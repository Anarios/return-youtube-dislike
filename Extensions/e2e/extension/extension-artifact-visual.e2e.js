const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const {
  EXTENSION_WATCH_VISUAL_PROFILE,
  attachVisualFailureScreenshot,
  expectNoStructuralLayoutShift,
  expectWatchVisualState,
  readWatchVisualContract,
  waitForBarRatio,
} = require("../watch-visual-contract");
const { registerWatchVisualContract } = require("../watch-visual-scenarios");
const { annotateVisualEvidence, captureOptionalVisualEvidence } = require("../visual-evidence");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const BASE_COUNTS = Object.freeze({ likes: 100, dislikes: 25 });
const VISUAL_REVIEW_DIRECTORY = path.join(REPOSITORY_ROOT, "test-results", "visual-review", "extension");

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

function nonPreflightRecords(records, startIndex = 0) {
  return records.slice(startIndex).filter((record) => record.method !== "OPTIONS");
}

async function installCurrentDesktopLayoutMarker(context) {
  await context.addInitScript(() => {
    if (!location.hostname.endsWith("youtube.com")) return;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.getElementById("comment-teaser")) return;
        const marker = document.createElement("div");
        marker.id = "comment-teaser";
        marker.hidden = true;
        document.body.append(marker);
      },
      { once: true },
    );
  });
}

async function withExtensionVisualFixture(testInfo, { initialState = "neutral", viewport }, run) {
  if (!fs.existsSync(path.join(EXTENSION_ARTIFACT, "manifest.json"))) {
    throw new Error(
      `The generated Chrome extension artifact is missing at ${EXTENSION_ARTIFACT}. ` +
        "Run the extension production build first or set RYD_EXTENSION_ARTIFACT.",
    );
  }

  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions: {
      countsByVideo: { [VIDEO_A]: BASE_COUNTS },
      fixture: { initialState, nativeDislikeText: false, roleAttribute: "data-fixture-role" },
    },
  });
  const workerErrors = [];
  let caughtError = null;

  try {
    await adapter.start();
    adapter.worker.on("console", (message) => {
      if (["assert", "error", "warning"].includes(message.type())) workerErrors.push(message.text());
    });
    await installCurrentDesktopLayoutMarker(adapter.context);
    await adapter.page.setViewportSize({ height: viewport.height, width: viewport.width });
    await adapter.openWatch(VIDEO_A);
    await adapter.waitForWatchResult(VIDEO_A);
    await expect
      .poll(() => apiServer.records.filter((record) => record.pathname === "/puzzle/registration").length)
      .toBe(2);
    await run({ adapter, apiServer, page: adapter.page, workerErrors });
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    if (caughtError || (testInfo.status && testInfo.status !== testInfo.expectedStatus)) {
      await attachVisualFailureScreenshot(testInfo, adapter.page, `${viewport.name}-${initialState}`).catch(() => {});
    }
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

async function assertCleanExtensionRuntime({ adapter, apiServer, workerErrors }, scenarioId) {
  await adapter.assertNoPageSignals(scenarioId);
  expect(workerErrors, "the MV3 background worker emitted browser warnings or errors").toEqual([]);
  expect(adapter.backend.blockedRequests, "the content script escaped the hermetic route set").toEqual([]);
  expect(apiServer.unexpectedRequests, "the MV3 background escaped the fake protocol").toEqual([]);
}

async function waitForOneVoteHandshake(apiServer, startIndex) {
  const interactions = () =>
    nonPreflightRecords(apiServer.records, startIndex).filter((record) =>
      ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
    );
  await expect.poll(() => interactions().length).toBe(2);
  await new Promise((resolve) => setTimeout(resolve, 350));
  return interactions();
}

function expectExactVoteHandshake(interactions, transition) {
  expect(interactions.map(({ method, pathname }) => ({ method, pathname }))).toEqual([
    { method: "POST", pathname: "/interact/vote" },
    { method: "POST", pathname: "/interact/confirmVote" },
  ]);
  expect(interactions[0].body).toEqual({
    userId: expect.stringMatching(/^[A-Za-z0-9]{36}$/),
    value: transition.value,
    videoId: VIDEO_A,
  });
  expect(interactions[1].body).toEqual({
    solution: expect.any(String),
    userId: interactions[0].body.userId,
    videoId: VIDEO_A,
  });
  expect(Buffer.from(interactions[1].body.solution, "base64")).toHaveLength(4);
  expect(Number.isFinite(interactions[0].respondedAt), "the vote request must receive a response").toBe(true);
  expect(interactions[0].responseStatus, "the vote response must be successful").toBeGreaterThanOrEqual(200);
  expect(interactions[0].responseStatus, "the vote response must be successful").toBeLessThan(300);
  expect(Number.isFinite(interactions[1].respondedAt), "the confirmation request must receive a response").toBe(true);
  expect(interactions[1].responseStatus, "the confirmation response must be successful").toBeGreaterThanOrEqual(200);
  expect(interactions[1].responseStatus, "the confirmation response must be successful").toBeLessThan(300);
  expect(interactions[1].responseBody).toBe(true);
}

registerWatchVisualContract({
  runtime: "extension",
  test,
  async runScenario({ scenario, testInfo }) {
    const { transition, viewport } = scenario;
    await withExtensionVisualFixture(testInfo, { initialState: transition.initialState, viewport }, async (runtime) => {
      const before = await readWatchVisualContract(runtime.page, EXTENSION_WATCH_VISUAL_PROFILE);
      expectWatchVisualState(before, transition.initialState, BASE_COUNTS, viewport, EXTENSION_WATCH_VISUAL_PROFILE);

      const interactionStart = runtime.apiServer.records.length;
      await runtime.page
        .locator(`[${EXTENSION_WATCH_VISUAL_PROFILE.roleAttribute}="${transition.action}"] button`)
        .click();
      const interactions = await waitForOneVoteHandshake(runtime.apiServer, interactionStart);
      const nextCounts = {
        likes: BASE_COUNTS.likes + transition.likesDelta,
        dislikes: BASE_COUNTS.dislikes + transition.dislikesDelta,
      };
      await waitForBarRatio(runtime.page, nextCounts, EXTENSION_WATCH_VISUAL_PROFILE);

      const after = await readWatchVisualContract(runtime.page, EXTENSION_WATCH_VISUAL_PROFILE);
      expectWatchVisualState(after, transition.nextState, nextCounts, viewport, EXTENSION_WATCH_VISUAL_PROFILE, {
        assertTooltipText: false,
      });
      expectNoStructuralLayoutShift(before, after);
      expectExactVoteHandshake(interactions, transition);
      expect(runtime.adapter.backend.requestsFor("GET", "/votes")).toHaveLength(1);
      expect(runtime.adapter.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
      expect(runtime.adapter.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
      annotateVisualEvidence(testInfo, await captureVisualReview(runtime.page, scenario.id));
      await assertCleanExtensionRuntime(runtime, scenario.id);
    });
  },
});
