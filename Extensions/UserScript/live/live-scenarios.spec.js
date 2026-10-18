const path = require("node:path");
const {
  DISLIKED_STATE,
  LIKED_STATE,
  NEUTRAL_STATE,
  applyVoteTransitionCounts,
  resolveVoteTransition,
} = require("../../common/vote-transition-core");
const {
  RESPONSIVE_VIEWPORTS,
  WATCH_ACTION_TOPOLOGY_VIEWPORTS,
  runChannelShortsNavigationScenario,
  runChannelWatchNavigationScenario,
  runPostNavigationVoteScenario,
  runProductionReactionMatrixScenario,
  runReactionCycle,
  runReloadScenario,
  runResponsiveVisualScenario,
  runSidebarStressScenario,
  runShortsRenderScenario,
  runSpaNavigationScenario,
  runWatchActionTopologyScenario,
  runWatchRenderScenario,
} = require("../e2e/live/live-scenarios");

const EXPECTED_ACTIONS = {
  neutral: ["like", "like", "dislike", "like", "dislike", "dislike"],
  liked: ["like", "dislike", "like", "dislike", "dislike", "like"],
  disliked: ["like", "dislike", "dislike", "like", "like", "dislike"],
};

const SHARED_TEST_STATES = {
  disliked: DISLIKED_STATE,
  liked: LIKED_STATE,
  neutral: NEUTRAL_STATE,
};

function expectedReactionCounts(initialState, initialCounts) {
  let counts = { ...initialCounts };
  let state = SHARED_TEST_STATES[initialState];
  return [
    { ...counts },
    ...EXPECTED_ACTIONS[initialState].map((action) => {
      const transition = resolveVoteTransition(state, action);
      counts = applyVoteTransitionCounts(counts.likes, counts.dislikes, transition);
      state = transition.nextState;
      return { ...counts };
    }),
  ];
}

function nextState(state, action) {
  if (action === "like") return state === "liked" ? "neutral" : "liked";
  return state === "disliked" ? "neutral" : "disliked";
}

function valueForState(state) {
  if (state === "liked") return 1;
  if (state === "disliked") return -1;
  return 0;
}

function createReactionHarness(
  initialState,
  {
    clickThrowTransition = null,
    failHandshake = null,
    failHandshakes = failHandshake === null ? [] : [failHandshake],
    failedVoteUserId = "shared-user-id",
    rollbackOnClickThrow = false,
    rollbackOnHandshakeFailure = false,
    rollbackOnStateWaitFailure = false,
    stateWaitFailTransition = null,
  } = {},
) {
  const initialCounts = { dislikes: 123, likes: 456 };
  const events = [];
  let currentState = initialState;
  let currentVideo = null;
  let handshakeNumber = 0;
  let stateWaitNumber = 0;
  const failedHandshakeNumbers = new Set(failHandshakes);
  const countsForState = () => ({
    dislikes: initialCounts.dislikes + Number(currentState === "disliked") - Number(initialState === "disliked"),
    likes: initialCounts.likes + Number(currentState === "liked") - Number(initialState === "liked"),
  });

  const driver = {
    assertDislikeCountChangesObservable: jest.fn(async (changes) => {
      expect(changes.every(({ after, before }) => after !== before)).toBe(true);
      return changes;
    }),
    assertRenderedDislikeCount: jest.fn(async (renderedCount, dislikes) => {
      expect(renderedCount).toBe(String(dislikes));
      return { normalizedCount: renderedCount };
    }),
    assertCurrentVideo: jest.fn((videoId) => expect(currentVideo).toBe(videoId)),
    assertRuntime: jest.fn(),
    assertSignedIn: jest.fn(),
    clickAction: jest.fn(async (videoId, action) => {
      expect(currentVideo).toBe(videoId);
      currentState = nextState(currentState, action);
      events.push({ action, state: currentState });
      if (events.length === clickThrowTransition) {
        if (rollbackOnClickThrow) currentState = initialState;
        throw new Error("simulated post-dispatch click failure");
      }
    }),
    openShort: jest.fn(async (videoId) => {
      currentVideo = videoId;
      return { body: { ...initialCounts, id: videoId }, videoId };
    }),
    openWatch: jest.fn(async (videoId) => {
      currentVideo = videoId;
      return { body: { ...initialCounts, id: videoId }, videoId };
    }),
    readReactionState: jest.fn(async () => currentState),
    waitForDislikeText: jest.fn(async () => String(countsForState().dislikes)),
    waitForReactionState: jest.fn(async (expected) => {
      stateWaitNumber += 1;
      if (stateWaitNumber === stateWaitFailTransition) {
        if (rollbackOnStateWaitFailure) currentState = initialState;
        throw new Error("simulated post-click state-wait failure");
      }
      expect(currentState).toBe(expected);
    }),
  };

  const recorder = {
    mark: jest.fn(() => events.length),
    waitForHandshake: jest.fn(async (value) => {
      handshakeNumber += 1;
      expect(value).toBe(valueForState(currentState));
      if (failedHandshakeNumbers.has(handshakeNumber)) {
        if (rollbackOnHandshakeFailure) currentState = initialState;
        throw new Error("simulated handshake failure");
      }
      return "shared-user-id";
    }),
    voteUserId: jest.fn(() => failedVoteUserId),
  };

  return {
    driver,
    events,
    getState: () => currentState,
    recorder,
  };
}

const OPTIONS = {
  capabilities: { shortsVisualModel: "strict-synthetic" },
  expectedBuildId: "0123456789abcdef0123456789abcdef",
  expectedChannel: "@ryd-test",
  expectedVersion: "3.2.0",
  runtime: "userscript",
};

function currentShortsControl(videoId, count = "123") {
  return {
    activeActionBarSyntheticControls: 1,
    count,
    currentReelSyntheticControls: 1,
    synthetic: true,
    syntheticVideoId: videoId,
    videoId,
    visibleDocumentSyntheticControls: 1,
    visibleStaleSyntheticControls: 0,
    visibleSyntheticControls: 1,
  };
}

function presentNativeShortsControls(videoId, visibleNativeControls = 5) {
  return {
    currentVideoId: videoId,
    labels: ["Like", "Comments", "Share", "Remix", "Sound"].slice(0, visibleNativeControls),
    matchingRenderedReels: 1,
    matchingVisibleNativeControls: visibleNativeControls,
    observedForMs: 50,
    renderedReels: 1,
    status: "present",
    visibleNativeControls,
  };
}

function blankNativeShortsControls(videoId, observedForMs = 20_000) {
  return {
    currentVideoId: videoId,
    labels: [],
    matchingRenderedReels: 1,
    matchingVisibleNativeControls: 0,
    observedForMs,
    reason: "no-visible-native-shorts-actions",
    renderedReels: 1,
    status: "blank",
    visibleNativeControls: 0,
  };
}

function successfulShortsNavigation(videoId, dislikes = 123) {
  return {
    body: { dislikes, id: videoId, likes: 456 },
    nativeControls: presentNativeShortsControls(videoId),
    request: {
      method: "GET",
      requestId: 1,
      source: "page",
      url: `https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`,
      videoId,
      workerUrl: null,
    },
    status: 200,
    videoId,
  };
}

function blankShortsNavigation(videoId, observedForMs = 20_000) {
  return {
    body: null,
    nativeControls: blankNativeShortsControls(videoId, observedForMs),
    request: null,
    status: null,
    videoId,
  };
}

