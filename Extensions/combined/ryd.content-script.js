import {
  captureShortsNativeControlInventory,
  ensureSyntheticShortsDislikeButton,
  getButtonControls,
  getButtons,
  getDislikeTextContainer,
  getShortsCandidateVideoId,
  getShortsControlSurfaceSignature,
  hasRenderedBox,
  markButtonsForVideo,
  setSyntheticShortsDislikeEnabled,
  shortsControlSurfaceIsReadyForMutation,
  shortsNativeControlInventoryIsReadyForFallback,
} from "./src/buttons";
import {
  ensureRemoteSelectors,
  hasLoadedStateForVideo,
  initExtConfig,
  isLikesDisabled,
  isShorts,
  clearRenderedVoteState,
  remoteSelectorsSettled,
  restoreCurrentState,
  setInitialState,
  storedData,
  NEUTRAL_STATE,
} from "./src/state";
import { getBrowser, getVideoId, isVideoLoaded } from "./src/utils";
import {
  addLikeDislikeEventListener,
  createSmartimationObserver,
  storageChangeHandler,
  observeColorTheme,
  setCountPermissionAvailable,
} from "./src/events";
import { hasUsableRateBar } from "./src/bar";
import {
  createInitializationCycleRunner,
  createPendingNavigationTracker,
  pendingIncompleteShortsControlsCanInitialize,
  pendingNavigationControlsAreReady,
  reactionControlsCanInitialize,
} from "./src/initialization-cycle";
import { initPatreonFeatures } from "./src/patreon";
import { initDiscussion } from "./src/discussion";
import {
  hasFeaturePermission,
  onDataPermissionsChanged,
  usesFirefoxDataCollectionConsent,
} from "./src/core-data-consent";
import { getDataConsentPrompt } from "./src/data-consent-prompt";
import { cancelObsoleteVoteDataRequests, clearVoteDataRequestCache } from "./src/vote-data-request";
import { isPrivateBrowsingContext } from "./src/private-browsing";
import {
  actionBarHasHydratedData,
  getShortsControlSurfaceStabilityMs,
  shortsNativeControlInventoryMatches,
} from "../common/shorts-control-readiness";

if (__RYD_LIVE_TEST_BUILD__) {
  document.documentElement.setAttribute("data-ryd-extension-version", getBrowser().runtime.getManifest().version);
  document.documentElement.setAttribute("data-ryd-extension-build", __RYD_LIVE_BUILD_ID__);
}

let jsInitChecktimer = null;
let isSetInitialStateDone = false;
let isStorageListenerRegistered = false;
let shortsNavigationObserver = null;
let shortsNavigationObserverTarget = null;
let initializedVideoId = null;
let initializedButtons = null;
let initializedLikeButton = null;
let initializedDislikeButton = null;
let initializedNativeLikeButton = null;
let initializedNativeDislikeButton = null;
let initializationCheckRunning = false;
let pendingShortsMutationSurface = null;
let shortsRouteEpoch = 0;
let observedRouteKey = null;
let privatePageActive = true;
const privateBrowsingContext = isPrivateBrowsingContext();
const firefoxDataConsent = usesFirefoxDataCollectionConsent();
const dataConsentPrompt = firefoxDataConsent && !privateBrowsingContext ? getDataConsentPrompt() : null;
dataConsentPrompt?.onPageOfferEnded(updateInitializationWatch);
let countsPermissionGranted = !firefoxDataConsent;
let countsPermissionEpoch = 0;
let contentReady = false;
let initializationWatchTimer = null;
const pendingNavigation = createPendingNavigationTracker();
const SHORTS_HYDRATION_ATTRIBUTE = "data-ryd-shorts-action-bar-hydrated";
const SHORTS_HYDRATION_REQUEST_EVENT = "ryd-shorts-action-bar-hydration-request";

function clearPrivateVoteState() {
  clearVoteDataRequestCache();
  Object.assign(storedData, { likes: 0, dislikes: 0, previousState: NEUTRAL_STATE, videoId: null });
}

if (privateBrowsingContext) {
  window.addEventListener("pagehide", () => {
    privatePageActive = false;
    clearPrivateVoteState();
    clearRenderedVoteState();
    initializedVideoId = null;
    isSetInitialStateDone = false;
    if (jsInitChecktimer !== null) {
      clearInterval(jsInitChecktimer);
      jsInitChecktimer = null;
    }
  });
  window.addEventListener("pageshow", () => {
    privatePageActive = true;
  });
}

