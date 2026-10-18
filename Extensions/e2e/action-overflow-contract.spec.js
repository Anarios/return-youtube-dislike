const assert = require("node:assert/strict");
const {
  ACTION_OVERFLOW_SCENARIOS,
  OPTIONAL_ACTIONS,
  assertActionOverflowScenario,
  requiredActionRowWidth,
} = require("./action-overflow-contract");

describe("action overflow E2E contract", () => {
  test("locks explicit roomy, constrained, and opted-in clutter scenarios", () => {
    expect(ACTION_OVERFLOW_SCENARIOS.map(({ id }) => id)).toEqual([
      "roomy-keeps-every-optional-action",
      "one-button-overflow-hides-one",
      "two-button-overflow-hides-two",
      "three-button-overflow-hides-three",
      "narrow-action-allocation-overflows-every-optional-action",
      "hide-clutter-keeps-only-reactions",
    ]);
  });

  test.each(ACTION_OVERFLOW_SCENARIOS.filter(({ hideClutterButtons }) => !hideClutterButtons))(
    "$id is the maximal prefix that fits",
    (scenario) => {
      expect(requiredActionRowWidth(scenario.expectedTopLevel)).toBeLessThanOrEqual(scenario.availableWidth);
      if (scenario.expectedOverflow.length > 0) {
        expect(requiredActionRowWidth([...scenario.expectedTopLevel, scenario.expectedOverflow[0]])).toBeGreaterThan(
          scenario.availableWidth,
        );
      }
    },
  );

  test("the opt-in scenario moves every optional action under More", () => {
    const scenario = ACTION_OVERFLOW_SCENARIOS.find(({ hideClutterButtons }) => hideClutterButtons);
    expect(scenario.expectedTopLevel).toEqual([]);
    expect(scenario.expectedOverflow).toEqual(OPTIONAL_ACTIONS.map(({ id }) => id));
  });

  test("the oracle rejects a false-green snapshot that hides every button at a constrained width", () => {
    const scenario = ACTION_OVERFLOW_SCENARIOS.find(({ id }) => id === "one-button-overflow-hides-one");
    const falseGreen = {
      duplicateActionIds: [],
      moreButtonCount: 1,
      overflowActionIds: OPTIONAL_ACTIONS.map(({ id }) => id),
      reactionGroupCount: 1,
      topLevelActionIds: [],
    };
    expect(() => assertActionOverflowScenario(falseGreen, scenario, assert)).toThrow("wrong top-level actions");
  });
});
