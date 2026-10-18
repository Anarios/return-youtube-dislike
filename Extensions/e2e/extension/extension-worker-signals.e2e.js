const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const INTENTIONAL_REJECTION = "intentional MV3 rejection probe";

test("the runtime guard detects an unhandled rejection in the real MV3 worker", async () => {
  expect(
    fs.existsSync(path.join(EXTENSION_ARTIFACT, "manifest.json")),
    `The generated Chrome extension artifact is missing at ${EXTENSION_ARTIFACT}`,
  ).toBe(true);

  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({ apiServer, artifactDirectory: EXTENSION_ARTIFACT });
  try {
    await adapter.start();
    await adapter.worker.evaluate((message) => {
      void Promise.reject(new Error(message));
    }, INTENTIONAL_REJECTION);

    await expect
      .poll(() => apiServer.workerSignals.some((signal) => signal.message === INTENTIONAL_REJECTION))
      .toBe(true);
    await expect(adapter.pageSignals.assertClean("intentional-worker-rejection-negative-control")).rejects.toThrow(
      new RegExp(INTENTIONAL_REJECTION),
    );

    expect(apiServer.unexpectedRequests).toEqual([]);
    expect(adapter.backend.blockedRequests).toEqual([]);
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
});
