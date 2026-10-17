const fs = require("node:fs");
const { EventEmitter } = require("node:events");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createFakeBackend } = require("../UserScript/e2e/harness");
const { WORKER_SIGNAL_PATH, isAllowedApiPreflight } = require("./hermetic-api-contract");
const {
  ARTIFACT_BROWSER_SCENARIO_CATALOG,
  ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
  ARTIFACT_SMOKE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID,
  HermeticExtensionArtifactAdapter,
  SHARED_ARTIFACT_SCENARIO_IDS,
  SHARED_ARTIFACT_RUNTIMES,
  assertArtifactBrowserScenarioCatalog,
  assertLoopbackOrigin,
  createArtifactBrowserScenarioPlan,
  createPageSignalCollector,
  createSharedArtifactBackendOptions,
  createWorkerSignalCollector,
  isArtifactVoteHandshakeValid,
  isSpaDestinationValid,
  prepareHermeticExtensionArtifact,
  readGeneratedMv3Contract,
  readArtifactVoteHandshake,
  runArtifactWatchRenderScenario,
  runArtifactWatchSpaClonedVoteScenario,
  runArtifactWatchSpaScenario,
  runArtifactWatchSpaVoteScenario,
  runExtensionDelayedOutgoingFailureScenario,
  startHermeticApiServer,
} = require("./hermetic-artifact-smoke");

const PRODUCTION_API_ORIGIN = "https://returnyoutubedislikeapi.com";
const temporaryDirectories = [];

function createExtensionFixture(lineEnding = "\n") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-mv3-source-fixture-"));
  temporaryDirectories.push(directory);
  fs.writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      background: { service_worker: "ryd.background.js" },
      content_scripts: [
        { css: ["content-style.css"], js: ["ryd.content-script.js"], matches: ["*://www.youtube.com/*"] },
      ],
      host_permissions: ["*://returnyoutubedislikeapi.com/*"],
      manifest_version: 3,
      version: "4.0.5",
    }),
  );
  fs.writeFileSync(
    path.join(directory, "ryd.background.js"),
    `fetch("${PRODUCTION_API_ORIGIN}/register")\napi.runtime.onInstalled.addListener((details) => {\n  maybeShowChangelog(details);\n});`.replaceAll(
      "\n",
      lineEnding,
    ),
  );
  fs.writeFileSync(path.join(directory, "ryd.content-script.js"), `fetch("${PRODUCTION_API_ORIGIN}/votes")`);
  fs.writeFileSync(path.join(directory, "content-style.css"), "#ryd-bar { display: block; }");
  fs.writeFileSync(path.join(directory, "menu-fixer.js"), "document.documentElement.dataset.menuFixerLoaded = 'true';");
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test("the artifact smoke is the shared watch-render scenario", () => {
  expect(ARTIFACT_SMOKE_SCENARIO_ID).toBe("watch-render");
  expect(ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID).toBe("watch-spa-cloned-controls-immediate-dislike");
  expect(ARTIFACT_WATCH_SPA_SCENARIO_ID).toBe("watch-spa-side-panel");
  expect(ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID).toBe("watch-spa-dislike-activation");
  expect(SHARED_ARTIFACT_SCENARIO_IDS).toEqual([
    "watch-render",
    "watch-spa-side-panel",
    "watch-spa-dislike-activation",
    "watch-spa-cloned-controls-immediate-dislike",
  ]);
  expect(SHARED_ARTIFACT_RUNTIMES).toEqual(["userscript", "extension"]);
  expect(ARTIFACT_BROWSER_SCENARIO_CATALOG).toEqual([
    ...SHARED_ARTIFACT_SCENARIO_IDS.map((id) => ({ id, runtimes: SHARED_ARTIFACT_RUNTIMES, shared: true })),
    {
      capability: "background",
      id: ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
      runtimes: ["extension"],
      shared: false,
    },
  ]);
  expect(assertArtifactBrowserScenarioCatalog()).toBe(ARTIFACT_BROWSER_SCENARIO_CATALOG);
  expect(createArtifactBrowserScenarioPlan()).toEqual([
    ...SHARED_ARTIFACT_SCENARIO_IDS.flatMap((scenarioId) =>
      SHARED_ARTIFACT_RUNTIMES.map((runtime) => ({ runtime, scenarioId })),
    ),
    { runtime: "extension", scenarioId: ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID },
  ]);
});

test.each([
  [
    "a missing extension run from a core scenario",
    (catalog) => {
      catalog[0] = { ...catalog[0], runtimes: ["userscript"] };
    },
    /must run for userscript and extension/,
  ],
  [
    "a core scenario reclassified as extension-only",
    (catalog) => {
      catalog[0] = { ...catalog[0], capability: "background", runtimes: ["extension"], shared: false };
    },
    /must remain shared/,
  ],
  [
    "an undeclared extension-only capability",
    (catalog) => {
      catalog[catalog.length - 1] = { ...catalog.at(-1), capability: "mobile-layout" };
    },
    /must declare a supported capability/,
  ],
  [
    "an extension-only scenario registered for userscript",
    (catalog) => {
      catalog[catalog.length - 1] = { ...catalog.at(-1), runtimes: ["userscript", "extension"] };
    },
    /must run only for extension/,
  ],
  [
    "an unknown scenario presented as shared coverage",
    (catalog) => {
      catalog.push({ id: "uncatalogued-core-behavior", runtimes: ["userscript", "extension"], shared: true });
    },
    /must be added to the shared scenario contract/,
  ],
])("the artifact catalog rejects %s", (_label, mutateCatalog, message) => {
  const catalog = ARTIFACT_BROWSER_SCENARIO_CATALOG.map((entry) => ({ ...entry, runtimes: [...entry.runtimes] }));
  mutateCatalog(catalog);

  expect(() => assertArtifactBrowserScenarioCatalog(catalog)).toThrow(message);
  expect(() => createArtifactBrowserScenarioPlan(catalog)).toThrow(message);
});

