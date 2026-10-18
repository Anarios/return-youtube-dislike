const path = require("node:path");

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;
const BACKGROUND_SCRIPT = "ryd.background.js";
const DEFAULT_RELOAD_TIMEOUT_MS = 15_000;
const EXTENSION_INVENTORY_POLL_INTERVAL_MS = 50;
const LIVE_EXTENSION_PATH = path.resolve(__dirname, "../../../combined/dist/chrome");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeExtensionPath(value, { pathImpl = path, platform = process.platform } = {}) {
  if (typeof value !== "string" || value.trim() === "") return null;
  let normalized = pathImpl.resolve(value.trim()).replace(/[\\/]+$/u, "");
  if (platform === "win32") normalized = normalized.toLowerCase();
  return normalized;
}

function selectEnabledUnpackedExtension(extensions, expectedPath, { requireEnabled = true, ...pathOptions } = {}) {
  if (!Array.isArray(extensions)) throw new Error("Chrome returned a malformed unpacked-extension inventory.");
  const normalizedExpectedPath = normalizeExtensionPath(expectedPath, pathOptions);
  if (!normalizedExpectedPath) throw new Error("An absolute unpacked-extension path is required.");

  const matching = extensions.filter(
    (extension) => normalizeExtensionPath(extension?.path, pathOptions) === normalizedExpectedPath,
  );
  if (matching.length === 0) {
    throw new Error(`The unpacked extension at ${expectedPath} is not installed in the attached Chrome profile.`);
  }
  if (matching.length > 1) {
    throw new Error(`Chrome reported more than one unpacked extension at ${expectedPath}; refusing to choose one.`);
  }

  const [extension] = matching;
  if (!EXTENSION_ID_PATTERN.test(extension.id ?? "")) {
    throw new Error(`Chrome reported an invalid extension ID for ${expectedPath}.`);
  }
  if (requireEnabled && extension.enabled !== true) {
    throw new Error(`The unpacked extension at ${expectedPath} is installed but disabled.`);
  }
  return extension;
}

