// ==UserScript==
// @name         Return YouTube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @homepage     https://www.returnyoutubedislike.com/
// @version      0.6.1
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
const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

var isMobile = (location.hostname == "m.youtube.com");
var mobileDislikes = 0;
function cLog(text, subtext = '') {
  subtext = subtext.trim() === '' ? '' : `(${subtext})`;
  console.log(`[Return YouTube Dislikes] ${text} ${subtext}`);
}

function getButtons() {
  if (isMobile) {
    return document.querySelector(".slim-video-action-bar-actions");
  }
  if (document.getElementById("menu-container").offsetParent === null) {
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

function isVideoLiked() {
  if (isMobile) {
    return getLikeButton().querySelector("button").getAttribute("aria-label") == "true";
  }
  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  if (isMobile) {
    return getDislikeButton().querySelector("button").getAttribute("aria-label") == "true";
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
    getButtons().children[0].querySelector(".button-renderer-text").innerText = likesCount;
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

(typeof GM_addStyle != 'undefined'
 ? GM_addStyle
 : styles => {
  var styleNode = document.createElement("style")
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
  var rateBar = document.getElementById("return-youtube-dislike-bar-container");

  const widthPx =
    getButtons().children[0].clientWidth +
    getButtons().children[1].clientWidth +
    8;

  const widthPercent =
    likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  if (!rateBar) {
    document.getElementById("menu-container").insertAdjacentHTML(
      "beforeend",
      `
        <div class="ryd-tooltip" style="width: ${widthPx}px">
        <div class="ryd-tooltip-bar-container">
           <div
              id="return-youtube-dislike-bar-container"
              style="width: 100%; height: 2px;"
              >
              <div
                 id="return-youtube-dislike-bar"
                 style="width: ${widthPercent}%; height: 100%"
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
  }
}

function setState() {
  cLog("Fetching votes...");
  let statsSet = false;
  if (isMobile) {
    GM.xmlHttpRequest({
      method: "GET",
      url: `https://youtube.com/watch?v=${getVideoId()}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.3674"
      },
      onload: (response) => {
        let result = getDislikesFromYoutubeResponse(response.responseText);
        if (result) {
          cLog("response from youtube:");
          cLog(JSON.stringify(result));
          if (result.likes && result.dislikes) {
            const formattedDislike = numberFormat(result.dislikes);
            setDislikes(formattedDislike);
            createRateBar(result.likes, result.dislikes);
            statsSet = true;
          }
        }
      }
    });
  }
  else {
    fetch(`https://youtube.com/watch?v=${getVideoId()}`).then((response) => {
      response.text().then((text) => {
        let result = getDislikesFromYoutubeResponse(text);
        if (result) {
          cLog("response from youtube:");
          cLog(JSON.stringify(result));
          if (result.likes && result.dislikes) {
            const formattedDislike = numberFormat(result.dislikes);
            setDislikes(formattedDislike);
            createRateBar(result.likes, result.dislikes);
            statsSet = true;
          }
        }
      });
    });
  }

  fetch(
    `https://returnyoutubedislikeapi.com/votes?videoId=${getVideoId()}`
  ).then((response) => {
    response.json().then((json) => {
      if (json && !statsSet) {
        const { dislikes, likes } = json;
        cLog(`Received count: ${dislikes}`);
        setDislikes(numberFormat(dislikes));
        createRateBar(likes, dislikes);
      }
    });
  });
}

function likeClicked() {
  cLog("Like clicked", getState());
  setState();
}

function dislikeClicked() {
  cLog("Dislike clicked", getState());
  setState();
}

function setInitialState() {
  setState();
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("v");

  return videoId;
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
  const userLocales = document.documentElement.lang;

  const formatter = Intl.NumberFormat(userLocales, {
    notation: "compact",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return formatter.format(roundDown(numberState)).replace(/\.0|,0/, "");
}

function getDislikesFromYoutubeResponse(htmlResponse) {
  let start =
    htmlResponse.indexOf('"videoDetails":') + '"videoDetails":'.length;
  let end =
    htmlResponse.indexOf('"isLiveContent":false}', start) +
    '"isLiveContent":false}'.length;
  if (end < start) {
    end =
      htmlResponse.indexOf('"isLiveContent":true}', start) +
      '"isLiveContent":true}'.length;
  }
  let jsonStr = htmlResponse.substring(start, end);
  let jsonResult = JSON.parse(jsonStr);
  let rating = jsonResult.averageRating;

  start = htmlResponse.indexOf('"topLevelButtons":[', end);
  start =
    htmlResponse.indexOf('"accessibilityData":', start) +
    '"accessibilityData":'.length;
  end = htmlResponse.indexOf("}", start);
  let likes = +htmlResponse.substring(start, end).replace(/\D/g, "");
  let dislikes = (likes * (5 - rating)) / (rating - 1);
  let result = {
    likes,
    dislikes: Math.round(dislikes),
    rating,
    viewCount: +jsonResult.viewCount,
  };
  return result;
}

function setEventListeners(evt) {
  function checkForJS_Finish(check) {
    console.log()
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      const buttons = getButtons();

      if (!window.returnDislikeButtonlistenersSet) {
        cLog("Registering button listeners...");
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        window.returnDislikeButtonlistenersSet = true;
      }
      setInitialState();
    }
  }

  if (window.location.href.indexOf("watch?") >= 0 || (isMobile && evt?.indexOf("watch?") >= 0)) {
    cLog("Setting up...");
    var jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
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
  }
  setInterval(() => {
    getDislikeButton().querySelector(".button-renderer-text").innerText = mobileDislikes;
  }, 1000);
}