function validSpaSnapshot() {
  const outgoing = {
    barCount: 0,
    containerCount: 0,
    controlVideoIds: ["abcdefghijk"],
    hidden: true,
    present: true,
    wrapperCount: 0,
  };
  return {
    actionHostCount: 1,
    barOwnedByDestination: true,
    containerOwnedByDestination: true,
    count: "65",
    currentVideoId: "zyxwvutsrqp",
    destinationBarCount: 1,
    destinationContainerCount: 1,
    destinationControlCount: 1,
    destinationWrapperCount: 1,
    fillRatio: 0.35,
    globalBarCount: 1,
    globalContainerCount: 1,
    globalWrapperCount: 1,
    insideOutgoing: { ...outgoing },
    retainedBefore: { ...outgoing },
    retainedDestination: { ...outgoing, controlVideoIds: ["zyxwvutsrqp"] },
    tooltipText: "35 / 65",
    urlVideoId: "zyxwvutsrqp",
    visibleContainer: true,
    visibleFill: true,
  };
}

const ARTIFACT_USER_ID = "A".repeat(36);

function validVoteHandshake(change = {}) {
  return {
    confirmation: {
      body: { solution: "AAAAAA==", userId: ARTIFACT_USER_ID, videoId: "zyxwvutsrqp" },
      responded: true,
      responseBody: true,
      responseStatus: 200,
    },
    confirmationCount: 1,
    expectedValue: -1,
    expectedVideoId: "zyxwvutsrqp",
    interactionCount: 2,
    interactionPaths: ["/interact/vote", "/interact/confirmVote"],
    sharedUserId: ARTIFACT_USER_ID,
    vote: {
      body: { userId: ARTIFACT_USER_ID, value: -1, videoId: "zyxwvutsrqp" },
      responded: true,
      responseBody: { challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 },
      responseStatus: 200,
    },
    voteCount: 1,
    ...change,
  };
}

test.each(["http://127.0.0.1:43127", "http://localhost:43127", "http://[::1]:43127"])(
  "accepts a loopback-only API origin: %s",
  (origin) => {
    expect(assertLoopbackOrigin(origin)).toBe(origin);
  },
);

test.each(["https://returnyoutubedislikeapi.com", "https://api.example.test", "http://192.168.1.20:43127"])(
  "rejects a non-loopback API origin: %s",
  (origin) => {
    expect(() => assertLoopbackOrigin(origin)).toThrow("Refusing to prepare a hermetic extension artifact");
  },
);

test.each([
  ["/votes", "GET"],
  ["/puzzle/registration", "POST"],
  ["/interact/vote", "POST"],
  [WORKER_SIGNAL_PATH, "POST"],
])("accepts a preflight only for a declared API method: %s %s", (pathname, method) => {
  expect(isAllowedApiPreflight(pathname, method)).toBe(true);
});

test.each([
  ["/not-an-api", "POST"],
  ["/interact/vote", "GET"],
  ["/votes", "POST"],
  ["/votes", null],
])("rejects undeclared preflight traffic: %s %s", (pathname, method) => {
  expect(isAllowedApiPreflight(pathname, method)).toBe(false);
});

function requestPreflight(origin, pathname, requestedMethod) {
  const url = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        headers: {
          "access-control-request-method": requestedMethod,
          origin: "https://www.youtube.com",
        },
        method: "OPTIONS",
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      },
    );
    request.once("error", reject);
    request.end();
  });
}

test("the loopback backend records and rejects an OPTIONS request to an unknown path", async () => {
  const apiServer = await startHermeticApiServer();
  try {
    await expect(requestPreflight(apiServer.origin, "/interact/vote", "POST")).resolves.toBe(204);
    await expect(requestPreflight(apiServer.origin, "/unexpected-preflight", "POST")).resolves.toBe(404);

    expect(apiServer.records.map(({ method, pathname }) => ({ method, pathname }))).toEqual([
      { method: "OPTIONS", pathname: "/interact/vote" },
      { method: "OPTIONS", pathname: "/unexpected-preflight" },
    ]);
    expect(apiServer.unexpectedRequests).toHaveLength(1);
    expect(apiServer.unexpectedRequests[0]).toMatchObject({
      method: "OPTIONS",
      pathname: "/unexpected-preflight",
      responseStatus: 404,
    });
  } finally {
    await apiServer.close();
  }
});

function createPreflightRoute(pathname, requestedMethod) {
  const request = {
    headers: () => ({ "access-control-request-method": requestedMethod }),
    method: () => "OPTIONS",
    resourceType: () => "fetch",
    url: () => `https://returnyoutubedislikeapi.com${pathname}`,
  };
  return {
    abort: jest.fn(async () => {}),
    fulfill: jest.fn(async () => {}),
    request: () => request,
  };
}

