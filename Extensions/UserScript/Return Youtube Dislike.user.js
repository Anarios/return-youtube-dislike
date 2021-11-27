// ==UserScript==
// @name         Return YouTube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @version      0.5
// @description  Return of the YouTube Dislike, Based off https://www.returnyoutubedislike.com/
// @author       Anarios & JRWR
// @match      *://*.youtube.com/watch*
// @compatible chrome
// @compatible firefox
// @compatible opera
// @compatible safari
// @compatible edge
// @downloadURL https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @updateURL https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @grant GM.xmlHttpRequest
// ==/UserScript==
function cLog(text, subtext = '') {
  subtext = subtext.trim() === '' ? '' : `(${subtext})`;
  console.log(`[Return Youtube Dislikes] ${text} ${subtext}`);
}

function doXHR(opts) {
  if (typeof GM_xmlhttpRequest === 'function') {
    return GM_xmlhttpRequest(opts);
  }
  if (typeof GM !== 'undefined') /*This will prevent from throwing "Uncaught ReferenceError: GM is not defined"*/{ 
    if (typeof GM.xmlHttpRequest === 'function') {
      return GM.xmlHttpRequest(opts);
    }
  }

  console.warn('Unable to detect UserScript plugin, falling back to native XHR.');

  const xhr = new XMLHttpRequest();

  xhr.open(opts.method, opts.url, true);
  xhr.onload = () => opts.onload({
    response: JSON.parse(xhr.responseText),
  });
  xhr.onerror = err => console.error('XHR Failed', err);
  xhr.send();
}

function getButtons() {
  if (document.getElementById("menu-container").offsetParent === null) {
    return document.querySelector(
      "ytd-menu-renderer.ytd-watch-metadata > div"
    );
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
  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  return getDislikeButton().classList.contains("style-default-active");
}

function isVideoNotLiked() {
  return getLikeButton().classList.contains("style-text");
}

function isVideoNotDisliked() {
  return getDislikeButton().classList.contains("style-text");
}

function getState() {
  if (isVideoLiked()) {
    return "liked";
  }
  if (isVideoDisliked()) {
    return "disliked";
  }

  return "neutral";
}

function setLikes(likesCount) {
  getButtons().children[0].querySelector("#text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  getButtons().children[1].querySelector("#text").innerText = dislikesCount;
}

function createRateBar(likes, dislikes) {
  var rateBar = document.getElementById(
    "return-youtube-dislike-bar-container"
  );

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
  cLog('Fetching votes...');

  doXHR({
    method: "GET",
    responseType: "json",
    url:
      "https://return-youtube-dislike-api.azurewebsites.net/votes?videoId=" +
      getVideoId(),
    onload: function (xhr) {
      if (xhr != undefined) {
        const { dislikes, likes } = xhr.response;
        cLog(`Received count: ${dislikes}`);
        setDislikes(numberFormat(dislikes));
        createRateBar(likes, dislikes);
      }
    },
  });
}

function likeClicked() {
  cLog('Like clicked', getState());
  setState();
}

function dislikeClicked() {
  cLog('Dislike clicked', getState());
  setState();
}

function setInitalState() {
  setState();
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("v");

  return videoId;
}

function isVideoLoaded() {
  const videoId = getVideoId();

  return (
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null
  );
}

function numberFormat(numberState) {
  const userLocales = navigator.language;
  const formatter = Intl.NumberFormat(userLocales, { notation: "compact" });

  return formatter.format(numberState);
}

function setEventListeners(evt) {
  function checkForJS_Finish() {
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      const buttons = getButtons();

      if (!window.returnDislikeButtonlistenersSet) {
        cLog('Registering button listeners...');
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        window.returnDislikeButtonlistenersSet = true;
      }
      setInitalState();
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    cLog('Setting up...');
    var jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
}

(function () {
  "use strict";
  window.addEventListener("yt-navigate-finish", setEventListeners, true);
  setEventListeners();
})();
