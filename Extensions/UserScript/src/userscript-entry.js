import { createVoteClient } from "../../common/vote-client";
import { resolveDelegatedVoteActivation } from "../../common/delegated-vote-activation";
import { getThemeColor, isYouTubeDarkTheme, observeYouTubeTheme } from "../../common/color-themes";
import {
  actionBarHasHydratedData,
  captureShortsNativeControlInventory,
  getShortsControlSurfaceStabilityMs,
  getShortsIdentityLinkVideoIds,
  isShortsControlSurfaceReadyForMutation as sharedShortsSurfaceIsReady,
  shortsNativeControlInventoryIsReadyForFallback as sharedShortsNativeInventoryIsReadyForFallback,
  shortsNativeControlInventoryMatches,
} from "../../common/shorts-control-readiness";
import {
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  LIKE_ACTION,
  DISLIKE_ACTION,
  resolveVoteTransition,
  applyVoteTransitionCounts,
  shouldSubmitVote,
} from "../../common/vote-transition";
import { createGmCredentialStore } from "./gm-credential-store";
import { createGmSyntheticDislikeStore } from "./gm-synthetic-dislike-store";
import USER_SCRIPT_VERSION from "../userscript-version.json";

if (__RYD_LIVE_TEST_BUILD__) {
  document.documentElement.setAttribute("data-ryd-userscript-version", USER_SCRIPT_VERSION);
  document.documentElement.setAttribute("data-ryd-userscript-build", __RYD_LIVE_BUILD_ID__);
}

const API_BASE_URL = "https://returnyoutubedislikeapi.com";
const fetchImpl = globalThis.fetch.bind(globalThis);
const voteClient = createVoteClient({
  apiBaseUrl: API_BASE_URL,
  fetchImpl,
  credentialStore: createGmCredentialStore(),
  cryptoImpl: globalThis.crypto,
});
const syntheticDislikeStore = createGmSyntheticDislikeStore();

const extConfig = {
  // BEGIN USER OPTIONS
  // You may change the following variables to allowed values listed in the corresponding brackets (* means default). Keep the style and keywords intact.
  showUpdatePopup: false, // [true, false*] Show a popup tab after extension update (See what's new)
  disableVoteSubmission: false, // [true, false*] Disable like/dislike submission (Stops counting your likes and dislikes)
  disableLogging: true, // [true*, false] Disable Logging API Response in JavaScript Console.
  coloredThumbs: false, // [true, false*] Colorize thumbs (Use custom colors for thumb icons)
  coloredBar: false, // [true, false*] Colorize ratio bar (Use custom colors for ratio bar)
  colorTheme: "classic", // [classic*, accessible, neon, hibiscus, custom] Color theme (red/green, blue/yellow, pink/cyan, green/magenta, custom)
  customColors: {
    light: { like: "#007600", dislike: "#b300b3" },
    dark: { like: "#00d000", dislike: "#ff77ff" },
  }, // Custom like/dislike colors for YouTube's light and dark themes (#rrggbb)
  numberDisplayFormat: "compactShort", // [compactShort*, compactLong, standard] Number format (For non-English locale users, you may be able to improve appearance with a different option. Please file a feature request if your locale is not covered)
  numberDisplayRoundDown: true, // [true*, false] Round down numbers (Show rounded down numbers)
  tooltipPercentageMode: "none", // [none*, dash_like, dash_dislike, both, only_like, only_dislike] Mode of showing percentage in like/dislike bar tooltip.
  numberDisplayReformatLikes: false, // [true, false*] Re-format like numbers (Make likes and dislikes format consistent)
  rateBarEnabled: true, // [true*, false] Enables ratio bar under like/dislike buttons
  // END USER OPTIONS
};

let previousState = NEUTRAL_STATE;
let likesvalue = 0;
let dislikesvalue = 0;

let isMobile = location.hostname == "m.youtube.com";

function getShortVideoIdFromPathname(pathname) {
  return pathname.match(/^\/shorts\/([^/]+)\/?$/)?.[1] ?? null;
}

let isShorts = () => getShortVideoIdFromPathname(location.pathname) !== null;
let mobileDislikes = 0;
let suppressNextLikeActivation = false;
const boundDislikeButtons = new WeakSet();
const boundActivationVideoIds = new WeakMap();
const suppressedStaleRefreshTargets = new WeakSet();
const removingSyntheticShortsDislikes = new WeakSet();
const pendingWatchControlResets = new Map();
let pendingWatchNavigationBoundary = null;
const hydratingShortsActivationTargets = new WeakMap();
const shortsHydrationTails = new Map();
let shortsLifecycleObserver = null;
let shortsLifecycleObserverTarget = null;
let initializationGeneration = 0;
let initializationTimer = null;
let pendingShortsMutationSurface = null;
let activeCountRequest = null;
let countStateVideoId = null;
let countStateLoaded = false;
let countStateEpoch = 0;
let shortsSubmittedStateVideoId = null;
let shortsSubmittedState = NEUTRAL_STATE;
let watchRateBarObserver = null;
let watchRateBarObserverTarget = null;
let watchRateBarObserverVideoId = null;
let watchRateBarRepairTimer = null;
const SYNTHETIC_SHORTS_DISLIKE_SELECTOR = "[data-ryd-synthetic-shorts-dislike]";
const SHORTS_DISLIKE_ICON_PATH =
  "m8.482 1.5.294.005a9.01 9.01 0 013.918 1.04l.257.143.203.116c.17.097.357.16.55.185l.194.012h1.477l.115.006c.53.054.95.475 1.004 1.005l.006.114v4.499c0 .621-.504 1.125-1.125 1.125h-1.343a.75.75 0 00-.66.395l-.048.107-2.24 6.402a.75.75 0 01-.832.491l-.78-.13a3 3 0 01-2.439-3.587L7.5 11.25H4.454a2.749 2.749 0 01-2.683-2.151 2.762 2.762 0 01.479-2.237l-.016-.065A2.862 2.862 0 013 4.125v-.032c0-.227.037-.453.108-.668l.08-.211A2.816 2.816 0 015.78 1.5h2.703ZM5.78 3c-.566 0-1.069.362-1.248.9a.613.613 0 00-.031.193v.654l-.44.44c-.333.332-.47.813-.364 1.271l.015.065.157.675-.413.557a1.248 1.248 0 00.999 1.995H7.5a1.501 1.501 0 011.467 1.815L8.5 13.742a1.5 1.5 0 001.22 1.794l.157.027 2.031-5.806a2.25 2.25 0 012.124-1.507H15V4.501h-1.102a3.001 3.001 0 01-1.489-.396l-.202-.116A7.504 7.504 0 008.482 3H5.78Z";
function cLog(text, subtext = "") {
  if (!extConfig.disableLogging) {
    subtext = subtext.trim() === "" ? "" : `(${subtext})`;
    console.log(`[Return YouTube Dislikes] ${text} ${subtext}`);
  }
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
    // When short (channel) is ignored, the element (like/dislike AND short itself) is
    // hidden with a 0 DOMRect. In this case, consider it outside of Viewport
    !(rect.top == 0 && rect.left == 0 && rect.bottom == 0 && rect.right == 0) &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= height &&
    rect.right <= width
  );
}

function intersectsViewport(element) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
    rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width
  );
}

function hasMeaningfulViewportPresence(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  const visibleWidth = Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
  return (visibleWidth * visibleHeight) / (rect.width * rect.height) >= 0.5;
}

function hasRenderedBox(element) {
  if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) {
    return false;
  }
  for (let current = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number.parseFloat(style.opacity) === 0
    ) {
      return false;
    }
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getRendererShortVideoIds(renderer) {
  const identities = new Set();
  if (!renderer) {
    return identities;
  }
  const attributeVideoId = renderer.getAttribute("video-id");
  if (attributeVideoId) {
    identities.add(attributeVideoId);
  }
  for (const linkVideoId of getShortsIdentityLinkVideoIds(renderer, location.href)) {
    identities.add(linkVideoId);
  }
  return identities;
}

function rendererMatchesShort(renderer, videoId) {
  const videoIds = getRendererShortVideoIds(renderer);
  return Boolean(videoId) && videoIds.size === 1 && videoIds.has(videoId);
}

function getControlOwnershipVideoIds(container) {
  const identities = new Set();
  if (!container) {
    return identities;
  }
  const ownedElements = [container, ...container.querySelectorAll("[data-ryd-video-id]")];
  for (const element of ownedElements) {
    const ownedVideoId = element.getAttribute?.("data-ryd-video-id");
    if (ownedVideoId) {
      identities.add(ownedVideoId);
    }
  }
  for (const target of container.querySelectorAll("button, tp-yt-paper-button#button")) {
    const boundVideoId = boundActivationVideoIds.get(target);
    if (boundVideoId) {
      identities.add(boundVideoId);
    }
  }
  return identities;
}

function hasConflictingControlOwnership(container, videoId) {
  return Array.from(getControlOwnershipVideoIds(container)).some((ownedVideoId) => ownedVideoId !== videoId);
}

function clearPendingWatchControlObservers() {
  for (const resetState of pendingWatchControlResets.values()) {
    resetState.observer.disconnect();
  }
  pendingWatchControlResets.clear();
}

function clearPendingWatchNavigationBoundary() {
  pendingWatchNavigationBoundary?.observer?.disconnect();
  pendingWatchNavigationBoundary = null;
}

function activationTargetHasVideoIdentity(target, videoId, buttons) {
  let current = target;
  while (current) {
    if (current.getAttribute?.("video-id") === videoId || current.getAttribute?.("data-video-id") === videoId) {
      return true;
    }
    if (current === buttons) {
      break;
    }
    current = current.parentElement;
  }
  return false;
}

function watchTargetIsReady(targetState, buttons, videoId) {
  return (
    !buttons.contains(targetState.activationTarget) ||
    activationTargetHasVideoIdentity(targetState.activationTarget, videoId, buttons) ||
    targetState.refreshed
  );
}

function originalWatchTargetsAreReady(resetState, buttons, videoId) {
  return [resetState.like, resetState.dislike].every((targetState) =>
    watchTargetIsReady(targetState, buttons, videoId),
  );
}

function currentWatchTargetIsReady(target, targetState, buttons, videoId) {
  const boundVideoId = boundActivationVideoIds.get(target);
  return (
    !boundVideoId ||
    boundVideoId === videoId ||
    activationTargetHasVideoIdentity(target, videoId, buttons) ||
    (target === targetState.activationTarget && targetState.refreshed)
  );
}

function elementIsOwnedDisplayMutation(element, targetState) {
  if (!element || !targetState.host.contains(element)) {
    return false;
  }
  return Boolean(
    element.closest(
      "#text, [role='text'], yt-formatted-string, #return-youtube-dislike-bar-container, #return-youtube-dislike-bar, .ryd-tooltip, [data-ryd-synthetic-shorts-dislike]",
    ),
  );
}

function mutationIsMeaningfulWatchRefresh(mutation, targetState, videoId, buttons) {
  if (suppressedStaleRefreshTargets.has(targetState.activationTarget)) {
    return false;
  }
  const mutationElement =
    mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
  if (!mutationElement || !targetState.host.contains(mutationElement)) {
    return false;
  }

  if (mutation.type === "attributes") {
    if (["data-video-id", "video-id"].includes(mutation.attributeName)) {
      return activationTargetHasVideoIdentity(targetState.activationTarget, videoId, buttons);
    }
    return (
      ["aria-disabled", "aria-label", "disabled", "title"].includes(mutation.attributeName) &&
      (mutationElement === targetState.activationTarget || mutationElement === targetState.host)
    );
  }

  if (mutation.type !== "childList" || elementIsOwnedDisplayMutation(mutationElement, targetState)) {
    return false;
  }
  const changedElements = [...mutation.addedNodes, ...mutation.removedNodes]
    .map((node) => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement))
    .filter(Boolean);
  return changedElements.some((element) => !elementIsOwnedDisplayMutation(element, targetState));
}

