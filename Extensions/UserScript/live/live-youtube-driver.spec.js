/**
 * @jest-environment jsdom
 */

const {
  AttributedRuntimeTrafficLedger,
  LiveYoutubeDriver,
  VoteTrafficRecorder,
  assertDislikeCountChangesObservable,
  assertExactVotesRequestAudit,
  assertExactVotesResponseAudit,
  assertWorkerRequestAttributionIsUnambiguous,
  assertElementActionable,
  assertElementReadyForViewportMeasurement,
  assertNativeShortsPairGeometry,
  assertReactionPressedStates,
  assertRenderedDislikeCountMatchesApi,
  assertShortsActionStackGeometry,
  assertSyntheticShortsGeometry,
  assertWatchActionTopologySnapshot,
  assertWatchRatioViewportAlignment,
  assertWatchRatioSurroundings,
  assertNavigationLinkActionable,
  attributeRuntimeRequest,
  channelTabUrl,
  clickHitTestedElement,
  clickHitTestedNavigationLink,
  clickStabilizedExactVideoLink,
  clickWithSingleNavigationRetry,
  croppedScreenshotClip,
  firstVisibleRelatedWatchLink,
  formattedDislikeCountCandidates,
  isShortCandidateEligible,
  isShortsIconVisualReady,
  isExactVideoUrl,
  parseLiveExtensionAcceptHeader,
  prepareElementForViewportMeasurement,
  readCurrentShortsNativeControlState,
  readDislikeControlText,
  readElementActionability,
  readNavigationLinkActionability,
  readShortsReelDiagnosticState,
  readShortsRendererIdentityState,
  scrollElementIntoViewAndWaitForPaint,
  readWatchRatioAppearance,
  readWatchRatioSurroundings,
  readWatchTopRowTopology,
  relatedWatchVideoId,
} = require("../e2e/live/live-youtube-driver");

const SELECTED_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const COMPETING_EXTENSION_ID = "pppppppppppppppppppppppppppppppp";
const EXPECTED_BUILD_ID = "0123456789abcdef0123456789abcdef";
const LIVE_ACCEPT_HEADER = `application/json, application/vnd.ryd-live+json; id=${SELECTED_EXTENSION_ID}; build=${EXPECTED_BUILD_ID}`;

const VISIBLE_RECT = {
  bottom: 200,
  height: 100,
  left: 10,
  right: 110,
  top: 100,
  width: 100,
};

const ACTION_HOST_STYLE = {
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  paddingBottom: 8,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
};
const COUNT_STYLE = {
  fontFamily: '"Roboto", "Arial", sans-serif',
  fontSize: 12,
  fontStyle: "normal",
  fontWeight: "400",
  lineHeight: 18,
};

function box(x, y, width, height) {
  return { height, width, x, y };
}

function validSyntheticShortsGeometry() {
  return {
    like: {
      button: box(100, 10, 48, 48),
      count: box(110, 58, 28, 14),
      countStyle: { ...COUNT_STYLE },
      host: box(100, 10, 48, 78),
      hostStyle: { ...ACTION_HOST_STYLE },
      icon: box(112, 22, 24, 24),
      label: box(100, 10, 48, 70),
      svg: box(112, 22, 24, 24),
    },
    nativeActionHosts: [box(100, 10, 48, 78), box(100, 166, 48, 78)],
    next: {
      host: box(100, 166, 48, 78),
    },
    synthetic: {
      button: box(100, 88, 48, 48),
      count: box(109, 136, 30, 14),
      countStyle: { ...COUNT_STYLE },
      host: box(100, 88, 48, 78),
      hostStyle: { ...ACTION_HOST_STYLE },
      icon: box(112, 100, 24, 24),
      label: box(100, 88, 48, 70),
      svg: box(112, 100, 24, 24),
    },
  };
}

function widenShortsControlForLocalizedCount(control, { countWidth = 41, shellWidth = 52 } = {}) {
  const center = control.button.x + control.button.width / 2;
  control.host.x = center - shellWidth / 2;
  control.host.width = shellWidth;
  control.label.x = center - shellWidth / 2;
  control.label.width = shellWidth;
  control.count.x = center - countWidth / 2;
  control.count.width = countWidth;
  return control;
}

function widenShortsButtonAroundCenter(control, width) {
  const center = control.button.x + control.button.width / 2;
  control.button.x = center - width / 2;
  control.button.width = width;
  return control;
}

function validNativeShortsPairGeometry() {
  const syntheticGeometry = validSyntheticShortsGeometry();
  const enrich = (geometry, actionIndex) => ({
    ...geometry,
    actionIndex,
    reelIndex: 2,
    videoMatches: true,
  });
  return {
    dislike: enrich(syntheticGeometry.synthetic, 4),
    like: enrich(syntheticGeometry.like, 3),
  };
}

function renderShort({ canonicalHref, descriptionHref, href, rendererVideoId } = {}) {
  document.body.innerHTML = `
    <ytd-reel-video-renderer${rendererVideoId ? ` video-id="${rendererVideoId}"` : ""}>
      ${href ? `<a href="${href}"></a>` : ""}
      ${canonicalHref ? `<a class="ytp-title-link" href="${canonicalHref}"></a>` : ""}
      ${descriptionHref ? `<div id="description"><a href="${descriptionHref}"></a></div>` : ""}
      <button type="button">Dislike</button>
    </ytd-reel-video-renderer>
  `;
  const reel = document.querySelector("ytd-reel-video-renderer");
  const button = reel.querySelector("button");
  reel.getBoundingClientRect = jest.fn(() => VISIBLE_RECT);
  button.getBoundingClientRect = jest.fn(() => VISIBLE_RECT);
  return { button, reel };
}

const activeShortSettings = (videoId) => ({
  activeShortRequired: true,
  expectedShortVideoId: videoId,
});

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  document.body.innerHTML = "";
});

describe("exact installed live-build identity", () => {
  const buildId = "0123456789abcdef0123456789abcdef";

  function createDriver(markers) {
    const page = {
      locator: jest.fn((selector) => {
        expect(selector).toBe("html");
        return { evaluate: jest.fn(async () => markers) };
      }),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    return new LiveYoutubeDriver(page, {});
  }

  test.each(["userscript", "extension"])("accepts only the exact installed %s live build", async (runtime) => {
    const otherRuntime = runtime === "userscript" ? "extension" : "userscript";
    const markers = {
      extension: null,
      extensionBuild: null,
      userscript: null,
      userscriptBuild: null,
      [runtime]: runtime === "userscript" ? "3.2.0" : "4.0.4",
      [`${runtime}Build`]: buildId,
    };
    const driver = createDriver(markers);

    await expect(driver.assertRuntime(runtime, markers[runtime], buildId)).resolves.toBeUndefined();
    expect(markers[otherRuntime]).toBeNull();
  });

  test("rejects a stale userscript build even when its version matches", async () => {
    const driver = createDriver({
      extension: null,
      extensionBuild: null,
      userscript: "3.2.0",
      userscriptBuild: "f".repeat(32),
    });

    await expect(driver.assertRuntime("userscript", "3.2.0", buildId)).rejects.toThrow(
      "match the freshly generated artifact",
    );
  });

  test.each([
    ["extension", "4.0.4"],
    ["userscript", "3.2.0"],
  ])(
    "rejects an absent %s runtime instead of treating an unmodified YouTube page as a pass",
    async (runtime, version) => {
      const driver = createDriver({
        extension: null,
        extensionBuild: null,
        userscript: null,
        userscriptBuild: null,
      });

      await expect(driver.assertRuntime(runtime, version, buildId)).rejects.toThrow(
        `Expected ${runtime} version ${version} to be active`,
      );
    },
  );

  test.each([undefined, "", "stale", "A".repeat(32)])(
    "refuses to test without a valid exact build ID: %p",
    async (expectedBuildId) => {
      const driver = createDriver({
        extension: null,
        extensionBuild: null,
        userscript: "3.2.0",
        userscriptBuild: buildId,
      });

      await expect(driver.assertRuntime("userscript", "3.2.0", expectedBuildId)).rejects.toThrow(
        "exact 32-character live build ID",
      );
    },
  );

  test("rejects an enabled opposite runtime even when the selected marker is exact", async () => {
    const driver = createDriver({
      extension: "4.0.4",
      extensionBuild: "f".repeat(32),
      userscript: "3.2.0",
      userscriptBuild: buildId,
    });

    await expect(driver.assertRuntime("userscript", "3.2.0", buildId)).rejects.toThrow(
      "Disable the extension before running the userscript smoke",
    );
  });
});

describe("isShortCandidateEligible", () => {
  test("accepts an exact renderer video-id without requiring a Shorts link", () => {
    const { button } = renderShort({ rendererVideoId: "current-video" });

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(true);
  });

  test("accepts an exact Shorts link when the renderer has no video-id", () => {
    const { button } = renderShort({ href: "/shorts/current-video?feature=share" });

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(true);
  });

  test("uses the canonical player link instead of a description cross-link for reel ownership", () => {
    const { button } = renderShort({
      canonicalHref: "/shorts/canonical01",
      descriptionHref: "/shorts/crosslink01",
    });

    expect(isShortCandidateEligible(button, activeShortSettings("canonical01"))).toBe(true);
    expect(isShortCandidateEligible(button, activeShortSettings("crosslink01"))).toBe(false);
    expect(readShortsRendererIdentityState(button, { expectedShortVideoId: "crosslink01" })).toMatchObject({
      candidateVideoIds: ["canonical01"],
      videoMatches: false,
    });
  });

  test("keeps conflicting renderer and canonical identities ineligible", () => {
    const { button } = renderShort({ canonicalHref: "/shorts/canonical01", rendererVideoId: "attribute01" });

    expect(isShortCandidateEligible(button, activeShortSettings("canonical01"))).toBe(false);
    expect(isShortCandidateEligible(button, activeShortSettings("attribute01"))).toBe(false);
    expect(readShortsRendererIdentityState(button, { expectedShortVideoId: "attribute01" })).toMatchObject({
      candidateVideoIds: ["attribute01", "canonical01"],
      videoMatches: false,
    });
  });

  test("rejects a matching descendant link when the renderer video-id identifies another Short", () => {
    const { button } = renderShort({ href: "/shorts/current-video", rendererVideoId: "outgoing-video" });

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(false);
  });

  test.each(["/shorts/current-video-extra", "/shorts/current-video/related", "/shorts/other-video"])(
    "rejects a non-exact Shorts link: %s",
    (href) => {
      const { button } = renderShort({ href });

      expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(false);
    },
  );

  test("rejects an exact video outside the viewport", () => {
    const { button, reel } = renderShort({ rendererVideoId: "current-video" });
    reel.getBoundingClientRect = jest.fn(() => ({ ...VISIBLE_RECT, bottom: -1, top: -101 }));

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(false);
  });

  test("rejects an action button outside the viewport even when its renderer intersects", () => {
    const { button } = renderShort({ rendererVideoId: "current-video" });
    button.getBoundingClientRect = jest.fn(() => ({ ...VISIBLE_RECT, left: 1100, right: 1200 }));

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(false);
  });

  test.each([
    ["zero-opacity", (reel) => (reel.style.opacity = "0")],
    ["aria-hidden", (reel) => reel.setAttribute("aria-hidden", "true")],
  ])("rejects a geometrically visible control inside a %s stale renderer", (_label, hideRenderer) => {
    const { button, reel } = renderShort({ rendererVideoId: "current-video" });
    hideRenderer(reel);

    expect(isShortCandidateEligible(button, activeShortSettings("current-video"))).toBe(false);
  });
});

describe("readCurrentShortsNativeControlState", () => {
  function renderRail({
    nativeControlCount = 0,
    outsideActionCount = 0,
    playerChromeLabels = [],
    rendererVideoId = null,
    synthetic = false,
  } = {}) {
    const nativeControls = Array.from({ length: nativeControlCount }, (_, index) => {
      const host = index === 0 ? "like-button-view-model" : "button-view-model";
      return `<${host}><button type="button" aria-label="Native ${index + 1}"></button></${host}>`;
    }).join("");
    const outsideActions = Array.from({ length: outsideActionCount }, (_, index) => {
      const host = index === 0 ? "like-button-view-model" : "button-view-model";
      return `<${host}><button aria-label="Future ${index + 1}"></button></${host}>`;
    }).join("");
    const playerChrome = playerChromeLabels
      .map((label) => `<button class="ytp-button" aria-label="${label}"></button>`)
      .join("");
    document.body.innerHTML = `
      <ytd-reel-video-renderer${rendererVideoId ? ` video-id="${rendererVideoId}"` : ""}>
        <a id="canonical" class="ytp-title-link" href="/shorts/abcdefghijk"></a>
        <div id="description"><a href="/shorts/unrelated01">related Short</a></div>
        <div class="html5-video-player"><video></video>${playerChrome}</div>
        <reel-action-bar-view-model>
          ${nativeControls}
          ${
            synthetic
              ? '<div data-ryd-synthetic-shorts-dislike><button type="button" aria-label="Dislike"></button></div>'
              : ""
          }
        </reel-action-bar-view-model>
        <future-action-rail>${outsideActions}</future-action-rail>
      </ytd-reel-video-renderer>
    `;
    for (const element of document.querySelectorAll(
      "ytd-reel-video-renderer, reel-action-bar-view-model, video, button",
    )) {
      element.getBoundingClientRect = jest.fn(() => VISIBLE_RECT);
    }
  }

  const readState = () =>
    readCurrentShortsNativeControlState({
      actionBarSelector: "reel-action-bar-view-model, .slim-video-action-bar-actions",
      syntheticSelector: "[data-ryd-synthetic-shorts-dislike]",
      videoId: "abcdefghijk",
    });

  test("classifies a current renderer with no YouTube actions as fully blank", () => {
    renderRail({ playerChromeLabels: ["Pause", "Mute", "More"] });

    expect(readState()).toMatchObject({
      completeIndependentActionBars: 0,
      completeNativeActionBars: 0,
      independentActionLabels: [],
      matchingCompleteIndependentActionBars: 0,
      matchingCompleteNativeActionBars: 0,
      matchingRenderedReels: 1,
      matchingVisibleIndependentActions: 0,
      matchingVisibleNativeControls: 0,
      renderedReels: 1,
      visibleIndependentActions: 0,
      visibleNativeControls: 0,
    });
  });

  test("counts native actions but excludes the runtime's synthetic Dislike", () => {
    renderRail({ nativeControlCount: 5, synthetic: true });

    expect(readState()).toMatchObject({
      completeNativeActionBars: 1,
      labels: ["Native 1", "Native 2", "Native 3", "Native 4", "Native 5"],
      matchingCompleteNativeActionBars: 1,
      matchingRenderedReels: 1,
      matchingVisibleNativeControls: 5,
      visibleNativeControls: 5,
    });
  });

  test("classifies visible action buttons individually when their action-bar host has no rendered box", () => {
    renderRail({ nativeControlCount: 4 });
    document.querySelector("reel-action-bar-view-model").getBoundingClientRect = jest.fn(() => box(100, 100, 0, 0));

    expect(readState()).toMatchObject({
      completeNativeActionBars: 1,
      matchingCompleteNativeActionBars: 1,
      matchingVisibleNativeControls: 4,
      visibleNativeControls: 4,
    });
  });

  test("does not call a page blank when another visible reel has meaningful native controls", () => {
    renderRail({ nativeControlCount: 3, rendererVideoId: "different01" });

    expect(readState()).toMatchObject({
      matchingRenderedReels: 0,
      matchingVisibleNativeControls: 0,
      visibleNativeControls: 3,
    });
  });

  test("uses the canonical player identity instead of a description cross-link", () => {
    renderRail({ nativeControlCount: 3 });

    const state = readCurrentShortsNativeControlState({
      actionBarSelector: "reel-action-bar-view-model, .slim-video-action-bar-actions",
      syntheticSelector: "[data-ryd-synthetic-shorts-dislike]",
      videoId: "unrelated01",
    });
    expect(state).toMatchObject({
      matchingRenderedReels: 0,
      matchingVisibleNativeControls: 0,
      rendererIdentities: [["abcdefghijk"]],
      visibleNativeControls: 3,
    });
  });

  test("returns the visible video box only from the exact current reel and ignores retained or detached videos", () => {
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="outgoing01"><video id="retained"></video></ytd-reel-video-renderer>
      <ytd-reel-video-renderer video-id="abcdefghijk"><video id="current"></video></ytd-reel-video-renderer>`;
    const detached = document.createElement("video");
    document.body.append(detached);
    detached.remove();
    document.querySelectorAll("ytd-reel-video-renderer").forEach((reel) => {
      reel.getBoundingClientRect = jest.fn(() => ({
        bottom: 700,
        height: 620,
        left: 0,
        right: 1024,
        top: 80,
        width: 1024,
        x: 0,
        y: 80,
      }));
    });
    document.querySelector("#retained").getBoundingClientRect = jest.fn(() => ({
      bottom: 768,
      height: 768,
      left: 0,
      right: 1024,
      top: 0,
      width: 1024,
      x: 0,
      y: 0,
    }));
    document.querySelector("#current").getBoundingClientRect = jest.fn(() => ({
      bottom: 640,
      height: 560,
      left: 300,
      right: 700,
      top: 80,
      width: 400,
      x: 300,
      y: 80,
    }));

    expect(readState()).toMatchObject({
      currentVideoBox: { height: 560, width: 400, x: 300, y: 80 },
      matchingRenderedReels: 1,
      viewport: { height: window.innerHeight, width: window.innerWidth },
    });
  });

  test("detects visible controls outside known action-bar selectors through the independent fallback", () => {
    renderRail({ outsideActionCount: 2 });

    expect(readState()).toMatchObject({
      independentActionLabels: ["Future 1", "Future 2"],
      matchingVisibleIndependentActions: 2,
      matchingVisibleNativeControls: 0,
      visibleIndependentActions: 2,
      visibleNativeControls: 0,
    });
  });

  test("recognizes a complete structural fallback rail after the known selector changes", () => {
    renderRail({ outsideActionCount: 4 });

    expect(readState()).toMatchObject({
      completeIndependentActionBars: 1,
      matchingCompleteIndependentActionBars: 1,
      matchingVisibleIndependentActions: 4,
      visibleIndependentActions: 4,
    });
  });

  test("captures selector-independent action details for blank-sample diagnostics", () => {
    renderRail({ outsideActionCount: 1 });
    const diagnostic = readShortsReelDiagnosticState(document.querySelector("ytd-reel-video-renderer"), {
      actionBarSelector: "reel-action-bar-view-model, .slim-video-action-bar-actions",
      syntheticSelector: "[data-ryd-synthetic-shorts-dislike]",
    });

    expect(diagnostic).toMatchObject({
      actionBars: [expect.objectContaining({ tagName: "reel-action-bar-view-model" })],
      renderedInViewport: true,
      totalInteractiveCount: 1,
      visibleActions: [
        expect.objectContaining({
          ariaLabel: "Future 1",
          renderedInViewport: true,
          synthetic: false,
          tagName: "button",
        }),
      ],
    });
  });
});

describe("Shorts native-control wait classification", () => {
  function nativeRailMeasurement({ currentVideoBox = null, visible = false } = {}) {
    return {
      completeIndependentActionBars: 0,
      completeNativeActionBars: visible ? 1 : 0,
      currentVideoBox,
      currentVideoId: "abcdefghijk",
      independentActionLabels: [],
      labels: visible ? ["Like", "Comments", "Share", "Remix"] : [],
      matchingCompleteIndependentActionBars: 0,
      matchingCompleteNativeActionBars: visible ? 1 : 0,
      matchingRenderedReels: 1,
      matchingVisibleIndependentActions: 0,
      matchingVisibleNativeControls: visible ? 4 : 0,
      renderedReels: 1,
      viewport: { height: 768, width: 1024 },
      visibleIndependentActions: 0,
      visibleNativeControls: visible ? 4 : 0,
    };
  }

  test("treats a reel with only Pause, Mute, and player More controls as a blank sample", async () => {
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="abcdefghijk">
        <div class="html5-video-player">
          <button class="ytp-button" aria-label="Pause"></button>
          <button class="ytp-button" aria-label="Mute"></button>
          <button class="ytp-button" aria-label="More"></button>
        </div>
        <reel-action-bar-view-model></reel-action-bar-view-model>
      </ytd-reel-video-renderer>`;
    for (const element of document.querySelectorAll("ytd-reel-video-renderer, reel-action-bar-view-model, button")) {
      element.getBoundingClientRect = jest.fn(() => VISIBLE_RECT);
    }
    const page = {
      evaluate: jest.fn(async (reader, settings) => reader(settings)),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 0 }),
    ).resolves.toMatchObject({
      independentActionLabels: [],
      reason: "no-visible-native-shorts-actions",
      status: "blank",
      visibleIndependentActions: 0,
      visibleNativeControls: 0,
    });
  });

  test.each([
    [
      "blank",
      { matchingVisibleNativeControls: 0, visibleNativeControls: 0 },
      "blank",
      "no-visible-native-shorts-actions",
    ],
    [
      "unowned native controls",
      { matchingVisibleNativeControls: 0, visibleNativeControls: 3 },
      "present",
      "visible-native-shorts-actions-not-owned-by-current-video",
    ],
  ])("classifies %s after the bounded observation window", async (_label, measurement, status, reason) => {
    const page = {
      evaluate: jest.fn(async () => ({
        completeIndependentActionBars: 0,
        completeNativeActionBars: 0,
        currentVideoId: "abcdefghijk",
        independentActionLabels: [],
        labels: [],
        matchingCompleteIndependentActionBars: 0,
        matchingCompleteNativeActionBars: 0,
        matchingVisibleIndependentActions: 0,
        matchingRenderedReels: 0,
        renderedReels: 1,
        visibleIndependentActions: 0,
        ...measurement,
      })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 0 }),
    ).resolves.toMatchObject({ reason, status, ...measurement });
    expect(reportProgress).toHaveBeenCalledWith(
      status === "blank" ? "shorts-native-controls.blank" : "shorts-native-controls.present-unowned",
      expect.objectContaining({ reason, status }),
    );
  });

  test("returns immediately when a complete current-video native action bar appears", async () => {
    const page = {
      evaluate: jest.fn(async () => ({
        completeIndependentActionBars: 0,
        completeNativeActionBars: 1,
        currentVideoId: "abcdefghijk",
        independentActionLabels: [],
        labels: ["Like", "Comments", "Share", "Remix"],
        matchingCompleteIndependentActionBars: 0,
        matchingCompleteNativeActionBars: 1,
        matchingVisibleIndependentActions: 0,
        matchingRenderedReels: 1,
        matchingVisibleNativeControls: 4,
        renderedReels: 1,
        visibleIndependentActions: 0,
        visibleNativeControls: 4,
      })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { timeoutMs: 20_000 }),
    ).resolves.toMatchObject({
      matchingCompleteNativeActionBars: 1,
      matchingVisibleNativeControls: 4,
      status: "present",
    });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test("reports any meaningful current native action immediately so a missing runtime control cannot be skipped", async () => {
    const partial = {
      completeIndependentActionBars: 0,
      completeNativeActionBars: 0,
      currentVideoId: "abcdefghijk",
      independentActionLabels: [],
      labels: ["Like", "Comments"],
      matchingCompleteIndependentActionBars: 0,
      matchingCompleteNativeActionBars: 0,
      matchingRenderedReels: 1,
      matchingVisibleIndependentActions: 0,
      matchingVisibleNativeControls: 2,
      renderedReels: 1,
      visibleIndependentActions: 0,
      visibleNativeControls: 2,
    };
    const page = {
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(partial)
        .mockResolvedValueOnce({
          ...partial,
          completeNativeActionBars: 1,
          labels: ["Like", "Comments", "Share", "Remix"],
          matchingCompleteNativeActionBars: 1,
          matchingVisibleNativeControls: 4,
          visibleNativeControls: 4,
        }),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 100 }),
    ).resolves.toMatchObject({
      matchingCompleteNativeActionBars: 0,
      matchingVisibleNativeControls: 2,
      status: "present",
    });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test("does not classify a partial visible current action bar as blank at the observation boundary", async () => {
    const measurement = {
      completeIndependentActionBars: 0,
      completeNativeActionBars: 0,
      currentVideoId: "abcdefghijk",
      independentActionLabels: [],
      labels: ["Like", "Comments"],
      matchingCompleteIndependentActionBars: 0,
      matchingCompleteNativeActionBars: 0,
      matchingRenderedReels: 1,
      matchingVisibleIndependentActions: 0,
      matchingVisibleNativeControls: 2,
      renderedReels: 1,
      visibleIndependentActions: 0,
      visibleNativeControls: 2,
    };
    const page = {
      evaluate: jest.fn(async () => measurement),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 0 }),
    ).resolves.toMatchObject({
      matchingCompleteNativeActionBars: 0,
      matchingVisibleNativeControls: 2,
      status: "present",
    });
    expect(reportProgress).toHaveBeenCalledWith(
      "shorts-native-controls.present",
      expect.objectContaining({ matchingVisibleNativeControls: 2, status: "present" }),
    );
  });

  test("uses real pointer movement over the current video to reveal an idle native action rail", async () => {
    let nativeRailRevealed = false;
    const page = {
      evaluate: jest.fn(async (reader) => {
        expect(reader).toBe(readCurrentShortsNativeControlState);
        return nativeRailMeasurement({
          currentVideoBox: box(300, 80, 400, 560),
          visible: nativeRailRevealed,
        });
      }),
      locator: jest.fn(() => {
        throw new Error("The native-control wait must not scan retained video locators.");
      }),
      mouse: {
        move: jest.fn(async () => {
          nativeRailRevealed = true;
        }),
      },
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 50 }),
    ).resolves.toMatchObject({
      lastNativeUiWakePoint: { x: 499, y: 360 },
      matchingVisibleNativeControls: 4,
      nativeUiWakeAttempts: 1,
      status: "present",
    });
    expect(page.mouse.move).toHaveBeenCalledWith(499, 360);
    expect(page.locator).not.toHaveBeenCalled();
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });

  test("does not depend on animation-frame delivery when pointer movement reveals the rail", async () => {
    let nativeRailRevealed = false;
    const page = {
      evaluate: jest.fn(async (reader) => {
        expect(reader).toBe(readCurrentShortsNativeControlState);
        return nativeRailMeasurement({
          currentVideoBox: box(500, 80, 400, 560),
          visible: nativeRailRevealed,
        });
      }),
      mouse: {
        move: jest.fn(async () => {
          nativeRailRevealed = true;
        }),
      },
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 50 }),
    ).resolves.toMatchObject({ status: "present" });

    expect(page.mouse.move).toHaveBeenCalledWith(699, 360);
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });

  test("timeout zero performs exactly one measurement without a pointer pulse or delay", async () => {
    const page = {
      evaluate: jest.fn(async () => nativeRailMeasurement({ currentVideoBox: box(400, 80, 400, 560) })),
      mouse: { move: jest.fn(async () => undefined) },
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { intervalMs: 1, timeoutMs: 0 }),
    ).resolves.toMatchObject({ nativeUiWakeAttempts: 0, status: "blank" });

    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(page.mouse.move).not.toHaveBeenCalled();
  });

  test("confirms a truly blank rail within the bounded observation and operation-watchdog window", async () => {
    const page = {
      evaluate: jest.fn(async () => nativeRailMeasurement()),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});
    const startedAt = Date.now();

    const result = await driver.waitForCurrentShortsNativeControls("abcdefghijk", {
      intervalMs: 5,
      operationTimeoutMs: 100,
      timeoutMs: 25,
    });

    expect(result).toMatchObject({
      nativeUiWakeAttempts: 0,
      reason: "no-visible-native-shorts-actions",
      status: "blank",
    });
    expect(result.observedForMs).toBeGreaterThanOrEqual(25);
    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(page.evaluate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("accepts controls discovered by the final measurement at the observation boundary", async () => {
    const page = {
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(nativeRailMeasurement())
        .mockResolvedValueOnce(nativeRailMeasurement({ visible: true })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", {
        intervalMs: 20,
        operationTimeoutMs: 100,
        timeoutMs: 20,
      }),
    ).resolves.toMatchObject({ matchingVisibleNativeControls: 4, status: "present" });
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });

  test("fails instead of recording blank evidence when the synchronous browser probe stalls", async () => {
    const page = {
      evaluate: jest.fn(() => new Promise(() => {})),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", {
        intervalMs: 1,
        operationTimeoutMs: 10,
        timeoutMs: 25,
      }),
    ).rejects.toThrow(
      "Timed out probing Shorts native controls for abcdefghijk; the 25ms observation window is invalid.",
    );
  });

  test("fails instead of overrunning the observation deadline when a pointer pulse stalls", async () => {
    const page = {
      evaluate: jest.fn(async () => nativeRailMeasurement({ currentVideoBox: box(300, 80, 400, 560) })),
      mouse: { move: jest.fn(() => new Promise(() => {})) },
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", {
        intervalMs: 1,
        operationTimeoutMs: 10,
        timeoutMs: 25,
      }),
    ).rejects.toThrow(
      "Timed out probing Shorts native controls for abcdefghijk; the 25ms observation window is invalid.",
    );
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test("returns present when a complete structural fallback rail replaces the known action-bar selector", async () => {
    const page = {
      evaluate: jest.fn(async () => ({
        completeIndependentActionBars: 1,
        completeNativeActionBars: 0,
        currentVideoId: "abcdefghijk",
        independentActionLabels: ["Like", "Comments", "Share", "Remix"],
        labels: [],
        matchingCompleteIndependentActionBars: 1,
        matchingCompleteNativeActionBars: 0,
        matchingRenderedReels: 1,
        matchingVisibleIndependentActions: 4,
        matchingVisibleNativeControls: 0,
        renderedReels: 1,
        visibleIndependentActions: 4,
        visibleNativeControls: 0,
      })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.waitForCurrentShortsNativeControls("abcdefghijk", { timeoutMs: 20_000 }),
    ).resolves.toMatchObject({
      matchingCompleteIndependentActionBars: 1,
      matchingVisibleIndependentActions: 4,
      status: "present",
    });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });
});

