const defaultImplementations = require("../UserScript/e2e/live/live-scenarios");

const COMMON_PRECONDITION_METHODS = ["assertRuntime", "assertSignedIn"];

const SHARED_LIVE_SCENARIOS = Object.freeze([
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentShortsControl",
      "navigateFromColdChannelToShort",
      "navigateToNextShort",
      "pausePlayback",
      "soakCurrentShortsControl",
      "withExactVotesRequest",
      "withNoProductionInteractions",
    ],
    driverMethodsByCapability: {
      "native-pair": ["captureNativeShortsVisual"],
      "strict-synthetic": ["captureSyntheticShortsVisual"],
    },
    id: "channel-shorts-navigation",
    implementation: "runChannelShortsNavigationScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentWatchResult",
      "navigateFromColdChannelToWatch",
      "withNoProductionInteractions",
    ],
    id: "channel-watch-navigation",
    implementation: "runChannelWatchNavigationScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentWatchResult",
      "openPlaylist",
      "withNoProductionInteractions",
    ],
    id: "watch-render",
    implementation: "runWatchRenderScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentWatchResult",
      "openPlaylist",
      "reload",
      "withNoProductionInteractions",
    ],
    id: "reload",
    implementation: "runReloadScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentWatchResult",
      "navigateWithinPlaylist",
      "openPlaylist",
      "withNoProductionInteractions",
    ],
    id: "spa-navigation",
    implementation: "runSpaNavigationScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertRenderedDislikeCount",
      "captureWatchActionTopologyVisual",
      "navigateToRelatedWatch",
      "openWatch",
      "readViewportSize",
      "setViewportSize",
      "waitForDislikeText",
      "withNoProductionInteractions",
    ],
    id: "watch-action-topology",
    implementation: "runWatchActionTopologyScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentVideo",
      "assertRenderedDislikeCount",
      "captureWatchRatioVisual",
      "navigateToRelatedWatch",
      "openWatch",
      "soakWatchRatioVisual",
      "withNoProductionInteractions",
    ],
    id: "sidebar-navigation-stress",
    implementation: "runSidebarStressScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentShortsControl",
      "openShort",
      "reload",
      "soakCurrentShortsControl",
      "withNoProductionInteractions",
    ],
    driverMethodsByCapability: {
      "native-pair": ["captureNativeShortsVisual"],
      "strict-synthetic": ["captureSyntheticShortsVisual"],
    },
    id: "shorts-render",
    implementation: "runShortsRenderScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentShortsControl",
      "assertRenderedDislikeCount",
      "captureWatchRatioVisual",
      "openWatch",
      "readViewportSize",
      "setViewportSize",
      "waitForDislikeText",
      "withNoProductionInteractions",
    ],
    driverMethodsByCapability: {
      "native-pair": ["captureNativeShortsVisual", "openShort"],
      "strict-synthetic": ["captureSyntheticShortsVisual", "openShort"],
    },
    id: "responsive-visual",
    implementation: "runResponsiveVisualScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentVideo",
      "clickAction",
      "navigateWithinPlaylist",
      "openPlaylist",
      "readReactionState",
      "waitForDislikeText",
      "waitForReactionState",
    ],
    id: "post-navigation-vote",
    implementation: "runPostNavigationVoteScenario",
  },
  {
    driverMethods: [
      ...COMMON_PRECONDITION_METHODS,
      "assertCurrentVideo",
      "assertDislikeCountChangesObservable",
      "assertRenderedDislikeCount",
      "captureReactionStateVisual",
      "clickAction",
      "openShort",
      "openWatch",
      "readReactionState",
      "waitForDislikeText",
      "waitForReactionState",
    ],
    id: "reaction-matrix",
    implementation: "runProductionReactionMatrixScenario",
  },
]);

const SHARED_LIVE_SCENARIO_IDS = Object.freeze(SHARED_LIVE_SCENARIOS.map(({ id }) => id));
const SCENARIOS_BY_ID = new Map(SHARED_LIVE_SCENARIOS.map((scenario) => [scenario.id, scenario]));

