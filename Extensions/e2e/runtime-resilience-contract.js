const { expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../UserScript/e2e/harness");
const { SPA_COUNTS, isArtifactVoteHandshakeValid, readArtifactVoteHandshake } = require("./hermetic-artifact-smoke");

const INTERACTION_PATHS = new Set(["/interact/vote", "/interact/confirmVote"]);
const SUPPORTED_RUNTIME_NAMES = Object.freeze(["userscript", "extension"]);
const RUNTIME_RESILIENCE_SCENARIOS = Object.freeze([
  Object.freeze({ id: "delayed-a-hydration-vs-b-activation", kind: "delayed-hydration" }),
  Object.freeze({ id: "in-flight-a-vote-then-b-navigation", kind: "in-flight-vote" }),
  Object.freeze({ id: "rejected-vote-and-confirmation-then-b-recovery", kind: "failure-recovery" }),
  Object.freeze({ id: "signed-out-and-disabled-interaction-gate", kind: "interaction-gate" }),
]);

function registerRuntimeResilienceContractScenarios({ register, runtimeName }) {
  if (!SUPPORTED_RUNTIME_NAMES.includes(runtimeName)) {
    throw new TypeError(`Unsupported resilience contract runtime: ${runtimeName}`);
  }
  if (typeof register !== "function") {
    throw new TypeError("The runtime resilience contract requires a scenario register callback.");
  }
  for (const scenario of RUNTIME_RESILIENCE_SCENARIOS) {
    register({ scenario, title: `${runtimeName} resilience contract: ${scenario.id}` });
  }
}

function interactionRecords(adapter) {
  return adapter
    .readInteractionRecords()
    .filter((record) => record.method === "POST" && INTERACTION_PATHS.has(record.pathname));
}

function currentDislikeButton(adapter, videoId) {
  return adapter.page.locator(
    `ytd-watch-flexy[video-id="${videoId}"] [data-fixture-role="dislike"] button:visible, ` +
      `ytd-watch-grid[video-id="${videoId}"] [data-fixture-role="dislike"] button:visible`,
  );
}

async function clickCurrentDislike(adapter, videoId) {
  const button = currentDislikeButton(adapter, videoId);
  await expect(button, `${adapter.runtime} must expose one current Dislike button for ${videoId}`).toHaveCount(1);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
}

async function waitForRecordResponse(record, label) {
  await expect.poll(() => record.respondedAt, { message: `${label} never received a response` }).toBeTruthy();
}

async function expectSuccessfulHandshake(adapter, startIndex, videoId, value) {
  const read = () => readArtifactVoteHandshake(adapter.readInteractionRecords(), startIndex, videoId, value);
  await expect
    .poll(
      () => {
        const handshake = read();
        return handshake.interactionCount >= 2 && handshake.confirmation?.responded === true;
      },
      { message: `${adapter.runtime} did not complete the ${value} vote chain for ${videoId}` },
    )
    .toBe(true);
  const handshake = read();
  expect(isArtifactVoteHandshakeValid(handshake), JSON.stringify(handshake)).toBe(true);
  return handshake;
}

async function assertRuntimeClean(adapter, scenarioId, { allowedConsoleErrors = [] } = {}) {
  expect(adapter.backend.blockedRequests, `${adapter.runtime} escaped the hermetic page route set`).toEqual([]);
  if (adapter.apiServer) {
    expect(adapter.apiServer.unexpectedRequests, "the extension background escaped its hermetic API server").toEqual(
      [],
    );
  }
  if (allowedConsoleErrors.length === 0) {
    await adapter.assertNoPageSignals(scenarioId);
    return;
  }

  await adapter.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await adapter.workerSignals?.refresh?.();
  const snapshot = adapter.pageSignals.snapshot();
  const pageSignals = snapshot.page ?? snapshot;
  const workerSignals = snapshot.worker ?? null;
  expect(pageSignals.pageErrors, `${adapter.runtime} emitted a page error during ${scenarioId}`).toEqual([]);
  expect(
    pageSignals.unhandledRejections,
    `${adapter.runtime} emitted an unhandled rejection during ${scenarioId}`,
  ).toEqual([]);
  if (workerSignals) {
    expect(workerSignals.evaluationFailure).toBeNull();
    expect(workerSignals.evaluatedSignals).toEqual([]);
    expect(workerSignals.reportedSignals).toEqual([]);
  }
  const consoleSignals = [
    ...pageSignals.consoleErrors.map((signal) => signal.text),
    ...(workerSignals?.consoleFailures ?? []).map((signal) => signal.text),
  ];
  expect(
    consoleSignals.every((text) => allowedConsoleErrors.some((pattern) => pattern.test(text))),
    `${adapter.runtime} emitted an unexpected console error during ${scenarioId}: ${JSON.stringify(consoleSignals)}`,
  ).toBe(true);
}

async function withAdapter(createAdapter, options, run) {
  const adapter = await createAdapter(options);
  try {
    await adapter.start();
    await run(adapter);
  } finally {
    await adapter.close().catch(() => {});
  }
}

async function runDelayedHydrationContract(createAdapter, scenario) {
  await withAdapter(createAdapter, { scenario }, async (adapter) => {
    const outgoingStats = adapter.deferNextStatsRequest();
    await adapter.openSpaWatch(VIDEO_A);
    const outgoingRecord = await outgoingStats.seen;
    expect(outgoingRecord.query.videoId).toBe(VIDEO_A);

    await adapter.navigateSpaWatchWhilePending(VIDEO_A, VIDEO_B);
    outgoingStats.release({ body: { ...SPA_COUNTS[VIDEO_A], rating: 4.5 }, status: 200 });

    const destination = await adapter.waitForWatchResult(VIDEO_B);
    expect(destination).toMatchObject({ count: String(SPA_COUNTS[VIDEO_B].dislikes), videoId: VIDEO_B });
    expect(await adapter.readDestinationDislikeTextHistory()).not.toContain(String(SPA_COUNTS[VIDEO_A].dislikes));

    const interactionStartIndex = adapter.readInteractionRecords().length;
    await clickCurrentDislike(adapter, VIDEO_B);
    const handshake = await expectSuccessfulHandshake(adapter, interactionStartIndex, VIDEO_B, -1);
    expect(handshake.sharedUserId).toMatch(/^[0-9A-Za-z-]{30,}$/);
    expect(interactionRecords(adapter).map((record) => record.body.videoId)).toEqual([VIDEO_B, VIDEO_B]);

    const stats = adapter.readStatsRequestTimings();
    expect(stats.map((record) => record.query.videoId)).toEqual([VIDEO_A, VIDEO_B]);
    expect(stats.every((record) => record.respondedAt)).toBe(true);
    await assertRuntimeClean(adapter, scenario.id);
  });
}

async function runInFlightVoteContract(createAdapter, scenario) {
  await withAdapter(createAdapter, { scenario }, async (adapter) => {
    await adapter.openSpaWatch(VIDEO_A);
    await adapter.waitForWatchResult(VIDEO_A);
    const outgoingConfirmation = adapter.deferInteractionResponse("/interact/confirmVote");

    await clickCurrentDislike(adapter, VIDEO_A);
    const outgoingConfirmationRecord = await outgoingConfirmation.seen;
    expect(outgoingConfirmationRecord.body).toMatchObject({ videoId: VIDEO_A });
    expect(outgoingConfirmationRecord.respondedAt).toBeUndefined();

    await adapter.navigateSpaWatch(VIDEO_A, VIDEO_B);
    await adapter.waitForWatchResult(VIDEO_B);
    const destinationStartIndex = adapter.readInteractionRecords().length;
    await clickCurrentDislike(adapter, VIDEO_B);
    const destinationHandshake = await expectSuccessfulHandshake(adapter, destinationStartIndex, VIDEO_B, -1);
    expect(outgoingConfirmationRecord.respondedAt).toBeUndefined();

    outgoingConfirmation.release({ body: true, status: 200 });
    await waitForRecordResponse(outgoingConfirmationRecord, `${adapter.runtime} video A confirmation`);
    const records = interactionRecords(adapter);
    expect(records.map((record) => record.pathname)).toEqual([
      "/interact/vote",
      "/interact/confirmVote",
      "/interact/vote",
      "/interact/confirmVote",
    ]);
    expect(records.map((record) => record.body.videoId)).toEqual([VIDEO_A, VIDEO_A, VIDEO_B, VIDEO_B]);
    expect(records[2].at).toBeLessThan(outgoingConfirmationRecord.respondedAt);
    expect(new Set(records.map((record) => record.body.userId))).toEqual(new Set([destinationHandshake.sharedUserId]));
    await assertRuntimeClean(adapter, scenario.id);
  });
}

async function runFailureRecoveryContract(createAdapter, scenario) {
  await withAdapter(createAdapter, { scenario }, async (adapter) => {
    adapter.enqueueInteractionResponse("/interact/vote", {
      body: { error: "intentional vote rejection" },
      status: 500,
    });
    await adapter.openSpaWatch(VIDEO_A);
    await adapter.waitForWatchResult(VIDEO_A);

    await clickCurrentDislike(adapter, VIDEO_A);
    await expect.poll(() => interactionRecords(adapter).length).toBe(1);
    const rejectedVote = interactionRecords(adapter)[0];
    await waitForRecordResponse(rejectedVote, `${adapter.runtime} rejected vote`);
    expect(rejectedVote).toMatchObject({ pathname: "/interact/vote", responseStatus: 500 });
    expect(rejectedVote.body).toMatchObject({ videoId: VIDEO_A, value: -1 });

    adapter.enqueueInteractionResponse("/interact/confirmVote", { body: false, status: 200 });
    await clickCurrentDislike(adapter, VIDEO_A);
    await expect.poll(() => interactionRecords(adapter).length).toBe(3);
    const rejectedConfirmation = interactionRecords(adapter)[2];
    await waitForRecordResponse(rejectedConfirmation, `${adapter.runtime} rejected confirmation`);
    expect(rejectedConfirmation).toMatchObject({
      pathname: "/interact/confirmVote",
      responseBody: false,
      responseStatus: 200,
    });
    expect(interactionRecords(adapter)[1].body).toMatchObject({ videoId: VIDEO_A, value: 0 });

    await adapter.navigateSpaWatch(VIDEO_A, VIDEO_B);
    await adapter.waitForWatchResult(VIDEO_B);
    const destinationStartIndex = adapter.readInteractionRecords().length;
    await clickCurrentDislike(adapter, VIDEO_B);
    const destinationHandshake = await expectSuccessfulHandshake(adapter, destinationStartIndex, VIDEO_B, -1);

    const records = interactionRecords(adapter);
    expect(records.map((record) => `${record.pathname}:${record.body.videoId}`)).toEqual([
      `/interact/vote:${VIDEO_A}`,
      `/interact/vote:${VIDEO_A}`,
      `/interact/confirmVote:${VIDEO_A}`,
      `/interact/vote:${VIDEO_B}`,
      `/interact/confirmVote:${VIDEO_B}`,
    ]);
    expect(new Set(records.map((record) => record.body.userId))).toEqual(new Set([destinationHandshake.sharedUserId]));
    await assertRuntimeClean(adapter, scenario.id, { allowedConsoleErrors: [/status of 500/i] });
  });
}

async function runInteractionGateContract(createAdapter, scenario) {
  for (const gateMode of ["signed-out", "disabled"]) {
    await withAdapter(createAdapter, { gateMode, scenario }, async (adapter) => {
      if (gateMode === "disabled") await adapter.setVoteSubmissionDisabled(true);
      await adapter.openWatch(VIDEO_A);
      await adapter.waitForWatchResult(VIDEO_A);
      await clickCurrentDislike(adapter, VIDEO_A);
      await adapter.page.waitForTimeout(250);
      expect(interactionRecords(adapter), `${adapter.runtime} bypassed the ${gateMode} interaction gate`).toEqual([]);
      await assertRuntimeClean(adapter, `${scenario.id}-${gateMode}`);
    });
  }
}

const SCENARIO_RUNNERS = Object.freeze({
  "delayed-hydration": runDelayedHydrationContract,
  "failure-recovery": runFailureRecoveryContract,
  "in-flight-vote": runInFlightVoteContract,
  "interaction-gate": runInteractionGateContract,
});

async function runRuntimeResilienceContract({ createAdapter, scenario }) {
  if (typeof createAdapter !== "function") {
    throw new TypeError("The runtime resilience contract requires createAdapter().");
  }
  const runner = SCENARIO_RUNNERS[scenario?.kind];
  if (!runner) throw new TypeError(`Unknown runtime resilience scenario: ${scenario?.kind}`);
  await runner(createAdapter, scenario);
}

module.exports = {
  RUNTIME_RESILIENCE_SCENARIOS,
  registerRuntimeResilienceContractScenarios,
  runRuntimeResilienceContract,
};
