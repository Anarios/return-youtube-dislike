const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, openWatchFixture } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);

test("bundled selectors initialize Watch when the remote selector request never settles", async () => {
  expect(
    fs.existsSync(path.join(EXTENSION_ARTIFACT, "manifest.json")),
    `The generated Chrome extension artifact is missing at ${EXTENSION_ARTIFACT}`,
  ).toBe(true);

  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    selectorResponse: () => new Promise(() => {}),
  });

  try {
    await adapter.start();
    adapter.page.setDefaultTimeout(4_000);
    await openWatchFixture(adapter.page, VIDEO_A);

    const result = await adapter.waitForWatchResult(VIDEO_A);
    expect(result).toMatchObject({
      actionSurfaceVisible: true,
      count: "25",
      countVisible: true,
      fillVisible: true,
      ownedByExpectedWatch: true,
      rateBarVisible: true,
      sameActionSurface: true,
      videoId: VIDEO_A,
    });

    const selectorRequests = adapter.backend.requestsFor("GET", "/configs/selectors");
    expect(selectorRequests).toHaveLength(1);
    expect(selectorRequests[0].respondedAt).toBeUndefined();
    expect(adapter.backend.requestsFor("GET", "/votes").map(({ query }) => query.videoId)).toEqual([VIDEO_A]);
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
    await adapter.pageSignals.assertClean("hanging-selector-startup-fallback");
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
});
