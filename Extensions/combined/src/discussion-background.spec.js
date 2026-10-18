import { createDiscussionBackground, ANONYMOUS_SESSION } from "./discussion-background";

const ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "33333333-3333-4333-8333-333333333333";
const VIDEO_ID = "video123456";
const ORIGIN = "https://returnyoutubedislikeapi.com";
const SCOPE = { id: "44444444-4444-4444-8444-444444444444", videoId: VIDEO_ID };
const VIDEO_OPERATIONS = new Set([
  "comments",
  "replies",
  "comment",
  "createComment",
  "editComment",
  "deleteComment",
  "react",
  "report",
  "cancelScope",
]);
const sender = {
  id: "extension-id",
  url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  tab: { id: 1, url: `https://www.youtube.com/watch?v=${VIDEO_ID}` },
  frameId: 0,
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function extensionView(incognito, url = "moz-extension://extension-id/popup.html") {
  return {
    browser: { extension: { inIncognitoContext: incognito } },
    location: { href: url },
    CustomEvent: jest.fn(function (type, options) {
      return { type, detail: options.detail };
    }),
    dispatchEvent: jest.fn(),
  };
}

function storageArea(data = {}) {
  return {
    data,
    get: jest.fn((keys, callback) => callback(Object.fromEntries(keys.map((key) => [key, data[key]])))),
    set: jest.fn((values, callback) => {
      Object.assign(data, values);
      callback?.();
    }),
    remove: jest.fn((keys, callback) => {
      keys.forEach((key) => delete data[key]);
      callback?.();
    }),
  };
}

function harness({
  authenticated = false,
  consent = true,
  fetchOverride,
  accountFetchImpl,
  testMode = false,
  solveOverride,
  firefox = false,
  views = [],
} = {}) {
  const sync = storageArea(authenticated ? { patreonAuthenticated: true, patreonSessionToken: "account-token" } : {});
  const local = storageArea();
  let alarmListener;
  const api = {
    runtime: {
      id: "extension-id",
      getURL: (path) => `${firefox ? "moz" : "chrome"}-extension://extension-id/${path}`,
      getManifest: () => (firefox ? { browser_specific_settings: { gecko: {} } } : {}),
      sendMessage: jest.fn((message, callback) => callback?.()),
    },
    extension: { getViews: jest.fn(() => views) },
    storage: { sync, local },
    action: {
      setBadgeText: jest.fn((value, callback) => callback?.()),
      setBadgeBackgroundColor: jest.fn((value, callback) => callback?.()),
    },
    tabs: {
      query: jest.fn((query, callback) =>
        callback([
          { id: 1, url: sender.url, incognito: false },
          { id: 2, url: sender.url, incognito: false },
          { id: 3, url: "https://example.com/", incognito: false },
        ]),
      ),
      sendMessage: jest.fn((id, message, callback) => callback?.()),
      onCreated: { addListener: jest.fn() },
      onUpdated: { addListener: jest.fn() },
    },
    alarms: {
      create: jest.fn(),
      clear: jest.fn(),
      onAlarm: {
        addListener: (listener) => {
          alarmListener = listener;
        },
      },
    },
  };
  const notification = {
    id: NOTIFICATION_ID,
    type: "likes",
    commentId: ID,
    rootId: ID,
    videoId: VIDEO_ID,
    actorNickname: null,
    likeCount: 1,
    read: false,
    createdAt: "2026-09-06T10:00:00Z",
    updatedAt: "2026-09-06T10:00:00Z",
    revision: "1",
  };
  let inbox = {
    items: authenticated ? [notification] : [],
    unreadCount: authenticated ? 1 : 0,
    revision: "1",
    nextCursor: null,
  };
  const calls = [];
  const fetchImpl = jest.fn(async (url, options) => {
    const path = url.replace(`${ORIGIN}/api/discussion`, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, body, options, url });
    if (fetchOverride) {
      const override = await fetchOverride(path, options, body);
      if (override) return override;
    }
    let data;
    if (path === "/me" || path === "/me/profile")
      data = {
        authenticated: true,
        canPost: true,
        isModerator: false,
        membershipTier: "commenter",
        profile: { id: PROFILE_ID, nickname: "Tester", suspended: false, providerId: "private" },
        token: "private",
        userId: "private",
      };
    else if (path.startsWith("/notifications/ticket"))
      data = { token: "hub-ticket", expiresAt: "2026-09-06T10:01:00Z" };
    else if (path.startsWith("/notifications")) data = inbox;
    else if (path.endsWith("/reaction/challenge"))
      data = { challengeId: ID, challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 1 };
    else if (path.endsWith("/reaction/confirm")) data = { commentId: ID, likes: 1, dislikes: 0, myReaction: 1 };
    else if (path === "/reactions/state") data = { items: [{ commentId: ID, value: -1 }] };
    else if (path.includes("/comments"))
      data = {
        items: [{ id: ID, videoId: VIDEO_ID, author: { id: PROFILE_ID, nickname: "Tester" }, text: "Hello" }],
        nextCursor: null,
      };
    else data = { enabled: true };
    return { ok: true, status: 200, json: async () => structuredClone(data) };
  });
  const sockets = [];
  const connectionFactory = jest.fn((url, tokenFactory) => {
    const handlers = {};
    const socket = {
      url,
      tokenFactory,
      handlers,
      on: (name, handler) => {
        handlers[name] = handler;
      },
      onclose: (handler) => {
        handlers.close = handler;
      },
      onreconnected: (handler) => {
        handlers.reconnected = handler;
      },
      start: jest.fn(async () => {
        await tokenFactory();
      }),
      stop: jest.fn(async () => {}),
    };
    sockets.push(socket);
    return socket;
  });
  const voteClient = {
    ensureRegistered: jest.fn(async () => ({ userId: "existing-voter-secret" })),
    getRegisteredUser: jest.fn(async () => ({ userId: "existing-voter-secret" })),
  };
  const client = createDiscussionBackground({
    api,
    voteClient,
    fetchImpl,
    accountFetchImpl,
    hasConsent: async () => consent,
    connectionFactory,
    solve: solveOverride || jest.fn(async () => ({ solution: "AAAAAA==" })),
    settings: {
      apiOrigin: ORIGIN,
      testMode,
      authStorageKey: "testAuth",
      credentialStorageKey: "testCredentials",
      stateStorageKey: "discussionState",
    },
  });
  return {
    api,
    client,
    calls,
    sockets,
    fetchImpl,
    voteClient,
    sync,
    local,
    notification,
    setInbox: (value) => {
      inbox = value;
    },
    alarm: () => alarmListener({ name: "ryd-discussion-reconnect" }),
    send: (operation, payload = {}, source = sender, scope = SCOPE) =>
      client.handleMessage(
        {
          message: "ryd_discussion",
          operation,
          payload,
          ...(VIDEO_OPERATIONS.has(operation) && scope ? { scope } : {}),
        },
        source,
      ),
  };
}