function createWatchDocumentRoute() {
  const request = {
    resourceType: () => "document",
    url: () => "https://www.youtube.com/watch?v=abcdefghijk",
  };
  return {
    fulfill: jest.fn(async () => {}),
    request: () => request,
  };
}

test("shared artifact fixtures do not preseed runtime roles or a Dislike count container", async () => {
  const backendOptions = createSharedArtifactBackendOptions({
    countsByVideo: { abcdefghijk: { dislikes: 25, likes: 100 } },
  });
  expect(backendOptions.fixture).toEqual({
    nativeDislikeText: false,
    roleAttribute: "data-fixture-role",
  });

  const backend = createFakeBackend(backendOptions);
  const route = createWatchDocumentRoute();
  await backend.handle(route);

  expect(route.fulfill).toHaveBeenCalledTimes(1);
  const [{ body }] = route.fulfill.mock.calls[0];
  const dislikeMarkup = body.match(/<dislike-button-view-model\b[\s\S]*?<\/dislike-button-view-model>/)?.[0];
  expect(body).toContain('data-fixture-role="buttons"');
  expect(body).not.toContain("data-ryd-role=");
  expect(dislikeMarkup).toBeDefined();
  expect(dislikeMarkup).not.toMatch(/id="text"|role="text"|ytSpecButtonShapeNextButtonTextContent/);
});

test("the routed fake backend records a valid preflight and blocks an unknown one", async () => {
  const backend = createFakeBackend();
  const valid = createPreflightRoute("/interact/confirmVote", "POST");
  const invalid = createPreflightRoute("/unexpected-preflight", "POST");

  await backend.handle(valid);
  await backend.handle(invalid);

  expect(valid.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 204 }));
  expect(valid.abort).not.toHaveBeenCalled();
  expect(backend.preflightRequests).toEqual([
    expect.objectContaining({
      method: "OPTIONS",
      pathname: "/interact/confirmVote",
      requestedMethod: "POST",
    }),
  ]);
  expect(invalid.abort).toHaveBeenCalledWith("blockedbyclient");
  expect(backend.blockedRequests).toEqual([
    expect.objectContaining({
      method: "OPTIONS",
      pathname: "/unexpected-preflight",
      requestedMethod: "POST",
    }),
  ]);
});

test.each(["\n", "\r\n"])(
  "redirects MV3 background traffic with %j line endings and preserves routed traffic",
  (lineEnding) => {
    const sourceDirectory = createExtensionFixture(lineEnding);
    const prepared = prepareHermeticExtensionArtifact(sourceDirectory, "http://127.0.0.1:43127");
    temporaryDirectories.push(prepared.temporaryRoot);

    expect(prepared.replacements).toEqual({ "ryd.background.js": 1, firstInstallChangelogListener: 1 });
    expect(prepared.routedBundles).toEqual(["ryd.content-script.js"]);
    expect(fs.readFileSync(path.join(prepared.extensionDirectory, "ryd.background.js"), "utf8")).toContain(
      "http://127.0.0.1:43127/register",
    );
    expect(fs.readFileSync(path.join(prepared.extensionDirectory, "ryd.background.js"), "utf8")).toContain(
      "__rydArtifactWorkerSignals",
    );
    expect(prepared.workerSignalEndpoint).toBe(`http://127.0.0.1:43127${WORKER_SIGNAL_PATH}`);
    expect(fs.readFileSync(path.join(prepared.extensionDirectory, "ryd.background.js"), "utf8")).toContain(
      "api.runtime.onInstalled.addListener(() => {});",
    );
    expect(fs.readFileSync(path.join(prepared.extensionDirectory, "ryd.content-script.js"), "utf8")).toContain(
      `${PRODUCTION_API_ORIGIN}/votes`,
    );
    expect(fs.readFileSync(path.join(prepared.extensionDirectory, "menu-fixer.js"), "utf8")).toContain(
      "menuFixerLoaded",
    );
    expect(JSON.parse(fs.readFileSync(path.join(prepared.extensionDirectory, "manifest.json"), "utf8"))).toMatchObject({
      host_permissions: expect.arrayContaining(["http://127.0.0.1/*"]),
      manifest_version: 3,
    });
    expect(fs.readFileSync(path.join(sourceDirectory, "ryd.background.js"), "utf8")).toContain(PRODUCTION_API_ORIGIN);
  },
);

test.each([
  [
    "an unexpected listener body",
    (source) => source.replace("maybeShowChangelog(details);", "showOtherPage(details);"),
  ],
  ["duplicate changelog listeners", (source) => `${source}\n${source}`],
])("rejects %s instead of suppressing an unrecognized listener", (_label, mutateBackground) => {
  const sourceDirectory = createExtensionFixture();
  const backgroundPath = path.join(sourceDirectory, "ryd.background.js");
  fs.writeFileSync(backgroundPath, mutateBackground(fs.readFileSync(backgroundPath, "utf8")));

  expect(() => {
    const prepared = prepareHermeticExtensionArtifact(sourceDirectory, "http://127.0.0.1:43127");
    temporaryDirectories.push(prepared.temporaryRoot);
  }).toThrow(/exactly one recognized first-install changelog listener/);
});

test("rejects an extension artifact whose injected auxiliary script was dropped by the build", () => {
  const sourceDirectory = createExtensionFixture();
  fs.rmSync(path.join(sourceDirectory, "menu-fixer.js"));

  expect(() => prepareHermeticExtensionArtifact(sourceDirectory, "http://127.0.0.1:43127")).toThrow(
    /missing menu-fixer\.js/,
  );
});

