// ==UserScript==
// @name         Return YouTube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @homepage     https://www.returnyoutubedislike.com/
// @version      3.1.2
// @description  Return of the YouTube Dislike, Based off https://www.returnyoutubedislike.com/
// @icon         https://github.com/Anarios/return-youtube-dislike/raw/main/Icons/Return%20Youtube%20Dislike%20-%20Transparent.png
// @author       Anarios & JRWR
// @match        *://*.youtube.com/*
// @exclude      *://music.youtube.com/*
// @exclude      *://*.music.youtube.com/*
// @downloadURL  https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @updateURL    https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @grant        GM.xmlHttpRequest
// @connect      youtube.com
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

const extConfig = {
  // BEGIN USER OPTIONS
  // You may change the following variables to allowed values listed in the corresponding brackets (* means default). Keep the style and keywords intact.
  showUpdatePopup: false, // [true, false*] Show a popup tab after extension update (See what's new)
  disableVoteSubmission: false, // [true, false*] Disable like/dislike submission (Stops counting your likes and dislikes)
  coloredThumbs: false, // [true, false*] Colorize thumbs (Use custom colors for thumb icons)
  coloredBar: false, // [true, false*] Colorize ratio bar (Use custom colors for ratio bar)
  colorTheme: "classic", // [classic*, accessible, neon] Color theme (red/green, blue/yellow, pink/cyan)
  numberDisplayFormat: "compactShort", // [compactShort*, compactLong, standard] Number format (For non-English locale users, you may be able to improve appearance with a different option. Please file a feature request if your locale is not covered)
  numberDisplayRoundDown: true, // [true*, false] Round down numbers (Show rounded down numbers)
  tooltipPercentageMode: "none", // [none*, dash_like, dash_dislike, both, only_like, only_dislike] Mode of showing percentage in like/dislike bar tooltip.
  numberDisplayReformatLikes: false, // [true, false*] Re-format like numbers (Make likes and dislikes format consistent)
  // END USER OPTIONS
};

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";
let previousState = 3; //1=LIKED, 2=DISLIKED, 3=NEUTRAL
let likesvalue = 0;
let dislikesvalue = 0;

const isMobile = location.hostname == "m.youtube.com";
const isShorts = () => location.pathname.startsWith("/shorts");
let mobileDislikes = 0;
function cLog(text, subtext = "") {
  subtext = subtext.trim() === "" ? "" : `(${subtext})`;
  console.log(`[Return YouTube Dislikes] ${text} ${subtext}`);
}

const HEIGHT = innerHeight || document.documentElement.clientHeight;
const WIDTH = innerWidth || document.documentElement.clientWidth;

function isInViewport(element) {
  const { top, left, bottom, right } = element.getBoundingClientRect();
  return (
    // When short (channel) is ignored, the element (like/dislike AND short itself) is
    // hidden with a 0 DOMRect. In this case, consider it outside of Viewport
    !(top == 0 && left == 0 && bottom == 0 && right == 0) ||
    top >= 0 ||
    left >= 0 ||
    bottom <= HEIGHT ||
    right <= WIDTH
  );
}

function getButtons() {
  if (isShorts()) {
    for (const element of document.querySelectorAll(
      isMobile
        ? "ytm-like-button-renderer"
        : "#like-button > ytd-like-button-renderer"
    )) {
      if (isInViewport(element)) {
        return element;
      }
    }
  }
  if (isMobile) {
    return (
      document.querySelector(".slim-video-action-bar-actions .segmented-buttons") ??
      document.querySelector(".slim-video-action-bar-actions")
    );
  }
  return document.getElementById("menu-container")?.offsetParent === null ? (
    document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div") ??
    document.querySelector("ytd-menu-renderer.ytd-video-primary-info-renderer > div")
  ) : document
  .getElementById("menu-container")
  ?.querySelector("#top-level-buttons-computed");
}

function getLikeButton() {
  return getButtons().children[0].tagName ===
    "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? getButtons().children[0].children[0]
    : getButtons().children[0];
}

function getLikeTextContainer() {
  return (
    getLikeButton().querySelector("#text") ??
    getLikeButton().getElementsByTagName("yt-formatted-string")[0] ??
    getLikeButton().querySelector("span[role='text']")
  );
}

