const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MIN_LIVE_SHORTS_NEXT_HOPS } = require("../../live/live-navigation-constants");
const { WATCH_RATIO_SOAK_DURATION_MS } = require("./live-youtube-driver");
const {
  DISLIKED_STATE,
  LIKED_STATE,
  NEUTRAL_STATE,
  applyVoteTransitionCounts,
  resolveVoteTransition,
} = require("../../../common/vote-transition-core");
const { assertExpectedWatchCounts } = require("./watch-ratio-audit");

const RESPONSIVE_VIEWPORTS = [
  { height: 720, width: 1280 },
  { height: 720, width: 768 },
  { height: 844, width: 390 },
];

const WATCH_ACTION_TOPOLOGY_VIEWPORTS = [
  { height: 900, name: "wide-constrained", width: 1536 },
  { height: 800, name: "stacked", width: 1300 },
  { height: 800, name: "narrow", width: 820 },
];

const REACTION_CYCLES = {
  neutral: ["like", "like", "dislike", "like", "dislike", "dislike"],
  liked: ["like", "dislike", "like", "dislike", "dislike", "like"],
  disliked: ["like", "dislike", "dislike", "like", "like", "dislike"],
};

const LIVE_TO_SHARED_REACTION_STATE = {
  disliked: DISLIKED_STATE,
  liked: LIKED_STATE,
  neutral: NEUTRAL_STATE,
};
const SHARED_TO_LIVE_REACTION_STATE = Object.fromEntries(
  Object.entries(LIVE_TO_SHARED_REACTION_STATE).map(([liveState, sharedState]) => [sharedState, liveState]),
);

function resolveLiveVoteTransition(state, action) {
  const sharedState = LIVE_TO_SHARED_REACTION_STATE[state];
  assert.ok(sharedState, `Unsupported live reaction state: ${state}`);
  const transition = resolveVoteTransition(sharedState, action);
  const nextState = SHARED_TO_LIVE_REACTION_STATE[transition.nextState];
  assert.ok(nextState, `Unsupported shared reaction state: ${transition.nextState}`);
  return { ...transition, nextState };
}

function nextReactionState(state, action) {
  return resolveLiveVoteTransition(state, action).nextState;
}

function reactionValue(state) {
  if (state === "liked") return 1;
  if (state === "disliked") return -1;
  if (state === "neutral") return 0;
  throw new Error(`Unsupported reaction state: ${state}`);
}

async function assertLivePreconditions(driver, options) {
  await driver.assertSignedIn(options.expectedChannel);
  await driver.assertRuntime(options.runtime, options.expectedVersion, options.expectedBuildId);
}

async function runWatchRenderScenario(driver, options) {
  return driver.withNoProductionInteractions(async () => {
    const navigation = await driver.openPlaylist(options.playlistUrl, options.watchA);
    await assertLivePreconditions(driver, options);
    return driver.assertCurrentWatchResult(options.watchA, options.runtime, navigation.body);
  });
}

async function runReloadScenario(driver, options) {
  return driver.withNoProductionInteractions(async () => {
    const initialNavigation = await driver.openPlaylist(options.playlistUrl, options.watchA);
    await assertLivePreconditions(driver, options);
    const initial = await driver.assertCurrentWatchResult(options.watchA, options.runtime, initialNavigation.body);
    const reloadNavigation = await driver.reload(options.watchA);
    await assertLivePreconditions(driver, options);
    const reloaded = await driver.assertCurrentWatchResult(options.watchA, options.runtime, reloadNavigation.body);
    return { initial, reloaded };
  });
}

async function runSpaNavigationScenario(driver, options) {
  return driver.withNoProductionInteractions(async () => {
    const watchANavigation = await driver.openPlaylist(options.playlistUrl, options.watchA);
    await assertLivePreconditions(driver, options);
    const watchA = await driver.assertCurrentWatchResult(options.watchA, options.runtime, watchANavigation.body);
    const watchBNavigation = await driver.navigateWithinPlaylist({ excludedVideoIds: [options.watchA] });
    const destinationVideoId = watchBNavigation.videoId;
    assert.match(destinationVideoId, /^[A-Za-z0-9_-]{11}$/, "Playlist navigation returned an invalid video ID.");
    assert.notEqual(destinationVideoId, options.watchA, "Playlist navigation returned the source video.");
    await assertLivePreconditions(driver, options);
    const watchB = await driver.assertCurrentWatchResult(destinationVideoId, options.runtime, watchBNavigation.body);
    const watchACount = watchA.count;
    const watchBCount = watchB.count;
    assert.match(watchACount, /\d/);
    assert.match(watchBCount, /\d/);
    return { destinationVideoId, watchA, watchACount, watchB, watchBCount };
  });
}

