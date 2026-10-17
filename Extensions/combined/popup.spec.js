/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const cachedUser = { fullName: "Test User", imageUrl: "https://example.org/avatar", membershipTier: "none" };

describe("popup account consent lifecycle", () => {
  let readCachedSession;
  let removeConsent;
  let consent;

  beforeEach(() => {
    jest.resetModules();
    consent = true;
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    global.chrome = {
      i18n: { getMessage: () => "" },
      runtime: { getManifest: () => require("./manifest-firefox.json"), sendMessage: jest.fn() },
      permissions: {
        getAll: jest.fn(() => Promise.resolve({ data_collection: consent ? ["authenticationInfo"] : [] })),
        contains: jest.fn().mockResolvedValue(true),
        request: jest.fn(() => Promise.resolve(consent)),
        onRemoved: {
          addListener: (listener) => {
            removeConsent = () => listener({ data_collection: ["authenticationInfo"] });
          },
        },
      },
      identity: { getRedirectURL: jest.fn() },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            if (keys.includes("patreonUser")) readCachedSession = callback;
          }),
          set: jest.fn(),
          remove: jest.fn(),
        },
        onChanged: { addListener: jest.fn() },
      },
    };
    global.browser = global.chrome;
    global.fetch = jest.fn();
    require("./popup");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.fetch;
  });

  test.each([
    ["github_not_configured", "githubLoginUnavailable"],
    ["github_unavailable", "githubLoginUnavailable"],
    ["not_contributor", "githubLoginNotContributor"],
    ["github_redirect_rejected", "githubLoginBrowserUnavailable"],
    ["github_invalid_state", "githubLoginExpired"],
    ["github_pkce_required", "githubLoginUpdateRequired"],
    ["github_rate_limited", "githubLoginRateLimited"],
    ["github_authorization_denied", "githubLoginDenied"],
    ["unexpected", "githubLoginCompleteFailed"],
  ])("shows the actionable GitHub message for %s", async (error, key) => {
    const messages = require("./_locales/en/messages.json");
    chrome.i18n.getMessage = (name) => messages[name]?.message || "";
    const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    chrome.runtime.sendMessage.mockImplementation((request, callback) => callback({ success: false, error }));
    document.getElementById("github-login-btn").click();
    await flushPromises();
    expect(alert).toHaveBeenCalledWith(messages[key].message);
  });

  function revoke() {
    consent = false;
    removeConsent();
  }

  function expectLoggedOut() {
    expect(document.getElementById("patreon-logged-in").style.display).toBe("none");
    expect(document.getElementById("patreon-user-avatar").hasAttribute("src")).toBe(false);
  }

  test.each([[], undefined])("does not verify or display cached account data without a grant: %j", async (granted) => {
    chrome.permissions.getAll.mockResolvedValue({ permissions: ["identity"], data_collection: granted });
    readCachedSession({ patreonUser: cachedUser, patreonSessionToken: "test-token" });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).toHaveBeenCalledWith([
      "patreonAuthenticated",
      "patreonUser",
      "patreonSessionToken",
    ]);
    expectLoggedOut();
  });

  test.each(["patreon-login-btn", "github-login-btn"])(
    "does not start %s when Firefox denies authentication consent",
    async (button) => {
      consent = false;
      jest.spyOn(window, "alert").mockImplementation(() => {});
      document.getElementById(button).click();
      expect(chrome.permissions.request).toHaveBeenCalledWith({ data_collection: ["authenticationInfo"] });
      await flushPromises();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test.each(["patreon-login-btn", "github-login-btn"])(
    "does not start %s after a request succeeds without a recorded grant",
    async (button) => {
      chrome.permissions.getAll.mockResolvedValue({ permissions: ["identity"], data_collection: [] });
      jest.spyOn(window, "alert").mockImplementation(() => {});
      document.getElementById(button).click();
      await flushPromises();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("does not verify or show a cached session whose storage read completes after revocation", async () => {
    revoke();
    readCachedSession({ patreonUser: cachedUser, patreonSessionToken: "test-token" });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    expectLoggedOut();
  });

  test.each(["revocation", "logout"])(
    "does not restore an account or avatar from verification after %s",
    async (event) => {
      let resolveVerify;
      fetch.mockReturnValue(new Promise((resolve) => (resolveVerify = resolve)));
      readCachedSession({ patreonUser: cachedUser, patreonSessionToken: "test-token" });
      await flushPromises();
      expect(fetch).toHaveBeenCalledTimes(1);
      if (event === "revocation") revoke();
      else document.getElementById("patreon-logout-btn").click();
      resolveVerify({ json: async () => ({ valid: true, membershipTier: "premium" }) });
      await flushPromises();
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      expectLoggedOut();
    },
  );

  test.each(["patreon-login-btn", "github-login-btn"])(
    "ignores a successful %s callback after revocation",
    async (button) => {
      let loginComplete;
      chrome.runtime.sendMessage.mockImplementation((request, callback) => (loginComplete = callback));
      document.getElementById(button).click();
      await flushPromises();
      expect(typeof loginComplete).toBe("function");
      revoke();
      loginComplete({ success: true, user: cachedUser });
      await flushPromises();
      expectLoggedOut();
    },
  );
});
