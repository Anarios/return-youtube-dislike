const assert = require("node:assert/strict");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  ACTION_OVERFLOW_SCENARIOS,
  OPTIONAL_ACTIONS,
  assertActionOverflowScenario,
} = require("../action-overflow-contract");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const { DEFAULT_VIDEO_ID, createExtensionActionOverflowFixture } = require("./extension-action-overflow-fixture");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const DESTINATION_VIDEO_ID = "overflow002";

async function withOverflowFixture(testInfo, { hideClutterButtons = false } = {}, run) {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions: { countsByVideo: { [DEFAULT_VIDEO_ID]: { dislikes: 6600, likes: 501000 } } },
  });
  const unexpectedRequests = [];
  let caughtError = null;

  try {
    await adapter.start();
    await expect
      .poll(() =>
        adapter.worker.evaluate(async () => (await chrome.storage.sync.get(["hideClutterButtons"])).hideClutterButtons),
      )
      .toBe(false);
    await adapter.worker.evaluate(
      (enabled) => chrome.storage.sync.set({ hideClutterButtons: enabled }),
      hideClutterButtons,
    );
    await expect
      .poll(() =>
        adapter.worker.evaluate(async () => (await chrome.storage.sync.get(["hideClutterButtons"])).hideClutterButtons),
      )
      .toBe(hideClutterButtons);
    await adapter.context.route("https://www.youtube.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.resourceType() === "document" && url.pathname === "/watch") {
        await route.fulfill({
          body: createExtensionActionOverflowFixture({ initialVideoId: url.searchParams.get("v") || DEFAULT_VIDEO_ID }),
          contentType: "text/html; charset=utf-8",
          status: 200,
        });
        return;
      }
      unexpectedRequests.push({ method: request.method(), resourceType: request.resourceType(), url: request.url() });
      await route.abort("blockedbyclient");
    });

    await adapter.page.goto(`https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}&rydOverflowFixture=1`, {
      waitUntil: "domcontentloaded",
    });
    await adapter.page.waitForFunction(() => Boolean(globalThis.__actionOverflowFixture));
    await adapter.page.waitForTimeout(250);
    await adapter.page.evaluate(() => globalThis.__actionOverflowFixture.mount());
    await adapter.page.waitForFunction(() => globalThis.__actionOverflowFixture.isPatched());
    await run({ adapter, page: adapter.page });
    expect(unexpectedRequests).toEqual([]);
    await adapter.pageSignals.assertClean(testInfo.title);
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    if (caughtError && adapter.context) {
      const screenshotPath = testInfo.outputPath("action-overflow-failure.png");
      await adapter.page.screenshot({ fullPage: true, path: screenshotPath }).catch(() => {});
      await testInfo.attach("action-overflow-page", { contentType: "image/png", path: screenshotPath }).catch(() => {});
    }
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

async function settleAndRead(page, scenario) {
  await page.evaluate(
    (availableWidth) => globalThis.__actionOverflowFixture.settleLayout(availableWidth),
    scenario.availableWidth,
  );
  await expect
    .poll(() => page.evaluate(() => globalThis.__actionOverflowFixture.snapshot()), {
      message: `${scenario.id} did not settle to the expected minimal overflow`,
    })
    .toMatchObject({
      availableWidth: scenario.availableWidth,
      duplicateActionIds: [],
      globalActionCount: OPTIONAL_ACTIONS.length,
      menuCount: 1,
      moreButtonCount: 1,
      overflowActionIds: [...scenario.expectedOverflow],
      patched: true,
      reactionGroupCount: 1,
      topLevelActionIds: [...scenario.expectedTopLevel],
    });
  await page.waitForTimeout(180);
  const snapshot = await page.evaluate(() => globalThis.__actionOverflowFixture.snapshot());
  assertActionOverflowScenario(snapshot, scenario, assert);
  return snapshot;
}

