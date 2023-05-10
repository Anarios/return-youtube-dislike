import {
  getLikeButton,
  getDislikeButton,
  getButtons,
  getLikeTextContainer,
  getDislikeTextContainer,
} from "./buttons";
import { createRateBar } from "./bar";
import {
  getBrowser,
  getVideoId,
  cLog,
  numberFormat,
  getColorFromTheme,
} from "./utils";
import { localize } from "./utils";
import { createStarRating } from "./starRating";

//TODO: Do not duplicate here and in ryd.background.js
const apiUrl = "https://returnyoutubedislikeapi.com";
const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

let extConfig = {
  disableVoteSubmission: false,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic",
  numberDisplayFormat: "compactShort",
  showTooltipPercentage: false,
  tooltipPercentageMode: "dash_like",
  numberDisplayReformatLikes: false,
};

let storedData = {
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

let mutationObserver = new Object();

if (isShorts() && mutationObserver.exists !== true) {
  cLog("initializing mutation observer");
  mutationObserver.options = {
    childList: false,
    attributes: true,
    subtree: false,
  };
  mutationObserver.exists = true;
  mutationObserver.observer = new MutationObserver(function (
    mutationList,
    observer
  ) {
    mutationList.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.target.nodeName === "TP-YT-PAPER-BUTTON" &&
        mutation.target.id === "button"
      ) {
        // cLog('Short thumb button status changed');
        if (mutation.target.getAttribute("aria-pressed") === "true") {
          mutation.target.style.color =
            mutation.target.parentElement.parentElement.id === "like-button"
              ? getColorFromTheme(true)
              : getColorFromTheme(false);
        } else {
          mutation.target.style.color = "unset";
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
      getButtons().children[0].querySelector(".button-renderer-text").innerText
    );
  }
  return /^\D*$/.test(getButtons().children[0].innerText);
}

function isVideoLiked() {
  if (isMobile()) {
    return (
      getLikeButton().querySelector("button").getAttribute("aria-label") === "true"
    );
  }
  return getLikeButton().classList.contains("style-default-active") || getLikeButton().querySelector('button')?.getAttribute('aria-pressed') === 'true';
}

function isVideoDisliked() {
  if (isMobile()) {
    return (
      getDislikeButton().querySelector("button").getAttribute("aria-label") === "true"
    );
  }
  return getDislikeButton().classList.contains("style-default-active") || getDislikeButton().querySelector('button')?.getAttribute('aria-pressed') === 'true';
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
  cLog(`SET likes ${likesCount}`)
  getLikeTextContainer().innerText = likesCount;
}

function setDislikes(dislikesCount) {
  cLog(`SET dislikes ${dislikesCount}`)
  getDislikeTextContainer()?.removeAttribute("is-empty");
  getDislikeTextContainer()?.removeAttribute('is-empty');
  if (!isLikesDisabled()) {
    if (isMobile()) {
      getButtons().children[1].querySelector(
        ".button-renderer-text"
      ).innerText = dislikesCount;
      return;
    }
    getDislikeTextContainer().innerText = dislikesCount;

  } else {
    cLog("likes count disabled by creator");
    if (isMobile()) {
      getButtons().children[1].querySelector(
        ".button-renderer-text"
      ).innerText = localize("TextLikesDisabled");
      return;
    }
    getDislikeTextContainer().innerText = localize("TextLikesDisabled");
  }
}

function getLikeCountFromButton() {
  try {
    if (isShorts()) {
      //Youtube Shorts don't work with this query. It's not necessary; we can skip it and still see the results.
      //It should be possible to fix this function, but it's not critical to showing the dislike count.
      return false;
    }

    let likeButton = getLikeButton()
    .querySelector("yt-formatted-string#text") ??
    getLikeButton().querySelector("button");

    let likesStr = likeButton.getAttribute("aria-label")
    .replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
  } catch {
    return false;
  }
}

function processResponse(response, storedData) {
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
      let shortLikeButton = getLikeButton().querySelector(
        "tp-yt-paper-button#button"
      );
      let shortDislikeButton = getDislikeButton().querySelector(
        "tp-yt-paper-button#button"
      );
      if (shortLikeButton.getAttribute("aria-pressed") === "true") {
        shortLikeButton.style.color = getColorFromTheme(true);
      }
      if (shortDislikeButton.getAttribute("aria-pressed") === "true") {
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
      getLikeButton().style.color = getColorFromTheme(true);
      getDislikeButton().style.color = getColorFromTheme(false);
    }
  }
  //Temporary disabling this - it breaks all places where getButtons()[1] is used
  // createStarRating(response.rating, isMobile());
}

// Tells the user if the API is down
function displayError(error) {
  getDislikeTextContainer().innerText = localize(
    "textTempUnavailable"
  );
}

async function setState(storedData) {
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
      if (!response.ok) displayError(response.error);
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
  getBrowser().storage.sync.get(["disableVoteSubmission"], (res) => {
    if (res.disableVoteSubmission === undefined) {
      getBrowser().storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
  });
}

function initializeColoredThumbs() {
  getBrowser().storage.sync.get(["coloredThumbs"], (res) => {
    if (res.coloredThumbs === undefined) {
      getBrowser().storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeColoredBar() {
  getBrowser().storage.sync.get(["coloredBar"], (res) => {
    if (res.coloredBar === undefined) {
      getBrowser().storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  getBrowser().storage.sync.get(["colorTheme"], (res) => {
    if (res.colorTheme === undefined) {
      getBrowser().storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  getBrowser().storage.sync.get(["numberDisplayFormat"], (res) => {
    if (res.numberDisplayFormat === undefined) {
      getBrowser().storage.sync.set({ numberDisplayFormat: "compactShort" });
    } else {
      extConfig.numberDisplayFormat = res.numberDisplayFormat;
    }
  });
}

function initializeTooltipPercentage() {
  getBrowser().storage.sync.get(["showTooltipPercentage"], (res) => {
    if (res.showTooltipPercentage === undefined) {
      getBrowser().storage.sync.set({ showTooltipPercentage: false });
    } else {
      extConfig.showTooltipPercentage = res.showTooltipPercentage;
    }
  });
}

function initializeTooltipPercentageMode() {
  getBrowser().storage.sync.get(["tooltipPercentageMode"], (res) => {
    if (res.tooltipPercentageMode === undefined) {
      getBrowser().storage.sync.set({ tooltipPercentageMode: "dash_like" });
    } else {
      extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
    }
  });
}

function initializeNumberDisplayReformatLikes() {
  getBrowser().storage.sync.get(["numberDisplayReformatLikes"], (res) => {
    if (res.numberDisplayReformatLikes === undefined) {
      getBrowser().storage.sync.set({ numberDisplayReformatLikes: false });
    } else {
      extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
    }
  });
}

export {
  isMobile,
  isShorts,
  isVideoDisliked,
  isVideoLiked,
  isNewDesign,
  isRoundedDesign,
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
  isLikesDisabled,
};
