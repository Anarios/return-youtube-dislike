import { isMobile, isShorts } from "./state";
import { isInViewport } from "./utils";

function getButtons() {
  //---   If Watching Youtube Shorts:   ---//
  if (isShorts()) {
    let elements = document.querySelectorAll(
      isMobile()
        ? "ytm-like-button-renderer"
        : "#like-button > ytd-like-button-renderer"
    );
    for (let element of elements) {
      //Youtube Shorts can have multiple like/dislike buttons when scrolling through videos
      //However, only one of them should be visible (no matter how you zoom)
      if (isInViewport(element)) {
        return element;
      }
    }
  }
  //---   If Watching On Mobile:   ---//
  if (isMobile()) {
    return document.querySelector(".slim-video-action-bar-actions");
  }
  //---   If Menu Element Is Displayed:   ---//
  if (document.getElementById("menu-container")?.offsetParent === null) {
    return document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div");
    //---   If Menu Element Isn't Displayed:   ---//
  } else {
    return document
      .getElementById("menu-container")
      ?.querySelector("#top-level-buttons-computed");
  }
}

function getLikeButton() {
  return getButtons().children[0].tagName ===
    "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? document.querySelector("#segmented-like-button") !== null ? document.querySelector("#segmented-like-button") : getButtons().children[0].children[0]
    : getButtons().querySelector("like-button-view-model") ?? getButtons().children[0];
}

function getLikeTextContainer() {
  return (
    getLikeButton().querySelector("#text") ??
    getLikeButton().getElementsByTagName("yt-formatted-string")[0] ??
    getLikeButton().querySelector("span[role='text']")
  );
}

function getDislikeButton() {
  if (getButtons().children[0].tagName === 'YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER') {
    if (getButtons().children[0].children[1] === undefined) {
      return document.querySelector('#segmented-dislike-button');
    } else {
      return getButtons().children[0].children[1];
    }
  } else {
    if (getButtons().querySelector("dislike-button-view-model")) {
      return getButtons().querySelector("dislike-button-view-model");
    } else {
      return getButtons().children[1];
    }
  }
}

function createDislikeTextContainer() {
  const textNodeClone = (getLikeButton().querySelector("button > div[class*='cbox']") || (getLikeButton().querySelector('div > span[role="text"]') || document.querySelector('button > div.yt-spec-button-shape-next__button-text-content > span[role="text"]')).parentNode).cloneNode(true);
  const insertPreChild = getDislikeButton().querySelector("yt-touch-feedback-shape");
  getDislikeButton().querySelector("button").insertBefore(textNodeClone, insertPreChild);
  getDislikeButton().querySelector("button").classList.remove("yt-spec-button-shape-next--icon-button");
  getDislikeButton().querySelector("button").classList.add("yt-spec-button-shape-next--icon-leading");
  if(textNodeClone.querySelector("span[role='text']") === null) {
    const span = document.createElement("span");
    span.setAttribute("role", "text");
    while(textNodeClone.firstChild){
      textNodeClone.removeChild(textNodeClone.firstChild);
    }
    textNodeClone.appendChild(span);
  }
  textNodeClone.querySelector("span[role='text']").innerText = "";
  return textNodeClone.querySelector("span[role='text']");
}

function getDislikeTextContainer() {
  let result =
    getDislikeButton().querySelector("#text") ??
    getDislikeButton().getElementsByTagName("yt-formatted-string")[0] ??
    getDislikeButton().querySelector("span[role='text']");
  if (result == null) {
    result = createDislikeTextContainer();
  }
  return result;
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
  getLikeTextContainer,
  getDislikeTextContainer,
  checkForSignInButton,
};
