const { chromium, test } = require("@playwright/test");
const {
  createExtensionLiveRuntimeAdapter,
  createUserscriptLiveRuntimeAdapter,
} = require("../../../e2e/live-runtime-adapter");
const { createSharedLiveScenarioRunner } = require("../../../e2e/shared-live-scenarios");
const { readLiveOptions } = require("../../live/live-options");
const { selectAuthenticatedYoutubeContext } = require("./live-authenticated-context");
const { LiveReadOnlyGate, LiveRunDiagnostics, runLoggedStage } = require("./live-diagnostics");
const { reloadLiveExtensionInBrowser } = require("./live-extension-reloader");
const { REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS } = require("./live-interactive-scenario-contract");
const { LiveYoutubeDriver } = require("./live-youtube-driver");

const options = readLiveOptions();
const scenarioRunner = createSharedLiveScenarioRunner();
const REQUIRED_READ_ONLY_SCENARIOS = REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS;

if (options === null) {
  throw new Error(
    "No live YouTube scenarios ran. Set RYD_LIVE_YOUTUBE=1 and every documented runtime/allowlist variable.",
  );
}

test.describe("live YouTube RYD read-only smoke", () => {
  let browser;
  let context;
  let diagnostics;
  let page;
  let driver;
  let runtimeAdapter;
  let selectedExtensionId = null;
  let sessionPage;
  let currentReadOnlyScenarioId = null;
  const readOnlyGate = new LiveReadOnlyGate(REQUIRED_READ_ONLY_SCENARIOS);

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(options.cdpConnectTimeoutMilliseconds + 15_000);
    try {
      browser = await chromium.connectOverCDP(options.cdpEndpoint, {
        isLocal: true,
        noDefaults: true,
        timeout: options.cdpConnectTimeoutMilliseconds,
      });
    } catch (error) {
      throw new Error(
        `Could not attach to the running Chrome/Chromium profile. Enable remote debugging in the target browser and set RYD_CDP_ENDPOINT to its WebSocket, HTTP, host:port, or browser-alias endpoint, then retry. ${error.message}`,
      );
    }

    const selectedSession = await selectAuthenticatedYoutubeContext(browser, options.expectedChannel);
    context = selectedSession.context;
    sessionPage = selectedSession.sessionPage;
    console.log(
      `AUTHENTICATED_CHROMIUM_CONTEXT_SELECTED context=${selectedSession.contextIndex + 1} page=${selectedSession.pageIndex + 1} handle=${options.expectedChannel}`,
    );
    if (options.runtime === "extension") {
      const reloaded = await reloadLiveExtensionInBrowser({
        browser,
        context,
        expectedBuildId: options.expectedBuildId,
        expectedVersion: options.expectedVersion,
        sessionPage,
      });
      selectedExtensionId = reloaded.extensionId;
      console.log(`LIVE_EXTENSION_RELOADED ${JSON.stringify(reloaded)}`);
    }
  });

  test.beforeEach(async () => {
    currentReadOnlyScenarioId = null;
    page = await context.newPage();
    diagnostics = new LiveRunDiagnostics(page, context, { runtime: options.runtime, selectedExtensionId });
    await diagnostics.start();
    driver = new LiveYoutubeDriver(page, context, {
      authenticatedHandle: options.expectedChannel,
      expectedBuildId: options.expectedBuildId,
      reportProgress: (name, details) => diagnostics.checkpoint(name, details),
      selectedExtensionId,
    });
    const createAdapter =
      options.runtime === "extension" ? createExtensionLiveRuntimeAdapter : createUserscriptLiveRuntimeAdapter;
    runtimeAdapter = createAdapter({
      driver,
      expectedBuildId: options.expectedBuildId,
      expectedVersion: options.expectedVersion,
    });
  });

  test.afterEach(async ({}, testInfo) => {
    if (!diagnostics) return;
    let lateSignalError = null;
    let snapshotError = null;
    try {
      if (driver?.trafficLedger) {
        await driver.assertNoUnclaimedAttributedTraffic(`Playwright scenario ${testInfo.title}`);
      }
    } catch (error) {
      lateSignalError = error;
    }
    try {
      diagnostics.consumeFatalSignals(`after ${testInfo.title}`);
    } catch (error) {
      lateSignalError = lateSignalError
        ? new AggregateError([lateSignalError, error], "Late traffic and browser diagnostics both failed.")
        : error;
    }
    try {
      if (lateSignalError || testInfo.status !== testInfo.expectedStatus) {
        const error =
          lateSignalError ?? testInfo.errors.at(-1) ?? new Error(`${testInfo.title} failed without an attached error.`);
        const snapshotPath = await diagnostics.persistFailureSnapshot(error);
        await testInfo.attach("live-failure-snapshot", { contentType: "application/json", path: snapshotPath });
      }
    } catch (error) {
      snapshotError = error;
    } finally {
      if (currentReadOnlyScenarioId) {
        const completed = !lateSignalError && !snapshotError && testInfo.status === "passed";
        readOnlyGate.record(currentReadOnlyScenarioId, completed ? testInfo.status : "failed");
      }
      driver?.stop();
      diagnostics.stop();
      if (page && !page.isClosed()) await page.close();
      diagnostics = null;
      driver = null;
      page = null;
      runtimeAdapter = null;
    }
    if (lateSignalError && snapshotError) {
      throw new AggregateError(
        [lateSignalError, snapshotError],
        "A late fatal browser signal and snapshot failure occurred.",
      );
    }
    if (lateSignalError) throw lateSignalError;
    if (snapshotError) throw snapshotError;
  });

  test.afterAll(async () => {
    try {
      readOnlyGate.assertPassed();
      console.log(
        `LIVE_VALIDATION_READ_ONLY_COMPLETE ${JSON.stringify({
          classification: "read-only",
          productionReactionsCompleted: false,
          releaseReady: false,
        })}`,
      );
    } finally {
      if (browser) await browser.close();
    }
  });

  const runScenario = (scenarioId, services) =>
    runLoggedStage(diagnostics, `playwright.${scenarioId}`, () =>
      scenarioRunner.run(runtimeAdapter, scenarioId, options, services),
    );

  const runReadOnlyScenario = (scenarioId) => {
    currentReadOnlyScenarioId = scenarioId;
    return runScenario(scenarioId);
  };

  test(`${options?.runtime || "runtime"}: renders on an allowlisted Short`, async () => {
    await runReadOnlyScenario("shorts-render");
  });

  test(`${options?.runtime || "runtime"}: audits ten-plus successful Shorts Next-video SPA samples`, async () => {
    test.setTimeout(120_000 + options.navigation.shortsNextHops * 2 * 45_000);
    await runReadOnlyScenario("channel-shorts-navigation");
  });

  test(`${options?.runtime || "runtime"}: initializes after cold channel-to-watch SPA navigation`, async () => {
    test.setTimeout(120_000);
    await runReadOnlyScenario("channel-watch-navigation");
  });

  test(`${options?.runtime || "runtime"}: renders on a signed-in watch page`, async () => {
    await runReadOnlyScenario("watch-render");
  });

  test(`${options?.runtime || "runtime"}: reinitializes after reload`, async () => {
    await runReadOnlyScenario("reload");
  });

  test(`${options?.runtime || "runtime"}: reinitializes after real playlist SPA navigation`, async () => {
    await runReadOnlyScenario("spa-navigation");
  });

  test(`${options?.runtime || "runtime"}: preserves the complete Watch action topology`, async () => {
    test.setTimeout(240_000);
    await runReadOnlyScenario("watch-action-topology");
  });

  test(`${options?.runtime || "runtime"}: survives consecutive real sidebar SPA navigations`, async () => {
    test.setTimeout(60_000 + options.sidebar.hopCount * 75_000);
    await runReadOnlyScenario("sidebar-navigation-stress");
  });

  test(`${options?.runtime || "runtime"}: preserves reaction UI geometry across responsive widths`, async () => {
    test.setTimeout(180_000);
    await runReadOnlyScenario("responsive-visual");
  });
});