test("the direct MV3 adapter contract rejects a development bundle with an inline source map", () => {
  const sourceDirectory = createExtensionFixture();
  fs.appendFileSync(
    path.join(sourceDirectory, "ryd.content-script.js"),
    "\n//# sourceMappingURL=data:application/json;base64,e30=",
  );

  expect(() => readGeneratedMv3Contract(sourceDirectory)).toThrow(
    "ryd.content-script.js contains an inline source map and is not a production bundle.",
  );
});

test.each(["userscript", "extension"])("runs one shared artifact scenario contract for %s", async (runtime) => {
  const events = [];
  const adapter = {
    assertNoPageSignals: jest.fn(async (scenarioId) => events.push(`signals:${scenarioId}`)),
    close: jest.fn(async () => events.push("close")),
    openWatch: jest.fn(async (videoId) => events.push(`open:${videoId}`)),
    runtime,
    start: jest.fn(async () => events.push("start")),
    waitForWatchResult: jest.fn(async (videoId) => ({
      actionSurfaceVisible: true,
      count: "25",
      countVisible: true,
      fillVisible: true,
      ownedByExpectedWatch: true,
      rateBarVisible: true,
      sameActionSurface: true,
      videoId,
    })),
  };

  await expect(runArtifactWatchRenderScenario(adapter, { videoId: "abcdefghijk" })).resolves.toMatchObject({
    count: "25",
    runtime,
    scenarioId: "watch-render",
    videoId: "abcdefghijk",
  });
  expect(events).toEqual(["start", "open:abcdefghijk", "signals:watch-render", "close"]);
});