function captureMeaningfulWatchRefreshes(resetState, mutations, videoId, buttons) {
  for (const targetState of [resetState.like, resetState.dislike]) {
    if (
      !targetState.refreshed &&
      mutations.some((mutation) => mutationIsMeaningfulWatchRefresh(mutation, targetState, videoId, buttons))
    ) {
      targetState.refreshed = true;
    }
  }
}

function captureWatchNavigationBoundaryRefreshes(boundary, mutations) {
  for (const targetState of [boundary.like, boundary.dislike]) {
    if (
      !targetState.refreshed &&
      mutations.some((mutation) => mutationIsMeaningfulWatchRefresh(mutation, targetState, "", boundary.buttons))
    ) {
      targetState.refreshed = true;
    }
  }
}

function seedWatchTargetFromNavigationBoundary(targetState, boundaryTargetState, buttons, videoId) {
  if (targetState.activationTarget === boundaryTargetState.activationTarget) {
    targetState.refreshed ||= boundaryTargetState.refreshed;
    return;
  }

  const boundVideoId = boundActivationVideoIds.get(targetState.activationTarget);
  targetState.refreshed ||=
    !boundVideoId ||
    boundVideoId === videoId ||
    activationTargetHasVideoIdentity(targetState.activationTarget, videoId, buttons);
}

function seedWatchResetFromNavigationBoundary(resetState, buttons, videoId) {
  const boundary = pendingWatchNavigationBoundary;
  if (!boundary || boundary.sourceVideoId === videoId) {
    return;
  }

  captureWatchNavigationBoundaryRefreshes(boundary, boundary.observer.takeRecords());
  clearPendingWatchNavigationBoundary();
  if (boundary.buttons !== buttons) {
    return;
  }

  seedWatchTargetFromNavigationBoundary(resetState.like, boundary.like, buttons, videoId);
  seedWatchTargetFromNavigationBoundary(resetState.dislike, boundary.dislike, buttons, videoId);
}

function suppressStaleTargetRefresh(target) {
  suppressedStaleRefreshTargets.add(target);
  setTimeout(() => suppressedStaleRefreshTargets.delete(target), 0);
}

