/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};

;// CONCATENATED MODULE: ./Extensions/combined/src/bar.js



function createRateBar(likes, dislikes) {
  if (!likesDisabledState) {
    var rateBar = document.getElementById("ryd-bar-container");
    var widthPx = buttons_getButtons().children[0].clientWidth + buttons_getButtons().children[1].clientWidth + 8;
    var widthPercent = likes + dislikes > 0 ? likes / (likes + dislikes) * 100 : 50;

    if (!rateBar) {
      (document.getElementById("menu-container") || document.querySelector("ytm-slim-video-action-bar-renderer")).insertAdjacentHTML("beforeend", "\n            <div class=\"ryd-tooltip\" style=\"width: ".concat(widthPx, "px\">\n            <div class=\"ryd-tooltip-bar-container\">\n              <div\n                  id=\"ryd-bar-container\"\n                  style=\"width: 100%; height: 2px;\"\n                  >\n                  <div\n                    id=\"ryd-bar\"\n                    style=\"width: ").concat(widthPercent, "%; height: 100%\"\n                    ></div>\n              </div>\n            </div>\n            <tp-yt-paper-tooltip position=\"top\" id=\"ryd-dislike-tooltip\" class=\"style-scope ytd-sentiment-bar-renderer\" role=\"tooltip\" tabindex=\"-1\">\n              <!--css-build:shady-->").concat(likes.toLocaleString(), "&nbsp;/&nbsp;").concat(dislikes.toLocaleString(), "\n            </tp-yt-paper-tooltip>\n            </div>\n    "));
    } else {
      document.getElementById("ryd-bar-container").style.width = widthPx + "px";
      document.getElementById("ryd-bar").style.width = widthPercent + "%";
      document.querySelector("#ryd-dislike-tooltip > #tooltip").innerHTML = "".concat(likes.toLocaleString(), "&nbsp;/&nbsp;").concat(dislikes.toLocaleString());
    }
  }
}


;// CONCATENATED MODULE: ./Extensions/combined/src/utils.js
function roundDown(num) {
  if (num < 1000) return num;

  var _int = Math.floor(Math.log10(num) - 2);

  var decimal = _int + (_int % 3 ? 1 : 0);
  var value = Math.floor(num / Math.pow(10, decimal));
  return value * Math.pow(10, decimal);
}

function numberFormat(numberState) {
  var userLocales;

  try {
    var _URL, _URL$searchParams, _Array$from, _Array$from$find;

    userLocales = (_URL = new URL((_Array$from = Array.from(document.querySelectorAll("head > link[rel='search']"))) === null || _Array$from === void 0 ? void 0 : (_Array$from$find = _Array$from.find(function (n) {
      var _n$getAttribute;

      return n === null || n === void 0 ? void 0 : (_n$getAttribute = n.getAttribute("href")) === null || _n$getAttribute === void 0 ? void 0 : _n$getAttribute.includes("?locale=");
    })) === null || _Array$from$find === void 0 ? void 0 : _Array$from$find.getAttribute("href"))) === null || _URL === void 0 ? void 0 : (_URL$searchParams = _URL.searchParams) === null || _URL$searchParams === void 0 ? void 0 : _URL$searchParams.get("locale");
  } catch (_unused) {}

  var formatter = Intl.NumberFormat(document.documentElement.lang || userLocales || navigator.language, {
    notation: "compact"
  });
  return formatter.format(roundDown(numberState));
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
  var urlObject = new URL(url);
  var pathname = urlObject.pathname;

  if (pathname.startsWith("/clip")) {
    return document.querySelector("meta[itemprop='videoId']").content;
  } else {
    return urlObject.searchParams.get("v");
  }
}

function isVideoLoaded() {
  var videoId = getVideoId(window.location.href);
  return document.querySelector("ytd-watch-flexy[video-id='".concat(videoId, "']")) !== null || // mobile: no video-id attribute
  document.querySelector('#player[loading="false"]:not([hidden])') !== null;
}