async function runSidebarStressScenario(
  driver,
  options,
  {
    makeDirectory = (directory) => fs.mkdirSync(directory, { recursive: true }),
    outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/sidebar-stress"),
    readyTimeoutMs = 1_000,
    soakDurationMs = WATCH_RATIO_SOAK_DURATION_MS,
  } = {},
) {
  const hopCount = options.sidebar?.hopCount;
  assert.ok(Number.isSafeInteger(hopCount) && hopCount > 0, "A positive sidebar stress hop count is required.");
  assert.ok(
    Number.isFinite(readyTimeoutMs) && readyTimeoutMs > 0,
    "A positive ratio-bar readiness budget is required.",
  );
  makeDirectory(outputDirectory);

  return driver.withNoProductionInteractions(async () => {
    await driver.openWatch(options.watchA);
    await assertLivePreconditions(driver, options);
    const visitedVideoIds = [options.watchA];
    const hops = [];

    for (let index = 0; index < hopCount; index += 1) {
      const { body, videoId } = await driver.navigateToRelatedWatch(visitedVideoIds);
      assert.equal(typeof body.dislikes, "number", `Sidebar hop ${index + 1} has no production dislike count.`);
      assert.ok(!visitedVideoIds.includes(videoId), `Sidebar hop ${index + 1} revisited ${videoId}.`);
      driver.assertCurrentVideo(videoId);
      await assertLivePreconditions(driver, options);

      const screenshotPath = path.join(
        outputDirectory,
        `${options.runtime}-sidebar-hop-${String(index + 1).padStart(2, "0")}.png`,
      );
      const visual = await driver.captureWatchRatioVisual(options.runtime, screenshotPath, {
        expectedCounts: body,
        expectedVideoId: videoId,
        presenceTimeoutMs: readyTimeoutMs,
      });
      const readyLatencyMs = visual.presenceLatencyMs;
      assert.ok(
        Number.isFinite(readyLatencyMs) && readyLatencyMs <= readyTimeoutMs,
        `Sidebar hop ${index + 1} ratio bar took ${readyLatencyMs}ms; the budget is ${readyTimeoutMs}ms.`,
      );
      assert.match(visual.count, /\d/, `Sidebar hop ${index + 1} did not render a dislike count.`);
      const countAudit = await driver.assertRenderedDislikeCount(visual.count, body.dislikes, options.runtime);
      const soak = await driver.soakWatchRatioVisual(options.runtime, {
        durationMs: soakDurationMs,
        expectedCount: visual.count,
        expectedCounts: body,
        videoId,
      });

      visitedVideoIds.push(videoId);
      hops.push({
        apiDislikes: body.dislikes,
        apiLikes: body.likes,
        count: visual.count,
        countAudit,
        readyLatencyMs,
        readyTimeoutMs,
        screenshotPath,
        soak,
        videoId,
      });
    }

    return { hopCount, hops, outputDirectory, startVideoId: options.watchA };
  });
}

async function runWatchActionTopologyScenario(
  driver,
  options,
  {
    makeDirectory = (directory) => fs.mkdirSync(directory, { recursive: true }),
    outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/watch-actions"),
  } = {},
) {
  makeDirectory(outputDirectory);
  return driver.withNoProductionInteractions(async () => {
    const originalViewport = await driver.readViewportSize();
    const coldLayouts = [];
    let baseline;

    try {
      for (const viewport of WATCH_ACTION_TOPOLOGY_VIEWPORTS) {
        await driver.setViewportSize(viewport);
        const navigation = await driver.openWatch(options.watchA);
        await assertLivePreconditions(driver, options);
        const count = await driver.waitForDislikeText();
        await driver.assertRenderedDislikeCount(count, navigation.body.dislikes, options.runtime);
        const topology = await driver.captureWatchActionTopologyVisual(
          options.runtime,
          path.join(outputDirectory, `${options.runtime}-cold-${viewport.name}-${viewport.width}.png`),
          {
            expectedCounts: navigation.body,
            expectedInventorySignatures: baseline?.inventorySignatures ?? null,
            minimumTopLevelOptionalActions: baseline ? 0 : 1,
          },
        );
        if (!baseline) {
          baseline = topology;
        }
        coldLayouts.push(topology);
      }

      const coldLayoutRecords = coldLayouts.map((topology, index) => ({
        topology,
        viewport: WATCH_ACTION_TOPOLOGY_VIEWPORTS[index],
      }));
      const expansionTransitions = coldLayoutRecords
        .flatMap((source) => coldLayoutRecords.map((destination) => ({ destination, source })))
        .filter(
          ({ destination, source }) =>
            destination.topology.topLevelOptionalSignatures.length >
              source.topology.topLevelOptionalSignatures.length &&
            source.topology.topLevelOptionalSignatures.every((signature) =>
              destination.topology.topLevelOptionalSignatures.includes(signature),
            ),
        )
        .sort(
          (left, right) =>
            right.destination.topology.topLevelOptionalSignatures.length -
              left.destination.topology.topLevelOptionalSignatures.length ||
            left.source.topology.topLevelOptionalSignatures.length -
              right.source.topology.topLevelOptionalSignatures.length,
        );
      const { destination: resizeDestination, source: resizeSource } = expansionTransitions[0] ?? {};
      assert.ok(
        resizeDestination,
        "The configured cold Watch widths did not expose a layout with a strict superset of top-level actions.",
      );

      await driver.setViewportSize(resizeSource.viewport);
      const resizeNavigation = await driver.openWatch(options.watchA);
      await assertLivePreconditions(driver, options);
      const resizeCount = await driver.waitForDislikeText();
      await driver.assertRenderedDislikeCount(resizeCount, resizeNavigation.body.dislikes, options.runtime);
      const resizeRoundTripSource = await driver.captureWatchActionTopologyVisual(
        options.runtime,
        path.join(
          outputDirectory,
          `${options.runtime}-resize-source-${resizeSource.viewport.name}-${resizeSource.viewport.width}.png`,
        ),
        {
          expectedCounts: resizeNavigation.body,
          expectedInventorySignatures: baseline.inventorySignatures,
          expectedTopLevelOptionalSignatures: resizeSource.topology.topLevelOptionalSignatures,
          minimumTopLevelOptionalActions: resizeSource.topology.topLevelOptionalSignatures.length,
        },
      );

      await driver.setViewportSize(resizeDestination.viewport);
      await driver.waitForDislikeText();
      const resizeRoundTripDestination = await driver.captureWatchActionTopologyVisual(
        options.runtime,
        path.join(
          outputDirectory,
          `${options.runtime}-resize-destination-${resizeDestination.viewport.name}-${resizeDestination.viewport.width}.png`,
        ),
        {
          expectedCounts: resizeNavigation.body,
          expectedInventorySignatures: baseline.inventorySignatures,
          expectedTopLevelOptionalSignatures: resizeDestination.topology.topLevelOptionalSignatures,
          minimumTopLevelOptionalActions: resizeDestination.topology.topLevelOptionalSignatures.length,
        },
      );

      await driver.setViewportSize(WATCH_ACTION_TOPOLOGY_VIEWPORTS[0]);
      const { body: sidebarBody, videoId: sidebarVideoId } = await driver.navigateToRelatedWatch([options.watchA]);
      await assertLivePreconditions(driver, options);
      const sidebarCount = await driver.waitForDislikeText();
      await driver.assertRenderedDislikeCount(sidebarCount, sidebarBody.dislikes, options.runtime);
      const sidebar = await driver.captureWatchActionTopologyVisual(
        options.runtime,
        path.join(outputDirectory, `${options.runtime}-sidebar-${sidebarVideoId}.png`),
        { expectedCounts: sidebarBody, minimumTopLevelOptionalActions: 1 },
      );

      return {
        coldLayouts,
        outputDirectory,
        resizeRoundTrip: {
          destination: resizeRoundTripDestination,
          destinationViewport: resizeDestination.viewport,
          source: resizeRoundTripSource,
          sourceViewport: resizeSource.viewport,
        },
        sidebar,
        sidebarVideoId,
      };
    } finally {
      await driver.setViewportSize(originalViewport);
    }
  });
}