function getDislikeButton() {
  return getButtons().children[0].tagName ===
  "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? getButtons().children[0].children[1] === undefined ? document.querySelector("#segmented-dislike-button") : getButtons().children[0].children[1]
    : getButtons().children[1];
}

function getDislikeTextContainer() {
  const result =
    getDislikeButton().querySelector("#text") ??
    getDislikeButton().getElementsByTagName("yt-formatted-string")[0] ??
    getDislikeButton().querySelector("span[role='text']")
  if (result === null) {
    const textSpan = document.createElement("span");
    textSpan.id = "text";
    textSpan.style.marginLeft = "6px";
    getDislikeButton().querySelector("button").appendChild(textSpan);
    getDislikeButton().querySelector("button").style.width = "auto";
    return getDislikeButton().querySelector("#text");
  }
  return result;
}

const mutationObserver = new Object();

if (isShorts() && mutationObserver.exists !== true) {
  cLog("initializing mutation observer");
  mutationObserver.options = {
    childList: false,
    attributes: true,
    subtree: false,
  };
  mutationObserver.exists = true;
  mutationObserver.observer = new MutationObserver((mutationList) => {
    mutationList.some((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.target.nodeName === "TP-YT-PAPER-BUTTON" &&
        mutation.target.id === "button"
      ) {
        cLog("Short thumb button status changed");
        mutation.target.style.color =
          mutation.target.parentElement.parentElement.id === "like-button"
            ? getColorFromTheme(true)
            : getColorFromTheme(false);
        return true;
      }
      cLog(
        `unexpected mutation observer event: ${mutation.target}${mutation.type}`
      );
      return false;
    });
  });
}

function isVideoLiked() {
  return isMobile
    ? getLikeButton().querySelector("button").getAttribute("aria-label") == "true"
    : getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  return isMobile
    ? getDislikeButton().querySelector("button").getAttribute("aria-label") ==
      "true"
    : getDislikeButton().classList.contains("style-default-active");
}

function isVideoNotLiked() {
  return isMobile
    ? !isVideoLiked()
    : getLikeButton().classList.contains("style-text");
}

function isVideoNotDisliked() {
  return isMobile ? !isVideoDisliked() : getDislikeButton().classList.contains("style-text");
}

function checkForUserAvatarButton() {
  if (isMobile) {
    return;
  }
  return !!document.querySelector("#avatar-btn");
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
  if (isMobile) getButtons().children[0].querySelector(".button-renderer-text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  if (isMobile) {
    (mobileDislikes = dislikesCount);
  } else {
    getDislikeTextContainer()?.removeAttribute('is-empty');
  }
  getDislikeTextContainer().innerText = dislikesCount;
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }
    const likeButton = getLikeButton()
    .querySelector("yt-formatted-string#text") ??
    getLikeButton().querySelector("button");

    const likesStr = likeButton.getAttribute("aria-label")
    .replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
  }
  catch {
    return false;
  }

}

(typeof GM_addStyle == "undefined"
  ? (styles) => {
      const styleNode = document.createElement("style");
      styleNode.type = "text/css";
      styleNode.innerText = styles;
      document.head.appendChild(styleNode);
    }
  : GM_addStyle)(`
    #return-youtube-dislike-bar-container {
      background: var(--yt-spec-icon-disabled);
      border-radius: 2px;
    }

    #return-youtube-dislike-bar {
      background: var(--yt-spec-text-primary);
      border-radius: 2px;
      transition: all 0.15s ease-in-out;
    }

    .ryd-tooltip {
      position: relative;
      display: block;
      height: 2px;
      top: 9px;
    }

    .ryd-tooltip-bar-container {
      width: 100%;
      height: 2px;
      position: absolute;
      padding-top: 6px;
      padding-bottom: 28px;
      top: -6px;
    }
  `);

