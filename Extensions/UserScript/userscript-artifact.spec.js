const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const webpack = require("webpack");
const createUserscriptConfig = require("../../webpack.userscript.config");
const {
  USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH,
  USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH,
} = require("../../userscript-build-receipt");
const userscriptMeta = require("./userscript.meta");

const ARTIFACT_PATH = path.join(__dirname, "Return Youtube Dislike.user.js");
const REPOSITORY_ROOT = path.resolve(__dirname, "../..");

function snapshotFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

function expectFileUnchanged(filePath, before) {
  if (before === null) {
    expect(fs.existsSync(filePath)).toBe(false);
    return;
  }
  expect(fs.readFileSync(filePath)).toEqual(before);
}

function compile(config) {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((error, stats) => {
      const finish = (closeError) => {
        if (error || closeError) {
          reject(error || closeError);
          return;
        }
        if (stats.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
          return;
        }
        resolve();
      };
      compiler.close(finish);
    });
  });
}

describe("generated userscript artifact", () => {
  let artifact;

  beforeAll(() => {
    artifact = fs.readFileSync(ARTIFACT_PATH, "utf8");
  });

  it("contains the candidate metadata and required modern and legacy grants", () => {
    expect(artifact.startsWith("// ==UserScript==\n")).toBe(true);
    expect(artifact).toContain(`// @version      ${userscriptMeta.version}`);
    expect(userscriptMeta.version).toBe("3.2.0");
    expect(artifact).toContain(`// @downloadURL  ${userscriptMeta.downloadURL}`);
    expect(artifact).toContain(`// @updateURL    ${userscriptMeta.updateURL}`);
    for (const grant of userscriptMeta.grants) {
      expect(artifact).toContain(`// @grant        ${grant}`);
    }
    expect(artifact).not.toContain("@grant        GM.xmlHttpRequest");
    expect(artifact).not.toContain("@connect");
  });

  it("is a standalone syntactically valid script with editable user options", () => {
    expect(() => new vm.Script(artifact, { filename: ARTIFACT_PATH })).not.toThrow();
    expect(artifact).not.toMatch(/^\s*(?:import|export)\s/m);
    expect(artifact).not.toMatch(/[ \t]+(?=\r?\n|$)/);
    expect(artifact).toContain("BEGIN USER OPTIONS");
    expect(artifact).toContain("disableVoteSubmission: false");
    expect(artifact).not.toContain("data-ryd-userscript-version");
  });

  it("builds an unpublished live-test artifact with a runtime marker and no update URLs", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-userscript-live-build-"));
    const receiptPath = path.join(REPOSITORY_ROOT, USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH);
    const receiptBefore = snapshotFile(receiptPath);
    try {
      const config = createUserscriptConfig({ liveTest: "true" }, { mode: "production" });
      config.output = { ...config.output, path: temporaryDirectory };
      await compile(config);
      const liveArtifact = fs.readFileSync(path.join(temporaryDirectory, config.output.filename), "utf8");
      expect(liveArtifact).toContain("data-ryd-userscript-version");
      expect(liveArtifact).toContain("// @name         Return YouTube Dislike [Live Test]");
      expect(liveArtifact).not.toContain("// @downloadURL");
      expect(liveArtifact).not.toContain("// @updateURL");
      expect(liveArtifact).not.toMatch(/[ \t]+(?=\r?\n|$)/);
    } finally {
      expectFileUnchanged(receiptPath, receiptBefore);
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("rebuilds deterministically", async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-userscript-build-"));
    const receiptPath = path.join(REPOSITORY_ROOT, USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH);
    const receiptBefore = snapshotFile(receiptPath);
    try {
      const config = createUserscriptConfig({}, { mode: "production" });
      config.output = { ...config.output, path: temporaryDirectory };
      await compile(config);
      const rebuilt = fs.readFileSync(path.join(temporaryDirectory, config.output.filename), "utf8");
      expect(rebuilt.replace(/\r\n/g, "\n")).toBe(artifact.replace(/\r\n/g, "\n"));
    } finally {
      expectFileUnchanged(receiptPath, receiptBefore);
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
