const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const VIDEO_A = "abcdefghijk";
const VIDEO_B = "zyxwvutsrqp";
const COMMENT_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(operation, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await operation();
    if (result) return result;
    await delay(100);
  }
  throw new Error("Timed out waiting for " + description);
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}
function identityFlags(record) {
  const text = JSON.stringify({ query: record.query, body: record.body });
  const hasVoterId = /"userId"\s*:|"user_id"\s*:/i.test(text);
  return { hasVoterId, hasAuthorization: record.hasAuthorization === true };
}
function assertNoIdentity(records) {
  for (const record of records) {
    assert(
      !/\/puzzle\/registration|\/interact\/|\/reactions\/state/.test(record.path),
      "Passive mutation: " + JSON.stringify(record),
    );
    const flags = identityFlags(record);
    assert(!flags.hasVoterId && !flags.hasAuthorization, "Passive identity: " + JSON.stringify(record));
  }
}
function assertNoLinkedIdentity(records) {
  for (const record of records) {
    const flags = identityFlags(record);
    assert(
      !(flags.hasVoterId && flags.hasAuthorization),
      "Linked voter and account identities: " + JSON.stringify(record),
    );
    assert(!record.path.endsWith("/reactions/state"), "Unexpected reactions/state lookup");
  }
}
async function startFixtures(evidence, options = {}) {
  await fs.mkdir(evidence, { recursive: true });
  const key = path.join(evidence, "fixture-key.pem");
  const cert = path.join(evidence, "fixture-cert.pem");
  execFileSync(
    process.env.RYD_OPENSSL_BINARY || "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "2",
      "-subj",
      "/CN=www.youtube.com",
      "-addext",
      "subjectAltName=DNS:www.youtube.com",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const navigationPage = await fs.readFile(
    path.join(ROOT, "Extensions/UserScript/e2e/fixtures/navigation-page.html"),
    "utf8",
  );
  const youtubeCascade = await fs.readFile(path.join(__dirname, "fixtures/youtube-cascade.css"), "utf8");
  assert.equal(navigationPage.split("</head>").length, 2, "Fixture page needs exactly one head");
  const navigation = navigationPage.replace("</head>", `<style id="youtube-cascade">${youtubeCascade}</style></head>`);
  const records = [];
  const blocked = [];
  const unknown = [];
  const sockets = new Set();
  const hubSockets = new Set();
  const hubLifecycle = [];
  let hubAvailable = options.hubAvailable !== false;
  let notifications = structuredClone(
    options.notifications || { items: [], unreadCount: 0, revision: "0", nextCursor: null },
  );
  const serverFrame = (message) => {
    const payload = Buffer.from(JSON.stringify(message) + "\u001e");
    if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
    assert(payload.length <= 65535, "Fixture WebSocket message is too large");
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  };
  let reaction = 0;
  let membershipTier = options.membershipTier || "commenter";
  const heldVotes = new Map();
  const comment = (videoId = VIDEO_B) => ({
    id: COMMENT_ID,
    videoId,
    author: { id: "33333333-3333-4333-8333-333333333333", nickname: "Fixture author" },
    text: "Fixture comment",
    createdAt: "2026-10-25T12:00:00Z",
    likes: reaction === 1 ? 1 : 0,
    dislikes: reaction === -1 ? 1 : 0,
    replyCount: 0,
  });
  const api = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    let bodyText = "";
    for await (const chunk of request) bodyText += chunk;
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }
    const record = {
      at: Date.now(),
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body,
      hasAuthorization: !!request.headers.authorization,
    };
    records.push(record);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Content-Type": "application/json",
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, headers);
      response.end();
      return;
    }
    let result;
    if (url.pathname === "/configs/selectors")
      result = { rateBar: { oldDesignActions: ["#top-level-buttons-computed"] } };
    else if (url.pathname === "/votes")
      result = { id: url.searchParams.get("videoId"), likes: 100, dislikes: 25, rating: 4.5 };
    else if (url.pathname === "/puzzle/registration")
      result = request.method === "POST" ? true : { challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 };
    else if (url.pathname === "/interact/vote") result = { challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 };
    else if (url.pathname === "/interact/confirmVote") result = true;
    else if (url.pathname === "/api/discussion/capabilities") result = { enabled: true, maxCommentLength: 2000 };
    else if (url.pathname === "/api/auth/verify")
      result = {
        valid: true,
        membershipTier,
        user: { membershipTier, hasActiveMembership: true },
      };
    else if (url.pathname === "/api/discussion/me")
      result = {
        authenticated: true,
        canPost: true,
        isModerator: false,
        membershipTier,
        profile: { id: PROFILE_ID, nickname: "Fixture member", suspended: false },
      };
    else if (/^\/api\/patreon\/analytics\/video\/[^/]+$/.test(url.pathname))
      result = {
        videoId: url.pathname.split("/").at(-1),
        summary: { totalLikes: 100, totalDislikes: 25, totalVotes: 125, countriesRepresented: 0, uniqueIps: 0 },
        timeSeries: {
          bucket: "day",
          totalRangeStartUtc: "2026-10-24T00:00:00Z",
          totalRangeEndUtc: "2026-10-26T00:00:00Z",
          selectedRangeStartUtc: "2026-10-24T00:00:00Z",
          selectedRangeEndUtc: "2026-10-26T00:00:00Z",
          points: [
            { timestampUtc: "2026-10-24T00:00:00Z", likes: 75, dislikes: 15 },
            { timestampUtc: "2026-10-25T00:00:00Z", likes: 25, dislikes: 10 },
          ],
        },
        geo: { countries: [], subdivisions: [], topLikes: [], topDislikes: [] },
      };
    else if (url.pathname === "/api/discussion/notifications/ticket")
      result = { token: "fixture-hub-ticket", expiresAt: "2099-01-01T00:00:00Z" };
    else if (url.pathname === "/api/discussion/notifications") result = structuredClone(notifications);
    else if (url.pathname.endsWith("/reaction/challenge"))
      result = { challengeId: COMMENT_ID, challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 };
    else if (url.pathname.endsWith("/reaction/confirm")) {
      reaction = body?.value ?? 1;
      result = {
        commentId: COMMENT_ID,
        likes: reaction === 1 ? 1 : 0,
        dislikes: reaction === -1 ? 1 : 0,
        myReaction: reaction,
      };
    } else if (/^\/api\/discussion\/videos\/[^/]+\/comments$/.test(url.pathname))
      result =
        request.method === "POST"
          ? comment(url.pathname.split("/")[4])
          : { items: [comment(url.pathname.split("/")[4])], nextCursor: null };
    else if (url.pathname === "/api/discussion/comments/" + COMMENT_ID) result = comment();
    else if (url.pathname.endsWith("/replies")) result = { items: [], nextCursor: null };
    else {
      unknown.push(record);
      response.writeHead(404, headers);
      response.end("{}");
      return;
    }
    record.status = 200;
    const held = url.pathname === "/votes" && heldVotes.get(url.searchParams.get("videoId"));
    if (held) {
      held.push({ response, headers, result, record });
      return;
    }
    response.writeHead(200, headers);
    response.end(JSON.stringify(result));
  });
  api.on("upgrade", (request, socket) => {
    socket.on("error", () => socket.destroy());
    const url = new URL(request.url, "http://localhost");
    const record = {
      at: Date.now(),
      method: "WEBSOCKET",
      path: url.pathname,
      query: { ticketPresent: url.searchParams.has("access_token") },
      body: null,
      hasAuthorization: !!request.headers.authorization,
    };
    records.push(record);
    if (url.pathname !== "/api/discussion/notifications/hub") {
      socket.destroy();
      return;
    }
    if (!hubAvailable) {
      record.status = 503;
      socket.end("HTTP/1.1 503 Fixture hub unavailable\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    record.status = 101;
    sockets.add(socket);
    hubSockets.add(socket);
    hubLifecycle.push({ at: Date.now(), event: "connected", active: hubSockets.size });
    socket.on("close", () => sockets.delete(socket));
    socket.on("close", () => {
      hubSockets.delete(socket);
      hubLifecycle.push({ at: Date.now(), event: "closed", active: hubSockets.size });
    });
    const accept = crypto
      .createHash("sha1")
      .update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
        accept +
        "\r\n\r\n",
    );
    let handshaken = false;
    let incoming = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      incoming = Buffer.concat([incoming, chunk]);
      while (incoming.length >= 2) {
        const opcode = incoming[0] & 15;
        const masked = (incoming[1] & 128) !== 0;
        let length = incoming[1] & 127;
        let offset = 2;
        if (length === 126) {
          if (incoming.length < 4) return;
          length = incoming.readUInt16BE(2);
          offset = 4;
        }
        if (length === 127) {
          socket.destroy();
          return;
        }
        const maskLength = masked ? 4 : 0;
        if (incoming.length < offset + maskLength + length) return;
        const mask = incoming.subarray(offset, offset + maskLength);
        offset += maskLength;
        const payload = Buffer.from(incoming.subarray(offset, offset + length));
        if (masked) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
        incoming = incoming.subarray(offset + length);
        if (opcode === 8) {
          hubLifecycle.push({ at: Date.now(), event: "client-close" });
          socket.end(Buffer.concat([Buffer.from([0x88, payload.length]), payload]));
          return;
        }
        if (opcode === 9) {
          socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
          continue;
        }
        if (opcode === 1 && !handshaken) {
          handshaken = true;
          socket.write(Buffer.from([0x81, 3, 123, 125, 30]));
        }
      }
    });
  });
  const apiOrigin = "http://127.0.0.1:" + (await listen(api));
  const website = https.createServer(
    { key: await fs.readFile(key), cert: await fs.readFile(cert) },
    (request, response) => {
      const url = new URL(request.url, "https://www.youtube.com");
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      const videoId = url.pathname.startsWith("/shorts/")
        ? url.pathname.split("/")[2]
        : url.searchParams.get("v") || VIDEO_A;
      const kind = url.pathname.startsWith("/shorts/") ? "shorts" : url.pathname === "/watch" ? "watch" : "channel";
      const html = navigation
        .replaceAll("__VIDEO_ID__", videoId)
        .replaceAll("__SECOND_VIDEO_ID__", VIDEO_B)
        .replaceAll("__VIDEO_LIKES__", "100")
        .replaceAll("__SECOND_VIDEO_LIKES__", "100")
        .replaceAll("__INITIAL_PAGE_KIND__", kind);
      response.setHeader("Content-Type", "text/html");
      response.end(html);
    },
  );
  const websitePort = await listen(website);
  const proxy = http.createServer((request, response) => {
    blocked.push({ method: request.method, host: new URL(request.url).hostname });
    response.writeHead(502);
    response.end();
  });
  proxy.on("connect", (request, socket, head) => {
    socket.on("error", () => socket.destroy());
    if (request.url !== "www.youtube.com:443") {
      blocked.push({ method: "CONNECT", host: request.url });
      socket.end("HTTP/1.1 502 Isolated test\r\n\r\n");
      return;
    }
    const upstream = net.connect(websitePort, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    sockets.add(socket);
    sockets.add(upstream);
    for (const stream of [socket, upstream]) {
      stream.on("error", () => stream.destroy());
      stream.on("close", () => sockets.delete(stream));
    }
  });
  const proxyPort = await listen(proxy);
  return {
    apiOrigin,
    proxyOrigin: "http://127.0.0.1:" + proxyPort,
    proxyPort,
    records,
    blocked,
    unknown,
    holdVotes(videoId) {
      assert(!heldVotes.has(videoId), "Votes are already held for this fixture video");
      heldVotes.set(videoId, []);
    },
    heldVoteCount(videoId) {
      return heldVotes.get(videoId)?.length || 0;
    },
    releaseVotes(videoId, overrides = {}) {
      const held = heldVotes.get(videoId);
      assert(held, "No held votes for this fixture video");
      heldVotes.delete(videoId);
      for (const { response, headers, result, record } of held) {
        record.heldResponseReleased = true;
        record.responseClosedBeforeRelease = response.destroyed;
        if (response.destroyed) continue;
        response.writeHead(200, headers);
        response.end(JSON.stringify({ ...result, ...overrides }));
      }
      return held.length;
    },
    setMembershipTier(value) {
      assert(["commenter", "premium"].includes(value));
      membershipTier = value;
    },
    hubLifecycle,
    get hubConnections() {
      return hubSockets.size;
    },
    setHubAvailable(available) {
      hubAvailable = available;
      hubLifecycle.push({ at: Date.now(), event: "availability", available });
    },
    setNotifications(value) {
      assert(/^(0|[1-9][0-9]*)$/.test(value.revision));
      notifications = structuredClone(value);
    },
    dropHubConnections() {
      hubLifecycle.push({ at: Date.now(), event: "terminal-drop", active: hubSockets.size });
      for (const socket of hubSockets) {
        socket.write(serverFrame({ type: 7, error: "Fixture terminal disconnect", allowReconnect: false }));
        setTimeout(() => socket.end(), 25);
      }
    },
    publishNotificationHint() {
      for (const socket of hubSockets)
        socket.write(
          serverFrame({ type: 1, target: "NotificationsChanged", arguments: [{ revision: notifications.revision }] }),
        );
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      api.closeAllConnections();
      website.closeAllConnections();
      proxy.closeAllConnections();
      await Promise.all([api, website, proxy].map((server) => new Promise((resolve) => server.close(resolve))));
    },
  };
}
async function prepareArtifact(source, destination, origin) {
  await fs.cp(source, destination, { recursive: true });
  const hashes = {};
  const manifest = JSON.parse(await fs.readFile(path.join(destination, "manifest.json"), "utf8"));
  if (manifest.browser_specific_settings?.gecko)
    hashes["consent.js"] = crypto
      .createHash("sha256")
      .update(await fs.readFile(path.join(destination, "consent.js")))
      .digest("hex");
  for (const file of ["ryd.background.js", "ryd.content-script.js", "popup.js"]) {
    const filename = path.join(destination, file);
    const original = await fs.readFile(filename, "utf8");
    hashes[file] = crypto.createHash("sha256").update(original).digest("hex");
    assert(original.includes("https://returnyoutubedislikeapi.com"), file + " has no production API origin");
    await fs.writeFile(filename, original.replaceAll("https://returnyoutubedislikeapi.com", origin));
  }
  const key = manifest.manifest_version === 3 ? "host_permissions" : "permissions";
  const apiUrl = new URL(origin);
  manifest[key] = [...(manifest[key] || []), apiUrl.protocol + "//" + apiUrl.hostname + "/*"];
  await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2));
  return {
    manifest,
    sourceHashes: hashes,
    derivation:
      "Replace API origin in generated bundles and add owned loopback host permission only; production artifacts remain unchanged.",
  };
}
function configureDisabledComments() {
  const root = document.querySelector("ytd-watch-flexy[video-id],ytd-watch-grid[video-id]");
  if (!root) return false;
  let comments = root.querySelector("ytd-comments");
  if (!comments) {
    comments = document.createElement("ytd-comments");
    root.append(comments);
  }
  comments.innerHTML =
    '<ytd-message-renderer><a href="https://support.google.com/youtube/answer/9706180">Comments are disabled.</a></ytd-message-renderer>';
  comments.data = {
    contents: [
      {
        messageRenderer: {
          text: {
            runs: [
              { navigationEndpoint: { urlEndpoint: { url: "https://support.google.com/youtube/answer/9706180" } } },
            ],
          },
        },
      },
    ],
  };
  return true;
}
function navigateFixture(kind, videoId, disabled = false) {
  const fixture = window.__navigationFixture || window.wrappedJSObject?.__navigationFixture;
  fixture.navigate(kind, videoId);
  if (kind === "channel") {
    history.replaceState({}, "", videoId === "search" ? "/results?search_query=fixture" : "/");
    document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
  }
  return { path: location.pathname, videoId };
}
module.exports = {
  ROOT,
  VIDEO_A,
  VIDEO_B,
  COMMENT_ID,
  PROFILE_ID,
  delay,
  until,
  listen,
  startFixtures,
  prepareArtifact,
  configureDisabledComments,
  navigateFixture,
  identityFlags,
  assertNoIdentity,
  assertNoLinkedIdentity,
};