function isOrdinaryYoutubePage(page) {
  if (!page || typeof page.url !== "function" || page.isClosed?.()) return false;
  try {
    const url = new URL(page.url());
    return url.protocol === "https:" && ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function assertSelectedSessionPage(sessionPage, context) {
  if (!isOrdinaryYoutubePage(sessionPage)) {
    throw new Error("The selected extension-reload session page must be an open ordinary HTTPS YouTube page.");
  }
  if (typeof sessionPage.context !== "function" || sessionPage.context() !== context) {
    throw new Error("The selected extension-reload session page does not belong to the attached Chrome context.");
  }
  return sessionPage;
}

function extensionServiceWorkerUrl(extensionId) {
  if (!EXTENSION_ID_PATTERN.test(extensionId ?? "")) throw new Error("A valid Chrome extension ID is required.");
  return `chrome-extension://${extensionId}/${BACKGROUND_SCRIPT}`;
}

function matchingExtensionWorkers(context, extensionId, excludedWorker = null) {
  const expectedUrl = extensionServiceWorkerUrl(extensionId);
  return context.serviceWorkers().filter((worker) => worker !== excludedWorker && worker.url() === expectedUrl);
}

async function waitForExtensionWorker(
  context,
  serviceWorkerSession,
  extensionId,
  { delayImpl = delay, excludedWorker = null, now = Date.now, timeoutMilliseconds = DEFAULT_RELOAD_TIMEOUT_MS } = {},
) {
  let workers = matchingExtensionWorkers(context, extensionId, excludedWorker);
  if (workers.length > 1) throw new Error(`Chrome exposed duplicate service workers for extension ${extensionId}.`);
  if (workers.length === 1) return workers[0];

  await serviceWorkerSession.send("ServiceWorker.enable");
  await serviceWorkerSession.send("ServiceWorker.startWorker", {
    scopeURL: `chrome-extension://${extensionId}/`,
  });

  const deadline = now() + timeoutMilliseconds;
  while (now() < deadline) {
    workers = matchingExtensionWorkers(context, extensionId, excludedWorker);
    if (workers.length > 1) throw new Error(`Chrome exposed duplicate service workers for extension ${extensionId}.`);
    if (workers.length === 1) return workers[0];
    await delayImpl(Math.min(50, Math.max(1, deadline - now())));
  }
  throw new Error(`Chrome did not start ${extensionServiceWorkerUrl(extensionId)} within ${timeoutMilliseconds}ms.`);
}

async function readWorkerIdentity(worker) {
  return worker.evaluate(async () => {
    const runtime = globalThis.chrome?.runtime;
    const manifest = runtime?.getManifest?.();
    let resourceBuildId = null;
    try {
      const response = await fetch(runtime.getURL("live-build.json"), { cache: "no-store" });
      const marker = response.ok ? await response.json() : null;
      resourceBuildId = marker?.buildId ?? null;
    } catch {}

    return {
      backgroundScript: manifest?.background?.service_worker ?? null,
      compiledBuildId: globalThis.__RYD_LIVE_EXTENSION_BUILD__?.buildId ?? null,
      extensionId: runtime?.id ?? null,
      resourceBuildId,
      version: manifest?.version ?? null,
    };
  });
}

function assertWorkerIdentity(identity, extensionId, { expectedBuildId = null, expectedVersion = null } = {}) {
  if (!identity || typeof identity !== "object") throw new Error("The extension service worker returned no identity.");
  if (identity.extensionId !== extensionId) {
    throw new Error(
      `The service worker belongs to ${identity.extensionId ?? "an unknown extension"}, not ${extensionId}.`,
    );
  }
  if (identity.backgroundScript !== BACKGROUND_SCRIPT) {
    throw new Error(`Extension ${extensionId} does not use the expected ${BACKGROUND_SCRIPT} service worker.`);
  }
  if (expectedVersion !== null && identity.version !== expectedVersion) {
    throw new Error(
      `Reloaded extension ${extensionId} has version ${identity.version ?? "<missing>"}, expected ${expectedVersion}.`,
    );
  }
  if (expectedBuildId !== null) {
    if (!LIVE_BUILD_ID_PATTERN.test(expectedBuildId)) throw new Error("The expected live-build ID is malformed.");
    if (identity.compiledBuildId !== expectedBuildId) {
      throw new Error(
        `Reloaded extension ${extensionId} is running build ${identity.compiledBuildId ?? "<missing>"}, expected ${expectedBuildId}.`,
      );
    }
    if (identity.resourceBuildId !== expectedBuildId) {
      throw new Error(
        `Extension ${extensionId} exposes resource build ${identity.resourceBuildId ?? "<missing>"}, expected ${expectedBuildId}.`,
      );
    }
  }
  return identity;
}

async function requestWorkerReload(worker, timeoutMilliseconds = DEFAULT_RELOAD_TIMEOUT_MS) {
  const closed = worker.waitForEvent("close", { timeout: timeoutMilliseconds });
  await worker.evaluate(() => {
    const runtime = chrome.runtime;
    setTimeout(() => runtime.reload(), 0);
    return true;
  });
  await closed;
}

async function readUnpackedExtensions(browserSession) {
  try {
    const result = await browserSession.send("Extensions.getExtensions");
    return result?.extensions;
  } catch (error) {
    throw new Error(
      "Chrome did not expose Extensions.getExtensions on this CDP connection, so the unpacked extension cannot be identified safely. Reload it manually; no extension was changed.",
      { cause: error },
    );
  }
}

async function waitForReloadedExtensionEnabled(
  browserSession,
  expectedExtensionPath,
  expectedExtensionId,
  { delayImpl = delay, now = Date.now, pathOptions, timeoutMilliseconds = DEFAULT_RELOAD_TIMEOUT_MS } = {},
) {
  const deadline = now() + timeoutMilliseconds;

  while (true) {
    const inventory = await readUnpackedExtensions(browserSession);
    const extension = selectEnabledUnpackedExtension(inventory, expectedExtensionPath, {
      ...pathOptions,
      requireEnabled: false,
    });
    if (extension.id !== expectedExtensionId) {
      throw new Error(
        `The unpacked extension ID changed from ${expectedExtensionId} to ${extension.id} during reload.`,
      );
    }
    if (extension.enabled === true) return extension;

    const remainingMilliseconds = deadline - now();
    if (remainingMilliseconds <= 0) {
      throw new Error(
        `The unpacked extension at ${expectedExtensionPath} remained disabled for ${timeoutMilliseconds}ms after reload.`,
      );
    }
    await delayImpl(Math.min(EXTENSION_INVENTORY_POLL_INTERVAL_MS, remainingMilliseconds));
  }
}

async function reloadLiveExtension({
  browserSession,
  context,
  expectedBuildId,
  expectedExtensionPath,
  expectedVersion,
  pathOptions,
  serviceWorkerSession,
  timeoutMilliseconds = DEFAULT_RELOAD_TIMEOUT_MS,
  waitOptions = {},
}) {
  if (!LIVE_BUILD_ID_PATTERN.test(expectedBuildId ?? "")) throw new Error("The expected live-build ID is malformed.");

  const beforeInventory = await readUnpackedExtensions(browserSession);
  const before = selectEnabledUnpackedExtension(beforeInventory, expectedExtensionPath, pathOptions);
  const oldWorker = await waitForExtensionWorker(context, serviceWorkerSession, before.id, {
    ...waitOptions,
    timeoutMilliseconds,
  });
  assertWorkerIdentity(await readWorkerIdentity(oldWorker), before.id);

  await requestWorkerReload(oldWorker, timeoutMilliseconds);

  const after = await waitForReloadedExtensionEnabled(browserSession, expectedExtensionPath, before.id, {
    ...waitOptions,
    pathOptions,
    timeoutMilliseconds,
  });

  const newWorker = await waitForExtensionWorker(context, serviceWorkerSession, after.id, {
    ...waitOptions,
    excludedWorker: oldWorker,
    timeoutMilliseconds,
  });
  const identity = assertWorkerIdentity(await readWorkerIdentity(newWorker), after.id, {
    expectedBuildId,
    expectedVersion,
  });

  return {
    buildId: identity.compiledBuildId,
    extensionId: after.id,
    previousVersion: before.version ?? null,
    version: identity.version,
  };
}

async function reloadLiveExtensionInBrowser({
  browser,
  context,
  expectedBuildId,
  expectedExtensionPath = LIVE_EXTENSION_PATH,
  expectedVersion,
  reloadImpl = reloadLiveExtension,
  sessionPage,
  timeoutMilliseconds = DEFAULT_RELOAD_TIMEOUT_MS,
}) {
  assertSelectedSessionPage(sessionPage, context);
  const browserSession = await browser.newBrowserCDPSession();
  let serviceWorkerSession = null;
  try {
    serviceWorkerSession = await context.newCDPSession(sessionPage);
    return await reloadImpl({
      browserSession,
      context,
      expectedBuildId,
      expectedExtensionPath,
      expectedVersion,
      serviceWorkerSession,
      timeoutMilliseconds,
    });
  } finally {
    await serviceWorkerSession?.detach().catch(() => {});
    await browserSession.detach().catch(() => {});
  }
}

module.exports = {
  BACKGROUND_SCRIPT,
  DEFAULT_RELOAD_TIMEOUT_MS,
  LIVE_EXTENSION_PATH,
  assertSelectedSessionPage,
  assertWorkerIdentity,
  extensionServiceWorkerUrl,
  normalizeExtensionPath,
  readUnpackedExtensions,
  readWorkerIdentity,
  reloadLiveExtension,
  reloadLiveExtensionInBrowser,
  requestWorkerReload,
  selectEnabledUnpackedExtension,
  waitForReloadedExtensionEnabled,
  waitForExtensionWorker,
};
