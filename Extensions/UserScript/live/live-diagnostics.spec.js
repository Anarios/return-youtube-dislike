/**
 * @jest-environment jsdom
 */

const path = require("node:path");
const {
  LiveFatalSignalGuard,
  LiveReadOnlyGate,
  LiveRunDiagnostics,
  UNHANDLED_REJECTION_PREFIX,
  diagnosticApiUrl,
  environmentalConsoleWarningId,
  readLivePageState,
  runIndependentLoggedStages,
  runLoggedStage,
} = require("../e2e/live/live-diagnostics");

class FakeEmitter {
  constructor() {
    this.listeners = new Map();
  }

  emit(event, value) {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }

  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
  }
}

function visibleRect() {
  return { bottom: 100, height: 90, left: 10, right: 60, top: 10, width: 50 };
}

function consoleError(text, url = "https://www.youtube.com/watch?v=abcdefghijk") {
  return {
    location: () => ({ lineNumber: 7, url }),
    text: () => text,
    type: () => "error",
  };
}

function createLiveHarness(diagnosticsOptions = {}) {
  const context = new FakeEmitter();
  context.serviceWorkers = jest.fn(() => []);
  const page = new FakeEmitter();
  page.addInitScript = jest.fn().mockResolvedValue(undefined);
  page.evaluate = jest.fn().mockResolvedValue(undefined);
  page.isClosed = jest.fn(() => false);
  page.url = jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk");
  return {
    context,
    diagnostics: new LiveRunDiagnostics(page, context, { log: jest.fn(), ...diagnosticsOptions }),
    page,
  };
}

