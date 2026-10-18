const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openWatchFixture,
} = require("./harness");
const {
  USERSCRIPT_WATCH_VISUAL_PROFILE,
  attachVisualFailureScreenshot,
  expectNoStructuralLayoutShift,
  expectWatchVisualState,
  readWatchVisualContract,
  waitForBarRatio,
} = require("../../e2e/watch-visual-contract");
const { getWatchNeutralBaselineId, registerWatchVisualContract } = require("../../e2e/watch-visual-scenarios");
const { annotateVisualEvidence, captureOptionalVisualEvidence } = require("../../e2e/visual-evidence");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const VISUAL_REVIEW_DIRECTORY = path.join(REPOSITORY_ROOT, "test-results", "visual-review", "userscript");
const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const BASE_COUNTS = { likes: 300, dislikes: 100 };

async function captureVisualReview(page, name) {
  const outputPath = path.join(VISUAL_REVIEW_DIRECTORY, `${name}.png`);
  return captureOptionalVisualEvidence({
    capture: async (screenshotPath) => {
      fs.mkdirSync(VISUAL_REVIEW_DIRECTORY, { recursive: true });
      await page.locator("#top-row").screenshot({
        animations: "disabled",
        path: screenshotPath,
      });
    },
    outputPath,
  });
}

function monitorRuntime(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}

async function launchVisualFixture({ context, page }, initialState) {
  const runtime = monitorRuntime(page);
  const backend = createFakeBackend({
    countsByVideo: { [VIDEO_A]: BASE_COUNTS },
    fixture: { initialState },
  });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openWatchFixture(page, VIDEO_A);
  await injectGeneratedUserscript(page);

  await expect(page.locator('[data-ryd-role="dislike"] #text')).toHaveText(String(BASE_COUNTS.dislikes));
  await expect(page.locator(USERSCRIPT_WATCH_VISUAL_PROFILE.container)).toBeVisible();
  return { backend, ...runtime };
}

registerWatchVisualContract({
  runtime: "userscript",
  test,
  async runScenario({ fixtures: { context, page }, scenario, testInfo }) {
    const { transition, viewport } = scenario;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    try {
      const harness = await launchVisualFixture({ context, page }, transition.initialState);
      const before = await readWatchVisualContract(page, USERSCRIPT_WATCH_VISUAL_PROFILE);
      expectWatchVisualState(before, transition.initialState, BASE_COUNTS, viewport, USERSCRIPT_WATCH_VISUAL_PROFILE);
      const neutralBaselineId = getWatchNeutralBaselineId(scenario);
      if (neutralBaselineId) {
        annotateVisualEvidence(testInfo, await captureVisualReview(page, neutralBaselineId));
      }

      await page.locator(`[data-ryd-role="${transition.action}"] button`).click();
      await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);

      const nextCounts = {
        likes: BASE_COUNTS.likes + transition.likesDelta,
        dislikes: BASE_COUNTS.dislikes + transition.dislikesDelta,
      };
      await waitForBarRatio(page, nextCounts, USERSCRIPT_WATCH_VISUAL_PROFILE);
      const after = await readWatchVisualContract(page, USERSCRIPT_WATCH_VISUAL_PROFILE);
      expectWatchVisualState(after, transition.nextState, nextCounts, viewport, USERSCRIPT_WATCH_VISUAL_PROFILE);
      expectNoStructuralLayoutShift(before, after);

      expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);
      expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
      expect(harness.backend.requestsFor("POST", "/interact/vote")[0].body).toMatchObject({
        userId: EXISTING_CREDENTIALS.userId,
        value: transition.value,
        videoId: VIDEO_A,
      });
      expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(1);
      expect(harness.backend.blockedRequests).toEqual([]);
      expect(harness.consoleErrors).toEqual([]);
      expect(harness.pageErrors).toEqual([]);
      annotateVisualEvidence(testInfo, await captureVisualReview(page, scenario.id));
    } catch (error) {
      await attachVisualFailureScreenshot(testInfo, page, scenario.id);
      throw error;
    }
  },
});
