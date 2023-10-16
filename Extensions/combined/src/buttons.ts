import { isMobile, isShorts } from "./state";
import { isInViewport } from "./utils";

function getButtons() {
  //---   If Watching Youtube Shorts:   ---//
  if (isShorts()) {
    let elements: NodeListOf<HTMLElement>;
    if (isMobile()) {
      elements = document.querySelectorAll("ytm-like-button-renderer");
    } else {
      elements = document.querySelectorAll(
        "#like-button > ytd-like-button-renderer"
      );
    }
    for (let element of Array.from(elements)) {
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

function getLikeButton(): HTMLElement | undefined {
  const buttons = getButtons();
  if (!buttons) {
    console.error("buttons not found");
    return;
  }

  const children = buttons.children;
  if (children.length === 0) {
    console.error("like button not found");
    return;
  }

  const firstChild = children[0] as HTMLElement;
  if (firstChild.tagName === "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER") {
    const segmentedLikeButton = document.getElementById(
      "segmented-like-button"
    );
    if (segmentedLikeButton) {
      return segmentedLikeButton;
    }

    const grandChildren = firstChild.children;
    if (grandChildren.length > 0) {
      return grandChildren[0] as HTMLElement;
    }
  } else {
    return firstChild;
  }
  console.error("like button not found");
  return;
}

function getLikeTextContainer() {
  return (
    getLikeButton()?.querySelector("#text") ??
    getLikeButton()?.getElementsByTagName("yt-formatted-string")[0] ??
    getLikeButton()?.querySelector("span[role='text']")
  );
}

function getDislikeButton() {
  const buttons = getButtons();
  if (!buttons) {
    console.error("buttons not found");
    return;
  }

  const children = buttons.children;
  if (children.length === 0) {
    console.error("dislike button not found");
    return;
  }

  const firstChild = children[0] as HTMLElement;
  if (firstChild.tagName === "YTD-SEGMENTED-LIKE-DISLIKE-BUTTON-RENDERER") {
    const segmentedDislikeButton = document.getElementById(
      "segmented-dislike-button"
    );
    if (segmentedDislikeButton) {
      return segmentedDislikeButton;
    }

    const grandChildren = firstChild.children;
    if (grandChildren.length > 0) {
      return grandChildren[1] as HTMLElement;
    }
  } else {
    return children[1] as HTMLElement;
  }
  console.error("dislike button not found");
  return;
}

function createDislikeTextContainer() {
  const textNodeClone = (
    getLikeButton() || getLikeButton()?.parentNode
  )?.cloneNode(true);
  const insertPreChild = getDislikeButton()?.querySelector(
    "yt-touch-feedback-shape"
  );
  if (textNodeClone && insertPreChild) {
    getDislikeButton()
      ?.querySelector("button")
      ?.insertBefore(textNodeClone, insertPreChild);
  }
  getDislikeButton()
    ?.querySelector("button")
    ?.classList.remove("yt-spec-button-shape-next--icon-button");
  getDislikeButton()
    ?.querySelector("button")
    ?.classList.add("yt-spec-button-shape-next--icon-leading");
  if ((textNodeClone as any).querySelector("span[role='text']") === null) {
    const span = document.createElement("span");
    span.setAttribute("role", "text");
    while (textNodeClone?.firstChild) {
      textNodeClone.removeChild(textNodeClone.firstChild);
    }
    textNodeClone?.appendChild(span);
  }
  (textNodeClone as any).querySelector("span[role='text']").innerText = "";
  return (textNodeClone as any).querySelector("span[role='text']");
}

function getDislikeTextContainer() {
  let result =
    getDislikeButton()?.querySelector("#text") ??
    getDislikeButton()?.getElementsByTagName("yt-formatted-string")[0] ??
    getDislikeButton()?.querySelector("span[role='text']");
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
