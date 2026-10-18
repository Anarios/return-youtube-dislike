const assert = require("node:assert/strict");
const { assertExactSuccessfulVotesTraffic } = require("./hermetic-api-contract");

const SHORTS_PLACEHOLDER_POOL_SIZE = 10;
const SHORTS_PLACEHOLDER_POOL_HOPS = 10;
const SHORTS_PLACEHOLDER_POOL_VIDEO_IDS = Object.freeze(
  Array.from({ length: SHORTS_PLACEHOLDER_POOL_HOPS + 1 }, (_, index) => `PoolVid${String(index).padStart(4, "0")}`),
);
const SHORTS_PLACEHOLDER_POOL_COUNTS = Object.freeze(
  Object.fromEntries(
    SHORTS_PLACEHOLDER_POOL_VIDEO_IDS.map((videoId, index) => [
      videoId,
      Object.freeze({ dislikes: 210 + index * 17, likes: 1_100 + index * 31 }),
    ]),
  ),
);
const SHORTS_PLACEHOLDER_POOL_ACTION_ORDER = Object.freeze(["like", "dislike", "comments", "share", "remix", "pivot"]);
const SHORTS_PLACEHOLDER_POOL_MARKER = "rydShortsPlaceholderPool=1";
const SHORTS_SYNTHETIC_DISLIKE_SELECTOR = "[data-ryd-synthetic-shorts-dislike]";
const SHORTS_DUPLICATE_NORMALIZATION_HOP = 3;
const SHORTS_NATIVE_CLEANUP_HOP = 5;
const SHORTS_EVENTLESS_RETURN_HOP = 7;
const SHORTS_NATIVE_LIKE_PAINT_HOP = 1;
const SHORTS_PIXEL_ORACLE_HOPS = new Set([0, 1, SHORTS_PLACEHOLDER_POOL_HOPS]);
const SHORTS_FRESH_ROUTE_EPOCH_MS = 250;
const SHORTS_TRANSITION_OBSERVATION_PHASES = Object.freeze([
  "route-current-active-offscreen",
  "partial-active-ambiguous",
  "visible-active-data-null-after-timeout",
]);

