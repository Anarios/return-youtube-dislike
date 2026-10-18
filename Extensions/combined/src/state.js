import { logger } from "./logging";
import {
  getButtonControls,
  getLikeButton,
  getNativeButton,
  getDislikeButton,
  getButtons,
  getLikeTextContainer,
  getDislikeTextContainer,
  refreshDislikeTextTypography,
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
} from "./utils";
import { config, getApiEndpoint, DEV_API_URL, PROD_API_URL, isDevelopment } from "./config";
import { LIKED_STATE, DISLIKED_STATE, NEUTRAL_STATE } from "../../common/vote-transition";
import { createBrowserSyntheticDislikeStore } from "./vote-client-adapter";
import { requestVoteData } from "./vote-data-request";
import { fetchWithCoreConsent } from "./core-data-consent";
import { normalizeCustomColors } from "../../common/color-themes";
import { isPrivateBrowsingContext } from "./private-browsing";

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
  customColors: normalizeCustomColors(),
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

let syntheticDislikeStore = null;

function getSyntheticDislikeStore() {
  if (isPrivateBrowsingContext()) return null;
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
    logger.debug("Could not restore the synthetic Shorts Dislike state.", error?.message ?? error);
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
  const likeButton = getNativeButton(getLikeButton());
  if (isMobile()) {
    return likeButton.getAttribute("aria-label") === "true";
  }
  return (
    extConfig.selectors.activeButtonClasses.some((className) => getLikeButton().classList.contains(className)) ||
    likeButton?.getAttribute("aria-pressed") === "true"
  );
}

function isVideoDisliked() {
  const dislikeButton = getNativeButton(getDislikeButton());
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
const reformattedLikeText = new WeakMap();

function getLikeTextNode() {
  const container = getLikeTextContainer();
  if (!container) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let result = null;
  while (walker.nextNode()) {
    if (!walker.currentNode.data.trim()) continue;
    // Do not flatten animated counters or other multi-node native content.
    if (result) return null;
    result = walker.currentNode;
  }
  return result;
}

function setLikes(likesCount) {
  const textNode = getLikeTextNode();
  if (!textNode) return false;
  const previous = reformattedLikeText.get(textNode);
  const formattedText = String(likesCount);
  reformattedLikeText.set(textNode, {
    nativeText: previous && textNode.data === previous.formattedText ? previous.nativeText : textNode.data,
    formattedText,
  });
  // YouTube retains this node when updating its count. Replacing it with
  // innerText leaves subsequent native updates writing to a detached node.
  if (textNode.data !== formattedText) textNode.data = formattedText;
  return true;
}

function refreshReactionPresentation() {
  refreshDislikeTextTypography();
  const rateBar = getButtons()?.querySelector("#ryd-bar-container");
  if (rateBar) {
    const liked = String(isVideoLiked());
    if (rateBar.getAttribute("data-ryd-liked") !== liked) rateBar.setAttribute("data-ryd-liked", liked);
  }
  const nativeLikeCount = readNativeLikeCount();
  const nativeLikes = nativeLikeCount?.likes ?? false;
  if (nativeLikes > 0 && nativeLikeCount.videoId === storedData.videoId && !nativeLikeCount.presented) {
    nativeLikeCount.presented = true;
    if (storedData.likes !== nativeLikes) {
      storedData.likes = nativeLikes;
      createRateBar(storedData.likes, storedData.dislikes);
    }
  }
  if (extConfig.numberDisplayReformatLikes === true) {
    if (nativeLikes !== false) setLikes(numberFormat(nativeLikes));
  } else {
    const textNode = getLikeTextNode();
    const previous = textNode && reformattedLikeText.get(textNode);
    if (previous) {
      if (textNode.data === previous.formattedText) textNode.data = previous.nativeText;
      reformattedLikeText.delete(textNode);
    }
  }

  for (const [host, isLike] of [
    [getLikeButton(), true],
    [getDislikeButton(), false],
  ]) {
    if (!host) continue;
    const button = getNativeButton(host) || host;
    if (!button) continue;
    const colored = extConfig.coloredThumbs === true && (!isShorts() || button.getAttribute("aria-pressed") === "true");
    if (colored) {
      const color = getColorFromTheme(isLike);
      if (button.style.getPropertyValue("--ryd-thumb-color") !== color) {
        button.style.setProperty("--ryd-thumb-color", color);
      }
      if (!button.hasAttribute("data-ryd-thumb-color")) button.setAttribute("data-ryd-thumb-color", "");
    } else if (button.hasAttribute("data-ryd-thumb-color")) {
      button.removeAttribute("data-ryd-thumb-color");
      button.style.removeProperty("--ryd-thumb-color");
    }
  }
}

function setDislikes(dislikesCount) {
  if (!isPrivateBrowsingContext()) logger.log(`SET dislikes ${dislikesCount}`);

  const controls = getButtonControls();
  const _container = getDislikeTextContainer(controls);
  if (!_container) return false;
  _container?.removeAttribute("is-empty");

  let _dislikeText;
  if (!isLikesDisabled(controls)) {
    _dislikeText = dislikesCount;
  } else {
    logger.log("likes count disabled by creator");
    _dislikeText = localize("TextLikesDisabled");
  }

  // Compare raw text so CSS text transforms cannot retrigger the mutation observer indefinitely.
  if (_dislikeText != null && _container.textContent !== String(_dislikeText)) {
    _container.textContent = _dislikeText;
  }
  return true;
}

const nativeLikeCounts = new WeakMap();

function readNativeLikeCount() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return null;
    }

    const likeButton = querySelector(extConfig.selectors.likeCountButton, getLikeButton());
    const nativeLabel = likeButton.getAttribute("aria-label");
    const videoId = getVideoId(window.location.href);
    const previous = nativeLikeCounts.get(likeButton);
    // A reused button can retain the outgoing video's count after navigation.
    // Trust it again only after YouTube changes the label or replaces the node.
    if (previous && previous.videoId !== videoId && previous.nativeLabel === nativeLabel) return null;
    if (previous?.videoId === videoId && previous.nativeLabel === nativeLabel) return previous;

    const likesStr = nativeLabel?.replace(/\D/g, "") ?? "";
    const current = {
      likes: likesStr.length > 0 ? parseInt(likesStr) : false,
      nativeLabel,
      presented: false,
      videoId,
    };
    nativeLikeCounts.set(likeButton, current);
    return current;
  } catch {
    return null;
  }
}

