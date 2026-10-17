const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const {
  VIDEO_A,
  VIDEO_B,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  openNavigationFixture,
  openWatchFixture,
} = require("../UserScript/e2e/harness");
const { assertInvariantContinuously, waitForStableInvariant } = require("./continuous-invariants");
const {
  WORKER_SIGNAL_PATH,
  assertExactSuccessfulVotesTraffic,
  isAllowedApiPreflight,
} = require("./hermetic-api-contract");
const { LIVE_RUNTIME_PROFILES } = require("./live-runtime-adapter");
const { SHARED_LIVE_SCENARIO_IDS } = require("./shared-live-scenarios");
const { assertProductionJavaScriptOutput } = require("./verify-extension-artifact");
const { isVoteProtocolBodyPairValid } = require("./vote-protocol-contract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const PRODUCTION_API_ORIGIN = "https://returnyoutubedislikeapi.com";
const ARTIFACT_SMOKE_SCENARIO_ID = "watch-render";
const ARTIFACT_WATCH_SPA_SCENARIO_ID = "watch-spa-side-panel";
const ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID = "watch-spa-dislike-activation";
const ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID = "watch-spa-cloned-controls-immediate-dislike";
const ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID = "extension-watch-spa-delayed-outgoing-failure";
const ARTIFACT_NATIVE_HYDRATION_DELAY_MS = 750;
const SHARED_ARTIFACT_SCENARIO_IDS = Object.freeze([
  ARTIFACT_SMOKE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID,
]);
const SHARED_ARTIFACT_RUNTIMES = Object.freeze(["userscript", "extension"]);
const EXTENSION_ONLY_ARTIFACT_CAPABILITIES = Object.freeze(["background", "premium", "settings"]);
const ARTIFACT_BROWSER_SCENARIO_CATALOG = Object.freeze([
  ...SHARED_ARTIFACT_SCENARIO_IDS.map((id) => Object.freeze({ id, runtimes: SHARED_ARTIFACT_RUNTIMES, shared: true })),
  Object.freeze({
    capability: "background",
    id: ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
    runtimes: Object.freeze(["extension"]),
    shared: false,
  }),
]);
const SPA_COUNTS = Object.freeze({
  [VIDEO_A]: Object.freeze({ dislikes: 10, likes: 90 }),
  [VIDEO_B]: Object.freeze({ dislikes: 65, likes: 35 }),
});
const DEFAULT_EXTENSION_ARTIFACT = path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome");
const DEFAULT_USERSCRIPT_ARTIFACT = path.join(
  REPOSITORY_ROOT,
  "Extensions",
  "UserScript",
  "Return Youtube Dislike.user.js",
);
const ZERO_DIFFICULTY_PUZZLE = {
  challenge: Buffer.alloc(16).toString("base64"),
  difficulty: 0,
};
const ARTIFACT_UNHANDLED_REJECTION_BINDING = "__rydArtifactReportUnhandledRejection";
const ARTIFACT_WORKER_SIGNAL_STORE = "__rydArtifactWorkerSignals";
const CONSOLE_FAILURE_TYPES = new Set(["assert", "error", "warning"]);
const SHARED_ARTIFACT_FIXTURE_DEFAULTS = Object.freeze({
  nativeDislikeText: false,
  roleAttribute: "data-fixture-role",
});
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assertArtifactBrowserScenarioCatalog(catalog = ARTIFACT_BROWSER_SCENARIO_CATALOG) {
  assert.ok(Array.isArray(catalog), "The hermetic artifact browser catalog must be an array.");
  assert.equal(
    new Set(catalog.map(({ id }) => id)).size,
    catalog.length,
    "Artifact browser scenario IDs must be unique.",
  );
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));

  for (const scenarioId of SHARED_ARTIFACT_SCENARIO_IDS) {
    const entry = byId.get(scenarioId);
    assert.ok(entry, `The shared artifact browser catalog is missing ${scenarioId}.`);
    assert.equal(entry.shared, true, `The core artifact browser scenario ${scenarioId} must remain shared.`);
    assert.deepEqual(
      entry.runtimes,
      SHARED_ARTIFACT_RUNTIMES,
      `The core artifact browser scenario ${scenarioId} must run for userscript and extension.`,
    );
    assert.equal(entry.capability, undefined, `The shared artifact browser scenario ${scenarioId} is misclassified.`);
  }

  for (const entry of catalog) {
    assert.equal(typeof entry.id, "string", "Every artifact browser scenario must have a string ID.");
    assert.equal(
      typeof entry.shared,
      "boolean",
      `Artifact browser scenario ${entry.id} must declare shared explicitly.`,
    );
    if (entry.shared) {
      assert.ok(
        SHARED_ARTIFACT_SCENARIO_IDS.includes(entry.id),
        `Unknown shared artifact browser scenario ${entry.id} must be added to the shared scenario contract.`,
      );
      assert.deepEqual(
        entry.runtimes,
        SHARED_ARTIFACT_RUNTIMES,
        `The core artifact browser scenario ${entry.id} must run for userscript and extension.`,
      );
      assert.equal(entry.capability, undefined, `The shared artifact browser scenario ${entry.id} is misclassified.`);
    } else {
      assert.deepEqual(
        entry.runtimes,
        ["extension"],
        `Extension-only scenario ${entry.id} must run only for extension.`,
      );
      assert.ok(
        EXTENSION_ONLY_ARTIFACT_CAPABILITIES.includes(entry.capability),
        `Extension-only scenario ${entry.id} must declare a supported capability.`,
      );
    }
  }
  return catalog;
}

function createArtifactBrowserScenarioPlan(catalog = ARTIFACT_BROWSER_SCENARIO_CATALOG) {
  return assertArtifactBrowserScenarioCatalog(catalog).flatMap(({ id: scenarioId, runtimes }) =>
    runtimes.map((runtime) => Object.freeze({ runtime, scenarioId })),
  );
}

function createSharedArtifactBackendOptions(backendOptions = {}) {
  if (!backendOptions || typeof backendOptions !== "object" || Array.isArray(backendOptions)) {
    throw new TypeError("Shared artifact backend options must be an object.");
  }
  const fixture = backendOptions.fixture ?? {};
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new TypeError("Shared artifact fixture options must be an object.");
  }
  return {
    ...backendOptions,
    fixture: {
      ...SHARED_ARTIFACT_FIXTURE_DEFAULTS,
      ...fixture,
    },
  };
}

function serializeBrowserError(error) {
  return {
    message: error?.message ?? String(error),
    name: error?.name ?? "Error",
    stack: error?.stack ?? null,
  };
}

async function createPageSignalCollector(page, runtime) {
  assert.ok(page && typeof page.on === "function", "A Playwright page is required to collect browser signals.");
  assert.ok(["extension", "userscript"].includes(runtime), "A supported runtime is required for page diagnostics.");

  const consoleErrors = [];
  const pageErrors = [];
  const unhandledRejections = [];

  page.on("console", (message) => {
    if (!CONSOLE_FAILURE_TYPES.has(message.type())) return;
    consoleErrors.push({
      location: message.location(),
      text: message.text(),
      type: message.type(),
    });
  });
  page.on("pageerror", (error) => pageErrors.push(serializeBrowserError(error)));

  await page.exposeBinding(ARTIFACT_UNHANDLED_REJECTION_BINDING, (source, rejection) => {
    unhandledRejections.push({
      ...rejection,
      frameUrl: source.frame?.url() ?? null,
    });
  });
  await page.addInitScript(
    ({ bindingName }) => {
      globalThis.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        let serialized;
        if (reason instanceof Error || (reason && typeof reason.message === "string")) {
          serialized = {
            message: reason.message,
            name: typeof reason.name === "string" ? reason.name : "Error",
            stack: reason.stack ?? null,
          };
        } else {
          let value;
          try {
            value = JSON.stringify(reason);
          } catch {
            value = String(reason);
          }
          serialized = {
            message: value === undefined ? String(reason) : value,
            name: "UnhandledRejection",
            stack: null,
          };
        }
        void Promise.resolve(globalThis[bindingName](serialized)).catch(() => {});
      });
    },
    { bindingName: ARTIFACT_UNHANDLED_REJECTION_BINDING },
  );

  const snapshot = () => ({
    consoleErrors: consoleErrors.map((signal) => ({ ...signal, location: { ...signal.location } })),
    pageErrors: pageErrors.map((signal) => ({ ...signal })),
    runtime,
    unhandledRejections: unhandledRejections.map((signal) => ({ ...signal })),
  });

  return {
    async assertClean(scenarioId) {
      assert.equal(typeof scenarioId, "string", "A scenario id is required when checking page signals.");
      await page.evaluate(() => new Promise((resolve) => globalThis.setTimeout(resolve, 0)));
      const diagnostics = snapshot();
      const failureCount =
        diagnostics.consoleErrors.length + diagnostics.pageErrors.length + diagnostics.unhandledRejections.length;
      assert.equal(
        failureCount,
        0,
        `${runtime} emitted unexpected browser signals during ${scenarioId}: ${JSON.stringify(diagnostics, null, 2)}`,
      );
      return diagnostics;
    },
    snapshot,
  };
}

function createWorkerRuntimeProbe(signalEndpoint) {
  const endpoint = JSON.stringify(signalEndpoint);
  const signalStore = JSON.stringify(ARTIFACT_WORKER_SIGNAL_STORE);
  return `;(() => {
  const endpoint = ${endpoint};
  const signals = [];
  Object.defineProperty(globalThis, ${signalStore}, { configurable: false, value: signals, writable: false });
  const serialize = (kind, value, details = {}) => {
    let message;
    let name = kind === "unhandledrejection" ? "UnhandledRejection" : "Error";
    let stack = null;
    if (value instanceof Error || (value && typeof value.message === "string")) {
      message = value.message;
      name = typeof value.name === "string" ? value.name : name;
      stack = typeof value.stack === "string" ? value.stack : null;
    } else {
      try {
        message = typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        message = String(value);
      }
      if (message === undefined) message = String(value);
    }
    return { at: Date.now(), details, kind, message, name, stack };
  };
  const report = (kind, value, details) => {
    const signal = serialize(kind, value, details);
    signals.push(signal);
    void fetch(endpoint, {
      body: JSON.stringify(signal),
      headers: { "content-type": "text/plain;charset=UTF-8" },
      method: "POST",
    }).catch(() => {});
  };
  globalThis.addEventListener("error", (event) => {
    report("error", event.error || event.message, {
      column: event.colno || null,
      filename: event.filename || null,
      line: event.lineno || null,
    });
  });
  globalThis.addEventListener("unhandledrejection", (event) => report("unhandledrejection", event.reason));
  for (const [method, kind] of [["error", "console-error"], ["warn", "console-warning"]]) {
    const original = console[method].bind(console);
    console[method] = (...values) => {
      report(kind, values.map((value) => (typeof value === "string" ? value : String(value))).join(" "));
      return original(...values);
    };
  }
  const originalAssert = console.assert.bind(console);
  console.assert = (condition, ...values) => {
    if (!condition) report("console-assert", values.join(" ") || "Assertion failed");
    return originalAssert(condition, ...values);
  };
})();`;
}

