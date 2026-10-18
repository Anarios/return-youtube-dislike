const {
  SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
  SHORTS_PLACEHOLDER_POOL_COUNTS,
  SHORTS_PLACEHOLDER_POOL_HOPS,
  SHORTS_NATIVE_LIKE_PAINT_HOP,
  SHORTS_PLACEHOLDER_POOL_SIZE,
  SHORTS_PLACEHOLDER_POOL_VIDEO_IDS,
  assertDuplicateSyntheticNormalization,
  assertEventlessSameVideoReturnSafety,
  assertNativeLikePaintHydrationSafety,
  assertNativeDislikeCleanupSurface,
  assertShortsPlaceholderPoolSurface,
  createShortsPlaceholderPoolFixture,
} = require("./shorts-placeholder-pool-contract");

function validSurface(logicalIndex = 2) {
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  const previousVideoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex - 1];
  const hostBoxes = SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map((_, index) => ({
    bottom: 150 + index * 70,
    height: 70,
    left: 400,
    right: 448,
    top: 80 + index * 70,
    width: 48,
  }));
  const buttonBoxes = hostBoxes.map((host) => ({ ...host, bottom: host.top + 48, height: 48 }));
  return {
    actionBarBox: { bottom: 500, height: 420, left: 400, right: 448, top: 80, width: 48 },
    actionBarDataReady: true,
    actionBarPainted: "true",
    actionBarVisible: true,
    actions: [...SHORTS_PLACEHOLDER_POOL_ACTION_ORDER],
    activeRenderers: 1,
    buttonBoxes,
    buttonEnabled: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
    buttonHitTested: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
    buttonTopHits: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => "button"),
    buttonVisible: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
    dislikeCount: String(SHORTS_PLACEHOLDER_POOL_COUNTS[videoId].dislikes),
    dislikeKind: "synthetic",
    dislikePressed: "false",
    fixture: {
      activeVideoIds: [videoId],
      corruptedVideoIds: [],
      currentIndex: logicalIndex,
      currentVideoId: videoId,
      freshEpochViolations: [],
      phaseObservations: [
        {
          actionBarDataReady: false,
          candidateVideoIds: [previousVideoId, videoId].sort(),
          hydrated: false,
          inViewport: false,
          meaningfulViewport: false,
          phase: "route-current-active-offscreen",
          syntheticCount: 0,
          videoId,
          viewportRatio: 0,
        },
        {
          actionBarDataReady: false,
          candidateVideoIds: [previousVideoId, videoId].sort(),
          hydrated: false,
          inViewport: true,
          meaningfulViewport: false,
          phase: "partial-active-ambiguous",
          syntheticCount: 0,
          videoId,
          viewportRatio: 0.1,
        },
        {
          actionBarDataReady: false,
          candidateVideoIds: [videoId],
          hydrated: false,
          inViewport: true,
          meaningfulViewport: true,
          phase: "visible-active-data-null-after-timeout",
          syntheticCount: 0,
          videoId,
          viewportRatio: 1,
        },
      ],
      prematureSyntheticInsertions: [],
      seededNormalizationStates: [],
      slotCount: SHORTS_PLACEHOLDER_POOL_SIZE,
      transitioning: false,
    },
    hostBoxes,
    hostVisible: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
    pathname: `/shorts/${videoId}`,
    rendererBox: { bottom: 620, height: 620, left: 0, right: 460, top: 0, width: 460 },
    rendererHydrated: "true",
    rendererVideoId: videoId,
    rendererVisible: true,
    staleSyntheticOwners: [],
    nativeDislikes: 0,
    syntheticCount: String(SHORTS_PLACEHOLDER_POOL_COUNTS[videoId].dislikes),
    syntheticElements: 1,
    syntheticOwner: videoId,
    syntheticPressed: "false",
    visibleDocumentActionButtons: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.length,
    visibleDocumentRenderers: 1,
    visibleDocumentSynthetic: 1,
  };
}

function validate(snapshot, logicalIndex = 2) {
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  assertShortsPlaceholderPoolSurface(snapshot, {
    counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
    logicalIndex,
    videoId,
  });
}

