jest.mock("../common/vote-client", () => ({ createVoteClient: jest.fn() }));
jest.mock("./src/core-data-consent", () => ({
  hasCoreDataPermission: jest.fn(),
  fetchWithCoreConsent: (...args) => fetch(...args),
  coreConsentError: () => new Error("Data consent required"),
  onCoreDataPermissionChanged: jest.fn(),
}));

const normalSender = { id: "extension-id", tab: { id: 1, incognito: false, windowId: 1 } };
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const startData = () => {
  const loginUrl = fetch.mock.calls.filter(([url]) => url.includes("/github/login?")).at(-1)?.[0];
  const params = new URLSearchParams({
    state: "test",
    redirect_uri: "https://extension.example/callback",
    code_challenge: loginUrl ? new URL(loginUrl).searchParams.get("codeChallenge") : "unused",
    code_challenge_method: "S256",
  });
  return {
    authUrl: `https://github.com/login/oauth/authorize?${params}`,
    state: "test",
    redirectUri: "https://extension.example/callback",
  };
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

describe("background account consent lifecycle", () => {
  let messageListener;
  let removeConsent;
  let consent;
  let originalCrypto;

  beforeEach(() => {
    jest.resetModules();
    const permissionRemovedListeners = new Set();
    consent = true;
    require("./src/core-data-consent").hasCoreDataPermission.mockResolvedValue(true);
    require("./src/core-data-consent").onCoreDataPermissionChanged.mockReturnValue(() => {});
    originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (bytes) => bytes.fill(1),
        subtle: {
          digest: async (algorithm, bytes) => require("node:crypto").createHash("sha256").update(bytes).digest(),
        },
      },
    });
    require("../common/vote-client").createVoteClient.mockReturnValue({
      ensureRegistered: jest.fn().mockResolvedValue({}),
      getRegisteredUser: jest.fn().mockResolvedValue(null),
      submitVote: jest.fn().mockResolvedValue(true),
    });
    global.__RYD_LIVE_TEST_BUILD__ = false;
    global.chrome = {
      runtime: {
        id: "extension-id",
        getURL: (path) => "moz-extension://fixture/" + path,
        getManifest: () => require("./manifest-firefox.json"),
        onMessage: { addListener: (listener) => (messageListener = listener) },
        onInstalled: { addListener: jest.fn() },
      },
      permissions: {
        getAll: jest.fn(() => Promise.resolve({ data_collection: consent ? ["authenticationInfo"] : [] })),
        contains: jest.fn().mockResolvedValue(true),
        onRemoved: {
          addListener: (listener) => {
            permissionRemovedListeners.add(listener);
            removeConsent = () =>
              [...permissionRemovedListeners].forEach((listener) =>
                listener({ data_collection: ["authenticationInfo"] }),
              );
          },
          removeListener: (listener) => permissionRemovedListeners.delete(listener),
        },
      },
      identity: {
        getRedirectURL: () => "https://extension.example/callback",
        launchWebAuthFlow: jest.fn(() => Promise.resolve("https://extension.example/callback?code=test&state=test")),
      },
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn((data, callback) => callback?.()),
          remove: jest.fn((keys, callback) => callback?.()),
        },
        onChanged: { addListener: jest.fn() },
      },
      tabs: {
        get: jest.fn(async () => ({ id: 9, url: "moz-extension://fixture/consent.html", incognito: false })),
        create: jest.fn(async () => ({ id: 9 })),
        reload: jest.fn(async () => {}),
        update: jest.fn(async () => ({ id: 9 })),
        query: jest.fn((query, callback) =>
          callback([{ id: 1, url: "https://www.youtube.com/watch?v=video123456", incognito: false }]),
        ),
        sendMessage: jest.fn(),
      },
    };
    global.browser = global.chrome;
    global.fetch = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => {});
    require("./ryd.background");
  });

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
    else delete globalThis.crypto;
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.fetch;
    delete global.__RYD_LIVE_TEST_BUILD__;
  });

  function revoke() {
    consent = false;
    removeConsent();
  }

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s shows Premium/raw counts after saving the account without changing its display mode",
    async (message) => {
      const stored = { hidePremiumTeaser: true, premiumAnalyticsView: "hidden" };
      const user = { fullName: "Test", hasActiveMembership: true, membershipTier: "premium" };
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        Object.assign(stored, data);
        callback?.();
      });
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user, sessionToken: "test-token" }),
      });
      const response = jest.fn(() => {
        expect(stored.hidePremiumTeaser).toBe(false);
      });

      messageListener({ message }, normalSender, response);
      await flushPromises();

      expect(response).toHaveBeenCalledWith({ success: true, user });
      expect(chrome.storage.sync.set).toHaveBeenNthCalledWith(
        1,
        { patreonAuthenticated: true, patreonUser: user, patreonSessionToken: "test-token" },
        expect.any(Function),
      );
      expect(chrome.storage.sync.set).toHaveBeenNthCalledWith(2, { hidePremiumTeaser: false }, expect.any(Function));
      expect(stored.premiumAnalyticsView).toBe("hidden");
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s leaves the visibility preference unchanged if OAuth is cancelled or fails",
    async (message) => {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() });
      chrome.identity.launchWebAuthFlow.mockRejectedValue(new Error("User cancelled"));
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s leaves visibility unchanged if saving the account fails",
    async (message) => {
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: "Storage unavailable" };
        callback();
        delete chrome.runtime.lastError;
      });
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "Test" }, sessionToken: "test-token" }),
      });
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.sync.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ hidePremiumTeaser: false }),
        expect.any(Function),
      );
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s and logout broadcast only to parsed YouTube hostnames",
    async (message) => {
      const youtubeUrls = [
        "https://youtube.com/watch?v=test",
        "https://www.youtube.com/watch?v=test",
        "https://m.youtube.com/watch?v=test",
        "https://music.youtube.com/",
        "https://studio.youtube.com/",
        "https://nested.subdomain.youtube.com/",
        "https://WWW.YOUTUBE.COM/watch?v=test",
        "http://www.youtube.com/watch?v=test",
        "https://www.youtube.com:8443/watch?v=test",
      ];
      const otherUrls = [
        undefined,
        null,
        "",
        "not a URL",
        "youtube.com/watch?v=test",
        "//www.youtube.com/watch?v=test",
        "https://[youtube.com/",
        "https://youtube.com:invalid/",
        "https://example.com/",
        "https://notyoutube.com/",
        "https://youtube.com.example.com/",
        "https://www.youtube.com.example.com/",
        "https://youtube.com@example.com/",
        "https://example.com/youtube.com/watch",
        "https://example.com/?ref=youtube.com",
        "https://example.com/#youtube.com",
        "https://returnyoutubedislikeapi.com/?ref=youtube.com",
        "about:blank#youtube.com",
        "data:text/plain,youtube.com",
        "blob:https://www.youtube.com/test",
      ];
      const youtubeTabs = youtubeUrls.map((url, id) => ({ id, url, incognito: false }));
      const otherTabs = otherUrls.map((url, index) => ({ id: youtubeTabs.length + index, url }));
      chrome.tabs.query.mockImplementation((query, callback) => callback([...otherTabs, ...youtubeTabs]));
      const user = { fullName: "Test" };
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user, sessionToken: "test-token" }),
      });
      const response = jest.fn();
      const statusMessages = () =>
        chrome.tabs.sendMessage.mock.calls.filter(([, payload]) => payload.message === "patreon_status_changed");

      messageListener({ message }, normalSender, response);
      await flushPromises();

      expect(response).toHaveBeenCalledWith({ success: true, user });
      expect(statusMessages()).toEqual(
        youtubeTabs.map(({ id }) => [
          id,
          { message: "patreon_status_changed", authenticated: true, user, sessionToken: "test-token" },
          expect.any(Function),
        ]),
      );

      chrome.tabs.sendMessage.mockClear();
      messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
      await flushPromises();

      expect(statusMessages()).toEqual(
        youtubeTabs.map(({ id }) => [
          id,
          { message: "patreon_status_changed", authenticated: false, user: null, sessionToken: null },
          expect.any(Function),
        ]),
      );
    },
  );

  test.each(["logout", "revocation"])(
    "discards an authenticated broadcast when its tab query completes after %s",
    async (event) => {
      let completeQuery;
      chrome.tabs.query.mockImplementationOnce((query, callback) => {
        completeQuery = callback;
      });
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "Test" }, sessionToken: "test-token" }),
      });
      messageListener({ message: "patreon_oauth_login" }, normalSender, jest.fn());
      await flushPromises();
      expect(completeQuery).toEqual(expect.any(Function));

      if (event === "revocation") revoke();
      else messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
      await flushPromises();
      const callsBeforeCompletion = chrome.tabs.sendMessage.mock.calls.slice();

      completeQuery([{ id: 1, url: "https://www.youtube.com/watch?v=test", incognito: false }]);

      expect(chrome.tabs.sendMessage.mock.calls).toEqual(callsBeforeCompletion);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { message: "patreon_status_changed", authenticated: false, user: null, sessionToken: null },
        expect.any(Function),
      );
    },
  );

  test("does not register a voter when the background starts", async () => {
    await flushPromises();
    const voteClient = require("../common/vote-client").createVoteClient.mock.results[0].value;
    expect(voteClient.ensureRegistered).not.toHaveBeenCalled();
    expect(voteClient.submitVote).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test.each([
    "send_vote",
    "register",
    "patreon_oauth_login",
    "github_oauth_login",
    "patreon_logout",
    "ryd_discussion",
    "set_state",
    "send_links",
    "ryd_open_tab",
    "ryd_open_consent",
    "ryd_has_authentication_consent",
  ])("private %s is rejected before shared work", async (message) => {
    const response = jest.fn();
    messageListener(
      {
        message,
        videoId: "abcdefghijk",
        vote: -1,
        videoIds: Array(20).fill("abcdefghijk"),
        url: "https://example.org/",
      },
      { ...normalSender, tab: { id: 2, incognito: true }, url: "moz-extension://fixture/consent.html" },
      response,
    );
    await flushPromises();
    expect(response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        granted: false,
        error: expect.objectContaining({ code: "private_browsing" }),
      }),
    );
    const client = require("../common/vote-client").createVoteClient.mock.results[0].value;
    expect(client.ensureRegistered).not.toHaveBeenCalled();
    expect(client.getRegisteredUser).not.toHaveBeenCalled();
    expect(client.submitVote).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  test("private tabs can read consent but receive no account broadcasts", async () => {
    chrome.tabs.query.mockImplementation((query, callback) =>
      callback([
        { id: 1, url: "https://www.youtube.com/watch?v=test", incognito: false },
        { id: 2, url: "https://www.youtube.com/watch?v=test", incognito: true },
      ]),
    );
    const response = jest.fn();
    messageListener({ message: "ryd_has_core_consent" }, { id: "extension-id", tab: { incognito: true } }, response);
    messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
    await flushPromises();
    expect(response).toHaveBeenCalledWith({ granted: true });
    const recipients = chrome.tabs.sendMessage.mock.calls
      .filter(([, payload]) => payload.message === "patreon_status_changed")
      .map(([id]) => id);
    expect(recipients).toEqual([1]);
  });

  test.each([-1, 0, 1])("submits vote %s through the client that registers on demand", async (vote) => {
    const response = jest.fn();
    messageListener({ message: "send_vote", videoId: "video123456", vote }, normalSender, response);
    await flushPromises();
    const voteClient = require("../common/vote-client").createVoteClient.mock.results[0].value;
    expect(voteClient.submitVote).toHaveBeenCalledWith("video123456", vote);
    expect(response).toHaveBeenCalledWith({ success: true });
  });

  test.each(["send_vote", "register", "patreon_oauth_login", "github_oauth_login"])(
    "%s cannot register or send data before core consent",
    async (message) => {
      require("./src/core-data-consent").hasCoreDataPermission.mockResolvedValue(false);
      const response = jest.fn();
      messageListener({ message, videoId: "video123456", vote: -1 }, normalSender, response);
      await flushPromises();
      const client = require("../common/vote-client").createVoteClient.mock.results[0].value;
      expect(client.ensureRegistered).not.toHaveBeenCalled();
      expect(client.submitVote).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  test("a standalone registration request does not create an ID", async () => {
    const response = jest.fn();
    messageListener({ message: "register" }, normalSender, response);
    await flushPromises();
    expect(response).toHaveBeenCalledWith({ success: false, error: "vote_required" });
    expect(
      require("../common/vote-client").createVoteClient.mock.results[0].value.ensureRegistered,
    ).not.toHaveBeenCalled();
  });

  test.each([
    { url: "moz-extension://fixture/consent.html" },
    { url: "moz-extension://fixture/consent.html#permission-details" },
    { url: "https://www.youtube.com/watch?v=video123456", frameId: 0 },
    { url: "https://m.youtube.com/", frameId: 0 },
    { url: "http://youtube.com/", frameId: 0 },
  ])(
    "the explainer or top-level YouTube launcher opens and refreshes the reused consent page (%j)",
    async (context) => {
      const response = jest.fn();
      const sender = { ...normalSender, ...context };
      messageListener({ message: "ryd_open_consent" }, sender, response);
      messageListener({ message: "ryd_open_consent" }, sender, response);
      await flushPromises();
      expect(response).toHaveBeenCalledWith({ success: true });
      expect(chrome.tabs.reload).not.toHaveBeenCalled();
      messageListener({ message: "ryd_open_consent" }, sender, response);
      await flushPromises();
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.reload).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.reload).toHaveBeenCalledWith(9);
      expect(chrome.tabs.update).toHaveBeenCalledWith(9, { active: true });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test.each([
    { id: "other-extension" },
    { frameId: 1 },
    { frameId: undefined },
    { tab: undefined },
    { tab: { id: 2, incognito: true } },
    { tab: { id: 2 } },
    { url: "https://example.com/" },
    { url: "https://youtube.com.example.com/" },
    { url: "https://youtube.com@example.com/" },
    { url: "blob:https://www.youtube.com/test" },
    { url: "not a URL" },
    { url: "moz-extension://fixture/consent.html#unrelated" },
    { url: "moz-extension://fixture/consent.html?redirect=https://example.com" },
  ])("rejects unrelated consent-page opener contexts (%j)", async (override) => {
    const response = jest.fn();
    messageListener(
      { message: "ryd_open_consent" },
      { ...normalSender, url: "https://www.youtube.com/watch?v=video123456", frameId: 0, ...override },
      response,
    );
    await flushPromises();
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("reopens the explainer if its previous tab has navigated away", async () => {
    const sender = { ...normalSender, url: "moz-extension://fixture/consent.html" };
    messageListener({ message: "ryd_open_consent" }, sender, jest.fn());
    await flushPromises();
    chrome.tabs.get.mockResolvedValue({ id: 9, url: "https://example.org/" });
    messageListener({ message: "ryd_open_consent" }, sender, jest.fn());
    await flushPromises();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });

  test("Read more opens the fixed details URL without requesting permission", async () => {
    chrome.permissions.request = jest.fn();
    messageListener(
      { message: "ryd_open_consent", details: true, url: "https://example.com/" },
      { ...normalSender, url: "https://www.youtube.com/watch?v=video123456", frameId: 0 },
      jest.fn(),
    );
    await flushPromises();
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: "moz-extension://fixture/consent.html#permission-details" }),
    );
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("Read more reuses the consent tab and Continue restores the compact page", async () => {
    const sender = { ...normalSender, url: "https://www.youtube.com/watch?v=video123456", frameId: 0 };
    messageListener({ message: "ryd_open_consent" }, sender, jest.fn());
    await flushPromises();
    messageListener({ message: "ryd_open_consent", details: true }, sender, jest.fn());
    await flushPromises();
    expect(chrome.tabs.update).toHaveBeenCalledWith(9, {
      url: "moz-extension://fixture/consent.html#permission-details",
    });
    chrome.tabs.get.mockResolvedValue({
      id: 9,
      url: "moz-extension://fixture/consent.html#permission-details",
      incognito: false,
    });
    messageListener({ message: "ryd_open_consent" }, sender, jest.fn());
    await flushPromises();
    expect(chrome.tabs.update).toHaveBeenCalledWith(9, { url: "moz-extension://fixture/consent.html" });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.reload).toHaveBeenCalledTimes(2);
  });

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s sends nothing when consent is denied",
    async (message) => {
      consent = false;
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      expect(fetch).not.toHaveBeenCalled();
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s sends nothing when Firefox does not expose built-in data consent",
    async (message) => {
      chrome.permissions.getAll.mockResolvedValue({ permissions: ["identity"], origins: [] });
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      expect(fetch).not.toHaveBeenCalled();
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s does not open OAuth after consent is revoked during startup",
    async (message) => {
      const start = deferred();
      fetch.mockReturnValueOnce(start.promise);
      messageListener({ message }, normalSender, jest.fn());
      await flushPromises();
      revoke();
      start.resolve({ ok: true, json: async () => startData() });
      await flushPromises();
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s does not exchange an OAuth code after logout",
    async (message) => {
      const oauth = deferred();
      fetch.mockResolvedValue({ ok: true, json: async () => startData() });
      chrome.identity.launchWebAuthFlow.mockReturnValue(oauth.promise);
      messageListener({ message }, normalSender, jest.fn());
      await flushPromises();
      messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
      oauth.resolve("https://extension.example/callback?code=test&state=test");
      await flushPromises();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    },
  );

  test.each(["patreon_oauth_login", "github_oauth_login"])(
    "%s discards an exchange result arriving after revocation",
    async (message) => {
      const exchange = deferred();
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockReturnValueOnce(exchange.promise);
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      expect(fetch).toHaveBeenCalledTimes(2);
      revoke();
      exchange.resolve({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "Test" }, sessionToken: "test-token" }),
      });
      await flushPromises();
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  test.each([
    ["patreon_oauth_login", "logout"],
    ["patreon_oauth_login", "revocation"],
    ["github_oauth_login", "logout"],
    ["github_oauth_login", "revocation"],
  ])(
    "clears a pending %s session after %s without changing visibility if its save completes later",
    async (message, event) => {
      let saved;
      const stored = { hidePremiumTeaser: true };
      chrome.storage.sync.set.mockImplementation((data, callback) => {
        saved = () => {
          Object.assign(stored, data);
          callback();
        };
      });
      chrome.storage.sync.remove.mockImplementation((keys, callback) => {
        for (const key of keys) delete stored[key];
        callback();
      });
      fetch.mockResolvedValueOnce({ ok: true, json: async () => startData() }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "Test" }, sessionToken: "test-token" }),
      });
      const response = jest.fn();
      messageListener({ message }, normalSender, response);
      await flushPromises();
      if (event === "revocation") revoke();
      else messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
      await flushPromises();
      expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
      saved();
      await flushPromises();
      expect(stored).toEqual({ hidePremiumTeaser: true });
      expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.sync.remove).toHaveBeenCalledTimes(1);
      expect(
        chrome.tabs.sendMessage.mock.calls
          .filter(([, message]) => message.message === "patreon_status_changed")
          .every(([, message]) => message.authenticated === false),
      ).toBe(true);
      expect(
        chrome.tabs.sendMessage.mock.calls
          .filter(([, message]) => message.message === "ryd_discussion_event" && message.type === "session")
          .every(([, message]) => message.data.authenticated === false),
      ).toBe(true);
      expect(response).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  test("keeps the new account when an old save finishes after logout and a new sign-in", async () => {
    let completeOldSave;
    const stored = {};
    chrome.storage.sync.set
      .mockImplementationOnce((data, callback) => {
        completeOldSave = () => {
          Object.assign(stored, data);
          callback();
        };
      })
      .mockImplementation((data, callback) => {
        Object.assign(stored, data);
        callback();
      });
    chrome.storage.sync.remove.mockImplementation((keys, callback) => {
      for (const key of keys) delete stored[key];
      callback();
    });
    const start = { ok: true, json: async () => startData() };
    fetch
      .mockResolvedValueOnce(start)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "Old" }, sessionToken: "old-token" }),
      })
      .mockResolvedValueOnce(start)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { fullName: "New" }, sessionToken: "new-token" }),
      });
    messageListener({ message: "patreon_oauth_login" }, normalSender, jest.fn());
    await flushPromises();
    messageListener({ message: "patreon_logout" }, normalSender, jest.fn());
    const newResponse = jest.fn();
    messageListener({ message: "github_oauth_login" }, normalSender, newResponse);
    await flushPromises();
    completeOldSave();
    await flushPromises();
    expect(stored.patreonSessionToken).toBe("new-token");
    expect(stored.patreonUser.fullName).toBe("New");
    expect(newResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