describe("blank Shorts diagnostic evidence", () => {
  test("captures a viewport screenshot and a structured identity/action inventory", async () => {
    const identity = {
      candidateVideoIds: ["abcdefghijk"],
      elementRenderedInViewport: true,
      hasReel: true,
      reelRenderedInViewport: true,
      videoMatches: true,
    };
    const dom = {
      actionBars: [],
      renderedInViewport: true,
      totalInteractiveCount: 0,
      visibleActions: [],
    };
    const reel = {
      evaluate: jest.fn(async (reader) => (reader === readShortsRendererIdentityState ? identity : dom)),
    };
    const page = {
      evaluate: jest.fn(async () => undefined),
      locator: jest.fn(() => ({ count: jest.fn(async () => 1), nth: jest.fn(() => reel) })),
      screenshot: jest.fn(async () => undefined),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });
    driver.readViewportSize = jest.fn(async () => ({ height: 768, width: 1024 }));
    driver.waitForCurrentShortsNativeControls = jest.fn(async () => ({
      currentVideoId: "abcdefghijk",
      observedForMs: 0,
      reason: "no-visible-native-shorts-actions",
      status: "blank",
      visibleNativeControls: 0,
    }));

    const evidence = await driver.captureBlankShortsDiagnostics("abcdefghijk", "blank.png");

    expect(evidence).toMatchObject({
      currentUrl: "https://www.youtube.com/shorts/abcdefghijk",
      expectedVideoId: "abcdefghijk",
      nativeControlsAfterEvidence: expect.objectContaining({ status: "blank" }),
      reels: [{ dom, identity, index: 0 }],
      screenshotPath: "blank.png",
      viewport: { height: 768, width: 1024 },
    });
    expect(evidence.capturedAt).toEqual(expect.any(String));
    expect(page.screenshot).toHaveBeenCalledWith({
      animations: "disabled",
      caret: "hide",
      path: "blank.png",
      timeout: expect.any(Number),
    });
    const screenshotTimeout = page.screenshot.mock.calls[0][0].timeout;
    expect(screenshotTimeout).toBeGreaterThan(0);
    expect(screenshotTimeout).toBeLessThanOrEqual(2_000);
    expect(reportProgress).toHaveBeenCalledWith("shorts-blank-evidence.captured", {
      renderedReels: 1,
      screenshotPath: "blank.png",
      statusAfterEvidence: "blank",
      videoId: "abcdefghijk",
      visibleActions: 0,
    });
  });

  test("fails quickly when a blank-evidence screenshot stalls", async () => {
    const identity = {
      candidateVideoIds: ["abcdefghijk"],
      elementRenderedInViewport: true,
      hasReel: true,
      reelRenderedInViewport: true,
      videoMatches: true,
    };
    const dom = {
      actionBars: [],
      renderedInViewport: true,
      totalInteractiveCount: 0,
      visibleActions: [],
    };
    const reel = {
      evaluate: jest.fn(async (reader) => (reader === readShortsRendererIdentityState ? identity : dom)),
    };
    const page = {
      evaluate: jest.fn(async () => undefined),
      locator: jest.fn(() => ({ count: jest.fn(async () => 1), nth: jest.fn(() => reel) })),
      screenshot: jest.fn(() => new Promise(() => {})),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(
      driver.captureBlankShortsDiagnostics("abcdefghijk", "blank.png", { operationTimeoutMs: 10 }),
    ).rejects.toThrow("Timed out capturing screenshot evidence for blank Short abcdefghijk");
    expect(page.screenshot).toHaveBeenCalledTimes(1);
  });

  test("bounds the complete blank-evidence inventory when many renderer probes are individually slow", async () => {
    const delayedResult = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 20));
    const identity = {
      candidateVideoIds: ["abcdefghijk"],
      elementRenderedInViewport: true,
      hasReel: true,
      reelRenderedInViewport: true,
      videoMatches: true,
    };
    const dom = {
      actionBars: [],
      renderedInViewport: true,
      totalInteractiveCount: 0,
      visibleActions: [],
    };
    const reel = {
      evaluate: jest.fn((reader) => delayedResult(reader === readShortsRendererIdentityState ? identity : dom)),
    };
    const page = {
      evaluate: jest.fn(async () => undefined),
      locator: jest.fn(() => ({ count: jest.fn(async () => 20), nth: jest.fn(() => reel) })),
      screenshot: jest.fn(async () => undefined),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const driver = new LiveYoutubeDriver(page, {});
    const startedAt = Date.now();

    await expect(
      driver.captureBlankShortsDiagnostics("abcdefghijk", "blank.png", {
        evidenceTimeoutMs: 30,
        operationTimeoutMs: 100,
      }),
    ).rejects.toThrow("Timed out capturing blank Shorts diagnostics for abcdefghijk within 30ms");
    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(reel.evaluate.mock.calls.length).toBeLessThan(40);
    expect(page.screenshot).not.toHaveBeenCalled();
  });
});

describe("current live reaction target selection", () => {
  function actionCandidate({ eligible = true, enabled = true, visible = true } = {}) {
    return {
      click: jest.fn(async () => {}),
      evaluate: jest.fn(async (callback) =>
        callback === readElementActionability
          ? {
              centerHitTarget: true,
              centerInViewport: true,
              connected: true,
              enabled,
              visible,
            }
          : {
              candidateVideoIds: eligible ? ["abcdefghijk"] : ["stalevid001"],
              elementRenderedInViewport: eligible,
              hasReel: true,
              reelRenderedInViewport: eligible,
              videoMatches: eligible,
            },
      ),
      isEnabled: jest.fn(async () => enabled),
      isVisible: jest.fn(async () => visible),
    };
  }

  test("scrolls a visible below-fold control in the exact destination Watch root before clicking it", async () => {
    const hiddenDuplicate = actionCandidate({ visible: false });
    const disabledDuplicate = actionCandidate({ enabled: false });
    // `eligible: false` models the viewport/Shorts-identity probe returning
    // false before a scroll. Watch controls must not be rejected by that probe:
    // a short browser window commonly places the whole action row below fold.
    const belowFoldCurrent = actionCandidate({ eligible: false });
    const current = actionCandidate();
    const candidates = [hiddenDuplicate, disabledDuplicate, belowFoldCurrent, current];
    const candidateLocator = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const watchRoot = { locator: jest.fn(() => candidateLocator) };
    const page = {
      locator: jest.fn(() => watchRoot),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});

    await driver.clickDislike("abcdefghijk");

    expect(page.locator).toHaveBeenCalledWith(
      'ytd-watch-flexy[video-id="abcdefghijk"], ytd-watch-grid[video-id="abcdefghijk"]',
    );
    const actionSelector = watchRoot.locator.mock.calls[0][0];
    expect(actionSelector.split(", ").every((selector) => selector.endsWith(":visible"))).toBe(true);
    expect(hiddenDuplicate.click).not.toHaveBeenCalled();
    expect(disabledDuplicate.click).not.toHaveBeenCalled();
    expect(belowFoldCurrent.evaluate).toHaveBeenCalledWith(scrollElementIntoViewAndWaitForPaint, undefined, {
      timeout: 20_000,
    });
    expect(belowFoldCurrent.evaluate).toHaveBeenCalledWith(
      readElementActionability,
      { includeHref: false, scroll: false },
      { timeout: 20_000 },
    );
    expect(belowFoldCurrent.click).toHaveBeenCalledWith({ force: true, timeout: 5_000 });
    expect(current.click).not.toHaveBeenCalled();
  });

  test("rejects a visible wrong-video Shorts duplicate before clicking the exact current reel", async () => {
    const wrongVideoDuplicate = actionCandidate({ eligible: false });
    const current = actionCandidate();
    const candidates = [wrongVideoDuplicate, current];
    const candidateLocator = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const page = {
      locator: jest.fn(() => candidateLocator),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});

    await driver.clickDislike("abcdefghijk");

    const actionSelector = page.locator.mock.calls[0][0];
    expect(actionSelector.split(", ").every((selector) => selector.endsWith(":visible"))).toBe(true);
    expect(wrongVideoDuplicate.evaluate).toHaveBeenCalledWith(readShortsRendererIdentityState, {
      expectedShortVideoId: "abcdefghijk",
    });
    expect(wrongVideoDuplicate.click).not.toHaveBeenCalled();
    expect(current.click).toHaveBeenCalledWith({ force: true, timeout: 5_000 });
  });
});