describe("strict shared Watch navigation results", () => {
  test.each(["userscript", "extension"])(
    "binds every basic %s Watch route to its exact API count and current-result oracle",
    async (runtime) => {
      const response = (videoId, dislikes) => ({ body: { dislikes, id: videoId, likes: 1_000 }, videoId });
      const driver = {
        assertCurrentWatchResult: jest.fn(async (videoId, requestedRuntime, counts) => ({
          count: String(counts.dislikes),
          runtime: requestedRuntime,
          videoId,
        })),
        assertRuntime: jest.fn(),
        assertSignedIn: jest.fn(),
        navigateFromColdChannelToWatch: jest.fn(async () => response("watchvideob", 200)),
        navigateWithinPlaylist: jest.fn(async () => response("watchvideob", 200)),
        openPlaylist: jest.fn(async () => response("watchvideoa", 100)),
        reload: jest.fn(async () => response("watchvideoa", 101)),
        withNoProductionInteractions: jest.fn(async (action) => action()),
      };
      const options = {
        ...OPTIONS,
        navigation: { channelUrl: "https://www.youtube.com/@SmashTrash", watch: "watchvideob" },
        playlistUrl: "https://www.youtube.com/watch?v=watchvideoa&list=playlist",
        runtime,
        watchA: "watchvideoa",
        watchB: "absentvid01",
      };

      await expect(runWatchRenderScenario(driver, options)).resolves.toMatchObject({ count: "100" });
      await expect(runReloadScenario(driver, options)).resolves.toMatchObject({
        initial: { count: "100" },
        reloaded: { count: "101" },
      });
      await expect(runSpaNavigationScenario(driver, options)).resolves.toMatchObject({
        destinationVideoId: "watchvideob",
        watchACount: "100",
        watchBCount: "200",
      });
      await expect(runChannelWatchNavigationScenario(driver, options)).resolves.toMatchObject({ count: "200" });

      expect(driver.assertCurrentWatchResult.mock.calls).toEqual([
        ["watchvideoa", runtime, { dislikes: 100, id: "watchvideoa", likes: 1_000 }],
        ["watchvideoa", runtime, { dislikes: 100, id: "watchvideoa", likes: 1_000 }],
        ["watchvideoa", runtime, { dislikes: 101, id: "watchvideoa", likes: 1_000 }],
        ["watchvideoa", runtime, { dislikes: 100, id: "watchvideoa", likes: 1_000 }],
        ["watchvideob", runtime, { dislikes: 200, id: "watchvideob", likes: 1_000 }],
        ["watchvideob", runtime, { dislikes: 200, id: "watchvideob", likes: 1_000 }],
      ]);
      expect(driver.navigateWithinPlaylist).toHaveBeenCalledWith({ excludedVideoIds: [options.watchA] });
    },
  );

  test("accepts equal formatted counts only after binding the dynamic playlist destination by video ID", async () => {
    const destinationVideoId = "dynamicvid1";
    const navigation = (videoId) => ({ body: { dislikes: 100, id: videoId, likes: 1_000 }, videoId });
    const driver = {
      assertCurrentWatchResult: jest.fn(async (videoId) => ({ count: "100", videoId })),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      navigateWithinPlaylist: jest.fn(async () => navigation(destinationVideoId)),
      openPlaylist: jest.fn(async () => navigation("watchvideoa")),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };
    const options = {
      ...OPTIONS,
      playlistUrl: "https://www.youtube.com/watch?v=watchvideoa&list=playlist",
      runtime: "extension",
      watchA: "watchvideoa",
      watchB: "absentvid01",
    };

    await expect(runSpaNavigationScenario(driver, options)).resolves.toMatchObject({
      destinationVideoId,
      watchACount: "100",
      watchB: { videoId: destinationVideoId },
      watchBCount: "100",
    });
    expect(driver.assertCurrentWatchResult).toHaveBeenLastCalledWith(
      destinationVideoId,
      options.runtime,
      expect.objectContaining({ id: destinationVideoId }),
    );
  });
});

function createPostNavigationVoteHarness(initialState, { failHandshake = null, navigationInteractions = 0 } = {}) {
  const events = [];
  let currentVideo = null;
  let currentState = initialState;
  let handshakeNumber = 0;
  let interactionCount = 0;

  const driver = {
    assertCurrentVideo: jest.fn((videoId) => expect(currentVideo).toBe(videoId)),
    assertRuntime: jest.fn(),
    assertSignedIn: jest.fn(),
    clickAction: jest.fn(async (videoId, action) => {
      expect(currentVideo).toBe(videoId);
      currentState = nextState(currentState, action);
      interactionCount += 2;
      events.push(`click:${action}:${currentState}`);
    }),
    navigateWithinPlaylist: jest.fn(async (videoId) => {
      currentVideo = videoId;
      interactionCount += navigationInteractions;
      events.push(`navigate:${videoId}`);
    }),
    openPlaylist: jest.fn(async (_playlistUrl, videoId) => {
      currentVideo = videoId;
      events.push(`open:${videoId}`);
    }),
    openWatch: jest.fn(async (videoId) => {
      currentVideo = videoId;
      events.push(`cleanup-open:${videoId}`);
    }),
    readReactionState: jest.fn(async () => currentState),
    waitForDislikeText: jest.fn(async () => (currentVideo === "watchvideoa" ? "100" : "200")),
    waitForReactionState: jest.fn(async (expected) => expect(currentState).toBe(expected)),
  };
  const recorder = {
    mark: jest.fn(() => interactionCount),
    stop: jest.fn(),
    voteUserId: jest.fn(() => "shared-user-id"),
    waitForHandshake: jest.fn(async (value, mark) => {
      handshakeNumber += 1;
      expect(mark).toBe(interactionCount - 2);
      expect(value).toBe(valueForState(currentState));
      events.push(`handshake:${value}`);
      if (handshakeNumber === failHandshake) throw new Error("simulated handshake failure");
      return "shared-user-id";
    }),
  };

  return {
    driver,
    events,
    getState: () => currentState,
    recorder,
  };
}