function createWorkerSignalCollector(worker, apiServer) {
  assert.ok(worker && typeof worker.evaluate === "function", "A Playwright MV3 worker is required.");
  assert.ok(Array.isArray(apiServer?.workerSignals), "The hermetic server must expose worker signals.");

  const consoleFailures = [];
  let evaluatedSignals = [];
  let evaluationFailure = null;

  worker.on("console", (message) => {
    if (!CONSOLE_FAILURE_TYPES.has(message.type())) return;
    consoleFailures.push({ text: message.text(), type: message.type() });
  });

  async function refresh() {
    try {
      await worker.evaluate(() => new Promise((resolve) => globalThis.setTimeout(resolve, 0)));
      evaluatedSignals = await worker.evaluate((storeName) => {
        const signals = globalThis[storeName];
        if (!Array.isArray(signals)) throw new Error(`Missing MV3 worker signal probe ${storeName}`);
        return signals.map((signal) => ({ ...signal }));
      }, ARTIFACT_WORKER_SIGNAL_STORE);
      evaluationFailure = null;
    } catch (error) {
      evaluationFailure = serializeBrowserError(error);
    }
  }

  const snapshot = () => ({
    consoleFailures: consoleFailures.map((signal) => ({ ...signal })),
    evaluatedSignals: evaluatedSignals.map((signal) => ({ ...signal })),
    evaluationFailure: evaluationFailure ? { ...evaluationFailure } : null,
    reportedSignals: apiServer.workerSignals.map((signal) => ({ ...signal })),
    workerUrl: worker.url(),
  });

  return {
    async assertClean(scenarioId) {
      await refresh();
      const diagnostics = snapshot();
      const signalCount =
        diagnostics.consoleFailures.length +
        diagnostics.evaluatedSignals.length +
        diagnostics.reportedSignals.length +
        Number(Boolean(diagnostics.evaluationFailure));
      assert.equal(
        signalCount,
        0,
        `extension MV3 worker emitted unexpected runtime signals during ${scenarioId}: ${JSON.stringify(
          diagnostics,
          null,
          2,
        )}`,
      );
      return diagnostics;
    },
    refresh,
    snapshot,
  };
}

function combineExtensionSignalCollectors(pageCollector, workerCollector) {
  return {
    async assertClean(scenarioId) {
      let pageFailure = null;
      let pageDiagnostics;
      try {
        pageDiagnostics = await pageCollector.assertClean(scenarioId);
      } catch (error) {
        pageFailure = error;
        pageDiagnostics = pageCollector.snapshot();
      }

      let workerFailure = null;
      let workerDiagnostics;
      try {
        workerDiagnostics = await workerCollector.assertClean(scenarioId);
      } catch (error) {
        workerFailure = error;
        workerDiagnostics = workerCollector.snapshot();
      }

      if (pageFailure || workerFailure) {
        throw new Error(
          `extension emitted unexpected runtime signals during ${scenarioId}: ${JSON.stringify(
            { page: pageDiagnostics, worker: workerDiagnostics },
            null,
            2,
          )}`,
          { cause: pageFailure ?? workerFailure },
        );
      }
      return { page: pageDiagnostics, worker: workerDiagnostics };
    },
    snapshot: () => ({ page: pageCollector.snapshot(), worker: workerCollector.snapshot() }),
  };
}

function assertLoopbackOrigin(value) {
  const url = new URL(value);
  assert.ok(["http:", "https:"].includes(url.protocol), "The hermetic API origin must use HTTP or HTTPS.");
  assert.ok(
    ["127.0.0.1", "::1", "[::1]", "localhost"].includes(url.hostname),
    `Refusing to prepare a hermetic extension artifact for non-loopback origin ${url.origin}.`,
  );
  assert.equal(url.pathname, "/", "The hermetic API value must be an origin without a path.");
  return url.origin;
}

function removeOwnedTemporaryDirectory(directory, prefix) {
  if (!directory) return;
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemporaryRoot = path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolvedDirectory), resolvedTemporaryRoot, "Refusing to remove a non-temporary directory.");
  assert.ok(path.basename(resolvedDirectory).startsWith(prefix), "Refusing to remove an unowned temporary directory.");
  fs.rmSync(resolvedDirectory, { force: true, recursive: true });
}

function readGeneratedMv3Contract(artifactDirectory) {
  const manifestPath = path.join(artifactDirectory, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.manifest_version, 3, "The extension browser suite requires a generated MV3 artifact.");
  assert.equal(
    manifest.background?.service_worker,
    "ryd.background.js",
    "The generated MV3 artifact must declare the built background service worker.",
  );
  const contentScript = manifest.content_scripts?.find(
    ({ css = [], js = [] }) => js.includes("ryd.content-script.js") && css.includes("content-style.css"),
  );
  assert.ok(contentScript, "The generated MV3 artifact must declare its built content script and stylesheet.");
  for (const asset of [manifest.background.service_worker, "ryd.content-script.js", "content-style.css"]) {
    assert.ok(
      fs.statSync(path.join(artifactDirectory, asset)).isFile(),
      `The generated MV3 artifact is missing declared asset ${asset}.`,
    );
  }
  for (const asset of new Set([manifest.background.service_worker, ...contentScript.js])) {
    assertProductionJavaScriptOutput(path.join(artifactDirectory, asset), asset);
  }
  return {
    serviceWorkerPath: `/${manifest.background.service_worker.replace(/^\/+/, "")}`,
    version: manifest.version,
  };
}

function prepareHermeticExtensionArtifact(sourceDirectory, apiOrigin) {
  const origin = assertLoopbackOrigin(apiOrigin);
  const source = path.resolve(sourceDirectory);
  for (const requiredFile of ["manifest.json", "menu-fixer.js", "ryd.background.js", "ryd.content-script.js"]) {
    if (!fs.existsSync(path.join(source, requiredFile))) {
      throw new Error(`The extension artifact is missing ${requiredFile}: ${source}`);
    }
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-mv3-e2e-"));
  const extensionDirectory = path.join(temporaryRoot, "extension");
  fs.cpSync(source, extensionDirectory, { recursive: true });

  const backgroundBundlePath = path.join(extensionDirectory, "ryd.background.js");
  const backgroundSource = fs.readFileSync(backgroundBundlePath, "utf8");
  const replacementCount = backgroundSource.split(PRODUCTION_API_ORIGIN).length - 1;
  if (replacementCount < 1) {
    removeOwnedTemporaryDirectory(temporaryRoot, "ryd-mv3-e2e-");
    throw new Error("ryd.background.js has no production API origin to replace; rebuild the extension before testing.");
  }
  const transformedBackground = backgroundSource.replaceAll(PRODUCTION_API_ORIGIN, origin);
  assert.equal(
    transformedBackground.includes(PRODUCTION_API_ORIGIN),
    false,
    "ryd.background.js still contains the production API origin after transformation.",
  );
  const changelogListener =
    /api\.runtime\.onInstalled\.addListener\(\(details\) => \{\r?\n  maybeShowChangelog\(details\);\r?\n\}\);/g;
  if ((transformedBackground.match(changelogListener) ?? []).length !== 1) {
    removeOwnedTemporaryDirectory(temporaryRoot, "ryd-mv3-e2e-");
    throw new Error("ryd.background.js must have exactly one recognized first-install changelog listener to suppress.");
  }
  const hermeticBackground = transformedBackground.replace(
    changelogListener,
    "api.runtime.onInstalled.addListener(() => {});",
  );
  const workerSignalEndpoint = `${origin}${WORKER_SIGNAL_PATH}`;
  fs.writeFileSync(backgroundBundlePath, `${createWorkerRuntimeProbe(workerSignalEndpoint)}\n${hermeticBackground}`);

  const contentScriptPath = path.join(extensionDirectory, "ryd.content-script.js");
  const contentScriptSource = fs.readFileSync(contentScriptPath, "utf8");
  if (!contentScriptSource.includes(PRODUCTION_API_ORIGIN)) {
    removeOwnedTemporaryDirectory(temporaryRoot, "ryd-mv3-e2e-");
    throw new Error("ryd.content-script.js has no production API origin for the pre-navigation route to intercept.");
  }

  const manifestPath = path.join(extensionDirectory, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const apiUrl = new URL(origin);
  const loopbackPermission = `${apiUrl.protocol}//${apiUrl.hostname}/*`;
  manifest.host_permissions = [...new Set([...(manifest.host_permissions ?? []), loopbackPermission])];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    extensionDirectory,
    loopbackPermission,
    replacements: { "ryd.background.js": replacementCount, firstInstallChangelogListener: 1 },
    routedBundles: ["ryd.content-script.js"],
    temporaryRoot,
    workerSignalEndpoint,
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
    request.on("error", reject);
  });
}