function getLikeCountFromButton() {
  return readNativeLikeCount()?.likes ?? false;
}

function processResponse(response, storedData) {
  const formattedDislike = numberFormat(response.dislikes);
  if (!setDislikes(formattedDislike)) return false;
  // Prefer YouTube's positive count, including updates made while the request was pending.
  const nativeLikeCount = readNativeLikeCount();
  if (nativeLikeCount?.likes > 0) {
    storedData.likes = nativeLikeCount.likes;
    nativeLikeCount.presented = true;
  }
  refreshReactionPresentation();
  createRateBar(storedData.likes, storedData.dislikes);

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
  if (isSyntheticShortsDislike(dislikeButton) && !isPrivateBrowsingContext()) {
    const storedDisliked = await readSyntheticShortsDislikeState(videoId);
    if (getVideoId(window.location.href) !== videoId) return;
    const liked = isVideoLiked();
    setSyntheticShortsDislikePressed(!liked && storedDisliked, dislikeButton);
    storedData.previousState = liked ? LIKED_STATE : storedDisliked ? DISLIKED_STATE : NEUTRAL_STATE;
    if (liked && storedDisliked) void persistSyntheticShortsDislikeState(videoId, false);
  } else {
    storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
  }
  logger.log("Video is loaded. Adding buttons...");

  const likeCount = getLikeCountFromButton() || null;
  let response;
  try {
    response = await requestVoteData(videoId, { likeCount });
  } catch (error) {
    if (error?.name === "AbortError") return false;
    displayError(error, videoId);
    return;
  }
  if (!isPrivateBrowsingContext()) {
    logger.log("response from api:");
    logger.log(JSON.stringify(response));
  }
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
  const nativeLikeCount = readNativeLikeCount();
  if (nativeLikeCount?.likes > 0) {
    storedData.likes = nativeLikeCount.likes;
    nativeLikeCount.presented = true;
  }
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
  if (isPrivateBrowsingContext()) {
    await initializePrivateDisplayPreferences();
    await initializeSelectors();
    return;
  }
  initializeDisableVoteSubmission();
  initializeDisableLogging();
  initializeColoredThumbs();
  initializeColoredBar();
  await initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
  initializeNumberDisplayReformatLikes();
  initializeHidePremiumTeaser();
  await initializeHideClutterButtons();
  await initializeSelectors();
}

