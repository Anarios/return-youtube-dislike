const { NAVIGATION_MATRIX } = require("../UserScript/e2e/navigation-matrix");
const { SHARED_LIVE_SCENARIO_IDS } = require("./shared-live-scenarios");
const { LIVE_RUNTIME_PROFILES } = require("./live-runtime-adapter");

const REQUIRED_SURFACE_PAIRS = ["watch->watch", "watch->shorts", "shorts->watch", "shorts->shorts"];
const REQUIRED_TRIGGERS = [
  "autoplay-ended",
  "direct-link",
  "dom-corruption",
  "dom-replacement",
  "history-back-forward",
  "navigate-start-only",
  "next-control",
  "sidebar-link",
];
const REQUIRED_DOM_FEATURES = [
  "active-reel-switch",
  "complete-native-inventory",
  "connected-collapsed-rate-bar",
  "connected-hidden-rate-bar",
  "delayed-hydration",
  "exact-href-identity",
  "hidden-outgoing-first",
  "incomplete-rendered-native-inventory",
  "legacy-segmented-duplicate-ids",
  "malformed-rate-bar",
  "no-useful-control-mutation",
  "no-is-active",
  "no-synthetic-mutation",
  "no-video-id",
  "non-rendered-native-action",
  "native-dislike-present",
  "positive-size-offscreen-outgoing-first",
  "persistent-data-null-action-root",
  "prune-current-bar",
  "replace-action-root",
  "replace-controls",
  "replace-current-action-container",
  "replace-page-and-controls-after-start",
  "reuse-exact-control-nodes",
  "retain-hidden-outgoing",
  "same-current-root",
  "stable-action-root-geometry",
  "stripped-rate-bar-wrapper-class",
  "unrelated-description-short-link",
];
const REQUIRED_TIMINGS = [
  "data-null-past-watchdog",
  "destination-count-gated",
  "finish-before-hydration",
  "inert-beyond-fallback-window",
  "native-dislike-after-stability",
  "native-dislike-without-synthetic-mutation",
  "no-navigate-finish",
  "no-navigation-event",
  "navigate-finish",
  "navigate-start-without-finish",
  "same-video",
  "settled",
  "stable-native-inventory",
];
const REQUIRED_SHARED_LIVE_SCENARIOS = [
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
const REQUIRED_POSTCONDITIONS = ["no-destination-dislike", "single-destination-dislike"];

function collectCoverage(axis) {
  return new Set(
    NAVIGATION_MATRIX.flatMap((scenario) => {
      const value = scenario.coverage[axis];
      return Array.isArray(value) ? value : [value];
    }),
  );
}

describe("systematic browser coverage contract", () => {
  test("keeps every declarative scenario uniquely identified and completely classified", () => {
    expect(new Set(NAVIGATION_MATRIX.map(({ id }) => id)).size).toBe(NAVIGATION_MATRIX.length);
    for (const scenario of NAVIGATION_MATRIX) {
      expect(scenario).toEqual(
        expect.objectContaining({
          coverage: expect.objectContaining({
            destination: expect.any(String),
            dom: expect.any(Array),
            origin: expect.any(String),
            timing: expect.any(Array),
            trigger: expect.any(String),
            width: expect.any(String),
          }),
          destination: expect.objectContaining({ counts: expect.any(Object), kind: expect.any(String) }),
          id: expect.any(String),
          origin: expect.objectContaining({ counts: expect.any(Object), kind: expect.any(String) }),
          postcondition: expect.any(String),
          viewport: expect.objectContaining({ height: expect.any(Number), width: expect.any(Number) }),
        }),
      );
    }
  });

  test("keeps both interactive and intentionally inert navigation postconditions", () => {
    expect([...new Set(NAVIGATION_MATRIX.map(({ postcondition }) => postcondition))].sort()).toEqual(
      REQUIRED_POSTCONDITIONS,
    );
  });

  test("covers every watch and Shorts direction and every required navigation trigger", () => {
    const surfacePairs = new Set(
      NAVIGATION_MATRIX.map(({ coverage }) => `${coverage.origin}->${coverage.destination}`),
    );
    REQUIRED_SURFACE_PAIRS.forEach((pair) => expect(surfacePairs).toContain(pair));
    const triggers = collectCoverage("trigger");
    REQUIRED_TRIGGERS.forEach((trigger) => expect(triggers).toContain(trigger));
  });

  test("keeps the retained, replacement, hydration, pruning, and event-order stress cells", () => {
    const domFeatures = collectCoverage("dom");
    REQUIRED_DOM_FEATURES.forEach((feature) => expect(domFeatures).toContain(feature));
    const timings = collectCoverage("timing");
    REQUIRED_TIMINGS.forEach((timing) => expect(timings).toContain(timing));
  });

  test("uses distinguishable ratios whenever a scenario changes videos", () => {
    for (const scenario of NAVIGATION_MATRIX.filter(
      ({ destination, origin }) => destination.videoId !== origin.videoId,
    )) {
      const ratio = ({ likes, dislikes }) => likes / (likes + dislikes);
      expect(ratio(scenario.origin.counts)).not.toBe(ratio(scenario.destination.counts));
    }
  });

  test("keeps the same authenticated scenario catalog for both runtime adapters", () => {
    expect(SHARED_LIVE_SCENARIO_IDS).toEqual(REQUIRED_SHARED_LIVE_SCENARIOS);
  });

  test.each(["userscript", "extension"])(
    "distinguishes owned desktop Shorts from native-dependent mobile compatibility for %s",
    (runtime) => {
      expect(LIVE_RUNTIME_PROFILES[runtime].capabilities.shortsControlModelBySurface).toEqual({
        desktop: "synthetic-owned",
        mobile: "native-youtube-required",
      });
    },
  );
});
