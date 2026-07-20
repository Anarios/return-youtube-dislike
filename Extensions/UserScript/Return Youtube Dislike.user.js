// ==UserScript==
// @name         Return YouTube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @homepage     https://www.returnyoutubedislike.com/
// @version      3.1.5
// @encoding     utf-8
// @description  Return of the YouTube Dislike, Based off https://www.returnyoutubedislike.com/
// @icon         https://github.com/Anarios/return-youtube-dislike/raw/main/Icons/Return%20Youtube%20Dislike%20-%20Transparent.png
// @author       Anarios & JRWR
// @match        *://*.youtube.com/*
// @exclude      *://music.youtube.com/*
// @exclude      *://*.music.youtube.com/*
// @compatible   chrome
// @compatible   firefox
// @compatible   opera
// @compatible   safari
// @compatible   edge
// @downloadURL  https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @updateURL    https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @grant        GM.xmlHttpRequest
// @connect      youtube.com
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 503:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  k: () => (/* binding */ bar_userscript_createRateBar)
});

// EXTERNAL MODULE: ./Extensions/common/buttons.js
var buttons = __webpack_require__(525);
// EXTERNAL MODULE: ./Extensions/common/state.js + 1 modules
var state = __webpack_require__(284);
// EXTERNAL MODULE: ./Extensions/UserScript/src/utils.userscript.js + 1 modules
var utils_userscript = __webpack_require__(278);
;// CONCATENATED MODULE: ./Extensions/common/bar.js




function createRateBar(likes, dislikes) {
  let rateBar = document.getElementById("ryd-bar-container");
  if (!(0,state/* isLikesDisabled */.$L)()) {
    // sometimes rate bar is hidden
    if (rateBar && !(0,utils_userscript/* isInViewport */.v4)(rateBar)) {
      rateBar.remove();
      rateBar = null;
    }

    const widthPx =
      parseFloat(window.getComputedStyle((0,buttons/* getLikeButton */.yN)()).width) +
      parseFloat(window.getComputedStyle((0,buttons/* getDislikeButton */.x8)()).width) +
      ((0,state/* isRoundedDesign */.MB)() ? 0 : 8);

    const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    var likePercentage = parseFloat(widthPercent.toFixed(1));
    const dislikePercentage = (100 - likePercentage).toLocaleString();
    likePercentage = likePercentage.toLocaleString();

    if (state/* extConfig */.zO.showTooltipPercentage) {
      var tooltipInnerHTML;
      switch (state/* extConfig */.zO.tooltipPercentageMode) {
        case "dash_dislike":
          tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${dislikePercentage}%`;
          break;
        case "both":
          tooltipInnerHTML = `${likePercentage}%&nbsp;/&nbsp;${dislikePercentage}%`;
          break;
        case "only_like":
          tooltipInnerHTML = `${likePercentage}%`;
          break;
        case "only_dislike":
          tooltipInnerHTML = `${dislikePercentage}%`;
          break;
        default: // dash_like
          tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${likePercentage}%`;
      }
    } else {
      tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
    }

    if (!(0,state/* isShorts */.ol)()) {
      if (!rateBar && !(0,state/* isMobile */.tq)()) {
        let colorLikeStyle = "";
        let colorDislikeStyle = "";
        if (state/* extConfig */.zO.coloredBar) {
          colorLikeStyle = "; background-color: " + (0,utils_userscript/* getColorFromTheme */.t4)(true);
          colorDislikeStyle = "; background-color: " + (0,utils_userscript/* getColorFromTheme */.t4)(false);
        }
        let actions =
          (0,state/* isNewDesign */.am)() && (0,buttons/* getButtons */.hS)() === (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.newDesignActions)
            ? (0,buttons/* getButtons */.hS)()
            : (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.oldDesignActions);
        (actions || (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.mobileActionBar)).insertAdjacentHTML(
          "beforeend",
          `
              <div class="ryd-tooltip ryd-tooltip-${(0,state/* isNewDesign */.am)() ? "new" : "old"}-design" style="width: ${widthPx}px">
              <div class="ryd-tooltip-bar-container">
                <div
                    id="ryd-bar-container"
                    style="width: 100%; height: 2px;${colorDislikeStyle}"
                    >
                    <div
                      id="ryd-bar"
                      style="width: ${widthPercent}%; height: 100%${colorLikeStyle}"
                      ></div>
                </div>
              </div>
              <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
                <!--css-build:shady-->${tooltipInnerHTML}
              </tp-yt-paper-tooltip>
              </div>
      		`,
        );

        if ((0,state/* isNewDesign */.am)()) {
          // Add border between info and comments
          let descriptionAndActionsElement = (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.topRow);
          descriptionAndActionsElement.style.borderBottom = "1px solid var(--yt-spec-10-percent-layer)";
          descriptionAndActionsElement.style.paddingBottom = "10px";

          // Fix like/dislike ratio bar offset in new UI
          (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.actionsInner).style.width = "revert";
          if ((0,state/* isRoundedDesign */.MB)()) {
            (0,utils_userscript/* querySelector */.R2)(state/* extConfig */.zO.selectors.rateBar.actions).style.flexDirection = "row-reverse";
          }
        }
      } else {
        document.querySelector(`.ryd-tooltip`).style.width = widthPx + "px";
        document.getElementById("ryd-bar").style.width = widthPercent + "%";
        document.querySelector("#ryd-dislike-tooltip > #tooltip").innerHTML = tooltipInnerHTML;
        if (state/* extConfig */.zO.coloredBar) {
          document.getElementById("ryd-bar-container").style.backgroundColor = (0,utils_userscript/* getColorFromTheme */.t4)(false);
          document.getElementById("ryd-bar").style.backgroundColor = (0,utils_userscript/* getColorFromTheme */.t4)(true);
        }
      }
    }
  } else {
    console.log("removing bar");
    if (rateBar) {
      rateBar.parentNode.removeChild(rateBar);
    }
  }
}



