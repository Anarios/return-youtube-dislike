import { getBrowser, getVideoId, numberFormat, createObserver, querySelector } from "./utils";
import { checkForSignInButton, getButtons, getDislikeButton, getLikeButton } from "./buttons";
import {
  getShortsDislikeControl,
  getShortsVoteState,
  setShortsDislikePressed,
  updateShortsVoteState,
} from "./shortsDislike";
import {
  NEUTRAL_STATE,
  LIKED_STATE,
  DISLIKED_STATE,
  setDislikes,
  extConfig,
  storedData,
  setLikes,
  getLikeCountFromButton,
  isShorts,
} from "./state";
import { createRateBar } from "./bar";

function sendVote(vote) {
  if (extConfig.disableVoteSubmission === true) return false;

  try {
    const result = getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href),
    });
    if (result && typeof result.then === "function") {
      return result
        .then((response) => response?.accepted !== false)
        .catch((error) => {
          console.debug("Vote dispatch failed:", error?.message ?? error);
          return false;
        });
    }
    return true;
  } catch (error) {
    console.debug("Vote dispatch failed:", error?.message ?? error);
    return false;
  }
}

function updateDOMDislikes() {
  setDislikes(numberFormat(storedData.dislikes));
  createRateBar(storedData.likes, storedData.dislikes);
}

function likeClicked() {
  if (checkForSignInButton() === false) {
    if (storedData.previousState === DISLIKED_STATE) {
      sendVote(1);
      if (storedData.dislikes > 0) storedData.dislikes--;
      storedData.likes++;
      updateDOMDislikes();
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(1);
      storedData.likes++;
      updateDOMDislikes();
      storedData.previousState = LIKED_STATE;
    } else if ((storedData.previousState = LIKED_STATE)) {
      sendVote(0);
      if (storedData.likes > 0) storedData.likes--;
      updateDOMDislikes();
      storedData.previousState = NEUTRAL_STATE;
    }
    if (extConfig.numberDisplayReformatLikes === true) {
      const nativeLikes = getLikeCountFromButton();
      if (nativeLikes !== false) {
        setLikes(numberFormat(nativeLikes));
      }
    }
  }
}

const shortsDislikeTransitionsInFlight = new Set();

function shortsDislikeClicked() {
  const videoId = getVideoId(window.location.href);
  const control = getShortsDislikeControl();
  if (!videoId || control?.videoId !== videoId || shortsDislikeTransitionsInFlight.has(videoId)) return;
  if (extConfig.disableVoteSubmission === true) return;

  shortsDislikeTransitionsInFlight.add(videoId);
  const voteState = getShortsVoteState(videoId);
  const nextPressed = !voteState.pressed;

  const applyTransition = () => {
    updateShortsVoteState(videoId, { pressed: nextPressed });
    const activeControl = getShortsDislikeControl();
    if (getVideoId(window.location.href) !== videoId || activeControl?.videoId !== videoId) return;

    if (nextPressed) {
      if (storedData.previousState === LIKED_STATE && storedData.likes > 0) storedData.likes--;
      storedData.dislikes++;
      updateDOMDislikes();
      storedData.previousState = DISLIKED_STATE;
      updateShortsDislikeState(true, 1);
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) setLikes(numberFormat(nativeLikes));
      }
    } else {
      if (storedData.dislikes > 0) storedData.dislikes--;
      updateDOMDislikes();
      storedData.previousState = NEUTRAL_STATE;
      updateShortsDislikeState(false, -1);
    }
  };

  const dispatchResult = sendVote(nextPressed ? -1 : 0);
  if (dispatchResult && typeof dispatchResult.then === "function") {
    dispatchResult
      .then((accepted) => {
        if (accepted) applyTransition();
      })
      .catch((error) => console.debug("Vote transition failed:", error?.message ?? error))
      .finally(() => shortsDislikeTransitionsInFlight.delete(videoId));
  } else {
    if (dispatchResult) applyTransition();
    shortsDislikeTransitionsInFlight.delete(videoId);
  }
}

