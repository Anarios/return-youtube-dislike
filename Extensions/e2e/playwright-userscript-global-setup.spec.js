/**
 * @jest-environment node
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const userscriptPlaywrightConfig = require("../../playwright.userscript.config");
const {
  REPOSITORY_USERSCRIPT_ARTIFACT,
  receiptPathForUserscriptArtifact,
  resolveRequestedUserscriptArtifact,
} = require("./verify-userscript-artifact");
const { verifyPlaywrightUserscriptArtifact } = require("./playwright-userscript-global-setup");
const { createUserscriptBuildReceipt, writeUserscriptBuildReceipt } = require("../../userscript-build-receipt");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
let temporaryDirectory;

function createCustomArtifact(name = "Return Youtube Dislike.user.js") {
  const directory = fs.mkdtempSync(path.join(temporaryDirectory, "artifact-"));
  const artifactPath = path.join(directory, name);
  fs.writeFileSync(artifactPath, "generated userscript");
  return artifactPath;
}

function writeMatchingReceipt(artifactPath) {
  const receipt = createUserscriptBuildReceipt(REPOSITORY_ROOT, {
    artifactPath,
    liveTestBuild: false,
    mode: "production",
  });
  return writeUserscriptBuildReceipt(receiptPathForUserscriptArtifact(artifactPath), artifactPath, receipt);
}

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-userscript-playwright-"));
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { force: true, recursive: true });
});

test("the userscript Playwright config always runs the artifact freshness gate", () => {
  expect(userscriptPlaywrightConfig.globalSetup).toBe(require.resolve("./playwright-userscript-global-setup"));
});

test("the default Playwright target receives exact repository artifact verification", () => {
  const verifyArtifact = jest.fn(() => ({ kind: "repository" }));

  expect(verifyPlaywrightUserscriptArtifact({ env: {}, verifyArtifact })).toEqual({ kind: "repository" });
  expect(verifyArtifact).toHaveBeenCalledWith(REPOSITORY_USERSCRIPT_ARTIFACT);
});

test("the harness and freshness gate resolve the same custom artifact", () => {
  const requestedArtifact = path.join(temporaryDirectory, "custom.user.js");
  const previousArtifact = process.env.RYD_USERSCRIPT_ARTIFACT;

  try {
    process.env.RYD_USERSCRIPT_ARTIFACT = `  ${requestedArtifact}  `;
    jest.isolateModules(() => {
      const { GENERATED_USERSCRIPT } = require("../UserScript/e2e/harness");
      expect(GENERATED_USERSCRIPT).toBe(resolveRequestedUserscriptArtifact(requestedArtifact));
    });
  } finally {
    if (previousArtifact === undefined) delete process.env.RYD_USERSCRIPT_ARTIFACT;
    else process.env.RYD_USERSCRIPT_ARTIFACT = previousArtifact;
  }
});

test("a custom artifact with its own matching receipt passes", () => {
  const artifactPath = createCustomArtifact();
  writeMatchingReceipt(artifactPath);

  expect(verifyPlaywrightUserscriptArtifact({ env: { RYD_USERSCRIPT_ARTIFACT: artifactPath } })).toMatchObject({
    artifactPath: expect.any(String),
    artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

test("an unreceipted custom artifact is rejected", () => {
  const artifactPath = createCustomArtifact();

  expect(() => verifyPlaywrightUserscriptArtifact({ env: { RYD_USERSCRIPT_ARTIFACT: artifactPath } })).toThrow(
    /Missing userscript build receipt/,
  );
});

test("a custom artifact changed after its receipt is rejected", () => {
  const artifactPath = createCustomArtifact();
  writeMatchingReceipt(artifactPath);
  fs.writeFileSync(artifactPath, "stale generated userscript");

  expect(() => verifyPlaywrightUserscriptArtifact({ env: { RYD_USERSCRIPT_ARTIFACT: artifactPath } })).toThrow(
    /differs from its build receipt/,
  );
});

test("a receipt copied from another artifact path is rejected", () => {
  const firstArtifact = createCustomArtifact("first.user.js");
  const secondArtifact = createCustomArtifact("second.user.js");
  writeMatchingReceipt(firstArtifact);
  fs.copyFileSync(receiptPathForUserscriptArtifact(firstArtifact), receiptPathForUserscriptArtifact(secondArtifact));

  expect(() => verifyPlaywrightUserscriptArtifact({ env: { RYD_USERSCRIPT_ARTIFACT: secondArtifact } })).toThrow(
    /belongs to a different artifact path/,
  );
});