function validNativeCleanupSurface() {
  const logicalIndex = 5;
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  const snapshot = validSurface(logicalIndex);
  snapshot.dislikeKind = "native";
  snapshot.nativeDislikes = 1;
  snapshot.syntheticCount = null;
  snapshot.syntheticElements = 0;
  snapshot.syntheticOwner = null;
  snapshot.syntheticPressed = null;
  snapshot.visibleDocumentSynthetic = 0;
  snapshot.fixture.seededNormalizationStates.push({
    nativeDislikes: 1,
    phase: "native-and-multiple-synthetics",
    syntheticCount: 3,
    videoId,
  });
  return { logicalIndex, snapshot, videoId };
}

function validDuplicateNormalizationSurface() {
  const logicalIndex = 3;
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  const snapshot = validSurface(logicalIndex);
  snapshot.fixture.seededNormalizationStates.push({
    nativeDislikes: 0,
    phase: "duplicate-synthetics",
    syntheticCount: 2,
    videoId,
  });
  return { logicalIndex, snapshot, videoId };
}

function validEventlessFixture() {
  const logicalIndex = 7;
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  const fixture = validSurface(logicalIndex).fixture;
  for (const phase of ["eventless-pending-before-route-away", "eventless-same-video-return-fresh-epoch"]) {
    fixture.phaseObservations.push({
      actionBarDataReady: true,
      candidateVideoIds: [videoId],
      hydrated: true,
      inViewport: true,
      meaningfulViewport: true,
      phase,
      syntheticCount: 0,
      videoId,
      viewportRatio: 1,
    });
  }
  return { fixture, logicalIndex, videoId };
}

function validNativeLikePaintObservations() {
  const logicalIndex = SHORTS_NATIVE_LIKE_PAINT_HOP;
  const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
  return {
    logicalIndex,
    observations: [
      {
        actionBarDataReady: true,
        nativeLikePaintedGraphicCount: 0,
        nativeLikeSvgPresent: false,
        phase: "native-like-button-shell-only",
        syntheticCount: 0,
        videoId,
      },
      {
        actionBarDataReady: true,
        nativeLikePaintedGraphicCount: 0,
        nativeLikeSvgPresent: true,
        phase: "native-like-empty-svg",
        syntheticCount: 0,
        videoId,
      },
      {
        actionBarDataReady: true,
        nativeLikePaintedGraphicCount: 1,
        nativeLikeSvgPresent: true,
        phase: "native-like-painted-svg",
        syntheticCount: 0,
        videoId,
      },
    ],
    videoId,
  };
}