describe("live Shorts navigation stabilization", () => {
  test.each(["userscript", "extension"])(
    "requires ten successful, distinct, response-backed visual transitions for %s",
    async (runtime) => {
      const events = [];
      const nextVideoIds = Array.from({ length: 10 }, (_, index) => `shortnext${String(index + 1).padStart(2, "0")}`);
      let nextIndex = 0;
      const driver = {
        assertCurrentShortsControl: jest.fn(async (videoId) => {
          events.push(`control:${videoId}`);
          return currentShortsControl(videoId, String(100 + nextIndex));
        }),
        assertRuntime: jest.fn(async () => events.push("runtime")),
        assertSignedIn: jest.fn(async () => events.push("signed-in")),
        captureSyntheticShortsVisual: jest.fn(async (videoId, screenshotPath) => {
          events.push(`visual:${videoId}`);
          return { screenshotPath, videoId };
        }),
        navigateFromColdChannelToShort: jest.fn(async () => {
          events.push("channel-navigation");
          return successfulShortsNavigation("abcdefghijk", 200);
        }),
        navigateToNextShort: jest.fn(async (previousVideoId) => {
          const videoId = nextVideoIds[nextIndex];
          expect(previousVideoId).toBe(nextIndex === 0 ? "abcdefghijk" : nextVideoIds[nextIndex - 1]);
          nextIndex += 1;
          events.push(`next:${videoId}`);
          return successfulShortsNavigation(videoId, 200 + nextIndex);
        }),
        pausePlayback: jest.fn(async () => events.push("pause")),
        reportBlankShortsSample: jest.fn(),
        soakCurrentShortsControl: jest.fn(async (videoId, requestedRuntime, dislikes) => {
          events.push(`soak:${videoId}:${requestedRuntime}:${dislikes}`);
          return { sampleCount: 6, videoId };
        }),
        withNoProductionInteractions: jest.fn(async (action) => action()),
      };
      const options = {
        ...OPTIONS,
        runtime,
        navigation: {
          channelUrl: "https://www.youtube.com/@SmashTrash",
          short: "abcdefghijk",
          shortsNextHops: 10,
        },
      };

      const result = await runChannelShortsNavigationScenario(driver, options, {
        makeDirectory: jest.fn(),
        outputDirectory: "shorts-evidence",
      });

      expect(result.visitedVideoIds).toEqual(["abcdefghijk", ...nextVideoIds]);
      expect(result.hops).toHaveLength(10);
      expect(result.attemptedNextHops).toBe(10);
      expect(result.maximumNextAttempts).toBe(20);
      expect(result.skipped).toEqual([]);
      expect(result.successfulNextSamples).toBe(10);
      expect(result.validSampleCount).toBe(11);
      expect(result.hops.map(({ status, videoId }) => ({ status, videoId }))).toEqual(
        nextVideoIds.map((videoId) => ({ status: 200, videoId })),
      );
      expect(driver.navigateToNextShort).toHaveBeenCalledTimes(10);
      expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(11);
      expect(driver.captureSyntheticShortsVisual).toHaveBeenCalledTimes(11);
      expect(driver.soakCurrentShortsControl).toHaveBeenCalledTimes(11);
      expect(driver.reportBlankShortsSample).not.toHaveBeenCalled();
      expect(driver.assertCurrentShortsControl.mock.calls.slice(1)).toEqual(
        nextVideoIds.map((videoId, index) => [videoId, runtime, { expectedDislikes: 201 + index }]),
      );
      expect(driver.soakCurrentShortsControl.mock.calls).toEqual([
        ["abcdefghijk", runtime, 200],
        ...nextVideoIds.map((videoId, index) => [videoId, runtime, 201 + index]),
      ]);
      expect(driver.captureSyntheticShortsVisual.mock.calls.map(([videoId]) => videoId)).toEqual([
        "abcdefghijk",
        ...nextVideoIds,
      ]);
      expect(driver.captureSyntheticShortsVisual.mock.calls.at(-1)[1]).toContain(
        `${runtime}-shorts-hop-10-shortnext10.png`,
      );
      expect(driver.pausePlayback).toHaveBeenCalledTimes(1);
      expect(events.at(-1)).toBe("pause");
      expect(driver.withNoProductionInteractions).toHaveBeenCalledTimes(1);
    },
  );

  test("rejects a Shorts stress configuration below ten before loading YouTube", async () => {
    const driver = { withNoProductionInteractions: jest.fn() };

    await expect(
      runChannelShortsNavigationScenario(driver, {
        ...OPTIONS,
        navigation: { channelUrl: "https://www.youtube.com/@SmashTrash", short: "abcdefghijk", shortsNextHops: 9 },
      }),
    ).rejects.toThrow("at least 10 successful Next samples");
    expect(driver.withNoProductionInteractions).not.toHaveBeenCalled();
  });

  test("fails when a later Shorts Next transition revisits a previously rendered video", async () => {
    const nextVideoIds = ["shortnext01", "shortnext02", "shortnext01"];
    let nextIndex = 0;
    const driver = {
      assertCurrentShortsControl: jest.fn(async (videoId) => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => {
        const videoId = nextVideoIds[nextIndex++];
        return successfulShortsNavigation(videoId);
      }),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence" },
      ),
    ).rejects.toThrow("attempt 3 revisited an earlier video shortnext01");
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(3);
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });

  test.each([
    [
      {
        body: { dislikes: 123 },
        nativeControls: presentNativeShortsControls("shortnext01"),
        request: { method: "GET", videoId: "shortnext01" },
        status: 204,
        videoId: "shortnext01",
      },
      "did not receive HTTP 200",
    ],
    [
      {
        body: { dislikes: 123 },
        nativeControls: presentNativeShortsControls("shortnext01"),
        request: { method: "POST", videoId: "shortnext01" },
        status: 200,
        videoId: "shortnext01",
      },
      "did not issue a GET /votes request",
    ],
    [
      {
        body: { dislikes: 123 },
        nativeControls: presentNativeShortsControls("shortnext01"),
        request: { method: "GET", videoId: "stalevid001" },
        status: 200,
        videoId: "shortnext01",
      },
      "requested votes for stale video stalevid001 instead of shortnext01",
    ],
    [
      {
        body: {},
        nativeControls: presentNativeShortsControls("shortnext01"),
        request: { method: "GET", videoId: "shortnext01" },
        status: 200,
        videoId: "shortnext01",
      },
      "has no valid production dislike count",
    ],
  ])("rejects a Shorts hop without its exact successful /votes result", async (navigation, expectedError) => {
    const driver = {
      assertCurrentShortsControl: jest.fn(async (videoId) => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => navigation),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence" },
      ),
    ).rejects.toThrow(expectedError);
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(1);
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });

  test("skips fully blank native rails, records their IDs and durations, and still audits ten successful Next samples", async () => {
    const attemptVideoIds = Array.from({ length: 11 }, (_, index) => `nexttry${String(index + 1).padStart(4, "0")}`);
    let nextIndex = 0;
    const driver = {
      assertCurrentShortsControl: jest.fn(async (videoId) => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureBlankShortsDiagnostics: jest.fn(async (videoId, screenshotPath) => ({
        expectedVideoId: videoId,
        nativeControlsAfterEvidence: blankNativeShortsControls(videoId, 0),
        reels: [],
        screenshotPath,
      })),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => blankShortsNavigation("abcdefghijk", 20_125)),
      navigateToNextShort: jest.fn(async () => {
        const videoId = attemptVideoIds[nextIndex];
        nextIndex += 1;
        return nextIndex === 1 ? blankShortsNavigation(videoId, 20_250) : successfulShortsNavigation(videoId);
      }),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };
    const writeFile = jest.fn();

    const result = await runChannelShortsNavigationScenario(
      driver,
      {
        ...OPTIONS,
        navigation: {
          channelUrl: "https://www.youtube.com/@SmashTrash",
          short: "abcdefghijk",
          shortsNextHops: 10,
        },
      },
      { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence", writeFile },
    );

    expect(result.attemptedNextHops).toBe(11);
    expect(result.successfulNextSamples).toBe(10);
    expect(result.validSampleCount).toBe(10);
    expect(result.skipped).toEqual([
      {
        attemptNumber: 0,
        durationMs: 20_125,
        inventoryPath: path.join("shorts-evidence", "userscript-shorts-blank-channel-00-abcdefghijk.json"),
        reason: "no-visible-native-shorts-actions",
        screenshotPath: path.join("shorts-evidence", "userscript-shorts-blank-channel-00-abcdefghijk.png"),
        source: "channel",
        videoId: "abcdefghijk",
        votesRequestObserved: false,
      },
      {
        attemptNumber: 1,
        durationMs: 20_250,
        inventoryPath: path.join("shorts-evidence", "userscript-shorts-blank-next-01-nexttry0001.json"),
        reason: "no-visible-native-shorts-actions",
        screenshotPath: path.join("shorts-evidence", "userscript-shorts-blank-next-01-nexttry0001.png"),
        source: "next",
        videoId: "nexttry0001",
        votesRequestObserved: false,
      },
    ]);
    expect(driver.reportBlankShortsSample.mock.calls.map(([record]) => record)).toEqual(result.skipped);
    expect(driver.captureBlankShortsDiagnostics).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledTimes(2);
    for (const [inventoryPath, contents] of writeFile.mock.calls) {
      const evidence = JSON.parse(contents);
      expect(inventoryPath).toBe(evidence.sample.inventoryPath);
      expect(evidence.diagnostics.screenshotPath).toBe(evidence.sample.screenshotPath);
      expect(evidence.nativeControls.status).toBe("blank");
    }
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(10);
    expect(driver.captureSyntheticShortsVisual).toHaveBeenCalledTimes(10);
    expect(driver.soakCurrentShortsControl).toHaveBeenCalledTimes(10);
    expect(result.visitedVideoIds).toEqual(["abcdefghijk", ...attemptVideoIds]);
  });

  test("reclassifies a late native rail after blank evidence and applies the normal strict runtime assertions", async () => {
    const nextVideoIds = Array.from({ length: 10 }, (_, index) => `nexttry${String(index + 1).padStart(4, "0")}`);
    let nextIndex = 0;
    const lateNavigation = {
      ...successfulShortsNavigation(nextVideoIds[0]),
      nativeControls: blankNativeShortsControls(nextVideoIds[0]),
    };
    const driver = {
      assertCurrentShortsControl: jest.fn(async (videoId) => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureBlankShortsDiagnostics: jest.fn(async (videoId, screenshotPath) => ({
        expectedVideoId: videoId,
        nativeControlsAfterEvidence: presentNativeShortsControls(videoId, 4),
        reels: [],
        screenshotPath,
      })),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => {
        const videoId = nextVideoIds[nextIndex];
        nextIndex += 1;
        return nextIndex === 1 ? lateNavigation : successfulShortsNavigation(videoId);
      }),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      reportProgress: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    const result = await runChannelShortsNavigationScenario(
      driver,
      {
        ...OPTIONS,
        navigation: {
          channelUrl: "https://www.youtube.com/@SmashTrash",
          short: "abcdefghijk",
          shortsNextHops: 10,
        },
      },
      { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence", writeFile: jest.fn() },
    );

    expect(result.attemptedNextHops).toBe(10);
    expect(result.successfulNextSamples).toBe(10);
    expect(result.skipped).toEqual([]);
    expect(driver.captureBlankShortsDiagnostics).toHaveBeenCalledTimes(1);
    expect(driver.reportBlankShortsSample).not.toHaveBeenCalled();
    expect(driver.reportProgress).toHaveBeenCalledWith("shorts-sample.recovered-after-evidence", {
      attemptNumber: 1,
      source: "next",
      status: "present",
      videoId: nextVideoIds[0],
    });
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledWith(nextVideoIds[0], "userscript", {
      expectedDislikes: 123,
    });
  });

  test("fails instead of skipping when post-evidence remeasurement reveals native actions without RYD", async () => {
    const videoId = "nexttry0001";
    const lateNavigation = {
      ...successfulShortsNavigation(videoId),
      nativeControls: blankNativeShortsControls(videoId),
    };
    const driver = {
      assertCurrentShortsControl: jest
        .fn()
        .mockResolvedValueOnce(currentShortsControl("abcdefghijk"))
        .mockRejectedValueOnce(new Error("runtime Dislike missing after late native rail")),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureBlankShortsDiagnostics: jest.fn(async (_videoId, screenshotPath) => ({
        nativeControlsAfterEvidence: presentNativeShortsControls(videoId, 4),
        screenshotPath,
      })),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => lateNavigation),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      reportProgress: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence", writeFile: jest.fn() },
      ),
    ).rejects.toThrow("runtime Dislike missing after late native rail");
    expect(driver.reportBlankShortsSample).not.toHaveBeenCalled();
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });

  test("treats any native Shorts rail with a missing runtime Dislike as a hard failure instead of a skip", async () => {
    const driver = {
      assertCurrentShortsControl: jest
        .fn()
        .mockResolvedValueOnce(currentShortsControl("abcdefghijk"))
        .mockRejectedValueOnce(new Error("runtime Dislike missing")),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => successfulShortsNavigation("nexttry0001")),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence" },
      ),
    ).rejects.toThrow("runtime Dislike missing");
    expect(driver.navigateToNextShort).toHaveBeenCalledTimes(1);
    expect(driver.reportBlankShortsSample).not.toHaveBeenCalled();
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });

  test("stops within the bounded attempt policy when blank YouTube samples can no longer be a minority", async () => {
    let attempt = 0;
    const driver = {
      assertCurrentShortsControl: jest.fn(),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureBlankShortsDiagnostics: jest.fn(async (videoId, screenshotPath) => ({
        expectedVideoId: videoId,
        nativeControlsAfterEvidence: blankNativeShortsControls(videoId, 0),
        reels: [],
        screenshotPath,
      })),
      captureSyntheticShortsVisual: jest.fn(),
      navigateFromColdChannelToShort: jest.fn(async () => blankShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => {
        attempt += 1;
        return blankShortsNavigation(`nexttry${String(attempt).padStart(4, "0")}`);
      }),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence", writeFile: jest.fn() },
      ),
    ).rejects.toThrow(
      /required 10 successful Next samples, but found 0 valid and 10 blank samples across 9 Next attempts/,
    );
    expect(driver.navigateToNextShort).toHaveBeenCalledTimes(9);
    expect(driver.captureBlankShortsDiagnostics).toHaveBeenCalledTimes(10);
    expect(driver.reportBlankShortsSample).toHaveBeenCalledTimes(10);
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });

  test("stops at 18 attempts after seven successes and eleven blanks because ten successes are no longer reachable", async () => {
    let attempt = 0;
    const driver = {
      assertCurrentShortsControl: jest.fn(async (videoId) => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureBlankShortsDiagnostics: jest.fn(async (videoId, screenshotPath) => ({
        nativeControlsAfterEvidence: blankNativeShortsControls(videoId, 0),
        screenshotPath,
      })),
      captureSyntheticShortsVisual: jest.fn(async () => ({})),
      navigateFromColdChannelToShort: jest.fn(async () => successfulShortsNavigation("abcdefghijk")),
      navigateToNextShort: jest.fn(async () => {
        attempt += 1;
        const videoId = `nexttry${String(attempt).padStart(4, "0")}`;
        return attempt <= 7 ? successfulShortsNavigation(videoId) : blankShortsNavigation(videoId);
      }),
      pausePlayback: jest.fn(),
      reportBlankShortsSample: jest.fn(),
      soakCurrentShortsControl: jest.fn(),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runChannelShortsNavigationScenario(
        driver,
        {
          ...OPTIONS,
          navigation: {
            channelUrl: "https://www.youtube.com/@SmashTrash",
            short: "abcdefghijk",
            shortsNextHops: 10,
          },
        },
        { makeDirectory: jest.fn(), outputDirectory: "shorts-evidence", writeFile: jest.fn() },
      ),
    ).rejects.toThrow(/found 7 valid and 11 blank samples across 18 Next attempts \(limit 20\)/);
    expect(driver.navigateToNextShort).toHaveBeenCalledTimes(18);
    expect(driver.reportBlankShortsSample).toHaveBeenCalledTimes(11);
    expect(driver.pausePlayback).not.toHaveBeenCalled();
  });
});