function injectPageWorldHelpers() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = getBrowser().runtime.getURL("menu-fixer.js");
    script.onload = function () {
      this.remove();
      resolve(true);
    };
    script.onerror = function () {
      this.remove();
      console.warn("Page-world helpers failed to load; Shorts initialization will retry.");
      resolve(false);
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

function pageWorldActionBarHasHydratedData(actionBar) {
  if (!actionBar?.matches?.("reel-action-bar-view-model")) return actionBarHasHydratedData(actionBar);

  actionBar.removeAttribute(SHORTS_HYDRATION_ATTRIBUTE);
  actionBar.dispatchEvent(new Event(SHORTS_HYDRATION_REQUEST_EVENT, { bubbles: false }));
  const hydrated = actionBar.getAttribute(SHORTS_HYDRATION_ATTRIBUTE) === "true";
  actionBar.removeAttribute(SHORTS_HYDRATION_ATTRIBUTE);
  return hydrated;
}

function applyCountsPermission(granted) {
  countsPermissionEpoch += 1;
  countsPermissionGranted = granted;
  setCountPermissionAvailable(granted);
  dataConsentPrompt?.hidePageOffer();
  clearPrivateVoteState();
  clearRenderedVoteState(initializedButtons ? getButtonControls(initializedButtons) : undefined);
  initializedVideoId = null;
  isSetInitialStateDone = false;
  if (jsInitChecktimer !== null) {
    clearInterval(jsInitChecktimer);
    jsInitChecktimer = null;
  }
  if (granted) void ensureRemoteSelectors();
  if (!contentReady) return;
  updateInitializationWatch();
  void triggerInitializationCycle();
}

async function recheckCountsPermission() {
  if (!firefoxDataConsent || countsPermissionGranted) return;
  const epoch = countsPermissionEpoch;
  const granted = await hasFeaturePermission("counts");
  if (granted && epoch === countsPermissionEpoch && !countsPermissionGranted) applyCountsPermission(true);
}

function observeCountPermissions() {
  onDataPermissionsChanged(({ added, removed }) => {
    if (added.includes("browsingActivity") || removed.includes("browsingActivity")) {
      applyCountsPermission(!removed.includes("browsingActivity"));
      return;
    }
    if (![...added, ...removed].includes("websiteContent")) return;
    clearVoteDataRequestCache();
    storedData.videoId = null;
    initializedVideoId = null;
    isSetInitialStateDone = false;
    if (contentReady && countsPermissionGranted) void triggerInitializationCycle();
  });
}
observeCountPermissions();
if (firefoxDataConsent) {
  const epoch = countsPermissionEpoch;
  const [granted] = await Promise.all([hasFeaturePermission("counts"), dataConsentPrompt?.loadPageOfferDismissal()]);
  if (epoch === countsPermissionEpoch) countsPermissionGranted = granted;
  setCountPermissionAvailable(countsPermissionGranted);
}
const pageWorldHelpersReady = injectPageWorldHelpers();
// Listen before asynchronous initialization so settings changed in another tab
// are applied while the page is still loading.
if (!privateBrowsingContext) {
  getBrowser().storage.onChanged.addListener(storageChangeHandler);
  isStorageListenerRegistered = true;
}
await initExtConfig();
observeColorTheme();
await pageWorldHelpersReady;
if (!privateBrowsingContext) {
  initPatreonFeatures();
  initDiscussion();
}

function ensureShortsNavigationObserver() {
  if (!isShorts()) {
    return;
  }

  const shortsRoot = document.querySelector("ytd-shorts");
  if (!shortsRoot) {
    if (shortsNavigationObserverTarget && !shortsNavigationObserverTarget.isConnected) {
      shortsNavigationObserver?.disconnect();
      shortsNavigationObserverTarget = null;
    }
    return;
  }

  if (!shortsNavigationObserver) {
    shortsNavigationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const activatedRenderer =
          mutation.type === "attributes" &&
          mutation.attributeName === "is-active" &&
          mutation.target.tagName === "YTD-REEL-VIDEO-RENDERER" &&
          mutation.target.hasAttribute("is-active");
        const currentShortsLinkChanged =
          mutation.type === "attributes" &&
          mutation.attributeName === "href" &&
          mutation.target.matches?.("a[href*='/shorts/']") &&
          getShortsCandidateVideoId(getButtons()) === getVideoId(window.location.href);
        const nativeActionTreeChanged =
          mutation.type === "childList" &&
          [...mutation.addedNodes, ...mutation.removedNodes].some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node.matches?.("like-button-view-model, dislike-button-view-model, reel-action-bar-view-model") ||
                node.querySelector?.("like-button-view-model, dislike-button-view-model, reel-action-bar-view-model")),
          );
        if (activatedRenderer || currentShortsLinkChanged || nativeActionTreeChanged) {
          triggerInitializationCycle();
          break;
        }
      }
    });
  }

  if (shortsNavigationObserverTarget !== shortsRoot) {
    shortsNavigationObserver.disconnect();
    shortsNavigationObserver.observe(shortsRoot, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["href", "is-active"],
    });
    shortsNavigationObserverTarget = shortsRoot;
  }
}

