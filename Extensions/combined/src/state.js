import { getLikeButton, getDislikeButton, getButtons } from "./buttons";
import { createRateBar } from "./bar";
import { getBrowser, getVideoId, cLog, numberFormat } from "./utils";
import { sendVideoIds } from "./events";

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

const DISLIKES_DISABLED_TEXT = "DISLIKES DISABLED"

let extConfig = {
  disableVoteSubmission: false,
};

let storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
};

let likesDisabledState = true;

function isMobile() {
  return location.hostname == "m.youtube.com";
}

function isVideoLiked() {
  if (isMobile()) {
    return (
      getLikeButton().querySelector("button").getAttribute("aria-label") ==
      "true"
    );
  }
  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  if (isMobile()) {
    return (
      getDislikeButton().querySelector("button").getAttribute("aria-label") ==
      "true"
    );
  }
  return getDislikeButton().classList.contains("style-default-active");
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
  getButtons().children[0].querySelector("#text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  if(!likesDisabledState) {
    if (isMobile()) {
      getButtons().children[1].querySelector(".button-renderer-text").innerText =
        dislikesCount;
      return;
    }
    getButtons().children[1].querySelector("#text").innerText = dislikesCount;
  } else {
    cLog("likes count diabled by creator");
    if (isMobile()) {
      getButtons().children[1].querySelector(".button-renderer-text").innerText =
      DISLIKES_DISABLED_TEXT;
      return;
    }
    getButtons().children[1].querySelector("#text").innerText = DISLIKES_DISABLED_TEXT;
  }
}

function getLikeCountFromButton() {
  let likesStr = getLikeButton()
    .querySelector("button")
    .getAttribute("aria-label")
    .replace(/\D/g, "");
  return likesStr.length > 0 ? parseInt(likesStr) : false;
}

function processResponse(response, storedData) {
  const formattedDislike = numberFormat(response.dislikes);
  setDislikes(formattedDislike);
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = getLikeCountFromButton() || parseInt(response.likes);
  if(!likesDisabledState) {
    createRateBar(storedData.likes, storedData.dislikes);
  }
}

function setState(storedData) {
  storedData.previousState = isVideoDisliked()
    ? DISLIKED_STATE
    : isVideoLiked()
    ? LIKED_STATE
    : NEUTRAL_STATE;
  let statsSet = false;

  getBrowser().runtime.sendMessage(
    {
      message: "set_state",
      videoId: getVideoId(window.location.href),
      state: getState(storedData).current,
      likeCount: getLikeCountFromButton() || null,
    },
    function (response) {
      cLog("response from api:");
      cLog(JSON.stringify(response));
      likesDisabledState = numberFormat(response.dislikes) == 0 && numberFormat(response.likes) == 0 && numberFormat(response.viewCount) == 0;
      if (response !== undefined && !("traceId" in response) && !statsSet) {
        processResponse(response, storedData);
      }
    }
  );
}

function setInitialState() {
  setState(storedData);
  setTimeout(() => {
    sendVideoIds();
  }, 1500);
}

function initExtConfig() {
  initializeDisableVoteSubmission();
}

function initializeDisableVoteSubmission() {
  getBrowser().storage.sync.get(['disableVoteSubmission'], (res) => {
    if (res.disableVoteSubmission === undefined) {
      getBrowser().storage.sync.set({disableVoteSubmission: false});
    }
    else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}

export {
  isMobile,
  isVideoDisliked,
  isVideoLiked,
  getState,
  setState,
  setInitialState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  extConfig,
  initExtConfig,
  storedData,
  likesDisabledState,
};
