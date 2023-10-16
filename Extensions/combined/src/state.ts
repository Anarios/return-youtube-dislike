import { createRateBar } from "./bar";
import {
  getButtons,
  getDislikeButton,
  getDislikeTextContainer,
  getLikeButton,
  getLikeTextContainer,
} from "./buttons";
import { ExtConfig, StoredData } from "./types";
import {
  cLog,
  getBrowser,
  getColorFromTheme,
  getVideoId,
  localize,
  numberFormat,
} from "./utils";

//TODO: Do not duplicate here and in ryd.background.js
const apiUrl = "https://returnyoutubedislikeapi.com";
const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

let extConfig: ExtConfig = {
  disableVoteSubmission: false,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic",
  numberDisplayFormat: "compactShort",
  showTooltipPercentage: false,
  tooltipPercentageMode: "dash_like",
  numberDisplayReformatLikes: false,
};

let storedData: StoredData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
};

function isMobile() {
  return location.hostname == "m.youtube.com";
}

function isShorts() {
  return location.pathname.startsWith("/shorts");
}

function isNewDesign() {
  return document.getElementById("comment-teaser") !== null;
}

function isRoundedDesign() {
  return document.getElementById("segmented-like-button") !== null;
}

class MutationObserverWrapper extends Object {
  options: MutationObserverInit;
  exists: boolean;
  observer: MutationObserver;
}

let mutationObserver = new MutationObserverWrapper();

if (isShorts() && mutationObserver.exists !== true) {
  cLog("initializing mutation observer");
  mutationObserver.options = {
    childList: false,
    attributes: true,
    subtree: false,
  };
  mutationObserver.exists = true;
  mutationObserver.observer = new MutationObserver(function (mutationList) {
    mutationList.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.target.nodeName === "TP-YT-PAPER-BUTTON" &&
        (mutation.target as HTMLElement).id === "button"
      ) {
        // cLog('Short thumb button status changed');
        if (
          (mutation.target as HTMLElement).getAttribute("aria-pressed") ===
          "true"
        ) {
          (mutation.target as HTMLElement).style.color =
            (mutation.target as HTMLElement)?.parentElement?.parentElement
              ?.id === "like-button"
              ? getColorFromTheme(true)
              : getColorFromTheme(false);
        } else {
          (mutation.target as HTMLElement).style.color = "unset";
        }
        return;
      }
      cLog(
        "unexpected mutation observer event: " + mutation.target + mutation.type
      );
    });
  });
}

function isLikesDisabled() {
  // return true if the like button's text doesn't contain any number
  if (isMobile()) {
    return /^\D*$/.test(
      (
        getButtons()?.children[0]?.querySelector(
          ".button-renderer-text"
        ) as HTMLElement
      )?.innerText
    );
  }
  return /^\D*$/.test((getButtons()?.children[0] as HTMLElement)?.innerText);
}

function isVideoLiked() {
  if (isMobile()) {
    return (
      getLikeButton()?.querySelector("button")?.getAttribute("aria-label") ===
      "true"
    );
  }
  return (
    getLikeButton()?.classList.contains("style-default-active") ||
    getLikeButton()?.querySelector("button")?.getAttribute("aria-pressed") ===
      "true"
  );
}

function isVideoDisliked() {
  if (isMobile()) {
    return (
      getDislikeButton()
        ?.querySelector("button")
        ?.getAttribute("aria-label") === "true"
    );
  }
  return (
    getDislikeButton()?.classList.contains("style-default-active") ||
    getDislikeButton()
      ?.querySelector("button")
      ?.getAttribute("aria-pressed") === "true"
  );
}

function getState(storedData: {
  likes: number;
  dislikes: number;
  previousState: string;
}) {
  if (isVideoLiked()) {
    return { current: LIKED_STATE, previous: storedData.previousState };
  }
  if (isVideoDisliked()) {
    return { current: DISLIKED_STATE, previous: storedData.previousState };
  }
  return { current: NEUTRAL_STATE, previous: storedData.previousState };
}

//---   Sets The Likes And Dislikes Values   ---//
function setLikes(likesCount: string) {
  cLog(`SET likes ${likesCount}`);
  const likeTextContainer = getLikeTextContainer() as HTMLElement;
  if (!likeTextContainer) {
    console.error("likeTextContainer not found");
    return;
  }
  likeTextContainer.innerText = likesCount;
}

