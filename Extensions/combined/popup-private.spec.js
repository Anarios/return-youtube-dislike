/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");

jest.mock("./src/discussion/popup", () => ({ initDiscussionPopup: jest.fn() }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("private popup", () => {
  function openPopup({ privateBrowsing, firefox = true, categories = [] }) {
    jest.resetModules();
    const messages = require("./_locales/en/messages.json");
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    global.chrome = {
      extension: { inIncognitoContext: privateBrowsing },
      i18n: { getMessage: (key) => messages[key]?.message || "" },
      runtime: {
        getManifest: () => (firefox ? require("./manifest-firefox.json") : { version: "1.0.0" }),
        sendMessage: jest.fn(),
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: categories })),
        request: jest.fn(),
        onRemoved: { addListener: jest.fn() },
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
        local: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
        onChanged: { addListener: jest.fn() },
      },
    };
    global.browser = global.chrome;
    global.fetch = jest.fn();
    require("./popup");
  }

  afterEach(() => {
    delete global.chrome;
    delete global.browser;
    delete global.fetch;
  });

  test.each([false, true])(
    "shows private count guidance without shared-state initialization (granted: %s)",
    async (granted) => {
      openPopup({ privateBrowsing: true, categories: granted ? ["browsingActivity"] : [] });
      await flush();

      expect(document.getElementById("ryd-private-counts-message").textContent).toBe(
        require("./_locales/en/messages.json")[granted ? "consent_private_counts" : "counts_consent_private"].message,
      );
      expect(document.querySelector("h1").textContent).toBe("Return YouTube Dislike");
      expect(document.querySelectorAll("img")).toHaveLength(1);
      expect(document.querySelector("img").getAttribute("src")).toBe("icons/logo.svg");
      expect(
        document.querySelector("button, input, select, a, iframe, #patreon-section, #ryd-discussion-popup"),
      ).toBeNull();
      expect(chrome.storage.sync.get).not.toHaveBeenCalled();
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
      expect(chrome.storage.onChanged.addListener).not.toHaveBeenCalled();
      expect(chrome.permissions.getAll).toHaveBeenCalledTimes(1);
      expect(chrome.permissions.request).not.toHaveBeenCalled();
      expect(chrome.permissions.onRemoved.addListener).not.toHaveBeenCalled();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      expect(chrome.tabs.create).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(require("./src/discussion/popup").initDiscussionPopup).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["a normal Firefox window", false, true],
    ["a Chrome incognito window", true, false],
  ])(
    "preserves consent, account, discussion, links and settings initialization in %s",
    async (_, privateBrowsing, firefox) => {
      openPopup({ privateBrowsing, firefox });
      await flush();

      expect(document.getElementById("ryd-private-counts-message")).toBeNull();
      expect(require("./src/discussion/popup").initDiscussionPopup).toHaveBeenCalledTimes(1);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        ["patreonUser", "patreonSessionToken"],
        expect.any(Function),
      );
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(2);

      document.getElementById("link_website").click();
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
      document.getElementById("disable_vote_submission").click();
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: true });
      const settings = document.getElementById("advancedSettings");
      expect(settings.hasAttribute("inert")).toBe(true);
      document.getElementById("advancedToggle").click();
      expect(settings.style.pointerEvents).toBe("auto");
      expect(settings.inert).toBe(false);
      document.getElementById("advancedToggle").click();
      expect(settings.style.pointerEvents).toBe("none");
      expect(settings.inert).toBe(true);
    },
  );
});