async function startHermeticApiServer({ dislikes = 25, likes = 100 } = {}) {
  const records = [];
  const unexpectedRequests = [];
  const workerSignals = [];
  const responsePlans = new Map();
  const responseKey = (method, pathname) => `${method.toUpperCase()} ${pathname}`;
  const enqueue = (method, pathname, plannedResponse) => {
    const key = responseKey(method, pathname);
    const queue = responsePlans.get(key) ?? [];
    queue.push(plannedResponse);
    responsePlans.set(key, queue);
  };
  const defer = (method, pathname) => {
    let releaseResponse;
    let resolveSeen;
    let released = false;
    const seen = new Promise((resolve) => {
      resolveSeen = resolve;
    });
    enqueue(method, pathname, (record) => {
      resolveSeen(record);
      return new Promise((resolve) => {
        releaseResponse = resolve;
      });
    });
    return {
      get released() {
        return released;
      },
      release(response) {
        if (released) return;
        if (!releaseResponse) {
          throw new Error(`Cannot release ${responseKey(method, pathname)} before its request is seen`);
        }
        released = true;
        releaseResponse(response);
      },
      seen,
    };
  };
  const requestsFor = (method, pathname) =>
    records.filter((record) => record.method === method.toUpperCase() && record.pathname === pathname);
  const takePlannedResponse = (record) => {
    const queue = responsePlans.get(responseKey(record.method, record.pathname));
    if (!queue?.length) return null;
    const planned = queue.shift();
    return typeof planned === "function" ? planned(record) : planned;
  };
  const server = http.createServer(async (request, response) => {
    const origin = `http://${request.headers.host}`;
    const url = new URL(request.url, origin);
    const record = {
      at: Date.now(),
      body: await readRequestBody(request),
      method: request.method,
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
    };
    records.push(record);

    const headers = {
      "access-control-allow-headers": "Accept, Content-Type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8",
    };
    if (request.method === "OPTIONS") {
      const requestedMethod = request.headers["access-control-request-method"];
      if (!isAllowedApiPreflight(url.pathname, requestedMethod)) {
        unexpectedRequests.push(record);
        record.respondedAt = Date.now();
        record.responseBody = { error: "unexpected hermetic preflight" };
        record.responseStatus = 404;
        response.writeHead(404, headers);
        response.end(JSON.stringify(record.responseBody));
        return;
      }
      record.respondedAt = Date.now();
      record.responseBody = null;
      record.responseStatus = 204;
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === WORKER_SIGNAL_PATH) {
      workerSignals.push(record.body);
      record.respondedAt = Date.now();
      record.responseBody = null;
      record.responseStatus = 204;
      response.writeHead(204, headers);
      response.end();
      return;
    }
    let defaultBody;
    if (request.method === "GET" && url.pathname === "/configs/selectors") defaultBody = {};
    else if (request.method === "GET" && url.pathname === "/votes") {
      defaultBody = { dislikes, likes, rating: 4.5 };
    } else if (request.method === "GET" && url.pathname === "/puzzle/registration") {
      defaultBody = ZERO_DIFFICULTY_PUZZLE;
    } else if (request.method === "POST" && url.pathname === "/puzzle/registration") defaultBody = true;
    else if (request.method === "POST" && url.pathname === "/interact/vote") defaultBody = ZERO_DIFFICULTY_PUZZLE;
    else if (request.method === "POST" && url.pathname === "/interact/confirmVote") defaultBody = true;
    else {
      unexpectedRequests.push(record);
      record.respondedAt = Date.now();
      record.responseBody = { error: "unexpected hermetic request" };
      record.responseStatus = 404;
      response.writeHead(404, headers);
      response.end(JSON.stringify(record.responseBody));
      return;
    }

    const planned = takePlannedResponse(record);
    const resolvedPlan = planned ? await planned : planned;
    const responsePlan = resolvedPlan ?? { body: defaultBody };
    if (responsePlan.delayMs) await delay(responsePlan.delayMs);
    const body = responsePlan.body === undefined ? defaultBody : responsePlan.body;
    const status = responsePlan.status ?? 200;
    record.respondedAt = Date.now();
    record.responseBody = body;
    record.responseStatus = status;
    response.writeHead(status, { ...headers, ...(responsePlan.headers ?? {}) });
    response.end(typeof body === "string" ? body : JSON.stringify(body));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    defer,
    enqueue,
    origin: `http://127.0.0.1:${address.port}`,
    records,
    requestsFor,
    unexpectedRequests,
    workerSignals,
  };
}

async function installArtifactRoutes(context, backend, { passthroughOrigin = null } = {}) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "chrome-extension:") {
      await route.continue();
      return;
    }
    if (passthroughOrigin && url.origin === passthroughOrigin) {
      await route.continue();
      return;
    }
    await backend.handle(route);
  });
}

async function waitForWatchResult(page, runtime, videoId) {
  const profile = LIVE_RUNTIME_PROFILES[runtime];
  const dislikeTextSelector = [
    "dislike-button-view-model #text",
    "dislike-button-view-model [role='text']",
    "dislike-button-view-model .yt-spec-button-shape-next__button-text-content",
    "dislike-button-view-model .ytSpecButtonShapeNextButtonTextContent",
  ].join(", ");
  await page.waitForFunction(
    ({ dislikeTextSelector: expectedDislikeTextSelector, rateBarContainer, videoId: expectedVideoId }) => {
      const rendered = (element) => {
        if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity) !== 0
        );
      };
      const watch = document.querySelector(
        `ytd-watch-flexy[video-id="${expectedVideoId}"], ytd-watch-grid[video-id="${expectedVideoId}"]`,
      );
      const actionSurface = watch
        ? [...watch.querySelectorAll("#top-level-buttons-computed")].find(
            (candidate) => rendered(candidate) && rendered(candidate.querySelector(rateBarContainer)),
          )
        : null;
      const dislikeText = actionSurface?.querySelector(expectedDislikeTextSelector) ?? null;
      const count = (dislikeText?.textContent ?? "").replace(/\s+/g, " ").trim();
      return Boolean(actionSurface && rendered(dislikeText) && /\d/.test(count));
    },
    { dislikeTextSelector, rateBarContainer: profile.selectors.rateBarContainer, videoId },
  );

  return page.evaluate(
    ({ dislikeTextSelector: expectedDislikeTextSelector, rateBar, rateBarContainer, videoId: expectedVideoId }) => {
      const rendered = (element) => {
        if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity) !== 0
        );
      };
      const watch = document.querySelector(
        `ytd-watch-flexy[video-id="${expectedVideoId}"], ytd-watch-grid[video-id="${expectedVideoId}"]`,
      );
      const actionSurface = watch
        ? [...watch.querySelectorAll("#top-level-buttons-computed")].find(
            (candidate) => rendered(candidate) && rendered(candidate.querySelector(rateBarContainer)),
          )
        : null;
      const dislikeText = actionSurface?.querySelector(expectedDislikeTextSelector) ?? null;
      const container = actionSurface?.querySelector(rateBarContainer);
      const fill = actionSurface?.querySelector(rateBar);
      const visible = (element) => {
        const box = element?.getBoundingClientRect();
        return Boolean(box && box.width > 0 && box.height > 0);
      };
      return {
        actionSurfaceVisible: rendered(actionSurface),
        count: (dislikeText?.textContent ?? "").replace(/\s+/g, " ").trim(),
        countVisible: rendered(dislikeText),
        fillRatio:
          container && fill && container.getBoundingClientRect().width > 0
            ? fill.getBoundingClientRect().width / container.getBoundingClientRect().width
            : null,
        fillVisible: visible(fill),
        ownedByExpectedWatch: Boolean(
          actionSurface && actionSurface.closest("ytd-watch-flexy, ytd-watch-grid") === watch,
        ),
        rateBarVisible: visible(container),
        sameActionSurface: Boolean(
          actionSurface &&
            dislikeText?.closest("#top-level-buttons-computed") === actionSurface &&
            container?.closest("#top-level-buttons-computed") === actionSurface,
        ),
        videoId: watch?.getAttribute("video-id") ?? null,
        expectedVideoId,
      };
    },
    { ...profile.selectors, dislikeTextSelector, videoId },
  );
}

async function prepareSpaOutgoingControls(page, fromVideoId) {
  return page.evaluate((expectedVideoId) => {
    const fixturePage = document.querySelector("#fixture-page");
    const currentSection = fixturePage?.querySelector(
      `[data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"]`,
    );
    const outgoingTopRow = currentSection?.querySelector("#top-row");
    if (!fixturePage || !currentSection || !outgoingTopRow) {
      throw new Error(`The outgoing watch fixture for ${expectedVideoId} is not ready.`);
    }
    if (!outgoingTopRow.querySelector(".ryd-tooltip")) {
      throw new Error(`The outgoing watch fixture for ${expectedVideoId} has no initialized ratio bar.`);
    }

    const beforeHolder = document.createElement("div");
    beforeHolder.hidden = true;
    beforeHolder.setAttribute("data-artifact-outgoing-position", "before-current-root");
    beforeHolder.setAttribute("data-artifact-outgoing-video-id", expectedVideoId);
    beforeHolder.appendChild(outgoingTopRow.cloneNode(true));
    fixturePage.before(beforeHolder);

    globalThis.__artifactInsideOutgoingActions = outgoingTopRow.cloneNode(true);
    return {
      beforeBarCount: beforeHolder.querySelectorAll(".ryd-tooltip").length,
      fromVideoId: expectedVideoId,
    };
  }, fromVideoId);
}

async function preparePendingSpaOutgoingControls(page, fromVideoId) {
  return page.evaluate((expectedVideoId) => {
    const fixturePage = document.querySelector("#fixture-page");
    const currentSection = fixturePage?.querySelector(
      `[data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"]`,
    );
    const outgoingTopRow = currentSection?.querySelector("#top-row");
    if (!fixturePage || !currentSection || !outgoingTopRow) {
      throw new Error(`The pending outgoing watch fixture for ${expectedVideoId} is not ready.`);
    }

    const beforeHolder = document.createElement("div");
    beforeHolder.hidden = true;
    beforeHolder.setAttribute("data-artifact-outgoing-position", "before-current-root");
    beforeHolder.setAttribute("data-artifact-outgoing-video-id", expectedVideoId);
    beforeHolder.appendChild(outgoingTopRow.cloneNode(true));
    fixturePage.before(beforeHolder);

    globalThis.__artifactInsideOutgoingActions = outgoingTopRow.cloneNode(true);
    return {
      beforeBarCount: beforeHolder.querySelectorAll(".ryd-tooltip").length,
      fromVideoId: expectedVideoId,
    };
  }, fromVideoId);
}

function replaceSpaDestinationInPage({ expectedLikes, expectedVideoId, nativeHydrationDelay, beforeNavigation }) {
  const replace = () => {
    const currentSection = document.querySelector(
      `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"]`,
    );
    if (!currentSection) throw new Error(`The destination watch fixture for ${expectedVideoId} is missing.`);
    if (!globalThis.__artifactInsideOutgoingActions) {
      throw new Error("The retained inside-current-root outgoing controls are missing.");
    }

    const insideHolder = document.createElement("div");
    insideHolder.hidden = true;
    insideHolder.setAttribute("data-artifact-outgoing-position", "inside-current-root");
    insideHolder.setAttribute(
      "data-artifact-outgoing-video-id",
      globalThis.__artifactInsideOutgoingActions
        .querySelector("[data-fixture-control-video-id]")
        ?.getAttribute("data-fixture-control-video-id") ?? "unknown",
    );
    insideHolder.appendChild(globalThis.__artifactInsideOutgoingActions);
    const watchRoot = currentSection.querySelector(
      `ytd-watch-flexy[video-id="${expectedVideoId}"], ytd-watch-grid[video-id="${expectedVideoId}"]`,
    );
    if (!watchRoot) throw new Error(`The destination Watch root for ${expectedVideoId} is missing.`);
    watchRoot.appendChild(insideHolder);
    delete globalThis.__artifactInsideOutgoingActions;

    const currentActions = watchRoot.querySelector(":scope > #top-row #top-level-buttons-computed");
    const currentLikeButton = currentActions?.querySelector('[data-fixture-role="like"] button');
    if (!currentLikeButton) throw new Error(`The destination controls for ${expectedVideoId} have no Like button.`);
    currentLikeButton.setAttribute("aria-label", `${expectedLikes} likes`);
    const currentLikeText = currentLikeButton.querySelector("#text, [role='text']");
    if (currentLikeText) currentLikeText.textContent = String(expectedLikes);

    const nativeHydrationStartedAt = Date.now();
    const replaced = globalThis.__navigationFixture.replaceCurrentWatchActions({
      nativeHydrationDelay,
      retainOutgoing: true,
    });
    if (!replaced) throw new Error(`The destination action container for ${expectedVideoId} was not replaced.`);
    const destinationActions = currentSection.querySelector(
      `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${expectedVideoId}"]`,
    );
    const likeButton = destinationActions?.querySelector('[data-fixture-role="like"] button');
    if (nativeHydrationDelay === 0 && !likeButton) {
      throw new Error(`The replacement controls for ${expectedVideoId} have no Like button.`);
    }
    return {
      destinationReplaced: true,
      insideBarCount: insideHolder.querySelectorAll(".ryd-tooltip").length,
      nativeHydrationDelay,
      nativeHydrationStartedAt,
    };
  };
  if (!beforeNavigation) return replace();
  delete globalThis.__artifactPreparedDestinationReplacement;
  document.addEventListener(
    "yt-navigate-finish",
    () => {
      // Capture runs before the extension's navigation listeners, so they never
      // see hydrated destination controls that the fixture removes afterwards.
      globalThis.__artifactPreparedDestinationReplacement = replace();
    },
    { capture: true, once: true },
  );
}