// EXTERNAL MODULE: ./Extensions/UserScript/src/browser-shim.js
var browser_shim = __webpack_require__(979);
;// CONCATENATED MODULE: ./Extensions/UserScript/src/bar.userscript.js
// Alias target for Extensions/common/bar.js when bundling the userscript
// (see the webpack "userscript" config's resolve.alias). Applies the
// userscript-only rateBarEnabled option (see browser-shim.js): when disabled,
// skip rendering the bar entirely instead of delegating to the shared
// createRateBar. The userscript has no live options UI, so this is a static,
// build-time choice - there is never an existing bar to tear down.



function bar_userscript_createRateBar(likes, dislikes) {
  if (!browser_shim/* userConfig */.x.rateBarEnabled) {
    return;
  }
  return createRateBar(likes, dislikes);
}




/***/ }),

/***/ 979:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   G: () => (/* binding */ browserShim),
/* harmony export */   x: () => (/* binding */ userConfig)
/* harmony export */ });
// This is the userscript's only user-facing configuration surface (there is
// no options UI, unlike the browser extension). Edit the values below, then
// run `npm run build:userscript` to regenerate the .user.js file.
const userConfig = {
  // ==== BEGIN USER OPTIONS ====
  // You may change the following variables to allowed values listed in the corresponding brackets (* means default). Keep the style and keywords intact.
  disableVoteSubmission: false, // [true, false*] Unused: the userscript does not submit votes, kept only so shared code sees a consistent shape.
  disableLogging: true, // [true*, false] Disable Logging API Response in JavaScript Console.
  coloredThumbs: false, // [true, false*] Colorize thumbs (Use custom colors for thumb icons)
  coloredBar: false, // [true, false*] Colorize ratio bar (Use custom colors for ratio bar)
  colorTheme: "classic", // [classic*, accessible, neon] Color theme (red/green, blue/yellow, pink/cyan)
  numberDisplayFormat: "compactShort", // [compactShort*, compactLong, standard] Number format (For non-English locale users, you may be able to improve appearance with a different option. Please file a feature request if your locale is not covered)
  showTooltipPercentage: false, // [true, false*] Show percentage in like/dislike bar tooltip.
  tooltipPercentageMode: "dash_like", // [dash_like*, dash_dislike, both, only_like, only_dislike] Mode of showing percentage in like/dislike bar tooltip.
  numberDisplayReformatLikes: false, // [true, false*] Re-format like numbers (Make likes and dislikes format consistent)
  hidePremiumTeaser: false, // [true, false*] Hide the premium features teaser (the userscript has no premium features; kept for shape-compatibility with shared code)
  numberDisplayRoundDown: true, // [true*, false] Round down numbers (Show rounded down numbers). Userscript-only: applied via utils.userscript.js, no equivalent in the shared extension code.
  rateBarEnabled: false, // [true, false*] Enables ratio bar under like/dislike buttons. Userscript-only: applied via bar.userscript.js, no equivalent in the shared extension code.
  // ==== END USER OPTIONS ====
};

function get(keys, callback) {
  const list = Array.isArray(keys) ? keys : [keys];
  const result = {};
  for (const key of list) {
    if (userConfig[key] !== undefined) {
      result[key] = userConfig[key];
    }
  }
  callback(result);
}

function set(values) {
  Object.assign(userConfig, values);
}

// A minimal stand-in for the `chrome`/`browser` global that Extensions/common's
// shared modules call through getBrowser(). The userscript has no options UI
// and no background script, so every entry in userConfig is always already
// present: initializeX() in state.js only ever reads it back, it never falls
// through to storage.sync.set(); onChanged/runtime.sendMessage are inert
// because nothing in the userscript build ever registers a storage listener
// or submits votes.
const browserShim = {
  storage: {
    sync: { get, set },
    onChanged: {
      addListener() {},
    },
  },
  runtime: {
    sendMessage() {},
    getURL() {
      return undefined;
    },
    getManifest() {
      return null;
    },
  },
};




/***/ }),

/***/ 898:
/***/ ((module, __unused_webpack___webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony import */ var _common_buttons__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(525);
/* harmony import */ var _common_state__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(284);
/* harmony import */ var _utils_userscript__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(278);
/* harmony import */ var _common_events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(30);





// The core bar/tooltip/menu-fix rules from Extensions/combined/content-style.css.
// Kept as a small literal copy rather than importing that file directly: the
// rest of content-style.css is premium-analytics-only CSS with no meaning in
// the userscript, and there is no build-time mechanism to share a CSS partial
// across the Extensions/common boundary at runtime once each side is packaged
// separately. If these rules drift from content-style.css, Extensions/common/bar.js's
// actual DOM output (#ryd-bar-container/#ryd-bar/.ryd-tooltip*) is the tiebreaker.
const CORE_STYLES = `
#ryd-bar-container {
  background: var(--yt-spec-icon-disabled);
  border-radius: 2px;
}

#ryd-bar {
  background: var(--yt-spec-text-primary);
  border-radius: 2px;
  transition: all 0.15s ease-in-out;
}

.ryd-tooltip {
  display: block;
  height: 2px;
}

.ryd-tooltip-old-design {
  position: relative;
  top: 9px;
}

.ryd-tooltip-new-design {
  position: absolute;
  bottom: -10px;
}

.ryd-tooltip-bar-container {
  width: 100%;
  height: 2px;
  position: absolute;
  padding-top: 6px;
  padding-bottom: 12px;
  top: -6px;
}

/* required to make the ratio bar visible in the new design */
ytd-menu-renderer.ytd-watch-metadata {
  overflow-y: visible !important;
}

#top-level-buttons-computed {
  position: relative !important;
}
`;

(typeof GM_addStyle !== "undefined"
  ? GM_addStyle
  : (styles) => {
      const styleNode = document.createElement("style");
      styleNode.textContent = styles;
      document.head.appendChild(styleNode);
    })(CORE_STYLES);

await (0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .initExtConfig */ .qg)();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;
let shortsNavigationObserver = null;
let shortsNavigationObserverTarget = null;

function ensureShortsNavigationObserver() {
  if (!(0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .isShorts */ .ol)()) {
    return;
  }

  const shortsRoot = document.querySelector("ytd-shorts");
  if (!shortsRoot) {
    return;
  }

  if (!shortsNavigationObserver) {
    shortsNavigationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "is-active" &&
          mutation.target.tagName === "YTD-REEL-VIDEO-RENDERER" &&
          mutation.target.hasAttribute("is-active")
        ) {
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
      subtree: true,
      attributeFilter: ["is-active"],
    });
    shortsNavigationObserverTarget = shortsRoot;
  }
}

