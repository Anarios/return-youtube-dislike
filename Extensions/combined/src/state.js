import {
  getButtonControls,
  getLikeButton,
  getDislikeButton,
  getButtons,
  getLikeTextContainer,
  getDislikeTextContainer,
  isSyntheticShortsDislike,
  setSyntheticShortsDislikeEnabled,
  setSyntheticShortsDislikePressed,
} from "./buttons";
import {
  HIDE_CLUTTER_BUTTONS_STORAGE_KEY,
  normalizeHideClutterButtons,
  publishHideClutterButtons,
} from "./clutter-button-setting";
import { createRateBar } from "./bar";
import {
  getBrowser,
  getVideoId,
  initializeLogging,
  numberFormat,
  getColorFromTheme,
  querySelector,
  localize,
  createObserver,
} from "./utils";
import { config, getApiEndpoint, DEV_API_URL, PROD_API_URL, isDevelopment } from "./config";
import { LIKED_STATE, DISLIKED_STATE, NEUTRAL_STATE } from "../../common/vote-transition";
import { createBrowserSyntheticDislikeStore } from "./vote-client-adapter";
import { requestVoteData } from "./vote-data-request";

const DEFAULT_SELECTORS = {
  dislikeTextContainer: [
    ".yt-spec-button-shape-next__button-text-content",
    ".ytSpecButtonShapeNextButtonTextContent",
    "#text",
    "yt-formatted-string",
    "span[role='text']",
  ],
  likeTextContainer: [
    ".yt-spec-button-shape-next__button-text-content",
    ".ytSpecButtonShapeNextButtonTextContent",
    "#text",
    "yt-formatted-string",
    "span[role='text']",
  ],
  likeTextContainerTemplate: [
    ".yt-spec-button-shape-next__button-text-content",
    ".ytSpecButtonShapeNextButtonTextContent",
    "button > div[class*='cbox']",
  ],
  likeTextContainerTemplateParent: [
    'div > span[role="text"]',
    'button > div.yt-spec-button-shape-next__button-text-content > span[role="text"]',
  ],
  textContainerInner: ["span[role='text']"],
  buttons: {
    shorts: {
      mobile: ["ytm-like-button-renderer"],
      desktop: ["reel-action-bar-view-model", "#like-button > ytd-like-button-renderer"],
    },
    regular: {
      mobile: [".slim-video-action-bar-actions"],
      desktopMenu: ["ytd-menu-renderer.ytd-watch-metadata > div"],
      desktopNoMenu: ["#top-level-buttons-computed"],
    },
    segmentedContainer: ["ytd-segmented-like-dislike-button-renderer"],
    nativeButton: ["button"],
    mobileText: [".button-renderer-text"],
    shortsToggleButton: ["tp-yt-paper-button#button"],
    smartimation: ["yt-smartimation"],
    likeButton: {
      segmented: ["#segmented-like-button"],
      segmentedGetButtons: [":first-child > :first-child"],
      notSegmented: ["like-button-view-model", ":first-child"],
    },
    dislikeButton: {
      segmented: ["#segmented-dislike-button"],
      segmentedGetButtons: [":first-child > :nth-child(2)"],
      notSegmented: ["dislike-button-view-model", ":nth-child(2)", "#dislike-button"],
      shortsFallback: ["#dislike-button"],
    },
  },
  buttonClasses: {
    iconButton: ["yt-spec-button-shape-next--icon-button", "ytSpecButtonShapeNextIconButton"],
    iconLeading: ["yt-spec-button-shape-next--icon-leading", "ytSpecButtonShapeNextIconLeading"],
  },
  activeButtonClasses: ["style-default-active"],
  likeCountButton: ["yt-formatted-string#text", "button"],
  videoLoaded: [
    "ytd-watch-grid[video-id='{videoId}']",
    "ytd-watch-flexy[video-id='{videoId}']",
    '#player[loading="false"]:not([hidden])',
  ],
  shortsLoaded: {
    containers: [".reel-video-in-sequence-new"],
    thumbnail: [".reel-video-in-sequence-thumbnail"],
    renderer: ["ytd-reel-video-renderer"],
    overlay: ["#experiment-overlay"],
  },
  rateBar: {
    newDesignActions: ["#top-level-buttons-computed"],
    oldDesignActions: ["#menu-container"],
    mobileActionBar: ["ytm-slim-video-action-bar-renderer"],
    topRow: ["#top-row"],
    actionsInner: ["#actions-inner"],
    actions: ["#actions"],
  },
  signInButton: ["a[href^='https://accounts.google.com/ServiceLogin']"],
  menuContainer: ["#menu-container"],
  roundedDesign: ["#segmented-like-button", "like-button-view-model"],
};
const SELECTOR_REQUEST_TIMEOUT_MS = 1500;