async function finishSpaDestinationReplacement(
  page,
  toVideoId,
  { nativeHydrationDelay = 0, beforeNavigation = false } = {},
) {
  return page.evaluate(replaceSpaDestinationInPage, {
    expectedLikes: SPA_COUNTS[toVideoId].likes,
    expectedVideoId: toVideoId,
    nativeHydrationDelay,
    beforeNavigation,
  });
}

async function observeSpaDestinationDislikeText(page, videoId) {
  await page.waitForFunction((expectedVideoId) => {
    const currentRoot = document.querySelector(
      `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"]`,
    );
    return Boolean(
      currentRoot?.querySelector(
        `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${expectedVideoId}"] ` +
          `[data-fixture-control-video-id="${expectedVideoId}"] [data-fixture-role="dislike"]`,
      ),
    );
  }, videoId);
  await page.evaluate((expectedVideoId) => {
    globalThis.__artifactDestinationDislikeTextObserver?.disconnect();
    const currentRoot = document.querySelector(
      `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"]`,
    );
    const dislike = currentRoot?.querySelector(
      `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${expectedVideoId}"] ` +
        `[data-fixture-control-video-id="${expectedVideoId}"] [data-fixture-role="dislike"]`,
    );
    if (!dislike) throw new Error(`The destination Dislike control for ${expectedVideoId} is missing.`);
    const read = () => (dislike.querySelector("#text, [role='text']")?.textContent ?? "").replace(/\s+/g, " ").trim();
    globalThis.__artifactDestinationDislikeTexts = [read()];
    globalThis.__artifactDestinationDislikeTextObserver = new MutationObserver(() => {
      globalThis.__artifactDestinationDislikeTexts.push(read());
    });
    globalThis.__artifactDestinationDislikeTextObserver.observe(dislike, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, videoId);
}

async function readSpaWatchSnapshot(page, runtime, fromVideoId, toVideoId) {
  const profile = LIVE_RUNTIME_PROFILES[runtime];
  return page.evaluate(
    ({ fromVideoId: outgoingVideoId, profile: runtimeProfile, toVideoId: destinationVideoId }) => {
      const normalizedText = (element) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
      const visibleBox = (element) => {
        const box = element?.getBoundingClientRect();
        return box && box.width > 0 && box.height > 0
          ? { height: box.height, width: box.width, x: box.x, y: box.y }
          : null;
      };
      const retainedState = (selector) => {
        const holder = document.querySelector(selector);
        return {
          barCount: holder?.querySelectorAll(runtimeProfile.selectors.rateBar).length ?? -1,
          containerCount: holder?.querySelectorAll(runtimeProfile.selectors.rateBarContainer).length ?? -1,
          controlVideoIds: [...(holder?.querySelectorAll("[data-fixture-control-video-id]") ?? [])].map((control) =>
            control.getAttribute("data-fixture-control-video-id"),
          ),
          hidden: holder?.hidden === true,
          present: holder !== null,
          wrapperCount: holder?.querySelectorAll(".ryd-tooltip").length ?? -1,
        };
      };

      const currentRoot = document.querySelector(
        `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${destinationVideoId}"]`,
      );
      const actionHost = currentRoot?.querySelector(
        `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${destinationVideoId}"]`,
      );
      const controls = actionHost?.querySelector(`[data-fixture-control-video-id="${destinationVideoId}"]`);
      const countElement = controls?.querySelector(
        '[data-fixture-role="dislike"] #text, [data-fixture-role="dislike"] [role="text"]',
      );
      const wrapper = actionHost?.querySelector(":scope > .ryd-tooltip");
      const container = wrapper?.querySelector(runtimeProfile.selectors.rateBarContainer);
      const fill = container?.querySelector(runtimeProfile.selectors.rateBar);
      const tooltip = wrapper?.querySelector(runtimeProfile.selectors.tooltipContent);
      const containerBox = visibleBox(container);
      const fillBox = visibleBox(fill);
      const currentVideoId = currentRoot?.querySelector("ytd-watch-flexy")?.getAttribute("video-id") ?? null;
      const url = new URL(location.href);

      return {
        actionHostCount:
          currentRoot?.querySelectorAll(
            `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${destinationVideoId}"]`,
          ).length ?? 0,
        barOwnedByDestination: Boolean(fill && fill.closest("#top-level-buttons-computed") === actionHost),
        containerOwnedByDestination: Boolean(
          container && container.closest("#top-level-buttons-computed") === actionHost,
        ),
        count: normalizedText(countElement),
        currentVideoId,
        destinationBarCount: actionHost?.querySelectorAll(runtimeProfile.selectors.rateBar).length ?? 0,
        destinationContainerCount: actionHost?.querySelectorAll(runtimeProfile.selectors.rateBarContainer).length ?? 0,
        destinationControlCount:
          actionHost?.querySelectorAll(`[data-fixture-control-video-id="${destinationVideoId}"]`).length ?? 0,
        destinationWrapperCount: actionHost?.querySelectorAll(":scope > .ryd-tooltip").length ?? 0,
        fillRatio: containerBox && fillBox ? fillBox.width / containerBox.width : null,
        globalBarCount: document.querySelectorAll(runtimeProfile.selectors.rateBar).length,
        globalContainerCount: document.querySelectorAll(runtimeProfile.selectors.rateBarContainer).length,
        globalWrapperCount: document.querySelectorAll(".ryd-tooltip").length,
        insideOutgoing: retainedState(
          `[data-artifact-outgoing-position="inside-current-root"][data-artifact-outgoing-video-id="${outgoingVideoId}"]`,
        ),
        retainedDestination: retainedState(`[data-fixture-retained-settling-watch-actions="${destinationVideoId}"]`),
        retainedBefore: retainedState(
          `[data-artifact-outgoing-position="before-current-root"][data-artifact-outgoing-video-id="${outgoingVideoId}"]`,
        ),
        tooltipText: normalizedText(tooltip),
        urlVideoId: url.pathname === "/watch" ? url.searchParams.get("v") : null,
        visibleContainer: containerBox !== null,
        visibleFill: fillBox !== null,
      };
    },
    { fromVideoId, profile, toVideoId },
  );
}

function isSpaDestinationValid(snapshot, { expectedCount, expectedRatio, fromVideoId, toVideoId }) {
  const outgoingRetained = [snapshot.retainedBefore, snapshot.insideOutgoing];
  const hasNoRydBar = (state) =>
    state.present === true &&
    state.hidden === true &&
    state.wrapperCount === 0 &&
    state.containerCount === 0 &&
    state.barCount === 0;
  return (
    snapshot.urlVideoId === toVideoId &&
    snapshot.currentVideoId === toVideoId &&
    snapshot.actionHostCount === 1 &&
    snapshot.destinationControlCount === 1 &&
    snapshot.destinationWrapperCount === 1 &&
    snapshot.destinationContainerCount === 1 &&
    snapshot.destinationBarCount === 1 &&
    snapshot.globalWrapperCount === 1 &&
    snapshot.globalContainerCount === 1 &&
    snapshot.globalBarCount === 1 &&
    snapshot.barOwnedByDestination === true &&
    snapshot.containerOwnedByDestination === true &&
    snapshot.visibleContainer === true &&
    snapshot.visibleFill === true &&
    snapshot.count === String(expectedCount) &&
    snapshot.tooltipText.includes(`${SPA_COUNTS[toVideoId].likes} / ${expectedCount}`) &&
    Number.isFinite(snapshot.fillRatio) &&
    Math.abs(snapshot.fillRatio - expectedRatio) <= 0.02 &&
    outgoingRetained.every((state) => hasNoRydBar(state) && state.controlVideoIds.includes(fromVideoId)) &&
    hasNoRydBar(snapshot.retainedDestination) &&
    snapshot.retainedDestination.controlVideoIds.includes(toVideoId)
  );
}

async function clickSpaDestinationDislike(page, videoId) {
  const selector =
    `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${videoId}"] ` +
    `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${videoId}"] ` +
    `[data-fixture-control-video-id="${videoId}"] [data-fixture-role="dislike"] button`;
  const buttons = page.locator(selector);
  assert.equal(await buttons.count(), 1, `Expected exactly one destination Dislike activation target for ${videoId}.`);
  const button = buttons.first();
  assert.equal(
    await button.isVisible(),
    true,
    `The destination Dislike activation target for ${videoId} is not visible.`,
  );
  const ariaPressedBefore = await button.getAttribute("aria-pressed");
  await button.click();
  return { ariaPressedBefore, selector, videoId };
}

async function cloneRenderedSpaControlsAndActivateDislike(page, videoId) {
  return page.evaluate((expectedVideoId) => {
    const actionHost = document.querySelector(
      `#fixture-page [data-fixture-page-kind="watch"][data-fixture-video-id="${expectedVideoId}"] ` +
        `#top-level-buttons-computed[data-fixture-watch-actions-replacement="${expectedVideoId}"]`,
    );
    if (!actionHost) throw new Error(`The rendered destination action host for ${expectedVideoId} is missing.`);

    const barSelector = "#ryd-bar, #return-youtube-dislike-bar";
    const countSelector = '[data-fixture-role="dislike"] #text, [data-fixture-role="dislike"] [role="text"]';
    const visible = (element) => {
      if (!element?.isConnected) return false;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity) !== 0
      );
    };
    const countBefore = actionHost.querySelector(countSelector)?.textContent?.trim() ?? null;
    const barBefore = actionHost.querySelector(barSelector);
    const buttonBefore = actionHost.querySelector('[data-fixture-role="dislike"] button');
    if (!visible(actionHost) || !visible(countBefore === null ? null : actionHost.querySelector(countSelector))) {
      throw new Error(`The destination count for ${expectedVideoId} is not visibly rendered before cloning.`);
    }
    if (!visible(barBefore) || !visible(buttonBefore)) {
      throw new Error(
        `The destination button and rate bar for ${expectedVideoId} are not visibly rendered before cloning.`,
      );
    }

    const replacement = actionHost.cloneNode(true);
    replacement.setAttribute("data-artifact-cloned-rendered-actions", "true");
    actionHost.replaceWith(replacement);
    const activationTarget = replacement.querySelector('[data-fixture-role="dislike"] button');
    const count = replacement.querySelector(countSelector);
    const bar = replacement.querySelector(barSelector);
    if (!visible(replacement) || !visible(activationTarget) || !visible(count) || !visible(bar)) {
      throw new Error(`The cloned destination presentation for ${expectedVideoId} is not visibly complete.`);
    }

    const ariaPressedBefore = activationTarget.getAttribute("aria-pressed");
    let clickObservedAtDocument = false;
    document.addEventListener(
      "click",
      (event) => {
        clickObservedAtDocument = event.composedPath().includes(activationTarget);
      },
      { capture: true, once: true },
    );
    activationTarget.click();
    return {
      ariaDisabled: activationTarget.getAttribute("aria-disabled"),
      ariaPressedAfterSynchronousClick: activationTarget.getAttribute("aria-pressed"),
      ariaPressedBefore,
      barCount: replacement.querySelectorAll(barSelector).length,
      buttonDisabled: activationTarget.disabled,
      clickObservedAtDocument,
      countAfterSynchronousClick: count.textContent?.trim() ?? null,
      countBefore,
      countContainerCount: replacement.querySelectorAll(countSelector).length,
      presentationCloned: replacement !== actionHost && !actionHost.isConnected,
      videoId: expectedVideoId,
    };
  }, videoId);
}

