jest.mock("../common/vote-client", () => ({ createVoteClient: jest.fn() }));
jest.mock("./src/data-collection-permissions", () => ({
  hasAuthenticationDataPermission: jest.fn(),
  onAuthenticationDataPermissionRemoved: jest.fn(),
  usesFirefoxDataCollectionConsent: jest.fn(),
}));

const flushCallbacks = () => new Promise((resolve) => setTimeout(resolve, 0));
const VERSION = "4.0.5";
const CHANGELOG_URL = "moz-extension://test/changelog/4/changelog_4.0.html";

describe("background changelog lifecycle", () => {
  let installedListener;
  let startupListener;
  let stored;

  beforeEach(() => {
    jest.resetModules();
    stored = {};
    require("../common/vote-client").createVoteClient.mockReturnValue({ ensureRegistered: () => Promise.resolve({}) });
    global.__RYD_LIVE_TEST_BUILD__ = false;
    global.chrome = {
      runtime: {
        getManifest: () => ({ version: VERSION }),
        getURL: (relativePath) => `moz-extension://test/${relativePath}`,
        onMessage: { addListener: jest.fn() },
        onInstalled: { addListener: (listener) => (installedListener = listener) },
        onStartup: { addListener: (listener) => (startupListener = listener) },
      },
      storage: {
        sync: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
        local: {
          get: jest.fn((keys, callback) => queueMicrotask(() => callback({ ...stored }))),
          set: jest.fn((values, callback) =>
            queueMicrotask(() => {
              Object.assign(stored, values);
              callback?.();
            }),
          ),
          remove: jest.fn((keys, callback) =>
            queueMicrotask(() => {
              for (const key of [].concat(keys)) delete stored[key];
              callback?.();
            }),
          ),
        },
        onChanged: { addListener: jest.fn() },
      },
      tabs: {
        create: jest.fn((properties, callback) => queueMicrotask(() => callback?.({ id: 1, ...properties }))),
      },
    };
    // Firefox exposes the chrome callback namespace alongside browser.
    global.browser = global.chrome;
    jest.spyOn(console, "debug").mockImplementation(() => {});
    require("./ryd.background");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.browser;
    delete global.__RYD_LIVE_TEST_BUILD__;
  });

  test.each([false, true])("opens the changelog on a fresh install (temporary=%s)", async (temporary) => {
    installedListener({ reason: "install", temporary });
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: CHANGELOG_URL }, expect.any(Function));
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
  });

  test.each(["install", "update"])("preserves already-seen suppression on %s", async (reason) => {
    stored.lastShownChangelogVersion = "4.0.4";
    installedListener({ reason, temporary: true, previousVersion: "4.0.4" });
    await flushCallbacks();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(stored).toEqual({ lastShownChangelogVersion: "4.0.4" });
  });

  test("queues an unseen update and opens it on browser startup", async () => {
    installedListener({ reason: "update", previousVersion: "4.0.4" });
    await flushCallbacks();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(stored).toEqual({ pendingChangelogVersion: VERSION });

    startupListener();
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });

    startupListener();
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  });

  test("opens an unseen temporary update immediately after the shown marker is cleared", async () => {
    installedListener({ reason: "update", temporary: true, previousVersion: VERSION });
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: CHANGELOG_URL }, expect.any(Function));
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
  });

  test("consumes an existing pending changelog when a temporary update opens it", async () => {
    stored.pendingChangelogVersion = VERSION;
    installedListener({ reason: "update", temporary: true, previousVersion: VERSION });
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
  });

  test("does not reopen the changelog on the next already-seen temporary reload", async () => {
    const details = { reason: "update", temporary: true, previousVersion: VERSION };
    installedListener(details);
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);

    installedListener(details);
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
  });

  test("opens a previously persisted pending version on startup", async () => {
    stored.pendingChangelogVersion = VERSION;
    startupListener();
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: CHANGELOG_URL }, expect.any(Function));
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
  });

  test("clears a redundant pending update when the changelog was already shown", async () => {
    stored.lastShownChangelogVersion = "4.0.4";
    stored.pendingChangelogVersion = VERSION;
    startupListener();
    await flushCallbacks();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(stored).toEqual({ lastShownChangelogVersion: "4.0.4" });
  });

  test("does not mark the changelog as shown when tabs.create reports a callback error", async () => {
    chrome.tabs.create.mockImplementationOnce((properties, callback) =>
      queueMicrotask(() => {
        chrome.runtime.lastError = { message: "No browser window is available" };
        try {
          callback(undefined);
        } finally {
          delete chrome.runtime.lastError;
        }
      }),
    );
    installedListener({ reason: "install", temporary: true });
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(stored.lastShownChangelogVersion).toBeUndefined();
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastShownChangelogVersion: expect.anything() }),
      expect.any(Function),
    );

    installedListener({ reason: "install", temporary: true });
    await flushCallbacks();
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
    expect(stored).toEqual({ lastShownChangelogVersion: VERSION });
    const shownWrites = chrome.storage.local.set.mock.calls.filter(([values]) =>
      Object.prototype.hasOwnProperty.call(values, "lastShownChangelogVersion"),
    );
    expect(shownWrites).toHaveLength(1);
  });
});