describe("live interactive diagnostics", () => {
  test("captures runtime and Shorts ownership state without dumping page HTML", () => {
    document.documentElement.setAttribute("data-ryd-userscript-version", "3.2.0");
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="abcdefghijk" is-active>
        <a href="/shorts/abcdefghijk">Short</a>
        <reel-action-bar-view-model>
          <like-button-view-model></like-button-view-model>
          <button-view-model data-ryd-synthetic-shorts-dislike data-ryd-video-id="abcdefghijk">
            <button aria-pressed="false"></button><span>123</span>
          </button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>
    `;
    for (const element of document.querySelectorAll("*")) element.getBoundingClientRect = visibleRect;

    const state = readLivePageState();

    expect(state.runtimeMarkers).toEqual({
      extension: null,
      extensionBuild: null,
      userscript: "3.2.0",
      userscriptBuild: null,
    });
    expect(state.renderers).toEqual([
      expect.objectContaining({ actionBars: 1, syntheticControls: 1, videoId: "abcdefghijk", visible: true }),
    ]);
    expect(state.renderers[0].links).toEqual([{ href: "/shorts/abcdefghijk", visible: true }]);
    expect(state.actionBars).toEqual([
      expect.objectContaining({ nativeLikes: 1, syntheticControls: 1, videoId: "abcdefghijk", visible: true }),
    ]);
    expect(state.syntheticControls).toEqual([
      expect.objectContaining({ ariaPressed: "false", text: "123", videoId: "abcdefghijk", visible: true }),
    ]);
    expect(JSON.stringify(state)).not.toContain("outerHTML");
  });

  test("records browser failures and redacted recent API traffic in the persisted snapshot", async () => {
    const context = new FakeEmitter();
    const page = new FakeEmitter();
    page.addInitScript = jest.fn().mockResolvedValue(undefined);
    page.evaluate = jest.fn(async (callback) =>
      callback.name === "readLivePageState" ? { runtimeMarkers: { userscript: "3.2.0" } } : undefined,
    );
    page.isClosed = jest.fn(() => false);
    page.url = jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk");
    const fileSystem = { mkdirSync: jest.fn(), writeFileSync: jest.fn() };
    const log = jest.fn();
    const diagnostics = new LiveRunDiagnostics(page, context, {
      clock: () => new Date("2026-08-18T12:34:56.000Z"),
      fileSystem,
      log,
      outputDirectory: "diagnostics",
      runtime: "userscript",
    });
    await diagnostics.start();
    diagnostics.stageStarted("read-only.channel-to-shorts-and-next");
    diagnostics.checkpoint("ryd-votes-response.waiting", { videoId: "abcdefghijk" });

    const request = {
      method: () => "GET",
      resourceType: () => "fetch",
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&userId=private-id",
    };
    context.emit("request", request);
    context.emit("response", { request: () => request, status: () => 200 });
    page.emit("pageerror", new Error("page exploded"));
    page.emit("console", {
      location: () => ({ lineNumber: 7, url: "https://www.youtube.com/shorts/abcdefghijk" }),
      text: () => `${UNHANDLED_REJECTION_PREFIX}promise exploded`,
      type: () => "error",
    });
    page.emit("console", {
      location: () => ({}),
      text: () => "console exploded",
      type: () => "error",
    });

    const snapshotPath = await diagnostics.persistFailureSnapshot(new Error("scenario timed out"));
    diagnostics.stop();

    expect(snapshotPath).toBe(path.join("diagnostics", "failure-2026-08-18T12-34-56-000Z.json"));
    expect(fileSystem.mkdirSync).toHaveBeenCalledWith("diagnostics", { recursive: true });
    const snapshot = JSON.parse(fileSystem.writeFileSync.mock.calls[0][1]);
    expect(snapshot.currentStage).toBe("read-only.channel-to-shorts-and-next");
    expect(snapshot.currentCheckpoint).toBe("ryd-votes-response.waiting");
    expect(snapshot.browserSignals.map(({ type }) => type)).toEqual([
      "pageerror",
      "unhandledrejection",
      "console.error",
    ]);
    expect(snapshot.recentApiRequests).toEqual([
      expect.objectContaining({
        method: "GET",
        pathname: "/votes",
        query: { userId: "<redacted>", videoId: "abcdefghijk" },
        status: 200,
      }),
    ]);
    expect(snapshot.pageState).toEqual({ runtimeMarkers: { userscript: "3.2.0" } });
    expect(snapshot.url).toBe("https://www.youtube.com/shorts/abcdefghijk");
    expect(context.listeners.get("request").size).toBe(0);
    expect(page.listeners.get("pageerror").size).toBe(0);
  });

  test("logs stage completion and failure boundaries", async () => {
    const diagnostics = {
      stageCompleted: jest.fn(),
      stageFailed: jest.fn(),
      stageStarted: jest.fn(),
    };

    await expect(runLoggedStage(diagnostics, "success", async () => 42)).resolves.toBe(42);
    const failure = new Error("failed");
    await expect(
      runLoggedStage(diagnostics, "failure", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(diagnostics.stageStarted.mock.calls.map(([name]) => name)).toEqual(["success", "failure"]);
    expect(diagnostics.stageCompleted).toHaveBeenCalledWith("success", expect.any(Number));
    expect(diagnostics.stageFailed).toHaveBeenCalledWith("failure", expect.any(Number), failure);
  });

  test.each([
    ["pageerror", (page) => page.emit("pageerror", new Error("page exploded"))],
    [
      "unhandledrejection",
      (page) => page.emit("console", consoleError(`${UNHANDLED_REJECTION_PREFIX}promise exploded`)),
    ],
    ["console.error", (page) => page.emit("console", consoleError("console exploded"))],
  ])("turns an otherwise-passing stage red for a %s", async (type, emitSignal) => {
    const { diagnostics, page } = createLiveHarness();
    await diagnostics.start();

    await expect(
      runLoggedStage(diagnostics, "read-only.watch", async () => {
        emitSignal(page);
        return "rendered";
      }),
    ).rejects.toMatchObject({ name: "LiveFatalSignalError" });

    expect(diagnostics.browserSignals).toEqual([
      expect.objectContaining({ ignoredBy: null, stage: "read-only.watch", type }),
    ]);
    diagnostics.stop();
  });

  test.each([
    [
      "googlevideo HTTP 403",
      "Failed to load resource: the server responded with a status of 403 ()",
      "https://rr2---sn-q4flrnel.googlevideo.com/videoplayback?opaque=1",
      "googlevideo-resource-failure",
    ],
    [
      "googlevideo DNS failure",
      "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
      "https://rr3---sn-oxup5-f5fk.googlevideo.com/generate_204",
      "googlevideo-resource-failure",
    ],
    [
      "doubleclick follow-on network failure",
      "Failed to load resource: net::ERR_FAILED",
      "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/",
      "doubleclick-resource-failure",
    ],
    [
      "doubleclick CORS failure",
      "Access to XMLHttpRequest at 'https://googleads.g.doubleclick.net/pagead/id' from origin 'https://www.youtube.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
      "https://www.youtube.com/watch?v=abcdefghijk",
      "doubleclick-cors",
    ],
    [
      "doubleclick CORS failure after a YouTube ad redirect",
      "Access to fetch at 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1' (redirected from 'https://www.youtube.com/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1') from origin 'https://www.youtube.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
      "https://www.youtube.com/watch?v=abcdefghijk&list=RDabcdefghijk",
      "doubleclick-cors",
    ],
    [
      "sandboxed about:blank frame script block",
      "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
      "about:blank",
      "sandboxed-about-blank-script",
    ],
    [
      "YouTube account-cookie rotation rate limit",
      "Failed to load resource: the server responded with a status of 429 ()",
      "https://accounts.youtube.com/RotateCookies",
      "youtube-rotate-cookies-rate-limit",
    ],
    [
      "YouTube accounts report-only frame-ancestors violation",
      "Framing 'https://accounts.youtube.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n",
      "",
      "youtube-accounts-report-only-frame-ancestors",
    ],
  ])("records a narrowly recognized external %s as a non-fatal warning", async (_name, message, url, warningId) => {
    const { diagnostics, page } = createLiveHarness();
    await diagnostics.start();

    await expect(
      runLoggedStage(diagnostics, "read-only.watch", async () => {
        page.emit("console", consoleError(message, url));
        return "rendered";
      }),
    ).resolves.toBe("rendered");

    expect(diagnostics.browserSignals).toEqual([
      expect.objectContaining({
        environmentalWarning: warningId,
        ignoredBy: null,
        severity: "warning",
        stage: "read-only.watch",
        type: "console.error",
      }),
    ]);
    diagnostics.stop();
  });

  test.each([
    [
      "unknown status on a media CDN",
      "Failed to load resource: the server responded with a status of 404 ()",
      "https://rr2---sn-q4flrnel.googlevideo.com/videoplayback",
    ],
    [
      "page JavaScript failure reported at a media URL",
      "TypeError: Cannot read properties of undefined",
      "https://rr2---sn-q4flrnel.googlevideo.com/videoplayback",
    ],
    [
      "known network wording on YouTube itself",
      "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
      "https://www.youtube.com/youtubei/v1/player",
    ],
    [
      "production RYD API failure",
      "Failed to load resource: net::ERR_FAILED",
      "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    ],
    [
      "lookalike media hostname",
      "Failed to load resource: the server responded with a status of 403 ()",
      "https://googlevideo.com.attacker.test/videoplayback",
    ],
    [
      "insecure media URL",
      "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
      "http://rr2---sn-q4flrnel.googlevideo.com/videoplayback",
    ],
    [
      "nonstandard media port",
      "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
      "https://rr2---sn-q4flrnel.googlevideo.com:444/videoplayback",
    ],
    [
      "different YouTube account endpoint",
      "Failed to load resource: the server responded with a status of 429 ()",
      "https://accounts.youtube.com/RotateCookiesAgain",
    ],
    [
      "different status from YouTube cookie rotation",
      "Failed to load resource: the server responded with a status of 500 ()",
      "https://accounts.youtube.com/RotateCookies",
    ],
    [
      "lookalike YouTube accounts hostname",
      "Failed to load resource: the server responded with a status of 429 ()",
      "https://accounts.youtube.com.attacker.test/RotateCookies",
    ],
    [
      "enforced YouTube accounts frame-ancestors violation",
      "Framing 'https://accounts.youtube.com/' violates the following Content Security Policy directive: \"frame-ancestors 'self'\".",
      "",
    ],
    [
      "report-only YouTube accounts frame-ancestors near miss",
      "Framing 'https://accounts.youtube.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.",
      "",
    ],
    [
      "unrelated report-only accounts frame-ancestors violation",
      "Framing 'https://accounts.google.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n",
      "",
    ],
    [
      "YouTube accounts report-only frame-ancestors violation with a page location",
      "Framing 'https://accounts.youtube.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "lookalike CORS target",
      "Access to fetch at 'https://doubleclick.net.attacker.test/pixel' from origin 'https://www.youtube.com' has been blocked by CORS policy: blocked",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "non-YouTube CORS origin",
      "Access to fetch at 'https://googleads.g.doubleclick.net/pixel' from origin 'https://attacker.test' has been blocked by CORS policy: blocked",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "doubleclick CORS redirect from a foreign origin",
      "Access to fetch at 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/' (redirected from 'https://attacker.test/pagead/viewthroughconversion/123/') from origin 'https://www.youtube.com' has been blocked by CORS policy: blocked",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "doubleclick CORS redirect from a different YouTube endpoint",
      "Access to fetch at 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/' (redirected from 'https://www.youtube.com/youtubei/v1/player') from origin 'https://www.youtube.com' has been blocked by CORS policy: blocked",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "sandboxed-frame message at a page URL",
      "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ],
    [
      "near-miss sandboxed-frame message",
      "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set. Unexpected",
      "about:blank",
    ],
    ["unrelated about:blank JavaScript error", "TypeError: Cannot read properties of undefined", "about:blank"],
  ])("keeps %s fatal", async (_name, message, url) => {
    const { diagnostics, page } = createLiveHarness();
    await diagnostics.start();

    page.emit("console", consoleError(message, url));
    expect(() => diagnostics.consumeFatalSignals("unexpected console error")).toThrow(/fatal browser signal/);
    expect(diagnostics.browserSignals[0]).toEqual(
      expect.objectContaining({ environmentalWarning: null, severity: "fatal", type: "console.error" }),
    );
    diagnostics.stop();
  });

  test("classifies only page console errors, never page exceptions or unhandled rejections", () => {
    const details = {
      location: { url: "https://rr2---sn-q4flrnel.googlevideo.com/videoplayback" },
      message: "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
      source: "page",
    };
    expect(environmentalConsoleWarningId({ ...details, type: "console.error" })).toBe("googlevideo-resource-failure");
    expect(environmentalConsoleWarningId({ ...details, type: "pageerror" })).toBeNull();
    expect(environmentalConsoleWarningId({ ...details, type: "unhandledrejection" })).toBeNull();
    expect(
      environmentalConsoleWarningId({ ...details, source: "extension-service-worker", type: "console.error" }),
    ).toBeNull();
  });

  test("fails closed if a future signal reaches the guard without an explicit severity", () => {
    const { context, page } = createLiveHarness();
    const guard = new LiveFatalSignalGuard(page, context, { log: jest.fn() });
    guard.signals.push({ message: "unclassified", type: "console.error" });

    expect(() => guard.assertNoFatalSignalsBetween(0, 1, "future signal")).toThrow(/console\.error: unclassified/);
  });

  test("allows only an explicit exact benign-console rule and keeps mismatches fatal", async () => {
    const { diagnostics, page } = createLiveHarness({
      ignoredSignalRules: [
        {
          id: "known-youtube-message",
          message: "Known YouTube-only diagnostic",
          type: "console.error",
          url: "https://www.youtube.com/watch?v=abcdefghijk",
        },
      ],
    });
    await diagnostics.start();

    page.emit("console", consoleError("Known YouTube-only diagnostic"));
    expect(() => diagnostics.consumeFatalSignals("known noise")).not.toThrow();
    expect(diagnostics.browserSignals[0]).toEqual(
      expect.objectContaining({ ignoredBy: "known-youtube-message", severity: "warning" }),
    );

    page.emit("console", consoleError("Known YouTube-only diagnostic with extra text"));
    expect(() => diagnostics.consumeFatalSignals("unexpected noise")).toThrow(/fatal browser signal/);
    diagnostics.stop();
  });

  test("rejects broad or callback-based console suppression rules", () => {
    const { context, page } = createLiveHarness();
    expect(
      () =>
        new LiveFatalSignalGuard(page, context, {
          ignoredSignalRules: [{ id: "message-only", message: "Failed", type: "console.error" }],
        }),
    ).toThrow(/requires a non-empty exact url/);
    expect(
      () =>
        new LiveFatalSignalGuard(page, context, {
          ignoredSignalRules: [{ id: "broad", messagePattern: /error/, type: "console.error" }],
        }),
    ).toThrow(/unsupported fields: messagePattern/);
    expect(
      () =>
        new LiveFatalSignalGuard(page, context, {
          ignoredSignalRules: [{ id: "callback", message: "ignored", predicate: () => true, type: "console.error" }],
        }),
    ).toThrow(/unsupported fields: predicate/);
  });

  test("fails only for console errors from the selected extension service worker", async () => {
    const extensionId = "a".repeat(32);
    const matchingWorker = new FakeEmitter();
    matchingWorker.url = jest.fn(() => `chrome-extension://${extensionId}/ryd.background.js`);
    matchingWorker.evaluate = jest.fn().mockResolvedValue(undefined);
    const unrelatedWorker = new FakeEmitter();
    unrelatedWorker.url = jest.fn(() => `chrome-extension://${"b".repeat(32)}/ryd.background.js`);
    unrelatedWorker.evaluate = jest.fn().mockResolvedValue(undefined);
    const { context, diagnostics } = createLiveHarness({ selectedExtensionId: extensionId });
    context.serviceWorkers.mockReturnValue([matchingWorker, unrelatedWorker]);
    await diagnostics.start();

    unrelatedWorker.emit("console", consoleError("unrelated extension failed", unrelatedWorker.url()));
    expect(() => diagnostics.consumeFatalSignals("unrelated worker")).not.toThrow();

    matchingWorker.emit("console", consoleError("selected extension failed", matchingWorker.url()));
    expect(() => diagnostics.consumeFatalSignals("selected worker")).toThrow(
      /extension-service-worker\.console\.error: selected extension failed/,
    );
    expect(matchingWorker.evaluate).toHaveBeenCalledWith(expect.any(Function), UNHANDLED_REJECTION_PREFIX);
    expect(unrelatedWorker.evaluate).not.toHaveBeenCalled();
    diagnostics.stop();
  });

  test("keeps external-resource wording fatal when it comes from the selected extension worker", async () => {
    const extensionId = "a".repeat(32);
    const matchingWorker = new FakeEmitter();
    matchingWorker.url = jest.fn(() => `chrome-extension://${extensionId}/ryd.background.js`);
    matchingWorker.evaluate = jest.fn().mockResolvedValue(undefined);
    const { context, diagnostics } = createLiveHarness({ selectedExtensionId: extensionId });
    context.serviceWorkers.mockReturnValue([matchingWorker]);
    await diagnostics.start();

    matchingWorker.emit(
      "console",
      consoleError(
        "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
        "https://rr2---sn-q4flrnel.googlevideo.com/videoplayback",
      ),
    );

    expect(() => diagnostics.consumeFatalSignals("selected worker")).toThrow(
      /extension-service-worker\.console\.error/,
    );
    expect(diagnostics.browserSignals[0]).toEqual(
      expect.objectContaining({ environmentalWarning: null, severity: "fatal" }),
    );
    diagnostics.stop();
  });

  test("guards a selected extension service worker that restarts during a scenario", async () => {
    const extensionId = "a".repeat(32);
    const replacementWorker = new FakeEmitter();
    replacementWorker.url = jest.fn(() => `chrome-extension://${extensionId}/ryd.background.js`);
    replacementWorker.evaluate = jest.fn().mockResolvedValue(undefined);
    const { context, diagnostics } = createLiveHarness({ selectedExtensionId: extensionId });
    await diagnostics.start();

    context.emit("serviceworker", replacementWorker);
    replacementWorker.emit(
      "console",
      consoleError(`${UNHANDLED_REJECTION_PREFIX}replacement rejected`, replacementWorker.url()),
    );

    expect(() => diagnostics.consumeFatalSignals("replacement worker")).toThrow(
      /extension-service-worker\.unhandledrejection: replacement rejected/,
    );
    diagnostics.stop();
  });

  test("continues independent read-only stages, then rejects the aggregate run", async () => {
    const diagnostics = {
      consumeFatalSignals: jest.fn(),
      stageCompleted: jest.fn(),
      stageFailed: jest.fn(),
      stageStarted: jest.fn(),
    };
    const laterStage = jest.fn().mockResolvedValue("healthy");

    let aggregate;
    try {
      await runIndependentLoggedStages(diagnostics, [
        {
          action: async () => {
            throw new Error("first failed");
          },
          name: "first",
        },
        { action: laterStage, name: "second" },
      ]);
    } catch (error) {
      aggregate = error;
    }

    expect(aggregate).toBeInstanceOf(AggregateError);
    expect(aggregate.message).toBe("1 of 2 independent live read-only stages failed.");
    expect(aggregate.stageResults).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ message: "first failed" }), name: "first" }),
      { name: "second", result: "healthy" },
    ]);
    expect(laterStage).toHaveBeenCalledTimes(1);
    expect(diagnostics.stageCompleted).toHaveBeenCalledWith("second", expect.any(Number));
  });

  test("blocks production reactions unless this worker completed every read-only scenario", () => {
    const gate = new LiveReadOnlyGate(["shorts-render", "watch-render", "responsive-visual"], {
      allowedSkippedScenarioIds: ["watch-render"],
    });
    gate.record("shorts-render", "passed");
    gate.record("watch-render", "skipped");
    expect(() => gate.assertPassed()).toThrow(/Missing: responsive-visual; failed: none/);

    gate.record("responsive-visual", "passed");
    expect(() => gate.assertPassed()).not.toThrow();

    gate.record("shorts-render", "failed");
    gate.record("shorts-render", "passed");
    expect(() => gate.assertPassed()).toThrow(/Missing: shorts-render; failed: shorts-render/);

    const requiredSkip = new LiveReadOnlyGate(["shorts-render"]);
    requiredSkip.record("shorts-render", "skipped");
    expect(() => requiredSkip.assertPassed()).toThrow(/failed: shorts-render/);
  });

  test("a fresh worker cannot inherit read-only gate success from a previous worker", () => {
    const firstWorker = new LiveReadOnlyGate(["shorts-render"]);
    firstWorker.record("shorts-render", "passed");
    expect(() => firstWorker.assertPassed()).not.toThrow();

    const restartedWorker = new LiveReadOnlyGate(["shorts-render"]);
    expect(() => restartedWorker.assertPassed()).toThrow(/Missing: shorts-render/);
  });

  test("redacts identity and proof material while retaining diagnostic video IDs", () => {
    expect(
      diagnosticApiUrl(
        "https://returnyoutubedislikeapi.com/puzzle/registration?userId=private&videoId=abcdefghijk&solution=secret",
      ),
    ).toEqual({
      pathname: "/puzzle/registration",
      query: { solution: "<redacted>", userId: "<redacted>", videoId: "abcdefghijk" },
    });
  });
});