describe("live post-navigation production vote", () => {
  test.each([
    ["neutral", "disliked", [-1, 0], ["dislike", "dislike"]],
    ["liked", "disliked", [-1, 1], ["dislike", "like"]],
    ["disliked", "neutral", [0, -1], ["dislike", "dislike"]],
  ])(
    "targets the SPA destination and restores an initially %s reaction",
    async (initialState, selectedState, expectedValues, expectedActions) => {
      const harness = createPostNavigationVoteHarness(initialState);
      const createRecorder = jest.fn((videoId) => {
        expect(videoId).toBe("watchvideob");
        return harness.recorder;
      });
      const consumeVoteApproval = jest.fn(async () => {
        harness.driver.assertCurrentVideo("watchvideob");
        harness.events.push("approved");
      });
      const options = {
        ...OPTIONS,
        playlistUrl: "https://www.youtube.com/watch?v=watchvideoa&list=playlist",
        watchA: "watchvideoa",
        watchB: "watchvideob",
      };

      await expect(
        runPostNavigationVoteScenario(harness.driver, options, createRecorder, consumeVoteApproval),
      ).resolves.toEqual({
        action: "dislike",
        initialState,
        selectedState,
        userId: "shared-user-id",
        videoId: "watchvideob",
        watchACount: "100",
        watchBCount: "200",
      });

      expect(harness.driver.openPlaylist).toHaveBeenCalledWith(options.playlistUrl, options.watchA);
      expect(harness.driver.navigateWithinPlaylist).toHaveBeenCalledWith(options.watchB);
      expect(harness.driver.openWatch).not.toHaveBeenCalled();
      expect(consumeVoteApproval).toHaveBeenCalledTimes(1);
      expect(harness.events.indexOf("approved")).toBeLessThan(
        harness.events.findIndex((event) => event.startsWith("click:")),
      );
      expect(harness.events.filter((event) => event.startsWith("click:")).map((event) => event.split(":")[1])).toEqual(
        expectedActions,
      );
      expect(harness.recorder.waitForHandshake.mock.calls.map(([value]) => value)).toEqual(expectedValues);
      expect(harness.getState()).toBe(initialState);
      expect(harness.recorder.stop).toHaveBeenCalledTimes(1);
    },
  );

  test("rejects interaction traffic emitted by navigation before requesting reaction approval", async () => {
    const harness = createPostNavigationVoteHarness("neutral", { navigationInteractions: 2 });
    const consumeVoteApproval = jest.fn();

    await expect(
      runPostNavigationVoteScenario(
        harness.driver,
        {
          ...OPTIONS,
          playlistUrl: "https://www.youtube.com/watch?v=watchvideoa&list=playlist",
          watchA: "watchvideoa",
          watchB: "watchvideob",
        },
        () => harness.recorder,
        consumeVoteApproval,
      ),
    ).rejects.toThrow(/navigation emitted unexpected production interaction traffic/);

    expect(consumeVoteApproval).not.toHaveBeenCalled();
    expect(harness.driver.clickAction).not.toHaveBeenCalled();
    expect(harness.recorder.stop).toHaveBeenCalledTimes(1);
  });

  test("restores the destination state when its first production handshake fails", async () => {
    const harness = createPostNavigationVoteHarness("neutral", { failHandshake: 1 });

    await expect(
      runPostNavigationVoteScenario(
        harness.driver,
        {
          ...OPTIONS,
          playlistUrl: "https://www.youtube.com/watch?v=watchvideoa&list=playlist",
          watchA: "watchvideoa",
          watchB: "watchvideob",
        },
        () => harness.recorder,
        jest.fn(),
      ),
    ).rejects.toThrow("simulated handshake failure");

    expect(harness.getState()).toBe("neutral");
    expect(harness.recorder.waitForHandshake.mock.calls.map(([value]) => value)).toEqual([-1, 0]);
    expect(harness.recorder.stop).toHaveBeenCalledTimes(1);
  });
});