test.describe("built extension watch action overflow", () => {
  for (const scenario of ACTION_OVERFLOW_SCENARIOS.filter(({ hideClutterButtons }) => !hideClutterButtons)) {
    test(`${scenario.id} hides exactly the minimum`, async ({}, testInfo) => {
      await withOverflowFixture(testInfo, {}, async ({ page }) => {
        await settleAndRead(page, scenario);
      });
    });
  }

  test("hide-clutter preference keeps only the reaction group top-level", async ({}, testInfo) => {
    const scenario = ACTION_OVERFLOW_SCENARIOS.find(({ hideClutterButtons }) => hideClutterButtons);
    const roomyScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "roomy-keeps-every-optional-action");
    await withOverflowFixture(testInfo, { hideClutterButtons: true }, async ({ adapter, page }) => {
      await expect(page.locator("html")).toHaveAttribute("data-ryd-hide-clutter-buttons", "true");
      const snapshot = await settleAndRead(page, scenario);
      expect(snapshot).toMatchObject({
        clutterShareCommandPreserved: true,
        clutterShareModelPresent: true,
      });
      await page.locator("[data-fixture-more]").click();
      const overflowMenu = page.locator("[data-fixture-overflow-menu]");
      await expect(overflowMenu).toBeVisible();
      await overflowMenu.locator('[data-fixture-action="share"] button').click();
      await expect
        .poll(() => page.evaluate(() => globalThis.__actionOverflowFixture.snapshot().activationLog))
        .toEqual(["share"]);

      await adapter.worker.evaluate(() => chrome.storage.sync.set({ hideClutterButtons: false }));
      await expect(page.locator("html")).toHaveAttribute("data-ryd-hide-clutter-buttons", "false");
      await settleAndRead(page, roomyScenario);

      await adapter.worker.evaluate(() => chrome.storage.sync.set({ hideClutterButtons: true }));
      await expect(page.locator("html")).toHaveAttribute("data-ryd-hide-clutter-buttons", "true");
      await settleAndRead(page, scenario);
    });
  });

  test("resize and navigation restore actions, recompute minimal overflow, and never duplicate controls", async ({}, testInfo) => {
    const scenarios = Object.fromEntries(ACTION_OVERFLOW_SCENARIOS.map((scenario) => [scenario.id, scenario]));
    await withOverflowFixture(testInfo, {}, async ({ page }) => {
      await settleAndRead(page, scenarios["two-button-overflow-hides-two"]);
      await settleAndRead(page, scenarios["roomy-keeps-every-optional-action"]);
      await settleAndRead(page, scenarios["three-button-overflow-hides-three"]);

      const destinationScenario = scenarios["one-button-overflow-hides-one"];
      await page.evaluate(
        ({ availableWidth, videoId }) => globalThis.__actionOverflowFixture.navigate(videoId, availableWidth),
        { availableWidth: destinationScenario.availableWidth, videoId: DESTINATION_VIDEO_ID },
      );
      await page.waitForFunction(() => globalThis.__actionOverflowFixture.isPatched());
      await settleAndRead(page, destinationScenario);

      const destination = await page.evaluate(() => globalThis.__actionOverflowFixture.snapshot());
      expect(destination).toMatchObject({
        globalActionCount: OPTIONAL_ACTIONS.length,
        menuCount: 1,
        navigationCount: 2,
        videoId: DESTINATION_VIDEO_ID,
      });
      await expect(page.locator("ytd-menu-renderer.ytd-watch-metadata")).toHaveCount(1);
      await expect(page.locator("[data-fixture-action]")).toHaveCount(OPTIONAL_ACTIONS.length);
      await expect(page.locator("segmented-like-dislike-button-view-model")).toHaveCount(1);
      await expect(page.locator("[data-fixture-more]")).toHaveCount(1);
    });
  });

  test("widening restores flexible actions without a model reset", async ({}, testInfo) => {
    const narrowScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "three-button-overflow-hides-three");
    const widerScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "one-button-overflow-hides-one");
    await withOverflowFixture(testInfo, {}, async ({ page }) => {
      await settleAndRead(page, narrowScenario);

      await page.evaluate(
        (availableWidth) => globalThis.__actionOverflowFixture.resizeLayout(availableWidth),
        widerScenario.availableWidth,
      );
      await expect
        .poll(() => page.evaluate(() => globalThis.__actionOverflowFixture.snapshot()), {
          message: "widening did not restore optional actions before native fitting",
        })
        .toMatchObject({
          overflowActionIds: [...widerScenario.expectedOverflow],
          topLevelActionIds: [...widerScenario.expectedTopLevel],
        });

      const snapshot = await page.evaluate(() => globalThis.__actionOverflowFixture.snapshot());
      assertActionOverflowScenario(snapshot, widerScenario, assert);
    });
  });

  test("widening restores flexible actions after same-video menu data identity churn", async ({}, testInfo) => {
    const narrowScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "three-button-overflow-hides-three");
    const widerScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "one-button-overflow-hides-one");
    await withOverflowFixture(testInfo, {}, async ({ page }) => {
      await settleAndRead(page, narrowScenario);

      await page.evaluate(
        (availableWidth) => globalThis.__actionOverflowFixture.resizeLayoutAfterDataIdentityChurn(availableWidth),
        widerScenario.availableWidth,
      );
      await expect
        .poll(() => page.evaluate(() => globalThis.__actionOverflowFixture.snapshot()), {
          message: "same-video menu data churn discarded optional actions before the wider layout",
        })
        .toMatchObject({
          overflowActionIds: [...widerScenario.expectedOverflow],
          topLevelActionIds: [...widerScenario.expectedTopLevel],
        });

      const snapshot = await page.evaluate(() => globalThis.__actionOverflowFixture.snapshot());
      assertActionOverflowScenario(snapshot, widerScenario, assert);
    });
  });

  test("a ResizeObserver refits actions when YouTube does not promptly notify its controller", async ({}, testInfo) => {
    const narrowScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "three-button-overflow-hides-three");
    const widerScenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "one-button-overflow-hides-one");
    await withOverflowFixture(testInfo, {}, async ({ page }) => {
      await settleAndRead(page, narrowScenario);

      await page.evaluate(
        (availableWidth) => globalThis.__actionOverflowFixture.resizeLayoutWithoutNativeNotification(availableWidth),
        widerScenario.availableWidth,
      );
      await expect
        .poll(() => page.evaluate(() => globalThis.__actionOverflowFixture.snapshot()), {
          message: "the observed action allocation changed without triggering a fresh fit",
          timeout: 2_000,
        })
        .toMatchObject({
          overflowActionIds: [...widerScenario.expectedOverflow],
          topLevelActionIds: [...widerScenario.expectedTopLevel],
        });

      const snapshot = await page.evaluate(() => globalThis.__actionOverflowFixture.snapshot());
      assertActionOverflowScenario(snapshot, widerScenario, assert);
    });
  });
});