describe("readDislikeControlText", () => {
  test("reads a synthetic control count from the sibling of its inner button", () => {
    document.body.innerHTML = `
      <div data-ryd-synthetic-shorts-dislike>
        <div>
          <button type="button" aria-pressed="false"><svg></svg></button>
          <div><span id="text" role="text">1.2K</span></div>
        </div>
      </div>
    `;

    expect(readDislikeControlText(document.querySelector("button"))).toBe("1.2K");
  });

  test("continues to read native dislike text from the button", () => {
    document.body.innerHTML = `<button type="button"><span role="text">456</span></button>`;

    expect(readDislikeControlText(document.querySelector("button"))).toBe("456");
  });
});

describe("Shorts dislike-count response binding", () => {
  test.each(["extension", "userscript"])("accepts every supported %s display format for the API value", (runtime) => {
    const candidates = formattedDislikeCountCandidates(1_234, "en", runtime);

    expect(candidates).toEqual(expect.arrayContaining(["1.2K", "1.2 thousand", "1,234"]));
    candidates.forEach((renderedCount) => {
      expect(assertRenderedDislikeCountMatchesApi(renderedCount, 1_234, "en", runtime)).toMatchObject({
        normalizedCount: renderedCount,
      });
    });
  });

  test("normalizes localized spacing without accepting an unrelated stale number", () => {
    const [compact] = formattedDislikeCountCandidates(12_345, "fr", "extension");

    expect(() =>
      assertRenderedDislikeCountMatchesApi(compact.replace(/ /g, "\u00a0"), 12_345, "fr", "extension"),
    ).not.toThrow();
    expect(() => assertRenderedDislikeCountMatchesApi("999", 12_345, "fr", "extension")).toThrow(
      /does not represent API count 12345/,
    );
  });

  test.each(["extension", "userscript"])(
    "requires +/-1 reaction targets whose formatted %s counts cannot remain stale",
    (runtime) => {
      expect(
        assertDislikeCountChangesObservable(
          [
            { after: 14, before: 13 },
            { after: 13, before: 14 },
          ],
          "en",
          runtime,
        ),
      ).toHaveLength(2);
      expect(() => assertDislikeCountChangesObservable([{ after: 14_141, before: 14_140 }], "en", runtime)).toThrow(
        /not observable.*Choose a low-count reaction target/,
      );
    },
  );
});

describe("Shorts /votes request audit", () => {
  const exactRequest = {
    method: "GET",
    url: "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    videoId: "abcdefghijk",
  };

  test("accepts exactly one request for the destination Short", () => {
    expect(assertExactVotesRequestAudit([exactRequest], "abcdefghijk")).toBe(exactRequest);
  });

  test("rejects a stale request even when an exact destination request also exists", () => {
    expect(() =>
      assertExactVotesRequestAudit([{ ...exactRequest, videoId: "stalevid001" }, exactRequest], "abcdefghijk"),
    ).toThrow(/emitted a stale \/votes request/);
  });

  test("rejects duplicate exact destination requests", () => {
    expect(() => assertExactVotesRequestAudit([exactRequest, { ...exactRequest }], "abcdefghijk")).toThrow(
      /must emit exactly one \/votes request.*observed 2/,
    );
  });

  describe("exact navigation response oracle", () => {
    const exactResponse = {
      ...exactRequest,
      requestId: 8,
      responseBody: { dislikes: 123, id: "abcdefghijk", likes: 456 },
      responseStatus: 200,
      source: "page",
    };

    test("accepts one new successful attributed request with the exact response video", () => {
      expect(assertExactVotesResponseAudit([exactResponse], "abcdefghijk", 7)).toBe(exactResponse);
    });

    test("accepts exactly one ordered extension Like-count refinement and returns its response as authoritative", () => {
      const refinedResponse = {
        ...exactResponse,
        requestId: 9,
        responseBody: { ...exactResponse.responseBody, dislikes: 125 },
        url: "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&likeCount=48525",
      };

      expect(
        assertExactVotesResponseAudit([exactResponse, refinedResponse], "abcdefghijk", 7, {
          allowLikeCountRefinement: true,
        }),
      ).toBe(refinedResponse);
    });

    test.each([
      [
        "two aggregate requests",
        [exactResponse, { ...exactResponse, requestId: 9 }],
        /second \/votes request.*single Like-count refinement/,
      ],
      [
        "two enriched requests",
        [
          { ...exactResponse, url: `${exactResponse.url}&likeCount=1` },
          { ...exactResponse, requestId: 9, url: `${exactResponse.url}&likeCount=2` },
        ],
        /first \/votes request.*aggregate request before refinement/,
      ],
      [
        "more than one refinement",
        [
          exactResponse,
          { ...exactResponse, requestId: 9, url: `${exactResponse.url}&likeCount=1` },
          { ...exactResponse, requestId: 10, url: `${exactResponse.url}&likeCount=2` },
        ],
        /one base request followed by one Like-count refinement.*observed 3/,
      ],
      [
        "non-numeric refinement",
        [exactResponse, { ...exactResponse, requestId: 9, url: `${exactResponse.url}&likeCount=48K` }],
        /invalid Like-count refinement/,
      ],
      [
        "a stale refinement video",
        [
          exactResponse,
          {
            ...exactResponse,
            requestId: 9,
            url: "https://returnyoutubedislikeapi.com/votes?videoId=stalevid001&likeCount=48525",
            videoId: "stalevid001",
          },
        ],
        /stale \/votes request/,
      ],
    ])("rejects extension refinement traffic with %s", (_label, records, expectedError) => {
      expect(() =>
        assertExactVotesResponseAudit(records, "abcdefghijk", 7, { allowLikeCountRefinement: true }),
      ).toThrow(expectedError);
    });

    test.each([
      ["duplicate request", [exactResponse, { ...exactResponse, requestId: 9 }], /exactly one \/votes request/],
      [
        "stale request",
        [{ ...exactResponse, requestId: 9, videoId: "stalevid001" }, exactResponse],
        /stale \/votes request/,
      ],
      ["old request ID", [{ ...exactResponse, requestId: 7 }], /not created after request baseline 7/],
      ["wrong status", [{ ...exactResponse, responseStatus: 503 }], /returned HTTP 503/],
      [
        "wrong response ID",
        [{ ...exactResponse, responseBody: { ...exactResponse.responseBody, id: "stalevid001" } }],
        /returned video stalevid001 instead of abcdefghijk/,
      ],
      [
        "invalid response count",
        [{ ...exactResponse, responseBody: { ...exactResponse.responseBody, dislikes: -1 } }],
        /has no valid dislike count/,
      ],
    ])("rejects a %s", (_label, records, expectedError) => {
      expect(() => assertExactVotesResponseAudit(records, "abcdefghijk", 7)).toThrow(expectedError);
    });
  });

  test("collects the complete per-hop window and rejects stale-plus-correct traffic", async () => {
    const listeners = new Map();
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
    };
    const page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn() };
    const driver = new LiveYoutubeDriver(page, context);
    const emitRequest = (videoId) => {
      const request = {
        frame: () => ({ page: () => page }),
        method: () => "GET",
        url: () => `https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`,
      };
      listeners.get("request").forEach((listener) => listener(request));
    };

    await expect(
      driver.withExactVotesRequest(
        async () => {
          emitRequest("stalevid001");
          emitRequest("abcdefghijk");
          return { videoId: "abcdefghijk" };
        },
        { quietMs: 0 },
      ),
    ).rejects.toThrow(/emitted a stale \/votes request/);
    expect(context.off).toHaveBeenCalledWith("request", expect.any(Function));
    expect(listeners.get("request").size).toBe(0);
  });

  test("baselines request IDs and returns the exact attributed response record", async () => {
    const listeners = new Map();
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
    };
    const page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn() };
    const driver = new LiveYoutubeDriver(page, context);
    const request = {
      frame: () => ({ page: () => page }),
      method: () => "GET",
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    };
    const response = {
      json: jest.fn(async () => ({ dislikes: 123, id: "abcdefghijk", likes: 456 })),
      request: () => request,
      status: () => 200,
    };

    await expect(
      driver.withExactVotesResponse(
        "abcdefghijk",
        async () => {
          listeners.get("request").forEach((listener) => listener(request));
          listeners.get("response").forEach((listener) => listener(response));
          return "navigation-result";
        },
        { quietMs: 0 },
      ),
    ).resolves.toEqual({
      body: { dislikes: 123, id: "abcdefghijk", likes: 456 },
      request: {
        method: "GET",
        requestId: 1,
        source: "page",
        url: "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
        videoId: "abcdefghijk",
        workerUrl: null,
      },
      result: "navigation-result",
      status: 200,
      videoId: "abcdefghijk",
    });
    expect(context.off).toHaveBeenCalledWith("request", expect.any(Function));
    expect(context.off).toHaveBeenCalledWith("response", expect.any(Function));
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  test("collects an extension base request plus one richer request and returns only the final response", async () => {
    const listeners = new Map();
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: jest.fn(() => []),
    };
    const page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn() };
    const driver = new LiveYoutubeDriver(page, context, {
      expectedBuildId: EXPECTED_BUILD_ID,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });
    driver.configureRequestAttributionRuntime("extension");
    const createExchange = (url, dislikes) => {
      const request = {
        frame: () => ({ page: () => page }),
        headers: () => ({
          accept: `application/json, application/vnd.ryd-live+json; id=${SELECTED_EXTENSION_ID}; build=${EXPECTED_BUILD_ID}`,
        }),
        method: () => "GET",
        url: () => url,
      };
      return {
        request,
        response: {
          json: jest.fn(async () => ({ dislikes, id: "abcdefghijk", likes: 48_525 })),
          request: () => request,
          status: () => 200,
        },
      };
    };
    const base = createExchange("https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk", 123);
    const refined = createExchange(
      "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&likeCount=48525",
      125,
    );

    await expect(
      driver.withExactVotesResponse(
        "abcdefghijk",
        async () => {
          for (const exchange of [base, refined]) {
            listeners.get("request").forEach((listener) => listener(exchange.request));
            listeners.get("response").forEach((listener) => listener(exchange.response));
          }
        },
        { quietMs: 0 },
      ),
    ).resolves.toMatchObject({
      body: { dislikes: 125, id: "abcdefghijk", likes: 48_525 },
      request: {
        requestId: 2,
        url: "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&likeCount=48525",
      },
      status: 200,
    });
    expect(base.response.json).toHaveBeenCalledTimes(1);
    expect(refined.response.json).toHaveBeenCalledTimes(1);
  });

  test("attributes a frame-less request only to the selected extension worker", () => {
    const page = {};
    const request = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js` }),
    };

    expect(attributeRuntimeRequest(request, page, "extension", SELECTED_EXTENSION_ID)).toEqual({
      source: "service-worker",
      workerUrl: `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js`,
    });
    expect(attributeRuntimeRequest(request, page, "userscript")).toBeNull();
    expect(
      attributeRuntimeRequest(
        {
          ...request,
          serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/unrelated-worker.js` }),
        },
        page,
        "extension",
        SELECTED_EXTENSION_ID,
      ),
    ).toBeNull();
  });

  test("does not attribute an otherwise identical /votes request from a competing extension worker", () => {
    const page = {};
    const request = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      serviceWorker: () => ({ url: () => `chrome-extension://${COMPETING_EXTENSION_ID}/ryd.background.js` }),
    };

    expect(attributeRuntimeRequest(request, page, "extension", SELECTED_EXTENSION_ID)).toBeNull();
  });

  test("parses only the exact live-build Accept fingerprint", () => {
    expect(parseLiveExtensionAcceptHeader(LIVE_ACCEPT_HEADER)).toEqual({
      buildId: EXPECTED_BUILD_ID,
      extensionId: SELECTED_EXTENSION_ID,
    });
    expect(parseLiveExtensionAcceptHeader(`${LIVE_ACCEPT_HEADER}; extra=true`)).toBeNull();
    expect(parseLiveExtensionAcceptHeader(LIVE_ACCEPT_HEADER.toUpperCase())).toBeNull();
    expect(parseLiveExtensionAcceptHeader("application/json")).toBeNull();
  });

  test("attributes an extension page-framed GET only with the exact extension and build fingerprint", () => {
    const page = {};
    const createRequest = (accept = LIVE_ACCEPT_HEADER) => ({
      frame: () => ({ page: () => page }),
      headers: () => ({ Accept: accept }),
      method: () => "GET",
    });

    expect(
      attributeRuntimeRequest(createRequest(), page, "extension", SELECTED_EXTENSION_ID, EXPECTED_BUILD_ID),
    ).toEqual({ source: "page", workerUrl: null });
    expect(
      attributeRuntimeRequest(
        createRequest(LIVE_ACCEPT_HEADER.replace(SELECTED_EXTENSION_ID, COMPETING_EXTENSION_ID)),
        page,
        "extension",
        SELECTED_EXTENSION_ID,
        EXPECTED_BUILD_ID,
      ),
    ).toBeNull();
    expect(
      attributeRuntimeRequest(
        createRequest(LIVE_ACCEPT_HEADER.replace(EXPECTED_BUILD_ID, "f".repeat(32))),
        page,
        "extension",
        SELECTED_EXTENSION_ID,
        EXPECTED_BUILD_ID,
      ),
    ).toBeNull();
    expect(
      attributeRuntimeRequest(
        createRequest("application/json"),
        page,
        "extension",
        SELECTED_EXTENSION_ID,
        EXPECTED_BUILD_ID,
      ),
    ).toBeNull();
  });

  test("rejects a page-framed POST even when it spoofs the complete extension fingerprint", () => {
    const page = {};
    const request = {
      frame: () => ({ page: () => page }),
      headers: () => ({ accept: LIVE_ACCEPT_HEADER }),
      method: () => "POST",
    };

    expect(attributeRuntimeRequest(request, page, "extension", SELECTED_EXTENSION_ID, EXPECTED_BUILD_ID)).toBeNull();
    expect(attributeRuntimeRequest(request, page, "userscript")).toEqual({ source: "page", workerUrl: null });
  });

  test("fails closed when extension request attribution has no selected extension ID", () => {
    const page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn() };
    const driver = new LiveYoutubeDriver(page, {});

    expect(() => driver.configureRequestAttributionRuntime("extension")).toThrow(
      /requires the exact selected extension ID/,
    );
  });

  test("fails closed when extension request attribution has no exact live build ID", () => {
    const page = { setDefaultNavigationTimeout: jest.fn(), setDefaultTimeout: jest.fn() };
    const context = { on: jest.fn() };
    const driver = new LiveYoutubeDriver(page, context, { selectedExtensionId: SELECTED_EXTENSION_ID });

    expect(() => driver.configureRequestAttributionRuntime("extension")).toThrow(/requires the exact live build ID/);
  });

  test("does not attribute a request owned by another page", () => {
    const page = {};
    const otherPage = {};
    const request = {
      frame: () => ({ page: () => otherPage }),
      serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js` }),
    };

    expect(attributeRuntimeRequest(request, page, "extension", SELECTED_EXTENSION_ID)).toBeNull();
  });

  test("rejects ambiguous worker traffic when another tab has the same video open", () => {
    const page = { url: () => "https://www.youtube.com/shorts/abcdefghijk" };
    const otherPage = { url: () => "https://www.youtube.com/watch?v=abcdefghijk" };
    const requests = [{ source: "service-worker", videoId: "abcdefghijk" }];

    expect(() =>
      assertWorkerRequestAttributionIsUnambiguous({ pages: () => [page, otherPage] }, page, requests, "abcdefghijk"),
    ).toThrow(/another tab has the same video open/);
  });

  test("captures the selected extension worker throughout the full per-hop request window", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: () => [page],
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, context, {
      expectedBuildId: EXPECTED_BUILD_ID,
      reportProgress,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });
    driver.configureRequestAttributionRuntime("extension");
    const request = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      method: () => "GET",
      serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js` }),
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    };

    await expect(
      driver.withExactVotesRequest(
        async () => {
          listeners.get("request").forEach((listener) => listener(request));
          return { videoId: "abcdefghijk" };
        },
        { quietMs: 0 },
      ),
    ).resolves.toEqual({ videoId: "abcdefghijk" });
    expect(reportProgress).toHaveBeenCalledWith(
      "shorts-votes-request-audit.confirmed",
      expect.objectContaining({ source: "service-worker", videoId: "abcdefghijk" }),
    );
  });

  test("cannot satisfy the exact /votes oracle with a competing extension worker", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: () => [page],
    };
    const driver = new LiveYoutubeDriver(page, context, {
      expectedBuildId: EXPECTED_BUILD_ID,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });
    driver.configureRequestAttributionRuntime("extension");
    const competingRequest = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      method: () => "GET",
      serviceWorker: () => ({ url: () => `chrome-extension://${COMPETING_EXTENSION_ID}/ryd.background.js` }),
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    };

    await expect(
      driver.withExactVotesRequest(
        async () => {
          listeners.get("request").forEach((listener) => listener(competingRequest));
          return { videoId: "abcdefghijk" };
        },
        { quietMs: 0 },
      ),
    ).rejects.toThrow(/must emit exactly one \/votes request.*observed 0/);
  });

  test("cannot satisfy the extension /votes oracle with an ordinary same-page GET", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: () => [page],
    };
    const driver = new LiveYoutubeDriver(page, context, {
      expectedBuildId: EXPECTED_BUILD_ID,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });
    driver.configureRequestAttributionRuntime("extension");
    const pageSpoof = {
      frame: () => ({ page: () => page }),
      headers: () => ({ accept: "application/json" }),
      method: () => "GET",
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    };

    await expect(
      driver.withExactVotesRequest(
        async () => {
          listeners.get("request").forEach((listener) => listener(pageSpoof));
          return { videoId: "abcdefghijk" };
        },
        { quietMs: 0 },
      ),
    ).rejects.toThrow(/must emit exactly one \/votes request.*observed 0/);
    driver.stop();
  });

  test("allows no /votes request only when the current Short stayed fully blank for the native-control window", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
    };
    const driver = new LiveYoutubeDriver(page, context);
    driver.configureRequestAttributionRuntime("userscript");
    driver.waitForCurrentShortsNativeControls = jest.fn(async () => ({
      currentVideoId: "abcdefghijk",
      observedForMs: 20_000,
      reason: "no-visible-native-shorts-actions",
      status: "blank",
      visibleNativeControls: 0,
    }));

    await expect(
      driver.withShortsSampleVotesResponse(async () => ({ videoId: "abcdefghijk" }), { quietMs: 0 }),
    ).resolves.toMatchObject({
      body: null,
      nativeControls: {
        observedForMs: 20_000,
        reason: "no-visible-native-shorts-actions",
        status: "blank",
      },
      request: null,
      status: null,
      videoId: "abcdefghijk",
    });
    expect(context.off).toHaveBeenCalledWith("request", expect.any(Function));
    expect(context.off).toHaveBeenCalledWith("response", expect.any(Function));
  });

  test("still rejects stale /votes traffic when YouTube rendered no native Shorts controls", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
    };
    const request = {
      frame: () => ({ page: () => page }),
      method: () => "GET",
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=stalevid001",
    };
    const response = {
      json: jest.fn(async () => ({ dislikes: 123, id: "stalevid001", likes: 456 })),
      request: () => request,
      status: () => 200,
    };
    const driver = new LiveYoutubeDriver(page, context);
    driver.configureRequestAttributionRuntime("userscript");
    driver.waitForCurrentShortsNativeControls = jest.fn(async () => ({
      currentVideoId: "abcdefghijk",
      observedForMs: 20_000,
      reason: "no-visible-native-shorts-actions",
      status: "blank",
      visibleNativeControls: 0,
    }));

    await expect(
      driver.withShortsSampleVotesResponse(
        async () => {
          listeners.get("request").forEach((listener) => listener(request));
          listeners.get("response").forEach((listener) => listener(response));
          return { videoId: "abcdefghijk" };
        },
        { quietMs: 0 },
      ),
    ).rejects.toThrow("emitted a stale /votes request while targeting abcdefghijk");
  });

  test("does not forgive a missing /votes request once any native Shorts action is visible", async () => {
    const listeners = new Map();
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: () => "https://www.youtube.com/shorts/abcdefghijk",
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
    };
    const driver = new LiveYoutubeDriver(page, context);
    driver.configureRequestAttributionRuntime("userscript");
    driver.waitForCurrentShortsNativeControls = jest.fn(async () => ({
      currentVideoId: "abcdefghijk",
      observedForMs: 1,
      status: "present",
      visibleNativeControls: 1,
    }));

    await expect(
      driver.withShortsSampleVotesResponse(async () => ({ videoId: "abcdefghijk" }), {
        quietMs: 0,
        trafficTimeoutMs: 0,
      }),
    ).rejects.toThrow("Timed out waiting for new attributed production /votes traffic for Short abcdefghijk");
  });

  test("navigateToNextShort consumes a frame-less response from the selected extension worker", async () => {
    const previousVideoId = "oldvideo001";
    const nextVideoId = "nextvideo01";
    let currentUrl = `https://www.youtube.com/shorts/${previousVideoId}`;
    let finishNavigation;
    const listeners = new Map();
    const request = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      method: () => "GET",
      serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js` }),
      url: () => `https://returnyoutubedislikeapi.com/votes?videoId=${nextVideoId}`,
    };
    const response = {
      json: jest.fn(async () => ({ dislikes: 321, id: nextVideoId, likes: 456 })),
      request: () => request,
      status: () => 200,
      url: () => `https://returnyoutubedislikeapi.com/votes?videoId=${nextVideoId}`,
    };
    const nextButton = {
      click: jest.fn(async () => {
        currentUrl = `https://www.youtube.com/shorts/${nextVideoId}`;
        listeners.get("request").forEach((listener) => listener(request));
        listeners.get("response").forEach((listener) => listener(response));
        finishNavigation?.();
      }),
      evaluate: jest.fn(async (callback) =>
        callback === readElementActionability
          ? {
              centerHitTarget: true,
              centerInViewport: true,
              connected: true,
              enabled: true,
              visible: true,
            }
          : {
              elementRenderedInViewport: true,
              hasReel: false,
              reelRenderedInViewport: false,
              videoMatches: false,
            },
      ),
      isVisible: jest.fn(async () => true),
    };
    const page = {
      evaluate: jest.fn(async () => "document-marker"),
      locator: jest.fn(() => ({
        count: jest.fn(async () => 1),
        nth: jest.fn(() => nextButton),
      })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => currentUrl),
      waitForURL: jest.fn(
        (predicate) =>
          new Promise((resolve) => {
            finishNavigation = () => {
              if (predicate(new URL(currentUrl))) resolve();
            };
          }),
      ),
    };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: () => [page],
    };
    const driver = new LiveYoutubeDriver(page, context, {
      expectedBuildId: EXPECTED_BUILD_ID,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });
    driver.configureRequestAttributionRuntime("extension");
    driver.waitForCurrentShortsNativeControls = jest.fn(async () => ({
      currentVideoId: nextVideoId,
      observedForMs: 10,
      status: "present",
      visibleNativeControls: 5,
    }));

    await expect(driver.navigateToNextShort(previousVideoId, { quietMs: 0 })).resolves.toMatchObject({
      body: { dislikes: 321, id: nextVideoId, likes: 456 },
      nativeControls: { status: "present", visibleNativeControls: 5 },
      request: {
        method: "GET",
        source: "service-worker",
        videoId: nextVideoId,
      },
      status: 200,
      videoId: nextVideoId,
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(nextButton.click).toHaveBeenCalledWith({ force: true, timeout: 5_000 });
    expect(context.off).toHaveBeenCalledWith("request", expect.any(Function));
    expect(context.off).toHaveBeenCalledWith("response", expect.any(Function));
  });
});