function interactionRecordsSince(records, startIndex) {
  return records
    .slice(startIndex)
    .filter(
      (record) => record.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
    );
}

function readArtifactVoteHandshake(records, startIndex, videoId, value) {
  const interactions = interactionRecordsSince(records, startIndex);
  const votes = interactions.filter((record) => record.pathname === "/interact/vote");
  const confirmations = interactions.filter((record) => record.pathname === "/interact/confirmVote");
  const vote = votes[0] ?? null;
  const confirmation = confirmations[0] ?? null;
  const userId = vote?.body?.userId ?? null;
  return {
    confirmation: confirmation
      ? {
          body: confirmation.body,
          responded: Number.isFinite(confirmation.respondedAt),
          responseBody: confirmation.responseBody,
          responseStatus: confirmation.responseStatus,
        }
      : null,
    confirmationCount: confirmations.length,
    expectedValue: value,
    expectedVideoId: videoId,
    interactionPaths: interactions.map((record) => record.pathname),
    interactionCount: interactions.length,
    sharedUserId:
      typeof userId === "string" && userId.length > 0 && confirmation?.body?.userId === userId ? userId : null,
    vote: vote
      ? {
          body: vote.body,
          responded: Number.isFinite(vote.respondedAt),
          responseBody: vote.responseBody,
          responseStatus: vote.responseStatus,
        }
      : null,
    voteCount: votes.length,
  };
}

function enqueueRecordedSuccessfulVoteResponses(backend) {
  backend.enqueue("POST", "/interact/vote", (record) => {
    record.responseBody = ZERO_DIFFICULTY_PUZZLE;
    record.responseStatus = 200;
    return { body: record.responseBody };
  });
  backend.enqueue("POST", "/interact/confirmVote", (record) => {
    record.responseBody = true;
    record.responseStatus = 200;
    return { body: record.responseBody };
  });
}

function isArtifactVoteHandshakeValid(snapshot) {
  const isSuccessfulStatus = (status) => Number.isInteger(status) && status >= 200 && status < 300;
  if (
    snapshot.interactionCount !== 2 ||
    snapshot.voteCount !== 1 ||
    snapshot.confirmationCount !== 1 ||
    typeof snapshot.sharedUserId !== "string" ||
    !/^[A-Za-z0-9]{36}$/.test(snapshot.sharedUserId) ||
    snapshot.interactionPaths?.join(",") !== "/interact/vote,/interact/confirmVote" ||
    snapshot.vote?.responded !== true ||
    !isSuccessfulStatus(snapshot.vote?.responseStatus) ||
    snapshot.confirmation?.responded !== true ||
    !isSuccessfulStatus(snapshot.confirmation?.responseStatus) ||
    snapshot.confirmation?.responseBody !== true
  ) {
    return false;
  }
  return isVoteProtocolBodyPairValid(snapshot.vote?.body, snapshot.confirmation?.body, {
    value: snapshot.expectedValue,
    videoId: snapshot.expectedVideoId,
  });
}

function assertSpaStatsTraffic(backend, fromVideoId, toVideoId) {
  const votes = assertExactSuccessfulVotesTraffic(
    backend.requests,
    [fromVideoId, toVideoId],
    "The shared artifact SPA contract",
  );
  assert.deepEqual(
    backend.blockedRequests,
    [],
    `The SPA scenario attempted unexpected network traffic: ${JSON.stringify(backend.blockedRequests)}`,
  );
  return {
    fromVideoRequests: votes.filter((request) => request.query.videoId === fromVideoId).length,
    toVideoRequests: votes.filter((request) => request.query.videoId === toVideoId).length,
  };
}

function assertSpaBackendTraffic(backend, fromVideoId, toVideoId) {
  const stats = assertSpaStatsTraffic(backend, fromVideoId, toVideoId);
  assert.equal(backend.requestsFor("POST", "/interact/vote").length, 0, "The read-only SPA scenario submitted a vote.");
  assert.equal(
    backend.requestsFor("POST", "/interact/confirmVote").length,
    0,
    "The read-only SPA scenario confirmed a vote.",
  );
  return {
    ...stats,
    interactionRequests: 0,
  };
}

function readSpaTraffic(backend) {
  return backend.requests.map(({ method, pathname, query }) => ({ method, pathname, query }));
}

async function readWatchDiagnostics(page, runtime, videoId) {
  const profile = LIVE_RUNTIME_PROFILES[runtime];
  return page.evaluate(
    ({ rateBar, rateBarContainer, videoId: expectedVideoId }) => ({
      bodyText: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
      currentVideoId: document.querySelector("ytd-watch-flexy")?.getAttribute("video-id") ?? null,
      dislikeText:
        document
          .querySelector("dislike-button-view-model #text, dislike-button-view-model [role='text']")
          ?.textContent?.trim() ?? null,
      expectedVideoId,
      fillPresent: document.querySelector(rateBar) !== null,
      rateBarPresent: document.querySelector(rateBarContainer) !== null,
      setStateCalls: globalThis.__rydSetStateCalls ?? 0,
    }),
    { ...profile.selectors, videoId },
  );
}

class HermeticUserscriptArtifactAdapter {
  constructor({
    artifactPath = DEFAULT_USERSCRIPT_ARTIFACT,
    backendOptions = {},
    browserType = chromium,
    disableVoteSubmission = false,
    headless = true,
  } = {}) {
    this.artifactPath = path.resolve(artifactPath);
    this.backendOptions = createSharedArtifactBackendOptions(backendOptions);
    this.browserType = browserType;
    this.disableVoteSubmission = disableVoteSubmission;
    this.headless = headless;
    this.profile = LIVE_RUNTIME_PROFILES.userscript;
    this.runtime = "userscript";
  }

  async start() {
    if (!fs.existsSync(this.artifactPath)) throw new Error(`Generated userscript is missing: ${this.artifactPath}`);
    this.backend = createFakeBackend(this.backendOptions);
    this.browser = await this.browserType.launch({ headless: this.headless });
    this.context = await this.browser.newContext({ serviceWorkers: "block" });
    await installGmEnvironment(this.context);
    await installArtifactRoutes(this.context, this.backend);
    this.page = await this.context.newPage();
    this.pageSignals = await createPageSignalCollector(this.page, this.runtime);
  }

  async openWatch(videoId) {
    await openWatchFixture(this.page, videoId);
    await injectGeneratedUserscript(this.page, {
      artifactPath: this.artifactPath,
      disableVoteSubmission: this.disableVoteSubmission,
    });
  }

  async openSpaWatch(videoId) {
    await openNavigationFixture(this.page, { pageKind: "watch", videoId });
    await injectGeneratedUserscript(this.page, {
      artifactPath: this.artifactPath,
      disableVoteSubmission: this.disableVoteSubmission,
    });
  }

  async navigateSpaWatch(fromVideoId, toVideoId) {
    const outgoing = await prepareSpaOutgoingControls(this.page, fromVideoId);
    await this.page.locator("#watch-related").click();
    const destination = await finishSpaDestinationReplacement(this.page, toVideoId);
    return { destination, outgoing };
  }

  deferNextStatsRequest() {
    return this.backend.defer("GET", "/votes");
  }

  async navigateSpaWatchWhilePending(fromVideoId, toVideoId) {
    const outgoing = await preparePendingSpaOutgoingControls(this.page, fromVideoId);
    await this.page.locator("#watch-related").click();
    const destination = await finishSpaDestinationReplacement(this.page, toVideoId);
    await observeSpaDestinationDislikeText(this.page, toVideoId);
    return { destination, outgoing };
  }

  async readDestinationDislikeTextHistory() {
    return this.page.evaluate(() => [...(globalThis.__artifactDestinationDislikeTexts ?? [])]);
  }

  deferInteractionResponse(pathname) {
    return this.backend.defer("POST", pathname);
  }

  enqueueInteractionResponse(pathname, response) {
    this.backend.enqueue("POST", pathname, response);
  }

  async setVoteSubmissionDisabled(disabled) {
    this.disableVoteSubmission = disabled === true;
  }

  readInteractionRecords() {
    return this.backend.requests;
  }

  readStatsRequestTimings() {
    return this.backend.requestsFor("GET", "/votes").map(({ at, query, respondedAt }) => ({
      at,
      query: { ...query },
      respondedAt,
    }));
  }

  async activateSpaDislike(videoId) {
    const interactionStartIndex = this.backend.requests.length;
    const activation = await clickSpaDestinationDislike(this.page, videoId);
    return { ...activation, interactionStartIndex };
  }

  async activateClonedSpaDislike(videoId) {
    const interactionStartIndex = this.backend.requests.length;
    const activation = await cloneRenderedSpaControlsAndActivateDislike(this.page, videoId);
    return { ...activation, interactionStartIndex };
  }

  async readSpaVoteHandshake(interactionStartIndex, videoId, value) {
    return readArtifactVoteHandshake(this.backend.requests, interactionStartIndex, videoId, value);
  }

  async assertSpaVoteNetwork(fromVideoId, toVideoId, interactionStartIndex) {
    const stats = assertSpaStatsTraffic(this.backend, fromVideoId, toVideoId);
    const requestsAfterActivation = this.backend.requests.slice(interactionStartIndex);
    assert.ok(
      requestsAfterActivation.every(
        (record) => record.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
      ),
      `The userscript made unexpected requests after activation: ${JSON.stringify(
        readSpaTraffic({
          requests: requestsAfterActivation,
        }),
      )}`,
    );
    return stats;
  }

  async readSpaWatchSnapshot(fromVideoId, toVideoId) {
    return readSpaWatchSnapshot(this.page, this.runtime, fromVideoId, toVideoId);
  }

  async assertSpaNetwork(fromVideoId, toVideoId) {
    return assertSpaBackendTraffic(this.backend, fromVideoId, toVideoId);
  }