function watchControlsAreReadyForVideo(buttons, likeButton, dislikeButton, videoId) {
  if (!hasConflictingControlOwnership(buttons, videoId)) {
    clearPendingWatchControlObservers();
    if (pendingWatchNavigationBoundary?.sourceVideoId !== videoId) {
      clearPendingWatchNavigationBoundary();
    }
    return true;
  }

  // YouTube occasionally completes a watch-to-watch navigation while reusing
  // the exact same reaction-control nodes and without mutating anything inside
  // them. In that state the old per-node ownership is the only conflicting
  // signal, so waiting for a control mutation can never finish. A completed
  // navigation plus a matching current watch root is the route-level ownership
  // proof for this otherwise indistinguishable case.
  const watchRoot = buttons.closest("ytd-watch-flexy, ytd-watch-grid");
  if (
    pendingWatchNavigationBoundary?.completedVideoId === videoId &&
    pendingWatchNavigationBoundary.sourceVideoId !== videoId &&
    pendingWatchNavigationBoundary.buttons === buttons &&
    watchRoot?.getAttribute("video-id") === videoId &&
    getButtons() === buttons &&
    hasRenderedBox(buttons)
  ) {
    clearPendingWatchControlObservers();
    clearPendingWatchNavigationBoundary();
    return true;
  }

  const existingReset = pendingWatchControlResets.get(buttons);
  if (existingReset?.videoId === videoId) {
    seedWatchResetFromNavigationBoundary(existingReset, buttons, videoId);
    if (!originalWatchTargetsAreReady(existingReset, buttons, videoId)) {
      return false;
    }

    const currentLikeButton = getLikeButton();
    const currentDislikeButton = getDislikeButton();
    if (!currentLikeButton || !currentDislikeButton || getButtons() !== buttons) {
      return false;
    }
    const currentLikeTarget = getActivationTarget(currentLikeButton);
    const currentDislikeTarget = getActivationTarget(currentDislikeButton);
    if (
      !currentWatchTargetIsReady(currentLikeTarget, existingReset.like, buttons, videoId) ||
      !currentWatchTargetIsReady(currentDislikeTarget, existingReset.dislike, buttons, videoId)
    ) {
      return false;
    }

    existingReset.observer.disconnect();
    pendingWatchControlResets.delete(buttons);
    return true;
  }

  existingReset?.observer.disconnect();
  const likeActivationTarget = getActivationTarget(likeButton);
  const dislikeActivationTarget = getActivationTarget(dislikeButton);
  const resetState = {
    dislike: {
      activationTarget: dislikeActivationTarget,
      host: dislikeButton,
      refreshed: false,
    },
    like: {
      activationTarget: likeActivationTarget,
      host: likeButton,
      refreshed: false,
    },
    observer: null,
    videoId,
  };
  seedWatchResetFromNavigationBoundary(resetState, buttons, videoId);
  if (
    originalWatchTargetsAreReady(resetState, buttons, videoId) &&
    currentWatchTargetIsReady(likeActivationTarget, resetState.like, buttons, videoId) &&
    currentWatchTargetIsReady(dislikeActivationTarget, resetState.dislike, buttons, videoId)
  ) {
    pendingWatchControlResets.delete(buttons);
    return true;
  }
  const observer = new MutationObserver((mutations) => {
    captureMeaningfulWatchRefreshes(resetState, mutations, videoId, buttons);
    if (originalWatchTargetsAreReady(resetState, buttons, videoId)) {
      observer.disconnect();
      setEventListeners();
    }
  });
  resetState.observer = observer;
  pendingWatchControlResets.set(buttons, resetState);
  observer.observe(buttons, {
    attributeFilter: ["aria-disabled", "aria-label", "data-video-id", "disabled", "title", "video-id"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  return false;
}

function getActiveDesktopShortsActionBar() {
  const videoId = getVideoId();
  const candidates = Array.from(document.querySelectorAll("ytd-reel-video-renderer"))
    .filter((renderer) => intersectsViewport(renderer))
    .map((renderer) => ({
      actionBar: renderer.querySelector("reel-action-bar-view-model"),
      renderer,
    }))
    .filter(({ actionBar }) => actionBar);

  const matchingCandidates = candidates.filter(({ renderer }) => rendererMatchesShort(renderer, videoId));
  if (matchingCandidates.length === 1) {
    return matchingCandidates[0].actionBar;
  }

  // During channel/watch -> Shorts SPA transitions, YouTube can render the active
  // reel before its video-id/link metadata is hydrated. A single visible reel is
  // still unambiguous; waiting for metadata in this state leaves the controls
  // permanently uninitialized on some page variants.
  if (
    candidates.length === 1 &&
    getRendererShortVideoIds(candidates[0].renderer).size === 0 &&
    !hasConflictingControlOwnership(candidates[0].actionBar, videoId)
  ) {
    return candidates[0].actionBar;
  }

  const fullyVisibleCandidates = candidates.filter(
    ({ actionBar, renderer }) =>
      isInViewport(renderer) &&
      getRendererShortVideoIds(renderer).size === 0 &&
      !hasConflictingControlOwnership(actionBar, videoId),
  );
  return fullyVisibleCandidates.length === 1 ? fullyVisibleCandidates[0].actionBar : null;
}

function getShortsControlSurfaceSignature(buttons) {
  return (
    Array.from(getRendererShortVideoIds(buttons?.closest("ytd-reel-video-renderer")))
      .sort()
      .join("|") || "identityless"
  );
}

function getVisibleDesktopShortsControlSurfaceCount() {
  return Array.from(document.querySelectorAll("reel-action-bar-view-model")).filter(
    (candidate) => hasRenderedBox(candidate) && hasMeaningfulViewportPresence(candidate),
  ).length;
}

function shortsControlSurfaceIsReadyForMutation(
  buttons,
  currentVideoId,
  { allowUnhydratedFallback = false, isHydrated = false, isStable = false } = {},
) {
  return sharedShortsSurfaceIsReady({
    allowUnhydratedFallback,
    candidateVideoIds: getRendererShortVideoIds(buttons?.closest("ytd-reel-video-renderer")),
    currentVideoId,
    isConnected: buttons?.isConnected,
    isHydrated,
    isRendered: hasRenderedBox(buttons),
    isStable,
    isViewportIntersecting: hasMeaningfulViewportPresence(buttons),
    visibleCandidateCount: getVisibleDesktopShortsControlSurfaceCount(),
  });
}

function shortsNativeControlInventoryIsReadyForFallback(inventory) {
  return sharedShortsNativeInventoryIsReadyForFallback(inventory, {
    getTopmostElement:
      typeof document.elementFromPoint === "function" ? (x, y) => document.elementFromPoint(x, y) : null,
    isMeaningfullyInViewport: hasMeaningfulViewportPresence,
    isRendered: hasRenderedBox,
  });
}

function getActiveMobileShortsButtons() {
  const videoId = getVideoId();
  const candidates = Array.from(document.querySelectorAll("ytm-like-button-renderer"))
    .filter((buttons) => isInViewport(buttons))
    .map((buttons) => ({ buttons, ...getMobileShortOwnership(buttons) }));

  const matchingCandidates = candidates.filter(({ identities }) => identities.has(videoId));
  if (matchingCandidates.length === 1) {
    return matchingCandidates[0].buttons;
  }

  if (
    candidates.length === 1 &&
    candidates[0].identities.size === 0 &&
    !hasConflictingControlOwnership(candidates[0].buttons, videoId)
  ) {
    return candidates[0].buttons;
  }
  return null;
}

function getExactShortLinkVideoIds(element) {
  return getShortsIdentityLinkVideoIds(element, location.href);
}

function getMobileShortOwnership(buttons) {
  const ancestors = [];
  let current = buttons;
  while (current && current !== document.body) {
    if (current.matches("ytm-shorts, ytm-shorts-container, #shorts-container, #shorts-inner-container")) {
      break;
    }
    ancestors.push(current);
    current = current.parentElement;
  }

  for (const ancestor of ancestors) {
    const attributeVideoId = ancestor.getAttribute("video-id") || ancestor.getAttribute("data-video-id");
    if (attributeVideoId) {
      return { identities: new Set([attributeVideoId]), owner: ancestor };
    }
  }

  for (const ancestor of ancestors) {
    const identities = getExactShortLinkVideoIds(ancestor);
    if (identities.size > 0) {
      return { identities, owner: ancestor };
    }
  }

  const owner =
    ancestors.find((ancestor) => ancestor.matches("ytm-reel-video-renderer, ytm-shorts-video-renderer")) ??
    ancestors.find((ancestor) => ancestor.matches("ytm-reel-player-overlay-renderer")) ??
    buttons;
  return { identities: new Set(), owner };
}

function getDesktopWatchButtonCandidates() {
  return Array.from(
    new Set(
      document.querySelectorAll(
        "#menu-container #top-level-buttons-computed, ytd-menu-renderer.ytd-watch-metadata > div, ytd-menu-renderer.ytd-video-primary-info-renderer > div",
      ),
    ),
  ).filter((candidate) =>
    candidate.querySelector(
      "segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer, like-button-view-model, #segmented-like-button",
    ),
  );
}

function selectCurrentWatchButtons(candidates) {
  const videoId = getVideoId();
  return (
    candidates
      .map((candidate, index) => {
        const watchRoot = candidate.closest("ytd-watch-flexy, ytd-watch-grid");
        const rootVideoId = watchRoot?.getAttribute("video-id");
        const rootMatches = Boolean(videoId && rootVideoId === videoId);
        const rendered = hasRenderedBox(candidate);
        const inViewport = rendered && intersectsViewport(candidate);
        const conflicts = Boolean(videoId && hasConflictingControlOwnership(candidate, videoId));
        // YouTube can retain several button groups under the same current
        // ytd-watch-flexy while an SPA navigation settles. A matching root is
        // therefore useful ownership evidence, but it must never make a
        // hidden stale group outrank the rendered controls the user can see.
        const tier =
          rootMatches && inViewport && !conflicts
            ? 10
            : rootMatches && inViewport
              ? 9
              : inViewport && !conflicts
                ? 8
                : inViewport
                  ? 7
                  : rootMatches && rendered && !conflicts
                    ? 6
                    : rootMatches && rendered
                      ? 5
                      : rendered && !conflicts
                        ? 4
                        : rendered
                          ? 3
                          : rootMatches && !conflicts
                            ? 2
                            : !conflicts
                              ? 1
                              : 0;
        return { candidate, index, tier };
      })
      .sort((left, right) => right.tier - left.tier || left.index - right.index)[0]?.candidate ?? null
  );
}

function getButtons() {
  if (isShorts()) {
    if (!isMobile) {
      const actionBar = getActiveDesktopShortsActionBar();
      if (actionBar) {
        return actionBar;
      }
    } else {
      const buttons = getActiveMobileShortsButtons();
      if (buttons) {
        return buttons;
      }
    }

    // Never bind watch/channel controls that are still connected while a Shorts
    // SPA route is mounting. The initialization retry loop will pick up the real
    // reel controls as soon as they are available.
    return null;
  }
  if (isMobile) {
    return (
      document.querySelector(".slim-video-action-bar-actions .segmented-buttons") ??
      document.querySelector(".slim-video-action-bar-actions")
    );
  }
  return selectCurrentWatchButtons(getDesktopWatchButtonCandidates());
}

function removeSyntheticShortsDislike(syntheticDislike) {
  if (!syntheticDislike || removingSyntheticShortsDislikes.has(syntheticDislike)) {
    return;
  }
  removingSyntheticShortsDislikes.add(syntheticDislike);
  try {
    syntheticDislike.remove();
  } finally {
    removingSyntheticShortsDislikes.delete(syntheticDislike);
  }
}

function ensureSyntheticShortsDislikeButton(
  buttons,
  { allowUnhydratedFallback = false, currentVideoId = getVideoId(), isHydrated = false, isStable = false } = {},
) {
  if (!isShorts() || isMobile || !buttons) {
    return;
  }

  const syntheticDislikes = Array.from(buttons.querySelectorAll(SYNTHETIC_SHORTS_DISLIKE_SELECTOR));
  const syntheticDislike = syntheticDislikes[0];
  const nativeDislike = buttons.querySelector("dislike-button-view-model, #dislike-button");
  const readyForMutation = shortsControlSurfaceIsReadyForMutation(buttons, currentVideoId, {
    allowUnhydratedFallback,
    isHydrated: isHydrated && actionBarHasHydratedData(buttons),
    isStable,
  });
  if (nativeDislike) {
    if (readyForMutation) syntheticDislikes.forEach(removeSyntheticShortsDislike);
    return;
  }
  if (!readyForMutation) {
    return;
  }
  if (syntheticDislike) {
    syntheticDislikes.slice(1).forEach(removeSyntheticShortsDislike);
    const videoId = currentVideoId;
    if (videoId && syntheticDislike.getAttribute("data-ryd-video-id") !== videoId) {
      syntheticDislike.setAttribute("data-ryd-video-id", videoId);
      setSyntheticShortsPressed(false, syntheticDislike);
      const button = syntheticDislike.querySelector("button");
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      }
      const count = syntheticDislike.querySelector("#text, [role='text']");
      if (count) {
        count.textContent = "";
      }
    }
    return;
  }

  const likeButton = buttons.querySelector("like-button-view-model");
  const nativeLikeButton = likeButton?.querySelector("button");
  if (!likeButton || !nativeLikeButton) {
    return;
  }

  const ownedDislike = document.createElement("div");
  ownedDislike.className = likeButton.getAttribute("class") || "";
  ownedDislike.setAttribute("data-ryd-synthetic-shorts-dislike", "true");
  ownedDislike.setAttribute("data-ryd-role", "dislike");
  ownedDislike.setAttribute("data-ryd-video-id", getVideoId());
  ownedDislike.classList.add("ryd-synthetic-shorts-dislike");

  const button = document.createElement("button");
  button.type = "button";
  button.className = nativeLikeButton.className;
  button.setAttribute("aria-label", "Dislike this video");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-disabled", "true");
  button.disabled = true;

  const icon = document.createElement("div");
  icon.className =
    nativeLikeButton.querySelector(".ytSpecButtonShapeNextIcon")?.getAttribute("class") || "ytSpecButtonShapeNextIcon";
  icon.setAttribute("aria-hidden", "true");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("width", "24");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", SHORTS_DISLIKE_ICON_PATH);
  svg.appendChild(path);
  icon.appendChild(svg);

  const countContainer = document.createElement("div");
  countContainer.className =
    likeButton.querySelector(".ytSpecButtonShapeWithLabelLabel")?.className || "ytSpecButtonShapeWithLabelLabel";
  const count = document.createElement("span");
  count.id = "text";
  count.className =
    likeButton.querySelector('span[role="text"]')?.className ||
    "ytAttributedStringHost ytAttributedStringTextAlignmentCenter";
  count.setAttribute("role", "text");
  countContainer.appendChild(count);
  button.appendChild(icon);
  const buttonAndCount = document.createElement("label");
  buttonAndCount.className = nativeLikeButton.closest("label")?.className || "ytSpecButtonShapeWithLabelHost";
  buttonAndCount.classList.add("ryd-synthetic-shorts-dislike-label");
  buttonAndCount.append(button, countContainer);
  ownedDislike.appendChild(buttonAndCount);
  setSyntheticShortsPressed(false, ownedDislike);
  likeButton.insertAdjacentElement("afterend", ownedDislike);
}

function getDislikeButton(buttons = getButtons()) {
  if (buttons?.tagName === "REEL-ACTION-BAR-VIEW-MODEL") {
    return (
      buttons.querySelector("dislike-button-view-model, #dislike-button") ??
      buttons.querySelector(SYNTHETIC_SHORTS_DISLIKE_SELECTOR)
    );
  }
  const firstButton = buttons?.children?.[0];
  if (!firstButton) {
    return null;
  }

  if (firstButton.tagName === "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER") {
    if (firstButton.children[1] === undefined) {
      return buttons.querySelector("#segmented-dislike-button");
    } else {
      return firstButton.children[1];
    }
  } else {
    if (buttons.querySelector("segmented-like-dislike-button-view-model")) {
      const dislikeViewModel = buttons.querySelector("dislike-button-view-model");
      if (!dislikeViewModel) cLog("Dislike button wasn't added to DOM yet...");
      return dislikeViewModel;
    } else {
      return buttons.children[1] ?? null;
    }
  }
}

function getLikeButton(buttons = getButtons()) {
  const firstButton = buttons?.children?.[0];
  if (!firstButton) {
    return null;
  }

  return firstButton.tagName === "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? buttons.querySelector("#segmented-like-button") !== null
      ? buttons.querySelector("#segmented-like-button")
      : firstButton.children[0]
    : buttons.querySelector("like-button-view-model") ?? firstButton;
}

function getLikeTextContainer() {
  const likeButton = getLikeButton();
  if (!likeButton) return null;
  return (
    likeButton.querySelector("#text") ??
    likeButton.getElementsByTagName("yt-formatted-string")[0] ??
    likeButton.querySelector("span[role='text']")
  );
}

function getDislikeTextContainer(dislikeButton = getDislikeButton()) {
  if (!dislikeButton) {
    return null;
  }

  let result =
    dislikeButton.querySelector("#text") ??
    dislikeButton.getElementsByTagName("yt-formatted-string")[0] ??
    dislikeButton.querySelector("span[role='text']") ??
    dislikeButton.querySelector(
      ".ytSpecButtonShapeNextButtonTextContent, .yt-spec-button-shape-next__button-text-content",
    );
  if (result == null) {
    const activationTarget = getActivationTarget(dislikeButton);
    if (!activationTarget?.matches("button, tp-yt-paper-button#button")) {
      return null;
    }

    const shorts = isShorts();
    const usesNativeShape =
      !shorts &&
      activationTarget.matches(
        ".ytSpecButtonShapeNextHost, .yt-spec-button-shape-next, " +
          ".ytSpecButtonShapeNextIconButton, .yt-spec-button-shape-next--icon-button, " +
          ".ytSpecButtonShapeNextIconLeading, .yt-spec-button-shape-next--icon-leading",
      );
    const text = document.createElement(usesNativeShape ? "div" : "span");
    text.id = "text";
    text.setAttribute("role", "text");
    if (usesNativeShape) {
      text.className = "ytSpecButtonShapeNextButtonTextContent yt-spec-button-shape-next__button-text-content";
      activationTarget.classList.remove("ytSpecButtonShapeNextIconButton", "yt-spec-button-shape-next--icon-button");
      activationTarget.classList.add("ytSpecButtonShapeNextIconLeading", "yt-spec-button-shape-next--icon-leading");
    } else {
      if (shorts) text.style.marginLeft = "6px";
      else text.style.marginInlineStart = "6px";
      activationTarget.style.width = "auto";
    }
    activationTarget.appendChild(text);
    result = text;
  }
  return result;
}

function setSyntheticShortsPressed(pressed, dislikeButton = getDislikeButton()) {
  if (!dislikeButton?.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR)) {
    return;
  }
  dislikeButton.classList.toggle("style-default-active", pressed);
  dislikeButton.classList.toggle("style-text", !pressed);
  dislikeButton.querySelector("button")?.setAttribute("aria-pressed", String(pressed));
}

function persistSyntheticShortsState(videoId, disliked) {
  void syntheticDislikeStore.setDisliked(videoId, disliked).catch(reportVoteFailure);
}

async function readSyntheticShortsDisliked(videoId) {
  try {
    return await syntheticDislikeStore.isDisliked(videoId);
  } catch (error) {
    reportVoteFailure(error);
    return false;
  }
}

async function restoreSyntheticShortsState(
  videoId,
  dislikeButton = getDislikeButton(),
  initialVisibleState = getState(),
) {
  if (!dislikeButton?.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR)) {
    return false;
  }

  const disliked = await readSyntheticShortsDisliked(videoId);

  return {
    disliked,
    submittedState: initialVisibleState === LIKED_STATE ? LIKED_STATE : disliked ? DISLIKED_STATE : initialVisibleState,
  };
}

function createObserver(options, callback) {
  const observerWrapper = new Object();
  observerWrapper.options = options;
  observerWrapper.observer = new MutationObserver(callback);
  observerWrapper.observe = function (element) {
    this.observer.observe(element, this.options);
  };
  observerWrapper.disconnect = function () {
    this.observer.disconnect();
  };
  observerWrapper.takeRecords = function () {
    return this.observer.takeRecords();
  };
  return observerWrapper;
}