describe("production interaction runtime attribution", () => {
  function createRecorderHarness(runtime, selectedExtensionId = null) {
    const listeners = new Map();
    const page = { url: () => "https://www.youtube.com/watch?v=abcdefghijk" };
    const context = {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: () => [page],
    };
    const recorder = new VoteTrafficRecorder(context, "abcdefghijk", {
      handshakeTimeout: 25,
      page,
      runtime,
      selectedExtensionId,
    });
    return { context, listeners, page, recorder };
  }

  function interactionRequest(pathname, body, { page = null, workerId = null } = {}) {
    return {
      frame: () => {
        if (page) return { page: () => page };
        throw new Error("Service Worker requests do not have a frame");
      },
      method: () => "POST",
      postDataJSON: () => body,
      serviceWorker: () => (workerId ? { url: () => `chrome-extension://${workerId}/ryd.background.js` } : null),
      url: () => `https://returnyoutubedislikeapi.com${pathname}`,
    };
  }

  function emitRequest(listeners, request) {
    listeners.get("request").forEach((listener) => listener(request));
  }

  test("requires an exact selected extension ID before recording a background vote", () => {
    const context = { on: jest.fn() };

    expect(
      () =>
        new VoteTrafficRecorder(context, "abcdefghijk", {
          page: {},
          runtime: "extension",
        }),
    ).toThrow(/requires the exact selected extension ID/);
  });

  test("ignores a complete matching handshake from a competing extension worker", async () => {
    const { listeners, recorder } = createRecorderHarness("extension", SELECTED_EXTENSION_ID);
    const body = { userId: "user-1", value: -1, videoId: "abcdefghijk" };
    emitRequest(listeners, interactionRequest("/interact/vote", body, { workerId: COMPETING_EXTENSION_ID }));
    emitRequest(listeners, interactionRequest("/interact/confirmVote", body, { workerId: COMPETING_EXTENSION_ID }));

    expect(recorder.mark()).toBe(0);
    expect(recorder.hasVote(-1, 0)).toBe(false);
    await expect(recorder.waitForHandshake(-1, 0)).rejects.toThrow(
      /Timed out waiting for the production vote handshake/,
    );
    recorder.stop();
  });

  test("ignores a complete page-framed handshake that spoofs the selected extension fingerprint", async () => {
    const { listeners, page, recorder } = createRecorderHarness("extension", SELECTED_EXTENSION_ID);
    const userId = "A".repeat(36);
    const vote = interactionRequest("/interact/vote", { userId, value: -1, videoId: "abcdefghijk" }, { page });
    const confirmation = interactionRequest(
      "/interact/confirmVote",
      { solution: Buffer.alloc(4).toString("base64"), userId, videoId: "abcdefghijk" },
      { page },
    );
    vote.headers = confirmation.headers = () => ({ accept: LIVE_ACCEPT_HEADER });

    emitRequest(listeners, vote);
    emitRequest(listeners, confirmation);

    expect(recorder.mark()).toBe(0);
    expect(recorder.hasVote(-1, 0)).toBe(false);
    await expect(recorder.waitForHandshake(-1, 0)).rejects.toThrow(
      /Timed out waiting for the production vote handshake/,
    );
    recorder.stop();
  });

  test("records only the selected extension worker when a competitor emits the same vote", () => {
    const { listeners, recorder } = createRecorderHarness("extension", SELECTED_EXTENSION_ID);
    const body = { userId: "user-1", value: -1, videoId: "abcdefghijk" };
    const competing = interactionRequest("/interact/vote", body, { workerId: COMPETING_EXTENSION_ID });
    const selected = interactionRequest("/interact/vote", body, { workerId: SELECTED_EXTENSION_ID });

    emitRequest(listeners, competing);
    emitRequest(listeners, selected);

    expect(recorder.mark()).toBe(1);
    expect(recorder.records).toEqual([
      expect.objectContaining({
        body,
        source: "service-worker",
        workerUrl: `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js`,
      }),
    ]);
    recorder.stop();
  });

  test("binds userscript interaction traffic to the selected page", () => {
    const { listeners, page, recorder } = createRecorderHarness("userscript");
    const body = { userId: "user-1", value: -1, videoId: "abcdefghijk" };
    emitRequest(listeners, interactionRequest("/interact/vote", body, { page: {} }));
    emitRequest(listeners, interactionRequest("/interact/vote", body, { page }));

    expect(recorder.mark()).toBe(1);
    expect(recorder.records[0]).toEqual(expect.objectContaining({ body, source: "page", workerUrl: null }));
    recorder.stop();
  });
});