function cLog(message, writer) {
  message = "[return youtube dislike]: ".concat(message);

  if (writer) {
    writer(message);
  } else {
    console.log(message);
  }
}


;// CONCATENATED MODULE: ./Extensions/combined/src/events.js





function sendVote(vote) {
  if (extConfig.disableVoteSubmission !== true) {
    getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href)
    });
  }
}

function sendVideoIds() {
  var links = Array.from(document.getElementsByClassName("yt-simple-endpoint ytd-compact-video-renderer")).concat(Array.from(document.getElementsByClassName("yt-simple-endpoint ytd-thumbnail"))); // Also try mobile

  if (links.length < 1) links = Array.from(document.querySelectorAll(".large-media-item-metadata > a, a.large-media-item-thumbnail-container"));
  var ids = links.filter(function (x) {
    return x.href && x.href.indexOf("/watch?v=") > 0;
  }).map(function (x) {
    return getVideoId(x.href);
  });
  getBrowser().runtime.sendMessage({
    message: "send_links",
    videoIds: ids
  });
}

function likeClicked() {
  if (checkForSignInButton() === false) {
    if (storedData.previousState === DISLIKED_STATE) {
      sendVote(1);
      storedData.dislikes--;
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(1);
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState = LIKED_STATE) {
      sendVote(0);
      storedData.likes--;
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = NEUTRAL_STATE;
    }
  }
}

function dislikeClicked() {
  if (checkForSignInButton() == false) {
    if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(-1);
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = DISLIKED_STATE;
    } else if (storedData.previousState === DISLIKED_STATE) {
      sendVote(0);
      storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = NEUTRAL_STATE;
    } else if (storedData.previousState === LIKED_STATE) {
      sendVote(-1);
      storedData.likes--;
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = DISLIKED_STATE;
    }
  }
}

function addLikeDislikeEventListener() {
  var buttons = buttons_getButtons();

  if (!window.returnDislikeButtonlistenersSet) {
    buttons.children[0].addEventListener("click", likeClicked);
    buttons.children[1].addEventListener("click", dislikeClicked);
    window.returnDislikeButtonlistenersSet = true;
  }
}

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(changes.disableVoteSubmission.newValue);
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
}


;// CONCATENATED MODULE: ./Extensions/combined/src/state.js




var LIKED_STATE = "LIKED_STATE";
var DISLIKED_STATE = "DISLIKED_STATE";
var NEUTRAL_STATE = "NEUTRAL_STATE";
var DISLIKES_DISABLED_TEXT = "DISLIKES DISABLED";
var extConfig = {
  disableVoteSubmission: false
};
var storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE
};
var likesDisabledState = true;

function isMobile() {
  return location.hostname == "m.youtube.com";
}

function isVideoLiked() {
  if (isMobile()) {
    return getLikeButton().querySelector("button").getAttribute("aria-label") == "true";
  }

  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  if (isMobile()) {
    return getDislikeButton().querySelector("button").getAttribute("aria-label") == "true";
  }

  return getDislikeButton().classList.contains("style-default-active");
}

function getState(storedData) {
  if (isVideoLiked()) {
    return {
      current: LIKED_STATE,
      previous: storedData.previousState
    };
  }

  if (isVideoDisliked()) {
    return {
      current: DISLIKED_STATE,
      previous: storedData.previousState
    };
  }

  return {
    current: NEUTRAL_STATE,
    previous: storedData.previousState
  };
} //---   Sets The Likes And Dislikes Values   ---//