async function runShortsRenderScenario(
  driver,
  options,
  {
    makeDirectory = (directory) => fs.mkdirSync(directory, { recursive: true }),
    outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/specific-short"),
  } = {},
) {
  const captureShortsVisual = {
    "native-pair": (screenshotPath) => driver.captureNativeShortsVisual(options.short, screenshotPath),
    "strict-synthetic": (screenshotPath) => driver.captureSyntheticShortsVisual(options.short, screenshotPath),
  }[options.capabilities?.shortsVisualModel];
  assert.equal(
    typeof captureShortsVisual,
    "function",
    `Unsupported live Shorts visual model: ${options.capabilities?.shortsVisualModel ?? "missing"}.`,
  );
  makeDirectory(outputDirectory);

  return driver.withNoProductionInteractions(async () => {
    const validate = async (navigation, phase) => {
      await assertLivePreconditions(driver, options);
      assert.equal(navigation?.videoId, options.short, `${phase} targeted a stale Short.`);
      assert.equal(navigation?.status, 200, `${phase} did not receive HTTP 200 for ${options.short}.`);
      assert.ok(
        Number.isSafeInteger(navigation?.body?.dislikes) && navigation.body.dislikes >= 0,
        `${phase} has no valid production dislike count for ${options.short}.`,
      );
      const control = await driver.assertCurrentShortsControl(options.short, options.runtime, {
        expectedDislikes: navigation.body.dislikes,
      });
      const visual = await captureShortsVisual(
        path.join(outputDirectory, `${options.runtime}-${phase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`),
      );
      const stability = await driver.soakCurrentShortsControl(options.short, options.runtime, navigation.body.dislikes);
      return { control, navigation, stability, visual };
    };

    const direct = await validate(await driver.openShort(options.short), "cold-direct-load");
    const reloaded = await validate(await driver.reload(options.short), "reload");
    return { direct, outputDirectory, reloaded, videoId: options.short };
  });
}