  async readSpaTraffic() {
    return { routedRequests: readSpaTraffic(this.backend) };
  }

  async waitForWatchResult(videoId) {
    let result;
    try {
      result = await waitForWatchResult(this.page, this.runtime, videoId);
    } catch (error) {
      const diagnostics = {
        page: await readWatchDiagnostics(this.page, this.runtime, videoId),
        pageSignals: this.pageSignals.snapshot(),
        productionOriginRequests: this.backend.requests,
      };
      throw new Error(`${error.message}\nUserscript artifact diagnostics: ${JSON.stringify(diagnostics, null, 2)}`, {
        cause: error,
      });
    }
    assert.equal(this.backend.blockedRequests.length, 0, "The userscript attempted unexpected network traffic.");
    return result;
  }

  async assertNoPageSignals(scenarioId) {
    return this.pageSignals.assertClean(scenarioId);
  }

  async close() {
    await this.context?.close();
    await this.browser?.close();
  }
}

class HermeticExtensionArtifactAdapter {
  constructor({
    apiServer,
    artifactDirectory = DEFAULT_EXTENSION_ARTIFACT,
    backendOptions = {},
    browserType = chromium,
    channel = "chromium",
    contextOptions = {},
    headless = true,
    selectorResponse = { body: { rateBar: { oldDesignActions: ["#top-level-buttons-computed"] } } },
  } = {}) {
    if (!apiServer?.origin) throw new TypeError("The extension adapter requires a running hermetic API server.");
    this.apiServer = apiServer;
    this.artifactDirectory = path.resolve(artifactDirectory);
    this.backendOptions = createSharedArtifactBackendOptions(backendOptions);
    this.browserType = browserType;
    this.channel = channel;
    this.contextOptions = contextOptions;
    this.headless = headless;
    this.selectorResponse = selectorResponse;
    this.profile = LIVE_RUNTIME_PROFILES.extension;
    this.runtime = "extension";
  }

  async start() {
    this.artifactContract = readGeneratedMv3Contract(this.artifactDirectory);
    this.backend = createFakeBackend(this.backendOptions);
    if (this.selectorResponse !== null) {
      this.backend.enqueue("GET", "/configs/selectors", this.selectorResponse);
    }
    this.apiRecordStart = this.apiServer.records.length;
    this.preparedArtifact = prepareHermeticExtensionArtifact(this.artifactDirectory, this.apiServer.origin);
    this.profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-mv3-profile-"));
    const extensionPath = this.preparedArtifact.extensionDirectory;
    this.context = await this.browserType.launchPersistentContext(this.profileDirectory, {
      ...this.contextOptions,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
        "--no-first-run",
      ],
      channel: this.channel,
      headless: this.headless,
      serviceWorkers: "allow",
    });
    await installArtifactRoutes(this.context, this.backend, { passthroughOrigin: this.apiServer.origin });

    const isArtifactWorker = (worker) => new URL(worker.url()).pathname === this.artifactContract.serviceWorkerPath;
    this.worker = this.context.serviceWorkers().find(isArtifactWorker);
    if (!this.worker) {
      this.worker = await this.context.waitForEvent("serviceworker", {
        predicate: isArtifactWorker,
        timeout: 15_000,
      });
    }
    const workerUrl = new URL(this.worker.url());
    assert.equal(workerUrl.protocol, "chrome-extension:", "The real MV3 background worker did not start.");
    assert.match(workerUrl.hostname, /^[a-p]{32}$/, "The MV3 worker has no valid generated extension ID.");
    assert.equal(
      workerUrl.pathname,
      this.artifactContract.serviceWorkerPath,
      "Chromium started a different extension worker than the generated artifact declares.",
    );
    this.extensionId = workerUrl.hostname;
    this.workerSignals = createWorkerSignalCollector(this.worker, this.apiServer);
    this.page = await this.context.newPage();
    const pageSignals = await createPageSignalCollector(this.page, this.runtime);
    this.pageSignals = combineExtensionSignalCollectors(pageSignals, this.workerSignals);
  }

  async openWatch(videoId) {
    await openWatchFixture(this.page, videoId);
  }

  async setPremiumTeaserHidden(hidden) {
    const stored = await this.worker.evaluate(async (value) => {
      // Wait for the background's initial default write before applying the
      // scenario preference; otherwise its pending write can replace our value.
      await new Promise((resolve, reject) => {
        const finish = (error) => {
          clearTimeout(timeout);
          chrome.storage.onChanged.removeListener(changed);
          if (error) reject(error);
          else resolve();
        };
        const changed = (changes, area) => {
          if (area === "sync" && changes.hidePremiumTeaser?.newValue !== undefined) finish();
        };
        const timeout = setTimeout(
          () => finish(new Error("The extension did not initialize hidePremiumTeaser.")),
          2_000,
        );
        chrome.storage.onChanged.addListener(changed);
        chrome.storage.sync.get(["hidePremiumTeaser"]).then((state) => {
          if (state.hidePremiumTeaser !== undefined) finish();
        }, finish);
      });
      await chrome.storage.sync.set({ hidePremiumTeaser: value });
      return (await chrome.storage.sync.get(["hidePremiumTeaser"])).hidePremiumTeaser;
    }, hidden === true);
    assert.equal(stored, hidden === true, "The premium teaser preference was not stored.");
  }

  async openSpaWatch(videoId) {
    await openNavigationFixture(this.page, { pageKind: "watch", videoId });
  }

  async navigateSpaWatch(fromVideoId, toVideoId) {
    const outgoing = await prepareSpaOutgoingControls(this.page, fromVideoId);
    await this.page.locator("#watch-related").click();
    const destination = await finishSpaDestinationReplacement(this.page, toVideoId, {
      nativeHydrationDelay: ARTIFACT_NATIVE_HYDRATION_DELAY_MS,
    });
    return { destination, outgoing };
  }

  deferNextStatsRequest() {
    return this.backend.defer("GET", "/votes");
  }

  async navigateSpaWatchWhilePending(fromVideoId, toVideoId) {
    const outgoing = await preparePendingSpaOutgoingControls(this.page, fromVideoId);
    await finishSpaDestinationReplacement(this.page, toVideoId, {
      beforeNavigation: true,
      nativeHydrationDelay: ARTIFACT_NATIVE_HYDRATION_DELAY_MS,
    });
    await this.page.locator("#watch-related").click();
    const destination = await this.page.evaluate(() => {
      const result = globalThis.__artifactPreparedDestinationReplacement;
      delete globalThis.__artifactPreparedDestinationReplacement;
      if (!result) throw new Error("The destination controls were not prepared during navigation.");
      return result;
    });
    await observeSpaDestinationDislikeText(this.page, toVideoId);
    return { destination, outgoing };
  }

  deferInteractionResponse(pathname) {
    return this.apiServer.defer("POST", pathname);
  }

  enqueueInteractionResponse(pathname, response) {
    this.apiServer.enqueue("POST", pathname, response);
  }

  readInteractionRecords() {
    return this.apiServer.records.slice(this.apiRecordStart);
  }

  async setVoteSubmissionDisabled(disabled) {
    await this.worker.evaluate(async (value) => {
      const deadline = Date.now() + 2_000;
      while ((await chrome.storage.sync.get(["disableVoteSubmission"])).disableVoteSubmission === undefined) {
        if (Date.now() >= deadline) throw new Error("The extension did not initialize disableVoteSubmission.");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await chrome.storage.sync.set({ disableVoteSubmission: value });
      const stored = (await chrome.storage.sync.get(["disableVoteSubmission"])).disableVoteSubmission;
      if (stored !== value) throw new Error("The extension did not persist disableVoteSubmission.");
    }, disabled === true);
  }

  async readDestinationDislikeTextHistory() {
    return this.page.evaluate(() => [...(globalThis.__artifactDestinationDislikeTexts ?? [])]);
  }

  readStatsRequestTimings() {
    return this.backend.requestsFor("GET", "/votes").map(({ at, query, respondedAt }) => ({
      at,
      query: { ...query },
      respondedAt,
    }));
  }

  async activateSpaDislike(videoId) {
    const interactionStartIndex = this.apiServer.records.length;
    const activation = await clickSpaDestinationDislike(this.page, videoId);
    return { ...activation, interactionStartIndex };
  }

  async activateClonedSpaDislike(videoId) {
    const interactionStartIndex = this.apiServer.records.length;
    const activation = await cloneRenderedSpaControlsAndActivateDislike(this.page, videoId);
    return { ...activation, interactionStartIndex };
  }

  async readSpaVoteHandshake(interactionStartIndex, videoId, value) {
    return readArtifactVoteHandshake(this.apiServer.records, interactionStartIndex, videoId, value);
  }

  async assertSpaVoteNetwork(fromVideoId, toVideoId, interactionStartIndex) {
    const stats = assertSpaStatsTraffic(this.backend, fromVideoId, toVideoId);
    assert.equal(
      this.backend.requestsFor("POST", "/interact/vote").length,
      0,
      "The extension content script bypassed its background vote transport.",
    );
    assert.equal(
      this.backend.requestsFor("POST", "/interact/confirmVote").length,
      0,
      "The extension content script bypassed its background confirmation transport.",
    );
    const backgroundAfterActivation = this.apiServer.records
      .slice(interactionStartIndex)
      .filter((record) => record.method !== "OPTIONS");
    assert.ok(
      backgroundAfterActivation.every(
        (record) => record.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
      ),
      `The extension background made unexpected requests after activation: ${JSON.stringify(backgroundAfterActivation)}`,
    );
    assert.equal(this.apiServer.unexpectedRequests.length, 0, "The extension made an unexpected test-server request.");
    return stats;
  }

  async readSpaWatchSnapshot(fromVideoId, toVideoId) {
    return readSpaWatchSnapshot(this.page, this.runtime, fromVideoId, toVideoId);
  }

  async assertSpaNetwork(fromVideoId, toVideoId) {
    const traffic = assertSpaBackendTraffic(this.backend, fromVideoId, toVideoId);
    assert.equal(this.apiServer.unexpectedRequests.length, 0, "The extension made an unexpected test-server request.");
    return traffic;
  }

  async readSpaTraffic() {
    return {
      backgroundRequests: this.apiServer.records.map(({ method, pathname, query }) => ({ method, pathname, query })),
      routedRequests: readSpaTraffic(this.backend),
    };
  }

  async waitForWatchResult(videoId) {
    let result;
    try {
      result = await waitForWatchResult(this.page, this.runtime, videoId);
    } catch (error) {
      const diagnostics = {
        apiRecords: this.apiServer.records,
        page: await readWatchDiagnostics(this.page, this.runtime, videoId),
        pageSignals: this.pageSignals.snapshot(),
        productionOriginRequests: this.backend.requests,
        unexpectedRequests: this.apiServer.unexpectedRequests,
        workerUrl: this.worker.url(),
      };
      throw new Error(`${error.message}\nExtension artifact diagnostics: ${JSON.stringify(diagnostics, null, 2)}`, {
        cause: error,
      });
    }
    assert.deepEqual(
      this.backend.blockedRequests,
      [],
      `The extension attempted unexpected network traffic: ${JSON.stringify(this.backend.blockedRequests)}`,
    );
    const unexpectedRoutedRequests = this.backend.requests.filter(
      (request) => request.method !== "GET" || !["/configs/selectors", "/votes"].includes(request.pathname),
    );
    assert.deepEqual(
      unexpectedRoutedRequests,
      [],
      "The extension content script made an unexpected production-origin request.",
    );
    assert.equal(this.apiServer.unexpectedRequests.length, 0, "The extension made an unexpected test-server request.");
    return { ...result, workerUrl: this.worker.url() };
  }

  async assertNoPageSignals(scenarioId) {
    return this.pageSignals.assertClean(scenarioId);
  }

  async close() {
    await this.context?.close();
    removeOwnedTemporaryDirectory(this.profileDirectory, "ryd-mv3-profile-");
    removeOwnedTemporaryDirectory(this.preparedArtifact?.temporaryRoot, "ryd-mv3-e2e-");
  }
}