function cloneConfig(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(defaultValue, apiValue) {
  if (apiValue === undefined || apiValue === null) {
    return cloneConfig(defaultValue);
  }

  if (Array.isArray(apiValue)) {
    return [...apiValue];
  }

  if (typeof apiValue !== "object" || Array.isArray(defaultValue)) {
    return apiValue;
  }

  const merged = cloneConfig(defaultValue ?? {});
  for (const [key, value] of Object.entries(apiValue)) {
    merged[key] = mergeConfig(defaultValue?.[key], value);
  }
  return merged;
}

let extConfig = {
  disableVoteSubmission: false,
  disableLogging: false,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic",
  numberDisplayFormat: "compactShort",
  showTooltipPercentage: false,
  tooltipPercentageMode: "dash_like",
  numberDisplayReformatLikes: false,
  hidePremiumTeaser: false,
  hideClutterButtons: false,
  selectors: cloneConfig(DEFAULT_SELECTORS),
};

let storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
  videoId: null,
};

function isMobile() {
  return location.hostname == "m.youtube.com";
}

function isShorts() {
  return location.pathname.startsWith("/shorts");
}

function isNewDesign() {
  return document.getElementById("comment-teaser") !== null;
}

function isRoundedDesign() {
  return querySelector(extConfig.selectors.roundedDesign) !== null;
}

let shortsObserver = null;
let syntheticDislikeStore = null;

function getShortsObserver() {
  if (shortsObserver) return shortsObserver;
  console.log("Initializing shorts mutation observer");
  shortsObserver = createObserver(
    {
      attributes: true,
    },
    (mutationList) => {
      mutationList.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target.matches?.("button, tp-yt-paper-button#button")) {
          if (mutation.target.getAttribute("aria-pressed") === "true") {
            const isLike = mutation.target.closest("like-button-view-model, #like-button") !== null;
            mutation.target.style.color = getColorFromTheme(isLike);
          } else {
            mutation.target.style.color = "unset";
          }
        }
      });
    },
  );
  return shortsObserver;
}

function getSyntheticDislikeStore() {
  if (syntheticDislikeStore) return syntheticDislikeStore;
  const browserApi = getBrowser();
  if (!browserApi?.storage?.local) return null;
  syntheticDislikeStore = createBrowserSyntheticDislikeStore(
    browserApi.storage.local,
    () => browserApi.runtime?.lastError,
  );
  return syntheticDislikeStore;
}

async function readSyntheticShortsDislikeState(videoId) {
  const store = getSyntheticDislikeStore();
  if (!store) return false;
  try {
    return await store.isDisliked(videoId);
  } catch (error) {
    console.debug("Could not restore the synthetic Shorts Dislike state.", error?.message ?? error);
    return false;
  }
}

async function persistSyntheticShortsDislikeState(videoId, disliked) {
  const store = getSyntheticDislikeStore();
  if (!store) return;
  await store.setDisliked(videoId, disliked);
}

function isLikesDisabled(controls = getButtonControls()) {
  // return true if the like button's text doesn't contain any number
  if (isMobile()) {
    const mobileLikeText = querySelector(extConfig.selectors.buttons.mobileText, controls.likeButton);
    return mobileLikeText ? /^\D*$/.test(mobileLikeText.innerText) : true;
  }
  const likeTextContainer = getLikeTextContainer(controls.likeButton);
  return likeTextContainer ? /^\D*$/.test(likeTextContainer.innerText) : true;
}