describe("live watch sidebar stress scenario", () => {
  test.each(["userscript", "extension"])(
    "takes consecutive unvisited related links and soaks one current %s bar after each exact response",
    async (runtime) => {
      const hopVideoIds = ["hopvideo001", "hopvideo002", "hopvideo003"];
      const counts = ["101", "202", "303"];
      const apiCounts = hopVideoIds.map((_videoId, index) => ({
        dislikes: (index + 1) * 1_000,
        likes: (index + 1) * 10_000,
      }));
      let currentVideoId = null;
      let hopIndex = 0;
      const driver = {
        assertCurrentVideo: jest.fn((videoId) => expect(currentVideoId).toBe(videoId)),
        assertRenderedDislikeCount: jest.fn(async (renderedCount, dislikes, requestedRuntime) => ({
          dislikes,
          normalizedCount: renderedCount,
          runtime: requestedRuntime,
        })),
        assertRuntime: jest.fn(),
        assertSignedIn: jest.fn(),
        captureWatchRatioVisual: jest.fn(async (_runtime, screenshotPath) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            count: counts[hopIndex - 1],
            presenceLatencyMs: 1,
            screenshotPath,
          };
        }),
        navigateToRelatedWatch: jest.fn(async (excludedVideoIds) => {
          expect(excludedVideoIds).toEqual(["abcdefghijk", ...hopVideoIds.slice(0, hopIndex)]);
          const videoId = hopVideoIds[hopIndex];
          const body = apiCounts[hopIndex];
          hopIndex += 1;
          currentVideoId = videoId;
          return { body, videoId };
        }),
        openWatch: jest.fn(async (videoId) => {
          currentVideoId = videoId;
        }),
        soakWatchRatioVisual: jest.fn(async (_runtime, settings) => ({
          count: settings.expectedCount,
          durationMs: settings.durationMs,
          sampleCount: 9,
          videoId: settings.videoId,
        })),
        withNoProductionInteractions: jest.fn(async (action) => action()),
      };
      const makeDirectory = jest.fn();
      const options = { ...OPTIONS, runtime, sidebar: { hopCount: 3 }, watchA: "abcdefghijk" };

      const result = await runSidebarStressScenario(driver, options, {
        makeDirectory,
        outputDirectory: "sidebar-evidence",
        readyTimeoutMs: 1,
        soakDurationMs: 25,
      });

      expect(makeDirectory).toHaveBeenCalledWith("sidebar-evidence");
      expect(driver.openWatch).toHaveBeenCalledWith(options.watchA);
      expect(driver.navigateToRelatedWatch).toHaveBeenCalledTimes(3);
      expect(driver.captureWatchRatioVisual.mock.calls).toEqual(
        hopVideoIds.map((videoId, index) => [
          runtime,
          path.join("sidebar-evidence", `${runtime}-sidebar-hop-0${index + 1}.png`),
          { expectedCounts: apiCounts[index], expectedVideoId: videoId, presenceTimeoutMs: 1 },
        ]),
      );
      expect(driver.soakWatchRatioVisual.mock.calls).toEqual(
        hopVideoIds.map((videoId, index) => [
          runtime,
          { durationMs: 25, expectedCount: counts[index], expectedCounts: apiCounts[index], videoId },
        ]),
      );
      expect(driver.assertRenderedDislikeCount.mock.calls).toEqual(
        counts.map((count, index) => [count, (index + 1) * 1_000, runtime]),
      );
      expect(driver.assertRuntime).toHaveBeenCalledTimes(4);
      expect(driver.assertSignedIn).toHaveBeenCalledTimes(4);
      expect(driver.withNoProductionInteractions).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        hopCount: 3,
        hops: hopVideoIds.map((videoId, index) => ({
          apiDislikes: (index + 1) * 1_000,
          apiLikes: (index + 1) * 10_000,
          count: counts[index],
          countAudit: {
            dislikes: (index + 1) * 1_000,
            normalizedCount: counts[index],
            runtime,
          },
          readyLatencyMs: 1,
          readyTimeoutMs: 1,
          screenshotPath: path.join("sidebar-evidence", `${runtime}-sidebar-hop-0${index + 1}.png`),
          soak: {
            count: counts[index],
            durationMs: 25,
            sampleCount: 9,
            videoId,
          },
          videoId,
        })),
        outputDirectory: "sidebar-evidence",
        startVideoId: options.watchA,
      });
    },
  );
});

describe("live Watch action topology scenario", () => {
  test.each(["userscript", "extension"])(
    "uses the same cold-width, resize-roundtrip, and sidebar contract for %s",
    async (runtime) => {
      const originalViewport = { height: 950, width: 1500 };
      let currentViewport = originalViewport;
      let currentVideo = null;
      const layoutsByWidth = new Map([
        [1536, ["share"]],
        [1300, ["share", "save", "thanks"]],
        [820, ["share"]],
      ]);
      const driver = {
        assertRenderedDislikeCount: jest.fn(async () => ({})),
        assertRuntime: jest.fn(),
        assertSignedIn: jest.fn(),
        captureWatchActionTopologyVisual: jest.fn(async (_runtime, screenshotPath, expectations) => {
          const topLevelOptionalSignatures =
            currentVideo === "sidebar001" ? ["share", "save"] : layoutsByWidth.get(currentViewport.width);
          expect(topLevelOptionalSignatures.length).toBeGreaterThanOrEqual(expectations.minimumTopLevelOptionalActions);
          const inventorySignatures =
            currentVideo === "sidebar001" ? ["report", "save", "share"] : ["report", "save", "share", "thanks"];
          if (expectations.expectedInventorySignatures) {
            expect(inventorySignatures).toEqual(expectations.expectedInventorySignatures);
          }
          if (expectations.expectedTopLevelOptionalSignatures) {
            expect(topLevelOptionalSignatures).toEqual(expectations.expectedTopLevelOptionalSignatures);
          }
          return { inventorySignatures, screenshotPath, topLevelOptionalSignatures };
        }),
        navigateToRelatedWatch: jest.fn(async () => {
          currentVideo = "sidebar001";
          return { body: { dislikes: 12, id: currentVideo, likes: 120 }, videoId: currentVideo };
        }),
        openWatch: jest.fn(async (videoId) => {
          currentVideo = videoId;
          return { body: { dislikes: 123, id: videoId, likes: 456 }, videoId };
        }),
        readViewportSize: jest.fn(async () => currentViewport),
        setViewportSize: jest.fn(async (viewport) => {
          currentViewport = viewport;
        }),
        waitForDislikeText: jest.fn(async () => "123"),
        withNoProductionInteractions: jest.fn(async (action) => action()),
      };
      const options = { ...OPTIONS, runtime, watchA: "abcdefghijk" };

      const result = await runWatchActionTopologyScenario(driver, options, {
        makeDirectory: jest.fn(),
        outputDirectory: "topology-evidence",
      });

      expect(driver.openWatch).toHaveBeenCalledTimes(WATCH_ACTION_TOPOLOGY_VIEWPORTS.length + 1);
      expect(driver.captureWatchActionTopologyVisual).toHaveBeenCalledTimes(WATCH_ACTION_TOPOLOGY_VIEWPORTS.length + 3);
      expect(driver.captureWatchActionTopologyVisual.mock.calls[0][2]).toEqual({
        expectedCounts: { dislikes: 123, id: "abcdefghijk", likes: 456 },
        expectedInventorySignatures: null,
        minimumTopLevelOptionalActions: 1,
      });
      expect(driver.captureWatchActionTopologyVisual.mock.calls.at(-2)[2]).toEqual({
        expectedCounts: { dislikes: 123, id: "abcdefghijk", likes: 456 },
        expectedInventorySignatures: ["report", "save", "share", "thanks"],
        expectedTopLevelOptionalSignatures: ["share", "save", "thanks"],
        minimumTopLevelOptionalActions: 3,
      });
      expect(driver.captureWatchActionTopologyVisual.mock.calls.at(-1)[2]).toEqual({
        expectedCounts: { dislikes: 12, id: "sidebar001", likes: 120 },
        minimumTopLevelOptionalActions: 1,
      });
      expect(driver.navigateToRelatedWatch).toHaveBeenCalledWith([options.watchA]);
      expect(driver.assertRenderedDislikeCount).toHaveBeenCalledTimes(WATCH_ACTION_TOPOLOGY_VIEWPORTS.length + 2);
      expect(driver.setViewportSize).toHaveBeenLastCalledWith(originalViewport);
      expect(result.coldLayouts).toHaveLength(WATCH_ACTION_TOPOLOGY_VIEWPORTS.length);
      expect(result.resizeRoundTrip).toMatchObject({
        destinationViewport: { width: 1300 },
        sourceViewport: { width: 1536 },
      });
      expect(result.sidebarVideoId).toBe("sidebar001");
      expect(driver.withNoProductionInteractions).toHaveBeenCalledTimes(1);
    },
  );

  test("rejects viewport coverage that cannot exercise an expanding resize transition", async () => {
    const originalViewport = { height: 900, width: 1500 };
    const driver = {
      assertRenderedDislikeCount: jest.fn(async () => ({})),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureWatchActionTopologyVisual: jest.fn(async () => ({
        inventorySignatures: ["report", "save", "share"],
        topLevelOptionalSignatures: ["share"],
      })),
      openWatch: jest.fn(async (videoId) => ({ body: { dislikes: 123, id: videoId, likes: 456 }, videoId })),
      readViewportSize: jest.fn(async () => originalViewport),
      setViewportSize: jest.fn(),
      waitForDislikeText: jest.fn(async () => "123"),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runWatchActionTopologyScenario(driver, { ...OPTIONS, watchA: "abcdefghijk" }, { makeDirectory: jest.fn() }),
    ).rejects.toThrow(/strict superset of top-level actions/);
    expect(driver.setViewportSize).toHaveBeenLastCalledWith(originalViewport);
  });
});

