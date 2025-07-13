import { isMobile, isShorts, extConfig } from "./state";
import { isInViewport, querySelector, querySelectorAll } from "./utils";

function getButtons() {
  //---   If Watching Youtube Shorts:   ---//
  if (isShorts()) {
    let elements = isMobile()
      ? querySelectorAll(extConfig.selectors.buttons.shorts.mobile)
      : querySelectorAll(extConfig.selectors.buttons.shorts.desktop);

    for (let element of elements) {
      //YouTube Shorts can have multiple like/dislike buttons when scrolling through videos
      //However, only one of them should be visible (no matter how you zoom)
      if (isInViewport(element)) {
        return element;
      }
    }
  }
  //---   If Watching On Mobile:   ---//
  if (isMobile()) {
    return document.querySelector(extConfig.selectors.buttons.regular.mobile);
  }
  //---   If Menu Element Is Displayed:   ---//
  if (querySelector(extConfig.selectors.menuContainer)?.offsetParent === null) {
    return querySelector(extConfig.selectors.buttons.regular.desktopMenu);
    //---   If Menu Element Isn't Displayed:   ---//
  } else {
    return querySelector(extConfig.selectors.buttons.regular.desktopNoMenu);
  }
}

function getLikeButton() {
  return getButtons().children[0].tagName ===
    "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? querySelector(extConfig.selectors.buttons.likeButton.segmented) ??
        querySelector(
          extConfig.selectors.buttons.likeButton.segmentedGetButtons,
          getButtons(),
        )
    : querySelector(
        extConfig.selectors.buttons.likeButton.notSegmented,
        getButtons(),
      );
}

function getLikeTextContainer() {
  return querySelector(extConfig.selectors.likeTextContainer, getLikeButton());
}

function getDislikeButton() {
  return getButtons().children[0].tagName ===
    "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER"
    ? querySelector(extConfig.selectors.buttons.dislikeButton.segmented) ??
        querySelector(
          extConfig.selectors.buttons.dislikeButton.segmentedGetButtons,
          getButtons(),
        )
    : isShorts()
      ? querySelector(["#dislike-button"], getButtons())
      : querySelector(
          extConfig.selectors.buttons.dislikeButton.notSegmented,
          getButtons(),
        );
}

function createDislikeTextContainer() {
  const textNodeClone = (
    getLikeButton().querySelector(
      ".yt-spec-button-shape-next__button-text-content",
    ) ||
    getLikeButton().querySelector("button > div[class*='cbox']") ||
    (
      getLikeButton().querySelector('div > span[role="text"]') ||
      document.querySelector(
        'button > div.yt-spec-button-shape-next__button-text-content > span[role="text"]',
      )
    ).parentNode
  ).cloneNode(true);
  const insertPreChild = getDislikeButton().querySelector("button");
  insertPreChild.insertBefore(textNodeClone, null);
  getDislikeButton()
    .querySelector("button")
    .classList.remove("yt-spec-button-shape-next--icon-button");
  getDislikeButton()
    .querySelector("button")
    .classList.add("yt-spec-button-shape-next--icon-leading");
  if (textNodeClone.querySelector("span[role='text']") === null) {
    const span = document.createElement("span");
    span.setAttribute("role", "text");
    while (textNodeClone.firstChild) {
      textNodeClone.removeChild(textNodeClone.firstChild);
    }
    textNodeClone.appendChild(span);
  }
  textNodeClone.innerText = "";
  return textNodeClone;
}

function getDislikeTextContainer() {
  let result;
  for (const selector of extConfig.selectors.dislikeTextContainer) {
    result = getDislikeButton().querySelector(selector);
    if (result !== null) {
      break;
    }
  }
  if (result == null) {
    result = createDislikeTextContainer();
  }
  return result;
}

function checkForSignInButton() {
  if (
    document.querySelector(
      "a[href^='https://accounts.google.com/ServiceLogin']",
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
