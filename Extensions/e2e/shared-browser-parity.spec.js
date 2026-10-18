/**
 * @jest-environment node
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NAVIGATION_MATRIX } = require("../UserScript/e2e/navigation-matrix");
const {
  ARTIFACT_BROWSER_SCENARIO_CATALOG,
  SHARED_ARTIFACT_SCENARIO_IDS,
  createArtifactBrowserScenarioPlan,
} = require("./hermetic-artifact-smoke");
const { SHORTS_PLACEHOLDER_POOL_HOPS } = require("./shorts-placeholder-pool-contract");
const { RUNTIME_RESILIENCE_SCENARIOS } = require("./runtime-resilience-contract");
const { WATCH_VISUAL_SCENARIOS } = require("./watch-visual-scenarios");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const SHARED_BROWSER_RUNTIMES = Object.freeze(["userscript", "extension"]);
const PLAYWRIGHT_CONFIGS = Object.freeze({
  extension: require(path.join(REPOSITORY_ROOT, "playwright.extension.config.js")),
  userscript: require(path.join(REPOSITORY_ROOT, "playwright.userscript.config.js")),
});
const WRAPPERS = Object.freeze({
  extension: Object.freeze({
    navigation: path.join(__dirname, "extension", "extension-artifact-navigation.e2e.js"),
    resilience: path.join(__dirname, "extension", "extension-runtime-resilience.e2e.js"),
    shorts: path.join(__dirname, "extension", "extension-artifact-navigation.e2e.js"),
    watch: path.join(__dirname, "extension", "extension-artifact-visual.e2e.js"),
  }),
  userscript: Object.freeze({
    navigation: path.join(__dirname, "..", "UserScript", "e2e", "userscript-navigation-matrix.e2e.js"),
    resilience: path.join(__dirname, "..", "UserScript", "e2e", "userscript-runtime-resilience.e2e.js"),
    shorts: path.join(__dirname, "..", "UserScript", "e2e", "userscript-shorts-placeholder-pool.e2e.js"),
    watch: path.join(__dirname, "..", "UserScript", "e2e", "userscript-state-visual-contract.e2e.js"),
  }),
});
const RENDER_ORACLES = Object.freeze({
  extension: path.join(__dirname, "extension", "extension-render-oracle.e2e.js"),
  userscript: path.join(__dirname, "..", "UserScript", "e2e", "userscript-render-oracle.e2e.js"),
});

function wrapperSource(runtime, contract) {
  return fs.readFileSync(WRAPPERS[runtime][contract], "utf8");
}

function expectOneSharedCall(source, moduleName, callName) {
  expect(source).toMatch(new RegExp(`require\\(["'][^"']*${moduleName}["']\\)`));
  expect(source.match(new RegExp(`\\b${callName}\\s*\\(`, "g"))).toHaveLength(1);
}

function registeredTestTitles(wrapperPath) {
  const titles = [];
  const fakeTest = (title) => titles.push(title);
  fakeTest.describe = (_title, registerTests) => registerTests();
  fakeTest.describe.configure = jest.fn();

  jest.resetModules();
  jest.doMock("@playwright/test", () => ({ expect, test: fakeTest }));
  try {
    jest.isolateModules(() => require(wrapperPath));
  } finally {
    jest.dontMock("@playwright/test");
    jest.resetModules();
  }
  return titles;
}

function sharedCoreScenarioIds(runtime) {
  if (!SHARED_BROWSER_RUNTIMES.includes(runtime)) {
    throw new TypeError(`Unsupported shared browser runtime: ${runtime}`);
  }
  return [
    ...NAVIGATION_MATRIX.map(({ id }) => `navigation:${id}`),
    ...WATCH_VISUAL_SCENARIOS.map(({ id }) => `watch-visual:${id}`),
    ...RUNTIME_RESILIENCE_SCENARIOS.map(({ id }) => `resilience:${id}`),
    `shorts-placeholder-pool:${SHORTS_PLACEHOLDER_POOL_HOPS}-hops`,
    ...ARTIFACT_BROWSER_SCENARIO_CATALOG.filter(({ runtimes, shared }) => shared && runtimes.includes(runtime)).map(
      ({ id }) => `artifact:${id}`,
    ),
  ];
}

function assertIdenticalSharedCoreCatalog(catalogByRuntime) {
  for (const runtime of SHARED_BROWSER_RUNTIMES) {
    const scenarioIds = catalogByRuntime[runtime];
    assert.ok(Array.isArray(scenarioIds), `Missing shared browser scenario catalog for ${runtime}.`);
    assert.equal(
      new Set(scenarioIds).size,
      scenarioIds.length,
      `${runtime} shared browser scenario catalog contains duplicate IDs.`,
    );
  }
  assert.deepEqual(
    catalogByRuntime.extension,
    catalogByRuntime.userscript,
    "Userscript and extension must register the identical shared browser scenario catalog.",
  );
  return catalogByRuntime;
}

function assertWrapperDiscoveredByPlaywright(runtime, wrapperPath, configuration = PLAYWRIGHT_CONFIGS[runtime]) {
  assert.ok(configuration, `Missing Playwright configuration for ${runtime}.`);
  const testDirectory = path.resolve(REPOSITORY_ROOT, configuration.testDir);
  const absoluteWrapperPath = path.resolve(wrapperPath);
  const relativePath = path.relative(testDirectory, absoluteWrapperPath);
  const normalizedRelativePath = relativePath.split(path.sep).join("/");

  assert.ok(
    relativePath &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath),
    `${runtime} shared browser wrapper is outside its configured Playwright test directory: ${absoluteWrapperPath}`,
  );
  assert.equal(
    configuration.testMatch,
    "**/*.e2e.js",
    `${runtime} Playwright testMatch no longer selects shared wrappers.`,
  );
  assert.match(
    normalizedRelativePath,
    /(?:^|\/)\w[^/]*\.e2e\.js$/,
    `${absoluteWrapperPath} is not a Playwright E2E spec.`,
  );
  for (const ignoredPattern of [configuration.testIgnore].flat().filter(Boolean)) {
    if (ignoredPattern === "**/live/**") {
      assert.ok(
        !normalizedRelativePath.split("/").includes("live"),
        `${runtime} shared browser wrapper is excluded by Playwright testIgnore: ${absoluteWrapperPath}`,
      );
    }
  }
  assert.ok(fs.statSync(absoluteWrapperPath).isFile(), `${runtime} shared browser wrapper does not exist.`);
  return normalizedRelativePath;
}

