/**
 * @jest-environment node
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  BUILD_RECEIPT_FILENAME,
  collectExtensionBuildInputs,
  createExtensionBuildReceipt,
} = require("./extension-build-receipt");
const { verifyBuildReceipt } = require("./Extensions/e2e/verify-extension-artifact");
const packageManifest = require("./package.json");
const createWebpackConfig = require("./webpack.config");

const STATIC_FILES = [
  ".babelrc",
  ".nvmrc",
  "extension-build-receipt.js",
  "package-lock.json",
  "package.json",
  "webpack.config.js",
  "webpack.live-build-marker.js",
];
let repositoryRoot;

function write(relativePath, contents = relativePath) {
  const filePath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

beforeEach(() => {
  repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-build-receipt-"));
  for (const file of STATIC_FILES) write(file);
  write(path.join("Extensions", "combined", "ryd.content-script.js"), "content source");
  write(path.join("Extensions", "combined", "content-style.css"), "style source");
  write(path.join("Extensions", "combined", "src", "state.spec.js"), "ignored test");
  write(path.join("Extensions", "combined", "e2e", "ignored.e2e.js"), "ignored e2e");
  write(path.join("Extensions", "combined", "dist", "ignored.js"), "ignored output");
  write(path.join("Extensions", "common", "vote-transition.js"), "shared source");
});

afterEach(() => {
  fs.rmSync(repositoryRoot, { force: true, recursive: true });
});

test("creates a deterministic receipt from production inputs only", () => {
  const first = createExtensionBuildReceipt(repositoryRoot, "production");
  const second = createExtensionBuildReceipt(repositoryRoot, "production");

  expect(second).toEqual(first);
  expect(first.inputs).toEqual(collectExtensionBuildInputs(repositoryRoot));
  expect(first.inputs).toContain("Extensions/combined/ryd.content-script.js");
  expect(first.inputs).toContain("Extensions/common/vote-transition.js");
  expect(first.inputs).not.toEqual(expect.arrayContaining([expect.stringMatching(/(?:dist|e2e|\.spec\.js)/)]));
});

test("rejects a production receipt after a build input changes", () => {
  const distRoot = path.join(repositoryRoot, "Extensions", "combined", "dist");
  write(
    path.join("Extensions", "combined", "dist", BUILD_RECEIPT_FILENAME),
    `${JSON.stringify(createExtensionBuildReceipt(repositoryRoot, "production"), null, 2)}\n`,
  );
  expect(() => verifyBuildReceipt(distRoot, repositoryRoot)).not.toThrow();

  write(path.join("Extensions", "combined", "src", "runtime.js"), "new runtime source");

  expect(() => verifyBuildReceipt(distRoot, repositoryRoot)).toThrow(
    "Extension build inputs changed after the artifact was generated.",
  );
});

test("rejects a receipt emitted by the development watcher", () => {
  const distRoot = path.join(repositoryRoot, "Extensions", "combined", "dist");
  write(
    path.join("Extensions", "combined", "dist", BUILD_RECEIPT_FILENAME),
    `${JSON.stringify(createExtensionBuildReceipt(repositoryRoot, "development"), null, 2)}\n`,
  );

  expect(() => verifyBuildReceipt(distRoot, repositoryRoot)).toThrow(
    "The extension artifact was not produced in production mode.",
  );
});

test("validates the generated artifact before the direct extension browser suite", () => {
  expect(packageManifest.scripts["test:e2e:extension:run"]).toMatch(
    /^npm run check:extension-artifact && playwright test /,
  );
});

test.each(["development", "production"])("records the Webpack %s mode in the build receipt", (mode) => {
  const config = createWebpackConfig({}, { mode });
  const receiptPlugin = config.plugins.find((plugin) => plugin.constructor.name === "ExtensionBuildReceiptPlugin");

  expect(receiptPlugin).toBeDefined();
  expect(receiptPlugin.mode).toBe(mode);
});
