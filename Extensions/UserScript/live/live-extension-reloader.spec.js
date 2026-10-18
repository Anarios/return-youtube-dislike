const path = require("node:path");
const {
  assertWorkerIdentity,
  extensionServiceWorkerUrl,
  normalizeExtensionPath,
  readUnpackedExtensions,
  reloadLiveExtension,
  reloadLiveExtensionInBrowser,
  selectEnabledUnpackedExtension,
  waitForReloadedExtensionEnabled,
  waitForExtensionWorker,
} = require("../e2e/live/live-extension-reloader");

const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const BUILD_ID = "0123456789abcdef0123456789abcdef";
const EXTENSION_PATH = "C:\\repo\\Extensions\\combined\\dist\\chrome";

function identity(overrides = {}) {
  return {
    backgroundScript: "ryd.background.js",
    compiledBuildId: BUILD_ID,
    extensionId: EXTENSION_ID,
    resourceBuildId: BUILD_ID,
    version: "4.0.5",
    ...overrides,
  };
}

async function flushPromiseJobs() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe("live unpacked-extension reload helper", () => {
  test("matches the exact unpacked path with Windows separator and case normalization", () => {
    const extension = selectEnabledUnpackedExtension(
      [
        { enabled: true, id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", path: "C:\\other", version: "4.0.5" },
        { enabled: true, id: EXTENSION_ID, path: "c:/REPO/Extensions/combined/dist/chrome/", version: "4.0.4" },
      ],
      EXTENSION_PATH,
      { pathImpl: path.win32, platform: "win32" },
    );

    expect(extension.id).toBe(EXTENSION_ID);
    expect(normalizeExtensionPath(extension.path, { pathImpl: path.win32, platform: "win32" })).toBe(
      normalizeExtensionPath(EXTENSION_PATH, { pathImpl: path.win32, platform: "win32" }),
    );
  });

  test.each([
    [[], /is not installed/],
    [[{ enabled: false, id: EXTENSION_ID, path: EXTENSION_PATH }], /installed but disabled/],
    [[{ enabled: true, id: "not-an-id", path: EXTENSION_PATH }], /invalid extension ID/],
    [
      [
        { enabled: true, id: EXTENSION_ID, path: EXTENSION_PATH },
        { enabled: true, id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", path: EXTENSION_PATH },
      ],
      /more than one/,
    ],
  ])("refuses an unsafe unpacked-extension inventory", (extensions, expectedError) => {
    expect(() =>
      selectEnabledUnpackedExtension(extensions, EXTENSION_PATH, {
        pathImpl: path.win32,
        platform: "win32",
      }),
    ).toThrow(expectedError);
  });

  test("can use the default-profile inventory only for exact path-to-ID identification", () => {
    expect(
      selectEnabledUnpackedExtension(
        [{ enabled: false, id: EXTENSION_ID, path: EXTENSION_PATH, version: "4.0.5" }],
        EXTENSION_PATH,
        { pathImpl: path.win32, platform: "win32", requireEnabled: false },
      ),
    ).toMatchObject({ enabled: false, id: EXTENSION_ID });
  });

  test("uses an exact extension worker URL", () => {
    expect(extensionServiceWorkerUrl(EXTENSION_ID)).toBe(`chrome-extension://${EXTENSION_ID}/ryd.background.js`);
    expect(() => extensionServiceWorkerUrl("not-an-id")).toThrow(/valid Chrome extension ID/);
  });

  test("starts a dormant worker through the ServiceWorker domain", async () => {
    const worker = { url: () => extensionServiceWorkerUrl(EXTENSION_ID) };
    let workers = [];
    const context = { serviceWorkers: jest.fn(() => workers) };
    const serviceWorkerSession = {
      send: jest.fn(async (method) => {
        if (method === "ServiceWorker.startWorker") workers = [worker];
      }),
    };

    await expect(
      waitForExtensionWorker(context, serviceWorkerSession, EXTENSION_ID, {
        delayImpl: async () => {},
        now: (() => {
          let value = 0;
          return () => value++;
        })(),
        timeoutMilliseconds: 20,
      }),
    ).resolves.toBe(worker);
    expect(serviceWorkerSession.send).toHaveBeenNthCalledWith(1, "ServiceWorker.enable");
    expect(serviceWorkerSession.send).toHaveBeenNthCalledWith(2, "ServiceWorker.startWorker", {
      scopeURL: `chrome-extension://${EXTENSION_ID}/`,
    });
  });

  test("fails closed when Chrome cannot inventory unpacked extensions", async () => {
    const browserSession = { send: jest.fn().mockRejectedValue(new Error("Method not available")) };

    await expect(readUnpackedExtensions(browserSession)).rejects.toThrow(
      /cannot be identified safely.*no extension was changed/i,
    );
  });

  test("polls through Chrome's transient post-reload disabled inventory state", async () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    try {
      const browserSession = {
        send: jest
          .fn()
          .mockResolvedValueOnce({
            extensions: [{ enabled: false, id: EXTENSION_ID, path: EXTENSION_PATH, version: "4.0.5" }],
          })
          .mockResolvedValueOnce({
            extensions: [{ enabled: true, id: EXTENSION_ID, path: EXTENSION_PATH, version: "4.0.5" }],
          }),
      };

      const extensionPromise = waitForReloadedExtensionEnabled(browserSession, EXTENSION_PATH, EXTENSION_ID, {
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        timeoutMilliseconds: 100,
      });
      await flushPromiseJobs();
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(50);
      await flushPromiseJobs();

      await expect(extensionPromise).resolves.toMatchObject({ enabled: true, id: EXTENSION_ID });
      expect(browserSession.send).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test("times out when Chrome's post-reload inventory remains disabled", async () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    try {
      const browserSession = {
        send: jest.fn().mockResolvedValue({
          extensions: [{ enabled: false, id: EXTENSION_ID, path: EXTENSION_PATH, version: "4.0.5" }],
        }),
      };

      const extensionPromise = waitForReloadedExtensionEnabled(browserSession, EXTENSION_PATH, EXTENSION_ID, {
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        timeoutMilliseconds: 100,
      });
      const rejection = expect(extensionPromise).rejects.toThrow(/remained disabled for 100ms after reload/);
      await flushPromiseJobs();
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(50);
      await flushPromiseJobs();
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(50);
      await flushPromiseJobs();

      await rejection;
      expect(browserSession.send).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  test("rejects a different extension ID immediately while polling the exact unpacked path", async () => {
    const differentExtensionId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const browserSession = {
      send: jest.fn().mockResolvedValue({
        extensions: [{ enabled: false, id: differentExtensionId, path: EXTENSION_PATH, version: "4.0.5" }],
      }),
    };

    await expect(
      waitForReloadedExtensionEnabled(browserSession, EXTENSION_PATH, EXTENSION_ID, {
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        timeoutMilliseconds: 100,
      }),
    ).rejects.toThrow(`changed from ${EXTENSION_ID} to ${differentExtensionId}`);
    expect(browserSession.send).toHaveBeenCalledTimes(1);
  });

  test("requires both the compiled and resource build IDs after reload", () => {
    expect(() =>
      assertWorkerIdentity(identity({ compiledBuildId: "f".repeat(32) }), EXTENSION_ID, {
        expectedBuildId: BUILD_ID,
        expectedVersion: "4.0.5",
      }),
    ).toThrow(/is running build/);
    expect(() =>
      assertWorkerIdentity(identity({ resourceBuildId: "f".repeat(32) }), EXTENSION_ID, {
        expectedBuildId: BUILD_ID,
        expectedVersion: "4.0.5",
      }),
    ).toThrow(/exposes resource build/);
  });

  test("reloads only the exact enabled unpacked extension and proves the replacement worker build", async () => {
    let workers;
    let inventoryVersion = "4.0.4";
    let closeOldWorker;
    const oldWorkerClosed = new Promise((resolve) => {
      closeOldWorker = resolve;
    });
    const oldWorker = {
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(
          identity({ compiledBuildId: "a".repeat(32), resourceBuildId: BUILD_ID, version: "4.0.4" }),
        )
        .mockImplementationOnce(async () => {
          workers = [];
          inventoryVersion = "4.0.5";
          closeOldWorker();
          return true;
        }),
      url: () => extensionServiceWorkerUrl(EXTENSION_ID),
      waitForEvent: jest.fn(() => oldWorkerClosed),
    };
    const newWorker = {
      evaluate: jest.fn().mockResolvedValue(identity()),
      url: () => extensionServiceWorkerUrl(EXTENSION_ID),
    };
    workers = [oldWorker];

    const browserSession = {
      send: jest.fn(async (method) => {
        expect(method).toBe("Extensions.getExtensions");
        return {
          extensions: [{ enabled: true, id: EXTENSION_ID, path: EXTENSION_PATH, version: inventoryVersion }],
        };
      }),
    };
    const context = { serviceWorkers: jest.fn(() => workers) };
    const serviceWorkerSession = {
      send: jest.fn(async (method) => {
        if (method === "ServiceWorker.startWorker") workers = [newWorker];
      }),
    };

    await expect(
      reloadLiveExtension({
        browserSession,
        context,
        expectedBuildId: BUILD_ID,
        expectedExtensionPath: EXTENSION_PATH,
        expectedVersion: "4.0.5",
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        serviceWorkerSession,
        timeoutMilliseconds: 100,
        waitOptions: { delayImpl: async () => {}, now: Date.now },
      }),
    ).resolves.toEqual({
      buildId: BUILD_ID,
      extensionId: EXTENSION_ID,
      previousVersion: "4.0.4",
      version: "4.0.5",
    });

    expect(browserSession.send).toHaveBeenCalledTimes(2);
    expect(oldWorker.waitForEvent).toHaveBeenCalledWith("close", { timeout: 100 });
    expect(oldWorker.evaluate).toHaveBeenCalledTimes(2);
    expect(newWorker.evaluate).toHaveBeenCalledTimes(1);
  });

  test("refuses to start or reload the unpacked extension when Chrome reports it disabled", async () => {
    const browserSession = {
      send: jest.fn().mockResolvedValue({
        extensions: [{ enabled: false, id: EXTENSION_ID, path: EXTENSION_PATH, version: "4.0.5" }],
      }),
    };
    const context = { serviceWorkers: jest.fn() };
    const serviceWorkerSession = { send: jest.fn() };

    await expect(
      reloadLiveExtension({
        browserSession,
        context,
        expectedBuildId: BUILD_ID,
        expectedExtensionPath: EXTENSION_PATH,
        expectedVersion: "4.0.5",
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        serviceWorkerSession,
      }),
    ).rejects.toThrow(/installed but disabled/);
    expect(context.serviceWorkers).not.toHaveBeenCalled();
    expect(serviceWorkerSession.send).not.toHaveBeenCalled();
  });

  test("does not request a worker reload when the expected unpacked path is absent", async () => {
    const browserSession = {
      send: jest.fn().mockResolvedValue({
        extensions: [{ enabled: true, id: EXTENSION_ID, path: "C:\\somewhere-else", version: "4.0.5" }],
      }),
    };
    const context = { serviceWorkers: jest.fn() };
    const serviceWorkerSession = { send: jest.fn() };

    await expect(
      reloadLiveExtension({
        browserSession,
        context,
        expectedBuildId: BUILD_ID,
        expectedExtensionPath: EXTENSION_PATH,
        expectedVersion: "4.0.5",
        pathOptions: { pathImpl: path.win32, platform: "win32" },
        serviceWorkerSession,
      }),
    ).rejects.toThrow(/is not installed/);
    expect(context.serviceWorkers).not.toHaveBeenCalled();
    expect(serviceWorkerSession.send).not.toHaveBeenCalled();
  });

  test("uses only the caller-selected YouTube page for the target-profile ServiceWorker session", async () => {
    const existingInternalPage = { url: () => "chrome://extensions/" };
    const selectedPage = {
      context: jest.fn(),
      isClosed: jest.fn().mockReturnValue(false),
      url: jest.fn().mockReturnValue("https://www.youtube.com/watch?v=AAAAAAAAAAA"),
    };
    const browserSession = { detach: jest.fn().mockResolvedValue(undefined) };
    const serviceWorkerSession = { detach: jest.fn().mockResolvedValue(undefined) };
    const browser = { newBrowserCDPSession: jest.fn().mockResolvedValue(browserSession) };
    const context = {
      newCDPSession: jest.fn().mockResolvedValue(serviceWorkerSession),
      newPage: jest.fn(),
      pages: jest.fn().mockReturnValue([existingInternalPage]),
    };
    selectedPage.context.mockReturnValue(context);
    const reloadResult = { extensionId: EXTENSION_ID };
    const reloadImpl = jest.fn().mockResolvedValue(reloadResult);

    await expect(
      reloadLiveExtensionInBrowser({
        browser,
        context,
        expectedBuildId: BUILD_ID,
        expectedExtensionPath: EXTENSION_PATH,
        expectedVersion: "4.0.5",
        reloadImpl,
        sessionPage: selectedPage,
        timeoutMilliseconds: 12345,
      }),
    ).resolves.toBe(reloadResult);

    expect(context.pages).not.toHaveBeenCalled();
    expect(context.newPage).not.toHaveBeenCalled();
    expect(context.newCDPSession).toHaveBeenCalledWith(selectedPage);
    expect(reloadImpl).toHaveBeenCalledWith({
      browserSession,
      context,
      expectedBuildId: BUILD_ID,
      expectedExtensionPath: EXTENSION_PATH,
      expectedVersion: "4.0.5",
      serviceWorkerSession,
      timeoutMilliseconds: 12345,
    });
    expect(serviceWorkerSession.detach).toHaveBeenCalledTimes(1);
    expect(browserSession.detach).toHaveBeenCalledTimes(1);
  });

  test("rejects a session page from a different profile before opening a browser CDP session", async () => {
    const otherContext = {};
    const sessionPage = {
      context: () => otherContext,
      isClosed: () => false,
      url: () => "https://www.youtube.com/",
    };
    const browser = { newBrowserCDPSession: jest.fn() };
    const context = { newCDPSession: jest.fn(), newPage: jest.fn() };

    await expect(
      reloadLiveExtensionInBrowser({
        browser,
        context,
        expectedBuildId: BUILD_ID,
        expectedExtensionPath: EXTENSION_PATH,
        expectedVersion: "4.0.5",
        sessionPage,
      }),
    ).rejects.toThrow(/does not belong to the attached Chrome context/);
    expect(browser.newBrowserCDPSession).not.toHaveBeenCalled();
    expect(context.newCDPSession).not.toHaveBeenCalled();
  });
});
