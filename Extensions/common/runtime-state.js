import { querySelector } from "./dom";

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

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
  selectors: cloneConfig(DEFAULT_SELECTORS),
};

let storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
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

export {
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  DEFAULT_SELECTORS,
  mergeConfig,
  extConfig,
  storedData,
  isMobile,
  isShorts,
  isNewDesign,
  isRoundedDesign,
};
