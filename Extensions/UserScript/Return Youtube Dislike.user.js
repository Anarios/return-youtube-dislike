// ==UserScript==
// @name         Return Youtube Dislike
// @namespace    https://www.returnyoutubedislike.com/
// @version      0.2
// @description  Return of the Youtube Dislike, Based off https://www.returnyoutubedislike.com/
// @author       Anarios & JRWR
// @match        *://*.youtube.com/*
// @include      *://*.youtube.com/*
// @compatible chrome
// @compatible firefox
// @compatible opera
// @compatible safari
// @compatible edge
// @downloadURL https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @updateURL https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js
// @grant GM_xmlhttpRequest
// ==/UserScript==
function getButtons() {
  return document
    .getElementById("menu-container")
    ?.querySelector("#top-level-buttons-computed");
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

function setState() {
  GM_xmlhttpRequest({
    method: "GET",
    responseType: "json",
    url:
      "https://return-youtube-dislike-api.azurewebsites.net/votes?videoId=" +
      getVideoId(),
    onload: function (response) {
      if (response != undefined) {
        const formattedDislike = numberFormat(response.response.dislikes);
        console.log(response);
        setDislikes(formattedDislike);
      }
    },
  });
}

function likeClicked() {
  console.log("like" + getState());
  setState();
}

function dislikeClicked() {
  console.log("dislike" + getState());
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
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        window.returnDislikeButtonlistenersSet = true;
      }
      setInitalState();
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    var jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
}

(function () {
  "use strict";
  window.addEventListener("yt-navigate-finish", setEventListeners, true);
  setEventListeners();
})();
