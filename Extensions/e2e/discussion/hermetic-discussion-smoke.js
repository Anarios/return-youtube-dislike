const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const { bounded, localClient, poll, solve, TIMEOUT_MS } = require("./live-discussion-contract");

const REPOSITORY = path.resolve(__dirname, "../../..");
const ORIGIN = "http://127.0.0.1:5099";
const LANGUAGES = ["en", "ru"];
const SURFACES = ["watch", "shorts"];

function fixture({ language, surface, videoId, disabled = true, kids = false, dark = true }) {
  assert.ok(LANGUAGES.includes(language) && SURFACES.includes(surface));
  assert.match(videoId, /^[A-Za-z0-9_-]{11}$/);
  const options = JSON.stringify({ language, surface, videoId, disabled, kids });
  return `<!doctype html><html lang="${language}"${dark ? " dark" : ""}><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Discussion artifact fixture</title><style>
    *{box-sizing:border-box} body{margin:0;padding:24px;font:14px Arial,sans-serif;background:${dark ? "#0f0f0f" : "#fff"};color:${dark ? "#f1f1f1" : "#0f0f0f"}}
    [hidden]{display:none!important} ytd-watch-flexy,ytd-reel-video-renderer,ytd-comments,reel-action-bar-view-model{display:block}
    ytd-watch-flexy{width:min(920px,100%);margin:auto} ytd-comments{min-height:42px;margin-top:20px}
    #movie_player{height:120px;background:#222;margin-bottom:20px} #shorts-player{height:280px;background:#222;width:260px}
    ytd-reel-video-renderer{width:320px;max-width:100%;height:500px;margin:auto} reel-action-bar-view-model{min-height:80px}
    </style></head><body><main id="fixture-root"></main><script>
    (()=>{const o=${options};const root=document.createElement(o.surface==='watch'?'ytd-watch-flexy':'ytd-reel-video-renderer');
    const player=document.createElement('div');player.id=o.surface==='watch'?'movie_player':'shorts-player';
    player.getVideoData=()=>({video_id:o.videoId});player.getPlayerResponse=()=>({videoDetails:{videoId:o.videoId,...(o.kids?{isMadeForKids:true}:{})},
    endscreen:{videos:[{videoId:'OtherVideo1',isMadeForKids:true}]},adPlacements:[{videoDetails:{videoId:'OtherVideo2',madeForKids:true}}],
    microformat:{playerMicroformatRenderer:{recommendations:[{isMadeForKids:true}]}}});
    root.append(player);root.polymerController={data:o.kids?{isMadeForKids:true}:{}};
    if(o.surface==='watch'){root.setAttribute('video-id',o.videoId);const comments=document.createElement('ytd-comments');
    comments.textContent=o.disabled?(o.language==='ru'?'Комментарии отключены.':'Comments are turned off.'):'Native comments enabled';
    comments.polymerController={data:{contents:o.disabled?[{messageRenderer:{text:{runs:[{navigationEndpoint:{urlEndpoint:{url:'https://support.google.com/youtube/answer/9706180?hl='+o.language}}}]}}}]:[]}};root.append(comments);}
    else{const actions=document.createElement('reel-action-bar-view-model');actions.polymerController={data:{buttonViewModels:[{buttonViewModel:{iconName:'SHORTS_COMMENT',state:o.disabled?'BUTTON_VIEW_MODEL_STATE_DISABLED':'BUTTON_VIEW_MODEL_STATE_ENABLED'}}]}};root.append(actions);}
    document.querySelector('#fixture-root').append(root);window.ytInitialPlayerResponse=player.getPlayerResponse();
    window.__discussionFixture={setKids(value){root.polymerController.data=value?{isMadeForKids:true}:{};o.kids=value;window.ytInitialPlayerResponse=player.getPlayerResponse();document.dispatchEvent(new Event('yt-page-data-updated'));},
    setLanguage(value){document.documentElement.lang=value;document.dispatchEvent(new Event('yt-page-data-updated'));}};
    })();</script></body></html>`;
}

