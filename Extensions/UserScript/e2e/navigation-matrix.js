const { expect } = require("@playwright/test");
const { assertInvariantContinuously, waitForStableInvariant } = require("../../e2e/continuous-invariants");
const { assertExactSuccessfulVotesTraffic } = require("../../e2e/hermetic-api-contract");
const { VIDEO_A, VIDEO_B } = require("./harness");

const SINGLE_DESTINATION_DISLIKE_POSTCONDITION = "single-destination-dislike";
const NO_DESTINATION_DISLIKE_POSTCONDITION = "no-destination-dislike";

function expectedDislikeText(counts, delta = 0) {
  if (delta === 0 && typeof counts.displayedDislikes === "string") return counts.displayedDislikes;
  if (delta === 1 && typeof counts.displayedDislikesAfterIncrement === "string") {
    return counts.displayedDislikesAfterIncrement;
  }
  return String(counts.dislikes + delta);
}

function expectedTooltipText({ dislikes, likes }) {
  return `${likes.toLocaleString("en-US")} / ${dislikes.toLocaleString("en-US")}`;
}

const WATCH_SIDEBAR_MATRIX = [
  {
    coverage: {
      destination: "shorts",
      dom: ["preloaded-sibling", "active-reel-switch"],
      origin: "shorts",
      timing: ["settled"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "short-next-short-active-reel",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "incomplete-rendered-native-inventory",
        "non-rendered-native-action",
        "persistent-data-null-action-root",
        "stable-action-root-geometry",
      ],
      origin: "shorts",
      timing: ["navigate-start-without-finish", "data-null-past-watchdog", "inert-beyond-fallback-window"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      videoId: VIDEO_B,
    },
    id: "short-next-short-persistent-data-null-nonrendered-native-stays-inert",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: NO_DESTINATION_DISLIKE_POSTCONDITION,
    timing: { inertForMs: 1_700 },
    transition: {
      actionRoot: "replace-incomplete-rendered-native-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "native-dislike-present",
        "no-synthetic-mutation",
        "persistent-data-null-action-root",
      ],
      origin: "shorts",
      timing: [
        "navigate-start-without-finish",
        "native-dislike-after-stability",
        "native-dislike-without-synthetic-mutation",
      ],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      shortsDislikeControl: "native",
      videoId: VIDEO_B,
    },
    id: "short-next-short-persistent-data-null-native-dislike",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    timing: { maxFirstValidMs: 2_500, unsafeWindowMs: 520 },
    transition: {
      actionRoot: "replace-native-dislike-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: ["preloaded-sibling", "active-reel-switch"],
      origin: "shorts",
      timing: ["settled"],
      trigger: "next-control",
      width: "medium-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "short-next-short-active-reel-medium",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 768 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: ["preloaded-sibling", "active-reel-switch"],
      origin: "shorts",
      timing: ["settled"],
      trigger: "next-control",
      width: "compact",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "short-next-short-active-reel-compact",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 844, width: 390 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: ["reuse-exact-renderer", "reuse-exact-action-root", "exact-href-identity", "no-is-active"],
      origin: "shorts",
      timing: ["navigate-start-without-finish"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      videoId: VIDEO_B,
    },
    id: "short-next-short-reuse-renderer-start-no-finish",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { actionRoot: "reuse-exact-node", navigateFinish: "none", renderer: "reuse-exact-node" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "reuse-exact-renderer",
        "reuse-exact-action-root",
        "exact-href-identity",
        "unrelated-description-short-link",
        "no-is-active",
        "no-video-id",
      ],
      origin: "shorts",
      timing: ["navigate-start-without-finish"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      unrelatedDescriptionShortVideoId: "FupY92jTfho",
      videoId: VIDEO_B,
    },
    id: "short-next-short-exact-href-with-description-crosslink",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { actionRoot: "reuse-exact-node", navigateFinish: "none", renderer: "reuse-exact-node" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "reuse-exact-renderer",
        "reuse-exact-action-root",
        "remove-synthetic-before-route",
        "exact-href-identity",
        "no-is-active",
      ],
      origin: "shorts",
      timing: ["repeated-navigate-start", "navigate-start-without-finish"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      videoId: VIDEO_B,
    },
    id: "short-next-short-reuse-renderer-repeated-start-no-finish",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: {
      actionRoot: "reuse-exact-node",
      navigateFinish: "none",
      navigateStarts: "before-and-after-route",
      renderer: "reuse-exact-node",
      syntheticDislike: "remove-before-route",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "complete-native-inventory",
        "persistent-data-null-action-root",
      ],
      origin: "shorts",
      timing: ["navigate-start-without-finish", "data-null-past-watchdog", "stable-native-inventory"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      videoId: VIDEO_B,
    },
    id: "short-next-short-reuse-renderer-replace-action-root-exact-href-persistent-data-null",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    timing: { maxFirstValidMs: 2_500, unsafeWindowMs: 520 },
    transition: {
      actionRoot: "replace-complete-native-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "replace-shorts-root",
        "destination-action-root-absent",
        "staged-data-null-action-root",
        "complete-native-inventory-before-hydration",
      ],
      origin: "shorts",
      timing: ["navigate-start-without-finish", "no-controls-over-500ms", "data-null-over-stability-window"],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "short-next-short-replace-root-start-no-finish-staged-hydration",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: {
      actionRoot: "absent-then-empty-then-native-then-hydrated",
      navigateFinish: "none",
      navigateStarts: "before-route",
      root: "replace",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: [
        "replace-shorts-root",
        "destination-action-root-absent",
        "staged-data-null-action-root",
        "complete-native-inventory-before-hydration",
      ],
      origin: "shorts",
      timing: [
        "repeated-navigate-start",
        "navigate-start-without-finish",
        "no-controls-over-500ms",
        "data-null-over-stability-window",
      ],
      trigger: "next-control",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "short-next-short-replace-root-repeated-start-no-finish-staged-hydration",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: {
      actionRoot: "absent-then-empty-then-native-then-hydrated",
      navigateFinish: "none",
      navigateStarts: "before-and-after-route",
      root: "replace",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["retain-hidden-outgoing", "replace-controls", "prune-current-bar"],
      origin: "watch",
      timing: ["finish-before-hydration", "destination-count-gated"],
      trigger: "sidebar-link",
      width: "wide-desktop",
    },
    id: "watch-sidebar-watch-retain-prune",
    destination: {
      counts: { dislikes: 300, likes: 100 },
      kind: "watch",
      videoId: VIDEO_B,
    },
    origin: {
      counts: { dislikes: 100, likes: 300 },
      kind: "watch",
      state: "neutral",
      videoId: VIDEO_A,
    },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    timing: {
      destinationCount: "gated",
      navigateFinish: "before-destination-controls",
    },
    transition: {
      destinationControls: "replace",
      outgoing: "retain-hidden-top-row",
      postInit: "prune-current-rate-bar",
      trigger: "persistent-sidebar-link",
    },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: [
        "same-current-root",
        "reuse-exact-control-nodes",
        "no-useful-control-mutation",
        "same-compact-dislike-text",
        "different-exact-dislike-count",
        "different-rate-bar-ratio",
      ],
      origin: "watch",
      timing: ["navigate-finish", "destination-count-gated"],
      trigger: "sidebar-link",
      width: "wide-desktop",
    },
    destination: {
      counts: {
        dislikes: 1_409,
        displayedDislikes: "1.4K",
        displayedDislikesAfterIncrement: "1.4K",
        likes: 3_591,
      },
      kind: "watch",
      videoId: VIDEO_B,
    },
    id: "watch-sidebar-watch-same-node-route-complete",
    origin: {
      counts: { dislikes: 1_401, displayedDislikes: "1.4K", likes: 8_599 },
      kind: "watch",
      state: "neutral",
      videoId: VIDEO_A,
    },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { controls: "reuse-exact-nodes", nativeControlMutations: "none" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: [
        "connected-hidden-rate-bar",
        "connected-collapsed-rate-bar",
        "malformed-rate-bar",
        "missing-rate-bar-video-owner",
        "stale-rate-bar-video-owner",
        "stripped-rate-bar-wrapper-class",
      ],
      origin: "watch",
      timing: ["same-video", "no-navigation-event"],
      trigger: "dom-corruption",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 100, likes: 300 }, kind: "watch", videoId: VIDEO_A },
    id: "watch-current-rate-bar-connected-corruption",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: {
      corruptions: [
        "hidden-wrapper",
        "collapsed-wrapper",
        "missing-fill",
        "missing-video-owner",
        "stale-video-owner",
        "stripped-wrapper-class",
      ],
    },
    viewport: { height: 720, width: 1280 },
  },
];

const NAVIGATION_MATRIX = [
  ...WATCH_SIDEBAR_MATRIX,
  {
    coverage: {
      destination: "watch",
      dom: ["same-current-root", "hidden-outgoing-first", "rendered-destination-second"],
      origin: "watch",
      timing: ["settled"],
      trigger: "sidebar-link",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-sidebar-watch-same-root-hidden-first",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { outgoingPresentation: "hidden" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["same-current-root", "positive-size-offscreen-outgoing-first", "rendered-destination-second"],
      origin: "watch",
      timing: ["settled"],
      trigger: "sidebar-link",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-sidebar-watch-same-root-offscreen-first",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { outgoingPresentation: "offscreen" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: [
        "same-current-root",
        "hidden-outgoing-first",
        "rendered-destination-second",
        "legacy-segmented-duplicate-ids",
      ],
      origin: "watch",
      timing: ["settled"],
      trigger: "sidebar-link",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-sidebar-watch-legacy-segmented-duplicate-ids",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    transition: { controlMarkup: "legacy-segmented", outgoingPresentation: "hidden" },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["replace-controls"],
      origin: "watch",
      timing: ["settled"],
      trigger: "history-back-forward",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-history-back-forward-replace",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["replace-page-and-controls"],
      origin: "watch",
      timing: ["no-navigate-finish"],
      trigger: "autoplay-ended",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-autoplay-watch-replace-no-finish",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["replace-page-and-controls-after-start"],
      origin: "watch",
      timing: ["navigate-start-without-finish"],
      trigger: "navigate-start-only",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "watch-navigate-start-watch-replace-no-finish",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "shorts",
      dom: ["replace-page-and-controls", "delayed-hydration"],
      origin: "watch",
      timing: ["finish-before-hydration"],
      trigger: "direct-link",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "shorts", videoId: VIDEO_B },
    id: "watch-direct-short-delayed",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    // 600ms fixture hydration + one 111ms discovery sample + three 111ms
    // samples to exceed 250ms native stability, with scheduler allowance.
    timing: { controlDelayMs: 600, maxFirstValidMs: 1_250 },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["replace-page-and-controls", "delayed-hydration"],
      origin: "shorts",
      timing: ["finish-before-hydration"],
      trigger: "direct-link",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 300, likes: 100 }, kind: "watch", videoId: VIDEO_B },
    id: "short-direct-watch-delayed",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "shorts", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    timing: { controlDelayMs: 600 },
    viewport: { height: 720, width: 1280 },
  },
  {
    coverage: {
      destination: "watch",
      dom: ["replace-current-action-container"],
      origin: "watch",
      timing: ["same-video", "no-navigation-event"],
      trigger: "dom-replacement",
      width: "wide-desktop",
    },
    destination: { counts: { dislikes: 100, likes: 300 }, kind: "watch", videoId: VIDEO_A },
    id: "watch-current-action-container-replace",
    origin: { counts: { dislikes: 100, likes: 300 }, kind: "watch", state: "neutral", videoId: VIDEO_A },
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
    viewport: { height: 720, width: 1280 },
  },
];

const USERSCRIPT_MATRIX_RUNTIME = {
  name: "userscript",
  selectors: {
    bar: "#return-youtube-dislike-bar",
    container: "#return-youtube-dislike-bar-container",
    tooltip: "#ryd-dislike-tooltip",
    wrapper: ".ryd-tooltip",
    shortsDislike: "[data-ryd-synthetic-shorts-dislike]",
    shortsVideoAttribute: "data-ryd-video-id",
    watchDislikeCount: "#text",
    wrapperVideoAttribute: "data-ryd-video-id",
  },
  tooltipText: expectedTooltipText,
};

const EXTENSION_MATRIX_RUNTIME = {
  clearsOutgoingWatchPresentationOnNavigateStart: true,
  name: "extension",
  selectors: {
    bar: "#ryd-bar",
    container: "#ryd-bar-container",
    tooltip: "#ryd-dislike-tooltip",
    wrapper: ".ryd-tooltip",
    shortsDislike: "[data-ryd-synthetic-shorts-dislike]",
    shortsVideoAttribute: "data-ryd-video-id",
    watchDislikeCount: "#text",
    wrapperVideoAttribute: "data-ryd-video-id",
  },
  tooltipText: expectedTooltipText,
};