let shortsObserver = null;

function getShortsObserver() {
  if (shortsObserver) {
    return shortsObserver;
  }
  cLog("Initializing shorts mutation observer");
  shortsObserver = createObserver(
    {
      attributes: true,
      attributeFilter: ["aria-pressed"],
    },
    refreshColoredThumbs,
  );
  return shortsObserver;
}

function isVideoLiked() {
  const likeButton = getLikeButton();
  const nativeButton = likeButton?.querySelector("button");
  if (isMobile) {
    return nativeButton?.getAttribute("aria-pressed") === "true" || nativeButton?.getAttribute("aria-label") === "true";
  }
  return (
    likeButton?.classList.contains("style-default-active") || nativeButton?.getAttribute("aria-pressed") === "true"
  );
}

function isVideoDisliked() {
  const dislikeButton = getDislikeButton();
  const nativeButton = dislikeButton?.querySelector("button");
  if (isMobile) {
    return nativeButton?.getAttribute("aria-pressed") === "true" || nativeButton?.getAttribute("aria-label") === "true";
  }
  return (
    dislikeButton?.classList.contains("style-default-active") || nativeButton?.getAttribute("aria-pressed") === "true"
  );
}

function isVideoNotLiked() {
  if (isMobile) {
    return !isVideoLiked();
  }
  return getLikeButton().classList.contains("style-text");
}

function isVideoNotDisliked() {
  if (isMobile) {
    return !isVideoDisliked();
  }
  return getDislikeButton()?.classList.contains("style-text");
}

function isSignedOut() {
  const signInLink = document.querySelector("a[href^='https://accounts.google.com/ServiceLogin']");
  return signInLink !== null || (!isMobile && document.querySelector("#avatar-btn") === null);
}

function getState() {
  if (isVideoLiked()) {
    return LIKED_STATE;
  }
  if (isVideoDisliked()) {
    return DISLIKED_STATE;
  }
  return NEUTRAL_STATE;
}

function setLikes(likesCount) {
  if (isMobile) {
    const container = getButtons()?.children[0]?.querySelector(".button-renderer-text");
    if (container) container.innerText = likesCount;
    return;
  }
  const container = getLikeTextContainer();
  if (container) container.innerText = likesCount;
}

function setDislikes(dislikesCount) {
  if (isMobile) {
    mobileDislikes = dislikesCount;
    return;
  }

  const _container = getDislikeTextContainer();
  if (!_container) {
    return;
  }
  _container.removeAttribute("is-empty");
  if (_container.innerText !== dislikesCount) {
    _container.innerText = dislikesCount;
  }
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }
    let likeButton =
      getLikeButton().querySelector("yt-formatted-string#text") ?? getLikeButton().querySelector("button");

    let likesStr = likeButton.getAttribute("aria-label").replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
  } catch {
    return false;
  }
}

(typeof GM_addStyle != "undefined"
  ? GM_addStyle
  : (styles) => {
      let styleNode = document.createElement("style");
      styleNode.type = "text/css";
      styleNode.innerText = styles;
      document.head.appendChild(styleNode);
    })(`
    [data-ryd-thumb-color],
    [data-ryd-thumb-color] :is(.ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon, yt-icon, .ytIconWrapperHost) {
      color: var(--ryd-thumb-color) !important;
    }

    [data-ryd-thumb-color] yt-animated-icon svg [fill]:not([fill="none"]) {
      fill: var(--ryd-thumb-color) !important;
    }

    [data-ryd-thumb-color] yt-animated-icon svg [stroke]:not([stroke="none"]) {
      stroke: var(--ryd-thumb-color) !important;
    }

    #return-youtube-dislike-bar-container {
      background: #737373;
      background: color-mix(
        in srgb,
        var(--yt-spec-text-primary, #f1f1f1) 55%,
        var(--yt-spec-base-background, #0f0f0f) 45%
      );
      border-radius: 2px;
    }

    #return-youtube-dislike-bar {
      background: var(--yt-spec-text-primary, #f1f1f1);
      border-radius: 2px;
      transition: all 0.15s ease-in-out;
    }

    .ryd-synthetic-shorts-dislike svg {
      display: block;
      fill: currentColor;
      height: 24px;
      pointer-events: none;
      width: 24px;
    }

    .ryd-synthetic-shorts-dislike {
      box-sizing: content-box;
      display: block;
      flex: 0 0 auto;
      height: 70px;
      margin: 0 !important;
      padding: 0 0 8px;
      width: 100%;
    }

    .ryd-synthetic-shorts-dislike-label {
      align-items: center;
      display: flex;
      flex-direction: column;
    }

    .ryd-synthetic-shorts-dislike .ytSpecButtonShapeNextIcon {
      flex: 0 0 24px;
      height: 24px;
      min-width: 24px;
      width: 24px;
    }

    .ryd-synthetic-shorts-dislike button {
      color: inherit;
      cursor: pointer;
    }

    .ryd-synthetic-shorts-dislike button[aria-pressed="true"] {
      color: var(--yt-spec-call-to-action, #3ea6ff);
    }

    .ryd-tooltip {
      bottom: -10px;
      display: block;
      height: 2px;
      outline: none;
      position: absolute;
    }

    .ryd-tooltip-bar-container {
      width: 100%;
      height: 2px;
      position: absolute;
      padding-top: 6px;
      padding-bottom: 12px;
      top: -6px;
    }

    .ryd-tooltip-label {
      background: rgba(28, 28, 28, 0.96);
      border-radius: 4px;
      bottom: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      box-sizing: border-box;
      color: #fff;
      font-family: Roboto, Arial, sans-serif;
      font-size: 12px;
      font-weight: 500;
      line-height: 16px;
      max-width: calc(100vw - 24px);
      opacity: 0;
      overflow: hidden;
      padding: 6px 8px;
      pointer-events: none;
      position: absolute;
      right: 0;
      text-overflow: ellipsis;
      transform: translateY(4px);
      transition: opacity 0.12s ease-out, transform 0.12s ease-out, visibility 0s linear 0.12s;
      visibility: hidden;
      white-space: nowrap;
      width: max-content;
      z-index: 2200;
    }

    .ryd-tooltip:hover .ryd-tooltip-label,
    .ryd-tooltip:focus-within .ryd-tooltip-label {
      opacity: 1;
      transform: translateY(0);
      transition-delay: 0s;
      visibility: visible;
    }

    .ryd-tooltip:focus-visible .ryd-tooltip-bar-container {
      outline: 2px solid var(--yt-spec-call-to-action, #3ea6ff);
      outline-offset: 2px;
    }

    ytd-menu-renderer.ytd-watch-metadata {
      overflow-y: visible !important;
    }

    #top-level-buttons-computed {
      position: relative !important;
    }
  `);

function createRateBar(likes, dislikes) {
  if (isMobile || isShorts() || !extConfig.rateBarEnabled) {
    return;
  }

  const buttons = getButtons();
  const likeButton = getLikeButton();
  const dislikeButton = getDislikeButton();
  if (!buttons || !likeButton) {
    return;
  }

  // YouTube retains the outgoing watch metadata tree during some SPA
  // transitions. A document-wide ID lookup can therefore find the old bar,
  // update it with the new video's counts, and then lose it when YouTube
  // removes that stale tree. Keep the single owned bar scoped to the active
  // reaction controls instead.
  for (const candidate of document.querySelectorAll("#return-youtube-dislike-bar-container")) {
    if (!buttons.contains(candidate)) {
      (candidate.closest(".ryd-tooltip") ?? candidate).remove();
    }
  }
  let rateBar = buttons.querySelector("#return-youtube-dislike-bar-container");
  if (rateBar && !watchRateBarIsHealthy(buttons, getVideoId())) {
    removeWatchRateBarArtifacts(buttons);
    rateBar = null;
  }

  // Inline view-model wrappers have no client width even when their children render.
  const widthPx =
    (likeButton.clientWidth || likeButton.getBoundingClientRect().width) +
    (dislikeButton ? dislikeButton.clientWidth || dislikeButton.getBoundingClientRect().width : 52);

  const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  var likePercentage = parseFloat(widthPercent.toFixed(1));
  const dislikePercentage = (100 - likePercentage).toLocaleString();
  likePercentage = likePercentage.toLocaleString();

  const separator = "\u00a0/\u00a0";
  const percentageSeparator = "\u00a0\u00a0-\u00a0\u00a0";
  let tooltipText;
  switch (extConfig.tooltipPercentageMode) {
    case "dash_like":
      tooltipText = `${likes.toLocaleString()}${separator}${dislikes.toLocaleString()}${percentageSeparator}${likePercentage}%`;
      break;
    case "dash_dislike":
      tooltipText = `${likes.toLocaleString()}${separator}${dislikes.toLocaleString()}${percentageSeparator}${dislikePercentage}%`;
      break;
    case "both":
      tooltipText = `${likePercentage}%${separator}${dislikePercentage}%`;
      break;
    case "only_like":
      tooltipText = `${likePercentage}%`;
      break;
    case "only_dislike":
      tooltipText = `${dislikePercentage}%`;
      break;
    default:
      tooltipText = `${likes.toLocaleString()}${separator}${dislikes.toLocaleString()}`;
  }

  if (!rateBar && !isMobile) {
    const tooltip = document.createElement("div");
    tooltip.className = "ryd-tooltip";
    tooltip.setAttribute("data-ryd-rate-bar-wrapper", "true");
    tooltip.setAttribute("data-ryd-video-id", getVideoId());
    tooltip.style.width = `${widthPx}px`;
    tooltip.setAttribute("aria-describedby", "ryd-dislike-tooltip");
    tooltip.setAttribute("tabindex", "0");

    const tooltipBarContainer = document.createElement("div");
    tooltipBarContainer.className = "ryd-tooltip-bar-container";

    rateBar = document.createElement("div");
    rateBar.id = "return-youtube-dislike-bar-container";
    rateBar.style.width = "100%";
    rateBar.style.height = "2px";

    const rateBarFill = document.createElement("div");
    rateBarFill.id = "return-youtube-dislike-bar";
    rateBarFill.style.width = `${widthPercent}%`;
    rateBarFill.style.height = "100%";
    if (extConfig.coloredBar) {
      rateBar.style.backgroundColor = getColorFromTheme(false);
      rateBarFill.style.backgroundColor = getColorFromTheme(true);
    }
    rateBar.appendChild(rateBarFill);
    tooltipBarContainer.appendChild(rateBar);

    const tooltipLabel = document.createElement("div");
    tooltipLabel.id = "ryd-dislike-tooltip";
    tooltipLabel.className = "ryd-tooltip-label";
    tooltipLabel.setAttribute("role", "tooltip");
    tooltipLabel.textContent = tooltipText;

    tooltip.append(tooltipBarContainer, tooltipLabel);
    buttons.appendChild(tooltip);
    const descriptionAndActionsElement = buttons.closest("#top-row");
    if (descriptionAndActionsElement) {
      descriptionAndActionsElement.style.borderBottom = "1px solid var(--yt-spec-10-percent-layer)";
      descriptionAndActionsElement.style.paddingBottom = "10px";
    }
  } else {
    const tooltip = rateBar.closest(".ryd-tooltip");
    const rateBarFill = rateBar.querySelector("#return-youtube-dislike-bar");
    if (!tooltip || !rateBarFill) {
      (tooltip ?? rateBar).remove();
      createRateBar(likes, dislikes);
      return;
    }
    tooltip.setAttribute("data-ryd-video-id", getVideoId());
    tooltip.style.width = widthPx + "px";
    rateBarFill.style.width = widthPercent + "%";
    const tooltipLabel = tooltip.querySelector("#ryd-dislike-tooltip");
    if (tooltipLabel) {
      tooltipLabel.textContent = tooltipText;
    }

    if (extConfig.coloredBar) {
      rateBar.style.backgroundColor = getColorFromTheme(false);
      rateBarFill.style.backgroundColor = getColorFromTheme(true);
    }
  }
}