async function runHermeticDiscussionSmoke({
  artifactDirectory = process.env.RYD_DISCUSSION_ARTIFACT ||
    path.join(REPOSITORY, "test-results/discussion/generated/chrome"),
  outputDirectory = process.env.RYD_DISCUSSION_OUTPUT ||
    path.join(REPOSITORY, `test-results/discussion/hermetic-smoke-${Date.now()}`),
  notificationFocus = process.env.RYD_DISCUSSION_NOTIFICATIONS_ONLY === "true",
} = {}) {
  const healthResponse = await fetch(`${ORIGIN}/api/discussion/local/health`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).localTestMode, true, "Local discussion host is required");
  const marker = JSON.parse(await fs.readFile(path.join(artifactDirectory, "live-build.json"), "utf8"));
  assert.match(marker.buildId, /^[a-f0-9]{32}$/);
  const background = await fs.readFile(path.join(artifactDirectory, "ryd.background.js"), "utf8");
  assert.ok(background.includes(`const testOrigin =  true ? "${ORIGIN}"`), "Requires an explicit local-test build");
  await fs.mkdir(outputDirectory, { recursive: true });
  const seedResponse = await fetch(`${ORIGIN}/api/discussion/local/seed`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  assert.equal(seedResponse.status, 200);
  const { accounts } = await seedResponse.json();
  const ledger = [];
  const request = localClient(ORIGIN, accounts, (value) => ledger.push(value));
  const results = [];
  const screenshots = [];
  const errors = [];
  const created = [];
  const profilesToRestore = new Set();
  const commentsToRestore = new Set();
  const record = (name, detail = {}) => {
    results.push({ name, passed: true, ...detail });
    process.stdout.write(`PASS ${name}\n`);
  };
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory,
    headless: true,
    contextOptions: { viewport: { width: 1200, height: 900 } },
  });
  let currentFixture;
  let popup;
  let failure;
  try {
    await adapter.start();
    const { context, page, worker } = adapter;
    context.setDefaultTimeout(TIMEOUT_MS);
    context.setDefaultNavigationTimeout(TIMEOUT_MS);
    page.on("pageerror", (error) => errors.push({ name: error.name, message: error.message.slice(0, 200) }));
    await worker.evaluate(() => {
      const NativeWebSocket = globalThis.WebSocket;
      const probe = {
        sequence: 0,
        connection: 0,
        ticketChanges: 0,
        events: [],
        closed: [],
        ready: new Set(),
        sockets: new Map(),
      };
      let previousTicket = null;
      globalThis.__rydDiscussionSocketProbe = probe;
      globalThis.WebSocket = class extends NativeWebSocket {
        constructor(...args) {
          super(...args);
          const url = new URL(args[0]);
          if (url.origin !== "ws://127.0.0.1:5099" || url.pathname !== "/api/discussion/notifications/hub") return;
          const connection = ++probe.connection;
          const ticket = url.searchParams.get("access_token");
          if (previousTicket !== null && ticket && ticket !== previousTicket) probe.ticketChanges++;
          previousTicket = ticket;
          probe.sockets.set(connection, this);
          this.addEventListener("message", (event) => {
            for (const packet of String(event.data).split("\u001e")) {
              let message;
              try {
                message = JSON.parse(packet);
              } catch {
                continue;
              }
              if (message && Object.keys(message).length === 0) probe.ready.add(connection);
              if (message.target !== "NotificationsChanged" || !/^\d+$/.test(message.arguments?.[0]?.revision))
                continue;
              probe.events.push({
                sequence: ++probe.sequence,
                connection,
                target: message.target,
                revision: message.arguments[0].revision,
              });
              if (probe.events.length > 100) probe.events.shift();
            }
          });
          this.addEventListener("close", (event) => {
            probe.closed.push({ connection, code: event.code });
            probe.ready.delete(connection);
            probe.sockets.delete(connection);
          });
        }
      };
    });
    await context.route(`${ORIGIN}/**`, (route) => route.continue());
    await context.route("https://www.youtube.com/**", (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().resourceType() === "document" &&
        ["/watch", `/shorts/${currentFixture?.videoId}`].includes(url.pathname)
      )
        return route.fulfill({ contentType: "text/html", body: fixture(currentFixture) });
      return route.fulfill({ status: 404, body: "Fixture resource absent" });
    });
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${adapter.extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await popup.evaluate(() => {
      const probe = { sequence: 0, events: [] };
      globalThis.__rydDiscussionInboxProbe = probe;
      chrome.runtime.onMessage.addListener((message, sender) => {
        if (sender.id !== chrome.runtime.id || message.message !== "ryd_discussion_event" || message.type !== "inbox")
          return;
        probe.events.push({
          sequence: ++probe.sequence,
          revision: message.data.revision,
          items: (message.data.items || []).map((item) => ({
            id: item.id,
            commentId: item.commentId,
            type: item.type,
            read: item.read,
            revision: item.revision,
          })),
        });
        if (probe.events.length > 100) probe.events.shift();
      });
    });
    const operation = (name, payload = {}) =>
      bounded(
        () =>
          popup.evaluate(
            ({ name, payload }) => chrome.runtime.sendMessage({ message: "ryd_discussion", operation: name, payload }),
            { name, payload },
          ),
        `Worker ${name}`,
      );
    async function setAccount(name) {
      let expectedProfile = null;
      if (name) {
        const session = await request("/me", { account: name });
        expectedProfile = session.profile?.id || null;
      }
      await bounded(
        () =>
          worker.evaluate(
            ({ account, voter }) =>
              chrome.storage.local.set({
                rydDiscussionTestAuth: account ? { sessionToken: account.sessionToken } : null,
                rydDiscussionTestCredentials: { userId: voter, registrationConfirmed: true },
              }),
            { account: name ? accounts[name] : null, voter: accounts.commenter.voterId },
          ),
        "Set fixture account",
      );
      const result = await poll(
        () => operation("session"),
        (value) =>
          value.ok &&
          (name
            ? value.data.authenticated &&
              (value.data.profile?.id || null) === expectedProfile &&
              value.data.membershipTier ===
                {
                  commenter: "commenter",
                  other: "commenter",
                  premium: "premium",
                  moderator: "premium",
                  supporter: "supporter",
                  inactive: "none",
                }[name]
            : !value.data.authenticated),
        "Fixture session did not converge",
      );
      const refresh = page.locator(".ryd-discussion-thread > .ryd-discussion-toolbar > button");
      if (await refresh.count()) await expect(refresh).toBeEnabled();
      return result;
    }
    const socketSnapshot = () =>
      bounded(
        () =>
          worker.evaluate(() => {
            const probe = globalThis.__rydDiscussionSocketProbe;
            return {
              connection: probe.connection,
              ticketChanges: probe.ticketChanges,
              closed: probe.closed,
              ready: [...probe.ready],
              events: probe.events,
              open: [...probe.sockets].filter(([, socket]) => socket.readyState === 1).map(([id]) => id),
            };
          }),
        "Observe native SignalR frames",
      );
    const inboxSnapshot = () =>
      bounded(() => popup.evaluate(() => globalThis.__rydDiscussionInboxProbe), "Observe runtime inbox events");
    const root = () => page.locator("#ryd-discussion-panel, #ryd-discussion-drawer").filter({ visible: true });
    const row = (id) => root().locator(`[data-comment-id="${id}"]`);
    const composer = () => root().locator(".ryd-discussion-composer");
    async function open(options) {
      currentFixture = options;
      await page.goto(
        `https://www.youtube.com/${options.surface === "watch" ? `watch?v=${options.videoId}` : `shorts/${options.videoId}`}`,
        { waitUntil: "domcontentloaded" },
      );
      await expect(page.locator("html")).toHaveAttribute("data-ryd-extension-build", marker.buildId);
      if (options.kids || options.disabled === false) return;
      if (options.surface === "shorts") await page.locator("#ryd-discussion-launcher").click();
      await expect(root()).toHaveCount(1);
      await expect(root()).toHaveAttribute("data-video-id", options.videoId);
    }
    async function screenshot(name) {
      const file = `${name}.png`;
      await page.screenshot({ path: path.join(outputDirectory, file), timeout: TIMEOUT_MS });
      screenshots.push(file);
    }
    async function narrowScreenshot(name) {
      const viewport = page.viewportSize();
      try {
        await page.setViewportSize({ width: 390, height: 844 });
        const box = await root().boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= 391, "Narrow activity panel overflows viewport");
        await screenshot(`${name}-narrow`);
      } finally {
        await page.setViewportSize(viewport);
      }
    }
    async function ownNickname(language, surface) {
      if (await composer().locator(".ryd-discussion-account button").count())
        await composer().locator(".ryd-discussion-account button").click();
      const nickname = `Artifact ${language} ${surface} ${crypto.randomBytes(3).toString("hex")}`;
      await composer().locator('input[name="nickname"]').fill(nickname);
      await composer().locator('button[type="submit"]').click();
      await expect(composer().locator(".ryd-discussion-account")).toContainText(nickname);
      assert.equal((await request("/me", { account: "commenter" })).profile.nickname, nickname);
      return nickname;
    }
    async function createRoot(videoId, text) {
      await composer().locator("textarea").fill(text);
      await composer().locator('[data-action="post"]').click();
      const value = await poll(
        () => request(`/videos/${videoId}/comments?sort=new`),
        (list) => list.items.some((item) => item.text === text),
        "Created comment absent from local API",
      );
      const comment = value.items.find((item) => item.text === text);
      created.push({ id: comment.id, account: "commenter" });
      await expect(row(comment.id)).toBeVisible();
      return comment;
    }
    async function assertFallback(dark) {
      await page.evaluate((value) => {
        document.documentElement.toggleAttribute("dark", value);
        document.body.style.backgroundColor = value ? "#0f0f0f" : "#fff";
        document.body.style.color = value ? "#f1f1f1" : "#0f0f0f";
      }, dark);
      const colors = await root().evaluate((node) => {
        const input = node.querySelector("textarea");
        return {
          text: getComputedStyle(node).color,
          input: getComputedStyle(input).backgroundColor,
          inputText: getComputedStyle(input).color,
          nativeVariable: getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary"),
        };
      });
      assert.equal(colors.nativeVariable, "");
      assert.equal(colors.text, dark ? "rgb(241, 241, 241)" : "rgb(15, 15, 15)");
      assert.notEqual(colors.input, colors.inputText);
      return colors;
    }

    async function ensureProfile(account) {
      const session = await request("/me", { account });
      if (!session.profile?.nickname)
        await request("/me/profile", {
          account,
          method: "PUT",
          body: { nickname: `Artifact ${account} ${crypto.randomBytes(3).toString("hex")}` },
        });
    }

    async function moderation(comment, label) {
      await ensureProfile("other");
      await ensureProfile("moderator");
      await setAccount("other");
      await row(comment.id).locator(':scope > .ryd-discussion-comment-actions [data-action="report"]').click();
      await row(comment.id)
        .locator(":scope > .ryd-discussion-inline-editor textarea")
        .fill(`Artifact moderation ${label}`);
      await row(comment.id).locator(':scope > .ryd-discussion-inline-editor [data-action="send-report"]').click();
      const reports = await poll(
        () => request("/moderation/reports", { account: "moderator" }),
        (value) => value.items.some((item) => item.comment.id === comment.id),
        "Report absent from moderator queue",
      );
      const reportId = reports.items.find((item) => item.comment.id === comment.id).id;
      await setAccount("moderator");
      await root().locator('[data-action="moderation"]').click();
      const report = () => root().locator(`[data-report-id="${reportId}"]`);
      await expect(report()).toBeVisible();
      commentsToRestore.add(comment.id);
      await report().locator('[data-action="hide"]').click();
      await expect(report().locator('[data-action="restore"]')).toBeVisible();
      assert.equal((await request(`/comments/${comment.id}`)).hidden, true);
      profilesToRestore.add(comment.author.id);
      await report().locator('[data-action="ban"]').click();
      await expect(report().locator('[data-action="unban"]')).toBeVisible();
      assert.equal((await request("/me", { account: "commenter" })).profile.suspended, true);
      await report().locator('[data-action="dismiss"]').click();
      await expect(report()).toHaveCount(0);
      await root().locator('[data-action="report-status"]').selectOption("resolved");
      await expect(report()).toBeVisible();
      await expect(report().locator('[data-action="dismiss"]')).toHaveCount(0);
      await screenshot(`${label}-moderation-history`);
      await narrowScreenshot(`${label}-moderation-history`);
      await report().locator('[data-action="restore"]').click();
      await expect(report().locator('[data-action="hide"]')).toBeVisible();
      await report().locator('[data-action="unban"]').click();
      await expect(report().locator('[data-action="ban"]')).toBeVisible();
      assert.equal((await request(`/comments/${comment.id}`)).hidden, false);
      assert.equal((await request("/me", { account: "commenter" })).profile.suspended, false);
      commentsToRestore.delete(comment.id);
      profilesToRestore.delete(comment.author.id);
      record(`${label}-report-hide-ban-dismiss-history-restore-unban`, { reportId });
    }

    async function notifications(comment, label, catalog) {
      const previousConnection = (await socketSnapshot()).connection;
      await setAccount("commenter");
      await root().locator('[data-action="discussion"]').click();
      await poll(
        socketSnapshot,
        (value) => value.open.some((id) => id > previousConnection),
        "Current fixture SignalR socket did not open",
      );
      assert.equal((await operation("readNotifications", { all: true })).ok, true);
      await page.bringToFront();
      for (const type of ["reply", "likes"]) {
        const wireBaseline = await socketSnapshot();
        const inboxBaseline = await inboxSnapshot();
        let targetId = comment.id;
        if (type === "reply") {
          const reply = await request(`/videos/${comment.videoId}/comments`, {
            account: "other",
            method: "POST",
            body: {
              text: `Incoming artifact reply ${label} ${crypto.randomUUID()}`,
              parentId: comment.id,
              replyToId: comment.id,
              requestId: crypto.randomUUID(),
            },
          });
          targetId = reply.id;
          created.push({ id: reply.id, account: "other" });
        } else {
          const userId = accounts.other.voterId;
          const challenge = await request(`/comments/${comment.id}/reaction/challenge`, {
            method: "POST",
            body: { userId, value: 1 },
          });
          const confirmed = await request(`/comments/${comment.id}/reaction/confirm`, {
            account: "other",
            method: "POST",
            body: {
              userId,
              challengeId: challenge.challengeId,
              solution: solve(challenge.challenge, challenge.difficulty),
            },
          });
          assert.equal(confirmed.myReaction, 1);
        }
        const wireSequence = wireBaseline.events.at(-1)?.sequence || 0;
        await poll(
          socketSnapshot,
          (value) =>
            value.events.some((event) => event.sequence > wireSequence && wireBaseline.open.includes(event.connection)),
          "No incoming worker SignalR frame for fixture activity",
        );
        const observed = await poll(
          inboxSnapshot,
          (value) =>
            value.events.some(
              (event) =>
                event.sequence > inboxBaseline.sequence &&
                event.items.some((item) => item.commentId === targetId && item.type === type && !item.read),
            ),
          "No runtime inbox event for the new activity",
        );
        const envelope = observed.events.find(
          (event) =>
            event.sequence > inboxBaseline.sequence &&
            event.items.some((item) => item.commentId === targetId && item.type === type && !item.read),
        );
        const notification = envelope.items.find(
          (item) => item.commentId === targetId && item.type === type && !item.read,
        );
        const wire = (await socketSnapshot()).events.find(
          (event) =>
            event.sequence > wireSequence &&
            wireBaseline.open.includes(event.connection) &&
            BigInt(event.revision) >= BigInt(notification.revision),
        );
        assert.ok(wire, "Runtime inbox revision has no matching observed SignalR frame");
        record(`${label}-${type}-native-signalr-and-runtime-inbox`, {
          wire,
          notificationId: notification.id,
          revision: notification.revision,
        });
        await root().locator('[data-action="inbox"]').click();
        const notificationRow = root().locator(`[data-notification-id="${notification.id}"]`);
        await expect(notificationRow).toBeVisible();
        if (type === "likes") await expect(notificationRow).toContainText(catalog.discussion_notificationLike.message);
        await screenshot(`${label}-${type}-inbox`);
        await narrowScreenshot(`${label}-${type}-inbox`);
        await notificationRow.locator("button").click();
        await expect(notificationRow).not.toHaveClass(/is-unread/);
        await poll(
          () => request("/notifications", { account: "commenter" }),
          (value) => value.items.find((item) => item.id === notification.id)?.read === true,
          "Inbox mark-read did not persist",
        );
        record(`${label}-${type}-inbox-ui-and-mark-read`);
        await root().locator('[data-action="discussion"]').click();
        if (notificationFocus && type === "reply") {
          const before = await socketSnapshot();
          await bounded(
            () =>
              worker.evaluate(() => {
                for (const socket of globalThis.__rydDiscussionSocketProbe.sockets.values()) {
                  if (socket.readyState === 1) socket.close(4000, "Fixture reconnect");
                }
              }),
            "Close native fixture socket",
          );
          const reconnected = await poll(
            socketSnapshot,
            (value) =>
              value.closed.some((entry) => before.open.includes(entry.connection)) &&
              value.open.some((id) => id > before.connection && value.ready.includes(id)) &&
              value.ticketChanges > before.ticketChanges,
            "Worker did not reconnect with a fresh ticket after native socket closure",
          );
          record(`${label}-native-socket-close-reconnect-fresh-ticket`, {
            closedConnections: reconnected.closed.filter((entry) => before.open.includes(entry.connection)),
            newConnections: reconnected.open.filter((id) => id > before.connection),
            freshTicket: true,
          });
        }
      }
    }

    await setAccount(null);
    for (const language of LANGUAGES) {
      const catalog = JSON.parse(
        await fs.readFile(path.join(artifactDirectory, `_locales/${language}/messages.json`), "utf8"),
      );
      for (const surface of SURFACES) {
        const videoId = `H${crypto.randomBytes(8).toString("base64url").slice(0, 10)}`;
        const label = `${language}-${surface}`;
        await setAccount(null);
        await open({ language, surface, videoId, disabled: true, kids: false, dark: true });
        await expect(root().locator("h2")).toHaveText(catalog.discussion_title.message);
        await expect(composer().locator("textarea")).toHaveCount(0);
        await expect(composer()).toContainText(catalog.discussion_gate.message);
        record(`${label}-anonymous-unknown-kids-unrelated-kids-render`);

        await setAccount("commenter");
        const nickname = await ownNickname(language, surface);
        const comment = await createRoot(videoId, `Artifact comment ${label} ${crypto.randomUUID()}`);
        assert.equal(comment.author.nickname, nickname);
        record(`${label}-nickname-and-create`);

        if (notificationFocus) {
          await ensureProfile("other");
          await setAccount("other");
          await notifications(comment, label, catalog);
          continue;
        }

        await row(comment.id).locator(':scope > .ryd-discussion-comment-actions [data-action="reply"]').click();
        const replyText = `Artifact reply ${label} ${crypto.randomUUID()}`;
        await row(comment.id).locator(":scope > .ryd-discussion-inline-editor textarea").fill(replyText);
        await row(comment.id).locator(':scope > .ryd-discussion-inline-editor [data-action="post"]').click();
        const replies = await poll(
          () => request(`/comments/${comment.id}/replies`),
          (value) => value.items.some((item) => item.text === replyText),
          "Reply absent from local API",
        );
        const reply = replies.items.find((item) => item.text === replyText);
        created.push({ id: reply.id, account: "commenter" });
        assert.equal(reply.parentId, comment.id);
        await expect(row(reply.id)).toBeVisible();
        record(`${label}-reply`);

        const darkColors = await assertFallback(true);
        await screenshot(`${label}-dark`);
        const lightColors = await assertFallback(false);
        await screenshot(`${label}-light`);
        record(`${label}-theme-fallback`, { darkColors, lightColors });
        await assertFallback(true);

        for (const account of ["premium", "supporter", "inactive"]) {
          await setAccount(account);
          if (account === "premium")
            await expect(composer().locator("textarea, input[name='nickname']")).toHaveCount(1);
          else await expect(composer().locator("textarea, input[name='nickname']")).toHaveCount(0);
          record(`${label}-${account}-gate`);
        }
        await setAccount(null);
        await expect(composer().locator("textarea")).toHaveCount(0);
        await expect(
          row(comment.id).locator(':scope > .ryd-discussion-comment-actions [data-action="edit"]'),
        ).toHaveCount(0);
        for (const [value, expectedLike, expectedDislike] of [
          [1, 1, 0],
          [-1, 0, 1],
          [-1, 0, 0],
        ]) {
          const reaction = row(comment.id).locator(
            `:scope > .ryd-discussion-comment-actions [data-reaction="${value}"]`,
          );
          await expect(reaction).toBeEnabled();
          await reaction.click();
          await poll(
            () => request(`/comments/${comment.id}`),
            (item) => item.likes === expectedLike && item.dislikes === expectedDislike,
            "Anonymous reaction count did not converge",
          );
          await expect(reaction).toBeEnabled();
          await expect(reaction).toHaveAttribute(
            "aria-pressed",
            String((value === 1 ? expectedLike : expectedDislike) === 1),
          );
        }
        record(`${label}-anonymous-like-dislike-remove`);

        await setAccount("commenter");
        await expect(composer().locator("textarea")).toHaveCount(1);
        await expect(
          row(comment.id).locator(':scope > .ryd-discussion-comment-actions [data-action="edit"]'),
        ).toHaveCount(1);
        await page.setViewportSize({ width: 390, height: 844 });
        const box = await root().boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= 391, "Panel overflows narrow viewport");
        await screenshot(`${label}-narrow`);
        await page.setViewportSize({ width: 1200, height: 900 });
        if (surface === "shorts") {
          await root().locator("textarea").first().focus();
          await page.keyboard.press("Escape");
          await expect(page.locator("#ryd-discussion-drawer")).toBeHidden();
          await expect(page.locator("#ryd-discussion-launcher")).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(root()).toBeVisible();
        }
        record(`${label}-responsive-and-owner-restoration`);

        await moderation(comment, label);
        await notifications(comment, label, catalog);

        await page.evaluate(() => window.__discussionFixture.setKids(true));
        await expect(
          page.locator("#ryd-discussion-panel, #ryd-discussion-launcher, #ryd-discussion-drawer"),
        ).toHaveCount(0);
        await page.evaluate(() => window.__discussionFixture.setKids(false));
        if (surface === "shorts")
          await expect(page.locator("#ryd-discussion-launcher")).toHaveAttribute("aria-expanded", "true");
        await expect(root()).toHaveCount(1);
        record(`${label}-positive-kids-excluded-unknown-restored`);

        await open({ language, surface, videoId, disabled: false, kids: false, dark: true });
        await page.waitForTimeout(300);
        await expect(
          page.locator("#ryd-discussion-panel, #ryd-discussion-launcher, #ryd-discussion-drawer"),
        ).toHaveCount(0);
        record(`${label}-native-enabled-excluded`);
      }
    }
    assert.equal(errors.length, 0, "Fixture page had uncaught errors");
    record("no-uncaught-fixture-page-errors");
  } catch (error) {
    failure = {
      name: error.name,
      message: String(error.message)
        .replace(/(access_token|sessionToken|token)=[^&\s]+/gi, "$1=[redacted]")
        .slice(0, 2500),
    };
    if (adapter.page)
      await adapter.page
        .screenshot({ path: path.join(outputDirectory, "failure.png"), timeout: TIMEOUT_MS })
        .catch(() => {});
  } finally {
    for (const id of commentsToRestore) {
      await request(`/moderation/comments/${id}`, {
        account: "moderator",
        method: "POST",
        body: { hidden: false },
      }).catch(() => errors.push({ name: "RestoreCommentError", commentId: id }));
    }
    for (const id of profilesToRestore) {
      await request(`/moderation/profiles/${id}/suspension`, {
        account: "moderator",
        method: "POST",
        body: { suspended: false },
      }).catch(() => errors.push({ name: "RestoreProfileError", profileId: id }));
    }
    for (const { id, account } of created.reverse()) {
      try {
        await request(`/comments/${id}`, { account, method: "DELETE" });
      } catch {
        errors.push({ name: "CleanupError", commentId: id });
      }
    }
    await bounded(() => adapter.close(), "Close disposable profile", 10000).catch(() =>
      errors.push({ name: "BrowserCleanupError" }),
    );
    await bounded(() => apiServer.close(), "Close fixture server", TIMEOUT_MS).catch(() =>
      errors.push({ name: "ServerCleanupError" }),
    );
    await fs.writeFile(
      path.join(outputDirectory, "result.json"),
      JSON.stringify(
        {
          kind: "hermetic-generated-artifact",
          scope: notificationFocus ? "notifications-and-reconnect" : "discussion-smoke",
          buildId: marker.buildId,
          artifactDirectory,
          results,
          screenshots,
          ledger,
          errors,
          failure: failure || null,
          limitations: [
            "Fixture YouTube pages, not live YouTube",
            "Headless disposable Chromium profile",
            "No live account OAuth",
            "No live YouTube toasts or cross-tab notification deduplication scenario",
            "Native Firefox and Safari not exercised",
          ],
        },
        null,
        2,
      ),
    );
  }
  assert.equal(failure, undefined, failure?.message);
  assert.equal(errors.length, 0, "Smoke cleanup or diagnostics failed");
  return {
    kind: "hermetic-generated-artifact",
    scope: notificationFocus ? "notifications-and-reconnect" : "discussion-smoke",
    buildId: marker.buildId,
    assertions: results.length,
    outputDirectory,
  };
}

if (require.main === module)
  runHermeticDiscussionSmoke()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });

module.exports = { fixture, runHermeticDiscussionSmoke };
