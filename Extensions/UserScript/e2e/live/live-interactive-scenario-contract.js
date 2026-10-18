const REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS = Object.freeze([
  "shorts-render",
  "channel-shorts-navigation",
  "channel-watch-navigation",
  "reload",
  "responsive-visual",
  "spa-navigation",
  "watch-action-topology",
  "sidebar-navigation-stress",
  "watch-render",
]);

function assertExactScenarioOrder(actualScenarioIds, label) {
  if (!Array.isArray(actualScenarioIds)) throw new TypeError(`${label} must be an array.`);
  if (actualScenarioIds.some((scenarioId) => typeof scenarioId !== "string" || scenarioId.trim() === "")) {
    throw new TypeError(`${label} must contain only non-empty scenario IDs.`);
  }

  const duplicates = actualScenarioIds.filter((scenarioId, index) => actualScenarioIds.indexOf(scenarioId) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate scenario IDs: ${[...new Set(duplicates)].join(", ")}.`);
  }

  const actual = new Set(actualScenarioIds);
  const required = new Set(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS);
  const missing = REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS.filter((scenarioId) => !actual.has(scenarioId));
  const unexpected = actualScenarioIds.filter((scenarioId) => !required.has(scenarioId));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${label} does not match the required interactive read-only set. Missing: ${
        missing.join(", ") || "none"
      }; unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }

  const firstMismatch = actualScenarioIds.findIndex(
    (scenarioId, index) => scenarioId !== REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS[index],
  );
  if (actualScenarioIds.length !== REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS.length || firstMismatch !== -1) {
    throw new Error(`${label} does not follow the required interactive read-only order.`);
  }
  return true;
}

function assertUniqueDefinitionField(definitions, field) {
  const values = definitions.map((definition) => definition?.[field]);
  if (values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new TypeError(`Every interactive read-only scenario requires a non-empty ${field}.`);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Interactive read-only scenario ${field} values must be unique.`);
  }
}

function assertInteractiveReadOnlyScenarioDefinitions(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError("Interactive read-only scenario definitions must be an array.");
  assertUniqueDefinitionField(definitions, "key");
  assertUniqueDefinitionField(definitions, "name");
  return assertExactScenarioOrder(
    definitions.map((definition) => definition?.scenarioId),
    "Interactive read-only scenario definitions",
  );
}

function assertInteractiveReadOnlyScenarioCompletions(completedScenarioIds) {
  return assertExactScenarioOrder(completedScenarioIds, "Completed interactive read-only scenarios");
}

module.exports = {
  REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS,
  assertInteractiveReadOnlyScenarioCompletions,
  assertInteractiveReadOnlyScenarioDefinitions,
};