async function checkForInitialization() {
  try {
    if ((0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .isShorts */ .ol)()) {
      ensureShortsNavigationObserver();
    }

    if (((0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .isShorts */ .ol)() && (0,_utils_userscript__WEBPACK_IMPORTED_MODULE_2__/* .isVideoLoaded */ .x8)()) || ((0,_common_buttons__WEBPACK_IMPORTED_MODULE_0__/* .getButtons */ .hS)()?.offsetParent && (0,_utils_userscript__WEBPACK_IMPORTED_MODULE_2__/* .isVideoLoaded */ .x8)())) {
      if (jsInitChecktimer !== null) {
        clearInterval(jsInitChecktimer);
        jsInitChecktimer = null;
      }
      (0,_common_events__WEBPACK_IMPORTED_MODULE_3__/* .createSmartimationObserver */ .Q$)();
      (0,_common_events__WEBPACK_IMPORTED_MODULE_3__/* .addLikeDislikeEventListener */ .G_)();
      await (0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .setInitialState */ .KY)();
      isSetInitialStateDone = true;
      // Intentionally no storage.onChanged listener here: the userscript has
      // no options UI or background script to broadcast a config change from.
    }
  } catch (exception) {
    if (!isSetInitialStateDone) {
      await (0,_common_state__WEBPACK_IMPORTED_MODULE_1__/* .setInitialState */ .KY)();
    }
  }
}

async function triggerInitializationCycle() {
  isSetInitialStateDone = false;

  if (jsInitChecktimer !== null) {
    clearInterval(jsInitChecktimer);
    jsInitChecktimer = null;
  }

  await checkForInitialization();

  if (!isSetInitialStateDone) {
    jsInitChecktimer = setInterval(() => {
      checkForInitialization();
    }, 111);

    setTimeout(() => {
      if (!isSetInitialStateDone) {
        checkForInitialization();
      }
    }, 2000);
  }
}

async function setEventListeners() {
  await triggerInitializationCycle();
}

await setEventListeners();

document.addEventListener("yt-navigate-finish", async function () {
  await setEventListeners();
});

__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } }, 1);

/***/ }),

/***/ 278:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  zo: () => (/* reexport */ createObserver),
  qs: () => (/* binding */ utils_userscript_getBrowser),
  t4: () => (/* reexport */ getColorFromTheme),
  gJ: () => (/* reexport */ getVideoId),
  yj: () => (/* reexport */ initializeLogging),
  v4: () => (/* reexport */ isInViewport),
  x8: () => (/* reexport */ isVideoLoaded),
  NC: () => (/* reexport */ localize),
  Y4: () => (/* binding */ utils_userscript_numberFormat),
  R2: () => (/* reexport */ querySelector),
  Wb: () => (/* reexport */ querySelectorAll)
});

// UNUSED EXPORTS: getNumberFormatter

// EXTERNAL MODULE: ./Extensions/common/state.js + 1 modules
var state = __webpack_require__(284);
;// CONCATENATED MODULE: ./Extensions/common/utils.js


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
  return getNumberFormatter(state/* extConfig */.zO.numberDisplayFormat).format(numberState);
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

function localize(localeString, substitutions) {
  try {
    if (typeof chrome !== "undefined" && chrome?.i18n?.getMessage) {
      const args = substitutions === undefined ? [localeString] : [localeString, substitutions];
      const message = chrome.i18n.getMessage(...args);
      if (message) {
        return message;
      }
    }
  } catch (error) {
    console.warn("Localization lookup failed for", localeString, error);
  }

  if (Array.isArray(substitutions)) {
    return substitutions.join(" ");
  }

  if (substitutions != null) {
    return `${substitutions}`;
  }

  return localeString;
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

  const selectors = state/* extConfig */.zO.selectors.shortsLoaded ?? DEFAULT_SHORTS_LOADED_SELECTORS;

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
  if ((0,state/* isShorts */.ol)()) {
    return isShortsLoaded(videoId);
  }

  const videoLoadedSelectors = state/* extConfig */.zO.selectors.videoLoaded ?? DEFAULT_VIDEO_LOADED_SELECTORS;

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
  if (state/* extConfig */.zO.disableLogging) {
    console.log = () => {};
    console.debug = () => {};
  } else {
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
  }
}

function getColorFromTheme(voteIsLike) {
  let colorString;
  switch (state/* extConfig */.zO.colorTheme) {
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
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    if (!selector) continue;
    result = (element ?? document).querySelector(selector);
    if (result !== null) {
      return result;
    }
  }
}

function querySelectorAll(selectors) {
  let result;
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    if (!selector) continue;
    result = document.querySelectorAll(selector);
    if (result.length !== 0) {
      return result;
    }
  }
  return result ?? document.querySelectorAll("__ryd-missing-selector__");
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



