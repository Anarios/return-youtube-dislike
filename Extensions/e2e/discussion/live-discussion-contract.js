const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const TIMEOUT_MS = 5000;
const DEFAULT_STAGES = [
  "render",
  "authoring",
  "access",
  "reactions",
  "sorting",
  "moderation",
  "notifications",
  "responsive",
  "keyboard",
  "cleanup",
  "navigation",
];

function safeDiagnostic(value) {
  return String(value)
    .replace(/(access_token|sessionToken|token)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 800);
}

async function bounded(work, label, timeout = TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeout}ms`)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_VIDEOS = {
  watch: "6Rt2HtMsP6M",
  shorts: "5QS-aIVIH9o",
  enabled: "sYi2Sf_Bysg",
};

function localClient(origin, accounts, onResponse = () => {}) {
  const url = new URL(origin);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Mutation tests require loopback API");
  assert.ok(
    ["http:", "https:"].includes(url.protocol) && !url.username && !url.password,
    "Invalid loopback API origin",
  );
  return async (route, { account, method = "GET", body, expected = 200 } = {}) => {
    const token = account ? accounts[account]?.sessionToken || accounts[account]?.token : null;
    if (account) assert.ok(token, `Missing local account: ${account}`);
    const response = await fetch(`${url.origin}/api/discussion${route}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await response.json().catch(() => null);
    onResponse({
      source: "loopback-client",
      method,
      path: `/api/discussion${route.split("?")[0]}`,
      status: response.status,
    });
    assert.equal(
      response.status,
      expected,
      `${method} ${route.split("?")[0]} failed: ${data?.code || response.status}`,
    );
    return data;
  };
}

function assertLocalRuntime(origin, runtime, health) {
  localClient(origin, {});
  assert.equal(health?.localTestMode, true, "Local discussion host marker is required");
  assert.match(runtime?.buildId || "", /^[a-f0-9]{32}$/, "Generated live build marker is required");
  assert.equal(runtime?.localOriginMatched, true, "Loaded extension must use the requested local discussion origin");
  assert.equal(runtime?.localHostPermission, true, "Loaded extension is missing its local test host permission");
  return { buildId: runtime.buildId, extensionId: runtime.extensionId, origin: new URL(origin).origin };
}