describe("current Shorts control ownership audit", () => {
  function createDriver({
    blockedAction = null,
    extraAction = false,
    hiddenDuplicateInCurrentReel = false,
    visibleStaleControl = false,
  } = {}) {
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="abcdefghijk">
        <reel-action-bar-view-model>
          <like-button-view-model><button type="button" aria-label="Like">1K</button></like-button-view-model>
          <div data-ryd-synthetic-shorts-dislike data-ryd-video-id="abcdefghijk">
            <button type="button" aria-label="Dislike this video" aria-pressed="false"></button>
            <span id="text">123</span>
          </div>
          <div><button type="button" aria-label="Comments"></button></div>
          <div><button type="button" aria-label="Share"></button></div>
          <div><button type="button" aria-label="Remix"></button></div>
          <div><button type="button" aria-label="More"></button></div>
          ${extraAction ? '<div><button type="button" aria-label="Extra action"></button></div>' : ""}
          ${
            hiddenDuplicateInCurrentReel
              ? '<div data-ryd-synthetic-shorts-dislike data-ryd-video-id="abcdefghijk" hidden><button></button></div>'
              : ""
          }
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>
      ${
        visibleStaleControl
          ? `<ytd-reel-video-renderer video-id="stalevid001">
              <div data-ryd-synthetic-shorts-dislike data-ryd-video-id="stalevid001"><button></button></div>
            </ytd-reel-video-renderer>`
          : ""
      }
    `;
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach((element, index) => {
      const top = 40 + index * 52;
      element.getBoundingClientRect = jest.fn(() => ({
        bottom: top + 48,
        height: 48,
        left: 900,
        right: 948,
        top,
        width: 48,
      }));
    });
    document.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").forEach((element) => {
      element.getBoundingClientRect = jest.fn(() => ({
        bottom: 140,
        height: 100,
        left: 900,
        right: 948,
        top: 40,
        width: 48,
      }));
    });
    document.elementFromPoint = jest.fn((x, y) => {
      const target = buttons.find((element) => {
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
      return target?.getAttribute("aria-label") === blockedAction ? document.body : target ?? null;
    });

    const button = document.querySelector(
      'ytd-reel-video-renderer[video-id="abcdefghijk"] [data-ryd-synthetic-shorts-dislike] button',
    );
    const page = {
      evaluate: jest.fn(async (callback) => callback()),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.visibleDislikeButton = jest.fn(async () => ({
      evaluate: async (callback, argument) => callback(button, argument),
    }));
    return driver;
  }

  test("accepts exactly one current synthetic control in the active reel and viewport", async () => {
    const driver = createDriver();

    await expect(driver.assertCurrentShortsControl("abcdefghijk", "extension")).resolves.toMatchObject({
      count: "123",
      synthetic: true,
      videoId: "abcdefghijk",
      hitTestedActionButtons: 6,
      visibleActionButtons: 6,
    });
  });

  test("accepts a seventh optional Shorts action when every action remains visible and hit-testable", async () => {
    const driver = createDriver({ extraAction: true });

    await expect(driver.assertCurrentShortsControl("abcdefghijk", "extension")).resolves.toMatchObject({
      hitTestedActionButtons: 7,
      visibleActionButtons: 7,
    });
  });

  test("rejects a visible Shorts action covered by another layer", async () => {
    const driver = createDriver({ blockedAction: "Share" });

    await expect(driver.assertCurrentShortsControl("abcdefghijk", "userscript")).rejects.toThrow(
      "Every visible Shorts action must be hit-testable at its center; blocked controls: Share",
    );
  });

  test("rejects a hidden duplicate retained inside the active reel", async () => {
    const driver = createDriver({ hiddenDuplicateInCurrentReel: true });

    await expect(driver.assertCurrentShortsControl("abcdefghijk", "userscript")).rejects.toThrow(
      "current Shorts action stack must contain exactly one userscript synthetic dislike control",
    );
  });

  test("rejects a visible synthetic control owned by a stale pre-rendered reel", async () => {
    const driver = createDriver({ visibleStaleControl: true });

    await expect(driver.assertCurrentShortsControl("abcdefghijk", "extension")).rejects.toThrow(
      "viewport contains a visible extension synthetic dislike control for a stale video ID",
    );
  });

  test("rejects a stale numeric control count that does not represent the current API response", async () => {
    const driver = createDriver();

    await expect(
      driver.assertCurrentShortsControl("abcdefghijk", "extension", { expectedDislikes: 456 }),
    ).rejects.toThrow(/Rendered dislike count "123" does not represent API count 456/);
  });
});

describe("relatedWatchVideoId", () => {
  const settings = {
    currentVideoId: "abcdefghijk",
    excludedVideoIds: ["excluded001"],
    origin: "https://www.youtube.com",
  };

  function read(href, overrides = {}) {
    const link = document.createElement("a");
    link.setAttribute("href", href);
    return relatedWatchVideoId(link, { ...settings, ...overrides });
  }

  test("accepts an exact same-origin watch target while preserving harmless query parameters", () => {
    expect(read("/watch?v=targetvid01&pp=sidebar")).toBe("targetvid01");
  });

  test.each([
    ["/watch?v=abcdefghijk", "current video"],
    ["/watch?v=excluded001", "previously visited video"],
    ["/watch?v=too-short", "invalid video ID"],
    ["/shorts/targetvid01", "Shorts URL"],
    ["https://example.com/watch?v=targetvid01", "cross-origin URL"],
    ["https://www.youtube.com.evil.example/watch?v=targetvid01", "lookalike host"],
  ])("rejects a %s (%s)", (href) => {
    expect(read(href)).toBeNull();
  });
});

describe("firstVisibleRelatedWatchLink", () => {
  function relatedLink(href, { visible = true, label = href } = {}) {
    const element = document.createElement("a");
    element.setAttribute("href", href);
    element.textContent = label;
    return {
      element,
      evaluate: async (callback, settings) => callback(element, settings),
      isVisible: async () => visible,
    };
  }

  function relatedPage(candidates) {
    const locator = {
      count: async () => candidates.length,
      nth: (index) => candidates[index],
    };
    return {
      locator,
      page: {
        locator: jest.fn(() => locator),
        url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
      },
    };
  }

  test("selects the first visible exact generic related anchor without renderer or thumbnail markup", async () => {
    const offscreenThumbnail = relatedLink("/watch?v=targetvid01&pp=thumbnail", {
      label: "thumbnail duplicate",
      visible: false,
    });
    const currentVideo = relatedLink("/watch?v=abcdefghijk", { label: "current video" });
    const excludedVideo = relatedLink("/watch?v=excluded001", { label: "visited video" });
    const genericTitle = relatedLink("/watch?v=targetvid01&pp=title", { label: "generic title link" });
    const visibleThumbnailDuplicate = relatedLink("/watch?v=targetvid01&pp=thumbnail", {
      label: "visible thumbnail duplicate",
    });
    const laterTarget = relatedLink("/watch?v=latervideo1", { label: "later target" });
    const { page } = relatedPage([
      offscreenThumbnail,
      currentVideo,
      excludedVideo,
      genericTitle,
      visibleThumbnailDuplicate,
      laterTarget,
    ]);

    await expect(firstVisibleRelatedWatchLink(page, "abcdefghijk", ["excluded001"], 100)).resolves.toEqual({
      link: genericTitle,
      videoId: "targetvid01",
    });
    expect(page.locator).toHaveBeenCalledTimes(1);
    expect(page.locator).toHaveBeenCalledWith('#related a[href*="/watch"]');
  });
});

describe("cold channel tab targeting", () => {
  test.each([
    ["https://www.youtube.com/@channel", "short", "https://www.youtube.com/@channel/shorts"],
    ["https://www.youtube.com/@channel/featured", "watch", "https://www.youtube.com/@channel/videos"],
    ["https://www.youtube.com/@channel/videos", "short", "https://www.youtube.com/@channel/shorts"],
    ["https://www.youtube.com/@channel/shorts", "watch", "https://www.youtube.com/@channel/videos"],
  ])("derives the relevant tab from %s for a %s target", (channelUrl, kind, expected) => {
    expect(channelTabUrl(channelUrl, kind).toString()).toBe(expected);
  });

  test.each([
    ["https://www.youtube.com/shorts/targetvid01", "short", true],
    ["https://www.youtube.com/watch?v=targetvid01", "watch", true],
    ["https://www.youtube.com/watch?v=targetvid01", "short", false],
    ["https://www.youtube.com/shorts/targetvid01", "watch", false],
    ["https://example.com/watch?v=targetvid01", "watch", false],
  ])("matches only the exact %s destination for %s", (url, kind, expected) => {
    expect(
      isExactVideoUrl(url, {
        kind,
        origin: "https://www.youtube.com",
        videoId: "targetvid01",
      }),
    ).toBe(expected);
  });
});

describe("hit-tested navigation link activation", () => {
  let originalElementFromPoint;

  function makeLink() {
    const link = document.createElement("a");
    const title = document.createElement("span");
    link.href = "/watch?v=targetvid01";
    title.textContent = "Related video";
    link.append(title);
    link.scrollIntoView = jest.fn();
    link.getBoundingClientRect = jest.fn(() => ({
      bottom: 140,
      height: 40,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
    }));
    document.body.append(link);
    return { link, title };
  }

  beforeEach(() => {
    originalElementFromPoint = document.elementFromPoint;
  });

  afterEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint,
      writable: true,
    });
  });

  test("accepts a visible enabled in-viewport link whose center hits a descendant", () => {
    const { link, title } = makeLink();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });

    const state = readNavigationLinkActionability(link);

    expect(assertNavigationLinkActionable(state, "related link")).toBe(state);
    expect(state).toMatchObject({
      center: { x: 200, y: 120 },
      centerHitTarget: true,
      centerInViewport: true,
      connected: true,
      enabled: true,
      href: "/watch?v=targetvid01",
      visible: true,
    });
    expect(link.scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" });
  });

  test("rejects an independently visible link when another element covers its center", () => {
    const { link } = makeLink();
    const obstruction = document.createElement("div");
    document.body.append(obstruction);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => obstruction),
      writable: true,
    });

    expect(() => assertNavigationLinkActionable(readNavigationLinkActionability(link), "related link")).toThrow(
      /center is covered by another element/,
    );
  });

  test("uses a force click after independent checks instead of entering the perpetual stability waiter", async () => {
    const { link, title } = makeLink();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });
    const locator = {
      click: jest.fn(async (options) => {
        if (!options?.force) throw new Error("simulated Playwright stability timeout");
      }),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
    };

    await expect(
      clickHitTestedNavigationLink(locator, {
        expectedKind: "watch",
        expectedVideoId: "targetvid01",
        label: "related link",
        timeout: 250,
      }),
    ).resolves.toMatchObject({ centerHitTarget: true, enabled: true, visible: true });

    expect(locator.evaluate).toHaveBeenNthCalledWith(1, scrollElementIntoViewAndWaitForPaint, undefined, {
      timeout: 250,
    });
    expect(locator.evaluate).toHaveBeenNthCalledWith(
      2,
      readElementActionability,
      { includeHref: true, scroll: false },
      { timeout: 250 },
    );
    expect(locator.click).toHaveBeenCalledTimes(1);
    expect(locator.click).toHaveBeenCalledWith({ force: true, timeout: 250 });
  });

  test("rejects a link whose target changed after selection without clicking it", async () => {
    const { link, title } = makeLink();
    link.href = "/watch?v=stalevideo1";
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });
    const locator = {
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
    };

    await expect(
      clickHitTestedNavigationLink(locator, {
        expectedKind: "watch",
        expectedVideoId: "targetvid01",
        label: "related link",
      }),
    ).rejects.toThrow(/changed to another Watch video/);
    expect(locator.click).not.toHaveBeenCalled();
  });

  test("re-resolves an exact channel target when the first visible duplicate is aria-hidden", async () => {
    const hidden = makeLink();
    const actionable = makeLink();
    const hiddenContainer = document.createElement("div");
    hiddenContainer.setAttribute("aria-hidden", "true");
    hiddenContainer.append(hidden.link);
    document.body.prepend(hiddenContainer);
    actionable.link.getBoundingClientRect.mockReturnValue({
      bottom: 140,
      height: 40,
      left: 400,
      right: 600,
      top: 100,
      width: 200,
      x: 400,
      y: 100,
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn((x) => (x < 400 ? hidden.title : actionable.title)),
      writable: true,
    });
    const candidates = [hidden, actionable].map(({ link }) => ({
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    }));
    candidates[1].click.mockResolvedValue(undefined);
    const collection = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const page = {
      locator: jest.fn(() => collection),
      url: jest.fn(() => "https://www.youtube.com/@channel"),
    };

    await expect(
      clickStabilizedExactVideoLink(page, "targetvid01", "watch", { pollInterval: 0, timeout: 100 }),
    ).resolves.toMatchObject({ centerHitTarget: true, visible: true });

    expect(candidates[0].click).not.toHaveBeenCalled();
    expect(candidates[1].click).toHaveBeenCalledTimes(1);
    expect(candidates[1].click).toHaveBeenCalledWith({ force: true, timeout: expect.any(Number) });
  });

  test("retries the freshly resolved exact channel target while hydration opacity settles", async () => {
    const { link, title } = makeLink();
    const container = document.createElement("div");
    container.style.opacity = "0";
    container.append(link);
    document.body.append(container);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });
    let actionabilityReads = 0;
    const candidate = {
      click: jest.fn(async () => undefined),
      evaluate: jest.fn(async (callback, argument) => {
        const result = callback(link, argument);
        if (callback === readElementActionability) {
          actionabilityReads += 1;
          if (actionabilityReads === 1) container.style.opacity = "1";
        }
        return result;
      }),
      isVisible: jest.fn(async () => true),
    };
    const collection = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => candidate),
    };
    const page = {
      locator: jest.fn(() => collection),
      url: jest.fn(() => "https://www.youtube.com/@channel"),
    };

    await expect(
      clickStabilizedExactVideoLink(page, "targetvid01", "watch", { pollInterval: 0, timeout: 100 }),
    ).resolves.toMatchObject({ centerHitTarget: true, visible: true });

    expect(actionabilityReads).toBe(2);
    expect(collection.count).toHaveBeenCalledTimes(1);
    expect(candidate.click).toHaveBeenCalledTimes(1);
  });

  test("waits for a transient channel-header avatar overlay to clear without scrolling the exact Short again", async () => {
    const { link, title } = makeLink();
    link.href = "/shorts/targetvid01";
    const headerAvatarOverlay = document.createElement("div");
    headerAvatarOverlay.className = "ytSpecAvatarShapeImageOverlays ytSpecAvatarShapeImage";
    document.body.append(headerAvatarOverlay);
    let hitReadsSinceScroll = 0;
    link.scrollIntoView.mockImplementation(() => {
      hitReadsSinceScroll = 0;
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => (++hitReadsSinceScroll === 1 ? headerAvatarOverlay : title)),
      writable: true,
    });
    const candidate = {
      click: jest.fn(async () => undefined),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    };
    const collection = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => candidate),
    };
    const page = {
      locator: jest.fn(() => collection),
      url: jest.fn(() => "https://www.youtube.com/@channel"),
    };

    await expect(
      clickStabilizedExactVideoLink(page, "targetvid01", "short", { pollInterval: 0, timeout: 250 }),
    ).resolves.toMatchObject({ centerHitTarget: true, href: "/shorts/targetvid01" });

    expect(link.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.elementFromPoint).toHaveBeenCalledTimes(2);
    expect(candidate.click).toHaveBeenCalledTimes(1);
    expect(candidate.click).toHaveBeenCalledWith({ force: true, timeout: expect.any(Number) });
  });

  test("cold channel-to-Watch navigation does not retain the preliminary hidden duplicate", async () => {
    const hidden = makeLink();
    const actionable = makeLink();
    const hiddenContainer = document.createElement("div");
    hiddenContainer.setAttribute("aria-hidden", "true");
    hiddenContainer.append(hidden.link);
    document.body.prepend(hiddenContainer);
    actionable.link.getBoundingClientRect.mockReturnValue({
      bottom: 140,
      height: 40,
      left: 400,
      right: 600,
      top: 100,
      width: 200,
      x: 400,
      y: 100,
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn((x) => (x < 400 ? hidden.title : actionable.title)),
      writable: true,
    });
    let currentUrl = "https://www.youtube.com/@channel";
    const candidates = [hidden, actionable].map(({ link }, index) => ({
      click: jest.fn(async () => {
        if (index === 1) currentUrl = "https://www.youtube.com/watch?v=targetvid01";
      }),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    }));
    const collection = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const page = {
      evaluate: jest.fn(async (callback) => callback()),
      goto: jest.fn(async (url) => {
        currentUrl = url;
      }),
      locator: jest.fn(() => collection),
      reload: jest.fn(async () => undefined),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => currentUrl),
      waitForURL: jest.fn(async (predicate, options) => {
        expect(options).toEqual({ timeout: 5_000, waitUntil: "commit" });
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (predicate(new URL(currentUrl))) return;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error("navigation did not complete");
      }),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.withExactVotesResponse = jest.fn(async (videoId, action) => ({
      body: { dislikes: 2, id: videoId, likes: 3 },
      result: await action(),
      status: 200,
      videoId,
    }));
    driver.waitForVideo = jest.fn(async () => undefined);

    await expect(
      driver.navigateFromColdChannelToWatch("https://www.youtube.com/@channel", "targetvid01"),
    ).resolves.toMatchObject({ status: 200, videoId: "targetvid01" });

    expect(candidates[0].click).not.toHaveBeenCalled();
    expect(candidates[1].click).toHaveBeenCalledTimes(1);
    expect(page.goto).toHaveBeenCalledWith("https://www.youtube.com/@channel/videos", {
      waitUntil: "domcontentloaded",
    });
    expect(driver.waitForVideo).toHaveBeenCalledWith("targetvid01");
  });

  test("retries an ignored exact Watch pointer activation once with a freshly validated keyboard activation", async () => {
    const { link, title } = makeLink();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });
    let currentUrl = "https://www.youtube.com/@channel";
    const candidate = {
      click: jest.fn(async () => undefined),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      focus: jest.fn(async () => undefined),
      isVisible: jest.fn(async () => true),
      press: jest.fn(async (key) => {
        expect(key).toBe("Enter");
        currentUrl = "https://www.youtube.com/watch?v=targetvid01";
      }),
    };
    const collection = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => candidate),
    };
    let navigationAttempt = 0;
    const page = {
      evaluate: jest.fn(async (callback) => callback()),
      goto: jest.fn(async (url) => {
        currentUrl = url;
      }),
      locator: jest.fn(() => collection),
      reload: jest.fn(async () => undefined),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => currentUrl),
      waitForURL: jest.fn(async (predicate, options) => {
        navigationAttempt += 1;
        expect(options).toEqual({
          timeout: navigationAttempt === 1 ? 5_000 : 25_000,
          waitUntil: "commit",
        });
        if (navigationAttempt === 1) throw new Error("pointer activation was ignored");
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (predicate(new URL(currentUrl))) return;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        throw new Error("keyboard navigation did not complete");
      }),
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });
    driver.withExactVotesResponse = jest.fn(async (videoId, action) => ({
      body: { dislikes: 2, id: videoId, likes: 3 },
      result: await action(),
      status: 200,
      videoId,
    }));
    driver.waitForVideo = jest.fn(async () => undefined);

    await expect(
      driver.navigateFromColdChannelToWatch("https://www.youtube.com/@channel/shorts", "targetvid01"),
    ).resolves.toMatchObject({ status: 200, videoId: "targetvid01" });

    expect(page.goto).toHaveBeenCalledWith("https://www.youtube.com/@channel/videos", {
      waitUntil: "domcontentloaded",
    });
    expect(candidate.click).toHaveBeenCalledTimes(1);
    expect(candidate.click).toHaveBeenCalledWith({ timeout: expect.any(Number) });
    expect(candidate.focus).toHaveBeenCalledTimes(1);
    expect(candidate.press).toHaveBeenCalledTimes(1);
    expect(candidate.press).toHaveBeenCalledWith("Enter", { timeout: expect.any(Number) });
    expect(reportProgress).toHaveBeenCalledWith("cold-channel.target-link.retrying", {
      firstFailure: "pointer activation was ignored",
      firstTimeoutMs: 5_000,
      kind: "watch",
      retryTimeoutMs: 25_000,
      videoId: "targetvid01",
    });
    expect(driver.waitForVideo).toHaveBeenCalledWith("targetvid01");
  });

  test("keeps the strict center hit test when an avatar overlay persistently covers an exact Short target", async () => {
    const { link } = makeLink();
    link.href = "/shorts/targetvid01";
    const obstruction = document.createElement("div");
    obstruction.className = "ytSpecAvatarShapeImageOverlays ytSpecAvatarShapeImage";
    document.body.append(obstruction);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => obstruction),
      writable: true,
    });
    const candidate = {
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    };
    const collection = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => candidate),
    };
    const page = {
      locator: jest.fn(() => collection),
      url: jest.fn(() => "https://www.youtube.com/@channel"),
    };

    await expect(
      clickStabilizedExactVideoLink(page, "targetvid01", "short", { pollInterval: 1, timeout: 20 }),
    ).rejects.toThrow(/Timed out waiting for an actionable exact short link.*center is covered/);
    expect(link.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(candidate.click).not.toHaveBeenCalled();
  });

  test("related-watch navigation re-resolves a hidden duplicate and keeps the SPA oracle", async () => {
    const currentVideoId = "abcdefghijk";
    const destinationVideoId = "targetvid01";
    let currentUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
    const hidden = makeLink();
    const { link, title } = makeLink();
    const hiddenContainer = document.createElement("div");
    hiddenContainer.setAttribute("aria-hidden", "true");
    hiddenContainer.append(hidden.link);
    document.body.prepend(hiddenContainer);
    link.getBoundingClientRect.mockReturnValue({
      bottom: 140,
      height: 40,
      left: 400,
      right: 600,
      top: 100,
      width: 200,
      x: 400,
      y: 100,
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn((x) => (x < 400 ? hidden.title : title)),
      writable: true,
    });
    const hiddenLocator = {
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(hidden.link, argument)),
      isVisible: jest.fn(async () => true),
    };
    const linkLocator = {
      click: jest.fn(async (options) => {
        if (!options?.force) throw new Error("simulated Playwright stability timeout");
        currentUrl = `https://www.youtube.com/watch?v=${destinationVideoId}`;
      }),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    };
    const candidates = [hiddenLocator, linkLocator];
    const relatedLocator = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const page = {
      evaluate: jest.fn(async (callback) => callback()),
      locator: jest.fn(() => relatedLocator),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => currentUrl),
      waitForURL: jest.fn(async (predicate, options) => {
        expect(options).toEqual({ waitUntil: "commit" });
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (predicate(new URL(currentUrl))) return;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error("navigation did not complete");
      }),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.withExactVotesResponse = jest.fn(async (videoId, action) => ({
      body: { id: videoId },
      result: await action(),
      status: 200,
      videoId,
    }));
    driver.waitForVideo = jest.fn(async () => undefined);

    await expect(driver.navigateToRelatedWatch()).resolves.toMatchObject({
      status: 200,
      videoId: destinationVideoId,
    });

    expect(hiddenLocator.click).not.toHaveBeenCalled();
    expect(linkLocator.click).toHaveBeenCalledWith({ force: true, timeout: 5_000 });
    expect(driver.withExactVotesResponse).toHaveBeenCalledWith(destinationVideoId, expect.any(Function));
    expect(driver.waitForVideo).toHaveBeenCalledWith(destinationVideoId);
    expect(page.url()).toBe(`https://www.youtube.com/watch?v=${destinationVideoId}`);
  });

  test("playlist SPA navigation settles a transient overlay before selecting and clicking its unvisited target", async () => {
    const currentVideoId = "abcdefghijk";
    const destinationVideoId = "targetvid01";
    let currentUrl = `https://www.youtube.com/watch?v=${currentVideoId}&list=RDabcdefghijk`;
    const current = makeLink();
    current.link.href = `/watch?v=${currentVideoId}&list=RDabcdefghijk`;
    const destination = makeLink();
    destination.link.href = `/watch?v=${destinationVideoId}&list=RDabcdefghijk`;
    destination.link.getBoundingClientRect.mockReturnValue({
      bottom: 140,
      height: 40,
      left: 400,
      right: 600,
      top: 100,
      width: 200,
      x: 400,
      y: 100,
    });
    const headerAvatarOverlay = document.createElement("div");
    headerAvatarOverlay.className = "ytSpecAvatarShapeImageOverlays ytSpecAvatarShapeImage";
    document.body.append(headerAvatarOverlay);
    let destinationHitReadsSinceScroll = 0;
    destination.link.scrollIntoView.mockImplementation(() => {
      destinationHitReadsSinceScroll = 0;
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn((x) => {
        if (x < 400) return current.title;
        destinationHitReadsSinceScroll += 1;
        return destinationHitReadsSinceScroll === 1 ? headerAvatarOverlay : destination.title;
      }),
      writable: true,
    });
    const candidates = [current, destination].map(({ link }, index) => ({
      click: jest.fn(async (options) => {
        expect(options.force).toBe(true);
        if (index === 1) {
          currentUrl = `https://www.youtube.com/watch?v=${destinationVideoId}&list=RDabcdefghijk`;
        }
      }),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
      isVisible: jest.fn(async () => true),
    }));
    const collection = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const page = {
      evaluate: jest.fn(async (callback) => callback()),
      locator: jest.fn(() => collection),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => currentUrl),
      waitForURL: jest.fn(async (predicate, options) => {
        expect(options).toEqual({ waitUntil: "commit" });
        for (let attempt = 0; attempt < 100; attempt += 1) {
          if (predicate(new URL(currentUrl))) return;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error("navigation did not complete");
      }),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.withExactVotesResponse = jest.fn(async (videoId, action) => ({
      body: { dislikes: 2, id: videoId, likes: 3 },
      result: await action(),
      status: 200,
      videoId,
    }));
    driver.waitForVideo = jest.fn(async () => undefined);

    await expect(driver.navigateWithinPlaylist({ excludedVideoIds: ["excluded001"] })).resolves.toMatchObject({
      body: { id: destinationVideoId },
      status: 200,
      videoId: destinationVideoId,
    });

    expect(candidates[0].click).not.toHaveBeenCalled();
    expect(candidates[1].click).toHaveBeenCalledTimes(1);
    expect(destination.link.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(document.elementFromPoint).toHaveBeenCalledTimes(4);
    expect(driver.withExactVotesResponse).toHaveBeenCalledWith(destinationVideoId, expect.any(Function));
    expect(driver.waitForVideo).toHaveBeenCalledWith(destinationVideoId);
  });

  test.each([
    ["disconnected", (link) => link.remove(), /became disconnected/],
    ["hidden", (link) => (link.hidden = true), /is not visibly rendered/],
    ["disabled", (link) => link.setAttribute("aria-disabled", "true"), /is disabled/],
    [
      "outside the viewport",
      (link) =>
        link.getBoundingClientRect.mockReturnValue({
          bottom: 940,
          height: 40,
          left: 100,
          right: 300,
          top: 900,
          width: 200,
          x: 100,
          y: 900,
        }),
      /center is outside the viewport/,
    ],
  ])("rejects a %s link before forcing a click", async (_description, mutate, expectedError) => {
    const { link, title } = makeLink();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => title),
      writable: true,
    });
    mutate(link);
    const locator = {
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(link, argument)),
    };

    await expect(clickHitTestedNavigationLink(locator, { label: "related link", timeout: 20 })).rejects.toThrow(
      expectedError,
    );
    expect(locator.click).not.toHaveBeenCalled();
  });
});

