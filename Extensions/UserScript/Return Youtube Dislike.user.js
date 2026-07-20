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
(function () {
  'use strict';

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

  function numberFormat$1(numberState) {
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

    return localeString;
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

  function numberFormat(numberState) {
    const input = userConfig.numberDisplayRoundDown ? roundDown(numberState) : numberState;
    return numberFormat$1(input);
  }

  function getBrowser() {
    return browserShim;
  }

  function createRateBar$1(likes, dislikes) {
    let rateBar = document.getElementById("ryd-bar-container");
    if (!isLikesDisabled()) {
      // sometimes rate bar is hidden
      if (rateBar && !isInViewport(rateBar)) {
        rateBar.remove();
        rateBar = null;
      }

      const widthPx =
        parseFloat(window.getComputedStyle(getLikeButton()).width) +
        parseFloat(window.getComputedStyle(getDislikeButton()).width) +
        (isRoundedDesign() ? 0 : 8);

      const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

      var likePercentage = parseFloat(widthPercent.toFixed(1));
      const dislikePercentage = (100 - likePercentage).toLocaleString();
      likePercentage = likePercentage.toLocaleString();

      if (extConfig.showTooltipPercentage) {
        var tooltipInnerHTML;
        switch (extConfig.tooltipPercentageMode) {
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

      if (!isShorts()) {
        if (!rateBar && !isMobile()) {
          let colorLikeStyle = "";
          let colorDislikeStyle = "";
          if (extConfig.coloredBar) {
            colorLikeStyle = "; background-color: " + getColorFromTheme(true);
            colorDislikeStyle = "; background-color: " + getColorFromTheme(false);
          }
          let actions =
            isNewDesign() && getButtons() === querySelector(extConfig.selectors.rateBar.newDesignActions)
              ? getButtons()
              : querySelector(extConfig.selectors.rateBar.oldDesignActions);
          (actions || querySelector(extConfig.selectors.rateBar.mobileActionBar)).insertAdjacentHTML(
            "beforeend",
            `
              <div class="ryd-tooltip ryd-tooltip-${isNewDesign() ? "new" : "old"}-design" style="width: ${widthPx}px">
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

          if (isNewDesign()) {
            // Add border between info and comments
            let descriptionAndActionsElement = querySelector(extConfig.selectors.rateBar.topRow);
            descriptionAndActionsElement.style.borderBottom = "1px solid var(--yt-spec-10-percent-layer)";
            descriptionAndActionsElement.style.paddingBottom = "10px";

            // Fix like/dislike ratio bar offset in new UI
            querySelector(extConfig.selectors.rateBar.actionsInner).style.width = "revert";
            if (isRoundedDesign()) {
              querySelector(extConfig.selectors.rateBar.actions).style.flexDirection = "row-reverse";
            }
          }
        } else {
          document.querySelector(`.ryd-tooltip`).style.width = widthPx + "px";
          document.getElementById("ryd-bar").style.width = widthPercent + "%";
          document.querySelector("#ryd-dislike-tooltip > #tooltip").innerHTML = tooltipInnerHTML;
          if (extConfig.coloredBar) {
            document.getElementById("ryd-bar-container").style.backgroundColor = getColorFromTheme(false);
            document.getElementById("ryd-bar").style.backgroundColor = getColorFromTheme(true);
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

  // Alias target for Extensions/common/bar.js when bundling the userscript
  // (see the webpack "userscript" config's resolve.alias). Applies the
  // userscript-only rateBarEnabled option (see browser-shim.js): when disabled,
  // skip rendering the bar entirely instead of delegating to the shared
  // createRateBar. The userscript has no live options UI, so this is a static,
  // build-time choice - there is never an existing bar to tear down.

  function createRateBar(likes, dislikes) {
    if (!userConfig.rateBarEnabled) {
      return;
    }
    return createRateBar$1(likes, dislikes);
  }

  const PROD_API_URL = "https://returnyoutubedislikeapi.com";
  const DEV_API_URL = PROD_API_URL;

  const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
  const manifest = typeof runtime?.getManifest === "function" ? runtime.getManifest() : null;
  const isDevelopment = !manifest || !("update_url" in manifest);

  runtime && typeof runtime.getURL === "function"
      ? runtime.getURL("changelog/4/changelog_4.0.html")
      : "https://returnyoutubedislike.com/changelog/4/changelog_4.0.html";

  const config = {
    apiUrl: isDevelopment ? DEV_API_URL : PROD_API_URL};

  function getApiEndpoint(endpoint) {
    return `${config.apiUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  }

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

  let shortsObserver = null;

  if (isShorts() && !shortsObserver) {
    console.log("Initializing shorts mutation observer");
    shortsObserver = createObserver(
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
                  ? getColorFromTheme(true)
                  : getColorFromTheme(false);
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
      return /^\D*$/.test(querySelector(extConfig.selectors.buttons.mobileText, getButtons().children[0]).innerText);
    }
    return /^\D*$/.test(getLikeTextContainer().innerText);
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

  //---   Sets The Likes And Dislikes Values   ---//
  function setLikes(likesCount) {
    console.log(`SET likes ${likesCount}`);
    getLikeTextContainer().innerText = likesCount;
  }

  function setDislikes(dislikesCount) {
    console.log(`SET dislikes ${dislikesCount}`);

    const _container = getDislikeTextContainer();
    _container?.removeAttribute("is-empty");

    let _dislikeText;
    if (!isLikesDisabled()) {
      if (isMobile()) {
        querySelector(extConfig.selectors.buttons.mobileText, getButtons().children[1]).innerText = dislikesCount;
        return;
      }
      _dislikeText = dislikesCount;
    } else {
      console.log("likes count disabled by creator");
      if (isMobile()) {
        querySelector(extConfig.selectors.buttons.mobileText, getButtons().children[1]).innerText =
          localize("TextLikesDisabled");
        return;
      }
      _dislikeText = localize("TextLikesDisabled");
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

      let likeButton = querySelector(extConfig.selectors.likeCountButton, getLikeButton());

      let likesStr = likeButton.getAttribute("aria-label").replace(/\D/g, "");
      return likesStr.length > 0 ? parseInt(likesStr) : false;
    } catch {
      return false;
    }
  }

  function processResponse(response, storedData) {
    const formattedDislike = numberFormat(response.dislikes);
    setDislikes(formattedDislike);
    if (extConfig.numberDisplayReformatLikes === true) {
      const nativeLikes = getLikeCountFromButton();
      if (nativeLikes !== false) {
        setLikes(numberFormat(nativeLikes));
      }
    }
    storedData.dislikes = parseInt(response.dislikes);
    storedData.likes = getLikeCountFromButton() || parseInt(response.likes);
    createRateBar(storedData.likes, storedData.dislikes);
    if (extConfig.coloredThumbs === true) {
      if (isShorts()) {
        // for shorts, leave deactivated buttons in default color
        let shortLikeButton = querySelector(extConfig.selectors.buttons.shortsToggleButton, getLikeButton());
        let shortDislikeButton = querySelector(extConfig.selectors.buttons.shortsToggleButton, getDislikeButton());
        if (shortLikeButton.getAttribute("aria-pressed") === "true") {
          shortLikeButton.style.color = getColorFromTheme(true);
        }
        if (shortDislikeButton.getAttribute("aria-pressed") === "true") {
          shortDislikeButton.style.color = getColorFromTheme(false);
        }
        shortsObserver.observe(shortLikeButton);
        shortsObserver.observe(shortDislikeButton);
      } else {
        getLikeButton().style.color = getColorFromTheme(true);
        getDislikeButton().style.color = getColorFromTheme(false);
      }
    }

    //Temporary disabling this - it breaks all places where getButtons()[1] is used
    // createStarRating(response.rating, isMobile());
  }

  // Tells the user if the API is down
  function displayError(error) {
    getDislikeTextContainer().innerText = localize("textTempUnavailable");
  }

  async function setState(storedData) {
    if (typeof window !== "undefined") {
      window.__rydSetStateCalls = (window.__rydSetStateCalls || 0) + 1;
    }
    storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
    console.log("Video is loaded. Adding buttons...");

    let videoId = getVideoId(window.location.href);
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
    if (response !== undefined && !("traceId" in response) && true) {
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

  function getNativeButton(buttonContainer) {
    return querySelector(extConfig.selectors.buttons.nativeButton, buttonContainer);
  }

  function isSegmentedButtonLayout() {
    return querySelector(extConfig.selectors.buttons.segmentedContainer, getButtons()) !== undefined;
  }

  function getButtons() {
    //---   If Watching Youtube Shorts:   ---//
    if (isShorts()) {
      let elements = isMobile()
        ? querySelectorAll(extConfig.selectors.buttons.shorts.mobile)
        : querySelectorAll(extConfig.selectors.buttons.shorts.desktop);

      for (let element of elements) {
        //YouTube Shorts can have multiple like/dislike buttons when scrolling through videos
        //However, only one of them should be visible (no matter how you zoom)
        if (isInViewport(element)) {
          return element;
        }
      }

      if (elements.length > 0) {
        return elements[0];
      }
    }
    //---   If Watching On Mobile:   ---//
    if (isMobile()) {
      return document.querySelector(extConfig.selectors.buttons.regular.mobile);
    }
    //---   If Menu Element Is Displayed:   ---//
    if (querySelector(extConfig.selectors.menuContainer)?.offsetParent === null) {
      return querySelector(extConfig.selectors.buttons.regular.desktopMenu);
      //---   If Menu Element Isn't Displayed:   ---//
    } else {
      return querySelector(extConfig.selectors.buttons.regular.desktopNoMenu);
    }
  }

  function getLikeButton() {
    return isSegmentedButtonLayout()
      ? querySelector(extConfig.selectors.buttons.likeButton.segmented) ??
          querySelector(extConfig.selectors.buttons.likeButton.segmentedGetButtons, getButtons())
      : querySelector(extConfig.selectors.buttons.likeButton.notSegmented, getButtons());
  }

  function getLikeTextContainer() {
    return querySelector(extConfig.selectors.likeTextContainer, getLikeButton());
  }

  function getDislikeButton() {
    if (isSegmentedButtonLayout()) {
      return (
        querySelector(extConfig.selectors.buttons.dislikeButton.segmented) ??
        querySelector(extConfig.selectors.buttons.dislikeButton.segmentedGetButtons, getButtons())
      );
    }

    const notSegmentedMatch = querySelector(extConfig.selectors.buttons.dislikeButton.notSegmented, getButtons());

    if (notSegmentedMatch != null) {
      return notSegmentedMatch;
    }

    if (isShorts()) {
      return querySelector(extConfig.selectors.buttons.dislikeButton.shortsFallback, getButtons());
    }

    return null;
  }

  function getTextContainerTemplate() {
    const likeButton = getLikeButton();
    const parentTemplate =
      querySelector(extConfig.selectors.likeTextContainerTemplateParent, likeButton) ??
      querySelector(extConfig.selectors.likeTextContainerTemplateParent);

    return querySelector(extConfig.selectors.likeTextContainerTemplate, likeButton) ?? parentTemplate?.parentNode;
  }

  function updateDislikeButtonShape(dislikeButton) {
    for (const className of extConfig.selectors.buttonClasses.iconButton) {
      dislikeButton.classList.remove(className);
    }

    for (const className of extConfig.selectors.buttonClasses.iconLeading) {
      dislikeButton.classList.add(className);
    }
  }

  function createDislikeTextContainer() {
    const textNodeClone = getTextContainerTemplate().cloneNode(true);
    const dislikeButton = getNativeButton(getDislikeButton());
    const insertPreChild = dislikeButton;
    insertPreChild.insertBefore(textNodeClone, null);
    updateDislikeButtonShape(dislikeButton);
    if (querySelector(extConfig.selectors.textContainerInner, textNodeClone) === undefined) {
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
    for (const selector of extConfig.selectors.dislikeTextContainer) {
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
    if (querySelector(extConfig.selectors.signInButton)) {
      return true;
    } else {
      return false;
    }
  }

  function sendVote(vote) {
    if (extConfig.disableVoteSubmission !== true) {
      getBrowser().runtime.sendMessage({
        message: "send_vote",
        vote: vote,
        videoId: getVideoId(window.location.href),
      });
    }
  }

  function updateDOMDislikes() {
    setDislikes(numberFormat(storedData.dislikes));
    createRateBar(storedData.likes, storedData.dislikes);
  }

  function likeClicked() {
    if (checkForSignInButton() === false) {
      if (storedData.previousState === DISLIKED_STATE) {
        sendVote(1);
        if (storedData.dislikes > 0) storedData.dislikes--;
        storedData.likes++;
        updateDOMDislikes();
        storedData.previousState = LIKED_STATE;
      } else if (storedData.previousState === NEUTRAL_STATE) {
        sendVote(1);
        storedData.likes++;
        updateDOMDislikes();
        storedData.previousState = LIKED_STATE;
      } else if ((storedData.previousState = LIKED_STATE)) {
        sendVote(0);
        if (storedData.likes > 0) storedData.likes--;
        updateDOMDislikes();
        storedData.previousState = NEUTRAL_STATE;
      }
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) {
          setLikes(numberFormat(nativeLikes));
        }
      }
    }
  }

  function dislikeClicked() {
    if (checkForSignInButton() == false) {
      if (storedData.previousState === NEUTRAL_STATE) {
        sendVote(-1);
        storedData.dislikes++;
        updateDOMDislikes();
        storedData.previousState = DISLIKED_STATE;
      } else if (storedData.previousState === DISLIKED_STATE) {
        sendVote(0);
        if (storedData.dislikes > 0) storedData.dislikes--;
        updateDOMDislikes();
        storedData.previousState = NEUTRAL_STATE;
      } else if (storedData.previousState === LIKED_STATE) {
        sendVote(-1);
        if (storedData.likes > 0) storedData.likes--;
        storedData.dislikes++;
        updateDOMDislikes();
        storedData.previousState = DISLIKED_STATE;
        if (extConfig.numberDisplayReformatLikes === true) {
          const nativeLikes = getLikeCountFromButton();
          if (nativeLikes !== false) {
            setLikes(numberFormat(nativeLikes));
          }
        }
      }
    }
  }

  function addLikeDislikeEventListener() {
    if (window.rydPreNavigateLikeButton !== getLikeButton()) {
      getLikeButton().addEventListener("click", likeClicked);
      getLikeButton().addEventListener("touchstart", likeClicked);
      if (getDislikeButton()) {
        getDislikeButton().addEventListener("click", dislikeClicked);
        getDislikeButton().addEventListener("touchstart", dislikeClicked);
        getDislikeButton().addEventListener("focusin", updateDOMDislikes);
        getDislikeButton().addEventListener("focusout", updateDOMDislikes);
      }
      window.rydPreNavigateLikeButton = getLikeButton();
    }
  }

  let smartimationObserver = null;

  function createSmartimationObserver() {
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

    const smartimationContainer = querySelector(extConfig.selectors.buttons.smartimation, getButtons());
    if (smartimationContainer && smartimationObserver.container != smartimationContainer) {
      console.log("Initializing smartimation mutation observer");
      smartimationObserver.disconnect();
      smartimationObserver.observe(smartimationContainer);
      smartimationObserver.container = smartimationContainer;
    }
  }

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

  let jsInitChecktimer = null;
  let isSetInitialStateDone = false;
  let shortsNavigationObserver = null;
  let shortsNavigationObserverTarget = null;

  function ensureShortsNavigationObserver() {
    if (!isShorts()) {
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
      if (isShorts()) {
        ensureShortsNavigationObserver();
      }

      if ((isShorts() && isVideoLoaded()) || (getButtons()?.offsetParent && isVideoLoaded())) {
        if (jsInitChecktimer !== null) {
          clearInterval(jsInitChecktimer);
          jsInitChecktimer = null;
        }
        createSmartimationObserver();
        addLikeDislikeEventListener();
        await setInitialState();
        isSetInitialStateDone = true;
        // Intentionally no storage.onChanged listener here: the userscript has
        // no options UI or background script to broadcast a config change from.
      }
    } catch (exception) {
      if (!isSetInitialStateDone) {
        await setInitialState();
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

  (async function () {
    await initExtConfig();
    await setEventListeners();
    document.addEventListener("yt-navigate-finish", async function () {
      await setEventListeners();
    });
  })();

})();
