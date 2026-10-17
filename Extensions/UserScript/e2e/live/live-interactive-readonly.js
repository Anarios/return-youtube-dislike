const { runIndependentLoggedStages } = require("./live-diagnostics");
const {
  assertInteractiveReadOnlyScenarioCompletions,
  assertInteractiveReadOnlyScenarioDefinitions,
} = require("./live-interactive-scenario-contract");

const INTERACTIVE_READ_ONLY_SCENARIOS = Object.freeze([
  Object.freeze({ key: "short", name: "read-only.short-render", scenarioId: "shorts-render" }),
  Object.freeze({
    key: "channelShorts",
    name: "read-only.channel-to-shorts-and-ten-plus-valid-next",
    scenarioId: "channel-shorts-navigation",
  }),
  Object.freeze({ key: "channelWatch", name: "read-only.channel-to-watch", scenarioId: "channel-watch-navigation" }),
  Object.freeze({ key: "reload", name: "read-only.reload", scenarioId: "reload" }),
  Object.freeze({ key: "responsive", name: "read-only.responsive-visual", scenarioId: "responsive-visual" }),
  Object.freeze({ key: "spa", name: "read-only.playlist-spa", scenarioId: "spa-navigation" }),
  Object.freeze({
    key: "watchActionTopology",
    name: "read-only.watch-action-topology",
    scenarioId: "watch-action-topology",
  }),
  Object.freeze({
    key: "sidebarStress",
    name: "read-only.sidebar-stress",
    scenarioId: "sidebar-navigation-stress",
  }),
  Object.freeze({ key: "watch", name: "read-only.watch-render", scenarioId: "watch-render" }),
]);

assertInteractiveReadOnlyScenarioDefinitions(INTERACTIVE_READ_ONLY_SCENARIOS);

function createInteractiveReadOnlyStages({ diagnostics, options, readOnly, runtimeAdapter, scenarioRunner }) {
  if (!options || typeof options !== "object") throw new TypeError("Live options are required.");
  if (!options.navigation?.watch) {
    throw new TypeError("The full interactive read-only gate requires a configured channel Watch target.");
  }
  if (!readOnly || typeof readOnly !== "object") throw new TypeError("A read-only result object is required.");
  if (!runtimeAdapter) throw new TypeError("A live runtime adapter is required.");
  if (!scenarioRunner || typeof scenarioRunner.run !== "function") {
    throw new TypeError("A shared live scenario runner is required.");
  }

  return INTERACTIVE_READ_ONLY_SCENARIOS.map(({ key, name, scenarioId }) => ({
    action: async () => {
      readOnly[key] = await scenarioRunner.run(runtimeAdapter, scenarioId, options);
      return readOnly[key];
    },
    name,
    scenarioId,
  }));
}

async function runInteractiveReadOnlyAfterRuntimeReload({
  initializeRuntime,
  options,
  reloadExtension,
  runStages = runIndependentLoggedStages,
  scenarioRunner,
}) {
  if (typeof initializeRuntime !== "function") throw new TypeError("A live runtime initializer is required.");
  if (typeof runStages !== "function") throw new TypeError("A live stage executor is required.");

  let reloadResult = null;
  if (options?.runtime === "extension") {
    if (typeof reloadExtension !== "function") throw new TypeError("An extension reload function is required.");
    reloadResult = await reloadExtension();
  }

  const initialized = await initializeRuntime(reloadResult);
  if (!initialized?.diagnostics || !initialized?.runtimeAdapter) {
    throw new TypeError("The live runtime initializer must return diagnostics and a runtime adapter.");
  }

  const readOnly = {};
  const stages = createInteractiveReadOnlyStages({
    diagnostics: initialized.diagnostics,
    options,
    readOnly,
    runtimeAdapter: initialized.runtimeAdapter,
    scenarioRunner,
  });
  const completedScenarioIds = [];
  const completionTrackedStages = stages.map((stage) => ({
    ...stage,
    action: async () => {
      const result = await stage.action();
      if (result === undefined) {
        throw new Error(`Interactive read-only scenario ${stage.scenarioId} completed without a result.`);
      }
      completedScenarioIds.push(stage.scenarioId);
      return result;
    },
  }));
  await runStages(initialized.diagnostics, completionTrackedStages);
  assertInteractiveReadOnlyScenarioCompletions(completedScenarioIds);
  return { readOnly, reloadResult };
}

module.exports = {
  INTERACTIVE_READ_ONLY_SCENARIOS,
  createInteractiveReadOnlyStages,
  runInteractiveReadOnlyAfterRuntimeReload,
};