describe("specific live Shorts cold-load and reload scenario", () => {
  function createShortsDriver(overrides = {}) {
    const videoId = "shortsabcde";
    const navigation = { body: { dislikes: 123, id: videoId }, status: 200, videoId };
    return {
      assertCurrentShortsControl: jest.fn(async () => currentShortsControl(videoId)),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async (_videoId, screenshotPath) => ({ screenshotPath })),
      openShort: jest.fn(async () => navigation),
      reload: jest.fn(async () => navigation),
      soakCurrentShortsControl: jest.fn(async () => ({ sampleCount: 2, videoId })),
      withNoProductionInteractions: jest.fn(async (action) => action()),
      ...overrides,
    };
  }

  test("binds both a fresh direct load and reload to the exact API count, owner, geometry, and soak", async () => {
    const driver = createShortsDriver();
    const options = { ...OPTIONS, short: "shortsabcde" };

    const result = await runShortsRenderScenario(driver, options, {
      makeDirectory: jest.fn(),
      outputDirectory: "specific-short-evidence",
    });

    expect(driver.openShort).toHaveBeenCalledWith(options.short);
    expect(driver.reload).toHaveBeenCalledWith(options.short);
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(2);
    expect(driver.assertCurrentShortsControl).toHaveBeenNthCalledWith(1, options.short, options.runtime, {
      expectedDislikes: 123,
    });
    expect(driver.assertCurrentShortsControl).toHaveBeenNthCalledWith(2, options.short, options.runtime, {
      expectedDislikes: 123,
    });
    expect(driver.captureSyntheticShortsVisual).toHaveBeenCalledTimes(2);
    expect(driver.captureSyntheticShortsVisual.mock.calls.map(([, screenshotPath]) => screenshotPath)).toEqual([
      expect.stringContaining("userscript-cold-direct-load.png"),
      expect.stringContaining("userscript-reload.png"),
    ]);
    expect(driver.soakCurrentShortsControl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      direct: { navigation: { status: 200, videoId: options.short } },
      reloaded: { navigation: { status: 200, videoId: options.short } },
      videoId: options.short,
    });
    expect(driver.withNoProductionInteractions).toHaveBeenCalledTimes(1);
  });

  test("rejects a stale response owner before recording visual evidence", async () => {
    const driver = createShortsDriver({
      openShort: jest.fn(async () => ({
        body: { dislikes: 123, id: "stalevid001" },
        status: 200,
        videoId: "stalevid001",
      })),
    });

    await expect(
      runShortsRenderScenario(driver, { ...OPTIONS, short: "shortsabcde" }, { makeDirectory: jest.fn() }),
    ).rejects.toThrow(/targeted a stale Short/);
    expect(driver.captureSyntheticShortsVisual).not.toHaveBeenCalled();
    expect(driver.reload).not.toHaveBeenCalled();
  });
});