async function runChannelShortsNavigationScenario(
  driver,
  options,
  {
    makeDirectory = (directory) => fs.mkdirSync(directory, { recursive: true }),
    outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/shorts-navigation"),
    writeFile = (filePath, contents) => fs.writeFileSync(filePath, contents, "utf8"),
  } = {},
) {
  const hopCount = options.navigation?.shortsNextHops;
  assert.ok(
    Number.isSafeInteger(hopCount) && hopCount >= MIN_LIVE_SHORTS_NEXT_HOPS,
    `The Shorts navigation smoke requires at least ${MIN_LIVE_SHORTS_NEXT_HOPS} successful Next samples.`,
  );
  const captureShortsVisual = {
    "native-pair": (videoId, screenshotPath) => driver.captureNativeShortsVisual(videoId, screenshotPath),
    "strict-synthetic": (videoId, screenshotPath) => driver.captureSyntheticShortsVisual(videoId, screenshotPath),
  }[options.capabilities?.shortsVisualModel];
  assert.equal(
    typeof captureShortsVisual,
    "function",
    `Unsupported live Shorts visual model: ${options.capabilities?.shortsVisualModel ?? "missing"}.`,
  );
  makeDirectory(outputDirectory);

  return driver.withNoProductionInteractions(async () => {
    const initialNavigation = await driver.navigateFromColdChannelToShort(
      options.navigation.channelUrl,
      options.navigation.short,
    );
    await assertLivePreconditions(driver, options);
    const visitedVideoIds = [options.navigation.short];
    const hops = [];
    const skipped = [];
    let previousVideoId = options.navigation.short;

    const recordBlankSample = async (navigation, source, attemptNumber) => {
      const evidenceName = `${options.runtime}-shorts-blank-${source}-${String(attemptNumber).padStart(2, "0")}-${
        navigation.videoId
      }`;
      const screenshotPath = path.join(outputDirectory, `${evidenceName}.png`);
      const inventoryPath = path.join(outputDirectory, `${evidenceName}.json`);
      const diagnostics = await driver.captureBlankShortsDiagnostics(navigation.videoId, screenshotPath);
      if (diagnostics.nativeControlsAfterEvidence.status !== "blank") {
        navigation.nativeControls = diagnostics.nativeControlsAfterEvidence;
        driver.reportProgress("shorts-sample.recovered-after-evidence", {
          attemptNumber,
          source,
          status: diagnostics.nativeControlsAfterEvidence.status,
          videoId: navigation.videoId,
        });
        return null;
      }
      const record = {
        attemptNumber,
        durationMs: navigation.nativeControls.observedForMs,
        inventoryPath,
        reason: navigation.nativeControls.reason,
        screenshotPath,
        source,
        videoId: navigation.videoId,
        votesRequestObserved: navigation.request !== null,
      };
      writeFile(
        inventoryPath,
        `${JSON.stringify(
          {
            diagnostics,
            nativeControls: navigation.nativeControls,
            sample: record,
          },
          null,
          2,
        )}\n`,
      );
      skipped.push(record);
      driver.reportBlankShortsSample(record);
      return record;
    };
    const assertReadyNavigation = (navigation, label) => {
      assert.equal(
        navigation?.nativeControls?.status,
        "present",
        `${label} did not provide a native Shorts control classification.`,
      );
      assert.equal(navigation.status, 200, `${label} did not receive HTTP 200 for ${navigation.videoId}.`);
      assert.equal(navigation.request?.method, "GET", `${label} did not issue a GET /votes request.`);
      assert.equal(
        navigation.request?.videoId,
        navigation.videoId,
        `${label} requested votes for stale video ${navigation.request?.videoId} instead of ${navigation.videoId}.`,
      );
      assert.ok(
        Number.isSafeInteger(navigation.body?.dislikes) && navigation.body.dislikes >= 0,
        `${label} has no valid production dislike count.`,
      );
    };

    let initial = null;
    let initialStability = null;
    let initialVisual = null;
    if (initialNavigation.nativeControls?.status === "blank") {
      await recordBlankSample(initialNavigation, "channel", 0);
    }
    if (initialNavigation.nativeControls?.status !== "blank") {
      assertReadyNavigation(initialNavigation, "The initial channel-to-Short transition");
      initial = await driver.assertCurrentShortsControl(options.navigation.short, options.runtime, {
        expectedDislikes: initialNavigation.body.dislikes,
      });
      initialStability = await driver.soakCurrentShortsControl(
        options.navigation.short,
        options.runtime,
        initialNavigation.body.dislikes,
      );
      initialVisual = await captureShortsVisual(
        options.navigation.short,
        path.join(outputDirectory, `${options.runtime}-shorts-hop-00-${options.navigation.short}.png`),
      );
    }

    const maximumNextAttempts = hopCount * 2;
    const expectedValidSamples = hopCount + (initial === null ? 0 : 1);
    const maximumBlankSamples = expectedValidSamples - 1;
    let attemptedNextHops = 0;
    while (hops.length < hopCount && attemptedNextHops < maximumNextAttempts && skipped.length <= maximumBlankSamples) {
      attemptedNextHops += 1;
      const navigation = await driver.navigateToNextShort(previousVideoId);
      const { videoId } = navigation;
      assert.match(
        videoId,
        /^[A-Za-z0-9_-]{11}$/,
        `Shorts Next attempt ${attemptedNextHops} produced an invalid video ID.`,
      );
      assert.ok(
        !visitedVideoIds.includes(videoId),
        `Shorts Next attempt ${attemptedNextHops} revisited an earlier video ${videoId}.`,
      );
      visitedVideoIds.push(videoId);
      previousVideoId = videoId;

      if (navigation.nativeControls?.status === "blank") {
        const skippedNavigation = await recordBlankSample(navigation, "next", attemptedNextHops);
        if (skippedNavigation !== null) continue;
      }

      const hopNumber = hops.length + 1;
      const label = `Shorts successful Next sample ${hopNumber} (attempt ${attemptedNextHops})`;
      assertReadyNavigation(navigation, label);
      const { body, request, status } = navigation;
      await driver.assertRuntime(options.runtime, options.expectedVersion, options.expectedBuildId);
      const control = await driver.assertCurrentShortsControl(videoId, options.runtime, {
        expectedDislikes: body.dislikes,
      });
      assert.equal(control.videoId, videoId, `${label} returned a stale control owner.`);
      assert.equal(control.syntheticVideoId, videoId, `${label} retained a stale synthetic ID.`);
      assert.equal(
        control.activeActionBarSyntheticControls,
        1,
        `${label} has duplicate controls in its active action stack.`,
      );
      assert.equal(control.currentReelSyntheticControls, 1, `${label} has duplicate controls in its current reel.`);
      assert.equal(control.visibleDocumentSyntheticControls, 1, `${label} has duplicate visible controls.`);
      assert.equal(control.visibleStaleSyntheticControls, 0, `${label} has a visible stale-video control.`);
      assert.match(control.count, /\p{Number}/u, `${label} did not render its dislike count.`);
      const visual = await captureShortsVisual(
        videoId,
        path.join(
          outputDirectory,
          `${options.runtime}-shorts-hop-${String(hopNumber).padStart(2, "0")}-${videoId}.png`,
        ),
      );
      const stability = await driver.soakCurrentShortsControl(videoId, options.runtime, body.dislikes);
      hops.push({
        attemptNumber: attemptedNextHops,
        body,
        control,
        nativeControls: navigation.nativeControls,
        request,
        stability,
        status,
        videoId,
        visual,
      });
    }

    assert.equal(
      hops.length,
      hopCount,
      `The Shorts navigation smoke required ${hopCount} successful Next samples, but found ${hops.length} valid and ${skipped.length} blank samples across ${attemptedNextHops} Next attempts (limit ${maximumNextAttempts}).`,
    );
    const validSampleCount = hops.length + (initial === null ? 0 : 1);
    assert.ok(
      validSampleCount > skipped.length,
      `The Shorts navigation smoke found too many broken YouTube samples: ${validSampleCount} valid versus ${skipped.length} blank.`,
    );
    await driver.pausePlayback();
    return {
      attemptedNextHops,
      hops,
      initial,
      initialNavigation,
      initialStability,
      initialVisual,
      maximumNextAttempts,
      outputDirectory,
      skipped,
      successfulNextSamples: hops.length,
      validSampleCount,
      visitedVideoIds,
    };
  });
}