function setLikes(likesCount) {
  getButtons().children[0].querySelector("#text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  if (!likesDisabledState) {
    if (isMobile()) {
      buttons_getButtons().children[1].querySelector(".button-renderer-text").innerText = dislikesCount;
      return;
    }

    buttons_getButtons().children[1].querySelector("#text").innerText = dislikesCount;
  } else {
    cLog("likes count diabled by creator");

    if (isMobile()) {
      buttons_getButtons().children[1].querySelector(".button-renderer-text").innerText = DISLIKES_DISABLED_TEXT;
      return;
    }

    buttons_getButtons().children[1].querySelector("#text").innerText = DISLIKES_DISABLED_TEXT;
  }
}

function getLikeCountFromButton() {
  var likesStr = getLikeButton().querySelector("button").getAttribute("aria-label").replace(/\D/g, "");
  return likesStr.length > 0 ? parseInt(likesStr) : false;
}

function processResponse(response, storedData) {
  var formattedDislike = numberFormat(response.dislikes);
  setDislikes(formattedDislike);
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = getLikeCountFromButton() || parseInt(response.likes);

  if (!likesDisabledState) {
    createRateBar(storedData.likes, storedData.dislikes);
  }
}

function setState(storedData) {
  storedData.previousState = isVideoDisliked() ? DISLIKED_STATE : isVideoLiked() ? LIKED_STATE : NEUTRAL_STATE;
  var statsSet = false;
  getBrowser().runtime.sendMessage({
    message: "set_state",
    videoId: getVideoId(window.location.href),
    state: getState(storedData).current,
    likeCount: getLikeCountFromButton() || null
  }, function (response) {
    cLog("response from api:");
    cLog(JSON.stringify(response));
    likesDisabledState = numberFormat(response.dislikes) == 0 && numberFormat(response.likes) == 0 && numberFormat(response.viewCount) == 0;

    if (response !== undefined && !("traceId" in response) && !statsSet) {
      processResponse(response, storedData);
    }
  });
}

function setInitialState() {
  setState(storedData);
  setTimeout(function () {
    sendVideoIds();
  }, 1500);
}

function initExtConfig() {
  initializeDisableVoteSubmission();
}

function initializeDisableVoteSubmission() {
  getBrowser().storage.sync.get(['disableVoteSubmission'], function (res) {
    if (res.disableVoteSubmission === undefined) {
      getBrowser().storage.sync.set({
        disableVoteSubmission: false
      });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}


;// CONCATENATED MODULE: ./Extensions/combined/src/buttons.js


function buttons_getButtons() {
  var _document$getElementB;

  if (isMobile()) {
    return document.querySelector(".slim-video-action-bar-actions");
  } //---   If Menu Element Is Displayed:   ---//


  if (((_document$getElementB = document.getElementById("menu-container")) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.offsetParent) === null) {
    return document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div"); //---   If Menu Element Isnt Displayed:   ---//
  } else {
    var _document$getElementB2;

    return (_document$getElementB2 = document.getElementById("menu-container")) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.querySelector("#top-level-buttons-computed");
  }
}

function getLikeButton() {
  return buttons_getButtons().children[0];
}

function getDislikeButton() {
  return buttons_getButtons().children[1];
}

function checkForSignInButton() {
  if (document.querySelector("a[href^='https://accounts.google.com/ServiceLogin']")) {
    return true;
  } else {
    return false;
  }
}


;// CONCATENATED MODULE: ./Extensions/combined/ryd.content-script.js
//---   Import Button Functions   ---//
 //---   Import State Functions   ---//

 //---   Import Video & Browser Functions   ---//




initExtConfig();
var jsInitChecktimer = null;

function setEventListeners(evt) {
  function checkForJS_Finish() {
    var _getButtons;

    if ((_getButtons = buttons_getButtons()) !== null && _getButtons !== void 0 && _getButtons.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      jsInitChecktimer = null;
      addLikeDislikeEventListener();
      setInitialState();
      getBrowser().storage.onChanged.addListener(storageChangeHandler);
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
}

setEventListeners();
document.addEventListener("yt-navigate-finish", function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false;
  setEventListeners();
});
setTimeout(function () {
  return sendVideoIds();
}, 2500);
/******/ })()
;