function setDislikes(dislikesCount: string) {
  cLog(`SET dislikes ${dislikesCount}`);
  getDislikeTextContainer()?.removeAttribute("is-empty");
  getDislikeTextContainer()?.removeAttribute("is-empty");
  if (!isLikesDisabled()) {
    if (isMobile()) {
      const buttons = getButtons();
      if (!buttons) {
        console.error("buttons not found");
        return;
      }

      const children = buttons.children;
      if (children.length === 0) {
        console.error("buttons children not found");
        return;
      }

      const secondChild = children[1] as HTMLElement;
      if (!secondChild) {
        console.error("secondChild not found");
        return;
      }

      const buttonRendererText = secondChild.querySelector(
        ".button-renderer-text"
      ) as HTMLElement;
      if (!buttonRendererText) {
        console.error("buttonRendererText not found");
        return;
      }

      buttonRendererText.innerText = dislikesCount;
      return;
    }
    const dislikeTextContainer = getDislikeTextContainer() as HTMLElement;
    if (!dislikeTextContainer) {
      console.error("dislikeTextContainer not found");
      return;
    }

    dislikeTextContainer.innerText = dislikesCount;
  } else {
    cLog("likes count disabled by creator");
    if (isMobile()) {
      const buttons = getButtons();
      if (!buttons) {
        console.error("buttons not found");
        return;
      }

      const children = buttons.children;
      if (children.length === 0) {
        console.error("buttons children not found");
        return;
      }

      const secondChild = children[1] as HTMLElement;
      if (!secondChild) {
        console.error("secondChild not found");
        return;
      }

      const buttonRendererText = secondChild.querySelector(
        ".button-renderer-text"
      ) as HTMLElement;
      if (!buttonRendererText) {
        console.error("buttonRendererText not found");
        return;
      }

      buttonRendererText.innerText = localize("TextLikesDisabled");
      return;
    }
    const dislikeTextContainer = getDislikeTextContainer() as HTMLElement;
    if (!dislikeTextContainer) {
      console.error("dislikeTextContainer not found");
      return;
    }
    dislikeTextContainer.innerText = localize("TextLikesDisabled");
  }
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }

    let likeButton =
      getLikeButton()?.querySelector("yt-formatted-string#text") ??
      getLikeButton()?.querySelector("button");

    let likesStr = likeButton?.getAttribute("aria-label")?.replace(/\D/g, "");
    if (!likesStr) {
      return false;
    }

    const likeStrLength = likesStr?.length;
    if (!likeStrLength) {
      return false;
    }

    return likeStrLength > 0 ? parseInt(likesStr) : false;
  } catch {
    return false;
  }
}

function processResponse(response: any, storedData: StoredData) {
  const formattedDislike = numberFormat(response.dislikes);
  setDislikes(formattedDislike);
  if (extConfig.numberDisplayReformatLikes === true) {
    const nativeLikes = getLikeCountFromButton();
    if (nativeLikes !== false) {
      setLikes(numberFormat(nativeLikes));
    }
  }
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = getLikeCountFromButton() || parseInt(response.likes);
  createRateBar(storedData.likes, storedData.dislikes);
  if (extConfig.coloredThumbs === true) {
    if (isShorts()) {
      // for shorts, leave deactivated buttons in default color
      const shortLikeButton = getLikeButton()?.querySelector(
        "tp-yt-paper-button#button"
      ) as HTMLElement;
      if (!shortLikeButton) {
        console.error("shortLikeButton not found");
        return;
      }

      const shortDislikeButton = getDislikeButton()?.querySelector(
        "tp-yt-paper-button#button"
      ) as HTMLElement;
      if (!shortDislikeButton) {
        console.error("shortDislikeButton not found");
        return;
      }

      if (shortLikeButton?.getAttribute("aria-pressed") === "true") {
        shortLikeButton.style.color = getColorFromTheme(true);
      }
      if (shortDislikeButton?.getAttribute("aria-pressed") === "true") {
        shortDislikeButton.style.color = getColorFromTheme(false);
      }

      mutationObserver.observer.observe(
        shortLikeButton,
        mutationObserver.options
      );
      mutationObserver.observer.observe(
        shortDislikeButton,
        mutationObserver.options
      );
    } else {
      const likeButton = getLikeButton();
      if (!likeButton) {
        console.error("likeButton not found");
        return;
      }

      const dislikeButton = getDislikeButton();
      if (!dislikeButton) {
        console.error("dislikeButton not found");
        return;
      }

      likeButton.style.color = getColorFromTheme(true);
      dislikeButton.style.color = getColorFromTheme(false);
    }
  }
  //Temporary disabling this - it breaks all places where getButtons()[1] is used
  // createStarRating(response.rating, isMobile());
}