// EXTERNAL MODULE: ./Extensions/UserScript/src/browser-shim.js
var browser_shim = __webpack_require__(979);
;// CONCATENATED MODULE: ./Extensions/UserScript/src/utils.userscript.js
// Alias target for Extensions/common/utils.js when bundling the userscript
// (see the webpack "userscript" config's resolve.alias). Everything except
// getBrowser and numberFormat is re-exported unchanged.
//
// getBrowser is overridden to return the userscript's storage shim instead of
// probing for a real chrome/browser global.
//
// numberFormat is wrapped to apply the userscript-only numberDisplayRoundDown
// option (see browser-shim.js) before delegating to the real numberFormat.
// This is the only reason a userscript-specific numberFormat needs to exist:
// Extensions/common/bar.js and events.js call numberFormat via their own
// `from "./utils"` import, which this alias transparently redirects here, so
// the pre-rounding step applies without touching any shared module.





function roundDown(num) {
  if (num < 1000) return num;
  const magnitude = Math.floor(Math.log10(num) - 2);
  const decimalPlaces = magnitude + (magnitude % 3 ? 1 : 0);
  return Math.floor(num / 10 ** decimalPlaces) * 10 ** decimalPlaces;
}

function utils_userscript_numberFormat(numberState) {
  const input = browser_shim/* userConfig */.x.numberDisplayRoundDown ? roundDown(numberState) : numberState;
  return numberFormat(input);
}

function utils_userscript_getBrowser() {
  return browser_shim/* browserShim */.G;
}




/***/ }),

/***/ 525:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $1: () => (/* binding */ checkForSignInButton),
/* harmony export */   Eq: () => (/* binding */ getLikeTextContainer),
/* harmony export */   hS: () => (/* binding */ getButtons),
/* harmony export */   x8: () => (/* binding */ getDislikeButton),
/* harmony export */   xP: () => (/* binding */ getDislikeTextContainer),
/* harmony export */   yN: () => (/* binding */ getLikeButton)
/* harmony export */ });
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(284);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(278);



function getNativeButton(buttonContainer) {
  return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.nativeButton, buttonContainer);
}

function isSegmentedButtonLayout() {
  return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.segmentedContainer, getButtons()) !== undefined;
}

function getButtons() {
  //---   If Watching Youtube Shorts:   ---//
  if ((0,_state__WEBPACK_IMPORTED_MODULE_0__/* .isShorts */ .ol)()) {
    let elements = (0,_state__WEBPACK_IMPORTED_MODULE_0__/* .isMobile */ .tq)()
      ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelectorAll */ .Wb)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.shorts.mobile)
      : (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelectorAll */ .Wb)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.shorts.desktop);

    for (let element of elements) {
      //YouTube Shorts can have multiple like/dislike buttons when scrolling through videos
      //However, only one of them should be visible (no matter how you zoom)
      if ((0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .isInViewport */ .v4)(element)) {
        return element;
      }
    }

    if (elements.length > 0) {
      return elements[0];
    }
  }
  //---   If Watching On Mobile:   ---//
  if ((0,_state__WEBPACK_IMPORTED_MODULE_0__/* .isMobile */ .tq)()) {
    return document.querySelector(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.regular.mobile);
  }
  //---   If Menu Element Is Displayed:   ---//
  if ((0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.menuContainer)?.offsetParent === null) {
    return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.regular.desktopMenu);
    //---   If Menu Element Isn't Displayed:   ---//
  } else {
    return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.regular.desktopNoMenu);
  }
}

function getLikeButton() {
  return isSegmentedButtonLayout()
    ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.likeButton.segmented) ??
        (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.likeButton.segmentedGetButtons, getButtons())
    : (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.likeButton.notSegmented, getButtons());
}

function getLikeTextContainer() {
  return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.likeTextContainer, getLikeButton());
}

function getDislikeButton() {
  if (isSegmentedButtonLayout()) {
    return (
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.dislikeButton.segmented) ??
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.dislikeButton.segmentedGetButtons, getButtons())
    );
  }

  const notSegmentedMatch = (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.dislikeButton.notSegmented, getButtons());

  if (notSegmentedMatch != null) {
    return notSegmentedMatch;
  }

  if ((0,_state__WEBPACK_IMPORTED_MODULE_0__/* .isShorts */ .ol)()) {
    return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttons.dislikeButton.shortsFallback, getButtons());
  }

  return null;
}

function getTextContainerTemplate() {
  const likeButton = getLikeButton();
  const parentTemplate =
    (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.likeTextContainerTemplateParent, likeButton) ??
    (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.likeTextContainerTemplateParent);

  return (0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.likeTextContainerTemplate, likeButton) ?? parentTemplate?.parentNode;
}

function updateDislikeButtonShape(dislikeButton) {
  for (const className of _state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttonClasses.iconButton) {
    dislikeButton.classList.remove(className);
  }

  for (const className of _state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.buttonClasses.iconLeading) {
    dislikeButton.classList.add(className);
  }
}

function createDislikeTextContainer() {
  const textNodeClone = getTextContainerTemplate().cloneNode(true);
  const dislikeButton = getNativeButton(getDislikeButton());
  const insertPreChild = dislikeButton;
  insertPreChild.insertBefore(textNodeClone, null);
  updateDislikeButtonShape(dislikeButton);
  if ((0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.textContainerInner, textNodeClone) === undefined) {
    const span = document.createElement("span");
    span.setAttribute("role", "text");
    while (textNodeClone.firstChild) {
      textNodeClone.removeChild(textNodeClone.firstChild);
    }
    textNodeClone.appendChild(span);
  }
  textNodeClone.innerText = "";
  return textNodeClone;
}