function isVideoLiked() {
  const likeButton = querySelector(extConfig.selectors.buttons.nativeButton, getLikeButton());
  if (isMobile()) {
    return likeButton.getAttribute("aria-label") === "true";
  }
  return (
    extConfig.selectors.activeButtonClasses.some((className) => getLikeButton().classList.contains(className)) ||
    likeButton?.getAttribute("aria-pressed") === "true"
  );
}

function isVideoDisliked() {
  const dislikeButton = querySelector(extConfig.selectors.buttons.nativeButton, getDislikeButton());
  if (isMobile()) {
    return dislikeButton.getAttribute("aria-label") === "true";
  }
  return (
    extConfig.selectors.activeButtonClasses.some((className) => getDislikeButton().classList.contains(className)) ||
    dislikeButton?.getAttribute("aria-pressed") === "true"
  );
}

function getState(storedData) {
  if (isVideoLiked()) {
    return { current: LIKED_STATE, previous: storedData.previousState };
  }
  if (isVideoDisliked()) {
    return { current: DISLIKED_STATE, previous: storedData.previousState };
  }
  return { current: NEUTRAL_STATE, previous: storedData.previousState };
}

//---   Sets The Likes And Dislikes Values   ---//
function setLikes(likesCount) {
  console.log(`SET likes ${likesCount}`);
  const likeTextContainer = getLikeTextContainer();
  if (!likeTextContainer) return false;
  likeTextContainer.innerText = likesCount;
  return true;
}

function setDislikes(dislikesCount) {
  console.log(`SET dislikes ${dislikesCount}`);

  const controls = getButtonControls();
  const _container = getDislikeTextContainer(controls);
  if (!_container) return false;
  _container?.removeAttribute("is-empty");

  let _dislikeText;
  if (!isLikesDisabled(controls)) {
    _dislikeText = dislikesCount;
  } else {
    console.log("likes count disabled by creator");
    _dislikeText = localize("TextLikesDisabled");
  }

  if (_dislikeText != null && _container?.innerText !== _dislikeText) {
    _container.innerText = _dislikeText;
  }
  return true;
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }

    let likeButton = querySelector(extConfig.selectors.likeCountButton, getLikeButton());

    let likesStr = likeButton.getAttribute("aria-label").replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
  } catch {
    return false;
  }
}

function processResponse(response, storedData) {
  const formattedDislike = numberFormat(response.dislikes);
  if (!setDislikes(formattedDislike)) return false;
  if (extConfig.numberDisplayReformatLikes === true) {
    const nativeLikes = getLikeCountFromButton();
    if (nativeLikes !== false) {
      setLikes(numberFormat(nativeLikes));
    }
  }
  createRateBar(storedData.likes, storedData.dislikes);
  if (extConfig.coloredThumbs === true) {
    if (isShorts()) {
      // for shorts, leave deactivated buttons in default color
      const shortLikeButton =
        querySelector(extConfig.selectors.buttons.shortsToggleButton, getLikeButton()) ??
        getLikeButton()?.querySelector("button");
      const shortDislikeButton =
        querySelector(extConfig.selectors.buttons.shortsToggleButton, getDislikeButton()) ??
        getDislikeButton()?.querySelector("button");
      if (shortLikeButton?.getAttribute("aria-pressed") === "true") {
        shortLikeButton.style.color = getColorFromTheme(true);
      }
      if (shortDislikeButton?.getAttribute("aria-pressed") === "true") {
        shortDislikeButton.style.color = getColorFromTheme(false);
      }
      const observer = getShortsObserver();
      if (shortLikeButton) observer.observe(shortLikeButton);
      if (shortDislikeButton) observer.observe(shortDislikeButton);
    } else {
      getLikeButton().style.color = getColorFromTheme(true);
      getDislikeButton().style.color = getColorFromTheme(false);
    }
  }

  //Temporary disabling this - it breaks all places where getButtons()[1] is used
  // createStarRating(response.rating, isMobile());
  return true;
}

// Tells the user if the API is down
function displayError(error, videoId = getVideoId(window.location.href)) {
  if (getVideoId(window.location.href) !== videoId) {
    return;
  }
  const dislikeTextContainer = getDislikeTextContainer();
  if (!dislikeTextContainer) return false;
  dislikeTextContainer.innerText = localize("textTempUnavailable");
  return true;
}