describe("Firefox private discussion isolation", () => {
  const normalSender = { ...sender, tab: { ...sender.tab, incognito: false } };

  test.each(["session", "capabilities", "comments", "react", "notifications", "cancelScope"])(
    "rejects private %s before validation, account reads, or shared work",
    async (operation) => {
      const h = harness({ authenticated: true, firefox: true });
      const source = { ...normalSender, tab: { ...normalSender.tab, incognito: true } };
      expect(await h.send(operation, { invalid: true }, source)).toMatchObject({
        ok: false,
        error: { code: "private_browsing" },
      });
      expect(h.sync.get).not.toHaveBeenCalled();
      expect(h.local.get).not.toHaveBeenCalled();
      expect(h.fetchImpl).not.toHaveBeenCalled();
      expect(h.voteClient.getRegisteredUser).not.toHaveBeenCalled();
      expect(h.voteClient.ensureRegistered).not.toHaveBeenCalled();
      expect(h.api.tabs.sendMessage).not.toHaveBeenCalled();
      expect(h.api.action.setBadgeText).not.toHaveBeenCalled();
    },
  );

  test("rejects a tab whose normal browsing context cannot be verified", async () => {
    const h = harness({ authenticated: true, firefox: true });
    expect(await h.send("session", {}, sender)).toMatchObject({ error: { code: "private_browsing" } });
    expect(h.sync.get).not.toHaveBeenCalled();
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  test.each([true, undefined])(
    "rejects a private or unverified extension view (%s) before account reads",
    async (incognito) => {
      const url = "moz-extension://extension-id/popup.html?rydContext=private-test-context";
      const h = harness({ authenticated: true, firefox: true, views: [extensionView(incognito, url)] });
      expect(await h.send("session", {}, { id: sender.id, url })).toMatchObject({
        ok: false,
        error: { code: "private_browsing" },
      });
      expect(h.sync.get).not.toHaveBeenCalled();
      expect(h.fetchImpl).not.toHaveBeenCalled();
    },
  );

  test("preserves account requests from a verified normal Firefox extension view", async () => {
    const url = "moz-extension://extension-id/popup.html?rydContext=normal-test-context";
    const h = harness({ authenticated: true, firefox: true, views: [extensionView(false, url)] });
    expect((await h.send("session", {}, { id: sender.id, url })).data.authenticated).toBe(true);
    h.client.stop();
  });

  test("delivers shared account events only to normal YouTube tabs and verified extension views", async () => {
    const normal = extensionView(false);
    const privateView = extensionView(true);
    const unknown = extensionView(undefined);
    const foreign = extensionView(false, "https://www.youtube.com/watch?v=video123456");
    const unavailable = extensionView(false);
    unavailable.dispatchEvent.mockImplementation(() => {
      throw new Error("View closed");
    });
    const h = harness({
      authenticated: true,
      firefox: true,
      views: [privateView, unknown, foreign, unavailable, normal],
    });
    h.api.tabs.query.mockImplementation((query, done) =>
      done([
        { id: 2, url: sender.url, incognito: true },
        { id: 1, url: sender.url, incognito: false },
        { id: 3, url: sender.url },
      ]),
    );
    expect((await h.send("session", {}, normalSender)).data.authenticated).toBe(true);
    await flush();
    expect(h.api.tabs.sendMessage.mock.calls.length).toBeGreaterThan(0);
    expect(h.api.tabs.sendMessage.mock.calls.every(([tabId]) => tabId === 1)).toBe(true);
    expect(
      normal.dispatchEvent.mock.calls.some(
        ([event]) => event.detail.type === "session" && event.detail.data.authenticated,
      ),
    ).toBe(true);
    expect(
      normal.dispatchEvent.mock.calls.some(
        ([event]) => event.detail.type === "inbox" && event.detail.data.unreadCount === 1,
      ),
    ).toBe(true);
    expect(normal.CustomEvent).toHaveBeenCalledWith(
      "ryd-discussion-event",
      expect.objectContaining({ detail: expect.any(Object) }),
    );
    for (const view of [privateView, unknown, foreign]) {
      expect(view.CustomEvent).not.toHaveBeenCalled();
      expect(view.dispatchEvent).not.toHaveBeenCalled();
    }
    expect(h.api.runtime.sendMessage).not.toHaveBeenCalled();
    h.client.stop();
  });

  test("isolates each Firefox view's session and inbox mutations from the worker and other views", async () => {
    const first = extensionView(false);
    const second = extensionView(false);
    first.dispatchEvent.mockImplementation(({ detail }) => {
      if (detail.type === "session" && detail.data.profile) detail.data.profile.nickname = "Changed in one view";
      if (detail.type === "inbox" && detail.data.items.length) {
        detail.data.items[0].read = true;
        detail.data.items[0].actorNickname = "Changed in one view";
      }
    });
    const h = harness({ authenticated: true, firefox: true, views: [first, second] });
    const response = await h.send("session", {}, normalSender);
    await flush();
    expect(response.data.profile.nickname).toBe("Tester");
    expect((await h.send("session", {}, normalSender)).data.profile.nickname).toBe("Tester");
    const sessionEvent = second.dispatchEvent.mock.calls.find(
      ([event]) => event.detail.type === "session" && event.detail.data.authenticated,
    )[0];
    expect(sessionEvent.detail.data.profile.nickname).toBe("Tester");
    const inboxEvent = second.dispatchEvent.mock.calls.find(
      ([event]) => event.detail.type === "inbox" && event.detail.data.items.length,
    )[0];
    expect(inboxEvent.detail.data.items[0]).toMatchObject({ read: false, actorNickname: null });
    expect(h.local.data.discussionState.items[0]).toMatchObject({ read: false, actorNickname: null });
    h.client.stop();
  });

  test("never falls back to global runtime account events when extension views are unavailable", async () => {
    const h = harness({ authenticated: true, firefox: true });
    h.api.extension.getViews.mockImplementation(() => {
      throw new Error("Unavailable");
    });
    expect((await h.send("session", {}, normalSender)).data.authenticated).toBe(true);
    await flush();
    expect(h.api.runtime.sendMessage).not.toHaveBeenCalled();
    expect(h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "inbox")).toBe(true);
    h.client.stop();
  });

  test("does not send account toasts to an active private YouTube tab", async () => {
    const h = harness({ authenticated: true, firefox: true });
    h.api.tabs.query.mockImplementation((query, done) =>
      done(
        query.active ? [{ id: 2, url: sender.url, incognito: true }] : [{ id: 1, url: sender.url, incognito: false }],
      ),
    );
    await h.send("session", {}, normalSender);
    await flush();
    h.setInbox({
      items: [{ ...h.notification, revision: "2", likeCount: 2 }],
      unreadCount: 1,
      revision: "2",
      nextCursor: null,
    });
    h.sockets[0].handlers.NotificationsChanged({ revision: "2" });
    await flush();
    await flush();
    expect(h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "toast")).toBe(false);
    expect(h.api.tabs.sendMessage.mock.calls.some(([tabId]) => tabId === 2)).toBe(false);
    h.client.stop();
  });

  test("keeps the default badge empty and applies account counts only to normal tabs, including new tabs", async () => {
    const h = harness({ authenticated: true, firefox: true });
    h.api.tabs.query.mockImplementation((query, done) =>
      done([
        { id: 1, url: sender.url, incognito: false },
        { id: 2, url: sender.url, incognito: true },
        { id: 3, url: "https://example.com/", incognito: false },
        { id: 4, url: sender.url },
      ]),
    );
    h.client.initialize();
    await flush();
    await flush();
    const badgeValues = h.api.action.setBadgeText.mock.calls.map(([value]) => value);
    expect(badgeValues).toContainEqual({ text: "" });
    expect(badgeValues).toContainEqual({ tabId: 1, text: "1" });
    expect(badgeValues).toContainEqual({ tabId: 3, text: "1" });
    expect(
      badgeValues.every((value) => (value.tabId === undefined ? value.text === "" : [1, 3].includes(value.tabId))),
    ).toBe(true);
    expect(h.api.action.setBadgeBackgroundColor.mock.calls.every(([value]) => [1, 3].includes(value.tabId))).toBe(true);

    h.api.action.setBadgeText.mockClear();
    h.api.action.setBadgeBackgroundColor.mockClear();
    const created = h.api.tabs.onCreated.addListener.mock.calls[0][0];
    const updated = h.api.tabs.onUpdated.addListener.mock.calls[0][0];
    await created({ id: 5, incognito: true });
    await updated(5, {}, { id: 5, incognito: true });
    await created({ id: 6 });
    expect(h.api.action.setBadgeText).not.toHaveBeenCalled();
    expect(h.api.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    await created({ id: 7, incognito: false });
    await updated(8, {}, { id: 8, incognito: false });
    expect(h.api.action.setBadgeText.mock.calls.map(([value]) => value)).toEqual([
      { tabId: 7, text: "1" },
      { tabId: 8, text: "1" },
    ]);
    h.client.clearSession();
    await flush();
    expect(h.api.action.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: "" }, expect.any(Function));
    h.client.stop();
  });

  test("preserves non-Firefox incognito discussion requests and global account updates", async () => {
    const h = harness({ authenticated: true });
    const response = await h.send("session", {}, { ...sender, tab: { ...sender.tab, incognito: true } });
    expect(response.data.authenticated).toBe(true);
    await flush();
    expect(
      h.api.runtime.sendMessage.mock.calls.some(([event]) => event.type === "session" && event.data.authenticated),
    ).toBe(true);
    expect(h.api.action.setBadgeText).toHaveBeenCalledWith({ text: "1" }, expect.any(Function));
    expect(h.api.extension.getViews).not.toHaveBeenCalled();
    h.client.stop();
  });
});