async function installSidebarRetainPruneFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        if (!fixturePage || !globalThis.__navigationFixture) {
          throw new Error("The navigation matrix requires the navigation-page fixture.");
        }

        const retainedTrees = document.createElement("div");
        retainedTrees.hidden = true;
        retainedTrees.id = "fixture-matrix-retained-trees";
        // Keep the retained outgoing tree before the live page in document
        // order. This reproduces YouTube variants where a first-match query
        // resolves stale connected controls before the current rendered tree.
        fixturePage.before(retainedTrees);

        const sidebar = document.createElement("aside");
        sidebar.id = "fixture-matrix-sidebar";
        sidebar.setAttribute("aria-label", "Fixture sidebar");
        const destinationLink = document.createElement("a");
        destinationLink.id = "fixture-matrix-sidebar-watch";
        destinationLink.href = `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`;
        destinationLink.textContent = "Open sidebar video";
        sidebar.appendChild(destinationLink);
        fixturePage.before(sidebar);

        const transition = {
          destinationTopRow: null,
          documentIdentity: `matrix-${Date.now()}-${Math.random()}`,
          phase: "origin",
          timeline: [],
        };
        const record = (phase) => {
          transition.phase = phase;
          transition.timeline.push(phase);
        };

        destinationLink.addEventListener("click", (event) => {
          event.preventDefault();
          if (transition.phase !== "origin") throw new Error(`Cannot navigate from matrix phase ${transition.phase}.`);

          const watchPage = fixturePage.querySelector('[data-fixture-page-kind="watch"]');
          const outgoingTopRow = watchPage?.querySelector("#top-row");
          const watchFlexy = watchPage?.querySelector("ytd-watch-flexy");
          if (!watchPage || !outgoingTopRow || !watchFlexy) {
            throw new Error("The origin watch fixture is incomplete.");
          }

          const destinationTopRow = outgoingTopRow.cloneNode(true);
          destinationTopRow.removeAttribute("style");
          destinationTopRow.querySelectorAll(".ryd-tooltip").forEach((element) => element.remove());
          const destinationControls = destinationTopRow.querySelector("[data-fixture-control-video-id]");
          destinationControls.setAttribute("data-fixture-control-video-id", matrixScenario.destination.videoId);
          globalThis.__navigationFixture.setNativeLikeCount(destinationControls, matrixScenario.destination.videoId);
          for (const role of ["like", "dislike"]) {
            const control = destinationControls.querySelector(`[data-fixture-role="${role}"]`);
            control.classList.remove("style-default-active");
            control.classList.add("style-text");
            control.querySelector("button")?.setAttribute("aria-pressed", "false");
          }
          destinationControls
            .querySelectorAll(
              '[data-fixture-role="dislike"] .ytSpecButtonShapeNextButtonTextContent, [data-fixture-role="dislike"] #text',
            )
            .forEach((element) => element.remove());
          transition.destinationTopRow = destinationTopRow;

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          record("navigate-start");

          retainedTrees.appendChild(outgoingTopRow);
          history.pushState({}, "", `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`);
          watchPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
          watchFlexy.setAttribute("video-id", matrixScenario.destination.videoId);
          record("route-and-shell");

          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
          record("navigate-finish");
        });

        globalThis.__navigationMatrixFixture = {
          detachOutgoing() {
            retainedTrees.replaceChildren();
            record("detach-outgoing");
          },
          hydrateDestination() {
            if (transition.phase !== "navigate-finish" || !transition.destinationTopRow) {
              throw new Error(`Cannot hydrate the destination from matrix phase ${transition.phase}.`);
            }
            const watchPage = fixturePage.querySelector('[data-fixture-page-kind="watch"]');
            const watchFlexy = watchPage?.querySelector("ytd-watch-flexy");
            if (!watchFlexy) throw new Error("The destination Watch root is unavailable during hydration.");
            watchFlexy.appendChild(transition.destinationTopRow);
            transition.destinationTopRow = null;
            record("hydrate-destination-controls");
          },
          snapshot() {
            return {
              currentControls: fixturePage.querySelectorAll("[data-fixture-control-video-id]").length,
              documentIdentity: transition.documentIdentity,
              phase: transition.phase,
              retainedControls: retainedTrees.querySelectorAll("[data-fixture-control-video-id]").length,
              retainedTreesConnected: retainedTrees.isConnected,
              retainedTreesHidden: retainedTrees.hidden,
              sidebarConnected: sidebar.isConnected,
              timeline: [...transition.timeline],
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installSameRootHiddenFirstFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const watchPage = fixturePage?.querySelector('[data-fixture-page-kind="watch"]');
        const watchFlexy = watchPage?.querySelector("ytd-watch-flexy");
        const originTopRow = watchPage?.querySelector("#top-row");
        if (!fixturePage || !watchPage || !watchFlexy || !originTopRow) {
          throw new Error("The same-root matrix requires a complete watch fixture.");
        }
        if (matrixScenario.transition?.controlMarkup === "legacy-segmented") {
          const modernSegmented = originTopRow.querySelector("segmented-like-dislike-button-view-model");
          if (!modernSegmented) {
            throw new Error("The legacy segmented matrix could not find its source controls.");
          }
          const legacySegmented = document.createElement("ytd-segmented-like-dislike-button-renderer");
          for (const attribute of modernSegmented.attributes) {
            legacySegmented.setAttribute(attribute.name, attribute.value);
          }
          legacySegmented.style.cssText = "display:flex;gap:8px;min-height:48px;width:320px";
          while (modernSegmented.firstChild) {
            legacySegmented.appendChild(modernSegmented.firstChild);
          }
          const legacyLike = legacySegmented.querySelector('[data-fixture-role="like"]');
          const legacyDislike = legacySegmented.querySelector('[data-fixture-role="dislike"]');
          legacyLike.id = "segmented-like-button";
          legacyDislike.id = "segmented-dislike-button";
          for (const button of legacySegmented.querySelectorAll("button")) {
            button.style.cssText = "min-height:36px;min-width:96px";
          }
          modernSegmented.replaceWith(legacySegmented);
        }
        watchFlexy.appendChild(originTopRow);

        const sidebar = document.createElement("aside");
        sidebar.id = "fixture-matrix-same-root-sidebar";
        sidebar.setAttribute("aria-label", "Fixture same-root sidebar");
        const destinationLink = document.createElement("a");
        destinationLink.id = "fixture-matrix-same-root-watch";
        destinationLink.href = `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`;
        destinationLink.textContent = "Open same-root sidebar video";
        sidebar.appendChild(destinationLink);
        fixturePage.before(sidebar);

        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        destinationLink.addEventListener("click", (event) => {
          event.preventDefault();
          const outgoingTopRow = watchFlexy.querySelector("#top-row");
          if (!outgoingTopRow || outgoingTopRow.hasAttribute("data-fixture-matrix-hidden-outgoing")) {
            throw new Error("The same-root matrix origin is unavailable.");
          }

          const destinationTopRow = outgoingTopRow.cloneNode(true);
          destinationTopRow.removeAttribute("style");
          destinationTopRow.querySelectorAll(".ryd-tooltip").forEach((element) => element.remove());
          const destinationControls = destinationTopRow.querySelector("[data-fixture-control-video-id]");
          destinationControls.setAttribute("data-fixture-control-video-id", matrixScenario.destination.videoId);
          globalThis.__navigationFixture.setNativeLikeCount(destinationControls, matrixScenario.destination.videoId);
          for (const role of ["like", "dislike"]) {
            const control = destinationControls.querySelector(`[data-fixture-role="${role}"]`);
            control.classList.remove("style-default-active");
            control.classList.add("style-text");
            control.querySelector("button")?.setAttribute("aria-pressed", "false");
          }
          destinationControls
            .querySelectorAll(
              '[data-fixture-role="dislike"] .ytSpecButtonShapeNextButtonTextContent, [data-fixture-role="dislike"] #text',
            )
            .forEach((element) => element.remove());
          destinationTopRow.setAttribute("data-fixture-matrix-live-destination", "true");

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          if (matrixScenario.transition?.outgoingPresentation === "offscreen") {
            outgoingTopRow.style.setProperty("left", "-10000px", "important");
            outgoingTopRow.style.setProperty("position", "fixed", "important");
            outgoingTopRow.style.setProperty("top", "0", "important");
          } else {
            outgoingTopRow.hidden = true;
          }
          outgoingTopRow.setAttribute("data-fixture-matrix-hidden-outgoing", "true");
          history.pushState({}, "", `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`);
          watchPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
          watchFlexy.setAttribute("video-id", matrixScenario.destination.videoId);
          watchFlexy.appendChild(destinationTopRow);
          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
        });

        globalThis.__navigationMatrixSameRootFixture = {
          detachOutgoing() {
            watchFlexy.querySelector('[data-fixture-matrix-hidden-outgoing="true"]')?.remove();
          },
          snapshot() {
            const hiddenOutgoing = watchFlexy.querySelector('[data-fixture-matrix-hidden-outgoing="true"]');
            const liveDestination = watchFlexy.querySelector('[data-fixture-matrix-live-destination="true"]');
            const hiddenBox = hiddenOutgoing?.getBoundingClientRect();
            return {
              documentIdentity,
              hiddenFirst: Boolean(
                hiddenOutgoing &&
                  liveDestination &&
                  hiddenOutgoing.compareDocumentPosition(liveDestination) & Node.DOCUMENT_POSITION_FOLLOWING,
              ),
              hiddenOutgoingConnected: Boolean(hiddenOutgoing?.isConnected),
              hiddenOutgoingHeight: hiddenBox?.height ?? null,
              hiddenOutgoingWidth: hiddenBox?.width ?? null,
              outgoingIntersectsViewport: Boolean(
                hiddenBox &&
                  hiddenBox.width > 0 &&
                  hiddenBox.height > 0 &&
                  hiddenBox.bottom > 0 &&
                  hiddenBox.right > 0 &&
                  hiddenBox.top < innerHeight &&
                  hiddenBox.left < innerWidth,
              ),
              outgoingPresentation: matrixScenario.transition?.outgoingPresentation ?? "hidden",
              liveDestinationConnected: Boolean(liveDestination?.isConnected),
              rootVideoId: watchFlexy.getAttribute("video-id"),
              sameRoot: Boolean(
                hiddenOutgoing &&
                  liveDestination &&
                  hiddenOutgoing.closest("ytd-watch-flexy") === liveDestination.closest("ytd-watch-flexy"),
              ),
              sidebarConnected: sidebar.isConnected,
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installSameNodeRouteCompletionFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const watchPage = fixturePage?.querySelector('[data-fixture-page-kind="watch"]');
        const watchFlexy = watchPage?.querySelector("ytd-watch-flexy");
        const topRow = watchPage?.querySelector("#top-row");
        const buttons = topRow?.querySelector("#top-level-buttons-computed");
        const controls = buttons?.querySelector("[data-fixture-control-video-id]");
        const like = controls?.querySelector('[data-fixture-role="like"]');
        const dislike = controls?.querySelector('[data-fixture-role="dislike"]');
        if (!fixturePage || !watchPage || !watchFlexy || !topRow || !buttons || !controls || !like || !dislike) {
          throw new Error("The same-node matrix requires a complete watch fixture.");
        }
        watchFlexy.appendChild(topRow);

        const sidebar = document.createElement("aside");
        sidebar.id = "fixture-matrix-same-node-sidebar";
        sidebar.setAttribute("aria-label", "Fixture same-node sidebar");
        const destinationLink = document.createElement("a");
        destinationLink.id = "fixture-matrix-same-node-watch";
        destinationLink.href = `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`;
        destinationLink.textContent = "Open same-node sidebar video";
        sidebar.appendChild(destinationLink);
        fixturePage.before(sidebar);

        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        const timeline = [];
        let countAfterNavigateStart = null;
        let countAfterRouteAndRoot = null;
        destinationLink.addEventListener("click", (event) => {
          event.preventDefault();
          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          countAfterNavigateStart = dislike.querySelector("#text")?.textContent ?? null;
          timeline.push("navigate-start");

          history.pushState({}, "", `/watch?v=${matrixScenario.destination.videoId}&rydNavigationFixture=1`);
          watchPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
          watchFlexy.setAttribute("video-id", matrixScenario.destination.videoId);
          // This fixture-only marker lets the test address B. It is deliberately
          // outside the userscript observer's attribute filter and provides no
          // runtime ownership evidence.
          controls.setAttribute("data-fixture-control-video-id", matrixScenario.destination.videoId);
          countAfterRouteAndRoot = dislike.querySelector("#text")?.textContent ?? null;
          timeline.push("route-and-root-only");

          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
          timeline.push("navigate-finish");
        });

        globalThis.__navigationMatrixSameNodeFixture = {
          snapshot() {
            return {
              buttonsReused: buttons === watchFlexy.querySelector("#top-level-buttons-computed"),
              countAfterNavigateStart,
              countAfterRouteAndRoot,
              controlsReused: controls === watchFlexy.querySelector("[data-fixture-control-video-id]"),
              dislikeReused: dislike === watchFlexy.querySelector('[data-fixture-role="dislike"]'),
              documentIdentity,
              likeReused: like === watchFlexy.querySelector('[data-fixture-role="like"]'),
              rootVideoId: watchFlexy.getAttribute("video-id"),
              sidebarConnected: sidebar.isConnected,
              timeline: [...timeline],
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installSameRendererShortStartOnlyFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const shortsPage = fixturePage?.querySelector('[data-fixture-page-kind="shorts"]');
        const renderer = shortsPage?.querySelector(
          `ytd-reel-video-renderer[video-id="${matrixScenario.origin.videoId}"][is-active]`,
        );
        const actionBar = renderer?.querySelector("reel-action-bar-view-model");
        const like = actionBar?.querySelector('[data-fixture-role="like"]');
        const next = document.getElementById("short-next");
        if (!fixturePage || !shortsPage || !renderer || !actionBar || !like || !next) {
          throw new Error("The same-renderer Shorts matrix requires complete origin controls and a Next link.");
        }

        for (const sibling of shortsPage.querySelectorAll("ytd-reel-video-renderer")) {
          if (sibling !== renderer) sibling.remove();
        }

        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        const originRenderer = renderer;
        const originActionBar = actionBar;
        const originLike = like;
        const repeatedStart = matrixScenario.transition.navigateStarts === "before-and-after-route";
        const timeline = [];
        let immediatelyAfterRoute = null;
        let originSyntheticDislike = null;
        let originSyntheticNativeButton = null;

        next.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            originSyntheticDislike = actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]");
            originSyntheticNativeButton = originSyntheticDislike?.querySelector("button") ?? null;
            if (!originSyntheticDislike || !originSyntheticNativeButton) {
              throw new Error("The same-renderer Shorts matrix requires an initialized synthetic Dislike.");
            }

            document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
            timeline.push(repeatedStart ? "navigate-start-a" : "navigate-start");

            if (repeatedStart) {
              originSyntheticDislike.remove();
              timeline.push("synthetic-removed-before-route");
            }

            history.pushState({}, "", `/shorts/${matrixScenario.destination.videoId}?rydNavigationFixture=1`);
            shortsPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
            renderer.removeAttribute("video-id");
            renderer.removeAttribute("is-active");
            renderer.hidden = false;
            let identityLink = renderer.querySelector('a[href*="/shorts/"]');
            if (repeatedStart) {
              const destinationIdentityLink = identityLink?.cloneNode(true);
              if (!destinationIdentityLink) {
                throw new Error("The repeated-start Shorts matrix requires a canonical identity link.");
              }
              destinationIdentityLink.setAttribute("href", `/shorts/${matrixScenario.destination.videoId}`);
              identityLink.replaceWith(destinationIdentityLink);
              identityLink = destinationIdentityLink;
            } else {
              identityLink?.setAttribute("href", `/shorts/${matrixScenario.destination.videoId}`);
            }
            if (matrixScenario.destination.unrelatedDescriptionShortVideoId) {
              const description = document.createElement("yt-attributed-string");
              description.id = "description-text";
              description.setAttribute("data-fixture-short-description", "true");
              const descriptionLink = document.createElement("a");
              descriptionLink.className =
                "yt-core-attributed-string__link yt-core-attributed-string__link--call-to-action-color";
              descriptionLink.href = `/shorts/${matrixScenario.destination.unrelatedDescriptionShortVideoId}`;
              descriptionLink.textContent = "This knot is very useful";
              description.append(descriptionLink);
              actionBar.before(description);
            }
            globalThis.__navigationFixture.setNativeLikeCount(actionBar, matrixScenario.destination.videoId);
            timeline.push("route-and-exact-href-only");

            if (repeatedStart) {
              document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
              timeline.push("navigate-start-b");
            }

            const currentSyntheticDislike = actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]");
            immediatelyAfterRoute = {
              actionBarReused: actionBar === originActionBar,
              href: identityLink?.getAttribute("href") ?? null,
              isActive: renderer.hasAttribute("is-active"),
              likeReused: like === originLike,
              nativeDislikeReused:
                actionBar.querySelector("[data-ryd-synthetic-shorts-dislike] button") === originSyntheticNativeButton,
              rendererReused: renderer === originRenderer,
              rendererVideoId: renderer.getAttribute("video-id"),
              shortHrefs: Array.from(renderer.querySelectorAll('a[href*="/shorts/"]')).map(
                (link) => new URL(link.getAttribute("href"), location.origin).pathname,
              ),
              syntheticDisabled: currentSyntheticDislike?.querySelector("button")?.disabled ?? null,
              syntheticCount: actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").length,
              syntheticReused: currentSyntheticDislike === originSyntheticDislike,
              syntheticText: currentSyntheticDislike?.querySelector("#text, [role='text']")?.textContent ?? null,
            };
          },
          true,
        );

        globalThis.__navigationMatrixSameRendererShortFixture = {
          snapshot() {
            const identityLink = renderer.querySelector('a[href*="/shorts/"]');
            return {
              actionBarReused: actionBar === originActionBar,
              documentIdentity,
              href: identityLink?.getAttribute("href") ?? null,
              immediatelyAfterRoute,
              isActive: renderer.hasAttribute("is-active"),
              likeReused: like === originLike,
              nativeDislikeReused:
                originSyntheticNativeButton !== null &&
                actionBar.querySelector("[data-ryd-synthetic-shorts-dislike] button") === originSyntheticNativeButton,
              navigateFinishes: 0,
              rendererReused: renderer === originRenderer,
              rendererVideoId: renderer.getAttribute("video-id"),
              shortHrefs: Array.from(renderer.querySelectorAll('a[href*="/shorts/"]')).map(
                (link) => new URL(link.getAttribute("href"), location.origin).pathname,
              ),
              syntheticCount: actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").length,
              syntheticReused:
                originSyntheticDislike !== null &&
                actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]") === originSyntheticDislike,
              timeline: [...timeline],
              visibleRendererCount: Array.from(shortsPage.querySelectorAll("ytd-reel-video-renderer")).filter(
                (candidate) => {
                  const bounds = candidate.getBoundingClientRect();
                  return !candidate.hidden && bounds.width > 0 && bounds.height > 0;
                },
              ).length,
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installPersistentDataNullShortFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const shortsPage = fixturePage?.querySelector('[data-fixture-page-kind="shorts"]');
        const renderer = shortsPage?.querySelector(
          `ytd-reel-video-renderer[video-id="${matrixScenario.origin.videoId}"][is-active]`,
        );
        const originActionBar = renderer?.querySelector("reel-action-bar-view-model");
        const next = document.getElementById("short-next");
        if (!fixturePage || !shortsPage || !renderer || !originActionBar || !next) {
          throw new Error("The persistent data-null Shorts matrix requires complete origin controls and a Next link.");
        }

        for (const sibling of shortsPage.querySelectorAll("ytd-reel-video-renderer")) {
          if (sibling !== renderer) sibling.remove();
        }

        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        const timeline = [];
        let actionBarDataReadCount = 0;
        let actionBarDataWriteCount = 0;
        let destinationActionBar = null;
        let destinationNativeChildren = [];
        let originSyntheticDislike = null;

        function visible(element) {
          if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            style.display !== "none" &&
            !["hidden", "collapse"].includes(style.visibility) &&
            Number.parseFloat(style.opacity || "1") > 0.01 &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < innerHeight &&
            bounds.left < innerWidth
          );
        }

        function activationTarget(host) {
          return (
            host?.querySelector("button, a[href], a[role='button'][tabindex='0'], tp-yt-paper-button#button") ?? null
          );
        }

        function hitTested(element) {
          if (!visible(element)) return false;
          const bounds = element.getBoundingClientRect();
          const x = Math.min(innerWidth - 1, Math.max(0, bounds.left + bounds.width / 2));
          const y = Math.min(innerHeight - 1, Math.max(0, bounds.top + bounds.height / 2));
          return document.elementsFromPoint(x, y).some((hit) => hit === element || element.contains(hit));
        }

        function actionName(host) {
          if (host.matches("[data-ryd-synthetic-shorts-dislike]")) return "dislike";
          if (host.getAttribute("data-fixture-role") === "like") return "like";
          const fixtureControl = host.getAttribute("data-fixture-control");
          return fixtureControl === "sound" ? "pivot" : fixtureControl;
        }

        function navigateToPersistentDataNullSurface() {
          originSyntheticDislike = originActionBar.querySelector("[data-ryd-synthetic-shorts-dislike]");
          const nativeChildTemplates = Array.from(originActionBar.children)
            .filter((child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"))
            .map((child) => child.cloneNode(true));
          if (!originSyntheticDislike || nativeChildTemplates.length !== 5) {
            throw new Error("The persistent data-null Shorts matrix requires one synthetic and five native controls.");
          }

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          timeline.push("navigate-start");
          history.pushState({}, "", `/shorts/${matrixScenario.destination.videoId}?rydNavigationFixture=1`);
          shortsPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
          renderer.removeAttribute("video-id");
          renderer.removeAttribute("is-active");
          renderer.hidden = false;
          const identityLink = renderer.querySelector('a[href*="/shorts/"]');
          if (!identityLink) {
            throw new Error("The persistent data-null Shorts matrix requires a canonical identity link.");
          }
          identityLink.setAttribute("href", `/shorts/${matrixScenario.destination.videoId}`);

          destinationActionBar = document.createElement("reel-action-bar-view-model");
          destinationActionBar.setAttribute("data-fixture-role", "buttons");
          destinationActionBar.setAttribute("data-fixture-painted", "true");
          destinationActionBar.setAttribute("data-fixture-persistent-data-null", matrixScenario.destination.videoId);
          Object.defineProperty(destinationActionBar, "data", {
            configurable: true,
            get() {
              actionBarDataReadCount += 1;
              return null;
            },
            set() {
              actionBarDataWriteCount += 1;
            },
          });
          destinationActionBar.append(...nativeChildTemplates);
          globalThis.__navigationFixture.setNativeLikeCount(destinationActionBar, matrixScenario.destination.videoId);
          const destinationLike = destinationActionBar.querySelector('[data-fixture-role="like"]');
          destinationLike?.classList.remove("style-default-active");
          destinationLike?.classList.add("style-text");
          destinationLike?.querySelector("button")?.setAttribute("aria-pressed", "false");
          destinationNativeChildren = Array.from(destinationActionBar.children);
          originActionBar.replaceWith(destinationActionBar);
          timeline.push("route-and-fresh-five-native-persistent-data-null-action-root");
        }

        next.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            navigateToPersistentDataNullSurface();
          },
          true,
        );

        globalThis.__navigationMatrixPersistentDataNullShortFixture = {
          snapshot() {
            const actionHosts = Array.from(destinationActionBar?.children ?? []);
            const nativeChildren = actionHosts.filter((child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"));
            const activationTargets = actionHosts.map(activationTarget);
            const visibleRenderers = Array.from(shortsPage.querySelectorAll("ytd-reel-video-renderer")).filter(visible);
            const exactHrefRenderers = visibleRenderers.filter((candidate) =>
              Array.from(candidate.querySelectorAll('a[href*="/shorts/"]')).some((link) => {
                try {
                  return (
                    new URL(link.getAttribute("href"), location.origin).pathname ===
                    `/shorts/${matrixScenario.destination.videoId}`
                  );
                } catch {
                  return false;
                }
              }),
            );
            const syntheticDislikes = actionHosts.filter((host) => host.matches("[data-ryd-synthetic-shorts-dislike]"));
            return {
              actionBarConnected: destinationActionBar?.isConnected ?? false,
              actionBarDataReadCount,
              actionBarDataReady: Boolean(destinationActionBar?.data),
              actionBarDataWriteCount,
              actionBarReplaced: destinationActionBar !== null && destinationActionBar !== originActionBar,
              actionNames: actionHosts.map(actionName),
              currentActionButtonCount: activationTargets.filter(Boolean).length,
              currentNativeChildCount: nativeChildren.length,
              currentSyntheticCount: syntheticDislikes.length,
              currentSyntheticVideoIds: syntheticDislikes.map((control) => control.getAttribute("data-ryd-video-id")),
              documentIdentity,
              exactHrefRendererCount: exactHrefRenderers.length,
              hitTestedActionButtonCount: activationTargets.filter(hitTested).length,
              href: renderer.querySelector('a[href*="/shorts/"]')?.getAttribute("href") ?? null,
              isActive: renderer.hasAttribute("is-active"),
              nativeChildrenStable:
                destinationNativeChildren.length === 5 &&
                nativeChildren.every((child, index) => child === destinationNativeChildren[index]),
              nativeDislikeCount:
                destinationActionBar?.querySelectorAll("dislike-button-view-model, #dislike-button").length ?? 0,
              navigateFinishes: 0,
              navigateStarts: timeline.includes("navigate-start") ? 1 : 0,
              originActionBarConnected: originActionBar.isConnected,
              originSyntheticConnected: originSyntheticDislike?.isConnected ?? false,
              rendererReused: renderer.isConnected,
              rendererVideoId: renderer.getAttribute("video-id"),
              syntheticEnabled: syntheticDislikes[0]
                ? !syntheticDislikes[0].querySelector("button")?.disabled &&
                  syntheticDislikes[0].querySelector("button")?.getAttribute("aria-disabled") !== "true"
                : false,
              timeline: [...timeline],
              visibleActionButtonCount: activationTargets.filter(visible).length,
              visibleRendererCount: visibleRenderers.length,
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installPersistentDataNullVariantShortFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const shortsPage = fixturePage?.querySelector('[data-fixture-page-kind="shorts"]');
        const renderer = shortsPage?.querySelector(
          `ytd-reel-video-renderer[video-id="${matrixScenario.origin.videoId}"][is-active]`,
        );
        const originActionBar = renderer?.querySelector("reel-action-bar-view-model");
        const next = document.getElementById("short-next");
        if (!fixturePage || !shortsPage || !renderer || !originActionBar || !next) {
          throw new Error("The persistent data-null Shorts variant requires complete origin controls and a Next link.");
        }

        for (const sibling of shortsPage.querySelectorAll("ytd-reel-video-renderer")) {
          if (sibling !== renderer) sibling.remove();
        }

        const addsNativeDislike = matrixScenario.destination.shortsDislikeControl === "native";
        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        const timeline = [];
        let actionBarDataReadCount = 0;
        let actionBarDataWriteCount = 0;
        let blockedActivationTarget = null;
        let destinationActionBar = null;
        let destinationNativeChildren = [];
        let originSyntheticDislike = null;

        function visible(element) {
          if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            style.display !== "none" &&
            !["hidden", "collapse"].includes(style.visibility) &&
            Number.parseFloat(style.opacity || "1") > 0.01 &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < innerHeight &&
            bounds.left < innerWidth
          );
        }

        function activationTarget(host) {
          return (
            host?.querySelector("button, a[href], a[role='button'][tabindex='0'], tp-yt-paper-button#button") ?? null
          );
        }

        function hitTested(element) {
          if (!visible(element)) return false;
          const bounds = element.getBoundingClientRect();
          const x = Math.min(innerWidth - 1, Math.max(0, bounds.left + bounds.width / 2));
          const y = Math.min(innerHeight - 1, Math.max(0, bounds.top + bounds.height / 2));
          return document.elementsFromPoint(x, y).some((hit) => hit === element || element.contains(hit));
        }

        function actionName(host) {
          if (host.getAttribute("data-fixture-role") === "like") return "like";
          if (host.getAttribute("data-fixture-role") === "dislike") return "dislike";
          const fixtureControl = host.getAttribute("data-fixture-control");
          return fixtureControl === "sound" ? "pivot" : fixtureControl;
        }

        function bounds(element) {
          if (!element?.isConnected) return null;
          const rect = element.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          };
        }

        function createNativeDislike() {
          const label = originSyntheticDislike?.querySelector("label")?.cloneNode(true);
          if (!label)
            throw new Error("The native-Dislike variant requires the initialized synthetic control template.");
          const nativeDislike = document.createElement("dislike-button-view-model");
          nativeDislike.className =
            "ytDislikeButtonViewModelHost ytwReelActionBarViewModelHostDesktopActionButton style-text";
          nativeDislike.setAttribute("data-fixture-role", "dislike");
          nativeDislike.append(label);
          const button = nativeDislike.querySelector("button");
          if (!button) throw new Error("The native-Dislike variant requires an activation target.");
          button.disabled = false;
          button.setAttribute("aria-disabled", "false");
          button.setAttribute("aria-pressed", "false");
          const count = nativeDislike.querySelector("#text, [role='text']");
          if (count) count.textContent = "";
          return nativeDislike;
        }

        function navigateToVariantSurface() {
          originSyntheticDislike = originActionBar.querySelector("[data-ryd-synthetic-shorts-dislike]");
          const nativeChildTemplates = Array.from(originActionBar.children)
            .filter((child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"))
            .map((child) => child.cloneNode(true));
          if (!originSyntheticDislike || nativeChildTemplates.length !== 5) {
            throw new Error("The persistent data-null Shorts variant requires one synthetic and five native controls.");
          }

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          timeline.push("navigate-start");
          history.pushState({}, "", `/shorts/${matrixScenario.destination.videoId}?rydNavigationFixture=1`);
          shortsPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);
          renderer.removeAttribute("video-id");
          renderer.removeAttribute("is-active");
          renderer.hidden = false;
          const identityLink = renderer.querySelector('a[href*="/shorts/"]');
          if (!identityLink) {
            throw new Error("The persistent data-null Shorts variant requires a canonical identity link.");
          }
          identityLink.setAttribute("href", `/shorts/${matrixScenario.destination.videoId}`);

          destinationActionBar = document.createElement("reel-action-bar-view-model");
          destinationActionBar.setAttribute("data-fixture-role", "buttons");
          destinationActionBar.setAttribute("data-fixture-painted", "true");
          destinationActionBar.setAttribute("data-fixture-persistent-data-null", matrixScenario.destination.videoId);
          Object.defineProperty(destinationActionBar, "data", {
            configurable: true,
            get() {
              actionBarDataReadCount += 1;
              return null;
            },
            set() {
              actionBarDataWriteCount += 1;
            },
          });
          destinationActionBar.append(...nativeChildTemplates);
          globalThis.__navigationFixture.setNativeLikeCount(destinationActionBar, matrixScenario.destination.videoId);
          const destinationLike = destinationActionBar.querySelector('[data-fixture-role="like"]');
          destinationLike?.classList.remove("style-default-active");
          destinationLike?.classList.add("style-text");
          destinationLike?.querySelector("button")?.setAttribute("aria-pressed", "false");

          if (addsNativeDislike) {
            destinationLike?.insertAdjacentElement("afterend", createNativeDislike());
            timeline.push("append-native-dislike");
          } else {
            blockedActivationTarget = activationTarget(destinationActionBar.lastElementChild);
            if (!blockedActivationTarget) {
              throw new Error("The inert persistent data-null variant requires a native activation target to hide.");
            }
            blockedActivationTarget.style.display = "none";
            blockedActivationTarget.setAttribute("data-fixture-non-rendered", "true");
            timeline.push("hide-one-native-activation-target");
          }

          destinationNativeChildren = Array.from(destinationActionBar.children);
          originActionBar.replaceWith(destinationActionBar);
          timeline.push("route-and-fresh-persistent-data-null-action-root");
        }

        next.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            navigateToVariantSurface();
          },
          true,
        );

        globalThis.__navigationMatrixPersistentDataNullVariantFixture = {
          snapshot() {
            const actionHosts = Array.from(destinationActionBar?.children ?? []);
            const nativeChildren = actionHosts.filter((child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"));
            const activationTargets = actionHosts.map(activationTarget);
            const visibleRenderers = Array.from(shortsPage.querySelectorAll("ytd-reel-video-renderer")).filter(visible);
            const exactHrefRenderers = visibleRenderers.filter((candidate) =>
              Array.from(candidate.querySelectorAll('a[href*="/shorts/"]')).some((link) => {
                try {
                  return (
                    new URL(link.getAttribute("href"), location.origin).pathname ===
                    `/shorts/${matrixScenario.destination.videoId}`
                  );
                } catch {
                  return false;
                }
              }),
            );
            const nativeDislikes = actionHosts.filter((host) =>
              host.matches("dislike-button-view-model, #dislike-button"),
            );
            const syntheticDislikes = actionHosts.filter((host) => host.matches("[data-ryd-synthetic-shorts-dislike]"));
            return {
              actionBarBounds: bounds(destinationActionBar),
              actionBarConnected: destinationActionBar?.isConnected ?? false,
              actionBarDataReadCount,
              actionBarDataReady: Boolean(destinationActionBar?.data),
              actionBarDataWriteCount,
              actionBarReplaced: destinationActionBar !== null && destinationActionBar !== originActionBar,
              actionNames: actionHosts.map(actionName),
              blockedActivationConnected: blockedActivationTarget?.isConnected ?? false,
              currentActionButtonCount: activationTargets.filter(Boolean).length,
              currentNativeChildCount: nativeChildren.length,
              currentSyntheticCount: syntheticDislikes.length,
              documentIdentity,
              exactHrefRendererCount: exactHrefRenderers.length,
              hitTestedActionButtonCount: activationTargets.filter(hitTested).length,
              href: renderer.querySelector('a[href*="/shorts/"]')?.getAttribute("href") ?? null,
              isActive: renderer.hasAttribute("is-active"),
              nativeChildrenStable:
                destinationNativeChildren.length === nativeChildren.length &&
                nativeChildren.every((child, index) => child === destinationNativeChildren[index]),
              nativeDislikeCount: nativeDislikes.length,
              nativeDislikeText: nativeDislikes[0]?.querySelector("#text, [role='text']")?.textContent?.trim() ?? null,
              navigateFinishes: 0,
              navigateStarts: timeline.includes("navigate-start") ? 1 : 0,
              nonRenderedActionButtonCount: activationTargets.filter((target) => target && !visible(target)).length,
              originActionBarConnected: originActionBar.isConnected,
              originSyntheticConnected: originSyntheticDislike?.isConnected ?? false,
              rendererReused: renderer.isConnected,
              rendererVideoId: renderer.getAttribute("video-id"),
              timeline: [...timeline],
              visibleActionButtonCount: activationTargets.filter(visible).length,
              visibleRendererCount: visibleRenderers.length,
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installReplacedRootShortStartOnlyFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        const shortsPage = fixturePage?.querySelector('[data-fixture-page-kind="shorts"]');
        const originRoot = shortsPage?.querySelector("ytd-shorts");
        const originRenderer = originRoot?.querySelector(
          `ytd-reel-video-renderer[video-id="${matrixScenario.origin.videoId}"][is-active]`,
        );
        const originActionBar = originRenderer?.querySelector("reel-action-bar-view-model");
        const next = document.getElementById("short-next");
        if (!fixturePage || !shortsPage || !originRoot || !originRenderer || !originActionBar || !next) {
          throw new Error("The replaced-root Shorts matrix requires a complete origin and a Next link.");
        }

        const nativeChildTemplates = Array.from(originActionBar.children)
          .filter((child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"))
          .map((child) => child.cloneNode(true));
        if (nativeChildTemplates.length !== 5) {
          throw new Error("The replaced-root Shorts matrix requires exactly five native action controls.");
        }

        const documentIdentity = `matrix-${Date.now()}-${Math.random()}`;
        const repeatedStart = matrixScenario.transition.navigateStarts === "before-and-after-route";
        const timeline = [];
        let destinationActionBar = null;
        let destinationActionBarData = null;
        let destinationActionBarDataReadCount = 0;
        let destinationActionBarFirstDataReadAt = null;
        let destinationActionBarMountedAt = null;
        let destinationRenderer = null;
        let destinationRoot = null;
        let originSyntheticDislike = null;

        function visible(element) {
          if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
        }

        function replaceRoot() {
          originSyntheticDislike = originActionBar.querySelector("[data-ryd-synthetic-shorts-dislike]");
          if (!originSyntheticDislike) {
            throw new Error("The replaced-root Shorts matrix requires an initialized origin Dislike.");
          }

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          timeline.push(repeatedStart ? "navigate-start-a" : "navigate-start");
          history.pushState({}, "", `/shorts/${matrixScenario.destination.videoId}?rydNavigationFixture=1`);
          shortsPage.setAttribute("data-fixture-video-id", matrixScenario.destination.videoId);

          destinationRoot = document.createElement("ytd-shorts");
          destinationRoot.setAttribute("data-fixture-replaced-shorts-root", matrixScenario.destination.videoId);
          const sequence = document.createElement("div");
          sequence.className = "reel-video-in-sequence-new";
          sequence.setAttribute("data-fixture-sequence-video-id", matrixScenario.destination.videoId);
          const thumbnail = document.createElement("div");
          thumbnail.className = "reel-video-in-sequence-thumbnail";
          destinationRenderer = document.createElement("ytd-reel-video-renderer");
          destinationRenderer.setAttribute("video-id", matrixScenario.destination.videoId);
          destinationRenderer.setAttribute("is-active", "");
          destinationRenderer.setAttribute("data-fixture-replaced-renderer", matrixScenario.destination.videoId);
          const overlay = document.createElement("div");
          overlay.id = "experiment-overlay";
          overlay.innerHTML = "<span>Ready</span>";
          const identityLink = document.createElement("a");
          identityLink.href = `/shorts/${matrixScenario.destination.videoId}`;
          identityLink.setAttribute("aria-label", `Short ${matrixScenario.destination.videoId}`);
          destinationRenderer.append(overlay, identityLink);
          sequence.append(thumbnail, destinationRenderer);
          destinationRoot.append(sequence);
          originRoot.replaceWith(destinationRoot);
          timeline.push("route-and-root-without-action-bar");

          if (repeatedStart) {
            document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
            timeline.push("navigate-start-b");
          }
        }

        function appendEmptyActionBar() {
          if (!destinationRenderer?.isConnected || destinationActionBar) {
            throw new Error("The replaced-root Shorts matrix cannot append its empty action bar.");
          }
          destinationActionBar = document.createElement("reel-action-bar-view-model");
          destinationActionBar.setAttribute("data-fixture-role", "buttons");
          destinationActionBar.setAttribute("data-fixture-staged-action-bar", matrixScenario.destination.videoId);
          destinationActionBarData = null;
          destinationActionBarDataReadCount = 0;
          destinationActionBarFirstDataReadAt = null;
          destinationActionBarMountedAt = performance.now();
          Object.defineProperty(destinationActionBar, "data", {
            configurable: true,
            get() {
              destinationActionBarDataReadCount += 1;
              destinationActionBarFirstDataReadAt ??= performance.now();
              return destinationActionBarData;
            },
            set(value) {
              destinationActionBarData = value;
            },
          });
          destinationRenderer.append(destinationActionBar);
          timeline.push("append-empty-data-null-action-bar");
        }

        function appendNativeChildren() {
          if (!destinationActionBar?.isConnected || destinationActionBar.children.length !== 0) {
            throw new Error("The replaced-root Shorts matrix cannot append its native action inventory.");
          }
          destinationActionBar.append(...nativeChildTemplates.map((child) => child.cloneNode(true)));
          globalThis.__navigationFixture.setNativeLikeCount(destinationActionBar, matrixScenario.destination.videoId);
          const like = destinationActionBar.querySelector('[data-fixture-role="like"]');
          like?.classList.remove("style-default-active");
          like?.classList.add("style-text");
          like?.querySelector("button")?.setAttribute("aria-pressed", "false");
          timeline.push("append-complete-native-inventory-data-null");
        }

        function hydrateActionBar() {
          if (!destinationActionBar?.isConnected || destinationActionBar.children.length !== 5) {
            throw new Error("The replaced-root Shorts matrix cannot hydrate an incomplete action bar.");
          }
          destinationActionBar.data = { hydrated: true, videoId: matrixScenario.destination.videoId };
          timeline.push("hydrate-action-bar-data");
        }

        next.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            replaceRoot();
          },
          true,
        );

        globalThis.__navigationMatrixReplacedRootShortFixture = {
          appendEmptyActionBar,
          appendNativeChildren,
          hydrateActionBar,
          snapshot() {
            const currentSyntheticDislikes = Array.from(
              document.querySelectorAll("[data-ryd-synthetic-shorts-dislike]"),
            );
            return {
              actionBarConnected: destinationActionBar?.isConnected ?? false,
              actionBarDataReadCount: destinationActionBarDataReadCount,
              actionBarDataReady: Boolean(destinationActionBarData),
              actionBarFirstDataReadDelayMs:
                destinationActionBarFirstDataReadAt === null || destinationActionBarMountedAt === null
                  ? null
                  : destinationActionBarFirstDataReadAt - destinationActionBarMountedAt,
              currentActionButtonCount:
                destinationActionBar === null
                  ? 0
                  : Array.from(destinationActionBar.querySelectorAll("button")).filter(visible).length,
              currentNativeChildCount:
                destinationActionBar === null
                  ? 0
                  : Array.from(destinationActionBar.children).filter(
                      (child) => !child.matches("[data-ryd-synthetic-shorts-dislike]"),
                    ).length,
              currentSyntheticCount: currentSyntheticDislikes.length,
              currentSyntheticVideoIds: currentSyntheticDislikes.map((control) =>
                control.getAttribute("data-ryd-video-id"),
              ),
              destinationRendererConnected: destinationRenderer?.isConnected ?? false,
              destinationRendererVisible: visible(destinationRenderer),
              destinationRootConnected: destinationRoot?.isConnected ?? false,
              documentIdentity,
              navigateFinishes: 0,
              navigateStarts: repeatedStart ? 2 : 1,
              originRootConnected: originRoot.isConnected,
              originSyntheticConnected: originSyntheticDislike?.isConnected ?? false,
              rendererVideoId: destinationRenderer?.getAttribute("video-id") ?? null,
              timeline: [...timeline],
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installStandardNavigationMatrixFixture(context, scenario) {
  await context.addInitScript((matrixScenario) => {
    if (!location.hostname.endsWith("youtube.com")) return;

    addEventListener(
      "DOMContentLoaded",
      () => {
        if (new URL(location.href).searchParams.get("rydNavigationFixture") !== "1") return;

        const fixturePage = document.getElementById("fixture-page");
        if (!fixturePage || !globalThis.__navigationFixture) {
          throw new Error("The navigation matrix requires the navigation-page fixture.");
        }

        const probe = {
          documentIdentity: `matrix-${Date.now()}-${Math.random()}`,
          historyRenders: [],
          navigateFinishes: 0,
          navigateStarts: 0,
          shortActiveMutations: [],
        };
        document.addEventListener("yt-navigate-start", () => {
          probe.navigateStarts += 1;
        });
        document.addEventListener("yt-navigate-finish", () => {
          probe.navigateFinishes += 1;
        });
        const shortActiveObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            const renderer = mutation.target;
            if (!renderer.matches?.("ytd-reel-video-renderer")) continue;
            probe.shortActiveMutations.push({
              active: renderer.hasAttribute("is-active"),
              attribute: mutation.attributeName,
              hidden: renderer.hidden,
              oldValue: mutation.oldValue,
              videoId: renderer.getAttribute("video-id"),
            });
          }
        });
        shortActiveObserver.observe(fixturePage, {
          attributeFilter: ["hidden", "is-active"],
          attributeOldValue: true,
          attributes: true,
          subtree: true,
        });

        const delayedLinkId = {
          "short-direct-watch-delayed": "short-to-watch",
          "watch-direct-short-delayed": "watch-to-short",
        }[matrixScenario.id];
        if (delayedLinkId) {
          document
            .getElementById(delayedLinkId)
            ?.setAttribute("data-fixture-control-delay", String(matrixScenario.timing.controlDelayMs));
        }

        if (matrixScenario.id === "watch-history-back-forward-replace") {
          addEventListener("popstate", () => {
            const videoId = new URL(location.href).searchParams.get("v");
            const watchPage = fixturePage.querySelector('[data-fixture-page-kind="watch"]');
            const currentTopRow = watchPage?.querySelector("#top-row");
            const watchFlexy = watchPage?.querySelector("ytd-watch-flexy");
            if (!videoId || !watchPage || !currentTopRow || !watchFlexy) {
              throw new Error("The history matrix could not render the current watch entry.");
            }

            const replacementTopRow = currentTopRow.cloneNode(true);
            replacementTopRow.removeAttribute("style");
            replacementTopRow.querySelectorAll(".ryd-tooltip").forEach((element) => element.remove());
            const controls = replacementTopRow.querySelector("[data-fixture-control-video-id]");
            controls.setAttribute("data-fixture-control-video-id", videoId);
            globalThis.__navigationFixture.setNativeLikeCount(controls, videoId);
            for (const role of ["like", "dislike"]) {
              const control = controls.querySelector(`[data-fixture-role="${role}"]`);
              control.classList.remove("style-default-active");
              control.classList.add("style-text");
              control.querySelector("button")?.setAttribute("aria-pressed", "false");
            }
            controls
              .querySelectorAll(
                '[data-fixture-role="dislike"] .ytSpecButtonShapeNextButtonTextContent, [data-fixture-role="dislike"] #text',
              )
              .forEach((element) => element.remove());
            currentTopRow.replaceWith(replacementTopRow);
            watchPage.setAttribute("data-fixture-video-id", videoId);
            watchFlexy.setAttribute("video-id", videoId);
            probe.historyRenders.push(videoId);
            document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
          });
        }

        globalThis.__navigationMatrixProbe = {
          snapshot() {
            return {
              currentKind:
                fixturePage.querySelector("[data-fixture-page-kind]")?.getAttribute("data-fixture-page-kind") ?? null,
              currentVideoId:
                fixturePage.querySelector("[data-fixture-video-id]")?.getAttribute("data-fixture-video-id") ?? null,
              documentIdentity: probe.documentIdentity,
              historyRenders: [...probe.historyRenders],
              navigateFinishes: probe.navigateFinishes,
              navigateStarts: probe.navigateStarts,
              shortActiveMutations: [...probe.shortActiveMutations],
              transitionPending: fixturePage.dataset.fixtureTransitionPending ?? null,
            };
          },
        };
      },
      { once: true },
    );
  }, scenario);
}

async function installNavigationMatrixFixture(context, scenario) {
  if (!NAVIGATION_MATRIX.some((candidate) => candidate.id === scenario.id)) {
    throw new Error(`No navigation matrix fixture is registered for ${scenario.id}.`);
  }
  if (
    scenario.id === "short-next-short-reuse-renderer-start-no-finish" ||
    scenario.id === "short-next-short-reuse-renderer-repeated-start-no-finish" ||
    scenario.id === "short-next-short-exact-href-with-description-crosslink"
  ) {
    await installSameRendererShortStartOnlyFixture(context, scenario);
    return;
  }
  if (scenario.id === "short-next-short-reuse-renderer-replace-action-root-exact-href-persistent-data-null") {
    await installPersistentDataNullShortFixture(context, scenario);
    return;
  }
  if (
    scenario.id === "short-next-short-persistent-data-null-nonrendered-native-stays-inert" ||
    scenario.id === "short-next-short-persistent-data-null-native-dislike"
  ) {
    await installPersistentDataNullVariantShortFixture(context, scenario);
    return;
  }
  if (
    scenario.id === "short-next-short-replace-root-start-no-finish-staged-hydration" ||
    scenario.id === "short-next-short-replace-root-repeated-start-no-finish-staged-hydration"
  ) {
    await installReplacedRootShortStartOnlyFixture(context, scenario);
    return;
  }
  if (scenario.id === "watch-sidebar-watch-retain-prune") {
    await installSidebarRetainPruneFixture(context, scenario);
    return;
  }
  if (
    scenario.id === "watch-sidebar-watch-same-root-hidden-first" ||
    scenario.id === "watch-sidebar-watch-same-root-offscreen-first" ||
    scenario.id === "watch-sidebar-watch-legacy-segmented-duplicate-ids"
  ) {
    await installSameRootHiddenFirstFixture(context, scenario);
    return;
  }
  if (scenario.id === "watch-sidebar-watch-same-node-route-complete") {
    await installSameNodeRouteCompletionFixture(context, scenario);
    return;
  }
  await installStandardNavigationMatrixFixture(context, scenario);
}

function currentWatchLocators(page, runtime, videoId) {
  const watchRoot = page.locator(`ytd-watch-flexy[video-id="${videoId}"], ytd-watch-grid[video-id="${videoId}"]`);
  const controls = watchRoot.locator(`[data-fixture-control-video-id="${videoId}"]`);
  const reactionRegion = controls.locator("xpath=..");
  const wrapper = reactionRegion.locator(`:scope > ${runtime.selectors.wrapper}`);
  const container = wrapper.locator(runtime.selectors.container);
  return {
    bar: container.locator(runtime.selectors.bar),
    container,
    controls,
    reactionRegion,
    tooltip: wrapper.locator(runtime.selectors.tooltip),
    watchRoot,
    wrapper,
  };
}

function currentShortRendererLocator(page, videoId, shortIdentity = "active-video-id") {
  if (shortIdentity === "exact-href-without-active-or-video-id") {
    return page.locator(
      `ytd-reel-video-renderer:not([hidden]):has(a[href^="/shorts/${videoId}"])` + `:not([is-active]):not([video-id])`,
    );
  }
  return page.locator(`ytd-reel-video-renderer[video-id="${videoId}"][is-active]`);
}

function currentShortDislikeSelector(runtime, shortsDislikeControl = "synthetic") {
  return shortsDislikeControl === "native"
    ? 'dislike-button-view-model[data-fixture-role="dislike"]'
    : runtime.selectors.shortsDislike;
}

function getDestinationDislikePostconditionTarget(page, runtime, scenario) {
  if (scenario.postcondition !== SINGLE_DESTINATION_DISLIKE_POSTCONDITION) {
    throw new Error(`Unsupported navigation postcondition for ${scenario.id}: ${scenario.postcondition}`);
  }

  const { destination } = scenario;
  const reactionRoot =
    destination.kind === "shorts"
      ? currentShortRendererLocator(page, destination.videoId, destination.shortIdentity)
      : currentWatchLocators(page, runtime, destination.videoId).controls;
  const control =
    destination.kind === "shorts"
      ? reactionRoot.locator(currentShortDislikeSelector(runtime, destination.shortsDislikeControl))
      : reactionRoot.locator('[data-fixture-role="dislike"]');
  const likeControl = reactionRoot.locator('[data-fixture-role="like"]');

  return {
    button: control.locator("button"),
    control,
    count: control.locator(destination.kind === "shorts" ? "#text" : runtime.selectors.watchDislikeCount),
    expectedCount: expectedDislikeText(destination.counts, 1),
    expectedFinalDislikeCount: expectedDislikeText(destination.counts),
    expectedInitialDislikeCount: expectedDislikeText(destination.counts),
    expectedFinalLikeCount: destination.counts.likes + 1,
    likeButton: likeControl.locator("button"),
    likeControl,
    likeCount: likeControl.locator("#text, [role='text']"),
  };
}

async function expectOwnedWatchBar(page, runtime, videoId, counts) {
  const locators = currentWatchLocators(page, runtime, videoId);
  const currentCount = locators.controls
    .locator('[data-fixture-role="dislike"]')
    .locator(runtime.selectors.watchDislikeCount);
  await expect(locators.controls).toHaveCount(1);
  await expect(
    locators.controls.locator(
      ":scope > yt-smartimation > [data-fixture-smartimation-content-shell] > [data-fixture-smartimation-content] > like-button-view-model",
    ),
  ).toHaveCount(1);
  await expect(
    locators.controls.locator(
      ":scope > yt-smartimation > [data-fixture-smartimation-content-shell] > [data-fixture-smartimation-content] > dislike-button-view-model",
    ),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => globalThis.__navigationFixtureBaseline?.renderedWatchNativeDislikeTextCount),
    "the fixture must supply an icon-only native Watch Dislike control",
  ).toBe(0);
  await expect(currentCount).toHaveCount(1);
  await expect(currentCount).not.toHaveAttribute("data-fixture-provided-native-text", /.*/);
  await expect(currentCount).toHaveText(expectedDislikeText(counts));
  await expect(locators.wrapper).toHaveCount(1);
  if (runtime.selectors.wrapperVideoAttribute) {
    await expect(locators.wrapper).toHaveAttribute(runtime.selectors.wrapperVideoAttribute, videoId);
  }
  await expect(locators.wrapper).toBeVisible();
  await expect(locators.container).toBeVisible();
  await expect(locators.bar).toBeVisible();
  await expect(locators.tooltip).toContainText(runtime.tooltipText(counts));
  await expect(page.locator(runtime.selectors.wrapper)).toHaveCount(1);
  await expect(page.locator(runtime.selectors.container)).toHaveCount(1);
  await expect(page.locator(runtime.selectors.bar)).toHaveCount(1);
  await expect(page.locator(runtime.selectors.tooltip)).toHaveCount(1);

  const geometry = await locators.reactionRegion.evaluate((reactionRegion, selectors) => {
    const box = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      };
    };
    const like = reactionRegion.querySelector('[data-fixture-role="like"] button');
    const dislike = reactionRegion.querySelector('[data-fixture-role="dislike"] button');
    const wrapper = reactionRegion.querySelector(`:scope > ${selectors.wrapper}`);
    const container = wrapper.querySelector(selectors.container);
    const bar = container.querySelector(selectors.bar);
    return {
      bar: box(bar),
      container: box(container),
      dislike: box(dislike),
      like: box(like),
      wrapper: box(wrapper),
    };
  }, runtime.selectors);
  expect(geometry.wrapper.width).toBeCloseTo(geometry.like.width + geometry.dislike.width, 0);
  expect(geometry.container.top).toBeGreaterThanOrEqual(Math.max(geometry.like.bottom, geometry.dislike.bottom) - 1);
  expect(geometry.bar.left).toBeGreaterThanOrEqual(geometry.container.left - 1);
  expect(geometry.bar.right).toBeLessThanOrEqual(geometry.container.right + 1);
  expect(geometry.bar.width / geometry.container.width).toBeCloseTo(counts.likes / (counts.likes + counts.dislikes), 2);
  return locators;
}

async function expectOwnedShortControl(
  page,
  runtime,
  videoId,
  counts,
  shortIdentity = "active-video-id",
  shortsDislikeControl = "synthetic",
) {
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${videoId}`);
  const currentRenderer = currentShortRendererLocator(page, videoId, shortIdentity);
  const dislikeSelector = currentShortDislikeSelector(runtime, shortsDislikeControl);
  const dislike = currentRenderer.locator(dislikeSelector);
  await expect(currentRenderer).toHaveCount(1);
  await expect(currentRenderer).toBeVisible();
  await expect(dislike).toHaveCount(1);
  await expect(dislike).toBeVisible();
  await expect(dislike.locator("#text")).toHaveText(String(counts.dislikes));
  if (shortsDislikeControl === "synthetic" && runtime.selectors.shortsVideoAttribute) {
    await expect(dislike).toHaveAttribute(runtime.selectors.shortsVideoAttribute, videoId);
  }
  await expect(page.locator(`${dislikeSelector}:visible`)).toHaveCount(1);
  await expect(currentRenderer.locator("reel-action-bar-view-model button")).toHaveCount(6);
  await expect(currentRenderer.locator("reel-action-bar-view-model button:visible")).toHaveCount(6);
  await expect(page.locator(runtime.selectors.wrapper)).toHaveCount(0);
  await expect(page.locator(runtime.selectors.container)).toHaveCount(0);
  await expect(page.locator(runtime.selectors.bar)).toHaveCount(0);
  return { currentRenderer, dislike };
}

async function readOwnedSurfaceInvariant(
  page,
  runtime,
  videoId,
  counts,
  kind,
  shortIdentity = "active-video-id",
  shortsDislikeControl = "synthetic",
) {
  const shortsDislikeSelector = currentShortDislikeSelector(runtime, shortsDislikeControl);
  return page.evaluate(
    ({
      counts: expectedCounts,
      expectedCount,
      expectedTooltip,
      kind: expectedKind,
      selectors,
      shortsDislikeSelector: expectedShortsDislikeSelector,
      shortIdentity: expectedShortIdentity,
      videoId: expectedVideoId,
    }) => {
      const visible = (element) => {
        if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
      };
      const currentUrl = new URL(location.href);
      const common = {
        bars: document.querySelectorAll(selectors.bar).length,
        containers: document.querySelectorAll(selectors.container).length,
        pathname: currentUrl.pathname,
        tooltips: document.querySelectorAll(selectors.tooltip).length,
        wrappers: document.querySelectorAll(selectors.wrapper).length,
      };

      if (expectedKind === "shorts") {
        const activeRenderers = Array.from(
          document.querySelectorAll(`ytd-reel-video-renderer[video-id="${expectedVideoId}"][is-active]`),
        );
        const exactHrefRenderers = Array.from(document.querySelectorAll("ytd-reel-video-renderer")).filter(
          (renderer) =>
            visible(renderer) &&
            Array.from(renderer.querySelectorAll('a[href*="/shorts/"]')).some((link) => {
              try {
                return new URL(link.getAttribute("href"), location.origin).pathname === `/shorts/${expectedVideoId}`;
              } catch {
                return false;
              }
            }),
        );
        const currentRenderers =
          expectedShortIdentity === "exact-href-without-active-or-video-id" ? exactHrefRenderers : activeRenderers;
        const currentControls = currentRenderers.flatMap((renderer) =>
          Array.from(renderer.querySelectorAll(expectedShortsDislikeSelector)),
        );
        const actionButtons = currentRenderers.flatMap((renderer) =>
          Array.from(renderer.querySelectorAll("reel-action-bar-view-model button")),
        );
        const currentActionButtons = actionButtons.filter(visible);
        const visibleControls = Array.from(document.querySelectorAll(expectedShortsDislikeSelector)).filter(visible);
        return {
          ...common,
          activeRenderers: activeRenderers.length,
          count: currentControls[0]?.querySelector("#text")?.textContent?.trim() ?? null,
          currentActionButtons: currentActionButtons.length,
          currentRendererHasActive: currentRenderers[0]?.hasAttribute("is-active") ?? null,
          currentRendererVideoId: currentRenderers[0]?.getAttribute("video-id") ?? null,
          currentRenderers: currentRenderers.length,
          totalActionButtons: actionButtons.length,
          currentControls: currentControls.length,
          currentVisible: currentControls.length === 1 && visible(currentControls[0]),
          expectedCount,
          expectedPathname: `/shorts/${expectedVideoId}`,
          expectedShortIdentity,
          kind: expectedKind,
          visibleControls: visibleControls.length,
        };
      }

      const controls = Array.from(document.querySelectorAll(`[data-fixture-control-video-id="${expectedVideoId}"]`));
      const currentControls = controls.filter(visible);
      const reactionRegion = currentControls[0]?.parentElement ?? null;
      const wrapper = reactionRegion?.querySelector(`:scope > ${selectors.wrapper}`) ?? null;
      const container = wrapper?.querySelector(selectors.container) ?? null;
      const bar = container?.querySelector(selectors.bar) ?? null;
      const containerBounds = container?.getBoundingClientRect();
      const barBounds = bar?.getBoundingClientRect();
      return {
        ...common,
        count:
          currentControls[0]
            ?.querySelector('[data-fixture-role="dislike"]')
            ?.querySelector(selectors.watchDislikeCount)
            ?.textContent?.trim() ?? null,
        currentControls: currentControls.length,
        expectedCount,
        expectedPathname: "/watch",
        expectedRatio: expectedCounts.likes / (expectedCounts.likes + expectedCounts.dislikes),
        expectedTooltip,
        expectedVideoId,
        kind: expectedKind,
        ownerBarVisible: visible(bar),
        ownerContainerVisible: visible(container),
        ownerTooltip: wrapper?.querySelector(selectors.tooltip)?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        ownerVideoId: selectors.wrapperVideoAttribute
          ? wrapper?.getAttribute(selectors.wrapperVideoAttribute) ?? null
          : expectedVideoId,
        ownerWrapperVisible: visible(wrapper),
        ratio: containerBounds?.width > 0 && barBounds ? barBounds.width / containerBounds.width : null,
        videoId: currentUrl.searchParams.get("v"),
      };
    },
    {
      counts,
      expectedCount: expectedDislikeText(counts),
      expectedTooltip: runtime.tooltipText(counts),
      kind,
      selectors: runtime.selectors,
      shortsDislikeSelector,
      shortIdentity,
      videoId,
    },
  );
}

function ownedSurfaceInvariantIsValid(sample) {
  if (sample.pathname !== sample.expectedPathname || sample.count !== sample.expectedCount) return false;
  if (sample.kind === "shorts") {
    const identityMatches =
      sample.expectedShortIdentity === "exact-href-without-active-or-video-id"
        ? sample.activeRenderers === 0 &&
          sample.currentRenderers === 1 &&
          sample.currentRendererHasActive === false &&
          sample.currentRendererVideoId === null
        : sample.activeRenderers === 1 && sample.currentRenderers === 1;
    return (
      identityMatches &&
      sample.currentControls === 1 &&
      sample.currentActionButtons === 6 &&
      sample.currentVisible &&
      sample.visibleControls === 1 &&
      sample.totalActionButtons === 6 &&
      sample.wrappers === 0 &&
      sample.containers === 0 &&
      sample.bars === 0
    );
  }
  return (
    sample.videoId === sample.expectedVideoId &&
    sample.currentControls === 1 &&
    sample.wrappers === 1 &&
    sample.containers === 1 &&
    sample.bars === 1 &&
    sample.tooltips === 1 &&
    sample.ownerWrapperVisible &&
    sample.ownerContainerVisible &&
    sample.ownerBarVisible &&
    sample.ownerVideoId === sample.expectedVideoId &&
    sample.ownerTooltip?.includes(sample.expectedTooltip) &&
    Math.abs(sample.ratio - sample.expectedRatio) <= 0.015
  );
}

async function waitForOwnedSurfaceStability(page, runtime, surface, timing = {}) {
  return waitForStableInvariant({
    intervalMs: 25,
    isValid: ownedSurfaceInvariantIsValid,
    label: `${runtime.name} ${surface.kind} ${surface.videoId} ownership`,
    read: () =>
      readOwnedSurfaceInvariant(
        page,
        runtime,
        surface.videoId,
        surface.counts,
        surface.kind,
        surface.shortIdentity,
        surface.shortsDislikeControl,
      ),
    stableForMs: timing.stableForMs ?? 250,
    timeoutMs: timing.timeoutMs ?? 2_000,
  });
}

async function waitForOwnedSurfaceWithinBudget(page, runtime, surface, maxFirstValidMs = 1_000) {
  const readiness = await waitForOwnedSurfaceStability(page, runtime, surface, {
    stableForMs: 250,
    timeoutMs: maxFirstValidMs + 500,
  });
  expect(readiness.firstValidMs).toBeLessThanOrEqual(maxFirstValidMs);
  return readiness;
}

async function assertOwnedSurfaceContinuously(page, runtime, surface, durationMs = 600) {
  return assertInvariantContinuously({
    durationMs,
    intervalMs: 25,
    isValid: ownedSurfaceInvariantIsValid,
    label: `${runtime.name} settled ${surface.kind} ${surface.videoId}`,
    read: () =>
      readOwnedSurfaceInvariant(
        page,
        runtime,
        surface.videoId,
        surface.counts,
        surface.kind,
        surface.shortIdentity,
        surface.shortsDislikeControl,
      ),
  });
}

function expectCountRequestVideoIds(backend, expectedVideoIds) {
  assertExactSuccessfulVotesTraffic(backend.requests, expectedVideoIds, "The shared navigation contract");
}

async function readStandardProbe(page) {
  return page.evaluate(() => globalThis.__navigationMatrixProbe.snapshot());
}

async function pruneCurrentWatchBar(page, runtime, locators, surface) {
  await locators.reactionRegion.evaluate((reactionRegion, wrapperSelector) => {
    const stats = { addedWrappers: 0, removedWrappers: 0 };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.matches(wrapperSelector)) stats.addedWrappers += 1;
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof Element && node.matches(wrapperSelector)) stats.removedWrappers += 1;
        }
      }
    });
    observer.observe(reactionRegion, { childList: true });
    globalThis.__navigationMatrixBarObserver = observer;
    globalThis.__navigationMatrixBarStats = stats;

    const wrapper = reactionRegion.querySelector(`:scope > ${wrapperSelector}`);
    if (!wrapper) throw new Error("The current matrix reaction tree has no owned rate bar to prune.");
    wrapper.remove();
  }, runtime.selectors.wrapper);

  await waitForOwnedSurfaceWithinBudget(page, runtime, surface);
  await assertOwnedSurfaceContinuously(page, runtime, surface);
  return page.evaluate(() => {
    globalThis.__navigationMatrixBarObserver.disconnect();
    return globalThis.__navigationMatrixBarStats;
  });
}

async function runWatchSidebarRetainPruneScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialDocumentIdentity = await page.evaluate(
    () => globalThis.__navigationMatrixFixture.snapshot().documentIdentity,
  );
  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === origin.videoId);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expect(backend.requestsFor("GET", "/votes").map((request) => request.query.videoId)).toEqual([origin.videoId]);

  const destinationCountGate = backend.defer("GET", "/votes");
  await page.locator("#fixture-matrix-sidebar-watch").click();

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId);
  expect(await page.evaluate(() => globalThis.__navigationMatrixFixture.snapshot())).toEqual({
    currentControls: 0,
    documentIdentity: initialDocumentIdentity,
    phase: "navigate-finish",
    retainedControls: 1,
    retainedTreesConnected: true,
    retainedTreesHidden: true,
    sidebarConnected: true,
    timeline: ["navigate-start", "route-and-shell", "navigate-finish"],
  });
  const retainedOutgoing = page.locator("#fixture-matrix-retained-trees");
  await expect(retainedOutgoing).toBeHidden();
  await expect(
    page.locator('[data-fixture-role="dislike"]').locator(`:is(${runtime.selectors.watchDislikeCount}):visible`),
  ).toHaveCount(0);
  await expect(page.locator(`${runtime.selectors.wrapper}:visible`)).toHaveCount(0);
  if (runtime.clearsOutgoingWatchPresentationOnNavigateStart) {
    await expect(
      retainedOutgoing.locator('[data-fixture-role="dislike"]').locator(runtime.selectors.watchDislikeCount),
    ).toHaveText("");
    await expect(retainedOutgoing.locator(runtime.selectors.wrapper)).toHaveCount(0);
    await expect(page.locator(runtime.selectors.wrapper)).toHaveCount(0);
  }
  expect(backend.requestsFor("GET", "/votes").map((request) => request.query.videoId)).toEqual([origin.videoId]);

  await page.evaluate(() => globalThis.__navigationMatrixFixture.hydrateDestination());
  const destinationRequest = await destinationCountGate.seen;
  try {
    expect(destinationRequest.query.videoId).toBe(destination.videoId);
    expect(await page.evaluate(() => globalThis.__navigationMatrixFixture.snapshot())).toMatchObject({
      currentControls: 1,
      documentIdentity: initialDocumentIdentity,
      phase: "hydrate-destination-controls",
      retainedControls: 1,
      retainedTreesConnected: true,
      retainedTreesHidden: true,
      sidebarConnected: true,
      timeline: ["navigate-start", "route-and-shell", "navigate-finish", "hydrate-destination-controls"],
    });
    const gatedDestination = currentWatchLocators(page, runtime, destination.videoId);
    await expect(gatedDestination.controls).toHaveCount(1);
    await expect(gatedDestination.controls).toBeVisible();
    await expect(
      gatedDestination.controls.locator('[data-fixture-role="dislike"]').locator(runtime.selectors.watchDislikeCount),
    ).toHaveText("");
    await expect(gatedDestination.wrapper).toHaveCount(0);
    await expect(page.locator(`${runtime.selectors.wrapper}:visible`)).toHaveCount(0);
    if (runtime.clearsOutgoingWatchPresentationOnNavigateStart) {
      await expect(
        retainedOutgoing.locator('[data-fixture-role="dislike"]').locator(runtime.selectors.watchDislikeCount),
      ).toHaveText("");
      await expect(retainedOutgoing.locator(runtime.selectors.wrapper)).toHaveCount(0);
      await expect(page.locator(runtime.selectors.wrapper)).toHaveCount(0);
    }
  } finally {
    if (!destinationCountGate.released) {
      destinationCountGate.release({ body: { ...destination.counts, rating: 4.5 } });
    }
  }

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  const destinationLocators = await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  await expect(page.locator("#fixture-matrix-retained-trees").locator(runtime.selectors.wrapper)).toHaveCount(0);
  expect(backend.requestsFor("GET", "/votes").map((request) => request.query.videoId)).toEqual([
    origin.videoId,
    destination.videoId,
  ]);

  const pruneStats = await pruneCurrentWatchBar(page, runtime, destinationLocators, destination);
  expect(pruneStats).toEqual({ addedWrappers: 1, removedWrappers: 1 });
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expect(backend.requestsFor("GET", "/votes").map((request) => request.query.videoId)).toEqual([
    origin.videoId,
    destination.videoId,
  ]);

  await page.evaluate(() => globalThis.__navigationMatrixFixture.detachOutgoing());
  await assertOwnedSurfaceContinuously(page, runtime, destination, 550);
  await expect(page.locator("#fixture-matrix-retained-trees").locator("[data-fixture-control-video-id]")).toHaveCount(
    0,
  );
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expect(await page.evaluate(() => globalThis.__navigationMatrixFixture.snapshot())).toMatchObject({
    currentControls: 1,
    documentIdentity: initialDocumentIdentity,
    phase: "detach-outgoing",
    retainedControls: 0,
    retainedTreesConnected: true,
    retainedTreesHidden: true,
    sidebarConnected: true,
    timeline: [
      "navigate-start",
      "route-and-shell",
      "navigate-finish",
      "hydrate-destination-controls",
      "detach-outgoing",
    ],
  });

  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
}

async function runWatchSameRootHiddenFirstScenario({
  backend,
  beforeNonCurrentDuplicateDetach,
  page,
  runtime,
  scenario,
}) {
  const { destination, origin } = scenario;
  const initialDocumentIdentity = await page.evaluate(
    () => globalThis.__navigationMatrixSameRootFixture.snapshot().documentIdentity,
  );
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.locator("#fixture-matrix-same-root-watch").click();

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId);
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  const outgoingIsOffscreen = scenario.transition.outgoingPresentation === "offscreen";
  const settledTopology = await page.evaluate(() => globalThis.__navigationMatrixSameRootFixture.snapshot());
  expect(settledTopology).toEqual({
    documentIdentity: initialDocumentIdentity,
    hiddenFirst: true,
    hiddenOutgoingConnected: true,
    hiddenOutgoingHeight: outgoingIsOffscreen ? expect.any(Number) : 0,
    hiddenOutgoingWidth: outgoingIsOffscreen ? expect.any(Number) : 0,
    liveDestinationConnected: true,
    outgoingIntersectsViewport: false,
    outgoingPresentation: scenario.transition.outgoingPresentation,
    rootVideoId: destination.videoId,
    sameRoot: true,
    sidebarConnected: true,
  });
  if (outgoingIsOffscreen) {
    expect(settledTopology.hiddenOutgoingHeight).toBeGreaterThan(0);
    expect(settledTopology.hiddenOutgoingWidth).toBeGreaterThan(0);
  }
  const currentRoot = page.locator(`ytd-watch-flexy[video-id="${destination.videoId}"]`);
  await expect(currentRoot.locator("ytd-menu-renderer.ytd-watch-metadata > div")).toHaveCount(2);
  await expect(
    currentRoot.locator('[data-fixture-matrix-hidden-outgoing="true"]').locator(runtime.selectors.wrapper),
  ).toHaveCount(0);
  await expect(
    currentRoot.locator('[data-fixture-matrix-live-destination="true"]').locator(runtime.selectors.wrapper),
  ).toHaveCount(1);
  if (scenario.transition.controlMarkup === "legacy-segmented") {
    await expect(currentRoot.locator("#segmented-like-button")).toHaveCount(2);
    await expect(currentRoot.locator("#segmented-dislike-button")).toHaveCount(2);
    await expect(
      currentRoot.locator('[data-fixture-matrix-live-destination="true"]').locator("#segmented-dislike-button #text"),
    ).toHaveText(String(destination.counts.dislikes));
  }
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expect(await page.evaluate(() => globalThis.__navigationMatrixSameRootFixture.snapshot())).toMatchObject({
    documentIdentity: initialDocumentIdentity,
    hiddenFirst: true,
    hiddenOutgoingConnected: true,
    hiddenOutgoingHeight: outgoingIsOffscreen ? expect.any(Number) : 0,
    hiddenOutgoingWidth: outgoingIsOffscreen ? expect.any(Number) : 0,
    liveDestinationConnected: true,
    outgoingIntersectsViewport: false,
    outgoingPresentation: scenario.transition.outgoingPresentation,
    rootVideoId: destination.videoId,
    sameRoot: true,
    sidebarConnected: true,
  });

  await beforeNonCurrentDuplicateDetach?.();

  await page.evaluate(() => globalThis.__navigationMatrixSameRootFixture.detachOutgoing());
  await assertOwnedSurfaceContinuously(page, runtime, destination, 550);
  await expect(currentRoot.locator("ytd-menu-renderer.ytd-watch-metadata > div")).toHaveCount(1);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runWatchHistoryScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.locator("#watch-next").click();
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 1,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);

  await page.goBack();
  await waitForOwnedSurfaceWithinBudget(page, runtime, origin);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: origin.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [origin.videoId],
    navigateFinishes: 2,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId, origin.videoId]);

  await page.goForward();
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [origin.videoId, destination.videoId],
    navigateFinishes: 3,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId, origin.videoId, destination.videoId]);

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId, origin.videoId, destination.videoId]);
}

async function runWatchAutoplayScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate(() => globalThis.__navigationFixture.dispatchEnded());

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 0,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runWatchStartWithoutFinishScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate(
    (videoId) => globalThis.__navigationFixture.navigateWatchAfterStartWithoutFinish(videoId),
    destination.videoId,
  );

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 0,
    navigateStarts: 1,
    transitionPending: "watch-start-without-finish",
  });
  const outgoingControls = page.locator(`[data-fixture-control-video-id="${origin.videoId}"]`);
  await expect(outgoingControls).toHaveCount(1);
  await expect(outgoingControls).toBeVisible();
  await page.waitForTimeout(650);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate(() => globalThis.__navigationFixture.finishWatchAfterStartWithoutFinish());
  await expect(outgoingControls).toHaveCount(0);

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "watch",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 0,
    navigateStarts: 1,
    transitionPending: null,
  });

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runCrossSurfaceScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  if (origin.kind === "watch") {
    await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  } else {
    await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  }
  expectCountRequestVideoIds(backend, [origin.videoId]);

  const linkId = origin.kind === "watch" ? "watch-to-short" : "short-to-watch";
  await page.locator(`#${linkId}`).click();

  if (destination.kind === "watch") {
    await expect(page).toHaveURL(
      (url) => url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId,
    );
  } else {
    await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);
  }
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: origin.kind,
    currentVideoId: origin.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 1,
    navigateStarts: 0,
    transitionPending: destination.kind,
  });
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination, scenario.timing?.maxFirstValidMs);
  if (destination.kind === "watch") {
    await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  } else {
    await expectOwnedShortControl(page, runtime, destination.videoId, destination.counts);
  }
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: destination.kind,
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 1,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runWatchActionContainerReplacementScenario({ backend, page, runtime, scenario }) {
  const { origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate((selectors) => {
    const currentActions = document.querySelector(
      '[data-fixture-page-kind="watch"] ytd-menu-renderer.ytd-watch-metadata > div',
    );
    if (!currentActions) throw new Error("The current watch fixture has no action container to replace.");
    const replacement = currentActions.cloneNode(true);
    replacement.setAttribute("data-fixture-matrix-action-replacement", "true");
    replacement.querySelectorAll(selectors.wrapper).forEach((element) => element.remove());
    const controls = replacement.querySelector("[data-fixture-control-video-id]");
    for (const role of ["like", "dislike"]) {
      const control = controls.querySelector(`[data-fixture-role="${role}"]`);
      control.classList.remove("style-default-active");
      control.classList.add("style-text");
      control.querySelector("button")?.setAttribute("aria-pressed", "false");
    }
    controls
      .querySelectorAll(
        '[data-fixture-role="dislike"] .ytSpecButtonShapeNextButtonTextContent, [data-fixture-role="dislike"] #text',
      )
      .forEach((element) => element.remove());

    const stats = { addedWrappers: 0 };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.matches(selectors.wrapper)) stats.addedWrappers += 1;
        }
      }
    });
    observer.observe(replacement, { childList: true });
    globalThis.__navigationMatrixReplacementObserver = observer;
    globalThis.__navigationMatrixReplacementStats = stats;
    globalThis.__navigationMatrixReplacedActions = currentActions;
    currentActions.replaceWith(replacement);
  }, runtime.selectors);

  await waitForOwnedSurfaceWithinBudget(page, runtime, origin);
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  await expect(page.locator('[data-fixture-matrix-action-replacement="true"]')).toHaveCount(1);
  expect(
    await page.evaluate(() => ({
      oldContainerConnected: globalThis.__navigationMatrixReplacedActions.isConnected,
      probe: globalThis.__navigationMatrixProbe.snapshot(),
    })),
  ).toMatchObject({
    oldContainerConnected: false,
    probe: {
      currentKind: "watch",
      currentVideoId: origin.videoId,
      documentIdentity: initialProbe.documentIdentity,
      historyRenders: [],
      navigateFinishes: 0,
      navigateStarts: 0,
      transitionPending: null,
    },
  });
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await assertOwnedSurfaceContinuously(page, runtime, origin);
  const replacementStats = await page.evaluate(() => {
    globalThis.__navigationMatrixReplacementObserver.disconnect();
    return globalThis.__navigationMatrixReplacementStats;
  });
  expect(replacementStats).toEqual({ addedWrappers: 1 });
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);
}

async function runWatchSameNodeRouteCompletionScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  expect(expectedDislikeText(origin.counts)).toBe(expectedDislikeText(destination.counts));
  expect(origin.counts.dislikes).not.toBe(destination.counts.dislikes);
  expect(origin.counts.likes / (origin.counts.likes + origin.counts.dislikes)).not.toBe(
    destination.counts.likes / (destination.counts.likes + destination.counts.dislikes),
  );
  const initialTopology = await page.evaluate(() => globalThis.__navigationMatrixSameNodeFixture.snapshot());
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  const destinationCountGate = backend.defer("GET", "/votes");
  await page.locator("#fixture-matrix-same-node-watch").click();
  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId);
  expect(await page.evaluate(() => globalThis.__navigationMatrixSameNodeFixture.snapshot())).toMatchObject({
    countAfterNavigateStart: "",
    countAfterRouteAndRoot: "",
    timeline: ["navigate-start", "route-and-root-only", "navigate-finish"],
  });

  const destinationRequest = await destinationCountGate.seen;
  expect(destinationRequest.query.videoId).toBe(destination.videoId);
  const pendingDestination = currentWatchLocators(page, runtime, destination.videoId);
  await expect(pendingDestination.controls).toHaveCount(1);
  await expect(
    pendingDestination.controls.locator('[data-fixture-role="dislike"]').locator(runtime.selectors.watchDislikeCount),
  ).toHaveText("");
  await expect(pendingDestination.wrapper).toHaveCount(0);
  if (runtime.selectors.wrapperVideoAttribute) {
    await expect(
      page.locator(`${runtime.selectors.wrapper}[${runtime.selectors.wrapperVideoAttribute}="${origin.videoId}"]`),
    ).toHaveCount(0);
  }

  destinationCountGate.release({ body: { ...destination.counts, rating: 4.5 } });
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  const destinationLocators = await expectOwnedWatchBar(page, runtime, destination.videoId, destination.counts);
  if (runtime.selectors.wrapperVideoAttribute) {
    await expect(destinationLocators.wrapper).toHaveAttribute(
      runtime.selectors.wrapperVideoAttribute,
      destination.videoId,
    );
  }
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expect(await page.evaluate(() => globalThis.__navigationMatrixSameNodeFixture.snapshot())).toEqual({
    buttonsReused: true,
    countAfterNavigateStart: "",
    countAfterRouteAndRoot: "",
    controlsReused: true,
    dislikeReused: true,
    documentIdentity: initialTopology.documentIdentity,
    likeReused: true,
    rootVideoId: destination.videoId,
    sidebarConnected: true,
    timeline: ["navigate-start", "route-and-root-only", "navigate-finish"],
  });

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runWatchRateBarCorruptionScenario({ backend, page, runtime, scenario }) {
  const { origin } = scenario;
  await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  for (const corruption of scenario.transition.corruptions) {
    const corrupted = await page.evaluate(
      ({ corruption: corruptionKind, selectors }) => {
        const wrapper = document.querySelector(selectors.wrapper);
        const container = wrapper?.querySelector(selectors.container);
        const fill = container?.querySelector(selectors.bar);
        if (!wrapper || !container || !fill) {
          throw new Error(`Cannot apply ${corruptionKind}; the current rate bar is incomplete.`);
        }
        globalThis.__navigationMatrixCorruptedRateBar = wrapper;
        if (corruptionKind === "hidden-wrapper") {
          wrapper.hidden = true;
        } else if (corruptionKind === "collapsed-wrapper") {
          wrapper.style.width = "0px";
          wrapper.style.overflow = "hidden";
        } else if (corruptionKind === "missing-fill") {
          fill.remove();
        } else if (corruptionKind === "missing-video-owner") {
          wrapper.removeAttribute(selectors.wrapperVideoAttribute);
        } else if (corruptionKind === "stale-video-owner") {
          wrapper.setAttribute(selectors.wrapperVideoAttribute, "stalevid001");
        } else if (corruptionKind === "stripped-wrapper-class") {
          wrapper.classList.remove("ryd-tooltip");
        } else {
          throw new Error(`Unknown rate-bar corruption ${corruptionKind}.`);
        }
        const bounds = wrapper.getBoundingClientRect();
        return {
          connected: wrapper.isConnected,
          height: bounds.height,
          hidden: wrapper.hidden,
          width: bounds.width,
        };
      },
      { corruption, selectors: runtime.selectors },
    );
    expect(corrupted.connected).toBe(true);
    if (corruption === "hidden-wrapper") {
      expect(corrupted.hidden).toBe(true);
    }
    if (corruption === "collapsed-wrapper") {
      expect(corrupted.width).toBe(0);
    }

    await waitForOwnedSurfaceWithinBudget(page, runtime, origin);
    await expectOwnedWatchBar(page, runtime, origin.videoId, origin.counts);
    expect(await page.evaluate(() => globalThis.__navigationMatrixCorruptedRateBar.isConnected)).toBe(false);
    expectCountRequestVideoIds(backend, [origin.videoId]);
    await assertOwnedSurfaceContinuously(page, runtime, origin, 300);
  }
}

async function runShortNextScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const initialProbe = await readStandardProbe(page);
  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.locator("#short-next").click();
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedShortControl(page, runtime, destination.videoId, destination.counts);
  expect(await readStandardProbe(page)).toMatchObject({
    currentKind: "shorts",
    currentVideoId: destination.videoId,
    documentIdentity: initialProbe.documentIdentity,
    historyRenders: [],
    navigateFinishes: 1,
    navigateStarts: 0,
    transitionPending: null,
  });
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runShortSameRendererStartOnlyScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const repeatedStart = scenario.transition.navigateStarts === "before-and-after-route";
  const expectedTimeline = repeatedStart
    ? ["navigate-start-a", "synthetic-removed-before-route", "route-and-exact-href-only", "navigate-start-b"]
    : ["navigate-start", "route-and-exact-href-only"];
  const expectedImmediateAfterRoute = {
    actionBarReused: true,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    likeReused: true,
    rendererReused: true,
    rendererVideoId: null,
    ...(repeatedStart
      ? {
          nativeDislikeReused: false,
          syntheticCount: 0,
          syntheticReused: false,
        }
      : {
          nativeDislikeReused: true,
          syntheticCount: 1,
          syntheticReused: true,
        }),
  };
  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  const initial = await page.evaluate(() => globalThis.__navigationMatrixSameRendererShortFixture.snapshot());
  await page.locator("#short-next").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);

  const expectedShortHrefs = destination.unrelatedDescriptionShortVideoId
    ? [`/shorts/${destination.videoId}`, `/shorts/${destination.unrelatedDescriptionShortVideoId}`]
    : [`/shorts/${destination.videoId}`];

  expect(await page.evaluate(() => globalThis.__navigationMatrixSameRendererShortFixture.snapshot())).toMatchObject({
    actionBarReused: true,
    documentIdentity: initial.documentIdentity,
    href: `/shorts/${destination.videoId}`,
    immediatelyAfterRoute: expectedImmediateAfterRoute,
    isActive: false,
    likeReused: true,
    navigateFinishes: 0,
    rendererReused: true,
    rendererVideoId: null,
    shortHrefs: expectedShortHrefs,
    timeline: expectedTimeline,
    visibleRendererCount: 1,
  });
  const immediateAfterRoute = await page.evaluate(
    () => globalThis.__navigationMatrixSameRendererShortFixture.snapshot().immediatelyAfterRoute,
  );
  if (repeatedStart) {
    expect(immediateAfterRoute).toMatchObject({
      nativeDislikeReused: false,
      syntheticCount: 0,
      syntheticDisabled: null,
      syntheticReused: false,
      syntheticText: null,
    });
  } else if (runtime.name === "extension") {
    expect(immediateAfterRoute).toMatchObject({
      nativeDislikeReused: true,
      syntheticCount: 1,
      syntheticDisabled: true,
      syntheticReused: true,
      syntheticText: "",
    });
  }

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedShortControl(page, runtime, destination.videoId, destination.counts, destination.shortIdentity);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expect(await page.evaluate(() => globalThis.__navigationMatrixSameRendererShortFixture.snapshot())).toMatchObject({
    actionBarReused: true,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    likeReused: true,
    nativeDislikeReused: !repeatedStart,
    navigateFinishes: 0,
    rendererReused: true,
    rendererVideoId: null,
    shortHrefs: expectedShortHrefs,
    syntheticCount: 1,
    syntheticReused: !repeatedStart,
    timeline: expectedTimeline,
    visibleRendererCount: 1,
  });

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

