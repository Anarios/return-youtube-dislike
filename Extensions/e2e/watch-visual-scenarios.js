const WATCH_VISUAL_RUNTIMES = Object.freeze(["userscript", "extension"]);

const WATCH_VISUAL_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "wide", width: 1280, height: 720 }),
  Object.freeze({ name: "narrow", width: 768, height: 720 }),
  Object.freeze({ name: "compact", width: 390, height: 844 }),
]);

const WATCH_REACTION_TRANSITIONS = Object.freeze([
  Object.freeze({
    action: "like",
    initialState: "neutral",
    nextState: "liked",
    value: 1,
    likesDelta: 1,
    dislikesDelta: 0,
  }),
  Object.freeze({
    action: "dislike",
    initialState: "neutral",
    nextState: "disliked",
    value: -1,
    likesDelta: 0,
    dislikesDelta: 1,
  }),
  Object.freeze({
    action: "like",
    initialState: "liked",
    nextState: "neutral",
    value: 0,
    likesDelta: -1,
    dislikesDelta: 0,
  }),
  Object.freeze({
    action: "dislike",
    initialState: "liked",
    nextState: "disliked",
    value: -1,
    likesDelta: -1,
    dislikesDelta: 1,
  }),
  Object.freeze({
    action: "like",
    initialState: "disliked",
    nextState: "liked",
    value: 1,
    likesDelta: 1,
    dislikesDelta: -1,
  }),
  Object.freeze({
    action: "dislike",
    initialState: "disliked",
    nextState: "neutral",
    value: 0,
    likesDelta: 0,
    dislikesDelta: -1,
  }),
]);

const WATCH_VISUAL_SCENARIOS = Object.freeze(
  WATCH_VISUAL_VIEWPORTS.flatMap((viewport) =>
    WATCH_REACTION_TRANSITIONS.map((transition) =>
      Object.freeze({
        id: `watch-${viewport.name}-${transition.initialState}-${transition.action}-${transition.nextState}`,
        transition,
        viewport,
      }),
    ),
  ),
);

const WATCH_VISUAL_RUNTIME_REGISTRATIONS = Object.freeze(
  Object.fromEntries(
    WATCH_VISUAL_RUNTIMES.map((runtime) => [
      runtime,
      Object.freeze({
        runtime,
        scenarioIds: Object.freeze(WATCH_VISUAL_SCENARIOS.map(({ id }) => id)),
      }),
    ]),
  ),
);

function getWatchVisualRuntimeRegistration(runtime) {
  const registration = WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime];
  if (!registration) throw new TypeError(`Unsupported Watch visual runtime: ${runtime}`);
  return registration;
}

function getWatchNeutralBaselineId(scenario) {
  if (!scenario?.transition || !scenario?.viewport) {
    throw new TypeError("A Watch visual scenario is required.");
  }
  return scenario.transition.initialState === "neutral" && scenario.transition.action === "like"
    ? `watch-${scenario.viewport.name}-neutral`
    : null;
}

function registerWatchVisualContract({ runScenario, runtime, test }) {
  if (typeof test !== "function" || typeof test.describe !== "function") {
    throw new TypeError("The Watch visual contract requires a Playwright-compatible test function.");
  }
  if (typeof runScenario !== "function") {
    throw new TypeError("The Watch visual contract requires runScenario().");
  }

  const registration = getWatchVisualRuntimeRegistration(runtime);
  test.describe(`${runtime} Watch visual contract`, () => {
    for (const scenario of WATCH_VISUAL_SCENARIOS) {
      test(scenario.id, async ({ context, page }, testInfo) =>
        runScenario({ fixtures: { context, page }, registration, scenario, testInfo }),
      );
    }
  });
  return registration;
}

module.exports = {
  WATCH_REACTION_TRANSITIONS,
  WATCH_VISUAL_RUNTIMES,
  WATCH_VISUAL_RUNTIME_REGISTRATIONS,
  WATCH_VISUAL_SCENARIOS,
  WATCH_VISUAL_VIEWPORTS,
  getWatchNeutralBaselineId,
  getWatchVisualRuntimeRegistration,
  registerWatchVisualContract,
};