async function setState(storedData) {
  if (typeof window !== "undefined") {
    window.__rydSetStateCalls = (window.__rydSetStateCalls || 0) + 1;
  }
  const videoId = getVideoId(window.location.href);
  const dislikeButton = getDislikeButton();
  if (isSyntheticShortsDislike(dislikeButton)) {
    const storedDisliked = await readSyntheticShortsDislikeState(videoId);
    if (getVideoId(window.location.href) !== videoId) return;
    const liked = isVideoLiked();
    setSyntheticShortsDislikePressed(!liked && storedDisliked, dislikeButton);
    storedData.previousState = liked ? LIKED_STATE : storedDisliked ? DISLIKED_STATE : NEUTRAL_STATE;
    if (liked && storedDisliked) void persistSyntheticShortsDislikeState(videoId, false);
  } else {
    storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
  }
  console.log("Video is loaded. Adding buttons...");

  const likeCount = getLikeCountFromButton() || null;
  let response;
  try {
    response = await requestVoteData(videoId, { likeCount });
  } catch (error) {
    if (error?.name === "AbortError") return false;
    displayError(error, videoId);
    return;
  }
  console.log("response from api:");
  console.log(JSON.stringify(response));
  if (getVideoId(window.location.href) !== videoId) {
    return;
  }
  if (!response || typeof response !== "object" || "traceId" in response) {
    displayError(response, videoId);
    return;
  }
  // Native reactions can change while counts load, before vote handling is
  // enabled. Use their current state as the next activation's starting point.
  const currentControls = getButtonControls();
  if (currentControls.ready) {
    const liked = isVideoLiked();
    if (isSyntheticShortsDislike(currentControls.dislikeButton)) {
      const disliked = storedData.previousState === DISLIKED_STATE;
      setSyntheticShortsDislikePressed(!liked && disliked, currentControls.dislikeButton);
      storedData.previousState = liked ? LIKED_STATE : disliked ? DISLIKED_STATE : NEUTRAL_STATE;
      if (liked && disliked) void persistSyntheticShortsDislikeState(videoId, false);
    } else {
      storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : liked ? LIKED_STATE : NEUTRAL_STATE;
    }
  }
  // Keep a valid destination response even if YouTube replaces its controls
  // while the request is in flight. The next initialization attempt can then
  // render the cached state into the hydrated controls without refetching.
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = parseInt(response.likes);
  storedData.videoId = videoId;
  return processResponse(response, storedData);
}

async function setInitialState() {
  return setState(storedData);
}

function hasLoadedStateForVideo(videoId) {
  return storedData.videoId === videoId;
}

function restoreCurrentState() {
  const dislikeButton = getDislikeButton();
  if (isSyntheticShortsDislike(dislikeButton)) {
    setSyntheticShortsDislikePressed(storedData.previousState === DISLIKED_STATE, dislikeButton);
  } else {
    storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
  }
  if (!setDislikes(numberFormat(storedData.dislikes))) return false;
  createRateBar(storedData.likes, storedData.dislikes);
  return true;
}

function clearRenderedVoteState(controls = getButtonControls()) {
  if (!controls) return;

  if (controls.dislikeTextContainer) {
    controls.dislikeTextContainer.innerText = "";
  }
  if (isSyntheticShortsDislike(controls.dislikeButton)) {
    setSyntheticShortsDislikeEnabled(false, controls.dislikeButton);
    setSyntheticShortsDislikePressed(false, controls.dislikeButton);
  }

  for (const wrapper of controls.buttons?.querySelectorAll?.(".ryd-tooltip") ?? []) {
    wrapper.remove();
  }
}

async function initExtConfig() {
  initializeDisableVoteSubmission();
  initializeDisableLogging();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
  initializeNumberDisplayReformatLikes();
  initializeHidePremiumTeaser();
  await initializeHideClutterButtons();
  await initializeSelectors();
}

