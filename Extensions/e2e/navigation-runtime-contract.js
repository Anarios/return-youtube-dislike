const { expect } = require("@playwright/test");
const { isArtifactVoteHandshakeValid, readArtifactVoteHandshake } = require("./hermetic-artifact-smoke");
const {
  NAVIGATION_MATRIX,
  NO_DESTINATION_DISLIKE_POSTCONDITION,
  getDestinationDislikePostconditionTarget,
  runNavigationMatrixScenario,
} = require("../UserScript/e2e/navigation-matrix");

const DEFAULT_POST_ACTIVATION_QUIET_MS = 650;
const INTERACTION_PATHS = new Set(["/interact/vote", "/interact/confirmVote"]);
const NON_CURRENT_DUPLICATE_SCENARIO_IDS = Object.freeze([
  "watch-sidebar-watch-same-root-hidden-first",
  "watch-sidebar-watch-same-root-offscreen-first",
  "watch-sidebar-watch-legacy-segmented-duplicate-ids",
]);
const SUPPORTED_RUNTIME_NAMES = Object.freeze(["userscript", "extension"]);

function registerNavigationRuntimeContractScenarios({ register, runtimeName }) {
  if (!SUPPORTED_RUNTIME_NAMES.includes(runtimeName)) {
    throw new TypeError(`Unsupported navigation contract runtime: ${runtimeName}`);
  }
  if (typeof register !== "function") {
    throw new TypeError("The navigation runtime contract requires a scenario register callback.");
  }
  for (const scenario of NAVIGATION_MATRIX) {
    register({
      scenario,
      title: `${runtimeName} navigation matrix: ${scenario.id}`,
    });
  }
}

function createNavigationRuntimeContractAdapter({
  backend,
  expectedCredentials,
  expectedUserId = expectedCredentials?.userId,
  matrixRuntime,
  page,
  postActivationQuietMs = DEFAULT_POST_ACTIVATION_QUIET_MS,
  readCredentials,
  readInteractionRecords,
  runtimeName = matrixRuntime?.name,
}) {
  if (!backend || !page || !matrixRuntime) {
    throw new TypeError("The navigation runtime contract requires a backend, page, and matrix runtime.");
  }
  if (typeof readInteractionRecords !== "function") {
    throw new TypeError("The navigation runtime contract requires readInteractionRecords().");
  }
  if (expectedCredentials !== undefined && typeof readCredentials !== "function") {
    throw new TypeError("Expected credentials require a readCredentials() adapter.");
  }
  if (!Number.isFinite(postActivationQuietMs) || postActivationQuietMs < 0) {
    throw new TypeError("postActivationQuietMs must be a non-negative finite number.");
  }

  return Object.freeze({
    backend,
    expectedCredentials,
    expectedUserId,
    matrixRuntime,
    page,
    postActivationQuietMs,
    readCredentials,
    readInteractionRecords,
    runtimeName,
  });
}

function interactionRecords(records) {
  return records.filter((record) => record.method === "POST" && INTERACTION_PATHS.has(record.pathname));
}

async function expectCredentials(adapter) {
  if (adapter.expectedCredentials === undefined) return;
  expect(await adapter.readCredentials(), `${adapter.runtimeName} changed its persisted vote identity`).toEqual(
    adapter.expectedCredentials,
  );
}

async function expectNonCurrentDuplicateActivationIgnored(adapter, scenario, currentTarget) {
  if (!NON_CURRENT_DUPLICATE_SCENARIO_IDS.includes(scenario.id)) return;

  const currentRoot = adapter.page.locator(
    `ytd-watch-flexy[video-id="${scenario.destination.videoId}"], ` +
      `ytd-watch-grid[video-id="${scenario.destination.videoId}"]`,
  );
  const allDislikeButtons = currentRoot.locator('[data-fixture-role="dislike"] button');
  const outgoingButton = currentRoot.locator(
    '[data-fixture-matrix-hidden-outgoing="true"] [data-fixture-role="dislike"] button',
  );

  await expect(allDislikeButtons).toHaveCount(2);
  await expect(outgoingButton).toHaveCount(1);
  expect(
    await allDislikeButtons
      .first()
      .evaluate((button) => button.matches('[data-fixture-matrix-hidden-outgoing="true"] *')),
    `${adapter.runtimeName} fixture must put the non-current duplicate before the visible destination control`,
  ).toBe(true);

  const currentCount = await currentTarget.count.textContent();
  const currentDislikePressed = await currentTarget.button.getAttribute("aria-pressed");
  const currentLikePressed = await currentTarget.likeButton.getAttribute("aria-pressed");
  const interactionStartIndex = adapter.readInteractionRecords().length;

  // Dispatch a real bubbling click even though the stale duplicate is hidden or
  // offscreen. This models an unscoped first-match locator without allowing the
  // test framework's actionability checks to silently retarget the current UI.
  await outgoingButton.evaluate((button) => button.click());
  await adapter.page.waitForTimeout(adapter.postActivationQuietMs);

  await expect(outgoingButton).toHaveAttribute("aria-pressed", "true");
  await expect(currentTarget.count).toHaveText(currentCount);
  await expect(currentTarget.button).toHaveAttribute("aria-pressed", currentDislikePressed);
  await expect(currentTarget.likeButton).toHaveAttribute("aria-pressed", currentLikePressed);
  expect(
    interactionRecords(adapter.readInteractionRecords().slice(interactionStartIndex)),
    `${adapter.runtimeName} reacted to a non-current duplicate before the visible destination control`,
  ).toEqual([]);
  await expectCredentials(adapter);
}