async function runArtifactWatchRenderScenario(adapter, { videoId = VIDEO_A } = {}) {
  assert.ok(
    SHARED_LIVE_SCENARIO_IDS.includes(ARTIFACT_SMOKE_SCENARIO_ID),
    `${ARTIFACT_SMOKE_SCENARIO_ID} must remain in the shared scenario catalog.`,
  );
  assert.ok(
    ["extension", "userscript"].includes(adapter?.runtime),
    "A supported artifact runtime adapter is required.",
  );
  for (const method of ["start", "openWatch", "waitForWatchResult", "assertNoPageSignals", "close"]) {
    assert.equal(
      typeof adapter[method],
      "function",
      `The ${adapter.runtime} artifact adapter must implement ${method}().`,
    );
  }

  try {
    await adapter.start();
    await adapter.openWatch(videoId);
    const result = await adapter.waitForWatchResult(videoId);
    assert.equal(result.videoId, videoId);
    assert.equal(
      result.ownedByExpectedWatch,
      true,
      `${adapter.runtime} rendered the result outside the expected watch root.`,
    );
    assert.equal(
      result.sameActionSurface,
      true,
      `${adapter.runtime} rendered the count and bar in different action surfaces.`,
    );
    assert.equal(result.actionSurfaceVisible, true, `${adapter.runtime} rendered into a hidden watch action surface.`);
    assert.equal(result.countVisible, true, `${adapter.runtime} rendered a hidden dislike count.`);
    assert.equal(result.rateBarVisible, true, `${adapter.runtime} did not render a visible watch ratio bar.`);
    assert.equal(result.fillVisible, true, `${adapter.runtime} did not render a visible watch ratio fill.`);
    assert.match(result.count, /\d/, `${adapter.runtime} did not render a numeric dislike count.`);
    await adapter.assertNoPageSignals(ARTIFACT_SMOKE_SCENARIO_ID);
    return { ...result, runtime: adapter.runtime, scenarioId: ARTIFACT_SMOKE_SCENARIO_ID };
  } finally {
    await adapter.close();
  }
}

function assertArtifactRuntimeAdapter(adapter, methods) {
  assert.ok(
    ["extension", "userscript"].includes(adapter?.runtime),
    "A supported artifact runtime adapter is required.",
  );
  for (const method of methods) {
    assert.equal(
      typeof adapter[method],
      "function",
      `The ${adapter.runtime} artifact adapter must implement ${method}().`,
    );
  }
}

function createArtifactSpaScenarioConfiguration({
  fromVideoId = VIDEO_A,
  intervalMs = 50,
  maxFirstValidMs = 1_000,
  stableForMs = 300,
  stabilityDurationMs = 1_000,
  timeoutMs = 15_000,
  toVideoId = VIDEO_B,
} = {}) {
  const fromCounts = SPA_COUNTS[fromVideoId];
  const toCounts = SPA_COUNTS[toVideoId];
  if (!fromCounts || !toCounts) {
    throw new TypeError("The SPA scenario requires configured non-proportional video counts.");
  }
  if (!Number.isFinite(maxFirstValidMs) || maxFirstValidMs < 0) {
    throw new TypeError("The SPA first-valid latency budget must be a non-negative finite number.");
  }
  const fromRatio = fromCounts.likes / (fromCounts.likes + fromCounts.dislikes);
  const toRatio = toCounts.likes / (toCounts.likes + toCounts.dislikes);
  assert.notEqual(fromRatio, toRatio, "The A/B fixture ratios must not be proportional.");
  return {
    fromCounts,
    fromRatio,
    fromVideoId,
    intervalMs,
    maxFirstValidMs,
    stabilityDurationMs,
    stableForMs,
    timeoutMs,
    toCounts,
    toRatio,
    toVideoId,
    validityOptions: {
      expectedCount: toCounts.dislikes,
      expectedRatio: toRatio,
      fromVideoId,
      toVideoId,
    },
  };
}

async function runArtifactWatchSpaSetup(adapter, configuration) {
  const {
    fromCounts,
    fromRatio,
    fromVideoId,
    intervalMs,
    maxFirstValidMs,
    stabilityDurationMs,
    stableForMs,
    timeoutMs,
    toVideoId,
    validityOptions,
  } = configuration;

  await adapter.openSpaWatch(fromVideoId);
  const initial = await adapter.waitForWatchResult(fromVideoId);
  assert.equal(initial.videoId, fromVideoId, "The outgoing watch fixture reported the wrong video ID.");
  assert.equal(initial.count, String(fromCounts.dislikes), "The outgoing watch rendered the wrong dislike count.");
  assert.ok(
    Number.isFinite(initial.fillRatio) && Math.abs(initial.fillRatio - fromRatio) <= 0.02,
    `The outgoing watch rendered ratio ${initial.fillRatio}; expected ${fromRatio}.`,
  );

  const mutation = await adapter.navigateSpaWatch(fromVideoId, toVideoId);
  assert.equal(mutation.outgoing.beforeBarCount, 1, "The retained outgoing fixture had no initialized A bar.");
  assert.equal(mutation.destination.destinationReplaced, true, "The destination actions were not replaced.");

  let readiness;
  try {
    readiness = await waitForStableInvariant({
      intervalMs,
      isValid: (snapshot) => isSpaDestinationValid(snapshot, validityOptions),
      label: `${adapter.runtime} destination watch ownership`,
      read: () => adapter.readSpaWatchSnapshot(fromVideoId, toVideoId),
      stableForMs,
      timeoutMs,
    });
  } catch (error) {
    if (typeof adapter.readSpaTraffic === "function") {
      error.message += ` Traffic: ${JSON.stringify(await adapter.readSpaTraffic())}`;
    }
    throw error;
  }
  assert.ok(
    readiness.firstValidMs <= maxFirstValidMs,
    `${adapter.runtime} destination watch first became valid after ${readiness.firstValidMs}ms; ` +
      `the budget is ${maxFirstValidMs}ms.`,
  );
  if (mutation.destination.nativeHydrationDelay > 0) {
    assert.ok(readiness.invalidSamples > 0, `${adapter.runtime} became valid before delayed controls hydrated.`);
    assert.ok(
      readiness.firstValidMs >= mutation.destination.nativeHydrationDelay - intervalMs * 2,
      `${adapter.runtime} became valid after ${readiness.firstValidMs}ms, before the ` +
        `${mutation.destination.nativeHydrationDelay}ms native-control delay elapsed.`,
    );
  }
  const stability = await assertInvariantContinuously({
    durationMs: stabilityDurationMs,
    intervalMs,
    isValid: (snapshot) => isSpaDestinationValid(snapshot, validityOptions),
    label: `${adapter.runtime} settled watch SPA UI`,
    read: () => adapter.readSpaWatchSnapshot(fromVideoId, toVideoId),
  });
  const destination = readiness.value;
  return {
    destination: {
      count: destination.count,
      fillRatio: destination.fillRatio,
      globalBarCount: destination.globalBarCount,
      retainedOutgoingBars: destination.retainedBefore.barCount + destination.insideOutgoing.barCount,
      tooltipText: destination.tooltipText,
      videoId: destination.currentVideoId,
    },
    initial: { count: initial.count, fillRatio: initial.fillRatio, videoId: initial.videoId },
    readiness: {
      firstValidMs: readiness.firstValidMs,
      invalidSamples: readiness.invalidSamples,
      maxFirstValidMs,
      sampleCount: readiness.sampleCount,
      stableForMs: readiness.stableForMs,
    },
    stability: { elapsedMs: stability.elapsedMs, sampleCount: stability.sampleCount },
  };
}

async function runArtifactWatchSpaScenario(adapter, options = {}) {
  assert.ok(
    SHARED_ARTIFACT_SCENARIO_IDS.includes(ARTIFACT_WATCH_SPA_SCENARIO_ID),
    `${ARTIFACT_WATCH_SPA_SCENARIO_ID} must remain in the shared artifact scenario catalog.`,
  );
  assertArtifactRuntimeAdapter(adapter, [
    "assertSpaNetwork",
    "assertNoPageSignals",
    "close",
    "navigateSpaWatch",
    "openSpaWatch",
    "readSpaWatchSnapshot",
    "start",
    "waitForWatchResult",
  ]);
  const configuration = createArtifactSpaScenarioConfiguration(options);

  try {
    await adapter.start();
    const result = await runArtifactWatchSpaSetup(adapter, configuration);
    const traffic = await adapter.assertSpaNetwork(configuration.fromVideoId, configuration.toVideoId);
    await adapter.assertNoPageSignals(ARTIFACT_WATCH_SPA_SCENARIO_ID);
    return {
      ...result,
      runtime: adapter.runtime,
      scenarioId: ARTIFACT_WATCH_SPA_SCENARIO_ID,
      traffic,
    };
  } finally {
    await adapter.close();
  }
}

