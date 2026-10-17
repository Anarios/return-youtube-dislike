/**
 * @jest-environment node
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION,
  UserscriptBuildReceiptPlugin,
  collectUserscriptBuildInputs,
  createUserscriptBuildReceipt,
  verifyUserscriptBuildReceipt,
  writeUserscriptBuildReceipt,
} = require("./userscript-build-receipt");
const createWebpackConfig = require("./webpack.userscript.config");

const BUILD_ID = "0123456789abcdef0123456789abcdef";
const STATIC_FILES = [
  ".babelrc",
  ".nvmrc",
  "package-lock.json",
  "package.json",
  "userscript-build-receipt.js",
  "webpack.live-build-marker.js",
  "webpack.userscript.config.js",
  "Extensions/UserScript/userscript.meta.js",
  "Extensions/UserScript/userscript-version.json",
];
let artifactPath;
let receiptPath;
let repositoryRoot;

function write(relativePath, contents = relativePath) {
  const filePath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function emitReceipt({ buildId = "", liveTestBuild = false } = {}) {
  const receipt = createUserscriptBuildReceipt(repositoryRoot, {
    artifactPath,
    buildId,
    liveTestBuild,
    mode: "production",
  });
  return writeUserscriptBuildReceipt(receiptPath, artifactPath, receipt);
}

beforeEach(() => {
  repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-userscript-receipt-"));
  for (const relativePath of STATIC_FILES) write(relativePath);
  write("Extensions/UserScript/src/userscript-entry.js", "entry source");
  write("Extensions/UserScript/src/userscript-entry.spec.js", "ignored test");
  write("Extensions/common/vote-client.js", "shared source");
  write("Extensions/common/vote-client.spec.js", "ignored test");
  artifactPath = write("Extensions/UserScript/Return Youtube Dislike.user.js", "generated artifact");
  receiptPath = path.join(repositoryRoot, "test-results", "userscript-receipt.json");
});

afterEach(() => {
  fs.rmSync(repositoryRoot, { force: true, recursive: true });
});

test("creates a deterministic receipt from production userscript inputs only", () => {
  const first = createUserscriptBuildReceipt(repositoryRoot, {
    artifactPath,
    liveTestBuild: false,
    mode: "production",
  });
  const second = createUserscriptBuildReceipt(repositoryRoot, {
    artifactPath,
    liveTestBuild: false,
    mode: "production",
  });

  expect(second).toEqual(first);
  expect(first.schemaVersion).toBe(USERSCRIPT_BUILD_RECEIPT_SCHEMA_VERSION);
  expect(first.inputs).toEqual(collectUserscriptBuildInputs(repositoryRoot));
  expect(first.inputs).toContain("Extensions/UserScript/src/userscript-entry.js");
  expect(first.inputs).toContain("Extensions/common/vote-client.js");
  expect(first.inputs).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.spec\.js$/)]));
});

test.each([
  [false, ""],
  [true, BUILD_ID],
])("verifies a current generated artifact and receipt (live=%s)", (liveTestBuild, expectedBuildId) => {
  emitReceipt({ buildId: expectedBuildId, liveTestBuild });

  expect(
    verifyUserscriptBuildReceipt({
      artifactPath,
      expectedBuildId,
      liveTestBuild,
      receiptPath,
      repositoryRoot,
    }),
  ).toMatchObject({ artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/), buildId: expectedBuildId });
});

test("rejects source drift after the userscript build", () => {
  emitReceipt();
  write("Extensions/UserScript/src/userscript-entry.js", "changed source");

  expect(() =>
    verifyUserscriptBuildReceipt({
      artifactPath,
      liveTestBuild: false,
      receiptPath,
      repositoryRoot,
    }),
  ).toThrow(/build inputs changed/);
});

test("rejects a generated artifact changed after its receipt", () => {
  emitReceipt();
  fs.writeFileSync(artifactPath, "different generated artifact");

  expect(() =>
    verifyUserscriptBuildReceipt({
      artifactPath,
      liveTestBuild: false,
      receiptPath,
      repositoryRoot,
    }),
  ).toThrow(/differs from its build receipt/);
});

test("rejects a receipt for another live build ID", () => {
  emitReceipt({ buildId: BUILD_ID, liveTestBuild: true });

  expect(() =>
    verifyUserscriptBuildReceipt({
      artifactPath,
      expectedBuildId: "f".repeat(32),
      liveTestBuild: true,
      receiptPath,
      repositoryRoot,
    }),
  ).toThrow(/different live build/);
});

test("rejects a missing receipt instead of trusting an existing userscript", () => {
  expect(() =>
    verifyUserscriptBuildReceipt({
      artifactPath,
      liveTestBuild: false,
      receiptPath,
      repositoryRoot,
    }),
  ).toThrow(/Missing userscript build receipt/);
});

test("a redirected temporary build cannot rewrite the configured receipt", () => {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, "protected receipt\n");
  const fixedTime = new Date("2024-01-02T03:04:05.000Z");
  fs.utimesSync(receiptPath, fixedTime, fixedTime);
  const before = fs.statSync(receiptPath);
  const callbacks = {};
  const compiler = {
    hooks: {
      afterEmit: { tap: (_name, callback) => (callbacks.afterEmit = callback) },
      beforeCompile: { tap: (_name, callback) => (callbacks.beforeCompile = callback) },
    },
    options: {
      output: {
        filename: path.basename(artifactPath),
        path: path.join(repositoryRoot, "temporary-output"),
      },
    },
  };
  const plugin = new UserscriptBuildReceiptPlugin({
    artifactPath,
    buildId: "",
    liveTestBuild: false,
    mode: "production",
    receiptPath,
    repositoryRoot,
  });

  plugin.apply(compiler);
  callbacks.beforeCompile();
  callbacks.afterEmit();

  expect(fs.readFileSync(receiptPath, "utf8")).toBe("protected receipt\n");
  expect(fs.statSync(receiptPath).mtimeMs).toBe(before.mtimeMs);
});

test.each([
  [{}, false],
  [{ liveTest: true }, true],
])("the userscript Webpack build emits a receipt (live=%s)", (environment, liveTestBuild) => {
  const config = createWebpackConfig(environment, { mode: "production" });
  const plugin = config.plugins.find(({ constructor }) => constructor.name === "UserscriptBuildReceiptPlugin");

  expect(plugin).toBeDefined();
  expect(plugin.liveTestBuild).toBe(liveTestBuild);
  expect(plugin.mode).toBe("production");
  expect(plugin.receiptPath).toMatch(
    liveTestBuild ? /live-build[\\/]userscript[\\/]userscript-build-receipt\.json$/ : /userscript-production\.json$/,
  );
});
