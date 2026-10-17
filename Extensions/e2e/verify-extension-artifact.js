const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BUILD_RECEIPT_FILENAME,
  BUILD_RECEIPT_SCHEMA_VERSION,
  createExtensionBuildReceipt,
} = require("../../extension-build-receipt");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist");
const PRODUCTION_API_ORIGIN = "https://returnyoutubedislikeapi.com";
const BROWSER_ARTIFACTS = Object.freeze([
  Object.freeze({ directory: "chrome", manifestVersion: 3 }),
  Object.freeze({ directory: "firefox", manifestVersion: 2 }),
  Object.freeze({ directory: "safari", manifestVersion: 2 }),
]);
const REQUIRED_FILES = Object.freeze([
  "content-style.css",
  "manifest.json",
  "menu-fixer.js",
  "popup.html",
  "ryd.background.js",
  "ryd.content-script.js",
]);
const EMITTED_JS_FILES = Object.freeze(["popup.js", "ryd.background.js", "ryd.changelog.js", "ryd.content-script.js"]);
const FORBIDDEN_DIRECTORY_NAMES = new Set(["e2e", "playwright-report", "test-results"]);
const TEST_FILE_PATTERN = /(?:^|[.])(e2e|spec|test)\.[cm]?[jt]sx?$/i;