function createShortsPlaceholderPoolFixture() {
  const fixtureConfig = JSON.stringify({
    actionOrder: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
    counts: SHORTS_PLACEHOLDER_POOL_COUNTS,
    freshRouteEpochMs: SHORTS_FRESH_ROUTE_EPOCH_MS,
    hops: SHORTS_PLACEHOLDER_POOL_HOPS,
    marker: SHORTS_PLACEHOLDER_POOL_MARKER,
    nativeLikePaintHop: SHORTS_NATIVE_LIKE_PAINT_HOP,
    poolSize: SHORTS_PLACEHOLDER_POOL_SIZE,
    syntheticSelector: SHORTS_SYNTHETIC_DISLIKE_SELECTOR,
    videoIds: SHORTS_PLACEHOLDER_POOL_VIDEO_IDS,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Shorts pre-rendered placeholder pool fixture</title>
    <style>
      html,
      body {
        background: #0f0f0f;
        color: #f1f1f1;
        height: 100%;
        margin: 0;
        overflow: hidden;
        width: 100%;
      }

      #fixture-shorts-stage {
        height: 640px;
        left: 72px;
        overflow: visible;
        position: relative;
        top: 24px;
        width: 460px;
      }

      #fixture-next-short {
        background: #272727;
        border: 0;
        border-radius: 24px;
        color: #fff;
        height: 48px;
        position: fixed;
        right: 24px;
        top: 24px;
        width: 96px;
        z-index: 100;
      }

      ytd-shorts,
      .reel-video-in-sequence-new,
      .reel-video-in-sequence-thumbnail,
      ytd-reel-video-renderer,
      reel-action-bar-view-model,
      like-button-view-model,
      dislike-button-view-model,
      button-view-model,
      pivot-button-view-model {
        display: block;
      }

      .reel-video-in-sequence-new {
        height: 640px;
        left: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
        width: 460px;
      }

      .reel-video-in-sequence-thumbnail {
        height: 1px;
        width: 1px;
      }

      ytd-reel-video-renderer {
        background: #161616;
        border-radius: 12px;
        height: 620px;
        left: 0;
        position: absolute;
        top: 0;
        transform: translateY(var(--fixture-reel-offset));
        width: 460px;
      }

      ytd-reel-video-renderer[is-active] {
        pointer-events: auto;
      }

      #experiment-overlay {
        height: 1px;
        width: 1px;
      }

      reel-action-bar-view-model {
        align-items: flex-start;
        display: flex;
        flex-direction: column;
        height: 420px;
        position: absolute;
        right: 12px;
        top: 80px;
        width: 48px;
      }

      .ytwReelActionBarViewModelHostDesktopActionButton,
      reel-action-bar-view-model > button-view-model,
      reel-action-bar-view-model > pivot-button-view-model,
      reel-action-bar-view-model > [data-ryd-synthetic-shorts-dislike] {
        box-sizing: border-box;
        display: block;
        height: 70px;
        margin: 0;
        padding: 0;
        width: 48px;
      }

      .ytSpecButtonShapeWithLabelHost {
        align-items: center;
        display: flex;
        flex-direction: column;
        height: 70px;
        margin: 0;
        padding: 0;
        width: 48px;
      }

      reel-action-bar-view-model button,
      reel-action-bar-view-model a[role="button"][tabindex="0"] {
        align-items: center;
        background: #272727;
        border: 0;
        border-radius: 24px;
        box-sizing: border-box;
        color: #fff;
        display: flex;
        height: 48px;
        justify-content: center;
        margin: 0;
        min-height: 0;
        min-width: 0;
        padding: 12px;
        width: 48px;
      }

      .ytSpecButtonShapeNextIcon,
      .ytSpecButtonShapeNextIcon svg {
        display: block;
        height: 24px;
        width: 24px;
      }

      .ytSpecButtonShapeWithLabelLabel {
        align-items: center;
        display: flex;
        font: 12px/18px Arial, sans-serif;
        height: 22px;
        justify-content: center;
        width: 48px;
      }
    </style>
  </head>
  <body>
    <button id="avatar-btn" type="button" aria-label="Account menu">Account</button>
    <button id="fixture-next-short" type="button" aria-label="Next video">Next</button>
    <ytd-shorts>
      <div id="fixture-shorts-stage"></div>
    </ytd-shorts>
    <script>
      (() => {
        const config = ${fixtureConfig};
        const stage = document.getElementById("fixture-shorts-stage");
        const nextButton = document.getElementById("fixture-next-short");
        const slots = [];
        const timeline = [];
        const prematureSyntheticInsertions = [];
        const phaseObservations = [];
        const seededNormalizationStates = [];
        const freshEpochViolations = [];
        const nativeLikePaintObservations = [];
        let freshEpochGuard = null;
        let currentIndex = 0;
        let transitioning = false;

        if (!customElements.get("like-button-view-model")) {
          customElements.define("like-button-view-model", class extends HTMLElement {});
        }

        function icon(path) {
          return '<span class="ytSpecButtonShapeNextIcon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24"><path fill="currentColor" d="' + path + '"></path></svg></span>';
        }

        function actionMarkup(action, videoId) {
          const counts = config.counts[videoId];
          if (action === "like" || action === "dislike") {
            const isLike = action === "like";
            const tag = isLike ? "like-button-view-model" : "dislike-button-view-model";
            const count = isLike ? counts.likes : counts.dislikes;
            const path = isLike
              ? 'M8 21H5V9h3v12Zm2 0V9l4-7 2 1v5h5v5l-3 8h-8Z'
              : 'M16 3h3v12h-3V3Zm-2 0v12l-4 7-2-1v-5H3v-5l3-8h8Z';
            return '<' + tag + ' class="ytLikeButtonViewModelHost ytwReelActionBarViewModelHostDesktopActionButton style-text" ' +
              'data-fixture-action="' + action + '" data-fixture-role="' + action + '">' +
              '<label class="ytSpecButtonShapeWithLabelHost">' +
              '<button class="ytSpecButtonShapeNextHost" type="button" aria-label="' + count +
              (isLike ? ' likes"' : ' dislikes"') + ' aria-pressed="false">' +
              icon(path) +
              '</button><div class="ytSpecButtonShapeWithLabelLabel"><span id="text" role="text">' +
              count + '</span></div></label></' + tag + '>';
          }

          const labels = { comments: "View comments", pivot: "Use this sound", remix: "Remix", share: "Share" };
          const paths = {
            comments: "M3 4h18v14H8l-5 3Z",
            pivot: "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 5a4 4 0 1 1-4 4 4 4 0 0 1 4-4Z",
            remix: "M4 7h10l-2-2 2-2 6 6-6 6-2-2 2-2H4Z",
            share: "M14 4l7 7-7 7v-4H3V8h11Z",
          };
          const label = labels[action];
          const hostTag = action === "pivot" ? "pivot-button-view-model" : "button-view-model";
          const activationTarget = action === "pivot"
            ? '<a role="button" tabindex="0" aria-label="' + label + '">' + icon(paths[action]) + '</a>'
            : '<button type="button" aria-label="' + label + '">' + icon(paths[action]) + '</button>';
          return '<' + hostTag + ' data-fixture-action="' + action + '">' +
            '<label class="ytSpecButtonShapeWithLabelHost">' + activationTarget +
            '<div class="ytSpecButtonShapeWithLabelLabel"><span role="text">' + label +
            '</span></div></label></' + hostTag + '>';
        }

        function nativeActionsMarkup(videoId, includeNativeDislike = false) {
          return ["like", ...(includeNativeDislike ? ["dislike"] : []), "comments", "share", "remix", "pivot"]
            .map((action) => actionMarkup(action, videoId))
            .join("");
        }

        function syntheticSeedMarkup(videoId, seedIndex) {
          return '<div class="ytLikeButtonViewModelHost ytwReelActionBarViewModelHostDesktopActionButton style-text ' +
            'ryd-synthetic-shorts-dislike" data-fixture-seeded-synthetic="' + seedIndex + '" ' +
            'data-ryd-role="dislike" data-ryd-synthetic-shorts-dislike="true" data-ryd-video-id="' + videoId + '">' +
            '<label class="ytSpecButtonShapeWithLabelHost ryd-synthetic-shorts-dislike-label">' +
            '<button class="ytSpecButtonShapeNextHost" type="button" aria-label="Dislike this video" ' +
            'aria-pressed="false" aria-disabled="true" disabled>' +
            icon('M16 3h3v12h-3V3Zm-2 0v12l-4 7-2-1v-5H3v-5l3-8h8Z') +
            '</button><div class="ytSpecButtonShapeWithLabelLabel"><span id="text" role="text"></span></div>' +
            '</label></div>';
        }

        function rendererMarkup(videoId, logicalIndex, hydrated) {
          return '<div class="reel-video-in-sequence-new" data-fixture-logical-index="' + logicalIndex + '">' +
            '<div class="reel-video-in-sequence-thumbnail"></div>' +
            '<ytd-reel-video-renderer video-id="' + videoId + '" data-fixture-hydrated="' + hydrated + '">' +
            '<div id="experiment-overlay"><span>Ready</span></div>' +
            '<a href="/shorts/' + videoId + '" aria-label="Short ' + videoId + '"></a>' +
            '<reel-action-bar-view-model data-fixture-role="buttons">' + nativeActionsMarkup(videoId) +
            '</reel-action-bar-view-model></ytd-reel-video-renderer></div>';
        }

        function slotRenderer(slot) {
          return slot.querySelector("ytd-reel-video-renderer");
        }

        function positionSlots() {
          for (const slot of slots) {
            const logicalIndex = Number(slot.dataset.fixtureLogicalIndex);
            slot.style.setProperty("--fixture-reel-offset", (logicalIndex - currentIndex) * 760 + "px");
          }
        }

        function resetSlot(slot, logicalIndex) {
          const videoId = config.videoIds[logicalIndex];
          slot.dataset.fixtureLogicalIndex = String(logicalIndex);
          const renderer = slotRenderer(slot);
          renderer.setAttribute("video-id", videoId);
          renderer.setAttribute("data-fixture-hydrated", "false");
          renderer.removeAttribute("data-fixture-corrupted");
          renderer.removeAttribute("is-active");
          renderer.querySelector("a").setAttribute("href", "/shorts/" + videoId);
          renderer.querySelector("a").setAttribute("aria-label", "Short " + videoId);
          slot.querySelector(".reel-video-in-sequence-thumbnail").style.removeProperty("background-image");
          const actionBar = renderer.querySelector("reel-action-bar-view-model");
          actionBar.innerHTML = nativeActionsMarkup(videoId);
          actionBar.data = null;
          actionBar.style.removeProperty("opacity");
          actionBar.setAttribute("data-fixture-painted", "false");
        }

        function recordPrematureSynthetic(renderer, phase) {
          const videoId = renderer.getAttribute("video-id");
          if (prematureSyntheticInsertions.some((entry) => entry.videoId === videoId)) return;
          prematureSyntheticInsertions.push({ phase, routeVideoId: config.videoIds[currentIndex], videoId });
        }

        function rendererVideoIds(renderer) {
          const identities = new Set([renderer.getAttribute("video-id")].filter(Boolean));
          for (const link of renderer.querySelectorAll('a[href*="/shorts/"]')) {
            const pathname = new URL(link.getAttribute("href"), location.origin).pathname;
            const candidate = pathname.startsWith("/shorts/") ? pathname.slice(8).split("/")[0] : null;
            if (candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)) identities.add(candidate);
          }
          return [...identities].sort();
        }

        function viewportRatio(element) {
          const bounds = element.getBoundingClientRect();
          if (bounds.width <= 0 || bounds.height <= 0) return 0;
          const visibleWidth = Math.max(0, Math.min(bounds.right, innerWidth) - Math.max(bounds.left, 0));
          const visibleHeight = Math.max(0, Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, 0));
          return (visibleWidth * visibleHeight) / (bounds.width * bounds.height);
        }

        function rendererReadyForMutation(renderer) {
          const bounds = renderer.getBoundingClientRect();
          return (
            renderer.hasAttribute("is-active") &&
            renderer.getAttribute("data-fixture-hydrated") === "true" &&
            Boolean(renderer.querySelector("reel-action-bar-view-model")?.data) &&
            renderer.querySelector("reel-action-bar-view-model")?.getAttribute("data-fixture-painted") === "true" &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < innerHeight &&
            bounds.left < innerWidth
          );
        }

        function observePhase(phase, renderer) {
          const actionBar = renderer.querySelector("reel-action-bar-view-model");
          const ratio = viewportRatio(renderer);
          phaseObservations.push({
            actionBarDataReady: Boolean(actionBar?.data),
            candidateVideoIds: rendererVideoIds(renderer),
            hydrated: renderer.getAttribute("data-fixture-hydrated") === "true",
            inViewport: ratio > 0,
            meaningfulViewport: ratio >= 0.5,
            phase,
            syntheticCount: renderer.querySelectorAll(config.syntheticSelector).length,
            videoId: renderer.getAttribute("video-id"),
            viewportRatio: ratio,
          });
        }

        function observeNativeLikePaintPhase(phase, renderer) {
          const actionBar = renderer.querySelector("reel-action-bar-view-model");
          const svg = actionBar?.querySelector('like-button-view-model button svg') ?? null;
          const paintedGraphicCount = svg
            ? [...svg.querySelectorAll("path, circle, ellipse, line, polygon, polyline, rect")].filter(
                (graphic) => graphic.tagName.toLowerCase() !== "path" || (graphic.getAttribute("d") || "").trim(),
              ).length
            : 0;
          nativeLikePaintObservations.push({
            actionBarDataReady: Boolean(actionBar?.data),
            nativeLikePaintedGraphicCount: paintedGraphicCount,
            nativeLikeSvgPresent: svg !== null,
            phase,
            syntheticCount: actionBar?.querySelectorAll(config.syntheticSelector).length ?? 0,
            videoId: renderer.getAttribute("video-id"),
          });
        }

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!(node instanceof Element)) continue;
              const synthetic = node.matches(config.syntheticSelector)
                ? node
                : node.querySelector(config.syntheticSelector);
              const renderer = synthetic?.closest("ytd-reel-video-renderer");
              if (renderer && !rendererReadyForMutation(renderer)) {
                recordPrematureSynthetic(renderer, "mutation");
              }
              if (
                renderer &&
                freshEpochGuard?.videoId === renderer.getAttribute("video-id") &&
                performance.now() < freshEpochGuard.earliestAllowedAt
              ) {
                freshEpochViolations.push({
                  insertedAt: performance.now(),
                  returnAt: freshEpochGuard.returnAt,
                  videoId: freshEpochGuard.videoId,
                });
              }
            }
          }
        });
        observer.observe(stage, { childList: true, subtree: true });

        stage.innerHTML = Array.from({ length: config.poolSize }, (_, index) =>
          rendererMarkup(config.videoIds[index], index, index === 0 ? "true" : "false"),
        ).join("");
        slots.push(...stage.querySelectorAll(".reel-video-in-sequence-new"));
        for (const slot of slots) {
          slotRenderer(slot).querySelector("reel-action-bar-view-model").data = null;
        }
        slotRenderer(slots[0]).setAttribute("is-active", "");
        const initialActionBar = slotRenderer(slots[0]).querySelector("reel-action-bar-view-model");
        initialActionBar.data = { hydrated: true, videoId: config.videoIds[0] };
        initialActionBar.setAttribute("data-fixture-painted", "true");
        positionSlots();

        async function navigateNext() {
          if (transitioning || currentIndex >= config.hops) return;
          transitioning = true;
          const previousIndex = currentIndex;
          const nextIndex = previousIndex + 1;
          const nextVideoId = config.videoIds[nextIndex];
          const destinationSlot = slots.find(
            (slot) => Number(slot.dataset.fixtureLogicalIndex) === nextIndex,
          );
          if (!destinationSlot) throw new Error("No pre-rendered or recycled slot for " + nextVideoId);
          const destinationRenderer = slotRenderer(destinationSlot);

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          timeline.push({ phase: "navigate-start", videoId: nextVideoId });
          history.pushState({}, "", "/shorts/" + nextVideoId + "?" + config.marker);
          timeline.push({ phase: "route", videoId: nextVideoId });
          const actionBar = destinationRenderer.querySelector("reel-action-bar-view-model");
          actionBar.data = null;
          actionBar.setAttribute("data-fixture-painted", "false");
          destinationRenderer.setAttribute("data-fixture-hydrated", "false");
          // The renderer attribute can advance before its canonical link. This
          // leaves two plausible IDs and must not authorize a DOM mutation.
          destinationRenderer
            .querySelector('a[href*="/shorts/"]')
            .setAttribute("href", "/shorts/" + config.videoIds[previousIndex] + "?fixtureStale=" + nextIndex);
          timeline.push({ phase: "ambiguous-attribute-link-identity", videoId: nextVideoId });
          for (const slot of slots) slotRenderer(slot).removeAttribute("is-active");
          // YouTube can identify an offscreen pre-rendered reel as active before
          // its compositor/scroll position catches up. Attribute-only selection
          // is not sufficient permission to mutate this managed action tree.
          destinationRenderer.setAttribute("is-active", "");
          timeline.push({ phase: "provisional-active-offscreen", videoId: nextVideoId });
          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
          timeline.push({ phase: "navigate-finish-before-activation", videoId: nextVideoId });

          await new Promise((resolve) => setTimeout(resolve, 140));
          observePhase("route-current-active-offscreen", destinationRenderer);

          // A small part of the incoming reel can intersect the viewport while
          // the old reel is still painted. Mere intersection is not readiness.
          destinationSlot.style.setProperty("--fixture-reel-offset", "640px");
          timeline.push({ phase: "partial-intersection-ambiguous-identity", videoId: nextVideoId });
          await new Promise((resolve) => setTimeout(resolve, 160));
          observePhase("partial-active-ambiguous", destinationRenderer);

          // Attribute-only reconciliation makes the identity unambiguous and
          // the reel fully visible, but actionBar.data remains null. Hold this
          // phase longer than the old 250 ms timer-only stability gate.
          const destinationLink = destinationRenderer.querySelector('a[href*="/shorts/"]');
          destinationLink.setAttribute("href", "/shorts/" + nextVideoId + "?fixtureHydrating=" + nextIndex);
          destinationRenderer
            .querySelector('[data-fixture-action="like"] button')
            ?.setAttribute("aria-label", "Loading likes for " + nextVideoId);
          currentIndex = nextIndex;
          positionSlots();
          timeline.push({ phase: "attribute-only-reconcile-visible-data-null", videoId: nextVideoId });
          await new Promise((resolve) => setTimeout(resolve, 520));
          observePhase("visible-active-data-null-after-timeout", destinationRenderer);

          const hadPrematureSynthetic = prematureSyntheticInsertions.some((entry) => entry.videoId === nextVideoId);
          if (actionBar.querySelector(config.syntheticSelector)) {
            recordPrematureSynthetic(destinationRenderer, "native-reconcile");
          }
          // YouTube owns this subtree and replaces its children after the reel
          // is already visible. Any early synthetic node is discarded here.
          actionBar.innerHTML = nativeActionsMarkup(nextVideoId);
          destinationRenderer.setAttribute("data-fixture-hydrated", "true");
          actionBar.data = { hydrated: true, logicalIndex: nextIndex, videoId: nextVideoId };
          if (nextIndex === config.nativeLikePaintHop) {
            const likeIconContainer = actionBar.querySelector(
              'like-button-view-model button .ytSpecButtonShapeNextIcon',
            );
            const paintedLikeSvg = likeIconContainer?.querySelector("svg") ?? null;
            if (!likeIconContainer || !paintedLikeSvg) throw new Error("The native Like paint fixture is incomplete.");

            paintedLikeSvg.remove();
            timeline.push({ phase: "native-like-button-shell-only", videoId: nextVideoId });
            await new Promise((resolve) => setTimeout(resolve, 400));
            observeNativeLikePaintPhase("native-like-button-shell-only", destinationRenderer);

            const emptyLikeSvg = paintedLikeSvg.cloneNode(false);
            likeIconContainer.appendChild(emptyLikeSvg);
            timeline.push({ phase: "native-like-empty-svg", videoId: nextVideoId });
            await new Promise((resolve) => setTimeout(resolve, 400));
            observeNativeLikePaintPhase("native-like-empty-svg", destinationRenderer);

            emptyLikeSvg.replaceWith(paintedLikeSvg);
            timeline.push({ phase: "native-like-painted-svg", videoId: nextVideoId });
            observeNativeLikePaintPhase("native-like-painted-svg", destinationRenderer);
          }
          if (hadPrematureSynthetic || prematureSyntheticInsertions.some((entry) => entry.videoId === nextVideoId)) {
            destinationRenderer.setAttribute("data-fixture-corrupted", "premature-child-before-hydration");
            // Preserve native descendants and non-zero rectangles while making
            // their parent unpainted, matching the rect-only false green seen in
            // the live placeholder pool.
            actionBar.style.opacity = "0";
            actionBar.setAttribute("data-fixture-painted", "false");
          } else {
            actionBar.style.removeProperty("opacity");
            actionBar.setAttribute("data-fixture-painted", "true");
          }
          timeline.push({ phase: "native-actions-reconciled-stable", videoId: nextVideoId });

          const futureIndex = nextIndex + config.poolSize - 1;
          if (futureIndex < config.videoIds.length) {
            const outgoingSlot = slots.find(
              (slot) => Number(slot.dataset.fixtureLogicalIndex) === previousIndex,
            );
            resetSlot(outgoingSlot, futureIndex);
            positionSlots();
            timeline.push({ phase: "recycled", videoId: config.videoIds[futureIndex] });
          }

          transitioning = false;
          dispatchEvent(new CustomEvent("fixture-shorts-transition-complete", { detail: { videoId: nextVideoId } }));
        }

        function getCurrentFixtureRenderer() {
          return slots.find((slot) => Number(slot.dataset.fixtureLogicalIndex) === currentIndex)
            ?.querySelector("ytd-reel-video-renderer") ?? null;
        }

        function seedSyntheticDuplicates() {
          const renderer = getCurrentFixtureRenderer();
          const actionBar = renderer?.querySelector("reel-action-bar-view-model");
          const videoId = config.videoIds[currentIndex];
          const existingSynthetic = actionBar?.querySelector(config.syntheticSelector);
          if (!renderer || !actionBar?.data || !existingSynthetic) {
            throw new Error("The current stable synthetic Shorts surface is unavailable for duplicate seeding.");
          }
          existingSynthetic.insertAdjacentHTML("afterend", syntheticSeedMarkup(videoId, "duplicate-only"));
          seededNormalizationStates.push({
            nativeDislikes: 0,
            phase: "duplicate-synthetics",
            syntheticCount: actionBar.querySelectorAll(config.syntheticSelector).length,
            videoId,
          });
          timeline.push({ phase: "duplicate-synthetics-seeded", videoId });
        }

        function seedNativeDislikeAndSyntheticDuplicates() {
          const renderer = getCurrentFixtureRenderer();
          const actionBar = renderer?.querySelector("reel-action-bar-view-model");
          const videoId = config.videoIds[currentIndex];
          const existingSynthetic = actionBar?.querySelector(config.syntheticSelector);
          const like = actionBar?.querySelector('[data-fixture-action="like"]');
          if (!renderer || !actionBar?.data || !existingSynthetic || !like) {
            throw new Error("The current stable synthetic Shorts surface is unavailable for cleanup seeding.");
          }
          like.insertAdjacentHTML("afterend", actionMarkup("dislike", videoId));
          existingSynthetic.insertAdjacentHTML(
            "afterend",
            syntheticSeedMarkup(videoId, "native-cleanup-1") + syntheticSeedMarkup(videoId, "native-cleanup-2"),
          );
          seededNormalizationStates.push({
            nativeDislikes: actionBar.querySelectorAll('dislike-button-view-model, #dislike-button').length,
            phase: "native-and-multiple-synthetics",
            syntheticCount: actionBar.querySelectorAll(config.syntheticSelector).length,
            videoId,
          });
          timeline.push({ phase: "native-and-multiple-synthetics-seeded", videoId });
        }

        function removeNativeDislikeForSyntheticRecovery() {
          const renderer = getCurrentFixtureRenderer();
          const actionBar = renderer?.querySelector("reel-action-bar-view-model");
          const videoId = config.videoIds[currentIndex];
          const nativeDislikes = actionBar?.querySelectorAll('dislike-button-view-model, #dislike-button') ?? [];
          if (!renderer || !actionBar?.data || nativeDislikes.length !== 1) {
            throw new Error("The normalized native Shorts dislike surface is unavailable for recovery.");
          }
          nativeDislikes[0].remove();
          actionBar.data = { hydrated: true, recovery: true, videoId };
          timeline.push({ phase: "native-dislike-removed-for-synthetic-recovery", videoId });
        }

        async function eventlessSameVideoReturn() {
          const renderer = getCurrentFixtureRenderer();
          const actionBar = renderer?.querySelector("reel-action-bar-view-model");
          const videoId = config.videoIds[currentIndex];
          if (!renderer || !actionBar?.data || actionBar.querySelectorAll(config.syntheticSelector).length !== 1) {
            throw new Error("The current Shorts surface is unavailable for the eventless return.");
          }

          actionBar.querySelectorAll(config.syntheticSelector).forEach((synthetic) => synthetic.remove());
          renderer
            .querySelector('a[href*="/shorts/"]')
            .setAttribute("href", "/shorts/" + videoId + "?fixturePendingEpoch=1");
          timeline.push({ phase: "eventless-synthetic-removed", videoId });
          await new Promise((resolve) => setTimeout(resolve, 140));
          observePhase("eventless-pending-before-route-away", renderer);

          history.pushState({}, "", "/@fixture-away");
          timeline.push({ phase: "eventless-route-away", videoId });
          // Stay away longer than both runtimes' 500 ms route-key monitor so
          // an eventless transient route cannot be missed between polls.
          await new Promise((resolve) => setTimeout(resolve, config.freshRouteEpochMs + 500));

          const returnAt = performance.now();
          freshEpochGuard = {
            earliestAllowedAt: returnAt + config.freshRouteEpochMs,
            returnAt,
            videoId,
          };
          history.pushState({}, "", "/shorts/" + videoId + "?" + config.marker + "&eventlessReturn=1");
          timeline.push({ phase: "eventless-same-video-return", videoId });
          await new Promise((resolve) => setTimeout(resolve, Math.floor(config.freshRouteEpochMs / 2)));
          observePhase("eventless-same-video-return-fresh-epoch", renderer);
        }

        nextButton.addEventListener("click", () => void navigateNext());
        globalThis.__shortsPlaceholderPoolFixture = {
          eventlessSameVideoReturn,
          removeNativeDislikeForSyntheticRecovery,
          seedNativeDislikeAndSyntheticDuplicates,
          seedSyntheticDuplicates,
          snapshot() {
            const activeRenderers = [...stage.querySelectorAll("ytd-reel-video-renderer[is-active]")];
            return {
              activeVideoIds: activeRenderers.map((renderer) => renderer.getAttribute("video-id")),
              corruptedVideoIds: [...stage.querySelectorAll("[data-fixture-corrupted]")].map((renderer) =>
                renderer.getAttribute("video-id"),
              ),
              currentIndex,
              currentVideoId: config.videoIds[currentIndex],
              freshEpochViolations: [...freshEpochViolations],
              logicalIndexes: slots.map((slot) => Number(slot.dataset.fixtureLogicalIndex)).sort((a, b) => a - b),
              phaseObservations: [...phaseObservations],
              nativeLikePaintObservations: [...nativeLikePaintObservations],
              prematureSyntheticInsertions: [...prematureSyntheticInsertions],
              seededNormalizationStates: [...seededNormalizationStates],
              slotCount: slots.length,
              timeline: [...timeline],
              transitioning,
            };
          },
        };
      })();
    </script>
  </body>
