/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");
jest.mock("./src/discussion/popup", () => ({ initDiscussionPopup: jest.fn() }));
jest.mock("./src/core-data-consent", () => ({
  ...jest.requireActual("./src/core-data-consent"),
  hasFeaturePermission: jest.fn(),
  onDataPermissionsChanged: jest.fn(),
}));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("popup vote submission setting per browser", () => {
  let granted;
  let listeners;
  let control;
  async function open({ categories = [], firefox = true, toolbar = false } = {}) {
    jest.resetModules();
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    const messages = require("./_locales/en/messages.json");
    granted = new Set(categories);
    listeners = [];
    global.chrome = {
      i18n: {
        getMessage: (key) => ({ "@@ui_locale": "en", "@@bidi_dir": "ltr" })[key] || messages[key]?.message || "",
      },
      runtime: {
        getManifest: () => (firefox ? require("./manifest-firefox.json") : { version: "1.0.0" }),
        sendMessage: jest.fn(async () => ({ success: true })),
      },
      extension: { getViews: () => (toolbar ? [window] : []) },
      permissions: {
        remove: jest.fn(async ({ data_collection }) => {
          for (const category of data_collection) granted.delete(category);
          return true;
        }),
        request: jest.fn(),
      },
      tabs: { create: jest.fn() },
      storage: {
        sync: {
          get: jest.fn((keys, callback) =>
            callback({ numberDisplayFormat: "compactShort", hideClutterButtons: false }),
          ),
          set: jest.fn(),
          remove: jest.fn(),
        },
        onChanged: { addListener: jest.fn() },
      },
    };
    global.browser = chrome;
    const permissions = require("./src/core-data-consent");
    permissions.hasFeaturePermission.mockImplementation(async (feature) =>
      permissions.FEATURE_DATA_PERMISSIONS[feature].every((category) => granted.has(category)),
    );
    permissions.onDataPermissionsChanged.mockImplementation((listener) => {
      listeners.push(listener);
      return () => {};
    });
    require("./popup");
    control = document.getElementById("disable_vote_submission");
    await flush();
  }
  afterEach(() => {
    jest.restoreAllMocks();
    window.history.replaceState(null, "", "/");
    delete global.chrome;
    delete global.browser;
  });
  test.each([
    [[]],
    [["websiteContent"]],
    [["websiteActivity"]],
    [["browsingActivity", "websiteActivity", "websiteContent"]],
  ])("Firefox keeps the vote submission switch whatever Firefox grants: %j", async (categories) => {
    await open({ categories });
    const messages = require("./_locales/en/messages.json");
    const label = control.closest("label");
    expect(label.dataset.hover).toBe(messages.textSettingsHover.message);
    expect(label.querySelector(".switchLabel").textContent.trim()).toBe(messages.textSettings.message.trim());
    const requested = chrome.storage.sync.get.mock.calls.flatMap(([keys]) => [].concat(keys));
    expect(requested).toContain("disableVoteSubmission");
    control.click();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: true });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
  });
  test("Firefox permission changes never write a vote setting to synced storage", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity"] });
    granted.delete("websiteActivity");
    for (const listener of listeners) listener({ added: [], removed: ["websiteActivity"] });
    granted.add("websiteActivity");
    for (const listener of listeners) listener({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(chrome.storage.sync.set.mock.calls.some(([values]) => "disableVoteSubmission" in values)).toBe(false);
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });
  test("preserves the existing Chrome and Safari disable-voting switch", async () => {
    await open({ firefox: false });
    const messages = require("./_locales/en/messages.json");
    const label = control.closest("label");
    expect(label.dataset.hover).toBe(messages.textSettingsHover.message);
    expect(label.querySelector(".switchLabel").textContent.trim()).toBe(messages.textSettings.message.trim());
    control.click();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: true });
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
  });
  test("explains the second sign-in click on the handoff page", async () => {
    window.history.replaceState(null, "", "/#github-login-btn");
    await open();
    expect(document.getElementById("signin-next-click").hidden).toBe(false);
    expect(document.activeElement.id).toBe("github-login-btn");
  });
});