async function runChannelWatchNavigationScenario(driver, options) {
  if (!options.navigation.watch) {
    throw new Error("RYD_LIVE_NAV_WATCH is required for the channel-to-watch scenario.");
  }

  return driver.withNoProductionInteractions(async () => {
    const navigation = await driver.navigateFromColdChannelToWatch(
      options.navigation.channelUrl,
      options.navigation.watch,
    );
    await assertLivePreconditions(driver, options);
    return driver.assertCurrentWatchResult(options.navigation.watch, options.runtime, navigation.body);
  });
}

async function runResponsiveVisualScenario(
  driver,
  options,
  {
    makeDirectory = (directory) => fs.mkdirSync(directory, { recursive: true }),
    outputDirectory = path.resolve(__dirname, "../../../../test-results/live-youtube/responsive"),
  } = {},
) {
  const shortsVisualModel = options.capabilities?.shortsVisualModel;
  const captureShortsVisual = {
    "native-pair": (screenshotPath) => driver.captureNativeShortsVisual(options.short, screenshotPath),
    "strict-synthetic": (screenshotPath) => driver.captureSyntheticShortsVisual(options.short, screenshotPath),
  }[shortsVisualModel];
  assert.equal(
    typeof captureShortsVisual,
    "function",
    `Unsupported live Shorts visual model: ${shortsVisualModel ?? "missing"}.`,
  );
  makeDirectory(outputDirectory);
  return driver.withNoProductionInteractions(async () => {
    const originalViewport = await driver.readViewportSize();
    const watch = [];
    const shorts = [];

    try {
      await driver.setViewportSize(RESPONSIVE_VIEWPORTS[0]);
      const watchNavigation = await driver.openWatch(options.watchA);
      await assertLivePreconditions(driver, options);
      for (let index = 0; index < RESPONSIVE_VIEWPORTS.length; index += 1) {
        const viewport = RESPONSIVE_VIEWPORTS[index];
        if (index > 0) await driver.setViewportSize(viewport);
        const count = await driver.waitForDislikeText();
        await driver.assertRenderedDislikeCount(count, watchNavigation.body.dislikes, options.runtime);
        watch.push(
          await driver.captureWatchRatioVisual(
            options.runtime,
            path.join(outputDirectory, `${options.runtime}-watch-ratio-${viewport.width}.png`),
            { expectedCounts: watchNavigation.body, expectedVideoId: options.watchA },
          ),
        );
      }

      await driver.setViewportSize(RESPONSIVE_VIEWPORTS[0]);
      const shortNavigation = await driver.openShort(options.short);
      await assertLivePreconditions(driver, options);
      for (let index = 0; index < RESPONSIVE_VIEWPORTS.length; index += 1) {
        const viewport = RESPONSIVE_VIEWPORTS[index];
        if (index > 0) await driver.setViewportSize(viewport);
        const control = await driver.assertCurrentShortsControl(options.short, options.runtime, {
          expectedDislikes: shortNavigation.body.dislikes,
        });
        const count = await driver.waitForDislikeText();
        await driver.assertRenderedDislikeCount(count, shortNavigation.body.dislikes, options.runtime);
        const screenshotPath = path.join(outputDirectory, `${options.runtime}-shorts-control-${viewport.width}.png`);
        shorts.push({
          control,
          visual: await captureShortsVisual(screenshotPath),
        });
      }
    } finally {
      await driver.setViewportSize(originalViewport);
    }

    return {
      outputDirectory,
      shorts,
      shortsSkipped: null,
      watch,
    };
  });
}

