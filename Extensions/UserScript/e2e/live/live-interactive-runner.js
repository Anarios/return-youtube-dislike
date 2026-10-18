const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { chromium } = require("@playwright/test");
const {
  createExtensionLiveRuntimeAdapter,
  createUserscriptLiveRuntimeAdapter,
} = require("../../../e2e/live-runtime-adapter");
const { createSharedLiveScenarioRunner } = require("../../../e2e/shared-live-scenarios");
const { consumeLiveVoteApproval, hasFreshVoteApproval, readLiveOptions } = require("../../live/live-options");
const { selectAuthenticatedYoutubeContext } = require("./live-authenticated-context");
const { LiveRunDiagnostics, runLoggedStage } = require("./live-diagnostics");
const { reloadLiveExtensionInBrowser } = require("./live-extension-reloader");
const {
  assertFullLiveReactionCompletion,
  buildLiveRuntimeArtifact,
  readFullLiveRuntime,
  requireProductionReactionApproval,
  requireUserscriptInstallAcknowledgement,
} = require("./live-full-run-contract");
const { runInteractiveReadOnlyAfterRuntimeReload } = require("./live-interactive-readonly");
const { LiveYoutubeDriver, VoteTrafficRecorder, withOperationTimeout } = require("./live-youtube-driver");

const REPOSITORY_DIRECTORY = path.resolve(__dirname, "../../../..");
const LIVE_EVIDENCE_DIRECTORY = path.resolve(__dirname, "../../../../test-results/live-youtube");
const LIVE_EVIDENCE_PARENT_DIRECTORY = path.dirname(LIVE_EVIDENCE_DIRECTORY);
const LIVE_ATTEMPT_PAGE_CLOSE_TIMEOUT_MS = 10_000;
const LIVE_SESSION_COMMANDS = new Set(["EXIT", "RERUN"]);
const scenarioRunner = createSharedLiveScenarioRunner();

