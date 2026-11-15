import { createDiscussionBackground, canReceiveLiveNotifications, ANONYMOUS_SESSION } from "./discussion-background";

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
const settle = async () => {
  for (let index = 0; index < 100; index++) await Promise.resolve();
};
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
  featureConsent,
  connectionStartOverride,
  account: accountOverrides = {},
} = {}) {
  const sync = storageArea(authenticated ? { patreonAuthenticated: true, patreonSessionToken: "account-token" } : {});
  const local = storageArea();
  const api = {
    runtime: {
      id: "extension-id",
      getURL: (path) => `${firefox ? "moz" : "chrome"}-extension://extension-id/${path}`,
      getManifest: () => (firefox ? { browser_specific_settings: { gecko: {} } } : {}),
      sendMessage: jest.fn((message, callback) => callback?.()),
      onStartup: { addListener: jest.fn() },
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
  let account = {
    authenticated: true,
    canPost: true,
    isModerator: false,
    membershipTier: "commenter",
    profile: { id: PROFILE_ID, nickname: "Tester", suspended: false, providerId: "private" },
    token: "private",
    userId: "private",
    ...accountOverrides,
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
    if (path === "/me/profile") {
      account = {
        ...account,
        profile: { id: PROFILE_ID, suspended: false, ...account.profile, nickname: body.nickname },
      };
      data = account;
    } else if (path === "/me") data = account;
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
        await connectionStartOverride?.(sockets.length);
        socket.state = "Connected";
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
    ...(featureConsent ? { hasFeatureConsent: featureConsent } : {}),
    connectionFactory,
    solve: solveOverride || jest.fn(async () => ({ solution: "AAAAAA==" })),
    random: () => 0.5,
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
    setAccount: (value) => {
      account = { ...account, ...value };
    },
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
    expect(h.local.data.discussionState).toBeUndefined();
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

describe("activity-driven notification recovery", () => {
  let clients;
  const recoveryHarness = (options) => {
    const value = harness(options);
    clients.push(value.client);
    return value;
  };
  beforeEach(() => {
    jest.useFakeTimers();
    clients = [];
  });
  afterEach(() => {
    for (const client of clients) client.stop();
    jest.useRealTimers();
  });

  test("transient initial verification failures retry within the bounded activity budget", async () => {
    let verifies = 0;
    const h = recoveryHarness({
      authenticated: true,
      fetchOverride: (path) =>
        path === "/me" && verifies++ < 2 ? { ok: false, status: 503, json: async () => ({}) } : undefined,
    });
    await expect(h.client.refreshSession()).rejects.toMatchObject({ status: 503 });
    expect(await h.send("session")).toMatchObject({ ok: false, error: { code: "session_unavailable" } });
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.calls.filter((call) => call.path === "/me")).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(3000);
    await settle();
    expect(h.calls.filter((call) => call.path === "/me")).toHaveLength(3);
    expect(h.sockets).toHaveLength(1);
    const sessions = h.api.tabs.sendMessage.mock.calls
      .filter(([, event]) => event.type === "session")
      .map(([, event]) => event.data);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.authenticated)).toBe(true);
    expect(h.api.action.setBadgeText).not.toHaveBeenCalledWith({ text: "" }, expect.any(Function));
    expect((await h.send("session")).data.authenticated).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("REST catches up while a socket start is pending and concurrent activity shares one socket", async () => {
    const pending = deferred();
    const h = recoveryHarness({ authenticated: true, connectionStartOverride: () => pending.promise });
    await Promise.all([h.send("session"), h.send("session"), h.send("session")]);
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(h.calls.filter((call) => call.path === "/me")).toHaveLength(1);
    expect(
      h.calls.filter((call) => call.path.startsWith("/notifications") && !call.path.includes("ticket")),
    ).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    await h.send("session");
    await settle();
    expect(
      h.calls.filter((call) => call.path.startsWith("/notifications") && !call.path.includes("ticket")),
    ).toHaveLength(1);
    h.setInbox({ items: [{ ...h.notification, revision: "2" }], revision: "2", unreadCount: 1, nextCursor: null });
    pending.resolve();
    await settle();
    expect(
      h.calls.filter((call) => call.path.startsWith("/notifications") && !call.path.includes("ticket")),
    ).toHaveLength(2);
    expect(h.calls.at(-1).path).toBe("/notifications?afterRevision=1");
    expect(h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "toast")).toBe(false);
  });

  test("initial socket failures exhaust retries and wait for new genuine activity", async () => {
    const h = recoveryHarness({
      authenticated: true,
      connectionStartOverride: async () => {
        throw new Error("offline");
      },
    });
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(3000);
    await jest.advanceTimersByTimeAsync(10000);
    expect(h.sockets).toHaveLength(4);
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sockets).toHaveLength(4);
    expect(
      h.calls.filter((call) => call.path.startsWith("/notifications") && !call.path.includes("ticket")),
    ).toHaveLength(1);
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(5);
    expect(
      h.calls.filter((call) => call.path.startsWith("/notifications") && !call.path.includes("ticket")),
    ).toHaveLength(2);
  });

  test.each(["logout", "revoke", "stop"])("%s cancels a scheduled recovery retry", async (action) => {
    const h = recoveryHarness({
      authenticated: true,
      connectionStartOverride: async () => {
        throw new Error("offline");
      },
    });
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(1);
    if (action === "logout") h.client.clearSession(true);
    else if (action === "revoke") await h.client.onDataPermissionsChanged({ removed: ["authenticationInfo"] });
    else h.client.stop();
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sockets).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("exhausted established reconnects wait for activity, then startup restores silently", async () => {
    const h = recoveryHarness({ authenticated: true });
    h.client.initialize();
    await settle();
    expect(h.sockets).toHaveLength(1);
    h.sockets[0].handlers.close();
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sockets).toHaveLength(1);
    h.setInbox({ items: [{ ...h.notification, revision: "2" }], revision: "2", unreadCount: 1, nextCursor: null });
    h.api.runtime.onStartup.addListener.mock.calls[0][0]();
    await settle();
    expect(h.sockets).toHaveLength(2);
    expect(h.calls.some((call) => call.path === "/notifications?afterRevision=1")).toBe(true);
    expect(h.api.tabs.sendMessage.mock.calls.some(([, event]) => event.type === "toast")).toBe(false);
  });

  test("a healthy socket retries a missing initial inbox snapshot on later activity", async () => {
    let failInbox = true;
    const h = recoveryHarness({
      authenticated: true,
      fetchOverride: (path) =>
        path.startsWith("/notifications") && !path.includes("ticket") && failInbox
          ? { ok: false, status: 503, json: async () => ({}) }
          : undefined,
    });
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(1);
    failInbox = false;
    await Promise.all([h.send("session"), h.send("session")]);
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    const count = h.calls.length;
    await h.send("session");
    await settle();
    expect(h.calls).toHaveLength(count);
  });
});

describe("live notification eligibility", () => {
  const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup.html" };
  const eligible = {
    authenticated: true,
    canPost: true,
    isModerator: false,
    membershipTier: "commenter",
    profile: { id: PROFILE_ID, nickname: "Tester", suspended: false },
  };
  const ticketCalls = (h) => h.calls.filter((call) => call.path === "/notifications/ticket");
  const inboxCalls = (h) =>
    h.calls.filter((call) => call.path.startsWith("/notifications") && call.path !== "/notifications/ticket");
  const liveEvents = (h) =>
    h.api.tabs.sendMessage.mock.calls.filter(([, event]) => ["inbox", "toast"].includes(event.type));
  const unreadState = (h) => [
    ...h.api.action.setBadgeText.mock.calls.filter(([value]) => value.text !== ""),
    ...liveEvents(h).filter(([, event]) => event.type === "toast" || event.data.items.length > 0),
  ];
  let clients;
  const eligibilityHarness = (options) => {
    const value = harness({ authenticated: true, ...options });
    clients.push(value.client);
    return value;
  };
  beforeEach(() => {
    jest.useFakeTimers();
    clients = [];
  });
  afterEach(() => {
    for (const client of clients) client.stop();
    jest.useRealTimers();
  });

  test.each([
    ["none", "Tester", false],
    ["supporter", "Tester", false],
    ["commenter", "Tester", true],
    ["premium", "Tester", true],
    ["commenter", "", false],
    ["premium", null, false],
  ])("a %s session with nickname %p is eligible: %p", (membershipTier, nickname, expected) => {
    expect(
      canReceiveLiveNotifications({ ...eligible, membershipTier, profile: { ...eligible.profile, nickname } }),
    ).toBe(expected);
  });

  test("anonymous sessions, missing profiles and unknown tiers are ineligible while suspended authors stay eligible", () => {
    expect(canReceiveLiveNotifications(ANONYMOUS_SESSION)).toBe(false);
    expect(canReceiveLiveNotifications({ ...eligible, authenticated: false })).toBe(false);
    expect(canReceiveLiveNotifications({ ...eligible, profile: null })).toBe(false);
    expect(canReceiveLiveNotifications({ ...eligible, membershipTier: "gold" })).toBe(false);
    expect(
      canReceiveLiveNotifications({ ...eligible, canPost: false, profile: { ...eligible.profile, suspended: true } }),
    ).toBe(true);
  });

  test.each([
    ["none", eligible.profile],
    ["supporter", eligible.profile],
    ["commenter", null],
    ["premium", null],
    ["premium", { ...eligible.profile, nickname: null }],
  ])(
    "a signed-in %s account with profile %p never requests a ticket or live inbox",
    async (membershipTier, profile) => {
      const h = eligibilityHarness({ account: { membershipTier, profile } });
      h.client.initialize();
      await settle();
      expect((await h.send("session")).data).toMatchObject({ authenticated: true, membershipTier });
      await h.send("session");
      await jest.advanceTimersByTimeAsync(60000);
      expect(h.calls.map((call) => call.path)).toEqual(["/me"]);
      expect(h.sockets).toHaveLength(0);
      expect(unreadState(h)).toHaveLength(0);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  test("a YouTube page asking for the session receives the cached live inbox without another request", async () => {
    const h = eligibilityHarness();
    h.client.initialize();
    await settle();
    expect(h.sockets).toHaveLength(1);
    const requests = h.calls.length;
    h.api.tabs.sendMessage.mockClear();
    const page = { ...sender, tab: { ...sender.tab, id: 7 } };
    expect((await h.send("session", {}, page)).data).toMatchObject({ authenticated: true });
    await h.send("session", {}, popup);
    await settle();
    expect(h.calls).toHaveLength(requests);
    expect(h.api.tabs.sendMessage.mock.calls).toEqual([
      [
        7,
        { message: "ryd_discussion_event", type: "inbox", data: expect.objectContaining({ unreadCount: 1 }) },
        expect.any(Function),
      ],
    ]);
  });

  test("a page of an ineligible account receives no inbox with its session", async () => {
    const h = eligibilityHarness({ account: { membershipTier: "supporter" } });
    h.client.initialize();
    await settle();
    await h.send("notifications", {}, popup);
    await settle();
    h.api.tabs.sendMessage.mockClear();
    await h.send("session");
    await settle();
    expect(liveEvents(h)).toHaveLength(0);
  });

  test("the on-demand inbox keeps working for ineligible accounts without live badge or toast state", async () => {
    const h = eligibilityHarness({ account: { membershipTier: "supporter" } });
    expect((await h.send("notifications", {}, popup)).data).toMatchObject({ unreadCount: 1, items: [h.notification] });
    expect((await h.send("readNotifications", { ids: [NOTIFICATION_ID] }, popup)).data).toMatchObject({
      unreadCount: 1,
    });
    expect((await h.send("readNotifications", { all: true }, popup)).ok).toBe(true);
    await settle();
    expect(h.calls.map((call) => call.path)).toEqual([
      "/me",
      "/notifications",
      "/notifications/read",
      "/notifications/read",
    ]);
    expect(h.sockets).toHaveLength(0);
    expect(unreadState(h)).toHaveLength(0);
  });

  test("saving a nickname opens one socket and publishes the live inbox", async () => {
    const h = eligibilityHarness({ account: { profile: null } });
    await h.send("session", {}, popup);
    await settle();
    expect(h.sockets).toHaveLength(0);
    expect((await h.send("profile", { nickname: "Tester" }, popup)).data.profile.nickname).toBe("Tester");
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    await h.send("profile", { nickname: "Renamed" }, popup);
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
  });

  test("a tier upgrade from storage connects a signed-in account that already has a nickname", async () => {
    const h = eligibilityHarness({ account: { membershipTier: "supporter" } });
    h.client.initialize();
    await settle();
    expect(h.sockets).toHaveLength(0);
    h.setAccount({ membershipTier: "premium" });
    h.client.onStorageChanged({ patreonUser: { newValue: { membershipTier: "premium" } } }, "sync");
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
  });

  test.each([
    ["tier", { membershipTier: "supporter" }],
    ["profile", { profile: null }],
    ["nickname", { profile: { ...eligible.profile, nickname: "" } }],
  ])("losing the %s closes the socket and clears live state without retrying", async (label, change) => {
    const h = eligibilityHarness();
    h.client.initialize();
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "1" }, expect.any(Function));
    h.setAccount(change);
    h.client.onStorageChanged({ patreonSessionToken: { newValue: "account-token" } }, "sync");
    await settle();
    expect(h.sockets[0].stop).toHaveBeenCalled();
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" }, expect.any(Function));
    expect(liveEvents(h).at(-1)[1].data).toEqual({ items: [], unreadCount: 0, revision: "0", nextCursor: null });
    const requests = h.calls.length;
    await h.send("session");
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.calls).toHaveLength(requests);
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("sign-out closes the socket and the signed-out worker stays disconnected", async () => {
    const h = eligibilityHarness();
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(1);
    h.client.clearSession(true);
    delete h.sync.data.patreonAuthenticated;
    delete h.sync.data.patreonSessionToken;
    await h.client.resumeSession();
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sockets[0].stop).toHaveBeenCalled();
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" }, expect.any(Function));
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
  });

  test("a profile response that reports a lost tier tears down live state and refuses further tickets", async () => {
    const h = eligibilityHarness();
    await h.send("session", {}, popup);
    await settle();
    const [socket] = h.sockets;
    expect(ticketCalls(h)).toHaveLength(1);
    h.setAccount({ membershipTier: "none" });
    expect((await h.send("profile", { nickname: "Renamed" }, popup)).data.membershipTier).toBe("none");
    await settle();
    expect(socket.stop).toHaveBeenCalled();
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" }, expect.any(Function));
    expect(liveEvents(h).at(-1)[1].data.items).toEqual([]);
    await expect(socket.tokenFactory()).rejects.toMatchObject({ code: "notifications_unavailable" });
    expect((await h.send("session", {}, popup)).data.authenticated).toBe(true);
    expect((await h.send("notifications", {}, popup)).ok).toBe(true);
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
  });

  test("a suspended commenter keeps the socket because the server still notifies suspended authors", async () => {
    const h = eligibilityHarness({ account: { canPost: false, profile: { ...eligible.profile, suspended: true } } });
    await h.send("session");
    await settle();
    expect(h.sockets).toHaveLength(1);
    expect(ticketCalls(h)).toHaveLength(1);
  });

  test.each([
    ["eligible", 1, {}],
    ["nickname-less", 0, { profile: null }],
  ])("a restarted worker with an %s stored session opens %i sockets", async (label, count, account) => {
    const h = eligibilityHarness({ account });
    h.client.initialize();
    await settle();
    expect(h.sockets).toHaveLength(count);
    expect(ticketCalls(h)).toHaveLength(count);
    expect(inboxCalls(h).length > 0).toBe(count > 0);
    h.api.runtime.onStartup.addListener.mock.calls[0][0]();
    await settle();
    expect(h.sockets).toHaveLength(count);
  });

  test("account permission gating still blocks an eligible account before any ticket", async () => {
    const h = eligibilityHarness({ featureConsent: async (feature) => feature !== "account" });
    h.client.initialize();
    await jest.advanceTimersByTimeAsync(60000);
    expect(h.sync.get).not.toHaveBeenCalled();
    expect(h.calls).toHaveLength(0);
    expect(h.sockets).toHaveLength(0);
  });
});

describe("discussion worker boundary", () => {
  const tabEvents = (h, type) =>
    h.api.tabs.sendMessage.mock.calls.filter(([, event]) => event.type === type).map(([, event]) => event.data);

  test("a restarted worker keeps open tabs signed in, with their inbox and badge, while it rechecks the account", async () => {
    const h = harness({ authenticated: true });
    h.client.initialize();
    await flush();
    await flush();
    expect(tabEvents(h, "session").length).toBeGreaterThan(0);
    expect(tabEvents(h, "session").every((session) => session.authenticated)).toBe(true);
    expect(tabEvents(h, "inbox").every((inbox) => inbox.items.length === 1)).toBe(true);
    expect(h.api.action.setBadgeText).not.toHaveBeenCalledWith({ text: "" }, expect.any(Function));
    h.client.stop();
  });

  test("a restarted worker signs open tabs out once a stored account is rejected", async () => {
    const h = harness({
      authenticated: true,
      fetchOverride: (path) =>
        path === "/me"
          ? { ok: false, status: 401, json: async () => ({ code: "authentication_required" }) }
          : undefined,
    });
    h.client.initialize();
    await flush();
    await flush();
    expect(tabEvents(h, "session")).toEqual([ANONYMOUS_SESSION, ANONYMOUS_SESSION]);
    expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" }, expect.any(Function));
    expect((await h.send("session")).data).toEqual(ANONYMOUS_SESSION);
    expect(h.calls.filter((call) => call.path === "/me")).toHaveLength(1);
    h.client.stop();
  });

  test.each(["/", "/results?search_query=example", "/feed/subscriptions"])(
    "initializes capabilities and session from a top-frame %s page",
    async (path) => {
      const h = harness();
      const source = {
        ...sender,
        url: `https://www.youtube.com${path}`,
        tab: { ...sender.tab, url: `https://www.youtube.com${path}` },
      };
      expect((await h.send("capabilities", {}, source)).ok).toBe(true);
      expect((await h.send("session", {}, source)).data).toEqual(ANONYMOUS_SESSION);
      expect((await h.send("comments", { videoId: VIDEO_ID }, source)).error.code).toBe("invalid_sender");
      h.client.stop();
    },
  );

  test.each(["https://www.youtube.com/", "https://www.youtube.com/results?search_query=example"])(
    "video reads accept the original SPA document URL %s while binding the current tab video",
    async (url) => {
      const h = harness();
      const source = { ...sender, url };
      expect((await h.send("comments", { videoId: VIDEO_ID }, source)).ok).toBe(true);
      expect(h.calls.at(-1).path).toBe(`/videos/${VIDEO_ID}/comments?sort=top`);
      expect((await h.send("comments", { videoId: VIDEO_ID }, source, null)).error.code).toBe("scope_required");
      expect(
        (await h.send("comments", { videoId: VIDEO_ID }, source, { ...SCOPE, videoId: "other123456" })).error.code,
      ).toBe("navigation_changed");
      expect((await h.send("comments", { videoId: VIDEO_ID }, { ...source, frameId: 1 })).error.code).toBe(
        "invalid_sender",
      );
      expect(
        (await h.send("comments", { videoId: VIDEO_ID }, { ...source, url: "https://example.com/" })).error.code,
      ).toBe("invalid_sender");
      h.client.stop();
    },
  );

  test("session and permission updates reach normal home and search tabs", async () => {
    const h = harness({ authenticated: true, firefox: true });
    h.api.tabs.query.mockImplementation((query, done) =>
      done([
        { id: 1, url: "https://www.youtube.com/", incognito: false },
        { id: 2, url: "https://www.youtube.com/results?search_query=test", incognito: false },
        { id: 3, url: "https://www.youtube.com/", incognito: true },
      ]),
    );
    await h.send("session", {}, { ...sender, tab: { ...sender.tab, incognito: false } });
    await flush();
    await h.client.onDataPermissionsChanged({ removed: ["websiteActivity"] });
    for (const type of ["session", "permissions"])
      expect(h.api.tabs.sendMessage.mock.calls.filter(([, event]) => event.type === type).map(([id]) => id)).toEqual(
        expect.arrayContaining([1, 2]),
      );
    expect(h.api.tabs.sendMessage.mock.calls.some(([id]) => id === 3)).toBe(false);
    h.client.stop();
  });

  test("public reads remain anonymous and independent of a failing account lookup", async () => {
    const h = harness({
      authenticated: true,
      fetchOverride: (path) => (path === "/me" ? { ok: false, status: 503, json: async () => ({}) } : undefined),
    });
    expect((await h.send("session")).ok).toBe(false);
    const meCalls = h.calls.filter((call) => call.path === "/me").length;
    expect((await h.send("comments", { videoId: VIDEO_ID })).ok).toBe(true);
    expect((await h.send("replies", { rootId: ID })).ok).toBe(true);
    expect((await h.send("comment", { id: ID })).ok).toBe(true);
    expect(h.calls.filter((call) => call.path === "/me")).toHaveLength(meCalls);
    expect(
      h.calls
        .filter((call) => call.path.includes("/comments"))
        .every((call) => !call.options.headers.Authorization && !call.body),
    ).toBe(true);
    expect(h.voteClient.getRegisteredUser).not.toHaveBeenCalled();
    h.client.stop();
  });

  test("reactions never carry the signed-in session and confirmed values survive public reloads", async () => {
    let confirmed = 1;
    const h = harness({
      authenticated: true,
      fetchOverride: (path) =>
        path.endsWith("/reaction/confirm")
          ? { ok: true, status: 200, json: async () => ({ commentId: ID, myReaction: confirmed }) }
          : undefined,
    });
    await h.send("session");
    expect((await h.send("react", { id: ID, value: 1 })).ok).toBe(true);
    expect(h.local.data.rydDiscussionReactions).toEqual([{ videoId: VIDEO_ID, reactions: { [ID]: 1 } }]);
    expect(h.sync.set).not.toHaveBeenCalled();
    expect(
      h.calls.filter((call) => call.path.includes("/reaction/")).every((call) => !call.options.headers.Authorization),
    ).toBe(true);
    h.client.clearSession(true);
    expect((await h.send("comments", { videoId: VIDEO_ID })).data.items[0].myReaction).toBe(1);
    confirmed = 0;
    expect((await h.send("react", { id: ID, value: 0 })).ok).toBe(true);
    expect(h.local.data.rydDiscussionReactions).toEqual([]);
    expect((await h.send("comments", { videoId: VIDEO_ID })).data.items[0].myReaction).toBe(0);
    expect(h.calls.some((call) => call.path === "/reactions/state")).toBe(false);
    h.client.stop();
  });

  test("a failed reaction confirm does not save a highlight", async () => {
    const h = harness({
      fetchOverride: (path) =>
        path.endsWith("/reaction/confirm") ? { ok: false, status: 503, json: async () => ({}) } : undefined,
    });
    expect((await h.send("react", { id: ID, value: 1 })).ok).toBe(false);
    expect(h.local.data.rydDiscussionReactions).toBeUndefined();
    h.client.stop();
  });

  test("local reaction history evicts the oldest video at its fixed limit", async () => {
    const h = harness();
    h.local.data.rydDiscussionReactions = Array.from({ length: 100 }, (_, index) => ({
      videoId: `v${String(index).padStart(10, "0")}`,
      reactions: { [ID]: 1 },
    }));
    expect((await h.send("react", { id: ID, value: 1 })).ok).toBe(true);
    expect(h.local.data.rydDiscussionReactions).toHaveLength(100);
    expect(h.local.data.rydDiscussionReactions.some((entry) => entry.videoId === "v0000000000")).toBe(false);
    expect(h.local.data.rydDiscussionReactions.at(-1)).toEqual({ videoId: VIDEO_ID, reactions: { [ID]: 1 } });
    h.client.stop();
  });

  test("Chrome and Safari reactions ignore the disabled like and dislike submission setting", async () => {
    const h = harness();
    h.sync.data.disableVoteSubmission = true;
    expect((await h.send("react", { id: ID, value: 1 })).ok).toBe(true);
    expect(h.voteClient.ensureRegistered).toHaveBeenCalledTimes(1);
    expect(h.calls.filter((call) => call.path.includes("/reaction/")).map((call) => call.path)).toEqual([
      `/comments/${ID}/reaction/challenge`,
      `/comments/${ID}/reaction/confirm`,
    ]);
    const requestedKeys = h.sync.get.mock.calls.flatMap(([keys]) => [].concat(keys));
    expect(requestedKeys).not.toContain("disableVoteSubmission");
    h.client.stop();
  });

  test("initial voter registration can save the reaction after its credential storage event", async () => {
    const h = harness();
    h.voteClient.ensureRegistered.mockImplementation(async () => {
      h.client.onStorageChanged({ userId: { newValue: "first-id" } }, "sync");
      return { userId: "first-id" };
    });
    expect((await h.send("react", { id: ID, value: 1 })).ok).toBe(true);
    expect(h.local.data.rydDiscussionReactions).toEqual([{ videoId: VIDEO_ID, reactions: { [ID]: 1 } }]);
    h.client.stop();
  });

  test("voting revocation clears local reactions and prevents registration while public reads continue", async () => {
    const allowed = { voting: true, counts: true, account: false };
    const h = harness({ featureConsent: async (feature) => allowed[feature] });
    await h.send("react", { id: ID, value: 1 });
    allowed.voting = false;
    await h.client.onDataPermissionsChanged({ removed: ["websiteActivity"] });
    expect(h.local.data.rydDiscussionReactions).toBeUndefined();
    h.voteClient.ensureRegistered.mockClear();
    expect((await h.send("react", { id: ID, value: 1 })).error.code).toBe("voting_consent_required");
    expect(h.voteClient.ensureRegistered).not.toHaveBeenCalled();
    expect((await h.send("comments", { videoId: VIDEO_ID })).ok).toBe(true);
    h.client.stop();
  });

  test.each([
    ["comments", { videoId: VIDEO_ID }],
    ["replies", { rootId: ID }],
    ["comment", { id: ID }],
    ["createComment", { videoId: VIDEO_ID, text: "Draft", requestId: ID }],
    ["editComment", { id: ID, text: "Draft" }],
    ["deleteComment", { id: ID }],
    ["react", { id: ID, value: 1 }],
    ["report", { id: ID, reason: "Reason" }],
  ])("%s requires browsing access before account or voter work", async (operation, payload) => {
    const h = harness({ authenticated: true, featureConsent: async (feature) => feature !== "counts" });
    expect((await h.send(operation, payload)).error.code).toBe("counts_consent_required");
    expect(h.sync.get).not.toHaveBeenCalled();
    expect(h.fetchImpl).not.toHaveBeenCalled();
    expect(h.voteClient.ensureRegistered).not.toHaveBeenCalled();
    h.client.stop();
  });

  test("browsing revocation invalidates a late comment body without stopping the account session", async () => {
    const body = deferred();
    let hold = true;
    let videoSignal;
    const allowed = { counts: true, account: true, voting: true };
    const h = harness({
      authenticated: true,
      featureConsent: async (feature) => allowed[feature],
      fetchOverride: (path, options) => {
        if (!hold || !path.startsWith("/videos/")) return;
        videoSignal = options.signal;
        return { ok: true, status: 200, json: () => body.promise };
      },
    });
    await h.send("session");
    await flush();
    const pending = h.send("comments", { videoId: VIDEO_ID });
    await flush();
    allowed.counts = false;
    await h.client.onDataPermissionsChanged({ removed: ["browsingActivity"] });
    expect(videoSignal.aborted).toBe(true);
    expect(h.sync.data.patreonSessionToken).toBe("account-token");
    expect(h.sockets[0].stop).not.toHaveBeenCalled();
    expect((await h.send("profile", { nickname: "Reader" })).ok).toBe(true);
    expect((await h.send("notifications")).ok).toBe(true);
    allowed.counts = true;
    await h.client.onDataPermissionsChanged({ added: ["browsingActivity"] });
    body.resolve({ items: [], nextCursor: null });
    expect((await pending).error.code).toBe("counts_consent_required");
    hold = false;
    expect((await h.send("comments", { videoId: VIDEO_ID })).ok).toBe(true);
    expect((await h.send("session")).data.authenticated).toBe(true);
    h.client.stop();
  });

  test("browsing revocation prevents a solved or queued reaction from resuming after regrant", async () => {
    const solved = deferred();
    const allowed = { counts: true, account: true, voting: true };
    const h = harness({ featureConsent: async (feature) => allowed[feature], solveOverride: () => solved.promise });
    const first = h.send("react", { id: ID, value: 1 });
    const queued = h.send("react", { id: ID, value: -1 });
    await flush();
    allowed.counts = false;
    await h.client.onDataPermissionsChanged({ removed: ["browsingActivity"] });
    allowed.counts = true;
    await h.client.onDataPermissionsChanged({ added: ["browsingActivity"] });
    solved.resolve({ solution: "AAAAAA==" });
    expect((await first).error.code).toBe("counts_consent_required");
    expect((await queued).error.code).toBe("counts_consent_required");
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge"))).toHaveLength(1);
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/confirm"))).toHaveLength(0);
    expect(h.local.data.rydDiscussionReactions).toBeUndefined();
    h.client.stop();
  });

  test("slow reaction cleanup does not deliver browsing removal after a newer grant", async () => {
    const h = harness();
    let finishRemoval;
    h.local.remove.mockImplementation((keys, callback) => {
      if (keys.includes("rydDiscussionReactions")) finishRemoval = callback;
      else callback?.();
    });
    const removed = h.client.onDataPermissionsChanged({ removed: ["browsingActivity"] });
    await flush();
    await h.client.onDataPermissionsChanged({ added: ["browsingActivity"] });
    const changes = h.api.tabs.sendMessage.mock.calls
      .filter(([tabId, message]) => tabId === 1 && message.type === "permissions")
      .map(([, message]) => message.data);
    expect(changes).toEqual([
      { added: [], removed: ["browsingActivity"] },
      { added: ["browsingActivity"], removed: [] },
    ]);
    finishRemoval();
    await removed;
    h.client.stop();
  });

  test("changing the synced voter ID removes reactions from the previous identity", async () => {
    const h = harness();
    await h.send("react", { id: ID, value: 1 });
    h.client.onStorageChanged({ userId: { oldValue: "old-id", newValue: "new-id" } }, "sync");
    expect((await h.send("comments", { videoId: VIDEO_ID })).data.items[0].myReaction).toBe(0);
    expect(h.local.data.rydDiscussionReactions).toBeUndefined();
    h.client.stop();
  });

  test.each(["createComment", "editComment", "report"])(
    "%s needs account permission before account reads",
    async (operation) => {
      const h = harness({ authenticated: true, featureConsent: async (feature) => feature !== "account" });
      const payload =
        operation === "createComment"
          ? { videoId: VIDEO_ID, text: "Draft", requestId: ID }
          : operation === "editComment"
            ? { id: ID, text: "Draft" }
            : { id: ID, reason: "Reason" };
      expect((await h.send(operation, payload)).error.code).toBe("account_consent_required");
      expect(h.sync.get).not.toHaveBeenCalled();
      expect(h.fetchImpl).not.toHaveBeenCalled();
      h.client.stop();
    },
  );

  test("cold initialization restores only consented accounts and healthy activity does no notification polling", async () => {
    const anonymous = harness();
    anonymous.client.initialize();
    await flush();
    expect(anonymous.calls).toHaveLength(0);
    anonymous.client.stop();
    const h = harness({ authenticated: true });
    h.client.initialize();
    await flush();
    await flush();
    expect(h.sockets).toHaveLength(1);
    const count = h.calls.length;
    await h.send("session");
    await flush();
    expect(h.calls).toHaveLength(count);
    h.client.stop();
  });

  test("a queued reaction is dropped when the signed-in profile owns the loaded comment", async () => {
    const solved = deferred();
    const h = harness({ solveOverride: () => solved.promise });
    await h.send("comments", { videoId: VIDEO_ID });
    const first = h.send("react", { id: ID, value: 1 });
    const queued = h.send("react", { id: ID, value: -1 });
    await flush();
    Object.assign(h.sync.data, { patreonAuthenticated: true, patreonSessionToken: "account-token" });
    await h.send("session");
    solved.resolve({ solution: "AAAAAA==" });
    expect((await first).error.code).toBe("own_comment");
    expect((await queued).error.code).toBe("own_comment");
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/challenge"))).toHaveLength(1);
    expect(h.calls.filter((call) => call.path.endsWith("/reaction/confirm"))).toHaveLength(0);
    h.client.stop();
  });
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
    authenticated.client.stop();
    anonymous.client.stop();
    await settle();
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

  test("public reads use only this device's saved reactions without reading voter credentials", async () => {
    const h = harness();
    h.local.data.rydDiscussionReactions = [{ videoId: VIDEO_ID, reactions: { [ID]: -1 } }];
    const response = await h.send("comments", { videoId: VIDEO_ID, sort: "new" });
    expect(response.ok).toBe(true);
    expect(response.data.items[0].myReaction).toBe(-1);
    expect(JSON.stringify(response)).not.toContain("existing-voter-secret");
    expect(h.calls.some((call) => call.path === "/reactions/state")).toBe(false);
    expect(h.voteClient.getRegisteredUser).not.toHaveBeenCalled();
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

  test("normal session activity reconnects a closed socket and silently catches up notifications", async () => {
    const h = harness({ authenticated: true });
    h.client.initialize();
    await flush();
    await flush();
    h.sockets[0].handlers.close();
    h.setInbox({ items: [{ ...h.notification, revision: "2" }], unreadCount: 1, revision: "2", nextCursor: null });
    await h.send("session");
    await flush();
    await flush();
    expect(h.sockets).toHaveLength(2);
    expect(h.calls.some((call) => call.path === "/notifications?afterRevision=1")).toBe(true);
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

  test("navigation aborts only the selected tab scope and keeps another tab and inbox request alive", async () => {
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
    const secondSource = { ...sender, documentId: "document-two", tab: { ...sender.tab, id: 2 } };
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

  test("a replacement top-frame document prunes and cancels the previous document's scope", async () => {
    let signal;
    const h = harness({
      fetchOverride: (path, options) => {
        if (!path.startsWith("/videos/") || signal) return;
        signal = options.signal;
        return new Promise((resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
        );
      },
    });
    const previous = { ...sender, documentId: "old-document" };
    const replacement = { ...sender, documentId: "new-document" };
    const pending = h.send("comments", { videoId: VIDEO_ID }, previous);
    await flush();
    expect((await h.send("comments", { videoId: VIDEO_ID }, replacement)).ok).toBe(true);
    expect(signal.aborted).toBe(true);
    expect((await pending).error.code).toBe("navigation_changed");
    expect((await h.send("comments", { videoId: VIDEO_ID }, previous)).error.code).toBe("navigation_changed");
    h.client.stop();
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