describe("hit-tested live control activation", () => {
  function makeButton() {
    const button = document.createElement("button");
    button.textContent = "Action";
    document.body.append(button);
    button.scrollIntoView = jest.fn();
    button.getBoundingClientRect = jest.fn(() => ({
      bottom: 140,
      height: 40,
      left: 100,
      right: 180,
      top: 100,
      width: 80,
      x: 100,
      y: 100,
    }));
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 720 });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    return button;
  }

  test("forces a trusted click only after explicit visibility, enabled, viewport, and hit-target checks", async () => {
    const button = makeButton();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => button),
      writable: true,
    });
    const beforeClick = jest.fn();
    const locator = {
      click: jest.fn(async (options) => {
        if (!options.force) throw new Error("simulated Playwright stability timeout");
      }),
      evaluate: jest.fn(async (callback, argument) => callback(button, argument)),
    };

    await expect(
      clickHitTestedElement(locator, { beforeClick, label: "reaction control", timeout: 321 }),
    ).resolves.toMatchObject({ centerHitTarget: true, centerInViewport: true, enabled: true, visible: true });

    expect(button.scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" });
    expect(beforeClick).toHaveBeenCalledTimes(1);
    expect(locator.click).toHaveBeenCalledWith({ force: true, timeout: 321 });
  });

  test("does not force a click when the independently hit-tested center is obstructed", async () => {
    const button = makeButton();
    const obstruction = document.createElement("div");
    document.body.append(obstruction);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => obstruction),
      writable: true,
    });
    const locator = {
      click: jest.fn(),
      evaluate: jest.fn(async (callback, argument) => callback(button, argument)),
    };

    await expect(clickHitTestedElement(locator, { label: "More-actions control" })).rejects.toThrow(
      /center is covered by another element/,
    );
    expect(locator.click).not.toHaveBeenCalled();
  });

  test("uses DOM scrolling and explicit viewport state for non-interactive visual measurements", async () => {
    const button = makeButton();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: jest.fn(() => null),
      writable: true,
    });
    const locator = {
      evaluate: jest.fn(async (callback, argument) => callback(button, argument)),
      scrollIntoViewIfNeeded: jest.fn(() => {
        throw new Error("must not enter Playwright's stability waiter");
      }),
    };

    await expect(prepareElementForViewportMeasurement(locator, "ratio bar")).resolves.toMatchObject({
      centerInViewport: true,
      connected: true,
      visible: true,
    });
    expect(locator.scrollIntoViewIfNeeded).not.toHaveBeenCalled();
  });

  test.each([
    ["disconnected", { connected: false }, /became disconnected/],
    ["hidden", { visible: false }, /not visibly rendered/],
    ["disabled", { enabled: false }, /is disabled/],
    ["offscreen", { centerInViewport: false }, /center is outside the viewport/],
    ["covered", { centerHitTarget: false }, /center is covered/],
  ])("rejects a %s live control before activation", (_label, override, expectedError) => {
    expect(() =>
      assertElementActionable(
        {
          centerHitTarget: true,
          centerInViewport: true,
          connected: true,
          enabled: true,
          visible: true,
          ...override,
        },
        "live control",
      ),
    ).toThrow(expectedError);
  });

  test("rejects a non-interactive measurement target outside the viewport", () => {
    expect(() =>
      assertElementReadyForViewportMeasurement({ centerInViewport: false, connected: true, visible: true }, "top row"),
    ).toThrow(/center is outside the viewport/);
  });
});

describe("bound authenticated session proof", () => {
  function createSignedInDriver(documentState, authenticatedHandle = "@expected.handle") {
    const page = {
      evaluate: jest.fn(async () => documentState),
      locator: jest.fn(() => {
        throw new Error("assertSignedIn must not reopen the account menu");
      }),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    return { driver: new LiveYoutubeDriver(page, {}, { authenticatedHandle }), page };
  }

  test("uses the context-selected handle and current ytcfg login flag without reopening the account menu", async () => {
    const { driver, page } = createSignedInDriver({ committed: true, configuredLoggedIn: true });

    await expect(driver.assertSignedIn("@EXPECTED.handle")).resolves.toBeUndefined();

    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(page.locator).not.toHaveBeenCalled();
  });

  test("rejects a current page whose ytcfg state is signed out", async () => {
    const { driver } = createSignedInDriver({ committed: true, configuredLoggedIn: false });

    await expect(driver.assertSignedIn("@expected.handle")).rejects.toThrow(/LOGGED_IN is not true/);
  });

  test("rejects a requested handle different from the context-selected identity", async () => {
    const { driver, page } = createSignedInDriver({ committed: true, configuredLoggedIn: true });

    await expect(driver.assertSignedIn("@different.handle")).rejects.toThrow(
      /not bound to the authenticated browser context/,
    );
    expect(page.evaluate).not.toHaveBeenCalled();
  });
});

describe("live playback diagnostics", () => {
  test("reports that playback was intentionally paused", async () => {
    const videos = [{ pause: jest.fn() }, { pause: jest.fn() }];
    const page = {
      locator: jest.fn(() => ({ evaluateAll: async (callback) => callback(videos) })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk"),
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });

    await expect(driver.pausePlayback()).resolves.toEqual({ pauseFailures: [], pausedVideos: 2 });

    expect(videos.every(({ pause }) => pause.mock.calls.length === 1)).toBe(true);
    expect(reportProgress).toHaveBeenCalledWith("playback.paused", {
      explanation: "The live smoke pauses media intentionally while it validates the current page",
      pauseFailures: [],
      pausedVideos: 2,
      url: "https://www.youtube.com/shorts/abcdefghijk",
    });
  });

  test("catches individual synchronous pause failures without waiting on media playback", async () => {
    const videos = [
      { pause: jest.fn(() => undefined) },
      {
        pause: jest.fn(() => {
          throw new Error("media state unavailable");
        }),
      },
    ];
    const page = {
      locator: jest.fn(() => ({ evaluateAll: async (callback) => callback(videos) })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(driver.pausePlayback()).resolves.toEqual({
      pauseFailures: ["media state unavailable"],
      pausedVideos: 1,
    });
  });

  test("waits for a new video URL without pausing until the caller requests stable playback", async () => {
    const videos = [{ pause: jest.fn() }];
    const page = {
      locator: jest.fn(() => ({ evaluateAll: async (callback) => callback(videos) })),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/shorts/abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});

    await driver.waitForVideoUrl("abcdefghijk");
    expect(page.locator).not.toHaveBeenCalled();
    expect(videos[0].pause).not.toHaveBeenCalled();

    await driver.waitForVideo("abcdefghijk");
    expect(page.locator).toHaveBeenCalledWith("video");
    expect(videos[0].pause).toHaveBeenCalledTimes(1);
  });
});

describe("Shorts control stability soak", () => {
  function createDriver() {
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.assertCurrentVideo = jest.fn();
    return driver;
  }

  test("requires a later ownership/count sample instead of trusting the first rendered control", async () => {
    const driver = createDriver();
    driver.assertCurrentShortsControl = jest
      .fn()
      .mockResolvedValueOnce({ count: "123", videoId: "abcdefghijk" })
      .mockRejectedValueOnce(new Error("control disappeared after navigation"));

    await expect(
      driver.soakCurrentShortsControl("abcdefghijk", "extension", 123, {
        durationMs: 0,
        intervalMs: 1,
        minimumSamples: 2,
        presenceTimeoutMs: 10,
      }),
    ).rejects.toThrow("control disappeared after navigation");
    expect(driver.assertCurrentShortsControl).toHaveBeenCalledTimes(2);
    expect(driver.assertCurrentShortsControl).toHaveBeenNthCalledWith(2, "abcdefghijk", "extension", {
      expectedDislikes: 123,
      presenceTimeoutMs: 10,
    });
  });

  test("returns evidence from at least two stable samples", async () => {
    const driver = createDriver();
    driver.assertCurrentShortsControl = jest.fn(async () => ({ count: "123", videoId: "abcdefghijk" }));

    await expect(
      driver.soakCurrentShortsControl("abcdefghijk", "userscript", 123, {
        durationMs: 0,
        intervalMs: 1,
        minimumSamples: 2,
      }),
    ).resolves.toMatchObject({ expectedDislikes: 123, sampleCount: 2, videoId: "abcdefghijk" });
  });
});

describe("watch ratio-bar soak", () => {
  test("rejects a current Watch result whose rendered count belongs to another response", async () => {
    const page = {
      evaluate: jest.fn(async () => "en"),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.assertCurrentVideo = jest.fn();
    driver.inspectWatchRatioVisual = jest.fn(async () => ({ count: "999" }));
    driver.soakWatchRatioVisual = jest.fn();

    await expect(
      driver.assertCurrentWatchResult("abcdefghijk", "extension", { dislikes: 123, likes: 456 }),
    ).rejects.toThrow(/Rendered dislike count "999" does not represent API count 123/);
    expect(driver.soakWatchRatioVisual).not.toHaveBeenCalled();
  });

  test("rejects a visible ratio result that is not owned by the current Watch root", async () => {
    const emptyLocator = {
      count: jest.fn(async () => 0),
      nth: jest.fn(),
    };
    const currentRoot = { locator: jest.fn(() => emptyLocator) };
    const page = {
      locator: jest.fn(() => currentRoot),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.assertCurrentVideo = jest.fn();
    driver.assertRenderedDislikeCount = jest.fn(async () => ({}));
    driver.inspectWatchRatioVisual = jest.fn(async () => ({ count: "123" }));
    driver.soakWatchRatioVisual = jest.fn();

    await expect(
      driver.assertCurrentWatchResult("abcdefghijk", "userscript", { dislikes: 123, likes: 456 }),
    ).rejects.toThrow(/exactly one visible userscript ratio bar owned by current Watch video abcdefghijk; found 0/);
    expect(driver.soakWatchRatioVisual).not.toHaveBeenCalled();
  });

  test("rechecks the current video, bar geometry, and stable count for the requested interval", async () => {
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const reportProgress = jest.fn();
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });
    driver.assertCurrentVideo = jest.fn();
    driver.assertWatchRatioVisual = jest.fn(async () => ({ count: "123" }));

    const result = await driver.soakWatchRatioVisual("userscript", {
      durationMs: 1,
      expectedCount: "123",
      expectedCounts: { dislikes: 123, likes: 456 },
      intervalMs: 1,
      videoId: "targetvid01",
    });

    expect(driver.assertCurrentVideo).toHaveBeenCalledWith("targetvid01");
    expect(driver.assertWatchRatioVisual).toHaveBeenCalledWith("userscript", {
      expectedCount: "123",
      expectedCounts: { dislikes: 123, likes: 456 },
      expectedVideoId: "targetvid01",
    });
    expect(result).toEqual({
      count: "123",
      durationMs: 1,
      ratioAudit: undefined,
      sampleCount: driver.assertWatchRatioVisual.mock.calls.length,
      videoId: "targetvid01",
    });
    expect(reportProgress).toHaveBeenNthCalledWith(1, "watch-ratio-soak.start", {
      durationMs: 1,
      expectedCount: "123",
      runtime: "userscript",
      videoId: "targetvid01",
    });
    expect(reportProgress).toHaveBeenLastCalledWith("watch-ratio-soak.complete", {
      durationMs: 1,
      expectedCount: "123",
      runtime: "userscript",
      sampleCount: result.sampleCount,
      videoId: "targetvid01",
    });
  });
});

describe("reaction visual capture hygiene", () => {
  function createCapturePage(tooltip, videoBoxes = []) {
    const tooltipList = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => tooltip),
    };
    const videos = videoBoxes.map((measurement) => ({
      boundingBox: jest.fn(async () => measurement),
      isVisible: jest.fn(async () => true),
    }));
    const videoList = {
      count: jest.fn(async () => videos.length),
      nth: jest.fn((index) => videos[index]),
    };
    return {
      evaluate: jest.fn(async () => undefined),
      locator: jest.fn((selector) => (selector === "video" ? videoList : tooltipList)),
      mouse: { move: jest.fn(async () => undefined) },
      screenshot: jest.fn(async () => undefined),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
  }

  test("parks the pointer inside the largest visible video and outside controls before capturing", async () => {
    const tooltip = {
      innerText: jest.fn(async () => "I like this"),
      isVisible: jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
    };
    const preloadedVideo = box(0, 0, 320, 180);
    const currentVideo = box(100, 40, 800, 640);
    const page = createCapturePage(tooltip, [preloadedVideo, currentVideo]);
    const driver = new LiveYoutubeDriver(page, {}, { visualTooltipTimeout: 1_000 });
    const control = box(900, 500, 48, 78);
    driver.readViewportSize = jest.fn(async () => ({ height: 720, width: 1280 }));

    await expect(driver.captureCroppedScreenshot("short-liked.png", [control])).resolves.toEqual({
      height: 102,
      width: 72,
      x: 888,
      y: 488,
    });

    const [pointerX, pointerY] = page.mouse.move.mock.calls[0];
    expect({ x: pointerX, y: pointerY }).toEqual({ x: 500, y: 360 });
    expect(pointerX).toBeGreaterThan(currentVideo.x);
    expect(pointerX).toBeLessThan(currentVideo.x + currentVideo.width);
    expect(pointerY).toBeGreaterThan(currentVideo.y);
    expect(pointerY).toBeLessThan(currentVideo.y + currentVideo.height);
    expect(
      pointerX < control.x ||
        pointerX > control.x + control.width ||
        pointerY < control.y ||
        pointerY > control.y + control.height,
    ).toBe(true);
    expect(tooltip.isVisible).toHaveBeenCalledTimes(2);
    expect(page.mouse.move.mock.invocationCallOrder[0]).toBeLessThan(page.screenshot.mock.invocationCallOrder[0]);
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ path: "short-liked.png", clip: { height: 102, width: 72, x: 888, y: 488 } }),
    );
  });

  test("fails within the configured bound instead of capturing a persistent native tooltip", async () => {
    const tooltip = {
      innerText: jest.fn(async () => "I like this"),
      isVisible: jest.fn(async () => true),
    };
    const page = createCapturePage(tooltip);
    const driver = new LiveYoutubeDriver(page, {}, { visualTooltipTimeout: 1 });
    driver.readViewportSize = jest.fn(async () => ({ height: 720, width: 1280 }));

    await expect(driver.captureCroppedScreenshot("obscured.png", [box(900, 500, 48, 78)])).rejects.toThrow(
      /Timed out waiting for native YouTube tooltips.*I like this/,
    );

    expect(page.mouse.move).toHaveBeenCalledTimes(1);
    expect(page.screenshot).not.toHaveBeenCalled();
  });

  test("waits for both synthetic Shorts icons to paint before measuring their geometry", async () => {
    const readyIdentity = {
      elementRenderedInViewport: true,
      hasReel: true,
      reelRenderedInViewport: true,
      videoMatches: true,
    };
    const count = { evaluate: jest.fn(async () => "123"), first: jest.fn() };
    count.first.mockReturnValue(count);
    const button = {
      evaluate: jest.fn(async () => readyIdentity),
      isVisible: jest.fn(async () => true),
    };
    const buttonList = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => button),
    };
    const control = {
      evaluate: jest.fn(async () => readyIdentity),
      isVisible: jest.fn(async () => true),
      locator: jest.fn((selector) => (selector === "button" ? buttonList : count)),
    };
    const controls = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => control),
    };
    const page = {
      locator: jest.fn(() => controls),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    const likeButton = { evaluate: jest.fn() };
    const paintFailure = new Error("paint did not complete");
    driver.assertCurrentVideo = jest.fn();
    driver.visibleLikeButton = jest.fn(async () => likeButton);
    driver.waitForShortsVisualPaint = jest.fn(async () => {
      throw paintFailure;
    });

    await expect(driver.captureSyntheticShortsVisual("abcdefghijk", "synthetic.png")).rejects.toBe(paintFailure);

    expect(driver.waitForShortsVisualPaint).toHaveBeenCalledWith([likeButton, button]);
    expect(control.evaluate).toHaveBeenCalledTimes(1);
    expect(control.evaluate.mock.calls[0][1]).toEqual({ expectedShortVideoId: "abcdefghijk" });
    expect(likeButton.evaluate).not.toHaveBeenCalled();
  });

  test("waits for both native Shorts icons to paint before measuring their geometry", async () => {
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    const likeButton = { evaluate: jest.fn() };
    const dislikeButton = { evaluate: jest.fn() };
    const paintFailure = new Error("paint did not complete");
    driver.assertCurrentVideo = jest.fn();
    driver.waitForDislikeText = jest.fn(async () => "123");
    driver.visibleLikeButton = jest.fn(async () => likeButton);
    driver.visibleDislikeButton = jest.fn(async () => dislikeButton);
    driver.waitForShortsVisualPaint = jest.fn(async () => {
      throw paintFailure;
    });

    await expect(driver.captureNativeShortsVisual("abcdefghijk", "native.png")).rejects.toBe(paintFailure);

    expect(driver.waitForShortsVisualPaint).toHaveBeenCalledWith([likeButton, dislikeButton]);
    expect(likeButton.evaluate).not.toHaveBeenCalled();
    expect(dislikeButton.evaluate).not.toHaveBeenCalled();
  });

  test.each([
    ["strict-synthetic", "captureSyntheticShortsVisual", "captureNativeShortsVisual"],
    ["native-pair", "captureNativeShortsVisual", "captureSyntheticShortsVisual"],
  ])(
    "selects the %s Shorts capture by capability, not runtime label",
    async (shortsVisualModel, expected, rejected) => {
      const page = {
        setDefaultNavigationTimeout: jest.fn(),
        setDefaultTimeout: jest.fn(),
      };
      const driver = new LiveYoutubeDriver(page, {});
      driver.assertCurrentVideo = jest.fn();
      driver.assertRenderedDislikeCount = jest.fn(async () => ({}));
      driver.readReactionPressedStates = jest.fn(async () => ({ dislikeState: "false", likeState: "false" }));
      driver.waitForDislikeText = jest.fn(async () => "123");
      driver.captureSyntheticShortsVisual = jest.fn(async () => ({ capture: "synthetic" }));
      driver.captureNativeShortsVisual = jest.fn(async () => ({ capture: "native" }));

      await driver.captureReactionStateVisual({
        expectedCounts: { dislikes: 123, likes: 456 },
        expectedState: "neutral",
        isShort: true,
        runtime: shortsVisualModel === "strict-synthetic" ? "extension" : "userscript",
        screenshotPath: "reaction.png",
        shortsVisualModel,
        videoId: "abcdefghijk",
      });

      expect(driver[expected]).toHaveBeenCalledWith("abcdefghijk", "reaction.png");
      expect(driver[rejected]).not.toHaveBeenCalled();
    },
  );

  test("rejects Shorts reaction evidence without an adapter visual capability", async () => {
    const page = {
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.assertCurrentVideo = jest.fn();
    driver.assertRenderedDislikeCount = jest.fn(async () => ({}));
    driver.readReactionPressedStates = jest.fn(async () => ({ dislikeState: "false", likeState: "false" }));
    driver.waitForDislikeText = jest.fn(async () => "123");

    await expect(
      driver.captureReactionStateVisual({
        expectedCounts: { dislikes: 123, likes: 456 },
        expectedState: "neutral",
        isShort: true,
        runtime: "extension",
        screenshotPath: "reaction.png",
        videoId: "abcdefghijk",
      }),
    ).rejects.toThrow("Unsupported reaction Shorts visual model: missing");
  });
});