function elementTouchesWatchRateBar(element) {
  return Boolean(
    element?.matches?.(
      ".ryd-tooltip, .ryd-tooltip-bar-container, .ryd-tooltip-label, #return-youtube-dislike-bar-container, #return-youtube-dislike-bar, #ryd-dislike-tooltip",
    ) ||
      element?.matches?.('[data-ryd-rate-bar-wrapper="true"]') ||
      element?.closest?.(".ryd-tooltip, .ryd-tooltip-bar-container, #return-youtube-dislike-bar-container") ||
      element?.querySelector?.(
        ".ryd-tooltip, .ryd-tooltip-bar-container, .ryd-tooltip-label, #return-youtube-dislike-bar-container, #return-youtube-dislike-bar, #ryd-dislike-tooltip",
      ),
  );
}

function mutationTouchesWatchRateBar(mutation) {
  if (mutation.type === "attributes") {
    return elementTouchesWatchRateBar(mutation.target);
  }
  return (
    mutation.type === "childList" &&
    [...mutation.addedNodes, ...mutation.removedNodes].some(
      (node) => node.nodeType === Node.ELEMENT_NODE && elementTouchesWatchRateBar(node),
    )
  );
}

function watchRateBarIsHealthy(buttons, videoId) {
  if (!buttons || !videoId) {
    return false;
  }

  const wrappers = Array.from(buttons.querySelectorAll('[data-ryd-rate-bar-wrapper="true"]'));
  const containers = Array.from(buttons.querySelectorAll("#return-youtube-dislike-bar-container"));
  const fills = Array.from(buttons.querySelectorAll("#return-youtube-dislike-bar"));
  const labels = Array.from(buttons.querySelectorAll("#ryd-dislike-tooltip"));
  if (wrappers.length !== 1 || containers.length !== 1 || fills.length !== 1 || labels.length !== 1) {
    return false;
  }

  const [wrapper] = wrappers;
  const [container] = containers;
  const [fill] = fills;
  const [label] = labels;
  if (
    wrapper.parentElement !== buttons ||
    !wrapper.matches(".ryd-tooltip") ||
    wrapper.getAttribute("data-ryd-video-id") !== videoId ||
    !wrapper.contains(container) ||
    !container.contains(fill) ||
    !wrapper.contains(label) ||
    !hasRenderedBox(wrapper) ||
    !hasRenderedBox(container)
  ) {
    return false;
  }

  const fillStyle = getComputedStyle(fill);
  const fillBounds = fill.getBoundingClientRect();
  return (
    fillStyle.display !== "none" &&
    fillStyle.visibility !== "hidden" &&
    fillStyle.visibility !== "collapse" &&
    Number.parseFloat(fillStyle.opacity) !== 0 &&
    fillBounds.height > 0
  );
}

function removeWatchRateBarArtifacts(buttons) {
  if (!buttons) {
    return;
  }

  for (const wrapper of buttons.querySelectorAll('.ryd-tooltip, [data-ryd-rate-bar-wrapper="true"]')) {
    wrapper.remove();
  }
  for (const fragment of buttons.querySelectorAll(
    ".ryd-tooltip-bar-container, .ryd-tooltip-label, #return-youtube-dislike-bar-container, #return-youtube-dislike-bar, #ryd-dislike-tooltip",
  )) {
    fragment.remove();
  }
}

function clearWatchPresentation(buttons, dislikeButton) {
  removeWatchRateBarArtifacts(buttons);
  const dislikeText =
    dislikeButton?.querySelector("#text") ??
    dislikeButton?.getElementsByTagName("yt-formatted-string")[0] ??
    dislikeButton?.querySelector("span[role='text']") ??
    dislikeButton?.querySelector(
      ".ytSpecButtonShapeNextButtonTextContent, .yt-spec-button-shape-next__button-text-content",
    );
  if (dislikeText) {
    dislikeText.textContent = "";
  }
}

function clearStaleWatchPresentation(buttons, dislikeButton, videoId) {
  if (isMobile || isShorts() || !initializedVideoId || initializedVideoId === videoId) {
    return;
  }

  clearWatchPresentation(buttons, dislikeButton);
}

function canRepairWatchRateBar(buttons, videoId) {
  if (
    isMobile ||
    isShorts() ||
    !extConfig.rateBarEnabled ||
    !videoId ||
    !countStateLoaded ||
    countStateVideoId !== videoId ||
    initializedVideoId !== videoId ||
    getVideoId() !== videoId ||
    !buttons?.isConnected ||
    getButtons() !== buttons ||
    !hasRenderedBox(buttons)
  ) {
    return false;
  }

  const likeButton = getLikeButton();
  const dislikeButton = getDislikeButton();
  return (
    likeButton === initializedLikeButton &&
    dislikeButton === initializedDislikeButton &&
    buttons.contains(likeButton) &&
    buttons.contains(dislikeButton) &&
    !watchRateBarIsHealthy(buttons, videoId)
  );
}

function repairWatchRateBar(buttons = getButtons(), videoId = getVideoId()) {
  if (canRepairWatchRateBar(buttons, videoId)) {
    removeWatchRateBarArtifacts(buttons);
    createRateBar(likesvalue, dislikesvalue);
  }
}

function scheduleWatchRateBarRepair() {
  if (watchRateBarRepairTimer !== null) {
    return;
  }
  watchRateBarRepairTimer = setTimeout(() => {
    watchRateBarRepairTimer = null;
    repairWatchRateBar(watchRateBarObserverTarget, watchRateBarObserverVideoId);
  }, 0);
}

function disconnectWatchRateBarObserver() {
  watchRateBarObserver?.disconnect();
  watchRateBarObserver = null;
  watchRateBarObserverTarget = null;
  watchRateBarObserverVideoId = null;
  if (watchRateBarRepairTimer !== null) {
    clearTimeout(watchRateBarRepairTimer);
    watchRateBarRepairTimer = null;
  }
}

function observeWatchRateBar(buttons, videoId) {
  if (isMobile || isShorts() || !extConfig.rateBarEnabled || !buttons) {
    disconnectWatchRateBarObserver();
    return;
  }

  if (watchRateBarObserverTarget === buttons) {
    watchRateBarObserverVideoId = videoId;
    return;
  }

  disconnectWatchRateBarObserver();
  watchRateBarObserverTarget = buttons;
  watchRateBarObserverVideoId = videoId;
  watchRateBarObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesWatchRateBar)) {
      scheduleWatchRateBarRepair();
    }
  });
  watchRateBarObserver.observe(buttons, {
    attributeFilter: ["aria-hidden", "class", "hidden", "inert", "style"],
    attributes: true,
    childList: true,
    subtree: true,
  });
}

function setState() {
  const videoId = getVideoId();
  previousState = getState();
  if (countStateVideoId === videoId && (activeCountRequest?.videoId === videoId || countStateLoaded)) {
    updateDOMDislikes();
    refreshFormattedLikes();
    refreshColoredThumbs();
    return;
  }
  if (countStateVideoId !== videoId) {
    likesvalue = 0;
    dislikesvalue = 0;
    countStateVideoId = videoId;
    countStateLoaded = false;
    countStateEpoch += 1;
  }
  const countRequest = {
    dislikesDelta: 0,
    likesDelta: 0,
    videoId,
  };
  activeCountRequest = countRequest;
  cLog("Fetching votes...");

  fetchImpl(`${API_BASE_URL}/votes?videoId=${videoId}`)
    .then((response) => response.json())
    .then((json) => {
      if (getVideoId() !== videoId || activeCountRequest !== countRequest) {
        return;
      }
      if (json && !("traceId" in json)) {
        const { dislikes, likes } = json;
        cLog(`Received count: ${dislikes}`);
        likesvalue = Math.max(0, likes + countRequest.likesDelta);
        dislikesvalue = Math.max(0, dislikes + countRequest.dislikesDelta);
        countStateLoaded = true;
        setDislikes(numberFormat(dislikesvalue));
        if (extConfig.numberDisplayReformatLikes === true) {
          const nativeLikes = getLikeCountFromButton();
          if (nativeLikes !== false) {
            setLikes(numberFormat(nativeLikes));
          }
        }
        createRateBar(likesvalue, dislikesvalue);
        refreshColoredThumbs();
      }
    })
    .catch((error) => cLog("Fetching votes failed", error instanceof Error ? error.message : String(error)))
    .finally(() => {
      if (activeCountRequest === countRequest) {
        activeCountRequest = null;
      }
    });
}

function updateDOMDislikes() {
  const videoId = getVideoId();
  if (!videoId || !countStateLoaded || countStateVideoId !== videoId) {
    return false;
  }

  setDislikes(numberFormat(dislikesvalue));
  createRateBar(likesvalue, dislikesvalue);
  return true;
}

function reportVoteFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  cLog("Vote submission failed", message);
}

function refreshFormattedLikes() {
  if (extConfig.numberDisplayReformatLikes !== true) {
    return;
  }

  const nativeLikes = getLikeCountFromButton();
  if (nativeLikes !== false) {
    setLikes(numberFormat(nativeLikes));
  }
}

function getVoteStateCounts(state) {
  return {
    dislikes: state === DISLIKED_STATE ? 1 : 0,
    likes: state === LIKED_STATE ? 1 : 0,
  };
}

function getShortsCountTransition(videoId, transition) {
  if (!isShorts() || shortsSubmittedStateVideoId !== videoId) {
    return transition;
  }
  const previousCounts = getVoteStateCounts(shortsSubmittedState);
  const nextCounts = getVoteStateCounts(transition.nextState);
  return {
    ...transition,
    dislikesDelta: nextCounts.dislikes - previousCounts.dislikes,
    likesDelta: nextCounts.likes - previousCounts.likes,
  };
}

function applyCountTransition(videoId, countTransition) {
  const counts = applyVoteTransitionCounts(likesvalue, dislikesvalue, countTransition);
  if (activeCountRequest?.videoId === videoId) {
    activeCountRequest.likesDelta += countTransition.likesDelta;
    activeCountRequest.dislikesDelta += countTransition.dislikesDelta;
  }
  likesvalue = counts.likes;
  dislikesvalue = counts.dislikes;
}

function applyVoteTransition(videoId, transition, syntheticShortsDislike) {
  const countTransition = getShortsCountTransition(videoId, transition);
  applyCountTransition(videoId, countTransition);
  previousState = transition.nextState;
  if (syntheticShortsDislike) {
    setSyntheticShortsPressed(previousState === DISLIKED_STATE);
  }
  if (isShorts()) {
    shortsSubmittedStateVideoId = videoId;
    shortsSubmittedState = previousState;
    persistSyntheticShortsState(videoId, previousState === DISLIKED_STATE);
  }
  updateDOMDislikes();
  refreshFormattedLikes();
}

function applyHydratingVoteTransition(hydration, transition, syntheticShortsDislike) {
  applyCountTransition(hydration.videoId, transition);
  previousState = transition.nextState;
  if (syntheticShortsDislike) {
    setSyntheticShortsPressed(previousState === DISLIKED_STATE);
  }
  updateDOMDislikes();
  refreshFormattedLikes();
}