// Tells the user if the API is down
function displayError() {
  const dislikeTextContainer = getDislikeTextContainer() as HTMLElement;
  if (!dislikeTextContainer) {
    console.error("dislikeTextContainer not found");
    return;
  }
  dislikeTextContainer.innerText = localize("textTempUnavailable");
}

async function setState(storedData: StoredData) {
  storedData.previousState = isVideoDisliked()
    ? DISLIKED_STATE
    : isVideoLiked()
    ? LIKED_STATE
    : NEUTRAL_STATE;
  let statsSet = false;

  let videoId = getVideoId(window.location.href);
  let likeCount = getLikeCountFromButton() || null;

  let response = await fetch(
    `${apiUrl}/votes?videoId=${videoId}&likeCount=${likeCount || ""}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  )
    .then((response) => {
      if (!response.ok) displayError();
      return response;
    })
    .then((response) => response.json())
    .catch(displayError);
  cLog("response from api:");
  cLog(JSON.stringify(response));
  if (response !== undefined && !("traceId" in response) && !statsSet) {
    processResponse(response, storedData);
  }
}

function setInitialState() {
  setState(storedData);
}

function initExtConfig() {
  initializeDisableVoteSubmission();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
  initializeNumberDisplayReformatLikes();
}

function initializeDisableVoteSubmission() {
  getBrowser().storage.sync.get(["disableVoteSubmission"], (res: any) => {
    if (res.disableVoteSubmission === undefined) {
      getBrowser().storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}

function initializeColoredThumbs() {
  getBrowser().storage.sync.get(["coloredThumbs"], (res: any) => {
    if (res.coloredThumbs === undefined) {
      getBrowser().storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeColoredBar() {
  getBrowser().storage.sync.get(["coloredBar"], (res: any) => {
    if (res.coloredBar === undefined) {
      getBrowser().storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  getBrowser().storage.sync.get(["colorTheme"], (res: any) => {
    if (res.colorTheme === undefined) {
      getBrowser().storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  getBrowser().storage.sync.get(["numberDisplayFormat"], (res: any) => {
    if (res.numberDisplayFormat === undefined) {
      getBrowser().storage.sync.set({ numberDisplayFormat: "compactShort" });
    } else {
      extConfig.numberDisplayFormat = res.numberDisplayFormat;
    }
  });
}

function initializeTooltipPercentage() {
  getBrowser().storage.sync.get(["showTooltipPercentage"], (res: any) => {
    if (res.showTooltipPercentage === undefined) {
      getBrowser().storage.sync.set({ showTooltipPercentage: false });
    } else {
      extConfig.showTooltipPercentage = res.showTooltipPercentage;
    }
  });
}

function initializeTooltipPercentageMode() {
  getBrowser().storage.sync.get(["tooltipPercentageMode"], (res: any) => {
    if (res.tooltipPercentageMode === undefined) {
      getBrowser().storage.sync.set({ tooltipPercentageMode: "dash_like" });
    } else {
      extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
    }
  });
}

function initializeNumberDisplayReformatLikes() {
  getBrowser().storage.sync.get(["numberDisplayReformatLikes"], (res: any) => {
    if (res.numberDisplayReformatLikes === undefined) {
      getBrowser().storage.sync.set({ numberDisplayReformatLikes: false });
    } else {
      extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
    }
  });
}

export {
  DISLIKED_STATE,
  LIKED_STATE,
  NEUTRAL_STATE,
  extConfig,
  getLikeCountFromButton,
  getState,
  initExtConfig,
  isLikesDisabled,
  isMobile,
  isNewDesign,
  isRoundedDesign,
  isShorts,
  isVideoDisliked,
  isVideoLiked,
  setDislikes,
  setInitialState,
  setLikes,
  setState,
  storedData,
};