function createInputLineReader(input = process.stdin) {
  const lineInterface = readline.createInterface({ input, terminal: false });
  const bufferedLines = [];
  const waiters = [];
  let closed = false;

  lineInterface.on("line", (line) => {
    const value = line.trim();
    const waiter = waiters.shift();
    if (waiter) waiter(value);
    else bufferedLines.push(value);
  });
  lineInterface.once("close", () => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter(null);
  });

  return {
    close: () => lineInterface.close(),
    readLine: () => {
      if (bufferedLines.length > 0) return Promise.resolve(bufferedLines.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function readPersistentSessionMode(environment = process.env) {
  const configured = environment.RYD_LIVE_KEEP_CDP_SESSION?.trim();
  if (!configured) return false;
  if (configured !== "1") {
    throw new Error("RYD_LIVE_KEEP_CDP_SESSION must be 1 or unset.");
  }
  return true;
}

function normalizeLiveSessionCommand(value) {
  if (value === null) return "EXIT";
  const command = value?.trim().toUpperCase();
  return LIVE_SESSION_COMMANDS.has(command) ? command : null;
}

function assertReusableConnectionOptions(initialOptions, nextOptions) {
  const immutableFields = ["cdpEndpoint", "expectedChannel", "runtime"];
  for (const field of immutableFields) {
    if (nextOptions?.[field] !== initialOptions?.[field]) {
      throw new Error(
        `Cannot reuse the live browser connection after ${field} changed from ${initialOptions?.[field] ?? "<missing>"} to ${nextOptions?.[field] ?? "<missing>"}. Exit and start a new live runner instead.`,
      );
    }
  }
  return nextOptions;
}

function copyDirectoryEntry(source, destination, fsImpl = fs) {
  const stats = fsImpl.statSync(source);
  if (stats.isDirectory()) {
    fsImpl.mkdirSync(destination, { recursive: true });
    for (const entry of fsImpl.readdirSync(source)) {
      copyDirectoryEntry(path.join(source, entry), path.join(destination, entry), fsImpl);
    }
    return;
  }
  fsImpl.mkdirSync(path.dirname(destination), { recursive: true });
  fsImpl.copyFileSync(source, destination);
}

function canonicalizeExistingPath(targetPath, fsImpl = fs) {
  const resolvedPath = path.resolve(targetPath);
  if (!fsImpl.existsSync(resolvedPath)) return resolvedPath;
  const realpath = fsImpl.realpathSync?.native ?? fsImpl.realpathSync;
  return realpath ? realpath(resolvedPath) : resolvedPath;
}

function pathsAreEqual(left, right) {
  const normalize = (value) => {
    const normalized = path.normalize(value);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return normalize(left) === normalize(right);
}

function isAttemptsEvidenceEntry(entry) {
  return entry.toLowerCase() === "attempts";
}

function resolveSafeLiveEvidenceDirectory(
  evidenceDirectory = LIVE_EVIDENCE_DIRECTORY,
  fsImpl = fs,
  allowedParentDirectory = LIVE_EVIDENCE_PARENT_DIRECTORY,
) {
  const resolvedEvidenceDirectory = canonicalizeExistingPath(evidenceDirectory, fsImpl);
  const resolvedRepositoryDirectory = canonicalizeExistingPath(REPOSITORY_DIRECTORY, fsImpl);
  const resolvedAllowedParentDirectory = canonicalizeExistingPath(allowedParentDirectory, fsImpl);
  const filesystemRoot = path.parse(resolvedEvidenceDirectory).root;
  if (
    pathsAreEqual(resolvedEvidenceDirectory, filesystemRoot) ||
    pathsAreEqual(resolvedEvidenceDirectory, resolvedRepositoryDirectory) ||
    !pathsAreEqual(path.dirname(resolvedEvidenceDirectory), resolvedAllowedParentDirectory) ||
    !pathsAreEqual(path.basename(resolvedEvidenceDirectory), "live-youtube")
  ) {
    throw new Error(
      `Refusing to reset unsafe live evidence directory ${resolvedEvidenceDirectory}. The target must be the dedicated live-youtube directory directly under ${resolvedAllowedParentDirectory}, never a filesystem or repository root.`,
    );
  }
  if (fsImpl.existsSync(resolvedEvidenceDirectory) && !fsImpl.statSync(resolvedEvidenceDirectory).isDirectory()) {
    throw new Error(`Refusing to reset live evidence path because it is not a directory: ${resolvedEvidenceDirectory}`);
  }
  return resolvedEvidenceDirectory;
}

function resetLiveAttemptEvidenceWorkspace(
  { attemptNumber } = {},
  {
    allowedParentDirectory = LIVE_EVIDENCE_PARENT_DIRECTORY,
    evidenceDirectory = LIVE_EVIDENCE_DIRECTORY,
    fsImpl = fs,
  } = {},
) {
  const resolvedEvidenceDirectory = resolveSafeLiveEvidenceDirectory(evidenceDirectory, fsImpl, allowedParentDirectory);
  if (!fsImpl.existsSync(resolvedEvidenceDirectory)) {
    return { attemptNumber, evidenceDirectory: resolvedEvidenceDirectory, removedEntries: [] };
  }

  const removedEntries = [];
  for (const entry of fsImpl.readdirSync(resolvedEvidenceDirectory).sort()) {
    if (isAttemptsEvidenceEntry(entry)) continue;
    const entryPath = path.resolve(resolvedEvidenceDirectory, entry);
    const relativeEntryPath = path.relative(resolvedEvidenceDirectory, entryPath);
    if (
      !relativeEntryPath ||
      relativeEntryPath === ".." ||
      relativeEntryPath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeEntryPath)
    ) {
      throw new Error(`Refusing to remove live evidence entry outside the dedicated directory: ${entryPath}`);
    }
    fsImpl.rmSync(entryPath, { force: true, recursive: true });
    removedEntries.push(entry);
  }
  return { attemptNumber, evidenceDirectory: resolvedEvidenceDirectory, removedEntries };
}

function preserveLiveAttemptEvidence(
  { attemptNumber, outcome },
  { evidenceDirectory = LIVE_EVIDENCE_DIRECTORY, fsImpl = fs, now = () => new Date() } = {},
) {
  const timestamp = now().toISOString().replace(/[:.]/gu, "-");
  const attemptDirectory = path.join(
    evidenceDirectory,
    "attempts",
    `${String(attemptNumber).padStart(2, "0")}-${timestamp}-${outcome}`,
  );
  fsImpl.mkdirSync(attemptDirectory, { recursive: true });

  if (fsImpl.existsSync(evidenceDirectory)) {
    for (const entry of fsImpl.readdirSync(evidenceDirectory)) {
      if (isAttemptsEvidenceEntry(entry)) continue;
      copyDirectoryEntry(path.join(evidenceDirectory, entry), path.join(attemptDirectory, entry), fsImpl);
    }
  }
  fsImpl.writeFileSync(
    path.join(attemptDirectory, "attempt.json"),
    `${JSON.stringify({ attemptNumber, capturedAt: now().toISOString(), outcome }, null, 2)}\n`,
  );
  return attemptDirectory;
}

function createInteractiveLiveDriver({ context, diagnostics, options, page, selectedExtensionId }) {
  return new LiveYoutubeDriver(page, context, {
    authenticatedHandle: options.expectedChannel,
    expectedBuildId: options.expectedBuildId,
    reportProgress: (name, details) => diagnostics.checkpoint(name, details),
    selectedExtensionId,
  });
}

function createInteractiveVoteRecorderFactory({ context, driver, options, page, selectedExtensionId }) {
  return (videoId) =>
    new VoteTrafficRecorder(context, videoId, {
      page,
      runtime: options.runtime,
      selectedExtensionId,
      trafficLedger: driver.trafficLedger,
    });
}

function createReactionTargetDetails(options) {
  return {
    reactionShort: options.reactionShort,
    reactionWatch: options.watchB,
  };
}

function formatReactionApprovalReadiness(options) {
  return `READY_FOR_REACTION_APPROVAL runtime=${options.runtime} watch=${options.watchB} reactionShort=${options.reactionShort} readOnlyShort=${options.short}`;
}

async function closeLiveAttemptPage(page, { timeoutMs = LIVE_ATTEMPT_PAGE_CLOSE_TIMEOUT_MS } = {}) {
  if (!page || page.isClosed()) return false;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("The live-attempt page-close timeout must be positive.");
  }
  await withOperationTimeout(
    () => page.close(),
    timeoutMs,
    `Timed out after ${timeoutMs}ms while closing the live-attempt test page.`,
  );
  return true;
}

async function prepareLiveAttempt({ buildArtifact, environment, output, readLine, readOptions, requestedRuntime }) {
  const build = buildArtifact(requestedRuntime);
  output.log(`LIVE_ARTIFACT_BUILT ${JSON.stringify(build)}`);
  if (requestedRuntime === "userscript") {
    output.log(
      "LIVE_USERSCRIPT_INSTALL_REQUIRED Reinstall test-results/live-build/userscript/Return Youtube Dislike.user.js, then enter INSTALLED.",
    );
    requireUserscriptInstallAcknowledgement(await readLine());
  }
  const options = readOptions(environment);
  if (!options) throw new Error("Set RYD_LIVE_YOUTUBE=1 and the documented allowlist variables to opt in.");
  if (options.runtime !== requestedRuntime) {
    throw new Error(`The built live runtime ${requestedRuntime} does not match configured runtime ${options.runtime}.`);
  }
  return options;
}

async function runConnectedLiveAttempt({
  browser,
  options,
  output,
  pageCloseTimeoutMs = LIVE_ATTEMPT_PAGE_CLOSE_TIMEOUT_MS,
  readLine,
  selectedSession,
}) {
  let attemptError;
  let diagnostics;
  let driver;
  let page;
  let selectedExtensionId = null;
  try {
    const { context } = selectedSession;
    let runtimeAdapter;
    const { readOnly } = await runInteractiveReadOnlyAfterRuntimeReload({
      initializeRuntime: async (reloaded) => {
        selectedExtensionId = reloaded?.extensionId ?? null;
        page = await context.newPage();
        diagnostics = new LiveRunDiagnostics(page, context, { runtime: options.runtime, selectedExtensionId });
        await diagnostics.start();
        driver = createInteractiveLiveDriver({
          context,
          diagnostics,
          options,
          page,
          selectedExtensionId,
        });
        const createAdapter =
          options.runtime === "extension" ? createExtensionLiveRuntimeAdapter : createUserscriptLiveRuntimeAdapter;
        runtimeAdapter = createAdapter({
          driver,
          expectedBuildId: options.expectedBuildId,
          expectedVersion: options.expectedVersion,
        });
        output.log("CHROMIUM_CONNECTED");
        return { diagnostics, runtimeAdapter };
      },
      options,
      reloadExtension: async () => {
        const reloaded = await reloadLiveExtensionInBrowser({
          browser,
          context,
          expectedBuildId: options.expectedBuildId,
          expectedVersion: options.expectedVersion,
          sessionPage: selectedSession.sessionPage,
        });
        output.log(`LIVE_EXTENSION_RELOADED ${JSON.stringify(reloaded)}`);
        return reloaded;
      },
      scenarioRunner,
    });
    await driver.assertNoUnclaimedAttributedTraffic("interactive read-only run");
    output.log(`READ_ONLY_COMPLETE ${JSON.stringify(readOnly)}`);
    output.log(formatReactionApprovalReadiness(options));

    diagnostics.checkpoint("reaction-approval.waiting", {
      instruction: "Enter the fresh production-reaction approval token",
    });
    const approval = requireProductionReactionApproval(await readLine());
    diagnostics.consumeFatalSignals("reaction approval wait");
    await driver.assertNoUnclaimedAttributedTraffic("reaction approval wait");
    if (!hasFreshVoteApproval(approval, options.runtime, options.watchB, Date.now())) {
      throw new Error("The supplied live reaction approval is missing, expired, or does not match this run.");
    }

    let approvalConsumed = false;
    const reactionServices = {
      createRecorder: createInteractiveVoteRecorderFactory({ context, driver, options, page, selectedExtensionId }),
      consumeVoteApproval: async () => {
        driver.assertCurrentVideo(options.watchB);
        await driver.assertRuntime(options.runtime, options.expectedVersion, options.expectedBuildId);
        if (approvalConsumed) return;
        if (!consumeLiveVoteApproval(approval, options.runtime, options.watchB)) {
          throw new Error("The live reaction approval expired or was already used. No reaction was clicked.");
        }
        approvalConsumed = true;
      },
    };
    const reaction = await runLoggedStage(diagnostics, "production-reactions", async () => ({
      "post-navigation-vote": await scenarioRunner.run(
        runtimeAdapter,
        "post-navigation-vote",
        options,
        reactionServices,
      ),
      "reaction-matrix": await scenarioRunner.run(runtimeAdapter, "reaction-matrix", options, reactionServices),
    }));
    await driver.assertNoUnclaimedAttributedTraffic("interactive production reactions");
    const completion = assertFullLiveReactionCompletion(reaction);
    output.log(`PRODUCTION_REACTIONS_COMPLETE ${JSON.stringify(reaction)}`);
    output.log(
      `LIVE_VALIDATION_COMPLETE ${JSON.stringify({
        ...completion,
        ...createReactionTargetDetails(options),
      })}`,
    );
    return { classification: completion.classification, reaction, readOnly };
  } catch (error) {
    attemptError = error;
    if (diagnostics) {
      try {
        const snapshotPath = await diagnostics.persistFailureSnapshot(error);
        output.error(`LIVE_FAILURE_SNAPSHOT ${snapshotPath}`);
      } catch (snapshotError) {
        output.error(`LIVE_FAILURE_SNAPSHOT_FAILED ${snapshotError.message}`);
      }
    }
  } finally {
    driver?.stop();
    diagnostics?.stop();
    let pageCloseError;
    try {
      if (page && !page.isClosed()) {
        output.log(`LIVE_ATTEMPT_PAGE_CLOSE_START ${JSON.stringify({ timeoutMs: pageCloseTimeoutMs })}`);
        await closeLiveAttemptPage(page, { timeoutMs: pageCloseTimeoutMs });
        output.log("LIVE_ATTEMPT_PAGE_CLOSE_COMPLETE");
      }
    } catch (error) {
      pageCloseError = error;
      output.error(`LIVE_ATTEMPT_PAGE_CLOSE_FAILED ${JSON.stringify({ message: error.message })}`);
    }
    if (attemptError && pageCloseError) {
      throw new AggregateError(
        [attemptError, pageCloseError],
        "The live attempt and its test-page cleanup both failed.",
      );
    }
    if (attemptError) throw attemptError;
    if (pageCloseError) throw pageCloseError;
  }
}

async function runLiveAttemptLoop({
  initialOptions,
  output,
  persistentSession,
  prepareNextAttempt,
  preserveEvidence,
  readLine,
  resetEvidenceWorkspace,
  runAttempt,
}) {
  let attemptNumber = 1;
  let options = initialOptions;

  while (true) {
    const reset = await resetEvidenceWorkspace({ attemptNumber });
    output.log(
      `LIVE_ATTEMPT_EVIDENCE_RESET ${JSON.stringify({
        attemptNumber,
        removedEntries: reset?.removedEntries ?? [],
      })}`,
    );
    output.log(
      `LIVE_ATTEMPT_START ${JSON.stringify({ attemptNumber, persistentSession, runtime: options?.runtime ?? null })}`,
    );
    let attemptError = null;
    let attemptResult = null;
    try {
      if (attemptNumber > 1) {
        const nextOptions = await prepareNextAttempt();
        options = assertReusableConnectionOptions(initialOptions, nextOptions);
      }
      attemptResult = await runAttempt(options, attemptNumber);
      output.log(`LIVE_ATTEMPT_COMPLETE ${JSON.stringify({ attemptNumber, outcome: "passed" })}`);
    } catch (error) {
      attemptError = error;
      output.error(
        `LIVE_ATTEMPT_FAILED ${JSON.stringify({ attemptNumber, message: error.message, outcome: "failed" })}`,
      );
    }

    if (!persistentSession) {
      if (attemptError) throw attemptError;
      return attemptResult;
    }

    const outcome = attemptError ? "failed" : "passed";
    try {
      const evidencePath = await preserveEvidence({ attemptNumber, outcome });
      output.log(`LIVE_ATTEMPT_EVIDENCE ${JSON.stringify({ attemptNumber, outcome, path: evidencePath })}`);
    } catch (evidenceError) {
      attemptError = attemptError
        ? new AggregateError([attemptError, evidenceError], "The live attempt and its evidence snapshot both failed.")
        : evidenceError;
      output.error(`LIVE_ATTEMPT_EVIDENCE_FAILED ${JSON.stringify({ attemptNumber, message: evidenceError.message })}`);
    }

    while (true) {
      output.log(`READY_FOR_LIVE_RERUN_OR_EXIT attempt=${attemptNumber} outcome=${attemptError ? "failed" : "passed"}`);
      const command = normalizeLiveSessionCommand(await readLine());
      if (command === "RERUN") {
        attemptNumber += 1;
        break;
      }
      if (command === "EXIT") {
        if (attemptError) throw attemptError;
        return attemptResult;
      }
      output.error("LIVE_RERUN_COMMAND_REJECTED expected=RERUN_OR_EXIT");
    }
  }
}

async function main({
  buildArtifact = buildLiveRuntimeArtifact,
  connectBrowser = (options) =>
    chromium.connectOverCDP(options.cdpEndpoint, {
      isLocal: true,
      noDefaults: true,
      timeout: options.cdpConnectTimeoutMilliseconds,
    }),
  environment = process.env,
  executeAttempt = runConnectedLiveAttempt,
  output = console,
  preserveEvidence = preserveLiveAttemptEvidence,
  readLine,
  readOptions = readLiveOptions,
  resetEvidenceWorkspace = resetLiveAttemptEvidenceWorkspace,
  selectContext = selectAuthenticatedYoutubeContext,
} = {}) {
  const persistentSession = readPersistentSessionMode(environment);
  const requestedRuntime = readFullLiveRuntime(environment);
  const ownedLineReader = readLine ? null : createInputLineReader();
  const nextLine = readLine ?? ownedLineReader.readLine;
  const prepareAttempt = () =>
    prepareLiveAttempt({
      buildArtifact,
      environment,
      output,
      readLine: nextLine,
      readOptions,
      requestedRuntime,
    });

  let browser;
  try {
    const initialOptions = await prepareAttempt();
    output.log("WAITING_FOR_CHROMIUM_DEBUG_APPROVAL");
    browser = await connectBrowser(initialOptions);
    const selectedSession = await selectContext(browser, initialOptions.expectedChannel);
    output.log(
      `AUTHENTICATED_CHROMIUM_CONTEXT_SELECTED context=${selectedSession.contextIndex + 1} page=${selectedSession.pageIndex + 1} handle=${initialOptions.expectedChannel}`,
    );

    return await runLiveAttemptLoop({
      initialOptions,
      output,
      persistentSession,
      prepareNextAttempt: prepareAttempt,
      preserveEvidence,
      readLine: nextLine,
      resetEvidenceWorkspace,
      runAttempt: (options, attemptNumber) =>
        executeAttempt({ browser, options, output, readLine: nextLine, selectedSession, attemptNumber }),
    });
  } finally {
    if (browser) await browser.close();
    ownedLineReader?.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  assertReusableConnectionOptions,
  closeLiveAttemptPage,
  createInputLineReader,
  createInteractiveLiveDriver,
  createInteractiveVoteRecorderFactory,
  createReactionTargetDetails,
  formatReactionApprovalReadiness,
  main,
  normalizeLiveSessionCommand,
  prepareLiveAttempt,
  preserveLiveAttemptEvidence,
  readPersistentSessionMode,
  resetLiveAttemptEvidenceWorkspace,
  resolveSafeLiveEvidenceDirectory,
  runConnectedLiveAttempt,
  runLiveAttemptLoop,
};