function syncShortsRouteEpoch() {
  const videoId = getVideoId(window.location.href);
  const routeKey = `${isShorts() ? "shorts" : "other"}:${videoId ?? "none"}`;
  if (observedRouteKey !== routeKey) {
    cancelObsoleteVoteDataRequests(videoId);
    observedRouteKey = routeKey;
    shortsRouteEpoch += 1;
    pendingShortsMutationSurface = null;
  }
}

function getStableShortsControls(videoId, allowSyntheticDislike = true) {
  const buttons = getButtons();
  const isHydrated = pageWorldActionBarHasHydratedData(buttons);
  const needsSyntheticDislike =
    buttons?.tagName === "REEL-ACTION-BAR-VIEW-MODEL" &&
    (!buttons.querySelector("dislike-button-view-model, #dislike-button") ||
      buttons.querySelector("[data-ryd-synthetic-shorts-dislike]"));
  if (!needsSyntheticDislike && isHydrated) {
    pendingShortsMutationSurface = null;
    return buttons ? getButtonControls(buttons) : null;
  }
  const inventory = captureShortsNativeControlInventory(buttons);
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
    pendingShortsMutationSurface.routeEpoch !== shortsRouteEpoch ||
    pendingShortsMutationSurface.videoId !== videoId ||
    pendingShortsMutationSurface.signature !== signature ||
    !shortsNativeControlInventoryMatches(pendingShortsMutationSurface.inventory, inventory)
  ) {
    pendingShortsMutationSurface = {
      buttons,
      inventory,
      observedAt: now,
      routeEpoch: shortsRouteEpoch,
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
  const preMutationIsHydrated = pageWorldActionBarHasHydratedData(preMutationButtons);
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

  if (needsSyntheticDislike) {
    if (!allowSyntheticDislike) {
      const consentControls = getButtonControls(preMutationButtons);
      return {
        ...consentControls,
        ready: Boolean(consentControls.nativeLikeButton),
      };
    }
    ensureSyntheticShortsDislikeButton(preMutationButtons, {
      allowUnhydratedFallback: preMutationAllowsFallback,
      currentVideoId: videoId,
      isHydrated: preMutationIsHydrated,
      isStable: true,
    });
  }

  const confirmedButtons = getButtons();
  const confirmedInventory = captureShortsNativeControlInventory(confirmedButtons);
  const confirmedIsHydrated = pageWorldActionBarHasHydratedData(confirmedButtons);
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
  return getButtonControls(confirmedButtons);
}

async function checkForInitialization() {
  if (privateBrowsingContext && !privatePageActive) return;
  if (initializationCheckRunning) return;
  initializationCheckRunning = true;
  try {
    syncShortsRouteEpoch();
    if (isShorts()) {
      ensureShortsNavigationObserver();
    }

    const videoId = getVideoId(window.location.href);
    const pendingOrigin = pendingNavigation.get();
    if (pendingOrigin && (!pendingOrigin.videoId || pendingOrigin.videoId === videoId)) {
      dataConsentPrompt?.hidePageOffer();
      return;
    }
    const controls = isShorts() ? getStableShortsControls(videoId, countsPermissionGranted) : getButtonControls();
    if (!controls) {
      dataConsentPrompt?.hidePageOffer();
      return;
    }
    const { buttons, dislikeButton, likeButton, nativeDislikeButton, nativeLikeButton } = controls;
    const shortsRoute = isShorts();
    if (
      controls.ready &&
      reactionControlsCanInitialize({
        hasRenderedButtons: hasRenderedBox(buttons),
        isShortsRoute: shortsRoute,
        isVideoLoaded: !shortsRoute && isVideoLoaded(),
      })
    ) {
      if (!countsPermissionGranted) {
        dataConsentPrompt?.syncPageOffer(controls, videoId);
        return;
      }
      dataConsentPrompt?.hidePageOffer();
      if (!getDislikeTextContainer(controls)) return;
      createSmartimationObserver(buttons);
      addLikeDislikeEventListener(likeButton, dislikeButton);
      const initializationPermissionEpoch = countsPermissionEpoch;
      let rendered;
      if (hasLoadedStateForVideo(videoId)) {
        rendered = restoreCurrentState();
      } else {
        rendered = await setInitialState();
      }
      if (!countsPermissionGranted || initializationPermissionEpoch !== countsPermissionEpoch) {
        clearPrivateVoteState();
        clearRenderedVoteState();
        return;
      }
      if (rendered === false || (privateBrowsingContext && !privatePageActive)) return;
      const currentControls = getButtonControls();
      if (
        videoId !== getVideoId(window.location.href) ||
        !currentControls.ready ||
        !currentControls.dislikeTextContainer ||
        buttons !== currentControls.buttons ||
        likeButton !== currentControls.likeButton ||
        dislikeButton !== currentControls.dislikeButton ||
        nativeLikeButton !== currentControls.nativeLikeButton ||
        nativeDislikeButton !== currentControls.nativeDislikeButton
      ) {
        return;
      }
      setSyntheticShortsDislikeEnabled(true, currentControls.dislikeButton);
      markButtonsForVideo(buttons, videoId);
      initializedVideoId = videoId;
      initializedButtons = buttons;
      initializedLikeButton = likeButton;
      initializedDislikeButton = dislikeButton;
      initializedNativeLikeButton = nativeLikeButton;
      initializedNativeDislikeButton = nativeDislikeButton;
      pendingNavigation.clear();
      isSetInitialStateDone = true;
      if (jsInitChecktimer !== null) {
        clearInterval(jsInitChecktimer);
        jsInitChecktimer = null;
      }
      if (!privateBrowsingContext && !isStorageListenerRegistered) {
        getBrowser().storage.onChanged.addListener(storageChangeHandler);
        isStorageListenerRegistered = true;
      }
    } else if (!countsPermissionGranted) {
      dataConsentPrompt?.hidePageOffer();
    }
  } catch (exception) {
    if (privateBrowsingContext) {
      console.warn("Initialization failed; retrying when the current controls are ready.");
    } else {
      console.warn("Initialization failed; retrying when the current controls are ready.", exception);
    }
  } finally {
    initializationCheckRunning = false;
  }
}

const initializationCycle = createInitializationCycleRunner(async () => {
  isSetInitialStateDone = false;

  if (jsInitChecktimer !== null) {
    clearInterval(jsInitChecktimer);
    jsInitChecktimer = null;
  }

  await remoteSelectorsSettled();
  await checkForInitialization();

  if (!isSetInitialStateDone && countsPermissionGranted) {
    jsInitChecktimer = setInterval(() => {
      checkForInitialization();
    }, 111);

    setTimeout(() => {
      if (!isSetInitialStateDone) {
        checkForInitialization();
      }
    }, 2000);
  }
});

function triggerInitializationCycle() {
  if (privateBrowsingContext && !privatePageActive) return Promise.resolve();
  return initializationCycle.request();
}

async function setEventListeners() {
  await triggerInitializationCycle();
}

document.addEventListener("yt-navigate-start", function () {
  dataConsentPrompt?.hidePageOffer();
  clearVoteDataRequestCache();
  if (privateBrowsingContext) clearPrivateVoteState();
  shortsRouteEpoch += 1;
  pendingShortsMutationSurface = null;
  pendingNavigation.begin(() => {
    let controls;
    if (initializedButtons) {
      controls = {
        buttons: initializedButtons,
        dislikeButton: initializedDislikeButton,
        likeButton: initializedLikeButton,
        nativeDislikeButton: initializedNativeDislikeButton,
        nativeLikeButton: initializedNativeLikeButton,
      };
    } else {
      const currentControls = getButtonControls();
      controls = currentControls.ready ? currentControls : null;
    }
    return {
      controls,
      videoId: initializedVideoId ?? getVideoId(window.location.href),
    };
  });
  if (jsInitChecktimer !== null) {
    clearInterval(jsInitChecktimer);
    jsInitChecktimer = null;
  }

  clearRenderedVoteState(initializedButtons ? getButtonControls(initializedButtons) : undefined);
  initializedVideoId = null;
  initializedButtons = null;
  initializedLikeButton = null;
  initializedDislikeButton = null;
  initializedNativeLikeButton = null;
  initializedNativeDislikeButton = null;
  isSetInitialStateDone = false;
});

document.addEventListener("yt-navigate-finish", async function (event) {
  pendingNavigation.clear();
  syncShortsRouteEpoch();
  await recheckCountsPermission();
  await setEventListeners();
});

function watchControlsNeedInitialization() {
  const videoId = getVideoId(window.location.href);
  if (!videoId) return false;

  let controls;
  const pendingOrigin = pendingNavigation.get();
  if (pendingOrigin) {
    if (!pendingOrigin.videoId || videoId === pendingOrigin.videoId) return false;
    controls = getButtonControls();
    if (!controls.ready) {
      // getButtons() returns no surface when the visible Shorts candidates are
      // ambiguous or when YouTube has replaced the Shorts root before mounting
      // its action bar. Starting the cycle for a changed route is non-mutating;
      // getStableShortsControls() still owns every identity, hydration,
      // inventory, viewport, and stability guard.
      return pendingIncompleteShortsControlsCanInitialize({
        destinationVideoId: videoId,
        isShortsRoute: isShorts(),
        previousVideoId: pendingOrigin.videoId,
      });
    }
    const pendingControlsReady = pendingNavigationControlsAreReady({
      currentControls: controls,
      destinationVideoId: videoId,
      previousControls: pendingOrigin.controls,
      shortsControlsVideoId: isShorts() ? getShortsCandidateVideoId(controls.buttons) : null,
    });
    if (!pendingControlsReady) {
      return false;
    }
  }

  if (initializationCycle.isRunning() || jsInitChecktimer !== null) return false;
  controls ??= getButtonControls();
  if (!controls.ready) return true;
  const { buttons, dislikeButton, likeButton, nativeDislikeButton, nativeLikeButton } = controls;
  const syntheticShortsDislikes = isShorts()
    ? buttons?.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").length ?? 0
    : 0;
  const hasNativeShortsDislike = Boolean(
    isShorts() && buttons?.querySelector("dislike-button-view-model, #dislike-button"),
  );
  return (
    initializedVideoId !== videoId ||
    initializedButtons !== buttons ||
    initializedLikeButton !== likeButton ||
    initializedDislikeButton !== dislikeButton ||
    initializedNativeLikeButton !== nativeLikeButton ||
    initializedNativeDislikeButton !== nativeDislikeButton ||
    !buttons?.isConnected ||
    !likeButton?.isConnected ||
    !dislikeButton?.isConnected ||
    !nativeLikeButton?.isConnected ||
    !nativeDislikeButton?.isConnected ||
    !buttons?.contains(likeButton) ||
    !buttons?.contains(dislikeButton) ||
    !likeButton?.contains(nativeLikeButton) ||
    !dislikeButton?.contains(nativeDislikeButton) ||
    (isShorts() &&
      ((hasNativeShortsDislike && syntheticShortsDislikes > 0) ||
        (!hasNativeShortsDislike && syntheticShortsDislikes !== 1))) ||
    (!isShorts() && hasLoadedStateForVideo(videoId) && !isLikesDisabled() && !hasUsableRateBar(buttons, videoId))
  );
}

function watchInitialization() {
  if (privateBrowsingContext && !privatePageActive) return;
  syncShortsRouteEpoch();
  if (isShorts()) ensureShortsNavigationObserver();
  if (!countsPermissionGranted) {
    void checkForInitialization();
    return;
  }
  if (watchControlsNeedInitialization()) void triggerInitializationCycle();
}

function initializationWatchNeeded() {
  return countsPermissionGranted || (dataConsentPrompt !== null && dataConsentPrompt.canOfferOnPage());
}

function updateInitializationWatch() {
  if (!initializationWatchNeeded()) {
    if (initializationWatchTimer !== null) clearInterval(initializationWatchTimer);
    initializationWatchTimer = null;
    return;
  }
  initializationWatchTimer ??= setInterval(watchInitialization, 500);
}

updateInitializationWatch();
// Navigation must be observable even while the first count request is pending.
contentReady = true;
await setEventListeners();