describe("live reaction cycle", () => {
  test.each(["neutral", "liked", "disliked"])(
    "covers all six transitions and restores an initially %s watch video",
    async (initialState) => {
      const harness = createReactionHarness(initialState);
      const beforeFirstAction = jest.fn();

      const result = await runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction,
        videoId: "abcdefghijk",
      });

      expect(harness.driver.openWatch).toHaveBeenCalledWith("abcdefghijk");
      expect(harness.driver.openShort).not.toHaveBeenCalled();
      expect(harness.events.map(({ action }) => action)).toEqual(EXPECTED_ACTIONS[initialState]);
      expect(
        new Set(
          harness.events.map(
            ({ action, state }, index) =>
              `${index ? harness.events[index - 1].state : initialState}:${action}:${state}`,
          ),
        ).size,
      ).toBe(6);
      expect(harness.getState()).toBe(initialState);
      expect(harness.recorder.waitForHandshake).toHaveBeenCalledTimes(6);
      expect(beforeFirstAction).toHaveBeenCalledTimes(1);
      const countSequence = expectedReactionCounts(initialState, { dislikes: 123, likes: 456 });
      expect(harness.driver.assertRenderedDislikeCount.mock.calls).toEqual(
        countSequence.map((counts) => [String(counts.dislikes), counts.dislikes, "userscript"]),
      );
      expect(harness.driver.assertDislikeCountChangesObservable).toHaveBeenCalledWith(
        countSequence
          .slice(1)
          .map((after, index) => ({ after: after.dislikes, before: countSequence[index].dislikes }))
          .filter(({ after, before }) => after !== before),
        "userscript",
      );
      expect(result).toEqual({
        evidencePaths: [],
        finalCounts: { dislikes: 123, likes: 456 },
        initialCounts: { dislikes: 123, likes: 456 },
        initialState,
        userId: "shared-user-id",
      });
    },
  );

  test("targets Shorts through the same transition implementation", async () => {
    const harness = createReactionHarness("neutral");

    await runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
      isShort: true,
      videoId: "shortsabcde",
    });

    expect(harness.driver.openShort).toHaveBeenCalledWith("shortsabcde");
    expect(harness.driver.openWatch).not.toHaveBeenCalled();
  });

  test("restores the initial state when a production handshake fails mid-cycle", async () => {
    const harness = createReactionHarness("neutral", { failHandshake: 3 });

    await expect(
      runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction: jest.fn(),
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow("simulated handshake failure");

    expect(harness.getState()).toBe("neutral");
    expect(harness.events.at(-1)).toEqual({ action: "dislike", state: "neutral" });
    expect(harness.recorder.waitForHandshake).toHaveBeenLastCalledWith(0, 3);
  });

  test.each([
    [
      "click dispatch throws",
      { clickThrowTransition: 1, rollbackOnClickThrow: true },
      "simulated post-dispatch click failure",
    ],
    [
      "post-click state wait fails",
      { rollbackOnStateWaitFailure: true, stateWaitFailTransition: 1 },
      "simulated post-click state-wait failure",
    ],
  ])(
    "forces a verified away-and-back cleanup when %s after the UI returns to its initial state",
    async (_failure, harnessOptions, expectedError) => {
      const harness = createReactionHarness("neutral", harnessOptions);

      await expect(
        runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
          beforeFirstAction: jest.fn(),
          videoId: "abcdefghijk",
        }),
      ).rejects.toThrow(expectedError);

      expect(harness.recorder.voteUserId).toHaveBeenCalledWith(1, 0);
      expect(harness.events.slice(-2)).toEqual([
        { action: "dislike", state: "disliked" },
        { action: "dislike", state: "neutral" },
      ]);
      expect(harness.recorder.waitForHandshake.mock.calls).toEqual([
        [-1, 1],
        [0, 2],
      ]);
      expect(harness.getState()).toBe("neutral");
    },
  );

  test("reports the manual-restore URL when cleanup after a post-dispatch click failure cannot be confirmed", async () => {
    const harness = createReactionHarness("neutral", {
      clickThrowTransition: 1,
      failHandshakes: [1],
      rollbackOnClickThrow: true,
    });

    await expect(
      runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction: jest.fn(),
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow(
      /Automatic cleanup could not be verified\. Manually restore https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk/,
    );
  });

  test.each([
    ["first", "neutral", 1, true],
    ["middle", "liked", 3, false],
    ["final", "disliked", 6, false],
  ])(
    "forces a verified away-and-back cleanup after a %s transition handshake fails with the UI at its initial state",
    async (_position, initialState, failHandshake, rollbackOnHandshakeFailure) => {
      const harness = createReactionHarness(initialState, { failHandshake, rollbackOnHandshakeFailure });

      await expect(
        runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
          beforeFirstAction: jest.fn(),
          videoId: "abcdefghijk",
        }),
      ).rejects.toThrow("simulated handshake failure");

      let failedState = initialState;
      for (const action of EXPECTED_ACTIONS[initialState].slice(0, failHandshake)) {
        failedState = nextState(failedState, action);
      }
      const cleanupAction = initialState === "liked" ? "like" : "dislike";
      const awayState = initialState === "neutral" ? "disliked" : "neutral";
      expect(harness.recorder.voteUserId).toHaveBeenCalledWith(valueForState(failedState), failHandshake - 1);
      expect(harness.events.slice(-2)).toEqual([
        { action: cleanupAction, state: awayState },
        { action: cleanupAction, state: initialState },
      ]);
      expect(harness.recorder.waitForHandshake.mock.calls.slice(-2)).toEqual([
        [valueForState(awayState), failHandshake],
        [valueForState(initialState), failHandshake + 1],
      ]);
      expect(harness.getState()).toBe(initialState);
    },
  );

  test("reports the manual-restore URL when the verified cleanup round trip fails", async () => {
    const harness = createReactionHarness("neutral", {
      failHandshakes: [1, 2],
      rollbackOnHandshakeFailure: true,
    });

    await expect(
      runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction: jest.fn(),
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow(
      /Automatic cleanup could not be verified\. Manually restore https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk/,
    );
  });

  test("reports the manual-restore URL when cleanup cannot match the failed attempt identity", async () => {
    const harness = createReactionHarness("neutral", {
      failHandshake: 1,
      failedVoteUserId: "failed-attempt-user-id",
    });

    await expect(
      runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction: jest.fn(),
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow(/cleanup reaction did not use the failed attempt's RYD identity/);
  });

  test("restores the initial state when a post-action visual assertion fails", async () => {
    const harness = createReactionHarness("neutral");
    const captureReactionVisual = jest.fn(async ({ index, state }) => {
      if (index === 3) throw new Error("simulated visual failure");
      return `watch-${index}-${state}.png`;
    });

    await expect(
      runReactionCycle(harness.driver, harness.recorder, OPTIONS, {
        beforeFirstAction: jest.fn(),
        captureReactionVisual,
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow("simulated visual failure");

    const counts = expectedReactionCounts("neutral", { dislikes: 123, likes: 456 });
    expect(captureReactionVisual.mock.calls.map(([capture]) => capture)).toEqual(
      ["neutral", "liked", "neutral", "disliked"].map((state, index) => ({
        counts: counts[index],
        index,
        state,
      })),
    );
    expect(harness.getState()).toBe("neutral");
    expect(harness.events.at(-1)).toEqual({ action: "dislike", state: "neutral" });
    expect(harness.recorder.waitForHandshake).toHaveBeenLastCalledWith(0, 3);
  });
});

describe("live production reaction matrix visual evidence", () => {
  test.each([
    ["a separate low-count reaction Short", "reactshort1"],
    ["the read-only Short fallback", null],
  ])("captures and returns all six transitions using %s", async (_targetKind, configuredReactionShort) => {
    const reactionShort = configuredReactionShort ?? "shortsabcde";
    const baselineCounts = new Map([
      ["abcdefghijk", { dislikes: 0, likes: 456 }],
      [reactionShort, { dislikes: 13, likes: 900 }],
    ]);
    const states = new Map([
      ["abcdefghijk", "neutral"],
      [reactionShort, "neutral"],
    ]);
    const countsFor = (videoId) => {
      const baseline = baselineCounts.get(videoId);
      const state = states.get(videoId);
      return {
        dislikes: baseline.dislikes + Number(state === "disliked"),
        likes: baseline.likes + Number(state === "liked"),
      };
    };
    let currentVideo;
    const driver = {
      assertDislikeCountChangesObservable: jest.fn(async (changes) => {
        expect(changes.every(({ after, before }) => after !== before)).toBe(true);
      }),
      assertCurrentVideo: jest.fn((videoId) => expect(currentVideo).toBe(videoId)),
      assertRenderedDislikeCount: jest.fn(async (renderedCount, dislikes) => {
        expect(renderedCount).toBe(String(dislikes));
      }),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureReactionStateVisual: jest.fn(async (capture) => {
        expect(states.get(capture.videoId)).toBe(capture.expectedState);
        expect(capture.expectedCounts).toEqual(countsFor(capture.videoId));
        return { screenshotPath: capture.screenshotPath };
      }),
      clickAction: jest.fn(async (videoId, action) => {
        states.set(videoId, nextState(states.get(videoId), action));
      }),
      openShort: jest.fn(async (videoId) => {
        currentVideo = videoId;
        return { body: { ...baselineCounts.get(videoId), id: videoId }, videoId };
      }),
      openWatch: jest.fn(async (videoId) => {
        currentVideo = videoId;
        return { body: { ...baselineCounts.get(videoId), id: videoId }, videoId };
      }),
      readReactionState: jest.fn(async () => states.get(currentVideo)),
      waitForDislikeText: jest.fn(async () => String(countsFor(currentVideo).dislikes)),
      waitForReactionState: jest.fn(async (expected) => expect(states.get(currentVideo)).toBe(expected)),
    };
    const recorders = [];
    const createRecorder = jest.fn((videoId) => {
      const recorder = {
        mark: jest.fn(() => 0),
        stop: jest.fn(),
        waitForHandshake: jest.fn(async (value) => {
          expect(value).toBe(valueForState(states.get(videoId)));
          return "shared-user-id";
        }),
      };
      recorders.push(recorder);
      return recorder;
    });
    const consumeVoteApproval = jest.fn();
    const makeDirectory = jest.fn();
    const options = {
      ...OPTIONS,
      ...(configuredReactionShort ? { reactionShort: configuredReactionShort } : {}),
      short: "shortsabcde",
      watchB: "abcdefghijk",
    };
    const outputDirectory = "reaction-evidence";

    const result = await runProductionReactionMatrixScenario(driver, options, createRecorder, consumeVoteApproval, {
      makeDirectory,
      outputDirectory,
    });

    const stateSequence = ["neutral", "liked", "neutral", "disliked", "liked", "disliked", "neutral"];
    const expectedWatch = stateSequence.map((state, index) =>
      path.join(outputDirectory, `watch-${index}-${state}.png`),
    );
    const expectedShort = stateSequence.map((state, index) =>
      path.join(outputDirectory, `short-${index}-${state}.png`),
    );
    const expectedWatchCounts = expectedReactionCounts("neutral", baselineCounts.get(options.watchB));
    const expectedShortCounts = expectedReactionCounts("neutral", baselineCounts.get(reactionShort));
    expect(makeDirectory).toHaveBeenCalledWith(outputDirectory);
    expect(consumeVoteApproval).toHaveBeenCalledTimes(1);
    expect(driver.captureReactionStateVisual).toHaveBeenCalledTimes(14);
    expect(driver.captureReactionStateVisual.mock.calls.slice(0, 7).map(([capture]) => capture)).toEqual(
      expectedWatch.map((screenshotPath, index) => ({
        expectedCounts: expectedWatchCounts[index],
        expectedState: stateSequence[index],
        isShort: false,
        runtime: "userscript",
        screenshotPath,
        shortsVisualModel: "strict-synthetic",
        videoId: options.watchB,
      })),
    );
    expect(driver.captureReactionStateVisual.mock.calls.slice(7).map(([capture]) => capture)).toEqual(
      expectedShort.map((screenshotPath, index) => ({
        expectedCounts: expectedShortCounts[index],
        expectedState: stateSequence[index],
        isShort: true,
        runtime: "userscript",
        screenshotPath,
        shortsVisualModel: "strict-synthetic",
        videoId: reactionShort,
      })),
    );
    expect(result).toEqual({
      evidencePaths: [...expectedWatch, ...expectedShort],
      outputDirectory,
      short: {
        evidencePaths: expectedShort,
        finalCounts: baselineCounts.get(reactionShort),
        initialCounts: baselineCounts.get(reactionShort),
        initialState: "neutral",
        userId: "shared-user-id",
      },
      watch: {
        evidencePaths: expectedWatch,
        finalCounts: baselineCounts.get(options.watchB),
        initialCounts: baselineCounts.get(options.watchB),
        initialState: "neutral",
        userId: "shared-user-id",
      },
    });
    expect(driver.assertRenderedDislikeCount.mock.calls).toEqual(
      [...expectedWatchCounts, ...expectedShortCounts].map((counts) => [
        String(counts.dislikes),
        counts.dislikes,
        "userscript",
      ]),
    );
    expect(driver.assertDislikeCountChangesObservable).toHaveBeenCalledTimes(2);
    expect(createRecorder.mock.calls.map(([videoId]) => videoId)).toEqual([options.watchB, reactionShort]);
    expect(recorders).toHaveLength(2);
    expect(recorders.every((recorder) => recorder.stop.mock.calls.length === 1)).toBe(true);
  });
});

describe("live responsive visual scenario", () => {
  test("captures watch and userscript Shorts evidence at all responsive widths without actions", async () => {
    const originalViewport = { height: 900, width: 1440 };
    let currentViewport = originalViewport;
    const driver = {
      assertCurrentShortsControl: jest.fn(),
      assertRenderedDislikeCount: jest.fn(async () => ({})),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async (_videoId, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      captureWatchRatioVisual: jest.fn(async (_runtime, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      openShort: jest.fn(async (videoId) => ({ body: { dislikes: 321, id: videoId }, status: 200, videoId })),
      openWatch: jest.fn(async (videoId) => ({ body: { dislikes: 123, id: videoId, likes: 456 }, videoId })),
      readViewportSize: jest.fn(async () => currentViewport),
      setViewportSize: jest.fn(async (viewport) => {
        currentViewport = viewport;
      }),
      waitForDislikeText: jest.fn(async () => "123"),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };
    const makeDirectory = jest.fn();
    const options = { ...OPTIONS, short: "shortsabcde", watchA: "abcdefghijk" };

    const result = await runResponsiveVisualScenario(driver, options, {
      makeDirectory,
      outputDirectory: "responsive-evidence",
    });

    expect(makeDirectory).toHaveBeenCalledWith("responsive-evidence");
    expect(driver.openWatch).toHaveBeenCalledWith(options.watchA);
    expect(driver.openShort).toHaveBeenCalledWith(options.short);
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
    expect(driver.captureWatchRatioVisual).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
    expect(driver.captureSyntheticShortsVisual).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
    expect(driver.captureWatchRatioVisual.mock.calls.map(([, screenshotPath]) => screenshotPath)).toEqual(
      RESPONSIVE_VIEWPORTS.map(({ width }) => expect.stringContaining(`userscript-watch-ratio-${width}.png`)),
    );
    expect(driver.captureWatchRatioVisual.mock.calls.map(([, , settings]) => settings)).toEqual(
      RESPONSIVE_VIEWPORTS.map(() => ({
        expectedCounts: { dislikes: 123, id: options.watchA, likes: 456 },
        expectedVideoId: options.watchA,
      })),
    );
    expect(driver.captureSyntheticShortsVisual.mock.calls.map(([, screenshotPath]) => screenshotPath)).toEqual(
      RESPONSIVE_VIEWPORTS.map(({ width }) => expect.stringContaining(`userscript-shorts-control-${width}.png`)),
    );
    expect(driver.setViewportSize).toHaveBeenLastCalledWith(originalViewport);
    expect(driver.withNoProductionInteractions).toHaveBeenCalledTimes(1);
    expect(driver.waitForDislikeText).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length * 2);
    expect(result.watch).toHaveLength(RESPONSIVE_VIEWPORTS.length);
    expect(result.shorts).toHaveLength(RESPONSIVE_VIEWPORTS.length);
    expect(result.shortsSkipped).toBeNull();
  });

  test("captures synthetic extension Shorts evidence when the adapter declares that capability", async () => {
    const originalViewport = { height: 900, width: 1440 };
    let currentViewport = originalViewport;
    const driver = {
      assertCurrentShortsControl: jest.fn(),
      assertRenderedDislikeCount: jest.fn(async () => ({})),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureSyntheticShortsVisual: jest.fn(async (_videoId, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      captureWatchRatioVisual: jest.fn(async (_runtime, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      openShort: jest.fn(async (videoId) => ({ body: { dislikes: 321, id: videoId }, status: 200, videoId })),
      openWatch: jest.fn(async (videoId) => ({ body: { dislikes: 123, id: videoId, likes: 456 }, videoId })),
      readViewportSize: jest.fn(async () => currentViewport),
      setViewportSize: jest.fn(async (viewport) => {
        currentViewport = viewport;
      }),
      waitForDislikeText: jest.fn(async () => "123"),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    const result = await runResponsiveVisualScenario(
      driver,
      { ...OPTIONS, runtime: "extension", short: "shortsabcde", watchA: "abcdefghijk" },
      { makeDirectory: jest.fn(), outputDirectory: "responsive-evidence" },
    );

    expect(driver.openShort).toHaveBeenCalledWith("shortsabcde");
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
    expect(driver.captureSyntheticShortsVisual).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
    expect(driver.captureSyntheticShortsVisual.mock.calls.map(([, screenshotPath]) => screenshotPath)).toEqual(
      RESPONSIVE_VIEWPORTS.map(({ width }) => expect.stringContaining(`extension-shorts-control-${width}.png`)),
    );
    expect(result.shorts).toHaveLength(RESPONSIVE_VIEWPORTS.length);
    expect(result.shortsSkipped).toBeNull();
    expect(driver.setViewportSize).toHaveBeenLastCalledWith(originalViewport);
  });

  test("captures native Shorts evidence by capability even when the runtime label is userscript", async () => {
    const originalViewport = { height: 900, width: 1440 };
    let currentViewport = originalViewport;
    const driver = {
      assertCurrentShortsControl: jest.fn(),
      assertRenderedDislikeCount: jest.fn(async () => ({})),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureNativeShortsVisual: jest.fn(async (_videoId, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      captureWatchRatioVisual: jest.fn(async (_runtime, screenshotPath) => ({
        screenshotPath,
        viewport: currentViewport,
      })),
      openShort: jest.fn(async (videoId) => ({ body: { dislikes: 321, id: videoId }, status: 200, videoId })),
      openWatch: jest.fn(async (videoId) => ({ body: { dislikes: 123, id: videoId, likes: 456 }, videoId })),
      readViewportSize: jest.fn(async () => currentViewport),
      setViewportSize: jest.fn(async (viewport) => {
        currentViewport = viewport;
      }),
      waitForDislikeText: jest.fn(async () => "123"),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await runResponsiveVisualScenario(
      driver,
      {
        ...OPTIONS,
        capabilities: { shortsVisualModel: "native-pair" },
        short: "shortsabcde",
        watchA: "abcdefghijk",
      },
      { makeDirectory: jest.fn(), outputDirectory: "responsive-evidence" },
    );

    expect(driver.captureNativeShortsVisual).toHaveBeenCalledTimes(RESPONSIVE_VIEWPORTS.length);
  });

  test("fails before navigation when the adapter omits its Shorts visual capability", async () => {
    const driver = { withNoProductionInteractions: jest.fn() };

    await expect(
      runResponsiveVisualScenario(
        driver,
        { ...OPTIONS, capabilities: undefined, short: "shortsabcde", watchA: "abcdefghijk" },
        { makeDirectory: jest.fn(), outputDirectory: "responsive-evidence" },
      ),
    ).rejects.toThrow("Unsupported live Shorts visual model: missing");
    expect(driver.withNoProductionInteractions).not.toHaveBeenCalled();
  });

  test("restores the original viewport when a visual assertion fails", async () => {
    const originalViewport = { height: 800, width: 1200 };
    const driver = {
      assertRenderedDislikeCount: jest.fn(async () => ({})),
      assertRuntime: jest.fn(),
      assertSignedIn: jest.fn(),
      captureWatchRatioVisual: jest.fn(async () => Promise.reject(new Error("visual failed"))),
      openWatch: jest.fn(async (videoId) => ({ body: { dislikes: 123, id: videoId, likes: 456 }, videoId })),
      readViewportSize: jest.fn(async () => originalViewport),
      setViewportSize: jest.fn(),
      waitForDislikeText: jest.fn(async () => "123"),
      withNoProductionInteractions: jest.fn(async (action) => action()),
    };

    await expect(
      runResponsiveVisualScenario(
        driver,
        { ...OPTIONS, short: "shortsabcde", watchA: "abcdefghijk" },
        {
          makeDirectory: jest.fn(),
          outputDirectory: "responsive-evidence",
        },
      ),
    ).rejects.toThrow("visual failed");
    expect(driver.setViewportSize).toHaveBeenLastCalledWith(originalViewport);
  });
});
