/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");
jest.mock("./src/consent-prompt", () => ({ waitForCoreDataConsent: () => Promise.resolve() }));
jest.mock("./src/core-data-consent", () => ({
  fetchWithCoreConsent: (...args) => fetch(...args),
  onCoreDataPermissionChanged: jest.fn(),
}));

jest.mock("./src/data-collection-permissions", () => ({
  hasAuthenticationDataPermission: jest.fn(),
  onAuthenticationDataPermissionRemoved: jest.fn(),
  requestAuthenticationDataPermission: jest.fn(),
  usesFirefoxDataCollectionConsent: jest.fn(),
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const cachedUser = { fullName: "Test User", imageUrl: "https://example.org/avatar", membershipTier: "none" };

describe("popup account consent lifecycle", () => {
  let readCachedSession;
  let removeConsent;
  let consent;

  beforeEach(async () => {
    jest.resetModules();
    consent = true;
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    const permissions = require("./src/data-collection-permissions");
    permissions.usesFirefoxDataCollectionConsent.mockReturnValue(true);
    permissions.hasAuthenticationDataPermission.mockImplementation(() => Promise.resolve(consent));
    permissions.requestAuthenticationDataPermission.mockImplementation(() => Promise.resolve(consent));
    permissions.onAuthenticationDataPermissionRemoved.mockImplementation((listener) => (removeConsent = listener));
    global.chrome = {
      i18n: { getMessage: () => "" },
      runtime: { getManifest: () => ({ version: "4.0.5" }), sendMessage: jest.fn() },
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
    global.fetch = jest.fn();
    require("./popup");
    await flushPromises();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
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