async function initializeSelectors() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SELECTOR_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(getApiEndpoint("/configs/selectors"), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Selector request failed with HTTP ${response.status}`);
    }
    const result = await response.json();
    extConfig.selectors = mergeConfig(DEFAULT_SELECTORS, result);
    console.log(result);
    return true;
  } catch (error) {
    extConfig.selectors = cloneConfig(DEFAULT_SELECTORS);
    console.debug("Remote selectors unavailable; using bundled selectors.", error?.name ?? error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function initializeDisableVoteSubmission() {
  getBrowser().storage.sync.get(["disableVoteSubmission"], (res) => {
    if (res.disableVoteSubmission === undefined) {
      getBrowser().storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}

function initializeDisableLogging() {
  getBrowser().storage.sync.get(["disableLogging"], (res) => {
    if (res.disableLogging === undefined) {
      getBrowser().storage.sync.set({ disableLogging: true });
      extConfig.disableLogging = true;
    } else {
      extConfig.disableLogging = res.disableLogging;
    }
    // Initialize console methods based on logging config
    initializeLogging();
  });
}

function initializeColoredThumbs() {
  getBrowser().storage.sync.get(["coloredThumbs"], (res) => {
    if (res.coloredThumbs === undefined) {
      getBrowser().storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeColoredBar() {
  getBrowser().storage.sync.get(["coloredBar"], (res) => {
    if (res.coloredBar === undefined) {
      getBrowser().storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  getBrowser().storage.sync.get(["colorTheme"], (res) => {
    if (res.colorTheme === undefined) {
      getBrowser().storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  getBrowser().storage.sync.get(["numberDisplayFormat"], (res) => {
    if (res.numberDisplayFormat === undefined) {
      getBrowser().storage.sync.set({ numberDisplayFormat: "compactShort" });
    } else {
      extConfig.numberDisplayFormat = res.numberDisplayFormat;
    }
  });
}

function initializeTooltipPercentage() {
  getBrowser().storage.sync.get(["showTooltipPercentage"], (res) => {
    if (res.showTooltipPercentage === undefined) {
      getBrowser().storage.sync.set({ showTooltipPercentage: false });
    } else {
      extConfig.showTooltipPercentage = res.showTooltipPercentage;
    }
  });
}

function initializeTooltipPercentageMode() {
  getBrowser().storage.sync.get(["tooltipPercentageMode"], (res) => {
    if (res.tooltipPercentageMode === undefined) {
      getBrowser().storage.sync.set({ tooltipPercentageMode: "dash_like" });
    } else {
      extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
    }
  });
}

function initializeNumberDisplayReformatLikes() {
  getBrowser().storage.sync.get(["numberDisplayReformatLikes"], (res) => {
    if (res.numberDisplayReformatLikes === undefined) {
      getBrowser().storage.sync.set({ numberDisplayReformatLikes: false });
    } else {
      extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
    }
  });
}

function initializeHidePremiumTeaser() {
  getBrowser().storage.sync.get(["hidePremiumTeaser"], (res) => {
    if (res.hidePremiumTeaser === undefined) {
      getBrowser().storage.sync.set({ hidePremiumTeaser: false });
      extConfig.hidePremiumTeaser = false;
    } else {
      extConfig.hidePremiumTeaser = res.hidePremiumTeaser === true;
    }
  });
}

function initializeHideClutterButtons() {
  const storage = getBrowser()?.storage?.sync;
  if (!storage) {
    extConfig.hideClutterButtons = publishHideClutterButtons(false);
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    storage.get([HIDE_CLUTTER_BUTTONS_STORAGE_KEY], (res = {}) => {
      const storedValue = res[HIDE_CLUTTER_BUTTONS_STORAGE_KEY];
      const normalized = normalizeHideClutterButtons(storedValue);
      extConfig.hideClutterButtons = publishHideClutterButtons(normalized);
      if (storedValue === undefined) {
        storage.set({ [HIDE_CLUTTER_BUTTONS_STORAGE_KEY]: false });
      }
      resolve(normalized);
    });
  });
}

export {
  isMobile,
  isShorts,
  isVideoDisliked,
  isVideoLiked,
  isNewDesign,
  isRoundedDesign,
  getState,
  setState,
  setInitialState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  extConfig,
  initExtConfig,
  initializeSelectors,
  storedData,
  isLikesDisabled,
  hasLoadedStateForVideo,
  restoreCurrentState,
  clearRenderedVoteState,
  persistSyntheticShortsDislikeState,
  initializeHideClutterButtons,
};
