const REACTION_GROUP_ID = "reactions";
const MORE_BUTTON_ID = "more";
const ACTION_GAP_PX = 8;
const REACTION_GROUP_WIDTH_PX = 232;
const MORE_BUTTON_WIDTH_PX = 48;

const OPTIONAL_ACTIONS = Object.freeze([
  Object.freeze({ id: "share", label: "Share", width: 104 }),
  Object.freeze({ id: "save", label: "Save", width: 88 }),
  Object.freeze({ id: "thanks", label: "Thanks", width: 104 }),
  Object.freeze({ id: "download", label: "Download", width: 112 }),
]);

const ACTION_OVERFLOW_SCENARIOS = Object.freeze([
  Object.freeze({
    availableWidth: 760,
    expectedOverflow: Object.freeze([]),
    expectedTopLevel: Object.freeze(["share", "save", "thanks", "download"]),
    hideClutterButtons: false,
    id: "roomy-keeps-every-optional-action",
  }),
  Object.freeze({
    availableWidth: 680,
    expectedOverflow: Object.freeze(["download"]),
    expectedTopLevel: Object.freeze(["share", "save", "thanks"]),
    hideClutterButtons: false,
    id: "one-button-overflow-hides-one",
  }),
  Object.freeze({
    availableWidth: 560,
    expectedOverflow: Object.freeze(["thanks", "download"]),
    expectedTopLevel: Object.freeze(["share", "save"]),
    hideClutterButtons: false,
    id: "two-button-overflow-hides-two",
  }),
  Object.freeze({
    availableWidth: 450,
    expectedOverflow: Object.freeze(["save", "thanks", "download"]),
    expectedTopLevel: Object.freeze(["share"]),
    hideClutterButtons: false,
    id: "three-button-overflow-hides-three",
  }),
  Object.freeze({
    availableWidth: 375,
    expectedOverflow: Object.freeze(["share", "save", "thanks", "download"]),
    expectedTopLevel: Object.freeze([]),
    hideClutterButtons: false,
    id: "narrow-action-allocation-overflows-every-optional-action",
  }),
  Object.freeze({
    availableWidth: 760,
    expectedOverflow: Object.freeze(["share", "save", "thanks", "download"]),
    expectedTopLevel: Object.freeze([]),
    hideClutterButtons: true,
    id: "hide-clutter-keeps-only-reactions",
  }),
]);

function requiredActionRowWidth(topLevelActionIds) {
  const widths = topLevelActionIds.map((id) => {
    const action = OPTIONAL_ACTIONS.find((candidate) => candidate.id === id);
    if (!action) throw new TypeError(`Unknown optional action: ${id}`);
    return action.width;
  });
  const itemCount = 2 + topLevelActionIds.length;
  return (
    REACTION_GROUP_WIDTH_PX +
    MORE_BUTTON_WIDTH_PX +
    widths.reduce((total, width) => total + width, 0) +
    ACTION_GAP_PX * (itemCount - 1)
  );
}

function assertActionOverflowScenario(snapshot, scenario, assert) {
  assert.deepEqual(snapshot.topLevelActionIds, scenario.expectedTopLevel, `${scenario.id}: wrong top-level actions`);
  assert.deepEqual(snapshot.overflowActionIds, scenario.expectedOverflow, `${scenario.id}: wrong overflow actions`);
  assert.equal(snapshot.reactionGroupCount, 1, `${scenario.id}: the reaction group must remain top-level exactly once`);
  assert.equal(snapshot.moreButtonCount, 1, `${scenario.id}: the More button must exist exactly once`);
  assert.equal(snapshot.duplicateActionIds.length, 0, `${scenario.id}: an action was duplicated across the two menus`);
  assert.deepEqual(
    [...snapshot.topLevelActionIds, ...snapshot.overflowActionIds].sort(),
    OPTIONAL_ACTIONS.map(({ id }) => id).sort(),
    `${scenario.id}: an optional action disappeared`,
  );

  if (!scenario.hideClutterButtons) {
    assert.ok(
      requiredActionRowWidth(snapshot.topLevelActionIds) <= scenario.availableWidth,
      `${scenario.id}: the selected top-level actions do not fit`,
    );
    if (snapshot.overflowActionIds.length > 0) {
      const nextHiddenAction = snapshot.overflowActionIds[0];
      assert.ok(
        requiredActionRowWidth([...snapshot.topLevelActionIds, nextHiddenAction]) > scenario.availableWidth,
        `${scenario.id}: more actions were hidden than necessary`,
      );
    }
  }
}

module.exports = {
  ACTION_GAP_PX,
  ACTION_OVERFLOW_SCENARIOS,
  MORE_BUTTON_ID,
  MORE_BUTTON_WIDTH_PX,
  OPTIONAL_ACTIONS,
  REACTION_GROUP_ID,
  REACTION_GROUP_WIDTH_PX,
  assertActionOverflowScenario,
  requiredActionRowWidth,
};