async function runShortPersistentDataNullScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const expectedTimeline = ["navigate-start", "route-and-fresh-five-native-persistent-data-null-action-root"];
  const readFixture = () => page.evaluate(() => globalThis.__navigationMatrixPersistentDataNullShortFixture.snapshot());
  const expectNoInteractions = () =>
    expect(
      backend.requests.filter(
        (request) =>
          request.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(request.pathname),
      ),
    ).toEqual([]);

  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expectNoInteractions();
  const initial = await readFixture();

  await page.locator("#short-next").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);
  expect(await readFixture()).toMatchObject({
    actionBarConnected: true,
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "comments", "share", "remix", "pivot"],
    currentActionButtonCount: 5,
    currentNativeChildCount: 5,
    currentSyntheticCount: 0,
    currentSyntheticVideoIds: [],
    documentIdentity: initial.documentIdentity,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 5,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 0,
    navigateFinishes: 0,
    navigateStarts: 1,
    originActionBarConnected: false,
    originSyntheticConnected: false,
    rendererReused: true,
    rendererVideoId: null,
    syntheticEnabled: false,
    timeline: expectedTimeline,
    visibleActionButtonCount: 5,
    visibleRendererCount: 1,
  });

  await page.waitForTimeout(scenario.timing.unsafeWindowMs);
  const unsafeWindow = await readFixture();
  expect(unsafeWindow).toMatchObject({
    actionBarConnected: true,
    actionBarDataReadCount: expect.any(Number),
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "comments", "share", "remix", "pivot"],
    currentActionButtonCount: 5,
    currentNativeChildCount: 5,
    currentSyntheticCount: 0,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 5,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 0,
    rendererVideoId: null,
    visibleActionButtonCount: 5,
    visibleRendererCount: 1,
  });
  expect(unsafeWindow.actionBarDataReadCount).toBeGreaterThan(0);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expectNoInteractions();

  await waitForOwnedSurfaceWithinBudget(page, runtime, destination, scenario.timing.maxFirstValidMs);
  await expectOwnedShortControl(page, runtime, destination.videoId, destination.counts, destination.shortIdentity);
  const recovered = await readFixture();
  expect(recovered).toMatchObject({
    actionBarConnected: true,
    actionBarDataReadCount: expect.any(Number),
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "dislike", "comments", "share", "remix", "pivot"],
    currentActionButtonCount: 6,
    currentNativeChildCount: 5,
    currentSyntheticCount: 1,
    currentSyntheticVideoIds: [destination.videoId],
    documentIdentity: initial.documentIdentity,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 6,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 0,
    navigateFinishes: 0,
    navigateStarts: 1,
    originActionBarConnected: false,
    originSyntheticConnected: false,
    rendererReused: true,
    rendererVideoId: null,
    syntheticEnabled: true,
    timeline: expectedTimeline,
    visibleActionButtonCount: 6,
    visibleRendererCount: 1,
  });
  expect(recovered.actionBarDataReadCount).toBeGreaterThan(unsafeWindow.actionBarDataReadCount);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expectNoInteractions();

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expectNoInteractions();
  expect(await readFixture()).toMatchObject({
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionNames: ["like", "dislike", "comments", "share", "remix", "pivot"],
    currentNativeChildCount: 5,
    currentSyntheticCount: 1,
    currentSyntheticVideoIds: [destination.videoId],
    hitTestedActionButtonCount: 6,
    nativeChildrenStable: true,
    visibleActionButtonCount: 6,
  });
}

async function runShortPersistentDataNullInertScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const expectedTimeline = [
    "navigate-start",
    "hide-one-native-activation-target",
    "route-and-fresh-persistent-data-null-action-root",
  ];
  const readFixture = () =>
    page.evaluate(() => globalThis.__navigationMatrixPersistentDataNullVariantFixture.snapshot());
  const requestState = () => ({
    interactionPaths: backend.requests
      .filter(
        (request) =>
          request.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(request.pathname),
      )
      .map((request) => request.pathname),
    videoIds: backend.requests
      .filter((request) => request.method === "GET" && request.pathname === "/votes")
      .map((request) => request.query?.videoId),
  });
  const geometryMatches = (actual, expected) =>
    actual !== null &&
    expected !== null &&
    ["bottom", "height", "left", "right", "top", "width"].every(
      (property) => Math.abs(actual[property] - expected[property]) <= 0.5,
    );

  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expect(requestState().interactionPaths).toEqual([]);
  const initial = await readFixture();

  await page.locator("#short-next").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);
  const transitioned = await readFixture();
  expect(transitioned).toMatchObject({
    actionBarConnected: true,
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "comments", "share", "remix", "pivot"],
    blockedActivationConnected: true,
    currentActionButtonCount: 5,
    currentNativeChildCount: 5,
    currentSyntheticCount: 0,
    documentIdentity: initial.documentIdentity,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 4,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 0,
    navigateFinishes: 0,
    navigateStarts: 1,
    nonRenderedActionButtonCount: 1,
    originActionBarConnected: false,
    originSyntheticConnected: false,
    rendererReused: true,
    rendererVideoId: null,
    timeline: expectedTimeline,
    visibleActionButtonCount: 4,
    visibleRendererCount: 1,
  });
  expect(transitioned.actionBarBounds?.height).toBeGreaterThan(0);
  expect(transitioned.actionBarBounds?.width).toBeGreaterThan(0);

  await assertInvariantContinuously({
    durationMs: scenario.timing.inertForMs,
    intervalMs: 25,
    isValid: ({ fixture, requests }) =>
      fixture.actionBarConnected &&
      fixture.actionBarDataReady === false &&
      fixture.actionBarDataWriteCount === 0 &&
      fixture.currentActionButtonCount === 5 &&
      fixture.currentNativeChildCount === 5 &&
      fixture.currentSyntheticCount === 0 &&
      fixture.exactHrefRendererCount === 1 &&
      fixture.hitTestedActionButtonCount === 4 &&
      fixture.nativeChildrenStable &&
      fixture.nativeDislikeCount === 0 &&
      fixture.nonRenderedActionButtonCount === 1 &&
      fixture.visibleActionButtonCount === 4 &&
      fixture.visibleRendererCount === 1 &&
      geometryMatches(fixture.actionBarBounds, transitioned.actionBarBounds) &&
      requests.interactionPaths.length === 0 &&
      requests.videoIds.length === 1 &&
      requests.videoIds[0] === origin.videoId,
    label: `${runtime.name} incomplete persistent data-null Shorts surface remains inert`,
    read: async () => ({ fixture: await readFixture(), requests: requestState() }),
  });

  expectCountRequestVideoIds(backend, [origin.videoId]);
  expect(requestState().interactionPaths).toEqual([]);
  expect(await readFixture()).toMatchObject({
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    currentSyntheticCount: 0,
    hitTestedActionButtonCount: 4,
    nativeChildrenStable: true,
    nativeDislikeCount: 0,
    nonRenderedActionButtonCount: 1,
    visibleActionButtonCount: 4,
  });
}

async function runShortPersistentDataNullNativeDislikeScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const expectedTimeline = [
    "navigate-start",
    "append-native-dislike",
    "route-and-fresh-persistent-data-null-action-root",
  ];
  const readFixture = () =>
    page.evaluate(() => globalThis.__navigationMatrixPersistentDataNullVariantFixture.snapshot());
  const expectNoInteractions = () =>
    expect(
      backend.requests.filter(
        (request) =>
          request.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(request.pathname),
      ),
    ).toEqual([]);

  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expectNoInteractions();
  const initial = await readFixture();

  await page.locator("#short-next").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);
  expect(await readFixture()).toMatchObject({
    actionBarConnected: true,
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "dislike", "comments", "share", "remix", "pivot"],
    currentActionButtonCount: 6,
    currentNativeChildCount: 6,
    currentSyntheticCount: 0,
    documentIdentity: initial.documentIdentity,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 6,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 1,
    nativeDislikeText: "",
    navigateFinishes: 0,
    navigateStarts: 1,
    nonRenderedActionButtonCount: 0,
    originActionBarConnected: false,
    originSyntheticConnected: false,
    rendererReused: true,
    rendererVideoId: null,
    timeline: expectedTimeline,
    visibleActionButtonCount: 6,
    visibleRendererCount: 1,
  });
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expectNoInteractions();

  await page.waitForTimeout(scenario.timing.unsafeWindowMs);
  expect(await readFixture()).toMatchObject({
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionNames: ["like", "dislike", "comments", "share", "remix", "pivot"],
    currentActionButtonCount: 6,
    currentNativeChildCount: 6,
    currentSyntheticCount: 0,
    hitTestedActionButtonCount: 6,
    nativeChildrenStable: true,
    nativeDislikeCount: 1,
    nativeDislikeText: "",
    nonRenderedActionButtonCount: 0,
    visibleActionButtonCount: 6,
  });
  expectCountRequestVideoIds(backend, [origin.videoId]);
  expectNoInteractions();

  const readiness = await waitForOwnedSurfaceWithinBudget(page, runtime, destination, scenario.timing.maxFirstValidMs);
  expect(readiness.firstValidMs).toBeLessThan(scenario.timing.maxFirstValidMs);
  await expectOwnedShortControl(
    page,
    runtime,
    destination.videoId,
    destination.counts,
    destination.shortIdentity,
    destination.shortsDislikeControl,
  );
  const initialized = await readFixture();
  expect(initialized).toMatchObject({
    actionBarConnected: true,
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    actionBarReplaced: true,
    actionNames: ["like", "dislike", "comments", "share", "remix", "pivot"],
    blockedActivationConnected: false,
    currentActionButtonCount: 6,
    currentNativeChildCount: 6,
    currentSyntheticCount: 0,
    documentIdentity: initial.documentIdentity,
    exactHrefRendererCount: 1,
    hitTestedActionButtonCount: 6,
    href: `/shorts/${destination.videoId}`,
    isActive: false,
    nativeChildrenStable: true,
    nativeDislikeCount: 1,
    nativeDislikeText: String(destination.counts.dislikes),
    navigateFinishes: 0,
    navigateStarts: 1,
    nonRenderedActionButtonCount: 0,
    originActionBarConnected: false,
    originSyntheticConnected: false,
    rendererReused: true,
    rendererVideoId: null,
    timeline: expectedTimeline,
    visibleActionButtonCount: 6,
    visibleRendererCount: 1,
  });
  expect(initialized.actionBarBounds?.height).toBeGreaterThan(0);
  expect(initialized.actionBarBounds?.width).toBeGreaterThan(0);
  expect(initialized.actionBarDataReadCount).toBeGreaterThan(0);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expectNoInteractions();

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expectNoInteractions();
  expect(await readFixture()).toMatchObject({
    actionBarDataReady: false,
    actionBarDataWriteCount: 0,
    currentNativeChildCount: 6,
    currentSyntheticCount: 0,
    nativeChildrenStable: true,
    nativeDislikeCount: 1,
    nativeDislikeText: String(destination.counts.dislikes),
  });
}

