const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BUILD_RECEIPT_FILENAME = "extension-build-receipt.json";
const BUILD_RECEIPT_SCHEMA_VERSION = 1;
const STATIC_BUILD_INPUTS = Object.freeze([
  ".babelrc",
  ".nvmrc",
  "extension-build-receipt.js",
  "package-lock.json",
  "package.json",
  "webpack.config.js",
  "webpack.live-build-marker.js",
]);
const TEST_FILE_PATTERN = /(?:^|[.])(e2e|spec|test)\.[cm]?[jt]sx?$/i;

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function listProductionFiles(repositoryRoot, relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  assert.ok(fs.statSync(absoluteDirectory).isDirectory(), `Missing build input directory ${relativeDirectory}.`);
  const files = [];

  function visit(absolutePath, relativePath) {
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      const entryRelativePath = path.join(relativePath, entry.name);
      if (entry.isDirectory()) {
        const normalized = normalizeRelativePath(entryRelativePath);
        if (normalized === "Extensions/combined/dist" || normalized === "Extensions/combined/e2e") continue;
        visit(path.join(absolutePath, entry.name), entryRelativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.toLowerCase() === "readme.md" || TEST_FILE_PATTERN.test(entry.name)) continue;
      files.push(normalizeRelativePath(entryRelativePath));
    }
  }

  visit(absoluteDirectory, relativeDirectory);
  return files;
}

function collectExtensionBuildInputs(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const inputs = [
    ...STATIC_BUILD_INPUTS,
    ...listProductionFiles(root, path.join("Extensions", "combined")),
    ...listProductionFiles(root, path.join("Extensions", "common")),
  ];
  const uniqueInputs = [...new Set(inputs.map(normalizeRelativePath))].sort(comparePaths);
  for (const relativePath of uniqueInputs) {
    assert.ok(fs.statSync(path.join(root, relativePath)).isFile(), `Missing build input ${relativePath}.`);
  }
  return uniqueInputs;
}

function hashExtensionBuildInputs(repositoryRoot, inputs = collectExtensionBuildInputs(repositoryRoot)) {
  const root = path.resolve(repositoryRoot);
  const hash = crypto.createHash("sha256");
  for (const relativePath of inputs) {
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

function createExtensionBuildReceipt(repositoryRoot, mode) {
  assert.equal(typeof mode, "string", "The extension build mode must be a string.");
  const inputs = collectExtensionBuildInputs(repositoryRoot);
  return {
    schemaVersion: BUILD_RECEIPT_SCHEMA_VERSION,
    mode,
    inputHashAlgorithm: "sha256",
    inputHash: hashExtensionBuildInputs(repositoryRoot, inputs),
    inputs,
  };
}

module.exports = {
  BUILD_RECEIPT_FILENAME,
  BUILD_RECEIPT_SCHEMA_VERSION,
  collectExtensionBuildInputs,
  createExtensionBuildReceipt,
  hashExtensionBuildInputs,
};