function dislikeClicked() {
  if (checkForSignInButton() == false) {
    if (isShorts()) {
      shortsDislikeClicked();
      return;
    }
    if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(-1);
      storedData.dislikes++;
      updateDOMDislikes();
      storedData.previousState = DISLIKED_STATE;
      updateShortsDislikeState(true, 1);
    } else if (storedData.previousState === DISLIKED_STATE) {
      sendVote(0);
      if (storedData.dislikes > 0) storedData.dislikes--;
      updateDOMDislikes();
      storedData.previousState = NEUTRAL_STATE;
      updateShortsDislikeState(false, -1);
    } else if (storedData.previousState === LIKED_STATE) {
      sendVote(-1);
      if (storedData.likes > 0) storedData.likes--;
      storedData.dislikes++;
      updateDOMDislikes();
      storedData.previousState = DISLIKED_STATE;
      updateShortsDislikeState(true, 1);
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) {
          setLikes(numberFormat(nativeLikes));
        }
      }
    }
  }
}

function updateShortsDislikeState(pressed, voteDelta) {
  if (!isShorts()) return;

  const owned = getShortsDislikeControl();
  if (owned) {
    setShortsDislikePressed(owned, pressed);
    updateShortsVoteState(owned.videoId, { pressed });
    owned.root.dataset.rydPendingVoteDelta = String(
      parseInt(owned.root.dataset.rydPendingVoteDelta ?? "0") + voteDelta,
    );
  }
}

function addLikeDislikeEventListener() {
  if (isShorts()) {
    const owned = getShortsDislikeControl();
    if (owned && window.rydPreNavigateShortsDislikeButton !== owned.button) {
      owned.button.addEventListener("click", dislikeClicked);
      window.rydPreNavigateShortsDislikeButton = owned.button;
    }
    return;
  }

  if (window.rydPreNavigateLikeButton !== getLikeButton()) {
    getLikeButton().addEventListener("click", likeClicked);
    getLikeButton().addEventListener("touchstart", likeClicked);
    if (getDislikeButton()) {
      getDislikeButton().addEventListener("click", dislikeClicked);
      getDislikeButton().addEventListener("touchstart", dislikeClicked);
      getDislikeButton().addEventListener("focusin", updateDOMDislikes);
      getDislikeButton().addEventListener("focusout", updateDOMDislikes);
    }
    window.rydPreNavigateLikeButton = getLikeButton();
  }
}

let smartimationObserver = null;

function createSmartimationObserver() {
  if (!smartimationObserver) {
    smartimationObserver = createObserver(
      {
        attributes: true,
        subtree: true,
        childList: true,
      },
      updateDOMDislikes,
    );
    smartimationObserver.container = null;
  }

  const smartimationContainer = querySelector(extConfig.selectors.buttons.smartimation, getButtons());
  if (smartimationContainer && smartimationObserver.container != smartimationContainer) {
    console.log("Initializing smartimation mutation observer");
    smartimationObserver.disconnect();
    smartimationObserver.observe(smartimationContainer);
    smartimationObserver.container = smartimationContainer;
  }
}

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(changes.disableVoteSubmission.newValue);
  }
  if (changes.coloredThumbs !== undefined) {
    handleColoredThumbsChangeEvent(changes.coloredThumbs.newValue);
  }
  if (changes.coloredBar !== undefined) {
    handleColoredBarChangeEvent(changes.coloredBar.newValue);
  }
  if (changes.colorTheme !== undefined) {
    handleColorThemeChangeEvent(changes.colorTheme.newValue);
  }
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(changes.numberDisplayReformatLikes.newValue);
  }
  if (changes.hidePremiumTeaser !== undefined) {
    handleHidePremiumTeaserChangeEvent(changes.hidePremiumTeaser.newValue);
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
}

function handleColoredThumbsChangeEvent(value) {
  extConfig.coloredThumbs = value;
}

function handleColoredBarChangeEvent(value) {
  extConfig.coloredBar = value;
}

function handleColorThemeChangeEvent(value) {
  if (!value) value = "classic";
  extConfig.colorTheme = value;
}

function handleNumberDisplayFormatChangeEvent(value) {
  extConfig.numberDisplayFormat = value;
}

function handleNumberDisplayReformatLikesChangeEvent(value) {
  extConfig.numberDisplayReformatLikes = value;
}

function handleHidePremiumTeaserChangeEvent(value) {
  extConfig.hidePremiumTeaser = value === true;
}

export {
  sendVote,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  createSmartimationObserver,
  storageChangeHandler,
};
