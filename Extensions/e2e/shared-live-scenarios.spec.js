const {
  LIVE_RUNTIME_PROFILES,
  createExtensionLiveRuntimeAdapter,
  createUserscriptLiveRuntimeAdapter,
} = require("./live-runtime-adapter");
const {
  SHARED_LIVE_SCENARIO_IDS,
  assertSharedLiveScenarioAdapter,
  createSharedLiveScenarioRunner,
} = require("./shared-live-scenarios");

const EXPECTED_SCENARIO_IDS = [
  "channel-shorts-navigation",
  "channel-watch-navigation",
  "watch-render",
  "reload",
  "spa-navigation",
  "watch-action-topology",
  "sidebar-navigation-stress",
  "shorts-render",
  "responsive-visual",
  "post-navigation-vote",
  "reaction-matrix",
];
const EXPECTED_BUILD_ID = "0123456789abcdef0123456789abcdef";

const ALL_DRIVER_METHODS = [
  "assertCurrentShortsControl",
  "assertCurrentVideo",
  "assertCurrentWatchResult",
  "assertDislikeCountChangesObservable",
  "assertRenderedDislikeCount",
  "assertRuntime",
  "assertSignedIn",
  "captureReactionStateVisual",
  "captureNativeShortsVisual",
  "captureSyntheticShortsVisual",
  "captureWatchActionTopologyVisual",
  "captureWatchRatioVisual",
  "clickAction",
  "configureRequestAttributionRuntime",
  "navigateFromColdChannelToShort",
  "navigateFromColdChannelToWatch",
  "navigateToNextShort",
  "navigateToRelatedWatch",
  "navigateWithinPlaylist",
  "openPlaylist",
  "openShort",
  "openWatch",
  "pausePlayback",
  "readReactionState",
  "readViewportSize",
  "reload",
  "setViewportSize",
  "soakCurrentShortsControl",
  "soakWatchRatioVisual",
  "waitForDislikeText",
  "waitForReactionState",
  "withExactVotesRequest",
  "withNoProductionInteractions",
];

function createDriver(overrides = {}) {
  return {
    ...Object.fromEntries(ALL_DRIVER_METHODS.map((method) => [method, jest.fn()])),
    ...overrides,
  };
}

function createAdapter(runtime, driver = createDriver(), expectedBuildId = EXPECTED_BUILD_ID) {
  const options = { driver, expectedBuildId, expectedVersion: runtime === "userscript" ? "3.2.0" : "4.0.5" };
  return runtime === "userscript"
    ? createUserscriptLiveRuntimeAdapter(options)
    : createExtensionLiveRuntimeAdapter(options);
}

function createImplementations(events) {
  const implementationNames = [
    "runChannelShortsNavigationScenario",
    "runChannelWatchNavigationScenario",
    "runWatchRenderScenario",
    "runReloadScenario",
    "runSpaNavigationScenario",
    "runWatchActionTopologyScenario",
    "runSidebarStressScenario",
    "runShortsRenderScenario",
    "runResponsiveVisualScenario",
    "runPostNavigationVoteScenario",
    "runProductionReactionMatrixScenario",
  ];
  return Object.fromEntries(
    implementationNames.map((name) => [
      name,
      jest.fn(async (_driver, options) => {
        events.push({ implementation: name, runtime: options.runtime });
        return `${options.runtime}:${name}`;
      }),
    ]),
  );
}