describe("shared Shorts placeholder-pool regression contract", () => {
  test("crosses a ten-slot pre-render pool with at least ten Next transitions", () => {
    expect(SHORTS_PLACEHOLDER_POOL_SIZE).toBe(10);
    expect(SHORTS_PLACEHOLDER_POOL_HOPS).toBeGreaterThanOrEqual(10);
    expect(SHORTS_PLACEHOLDER_POOL_VIDEO_IDS).toHaveLength(SHORTS_PLACEHOLDER_POOL_HOPS + 1);
    expect(new Set(SHORTS_PLACEHOLDER_POOL_VIDEO_IDS).size).toBe(SHORTS_PLACEHOLDER_POOL_VIDEO_IDS.length);
    expect(SHORTS_PLACEHOLDER_POOL_VIDEO_IDS.every((videoId) => /^[A-Za-z0-9_-]{11}$/.test(videoId))).toBe(true);
  });

  test("fixture models route-first activation, premature mutation, and physical-slot recycling", () => {
    const fixture = createShortsPlaceholderPoolFixture();
    expect(fixture).toContain('timeline.push({ phase: "navigate-finish-before-activation"');
    expect(fixture).toContain('observePhase("partial-active-ambiguous"');
    expect(fixture).toContain('observePhase("visible-active-data-null-after-timeout"');
    expect(fixture).toContain("actionBar.data = null");
    expect(fixture).toContain("setTimeout(resolve, 520)");
    expect(fixture).toContain("actionBar.innerHTML = nativeActionsMarkup(nextVideoId)");
    expect(fixture).toContain('phase: "native-like-button-shell-only"');
    expect(fixture).toContain('phase: "native-like-empty-svg"');
    expect(fixture).toContain('phase: "native-like-painted-svg"');
    expect(fixture).toContain("seedNativeDislikeAndSyntheticDuplicates");
    expect(fixture).toContain("seedSyntheticDuplicates");
    expect(fixture).toContain("eventlessSameVideoReturn");
    expect(fixture).toContain("futureIndex = nextIndex + config.poolSize - 1");
    expect(fixture).toContain('actionBar.style.opacity = "0"');
  });

  test("holds synthetic insertion through native Like shell-only and empty-SVG hydration", () => {
    const { logicalIndex, observations, videoId } = validNativeLikePaintObservations();
    const snapshot = validSurface(logicalIndex);
    snapshot.fixture.nativeLikePaintObservations = observations;

    expect(() => assertNativeLikePaintHydrationSafety(snapshot.fixture, { logicalIndex, videoId })).not.toThrow();
    expect(() => validate(snapshot, logicalIndex)).not.toThrow();

    observations[1].syntheticCount = 1;
    expect(() => assertNativeLikePaintHydrationSafety(snapshot.fixture, { logicalIndex, videoId })).toThrow(
      /before the exact native Like icon painted/,
    );
  });

  test("fixture inline lifecycle script is syntactically executable", () => {
    const fixture = createShortsPlaceholderPoolFixture();
    const inlineScript = fixture.match(/<script>([\s\S]+)<\/script>/)?.[1];
    expect(inlineScript).toBeTruthy();
    expect(() => new Function(inlineScript)).not.toThrow();
  });

  test("accepts a complete painted and current action stack", () => {
    expect(() => validate(validSurface())).not.toThrow();
  });

  test("accepts cleanup from one native and three synthetic dislikes to one native dislike", () => {
    const { logicalIndex, snapshot, videoId } = validNativeCleanupSurface();
    expect(() => assertNativeDislikeCleanupSurface(snapshot, { logicalIndex, videoId })).not.toThrow();
  });

  test("accepts duplicate synthetic normalization back to one current control", () => {
    const { logicalIndex, snapshot, videoId } = validDuplicateNormalizationSurface();
    expect(() => assertDuplicateSyntheticNormalization(snapshot, { logicalIndex, videoId })).not.toThrow();
  });

  test("accepts an eventless same-video return only after a fresh stability epoch", () => {
    const { fixture, logicalIndex, videoId } = validEventlessFixture();
    expect(() => assertEventlessSameVideoReturnSafety(fixture, { logicalIndex, videoId })).not.toThrow();
    fixture.freshEpochViolations.push({ videoId });
    expect(() => assertEventlessSameVideoReturnSafety(fixture, { logicalIndex, videoId })).toThrow(
      /reused stale pre-route stability evidence/,
    );
  });

  test.each([
    [
      "missing actionBar.data hydration",
      (snapshot) => {
        snapshot.actionBarDataReady = false;
      },
      /actionBar.data is not hydrated/,
    ],
    [
      "missing native action",
      (snapshot) => {
        snapshot.actions.pop();
        snapshot.hostBoxes.pop();
        snapshot.buttonBoxes.pop();
      },
      /retain every native action/,
    ],
    [
      "duplicate synthetic controls after normalization",
      (snapshot) => {
        snapshot.syntheticElements = 2;
      },
      /did not normalize duplicate synthetic controls/,
    ],
    [
      "unpainted action bar despite non-zero descendants",
      (snapshot) => {
        snapshot.actionBarPainted = "false";
      },
      /painted state/,
    ],
    [
      "rectangular but non-hit-testable controls",
      (snapshot) => {
        snapshot.buttonHitTested[3] = false;
      },
      /not topmost\/hit-testable/,
    ],
    [
      "premature placeholder mutation",
      (snapshot) => {
        snapshot.fixture.prematureSyntheticInsertions.push({ videoId: snapshot.rendererVideoId });
      },
      /before the managed action bar reached hydration/,
    ],
    [
      "synthetic control during visible but unstable hydration",
      (snapshot) => {
        snapshot.fixture.phaseObservations[1].syntheticCount = 1;
      },
      /premature control mutation/,
    ],
    [
      "stale synthetic ownership",
      (snapshot) => {
        snapshot.syntheticOwner = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[0];
      },
      /targets a stale video/,
    ],
  ])("fails closed for %s", (_label, corrupt, expectedMessage) => {
    const snapshot = validSurface();
    corrupt(snapshot);
    expect(() => validate(snapshot)).toThrow(expectedMessage);
  });
});