function getDislikeTextContainer() {
  let result;
  const nativeDislikeButton = getNativeButton(getDislikeButton());
  for (const selector of _state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.dislikeTextContainer) {
    result = getDislikeButton().querySelector(selector);
    if (result !== null && result !== nativeDislikeButton) {
      break;
    }
    result = null;
  }
  if (result == null) {
    result = createDislikeTextContainer();
  }
  return result;
}

function checkForSignInButton() {
  if ((0,_utils__WEBPACK_IMPORTED_MODULE_1__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_0__/* .extConfig */ .zO.selectors.signInButton)) {
    return true;
  } else {
    return false;
  }
}




/***/ }),

/***/ 30:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   G_: () => (/* binding */ addLikeDislikeEventListener),
/* harmony export */   Q$: () => (/* binding */ createSmartimationObserver)
/* harmony export */ });
/* unused harmony exports sendVote, likeClicked, dislikeClicked, storageChangeHandler */
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(278);
/* harmony import */ var _buttons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(525);
/* harmony import */ var _state__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(284);
/* harmony import */ var _bar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(503);





function sendVote(vote) {
  if (_state__WEBPACK_IMPORTED_MODULE_2__/* .extConfig */ .zO.disableVoteSubmission !== true) {
    (0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .getBrowser */ .qs)().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: (0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .getVideoId */ .gJ)(window.location.href),
    });
  }
}

function updateDOMDislikes() {
  (0,_state__WEBPACK_IMPORTED_MODULE_2__/* .setDislikes */ .r6)((0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .numberFormat */ .Y4)(_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes));
  (0,_bar__WEBPACK_IMPORTED_MODULE_3__/* .createRateBar */ .k)(_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes, _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes);
}

function likeClicked() {
  if ((0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .checkForSignInButton */ .$1)() === false) {
    if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState === _state__WEBPACK_IMPORTED_MODULE_2__/* .DISLIKED_STATE */ .Gv) {
      sendVote(1);
      if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes > 0) _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes--;
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes++;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .LIKED_STATE */ .AV;
    } else if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState === _state__WEBPACK_IMPORTED_MODULE_2__/* .NEUTRAL_STATE */ .kQ) {
      sendVote(1);
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes++;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .LIKED_STATE */ .AV;
    } else if ((_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .LIKED_STATE */ .AV)) {
      sendVote(0);
      if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes > 0) _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes--;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .NEUTRAL_STATE */ .kQ;
    }
    if (_state__WEBPACK_IMPORTED_MODULE_2__/* .extConfig */ .zO.numberDisplayReformatLikes === true) {
      const nativeLikes = (0,_state__WEBPACK_IMPORTED_MODULE_2__/* .getLikeCountFromButton */ .m8)();
      if (nativeLikes !== false) {
        (0,_state__WEBPACK_IMPORTED_MODULE_2__/* .setLikes */ .Xq)((0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .numberFormat */ .Y4)(nativeLikes));
      }
    }
  }
}

function dislikeClicked() {
  if ((0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .checkForSignInButton */ .$1)() == false) {
    if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState === _state__WEBPACK_IMPORTED_MODULE_2__/* .NEUTRAL_STATE */ .kQ) {
      sendVote(-1);
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes++;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .DISLIKED_STATE */ .Gv;
    } else if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState === _state__WEBPACK_IMPORTED_MODULE_2__/* .DISLIKED_STATE */ .Gv) {
      sendVote(0);
      if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes > 0) _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes--;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .NEUTRAL_STATE */ .kQ;
    } else if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState === _state__WEBPACK_IMPORTED_MODULE_2__/* .LIKED_STATE */ .AV) {
      sendVote(-1);
      if (_state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes > 0) _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.likes--;
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.dislikes++;
      updateDOMDislikes();
      _state__WEBPACK_IMPORTED_MODULE_2__/* .storedData */ .vk.previousState = _state__WEBPACK_IMPORTED_MODULE_2__/* .DISLIKED_STATE */ .Gv;
      if (_state__WEBPACK_IMPORTED_MODULE_2__/* .extConfig */ .zO.numberDisplayReformatLikes === true) {
        const nativeLikes = (0,_state__WEBPACK_IMPORTED_MODULE_2__/* .getLikeCountFromButton */ .m8)();
        if (nativeLikes !== false) {
          (0,_state__WEBPACK_IMPORTED_MODULE_2__/* .setLikes */ .Xq)((0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .numberFormat */ .Y4)(nativeLikes));
        }
      }
    }
  }
}

function addLikeDislikeEventListener() {
  if (window.rydPreNavigateLikeButton !== (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getLikeButton */ .yN)()) {
    (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getLikeButton */ .yN)().addEventListener("click", likeClicked);
    (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getLikeButton */ .yN)().addEventListener("touchstart", likeClicked);
    if ((0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getDislikeButton */ .x8)()) {
      (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getDislikeButton */ .x8)().addEventListener("click", dislikeClicked);
      (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getDislikeButton */ .x8)().addEventListener("touchstart", dislikeClicked);
      (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getDislikeButton */ .x8)().addEventListener("focusin", updateDOMDislikes);
      (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getDislikeButton */ .x8)().addEventListener("focusout", updateDOMDislikes);
    }
    window.rydPreNavigateLikeButton = (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getLikeButton */ .yN)();
  }
}

let smartimationObserver = null;