function createFixtureCleanup(request) {
  const comments = new Map();
  const pending = [];
  const hidden = new Set();
  const suspended = new Set();
  const reports = new Set();
  const remember = (comment, account) => {
    if (comment?.id) {
      comments.set(comment.id, { ...comment, account });
      for (const fixture of pending)
        if (
          fixture.account === account &&
          fixture.text === comment.text &&
          (fixture.parentId || null) === (comment.parentId || null)
        )
          fixture.resolvedId = comment.id;
    }
    return comment;
  };
  return {
    remember,
    pending,
    hidden,
    suspended,
    reports,
    async run() {
      const results = [];
      async function attempt(name, work) {
        try {
          await bounded(work, name);
          results.push({ name, passed: true });
        } catch (error) {
          results.push({ name, passed: false, message: safeDiagnostic(error.message) });
        }
      }
      for (const id of hidden)
        await attempt(`restore-comment:${id}`, () =>
          request(`/moderation/comments/${id}`, { account: "moderator", method: "POST", body: { hidden: false } }),
        );
      for (const id of suspended)
        await attempt(`restore-profile:${id}`, () =>
          request(`/moderation/profiles/${id}/suspension`, {
            account: "moderator",
            method: "POST",
            body: { suspended: false },
          }),
        );
      for (const fixture of pending.filter((item) => !item.resolvedId))
        await attempt(`discover-created:${fixture.label}`, async () => {
          const route = fixture.parentId
            ? `/comments/${fixture.parentId}/replies`
            : `/videos/${fixture.videoId}/comments?sort=new`;
          let cursor = null;
          const deadline = Date.now() + TIMEOUT_MS;
          do {
            const data = await request(
              `${route}${cursor ? `${route.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : ""}`,
              { account: fixture.account },
            );
            const found = (data.items || []).filter((comment) => comment.text === fixture.text);
            for (const comment of found) remember(comment, fixture.account);
            if (found.length) break;
            cursor = data.nextCursor;
            if (cursor && Date.now() >= deadline) throw new Error("Fixture discovery exceeded its deadline");
          } while (cursor);
        });
      for (const comment of [...comments.values()].sort((a, b) => Number(!!b.parentId) - Number(!!a.parentId)))
        await attempt(`delete-created:${comment.id}`, async () => {
          const current = await request(`/comments/${comment.id}`, { account: comment.account });
          if (!current.deleted)
            await request(`/comments/${comment.id}`, { account: comment.account, method: "DELETE" });
          const verified = await request(`/comments/${comment.id}`, { account: comment.account });
          assert.equal(verified.deleted, true, "Fixture deletion did not persist");
          assert.equal(verified.text, "", "Fixture body remains public");
        });
      for (const id of reports)
        await attempt(`dismiss-created:${id}`, () =>
          request(`/moderation/reports/${id}/dismiss`, { account: "moderator", method: "POST", body: {} }),
        );
      return results;
    },
  };
}

function solve(challenge, difficulty) {
  assert.ok(Number.isInteger(difficulty) && difficulty >= 0 && difficulty <= 24, "Invalid local puzzle difficulty");
  const buffer = Buffer.alloc(20);
  const decoded = Buffer.from(challenge, "base64");
  assert.equal(decoded.length, 16, "Invalid local puzzle challenge");
  decoded.copy(buffer, 4);
  const deadline = Date.now() + TIMEOUT_MS;
  for (let value = 0; value < 2 ** difficulty * 20; value++) {
    if (value % 1024 === 0 && Date.now() >= deadline) throw new Error("Local puzzle exceeded 5000ms");
    buffer.writeUInt32LE(value, 0);
    const digest = crypto.createHash("sha512").update(buffer).digest();
    let zeros = 0;
    for (const byte of digest) {
      if (byte === 0) zeros += 8;
      else {
        zeros += Math.clz32(byte) - 24;
        break;
      }
    }
    if (zeros >= difficulty) return buffer.subarray(0, 4).toString("base64");
  }
  throw new Error("Local reaction challenge exhausted");
}

async function poll(probe, accept, message, timeout = TIMEOUT_MS) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await bounded(probe, message, Math.max(1, deadline - Date.now()));
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, Math.min(150, Math.max(0, deadline - Date.now()))));
  }
  throw new Error(message);
}

/**
 * Runs selected stages against the generated extension on native YouTube.
 * Example: { surfaces: ["watch"], stages: ["authoring", "reactions"] }.
 * A render-only stage does not create comments. Other stages seed missing prerequisites through the loopback API.
 * The caller owns one persistent browser connection and switches YouTube UI language before each final run.
 */
async function runLiveDiscussionMatrix({
  page,
  popup,
  setAccount,
  accounts,
  origin,
  language,
  outputDirectory,
  videos = DEFAULT_VIDEOS,
  surfaces = ["watch", "shorts"],
  stages = DEFAULT_STAGES,
  checkpoint = () => {},
  notificationObserver,
  captureScreenshot,
}) {
  assert.ok(["en", "ru"].includes(language));
  assert.ok(surfaces.length && surfaces.every((value) => ["watch", "shorts"].includes(value)), "Invalid surfaces");
  assert.ok(
    stages.every((value) => DEFAULT_STAGES.includes(value)),
    "Invalid stages",
  );
  const selected = new Set(stages.length ? stages : ["render"]);
  page.setDefaultTimeout(TIMEOUT_MS);
  page.setDefaultNavigationTimeout(TIMEOUT_MS);
  popup.setDefaultTimeout(TIMEOUT_MS);
  await fs.mkdir(outputDirectory, { recursive: true });
  const results = [];
  const diagnostics = [];
  const ledger = [];
  const request = localClient(origin, accounts, (entry) => ledger.push(entry));
  const fixtures = createFixtureCleanup(request);
  const cleanupResults = [];
  const stageResults = [];
  const omissions = [
    ...DEFAULT_STAGES.filter((stage) => !selected.has(stage)).map((stage) => ({ stage, reason: "Not selected" })),
    ...[
      "native-language-menu",
      "native-theme-switch",
      "spa-and-recycled-shorts",
      "explicit-native-kids",
      "cross-tab-toasts",
      "offline-and-worker-restart",
      "cursor-pagination",
    ].map((stage) => ({ stage, reason: "Caller-owned supplementary acceptance" })),
    ...(!notificationObserver
      ? [{ stage: "native-signalr-frames", reason: "No native socket observer supplied; runtime inbox delivery only" }]
      : []),
  ];
  let runtime = null;
  const responseListener = (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(origin).origin || !url.pathname.startsWith("/api/discussion/")) return;
    ledger.push({
      source: "browser",
      method: response.request().method(),
      path: url.pathname,
      status: response.status(),
    });
  };
  const errorListener = (error) => diagnostics.push({ kind: "page", message: safeDiagnostic(error.message) });
  page.context().on("response", responseListener);
  page.on("pageerror", errorListener);
  const record = (name, details = {}) => {
    results.push({ name, passed: true, ...details });
    checkpoint(name);
  };
  const message = (operation, payload = {}) =>
    bounded(
      () =>
        popup.evaluate(
          ({ operation, payload }) => chrome.runtime.sendMessage({ message: "ryd_discussion", operation, payload }),
          { operation, payload },
        ),
      `Worker ${operation}`,
    );
  const root = () => page.locator("#ryd-discussion-panel, #ryd-discussion-drawer").filter({ visible: true });
  const row = (id) => root().locator(`[data-comment-id="${id}"]`);
  const actions = (id) => row(id).locator(":scope > .ryd-discussion-comment-actions");
  const editor = (id) => row(id).locator(":scope > .ryd-discussion-inline-editor");
  const profiles = new Map();
  async function ensureProfile(name) {
    let value = await request("/me", { account: name });
    if (!value.profile?.nickname)
      value = await request("/me/profile", {
        account: name,
        method: "PUT",
        body: { nickname: `Test ${name} ${crypto.randomBytes(3).toString("hex")}` },
      });
    profiles.set(name, value.profile?.id);
  }
  const checkLocale = async () => assert.ok((await page.locator("html").getAttribute("lang")).startsWith(language));
  async function account(name) {
    if (name && !profiles.has(name)) await ensureProfile(name);
    await bounded(() => setAccount(name), "Set local extension account");
    await poll(
      () => message("session"),
      (response) =>
        response.ok &&
        (name == null
          ? !response.data.authenticated
          : response.data.authenticated && response.data.profile?.id === profiles.get(name)),
      "Extension session did not converge",
    );
  }
  async function open(surface) {
    const deadline = Date.now() + 25000;
    const remaining = () => Math.max(1, deadline - Date.now());
    await bounded(
      async () => {
        await page.goto(
          `https://www.youtube.com/${surface === "watch" ? `watch?v=${videos.watch}` : `shorts/${videos.shorts}`}`,
          { waitUntil: "domcontentloaded", timeout: Math.min(TIMEOUT_MS, remaining()) },
        );
        await checkLocale();
        const native = await poll(
          () =>
            bounded(
              () =>
                page.evaluate(
                  ({ surface, videoId }) => {
                    const data = (node) => node?.polymerController?.data || node?.data;
                    if (surface === "shorts") {
                      const player = document.querySelector("#shorts-player");
                      let currentId;
                      try {
                        currentId = player?.getVideoData?.()?.video_id;
                      } catch {
                        return null;
                      }
                      const reel = player?.closest("ytd-reel-video-renderer");
                      if (currentId !== videoId || !reel) return null;
                      const buttons = [
                        ...(data(reel.querySelector("reel-action-bar-view-model"))?.buttonViewModels || []),
                        ...(data(reel)?.overlay?.reelPlayerOverlayRenderer?.buttonBar?.reelActionBarViewModel
                          ?.buttonViewModels || []),
                      ];
                      return buttons.some(
                        ({ buttonViewModel: button }) =>
                          button?.iconName === "SHORTS_COMMENT" && button.state === "BUTTON_VIEW_MODEL_STATE_DISABLED",
                      )
                        ? { videoId, evidence: "current-shorts-disabled-action" }
                        : null;
                    }
                    const watch = [...document.querySelectorAll("ytd-watch-flexy, ytd-watch-grid")].find(
                      (node) => node.getAttribute("video-id") === videoId,
                    );
                    if (!watch) return null;
                    const disabledLink = (value) => {
                      try {
                        const url = new URL(value, location.origin);
                        return url.hostname === "support.google.com" && url.pathname === "/youtube/answer/9706180";
                      } catch {
                        return false;
                      }
                    };
                    const hasNotice = (value, depth = 0) =>
                      value &&
                      typeof value === "object" &&
                      depth <= 14 &&
                      (value.messageRenderer?.text?.runs?.some((run) =>
                        disabledLink(run.navigationEndpoint?.urlEndpoint?.url),
                      ) ||
                        Object.values(value).some((child) => hasNotice(child, depth + 1)));
                    for (const comments of watch.querySelectorAll("ytd-comments")) {
                      comments.scrollIntoView({ block: "center" });
                      if (
                        comments.getBoundingClientRect().height > 0 &&
                        (hasNotice(data(comments)) ||
                          [...comments.querySelectorAll("ytd-message-renderer a[href]")].some((anchor) =>
                            disabledLink(anchor.href),
                          ))
                      )
                        return { videoId, evidence: "native-disabled-comments-notice" };
                    }
                    return null;
                  },
                  { surface, videoId: videos[surface] },
                ),
              "Inspect native YouTube anchor",
              Math.min(TIMEOUT_MS, remaining()),
            ),
          Boolean,
          "Native YouTube disabled-comments anchor did not hydrate",
          Math.min(20000, remaining()),
        );
        record(`${surface}:native-anchor-ready`, native);
        checkpoint(`${surface}:ryd-panel-wait`);
        await bounded(
          async () => {
            await poll(
              () => page.locator("html").getAttribute("data-ryd-extension-build"),
              (buildId) => buildId === runtime.buildId,
              "Content runtime does not match the guarded live build",
              Math.min(TIMEOUT_MS, remaining()),
            );
            if (surface === "shorts") {
              await page
                .locator("#ryd-discussion-launcher")
                .waitFor({ state: "visible", timeout: Math.min(TIMEOUT_MS, remaining()) });
              await page.locator("#ryd-discussion-launcher").click({ timeout: Math.min(TIMEOUT_MS, remaining()) });
            }
            await root().waitFor({ state: "visible", timeout: Math.min(TIMEOUT_MS, remaining()) });
            assert.equal(await root().count(), 1);
            assert.equal(await root().getAttribute("data-video-id"), videos[surface]);
          },
          "RYD panel readiness",
          Math.min(TIMEOUT_MS, remaining()),
        );
        record(`${surface}:ryd-panel-ready`);
      },
      "Open native video and discussion",
      25000,
    );
  }
  async function capture(name) {
    await poll(
      () =>
        root()
          .evaluate((node) => {
            node.scrollIntoView({ block: "center" });
            return node.isConnected;
          })
          .catch((error) => {
            if (/not attached|Execution context was destroyed/.test(error.message)) return false;
            throw error;
          }),
      Boolean,
      "The discussion container changed during screenshot preparation",
    );
    await bounded(
      () =>
        captureScreenshot
          ? captureScreenshot(page, path.join(outputDirectory, `${name}.png`))
          : page.screenshot({
              path: path.join(outputDirectory, `${name}.png`),
              animations: "disabled",
              mask: [page.locator("#avatar-btn")],
              timeout: TIMEOUT_MS,
            }),
      `Screenshot ${name}`,
    );
  }
  async function newest(id) {
    await root().locator(".ryd-discussion-thread > .ryd-discussion-toolbar select").selectOption("new");
    await row(id).waitFor({ state: "visible", timeout: TIMEOUT_MS });
  }
  const inboxEvents = () =>
    bounded(() => popup.evaluate(() => globalThis.__rydDiscussionLiveInboxEvents || []), "Read incoming inbox events");
  let failure = null;
  try {
    const health = await request("/local/health");
    const metadata = await bounded(
      () =>
        popup.evaluate(async (origin) => {
          const manifest = chrome.runtime.getManifest();
          const read = (name) => fetch(chrome.runtime.getURL(name), { signal: AbortSignal.timeout(5000) });
          const [markerResponse, backgroundResponse] = await Promise.all([
            read("live-build.json"),
            read("ryd.background.js"),
          ]);
          const marker = markerResponse.ok ? await markerResponse.json() : null;
          const background = backgroundResponse.ok ? await backgroundResponse.text() : "";
          return {
            extensionId: chrome.runtime.id,
            buildId: marker?.buildId,
            localOriginMatched: background.includes(`const testOrigin =  true ? ${JSON.stringify(origin)}`),
            localHostPermission:
              manifest.host_permissions?.some(
                (pattern) =>
                  pattern === `${origin}/*` || pattern === `${new URL(origin).protocol}//${new URL(origin).hostname}/*`,
              ) === true,
          };
        }, new URL(origin).origin),
      "Verify local extension runtime",
    );
    runtime = assertLocalRuntime(origin, metadata, health);
    record("local-runtime-and-host-guard", runtime);
    await bounded(
      () =>
        popup.evaluate(() => {
          if (globalThis.__rydDiscussionLiveInboxListener)
            chrome.runtime.onMessage.removeListener(globalThis.__rydDiscussionLiveInboxListener);
          globalThis.__rydDiscussionLiveInboxEvents = [];
          let sequence = 0;
          globalThis.__rydDiscussionLiveInboxListener = (event) => {
            if (event?.message !== "ryd_discussion_event" || event.type !== "inbox") return;
            globalThis.__rydDiscussionLiveInboxEvents.push({
              sequence: ++sequence,
              data: {
                unreadCount: event.data?.unreadCount,
                revision: event.data?.revision,
                items: (event.data?.items || []).map(({ id, commentId, type, read, revision }) => ({
                  id,
                  commentId,
                  type,
                  read,
                  revision,
                })),
              },
            });
            if (globalThis.__rydDiscussionLiveInboxEvents.length > 100)
              globalThis.__rydDiscussionLiveInboxEvents.shift();
          };
          chrome.runtime.onMessage.addListener(globalThis.__rydDiscussionLiveInboxListener);
        }),
      "Install incoming inbox observer",
    );
    for (const surface of surfaces) {
      const videoId = videos[surface];
      await account("commenter");
      const session = await message("session");
      if (!session.data.profile?.nickname) {
        const result = await message("profile", {
          nickname: `Test Commenter ${crypto.randomBytes(3).toString("hex")}`,
        });
        assert.equal(result.ok, true);
      }
      await open(surface);
      const marker = `${language} ${surface} ${crypto.randomUUID()}`;
      const text = `Local discussion check ${marker} <b>plain text</b>`;
      const composer = root().locator(".ryd-discussion-composer textarea[name=comment]");
      let comment;
      if (selected.has("authoring")) {
        const accountControls = root().locator(".ryd-discussion-composer .ryd-discussion-account button");
        if (await accountControls.count()) await accountControls.click();
        const nickname = `Live ${language} ${surface} ${crypto.randomBytes(3).toString("hex")}`;
        await root().locator('.ryd-discussion-composer input[name="nickname"]').fill(nickname);
        await root().locator('.ryd-discussion-composer button[type="submit"]').click();
        await poll(
          () => request("/me", { account: "commenter" }),
          (data) => data.profile?.nickname === nickname,
          "Nickname change did not persist",
        );
        await composer.waitFor({ state: "visible" });
        record(`${surface}:nickname-ui-change`);
        fixtures.pending.push({ label: `${surface}-root`, videoId, text, account: "commenter" });
        await composer.fill(text);
        await root().locator(".ryd-discussion-composer [data-action=post]").click();
        const created = await poll(
          () => request(`/videos/${videoId}/comments?sort=new`, { account: "commenter" }),
          (result) => result.items.some((item) => item.text === text),
          "Posted comment missing from authoritative list",
        );
        comment = fixtures.remember(
          created.items.find((item) => item.text === text),
          "commenter",
        );
        await newest(comment.id);
        assert.equal(await row(comment.id).locator(".ryd-discussion-comment-text").first().textContent(), text);
        assert.equal(await row(comment.id).locator(".ryd-discussion-comment-text b").count(), 0);
        record(`${surface}:create-plain-text`);

        await actions(comment.id).locator("[data-action=edit]").click();
        await editor(comment.id).locator("textarea[name=comment]").fill(`Edited ${text}`);
        await editor(comment.id).locator("[data-action=save]").click();
        await poll(
          () => request(`/comments/${comment.id}`, { account: "commenter" }),
          (data) => data.text === `Edited ${text}`,
          "Edit was not persisted",
        );
        record(`${surface}:edit`);

        await actions(comment.id).locator("[data-action=reply]").click();
        const replyText = `Reply ${marker}`;
        fixtures.pending.push({
          label: `${surface}-reply`,
          videoId,
          parentId: comment.id,
          text: replyText,
          account: "commenter",
        });
        await editor(comment.id).locator("textarea[name=comment]").fill(replyText);
        await editor(comment.id).locator("[data-action=post]").click();
        const replies = await poll(
          () => request(`/comments/${comment.id}/replies`, { account: "commenter" }),
          (data) => data.items.some((item) => item.text === replyText),
          "Reply was not persisted",
        );
        fixtures.remember(
          replies.items.find((item) => item.text === replyText),
          "commenter",
        );
        record(`${surface}:reply`);
        await capture(`${surface}-authoring`);
      }
      if (
        !comment &&
        ["access", "reactions", "sorting", "moderation", "notifications", "cleanup"].some((stage) =>
          selected.has(stage),
        )
      ) {
        fixtures.pending.push({ label: `${surface}-root`, videoId, text, account: "commenter" });
        comment = await request(`/videos/${videoId}/comments`, {
          account: "commenter",
          method: "POST",
          body: { text, requestId: crypto.randomUUID() },
        });
        fixtures.remember(comment, "commenter");
        await newest(comment.id);
        record(`${surface}:local-fixture`, { commentId: comment.id });
      }
      if (!stages.length || selected.has("render")) {
        await capture(`${surface}-render`);
        record(`${surface}:render`);
      }
      if (selected.has("access")) {
        await account("premium");
        await composer.waitFor({ state: "visible" });
        assert.equal((await message("session")).data.canPost, true);
        record(`${surface}:premium-posting-gate`);
        for (const name of ["supporter", "inactive"]) {
          await account(name);
          await poll(
            () => composer.count(),
            (count) => count === 0,
            `${name} account still has composer`,
          );
          assert.equal((await message("session")).data.canPost, false);
          record(`${surface}:${name}-posting-gate`);
        }
        await account(null);
        await newest(comment.id);
        assert.equal(await composer.count(), 0);
        await poll(
          () => actions(comment.id).locator("[data-action=edit]").count(),
          (count) => count === 0,
          "Signed-out author actions remain",
        );
        record(`${surface}:signed-out-author-controls`);
        await account("commenter");
        await newest(comment.id);
        await actions(comment.id).locator("[data-action=edit]").waitFor({ state: "visible" });
        record(`${surface}:author-controls-restored`);
      }
      if (selected.has("reactions")) {
        await account(null);
        await newest(comment.id);
        for (const value of [1, -1, -1]) {
          const button = actions(comment.id).locator(`[data-reaction="${value}"]`);
          await poll(() => button.isEnabled(), Boolean, "Reaction button not ready");
          const expected = (await button.getAttribute("aria-pressed")) === "true" ? 0 : value;
          const beforeValue =
            (await actions(comment.id).locator('[data-reaction="1"]').getAttribute("aria-pressed")) === "true"
              ? 1
              : (await actions(comment.id).locator('[data-reaction="-1"]').getAttribute("aria-pressed")) === "true"
                ? -1
                : 0;
          const before = await request(`/comments/${comment.id}`);
          await button.click();
          await poll(
            async () => ({
              enabled: await button.isEnabled(),
              like: await actions(comment.id).locator('[data-reaction="1"]').getAttribute("aria-pressed"),
              dislike: await actions(comment.id).locator('[data-reaction="-1"]').getAttribute("aria-pressed"),
            }),
            (state) =>
              state.enabled && state.like === String(expected === 1) && state.dislike === String(expected === -1),
            "Reaction did not match the requested transition",
          );
          const after = await request(`/comments/${comment.id}`);
          assert.equal(after.likes, before.likes - Number(beforeValue === 1) + Number(expected === 1));
          assert.equal(after.dislikes, before.dislikes - Number(beforeValue === -1) + Number(expected === -1));
        }
        assert.equal(await actions(comment.id).locator('[data-reaction="-1"]').getAttribute("aria-pressed"), "false");
        record(`${surface}:anonymous-like-dislike-remove`);
      }
      if (selected.has("sorting")) {
        for (const sort of ["new", "top"]) {
          const expected = await request(`/videos/${videoId}/comments?sort=${sort}`);
          await root().locator(".ryd-discussion-thread > .ryd-discussion-toolbar select").selectOption(sort);
          await poll(
            () =>
              root()
                .locator(".ryd-discussion-comments > [data-comment-id]")
                .evaluateAll((nodes) => nodes.map((node) => node.dataset.commentId)),
            (ids) => JSON.stringify(ids) === JSON.stringify(expected.items.map((item) => item.id)),
            `Rendered ${sort} order differs from API`,
          );
        }
        await newest(comment.id);
        record(`${surface}:sorting`);
      }
      if (selected.has("moderation")) {
        await ensureProfile("other");
        await ensureProfile("moderator");
        await account("other");
        await newest(comment.id);
        await actions(comment.id).locator("[data-action=report]").click();
        await editor(comment.id).locator("[data-action=send-report]").click();
        const submitted = await poll(
          () => request("/moderation/reports", { account: "moderator" }),
          (data) => data.items.some((item) => item.comment.id === comment.id),
          "Report not persisted",
        );
        const reportId = submitted.items.find((item) => item.comment.id === comment.id).id;
        fixtures.reports.add(reportId);
        await account("moderator");
        await root().locator("[data-action=moderation]").click();
        const report = root().locator(`[data-report-id="${reportId}"]`);
        await report.waitFor({ state: "visible" });
        fixtures.hidden.add(comment.id);
        await report.locator("[data-action=hide]").click();
        await report.locator("[data-action=restore]").waitFor({ state: "visible" });
        assert.equal((await request(`/comments/${comment.id}`)).hidden, true);
        fixtures.suspended.add(comment.author.id);
        await report.locator("[data-action=ban]").click();
        await report.locator("[data-action=unban]").waitFor({ state: "visible" });
        assert.equal((await request("/me", { account: "commenter" })).profile.suspended, true);
        await report.locator("[data-action=dismiss]").click();
        await report.waitFor({ state: "detached", timeout: TIMEOUT_MS });
        fixtures.reports.delete(reportId);
        await root().locator("[data-action=report-status]").selectOption("resolved");
        await report.waitFor({ state: "visible" });
        assert.ok(
          (await request("/moderation/reports?status=resolved", { account: "moderator" })).items.some(
            (item) => item.id === reportId,
          ),
        );
        await capture(`${surface}-moderation-history`);
        await report.locator("[data-action=restore]").click();
        await report.locator("[data-action=hide]").waitFor({ state: "visible" });
        assert.equal((await request(`/comments/${comment.id}`)).hidden, false);
        fixtures.hidden.delete(comment.id);
        await report.locator("[data-action=unban]").click();
        await report.locator("[data-action=ban]").waitFor({ state: "visible" });
        assert.equal((await request("/me", { account: "commenter" })).profile.suspended, false);
        fixtures.suspended.delete(comment.author.id);
        record(`${surface}:report-resolved-history-restore`);
      }
      if (selected.has("notifications")) {
        await ensureProfile("other");
        await account("commenter");
        await root().locator("[data-action=discussion]").click();
        const cleared = await message("readNotifications", { all: true });
        assert.equal(cleared.ok, true);
        for (const type of ["reply", "likes"]) {
          const nativeBaseline = notificationObserver
            ? await bounded(
                () => notificationObserver.beforeActivity({ surface, type, commentId: comment.id }),
                "Await native notification transport",
              )
            : null;
          const baseline = (await inboxEvents()).at(-1)?.sequence || 0;
          let activityId = comment.id;
          if (type === "reply") {
            const replyText = `Notification reply ${marker}`;
            fixtures.pending.push({
              label: `${surface}-notification-reply`,
              videoId,
              parentId: comment.id,
              text: replyText,
              account: "other",
            });
            const incomingReply = fixtures.remember(
              await request(`/videos/${videoId}/comments`, {
                account: "other",
                method: "POST",
                body: { text: replyText, parentId: comment.id, replyToId: comment.id, requestId: crypto.randomUUID() },
              }),
              "other",
            );
            activityId = incomingReply.id;
          } else {
            const userId = accounts.other.voterId;
            assert.ok(userId, "Missing separate local reaction identity");
            const challenge = await request(`/comments/${comment.id}/reaction/challenge`, {
              method: "POST",
              body: { userId, value: 1 },
            });
            await request(`/comments/${comment.id}/reaction/confirm`, {
              method: "POST",
              body: {
                userId,
                challengeId: challenge.challengeId,
                solution: solve(challenge.challenge, challenge.difficulty),
              },
            });
          }
          if (notificationObserver) {
            const proof = await bounded(
              () =>
                notificationObserver.afterActivity({ surface, type, commentId: activityId, baseline: nativeBaseline }),
              "Await native incoming notification frame",
            );
            assert.equal(proof?.observed, true, "Native notification observer must attest a received frame");
            record(`${surface}:${type}-native-signalr-frame`, {
              revision: proof.revision == null ? null : String(proof.revision),
              connection: Number.isInteger(proof.connection) ? proof.connection : null,
            });
          }
          // Observe incoming delivery before explicitly reading the inbox or opening its UI.
          const matches = (event) =>
            event.sequence > baseline &&
            event.data.items?.some((item) => item.commentId === activityId && item.type === type && !item.read);
          const incomingEvents = await poll(
            inboxEvents,
            (events) => events.some(matches),
            `Incoming runtime inbox event for ${type} did not arrive`,
          );
          const incoming = incomingEvents.find(matches);
          const notification = incoming.data.items.find(
            (item) => item.commentId === activityId && item.type === type && !item.read,
          );
          assert.ok(incoming.data.unreadCount > 0);
          record(`${surface}:${type}-notification-runtime-event`, {
            notificationId: notification.id,
            revision: incoming.data.revision,
          });
          await root().locator("[data-action=inbox]").click();
          const inboxRow = root().locator(`[data-notification-id="${notification.id}"]`);
          await inboxRow.waitFor({ state: "visible" });
          await capture(`${surface}-${type}-notifications`);
          await inboxRow.locator("button").click();
          await poll(
            () => request("/notifications", { account: "commenter" }),
            (data) => data.items.find((item) => item.id === notification.id)?.read === true,
            "UI mark read was not persisted",
          );
          record(`${surface}:${type}-inbox-ui-mark-read`);
          await root().locator("[data-action=discussion]").click();
        }
      }
      if (selected.has("responsive")) {
        const viewport = await bounded(
          () => page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
          "Read original viewport",
        );
        try {
          await bounded(() => page.setViewportSize({ width: 390, height: 844 }), "Set narrow viewport");
          await poll(
            () => root().boundingBox(),
            (box) => box && box.x >= -1 && box.x + box.width <= 392,
            "Discussion exceeds the narrow viewport",
          );
          await capture(`${surface}-390px`);
          record(`${surface}:responsive-390px`);
        } finally {
          await bounded(() => page.setViewportSize(viewport), "Restore viewport");
        }
        let previousBox = null;
        let stableSince = Date.now();
        await poll(
          async () => {
            const box = JSON.stringify(await root().boundingBox());
            if (box === "null" || box !== previousBox) stableSince = Date.now();
            previousBox = box;
            return Date.now() - stableSince >= 500;
          },
          Boolean,
          "Discussion layout did not settle after restoring the viewport",
        );
      }
      if (selected.has("keyboard")) {
        await account("commenter");
        await root().locator("[data-action=discussion]").click();
        await composer.focus();
        await bounded(() => page.keyboard.press("Tab"), "Keyboard Tab");
        assert.ok(
          await bounded(
            () => root().evaluate((node) => node.contains(document.activeElement)),
            "Inspect keyboard focus",
          ),
          "Keyboard Tab left the discussion panel",
        );
        if (surface === "shorts") {
          const controls = root().locator(
            "button:visible:not(:disabled), input:visible:not(:disabled), textarea:visible:not(:disabled), select:visible:not(:disabled), a[href]:visible",
          );
          await controls.last().focus();
          await bounded(() => page.keyboard.press("Tab"), "Drawer focus wrap");
          assert.ok(
            await bounded(
              () => controls.first().evaluate((node) => node === document.activeElement),
              "Inspect wrapped focus",
            ),
            "Drawer keyboard focus did not wrap to its first control",
          );
          await bounded(() => page.keyboard.press("Escape"), "Close drawer with Escape");
          await page.locator("#ryd-discussion-drawer").waitFor({ state: "hidden", timeout: TIMEOUT_MS });
          assert.ok(
            await bounded(
              () => page.locator("#ryd-discussion-launcher").evaluate((node) => node === document.activeElement),
              "Inspect launcher focus",
            ),
            "Closing the drawer did not return focus to its launcher",
          );
          await page.locator("#ryd-discussion-launcher").press("Enter");
          await root().waitFor({ state: "visible", timeout: TIMEOUT_MS });
        }
        const keyboardText = `Keyboard submission ${marker}`;
        fixtures.pending.push({ label: `${surface}-keyboard`, videoId, text: keyboardText, account: "commenter" });
        await composer.fill(keyboardText);
        await composer.press("Control+Enter");
        const created = await poll(
          () => request(`/videos/${videoId}/comments?sort=new`, { account: "commenter" }),
          (data) => data.items.some((item) => item.text === keyboardText),
          "Keyboard submission was not persisted",
        );
        const keyboardComment = fixtures.remember(
          created.items.find((item) => item.text === keyboardText),
          "commenter",
        );
        await capture(`${surface}-keyboard`);
        await request(`/comments/${keyboardComment.id}`, { account: "commenter", method: "DELETE" });
        record(`${surface}:keyboard-controls-and-submit`);
      }
      if (selected.has("cleanup") && comment) {
        await account("commenter");
        await root().locator("[data-action=discussion]").click();
        await newest(comment.id);
        const before = await request(`/comments/${comment.id}`);
        await actions(comment.id).locator("[data-action=delete]").click();
        await editor(comment.id).locator("[data-action=confirm-delete]").click();
        const deleted = await poll(
          () => request(`/comments/${comment.id}`),
          (data) => data.deleted === true,
          "Deleted comment did not become a tombstone",
        );
        assert.equal(deleted.text, "");
        assert.equal(deleted.replyCount, before.replyCount);
        record(`${surface}:delete-tombstone`);
      }
    }
    if (selected.has("navigation")) {
      await page.goto(`https://www.youtube.com/watch?v=${videos.enabled}`, { waitUntil: "domcontentloaded" });
      await page.locator("ytd-comments").first().scrollIntoViewIfNeeded({ timeout: TIMEOUT_MS });
      await page.locator("ytd-comments-header-renderer").first().waitFor({ state: "attached", timeout: TIMEOUT_MS });
      assert.equal(await page.locator("#ryd-discussion-panel,#ryd-discussion-launcher").count(), 0);
      record("enabled-video-excluded");
      await page.goBack({ waitUntil: "domcontentloaded" });
      const previous = surfaces.at(-1);
      await page
        .locator(previous === "shorts" ? "#ryd-discussion-launcher" : "#ryd-discussion-panel")
        .waitFor({ state: "visible", timeout: TIMEOUT_MS });
      record(`history-returns-to-${previous}`);
    }
    return {
      language,
      surfaces,
      stages,
      runtime,
      results,
      diagnostics,
      ledger,
      cleanupResults,
      stageResults,
      omissions,
    };
  } catch (error) {
    failure = { message: safeDiagnostic(error.message) };
    throw error;
  } finally {
    const completed = new Set(results.map((result) => result.name));
    const lastCheck = {
      render: "render",
      authoring: "reply",
      access: "author-controls-restored",
      reactions: "anonymous-like-dislike-remove",
      sorting: "sorting",
      moderation: "report-resolved-history-restore",
      notifications: "likes-inbox-ui-mark-read",
      responsive: "responsive-390px",
      keyboard: "keyboard-controls-and-submit",
      cleanup: "delete-tombstone",
    };
    for (const surface of surfaces)
      for (const [stage, check] of Object.entries(lastCheck))
        stageResults.push({
          surface,
          stage,
          status: !selected.has(stage)
            ? "not-selected"
            : completed.has(`${surface}:${check}`)
              ? "passed"
              : "not-completed",
        });
    stageResults.push({
      stage: "navigation",
      status: !selected.has("navigation")
        ? "not-selected"
        : completed.has(`history-returns-to-${surfaces.at(-1)}`)
          ? "passed"
          : "not-completed",
    });
    cleanupResults.push(...(await fixtures.run()));
    const cleanupFailed = cleanupResults.some((result) => !result.passed);
    if (cleanupFailed && !failure) failure = { message: "Local fixture cleanup failed; inspect cleanupResults" };
    page.context().off("response", responseListener);
    page.off("pageerror", errorListener);
    await bounded(
      () =>
        popup.evaluate(() => {
          if (globalThis.__rydDiscussionLiveInboxListener)
            chrome.runtime.onMessage.removeListener(globalThis.__rydDiscussionLiveInboxListener);
          delete globalThis.__rydDiscussionLiveInboxListener;
          delete globalThis.__rydDiscussionLiveInboxEvents;
        }),
      "Remove incoming inbox observer",
    ).catch(() => {});
    await fs.writeFile(
      path.join(outputDirectory, "results.json"),
      JSON.stringify(
        {
          language,
          surfaces,
          stages,
          runtime,
          results,
          diagnostics,
          ledger,
          cleanupResults,
          stageResults,
          omissions,
          failure,
        },
        null,
        2,
      ),
    );
    if (cleanupFailed && failure?.message === "Local fixture cleanup failed; inspect cleanupResults")
      throw new Error(failure.message);
  }
}

module.exports = {
  DEFAULT_VIDEOS,
  DEFAULT_STAGES,
  TIMEOUT_MS,
  bounded,
  assertLocalRuntime,
  createFixtureCleanup,
  localClient,
  poll,
  solve,
  runLiveDiscussionMatrix,
};