function listFiles(directory, relativeDirectory = "") {
  const files = [];
  for (const entry of fs.readdirSync(path.join(directory, relativeDirectory), { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(directory, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function verifyContentScriptManifest(manifest, browserDirectory) {
  const contentScript = manifest.content_scripts?.find(
    ({ css = [], js = [] }) => js.includes("ryd.content-script.js") && css.includes("content-style.css"),
  );
  assert.ok(contentScript, `${browserDirectory} manifest does not load the built content script and stylesheet.`);
}

function manifestExposesWebAccessibleResource(manifest, resource) {
  return (manifest.web_accessible_resources ?? []).some((entry) => {
    if (typeof entry === "string") return entry === resource;
    return Array.isArray(entry?.resources) && entry.resources.includes(resource);
  });
}

function verifyPageWorldHelperManifest(manifest, browserDirectory) {
  assert.ok(
    manifestExposesWebAccessibleResource(manifest, "menu-fixer.js"),
    `${browserDirectory} manifest does not expose menu-fixer.js to YouTube pages.`,
  );
}

function verifyStandaloneMv3Artifact(artifactDirectory) {
  const directory = path.resolve(artifactDirectory);
  assert.ok(fs.statSync(directory).isDirectory(), `Missing custom extension artifact ${directory}.`);
  const manifestPath = path.join(directory, "manifest.json");
  assert.ok(fs.statSync(manifestPath).isFile(), `The custom extension artifact has no manifest.json.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.manifest_version, 3, "The custom extension artifact must use Manifest V3.");
  assert.equal(
    manifest.background?.service_worker,
    "ryd.background.js",
    "The custom extension artifact must declare the built background worker.",
  );
  const contentScript = manifest.content_scripts?.find(
    ({ css = [], js = [] }) => js.includes("ryd.content-script.js") && css.includes("content-style.css"),
  );
  assert.ok(contentScript, "The custom extension artifact must declare its built content script and stylesheet.");
  for (const asset of new Set([manifest.background.service_worker, ...contentScript.js])) {
    assertProductionJavaScriptOutput(path.join(directory, asset), asset);
  }
  for (const asset of [manifest.background.service_worker, "ryd.content-script.js"]) {
    assert.ok(
      fs.readFileSync(path.join(directory, asset), "utf8").includes(PRODUCTION_API_ORIGIN),
      `${asset} is not a production API artifact.`,
    );
  }
  assert.ok(
    fs.statSync(path.join(directory, "content-style.css")).isFile(),
    "The custom extension artifact is missing content-style.css.",
  );
  return { directory, manifestVersion: manifest.manifest_version, version: manifest.version };
}

function verifyBrowserArtifact({ directory, manifestVersion }) {
  const artifactDirectory = path.join(DIST_ROOT, directory);
  assert.ok(fs.statSync(artifactDirectory).isDirectory(), `Missing generated ${directory} artifact.`);

  for (const requiredFile of REQUIRED_FILES) {
    assert.ok(
      fs.statSync(path.join(artifactDirectory, requiredFile)).isFile(),
      `${directory} is missing ${requiredFile}.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(artifactDirectory, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, manifestVersion, `${directory} has the wrong manifest version.`);
  assert.equal(
    fs.existsSync(path.join(artifactDirectory, BUILD_RECEIPT_FILENAME)),
    false,
    `${directory} must not package the root-only build receipt.`,
  );
  verifyContentScriptManifest(manifest, directory);
  verifyPageWorldHelperManifest(manifest, directory);
  if (directory === "chrome") {
    assert.equal(manifest.background?.service_worker, "ryd.background.js", "Chrome must load the built MV3 worker.");
  }
  for (const bundle of ["ryd.background.js", "ryd.content-script.js"]) {
    assert.ok(
      fs.readFileSync(path.join(artifactDirectory, bundle), "utf8").includes(PRODUCTION_API_ORIGIN),
      `${directory}/${bundle} is not a production API artifact.`,
    );
  }

  const files = listFiles(artifactDirectory);
  const forbiddenFiles = files.filter((relativePath) => {
    const segments = relativePath.split(path.sep).map((segment) => segment.toLowerCase());
    return (
      segments.some((segment) => FORBIDDEN_DIRECTORY_NAMES.has(segment)) ||
      TEST_FILE_PATTERN.test(path.basename(relativePath)) ||
      path.basename(relativePath).toLowerCase() === "live-build.json"
    );
  });
  assert.deepEqual(
    forbiddenFiles,
    [],
    `${directory} contains test-only or live-test files: ${forbiddenFiles.join(", ")}`,
  );

  return { directory, fileCount: files.length, manifestVersion };
}

function verifyBuildReceipt(distRoot = DIST_ROOT, repositoryRoot = REPOSITORY_ROOT) {
  const receiptPath = path.join(distRoot, BUILD_RECEIPT_FILENAME);
  assert.ok(
    fs.existsSync(receiptPath) && fs.statSync(receiptPath).isFile(),
    `Missing extension build receipt ${BUILD_RECEIPT_FILENAME}; run the production extension build before testing.`,
  );
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(receipt.schemaVersion, BUILD_RECEIPT_SCHEMA_VERSION, "The extension build receipt schema is invalid.");
  assert.equal(receipt.mode, "production", "The extension artifact was not produced in production mode.");
  assert.equal(receipt.inputHashAlgorithm, "sha256", "The extension build receipt uses an unknown hash algorithm.");

  const current = createExtensionBuildReceipt(repositoryRoot, "production");
  assert.deepEqual(receipt.inputs, current.inputs, "Extension build inputs changed after the artifact was generated.");
  assert.equal(
    receipt.inputHash,
    current.inputHash,
    "Extension build inputs changed after the artifact was generated; rebuild before testing.",
  );
  return receipt;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertProductionJavaScriptOutput(filePath, label = path.basename(filePath)) {
  assert.ok(fs.statSync(filePath).isFile(), `Missing JavaScript output ${label}.`);
  assert.equal(
    fs.readFileSync(filePath, "utf8").includes("sourceMappingURL=data:"),
    false,
    `${label} contains an inline source map and is not a production bundle.`,
  );
}

function verifyMirroredJavaScript(
  distRoot = DIST_ROOT,
  browserArtifacts = BROWSER_ARTIFACTS,
  emittedJsFiles = EMITTED_JS_FILES,
) {
  for (const bundle of emittedJsFiles) {
    const rootBundle = path.join(distRoot, bundle);
    assert.ok(fs.statSync(rootBundle).isFile(), `Missing emitted root bundle ${bundle}.`);
    const rootHash = sha256(rootBundle);

    for (const { directory } of browserArtifacts) {
      const mirroredBundle = path.join(distRoot, directory, bundle);
      assert.ok(fs.statSync(mirroredBundle).isFile(), `${directory} is missing mirrored bundle ${bundle}.`);
      assert.equal(
        sha256(mirroredBundle),
        rootHash,
        `${directory}/${bundle} is stale or differs from the emitted root bundle.`,
      );
    }
  }
}

function verifyProductionJavaScript(
  distRoot = DIST_ROOT,
  browserArtifacts = BROWSER_ARTIFACTS,
  emittedJsFiles = EMITTED_JS_FILES,
) {
  for (const bundle of emittedJsFiles) {
    const outputs = [
      { filePath: path.join(distRoot, bundle), label: bundle },
      ...browserArtifacts.map(({ directory }) => ({
        filePath: path.join(distRoot, directory, bundle),
        label: `${directory}/${bundle}`,
      })),
    ];

    for (const { filePath, label } of outputs) {
      assertProductionJavaScriptOutput(filePath, label);
    }
  }
}

function verifyExtensionArtifacts() {
  assert.ok(fs.statSync(DIST_ROOT).isDirectory(), `Missing extension build output: ${DIST_ROOT}`);
  verifyBuildReceipt();
  const results = BROWSER_ARTIFACTS.map(verifyBrowserArtifact);
  verifyMirroredJavaScript();
  verifyProductionJavaScript();
  return results;
}

function verifyRequestedExtensionArtifact(requestedArtifact = process.env.RYD_EXTENSION_ARTIFACT) {
  const repositoryChromeArtifact = path.join(DIST_ROOT, "chrome");
  if (!requestedArtifact || path.resolve(requestedArtifact) === path.resolve(repositoryChromeArtifact)) {
    return { kind: "repository", results: verifyExtensionArtifacts() };
  }
  return { kind: "custom", results: [verifyStandaloneMv3Artifact(requestedArtifact)] };
}

if (require.main === module) {
  try {
    const verification = verifyRequestedExtensionArtifact();
    process.stdout.write(`Verified extension artifact: ${JSON.stringify(verification)}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  EMITTED_JS_FILES,
  assertProductionJavaScriptOutput,
  manifestExposesWebAccessibleResource,
  verifyBuildReceipt,
  verifyExtensionArtifacts,
  verifyMirroredJavaScript,
  verifyProductionJavaScript,
  verifyRequestedExtensionArtifact,
  verifyStandaloneMv3Artifact,
};