describe("discussion worker boundary", () => {
  test("authenticated discussion traffic uses the account guard while anonymous reads keep their ordinary path", async () => {
    const accountFetchImpl = jest.fn(async () => {
      throw new Error("Authentication data consent required.");
    });
    const authenticated = harness({ authenticated: true, accountFetchImpl });
    expect((await authenticated.send("session")).ok).toBe(false);
    expect(accountFetchImpl).toHaveBeenCalledWith(
      `${ORIGIN}/api/discussion/me`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer account-token" }) }),
    );
    expect(authenticated.fetchImpl).not.toHaveBeenCalled();

    accountFetchImpl.mockClear();
    const anonymous = harness({ accountFetchImpl });
    expect((await anonymous.send("comments", { videoId: VIDEO_ID, sort: "new" })).ok).toBe(true);
    expect(anonymous.fetchImpl).toHaveBeenCalled();
    expect(accountFetchImpl).not.toHaveBeenCalled();
  });

  test("public comments do not create a voter identity before the first reaction", async () => {
    const h = harness();
    h.voteClient.getRegisteredUser.mockResolvedValue(null);
    const response = await h.send("comments", { videoId: VIDEO_ID, sort: "new" });
    expect(response.ok).toBe(true);
    expect(response.data.items[0].myReaction).toBe(0);
    expect(h.voteClient.ensureRegistered).not.toHaveBeenCalled();
    expect(h.calls.some((call) => call.path === "/reactions/state")).toBe(false);
  });
  test.each([
    ["comments", { videoId: VIDEO_ID, userId: "forged" }, sender],
    ["session", { sessionToken: "forged" }, sender],
    ["react", { id: ID, value: 1, recipient: "forged" }, sender],
    ["session", {}, { ...sender, id: "different-extension" }],
    ["session", {}, { ...sender, frameId: 1 }],
    ["session", {}, { ...sender, url: "https://www.youtube.com.evil.test/watch?v=video123456" }],
    ["fetch", { url: "https://example.com" }, sender],
    ["react", { id: ID, value: 2 }, sender],
    ["createComment", { videoId: VIDEO_ID, text: "Hi" }, sender],
  ])("rejects invalid %s requests before sending network traffic", async (operation, payload, source) => {
    const h = harness();
    expect((await h.send(operation, payload, source)).ok).toBe(false);
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  test("public reads enrich viewer reactions without exposing the voter credential", async () => {
    const h = harness();
    const response = await h.send("comments", { videoId: VIDEO_ID, sort: "new" });
    expect(response.ok).toBe(true);
    expect(response.data.items[0].myReaction).toBe(-1);
    expect(JSON.stringify(response)).not.toContain("existing-voter-secret");
    expect(h.calls.find((call) => call.path === "/reactions/state").body).toEqual({
      userId: "existing-voter-secret",
      commentIds: [ID],
    });
    expect(h.calls.every((call) => !call.options.headers.Authorization)).toBe(true);
    expect(h.sockets).toHaveLength(0);
  });

  test("preserves the same anonymous reaction identity across sign-in and sign-out", async () => {
    const h = harness();
    await h.send("react", { id: ID, value: 1 });
    Object.assign(h.sync.data, { patreonAuthenticated: true, patreonSessionToken: "account-token" });
    await h.send("react", { id: ID, value: -1 });
    delete h.sync.data.patreonSessionToken;
    await h.send("react", { id: ID, value: 0 });
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge")).map((call) => call.body)).toEqual([
      { userId: "existing-voter-secret", value: 1 },
      { userId: "existing-voter-secret", value: -1 },
      { userId: "existing-voter-secret", value: 0 },
    ]);
    expect(h.sync.set).not.toHaveBeenCalled();
    expect(h.sync.remove).not.toHaveBeenCalled();
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    h.client.stop();
  });

  test("returns a safe server session to the popup and uses only hub tickets on sockets", async () => {
    const h = harness({ authenticated: true });
    const response = await h.send(
      "session",
      {},
      { id: "extension-id", url: "chrome-extension://extension-id/popup.html" },
    );
    await flush();
    expect(response.data.profile).toEqual({ id: PROFILE_ID, nickname: "Tester", suspended: false });
    expect(JSON.stringify(response)).not.toMatch(/private|account-token|existing-voter-secret/);
    expect(h.sockets).toHaveLength(1);
    expect(await h.sockets[0].tokenFactory()).toBe("hub-ticket");
    expect(h.sockets[0].url).not.toContain("token");
    h.client.stop();
  });

  test("does not read or transmit stored account credentials after consent removal", async () => {
    const h = harness({ authenticated: true, consent: false });
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    expect(h.sync.get).not.toHaveBeenCalled();
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  test("test accounts never fall back to real Patreon storage", async () => {
    const h = harness({ authenticated: true, testMode: true });
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    expect(h.sync.get).not.toHaveBeenCalled();
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  test("discards an account response arriving after logout", async () => {
    const pending = deferred();
    const h = harness({ authenticated: true, fetchOverride: (path) => (path === "/me" ? pending.promise : undefined) });
    const response = h.send("session");
    await flush();
    h.client.clearSession();
    pending.resolve({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true, canPost: true, profile: { id: PROFILE_ID, nickname: "Old account" } }),
    });
    expect((await response).ok).toBe(false);
    expect(
      h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "session" && event.data.authenticated),
    ).toBe(false);
    expect(h.sockets).toHaveLength(0);
  });

  test("the public capability probe survives account initialization and logout", async () => {
    const pending = deferred();
    let signal;
    const h = harness({
      fetchOverride: (path, options) => {
        if (path !== "/capabilities") return;
        signal = options.signal;
        return pending.promise;
      },
    });
    const response = h.send("capabilities");
    await flush();
    h.client.clearSession();
    expect(signal.aborted).toBe(false);
    pending.resolve({ ok: true, status: 200, json: async () => ({ enabled: true }) });
    expect(await response).toEqual({ ok: true, data: { enabled: true } });
    expect(h.calls[0].options.headers.Authorization).toBeUndefined();
    h.client.stop();
  });

  test("does not restore an old account while logout storage cleanup is pending", async () => {
    const h = harness({ authenticated: true });
    await h.send("session");
    h.client.clearSession(true);
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    delete h.sync.data.patreonSessionToken;
    await h.client.resumeSession();
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    h.client.stop();
  });

  test("a request queued across an account change cannot execute under the replacement account", async () => {
    const held = deferred();
    const h = harness({ authenticated: true, fetchOverride: (path) => (path === "/me" ? held.promise : undefined) });
    const reading = h.send("session");
    await flush();
    const queued = h.send("createComment", { videoId: VIDEO_ID, text: "Old account draft", requestId: ID });
    h.client.clearSession(true);
    held.resolve({ ok: true, status: 200, json: async () => ({ authenticated: true }) });
    expect((await reading).ok).toBe(false);
    expect((await queued).error.code).toBe("session_changed");
    expect(h.calls.some((call) => call.path.includes("/videos/"))).toBe(false);
    h.client.stop();
  });

  test("moderation reports accept only open or resolved status and encode their cursor", async () => {
    const h = harness();
    expect((await h.send("reports", { status: "resolved", cursor: "opaque&value" })).ok).toBe(true);
    expect(h.calls.at(-1).path).toBe("/moderation/reports?status=resolved&cursor=opaque%26value");
    expect((await h.send("reports", { status: "hidden" })).error.code).toBe("invalid_request");
  });

  test("serializes reactions so a slow confirmation cannot overwrite a newer choice", async () => {
    const pending = deferred();
    let confirms = 0;
    const h = harness({
      fetchOverride: (path) => (path.endsWith("/reaction/confirm") && confirms++ === 0 ? pending.promise : undefined),
    });
    const first = h.send("react", { id: ID, value: 1 });
    const second = h.send("react", { id: ID, value: -1 });
    await flush();
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge"))).toHaveLength(1);
    pending.resolve({
      ok: true,
      status: 200,
      json: async () => ({ commentId: ID, likes: 1, dislikes: 0, myReaction: 1 }),
    });
    await Promise.all([first, second]);
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge")).map((call) => call.body.value)).toEqual([
      1, -1,
    ]);
  });

  test("updates grouped notification revisions and emits one active-tab toast without replaying history", async () => {
    const h = harness({ authenticated: true });
    await h.send("session");
    await flush();
    expect(h.api.tabs.sendMessage.mock.calls.filter(([, event]) => event.type === "toast")).toHaveLength(0);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    const updated = { ...h.notification, revision: "2", likeCount: 2, updatedAt: "2026-09-06T10:05:00Z" };
    h.setInbox({ items: [updated], unreadCount: 1, revision: "2", nextCursor: null });
    h.sockets[0].handlers.NotificationsChanged({ revision: "2" });
    await flush();
    await flush();
    h.sockets[0].handlers.NotificationsChanged({ revision: "2" });
    await flush();
    const toasts = h.api.tabs.sendMessage.mock.calls.filter(([, event]) => event.type === "toast");
    expect(toasts).toHaveLength(1);
    expect(toasts[0][0]).toBe(1);
    expect(toasts[0][1].data.likeCount).toBe(2);
    expect(h.calls.some((call) => call.path === "/notifications?afterRevision=1")).toBe(true);
    h.client.stop();
  });

  test("alarm reconnects a closed socket and silently catches up notifications", async () => {
    const h = harness({ authenticated: true });
    h.client.initialize();
    await flush();
    await flush();
    h.sockets[0].handlers.close();
    h.alarm();
    await flush();
    await flush();
    expect(h.sockets).toHaveLength(2);
    expect(h.api.tabs.sendMessage.mock.calls.filter(([, event]) => event.type === "toast")).toHaveLength(0);
    h.client.stop();
  });

  test("a reconnect callback from a cleared account cannot request its old inbox", async () => {
    const h = harness({ authenticated: true });
    await h.send("session");
    await flush();
    const oldSocket = h.sockets[0];
    h.client.clearSession(true);
    await flush();
    const count = h.calls.length;
    oldSocket.handlers.reconnected();
    await flush();
    expect(h.calls).toHaveLength(count);
    h.client.stop();
  });

  test("an expired cached account clears its inbox, badge and socket without changing the voter identity", async () => {
    const h = harness({
      authenticated: true,
      fetchOverride: (path) =>
        path.includes("cursor=expired")
          ? { ok: false, status: 401, json: async () => ({ code: "authentication_required" }) }
          : undefined,
    });
    await h.send("session");
    await flush();
    expect((await h.send("notifications", { cursor: "expired" })).error.status).toBe(401);
    await flush();
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    expect(h.sockets[0].stop).toHaveBeenCalled();
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" }, expect.any(Function));
    expect(
      h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "inbox" && event.data.items.length === 0),
    ).toBe(true);
    expect((await h.send("react", { id: ID, value: -1 })).ok).toBe(true);
    const challenge = h.calls.findLast((call) => call.path.endsWith("/reaction/challenge"));
    expect(challenge.body.userId).toBe("existing-voter-secret");
    expect(challenge.options.headers.Authorization).toBeUndefined();
    h.client.stop();
  });

  test("live inbox preserves history pagination without advancing its baseline from a manual history page", async () => {
    let revision = "25";
    const h = harness({
      authenticated: true,
      fetchOverride: (path) =>
        path.includes("cursor=manual-history")
          ? { ok: true, status: 200, json: async () => ({ items: [], revision: "999", nextCursor: null }) }
          : path.includes("afterRevision=")
            ? {
                ok: true,
                status: 200,
                json: async () => ({
                  items: revision === "26" ? [{ ...h.notification, revision }] : [],
                  unreadCount: 25,
                  revision,
                  nextCursor: null,
                }),
              }
            : undefined,
    });
    h.setInbox({ items: [h.notification], unreadCount: 25, revision: "25", nextCursor: "older-history" });
    await h.send("session");
    await flush();
    expect((await h.send("notifications", { cursor: "manual-history" })).data.revision).toBe("999");
    revision = "26";
    h.sockets[0].handlers.NotificationsChanged({ revision: "26" });
    await flush();
    await flush();
    const event = h.api.tabs.sendMessage.mock.calls.findLast(([, event]) => event.type === "inbox")[1];
    expect(event.data.nextCursor).toBe("older-history");
    expect(h.calls.findLast((call) => call.path.includes("afterRevision=")).path).toBe(
      "/notifications?afterRevision=25",
    );
    expect(event.data.revision).toBe("26");
    h.client.stop();
  });

  test("a voter registration rejection does not clear a valid logged-in account or its inbox", async () => {
    const h = harness({
      authenticated: true,
      fetchOverride: (path) =>
        path.endsWith("/reaction/challenge")
          ? { ok: false, status: 401, json: async () => ({ code: "voter_registration_required" }) }
          : undefined,
    });
    await h.send("session");
    await flush();
    expect((await h.send("react", { id: ID, value: 1 })).error.code).toBe("voter_registration_required");
    expect((await h.send("session")).data.authenticated).toBe(true);
    expect(h.sockets[0].stop).not.toHaveBeenCalled();
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    h.client.stop();
  });

  test("navigation aborts only the selected document scope and keeps another document and inbox request alive", async () => {
    const pending = [];
    let hold = false;
    const h = harness({
      authenticated: true,
      fetchOverride: (path, options) => {
        if (!hold || (!path.startsWith("/videos/") && !path.includes("cursor=pending"))) return;
        return new Promise((resolve, reject) => {
          pending.push({ path, signal: options.signal, resolve });
          options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
    });
    await h.send("session");
    await flush();
    hold = true;
    const firstSource = { ...sender, documentId: "document-one" };
    const secondSource = { ...sender, documentId: "document-two" };
    const first = h.send("comments", { videoId: VIDEO_ID }, firstSource);
    const second = h.send("comments", { videoId: VIDEO_ID }, secondSource);
    const inbox = h.send("notifications", { cursor: "pending" });
    await flush();
    expect(pending).toHaveLength(3);
    expect((await h.send("cancelScope", {}, firstSource)).ok).toBe(true);
    expect(pending[0].signal.aborted).toBe(true);
    expect(pending[1].signal.aborted).toBe(false);
    expect(pending[2].signal.aborted).toBe(false);
    for (const request of pending.slice(1))
      request.resolve({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) });
    expect((await first).error.code).toBe("navigation_changed");
    expect((await second).ok).toBe(true);
    expect((await inbox).ok).toBe(true);
    h.client.stop();
  });

  test("cancelled scopes cannot confirm a solved puzzle or start a queued reaction", async () => {
    const solved = deferred();
    const h = harness({ solveOverride: () => solved.promise });
    const first = h.send("react", { id: ID, value: 1 });
    const queued = h.send("react", { id: ID, value: -1 });
    await flush();
    await h.send("cancelScope");
    solved.resolve({ solution: "AAAAAA==" });
    expect((await first).error.code).toBe("navigation_changed");
    expect((await queued).error.code).toBe("navigation_changed");
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge"))).toHaveLength(1);
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/confirm"))).toHaveLength(0);
    expect((await h.send("comments", { videoId: VIDEO_ID })).error.code).toBe("navigation_changed");
  });

  test("video operations require a scope bound to the current tab video", async () => {
    const h = harness();
    expect((await h.send("comments", { videoId: VIDEO_ID }, sender, null)).error.code).toBe("scope_required");
    expect(
      (await h.send("comments", { videoId: VIDEO_ID }, sender, { ...SCOPE, videoId: "other123456" })).error.code,
    ).toBe("navigation_changed");
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });
});