describe("shared live runtime profiles", () => {
  test("preserves each runtime's selectors and control-ownership capabilities", () => {
    expect(LIVE_RUNTIME_PROFILES.userscript).toMatchObject({
      capabilities: {
        backgroundVoteTransport: false,
        credentialStore: "gm-storage",
        ownsShortsDislikeControl: true,
        shortsControlModel: "synthetic-owned",
        shortsControlModelBySurface: {
          desktop: "synthetic-owned",
          mobile: "native-youtube-required",
        },
        shortsVisualModel: "strict-synthetic",
      },
      buildMarkerAttribute: "data-ryd-userscript-build",
      markerAttribute: "data-ryd-userscript-version",
      selectors: {
        rateBar: "#return-youtube-dislike-bar",
        rateBarContainer: "#return-youtube-dislike-bar-container",
        shortsDislikeControl: "[data-ryd-synthetic-shorts-dislike]",
      },
    });
    expect(LIVE_RUNTIME_PROFILES.extension).toMatchObject({
      capabilities: {
        backgroundVoteTransport: true,
        credentialStore: "browser.storage",
        ownsShortsDislikeControl: true,
        shortsControlModel: "synthetic-owned",
        shortsControlModelBySurface: {
          desktop: "synthetic-owned",
          mobile: "native-youtube-required",
        },
        shortsVisualModel: "strict-synthetic",
      },
      buildMarkerAttribute: "data-ryd-extension-build",
      markerAttribute: "data-ryd-extension-version",
      selectors: {
        rateBar: "#ryd-bar",
        rateBarContainer: "#ryd-bar-container",
        shortsDislikeControl: "[data-ryd-synthetic-shorts-dislike]",
      },
    });
    expect(Object.isFrozen(LIVE_RUNTIME_PROFILES.userscript.capabilities)).toBe(true);
    expect(Object.isFrozen(LIVE_RUNTIME_PROFILES.extension.selectors)).toBe(true);
  });

  test.each(["userscript", "extension"])("binds runtime-sensitive driver calls for %s", async (runtime) => {
    const driver = createDriver();
    const adapter = createAdapter(runtime, driver);

    expect(driver.configureRequestAttributionRuntime).toHaveBeenCalledWith(runtime);

    await adapter.driver.assertRuntime(runtime, adapter.expectedVersion, adapter.expectedBuildId);
    await adapter.driver.assertCurrentShortsControl("abcdefghijk", runtime);
    const expectedCounts = { dislikes: 123, likes: 456 };
    await adapter.driver.assertCurrentWatchResult("abcdefghijk", runtime, expectedCounts);
    await adapter.driver.assertDislikeCountChangesObservable([{ after: 124, before: 123 }], runtime);
    await adapter.driver.assertRenderedDislikeCount("123", 123, runtime);
    await adapter.driver.soakCurrentShortsControl("abcdefghijk", runtime, 123, { durationMs: 10 });
    await adapter.driver.captureWatchRatioVisual(runtime, "watch.png");
    await adapter.driver.captureReactionStateVisual({
      expectedCounts,
      expectedState: "neutral",
      isShort: false,
      runtime,
      screenshotPath: "reaction.png",
      shortsVisualModel: adapter.capabilities.shortsVisualModel,
      videoId: "abcdefghijk",
    });

    expect(driver.assertRuntime).toHaveBeenCalledWith(runtime, adapter.expectedVersion, adapter.expectedBuildId);
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledWith("abcdefghijk", runtime);
    expect(driver.assertCurrentWatchResult).toHaveBeenCalledWith("abcdefghijk", runtime, expectedCounts);
    expect(driver.assertDislikeCountChangesObservable).toHaveBeenCalledWith([{ after: 124, before: 123 }], runtime);
    expect(driver.assertRenderedDislikeCount).toHaveBeenCalledWith("123", 123, runtime);
    expect(driver.soakCurrentShortsControl).toHaveBeenCalledWith("abcdefghijk", runtime, 123, { durationMs: 10 });
    expect(driver.captureWatchRatioVisual).toHaveBeenCalledWith(runtime, "watch.png");
    expect(driver.captureReactionStateVisual).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime,
        shortsVisualModel: adapter.capabilities.shortsVisualModel,
        videoId: "abcdefghijk",
      }),
    );
    expect(adapter.createScenarioOptions()).toMatchObject({ capabilities: adapter.capabilities });
  });

  test("rejects scenario options and calls for another runtime", async () => {
    const adapter = createAdapter("userscript");

    expect(() => adapter.createScenarioOptions({ runtime: "extension" })).toThrow(
      "The configured scenario runtime does not match",
    );
    expect(() => adapter.driver.assertRuntime("extension", adapter.expectedVersion)).toThrow(
      "The asserted runtime does not match",
    );
    expect(() => adapter.driver.soakCurrentShortsControl("abcdefghijk", "extension", 123)).toThrow(
      "The Shorts-control soak runtime does not match",
    );
    expect(() =>
      adapter.driver.captureReactionStateVisual({
        expectedState: "neutral",
        isShort: true,
        runtime: "userscript",
        shortsVisualModel: "native-pair",
        videoId: "abcdefghijk",
      }),
    ).toThrow("The reaction-visual Shorts model does not match");
  });

  test.each([undefined, "", "stale", "A".repeat(32)])(
    "rejects a missing or malformed exact live build ID: %p",
    (expectedBuildId) => {
      expect(() =>
        createUserscriptLiveRuntimeAdapter({
          driver: createDriver(),
          expectedBuildId,
          expectedVersion: "3.2.0",
        }),
      ).toThrow("expected live build ID must be a 32-character lowercase hexadecimal value");
    },
  );

  test("binds the exact generated live build ID into runtime checks", async () => {
    const driver = createDriver();
    const expectedBuildId = "0123456789abcdef0123456789abcdef";
    const adapter = createAdapter("userscript", driver, expectedBuildId);

    await adapter.driver.assertRuntime("userscript", adapter.expectedVersion, expectedBuildId);

    expect(driver.assertRuntime).toHaveBeenCalledWith("userscript", adapter.expectedVersion, expectedBuildId);
    expect(adapter.createScenarioOptions()).toMatchObject({ expectedBuildId });
    expect(() => adapter.driver.assertRuntime("userscript", adapter.expectedVersion, "f".repeat(32))).toThrow(
      "live build ID does not match",
    );
  });
});

