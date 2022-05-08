// ==UserScript==
// @name         Return YouTube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @homepage     https://www.returnyoutubedislike.com/
// @version      3.0.1
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
  numberDisplayReformatLikes: false, // [true, false*] Re-format like numbers (Make likes and dislikes format consistent)
// END USER OPTIONS
};

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";
let previousState = 3; //1=LIKED, 2=DISLIKED, 3=NEUTRAL
let likesvalue = 0;
let dislikesvalue = 0;

let isMobile = location.hostname == "m.youtube.com";
let isShorts = () => location.pathname.startsWith("/shorts");
let mobileDislikes = 0;
function cLog(text, subtext = "") {
  subtext = subtext.trim() === "" ? "" : `(${subtext})`;
  console.log(`[Return YouTube Dislikes] ${text} ${subtext}`);
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= height &&
    rect.right <= width
  );
}

function getButtons() {
  if (isShorts()) {
    let elements = document.querySelectorAll(
      isMobile
        ? "ytm-like-button-renderer"
        : "#like-button > ytd-like-button-renderer"
    );
    for (let element of elements) {
      if (isInViewport(element)) {
        return element;
      }
    }
  }
  if (isMobile) {
    return document.querySelector(".slim-video-action-bar-actions");
  }
  if (document.getElementById("menu-container")?.offsetParent === null) {
    return document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div");
  } else {
    return document
      .getElementById("menu-container")
      ?.querySelector("#top-level-buttons-computed");
  }
}

function getLikeButton() {
  return getButtons().children[0];
}

function getDislikeButton() {
  return getButtons().children[1];
}

let mutationObserver = new Object();

if (isShorts() && mutationObserver.exists !== true) {
  cLog('initializing mutation observer')
  mutationObserver.options = {
    childList: false,
    attributes: true,
    subtree: false
  };
  mutationObserver.exists = true;
  mutationObserver.observer = new MutationObserver( function(mutationList, observer) {
    mutationList.forEach( (mutation) => {
      if (mutation.type === 'attributes' && 
        mutation.target.nodeName === 'TP-YT-PAPER-BUTTON' && 
        mutation.target.id === 'button') {
        cLog('Short thumb button status changed');
        if (mutation.target.getAttribute('aria-pressed') === 'true') {
          mutation.target.style.color =
            (mutation.target.parentElement.parentElement.id === 'like-button') ? 
            getColorFromTheme(true) : getColorFromTheme(false);
        } else {
          mutation.target.style.color = 'unset';
        }
        return;
      }
      cLog('unexpected mutation observer event: ' + mutation.target + mutation.type);
    });
  });
}

function isVideoLiked() {
  if (isMobile) {
    return (
      getLikeButton().querySelector("button").getAttribute("aria-label") ==
      "true"
    );
  }
  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  if (isMobile) {
    return (
      getDislikeButton().querySelector("button").getAttribute("aria-label") ==
      "true"
    );
  }
  return getDislikeButton().classList.contains("style-default-active");
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
  return getDislikeButton().classList.contains("style-text");
}

function checkForUserAvatarButton() {
  if (isMobile) {
    return;
  }
  if (document.querySelector("#avatar-btn")) {
    return true;
  } else {
    return false;
  }
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
    getButtons().children[0].querySelector(".button-renderer-text").innerText =
      likesCount;
    return;
  }
  getButtons().children[0].querySelector("#text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  if (isMobile) {
    mobileDislikes = dislikesCount;
    return;
  }
  getButtons().children[1].querySelector("#text").innerText = dislikesCount;
}

function getLikeCountFromButton() {
  if (isShorts()) {
    //Youtube Shorts don't work with this query. It's not nessecary; we can skip it and still see the results.
    //It should be possible to fix this function, but it's not critical to showing the dislike count.
    return 0;
  }
  let likesStr = getLikeButton()
    .querySelector("button")
    .getAttribute("aria-label")
    .replace(/\D/g, "");
  return likesStr.length > 0 ? parseInt(likesStr) : false;
}