</html>`;
}

async function installShortsPlaceholderPoolRoute(context, { onUnexpectedRequest = () => {} } = {}) {
  if (!context?.route) throw new TypeError("A Playwright browser context is required.");
  await context.route("https://www.youtube.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.resourceType() === "document" &&
      url.pathname === `/shorts/${SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[0]}` &&
      url.searchParams.get("rydShortsPlaceholderPool") === "1"
    ) {
      await route.fulfill({
        body: createShortsPlaceholderPoolFixture(),
        contentType: "text/html; charset=utf-8",
        status: 200,
      });
      return;
    }

    onUnexpectedRequest({ method: request.method(), resourceType: request.resourceType(), url: request.url() });
    await route.abort("blockedbyclient");
  });
}

function shortsPlaceholderPoolUrl() {
  return `https://www.youtube.com/shorts/${SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[0]}?${SHORTS_PLACEHOLDER_POOL_MARKER}`;
}

async function readShortsPlaceholderPoolSurface(page, videoId, logicalIndex) {
  return page.evaluate(
    ({ actionOrder, expectedVideoId, index, syntheticSelector }) => {
      const visibleInViewport = (element) => {
        if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
        let opacity = 1;
        for (let current = element; current; current = current.parentElement) {
          const style = getComputedStyle(current);
          if (style.display === "none" || ["hidden", "collapse"].includes(style.visibility)) {
            return false;
          }
          const currentOpacity = Number.parseFloat(style.opacity || "1");
          if (Number.isFinite(currentOpacity)) opacity *= currentOpacity;
        }
        if (opacity <= 0.01) return false;
        const box = element.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.right > 0 &&
          box.top < innerHeight &&
          box.left < innerWidth
        );
      };
      const box = (element) => {
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
        };
      };
      const topHitAtCenter = (element) => {
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return null;
        const x = Math.min(innerWidth - 1, Math.max(0, bounds.left + bounds.width / 2));
        const y = Math.min(innerHeight - 1, Math.max(0, bounds.top + bounds.height / 2));
        return typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(x, y)
          : document.elementsFromPoint?.(x, y)?.[0] ?? null;
      };
      const hitTestedAtCenter = (element) => {
        const hit = topHitAtCenter(element);
        return hit === element || element.contains(hit);
      };
      const describeElement = (element) =>
        element
          ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList]
              .map((name) => `.${name}`)
              .join("")}`
          : null;
      const fixture = globalThis.__shortsPlaceholderPoolFixture?.snapshot();
      const renderer = document.querySelector(
        `.reel-video-in-sequence-new[data-fixture-logical-index="${index}"] > ytd-reel-video-renderer`,
      );
      const actionBar = renderer?.querySelector("reel-action-bar-view-model") ?? null;
      const actionHosts = [...(actionBar?.children ?? [])];
      const actions = actionHosts.map((host) =>
        host.matches(syntheticSelector) ? "dislike" : host.getAttribute("data-fixture-action"),
      );
      const buttons = actionHosts.map((host) =>
        host.querySelector("button, a[href], a[role='button'][tabindex='0'], tp-yt-paper-button#button"),
      );
      const synthetic = actionBar?.querySelector(syntheticSelector) ?? null;
      const nativeDislikes = actionBar?.querySelectorAll("dislike-button-view-model, #dislike-button") ?? [];
      const dislike = actionHosts.find(
        (host) => host.matches(syntheticSelector) || host.matches("dislike-button-view-model, #dislike-button"),
      );
      const visibleDocumentSynthetic = [...document.querySelectorAll(syntheticSelector)].filter(visibleInViewport);
      const visibleDocumentActionButtons = [
        ...document.querySelectorAll(
          "reel-action-bar-view-model button, reel-action-bar-view-model a[role='button'][tabindex='0']",
        ),
      ].filter(visibleInViewport);
      const renderers = [...document.querySelectorAll("ytd-reel-video-renderer")];
      const staleSyntheticOwners = [...document.querySelectorAll(syntheticSelector)]
        .filter((control) => {
          const owner = control.closest("ytd-reel-video-renderer")?.getAttribute("video-id");
          return control.getAttribute("data-ryd-video-id") !== owner;
        })
        .map((control) => ({
          controlVideoId: control.getAttribute("data-ryd-video-id"),
          rendererVideoId: control.closest("ytd-reel-video-renderer")?.getAttribute("video-id") ?? null,
        }));
      return {
        actionOrder,
        actions,
        actionBarBox: box(actionBar),
        actionBarDataReady: Boolean(actionBar?.data),
        actionBarPainted: actionBar?.getAttribute("data-fixture-painted") ?? null,
        actionBarVisible: visibleInViewport(actionBar),
        activeRenderers: renderers.filter((candidate) => candidate.hasAttribute("is-active")).length,
        buttonBoxes: buttons.map(box),
        buttonEnabled: buttons.map(
          (button) => Boolean(button) && !button.disabled && button.getAttribute("aria-disabled") !== "true",
        ),
        buttonHitTested: buttons.map(hitTestedAtCenter),
        buttonTopHits: buttons.map((button) => describeElement(topHitAtCenter(button))),
        buttonVisible: buttons.map(visibleInViewport),
        dislikeCount: dislike?.querySelector("#text, [role='text']")?.textContent?.trim() ?? null,
        dislikeKind: dislike?.matches(syntheticSelector) ? "synthetic" : dislike ? "native" : null,
        dislikePressed: dislike?.querySelector("button")?.getAttribute("aria-pressed") ?? null,
        fixture,
        hostBoxes: actionHosts.map(box),
        hostVisible: actionHosts.map(visibleInViewport),
        pathname: location.pathname,
        rendererBox: box(renderer),
        rendererHydrated: renderer?.getAttribute("data-fixture-hydrated") ?? null,
        rendererVideoId: renderer?.getAttribute("video-id") ?? null,
        rendererVisible: visibleInViewport(renderer),
        staleSyntheticOwners,
        nativeDislikes: nativeDislikes.length,
        syntheticCount: synthetic?.querySelector("#text, [role='text']")?.textContent?.trim() ?? null,
        syntheticElements: actionBar?.querySelectorAll(syntheticSelector).length ?? 0,
        syntheticOwner: synthetic?.getAttribute("data-ryd-video-id") ?? null,
        syntheticPressed: synthetic?.querySelector("button")?.getAttribute("aria-pressed") ?? null,
        visibleDocumentActionButtons: visibleDocumentActionButtons.length,
        visibleDocumentRenderers: renderers.filter(visibleInViewport).length,
        visibleDocumentSynthetic: visibleDocumentSynthetic.length,
        videoId: expectedVideoId,
      };
    },
    {
      actionOrder: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
      expectedVideoId: videoId,
      index: logicalIndex,
      syntheticSelector: SHORTS_SYNTHETIC_DISLIKE_SELECTOR,
    },
  );
}

function assertShortsPlaceholderPoolTransitionSafety(fixture, { logicalIndex, videoId }) {
  assert.deepEqual(
    fixture?.prematureSyntheticInsertions,
    [],
    `hop ${logicalIndex} inserted Dislike before the managed action bar reached hydration/readiness`,
  );
  assert.deepEqual(
    fixture?.corruptedVideoIds,
    [],
    `hop ${logicalIndex} lost its native action stack after premature placeholder mutation`,
  );
  assert.deepEqual(
    fixture?.freshEpochViolations,
    [],
    `hop ${logicalIndex} reused stale stability evidence after an eventless route round trip`,
  );
  assertNativeLikePaintHydrationSafety(fixture, { logicalIndex, videoId });
  if (logicalIndex === 0) return;
  const observations = fixture?.phaseObservations?.filter(
    (observation) =>
      observation.videoId === videoId && SHORTS_TRANSITION_OBSERVATION_PHASES.includes(observation.phase),
  );
  assert.deepEqual(
    observations?.map((observation) => observation.phase),
    SHORTS_TRANSITION_OBSERVATION_PHASES,
    `hop ${logicalIndex} skipped a placeholder readiness phase`,
  );
  const [offscreen, partial, visibleDataNull] = observations;
  const previousVideoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex - 1];
  assert.deepEqual(offscreen.candidateVideoIds, [previousVideoId, videoId].sort());
  assert.equal(offscreen.actionBarDataReady, false);
  assert.equal(offscreen.hydrated, false);
  assert.equal(offscreen.inViewport, false);
  assert.equal(offscreen.meaningfulViewport, false);
  assert.equal(offscreen.syntheticCount, 0, `hop ${logicalIndex} performed a premature control mutation`);
  assert.deepEqual(partial.candidateVideoIds, [previousVideoId, videoId].sort());
  assert.equal(partial.actionBarDataReady, false);
  assert.equal(partial.hydrated, false);
  assert.equal(partial.inViewport, true);
  assert.equal(partial.meaningfulViewport, false);
  assert.ok(partial.viewportRatio > 0 && partial.viewportRatio < 0.5);
  assert.equal(partial.syntheticCount, 0, `hop ${logicalIndex} performed a premature control mutation`);
  assert.deepEqual(visibleDataNull.candidateVideoIds, [videoId]);
  assert.equal(visibleDataNull.actionBarDataReady, false);
  assert.equal(visibleDataNull.hydrated, false);
  assert.equal(visibleDataNull.inViewport, true);
  assert.equal(visibleDataNull.meaningfulViewport, true);
  assert.ok(visibleDataNull.viewportRatio >= 0.5);
  assert.equal(visibleDataNull.syntheticCount, 0, `hop ${logicalIndex} performed a premature control mutation`);
}

function assertNativeLikePaintHydrationSafety(fixture, { logicalIndex, videoId }) {
  if (logicalIndex !== SHORTS_NATIVE_LIKE_PAINT_HOP) return;

  const observations = fixture?.nativeLikePaintObservations?.filter((observation) => observation.videoId === videoId);
  assert.deepEqual(
    observations,
    [
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
    `hop ${logicalIndex} inserted Dislike before the exact native Like icon painted`,
  );
}

function assertShortsPlaceholderPoolSurface(snapshot, { counts, dislikeKind = "synthetic", logicalIndex, videoId }) {
  assert.equal(snapshot.pathname, `/shorts/${videoId}`, `hop ${logicalIndex} URL targets a stale Short`);
  assert.equal(snapshot.fixture?.transitioning, false, `hop ${logicalIndex} fixture transition did not settle`);
  assert.equal(snapshot.fixture?.currentIndex, logicalIndex, `hop ${logicalIndex} fixture index is stale`);
  assert.equal(snapshot.fixture?.currentVideoId, videoId, `hop ${logicalIndex} fixture video is stale`);
  assert.deepEqual(snapshot.fixture?.activeVideoIds, [videoId], `hop ${logicalIndex} has an ambiguous active renderer`);
  assert.equal(snapshot.fixture?.slotCount, SHORTS_PLACEHOLDER_POOL_SIZE, "the physical placeholder pool changed size");
  assertShortsPlaceholderPoolTransitionSafety(snapshot.fixture, { logicalIndex, videoId });
  assert.equal(snapshot.activeRenderers, 1, `hop ${logicalIndex} must have one active renderer`);
  assert.equal(snapshot.visibleDocumentRenderers, 1, `hop ${logicalIndex} must have one visible renderer`);
  assert.equal(snapshot.rendererVideoId, videoId, `hop ${logicalIndex} selected a stale renderer`);
  assert.equal(snapshot.rendererHydrated, "true", `hop ${logicalIndex} renderer is not hydrated`);
  assert.equal(snapshot.rendererVisible, true, `hop ${logicalIndex} renderer is not visible`);
  assert.equal(snapshot.actionBarDataReady, true, `hop ${logicalIndex} actionBar.data is not hydrated`);
  assert.equal(snapshot.actionBarPainted, "true", `hop ${logicalIndex} action stack never reached its painted state`);
  assert.equal(snapshot.actionBarVisible, true, `hop ${logicalIndex} action stack is not effectively visible`);
  assert.deepEqual(
    snapshot.actions,
    SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
    `hop ${logicalIndex} must retain every native action and exactly one synthetic Dislike`,
  );
  assert.deepEqual(
    snapshot.hostVisible,
    SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
  );
  assert.deepEqual(
    snapshot.buttonVisible,
    SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
  );
  assert.deepEqual(
    snapshot.buttonHitTested,
    SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
    `hop ${logicalIndex} controls have rectangles but are not topmost/hit-testable in the active renderer; top hits: ${JSON.stringify(
      snapshot.buttonTopHits,
    )}`,
  );
  assert.deepEqual(
    snapshot.buttonEnabled,
    SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map(() => true),
  );
  assert.equal(snapshot.visibleDocumentActionButtons, SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.length);
  assert.equal(snapshot.dislikeKind, dislikeKind, `hop ${logicalIndex} rendered the wrong Dislike implementation`);
  assert.equal(snapshot.dislikePressed, "false", `hop ${logicalIndex} Dislike has an invalid initial state`);
  assert.equal(snapshot.dislikeCount, String(counts.dislikes), `hop ${logicalIndex} rendered a stale dislike count`);
  if (dislikeKind === "synthetic") {
    assert.equal(snapshot.visibleDocumentSynthetic, 1, `hop ${logicalIndex} must show exactly one synthetic Dislike`);
    assert.equal(snapshot.syntheticElements, 1, `hop ${logicalIndex} did not normalize duplicate synthetic controls`);
    assert.equal(snapshot.nativeDislikes, 0, `hop ${logicalIndex} unexpectedly retained a native Dislike control`);
    assert.equal(snapshot.syntheticOwner, videoId, `hop ${logicalIndex} Dislike targets a stale video`);
    assert.equal(snapshot.syntheticPressed, "false", `hop ${logicalIndex} synthetic Dislike has an invalid state`);
    assert.equal(
      snapshot.syntheticCount,
      String(counts.dislikes),
      `hop ${logicalIndex} rendered a stale dislike count`,
    );
  } else {
    assert.equal(snapshot.visibleDocumentSynthetic, 0, `hop ${logicalIndex} retained a visible synthetic Dislike`);
    assert.equal(snapshot.syntheticElements, 0, `hop ${logicalIndex} retained duplicate synthetic controls`);
    assert.equal(snapshot.nativeDislikes, 1, `hop ${logicalIndex} did not preserve exactly one native Dislike`);
  }
  assert.deepEqual(snapshot.staleSyntheticOwners, [], "an offscreen or current synthetic control has stale ownership");
  assert.ok(snapshot.rendererBox?.width > 0 && snapshot.rendererBox?.height > 0, "the current renderer collapsed");
  assert.ok(
    snapshot.actionBarBox?.left >= snapshot.rendererBox.left - 1 &&
      snapshot.actionBarBox?.right <= snapshot.rendererBox.right + 1 &&
      snapshot.actionBarBox?.top >= snapshot.rendererBox.top - 1 &&
      snapshot.actionBarBox?.bottom <= snapshot.rendererBox.bottom + 1,
    `hop ${logicalIndex} action stack is outside the active rendered container`,
  );

  for (let index = 0; index < SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.length; index += 1) {
    const host = snapshot.hostBoxes[index];
    const button = snapshot.buttonBoxes[index];
    assert.ok(host?.width >= 47 && host?.height >= 69, `hop ${logicalIndex} ${snapshot.actions[index]} host collapsed`);
    assert.ok(
      button?.width >= 47 && button?.height >= 47,
      `hop ${logicalIndex} ${snapshot.actions[index]} button collapsed`,
    );
    assert.ok(button.left >= host.left - 1 && button.right <= host.right + 1, "an action button escaped its host");
    if (index > 0) {
      const previous = snapshot.hostBoxes[index - 1];
      assert.ok(host.top >= previous.bottom - 1, `hop ${logicalIndex} action controls overlap`);
      assert.ok(host.top <= previous.bottom + 1, `hop ${logicalIndex} action controls have an unexpected gap`);
    }
  }
}

function interactionRequests(records) {
  return records.filter(
    (record) => record.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
  );
}

async function waitForFixtureIndex(page, logicalIndex) {
  await page.waitForFunction((index) => {
    const snapshot = globalThis.__shortsPlaceholderPoolFixture?.snapshot();
    return snapshot?.currentIndex === index && snapshot.transitioning === false;
  }, logicalIndex);
}

async function waitForValidSurface(page, videoId, logicalIndex, { dislikeKind = "synthetic" } = {}) {
  const counts = SHORTS_PLACEHOLDER_POOL_COUNTS[videoId];
  await page.waitForFunction(
    ({ expectedCount, expectedDislikeKind, expectedOrder, expectedVideoId, index, syntheticSelector }) => {
      const renderer = document.querySelector(
        `.reel-video-in-sequence-new[data-fixture-logical-index="${index}"] > ytd-reel-video-renderer[is-active]`,
      );
      const actionBar = renderer?.querySelector("reel-action-bar-view-model");
      const actions = [...(actionBar?.children ?? [])].map((host) =>
        host.matches(syntheticSelector) ? "dislike" : host.getAttribute("data-fixture-action"),
      );
      const synthetic = actionBar?.querySelector(syntheticSelector);
      const nativeDislike = actionBar?.querySelector("dislike-button-view-model, #dislike-button");
      const dislike = expectedDislikeKind === "synthetic" ? synthetic : nativeDislike;
      return (
        location.pathname === `/shorts/${expectedVideoId}` &&
        renderer?.getAttribute("video-id") === expectedVideoId &&
        Boolean(actionBar?.data) &&
        JSON.stringify(actions) === JSON.stringify(expectedOrder) &&
        (expectedDislikeKind === "synthetic"
          ? actionBar?.querySelectorAll(syntheticSelector).length === 1 &&
            !nativeDislike &&
            synthetic?.getAttribute("data-ryd-video-id") === expectedVideoId
          : actionBar?.querySelectorAll(syntheticSelector).length === 0 && Boolean(nativeDislike)) &&
        dislike?.querySelector("#text, [role='text']")?.textContent?.trim() === expectedCount
      );
    },
    {
      expectedCount: String(counts.dislikes),
      expectedDislikeKind: dislikeKind,
      expectedOrder: SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
      expectedVideoId: videoId,
      index: logicalIndex,
      syntheticSelector: SHORTS_SYNTHETIC_DISLIKE_SELECTOR,
    },
  );
}

async function assertSurfaceSoak(
  page,
  videoId,
  logicalIndex,
  { dislikeKind = "synthetic", durationMs = 240, intervalMs = 40 } = {},
) {
  const deadline = Date.now() + durationMs;
  let samples = 0;
  do {
    const snapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
    assertShortsPlaceholderPoolSurface(snapshot, {
      counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
      dislikeKind,
      logicalIndex,
      videoId,
    });
    samples += 1;
    if (Date.now() >= deadline && samples >= 2) break;
    await page.waitForTimeout(intervalMs);
  } while (true);
  return samples;
}

async function assertActionBarPixelOracle(page, videoId, logicalIndex) {
  const actionBar = page.locator(
    `.reel-video-in-sequence-new[data-fixture-logical-index="${logicalIndex}"] > ` +
      `ytd-reel-video-renderer[video-id="${videoId}"] reel-action-bar-view-model`,
  );
  const screenshot = await actionBar.screenshot({ animations: "disabled", scale: "css" });
  // Playwright already ships this decoder; keeping the oracle on its pinned
  // dependency avoids platform-specific golden screenshots and another package.
  const { PNG } = require("playwright-core/lib/utilsBundle");
  const image = PNG.sync.read(screenshot);
  assert.ok(image.width >= 47, `hop ${logicalIndex} pixel oracle captured a collapsed action stack`);
  assert.ok(image.height >= 419, `hop ${logicalIndex} pixel oracle captured a truncated action stack`);

  const brightPixelsByAction = SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.map((action, actionIndex) => {
    const startY = Math.floor((actionIndex * image.height) / SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.length);
    const endY = Math.floor(((actionIndex + 1) * image.height) / SHORTS_PLACEHOLDER_POOL_ACTION_ORDER.length);
    let brightPixels = 0;
    for (let y = startY; y < endY; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const offset = (y * image.width + x) * 4;
        const red = image.data[offset];
        const green = image.data[offset + 1];
        const blue = image.data[offset + 2];
        const alpha = image.data[offset + 3];
        if (alpha >= 200 && red >= 160 && green >= 160 && blue >= 160) brightPixels += 1;
      }
    }
    assert.ok(brightPixels >= 12, `hop ${logicalIndex} ${action} has geometry but no painted high-contrast pixels`);
    return brightPixels;
  });

  return { brightPixelsByAction, height: image.height, logicalIndex, videoId, width: image.width };
}

function assertNativeDislikeCleanupSurface(snapshot, { logicalIndex, videoId }) {
  assert.deepEqual(
    snapshot.fixture?.seededNormalizationStates?.find(
      (state) => state.phase === "native-and-multiple-synthetics" && state.videoId === videoId,
    ),
    {
      nativeDislikes: 1,
      phase: "native-and-multiple-synthetics",
      syntheticCount: 3,
      videoId,
    },
    `hop ${logicalIndex} did not seed the native-plus-duplicate cleanup state`,
  );
  assertShortsPlaceholderPoolSurface(snapshot, {
    counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
    dislikeKind: "native",
    logicalIndex,
    videoId,
  });
}

function assertDuplicateSyntheticNormalization(snapshot, { logicalIndex, videoId }) {
  assert.deepEqual(
    snapshot.fixture?.seededNormalizationStates?.find(
      (state) => state.phase === "duplicate-synthetics" && state.videoId === videoId,
    ),
    {
      nativeDislikes: 0,
      phase: "duplicate-synthetics",
      syntheticCount: 2,
      videoId,
    },
    `hop ${logicalIndex} did not seed the duplicate-only synthetic state`,
  );
  assertShortsPlaceholderPoolSurface(snapshot, {
    counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
    logicalIndex,
    videoId,
  });
}

function assertEventlessSameVideoReturnSafety(fixture, { logicalIndex, videoId }) {
  assert.deepEqual(
    fixture?.freshEpochViolations,
    [],
    `hop ${logicalIndex} reused stale pre-route stability evidence for ${videoId}`,
  );
  const observations = fixture?.phaseObservations?.filter(
    (observation) =>
      observation.videoId === videoId &&
      ["eventless-pending-before-route-away", "eventless-same-video-return-fresh-epoch"].includes(observation.phase),
  );
  assert.deepEqual(
    observations?.map(
      ({ actionBarDataReady, candidateVideoIds, hydrated, meaningfulViewport, phase, syntheticCount }) => ({
        actionBarDataReady,
        candidateVideoIds,
        hydrated,
        meaningfulViewport,
        phase,
        syntheticCount,
      }),
    ),
    [
      {
        actionBarDataReady: true,
        candidateVideoIds: [videoId],
        hydrated: true,
        meaningfulViewport: true,
        phase: "eventless-pending-before-route-away",
        syntheticCount: 0,
      },
      {
        actionBarDataReady: true,
        candidateVideoIds: [videoId],
        hydrated: true,
        meaningfulViewport: true,
        phase: "eventless-same-video-return-fresh-epoch",
        syntheticCount: 0,
      },
    ],
    `hop ${logicalIndex} inserted before a fresh same-video stability epoch elapsed`,
  );
}

async function runShortsPlaceholderPoolContract({ page, readRequests, runtimeName }) {
  if (!page || typeof readRequests !== "function") {
    throw new TypeError("The shared Shorts placeholder-pool contract requires page and readRequests().");
  }
  assert.ok(["extension", "userscript"].includes(runtimeName), `Unsupported runtime ${runtimeName}`);

  const documentIdentity = await page.evaluate(() => {
    const marker = `${Date.now()}-${Math.random()}`;
    globalThis.__shortsPlaceholderPoolDocumentIdentity = marker;
    return marker;
  });
  const results = [];

  for (let logicalIndex = 0; logicalIndex <= SHORTS_PLACEHOLDER_POOL_HOPS; logicalIndex += 1) {
    const videoId = SHORTS_PLACEHOLDER_POOL_VIDEO_IDS[logicalIndex];
    if (logicalIndex > 0) {
      await page.locator("#fixture-next-short").click();
      await waitForFixtureIndex(page, logicalIndex);
    }
    const transitionFixture = await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture?.snapshot());
    assertShortsPlaceholderPoolTransitionSafety(transitionFixture, { logicalIndex, videoId });
    await waitForValidSurface(page, videoId, logicalIndex);
    let snapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
    assertShortsPlaceholderPoolSurface(snapshot, {
      counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
      logicalIndex,
      videoId,
    });
    const pixelOracle = SHORTS_PIXEL_ORACLE_HOPS.has(logicalIndex)
      ? await assertActionBarPixelOracle(page, videoId, logicalIndex)
      : null;
    let soakSamples = await assertSurfaceSoak(page, videoId, logicalIndex);

    if (logicalIndex === SHORTS_DUPLICATE_NORMALIZATION_HOP) {
      await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture.seedSyntheticDuplicates());
      await waitForValidSurface(page, videoId, logicalIndex);
      snapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
      assertDuplicateSyntheticNormalization(snapshot, { logicalIndex, videoId });
    }

    if (logicalIndex === SHORTS_NATIVE_CLEANUP_HOP) {
      await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture.seedNativeDislikeAndSyntheticDuplicates());
      await waitForValidSurface(page, videoId, logicalIndex, { dislikeKind: "native" });
      const nativeSnapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
      assertNativeDislikeCleanupSurface(nativeSnapshot, { logicalIndex, videoId });
      soakSamples += await assertSurfaceSoak(page, videoId, logicalIndex, {
        dislikeKind: "native",
        durationMs: 160,
      });
      await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture.removeNativeDislikeForSyntheticRecovery());
      await waitForValidSurface(page, videoId, logicalIndex);
      snapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
      assertShortsPlaceholderPoolSurface(snapshot, {
        counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
        logicalIndex,
        videoId,
      });
    }

    if (logicalIndex === SHORTS_EVENTLESS_RETURN_HOP) {
      await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture.eventlessSameVideoReturn());
      const eventlessFixture = await page.evaluate(() => globalThis.__shortsPlaceholderPoolFixture.snapshot());
      assertEventlessSameVideoReturnSafety(eventlessFixture, { logicalIndex, videoId });
      await waitForValidSurface(page, videoId, logicalIndex);
      snapshot = await readShortsPlaceholderPoolSurface(page, videoId, logicalIndex);
      assertShortsPlaceholderPoolSurface(snapshot, {
        counts: SHORTS_PLACEHOLDER_POOL_COUNTS[videoId],
        logicalIndex,
        videoId,
      });
    }

    assert.equal(
      await page.evaluate(() => globalThis.__shortsPlaceholderPoolDocumentIdentity),
      documentIdentity,
      `hop ${logicalIndex} replaced the document instead of using SPA navigation`,
    );
    const requests = readRequests();
    assertExactSuccessfulVotesTraffic(
      requests,
      SHORTS_PLACEHOLDER_POOL_VIDEO_IDS.slice(0, logicalIndex + 1),
      `Shorts placeholder-pool hop ${logicalIndex}`,
    );
    assert.deepEqual(
      interactionRequests(requests),
      [],
      `hop ${logicalIndex} submitted a vote without a reaction click`,
    );
    results.push({ logicalIndex, pixelOracle, soakSamples, snapshot, videoId });
  }

  assert.equal(results.length - 1, SHORTS_PLACEHOLDER_POOL_HOPS);
  assert.ok(SHORTS_PLACEHOLDER_POOL_HOPS >= 10, "the placeholder-pool contract must exercise at least ten Next clicks");
  assert.deepEqual(
    results.at(-1).snapshot.fixture.logicalIndexes,
    Array.from({ length: SHORTS_PLACEHOLDER_POOL_SIZE }, (_, index) => index + 1),
    "the final hop did not cross the pre-rendered pool boundary into a recycled physical slot",
  );
  return results;
}

module.exports = {
  SHORTS_DUPLICATE_NORMALIZATION_HOP,
  SHORTS_EVENTLESS_RETURN_HOP,
  SHORTS_FRESH_ROUTE_EPOCH_MS,
  SHORTS_NATIVE_CLEANUP_HOP,
  SHORTS_NATIVE_LIKE_PAINT_HOP,
  SHORTS_PLACEHOLDER_POOL_ACTION_ORDER,
  SHORTS_PLACEHOLDER_POOL_COUNTS,
  SHORTS_PLACEHOLDER_POOL_HOPS,
  SHORTS_PLACEHOLDER_POOL_MARKER,
  SHORTS_PLACEHOLDER_POOL_SIZE,
  SHORTS_PLACEHOLDER_POOL_VIDEO_IDS,
  assertActionBarPixelOracle,
  assertDuplicateSyntheticNormalization,
  assertEventlessSameVideoReturnSafety,
  assertNativeLikePaintHydrationSafety,
  assertNativeDislikeCleanupSurface,
  assertShortsPlaceholderPoolSurface,
  assertShortsPlaceholderPoolTransitionSafety,
  createShortsPlaceholderPoolFixture,
  installShortsPlaceholderPoolRoute,
  readShortsPlaceholderPoolSurface,
  runShortsPlaceholderPoolContract,
  shortsPlaceholderPoolUrl,
};