async function restoreReactionStateUnchecked(
  driver,
  recorder,
  options,
  videoId,
  initialState,
  expectedUserId,
  isShort,
  failedAttempt,
) {
  try {
    driver.assertCurrentVideo(videoId);
  } catch {
    if (isShort) await driver.openShort(videoId);
    else await driver.openWatch(videoId);
    await assertLivePreconditions(driver, options);
  }

  const currentState = await driver.readReactionState();
  if (currentState === initialState && !failedAttempt) return;

  const attemptedUserId = failedAttempt?.userId;
  const assertCleanupUserId = (userId, roundTripUserId) => {
    assert.equal(typeof userId, "string", "The cleanup reaction has no anonymous RYD identity.");
    if (expectedUserId) {
      assert.equal(userId, expectedUserId, "The cleanup reaction used a different anonymous RYD identity.");
    }
    if (attemptedUserId) {
      assert.equal(userId, attemptedUserId, "The cleanup reaction did not use the failed attempt's RYD identity.");
    }
    if (roundTripUserId) {
      assert.equal(userId, roundTripUserId, "The cleanup round trip changed anonymous RYD identity.");
    }
  };
  const performCleanupTransition = async (action, targetState, roundTripUserId) => {
    const mark = recorder.mark();
    await driver.clickAction(videoId, action);
    await driver.waitForReactionState(targetState);
    const userId = await recorder.waitForHandshake(reactionValue(targetState), mark);
    assertCleanupUserId(userId, roundTripUserId);
    return userId;
  };

  if (currentState === initialState) {
    const action = initialState === "liked" ? "like" : "dislike";
    const awayState = initialState === "neutral" ? "disliked" : "neutral";
    const awayUserId = await performCleanupTransition(action, awayState);
    await performCleanupTransition(action, initialState, awayUserId);
    return;
  }

  const action =
    initialState === "neutral"
      ? currentState === "liked"
        ? "like"
        : "dislike"
      : initialState === "liked"
        ? "like"
        : "dislike";
  await performCleanupTransition(action, initialState);
}

async function restoreReactionState(
  driver,
  recorder,
  options,
  videoId,
  initialState,
  expectedUserId,
  isShort,
  failedAttempt,
) {
  try {
    await restoreReactionStateUnchecked(
      driver,
      recorder,
      options,
      videoId,
      initialState,
      expectedUserId,
      isShort,
      failedAttempt,
    );
  } catch (error) {
    const url = isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
    throw new Error(`Automatic cleanup could not be verified. Manually restore ${url}. ${error.message}`, {
      cause: error,
    });
  }
}

