jest.mock("../common/vote-client", () => ({ createVoteClient: jest.fn(() => ({})) }));
jest.mock("./src/discussion-background", () => ({
  createDiscussionBackground: jest.fn(() => ({
    initialize: jest.fn(),
    clearSession: jest.fn(),
    resumeSession: jest.fn().mockResolvedValue({}),
    onDataPermissionsChanged: jest.fn(async () => undefined),
    onStorageChanged: jest.fn(),
  })),
}));

const VERSION = "4.1.0";
const CHANGELOG_URL = "moz-extension://fixture/changelog/4/changelog_4.1.html";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (value) => [...listeners].forEach((listener) => listener(value)),
  };
}

describe("install lifecycle and permission migrations", () => {
  let installed;
  let startup;
  let stored;
  let sync;
  let grants;
  beforeEach(async () => {
    jest.resetModules();
    stored = {};
    sync = { disableVoteSubmission: false };
    grants = [
      "browsingActivity",
      "websiteContent",
      "websiteActivity",
      "personallyIdentifyingInfo",
      "authenticationInfo",
    ];
    global.__RYD_LIVE_TEST_BUILD__ = false;
    global.chrome = {
      runtime: {
        id: "extension-id",
        getManifest: () => ({
          version: VERSION,
          browser_specific_settings: { gecko: { data_collection_permissions: { required: ["none"] } } },
        }),
        getURL: (path) => "moz-extension://fixture/" + path,
        onMessage: event(),
        onInstalled: { addListener: (listener) => (installed = listener) },
        onStartup: { addListener: (listener) => (startup = listener) },
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...grants] })),
        onAdded: event(),
        onRemoved: event(),
        remove: jest.fn(async ({ data_collection }) => {
          grants = grants.filter((value) => !data_collection.includes(value));
          chrome.permissions.onRemoved.emit({ data_collection });
          return true;
        }),
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => queueMicrotask(() => callback({ ...sync }))),
          set: jest.fn((values, callback) => {
            Object.assign(sync, values);
            callback?.();
          }),
          remove: jest.fn((keys, callback) => {
            for (const key of [].concat(keys)) delete sync[key];
            callback?.();
          }),
        },
        local: {
          get: jest.fn((keys, callback) => queueMicrotask(() => callback({ ...stored }))),
          set: jest.fn((values, callback) => {
            Object.assign(stored, values);
            callback?.();
          }),
          remove: jest.fn((keys, callback) => {
            for (const key of [].concat(keys)) delete stored[key];
            callback?.();
          }),
        },
        onChanged: event(),
      },
      tabs: {
        create: jest.fn((properties, callback) => queueMicrotask(() => callback?.({ id: 1, ...properties }))),
        query: jest.fn((query, callback) => callback([])),
      },
      browserAction: { setIcon: jest.fn(), setTitle: jest.fn() },
      i18n: { getMessage: (key) => key },
    };
    global.browser = global.chrome;
    jest.spyOn(console, "debug").mockImplementation(() => {});
    require("./ryd.background");
    await flush();
    chrome.storage.sync.set.mockClear();
    chrome.storage.sync.remove.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.__RYD_LIVE_TEST_BUILD__;
  });

  test.each([false, true])("install opens only the welcome page (temporary=%s)", async (temporary) => {
    grants = ["browsingActivity"];
    installed({ reason: "install", temporary });
    await flush();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: CHANGELOG_URL }, expect.any(Function));
    expect(stored.lastShownChangelogVersion).toBe(VERSION);
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
  });

  test("a fresh install marks the one-time migration done so later updates never run it", async () => {
    grants = ["browsingActivity", "websiteActivity", "personallyIdentifyingInfo"];
    sync.disableVoteSubmission = true;
    installed({ reason: "install" });
    await flush();
    expect(stored.featureDataPermissionsMigrated).toBe(true);
    installed({ reason: "update", previousVersion: VERSION });
    await flush();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
    expect(grants).toEqual(["browsingActivity", "websiteActivity", "personallyIdentifyingInfo"]);
  });

  test("Chrome and Safari installs do not record the Firefox migration", async () => {
    chrome.runtime.getManifest = () => ({ version: VERSION, manifest_version: 3 });
    installed({ reason: "install" });
    await flush();
    expect(stored.featureDataPermissionsMigrated).toBeUndefined();
  });

  test("an already shown welcome page is not opened again", async () => {
    stored.lastShownChangelogVersion = VERSION;
    installed({ reason: "install" });
    await flush();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    "updates never open any tab, including deferred startup (temporary=%s)",
    async (temporary) => {
      stored.pendingChangelogVersion = VERSION;
      installed({ reason: "update", temporary, previousVersion: "3.0.0.18" });
      await flush();
      startup();
      await flush();
      expect(chrome.tabs.create).not.toHaveBeenCalled();
      expect(stored.pendingChangelogVersion).toBeUndefined();
    },
  );

  test.each(["browser_update", "chrome_update"])("%s never opens a tab", async (reason) => {
    installed({ reason });
    await flush();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
  });

  test("startup drops an old pending changelog without opening it", async () => {
    stored.pendingChangelogVersion = "4.0.5";
    startup();
    await flush();
    expect(stored.pendingChangelogVersion).toBeUndefined();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test("an unsigned update removes only the PII grant once and keeps existing votes and like counts", async () => {
    installed({ reason: "update", previousVersion: "4.0.6" });
    await flush();
    expect(chrome.permissions.remove).toHaveBeenCalledWith({ data_collection: ["personallyIdentifyingInfo"] });
    expect(grants).toContain("websiteActivity");
    expect(grants).toContain("websiteContent");
    expect(sync.disableVoteSubmission).toBe(false);
    expect(sync.patreonSessionToken).toBeUndefined();
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(stored.featureDataPermissionsMigrated).toBe(true);
    installed({ reason: "update", previousVersion: VERSION });
    await flush();
    expect(chrome.permissions.remove).toHaveBeenCalledTimes(1);
  });

  test("a signed-in update preserves the account session and PII grant", async () => {
    sync.patreonSessionToken = "synthetic-session";
    sync.patreonAuthenticated = true;
    installed({ reason: "update", previousVersion: "4.0.6" });
    await flush();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
    expect(sync.patreonSessionToken).toBe("synthetic-session");
    expect(stored.featureDataPermissionsMigrated).toBe(true);
  });

  test("a failed storage read does not mistake a saved account for an unsigned installation", async () => {
    chrome.storage.sync.get.mockImplementationOnce((keys, callback) => {
      chrome.runtime.lastError = { message: "Storage unavailable" };
      callback(undefined);
      delete chrome.runtime.lastError;
    });
    installed({ reason: "update", previousVersion: "4.0.6" });
    await flush();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
    expect(stored.featureDataPermissionsMigrated).toBeUndefined();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test("legacy disabled voting keeps the switch on and the website activity grant comment reactions use", async () => {
    sync.disableVoteSubmission = true;
    chrome.storage.onChanged.emit({ disableVoteSubmission: { oldValue: false, newValue: true } }, "sync");
    installed({ reason: "update", previousVersion: "4.0.6" });
    await flush();
    expect(chrome.permissions.remove).not.toHaveBeenCalledWith({ data_collection: ["websiteActivity"] });
    expect(grants).toContain("websiteActivity");
    expect(grants).toContain("websiteContent");
    expect(sync.disableVoteSubmission).toBe(true);
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon_hold128.png" });
  });

  test("an older user without vote grants keeps voting off without a synced setting", async () => {
    grants = ["browsingActivity"];
    installed({ reason: "update", previousVersion: "3.0.0.18" });
    await flush();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(sync.disableVoteSubmission).toBe(false);
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon_hold128.png" });
    expect(require("../common/vote-client").createVoteClient).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test("the Firefox icon needs both the voting grants and the switch off, and grants never touch the switch", async () => {
    grants = ["browsingActivity"];
    chrome.permissions.onAdded.emit({ data_collection: ["websiteActivity"] });
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon_hold128.png" });
    expect(chrome.browserAction.setTitle).toHaveBeenLastCalledWith({ title: "extensionName\nvote_not_counted" });
    grants.push("websiteActivity");
    chrome.permissions.onAdded.emit({ data_collection: ["websiteActivity"] });
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon128.png" });
    expect(chrome.browserAction.setTitle).toHaveBeenLastCalledWith({ title: "extensionName" });
    chrome.storage.onChanged.emit({ disableVoteSubmission: { oldValue: false, newValue: true } }, "sync");
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon_hold128.png" });
    chrome.storage.onChanged.emit({ disableVoteSubmission: { oldValue: true, newValue: false } }, "sync");
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon128.png" });
    grants = grants.filter((category) => category !== "browsingActivity");
    chrome.permissions.onRemoved.emit({ data_collection: ["browsingActivity"] });
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon_hold128.png" });
    expect(chrome.storage.sync.set.mock.calls.some(([values]) => "disableVoteSubmission" in values)).toBe(false);
  });

  test("an older permission read that finishes last never overwrites the newer toolbar state", async () => {
    grants = ["browsingActivity"];
    let releaseOlder;
    chrome.permissions.getAll.mockImplementationOnce(
      () => new Promise((resolve) => (releaseOlder = () => resolve({ data_collection: ["browsingActivity"] }))),
    );
    chrome.permissions.onAdded.emit({ data_collection: ["websiteActivity"] });
    grants.push("websiteActivity");
    chrome.permissions.onAdded.emit({ data_collection: ["websiteActivity"] });
    await flush();
    expect(chrome.browserAction.setTitle).toHaveBeenLastCalledWith({ title: "extensionName" });
    releaseOlder();
    await flush();
    expect(chrome.browserAction.setIcon).toHaveBeenLastCalledWith({ path: "/icons/icon128.png" });
    expect(chrome.browserAction.setTitle).toHaveBeenLastCalledWith({ title: "extensionName" });
  });

  test("a failed discussion permission update is handled", async () => {
    const discussion = require("./src/discussion-background").createDiscussionBackground.mock.results[0].value;
    discussion.onDataPermissionsChanged.mockRejectedValueOnce(new Error("broadcast failed"));
    chrome.permissions.onRemoved.emit({ data_collection: ["websiteActivity"] });
    await flush();
    expect(console.debug).toHaveBeenCalledWith("Discussion permission update failed", expect.any(Error));
  });

  test.each(["websiteActivity", "websiteContent", "personallyIdentifyingInfo"])(
    "revoking %s does not remove the saved session",
    async (category) => {
      sync.patreonSessionToken = "synthetic-session";
      chrome.permissions.onRemoved.emit({ data_collection: [category] });
      await flush();
      expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
      expect(sync.patreonSessionToken).toBe("synthetic-session");
      expect(
        require("./src/discussion-background").createDiscussionBackground.mock.results[0].value
          .onDataPermissionsChanged,
      ).toHaveBeenCalledWith({ added: [], removed: [category] });
    },
  );

  test("revoking authenticationInfo removes the saved session", async () => {
    sync.patreonSessionToken = "synthetic-session";
    chrome.permissions.onRemoved.emit({ data_collection: ["authenticationInfo"] });
    await flush();
    expect(chrome.storage.sync.remove).toHaveBeenCalledWith(
      ["patreonAuthenticated", "patreonUser", "patreonSessionToken"],
      expect.any(Function),
    );
    expect(sync.patreonSessionToken).toBeUndefined();
  });

  test("a failed welcome tab creation leaves its shown marker unset", async () => {
    chrome.tabs.create.mockImplementationOnce((properties, callback) => {
      chrome.runtime.lastError = { message: "No window" };
      callback(undefined);
      delete chrome.runtime.lastError;
    });
    installed({ reason: "install" });
    await flush();
    expect(stored.lastShownChangelogVersion).toBeUndefined();
  });
});
