import { isMobile } from "./state";

function getButtons() {
  if (isMobile()) {
    return document.querySelector(".slim-video-action-bar-actions");
  }
  //---   If Menu Element Is Displayed:   ---//
  if (document.getElementById("menu-container")?.offsetParent === null) {
    return document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div");
    //---   If Menu Element Isnt Displayed:   ---//
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

function checkForSignInButton() {
  if (
    document.querySelector(
      "a[href^='https://accounts.google.com/ServiceLogin']"
    )
  ) {
    return true;
  } else {
    return false;
  }
}

export {
  getButtons,
  getLikeButton,
  getDislikeButton,
  checkForSignInButton,
};
