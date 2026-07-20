import { extConfig, isShorts } from "./runtime-state";
import { querySelector, querySelectorAll, isInViewport, getVideoId, getNumberFormatter } from "./dom";

const DEFAULT_SHORTS_LOADED_SELECTORS = {
  containers: [".reel-video-in-sequence-new"],
  thumbnail: [".reel-video-in-sequence-thumbnail"],
  renderer: ["ytd-reel-video-renderer"],
  overlay: ["#experiment-overlay"],
};

const DEFAULT_VIDEO_LOADED_SELECTORS = [
  "ytd-watch-grid[video-id='{videoId}']",
  "ytd-watch-flexy[video-id='{videoId}']",
  '#player[loading="false"]:not([hidden])',
];

function numberFormat(numberState) {
  return getNumberFormatter(extConfig.numberDisplayFormat).format(numberState);
}

function isShortsLoaded(videoId) {
  if (!videoId) return false;

  const selectors = extConfig.selectors.shortsLoaded ?? DEFAULT_SHORTS_LOADED_SELECTORS;

  // Find all reel containers
  const reelContainers = querySelectorAll(selectors.containers);

  for (const container of reelContainers) {
    // Check if this container's thumbnail matches our video ID
    const thumbnail = querySelector(selectors.thumbnail, container);
    if (thumbnail) {
      const bgImage = thumbnail.style.backgroundImage;
      // YouTube thumbnail URLs contain the video ID in the format: /vi/VIDEO_ID/
      if ((bgImage && bgImage.includes(`/${videoId}/`)) || (!bgImage && isInViewport(container))) {
        // Check if this container has the renderer with visible experiment-overlay
        const renderer = querySelector(selectors.renderer, container);
        if (renderer) {
          const experimentOverlay = querySelector(selectors.overlay, renderer);
          if (
            experimentOverlay &&
            !experimentOverlay.hidden &&
            window.getComputedStyle(experimentOverlay).display !== "none" &&
            experimentOverlay.hasChildNodes()
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function isVideoLoaded() {
  const videoId = getVideoId(window.location.href);

  // Check if this is a Shorts URL
  if (isShorts()) {
    return isShortsLoaded(videoId);
  }

  const videoLoadedSelectors = extConfig.selectors.videoLoaded ?? DEFAULT_VIDEO_LOADED_SELECTORS;

  // Regular video checks
  return querySelector(videoLoadedSelectors.map((selector) => selector.replace("{videoId}", videoId))) !== undefined;
}

const originalConsole = {
  log: console.log.bind(console),
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function initializeLogging() {
  if (extConfig.disableLogging) {
    console.log = () => {};
    console.debug = () => {};
  } else {
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
  }
}

function getColorFromTheme(voteIsLike) {
  let colorString;
  switch (extConfig.colorTheme) {
    case "accessible":
      if (voteIsLike === true) {
        colorString = "dodgerblue";
      } else {
        colorString = "gold";
      }
      break;
    case "neon":
      if (voteIsLike === true) {
        colorString = "aqua";
      } else {
        colorString = "magenta";
      }
      break;
    case "classic":
    default:
      if (voteIsLike === true) {
        colorString = "lime";
      } else {
        colorString = "red";
      }
  }
  return colorString;
}

export { numberFormat, isVideoLoaded, initializeLogging, getColorFromTheme };
export { querySelector, querySelectorAll, isInViewport, getVideoId, getNumberFormatter } from "./dom";
export { createObserver, getBrowser, localize } from "./dom";
