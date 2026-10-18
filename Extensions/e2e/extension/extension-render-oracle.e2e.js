const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const PRODUCTION_API_ORIGIN = "https://returnyoutubedislikeapi.com";

function removeOwnedOracleDirectory(directory) {
  const resolved = path.resolve(directory);
  expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^ryd-render-oracle-/);
  fs.rmSync(resolved, { force: true, recursive: true });
}

test("the render oracle rejects a generated extension whose content script does nothing", async () => {
  expect(
    fs.existsSync(path.join(EXTENSION_ARTIFACT, "manifest.json")),
    `The generated Chrome extension artifact is missing at ${EXTENSION_ARTIFACT}`,
  ).toBe(true);

  const oracleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-render-oracle-"));
  const brokenArtifact = path.join(oracleRoot, "extension");
  fs.cpSync(EXTENSION_ARTIFACT, brokenArtifact, { recursive: true });
  fs.writeFileSync(
    path.join(brokenArtifact, "ryd.content-script.js"),
    `void ${JSON.stringify(PRODUCTION_API_ORIGIN)};`,
  );

  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: brokenArtifact,
    backendOptions: { fixture: { nativeDislikeText: false, roleAttribute: "data-fixture-role" } },
  });

  try {
    await adapter.start();
    adapter.page.setDefaultTimeout(1_500);
    await adapter.openWatch(VIDEO_A);

    await expect(adapter.waitForWatchResult(VIDEO_A)).rejects.toThrow(/Timeout|did not render/i);
    await expect(adapter.page.locator("#ryd-bar-container")).toHaveCount(0);
    await expect(adapter.page.locator("#ryd-bar")).toHaveCount(0);
    await expect(
      adapter.page.locator(
        "dislike-button-view-model #text, " +
          "dislike-button-view-model [role='text'], " +
          "dislike-button-view-model .ytSpecButtonShapeNextButtonTextContent",
      ),
    ).toHaveCount(0);
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
    removeOwnedOracleDirectory(oracleRoot);
  }
});
