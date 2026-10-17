const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { resolveCdpEndpoint } = require("../../live/live-cdp-endpoint");
const { selectAuthenticatedYoutubeContext } = require("./live-authenticated-context");
const { LIVE_EXTENSION_PATH, reloadLiveExtensionInBrowser } = require("./live-extension-reloader");

const extensionPath = LIVE_EXTENSION_PATH;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function connectTimeoutMilliseconds(environment) {
  const configured = Number(environment.RYD_CDP_CONNECT_TIMEOUT_MS || 120_000);
  if (!Number.isSafeInteger(configured) || configured < 15_000 || configured > 300_000) {
    throw new Error("RYD_CDP_CONNECT_TIMEOUT_MS must be an integer from 15000 through 300000.");
  }
  return configured;
}

async function main() {
  const expectedBuildId = readJson(path.join(extensionPath, "live-build.json")).buildId;
  const expectedVersion = readJson(path.join(extensionPath, "manifest.json")).version;
  const timeoutMilliseconds = connectTimeoutMilliseconds(process.env);
  const cdpEndpoint = resolveCdpEndpoint(process.env.RYD_CDP_ENDPOINT);

  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpEndpoint, {
      isLocal: true,
      noDefaults: true,
      timeout: timeoutMilliseconds,
    });
    const selectedSession = await selectAuthenticatedYoutubeContext(browser, process.env.RYD_LIVE_EXPECTED_CHANNEL);
    const { context, sessionPage } = selectedSession;
    console.log(
      `AUTHENTICATED_CHROMIUM_CONTEXT_SELECTED context=${selectedSession.contextIndex + 1} page=${selectedSession.pageIndex + 1} handle=${process.env.RYD_LIVE_EXPECTED_CHANNEL}`,
    );

    const result = await reloadLiveExtensionInBrowser({
      browser,
      context,
      expectedBuildId,
      expectedExtensionPath: extensionPath,
      expectedVersion,
      sessionPage,
      timeoutMilliseconds,
    });
    console.log(`LIVE_EXTENSION_RELOADED ${JSON.stringify(result)}`);
  } finally {
    if (browser) await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { connectTimeoutMilliseconds, main };