describe("watch reaction screenshot bounds", () => {
  function visibleBoxLocator(measurement, evaluatedValue = null) {
    const locator = {
      boundingBox: jest.fn(async () => measurement),
      count: jest.fn(async () => 1),
      evaluate: jest.fn(async () => evaluatedValue),
      isVisible: jest.fn(async () => true),
      nth: jest.fn(() => locator),
      scrollIntoViewIfNeeded: jest.fn(async () => undefined),
    };
    return locator;
  }

  function createRatioCaptureDriver({ appearance: appearanceOverrides = {}, fillBox = box(100, 144, 120, 2) } = {}) {
    const viewport = { height: 300, width: 500 };
    const likeBox = box(100, 100, 80, 40);
    const dislikeBox = box(180, 100, 80, 40);
    const containerBox = box(100, 144, 160, 2);
    const wrapperBox = box(100, 140, 160, 62);
    const hitAreaBox = box(100, 138, 160, 20);
    const topRowBox = box(80, 80, 400, 140);
    const like = visibleBoxLocator(likeBox);
    const dislike = visibleBoxLocator(dislikeBox);
    const bar = visibleBoxLocator(fillBox);
    const wrapper = visibleBoxLocator(wrapperBox);
    wrapper.evaluate
      .mockResolvedValueOnce({
        inlineFillWidth: "75%",
        negativeTrackBackgroundImage: "none",
        negativeTrackColor: "rgb(115, 115, 115)",
        negativeTrackOpacity: 1,
        numberLocale: "en-US",
        pageBackgroundColor: "rgb(255, 255, 255)",
        pageBackgroundSource: "body",
        pageTheme: "light",
        tooltipText: "3 / 1",
        wrapperVideoId: "abcdefghijk",
        ...appearanceOverrides,
      })
      .mockResolvedValueOnce({ hitArea: hitAreaBox, nearbyActions: [], topRow: topRowBox });
    const container = visibleBoxLocator(containerBox, {
      centerInViewport: true,
      connected: true,
      visible: true,
    });
    container.locator = jest.fn(() => wrapper);
    const page = {
      locator: jest.fn((selector) => (selector === "#return-youtube-dislike-bar-container" ? container : bar)),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.captureCroppedScreenshot = jest.fn(async () => ({}));
    driver.readViewportSize = jest.fn(async () => viewport);
    driver.visibleDislikeButton = jest.fn(async () => dislike);
    driver.visibleLikeButton = jest.fn(async () => like);
    driver.assertRenderedDislikeCount = jest.fn(async () => ({}));
    driver.waitForDislikeText = jest.fn(async () => "1");
    return driver;
  }

  test("passes the full ratio wrapper to the crop so its bottom label is retained", async () => {
    const viewport = { height: 300, width: 500 };
    const likeBox = box(100, 100, 80, 40);
    const dislikeBox = box(180, 100, 80, 40);
    const containerBox = box(100, 144, 160, 2);
    const barBox = box(100, 144, 120, 2);
    const wrapperBox = box(100, 140, 160, 62);
    const hitAreaBox = box(100, 138, 160, 20);
    const nearbyActionBox = box(280, 100, 80, 40);
    const topRowBox = box(80, 80, 400, 140);
    const like = visibleBoxLocator(likeBox);
    const dislike = visibleBoxLocator(dislikeBox);
    const bar = visibleBoxLocator(barBox);
    const wrapper = visibleBoxLocator(wrapperBox);
    wrapper.evaluate
      .mockResolvedValueOnce({
        inlineFillWidth: "75%",
        negativeTrackBackgroundImage: "none",
        negativeTrackColor: "rgb(115, 115, 115)",
        negativeTrackOpacity: 1,
        numberLocale: "en-US",
        pageBackgroundColor: "rgb(255, 255, 255)",
        pageBackgroundSource: "body",
        pageTheme: "light",
        tooltipText: "3 / 1",
        wrapperVideoId: "abcdefghijk",
      })
      .mockResolvedValueOnce({
        hitArea: hitAreaBox,
        nearbyActions: [nearbyActionBox],
        topRow: topRowBox,
      });
    const container = visibleBoxLocator(containerBox, {
      centerInViewport: true,
      connected: true,
      visible: true,
    });
    container.locator = jest.fn(() => wrapper);
    const page = {
      locator: jest.fn((selector) => (selector === "#return-youtube-dislike-bar-container" ? container : bar)),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});
    driver.captureCroppedScreenshot = jest.fn(async (_path, boxes) => croppedScreenshotClip(boxes, viewport));
    driver.readViewportSize = jest.fn(async () => viewport);
    driver.visibleDislikeButton = jest.fn(async () => dislike);
    driver.visibleLikeButton = jest.fn(async () => like);
    driver.assertRenderedDislikeCount = jest.fn(async () => ({}));
    driver.waitForDislikeText = jest.fn(async () => "1");

    const result = await driver.captureWatchRatioVisual("userscript", "watch-liked.png", {
      expectedCounts: { dislikes: 1, likes: 3 },
      expectedVideoId: "abcdefghijk",
    });

    expect(driver.captureCroppedScreenshot).toHaveBeenCalledWith("watch-liked.png", [
      topRowBox,
      likeBox,
      dislikeBox,
      containerBox,
      wrapperBox,
      hitAreaBox,
      nearbyActionBox,
    ]);
    expect(result.screenshotClip.y + result.screenshotClip.height).toBeGreaterThanOrEqual(
      wrapperBox.y + wrapperBox.height + 12,
    );
    expect(result.screenshotClip.y + result.screenshotClip.height).toBeGreaterThan(
      containerBox.y + containerBox.height + 12,
    );
  });

  test("rejects duplicate visible runtime bars before taking evidence", async () => {
    const candidates = [{ isVisible: jest.fn(async () => true) }, { isVisible: jest.fn(async () => true) }];
    const duplicateContainers = {
      count: jest.fn(async () => candidates.length),
      nth: jest.fn((index) => candidates[index]),
    };
    const bar = visibleBoxLocator(box(100, 144, 120, 2));
    const page = {
      locator: jest.fn((selector) =>
        selector === "#return-youtube-dislike-bar-container" ? duplicateContainers : bar,
      ),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {});

    await expect(driver.captureWatchRatioVisual("userscript", "duplicate.png")).rejects.toThrow(
      "Expected exactly one visible userscript watch ratio bar; found 2.",
    );
  });

  test.each([
    ["stale wrapper owner", { wrapperVideoId: "stalevid001" }, /Watch ratio bar is owned by stalevid001/],
    ["wrong API ratio", { inlineFillWidth: "25%" }, /inline width represents 25\.000%, expected 75\.000%/],
    ["wrong API tooltip", { tooltipText: "9 / 1" }, /tooltip.*does not exactly match the API counts/],
    [
      "near-invisible negative track",
      { negativeTrackColor: "rgb(248, 248, 248)" },
      /negative track is effectively invisible/,
    ],
  ])("rejects a %s before recording Watch evidence", async (_label, appearance, expectedError) => {
    const driver = createRatioCaptureDriver({ appearance });

    await expect(
      driver.captureWatchRatioVisual("userscript", "invalid.png", {
        expectedCounts: { dislikes: 1, likes: 3 },
        expectedVideoId: "abcdefghijk",
      }),
    ).rejects.toThrow(expectedError);
    expect(driver.captureCroppedScreenshot).not.toHaveBeenCalled();
  });
});

describe("live Shorts Next navigation retry", () => {
  test("retries exactly once when YouTube ignores the first trusted click", async () => {
    let navigated = false;
    const click = jest.fn().mockResolvedValue(undefined);
    const reportProgress = jest.fn();
    const waitForNavigation = jest
      .fn()
      .mockRejectedValueOnce(new Error("first navigation timed out"))
      .mockImplementationOnce(async () => {
        navigated = true;
      });

    await expect(
      clickWithSingleNavigationRetry({
        click,
        hasNavigated: () => navigated,
        reportProgress,
        retryDetails: { previousVideoId: "abcdefghijk" },
        waitForNavigation,
      }),
    ).resolves.toEqual({ retried: true });

    expect(click.mock.calls).toEqual([
      [1, 5_000],
      [2, 25_000],
    ]);
    expect(waitForNavigation.mock.calls.map(([timeout]) => timeout)).toEqual([5_000, 25_000]);
    expect(reportProgress).toHaveBeenCalledTimes(1);
    expect(reportProgress).toHaveBeenCalledWith("shorts-next-control.retrying", {
      firstFailure: "first navigation timed out",
      firstTimeoutMs: 5_000,
      previousVideoId: "abcdefghijk",
      retryTimeoutMs: 25_000,
    });
  });

  test("fails after the single retry instead of clicking a third time", async () => {
    const click = jest.fn().mockResolvedValue(undefined);
    const reportProgress = jest.fn();
    const waitForNavigation = jest
      .fn()
      .mockRejectedValueOnce(new Error("first navigation timed out"))
      .mockRejectedValueOnce(new Error("retry navigation timed out"));

    await expect(
      clickWithSingleNavigationRetry({
        click,
        hasNavigated: () => false,
        reportProgress,
        retryDetails: { previousVideoId: "abcdefghijk" },
        waitForNavigation,
      }),
    ).rejects.toThrow(/first Shorts Next click or its single retry/);

    expect(click).toHaveBeenCalledTimes(2);
    expect(waitForNavigation).toHaveBeenCalledTimes(2);
    expect(reportProgress).toHaveBeenCalledTimes(1);
  });

  test("does not retry when navigation completed at the first timeout boundary", async () => {
    let navigated = false;
    const click = jest.fn().mockResolvedValue(undefined);
    const reportProgress = jest.fn();
    const waitForNavigation = jest.fn(async () => {
      navigated = true;
      throw new Error("navigation event timed out after the URL changed");
    });

    await expect(
      clickWithSingleNavigationRetry({
        click,
        hasNavigated: () => navigated,
        reportProgress,
        retryDetails: { previousVideoId: "abcdefghijk" },
        waitForNavigation,
      }),
    ).resolves.toEqual({ retried: false });

    expect(click).toHaveBeenCalledTimes(1);
    expect(reportProgress).not.toHaveBeenCalled();
  });
});

describe("watch ratio viewport alignment", () => {
  const viewport = { height: 844, width: 375 };
  const like = box(-25.828, 700, 80.77, 40);
  const dislike = box(54.942, 700, 84.658, 40);

  test("rejects the captured 390px failure even when the ratio bar shares the native clipping", () => {
    const container = box(-25.828, 744, 165.428, 2);

    expect(() => assertWatchRatioViewportAlignment(container, like, dislike, viewport)).toThrow(
      /Watch like control is clipped past the viewport's left edge/,
    );
  });

  test("rejects native reaction controls clipped past the right edge", () => {
    const rightClippedLike = box(240, 700, 80, 40);
    const rightClippedDislike = box(320, 700, 84, 40);
    const container = box(240, 744, 164, 2);

    expect(() => assertWatchRatioViewportAlignment(container, rightClippedLike, rightClippedDislike, viewport)).toThrow(
      /Watch dislike control is clipped past the viewport's right edge/,
    );
  });

  test("retains the strict viewport assertion when native controls are in bounds", () => {
    const inBoundsLike = box(10, 700, 80, 40);
    const inBoundsDislike = box(90, 700, 85, 40);
    const clippedContainer = box(-2, 744, 177, 2);

    expect(() => assertWatchRatioViewportAlignment(clippedContainer, inBoundsLike, inBoundsDislike, viewport)).toThrow(
      /Watch ratio bar is clipped past the viewport's left edge/,
    );
  });

  test("accepts only an entirely visible reaction pair and ratio bar", () => {
    const inBoundsLike = box(10, 700, 80, 40);
    const inBoundsDislike = box(90, 700, 85, 40);
    const container = box(10, 744, 165, 2);

    expect(assertWatchRatioViewportAlignment(container, inBoundsLike, inBoundsDislike, viewport)).toEqual({
      nativeControlsAreHorizontallyClipped: false,
      nativeLeft: 10,
      nativeRight: 175,
    });
  });
});

describe("watch ratio surroundings", () => {
  const viewport = { height: 844, width: 390 };

  test("discovers visible non-reaction controls sharing the current top row", () => {
    document.body.innerHTML = `
      <div id="top-row">
        <button id="owner-action" type="button">Owner action</button>
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="top-level-buttons-computed">
            <segmented-like-dislike-button-view-model>
              <like-button-view-model><button type="button">Like</button></like-button-view-model>
              <dislike-button-view-model><button type="button">Dislike</button></dislike-button-view-model>
            </segmented-like-dislike-button-view-model>
            <button-view-model><button type="button">Save</button></button-view-model>
            <div class="ryd-tooltip"><div class="ryd-tooltip-bar-container"></div></div>
          </div>
        </ytd-menu-renderer>
      </div>`;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: viewport.width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: viewport.height });
    const setBox = (selector, measurement) => {
      document.querySelector(selector).getBoundingClientRect = () => ({
        ...measurement,
        bottom: measurement.y + measurement.height,
        left: measurement.x,
        right: measurement.x + measurement.width,
        top: measurement.y,
      });
    };
    setBox("#top-row", box(-26, 690, 427, 154));
    setBox("#owner-action", box(-20, 700, 40, 40));
    setBox("like-button-view-model button", box(12, 700, 90, 40));
    setBox("dislike-button-view-model button", box(102, 700, 90, 40));
    setBox("button-view-model button", box(20, 754, 96, 40));
    setBox(".ryd-tooltip-bar-container", box(12, 742, 180, 20));

    expect(readWatchRatioSurroundings(document.querySelector(".ryd-tooltip"))).toEqual({
      hitArea: box(12, 742, 180, 20),
      nearbyActions: [box(20, 754, 96, 40)],
      topRow: box(-26, 690, 427, 154),
    });
  });

  test("rejects a second-row action that encroaches on the ratio bar hit area", () => {
    const surroundings = {
      hitArea: box(12, 742, 180, 20),
      nearbyActions: [box(20, 754, 96, 40)],
      topRow: box(0, 690, 390, 154),
    };

    expect(() => assertWatchRatioSurroundings(surroundings, viewport)).toThrow(
      /Watch nearby action 1 overlaps the ratio bar hit area/,
    );
  });

  test("rejects a partially visible adjacent action", () => {
    const surroundings = {
      hitArea: box(12, 742, 180, 20),
      nearbyActions: [box(370, 700, 48, 40)],
      topRow: box(0, 690, 390, 154),
    };

    expect(() => assertWatchRatioSurroundings(surroundings, viewport)).toThrow(
      /Watch nearby action 1 is clipped past the viewport's right edge/,
    );
  });

  test("accepts separated in-viewport controls", () => {
    const surroundings = {
      hitArea: box(12, 742, 180, 20),
      nearbyActions: [box(210, 700, 80, 40)],
      topRow: box(-26, 690, 427, 154),
    };

    expect(assertWatchRatioSurroundings(surroundings, viewport)).toBe(surroundings);
  });
});

describe("watch ratio appearance", () => {
  test("uses the runtime number locale rather than the YouTube document language for tooltip expectations", () => {
    const numberFormat = jest.spyOn(Intl, "NumberFormat").mockImplementation(() => ({
      resolvedOptions: () => ({ locale: "en-US" }),
    }));
    document.documentElement.lang = "ru-RU";
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    document.body.innerHTML = `
      <div class="ryd-tooltip" data-ryd-video-id="abcdefghijk">
        <div id="return-youtube-dislike-bar-container" style="background: rgb(115, 115, 115)">
          <div id="return-youtube-dislike-bar" style="width: 75%"></div>
        </div>
        <div id="ryd-dislike-tooltip">48,515 / 13</div>
      </div>`;
    const wrapper = document.querySelector(".ryd-tooltip");
    const container = document.querySelector("#return-youtube-dislike-bar-container");
    const bar = document.querySelector("#return-youtube-dislike-bar");
    container.getBoundingClientRect = () => ({ bottom: 102, height: 2, left: 0, right: 200, top: 100 });
    bar.getBoundingClientRect = () => ({ bottom: 102, height: 2, left: 0, right: 150, top: 100 });

    try {
      const appearance = readWatchRatioAppearance(wrapper, {
        bar: "#return-youtube-dislike-bar",
        container: "#return-youtube-dislike-bar-container",
        tooltip: "#ryd-dislike-tooltip",
      });

      expect(appearance.numberLocale).toBe("en-US");
      expect(appearance.numberLocale).not.toBe(document.documentElement.lang);
      expect(appearance.tooltipText).toBe("48,515 / 13");
    } finally {
      numberFormat.mockRestore();
    }
  });
});

