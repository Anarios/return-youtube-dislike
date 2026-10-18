const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION = 1;
const USERSCRIPT_BUILD_RECEIPT_FILENAME = "userscript-build-receipt.json";
const USERSCRIPT_ARTIFACT_RELATIVE_PATH = "Extensions/UserScript/Return Youtube Dislike.user.js";
const USERSCRIPT_LIVE_ARTIFACT_RELATIVE_PATH = "test-results/live-build/userscript/Return Youtube Dislike.user.js";
const USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH = "test-results/build-receipts/userscript-production.json";
const USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH = "test-results/live-build/userscript/userscript-build-receipt.json";
const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;
const TEST_FILE_PATTERN = /(?:^|[.])(e2e|spec|test)\.[cm]?[jt]sx?$/i;
const STATIC_BUILD_INPUTS = Object.freeze([
  ".babelrc",
  ".nvmrc",
  "package-lock.json",
  "package.json",
  "userscript-build-receipt.js",
  "webpack.live-build-marker.js",
  "webpack.userscript.config.js",
  "Extensions/UserScript/userscript.meta.js",
  "Extensions/UserScript/userscript-version.json",
]);

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function listSourceFiles(repositoryRoot, relativeDirectory) {
  const files = [];
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  assert.ok(
    fs.statSync(absoluteDirectory).isDirectory(),
    `Missing userscript build input directory ${relativeDirectory}.`,
  );

  function visit(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryRelativePath = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(path.join(directory, entry.name), entryRelativePath);
      else if (entry.isFile() && !TEST_FILE_PATTERN.test(entry.name)) {
        files.push(normalizeRelativePath(entryRelativePath));
      }
    }
  }

  visit(absoluteDirectory, relativeDirectory);
  return files;
}

function collectUserscriptBuildInputs(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const inputs = [
    ...STATIC_BUILD_INPUTS,
    ...listSourceFiles(root, path.join("Extensions", "UserScript", "src")),
    ...listSourceFiles(root, path.join("Extensions", "common")),
  ];
  const uniqueInputs = [...new Set(inputs.map(normalizeRelativePath))].sort(comparePaths);
  for (const relativePath of uniqueInputs) {
    assert.ok(fs.statSync(path.join(root, relativePath)).isFile(), `Missing userscript build input ${relativePath}.`);
  }
  return uniqueInputs;
}

function hashFiles(repositoryRoot, relativePaths) {
  const root = path.resolve(repositoryRoot);
  const hash = crypto.createHash("sha256");
  for (const relativePath of relativePaths) {
    const contents = fs.readFileSync(path.join(root, relativePath));
    hash.update(relativePath, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(contents.length), "utf8");
    hash.update("\0", "utf8");
    hash.update(contents);
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function createUserscriptBuildReceipt(repositoryRoot, { artifactPath, buildId = "", liveTestBuild, mode }) {
  assert.equal(typeof mode, "string", "The userscript build mode must be a string.");
  assert.equal(typeof liveTestBuild, "boolean", "The userscript receipt must declare whether it is a live build.");
  if (liveTestBuild) {
    assert.match(buildId, LIVE_BUILD_ID_PATTERN, "A live userscript receipt requires an exact build ID.");
  } else {
    assert.equal(buildId, "", "A production userscript receipt must not contain a live build ID.");
  }
  const root = path.resolve(repositoryRoot);
  const inputs = collectUserscriptBuildInputs(root);
  return {
    artifactPath: normalizeRelativePath(path.relative(root, path.resolve(artifactPath))),
    buildId,
    inputHash: hashFiles(root, inputs),
    inputHashAlgorithm: "sha256",
    inputs,
    liveTestBuild,
    mode,
    schemaVersion: USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION,
  };
}

function writeUserscriptBuildReceipt(receiptPath, artifactPath, receipt) {
  const completedReceipt = { ...receipt, artifactHash: sha256(artifactPath) };
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(completedReceipt, null, 2)}\n`);
  return completedReceipt;
}

function verifyUserscriptBuildReceipt({
  artifactPath,
  expectedBuildId = "",
  liveTestBuild,
  receiptPath,
  repositoryRoot,
}) {
  const root = path.resolve(repositoryRoot);
  assert.ok(fs.existsSync(receiptPath), `Missing userscript build receipt ${receiptPath}; rebuild before testing.`);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(
    receipt.schemaVersion,
    USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION,
    "The userscript build receipt schema is invalid.",
  );
  assert.equal(receipt.mode, "production", "The userscript artifact was not produced in production mode.");
  assert.equal(receipt.liveTestBuild, liveTestBuild, "The userscript receipt belongs to the wrong artifact kind.");
  assert.equal(receipt.buildId, expectedBuildId, "The userscript receipt belongs to a different live build.");
  assert.equal(receipt.inputHashAlgorithm, "sha256", "The userscript build receipt uses an unknown hash algorithm.");
  assert.equal(
    receipt.artifactPath,
    normalizeRelativePath(path.relative(root, path.resolve(artifactPath))),
    "The userscript receipt belongs to a different artifact path.",
  );

  const current = createUserscriptBuildReceipt(root, {
    artifactPath,
    buildId: expectedBuildId,
    liveTestBuild,
    mode: "production",
  });
  assert.deepEqual(receipt.inputs, current.inputs, "Userscript build inputs changed after the artifact was generated.");
  assert.equal(
    receipt.inputHash,
    current.inputHash,
    "Userscript build inputs changed after the artifact was generated; rebuild before testing.",
  );
  assert.ok(fs.statSync(artifactPath).isFile(), `Missing generated userscript artifact ${artifactPath}.`);
  assert.equal(receipt.artifactHash, sha256(artifactPath), "The generated userscript differs from its build receipt.");
  return receipt;
}

class UserscriptBuildReceiptPlugin {
  constructor({ artifactPath, buildId, liveTestBuild, mode, receiptPath, repositoryRoot }) {
    this.artifactPath = artifactPath;
    this.buildId = buildId;
    this.liveTestBuild = liveTestBuild;
    this.mode = mode;
    this.receipt = null;
    this.receiptPath = receiptPath;
    this.repositoryRoot = repositoryRoot;
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tap("UserscriptBuildReceiptPlugin", () => {
      const outputPath = compiler.options.output?.path;
      const outputFilename = compiler.options.output?.filename;
      const emittedArtifactPath =
        typeof outputPath === "string" && typeof outputFilename === "string"
          ? path.resolve(outputPath, outputFilename)
          : null;

      this.receipt = null;
      if (emittedArtifactPath !== path.resolve(this.artifactPath)) return;

      this.receipt = createUserscriptBuildReceipt(this.repositoryRoot, this);
    });
    compiler.hooks.afterEmit.tap("UserscriptBuildReceiptPlugin", () => {
      if (!this.receipt) return;
      writeUserscriptBuildReceipt(this.receiptPath, this.artifactPath, this.receipt);
    });
  }
}

module.exports = {
  USERSCRIPT_ARTIFACT_RELATIVE_PATH,
  USERSCRIPT_BUILD_RECEIPT_FILENAME,
  USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH,
  USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION,
  USERSCRIPT_LIVE_ARTIFACT_RELATIVE_PATH,
  USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH,
  UserscriptBuildReceiptPlugin,
  collectUserscriptBuildInputs,
  createUserscriptBuildReceipt,
  verifyUserscriptBuildReceipt,
  writeUserscriptBuildReceipt,
};