function createSmartimationObserver() {
  if (!smartimationObserver) {
    smartimationObserver = (0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .createObserver */ .zo)(
      {
        attributes: true,
        subtree: true,
        childList: true,
      },
      updateDOMDislikes,
    );
    smartimationObserver.container = null;
  }

  const smartimationContainer = (0,_utils__WEBPACK_IMPORTED_MODULE_0__/* .querySelector */ .R2)(_state__WEBPACK_IMPORTED_MODULE_2__/* .extConfig */ .zO.selectors.buttons.smartimation, (0,_buttons__WEBPACK_IMPORTED_MODULE_1__/* .getButtons */ .hS)());
  if (smartimationContainer && smartimationObserver.container != smartimationContainer) {
    console.log("Initializing smartimation mutation observer");
    smartimationObserver.disconnect();
    smartimationObserver.observe(smartimationContainer);
    smartimationObserver.container = smartimationContainer;
  }
}

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(changes.disableVoteSubmission.newValue);
  }
  if (changes.coloredThumbs !== undefined) {
    handleColoredThumbsChangeEvent(changes.coloredThumbs.newValue);
  }
  if (changes.coloredBar !== undefined) {
    handleColoredBarChangeEvent(changes.coloredBar.newValue);
  }
  if (changes.colorTheme !== undefined) {
    handleColorThemeChangeEvent(changes.colorTheme.newValue);
  }
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(changes.numberDisplayReformatLikes.newValue);
  }
  if (changes.hidePremiumTeaser !== undefined) {
    handleHidePremiumTeaserChangeEvent(changes.hidePremiumTeaser.newValue);
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
}

function handleColoredThumbsChangeEvent(value) {
  extConfig.coloredThumbs = value;
}

function handleColoredBarChangeEvent(value) {
  extConfig.coloredBar = value;
}

function handleColorThemeChangeEvent(value) {
  if (!value) value = "classic";
  extConfig.colorTheme = value;
}

function handleNumberDisplayFormatChangeEvent(value) {
  extConfig.numberDisplayFormat = value;
}

function handleNumberDisplayReformatLikesChangeEvent(value) {
  extConfig.numberDisplayReformatLikes = value;
}

function handleHidePremiumTeaserChangeEvent(value) {
  extConfig.hidePremiumTeaser = value === true;
}




/***/ }),

/***/ 284:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Gv: () => (/* binding */ DISLIKED_STATE),
  AV: () => (/* binding */ LIKED_STATE),
  kQ: () => (/* binding */ NEUTRAL_STATE),
  zO: () => (/* binding */ extConfig),
  m8: () => (/* binding */ getLikeCountFromButton),
  qg: () => (/* binding */ initExtConfig),
  $L: () => (/* binding */ isLikesDisabled),
  tq: () => (/* binding */ isMobile),
  am: () => (/* binding */ isNewDesign),
  MB: () => (/* binding */ isRoundedDesign),
  ol: () => (/* binding */ isShorts),
  r6: () => (/* binding */ setDislikes),
  KY: () => (/* binding */ setInitialState),
  Xq: () => (/* binding */ setLikes),
  vk: () => (/* binding */ storedData)
});

// UNUSED EXPORTS: getState, isVideoDisliked, isVideoLiked, setState

// EXTERNAL MODULE: ./Extensions/common/buttons.js
var buttons = __webpack_require__(525);
// EXTERNAL MODULE: ./Extensions/UserScript/src/bar.userscript.js + 1 modules
var bar_userscript = __webpack_require__(503);
// EXTERNAL MODULE: ./Extensions/UserScript/src/utils.userscript.js + 1 modules
var utils_userscript = __webpack_require__(278);
;// CONCATENATED MODULE: ./Extensions/common/config.js
const PROD_API_URL = "https://returnyoutubedislikeapi.com";
const DEV_API_URL = PROD_API_URL;

const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
const manifest = typeof runtime?.getManifest === "function" ? runtime.getManifest() : null;
const isDevelopment = !manifest || !("update_url" in manifest);

const extensionChangelogUrl =
  runtime && typeof runtime.getURL === "function"
    ? runtime.getURL("changelog/4/changelog_4.0.html")
    : "https://returnyoutubedislike.com/changelog/4/changelog_4.0.html";

const config = {
  apiUrl: isDevelopment ? DEV_API_URL : PROD_API_URL,

  voteDisabledIconName: "icon_hold128.png",
  defaultIconName: "icon128.png",

  links: {
    website: "https://returnyoutubedislike.com",
    github: "https://github.com/Anarios/return-youtube-dislike",
    discord: "https://discord.gg/mYnESY4Md5",
    donate: "https://returnyoutubedislike.com/donate",
    faq: "https://returnyoutubedislike.com/faq",
    help: "https://returnyoutubedislike.com/help",
    changelog: extensionChangelogUrl,
  },

  defaultExtConfig: {
    disableVoteSubmission: false,
    disableLogging: true,
    coloredThumbs: false,
    coloredBar: false,
    colorTheme: "classic",
    numberDisplayFormat: "compactShort",
    numberDisplayReformatLikes: false,
    hidePremiumTeaser: false,
  },
};

function getApiUrl() {
  return config.apiUrl;
}