function reconcileHydratingVoteTransition(hydration, transition, syntheticShortsDislike) {
  const submittedCountTransition = getShortsCountTransition(hydration.videoId, transition);
  if (transition.optimisticCountStateEpoch === countStateEpoch) {
    applyCountTransition(hydration.videoId, {
      ...transition,
      dislikesDelta: submittedCountTransition.dislikesDelta - transition.dislikesDelta,
      likesDelta: submittedCountTransition.likesDelta - transition.likesDelta,
    });
  }
  previousState = transition.nextState;
  shortsSubmittedStateVideoId = hydration.videoId;
  shortsSubmittedState = previousState;
  persistSyntheticShortsState(hydration.videoId, previousState === DISLIKED_STATE);
  if (syntheticShortsDislike) {
    setSyntheticShortsPressed(previousState === DISLIKED_STATE);
  }
}

function submitVoteTransition(videoId, transition, signedOut) {
  if (shouldSubmitVote({ disableVoteSubmission: extConfig.disableVoteSubmission, signedOut })) {
    void voteClient.submitVote(videoId, transition.value).catch(reportVoteFailure);
  }
}

function clearNativeLikeForSyntheticDislike(action, stateBeforeActivation, syntheticShortsDislike) {
  if (!syntheticShortsDislike || action !== DISLIKE_ACTION || stateBeforeActivation !== LIKED_STATE) {
    return;
  }

  const nativeLikeButton = getLikeButton()?.querySelector("button");
  if (nativeLikeButton && isVideoLiked()) {
    suppressNextLikeActivation = true;
    try {
      nativeLikeButton.click();
    } finally {
      suppressNextLikeActivation = false;
    }
  }
}

function handleVoteActivation(action) {
  const signedOut = isSignedOut();
  if (signedOut) {
    return;
  }

  const videoId = getVideoId();
  if (!videoId) {
    return;
  }

  const transition = resolveVoteTransition(previousState, action);
  const syntheticShortsDislike = getDislikeButton()?.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR) === true;
  clearNativeLikeForSyntheticDislike(action, previousState, syntheticShortsDislike);
  applyVoteTransition(videoId, transition, syntheticShortsDislike);
  submitVoteTransition(videoId, transition, signedOut);
}

function captureHydratingShortsActivation(event, action) {
  const hydration = hydratingShortsActivationTargets.get(event.currentTarget);
  if (!hydration) {
    return false;
  }
  if (hydration.videoId !== getVideoId()) {
    return true;
  }

  const signedOut = isSignedOut();
  const syntheticShortsDislike = getDislikeButton()?.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR) === true;
  if (!signedOut) {
    clearNativeLikeForSyntheticDislike(action, hydration.visibleState, syntheticShortsDislike);
  }
  const transition = {
    ...resolveVoteTransition(hydration.visibleState, action),
    optimisticCountStateEpoch: countStateEpoch,
  };
  hydration.visibleState = transition.nextState;
  if (!signedOut) {
    hydration.activations.push(transition);
    applyHydratingVoteTransition(hydration, transition, syntheticShortsDislike);
    submitVoteTransition(hydration.videoId, transition, signedOut);
  }
  return true;
}

function likeClicked(event) {
  if (suppressNextLikeActivation) {
    return;
  }
  if (boundActivationVideoIds.get(event.currentTarget) !== getVideoId()) {
    suppressStaleTargetRefresh(event.currentTarget);
    return;
  }
  if (captureHydratingShortsActivation(event, LIKE_ACTION)) {
    return;
  }
  handleVoteActivation(LIKE_ACTION);
}

function dislikeClicked(event) {
  if (boundActivationVideoIds.get(event.currentTarget) !== getVideoId()) {
    suppressStaleTargetRefresh(event.currentTarget);
    return;
  }
  if (captureHydratingShortsActivation(event, DISLIKE_ACTION)) {
    return;
  }
  handleVoteActivation(DISLIKE_ACTION);
}

function handleDelegatedVoteClick(event) {
  const buttons = getButtons();
  const likeButton = getLikeButton(buttons);
  const dislikeButton = getDislikeButton(buttons);
  const activation = resolveDelegatedVoteActivation({
    buttons,
    dislikeButton,
    event,
    getActivationTarget,
    likeButton,
  });
  if (!activation) {
    return;
  }

  const videoId = getVideoId();
  if (!videoId) {
    return;
  }
  const targetHydration = hydratingShortsActivationTargets.get(activation.activationTarget);
  const hydration = targetHydration?.videoId === videoId ? targetHydration : null;
  if (targetHydration && !hydration) {
    hydratingShortsActivationTargets.delete(activation.activationTarget);
  }
  const targetIsBoundToCurrentVideo = boundActivationVideoIds.get(activation.activationTarget) === videoId;
  const currentCountStateIsLoaded = countStateLoaded && countStateVideoId === videoId;
  const isUnboundCurrentShortsActivation = isShorts() && !hydration && !targetIsBoundToCurrentVideo;
  if (!hydration && !targetIsBoundToCurrentVideo && !currentCountStateIsLoaded && !isUnboundCurrentShortsActivation) {
    return;
  }

  if (isUnboundCurrentShortsActivation) {
    previousState = getState();
  }
  boundActivationVideoIds.set(activation.activationTarget, videoId);
  const delegatedEvent = { currentTarget: activation.activationTarget };
  if (activation.action === LIKE_ACTION) {
    likeClicked(delegatedEvent);
  } else {
    dislikeClicked(delegatedEvent);
  }
}

function refreshDislikesForBoundControl(event) {
  if (boundActivationVideoIds.get(event.currentTarget) === getVideoId()) {
    updateDOMDislikes();
  }
}

function getVideoId() {
  const urlObject = new URL(window.location.href);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return (document.querySelector("meta[itemprop='videoId']") || document.querySelector("meta[itemprop='identifier']"))
      ?.content;
  } else {
    const shortVideoId = getShortVideoIdFromPathname(pathname);
    if (shortVideoId) {
      return shortVideoId;
    }
    return urlObject.searchParams.get("v");
  }
}

function isVideoLoaded() {
  if (isMobile) {
    return document.getElementById("player")?.getAttribute("loading") == "false";
  }
  const videoId = getVideoId();

  return (
    // desktop: spring 2024 UI
    document.querySelector(`ytd-watch-grid[video-id='${videoId}']`) !== null ||
    // desktop: older UI
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null ||
    // mobile: no video-id attribute
    document.querySelector('#player[loading="false"]:not([hidden])') !== null
  );
}

function roundDown(num) {
  if (num < 1000) return num;
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  let numberDisplay;
  if (extConfig.numberDisplayRoundDown === false) {
    numberDisplay = numberState;
  } else {
    numberDisplay = roundDown(numberState);
  }
  return getNumberFormatter(extConfig.numberDisplayFormat).format(numberDisplay);
}

function getNumberFormatter(optionSelect) {
  let userLocales;
  if (document.documentElement.lang) {
    userLocales = document.documentElement.lang;
  } else if (navigator.language) {
    userLocales = navigator.language;
  } else {
    try {
      userLocales = new URL(
        Array.from(document.querySelectorAll("head > link[rel='search']"))
          ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
          ?.getAttribute("href"),
      )?.searchParams?.get("locale");
    } catch {
      cLog("Cannot find browser locale. Use en as default for number formatting.");
      userLocales = "en";
    }
  }

  let formatterNotation;
  let formatterCompactDisplay;
  switch (optionSelect) {
    case "compactLong":
      formatterNotation = "compact";
      formatterCompactDisplay = "long";
      break;
    case "standard":
      formatterNotation = "standard";
      formatterCompactDisplay = "short";
      break;
    case "compactShort":
    default:
      formatterNotation = "compact";
      formatterCompactDisplay = "short";
  }

  const formatter = Intl.NumberFormat(userLocales, {
    notation: formatterNotation,
    compactDisplay: formatterCompactDisplay,
  });
  return formatter;
}

function getColorFromTheme(voteIsLike) {
  return getThemeColor(extConfig.colorTheme, voteIsLike, isYouTubeDarkTheme(document), extConfig.customColors);
}

let thumbColorObserver = null;
let thumbColorObserverHosts = [];

function observeThumbColorTargets(hosts) {
  const currentHosts = extConfig.coloredThumbs ? hosts.filter(Boolean) : [];
  if (
    currentHosts.length === thumbColorObserverHosts.length &&
    currentHosts.every((host, index) => host === thumbColorObserverHosts[index])
  ) {
    return;
  }
  thumbColorObserver?.disconnect();
  thumbColorObserverHosts = currentHosts;
  if (!currentHosts.length) return;
  if (!thumbColorObserver) thumbColorObserver = new MutationObserver(refreshColoredThumbs);
  currentHosts.forEach((host) => thumbColorObserver.observe(host, { childList: true, subtree: true }));
}

function refreshColoredThumbs() {
  const shorts = isShorts();
  const observer = shorts && extConfig.coloredThumbs ? getShortsObserver() : null;
  const buttons = [getLikeButton(), getDislikeButton()];
  observeThumbColorTargets(buttons);
  buttons.forEach((host, index) => {
    const button = host?.querySelector("button, tp-yt-paper-button#button") ?? host;
    if (!button) return;
    if (extConfig.coloredThumbs && (!shorts || button.getAttribute("aria-pressed") === "true")) {
      const color = getColorFromTheme(index === 0);
      if (button.style.getPropertyValue("--ryd-thumb-color") !== color) {
        button.style.setProperty("--ryd-thumb-color", color);
      }
      if (!button.hasAttribute("data-ryd-thumb-color")) button.setAttribute("data-ryd-thumb-color", "");
    } else if (button.hasAttribute("data-ryd-thumb-color")) {
      button.removeAttribute("data-ryd-thumb-color");
      button.style.removeProperty("--ryd-thumb-color");
    }
    observer?.observe(button);
  });
}

function refreshColorPresentation() {
  refreshColoredThumbs();
  if (extConfig.coloredBar) {
    const buttons = getButtons();
    const rateBar = buttons?.querySelector("#return-youtube-dislike-bar-container");
    const rateBarFill = rateBar?.querySelector("#return-youtube-dislike-bar");
    if (rateBar && rateBarFill) {
      rateBar.style.backgroundColor = getColorFromTheme(false);
      rateBarFill.style.backgroundColor = getColorFromTheme(true);
    }
  }
}

let smartimationObserver = null;
let initializedVideoId = null;
let initializedButtons = null;
let initializedLikeButton = null;
let initializedDislikeButton = null;
let lifecyclePageKey = null;

const SHORTS_RENDERER_SELECTOR =
  "ytd-reel-video-renderer, ytm-reel-video-renderer, ytm-shorts-video-renderer, ytm-reel-player-overlay-renderer";
const SHORTS_CONTROL_SELECTOR = `like-button-view-model, dislike-button-view-model, ${SYNTHETIC_SHORTS_DISLIKE_SELECTOR}`;

function getShortsRenderer(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  return element.matches(SHORTS_RENDERER_SELECTOR) ? element : element.closest?.(SHORTS_RENDERER_SELECTOR) ?? null;
}

function rendererOwnsCurrentShort(renderer) {
  if (!renderer) {
    return false;
  }
  return (
    renderer.hasAttribute("is-active") ||
    rendererMatchesShort(renderer, getVideoId()) ||
    (initializedLikeButton && renderer.contains(initializedLikeButton)) ||
    (initializedDislikeButton && renderer.contains(initializedDislikeButton))
  );
}

