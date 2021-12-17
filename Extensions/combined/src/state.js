import { getLikeButton, getDislikeButton, getButtons } from "./buttons";

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

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
  if (isMobile()) {
    getButtons().children[1].querySelector(".button-renderer-text").innerText =
      dislikesCount;
    return;
  }
  getButtons().children[1].querySelector("#text").innerText = dislikesCount;
}

function getLikeCountFromButton() {
  let likesStr = getLikeButton()
    .querySelector("button")
    .getAttribute("aria-label")
    .replace(/\D/g, "");
  return likesStr.length > 0 ? parseInt(likesStr) : false;
}

export {
  isMobile,
  isVideoDisliked,
  isVideoLiked,
  getState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
};
