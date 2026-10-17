const fs = require("node:fs");
const path = require("node:path");
const {
  WATCH_REACTION_TRANSITIONS,
  WATCH_VISUAL_RUNTIMES,
  WATCH_VISUAL_RUNTIME_REGISTRATIONS,
  WATCH_VISUAL_SCENARIOS,
  WATCH_VISUAL_VIEWPORTS,
  getWatchNeutralBaselineId,
  registerWatchVisualContract,
} = require("./watch-visual-scenarios");

const REQUIRED_VIEWPORTS = [
  { name: "wide", width: 1280, height: 720 },
  { name: "narrow", width: 768, height: 720 },
  { name: "compact", width: 390, height: 844 },
];
const REQUIRED_TRANSITIONS = [
  ["neutral", "like", "liked", 1],
  ["neutral", "dislike", "disliked", -1],
  ["liked", "like", "neutral", 0],
  ["liked", "dislike", "disliked", -1],
  ["disliked", "like", "liked", 1],
  ["disliked", "dislike", "neutral", 0],
];
const WRAPPER_SPECS = {
  extension: path.join(__dirname, "extension", "extension-artifact-visual.e2e.js"),
  userscript: path.join(__dirname, "..", "UserScript", "e2e", "userscript-state-visual-contract.e2e.js"),
};

function scenarioKey({ transition, viewport }) {
  return [viewport.name, transition.initialState, transition.action, transition.nextState, transition.value].join(":");
}

describe("shared Watch visual scenario registration", () => {
  test("keeps the complete three-width by six-transition product", () => {
    expect(WATCH_VISUAL_VIEWPORTS).toEqual(REQUIRED_VIEWPORTS);
    expect(
      WATCH_REACTION_TRANSITIONS.map(({ initialState, action, nextState, value }) => [
        initialState,
        action,
        nextState,
        value,
      ]),
    ).toEqual(REQUIRED_TRANSITIONS);

    const requiredKeys = REQUIRED_VIEWPORTS.flatMap((viewport) =>
      REQUIRED_TRANSITIONS.map(([initialState, action, nextState, value]) =>
        [viewport.name, initialState, action, nextState, value].join(":"),
      ),
    );
    expect(WATCH_VISUAL_SCENARIOS).toHaveLength(18);
    expect(WATCH_VISUAL_SCENARIOS.map(scenarioKey)).toEqual(requiredKeys);
    expect(new Set(WATCH_VISUAL_SCENARIOS.map(({ id }) => id)).size).toBe(18);
  });

  test("binds both runtimes to the identical immutable scenario ID catalog", () => {
    const expectedIds = WATCH_VISUAL_SCENARIOS.map(({ id }) => id);
    expect(WATCH_VISUAL_RUNTIMES).toEqual(["userscript", "extension"]);
    for (const runtime of WATCH_VISUAL_RUNTIMES) {
      expect(WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime]).toEqual({ runtime, scenarioIds: expectedIds });
      expect(Object.isFrozen(WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime])).toBe(true);
      expect(Object.isFrozen(WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime].scenarioIds)).toBe(true);
    }
    expect(WATCH_VISUAL_RUNTIME_REGISTRATIONS.userscript.scenarioIds).toEqual(
      WATCH_VISUAL_RUNTIME_REGISTRATIONS.extension.scenarioIds,
    );
  });

  test("selects exactly one neutral baseline capture per viewport", () => {
    expect(WATCH_VISUAL_SCENARIOS.map(getWatchNeutralBaselineId).filter(Boolean)).toEqual([
      "watch-wide-neutral",
      "watch-narrow-neutral",
      "watch-compact-neutral",
    ]);
    expect(() => getWatchNeutralBaselineId(null)).toThrow("A Watch visual scenario is required.");
  });

  test.each(WATCH_VISUAL_RUNTIMES)("the %s registrar cannot filter or omit shared scenarios", (runtime) => {
    const declared = [];
    const fakeTest = (id, implementation) => declared.push({ id, implementation });
    fakeTest.describe = (_name, declaration) => declaration();

    const registration = registerWatchVisualContract({ runtime, test: fakeTest, runScenario: jest.fn() });

    expect(registration).toBe(WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime]);
    expect(declared.map(({ id }) => id)).toEqual(WATCH_VISUAL_RUNTIME_REGISTRATIONS[runtime].scenarioIds);
    expect(declared.every(({ implementation }) => typeof implementation === "function")).toBe(true);
  });

  test.each(Object.entries(WRAPPER_SPECS))(
    "%s wrapper delegates declaration to the shared registrar",
    (runtime, specPath) => {
      const source = fs.readFileSync(specPath, "utf8");
      expect(source.match(/registerWatchVisualContract\s*\(\s*\{/g)).toHaveLength(1);
      expect(source).toContain(`runtime: "${runtime}"`);
      expect(source).not.toMatch(/for\s*\(const\s+(?:viewport|transition)\s+of\s+WATCH_/);
    },
  );
});