describe("shared live scenario contract", () => {
  test("publishes one stable ordered scenario ID list", () => {
    expect(SHARED_LIVE_SCENARIO_IDS).toEqual(EXPECTED_SCENARIO_IDS);
    expect(Object.isFrozen(SHARED_LIVE_SCENARIO_IDS)).toBe(true);
  });

  test.each(["userscript", "extension"])("validates the complete contract for %s", (runtime) => {
    const adapter = createAdapter(runtime);
    expect(assertSharedLiveScenarioAdapter(adapter)).toEqual(EXPECTED_SCENARIO_IDS);
  });

  test.each(["channel-shorts-navigation", "responsive-visual"])(
    "requires each runtime's Shorts visual model from shared scenario %s",
    (scenarioId) => {
      const driver = createDriver();
      delete driver.captureSyntheticShortsVisual;

      expect(() => assertSharedLiveScenarioAdapter(createAdapter("userscript", driver), [scenarioId])).toThrow(
        "must implement captureSyntheticShortsVisual()",
      );
      expect(() => assertSharedLiveScenarioAdapter(createAdapter("extension", driver), [scenarioId])).toThrow(
        "must implement captureSyntheticShortsVisual()",
      );

      const driverWithoutNativeCapture = createDriver();
      delete driverWithoutNativeCapture.captureNativeShortsVisual;
      expect(
        assertSharedLiveScenarioAdapter(createAdapter("extension", driverWithoutNativeCapture), [scenarioId]),
      ).toEqual([scenarioId]);
    },
  );

  test("executes the same scenario IDs through both runtime adapters", async () => {
    const events = [];
    const implementations = createImplementations(events);
    const runner = createSharedLiveScenarioRunner({ implementations });
    const services = {
      consumeVoteApproval: jest.fn(),
      createRecorder: jest.fn(),
      shortsNavigationOptions: { outputDirectory: "shorts-evidence" },
      visualOptions: { outputDirectory: "evidence" },
      sidebarOptions: { outputDirectory: "sidebar-evidence" },
      topologyOptions: { outputDirectory: "topology-evidence" },
    };

    const userscriptResults = await runner.runAll(createAdapter("userscript"), {}, services);
    const extensionResults = await runner.runAll(createAdapter("extension"), {}, services);

    expect(userscriptResults.map(({ id }) => id)).toEqual(EXPECTED_SCENARIO_IDS);
    expect(extensionResults.map(({ id }) => id)).toEqual(EXPECTED_SCENARIO_IDS);
    expect(events.map(({ runtime }) => runtime)).toEqual([
      ...EXPECTED_SCENARIO_IDS.map(() => "userscript"),
      ...EXPECTED_SCENARIO_IDS.map(() => "extension"),
    ]);
    expect(Object.values(implementations).every((implementation) => implementation.mock.calls.length === 2)).toBe(true);
  });

  test.each(["userscript", "extension"])(
    "routes the shared Shorts navigation evidence options through %s",
    async (runtime) => {
      const implementation = jest.fn(async () => "verified");
      const runner = createSharedLiveScenarioRunner({
        implementations: { runChannelShortsNavigationScenario: implementation },
      });
      const adapter = createAdapter(runtime);
      const shortsNavigationOptions = { outputDirectory: "shorts-evidence" };

      await expect(runner.run(adapter, "channel-shorts-navigation", {}, { shortsNavigationOptions })).resolves.toBe(
        "verified",
      );
      expect(implementation).toHaveBeenCalledWith(
        adapter.driver,
        expect.objectContaining({ runtime }),
        shortsNavigationOptions,
      );
    },
  );

  test.each(["userscript", "extension"])(
    "routes the shared post-navigation vote services through %s",
    async (runtime) => {
      const implementation = jest.fn(async () => "verified");
      const runner = createSharedLiveScenarioRunner({
        implementations: { runPostNavigationVoteScenario: implementation },
      });
      const adapter = createAdapter(runtime);
      const createRecorder = jest.fn();
      const consumeVoteApproval = jest.fn();

      await expect(
        runner.run(adapter, "post-navigation-vote", {}, { createRecorder, consumeVoteApproval }),
      ).resolves.toBe("verified");
      expect(implementation).toHaveBeenCalledWith(
        adapter.driver,
        expect.objectContaining({ runtime }),
        createRecorder,
        consumeVoteApproval,
      );
    },
  );

  test("requires both protected services before running the post-navigation vote", async () => {
    const implementation = jest.fn();
    const runner = createSharedLiveScenarioRunner({
      implementations: { runPostNavigationVoteScenario: implementation },
    });

    await expect(
      runner.run(createAdapter("extension"), "post-navigation-vote", {}, { createRecorder: jest.fn() }),
    ).rejects.toThrow("requires services.consumeVoteApproval()");
    expect(implementation).not.toHaveBeenCalled();
  });

  test("rejects unknown IDs before invoking a scenario implementation", async () => {
    const implementations = createImplementations([]);
    const runner = createSharedLiveScenarioRunner({ implementations });

    await expect(runner.run(createAdapter("userscript"), "not-a-scenario")).rejects.toThrow(
      "Unknown shared live scenario: not-a-scenario",
    );
    expect(Object.values(implementations).every((implementation) => implementation.mock.calls.length === 0)).toBe(true);
  });
});