function scenarioDriverMethods(scenario, adapter) {
  const capabilityMethods = scenario.driverMethodsByCapability?.[adapter.capabilities.shortsVisualModel] ?? [];
  return [...new Set([...scenario.driverMethods, ...capabilityMethods])];
}

function assertSharedLiveScenarioAdapter(adapter, scenarioIds = SHARED_LIVE_SCENARIO_IDS) {
  if (
    !adapter ||
    typeof adapter.createScenarioOptions !== "function" ||
    typeof adapter.assertDriverMethods !== "function"
  ) {
    throw new TypeError("A LiveRuntimeAdapter is required to run shared live scenarios.");
  }

  scenarioIds.forEach((scenarioId) => {
    const scenario = SCENARIOS_BY_ID.get(scenarioId);
    if (!scenario) throw new TypeError(`Unknown shared live scenario: ${scenarioId}`);
    adapter.assertDriverMethods(scenarioDriverMethods(scenario, adapter), scenarioId);
  });
  return [...scenarioIds];
}

function requireService(services, name, scenarioId) {
  if (typeof services?.[name] === "function") return services[name];
  throw new TypeError(`Shared scenario ${scenarioId} requires services.${name}().`);
}

function requireImplementation(implementations, scenario) {
  const implementation = implementations?.[scenario.implementation];
  if (typeof implementation !== "function") {
    throw new TypeError(`Shared scenario ${scenario.id} has no ${scenario.implementation}() implementation.`);
  }
  return implementation;
}

function createSharedLiveScenarioRunner({ implementations = defaultImplementations } = {}) {
  async function run(adapter, scenarioId, options = {}, services = {}) {
    const scenario = SCENARIOS_BY_ID.get(scenarioId);
    if (!scenario) throw new TypeError(`Unknown shared live scenario: ${scenarioId}`);
    assertSharedLiveScenarioAdapter(adapter, [scenarioId]);

    const implementation = requireImplementation(implementations, scenario);
    const scenarioOptions = adapter.createScenarioOptions(options);
    if (scenarioId === "channel-shorts-navigation") {
      return implementation(adapter.driver, scenarioOptions, services.shortsNavigationOptions);
    }
    if (scenarioId === "responsive-visual") {
      return implementation(adapter.driver, scenarioOptions, services.visualOptions);
    }
    if (scenarioId === "sidebar-navigation-stress") {
      return implementation(adapter.driver, scenarioOptions, services.sidebarOptions);
    }
    if (scenarioId === "watch-action-topology") {
      return implementation(adapter.driver, scenarioOptions, services.topologyOptions);
    }
    if (scenarioId === "post-navigation-vote") {
      return implementation(
        adapter.driver,
        scenarioOptions,
        requireService(services, "createRecorder", scenarioId),
        requireService(services, "consumeVoteApproval", scenarioId),
      );
    }
    if (scenarioId === "reaction-matrix") {
      return implementation(
        adapter.driver,
        scenarioOptions,
        requireService(services, "createRecorder", scenarioId),
        requireService(services, "consumeVoteApproval", scenarioId),
        services.visualOptions,
      );
    }
    return implementation(adapter.driver, scenarioOptions);
  }

  async function runAll(adapter, options = {}, services = {}, scenarioIds = SHARED_LIVE_SCENARIO_IDS) {
    assertSharedLiveScenarioAdapter(adapter, scenarioIds);
    const results = [];
    for (const scenarioId of scenarioIds) {
      results.push({ id: scenarioId, result: await run(adapter, scenarioId, options, services) });
    }
    return results;
  }

  return Object.freeze({
    ids: SHARED_LIVE_SCENARIO_IDS,
    run,
    runAll,
    validateAdapter: assertSharedLiveScenarioAdapter,
  });
}

module.exports = {
  SHARED_LIVE_SCENARIO_IDS,
  SHARED_LIVE_SCENARIOS,
  assertSharedLiveScenarioAdapter,
  createSharedLiveScenarioRunner,
};