function createRateBar(likes, dislikes) {
  if (isMobile) {
    return;
  }
  const rateBar = document.getElementById("return-youtube-dislike-bar-container");

  const widthPx =
    getButtons().children[0].clientWidth +
    getButtons().children[1].clientWidth +
    8;

  const widthPercent =
    likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  let likePercentage = parseFloat(widthPercent.toFixed(1));
  const dislikePercentage = (100 - likePercentage).toLocaleString();
  likePercentage = likePercentage.toLocaleString();

  let tooltipInnerHTML;
  switch (extConfig.tooltipPercentageMode) {
    case "dash_like":
      tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}&nbsp;&nbsp;-&nbsp;&nbsp;${likePercentage}%`;
      break;
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
    default:
      tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
  }

  if (!rateBar && !isMobile) {
    const colorDislikeStyle = extConfig.coloredBar ? `; background-color: ${getColorFromTheme(false)}` : "";

    document.getElementById("menu-container").insertAdjacentHTML(
      "beforeend",
      `
        <div class="ryd-tooltip" style="width: ${widthPx}px">
        <div class="ryd-tooltip-bar-container">
           <div
              id="return-youtube-dislike-bar-container"
              style="width: 100%; height: 2px;${colorDislikeStyle}"
              >
              <div
                 id="return-youtube-dislike-bar"
                 style="width: ${widthPercent}%; height: 100%${colorDislikeStyle}"
                 ></div>
           </div>
        </div>
        <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
           <!--css-build:shady-->${tooltipInnerHTML}
        </tp-yt-paper-tooltip>
        </div>
`
    );
    return;
  }
  document.getElementById(
    "return-youtube-dislike-bar-container"
  ).style.width = `${widthPx}px`;
  document.getElementById("return-youtube-dislike-bar").style.width =
  `${widthPercent}%`;

  document.querySelector("#ryd-dislike-tooltip > #tooltip").innerHTML =
  tooltipInnerHTML;

  if (extConfig.coloredBar) {
    document.getElementById(
      "return-youtube-dislike-bar-container"
    ).style.backgroundColor = getColorFromTheme(false);
    document.getElementById(
      "return-youtube-dislike-bar"
    ).style.backgroundColor = getColorFromTheme(true);
  }
}

const statsSet = false;

async function setState() {
  cLog("Fetching votes...");

  try {
    const response = await fetch(
      `https://returnyoutubedislikeapi.com/votes?videoId=${getVideoId()}`
    );
    const json = await response.json();
    if (json && !("traceId" in response) && !statsSet) {
      const { dislikes, likes } = json;
      cLog(`Received count: ${dislikes}`);
      likesvalue = likes;
      dislikesvalue = dislikes;
      setDislikes(numberFormat(dislikes));
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) {
          setLikes(numberFormat(nativeLikes));
        }
      }
      createRateBar(likes, dislikes);
      if (extConfig.coloredThumbs === true) {
        if (isShorts()) {
          // for shorts, leave deactived buttons in default color
          const shortLikeButton = getLikeButton().querySelector(
            "tp-yt-paper-button#button"
          );
          const shortDislikeButton = getDislikeButton().querySelector(
            "tp-yt-paper-button#button"
          );
          if (shortLikeButton.getAttribute("aria-pressed") === "true") {
            shortLikeButton.style.color = getColorFromTheme(true);
          }
          if (shortDislikeButton.getAttribute("aria-pressed") === "true") {
            shortDislikeButton.style.color = getColorFromTheme(false);
          }
          mutationObserver.observer.observe(
            shortLikeButton,
            mutationObserver.options
          );
          mutationObserver.observer.observe(
            shortDislikeButton,
            mutationObserver.options
          );
        } else {
          getLikeButton().style.color = getColorFromTheme(true);
          getDislikeButton().style.color = getColorFromTheme(false);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}

const likeClicked = () => {
  if (checkForUserAvatarButton() == true) {
    if (previousState == 1) {
      likesvalue--;
      createRateBar(likesvalue, dislikesvalue);
      setDislikes(numberFormat(dislikesvalue));
      previousState = 3;
    } else if (previousState == 2) {
      likesvalue++;
      dislikesvalue--;
      setDislikes(numberFormat(dislikesvalue));
      createRateBar(likesvalue, dislikesvalue);
      previousState = 1;
    } else if (previousState == 3) {
      likesvalue++;
      createRateBar(likesvalue, dislikesvalue);
      previousState = 1;
    }
    if (extConfig.numberDisplayReformatLikes === true) {
      const nativeLikes = getLikeCountFromButton();
      if (nativeLikes !== false) {
        setLikes(numberFormat(nativeLikes));
      }
    }
  }
};

const dislikeClicked = () => {
  if (checkForUserAvatarButton() == true) {
    if (previousState == 3) {
      dislikesvalue++;
      setDislikes(numberFormat(dislikesvalue));
      createRateBar(likesvalue, dislikesvalue);
      previousState = 2;
    } else if (previousState == 2) {
      dislikesvalue--;
      setDislikes(numberFormat(dislikesvalue));
      createRateBar(likesvalue, dislikesvalue);
      previousState = 3;
    } else if (previousState == 1) {
      likesvalue--;
      dislikesvalue++;
      setDislikes(numberFormat(dislikesvalue));
      createRateBar(likesvalue, dislikesvalue);
      previousState = 2;
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) {
          setLikes(numberFormat(nativeLikes));
        }
      }
    }
  }
}

