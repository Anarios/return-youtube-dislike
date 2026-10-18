/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");
const packageManifest = require("../../../package.json");
const {
  LiveValidationIncompleteError,
  REQUIRED_PRODUCTION_REACTION_SCENARIOS,
  assertFullLiveReactionCompletion,
  buildLiveRuntimeArtifact,
  readFullLiveRuntime,
  requireProductionReactionApproval,
  requireUserscriptInstallAcknowledgement,
} = require("../e2e/live/live-full-run-contract");

test.each(["extension", "userscript"])("selects and builds the exact %s live runtime before a full run", (runtime) => {
  const spawnSyncImpl = jest.fn(() => ({ status: 0 }));
  const environment = { npm_execpath: "C:\\node\\node_modules\\npm\\bin\\npm-cli.js", RYD_LIVE_RUNTIME: runtime };

  expect(readFullLiveRuntime(environment)).toBe(runtime);
  expect(
    buildLiveRuntimeArtifact(runtime, {
      environment,
      nodeExecutable: "C:\\node\\node.exe",
      platform: "win32",
      repositoryRoot: "repository",
      spawnSyncImpl,
    }),
  ).toEqual({ runtime, script: `build:live:${runtime}` });
  expect(spawnSyncImpl).toHaveBeenCalledWith(
    "C:\\node\\node.exe",
    ["C:\\node\\node_modules\\npm\\bin\\npm-cli.js", "run", `build:live:${runtime}`],
    {
      cwd: "repository",
      env: environment,
      stdio: "inherit",
    },
  );
});

test("uses a Windows command shell only when the npm CLI path is unavailable", () => {
  const spawnSyncImpl = jest.fn(() => ({ status: 0 }));
  const environment = { RYD_LIVE_RUNTIME: "extension" };

  buildLiveRuntimeArtifact("extension", {
    environment,
    platform: "win32",
    repositoryRoot: "repository",
    spawnSyncImpl,
  });

  expect(spawnSyncImpl).toHaveBeenCalledWith("npm.cmd", ["run", "build:live:extension"], {
    cwd: "repository",
    env: environment,
    shell: true,
    stdio: "inherit",
  });
});

test("a failed live build prevents the full runner from continuing", () => {
  expect(() =>
    buildLiveRuntimeArtifact("extension", {
      spawnSyncImpl: () => ({ status: 2 }),
    }),
  ).toThrow("build:live:extension failed with exit code 2");
});

test.each([undefined, "", "browser"])("rejects unsupported full-live runtime %p", (runtime) => {
  expect(() => readFullLiveRuntime({ RYD_LIVE_RUNTIME: runtime })).toThrow(/RYD_LIVE_RUNTIME/);
});

test("classifies only both completed production reaction scenarios as a full run", () => {
  expect(REQUIRED_PRODUCTION_REACTION_SCENARIOS).toEqual(["post-navigation-vote", "reaction-matrix"]);
  expect(
    assertFullLiveReactionCompletion({
      "post-navigation-vote": { videoId: "abcdefghijk" },
      "reaction-matrix": [{ action: "like" }],
    }),
  ).toEqual({
    classification: "full",
    completedScenarioIds: REQUIRED_PRODUCTION_REACTION_SCENARIOS,
    productionReactionsCompleted: true,
    releaseReady: true,
  });
});

test.each([
  [null, /no production reaction results/],
  [{}, /post-navigation-vote, reaction-matrix/],
  [{ "post-navigation-vote": {} }, /reaction-matrix/],
  [{ "reaction-matrix": [] }, /post-navigation-vote/],
  [{ "post-navigation-vote": null, "reaction-matrix": {} }, /post-navigation-vote/],
])("rejects incomplete full-live reaction results %#", (results, message) => {
  expect(() => assertFullLiveReactionCompletion(results)).toThrow(message);
});

test("SKIP is an explicit incomplete failure, not a successful full run", () => {
  expect(() => requireProductionReactionApproval("SKIP")).toThrow(LiveValidationIncompleteError);
  expect(() => requireProductionReactionApproval(" skip ")).toThrow(/production reaction scenarios were skipped/);
  expect(requireProductionReactionApproval("extension:abcdefghijk:123")).toBe("extension:abcdefghijk:123");
});

test("a freshly built userscript requires an explicit installation acknowledgement", () => {
  expect(requireUserscriptInstallAcknowledgement("INSTALLED")).toBe(true);
  expect(() => requireUserscriptInstallAcknowledgement("SKIP")).toThrow(LiveValidationIncompleteError);
  expect(() => requireUserscriptInstallAcknowledgement("")).toThrow(/not acknowledged as installed/);
});

test("package commands distinguish full reaction validation from the read-only Playwright suite", () => {
  expect(packageManifest.scripts["test:live:youtube"]).toBe(
    "node Extensions/UserScript/e2e/live/live-interactive-runner.js",
  );
  expect(packageManifest.scripts["test:live:youtube:full"]).toBe("npm run test:live:youtube");
  expect(packageManifest.scripts["test:live:youtube:interactive"]).toBe("npm run test:live:youtube");
  expect(packageManifest.scripts["test:live:youtube:read-only"]).toBe(
    "playwright test --config playwright.live-youtube.config.js",
  );
});

test("the read-only Playwright suite cannot silently register a skipped reaction test", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../e2e/live/live-youtube.live.e2e.js"), "utf8");
  expect(source).toContain('test.describe("live YouTube RYD read-only smoke"');
  expect(source).not.toMatch(/\btest\.skip\s*\(/);
  expect(source).not.toContain("reaction-matrix");
  expect(source).not.toContain("post-navigation-vote");
  expect(source).toContain("LIVE_VALIDATION_READ_ONLY_COMPLETE");
  expect(source).toContain("releaseReady: false");
});

test("standalone artifact runners verify current source before consuming existing output", () => {
  expect(packageManifest.scripts["test:e2e:userscript:run"]).toMatch(/^npm run check:userscript-artifact && /);
  expect(packageManifest.scripts["test:e2e:artifacts"]).toMatch(
    /^npm run check:extension-artifact && npm run check:userscript-artifact && /,
  );
});