async function runReactionCycle(
  driver,
  recorder,
  options,
  { beforeFirstAction, captureReactionVisual = null, isShort = false, videoId },
) {
  const navigation = isShort ? await driver.openShort(videoId) : await driver.openWatch(videoId);
  assertExpectedWatchCounts(navigation?.body);
  await assertLivePreconditions(driver, options);
  const baselineCount = await driver.waitForDislikeText();
  await driver.assertRenderedDislikeCount(baselineCount, navigation.body.dislikes, options.runtime);

  const initialState = await driver.readReactionState();
  const actions = REACTION_CYCLES[initialState];
  assert.ok(actions, `Unsupported initial YouTube reaction state: ${initialState}`);
  let projectedState = initialState;
  let projectedCounts = { dislikes: navigation.body.dislikes, likes: navigation.body.likes };
  const observableDislikeChanges = [];
  for (const action of actions) {
    const transition = resolveLiveVoteTransition(projectedState, action);
    const nextCounts = applyVoteTransitionCounts(projectedCounts.likes, projectedCounts.dislikes, transition);
    if (transition.dislikesDelta !== 0) {
      observableDislikeChanges.push({ after: nextCounts.dislikes, before: projectedCounts.dislikes });
    }
    projectedCounts = nextCounts;
    projectedState = transition.nextState;
  }
  await driver.assertDislikeCountChangesObservable(observableDislikeChanges, options.runtime);

  let authorized = false;
  let completed = false;
  let expectedUserId;
  let failedAttempt;
  let currentState = initialState;
  const initialCounts = { dislikes: navigation.body.dislikes, likes: navigation.body.likes };
  let expectedCounts = { ...initialCounts };
  const evidencePaths = [];
  const captureEvidence = async (index) => {
    if (!captureReactionVisual) return;
    const screenshotPath = await captureReactionVisual({ counts: { ...expectedCounts }, index, state: currentState });
    assert.equal(typeof screenshotPath, "string", "The reaction visual capture did not return an evidence path.");
    evidencePaths.push(screenshotPath);
  };
  try {
    await captureEvidence(0);
    driver.assertCurrentVideo(videoId);
    await assertLivePreconditions(driver, options);
    if (beforeFirstAction) await beforeFirstAction();
    authorized = true;

    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      const transition = resolveLiveVoteTransition(currentState, action);
      const expectedState = transition.nextState;
      const nextCounts = applyVoteTransitionCounts(expectedCounts.likes, expectedCounts.dislikes, transition);
      const mark = recorder.mark();
      const value = transition.value;
      failedAttempt = { mark, userId: undefined, value };
      await driver.clickAction(videoId, action);
      await driver.waitForReactionState(expectedState);
      const userId = await recorder.waitForHandshake(value, mark);
      failedAttempt.userId = userId;
      if (expectedUserId) assert.equal(userId, expectedUserId, "The transition cycle changed anonymous RYD identity.");
      expectedUserId = userId;
      failedAttempt = undefined;
      currentState = expectedState;
      expectedCounts = nextCounts;
      const renderedCount = await driver.waitForDislikeText();
      await driver.assertRenderedDislikeCount(renderedCount, expectedCounts.dislikes, options.runtime);
      await captureEvidence(index + 1);
    }

    assert.equal(currentState, initialState, "The six-transition cycle did not return to its initial state.");
    completed = true;
    return { evidencePaths, finalCounts: expectedCounts, initialCounts, initialState, userId: expectedUserId };
  } finally {
    if (authorized && !completed) {
      if (failedAttempt && !failedAttempt.userId && typeof recorder.voteUserId === "function") {
        try {
          failedAttempt.userId = recorder.voteUserId(failedAttempt.value, failedAttempt.mark);
        } catch {
          failedAttempt.userId = undefined;
        }
      }
      await restoreReactionState(
        driver,
        recorder,
        options,
        videoId,
        initialState,
        expectedUserId,
        isShort,
        failedAttempt,
      );
    }
  }
}

async function runProductionReactionMatrixScenario(
  driver,
  options,
  createRecorder,
  consumeVoteApproval,
  visualOptions = {},
) {
  const makeDirectory = visualOptions.makeDirectory ?? ((directory) => fs.mkdirSync(directory, { recursive: true }));
  const outputDirectory =
    visualOptions.outputDirectory ??
    path.resolve(__dirname, "../../../../test-results/live-youtube/reactions", options.runtime);
  const reactionShort = options.reactionShort ?? options.short;
  makeDirectory(outputDirectory);
  const captureFor =
    (kind, videoId, isShort) =>
    async ({ counts, index, state }) => {
      const screenshotPath = path.join(outputDirectory, `${kind}-${index}-${state}.png`);
      const evidence = await driver.captureReactionStateVisual({
        expectedCounts: counts,
        expectedState: state,
        isShort,
        runtime: options.runtime,
        screenshotPath,
        shortsVisualModel: options.capabilities?.shortsVisualModel,
        videoId,
      });
      assert.equal(
        evidence?.screenshotPath,
        screenshotPath,
        `The ${kind} reaction capture did not write the requested evidence path.`,
      );
      return screenshotPath;
    };

  const watchRecorder = createRecorder(options.watchB);
  let watchResult;
  try {
    watchResult = await runReactionCycle(driver, watchRecorder, options, {
      beforeFirstAction: consumeVoteApproval,
      captureReactionVisual: captureFor("watch", options.watchB, false),
      videoId: options.watchB,
    });
  } finally {
    watchRecorder.stop();
  }

  const shortRecorder = createRecorder(reactionShort);
  try {
    const shortResult = await runReactionCycle(driver, shortRecorder, options, {
      captureReactionVisual: captureFor("short", reactionShort, true),
      isShort: true,
      videoId: reactionShort,
    });
    assert.equal(
      shortResult.userId,
      watchResult.userId,
      "Watch and Shorts votes used different anonymous RYD identities.",
    );
    return {
      evidencePaths: [...watchResult.evidencePaths, ...shortResult.evidencePaths],
      outputDirectory,
      short: shortResult,
      watch: watchResult,
    };
  } finally {
    shortRecorder.stop();
  }
}