function elementTouchesCurrentShortRenderer(element) {
  const containingRenderer = getShortsRenderer(element);
  if (containingRenderer) {
    return rendererOwnsCurrentShort(containingRenderer);
  }
  return Array.from(element?.querySelectorAll?.(SHORTS_RENDERER_SELECTOR) ?? []).some(rendererOwnsCurrentShort);
}

function mutationTouchesShortsControls(mutation) {
  if (mutation.type === "attributes") {
    if (mutation.attributeName === "is-active" && mutation.target.matches(SHORTS_RENDERER_SELECTOR)) {
      return true;
    }
    if (
      (mutation.target.matches(SHORTS_RENDERER_SELECTOR) || mutation.target.matches("a")) &&
      elementTouchesCurrentShortRenderer(mutation.target)
    ) {
      return true;
    }
    return false;
  }
  if (mutation.type !== "childList") {
    return false;
  }
  const changedElements = [...mutation.addedNodes, ...mutation.removedNodes].filter(
    (node) => node.nodeType === Node.ELEMENT_NODE,
  );
  if (
    changedElements.some(
      (node) =>
        node.matches(`reel-action-bar-view-model, ${SHORTS_CONTROL_SELECTOR}`) ||
        node.querySelector?.(`reel-action-bar-view-model, ${SHORTS_CONTROL_SELECTOR}`),
    )
  ) {
    return [mutation.target, ...changedElements].some(elementTouchesCurrentShortRenderer);
  }
  return (
    mutation.target.closest?.(SHORTS_CONTROL_SELECTOR) &&
    elementTouchesCurrentShortRenderer(mutation.target) &&
    changedElements.some(
      (node) =>
        node.matches("button, tp-yt-paper-button#button") || node.querySelector?.("button, tp-yt-paper-button#button"),
    )
  );
}

function shortsControlsNeedInitialization() {
  const videoId = getVideoId();
  if (!isShorts() || !videoId) {
    return false;
  }

  const buttons = getButtons();
  const likeButton = getLikeButton();
  const dislikeButton = getDislikeButton();
  const syntheticDislikes = buttons?.querySelectorAll?.(SYNTHETIC_SHORTS_DISLIKE_SELECTOR).length ?? 0;
  const hasNativeDislike = Boolean(buttons?.querySelector?.("dislike-button-view-model, #dislike-button"));
  if (!buttons || !likeButton || !dislikeButton) {
    return true;
  }
  if ((hasNativeDislike && syntheticDislikes > 0) || (!hasNativeDislike && syntheticDislikes !== 1)) {
    return true;
  }
  if (
    initializedVideoId !== videoId ||
    initializedLikeButton !== likeButton ||
    initializedDislikeButton !== dislikeButton
  ) {
    return true;
  }

  return (
    boundActivationVideoIds.get(getActivationTarget(likeButton)) !== videoId ||
    boundActivationVideoIds.get(getActivationTarget(dislikeButton)) !== videoId
  );
}

function disconnectShortsLifecycleObserver() {
  shortsLifecycleObserver?.disconnect();
  shortsLifecycleObserverTarget = null;
}

function observeShortsLifecycle(buttons) {
  if (!isShorts() || !buttons) {
    disconnectShortsLifecycleObserver();
    return;
  }
  clearPendingWatchControlObservers();

  const isDesktopActionBar = buttons.tagName === "REEL-ACTION-BAR-VIEW-MODEL";
  const isMobileActionBar = isMobile && buttons.tagName === "YTM-LIKE-BUTTON-RENDERER";
  if (!isDesktopActionBar && !isMobileActionBar) {
    disconnectShortsLifecycleObserver();
    return;
  }

  const renderer = isMobileActionBar
    ? buttons.closest("ytm-reel-video-renderer, ytm-shorts-video-renderer") ?? getMobileShortOwnership(buttons).owner
    : buttons.closest("ytd-reel-video-renderer") ?? buttons;
  const observerTarget =
    renderer.closest(
      "ytd-shorts, ytd-shorts-container, ytm-shorts, ytm-shorts-container, #shorts-container, #shorts-inner-container",
    ) ??
    renderer.parentElement ??
    document.body;
  if (shortsLifecycleObserverTarget === observerTarget) {
    return;
  }
  disconnectShortsLifecycleObserver();
  shortsLifecycleObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesShortsControls) && shortsControlsNeedInitialization()) {
      setEventListeners();
    }
  });
  shortsLifecycleObserver.observe(observerTarget, {
    attributeFilter: ["href", "is-active", "video-id"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  shortsLifecycleObserverTarget = observerTarget;
}

function getActivationTarget(control) {
  if (control.matches("button, tp-yt-paper-button#button")) {
    return control;
  }
  return control.querySelector("button, tp-yt-paper-button#button") ?? control;
}

function beginShortsHydration(videoId, likeButton, dislikeButton, initialVisibleState) {
  const previousCompletion = shortsHydrationTails.get(videoId) ?? Promise.resolve();
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const hydration = {
    activations: [],
    completion,
    initialVisibleState,
    previousCompletion,
    resolveCompletion,
    videoId,
    visibleState: initialVisibleState,
  };
  shortsHydrationTails.set(videoId, completion);
  hydratingShortsActivationTargets.set(getActivationTarget(likeButton), hydration);
  hydratingShortsActivationTargets.set(getActivationTarget(dislikeButton), hydration);
  return hydration;
}

function finishShortsHydration(hydration, likeButton, dislikeButton) {
  for (const target of [getActivationTarget(likeButton), getActivationTarget(dislikeButton)]) {
    if (hydratingShortsActivationTargets.get(target) === hydration) {
      hydratingShortsActivationTargets.delete(target);
    }
  }
  if (shortsHydrationTails.get(hydration.videoId) === hydration.completion) {
    shortsHydrationTails.delete(hydration.videoId);
  }
  hydration.resolveCompletion();
}

function persistFinalHydratingActivation(hydration) {
  const finalActivation = hydration.activations[hydration.activations.length - 1];
  if (finalActivation) {
    persistSyntheticShortsState(hydration.videoId, finalActivation.nextState === DISLIKED_STATE);
  }
}

function reconcileStaleShortsHydration(hydration, submittedState, storedDisliked) {
  if (getVideoId() !== hydration.videoId || hydration.activations.length === 0) {
    persistFinalHydratingActivation(hydration);
    return;
  }

  const currentDislikeButton = getDislikeButton();
  if (!currentDislikeButton) {
    persistFinalHydratingActivation(hydration);
    return;
  }

  applyHydratedShortsState(hydration, submittedState, currentDislikeButton, storedDisliked);
}

function applyHydratedShortsState(hydration, submittedState, dislikeButton, storedDisliked) {
  const syntheticShortsDislike = dislikeButton.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR);
  shortsSubmittedStateVideoId = hydration.videoId;
  shortsSubmittedState = submittedState;

  if (hydration.activations.length === 0) {
    previousState = syntheticShortsDislike ? submittedState : hydration.initialVisibleState;
    if (syntheticShortsDislike) {
      setSyntheticShortsPressed(submittedState === DISLIKED_STATE, dislikeButton);
    }
    if (hydration.initialVisibleState === LIKED_STATE && storedDisliked) {
      persistSyntheticShortsState(hydration.videoId, false);
    }
    return;
  }

  for (const transition of hydration.activations) {
    reconcileHydratingVoteTransition(hydration, transition, syntheticShortsDislike);
  }
  updateDOMDislikes();
  refreshFormattedLikes();
}

function bindVoteButtonListeners(likeButton, dislikeButton, { enableSynthetic = true } = {}) {
  const likeActivationTarget = getActivationTarget(likeButton);
  const dislikeActivationTarget = getActivationTarget(dislikeButton);
  const videoId = getVideoId();
  boundActivationVideoIds.set(likeActivationTarget, videoId);
  boundActivationVideoIds.set(dislikeActivationTarget, videoId);
  if (!boundDislikeButtons.has(dislikeActivationTarget)) {
    dislikeActivationTarget.addEventListener("focusin", refreshDislikesForBoundControl);
    dislikeActivationTarget.addEventListener("focusout", refreshDislikesForBoundControl);
    boundDislikeButtons.add(dislikeActivationTarget);
  }
  if (enableSynthetic && dislikeButton.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR)) {
    dislikeActivationTarget.disabled = false;
    dislikeActivationTarget.setAttribute("aria-disabled", "false");
  }
}

function getStableDesktopShortsControls(videoId, generation) {
  const buttons = getButtons();
  const inventory = captureShortsNativeControlInventory(buttons);
  const isHydrated = actionBarHasHydratedData(buttons);
  if (
    !buttons ||
    !inventory ||
    (!isHydrated && !shortsNativeControlInventoryIsReadyForFallback(inventory)) ||
    !shortsControlSurfaceIsReadyForMutation(buttons, videoId, {
      allowUnhydratedFallback: !isHydrated,
      isHydrated,
      isStable: true,
    })
  ) {
    pendingShortsMutationSurface = null;
    return null;
  }

  const signature = getShortsControlSurfaceSignature(buttons);
  const now = performance.now();
  if (
    pendingShortsMutationSurface?.buttons !== buttons ||
    pendingShortsMutationSurface.generation !== generation ||
    pendingShortsMutationSurface.videoId !== videoId ||
    pendingShortsMutationSurface.signature !== signature ||
    !shortsNativeControlInventoryMatches(pendingShortsMutationSurface.inventory, inventory)
  ) {
    pendingShortsMutationSurface = {
      buttons,
      generation,
      inventory,
      observedAt: now,
      signature,
      unhydratedObservedAt: isHydrated ? null : now,
      videoId,
    };
    return null;
  }

  if (isHydrated) {
    pendingShortsMutationSurface.unhydratedObservedAt = null;
  } else if (pendingShortsMutationSurface.unhydratedObservedAt == null) {
    pendingShortsMutationSurface.unhydratedObservedAt = now;
  }
  const stabilityObservedAt = isHydrated
    ? pendingShortsMutationSurface.observedAt
    : pendingShortsMutationSurface.unhydratedObservedAt;
  if (now - stabilityObservedAt < getShortsControlSurfaceStabilityMs(isHydrated)) {
    return null;
  }

  const allowUnhydratedFallback = !isHydrated;
  const preMutationButtons = getButtons();
  const preMutationInventory = captureShortsNativeControlInventory(preMutationButtons);
  const preMutationIsHydrated = actionBarHasHydratedData(preMutationButtons);
  const preMutationAllowsFallback = !preMutationIsHydrated && allowUnhydratedFallback;
  if (
    preMutationButtons !== buttons ||
    !shortsNativeControlInventoryMatches(inventory, preMutationInventory) ||
    (preMutationAllowsFallback && !shortsNativeControlInventoryIsReadyForFallback(preMutationInventory)) ||
    getShortsControlSurfaceSignature(preMutationButtons) !== signature ||
    !shortsControlSurfaceIsReadyForMutation(preMutationButtons, videoId, {
      allowUnhydratedFallback: preMutationAllowsFallback,
      isHydrated: preMutationIsHydrated,
      isStable: true,
    })
  ) {
    pendingShortsMutationSurface = null;
    return null;
  }

  ensureSyntheticShortsDislikeButton(preMutationButtons, {
    allowUnhydratedFallback: preMutationAllowsFallback,
    currentVideoId: videoId,
    isHydrated: preMutationIsHydrated,
    isStable: true,
  });

  const confirmedButtons = getButtons();
  const confirmedInventory = captureShortsNativeControlInventory(confirmedButtons);
  const confirmedIsHydrated = actionBarHasHydratedData(confirmedButtons);
  if (
    confirmedButtons !== buttons ||
    !shortsNativeControlInventoryMatches(inventory, confirmedInventory) ||
    (preMutationAllowsFallback && !shortsNativeControlInventoryIsReadyForFallback(confirmedInventory)) ||
    getShortsControlSurfaceSignature(confirmedButtons) !== signature ||
    !shortsControlSurfaceIsReadyForMutation(confirmedButtons, videoId, {
      allowUnhydratedFallback: !confirmedIsHydrated && preMutationAllowsFallback,
      isHydrated: confirmedIsHydrated,
      isStable: true,
    })
  ) {
    pendingShortsMutationSurface = null;
    return null;
  }

  pendingShortsMutationSurface = null;
  return confirmedButtons;
}