describe("shared browser-contract parity", () => {
  test("userscript and extension expose one identical 50-scenario core browser catalog", () => {
    const catalogByRuntime = Object.fromEntries(
      SHARED_BROWSER_RUNTIMES.map((runtime) => [runtime, sharedCoreScenarioIds(runtime)]),
    );

    expect(assertIdenticalSharedCoreCatalog(catalogByRuntime)).toBe(catalogByRuntime);
    expect(catalogByRuntime.userscript).toHaveLength(50);
    expect(catalogByRuntime.userscript.filter((id) => id.startsWith("navigation:"))).toHaveLength(
      NAVIGATION_MATRIX.length,
    );
    expect(catalogByRuntime.userscript.filter((id) => id.startsWith("watch-visual:"))).toHaveLength(18);
    expect(catalogByRuntime.userscript.filter((id) => id.startsWith("resilience:"))).toHaveLength(4);
    expect(catalogByRuntime.userscript.filter((id) => id.startsWith("artifact:"))).toEqual(
      SHARED_ARTIFACT_SCENARIO_IDS.map((id) => `artifact:${id}`),
    );
  });

  test("the parity gate fails when either artifact loses one shared core scenario", () => {
    const catalogByRuntime = Object.fromEntries(
      SHARED_BROWSER_RUNTIMES.map((runtime) => [runtime, sharedCoreScenarioIds(runtime)]),
    );
    catalogByRuntime.extension = catalogByRuntime.extension.filter(
      (scenarioId) => scenarioId !== `artifact:${SHARED_ARTIFACT_SCENARIO_IDS[0]}`,
    );

    expect(() => assertIdenticalSharedCoreCatalog(catalogByRuntime)).toThrow(
      "Userscript and extension must register the identical shared browser scenario catalog.",
    );
  });

  test.each(SHARED_BROWSER_RUNTIMES)("%s Playwright config discovers every shared contract wrapper", (runtime) => {
    const uniqueWrappers = [...new Set(Object.values(WRAPPERS[runtime]))];
    expect(uniqueWrappers.map((wrapperPath) => assertWrapperDiscoveredByPlaywright(runtime, wrapperPath))).toHaveLength(
      uniqueWrappers.length,
    );
  });

  test("the wrapper-discovery gate rejects a shared wrapper from another runtime's test directory", () => {
    expect(() => assertWrapperDiscoveredByPlaywright("extension", WRAPPERS.userscript.watch)).toThrow(
      /outside its configured Playwright test directory/,
    );
  });

  test.each(SHARED_BROWSER_RUNTIMES)("%s has a discovered no-op-artifact render oracle", (runtime) => {
    const oraclePath = RENDER_ORACLES[runtime];
    expect(assertWrapperDiscoveredByPlaywright(runtime, oraclePath)).toBe(
      path
        .relative(path.resolve(REPOSITORY_ROOT, PLAYWRIGHT_CONFIGS[runtime].testDir), oraclePath)
        .split(path.sep)
        .join("/"),
    );
    expect(registeredTestTitles(oraclePath)).toEqual([
      `the render oracle rejects a generated ${runtime} whose ${
        runtime === "extension" ? "content script" : "runtime body"
      } does nothing`,
    ]);
  });

  test("the systematic command executes the catalogued artifact runner and both Playwright runtimes", () => {
    const { scripts } = require(path.join(REPOSITORY_ROOT, "package.json"));
    expect(scripts["test:e2e:artifacts"]).toBe(
      "npm run check:extension-artifact && npm run check:userscript-artifact && node Extensions/e2e/hermetic-artifact-smoke.js",
    );
    expect(scripts["test:e2e:systematic"]).toContain("npm run test:e2e:artifacts");
    expect(scripts["test:e2e:systematic"]).toContain("npm run test:e2e:extension:run");
    expect(scripts["test:e2e:systematic"]).toContain("npm run test:e2e:userscript:run");
    expect(scripts["test:all"]).toContain("npm run test:e2e:systematic");
    expect(
      createArtifactBrowserScenarioPlan().filter(({ scenarioId }) => SHARED_ARTIFACT_SCENARIO_IDS.includes(scenarioId)),
    ).toHaveLength(SHARED_ARTIFACT_SCENARIO_IDS.length * SHARED_BROWSER_RUNTIMES.length);
  });

  test.each(["userscript", "extension"])("%s registers the complete shared navigation matrix", (runtime) => {
    expect(NAVIGATION_MATRIX.length).toBeGreaterThan(0);
    expectOneSharedCall(
      wrapperSource(runtime, "navigation"),
      "navigation-runtime-contract",
      "registerNavigationRuntimeContractScenarios",
    );
    expect(
      registeredTestTitles(WRAPPERS[runtime].navigation).filter((title) =>
        title.startsWith(`${runtime} navigation matrix:`),
      ),
    ).toEqual(NAVIGATION_MATRIX.map(({ id }) => `${runtime} navigation matrix: ${id}`));
  });

  test.each(["userscript", "extension"])("%s registers the complete shared Watch visual matrix", (runtime) => {
    expect(WATCH_VISUAL_SCENARIOS).toHaveLength(18);
    expectOneSharedCall(wrapperSource(runtime, "watch"), "watch-visual-scenarios", "registerWatchVisualContract");
    expect(registeredTestTitles(WRAPPERS[runtime].watch)).toEqual(WATCH_VISUAL_SCENARIOS.map(({ id }) => id));
  });

  test.each(["userscript", "extension"])("%s gates successful Watch screenshots as visual evidence", (runtime) => {
    const source = wrapperSource(runtime, "watch");
    expectOneSharedCall(source, "visual-evidence", "captureOptionalVisualEvidence");
    expect(source).toMatch(/\bannotateVisualEvidence\s*\(/);
    expect(source).toContain("scenario.id");
    if (runtime === "userscript") {
      expect(source).toMatch(/["']visual-review["']\s*,\s*["']userscript["']/);
      expect(source).toContain("getWatchNeutralBaselineId");
    }
  });

  test.each(["userscript", "extension"])("%s registers the complete shared resilience matrix", (runtime) => {
    expect(RUNTIME_RESILIENCE_SCENARIOS).toHaveLength(4);
    expectOneSharedCall(
      wrapperSource(runtime, "resilience"),
      "runtime-resilience-contract",
      "registerRuntimeResilienceContractScenarios",
    );
    expect(registeredTestTitles(WRAPPERS[runtime].resilience)).toEqual(
      RUNTIME_RESILIENCE_SCENARIOS.map(({ id }) => `${runtime} resilience contract: ${id}`),
    );
  });

  test.each(["userscript", "extension"])(
    "%s invokes the shared ten-hop Shorts placeholder-pool contract",
    (runtime) => {
      expect(SHORTS_PLACEHOLDER_POOL_HOPS).toBeGreaterThanOrEqual(10);
      expectOneSharedCall(
        wrapperSource(runtime, "shorts"),
        "shorts-placeholder-pool-contract",
        "runShortsPlaceholderPoolContract",
      );
      expect(
        registeredTestTitles(WRAPPERS[runtime].shorts).filter((title) =>
          title.includes("ten pre-rendered and recycled Next transitions"),
        ),
      ).toHaveLength(1);
    },
  );
});