async function runPostNavigationVoteScenario(driver, options, createRecorder, consumeVoteApproval) {
  const recorder = createRecorder(options.watchB);
  try {
    await driver.openPlaylist(options.playlistUrl, options.watchA);
    await assertLivePreconditions(driver, options);
    driver.assertCurrentVideo(options.watchA);
    const watchACount = await driver.waitForDislikeText();

    const navigationMark = recorder.mark();
    await driver.navigateWithinPlaylist(options.watchB);
    await assertLivePreconditions(driver, options);
    driver.assertCurrentVideo(options.watchB);
    const watchBCount = await driver.waitForDislikeText({ differentFrom: watchACount });
    assert.notEqual(
      watchBCount,
      watchACount,
      "Choose allowlisted playlist videos whose rendered dislike counts differ so stale SPA UI can be detected.",
    );
    assert.equal(
      recorder.mark(),
      navigationMark,
      "SPA navigation emitted unexpected production interaction traffic before any reaction click.",
    );

    const initialState = await driver.readReactionState();
    const action = "dislike";
    const selectedState = nextReactionState(initialState, action);
    const selectedValue = reactionValue(selectedState);
    const voteMark = navigationMark;
    let authorized = false;
    let failedAttempt = { mark: voteMark, userId: undefined, value: selectedValue };
    let userId;

    try {
      driver.assertCurrentVideo(options.watchB);
      await assertLivePreconditions(driver, options);
      await consumeVoteApproval();
      authorized = true;
      await driver.clickAction(options.watchB, action);
      await driver.waitForReactionState(selectedState);
      userId = await recorder.waitForHandshake(selectedValue, voteMark);
      failedAttempt = undefined;
    } finally {
      if (authorized) {
        if (failedAttempt && !failedAttempt.userId && typeof recorder.voteUserId === "function") {
          try {
            failedAttempt.userId = recorder.voteUserId(failedAttempt.value, failedAttempt.mark);
          } catch {
            failedAttempt.userId = undefined;
          }
        }
        await restoreReactionState(
          driver,
          recorder,
          options,
          options.watchB,
          initialState,
          userId,
          false,
          failedAttempt,
        );
      }
    }

    driver.assertCurrentVideo(options.watchB);
    assert.equal(
      await driver.readReactionState(),
      initialState,
      "The post-navigation vote scenario did not restore the destination video's initial reaction state.",
    );
    await driver.waitForDislikeText();
    return {
      action,
      initialState,
      selectedState,
      userId,
      videoId: options.watchB,
      watchACount,
      watchBCount,
    };
  } finally {
    recorder.stop();
  }
}

async function restoreNeutralStateUnchecked(driver, recorder, options, dislikeMark, expectedUserId) {
  let state;
  try {
    driver.assertCurrentVideo(options.watchB);
    state = await driver.readVoteState();
  } catch {
    await driver.openWatch(options.watchB);
    await assertLivePreconditions(driver, options);
    state = await driver.readVoteState();
  }

  if (state === "false") {
    if (recorder.hasVote(-1, dislikeMark)) {
      throw new Error(
        `The YouTube button is neutral but the production -1 vote may remain. Manually verify and restore https://www.youtube.com/watch?v=${options.watchB}.`,
      );
    }
    return;
  }
  if (state !== "true") {
    throw new Error(
      `Could not verify the YouTube dislike state. Manually restore https://www.youtube.com/watch?v=${options.watchB}.`,
    );
  }

  const neutralMark = recorder.mark();
  await driver.clickDislike(options.watchB);
  await driver.waitForVoteState(false);
  const neutralUserId = await recorder.waitForHandshake(0, neutralMark);
  if (expectedUserId && neutralUserId !== expectedUserId) {
    throw new Error(
      `The neutral vote used a different identity from the dislike vote. Manually verify and restore https://www.youtube.com/watch?v=${options.watchB}.`,
    );
  }
}

async function restoreNeutralState(driver, recorder, options, dislikeMark, expectedUserId) {
  try {
    await restoreNeutralStateUnchecked(driver, recorder, options, dislikeMark, expectedUserId);
  } catch (error) {
    throw new Error(
      `Automatic cleanup could not be verified. Manually restore https://www.youtube.com/watch?v=${options.watchB}. ${error.message}`,
      { cause: error },
    );
  }
}

async function runReversibleVoteScenario(driver, recorder, options, consumeVoteApproval) {
  await driver.openWatch(options.watchB);
  await assertLivePreconditions(driver, options);
  await driver.waitForDislikeText();
  const initialLikeState = await driver.readLikeState();
  const initialDislikeState = await driver.readVoteState();
  assert.equal(initialLikeState, "false", "The allowlisted vote video must not already be liked.");
  assert.equal(initialDislikeState, "false", "The allowlisted vote video must not already be disliked.");

  const dislikeMark = recorder.mark();
  let cleanupRequired = false;
  let dislikeUserId;
  try {
    driver.assertCurrentVideo(options.watchB);
    await assertLivePreconditions(driver, options);
    await consumeVoteApproval();
    cleanupRequired = true;
    await driver.clickDislike(options.watchB);
    await driver.waitForVoteState(true);
    dislikeUserId = await recorder.waitForHandshake(-1, dislikeMark);
  } finally {
    if (cleanupRequired) {
      await restoreNeutralState(
        driver,
        recorder,
        options,
        dislikeMark,
        dislikeUserId || recorder.voteUserId(-1, dislikeMark),
      );
    }
  }
  await driver.waitForDislikeText();
}

module.exports = {
  RESPONSIVE_VIEWPORTS,
  WATCH_ACTION_TOPOLOGY_VIEWPORTS,
  runChannelShortsNavigationScenario,
  runChannelWatchNavigationScenario,
  runPostNavigationVoteScenario,
  runProductionReactionMatrixScenario,
  runReactionCycle,
  runReloadScenario,
  runReversibleVoteScenario,
  runResponsiveVisualScenario,
  runSidebarStressScenario,
  runShortsRenderScenario,
  runSpaNavigationScenario,
  runWatchRenderScenario,
  runWatchActionTopologyScenario,
};
