const fs = require("node:fs");
const path = require("node:path");

const API_ORIGIN = "https://returnyoutubedislikeapi.com";
const UNHANDLED_REJECTION_PREFIX = "__RYD_LIVE_UNHANDLED_REJECTION__";
const MAX_BROWSER_SIGNALS = 50;
const MAX_API_REQUESTS = 50;
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const EXTERNAL_RESOURCE_HOSTS = Object.freeze({
  doubleclick: "doubleclick.net",
  googlevideo: "googlevideo.com",
});
const EXTERNAL_RESOURCE_FAILURE_PATTERN =
  /^Failed to load resource: (?:the server responded with a status of 403(?: \([^)]*\))?|net::ERR_(?:BLOCKED_BY_CLIENT|CONNECTION_CLOSED|CONNECTION_REFUSED|CONNECTION_RESET|FAILED|NAME_NOT_RESOLVED|TIMED_OUT))\.?$/;
const DOUBLECLICK_CORS_PATTERN =
  /^Access to (?:fetch|XMLHttpRequest) at ['"]([^'"]+)['"](?: \(redirected from ['"]([^'"]+)['"]\))? from origin ['"](https:\/\/(?:www\.|m\.)?youtube\.com)['"] has been blocked by CORS policy: .+$/s;
const SANDBOXED_ABOUT_BLANK_SCRIPT_MESSAGE =
  "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
const YOUTUBE_ACCOUNTS_REPORT_ONLY_FRAME_ANCESTORS_MESSAGE =
  "Framing 'https://accounts.youtube.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n";
const YOUTUBE_ROTATE_COOKIES_RATE_LIMIT_PATTERN =
  /^Failed to load resource: the server responded with a status of 429(?: \([^)]*\))?\.?$/;
const FATAL_SIGNAL_TYPES = new Set([
  "console.error",
  "pageerror",
  "unhandledrejection",
  "extension-service-worker.console.error",
  "extension-service-worker.instrumentation-error",
  "extension-service-worker.unhandledrejection",
]);

function serializeError(error) {
  if (!error) return null;
  if (typeof error === "string") return { message: error, name: "Error", stack: null };
  const serialized = {
    message: String(error.message ?? error),
    name: String(error.name ?? "Error"),
    stack: typeof error.stack === "string" ? error.stack : null,
  };
  if (error instanceof AggregateError) serialized.errors = [...error.errors].map(serializeError);
  return serialized;
}

function normalizeIgnoredSignalRules(rules = []) {
  if (!Array.isArray(rules)) throw new TypeError("ignoredSignalRules must be an array.");
  const ids = new Set();
  return rules.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new TypeError("Each ignored-signal rule must be an object.");
    }
    const allowedKeys = new Set(["id", "message", "type", "url"]);
    const unknownKeys = Object.keys(rule).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new TypeError(`Ignored-signal rule contains unsupported fields: ${unknownKeys.join(", ")}.`);
    }
    if (typeof rule.id !== "string" || rule.id.trim() === "") {
      throw new TypeError("Each ignored-signal rule requires a non-empty id.");
    }
    if (ids.has(rule.id)) throw new TypeError(`Ignored-signal rule id ${rule.id} is duplicated.`);
    ids.add(rule.id);
    if (!FATAL_SIGNAL_TYPES.has(rule.type)) {
      throw new TypeError(`Ignored-signal rule ${rule.id} has an unsupported exact type.`);
    }
    if (typeof rule.message !== "string" || rule.message.length === 0) {
      throw new TypeError(`Ignored-signal rule ${rule.id} requires a non-empty exact message.`);
    }
    if (typeof rule.url !== "string" || rule.url.length === 0) {
      throw new TypeError(`Ignored-signal rule ${rule.id} requires a non-empty exact url.`);
    }
    return Object.freeze({ ...rule });
  });
}

function signalMessage(signal) {
  return signal.message ?? signal.error?.message ?? "Unknown browser error";
}

function signalUrl(signal) {
  return signal.workerUrl ?? signal.location?.url ?? null;
}

function ignoredSignalRuleId(signal, rules) {
  const message = signalMessage(signal);
  const url = signalUrl(signal);
  const rule = rules.find((candidate) => {
    if (candidate.type !== signal.type) return false;
    return candidate.message === message && candidate.url === url;
  });
  return rule?.id ?? null;
}

