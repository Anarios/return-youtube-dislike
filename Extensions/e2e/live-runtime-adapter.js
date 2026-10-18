const assert = require("node:assert/strict");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const LIVE_RUNTIME_PROFILES = deepFreeze({
  extension: {
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
    runtime: "extension",
    selectors: {
      rateBar: "#ryd-bar",
      rateBarContainer: "#ryd-bar-container",
      shortsDislikeControl: "[data-ryd-synthetic-shorts-dislike]",
      tooltipContent: "#ryd-dislike-tooltip",
      tooltipTrigger: ".ryd-tooltip",
    },
  },
  userscript: {
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
    runtime: "userscript",
    selectors: {
      rateBar: "#return-youtube-dislike-bar",
      rateBarContainer: "#return-youtube-dislike-bar-container",
      shortsDislikeControl: "[data-ryd-synthetic-shorts-dislike]",
      tooltipContent: ".ryd-tooltip-label",
      tooltipTrigger: ".ryd-tooltip",
    },
  },
});

function requireDriverMethod(driver, method, scenarioId = null) {
  if (typeof driver?.[method] === "function") return;
  const scenario = scenarioId ? ` for shared scenario ${scenarioId}` : "";
  throw new TypeError(`The ${driver ? "live driver" : "missing driver"}${scenario} must implement ${method}().`);
}

function assertRuntimeArgument(value, expected, label) {
  if (value === undefined) return;
  assert.equal(value, expected, `${label} does not match the selected live runtime adapter.`);
}

function createRuntimeBoundDriver(driver, runtime, expectedVersion, expectedBuildId, capabilities) {
  return new Proxy(driver, {
    get(target, property, receiver) {
      if (property === "assertRuntime") {
        return (requestedRuntime, requestedVersion, requestedBuildId) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The asserted runtime");
          assertRuntimeArgument(requestedVersion, expectedVersion, "The asserted runtime version");
          assertRuntimeArgument(requestedBuildId, expectedBuildId, "The asserted live build ID");
          requireDriverMethod(target, "assertRuntime");
          return target.assertRuntime(runtime, expectedVersion, expectedBuildId);
        };
      }

      if (property === "assertCurrentShortsControl") {
        return (videoId, requestedRuntime, assertionOptions) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The Shorts-control runtime");
          requireDriverMethod(target, "assertCurrentShortsControl");
          return assertionOptions === undefined
            ? target.assertCurrentShortsControl(videoId, runtime)
            : target.assertCurrentShortsControl(videoId, runtime, assertionOptions);
        };
      }

      if (property === "soakCurrentShortsControl") {
        return (videoId, requestedRuntime, expectedDislikes, soakOptions) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The Shorts-control soak runtime");
          requireDriverMethod(target, "soakCurrentShortsControl");
          return target.soakCurrentShortsControl(videoId, runtime, expectedDislikes, soakOptions);
        };
      }

      if (property === "assertCurrentWatchResult") {
        return (videoId, requestedRuntime, expectedCounts, assertionOptions) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The Watch-result runtime");
          requireDriverMethod(target, "assertCurrentWatchResult");
          return assertionOptions === undefined
            ? target.assertCurrentWatchResult(videoId, runtime, expectedCounts)
            : target.assertCurrentWatchResult(videoId, runtime, expectedCounts, assertionOptions);
        };
      }

      if (property === "assertRenderedDislikeCount") {
        return (renderedCount, dislikes, requestedRuntime) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The rendered-count runtime");
          requireDriverMethod(target, "assertRenderedDislikeCount");
          return target.assertRenderedDislikeCount(renderedCount, dislikes, runtime);
        };
      }

      if (property === "assertDislikeCountChangesObservable") {
        return (changes, requestedRuntime) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The reaction count-observability runtime");
          requireDriverMethod(target, "assertDislikeCountChangesObservable");
          return target.assertDislikeCountChangesObservable(changes, runtime);
        };
      }

      if (property === "captureWatchRatioVisual") {
        return (requestedRuntime, screenshotPath, options) => {
          assertRuntimeArgument(requestedRuntime, runtime, "The watch-visual runtime");
          requireDriverMethod(target, "captureWatchRatioVisual");
          return options === undefined
            ? target.captureWatchRatioVisual(runtime, screenshotPath)
            : target.captureWatchRatioVisual(runtime, screenshotPath, options);
        };
      }

      if (property === "captureReactionStateVisual") {
        return (request) => {
          assertRuntimeArgument(request?.runtime, runtime, "The reaction-visual runtime");
          assertRuntimeArgument(
            request?.shortsVisualModel,
            capabilities.shortsVisualModel,
            "The reaction-visual Shorts model",
          );
          requireDriverMethod(target, "captureReactionStateVisual");
          return target.captureReactionStateVisual({
            ...request,
            runtime,
            shortsVisualModel: capabilities.shortsVisualModel,
          });
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

class LiveRuntimeAdapter {
  constructor({ driver, expectedBuildId, expectedVersion, runtime }) {
    const profile = LIVE_RUNTIME_PROFILES[runtime];
    if (!profile) throw new TypeError(`Unsupported live runtime adapter: ${runtime}`);
    if (!driver || (typeof driver !== "object" && typeof driver !== "function")) {
      throw new TypeError("A live YouTube driver is required.");
    }
    if (typeof expectedVersion !== "string" || expectedVersion.trim() === "") {
      throw new TypeError("A non-empty expected runtime version is required.");
    }
    if (!/^[a-f0-9]{32}$/.test(expectedBuildId)) {
      throw new TypeError("The expected live build ID must be a 32-character lowercase hexadecimal value.");
    }

    if (typeof driver.configureRequestAttributionRuntime === "function") {
      driver.configureRequestAttributionRuntime(runtime);
    }

    this.capabilities = profile.capabilities;
    this.driver = createRuntimeBoundDriver(driver, runtime, expectedVersion, expectedBuildId, this.capabilities);
    this.expectedBuildId = expectedBuildId;
    this.expectedVersion = expectedVersion;
    this.profile = profile;
    this.runtime = runtime;
    this.selectors = profile.selectors;
  }

  createScenarioOptions(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Shared live scenario options must be an object.");
    }
    assertRuntimeArgument(options.runtime, this.runtime, "The configured scenario runtime");
    assertRuntimeArgument(options.expectedBuildId, this.expectedBuildId, "The configured live build ID");
    assertRuntimeArgument(options.expectedVersion, this.expectedVersion, "The configured scenario runtime version");
    return {
      ...options,
      capabilities: this.capabilities,
      expectedBuildId: this.expectedBuildId,
      expectedVersion: this.expectedVersion,
      runtime: this.runtime,
    };
  }

  assertDriverMethods(methods, scenarioId) {
    methods.forEach((method) => requireDriverMethod(this.driver, method, scenarioId));
  }
}

function createExtensionLiveRuntimeAdapter(options) {
  return new LiveRuntimeAdapter({ ...options, runtime: "extension" });
}

function createUserscriptLiveRuntimeAdapter(options) {
  return new LiveRuntimeAdapter({ ...options, runtime: "userscript" });
}

module.exports = {
  LIVE_RUNTIME_PROFILES,
  LiveRuntimeAdapter,
  createExtensionLiveRuntimeAdapter,
  createUserscriptLiveRuntimeAdapter,
};
