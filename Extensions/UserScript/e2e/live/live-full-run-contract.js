const { spawnSync } = require("node:child_process");
const path = require("node:path");

const REQUIRED_PRODUCTION_REACTION_SCENARIOS = Object.freeze(["post-navigation-vote", "reaction-matrix"]);
const SUPPORTED_LIVE_RUNTIMES = new Set(["extension", "userscript"]);
const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

class LiveValidationIncompleteError extends Error {
  constructor(message) {
    super(message);
    this.code = "LIVE_VALIDATION_INCOMPLETE";
    this.name = "LiveValidationIncompleteError";
  }
}

function readFullLiveRuntime(environment = process.env) {
  const runtime = environment.RYD_LIVE_RUNTIME?.trim();
  if (!SUPPORTED_LIVE_RUNTIMES.has(runtime)) {
    throw new Error('RYD_LIVE_RUNTIME must be either "userscript" or "extension" before building a full live run.');
  }
  return runtime;
}

function buildLiveRuntimeArtifact(
  runtime,
  {
    environment = process.env,
    nodeExecutable = process.execPath,
    platform = process.platform,
    repositoryRoot = REPOSITORY_ROOT,
    spawnSyncImpl = spawnSync,
  } = {},
) {
  if (!SUPPORTED_LIVE_RUNTIMES.has(runtime)) throw new TypeError(`Unsupported live build runtime: ${runtime}`);
  const script = `build:live:${runtime}`;
  const npmExecutable = environment.npm_execpath?.trim();
  const command = npmExecutable ? nodeExecutable : platform === "win32" ? "npm.cmd" : "npm";
  const args = npmExecutable ? [npmExecutable, "run", script] : ["run", script];
  const result = spawnSyncImpl(command, args, {
    cwd: repositoryRoot,
    env: environment,
    ...(platform === "win32" && !npmExecutable ? { shell: true } : {}),
    stdio: "inherit",
  });
  if (result.error) throw new Error(`Could not execute npm run ${script}.`, { cause: result.error });
  if (result.status !== 0) throw new Error(`npm run ${script} failed with exit code ${result.status}.`);
  return { runtime, script };
}

function requireUserscriptInstallAcknowledgement(value) {
  if (value?.trim() !== "INSTALLED") {
    throw new LiveValidationIncompleteError(
      "Full userscript validation is incomplete because the freshly built userscript was not acknowledged as installed.",
    );
  }
  return true;
}

function requireProductionReactionApproval(value) {
  if (value?.trim().toUpperCase() === "SKIP") {
    throw new LiveValidationIncompleteError(
      "Full live validation is incomplete because production reaction scenarios were skipped.",
    );
  }
  return value?.trim() ?? "";
}

function assertFullLiveReactionCompletion(results) {
  if (!results || typeof results !== "object") {
    throw new LiveValidationIncompleteError("Full live validation has no production reaction results.");
  }
  const missing = REQUIRED_PRODUCTION_REACTION_SCENARIOS.filter((scenarioId) => results[scenarioId] == null);
  if (missing.length > 0) {
    throw new LiveValidationIncompleteError(
      `Full live validation did not complete production reaction scenarios: ${missing.join(", ")}.`,
    );
  }
  return Object.freeze({
    classification: "full",
    completedScenarioIds: REQUIRED_PRODUCTION_REACTION_SCENARIOS,
    productionReactionsCompleted: true,
    releaseReady: true,
  });
}

module.exports = {
  LiveValidationIncompleteError,
  REQUIRED_PRODUCTION_REACTION_SCENARIOS,
  assertFullLiveReactionCompletion,
  buildLiveRuntimeArtifact,
  readFullLiveRuntime,
  requireProductionReactionApproval,
  requireUserscriptInstallAcknowledgement,
};
