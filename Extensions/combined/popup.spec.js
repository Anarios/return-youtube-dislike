/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");
jest.mock("./src/consent-prompt", () => ({ waitForCoreDataConsent: jest.fn(() => Promise.resolve()) }));
jest.mock("./src/core-data-consent", () => ({
  fetchWithCoreConsent: (...args) => fetch(...args),
  onCoreDataPermissionChanged: jest.fn(),
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const cachedUser = { fullName: "Test User", imageUrl: "https://example.org/avatar", membershipTier: "none" };

describe("popup account consent lifecycle", () => {
  let readCachedSession;
  let removeConsent;
  let removeCoreConsent;
  let consent;

  beforeEach(async () => {
    jest.resetModules();
    const permissionRemovedListeners = new Set();
    const coreConsentListeners = new Set();
    require("./src/core-data-consent").onCoreDataPermissionChanged.mockImplementation((listener) => {
      coreConsentListeners.add(listener);
      return () => coreConsentListeners.delete(listener);
    });
    removeCoreConsent = () => [...coreConsentListeners].forEach((listener) => listener(false));
    consent = true;
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    global.chrome = {
      i18n: { getMessage: () => "" },
      runtime: {
        getManifest: () => require("./manifest-firefox.json"),
        getURL: (path) => `moz-extension://fixture/${path}`,
        sendMessage: jest.fn(),
      },
      extension: { getViews: jest.fn(() => []) },
      tabs: { create: jest.fn().mockResolvedValue({ id: 9 }) },
      permissions: {
        getAll: jest.fn(() => Promise.resolve({ data_collection: consent ? ["authenticationInfo"] : [] })),
        contains: jest.fn().mockResolvedValue(true),
        request: jest.fn(() => Promise.resolve(consent)),
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
    await flushPromises();
    chrome.runtime.sendMessage.mockClear();
  });

  afterEach(() => {
    window.location.hash = "";
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.fetch;
  });

  test.each(["patreon-login-btn", "github-login-btn"])(
    "focuses the selected %s after the asynchronous account view becomes visible",
    async (buttonId) => {
      window.location.hash = `#${buttonId}`;
      const button = document.getElementById(buttonId);
      const focus = jest.spyOn(button, "focus").mockImplementation(() => {
        expect(document.getElementById("patreon-logged-out").style.display).toBe("block");
      });
      expect(document.getElementById("patreon-logged-out").style.display).toBe("none");
      await readCachedSession({});
      expect(focus).toHaveBeenCalledTimes(1);
    },
  );

  test.each([true, false])("moves toolbar core consent into a tab and closes only on success=%s", async (success) => {
    chrome.extension.getViews.mockReturnValue([window]);
    jest.resetModules();
    const waitForConsent = require("./src/consent-prompt").waitForCoreDataConsent;
    require("./popup");
    const options = waitForConsent.mock.calls[0][0];
    expect(options.alwaysExplain).toBe(false);
    expect(options.openConsentPage).toEqual(expect.any(Function));
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    let complete;
    chrome.tabs.create.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          complete = () => (success ? resolve({ id: 9 }) : reject(new Error("Could not open tab")));
        }),
    );
    const opening = options.openConsentPage();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "moz-extension://fixture/consent.html", active: true });
    expect(close).not.toHaveBeenCalled();
    complete();
    if (success) await opening;
    else await expect(opening).rejects.toThrow("Could not open tab");
    expect(close).toHaveBeenCalledTimes(success ? 1 : 0);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
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

  function expectPremiumVisibilityLabel(hasPremiumAnalytics) {
    const messages = require("./_locales/en/messages.json");
    const messageKey = hasPremiumAnalytics ? "hidePremiumAnalytics" : "hidePremiumTeaser";
    const label = document.getElementById("hide_premium_teaser").closest("label");
    expect(label.querySelector(".switchLabel").textContent).toBe(messages[messageKey].message);
    expect(label.dataset.hover).toBe(messages[`${messageKey}Hover`].message);
  }

  function localizeMembershipLabels() {
    const messages = require("./_locales/en/messages.json");
    chrome.i18n.getMessage = (key) => messages[key]?.message || "";
  }

  test.each([
    ["premium", true, true],
    ["supporter", true, false],
    ["commenter", true, false],
    ["none", true, false],
    ["premium", false, false],
    ["premium", undefined, false],
    ["premium", "true", false],
  ])(
    "uses the matching visibility label for cached %s membership with active=%s",
    async (membershipTier, active, premium) => {
      localizeMembershipLabels();
      fetch.mockReturnValue(new Promise(() => {}));
      await readCachedSession({
        patreonUser: { ...cachedUser, membershipTier, hasActiveMembership: active },
        patreonSessionToken: "test-token",
      });
      expectPremiumVisibilityLabel(premium);
    },
  );

  test.each([
    ["supporter", true, { valid: true, membershipTier: "premium" }, true],
    ["premium", true, { valid: true, membershipTier: "supporter" }, false],
    ["premium", false, { valid: true, membershipTier: "premium" }, true],
    ["premium", true, { valid: false, failureReason: "membershipinactive", membershipTier: "premium" }, false],
  ])(
    "updates the visibility label after verifying cached %s membership with active=%s",
    async (membershipTier, active, verification, premium) => {
      localizeMembershipLabels();
      fetch.mockResolvedValue({ json: async () => verification });
      document.getElementById("hide_premium_teaser").click();
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ hidePremiumTeaser: true });
      await readCachedSession({
        patreonUser: { ...cachedUser, membershipTier, hasActiveMembership: active },
        patreonSessionToken: "test-token",
      });
      await flushPromises();
      expectPremiumVisibilityLabel(premium);
      expect(document.getElementById("hide_premium_teaser").checked).toBe(true);
    },
  );

  test("keeps the raw-count visibility label for logged-out users", async () => {
    localizeMembershipLabels();
    await readCachedSession({});
    expectPremiumVisibilityLabel(false);
  });

  test.each(["patreon-login-btn", "github-login-btn"])(
    "updates the visibility label after %s and restores it on logout",
    async (button) => {
      localizeMembershipLabels();
      chrome.runtime.sendMessage.mockImplementation((request, callback) =>
        callback?.({ success: true, user: { ...cachedUser, membershipTier: "premium", hasActiveMembership: true } }),
      );
      document.getElementById(button).click();
      await flushPromises();
      expectPremiumVisibilityLabel(true);
      document.getElementById("patreon-logout-btn").click();
      expectPremiumVisibilityLabel(false);
    },
  );

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

  test.each(["patreon-login-btn", "github-login-btn"])(
    "moves missing %s consent out of the toolbar before requesting permission",
    async (button) => {
      consent = false;
      chrome.extension.getViews.mockReturnValue([window]);
      const close = jest.spyOn(window, "close").mockImplementation(() => {});
      let opened;
      chrome.tabs.create.mockImplementation(() => new Promise((resolve) => (opened = resolve)));
      document.getElementById(button).click();
      document.getElementById(button).click();
      await flushPromises();
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: `moz-extension://fixture/popup.html#${button}`,
        active: true,
      });
      expect(chrome.permissions.request).not.toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      opened({ id: 9 });
      await flushPromises();
      expect(close).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["patreon", "github"])("keeps already-granted %s toolbar login in the existing flow", async (provider) => {
    chrome.extension.getViews.mockReturnValue([window]);
    document.getElementById(`${provider}-login-btn`).click();
    await flushPromises();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { message: `${provider}_oauth_login` },
      expect.any(Function),
    );
  });

  test("failed consent-tab opening leaves the toolbar open and can be retried", async () => {
    consent = false;
    chrome.extension.getViews.mockReturnValue([window]);
    chrome.tabs.create.mockRejectedValueOnce(new Error("Tab could not open"));
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
    document.getElementById("github-login-btn").click();
    await flushPromises();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    document.getElementById("github-login-btn").click();
    await flushPromises();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test.each(["revocation", "logout"])(
    "does not open a consent tab after %s during its permission query",
    async (event) => {
      chrome.extension.getViews.mockReturnValue([window]);
      let resolvePermission;
      chrome.permissions.getAll.mockImplementationOnce(() => new Promise((resolve) => (resolvePermission = resolve)));
      document.getElementById("patreon-login-btn").click();
      if (event === "revocation") removeCoreConsent();
      else document.getElementById("patreon-logout-btn").click();
      chrome.runtime.sendMessage.mockClear();
      resolvePermission({ data_collection: [] });
      await flushPromises();
      expect(chrome.tabs.create).not.toHaveBeenCalled();
      expect(chrome.permissions.request).not.toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    },
  );

  test("does not verify or show a cached session whose storage read completes after revocation", async () => {
    revoke();
    readCachedSession({ patreonUser: cachedUser, patreonSessionToken: "test-token" });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    expectLoggedOut();
  });

  test("does not restore an account when core consent is removed during the final account-permission query", async () => {
    let resolvePermission;
    fetch.mockResolvedValue({
      json: async () => {
        chrome.permissions.getAll.mockImplementationOnce(() => new Promise((resolve) => (resolvePermission = resolve)));
        return { valid: true, membershipTier: "premium" };
      },
    });
    readCachedSession({ patreonUser: cachedUser, patreonSessionToken: "test-token" });
    await flushPromises();
    expect(typeof resolvePermission).toBe("function");

    removeCoreConsent();
    resolvePermission({ data_collection: ["authenticationInfo"] });
    await flushPromises();

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).toHaveBeenCalledWith([
      "patreonAuthenticated",
      "patreonUser",
      "patreonSessionToken",
    ]);
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