async function initializeCurrentButtons(generation) {
  const videoId = getVideoId();
  if (!videoId) {
    // Channel/search/home pages have no video controls to initialize. The
    // lightweight lifecycle monitor will restart initialization when a video
    // route appears, instead of polling the whole page every 111 ms forever.
    return true;
  }

  if (!(isShorts() || (hasRenderedBox(getButtons()) && isVideoLoaded()))) {
    return false;
  }

  let buttons = getButtons();
  const needsStableShortsControls =
    isShorts() &&
    !isMobile &&
    buttons?.tagName === "REEL-ACTION-BAR-VIEW-MODEL" &&
    (!buttons.querySelector("dislike-button-view-model, #dislike-button") ||
      buttons.querySelector(SYNTHETIC_SHORTS_DISLIKE_SELECTOR) ||
      !actionBarHasHydratedData(buttons));
  if (needsStableShortsControls) {
    buttons = getStableDesktopShortsControls(videoId, generation);
    if (!buttons) {
      return false;
    }
  }
  const likeButton = getLikeButton(buttons);
  const dislikeButton = getDislikeButton(buttons);
  if (!buttons || !likeButton || !dislikeButton) {
    return false;
  }
  if (!isShorts() && !watchControlsAreReadyForVideo(buttons, likeButton, dislikeButton, videoId)) {
    return false;
  }
  if (!isShorts() && !getDislikeTextContainer(dislikeButton)) {
    return false;
  }

  observeShortsLifecycle(buttons);
  observeWatchRateBar(buttons, videoId);
  const stateNeedsInitialization =
    initializedVideoId !== videoId ||
    initializedButtons !== buttons ||
    initializedLikeButton !== likeButton ||
    initializedDislikeButton !== dislikeButton;
  if (stateNeedsInitialization) {
    clearStaleWatchPresentation(buttons, dislikeButton, videoId);
    initializedVideoId = videoId;
    initializedButtons = buttons;
    initializedLikeButton = likeButton;
    initializedDislikeButton = dislikeButton;
    setState();
  }

  if (isShorts()) {
    const initialVisibleState = getState();
    const likeActivationTarget = getActivationTarget(likeButton);
    const dislikeActivationTarget = getActivationTarget(dislikeButton);
    const existingLikeHydration = hydratingShortsActivationTargets.get(likeActivationTarget);
    const existingDislikeHydration = hydratingShortsActivationTargets.get(dislikeActivationTarget);
    if (
      existingLikeHydration &&
      existingLikeHydration === existingDislikeHydration &&
      existingLikeHydration.videoId === videoId
    ) {
      return false;
    }
    const hydration = beginShortsHydration(videoId, likeButton, dislikeButton, initialVisibleState);
    bindVoteButtonListeners(likeButton, dislikeButton, { enableSynthetic: false });
    let storedDisliked;
    let submittedState;
    try {
      await hydration.previousCompletion;
      if (dislikeButton.matches(SYNTHETIC_SHORTS_DISLIKE_SELECTOR)) {
        const restored = await restoreSyntheticShortsState(videoId, dislikeButton, initialVisibleState);
        if (!restored) {
          persistFinalHydratingActivation(hydration);
          return false;
        }
        storedDisliked = restored.disliked;
        submittedState = restored.submittedState;
      } else {
        storedDisliked = await readSyntheticShortsDisliked(videoId);
        submittedState =
          initialVisibleState === LIKED_STATE ? LIKED_STATE : storedDisliked ? DISLIKED_STATE : initialVisibleState;
      }

      if (
        generation !== initializationGeneration ||
        getVideoId() !== videoId ||
        getLikeButton() !== likeButton ||
        getDislikeButton() !== dislikeButton
      ) {
        reconcileStaleShortsHydration(hydration, submittedState, storedDisliked);
        return false;
      }

      applyHydratedShortsState(hydration, submittedState, dislikeButton, storedDisliked);
      bindVoteButtonListeners(likeButton, dislikeButton);
    } finally {
      finishShortsHydration(hydration, likeButton, dislikeButton);
    }
  } else {
    if (
      generation !== initializationGeneration ||
      getVideoId() !== videoId ||
      getLikeButton() !== likeButton ||
      getDislikeButton() !== dislikeButton
    ) {
      return false;
    }
    bindVoteButtonListeners(likeButton, dislikeButton);
  }

  if (!smartimationObserver) {
    smartimationObserver = createObserver(
      {
        attributes: true,
        subtree: true,
        childList: true,
      },
      updateDOMDislikes,
    );
    smartimationObserver.container = null;
  }

  const smartimationContainer = buttons.querySelector("yt-smartimation");
  if (smartimationContainer && smartimationObserver.container != smartimationContainer) {
    cLog("Initializing smartimation mutation observer");
    smartimationObserver.disconnect();
    smartimationObserver.observe(smartimationContainer);
    smartimationObserver.container = smartimationContainer;
  }

  return true;
}

function setEventListeners(evt) {
  const generation = ++initializationGeneration;
  let checkRunning = false;
  if (initializationTimer) {
    clearInterval(initializationTimer);
  }

  async function checkForJSFinish() {
    if (generation !== initializationGeneration || checkRunning) {
      return;
    }
    checkRunning = true;
    try {
      const initialized = await initializeCurrentButtons(generation);
      if (initialized && generation === initializationGeneration) {
        clearInterval(initializationTimer);
        initializationTimer = null;
      }
    } catch (error) {
      reportVoteFailure(error);
    } finally {
      checkRunning = false;
    }
  }

  cLog("Setting up...");
  initializationTimer = setInterval(() => void checkForJSFinish(), 111);
  void checkForJSFinish();
}

function getLifecyclePageKey() {
  const videoId = getVideoId();
  if (!videoId) {
    return null;
  }
  return `${isShorts() ? "shorts" : "watch"}:${videoId}`;
}

function watchControlsNeedReinitialization() {
  if (isMobile || isShorts() || initializationTimer !== null) {
    return false;
  }

  const videoId = getVideoId();
  if (!videoId || initializedVideoId !== videoId) {
    return false;
  }

  const buttons = getButtons();
  const likeButton = getLikeButton();
  const dislikeButton = getDislikeButton();
  return (
    !initializedButtons?.isConnected ||
    buttons !== initializedButtons ||
    likeButton !== initializedLikeButton ||
    dislikeButton !== initializedDislikeButton ||
    !initializedLikeButton?.isConnected ||
    !initializedDislikeButton?.isConnected ||
    !buttons?.contains(initializedLikeButton) ||
    !buttons?.contains(initializedDislikeButton)
  );
}

function checkPageLifecycle() {
  const pageKey = getLifecyclePageKey();
  if (pageKey !== lifecyclePageKey) {
    lifecyclePageKey = pageKey;
    if (!isShorts()) {
      disconnectShortsLifecycleObserver();
      if (!pageKey) {
        clearPendingWatchControlObservers();
      }
    }
    setEventListeners();
    return;
  }
  if (watchControlsNeedReinitialization()) {
    setEventListeners();
    return;
  }
  repairWatchRateBar();
}

function handleNavigateStart() {
  pendingShortsMutationSurface = null;
  disconnectWatchRateBarObserver();
  if (smartimationObserver) {
    smartimationObserver.takeRecords();
    smartimationObserver.disconnect();
    smartimationObserver.container = null;
  }
  clearPendingWatchNavigationBoundary();
  clearPendingWatchControlObservers();
  if (isShorts()) {
    return;
  }

  const buttons = getButtons();
  const likeButton = getLikeButton();
  const dislikeButton = getDislikeButton();
  if (!buttons || !likeButton || !dislikeButton) {
    return;
  }

  const likeActivationTarget = getActivationTarget(likeButton);
  const dislikeActivationTarget = getActivationTarget(dislikeButton);
  const likeVideoId = boundActivationVideoIds.get(likeActivationTarget);
  const dislikeVideoId = boundActivationVideoIds.get(dislikeActivationTarget);
  if (
    !likeVideoId ||
    likeVideoId !== dislikeVideoId ||
    likeVideoId !== getVideoId() ||
    !buttons.contains(likeActivationTarget) ||
    !buttons.contains(dislikeActivationTarget)
  ) {
    return;
  }

  activeCountRequest = null;
  countStateLoaded = false;
  countStateEpoch += 1;
  clearWatchPresentation(buttons, dislikeButton);

  const boundary = {
    buttons,
    completedVideoId: null,
    dislike: {
      activationTarget: dislikeActivationTarget,
      host: dislikeButton,
      refreshed: false,
    },
    like: {
      activationTarget: likeActivationTarget,
      host: likeButton,
      refreshed: false,
    },
    observer: null,
    sourceVideoId: likeVideoId,
  };
  const observer = new MutationObserver((mutations) => {
    captureWatchNavigationBoundaryRefreshes(boundary, mutations);
  });
  boundary.observer = observer;
  pendingWatchNavigationBoundary = boundary;
  observer.observe(buttons, {
    attributeFilter: ["aria-disabled", "aria-label", "data-video-id", "disabled", "title", "video-id"],
    attributes: true,
    childList: true,
    subtree: true,
  });
}

function handleNavigateFinish(event) {
  lifecyclePageKey = getLifecyclePageKey();
  if (isShorts()) {
    clearPendingWatchControlObservers();
    clearPendingWatchNavigationBoundary();
  } else {
    disconnectShortsLifecycleObserver();
    const videoId = getVideoId();
    if (pendingWatchNavigationBoundary && videoId !== pendingWatchNavigationBoundary.sourceVideoId) {
      pendingWatchNavigationBoundary.completedVideoId = videoId;
    }
    if (!getVideoId()) {
      clearPendingWatchControlObservers();
      clearPendingWatchNavigationBoundary();
    }
  }
  setEventListeners(event);
}

(function () {
  "use strict";
  observeYouTubeTheme(refreshColorPresentation);
  void voteClient.ensureRegistered().catch(reportVoteFailure);
  document.addEventListener("click", handleDelegatedVoteClick, true);
  window.addEventListener("yt-navigate-start", handleNavigateStart, true);
  window.addEventListener("yt-navigate-finish", handleNavigateFinish, true);
  window.addEventListener("popstate", checkPageLifecycle, true);
  lifecyclePageKey = getLifecyclePageKey();
  setInterval(checkPageLifecycle, 500);
  setEventListeners();
})();
if (isMobile) {
  setInterval(() => {
    const dislikeButton = getDislikeButton();
    if (dislikeButton?.querySelector(".button-renderer-text") === null) {
      getDislikeTextContainer().innerText = mobileDislikes;
    } else {
      if (dislikeButton) dislikeButton.querySelector(".button-renderer-text").innerText = mobileDislikes;
    }
  }, 1000);
}