async function runArtifactWatchSpaVoteContract(
  adapter,
  {
    activationMethod,
    expectClonedPresentation = false,
    handshakeStableForMs = 1_000,
    handshakeTimeoutMs = 10_000,
    scenarioId,
    voteValue = -1,
    ...spaOptions
  },
) {
  assert.ok(
    SHARED_ARTIFACT_SCENARIO_IDS.includes(scenarioId),
    `${scenarioId} must remain in the shared artifact scenario catalog.`,
  );
  assertArtifactRuntimeAdapter(adapter, [
    activationMethod,
    "assertNoPageSignals",
    "assertSpaVoteNetwork",
    "close",
    "navigateSpaWatch",
    "openSpaWatch",
    "readSpaVoteHandshake",
    "readSpaWatchSnapshot",
    "start",
    "waitForWatchResult",
  ]);
  assert.equal(voteValue, -1, "The shared post-SPA activation scenario must submit a dislike value of -1.");
  const configuration = createArtifactSpaScenarioConfiguration(spaOptions);

  try {
    await adapter.start();
    const result = await runArtifactWatchSpaSetup(adapter, configuration);
    const activation = await adapter[activationMethod](configuration.toVideoId);
    assert.ok(
      Number.isInteger(activation.interactionStartIndex) && activation.interactionStartIndex >= 0,
      "The adapter did not return a valid interaction record boundary.",
    );
    assert.equal(activation.videoId, configuration.toVideoId, "The adapter activated the wrong destination video.");
    if (expectClonedPresentation) {
      assert.equal(activation.presentationCloned, true, "The initialized destination presentation was not cloned.");
      assert.equal(activation.barCount, 1, "The cloned destination did not visibly retain exactly one rate bar.");
      assert.equal(
        activation.countContainerCount,
        1,
        "The cloned destination did not visibly retain exactly one Dislike count.",
      );
      assert.equal(
        activation.countBefore,
        String(configuration.toCounts.dislikes),
        "The cloned destination did not start from the rendered destination Dislike count.",
      );
      assert.equal(
        activation.countAfterSynchronousClick,
        String(configuration.toCounts.dislikes + 1),
        `The first immediate click on cloned initialized controls was lost: ${JSON.stringify(activation)}`,
      );
    }

    let handshake;
    try {
      handshake = await waitForStableInvariant({
        intervalMs: configuration.intervalMs,
        isValid: isArtifactVoteHandshakeValid,
        label: `${adapter.runtime} post-SPA dislike handshake`,
        read: () => adapter.readSpaVoteHandshake(activation.interactionStartIndex, configuration.toVideoId, voteValue),
        stableForMs: handshakeStableForMs,
        timeoutMs: handshakeTimeoutMs,
      });
    } catch (error) {
      if (typeof adapter.readSpaTraffic === "function") {
        error.message += ` Traffic: ${JSON.stringify(await adapter.readSpaTraffic())}`;
      }
      throw error;
    }
    const handshakeSnapshot = handshake.value;
    const network = await adapter.assertSpaVoteNetwork(
      configuration.fromVideoId,
      configuration.toVideoId,
      activation.interactionStartIndex,
    );
    await adapter.assertNoPageSignals(scenarioId);

    return {
      ...result,
      activation: {
        ariaPressedBefore: activation.ariaPressedBefore,
        presentationCloned: activation.presentationCloned === true,
        videoId: activation.videoId,
      },
      handshake: {
        confirmationRequests: handshakeSnapshot.confirmationCount,
        confirmationStatus: handshakeSnapshot.confirmation.responseStatus,
        confirmed: handshakeSnapshot.confirmation.responseBody === true,
        firstValidMs: handshake.firstValidMs,
        interactionRequests: handshakeSnapshot.interactionCount,
        sampleCount: handshake.sampleCount,
        stableForMs: handshake.stableForMs,
        userId: handshakeSnapshot.sharedUserId,
        value: voteValue,
        videoId: configuration.toVideoId,
        voteResponded: handshakeSnapshot.vote.responded,
        voteRequests: handshakeSnapshot.voteCount,
        voteStatus: handshakeSnapshot.vote.responseStatus,
      },
      runtime: adapter.runtime,
      scenarioId,
      traffic: {
        ...network,
        confirmationRequests: handshakeSnapshot.confirmationCount,
        interactionRequests: handshakeSnapshot.interactionCount,
        voteRequests: handshakeSnapshot.voteCount,
      },
    };
  } finally {
    await adapter.close();
  }
}

async function runArtifactWatchSpaVoteScenario(adapter, options = {}) {
  return runArtifactWatchSpaVoteContract(adapter, {
    ...options,
    activationMethod: "activateSpaDislike",
    scenarioId: ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID,
  });
}

async function runArtifactWatchSpaClonedVoteScenario(adapter, options = {}) {
  return runArtifactWatchSpaVoteContract(adapter, {
    ...options,
    activationMethod: "activateClonedSpaDislike",
    expectClonedPresentation: true,
    scenarioId: ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID,
  });
}

async function runExtensionDelayedOutgoingFailureScenario(
  adapter,
  {
    fromVideoId = VIDEO_A,
    maxDestinationRequestReadyDelayMs = 250,
    requestTimeoutMs = 5_000,
    toVideoId = VIDEO_B,
  } = {},
) {
  assert.equal(adapter?.runtime, "extension", "The delayed outgoing failure scenario requires the extension runtime.");
  assertArtifactRuntimeAdapter(adapter, [
    "assertNoPageSignals",
    "assertSpaNetwork",
    "close",
    "deferNextStatsRequest",
    "navigateSpaWatchWhilePending",
    "openSpaWatch",
    "readDestinationDislikeTextHistory",
    "readSpaWatchSnapshot",
    "readStatsRequestTimings",
    "setPremiumTeaserHidden",
    "start",
    "waitForWatchResult",
  ]);
  const configuration = createArtifactSpaScenarioConfiguration({ fromVideoId, toVideoId });

  try {
    await adapter.start();
    // This scenario times native-controls initialization. The optional teaser can
    // fetch counts before hydration and share that request with the main renderer,
    // so hide it before loading either video to keep /votes timing attributable.
    // The shared SPA scenarios retain the default teaser-enabled configuration.
    await adapter.setPremiumTeaserHidden(true);
    const outgoingRequest = adapter.deferNextStatsRequest();
    await adapter.openSpaWatch(fromVideoId);
    let requestTimeout;
    try {
      await Promise.race([
        outgoingRequest.seen,
        new Promise((resolve, reject) => {
          requestTimeout = setTimeout(
            () => reject(new Error(`The outgoing ${fromVideoId} stats request was not observed.`)),
            requestTimeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(requestTimeout);
    }

    const mutation = await adapter.navigateSpaWatchWhilePending(fromVideoId, toVideoId);
    assert.equal(mutation.outgoing.beforeBarCount, 0, "The intentionally pending outgoing request rendered a bar.");
    assert.equal(mutation.destination.destinationReplaced, true, "The destination actions were not replaced.");

    const releasedAt = Date.now();
    outgoingRequest.release({ body: "{", status: 200 });
    const readiness = await waitForStableInvariant({
      intervalMs: configuration.intervalMs,
      isValid: (snapshot) => isSpaDestinationValid(snapshot, configuration.validityOptions),
      label: "extension destination after delayed outgoing failure",
      read: () => adapter.readSpaWatchSnapshot(fromVideoId, toVideoId),
      stableForMs: configuration.stableForMs,
      timeoutMs: configuration.timeoutMs,
    });
    const destination = readiness.value;

    const textHistory = await adapter.readDestinationDislikeTextHistory();
    assert.ok(textHistory.length >= 1, "The destination dislike text history was not recorded.");
    assert.ok(
      textHistory.every((text) => text === "" || text === String(configuration.toCounts.dislikes)),
      `The outgoing failure wrote into the destination dislike UI: ${JSON.stringify(textHistory)}`,
    );

    const timings = adapter.readStatsRequestTimings();
    const destinationRequests = timings.filter((record) => record.query.videoId === toVideoId);
    assert.equal(destinationRequests.length, 1, `Expected one destination stats request for ${toVideoId}.`);
    const destinationRequestDelayMs = destinationRequests[0].at - releasedAt;
    const destinationControlsReadyAt =
      mutation.destination.nativeHydrationStartedAt + mutation.destination.nativeHydrationDelay;
    const destinationRequestReadyDelayMs = destinationRequests[0].at - destinationControlsReadyAt;
    assert.ok(
      destinationRequestReadyDelayMs >= 0,
      `The destination stats request started ${-destinationRequestReadyDelayMs}ms before its controls hydrated.`,
    );
    assert.ok(
      destinationRequestReadyDelayMs <= maxDestinationRequestReadyDelayMs,
      `The queued destination initialization waited ${destinationRequestReadyDelayMs}ms after its controls hydrated; ` +
        `the budget is ${maxDestinationRequestReadyDelayMs}ms.`,
    );
    const traffic = await adapter.assertSpaNetwork(fromVideoId, toVideoId);
    await adapter.assertNoPageSignals(ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID);

    return {
      destination: {
        count: destination.count,
        fillRatio: destination.fillRatio,
        videoId: destination.currentVideoId,
      },
      destinationRequestDelayMs,
      destinationRequestReadyDelayMs,
      runtime: adapter.runtime,
      scenarioId: ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
      textHistory,
      traffic,
    };
  } finally {
    await adapter.close();
  }
}

function createCataloguedArtifactAdapter(runtime, scenarioId, apiServer) {
  const backendOptions = scenarioId === ARTIFACT_SMOKE_SCENARIO_ID ? undefined : { countsByVideo: SPA_COUNTS };
  const options = backendOptions ? { backendOptions } : {};
  if (runtime === "userscript") return new HermeticUserscriptArtifactAdapter(options);
  if (runtime === "extension") return new HermeticExtensionArtifactAdapter({ ...options, apiServer });
  throw new TypeError(`Unsupported catalogued artifact runtime: ${runtime}`);
}

function runCataloguedArtifactScenario(scenarioId, adapter) {
  switch (scenarioId) {
    case ARTIFACT_SMOKE_SCENARIO_ID:
      return runArtifactWatchRenderScenario(adapter);
    case ARTIFACT_WATCH_SPA_SCENARIO_ID:
      return runArtifactWatchSpaScenario(adapter);
    case ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID:
      return runArtifactWatchSpaVoteScenario(adapter);
    case ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID:
      return runArtifactWatchSpaClonedVoteScenario(adapter);
    case ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID:
      return runExtensionDelayedOutgoingFailureScenario(adapter);
    default:
      throw new TypeError(`Unknown catalogued artifact scenario: ${scenarioId}`);
  }
}

async function runBothArtifactSmokes() {
  const apiServer = await startHermeticApiServer();
  try {
    const results = [];
    for (const { runtime, scenarioId } of createArtifactBrowserScenarioPlan()) {
      const adapter = createCataloguedArtifactAdapter(runtime, scenarioId, apiServer);
      results.push(await runCataloguedArtifactScenario(scenarioId, adapter));
    }
    return results;
  } finally {
    await apiServer.close();
  }
}

if (require.main === module) {
  runBothArtifactSmokes()
    .then((results) => process.stdout.write(`${JSON.stringify(results, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  ARTIFACT_BROWSER_SCENARIO_CATALOG,
  ARTIFACT_EXTENSION_DELAYED_FAILURE_SCENARIO_ID,
  ARTIFACT_SMOKE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_CLONED_VOTE_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_SCENARIO_ID,
  ARTIFACT_WATCH_SPA_VOTE_SCENARIO_ID,
  HermeticExtensionArtifactAdapter,
  HermeticUserscriptArtifactAdapter,
  SHARED_ARTIFACT_SCENARIO_IDS,
  SHARED_ARTIFACT_RUNTIMES,
  SPA_COUNTS,
  assertLoopbackOrigin,
  assertArtifactBrowserScenarioCatalog,
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
  runBothArtifactSmokes,
  runExtensionDelayedOutgoingFailureScenario,
  startHermeticApiServer,
};