describe("Watch action-topology assertions", () => {
  test("discovers current flexible action siblings without mistaking them for More buttons", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="abcdefghijk">
        <div id="top-row">
          <ytd-menu-renderer class="ytd-watch-metadata">
            <div id="top-level-buttons-computed">
              <segmented-like-dislike-button-view-model>
                <like-button-view-model><button aria-label="Like"></button></like-button-view-model>
                <dislike-button-view-model><button aria-label="Dislike"></button></dislike-button-view-model>
              </segmented-like-dislike-button-view-model>
              <yt-button-view-model><button aria-label="Share"><span role="text">Share</span></button></yt-button-view-model>
            </div>
            <div id="flexible-item-buttons">
              <yt-button-view-model><button aria-label="Add to playlist"><span role="text">Save</span></button></yt-button-view-model>
              <yt-button-view-model><button aria-label="Thanks"><span role="text">Thanks</span></button></yt-button-view-model>
            </div>
            <yt-button-shape><button aria-label="More actions"></button></yt-button-shape>
          </ytd-menu-renderer>
        </div>
      </ytd-watch-flexy>`;
    const topRow = document.querySelector("#top-row");
    for (const element of document.querySelectorAll("*")) {
      element.getBoundingClientRect = () => ({
        bottom: 140,
        height: 40,
        left: 10,
        right: 110,
        top: 100,
        width: 100,
        x: 10,
        y: 100,
      });
    }

    const topology = readWatchTopRowTopology(topRow, "abcdefghijk");

    expect(topology.counts).toMatchObject({
      dislikeButtons: 1,
      likeButtons: 1,
      moreButtons: 1,
      reactionGroups: 1,
    });
    expect(topology.topLevelOptionalSignatures).toEqual(["Share", "Save", "Thanks"]);
  });

  function validTopology() {
    return {
      boxes: {
        actionSurface: box(600, 520, 500, 50),
        dislikeButton: box(680, 525, 80, 40),
        likeButton: box(600, 525, 80, 40),
        menu: box(590, 510, 570, 70),
        moreButton: box(1110, 525, 40, 40),
        reactionGroup: box(600, 525, 160, 40),
        topLevelActionHosts: [box(770, 525, 80, 40)],
        topRow: box(10, 500, 1180, 100),
      },
      counts: {
        dislikeButtons: 1,
        likeButtons: 1,
        moreButtons: 1,
        reactionGroups: 1,
        visibleCurrentWatchRoots: 1,
        visibleMenus: 1,
        visibleOverflowMenus: 1,
        visibleSurfaces: 1,
        visibleTopRows: 1,
      },
      inventorySignatures: ["Report", "Save", "Share"],
      overflowBox: box(850, 200, 250, 180),
      overflowItemBoxes: [box(860, 210, 230, 50), box(860, 270, 230, 50)],
      overflowSignatures: ["Save", "Report"],
      topLevelOptionalSignatures: ["Share"],
      videoId: "abcdefghijk",
      videoMatches: true,
      viewport: { height: 800, width: 1200 },
    };
  }

  function createActionTopologyDriver({ keyboardOpensPopup = true, pointerOpensPopup = true } = {}) {
    const topology = validTopology();
    let popupVisible = false;
    const reportProgress = jest.fn();
    const actionable = {
      centerHitTarget: true,
      centerInViewport: true,
      connected: true,
      enabled: true,
      visible: true,
    };
    const moreButton = {
      click: jest.fn(async (options) => {
        if (!options?.force) throw new Error("simulated stability timeout");
        if (pointerOpensPopup) popupVisible = true;
      }),
      evaluate: jest.fn(async (callback) => (callback === readElementActionability ? actionable : true)),
      focus: jest.fn(async () => undefined),
      isEnabled: jest.fn(async () => true),
      isVisible: jest.fn(async () => true),
      press: jest.fn(async (key) => {
        if (key === "Enter" && keyboardOpensPopup) popupVisible = true;
      }),
    };
    const menuButtons = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => moreButton),
    };
    const menu = {
      count: jest.fn(async () => 1),
      isVisible: jest.fn(async () => true),
      locator: jest.fn(() => menuButtons),
      nth: jest.fn(() => menu),
    };
    const topRow = {
      evaluate: jest.fn(async (callback) =>
        callback === readElementActionability
          ? actionable
          : {
              boxes: topology.boxes,
              counts: topology.counts,
              topLevelOptionalSignatures: topology.topLevelOptionalSignatures,
              videoId: topology.videoId,
              videoMatches: topology.videoMatches,
            },
      ),
      isVisible: jest.fn(async () => true),
      locator: jest.fn(() => menu),
    };
    const topRows = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => topRow),
    };
    const watchRoot = { isVisible: jest.fn(async () => true), locator: jest.fn(() => topRows) };
    const watchRoots = {
      count: jest.fn(async () => 1),
      nth: jest.fn(() => watchRoot),
    };
    const popup = {
      evaluate: jest.fn(async () => ({
        box: topology.overflowBox,
        itemBoxes: topology.overflowItemBoxes,
        signatures: topology.overflowSignatures,
      })),
      isVisible: jest.fn(async () => popupVisible),
    };
    const popups = {
      evaluateAll: jest.fn(async () => (popupVisible ? [0] : [])),
      nth: jest.fn(() => popup),
    };
    const page = {
      evaluate: jest.fn(async () => undefined),
      keyboard: {
        press: jest.fn(async () => {
          popupVisible = false;
        }),
      },
      locator: jest.fn((selector) =>
        selector.startsWith('ytd-watch-flexy[video-id="abcdefghijk"]') ? watchRoots : popups,
      ),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      url: jest.fn(() => "https://www.youtube.com/watch?v=abcdefghijk"),
    };
    const driver = new LiveYoutubeDriver(page, {}, { reportProgress });
    driver.inspectWatchRatioVisual = jest.fn(async () => ({}));
    driver.readViewportSize = jest.fn(async () => topology.viewport);

    return { driver, moreButton, page, reportProgress, topology };
  }

  test("opens More through independent hit testing without Playwright stability scrolling", async () => {
    const { driver, moreButton, page, topology } = createActionTopologyDriver();

    await expect(driver.inspectWatchActionTopology("extension", { presenceTimeoutMs: 100 })).resolves.toMatchObject({
      inventorySignatures: topology.inventorySignatures,
      overflowActivation: "pointer",
      overflowSignatures: topology.overflowSignatures,
      topLevelOptionalSignatures: topology.topLevelOptionalSignatures,
    });

    expect(moreButton.click).toHaveBeenCalledWith({ force: true, timeout: 100 });
    expect(moreButton.focus).not.toHaveBeenCalled();
    expect(moreButton.press).not.toHaveBeenCalled();
    expect(page.keyboard.press).toHaveBeenCalledWith("Escape");
  });

  test("re-resolves More and retries once with a hit-tested keyboard activation when YouTube ignores the pointer click", async () => {
    const { driver, moreButton, page, reportProgress, topology } = createActionTopologyDriver({
      pointerOpensPopup: false,
    });

    await expect(driver.inspectWatchActionTopology("extension", { presenceTimeoutMs: 250 })).resolves.toMatchObject({
      inventorySignatures: topology.inventorySignatures,
      overflowActivation: "keyboard-retry",
      overflowSignatures: topology.overflowSignatures,
    });

    expect(moreButton.click).toHaveBeenCalledTimes(1);
    expect(moreButton.focus).toHaveBeenCalledTimes(1);
    expect(moreButton.press).toHaveBeenCalledWith("Enter", { timeout: 250 });
    expect(
      page.locator.mock.calls.filter(([selector]) => selector.startsWith('ytd-watch-flexy[video-id="abcdefghijk"]')),
    ).toHaveLength(2);
    expect(reportProgress).toHaveBeenCalledWith(
      "watch-action-topology.more-menu.retrying",
      expect.objectContaining({ runtime: "extension", videoId: "abcdefghijk" }),
    );
  });

  test("fails after the single Watch More retry instead of hiding a persistently broken native menu", async () => {
    const { driver, moreButton } = createActionTopologyDriver({
      keyboardOpensPopup: false,
      pointerOpensPopup: false,
    });

    await expect(driver.inspectWatchActionTopology("extension", { presenceTimeoutMs: 250 })).rejects.toThrow(
      /hit-tested pointer activation or its single keyboard retry/,
    );

    expect(moreButton.click).toHaveBeenCalledTimes(1);
    expect(moreButton.focus).toHaveBeenCalledTimes(1);
    expect(moreButton.press).toHaveBeenCalledTimes(1);
  });

  test("accepts one complete, accessible, non-overlapping action topology", () => {
    const snapshot = validTopology();

    expect(() =>
      assertWatchActionTopologySnapshot(snapshot, {
        expectedInventorySignatures: ["Share", "Save", "Report"],
        expectedTopLevelOptionalSignatures: ["Share"],
        minimumTopLevelOptionalActions: 1,
      }),
    ).not.toThrow();
  });

  test("accepts YouTube's four-pixel menu-shell overhang while keeping actionable controls inside", () => {
    const snapshot = validTopology();
    snapshot.boxes.menu.width = 604;

    expect(() => assertWatchActionTopologySnapshot(snapshot)).not.toThrow();
  });

  test("rejects a menu shell that overhangs the top row by more than five pixels", () => {
    const snapshot = validTopology();
    snapshot.boxes.menu.width = 606;

    expect(() => assertWatchActionTopologySnapshot(snapshot)).toThrow(/Watch action menu escapes the top row/);
  });

  test("does not apply the menu-shell tolerance to the actionable More button", () => {
    const snapshot = validTopology();
    snapshot.boxes.moreButton.x = 1153;

    expect(() => assertWatchActionTopologySnapshot(snapshot)).toThrow(/More-actions button escapes the top row/);
  });

  test("rejects the former false-green state where every wide optional action is hidden", () => {
    const snapshot = validTopology();
    snapshot.topLevelOptionalSignatures = [];
    snapshot.overflowSignatures = ["Share", "Save", "Report"];

    expect(() => assertWatchActionTopologySnapshot(snapshot, { minimumTopLevelOptionalActions: 1 })).toThrow(
      /at least 1 optional action/,
    );
  });

  test("rejects an action duplicated across top level and More", () => {
    const snapshot = validTopology();
    snapshot.overflowSignatures = ["Share", "Save", "Report"];
    snapshot.inventorySignatures = ["Report", "Save", "Share", "Share"];

    expect(() => assertWatchActionTopologySnapshot(snapshot)).toThrow(/both at top level and in the More menu/);
  });

  test("rejects an action missing after a width change", () => {
    const snapshot = validTopology();
    snapshot.overflowSignatures = ["Report"];
    snapshot.inventorySignatures = ["Report", "Share"];

    expect(() =>
      assertWatchActionTopologySnapshot(snapshot, {
        expectedInventorySignatures: ["Report", "Save", "Share"],
      }),
    ).toThrow(/disappeared or duplicated while the layout changed/);
  });

  test.each([
    ["stale current root", (snapshot) => (snapshot.videoMatches = false), /stale video root/],
    [
      "clipped More button",
      (snapshot) => {
        snapshot.boxes.moreButton.x = 1190;
      },
      /More-actions button is clipped/,
    ],
    [
      "overlapping optional action",
      (snapshot) => {
        snapshot.boxes.topLevelActionHosts[0].x = 740;
      },
      /top-row controls 1 and 2 overlap/,
    ],
    [
      "clipped overflow menu",
      (snapshot) => {
        snapshot.overflowBox.x = 1100;
      },
      /More-actions menu is clipped/,
    ],
    [
      "overlapping overflow items",
      (snapshot) => {
        snapshot.overflowItemBoxes[1].y = 250;
      },
      /More-actions items 1 and 2 overlap/,
    ],
  ])("rejects a %s", (_label, mutate, expected) => {
    const snapshot = validTopology();
    mutate(snapshot);
    expect(() => assertWatchActionTopologySnapshot(snapshot)).toThrow(expected);
  });
});

describe("assertReactionPressedStates", () => {
  test.each([
    ["neutral", { dislikeState: "false", likeState: "false" }],
    ["liked", { dislikeState: "false", likeState: "true" }],
    ["disliked", { dislikeState: "true", likeState: "false" }],
  ])("accepts the exact mutually-exclusive %s state", (expectedState, pressedStates) => {
    expect(() => assertReactionPressedStates(pressedStates, expectedState)).not.toThrow();
  });

  test("rejects a valid but unexpected pressed state", () => {
    expect(() => assertReactionPressedStates({ dislikeState: "false", likeState: "true" }, "neutral")).toThrow(
      /Expected YouTube reaction state neutral/,
    );
  });

  test("rejects Like and Dislike being selected together", () => {
    expect(() => assertReactionPressedStates({ dislikeState: "true", likeState: "true" }, "liked")).toThrow(
      /Like and Dislike as selected/,
    );
  });

  test("rejects an invalid pressed-state value", () => {
    expect(() => assertReactionPressedStates({ dislikeState: null, likeState: "false" }, "neutral")).toThrow(
      /Unexpected YouTube dislike state/,
    );
  });
});

describe("assertSyntheticShortsGeometry", () => {
  test("accepts the measured native Shorts action geometry", () => {
    expect(() => assertSyntheticShortsGeometry(validSyntheticShortsGeometry())).not.toThrow();
  });

  test("accepts a centered host widened by a localized count", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsControlForLocalizedCount(measurement.like);
    widenShortsControlForLocalizedCount(measurement.synthetic);

    expect(() => assertSyntheticShortsGeometry(measurement)).not.toThrow();
  });

  test("accepts the real 51.6125px count-driven shell while preserving native Like control parity", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsControlForLocalizedCount(measurement.synthetic, {
      countWidth: 39.6125,
      shellWidth: 51.6125,
    });

    expect(() => assertSyntheticShortsGeometry(measurement)).not.toThrow();
  });

  test("accepts the exact Next-hop rail width when a native peer establishes the 51.6125px column", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsControlForLocalizedCount(measurement.synthetic, { countWidth: 7, shellWidth: 51.6125 });
    measurement.nativeActionHosts.push(box(98.19375, 244, 51.6125, 78));

    expect(() => assertSyntheticShortsGeometry(measurement)).not.toThrow();
  });

  test("rejects a 51.6125px shell with a short count when every native action remains 48px", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsControlForLocalizedCount(measurement.synthetic, { countWidth: 7, shellWidth: 51.6125 });

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/content-aware maximum of 48px/);
  });

  test("uses the measured fractional native Like button width instead of assuming 48px", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsButtonAroundCenter(measurement.like, 51.6125);
    widenShortsButtonAroundCenter(measurement.synthetic, 51.6125);
    widenShortsControlForLocalizedCount(measurement.like, { countWidth: 39.6125, shellWidth: 51.6125 });
    widenShortsControlForLocalizedCount(measurement.synthetic, { countWidth: 39.6125, shellWidth: 51.6125 });

    expect(() => assertSyntheticShortsGeometry(measurement)).not.toThrow();
  });

  test("rejects a synthetic button width that diverges from a fractional native Like control", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsButtonAroundCenter(measurement.like, 51.6125);
    widenShortsControlForLocalizedCount(measurement.like, { countWidth: 39.6125, shellWidth: 51.6125 });

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/button width parity with native Like/);
  });

  test.each([
    ["icon container", "icon"],
    ["SVG", "svg"],
  ])("rejects an 8px-wide synthetic %s", (_label, property) => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic[property].width = 8;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(
      new RegExp(`Synthetic Shorts ${property === "svg" ? "SVG" : "icon container"} width`),
    );
  });

  test("rejects a synthetic action host with a 16px margin", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.hostStyle.marginTop = 16;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/Synthetic Shorts action host marginTop/);
  });

  test("rejects a gap between Like and the synthetic action", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.host.y += 16;
    measurement.next.host.y += 16;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(
      /Gap between native Like and synthetic Shorts action hosts/,
    );
  });

  test("rejects a gap between the synthetic and following actions", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.next.host.y += 2;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(
      /Gap between synthetic Shorts and following action hosts/,
    );
  });

  test.each([
    ["button", "width", 44, /Synthetic Shorts button width/],
    ["label", "height", 68, /Synthetic Shorts label height/],
    ["host", "height", 80, /Synthetic Shorts action host height/],
  ])("rejects a mismatched synthetic %s %s", (part, dimension, value, message) => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic[part][dimension] = value;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(message);
  });

  test("rejects incorrect action-host padding", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.hostStyle.paddingBottom = 0;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/Synthetic Shorts action host paddingBottom/);
  });

  test.each([
    ["fontSize", 14, /Synthetic Shorts count font-size/],
    ["lineHeight", 16, /Synthetic Shorts count line-height/],
    ["fontFamily", "Arial", /Synthetic Shorts count fontFamily/],
  ])("rejects mismatched count %s", (property, value, message) => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.countStyle[property] = value;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(message);
  });

  test("rejects a control that is off the native action-column center", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.button.x += 2;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/Synthetic Shorts button horizontal center/);
  });

  test("rejects a host and label that are centered but much wider than their rendered content", () => {
    const measurement = validSyntheticShortsGeometry();
    widenShortsControlForLocalizedCount(measurement.synthetic, { shellWidth: 96 });

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(/content-aware maximum/);
  });

  test("rejects an overlapping synthetic action even when its internal geometry remains valid", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.host.y -= 4;

    expect(() => assertSyntheticShortsGeometry(measurement)).toThrow(
      /Gap between native Like and synthetic Shorts action hosts/,
    );
  });

  test("allows a one-pixel fractional rendering difference", () => {
    const measurement = validSyntheticShortsGeometry();
    measurement.synthetic.button.width = 47;
    measurement.synthetic.svg.height = 24.75;
    measurement.next.host.x = 101;

    expect(() => assertSyntheticShortsGeometry(measurement)).not.toThrow();
  });
});

describe("assertNativeShortsPairGeometry", () => {
  test("accepts an exact active native Like/Dislike action pair", () => {
    expect(() => assertNativeShortsPairGeometry(validNativeShortsPairGeometry())).not.toThrow();
  });

  test("accepts a native Dislike host widened by a localized count", () => {
    const measurement = validNativeShortsPairGeometry();
    widenShortsControlForLocalizedCount(measurement.dislike);

    expect(() => assertNativeShortsPairGeometry(measurement)).not.toThrow();
  });

  test("rejects controls selected from different retained Shorts reels", () => {
    const measurement = validNativeShortsPairGeometry();
    measurement.dislike.reelIndex = 1;

    expect(() => assertNativeShortsPairGeometry(measurement)).toThrow(/belong to different reels/);
  });

  test("rejects a native Dislike that is not immediately after Like", () => {
    const measurement = validNativeShortsPairGeometry();
    measurement.dislike.actionIndex += 1;

    expect(() => assertNativeShortsPairGeometry(measurement)).toThrow(/not immediately after Like/);
  });

  test("rejects a shrunken native Dislike icon", () => {
    const measurement = validNativeShortsPairGeometry();
    measurement.dislike.icon.width = 8;

    expect(() => assertNativeShortsPairGeometry(measurement)).toThrow(/Native Shorts Dislike icon container width/);
  });

  test("rejects broken native action-stack spacing", () => {
    const measurement = validNativeShortsPairGeometry();
    measurement.dislike.host.y += 12;

    expect(() => assertNativeShortsPairGeometry(measurement)).toThrow(
      /Gap between native Shorts Like and Dislike action hosts/,
    );
  });

  test("rejects native Dislike count typography that diverges from Like", () => {
    const measurement = validNativeShortsPairGeometry();
    measurement.dislike.countStyle.fontFamily = "Comic Sans MS";

    expect(() => assertNativeShortsPairGeometry(measurement)).toThrow(/count fontFamily does not match/);
  });
});

describe("live Shorts full-stack visual readiness", () => {
  const viewport = { height: 844, width: 390 };
  const validStack = () => [0, 1, 2, 3, 4].map((index) => box(330, 100 + index * 78, 48, 78));

  test("accepts five aligned visible controls and painted icons", () => {
    expect(() => assertShortsActionStackGeometry(validStack(), viewport)).not.toThrow();
    expect(
      isShortsIconVisualReady({
        effectiveOpacity: 1,
        paintedGraphicCount: 1,
        rendered: true,
        svgHeight: 24,
        svgPresent: true,
        svgWidth: 24,
      }),
    ).toBe(true);
  });

  test("rejects an incomplete Shorts stack", () => {
    expect(() => assertShortsActionStackGeometry(validStack().slice(0, 4), viewport)).toThrow(
      /full Shorts action stack/,
    );
  });

  test("rejects a misaligned or clipped control", () => {
    const misaligned = validStack();
    misaligned[3].x -= 8;
    expect(() => assertShortsActionStackGeometry(misaligned, viewport)).toThrow(/horizontal center/);

    const clipped = validStack();
    clipped[4].y = 800;
    expect(() => assertShortsActionStackGeometry(clipped, viewport)).toThrow(/bottom edge/);
  });

  test.each([
    [
      "unhydrated SVG",
      { effectiveOpacity: 1, paintedGraphicCount: 0, rendered: true, svgHeight: 24, svgPresent: true, svgWidth: 24 },
    ],
    [
      "missing SVG",
      { effectiveOpacity: 1, paintedGraphicCount: 0, rendered: true, svgHeight: 0, svgPresent: false, svgWidth: 0 },
    ],
    [
      "zero-width SVG",
      { effectiveOpacity: 1, paintedGraphicCount: 1, rendered: true, svgHeight: 24, svgPresent: true, svgWidth: 0 },
    ],
    [
      "zero-height SVG",
      { effectiveOpacity: 1, paintedGraphicCount: 1, rendered: true, svgHeight: 0, svgPresent: true, svgWidth: 24 },
    ],
    [
      "hidden ancestor",
      { effectiveOpacity: 0, paintedGraphicCount: 1, rendered: true, svgHeight: 24, svgPresent: true, svgWidth: 24 },
    ],
    [
      "non-rendered ancestor",
      { effectiveOpacity: 1, paintedGraphicCount: 1, rendered: false, svgHeight: 24, svgPresent: true, svgWidth: 24 },
    ],
  ])("does not screenshot a %s as a ready icon", (_label, state) => {
    expect(isShortsIconVisualReady(state)).toBe(false);
  });
});
