import { isMobile, isShorts, extConfig } from "./state";
import { isInViewport, querySelector, querySelectorAll } from "./utils";
import { getShortsDislikeControl } from "./shortsDislike";

function getNativeButton(buttonContainer) {
  return querySelector(extConfig.selectors.buttons.nativeButton, buttonContainer);
}

function isSegmentedButtonLayout() {
  return querySelector(extConfig.selectors.buttons.segmentedContainer, getButtons()) !== undefined;
}

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

    if (elements.length > 0) {
      return elements[0];
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
  return isSegmentedButtonLayout()
    ? querySelector(extConfig.selectors.buttons.likeButton.segmented) ??
        querySelector(extConfig.selectors.buttons.likeButton.segmentedGetButtons, getButtons())
    : querySelector(extConfig.selectors.buttons.likeButton.notSegmented, getButtons());
}

function getLikeTextContainer() {
  return querySelector(extConfig.selectors.likeTextContainer, getLikeButton());
}

function getDislikeButton() {
  if (isShorts()) {
    const owned = getShortsDislikeControl();
    if (owned) return owned.button;
  }

  if (isSegmentedButtonLayout()) {
    return (
      querySelector(extConfig.selectors.buttons.dislikeButton.segmented) ??
      querySelector(extConfig.selectors.buttons.dislikeButton.segmentedGetButtons, getButtons())
    );
  }

  const notSegmentedMatch = querySelector(extConfig.selectors.buttons.dislikeButton.notSegmented, getButtons());

  if (notSegmentedMatch != null) {
    return notSegmentedMatch;
  }

  if (isShorts()) {
    return querySelector(extConfig.selectors.buttons.dislikeButton.shortsFallback, getButtons());
  }

  return null;
}

function getTextContainerTemplate() {
  const likeButton = getLikeButton();
  const parentTemplate =
    querySelector(extConfig.selectors.likeTextContainerTemplateParent, likeButton) ??
    querySelector(extConfig.selectors.likeTextContainerTemplateParent);

  return querySelector(extConfig.selectors.likeTextContainerTemplate, likeButton) ?? parentTemplate?.parentNode;
}

function updateDislikeButtonShape(dislikeButton) {
  for (const className of extConfig.selectors.buttonClasses.iconButton) {
    dislikeButton.classList.remove(className);
  }

  for (const className of extConfig.selectors.buttonClasses.iconLeading) {
    dislikeButton.classList.add(className);
  }
}

// Removes text written directly into an element (i.e. non-empty direct text
// node children), leaving child elements untouched. YouTube's server-side
// "dirty fix" injects the dislike count straight into the icon button via
// `innerText`, which both shows a stray number and wipes the icon; this lets us
// strip that so our own text container is the single source of the count.
function removeStrayButtonText(element) {
  if (!element) return;
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
      element.removeChild(node);
    }
  }
}

function createDislikeTextContainer() {
  const textNodeClone = getTextContainerTemplate().cloneNode(true);
  const dislikeButton = getNativeButton(getDislikeButton());
  const insertPreChild = dislikeButton;
  removeStrayButtonText(dislikeButton);
  insertPreChild.insertBefore(textNodeClone, null);
  updateDislikeButtonShape(dislikeButton);
  if (querySelector(extConfig.selectors.textContainerInner, textNodeClone) === undefined) {
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
  if (isShorts()) {
    const owned = getShortsDislikeControl();
    if (owned) return owned.count;
  }

  let result;
  const nativeDislikeButton = getNativeButton(getDislikeButton());
  for (const selector of extConfig.selectors.dislikeTextContainer) {
    result = getDislikeButton().querySelector(selector);
    if (result !== null && result !== nativeDislikeButton) {
      break;
    }
    result = null;
  }
  if (result == null) {
    result = createDislikeTextContainer();
  }
  // If the count ends up in a dedicated child container, make sure no count
  // also got written directly into the button (e.g. by the server-side dirty
  // fix), which would render as a duplicate number beside our container.
  if (nativeDislikeButton && result !== nativeDislikeButton) {
    removeStrayButtonText(nativeDislikeButton);
  }
  return result;
}

function checkForSignInButton() {
  if (querySelector(extConfig.selectors.signInButton)) {
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
