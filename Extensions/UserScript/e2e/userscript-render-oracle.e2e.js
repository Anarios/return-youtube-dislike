const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("./harness");
const { HermeticUserscriptArtifactAdapter } = require("../../e2e/hermetic-artifact-smoke");

const PRODUCTION_API_ORIGIN = "https://returnyoutubedislikeapi.com";

function removeOwnedOracleDirectory(directory) {
  const resolved = path.resolve(directory);
  expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^ryd-userscript-render-oracle-/);
  fs.rmSync(resolved, { force: true, recursive: true });
}

test("the render oracle rejects a generated userscript whose runtime body does nothing", async () => {
  const oracleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-userscript-render-oracle-"));
  const brokenArtifact = path.join(oracleRoot, "Return Youtube Dislike.user.js");
  fs.writeFileSync(brokenArtifact, `void ${JSON.stringify(PRODUCTION_API_ORIGIN)};`);

  const adapter = new HermeticUserscriptArtifactAdapter({ artifactPath: brokenArtifact });

  try {
    await adapter.start();
    adapter.page.setDefaultTimeout(1_500);
    await adapter.openWatch(VIDEO_A);

    await expect(adapter.waitForWatchResult(VIDEO_A)).rejects.toThrow(/Timeout|did not render/i);
    await expect(adapter.page.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
    await expect(adapter.page.locator("#return-youtube-dislike-bar")).toHaveCount(0);
    await expect(
      adapter.page.locator(
        "dislike-button-view-model #text, " +
          "dislike-button-view-model [role='text'], " +
          "dislike-button-view-model .ytSpecButtonShapeNextButtonTextContent",
      ),
    ).toHaveCount(0);
  } finally {
    await adapter.close().catch(() => {});
    removeOwnedOracleDirectory(oracleRoot);
  }
});