async function expectSuccessfulVoteActivation(adapter, videoId, value, activationTarget) {
  const interactionStartIndex = adapter.readInteractionRecords().length;
  await activationTarget.click();

  const readHandshake = () =>
    readArtifactVoteHandshake(adapter.readInteractionRecords(), interactionStartIndex, videoId, value);
  await expect
    .poll(
      () => {
        const handshake = readHandshake();
        return handshake.interactionCount >= 2 && handshake.confirmation?.responded === true;
      },
      {
        message: `${adapter.runtimeName} must complete exactly one ${value} vote and successful confirmation for ${videoId}`,
      },
    )
    .toBe(true);

  const handshake = readHandshake();
  expect(
    isArtifactVoteHandshakeValid(handshake),
    `${adapter.runtimeName} emitted a duplicate, malformed, or failed vote chain for ${videoId}: ` +
      JSON.stringify(handshake),
  ).toBe(true);
  await adapter.page.waitForTimeout(adapter.postActivationQuietMs);
  const settledHandshake = readHandshake();
  expect(
    isArtifactVoteHandshakeValid(settledHandshake),
    `${adapter.runtimeName} emitted a late vote request for ${videoId}: ${JSON.stringify(settledHandshake)}`,
  ).toBe(true);
  if (adapter.expectedUserId !== undefined) {
    expect(settledHandshake.sharedUserId).toBe(adapter.expectedUserId);
  }
  return settledHandshake;
}

async function expectDestinationReactionContract(adapter, scenario) {
  expect(
    interactionRecords(adapter.readInteractionRecords()),
    `${adapter.runtimeName} submitted a vote during navigation without an activation`,
  ).toEqual([]);
  await expectCredentials(adapter);

  const target = getDestinationDislikePostconditionTarget(adapter.page, adapter.matrixRuntime, scenario);
  await expect(target.control).toHaveCount(1);
  await expect(target.control).toBeVisible();
  await expect(target.button).toHaveCount(1);
  await expect(target.button).toBeVisible();
  await expect(target.button).toBeEnabled();
  await expect(target.count).toHaveCount(1);
  await expect(target.count).toHaveText(target.expectedInitialDislikeCount);
  await expect(target.likeButton).toHaveCount(1);
  await expect(target.likeButton).toBeVisible();
  await expect(target.likeButton).toBeEnabled();
  await expect(target.likeCount).toHaveCount(1);
  const initialNativeLikeCount = Number.parseInt(await target.likeCount.textContent(), 10);
  expect(initialNativeLikeCount).toBeGreaterThanOrEqual(0);

  const dislike = await expectSuccessfulVoteActivation(adapter, scenario.destination.videoId, -1, target.button);
  await expect(target.count).toHaveText(target.expectedCount);
  await expect(target.control).toBeVisible();
  await expect(target.button).toHaveAttribute("aria-pressed", "true");
  await expect(target.control).toHaveClass(/style-default-active/);
  await expect(target.likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(target.likeControl).not.toHaveClass(/style-default-active/);
  await expect(target.likeCount).toHaveText(String(initialNativeLikeCount));
  await expectCredentials(adapter);

  const like = await expectSuccessfulVoteActivation(adapter, scenario.destination.videoId, 1, target.likeButton);
  expect(like.sharedUserId).toBe(dislike.sharedUserId);
  await expect(target.count).toHaveText(target.expectedFinalDislikeCount);
  await expect(target.control).toBeVisible();
  await expect(target.likeCount).toHaveText(String(initialNativeLikeCount + 1));
  await expect(target.likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(target.likeControl).toHaveClass(/style-default-active/);
  await expect(target.button).toHaveAttribute("aria-pressed", "false");
  await expect(target.control).not.toHaveClass(/style-default-active/);
  await expectCredentials(adapter);

  expect(interactionRecords(adapter.readInteractionRecords()).map((record) => record.pathname)).toEqual([
    "/interact/vote",
    "/interact/confirmVote",
    "/interact/vote",
    "/interact/confirmVote",
  ]);

  return {
    dislikeUserId: dislike.sharedUserId,
    initialNativeLikeCount,
    likeUserId: like.sharedUserId,
    target,
  };
}

async function runNavigationRuntimeContract({ adapter, afterNavigation, afterReactions, scenario }) {
  let navigationHookCalled = false;
  const runAfterNavigation = async () => {
    if (navigationHookCalled) return;
    navigationHookCalled = true;
    await afterNavigation?.({ adapter, scenario });
  };

  await runNavigationMatrixScenario({
    backend: adapter.backend,
    beforeNonCurrentDuplicateDetach: async () => {
      await runAfterNavigation();
      const target = getDestinationDislikePostconditionTarget(adapter.page, adapter.matrixRuntime, scenario);
      await expectNonCurrentDuplicateActivationIgnored(adapter, scenario, target);
    },
    page: adapter.page,
    runtime: adapter.matrixRuntime,
    scenario,
  });
  await runAfterNavigation();
  if (scenario.postcondition === NO_DESTINATION_DISLIKE_POSTCONDITION) {
    expect(
      interactionRecords(adapter.readInteractionRecords()),
      `${adapter.runtimeName} submitted a vote for an intentionally incomplete navigation surface`,
    ).toEqual([]);
    await expectCredentials(adapter);
    await afterReactions?.({ adapter, result: null, scenario });
    return null;
  }
  const result = await expectDestinationReactionContract(adapter, scenario);
  await afterReactions?.({ adapter, result, scenario });
  return result;
}

module.exports = {
  NON_CURRENT_DUPLICATE_SCENARIO_IDS,
  createNavigationRuntimeContractAdapter,
  expectNonCurrentDuplicateActivationIgnored,
  expectDestinationReactionContract,
  expectSuccessfulVoteActivation,
  registerNavigationRuntimeContractScenarios,
  runNavigationRuntimeContract,
};