function setInitialState() {
  setState();
}

function getVideoId() {
  const urlObject = new URL(window.location.href);
  const {pathname} = urlObject;
  return pathname.startsWith("/clip")
    ? document.querySelector("meta[itemprop='videoId']").content
    : pathname.startsWith("/shorts")
    ? pathname.slice(8)
    : urlObject.searchParams.get("v");
}

function isVideoLoaded() {
  if (isMobile) {
    return document.getElementById("player").getAttribute("loading") == "false";
  }
  const videoId = getVideoId();

  return (
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null
  );
}

function roundToNearestThousand(num) {
  if (num < 1000) {
    return num;
  }
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  return getNumberFormatter(extConfig.numberDisplayFormat).format(
    extConfig.numberDisplayRoundDown === false
      ? numberState
      : roundToNearestThousand(numberState)
  );
}

function getNumberFormatter(optionSelect) {
  let userLocales;
  if (document.documentElement.lang) {
    userLocales = document.documentElement.lang;
  } else if (navigator.language) {
    userLocales = navigator.language;
  } else {
    try {
      userLocales = (
        document.querySelectorAll("head > link[rel='search']"))
          ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
          ?.getAttribute("href")
      ?.searchParams?.get("locale");
    } catch {
      cLog(
        "Cannot find browser locale. Use en as default for number formatting."
      );
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

function getColorFromTheme(voteIsLike) {
  switch (extConfig.colorTheme) {
    case "accessible":
      return voteIsLike === true ? "dodgerblue" : "gold";
    case "neon":
      return voteIsLike === true ? "aqua" : "magenta";
    case "classic":
    default:
      return voteIsLike === true ? "lime" : "red";
  }
}

function setEventListeners(evt) {
  let jsInitChecktimer;

  function checkForJS_Finish() {
    //console.log();
    if (!(isShorts() || (getButtons()?.offsetParent && isVideoLoaded()))) {
      return;
    }
    const buttons = getButtons();

    if (!window.returnDislikeButtonlistenersSet) {
      cLog("Registering button listeners...");
      try {
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        buttons.children[0].addEventListener("touchstart", likeClicked);
        buttons.children[1].addEventListener("touchstart", dislikeClicked);
      } catch {
        return;
      } //Don't spam errors into the console
      window.returnDislikeButtonlistenersSet = true;
    }
    setInitialState();
    clearInterval(jsInitChecktimer);
  }

  cLog("Setting up...");
  jsInitChecktimer = setInterval(checkForJS_Finish, 111);
}

{
  "use strict";
  window.addEventListener("yt-navigate-finish", setEventListeners, true);
  setEventListeners();
}
if (isMobile) {
  const originalPush = history.pushState;
  history.pushState = (...args) => {
    window.returnDislikeButtonlistenersSet = false;
    setEventListeners(args[2]);
    return originalPush.apply(history, args);
  };
  setInterval(() => {
    if(getDislikeButton().querySelector(".button-renderer-text") === null){
      getDislikeTextContainer().innerText = mobileDislikes;
    }
    else{
      getDislikeButton().querySelector(".button-renderer-text").innerText =
        mobileDislikes;
    }
  }, 1000);
}
