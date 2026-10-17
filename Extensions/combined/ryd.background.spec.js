jest.mock("../common/vote-client", () => ({ createVoteClient: jest.fn() }));

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
    consent = true;
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
    require("../common/vote-client").createVoteClient.mockReturnValue({ ensureRegistered: () => Promise.resolve({}) });
    global.__RYD_LIVE_TEST_BUILD__ = false;
    global.chrome = {
      runtime: {
        getManifest: () => require("./manifest-firefox.json"),
        onMessage: { addListener: (listener) => (messageListener = listener) },
        onInstalled: { addListener: jest.fn() },
      },
      permissions: {
        getAll: jest.fn(() => Promise.resolve({ data_collection: consent ? ["authenticationInfo"] : [] })),
        contains: jest.fn().mockResolvedValue(true),
        onRemoved: {
          addListener: (listener) => {
            removeConsent = () => listener({ data_collection: ["authenticationInfo"] });
          },
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
        query: jest.fn((query, callback) => callback([{ id: 1, url: "https://www.youtube.com/watch?v=video123456" }])),
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
    "%s sends nothing when consent is denied",
    async (message) => {
      consent = false;
      const response = jest.fn();
      messageListener({ message }, {}, response);
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
      messageListener({ message }, {}, response);
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
      messageListener({ message }, {}, jest.fn());
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
      messageListener({ message }, {}, jest.fn());
      await flushPromises();
      messageListener({ message: "patreon_logout" }, {}, jest.fn());
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
      messageListener({ message }, {}, response);
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

  test.each(["logout", "revocation"])(
    "clears a pending stored session after %s even if its save completes later",
    async (event) => {
      let saved;
      const stored = {};
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
      messageListener({ message: "patreon_oauth_login" }, {}, response);
      await flushPromises();
      if (event === "revocation") revoke();
      else messageListener({ message: "patreon_logout" }, {}, jest.fn());
      await flushPromises();
      expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
      saved();
      await flushPromises();
      expect(stored).toEqual({});
      expect(chrome.storage.sync.remove).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.sendMessage.mock.calls.every(([, message]) => message.authenticated === false)).toBe(true);
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
    messageListener({ message: "patreon_oauth_login" }, {}, jest.fn());
    await flushPromises();
    messageListener({ message: "patreon_logout" }, {}, jest.fn());
    const newResponse = jest.fn();
    messageListener({ message: "github_oauth_login" }, {}, newResponse);
    await flushPromises();
    completeOldSave();
    await flushPromises();
    expect(stored.patreonSessionToken).toBe("new-token");
    expect(stored.patreonUser.fullName).toBe("New");
    expect(newResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