test.each([
  ["a hidden action surface", { actionSurfaceVisible: false }],
  ["a hidden dislike count", { countVisible: false }],
  ["an outgoing watch root", { ownedByExpectedWatch: false }],
  ["a count and bar on different action surfaces", { sameActionSurface: false }],
  ["a missing numeric count", { count: "" }],
  ["a hidden ratio bar", { rateBarVisible: false }],
  ["a hidden ratio fill", { fillVisible: false }],
])("the watch-render oracle rejects %s", async (_label, mutation) => {
  const adapter = {
    assertNoPageSignals: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
    openWatch: jest.fn(async () => {}),
    runtime: "extension",
    start: jest.fn(async () => {}),
    waitForWatchResult: jest.fn(async (videoId) => ({
      actionSurfaceVisible: true,
      count: "25",
      countVisible: true,
      fillVisible: true,
      ownedByExpectedWatch: true,
      rateBarVisible: true,
      sameActionSurface: true,
      videoId,
      ...mutation,
    })),
  };

  await expect(runArtifactWatchRenderScenario(adapter, { videoId: "abcdefghijk" })).rejects.toThrow();
  expect(adapter.assertNoPageSignals).not.toHaveBeenCalled();
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

test.each(["userscript", "extension"])("runs the same continuous A-to-B SPA contract for %s", async (runtime) => {
  const events = [];
  const adapter = {
    assertNoPageSignals: jest.fn(async (scenarioId) => events.push(`signals:${scenarioId}`)),
    assertSpaNetwork: jest.fn(async () => ({ fromVideoRequests: 1, interactionRequests: 0, toVideoRequests: 1 })),
    close: jest.fn(async () => events.push("close")),
    navigateSpaWatch: jest.fn(async () => ({
      destination: { destinationReplaced: true },
      outgoing: { beforeBarCount: 1 },
    })),
    openSpaWatch: jest.fn(async (videoId) => events.push(`open:${videoId}`)),
    readSpaWatchSnapshot: jest.fn(async () => validSpaSnapshot()),
    runtime,
    start: jest.fn(async () => events.push("start")),
    waitForWatchResult: jest.fn(async (videoId) => ({ count: "10", fillRatio: 0.9, videoId })),
  };

  await expect(
    runArtifactWatchSpaScenario(adapter, {
      intervalMs: 1,
      stabilityDurationMs: 0,
      stableForMs: 0,
      timeoutMs: 1,
    }),
  ).resolves.toMatchObject({
    destination: { count: "65", fillRatio: 0.35, videoId: "zyxwvutsrqp" },
    initial: { count: "10", fillRatio: 0.9, videoId: "abcdefghijk" },
    readiness: { maxFirstValidMs: 1_000 },
    runtime,
    scenarioId: "watch-spa-side-panel",
    traffic: { fromVideoRequests: 1, interactionRequests: 0, toVideoRequests: 1 },
  });
  expect(adapter.navigateSpaWatch).toHaveBeenCalledWith("abcdefghijk", "zyxwvutsrqp");
  expect(events).toEqual(["start", "open:abcdefghijk", "signals:watch-spa-side-panel", "close"]);
});

function createDelayedFailureAdapter(destinationRequestAt) {
  const events = [];
  const outgoingRequest = { seen: Promise.resolve(), release: jest.fn() };
  return {
    events,
    assertNoPageSignals: jest.fn(async () => {}),
    assertSpaNetwork: jest.fn(async () => ({ fromVideoRequests: 1, interactionRequests: 0, toVideoRequests: 1 })),
    close: jest.fn(async () => events.push("close")),
    deferNextStatsRequest: jest.fn(() => {
      events.push("defer");
      return outgoingRequest;
    }),
    navigateSpaWatchWhilePending: jest.fn(async () => ({
      destination: { destinationReplaced: true, nativeHydrationStartedAt: 1000, nativeHydrationDelay: 750 },
      outgoing: { beforeBarCount: 0 },
    })),
    openSpaWatch: jest.fn(async () => events.push("open")),
    readDestinationDislikeTextHistory: jest.fn(async () => ["", "65"]),
    readSpaWatchSnapshot: jest.fn(async () => validSpaSnapshot()),
    readStatsRequestTimings: jest.fn(() => [{ at: destinationRequestAt, query: { videoId: "zyxwvutsrqp" } }]),
    runtime: "extension",
    setPremiumTeaserHidden: jest.fn(async (hidden) => events.push(`hide-teaser:${hidden}`)),
    start: jest.fn(async () => events.push("start")),
    waitForWatchResult: jest.fn(),
  };
}

test("isolates main initialization request timing before loading the outgoing fixture", async () => {
  const adapter = createDelayedFailureAdapter(1800);
  await expect(runExtensionDelayedOutgoingFailureScenario(adapter)).resolves.toMatchObject({
    destinationRequestReadyDelayMs: 50,
    scenarioId: ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
  });
  expect(adapter.events).toEqual(["start", "hide-teaser:true", "defer", "open", "close"]);
});

test("waits for the initial background preference write before hiding the teaser", async () => {
  const previousChrome = globalThis.chrome;
  const listeners = new Set();
  let storedValue;
  const sync = {
    get: jest.fn(async () => ({ hidePremiumTeaser: storedValue })),
    set: jest.fn(async ({ hidePremiumTeaser }) => {
      storedValue = hidePremiumTeaser;
    }),
  };
  globalThis.chrome = {
    storage: {
      sync,
      onChanged: {
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
      },
    },
  };
  try {
    const adapter = { worker: { evaluate: (callback, value) => callback(value) } };
    const pending = HermeticExtensionArtifactAdapter.prototype.setPremiumTeaserHidden.call(adapter, true);
    await Promise.resolve();
    expect(sync.set).not.toHaveBeenCalled();
    storedValue = false;
    for (const listener of listeners) listener({ hidePremiumTeaser: { newValue: false } }, "sync");
    await pending;
    expect(sync.set).toHaveBeenCalledWith({ hidePremiumTeaser: true });
    expect(storedValue).toBe(true);
    expect(listeners.size).toBe(0);
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});

test("arms delayed destination controls before the real navigation click can expose them", async () => {
  const events = [];
  const destination = { destinationReplaced: true, nativeHydrationStartedAt: 1000, nativeHydrationDelay: 750 };
  const page = {
    evaluate: jest
      .fn()
      .mockResolvedValueOnce({ beforeBarCount: 0 })
      .mockImplementationOnce(async (_callback, options) => {
        expect(options).toMatchObject({
          beforeNavigation: true,
          expectedVideoId: "zyxwvutsrqp",
          nativeHydrationDelay: 750,
        });
        events.push("arm");
      })
      .mockImplementationOnce(async () => {
        events.push("read");
        return destination;
      })
      .mockResolvedValueOnce(undefined),
    locator: jest.fn(() => ({ click: async () => events.push("click") })),
    waitForFunction: jest.fn(async () => {}),
  };
  await expect(
    HermeticExtensionArtifactAdapter.prototype.navigateSpaWatchWhilePending.call(
      { page },
      "abcdefghijk",
      "zyxwvutsrqp",
    ),
  ).resolves.toEqual({ destination, outgoing: { beforeBarCount: 0 } });
  expect(events).toEqual(["arm", "click", "read"]);
});

test.each([
  ["a request before native controls hydrate", 1749, /before its controls hydrated/],
  ["a request beyond the initialization latency budget", 2001, /budget is 250ms/],
])("the isolated initialization scenario still rejects %s", async (_label, at, message) => {
  const adapter = createDelayedFailureAdapter(at);
  await expect(runExtensionDelayedOutgoingFailureScenario(adapter)).rejects.toThrow(message);
  expect(adapter.assertSpaNetwork).not.toHaveBeenCalled();
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

test("recognizes only one ordered, successful destination dislike handshake", () => {
  const records = [
    { method: "POST", pathname: "/puzzle/registration" },
    {
      body: { userId: ARTIFACT_USER_ID, value: -1, videoId: "zyxwvutsrqp" },
      method: "POST",
      pathname: "/interact/vote",
      respondedAt: 122,
      responseBody: { challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 },
      responseStatus: 200,
    },
    {
      body: { solution: "AAAAAA==", userId: ARTIFACT_USER_ID, videoId: "zyxwvutsrqp" },
      method: "POST",
      pathname: "/interact/confirmVote",
      respondedAt: 123,
      responseBody: true,
      responseStatus: 200,
    },
  ];

  const handshake = readArtifactVoteHandshake(records, 1, "zyxwvutsrqp", -1);
  expect(handshake).toEqual(validVoteHandshake());
  expect(isArtifactVoteHandshakeValid(handshake)).toBe(true);
});

test.each([
  ["duplicate listener requests", (value) => ({ ...value, interactionCount: 4, voteCount: 2, confirmationCount: 2 })],
  ["reversed request order", (value) => ({ ...value, interactionPaths: ["/interact/confirmVote", "/interact/vote"] })],
  [
    "the wrong destination video",
    (value) => ({ ...value, vote: { body: { ...value.vote.body, videoId: "abcdefghijk" } } }),
  ],
  ["the wrong vote value", (value) => ({ ...value, vote: { body: { ...value.vote.body, value: 1 } } })],
  [
    "different vote and confirmation identities",
    (value) => ({
      ...value,
      confirmation: {
        ...value.confirmation,
        body: { ...value.confirmation.body, userId: "B".repeat(36) },
      },
    }),
  ],
  ["a malformed identity", (value) => ({ ...value, sharedUserId: "short-user" })],
  ["an unfinished vote response", (value) => ({ ...value, vote: { ...value.vote, responded: false } })],
  ["a failed vote status", (value) => ({ ...value, vote: { ...value.vote, responseStatus: 500 } })],
  ["a false confirmation", (value) => ({ ...value, confirmation: { ...value.confirmation, responseBody: false } })],
  [
    "an unfinished confirmation response",
    (value) => ({ ...value, confirmation: { ...value.confirmation, responded: false } }),
  ],
  [
    "a failed confirmation status",
    (value) => ({ ...value, confirmation: { ...value.confirmation, responseStatus: 500 } }),
  ],
  [
    "a malformed proof solution",
    (value) => ({
      ...value,
      confirmation: { ...value.confirmation, body: { ...value.confirmation.body, solution: "AA==" } },
    }),
  ],
  ["an extra vote field", (value) => ({ ...value, vote: { body: { ...value.vote.body, duplicate: true } } })],
])("rejects a post-SPA vote handshake with %s", (_label, mutate) => {
  expect(isArtifactVoteHandshakeValid(mutate(validVoteHandshake()))).toBe(false);
});

test("accepts successful 2xx vote and confirmation responses", () => {
  const handshake = validVoteHandshake({
    confirmation: { ...validVoteHandshake().confirmation, responseStatus: 202 },
    vote: { ...validVoteHandshake().vote, responseStatus: 201 },
  });

  expect(isArtifactVoteHandshakeValid(handshake)).toBe(true);
});

test.each(["userscript", "extension"])(
  "runs one post-SPA dislike activation and confirmation contract for %s",
  async (runtime) => {
    const events = [];
    const adapter = {
      activateSpaDislike: jest.fn(async (videoId) => ({
        ariaPressedBefore: "false",
        interactionStartIndex: 7,
        videoId,
      })),
      assertNoPageSignals: jest.fn(async (scenarioId) => events.push(`signals:${scenarioId}`)),
      assertSpaVoteNetwork: jest.fn(async () => ({ fromVideoRequests: 1, toVideoRequests: 1 })),
      close: jest.fn(async () => events.push("close")),
      navigateSpaWatch: jest.fn(async () => ({
        destination: { destinationReplaced: true },
        outgoing: { beforeBarCount: 1 },
      })),
      openSpaWatch: jest.fn(async (videoId) => events.push(`open:${videoId}`)),
      readSpaVoteHandshake: jest.fn(async () => validVoteHandshake()),
      readSpaWatchSnapshot: jest.fn(async () => validSpaSnapshot()),
      runtime,
      start: jest.fn(async () => events.push("start")),
      waitForWatchResult: jest.fn(async (videoId) => ({ count: "10", fillRatio: 0.9, videoId })),
    };

    await expect(
      runArtifactWatchSpaVoteScenario(adapter, {
        handshakeStableForMs: 0,
        handshakeTimeoutMs: 1,
        intervalMs: 1,
        stabilityDurationMs: 0,
        stableForMs: 0,
        timeoutMs: 1,
      }),
    ).resolves.toMatchObject({
      activation: { ariaPressedBefore: "false", videoId: "zyxwvutsrqp" },
      destination: { count: "65", fillRatio: 0.35, videoId: "zyxwvutsrqp" },
      handshake: {
        confirmationRequests: 1,
        confirmationStatus: 200,
        confirmed: true,
        interactionRequests: 2,
        userId: ARTIFACT_USER_ID,
        value: -1,
        videoId: "zyxwvutsrqp",
        voteResponded: true,
        voteRequests: 1,
        voteStatus: 200,
      },
      runtime,
      scenarioId: "watch-spa-dislike-activation",
      traffic: { confirmationRequests: 1, interactionRequests: 2, voteRequests: 1 },
    });
    expect(adapter.activateSpaDislike).toHaveBeenCalledTimes(1);
    expect(adapter.activateSpaDislike).toHaveBeenCalledWith("zyxwvutsrqp");
    expect(adapter.readSpaVoteHandshake).toHaveBeenCalledWith(7, "zyxwvutsrqp", -1);
    expect(adapter.assertSpaVoteNetwork).toHaveBeenCalledWith("abcdefghijk", "zyxwvutsrqp", 7);
    expect(events).toEqual(["start", "open:abcdefghijk", "signals:watch-spa-dislike-activation", "close"]);
  },
);

test.each(["userscript", "extension"])(
  "requires the first immediate click on cloned initialized controls for %s",
  async (runtime) => {
    const events = [];
    const adapter = {
      activateClonedSpaDislike: jest.fn(async (videoId) => ({
        ariaPressedBefore: "false",
        barCount: 1,
        countAfterSynchronousClick: "66",
        countBefore: "65",
        countContainerCount: 1,
        interactionStartIndex: 9,
        presentationCloned: true,
        videoId,
      })),
      assertNoPageSignals: jest.fn(async (scenarioId) => events.push(`signals:${scenarioId}`)),
      assertSpaVoteNetwork: jest.fn(async () => ({ fromVideoRequests: 1, toVideoRequests: 1 })),
      close: jest.fn(async () => events.push("close")),
      navigateSpaWatch: jest.fn(async () => ({
        destination: { destinationReplaced: true },
        outgoing: { beforeBarCount: 1 },
      })),
      openSpaWatch: jest.fn(async (videoId) => events.push(`open:${videoId}`)),
      readSpaVoteHandshake: jest.fn(async () => validVoteHandshake()),
      readSpaWatchSnapshot: jest.fn(async () => validSpaSnapshot()),
      runtime,
      start: jest.fn(async () => events.push("start")),
      waitForWatchResult: jest.fn(async (videoId) => ({ count: "10", fillRatio: 0.9, videoId })),
    };

    await expect(
      runArtifactWatchSpaClonedVoteScenario(adapter, {
        handshakeStableForMs: 0,
        handshakeTimeoutMs: 1,
        intervalMs: 1,
        stabilityDurationMs: 0,
        stableForMs: 0,
        timeoutMs: 1,
      }),
    ).resolves.toMatchObject({
      activation: { ariaPressedBefore: "false", presentationCloned: true, videoId: "zyxwvutsrqp" },
      handshake: { interactionRequests: 2, value: -1, videoId: "zyxwvutsrqp" },
      runtime,
      scenarioId: "watch-spa-cloned-controls-immediate-dislike",
    });
    expect(adapter.activateClonedSpaDislike).toHaveBeenCalledWith("zyxwvutsrqp");
    expect(adapter.readSpaVoteHandshake).toHaveBeenCalledWith(9, "zyxwvutsrqp", -1);
    expect(events).toEqual([
      "start",
      "open:abcdefghijk",
      "signals:watch-spa-cloned-controls-immediate-dislike",
      "close",
    ]);
  },
);

test("rejects a duplicated post-SPA vote chain and still closes the adapter", async () => {
  const duplicatedHandshake = validVoteHandshake({
    confirmationCount: 2,
    interactionCount: 4,
    interactionPaths: ["/interact/vote", "/interact/confirmVote", "/interact/vote", "/interact/confirmVote"],
    voteCount: 2,
  });
  const adapter = {
    activateSpaDislike: jest.fn(async (videoId) => ({ interactionStartIndex: 0, videoId })),
    assertNoPageSignals: jest.fn(),
    assertSpaVoteNetwork: jest.fn(),
    close: jest.fn(),
    navigateSpaWatch: jest.fn(async () => ({
      destination: { destinationReplaced: true },
      outgoing: { beforeBarCount: 1 },
    })),
    openSpaWatch: jest.fn(),
    readSpaVoteHandshake: jest.fn(async () => duplicatedHandshake),
    readSpaWatchSnapshot: jest.fn(async () => validSpaSnapshot()),
    runtime: "userscript",
    start: jest.fn(),
    waitForWatchResult: jest.fn(async (videoId) => ({ count: "10", fillRatio: 0.9, videoId })),
  };

  await expect(
    runArtifactWatchSpaVoteScenario(adapter, {
      handshakeStableForMs: 0,
      handshakeTimeoutMs: 1,
      intervalMs: 1,
      stabilityDurationMs: 0,
      stableForMs: 0,
      timeoutMs: 1,
    }),
  ).rejects.toThrow("post-SPA dislike handshake did not remain valid");
  expect(adapter.assertSpaVoteNetwork).not.toHaveBeenCalled();
  expect(adapter.assertNoPageSignals).not.toHaveBeenCalled();
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

test("rejects a destination that becomes correct after the explicit latency budget", async () => {
  const adapter = {
    assertNoPageSignals: jest.fn(),
    assertSpaNetwork: jest.fn(),
    close: jest.fn(),
    navigateSpaWatch: jest.fn(async () => ({
      destination: { destinationReplaced: true },
      outgoing: { beforeBarCount: 1 },
    })),
    openSpaWatch: jest.fn(),
    readSpaWatchSnapshot: jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return validSpaSnapshot();
    }),
    runtime: "userscript",
    start: jest.fn(),
    waitForWatchResult: jest.fn(async (videoId) => ({ count: "10", fillRatio: 0.9, videoId })),
  };

  await expect(
    runArtifactWatchSpaScenario(adapter, {
      intervalMs: 1,
      maxFirstValidMs: 1,
      stabilityDurationMs: 0,
      stableForMs: 0,
      timeoutMs: 20,
    }),
  ).rejects.toThrow(/first became valid after .*the budget is 1ms/);
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

test.each([
  ["duplicate global bar", { globalBarCount: 2 }],
  ["stale outgoing bar", { insideOutgoing: { ...validSpaSnapshot().insideOutgoing, barCount: 1 } }],
  ["wrong destination ratio", { fillRatio: 0.9 }],
  ["wrong destination count", { count: "10" }],
])("rejects a settled SPA snapshot with %s", (_label, change) => {
  expect(
    isSpaDestinationValid(
      { ...validSpaSnapshot(), ...change },
      {
        expectedCount: 65,
        expectedRatio: 0.35,
        fromVideoId: "abcdefghijk",
        toVideoId: "zyxwvutsrqp",
      },
    ),
  ).toBe(false);
});

test("always closes an artifact adapter after a failed visual assertion", async () => {
  const adapter = {
    assertNoPageSignals: jest.fn(),
    close: jest.fn(),
    openWatch: jest.fn(),
    runtime: "extension",
    start: jest.fn(),
    waitForWatchResult: jest.fn(async () => ({
      actionSurfaceVisible: true,
      count: "25",
      countVisible: true,
      fillVisible: true,
      ownedByExpectedWatch: true,
      rateBarVisible: false,
      sameActionSurface: true,
      videoId: "abcdefghijk",
    })),
  };

  await expect(runArtifactWatchRenderScenario(adapter, { videoId: "abcdefghijk" })).rejects.toThrow(
    "extension did not render a visible watch ratio bar",
  );
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

test("turns an otherwise successful artifact result into a failure when the page emitted an error", async () => {
  const adapter = {
    assertNoPageSignals: jest.fn(async () => {
      throw new Error("unexpected browser signals");
    }),
    close: jest.fn(),
    openWatch: jest.fn(),
    runtime: "userscript",
    start: jest.fn(),
    waitForWatchResult: jest.fn(async (videoId) => ({
      actionSurfaceVisible: true,
      count: "25",
      countVisible: true,
      fillVisible: true,
      ownedByExpectedWatch: true,
      rateBarVisible: true,
      sameActionSurface: true,
      videoId,
    })),
  };

  await expect(runArtifactWatchRenderScenario(adapter, { videoId: "abcdefghijk" })).rejects.toThrow(
    "unexpected browser signals",
  );
  expect(adapter.close).toHaveBeenCalledTimes(1);
});

function createPageDouble() {
  const page = new EventEmitter();
  page.addInitScript = jest.fn(async () => {});
  page.evaluate = jest.fn(async (callback) => callback());
  page.exposeBinding = jest.fn(async (name, callback) => {
    page.exposedBinding = { callback, name };
  });
  return page;
}

function consoleMessage(
  type,
  text,
  location = { columnNumber: 5, lineNumber: 4, url: "https://www.youtube.com/watch" },
) {
  return {
    location: () => location,
    text: () => text,
    type: () => type,
  };
}

function createWorkerDouble(signals = []) {
  const worker = new EventEmitter();
  worker.evaluate = jest.fn(async (callback, argument) => {
    globalThis.__rydArtifactWorkerSignals = signals;
    try {
      return await callback(argument);
    } finally {
      delete globalThis.__rydArtifactWorkerSignals;
    }
  });
  worker.url = () => "chrome-extension://abcdefghijklmnopabcdefghijklmnop/ryd.background.js";
  return worker;
}

test("the worker collector fails on a captured unhandled rejection even without a console event", async () => {
  const worker = createWorkerDouble([
    {
      at: 123,
      details: {},
      kind: "unhandledrejection",
      message: "intentional worker promise rejection",
      name: "Error",
      stack: "Error: intentional worker promise rejection",
    },
  ]);
  const collector = createWorkerSignalCollector(worker, { workerSignals: [] });

  await expect(collector.assertClean("worker-negative-control")).rejects.toThrow(
    /extension MV3 worker emitted unexpected runtime signals.*intentional worker promise rejection/s,
  );
});

test("the worker collector includes early console failures reported by the worker probe", async () => {
  const worker = createWorkerDouble();
  const collector = createWorkerSignalCollector(worker, {
    workerSignals: [{ kind: "console-error", message: "startup exploded" }],
  });

  await expect(collector.assertClean("worker-startup")).rejects.toThrow(/startup exploded/);
});

test.each(["userscript", "extension"])(
  "collects clean page signals through one shared %s collector",
  async (runtime) => {
    const page = createPageDouble();
    const collector = await createPageSignalCollector(page, runtime);

    page.emit("console", consoleMessage("info", "harmless information"));

    await expect(collector.assertClean("watch-render")).resolves.toEqual({
      consoleErrors: [],
      pageErrors: [],
      runtime,
      unhandledRejections: [],
    });
    expect(page.exposeBinding).toHaveBeenCalledWith("__rydArtifactReportUnhandledRejection", expect.any(Function));
    expect(page.addInitScript).toHaveBeenCalledTimes(1);
  },
);

test.each([
  ["console error", (page) => page.emit("console", consoleMessage("error", "fixture exploded")), "fixture exploded"],
  [
    "console warning",
    (page) => page.emit("console", consoleMessage("warning", "initialization retry failed")),
    "initialization retry failed",
  ],
  [
    "failed browser resource load",
    (page) => page.emit("console", consoleMessage("error", "Failed to load resource: net::ERR_FILE_NOT_FOUND")),
    "ERR_FILE_NOT_FOUND",
  ],
  [
    "failed console assertion",
    (page) => page.emit("console", consoleMessage("assert", "bad assertion")),
    "bad assertion",
  ],
  ["page error", (page) => page.emit("pageerror", new TypeError("page exploded")), "page exploded"],
  [
    "unhandled rejection",
    (page) =>
      page.exposedBinding.callback(
        { frame: { url: () => "https://www.youtube.com/watch?v=abcdefghijk" } },
        { message: "promise exploded", name: "Error", stack: "Error: promise exploded" },
      ),
    "promise exploded",
  ],
])("fails a successful scenario on %s with diagnostics", async (_label, emitSignal, expectedDiagnostic) => {
  const page = createPageDouble();
  const collector = await createPageSignalCollector(page, "userscript");
  emitSignal(page);

  await expect(collector.assertClean("watch-render")).rejects.toThrow(
    new RegExp(`userscript emitted unexpected browser signals.*${expectedDiagnostic}`, "s"),
  );
});