(typeof GM_addStyle != "undefined"
  ? GM_addStyle
  : (styles) => {
      let styleNode = document.createElement("style");
      styleNode.type = "text/css";
      styleNode.innerText = styles;
      document.head.appendChild(styleNode);
    })(`
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
  let rateBar = document.getElementById("return-youtube-dislike-bar-container");

  const widthPx =
    getButtons().children[0].clientWidth +
    getButtons().children[1].clientWidth +
    8;

  const widthPercent =
    likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  if (!rateBar && !isMobile) {
    let colorLikeStyle = "";
    let colorDislikeStyle = "";
    if (extConfig.coloredBar) {
      colorLikeStyle = "; background-color: " + getColorFromTheme(true);
      colorDislikeStyle = "; background-color: " + getColorFromTheme(false);
    }
    
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
           <!--css-build:shady-->${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}
        </tp-yt-paper-tooltip>
        </div>
`
    );
  } else {
    document.getElementById(
      "return-youtube-dislike-bar-container"
    ).style.width = widthPx + "px";
    document.getElementById("return-youtube-dislike-bar").style.width =
      widthPercent + "%";

    document.querySelector(
      "#ryd-dislike-tooltip > #tooltip"
    ).innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
    
    if (extConfig.coloredBar) {
      document.getElementById("return-youtube-dislike-bar-container").style.backgroundColor =
        getColorFromTheme(false);
      document.getElementById("return-youtube-dislike-bar").style.backgroundColor =
        getColorFromTheme(true);
    }
  }
}

function setState() {
  cLog("Fetching votes...");
  let statsSet = false;

  fetch(
    `https://returnyoutubedislikeapi.com/votes?videoId=${getVideoId()}`
  ).then((response) => {
    response.json().then((json) => {
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
          if (isShorts()) { // for shorts, leave deactived buttons in default color
            let shortLikeButton = getLikeButton().querySelector('tp-yt-paper-button#button');
            let shortDislikeButton = getDislikeButton().querySelector('tp-yt-paper-button#button');
            if (shortLikeButton.getAttribute('aria-pressed') === 'true') {
              shortLikeButton.style.color = getColorFromTheme(true);
            }
            if (shortDislikeButton.getAttribute('aria-pressed') === 'true') {
              shortDislikeButton.style.color = getColorFromTheme(false);
            }
            mutationObserver.observer.observe(shortLikeButton, mutationObserver.options);
            mutationObserver.observer.observe(shortDislikeButton, mutationObserver.options);
          } else {
            getLikeButton().style.color = getColorFromTheme(true);
            getDislikeButton().style.color = getColorFromTheme(false);
          }
        }
      }
    });
  });
}

function likeClicked() {
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
  }
}

function dislikeClicked() {
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
    }
  }
}

function setInitialState() {
  setState();
}

function getVideoId() {
  const urlObject = new URL(window.location.href);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return document.querySelector("meta[itemprop='videoId']").content;
  } else {
    if (pathname.startsWith("/shorts")) {
      return pathname.slice(8);
    }
    return urlObject.searchParams.get("v");
  }
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

function roundDown(num) {
  if (num < 1000) return num;
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  let userLocales;
  try {
    userLocales = new URL(
      Array.from(document.querySelectorAll("head > link[rel='search']"))
        ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
        ?.getAttribute("href")
    )?.searchParams?.get("locale");
  } catch {
    userLocales = document.documentElement.lang;
  }

  let numberDisplay;
  if (extConfig.numberDisplayRoundDown === false) {
    numberDisplay = numberState;
  } else {
    numberDisplay = roundDown(numberState);
  }
  return getNumberFormatter(extConfig.numberDisplayFormat, userLocales).format(
    numberDisplay
  );
}

function getNumberFormatter(optionSelect, userLocales) {
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

  const formatter = Intl.NumberFormat(
    document.documentElement.lang || userLocales || navigator.language,
    {
      notation: formatterNotation,
      compactDisplay: formatterCompactDisplay,
    }
  );
  return formatter;
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

function setEventListeners(evt) {
  let jsInitChecktimer;

  function checkForJS_Finish(check) {
    console.log();
    if (isShorts() || (getButtons()?.offsetParent && isVideoLoaded())) {
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
  }

  cLog("Setting up...");
  jsInitChecktimer = setInterval(checkForJS_Finish, 111);
}

(function () {
  "use strict";
  window.addEventListener("yt-navigate-finish", setEventListeners, true);
  setEventListeners();
})();
if (isMobile) {
  let originalPush = history.pushState;
  history.pushState = function (...args) {
    window.returnDislikeButtonlistenersSet = false;
    setEventListeners(args[2]);
    return originalPush.apply(history, args);
  };
  setInterval(() => {
    getDislikeButton().querySelector(".button-renderer-text").innerText =
      mobileDislikes;
  }, 1000);
}
