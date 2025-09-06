import { extConfig, isShorts } from "./state";

function numberFormat(numberState) {
  return getNumberFormatter(extConfig.numberDisplayFormat).format(numberState);
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
      console.log("Cannot find browser locale. Use en as default for number formatting.");
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

  return Intl.NumberFormat(userLocales, {
    notation: formatterNotation,
    compactDisplay: formatterCompactDisplay,
  });
}

function localize(localeString) {
  return chrome.i18n.getMessage(localeString);
}

function getBrowser() {
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
    return chrome;
  } else if (typeof browser !== "undefined" && typeof browser.runtime !== "undefined") {
    return browser;
  } else {
    console.log("browser is not supported");
    return false;
  }
}

function getVideoId(url) {
  const urlObject = new URL(url);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return (document.querySelector("meta[itemprop='videoId']") || document.querySelector("meta[itemprop='identifier']"))
      .content;
  } else {
    if (pathname.startsWith("/shorts")) {
      return pathname.slice(8);
    }
    return urlObject.searchParams.get("v");
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

function isShortsLoaded(videoId) {
  if (!videoId) return false;

  // Find all reel containers
  const reelContainers = document.querySelectorAll(".reel-video-in-sequence-new");

  for (const container of reelContainers) {
    // Check if this container's thumbnail matches our video ID
    const thumbnail = container.querySelector(".reel-video-in-sequence-thumbnail");
    if (thumbnail) {
      const bgImage = thumbnail.style.backgroundImage;
      // YouTube thumbnail URLs contain the video ID in the format: /vi/VIDEO_ID/
      if ((bgImage && bgImage.includes(`/${videoId}/`)) || (!bgImage && isInViewport(container))) {
        // Check if this container has the renderer with visible experiment-overlay
        const renderer = container.querySelector("ytd-reel-video-renderer");
        if (renderer) {
          const experimentOverlay = renderer.querySelector("#experiment-overlay");
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

  // Regular video checks
  return (
    // desktop: spring 2024 UI
    document.querySelector(`ytd-watch-grid[video-id='${videoId}']`) !== null ||
    // desktop: older UI
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null ||
    // mobile: no video-id attribute
    document.querySelector('#player[loading="false"]:not([hidden])') !== null
  );
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

function querySelector(selectors, element) {
  let result;
  for (const selector of selectors) {
    result = (element ?? document).querySelector(selector);
    if (result !== null) {
      return result;
    }
  }
}

function querySelectorAll(selectors) {
  let result;
  for (const selector of selectors) {
    result = document.querySelectorAll(selector);
    if (result.length !== 0) {
      return result;
    }
  }
  return result;
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
  return observerWrapper;
}

export {
  numberFormat,
  getNumberFormatter,
  getBrowser,
  getVideoId,
  isInViewport,
  isVideoLoaded,
  initializeLogging,
  getColorFromTheme,
  localize,
  querySelector,
  querySelectorAll,
  createObserver,
};