function initializePrivateDisplayPreferences() {
  const preferences = [
    "coloredThumbs",
    "coloredBar",
    "colorTheme",
    "customColors",
    "numberDisplayFormat",
    "showTooltipPercentage",
    "tooltipPercentageMode",
    "numberDisplayReformatLikes",
    HIDE_CLUTTER_BUTTONS_STORAGE_KEY,
  ];
  extConfig.disableLogging = true;
  initializeLogging();
  extConfig.hidePremiumTeaser = true;
  return new Promise((resolve) => {
    getBrowser().storage.sync.get(preferences, (values = {}) => {
      for (const key of preferences) {
        if (values[key] !== undefined) extConfig[key] = values[key];
      }
      extConfig.colorTheme = values.colorTheme || "classic";
      extConfig.customColors = normalizeCustomColors(values.customColors);
      extConfig.hideClutterButtons = publishHideClutterButtons(values[HIDE_CLUTTER_BUTTONS_STORAGE_KEY]);
      resolve();
    });
  });
}

async function initializeSelectors() {
  const controller = new AbortController();
  const privateContext = isPrivateBrowsingContext();
  const abortOnPageHide = () => controller.abort();
  if (privateContext) window.addEventListener("pagehide", abortOnPageHide, { once: true });
  const timeout = setTimeout(() => controller.abort(), SELECTOR_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchWithCoreConsent(getApiEndpoint("/configs/selectors"), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      ...(privateContext ? { credentials: "omit", cache: "no-store" } : {}),
    });
    if (!response.ok) {
      throw new Error(`Selector request failed with HTTP ${response.status}`);
    }
    const result = await response.json();
    if (privateContext && controller.signal.aborted) return false;
    extConfig.selectors = mergeConfig(DEFAULT_SELECTORS, result);
    if (!isPrivateBrowsingContext()) logger.log(result);
    return true;
  } catch (error) {
    extConfig.selectors = cloneConfig(DEFAULT_SELECTORS);
    logger.debug("Remote selectors unavailable; using bundled selectors.", error?.name ?? error);
    return false;
  } finally {
    clearTimeout(timeout);
    if (privateContext) window.removeEventListener("pagehide", abortOnPageHide);
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

let loggingPreferenceRevision = 0;

function updateDisableLogging(value) {
  loggingPreferenceRevision += 1;
  extConfig.disableLogging = value ?? true;
  initializeLogging();
}

function initializeDisableLogging() {
  const revision = loggingPreferenceRevision;
  getBrowser().storage.sync.get(["disableLogging"], (res) => {
    if (revision !== loggingPreferenceRevision) return;
    if (res.disableLogging === undefined) {
      getBrowser().storage.sync.set({ disableLogging: true });
    }
    updateDisableLogging(res.disableLogging);
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
  return new Promise((resolve) => {
    const storage = getBrowser().storage;
    const changedPreferences = {};
    const captureChanges = (changes, area) => {
      if (area !== "sync") return;
      for (const key of ["colorTheme", "customColors"]) {
        if (changes[key]) changedPreferences[key] = changes[key].newValue;
      }
    };
    storage.onChanged.addListener(captureChanges);
    storage.sync.get(["colorTheme", "customColors"], (res = {}) => {
      storage.onChanged.removeListener(captureChanges);
      const preferences = { ...res, ...changedPreferences };
      extConfig.colorTheme = preferences.colorTheme || "classic";
      extConfig.customColors = normalizeCustomColors(preferences.customColors);
      resolve();
    });
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
      if (storedValue === undefined && !isPrivateBrowsingContext()) {
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
  refreshReactionPresentation,
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
  updateDisableLogging,
};