async function runShortReplacedRootStartOnlyScenario({ backend, page, runtime, scenario }) {
  const { destination, origin } = scenario;
  const repeatedStart = scenario.transition.navigateStarts === "before-and-after-route";
  const expectedRouteTimeline = repeatedStart
    ? ["navigate-start-a", "route-and-root-without-action-bar", "navigate-start-b"]
    : ["navigate-start", "route-and-root-without-action-bar"];

  await expectOwnedShortControl(page, runtime, origin.videoId, origin.counts);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  const initial = await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot());

  await page.locator("#short-next").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${destination.videoId}`);
  expect(await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot())).toEqual({
    actionBarConnected: false,
    actionBarDataReadCount: 0,
    actionBarDataReady: false,
    actionBarFirstDataReadDelayMs: null,
    currentActionButtonCount: 0,
    currentNativeChildCount: 0,
    currentSyntheticCount: 0,
    currentSyntheticVideoIds: [],
    destinationRendererConnected: true,
    destinationRendererVisible: true,
    destinationRootConnected: true,
    documentIdentity: initial.documentIdentity,
    navigateFinishes: 0,
    navigateStarts: repeatedStart ? 2 : 1,
    originRootConnected: false,
    originSyntheticConnected: false,
    rendererVideoId: destination.videoId,
    timeline: expectedRouteTimeline,
  });

  // Cross the periodic lifecycle boundary while the selected destination has
  // no action root at all. This is the exact state that previously deadlocked
  // the extension after its observer stayed attached to the detached A root.
  await page.waitForTimeout(650);
  expectCountRequestVideoIds(backend, [origin.videoId]);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);

  await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.appendEmptyActionBar());
  await expect
    .poll(
      () =>
        page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot().actionBarDataReadCount),
      {
        intervals: [25],
        message: `${runtime.name} must observe the replacement Shorts root before the next 500ms watchdog tick`,
        timeout: 225,
      },
    )
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot())).toMatchObject({
    actionBarConnected: true,
    actionBarDataReadCount: expect.any(Number),
    actionBarDataReady: false,
    actionBarFirstDataReadDelayMs: expect.any(Number),
    currentActionButtonCount: 0,
    currentNativeChildCount: 0,
    currentSyntheticCount: 0,
    timeline: [...expectedRouteTimeline, "append-empty-data-null-action-bar"],
  });
  expect(
    await page.evaluate(
      () => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot().actionBarFirstDataReadDelayMs,
    ),
  ).toBeLessThanOrEqual(175);
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.appendNativeChildren());
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot())).toMatchObject({
    actionBarConnected: true,
    actionBarDataReadCount: expect.any(Number),
    actionBarDataReady: false,
    actionBarFirstDataReadDelayMs: expect.any(Number),
    currentActionButtonCount: 5,
    currentNativeChildCount: 5,
    currentSyntheticCount: 0,
    timeline: [
      ...expectedRouteTimeline,
      "append-empty-data-null-action-bar",
      "append-complete-native-inventory-data-null",
    ],
  });
  expectCountRequestVideoIds(backend, [origin.videoId]);

  await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.hydrateActionBar());
  await waitForOwnedSurfaceWithinBudget(page, runtime, destination);
  await expectOwnedShortControl(page, runtime, destination.videoId, destination.counts);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
  expect(await page.evaluate(() => globalThis.__navigationMatrixReplacedRootShortFixture.snapshot())).toEqual({
    actionBarConnected: true,
    actionBarDataReadCount: expect.any(Number),
    actionBarDataReady: true,
    actionBarFirstDataReadDelayMs: expect.any(Number),
    currentActionButtonCount: 6,
    currentNativeChildCount: 5,
    currentSyntheticCount: 1,
    currentSyntheticVideoIds: [destination.videoId],
    destinationRendererConnected: true,
    destinationRendererVisible: true,
    destinationRootConnected: true,
    documentIdentity: initial.documentIdentity,
    navigateFinishes: 0,
    navigateStarts: repeatedStart ? 2 : 1,
    originRootConnected: false,
    originSyntheticConnected: false,
    rendererVideoId: destination.videoId,
    timeline: [
      ...expectedRouteTimeline,
      "append-empty-data-null-action-bar",
      "append-complete-native-inventory-data-null",
      "hydrate-action-bar-data",
    ],
  });

  await assertOwnedSurfaceContinuously(page, runtime, destination);
  expectCountRequestVideoIds(backend, [origin.videoId, destination.videoId]);
}

const SCENARIO_RUNNERS = {
  "short-next-short-active-reel": runShortNextScenario,
  "short-next-short-active-reel-compact": runShortNextScenario,
  "short-next-short-active-reel-medium": runShortNextScenario,
  "short-next-short-exact-href-with-description-crosslink": runShortSameRendererStartOnlyScenario,
  "short-next-short-persistent-data-null-native-dislike": runShortPersistentDataNullNativeDislikeScenario,
  "short-next-short-persistent-data-null-nonrendered-native-stays-inert": runShortPersistentDataNullInertScenario,
  "short-next-short-replace-root-repeated-start-no-finish-staged-hydration": runShortReplacedRootStartOnlyScenario,
  "short-next-short-replace-root-start-no-finish-staged-hydration": runShortReplacedRootStartOnlyScenario,
  "short-next-short-reuse-renderer-replace-action-root-exact-href-persistent-data-null":
    runShortPersistentDataNullScenario,
  "short-next-short-reuse-renderer-repeated-start-no-finish": runShortSameRendererStartOnlyScenario,
  "short-next-short-reuse-renderer-start-no-finish": runShortSameRendererStartOnlyScenario,
  "short-direct-watch-delayed": runCrossSurfaceScenario,
  "watch-autoplay-watch-replace-no-finish": runWatchAutoplayScenario,
  "watch-navigate-start-watch-replace-no-finish": runWatchStartWithoutFinishScenario,
  "watch-current-action-container-replace": runWatchActionContainerReplacementScenario,
  "watch-current-rate-bar-connected-corruption": runWatchRateBarCorruptionScenario,
  "watch-direct-short-delayed": runCrossSurfaceScenario,
  "watch-history-back-forward-replace": runWatchHistoryScenario,
  "watch-sidebar-watch-retain-prune": runWatchSidebarRetainPruneScenario,
  "watch-sidebar-watch-legacy-segmented-duplicate-ids": runWatchSameRootHiddenFirstScenario,
  "watch-sidebar-watch-same-root-hidden-first": runWatchSameRootHiddenFirstScenario,
  "watch-sidebar-watch-same-root-offscreen-first": runWatchSameRootHiddenFirstScenario,
  "watch-sidebar-watch-same-node-route-complete": runWatchSameNodeRouteCompletionScenario,
};
const NAVIGATION_SCENARIO_RUNNER_IDS = Object.freeze(Object.keys(SCENARIO_RUNNERS));

async function runNavigationMatrixScenario(options) {
  const runner = SCENARIO_RUNNERS[options.scenario.id];
  if (!runner) throw new Error(`No navigation matrix runner is registered for ${options.scenario.id}.`);
  await runner(options);
}

module.exports = {
  EXTENSION_MATRIX_RUNTIME,
  NAVIGATION_MATRIX,
  NAVIGATION_SCENARIO_RUNNER_IDS,
  NO_DESTINATION_DISLIKE_POSTCONDITION,
  SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
  USERSCRIPT_MATRIX_RUNTIME,
  WATCH_SIDEBAR_MATRIX,
  getDestinationDislikePostconditionTarget,
  installNavigationMatrixFixture,
  runNavigationMatrixScenario,
};