function getApiEndpoint(endpoint) {
  return `${config.apiUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

function getChangelogUrl() {
  return config.links?.changelog ?? extensionChangelogUrl;
}



;// CONCATENATED MODULE: ./Extensions/common/state.js




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
  return (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.roundedDesign) !== null;
}

let shortsObserver = null;

if (isShorts() && !shortsObserver) {
  console.log("Initializing shorts mutation observer");
  shortsObserver = (0,utils_userscript/* createObserver */.zo)(
    {
      attributes: true,
    },
    (mutationList) => {
      mutationList.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.target.nodeName === "TP-YT-PAPER-BUTTON" &&
          mutation.target.id === "button"
        ) {
          // console.log('Short thumb button status changed');
          if (mutation.target.getAttribute("aria-pressed") === "true") {
            mutation.target.style.color =
              mutation.target.parentElement.parentElement.id === "like-button"
                ? (0,utils_userscript/* getColorFromTheme */.t4)(true)
                : (0,utils_userscript/* getColorFromTheme */.t4)(false);
          } else {
            mutation.target.style.color = "unset";
          }
          return;
        }
        console.log("Unexpected mutation observer event: " + mutation.target + mutation.type);
      });
    },
  );
}

function isLikesDisabled() {
  // return true if the like button's text doesn't contain any number
  if (isMobile()) {
    return /^\D*$/.test((0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.mobileText, (0,buttons/* getButtons */.hS)().children[0]).innerText);
  }
  return /^\D*$/.test((0,buttons/* getLikeTextContainer */.Eq)().innerText);
}

function isVideoLiked() {
  const likeButton = (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.nativeButton, (0,buttons/* getLikeButton */.yN)());
  if (isMobile()) {
    return likeButton.getAttribute("aria-label") === "true";
  }
  return (
    extConfig.selectors.activeButtonClasses.some((className) => (0,buttons/* getLikeButton */.yN)().classList.contains(className)) ||
    likeButton?.getAttribute("aria-pressed") === "true"
  );
}

function isVideoDisliked() {
  const dislikeButton = (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.nativeButton, (0,buttons/* getDislikeButton */.x8)());
  if (isMobile()) {
    return dislikeButton.getAttribute("aria-label") === "true";
  }
  return (
    extConfig.selectors.activeButtonClasses.some((className) => (0,buttons/* getDislikeButton */.x8)().classList.contains(className)) ||
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
  (0,buttons/* getLikeTextContainer */.Eq)().innerText = likesCount;
}

function setDislikes(dislikesCount) {
  console.log(`SET dislikes ${dislikesCount}`);

  const _container = (0,buttons/* getDislikeTextContainer */.xP)();
  _container?.removeAttribute("is-empty");

  let _dislikeText;
  if (!isLikesDisabled()) {
    if (isMobile()) {
      (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.mobileText, (0,buttons/* getButtons */.hS)().children[1]).innerText = dislikesCount;
      return;
    }
    _dislikeText = dislikesCount;
  } else {
    console.log("likes count disabled by creator");
    if (isMobile()) {
      (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.mobileText, (0,buttons/* getButtons */.hS)().children[1]).innerText =
        (0,utils_userscript/* localize */.NC)("TextLikesDisabled");
      return;
    }
    _dislikeText = (0,utils_userscript/* localize */.NC)("TextLikesDisabled");
  }

  if (_dislikeText != null && _container?.innerText !== _dislikeText) {
    _container.innerText = _dislikeText;
  }
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }

    let likeButton = (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.likeCountButton, (0,buttons/* getLikeButton */.yN)());

    let likesStr = likeButton.getAttribute("aria-label").replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
  } catch {
    return false;
  }
}

function processResponse(response, storedData) {
  const formattedDislike = (0,utils_userscript/* numberFormat */.Y4)(response.dislikes);
  setDislikes(formattedDislike);
  if (extConfig.numberDisplayReformatLikes === true) {
    const nativeLikes = getLikeCountFromButton();
    if (nativeLikes !== false) {
      setLikes((0,utils_userscript/* numberFormat */.Y4)(nativeLikes));
    }
  }
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = getLikeCountFromButton() || parseInt(response.likes);
  (0,bar_userscript/* createRateBar */.k)(storedData.likes, storedData.dislikes);
  if (extConfig.coloredThumbs === true) {
    if (isShorts()) {
      // for shorts, leave deactivated buttons in default color
      let shortLikeButton = (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.shortsToggleButton, (0,buttons/* getLikeButton */.yN)());
      let shortDislikeButton = (0,utils_userscript/* querySelector */.R2)(extConfig.selectors.buttons.shortsToggleButton, (0,buttons/* getDislikeButton */.x8)());
      if (shortLikeButton.getAttribute("aria-pressed") === "true") {
        shortLikeButton.style.color = (0,utils_userscript/* getColorFromTheme */.t4)(true);
      }
      if (shortDislikeButton.getAttribute("aria-pressed") === "true") {
        shortDislikeButton.style.color = (0,utils_userscript/* getColorFromTheme */.t4)(false);
      }
      shortsObserver.observe(shortLikeButton);
      shortsObserver.observe(shortDislikeButton);
    } else {
      (0,buttons/* getLikeButton */.yN)().style.color = (0,utils_userscript/* getColorFromTheme */.t4)(true);
      (0,buttons/* getDislikeButton */.x8)().style.color = (0,utils_userscript/* getColorFromTheme */.t4)(false);
    }
  }

  //Temporary disabling this - it breaks all places where getButtons()[1] is used
  // createStarRating(response.rating, isMobile());
}

// Tells the user if the API is down
function displayError(error) {
  (0,buttons/* getDislikeTextContainer */.xP)().innerText = (0,utils_userscript/* localize */.NC)("textTempUnavailable");
}

async function setState(storedData) {
  if (typeof window !== "undefined") {
    window.__rydSetStateCalls = (window.__rydSetStateCalls || 0) + 1;
  }
  storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
  let statsSet = false;
  console.log("Video is loaded. Adding buttons...");

  let videoId = (0,utils_userscript/* getVideoId */.gJ)(window.location.href);
  let likeCount = getLikeCountFromButton() || null;

  let response = await fetch(getApiEndpoint(`/votes?videoId=${videoId}&likeCount=${likeCount || ""}`), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) displayError(response.error);
      return response;
    })
    .then((response) => response.json())
    .catch(displayError);
  console.log("response from api:");
  console.log(JSON.stringify(response));
  if (response !== undefined && !("traceId" in response) && !statsSet) {
    processResponse(response, storedData);
  }
}

async function setInitialState() {
  await setState(storedData);
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
  await initializeSelectors();
}

async function initializeSelectors() {
  let result = await fetch(getApiEndpoint("/configs/selectors"), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error("Error fetching selectors:", error);
    });
  extConfig.selectors = mergeConfig(DEFAULT_SELECTORS, result);
  console.log(result);
}

function initializeDisableVoteSubmission() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["disableVoteSubmission"], (res) => {
    if (res.disableVoteSubmission === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}

function initializeDisableLogging() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["disableLogging"], (res) => {
    if (res.disableLogging === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ disableLogging: true });
      extConfig.disableLogging = true;
    } else {
      extConfig.disableLogging = res.disableLogging;
    }
    // Initialize console methods based on logging config
    (0,utils_userscript/* initializeLogging */.yj)();
  });
}

function initializeColoredThumbs() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["coloredThumbs"], (res) => {
    if (res.coloredThumbs === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeColoredBar() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["coloredBar"], (res) => {
    if (res.coloredBar === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["colorTheme"], (res) => {
    if (res.colorTheme === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["numberDisplayFormat"], (res) => {
    if (res.numberDisplayFormat === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ numberDisplayFormat: "compactShort" });
    } else {
      extConfig.numberDisplayFormat = res.numberDisplayFormat;
    }
  });
}

function initializeTooltipPercentage() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["showTooltipPercentage"], (res) => {
    if (res.showTooltipPercentage === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ showTooltipPercentage: false });
    } else {
      extConfig.showTooltipPercentage = res.showTooltipPercentage;
    }
  });
}

function initializeTooltipPercentageMode() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["tooltipPercentageMode"], (res) => {
    if (res.tooltipPercentageMode === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ tooltipPercentageMode: "dash_like" });
    } else {
      extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
    }
  });
}

function initializeNumberDisplayReformatLikes() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["numberDisplayReformatLikes"], (res) => {
    if (res.numberDisplayReformatLikes === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ numberDisplayReformatLikes: false });
    } else {
      extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
    }
  });
}

function initializeHidePremiumTeaser() {
  (0,utils_userscript/* getBrowser */.qs)().storage.sync.get(["hidePremiumTeaser"], (res) => {
    if (res.hidePremiumTeaser === undefined) {
      (0,utils_userscript/* getBrowser */.qs)().storage.sync.set({ hidePremiumTeaser: false });
      extConfig.hidePremiumTeaser = false;
    } else {
      extConfig.hidePremiumTeaser = res.hidePremiumTeaser === true;
    }
  });
}




/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/async module */
/******/ 	(() => {
/******/ 		var webpackQueues = typeof Symbol === "function" ? Symbol("webpack queues") : "__webpack_queues__";
/******/ 		var webpackExports = typeof Symbol === "function" ? Symbol("webpack exports") : "__webpack_exports__";
/******/ 		var webpackError = typeof Symbol === "function" ? Symbol("webpack error") : "__webpack_error__";
/******/ 		var resolveQueue = (queue) => {
/******/ 			if(queue && queue.d < 1) {
/******/ 				queue.d = 1;
/******/ 				queue.forEach((fn) => (fn.r--));
/******/ 				queue.forEach((fn) => (fn.r-- ? fn.r++ : fn()));
/******/ 			}
/******/ 		}
/******/ 		var wrapDeps = (deps) => (deps.map((dep) => {
/******/ 			if(dep !== null && typeof dep === "object") {
/******/ 				if(dep[webpackQueues]) return dep;
/******/ 				if(dep.then) {
/******/ 					var queue = [];
/******/ 					queue.d = 0;
/******/ 					dep.then((r) => {
/******/ 						obj[webpackExports] = r;
/******/ 						resolveQueue(queue);
/******/ 					}, (e) => {
/******/ 						obj[webpackError] = e;
/******/ 						resolveQueue(queue);
/******/ 					});
/******/ 					var obj = {};
/******/ 					obj[webpackQueues] = (fn) => (fn(queue));
/******/ 					return obj;
/******/ 				}
/******/ 			}
/******/ 			var ret = {};
/******/ 			ret[webpackQueues] = x => {};
/******/ 			ret[webpackExports] = dep;
/******/ 			return ret;
/******/ 		}));
/******/ 		__webpack_require__.a = (module, body, hasAwait) => {
/******/ 			var queue;
/******/ 			hasAwait && ((queue = []).d = -1);
/******/ 			var depQueues = new Set();
/******/ 			var exports = module.exports;
/******/ 			var currentDeps;
/******/ 			var outerResolve;
/******/ 			var reject;
/******/ 			var promise = new Promise((resolve, rej) => {
/******/ 				reject = rej;
/******/ 				outerResolve = resolve;
/******/ 			});
/******/ 			promise[webpackExports] = exports;
/******/ 			promise[webpackQueues] = (fn) => (queue && fn(queue), depQueues.forEach(fn), promise["catch"](x => {}));
/******/ 			module.exports = promise;
/******/ 			body((deps) => {
/******/ 				currentDeps = wrapDeps(deps);
/******/ 				var fn;
/******/ 				var getResult = () => (currentDeps.map((d) => {
/******/ 					if(d[webpackError]) throw d[webpackError];
/******/ 					return d[webpackExports];
/******/ 				}))
/******/ 				var promise = new Promise((resolve) => {
/******/ 					fn = () => (resolve(getResult));
/******/ 					fn.r = 0;
/******/ 					var fnQueue = (q) => (q !== queue && !depQueues.has(q) && (depQueues.add(q), q && !q.d && (fn.r++, q.push(fn))));
/******/ 					currentDeps.map((dep) => (dep[webpackQueues](fnQueue)));
/******/ 				});
/******/ 				return fn.r ? promise : getResult();
/******/ 			}, (err) => ((err ? reject(promise[webpackError] = err) : outerResolve(exports)), resolveQueue(queue)));
/******/ 			queue && queue.d < 0 && (queue.d = 0);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module used 'module' so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(898);
/******/ 	
/******/ })()
;