function hostnameCategory(value) {
  let hostname;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    hostname = url.hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const [category, domain] of Object.entries(EXTERNAL_RESOURCE_HOSTS)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return category;
  }
  return null;
}

function environmentalConsoleWarningId(signal) {
  if (signal?.type !== "console.error" || signal.source !== "page") return null;
  const message = signalMessage(signal);
  const locationUrl = signal.location?.url;
  const locationCategory = hostnameCategory(locationUrl);

  if (message === SANDBOXED_ABOUT_BLANK_SCRIPT_MESSAGE && locationUrl === "about:blank") {
    return "sandboxed-about-blank-script";
  }

  if (message === YOUTUBE_ACCOUNTS_REPORT_ONLY_FRAME_ANCESTORS_MESSAGE && locationUrl === "") {
    return "youtube-accounts-report-only-frame-ancestors";
  }

  if (EXTERNAL_RESOURCE_FAILURE_PATTERN.test(message)) {
    if (locationCategory === "googlevideo") return "googlevideo-resource-failure";
    if (locationCategory === "doubleclick") return "doubleclick-resource-failure";
    return null;
  }

  if (YOUTUBE_ROTATE_COOKIES_RATE_LIMIT_PATTERN.test(message)) {
    try {
      const url = new URL(locationUrl);
      if (
        url.protocol === "https:" &&
        url.hostname.toLowerCase() === "accounts.youtube.com" &&
        url.pathname === "/RotateCookies" &&
        !url.port &&
        !url.username &&
        !url.password
      ) {
        return "youtube-rotate-cookies-rate-limit";
      }
    } catch {}
  }

  const corsMatch = message.match(DOUBLECLICK_CORS_PATTERN);
  if (!corsMatch || hostnameCategory(corsMatch[1]) !== "doubleclick") return null;
  const [, , redirectedFrom, origin] = corsMatch;
  if (redirectedFrom) {
    try {
      const redirectUrl = new URL(redirectedFrom);
      if (
        redirectUrl.origin !== origin ||
        !redirectUrl.pathname.startsWith("/pagead/viewthroughconversion/") ||
        redirectUrl.username ||
        redirectUrl.password
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return "doubleclick-cors";
}

function extensionServiceWorkerUrl(extensionId) {
  if (!EXTENSION_ID_PATTERN.test(extensionId ?? "")) {
    throw new TypeError("selectedExtensionId must be a valid Chrome extension ID.");
  }
  return `chrome-extension://${extensionId}/ryd.background.js`;
}

function installUnhandledRejectionListener(prefix) {
  if (globalThis.__rydLiveUnhandledRejectionListenerInstalled) return;
  globalThis.__rydLiveUnhandledRejectionListenerInstalled = true;
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    let message;
    try {
      if (reason instanceof Error)
        message = `${reason.name}: ${reason.message}${reason.stack ? `\n${reason.stack}` : ""}`;
      else if (typeof reason === "string") message = reason;
      else message = JSON.stringify(reason);
    } catch {
      message = String(reason);
    }
    console.error(`${prefix}${message ?? "Unknown rejection"}`);
  });
}

class LiveFatalSignalGuard {
  constructor(
    page,
    context,
    {
      clock = () => new Date(),
      ignoredSignalRules = [],
      log = console.log,
      onSignal = null,
      selectedExtensionId = null,
    } = {},
  ) {
    this.clock = clock;
    this.context = context;
    this.ignoredSignalRules = normalizeIgnoredSignalRules(ignoredSignalRules);
    this.log = log;
    this.onSignal = onSignal;
    this.page = page;
    this.selectedExtensionWorkerUrl = selectedExtensionId ? extensionServiceWorkerUrl(selectedExtensionId) : null;
    this.serviceWorkerListeners = new Map();
    this.signals = [];
    this.started = false;

    this.onPageConsole = this.onPageConsole.bind(this);
    this.onPageError = this.onPageError.bind(this);
    this.onServiceWorker = this.onServiceWorker.bind(this);
  }

  now() {
    return this.clock().toISOString();
  }

  recordSignal(type, details) {
    const baseSignal = { at: this.now(), type, ...details };
    const ignoredBy = ignoredSignalRuleId(baseSignal, this.ignoredSignalRules);
    const environmentalWarning = environmentalConsoleWarningId(baseSignal);
    const severity = ignoredBy || environmentalWarning ? "warning" : "fatal";
    const signal = { ...baseSignal, environmentalWarning, ignoredBy, severity };
    this.signals.push(signal);
    this.log(
      `LIVE_BROWSER_SIGNAL ${type} ${JSON.stringify({ ...details, environmentalWarning, ignoredBy, severity })}`,
    );
    this.onSignal?.(signal);
    return signal;
  }

  onPageError(error) {
    this.recordSignal("pageerror", { error: serializeError(error), source: "page" });
  }

  readConsoleMessage(message) {
    let location = {};
    try {
      location = message.location?.() ?? {};
    } catch {}
    return { location, message: message.text() };
  }

  onPageConsole(consoleMessage) {
    if (consoleMessage.type() !== "error") return;
    const { location, message } = this.readConsoleMessage(consoleMessage);
    if (message.startsWith(UNHANDLED_REJECTION_PREFIX)) {
      this.recordSignal("unhandledrejection", {
        location,
        message: message.slice(UNHANDLED_REJECTION_PREFIX.length),
        source: "page",
      });
      return;
    }
    this.recordSignal("console.error", { location, message, source: "page" });
  }

  async attachServiceWorker(worker) {
    if (!this.selectedExtensionWorkerUrl || worker.url() !== this.selectedExtensionWorkerUrl) return;
    if (this.serviceWorkerListeners.has(worker)) return;

    const listener = (consoleMessage) => {
      if (consoleMessage.type() !== "error") return;
      const { location, message } = this.readConsoleMessage(consoleMessage);
      if (message.startsWith(UNHANDLED_REJECTION_PREFIX)) {
        this.recordSignal("extension-service-worker.unhandledrejection", {
          location,
          message: message.slice(UNHANDLED_REJECTION_PREFIX.length),
          source: "extension-service-worker",
          workerUrl: this.selectedExtensionWorkerUrl,
        });
        return;
      }
      this.recordSignal("extension-service-worker.console.error", {
        location,
        message,
        source: "extension-service-worker",
        workerUrl: this.selectedExtensionWorkerUrl,
      });
    };
    this.serviceWorkerListeners.set(worker, listener);
    worker.on("console", listener);
    try {
      await worker.evaluate(installUnhandledRejectionListener, UNHANDLED_REJECTION_PREFIX);
    } catch (error) {
      this.recordSignal("extension-service-worker.instrumentation-error", {
        error: serializeError(error),
        source: "extension-service-worker",
        workerUrl: this.selectedExtensionWorkerUrl,
      });
    }
  }

  onServiceWorker(worker) {
    void this.attachServiceWorker(worker);
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.page.on("console", this.onPageConsole);
    this.page.on("pageerror", this.onPageError);
    await this.page.addInitScript(installUnhandledRejectionListener, UNHANDLED_REJECTION_PREFIX);
    if (!this.page.isClosed()) await this.page.evaluate(installUnhandledRejectionListener, UNHANDLED_REJECTION_PREFIX);

    if (this.selectedExtensionWorkerUrl) {
      this.context.on("serviceworker", this.onServiceWorker);
      await Promise.all(this.context.serviceWorkers().map((worker) => this.attachServiceWorker(worker)));
    }
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.page.off("console", this.onPageConsole);
    this.page.off("pageerror", this.onPageError);
    if (this.selectedExtensionWorkerUrl) this.context.off("serviceworker", this.onServiceWorker);
    for (const [worker, listener] of this.serviceWorkerListeners) worker.off("console", listener);
    this.serviceWorkerListeners.clear();
  }

  mark() {
    return this.signals.length;
  }

  fatalSignalsBetween(startIndex = 0, endIndex = this.signals.length) {
    return this.signals.slice(startIndex, endIndex).filter((signal) => signal.severity !== "warning");
  }

  assertNoFatalSignalsBetween(startIndex = 0, endIndex = this.signals.length, label = "live scenario") {
    const signals = this.fatalSignalsBetween(startIndex, endIndex);
    if (signals.length === 0) return;
    const summary = signals.map((signal) => `${signal.type}: ${signalMessage(signal)}`).join(" | ");
    const error = new Error(`${label} emitted ${signals.length} fatal browser signal(s): ${summary}`);
    error.name = "LiveFatalSignalError";
    error.signals = signals;
    throw error;
  }
}

class LiveReadOnlyGate {
  constructor(requiredScenarioIds, { allowedSkippedScenarioIds = [] } = {}) {
    if (!Array.isArray(requiredScenarioIds) || requiredScenarioIds.length === 0) {
      throw new TypeError("The live read-only gate requires at least one scenario ID.");
    }
    if (requiredScenarioIds.some((scenarioId) => typeof scenarioId !== "string" || scenarioId.trim() === "")) {
      throw new TypeError("Every live read-only gate scenario ID must be a non-empty string.");
    }
    if (new Set(requiredScenarioIds).size !== requiredScenarioIds.length) {
      throw new TypeError("Live read-only gate scenario IDs must be unique.");
    }
    if (
      !Array.isArray(allowedSkippedScenarioIds) ||
      allowedSkippedScenarioIds.some((scenarioId) => !requiredScenarioIds.includes(scenarioId))
    ) {
      throw new TypeError("Allowed skipped scenarios must be a subset of the required live read-only scenarios.");
    }
    this.allowedSkipped = new Set(allowedSkippedScenarioIds);
    this.completed = new Set();
    this.failed = new Set();
    this.requiredScenarioIds = Object.freeze([...requiredScenarioIds]);
  }

  record(scenarioId, outcome) {
    if (!this.requiredScenarioIds.includes(scenarioId)) {
      throw new TypeError(`Unknown live read-only scenario: ${scenarioId}`);
    }
    if (!["failed", "passed", "skipped"].includes(outcome)) {
      throw new TypeError(`Unsupported live read-only outcome for ${scenarioId}: ${outcome}`);
    }
    if (outcome === "failed" || (outcome === "skipped" && !this.allowedSkipped.has(scenarioId))) {
      this.completed.delete(scenarioId);
      this.failed.add(scenarioId);
      return;
    }
    if (this.failed.has(scenarioId)) return;
    this.completed.add(scenarioId);
  }

  assertPassed() {
    const missing = this.requiredScenarioIds.filter((scenarioId) => !this.completed.has(scenarioId));
    if (this.failed.size === 0 && missing.length === 0) return;
    throw new Error(
      `Production reactions are blocked because this worker did not pass every read-only scenario. Missing: ${
        missing.join(", ") || "none"
      }; failed: ${[...this.failed].join(", ") || "none"}.`,
    );
  }
}

function readLivePageState() {
  const readRect = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  };
  const actionBarSelector = "reel-action-bar-view-model, .slim-video-action-bar-actions";
  const syntheticSelector = "[data-ryd-synthetic-shorts-dislike]";
  const renderers = [...document.querySelectorAll("ytd-reel-video-renderer, ytm-reel-video-renderer")];

  return {
    document: {
      readyState: document.readyState,
      title: document.title,
      url: location.href,
      viewport: { height: innerHeight, width: innerWidth },
    },
    runtimeMarkers: {
      extensionBuild: document.documentElement.getAttribute("data-ryd-extension-build"),
      extension: document.documentElement.getAttribute("data-ryd-extension-version"),
      userscriptBuild: document.documentElement.getAttribute("data-ryd-userscript-build"),
      userscript: document.documentElement.getAttribute("data-ryd-userscript-version"),
    },
    renderers: renderers.map((renderer, index) => ({
      actionBars: renderer.querySelectorAll(actionBarSelector).length,
      ariaHidden: renderer.getAttribute("aria-hidden"),
      index,
      isActive: renderer.getAttribute("is-active"),
      links: [...renderer.querySelectorAll('a[href*="/shorts/"]')].map((link) => ({
        href: link.getAttribute("href"),
        visible: isVisible(link),
      })),
      rect: readRect(renderer),
      syntheticControls: renderer.querySelectorAll(syntheticSelector).length,
      tagName: renderer.tagName.toLowerCase(),
      videoId: renderer.getAttribute("video-id"),
      visible: isVisible(renderer),
    })),
    actionBars: [...document.querySelectorAll(actionBarSelector)].map((actionBar, index) => ({
      index,
      nativeDislikes: actionBar.querySelectorAll("dislike-button-view-model, #dislike-button").length,
      nativeLikes: actionBar.querySelectorAll("like-button-view-model, #like-button").length,
      rect: readRect(actionBar),
      syntheticControls: actionBar.querySelectorAll(syntheticSelector).length,
      tagName: actionBar.tagName.toLowerCase(),
      videoId: actionBar.closest("ytd-reel-video-renderer, ytm-reel-video-renderer")?.getAttribute("video-id") ?? null,
      visible: isVisible(actionBar),
    })),
    syntheticControls: [...document.querySelectorAll(syntheticSelector)].map((control, index) => ({
      ariaPressed: control.querySelector("button")?.getAttribute("aria-pressed") ?? null,
      index,
      rect: readRect(control),
      text: (control.textContent ?? "").replace(/\s+/g, " ").trim(),
      videoId: control.getAttribute("data-ryd-video-id"),
      visible: isVisible(control),
    })),
    videos: [...document.querySelectorAll("video")].map((video, index) => ({
      currentTime: video.currentTime,
      ended: video.ended,
      index,
      paused: video.paused,
      readyState: video.readyState,
      rect: readRect(video),
      visible: isVisible(video),
    })),
  };
}

function diagnosticApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== API_ORIGIN) return null;

  const query = {};
  for (const [name, requestValue] of url.searchParams) {
    query[name] = /auth|key|puzzle|secret|solution|token|user/i.test(name) ? "<redacted>" : requestValue;
  }
  return { pathname: url.pathname, query };
}

function timestampForFilename(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

class LiveRunDiagnostics {
  constructor(
    page,
    context,
    {
      clock = () => new Date(),
      fileSystem = fs,
      ignoredSignalRules = [],
      log = console.log,
      outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/diagnostics"),
      runtime = null,
      selectedExtensionId = null,
    } = {},
  ) {
    this.browserSignals = [];
    this.clock = clock;
    this.context = context;
    this.currentCheckpoint = null;
    this.currentStage = "startup";
    this.fileSystem = fileSystem;
    this.log = log;
    this.outputDirectory = outputDirectory;
    this.page = page;
    this.recentApiRequests = [];
    this.requestRecords = new WeakMap();
    this.runtime = runtime;
    this.fatalSignalCursor = 0;
    this.started = false;

    this.onRequest = this.onRequest.bind(this);
    this.onRequestFailed = this.onRequestFailed.bind(this);
    this.onResponse = this.onResponse.bind(this);
    this.fatalSignalGuard = new LiveFatalSignalGuard(page, context, {
      clock,
      ignoredSignalRules,
      log: () => {},
      onSignal: (signal) => this.recordBrowserSignal(signal),
      selectedExtensionId,
    });
  }

  now() {
    return this.clock().toISOString();
  }

  appendCapped(collection, value, maximum) {
    collection.push(value);
    if (collection.length > maximum) collection.splice(0, collection.length - maximum);
  }

  recordBrowserSignal(signal) {
    const { at, ...details } = signal;
    const enrichedSignal = {
      at,
      checkpoint: this.currentCheckpoint,
      stage: this.currentStage,
      ...details,
    };
    this.appendCapped(this.browserSignals, enrichedSignal, MAX_BROWSER_SIGNALS);
    this.log(`LIVE_BROWSER_SIGNAL ${enrichedSignal.type} ${JSON.stringify(details)}`);
  }

  onRequest(request) {
    const apiUrl = diagnosticApiUrl(request.url());
    if (!apiUrl) return;
    const record = {
      ...apiUrl,
      at: this.now(),
      failure: null,
      method: request.method(),
      resourceType: typeof request.resourceType === "function" ? request.resourceType() : null,
      checkpoint: this.currentCheckpoint,
      stage: this.currentStage,
      status: null,
    };
    this.appendCapped(this.recentApiRequests, record, MAX_API_REQUESTS);
    this.requestRecords.set(request, record);
  }

  onResponse(response) {
    const record = this.requestRecords.get(response.request());
    if (!record) return;
    record.status = response.status();
  }

  onRequestFailed(request) {
    const record = this.requestRecords.get(request);
    if (!record) return;
    record.failure = request.failure()?.errorText ?? "Unknown request failure";
  }

  async start() {
    if (this.started) return;
    this.started = true;
    await this.fatalSignalGuard.start();
    this.context.on("request", this.onRequest);
    this.context.on("requestfailed", this.onRequestFailed);
    this.context.on("response", this.onResponse);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.fatalSignalGuard.stop();
    this.context.off("request", this.onRequest);
    this.context.off("requestfailed", this.onRequestFailed);
    this.context.off("response", this.onResponse);
  }

  checkpoint(name, details = {}) {
    this.currentCheckpoint = name;
    this.log(`LIVE_CHECKPOINT ${name} ${JSON.stringify(details)}`);
  }

  stageStarted(name) {
    this.currentCheckpoint = null;
    this.currentStage = name;
    this.log(`LIVE_STAGE_START ${name}`);
  }

  stageCompleted(name, startedAt) {
    this.currentCheckpoint = null;
    this.currentStage = name;
    this.log(`LIVE_STAGE_COMPLETE ${name} durationMs=${Date.now() - startedAt}`);
  }

  stageFailed(name, startedAt, error) {
    this.currentStage = name;
    this.log(
      `LIVE_STAGE_FAILED ${name} durationMs=${Date.now() - startedAt} error=${JSON.stringify(error?.message ?? String(error))}`,
    );
  }

  consumeFatalSignals(label) {
    const startIndex = this.fatalSignalCursor;
    const endIndex = this.fatalSignalGuard.mark();
    this.fatalSignalCursor = endIndex;
    this.fatalSignalGuard.assertNoFatalSignalsBetween(startIndex, endIndex, label);
  }

  async snapshot(error) {
    let pageState = null;
    let pageStateError = null;
    let url = null;
    try {
      url = this.page.url();
    } catch {
      // A disconnected page still produces a useful harness/request snapshot.
    }
    if (!this.page.isClosed()) {
      try {
        pageState = await this.page.evaluate(readLivePageState);
      } catch (snapshotError) {
        pageStateError = serializeError(snapshotError);
      }
    }

    return {
      browserSignals: this.browserSignals,
      capturedAt: this.now(),
      currentCheckpoint: this.currentCheckpoint,
      currentStage: this.currentStage,
      error: serializeError(error),
      pageClosed: this.page.isClosed(),
      pageState,
      pageStateError,
      recentApiRequests: this.recentApiRequests,
      runtime: this.runtime,
      url,
    };
  }

  async persistFailureSnapshot(error) {
    const snapshot = await this.snapshot(error);
    this.fileSystem.mkdirSync(this.outputDirectory, { recursive: true });
    const fileName = `failure-${timestampForFilename(this.clock())}.json`;
    const snapshotPath = path.join(this.outputDirectory, fileName);
    this.fileSystem.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return snapshotPath;
  }
}

async function runLoggedStage(diagnostics, name, action) {
  const startedAt = Date.now();
  diagnostics.stageStarted(name);
  let result;
  let failure = null;
  try {
    result = await action();
  } catch (error) {
    failure = error;
  }

  await Promise.resolve();
  try {
    diagnostics.consumeFatalSignals?.(name);
  } catch (signalError) {
    failure = failure
      ? new AggregateError([failure, signalError], `${name} failed and emitted fatal browser signals.`)
      : signalError;
  }

  if (failure) {
    diagnostics.stageFailed(name, startedAt, failure);
    throw failure;
  }
  diagnostics.stageCompleted(name, startedAt);
  return result;
}

async function runIndependentLoggedStages(diagnostics, stages) {
  if (!Array.isArray(stages)) throw new TypeError("Independent live stages must be an array.");
  const results = [];
  const failures = [];
  for (const stage of stages) {
    if (!stage || typeof stage.name !== "string" || typeof stage.action !== "function") {
      throw new TypeError("Each independent live stage requires a name and action function.");
    }
    try {
      results.push({ name: stage.name, result: await runLoggedStage(diagnostics, stage.name, stage.action) });
    } catch (error) {
      failures.push(error);
      results.push({ error: serializeError(error), name: stage.name });
    }
  }
  if (failures.length > 0) {
    const error = new AggregateError(
      failures,
      `${failures.length} of ${stages.length} independent live read-only stages failed.`,
    );
    error.stageResults = results;
    throw error;
  }
  return results;
}

module.exports = {
  API_ORIGIN,
  LiveFatalSignalGuard,
  LiveReadOnlyGate,
  LiveRunDiagnostics,
  UNHANDLED_REJECTION_PREFIX,
  diagnosticApiUrl,
  environmentalConsoleWarningId,
  extensionServiceWorkerUrl,
  ignoredSignalRuleId,
  installUnhandledRejectionListener,
  normalizeIgnoredSignalRules,
  readLivePageState,
  runIndependentLoggedStages,
  runLoggedStage,
  serializeError,
};
