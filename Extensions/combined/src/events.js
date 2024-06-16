import {
  getBrowser,
  getVideoId,
  numberFormat,
  cLog,
  createObserver,
} from "./utils";
import {
  checkForSignInButton,
  getButtons,
  getDislikeButton,
  getLikeButton,
} from "./buttons";
import {
  NEUTRAL_STATE,
  LIKED_STATE,
  DISLIKED_STATE,
  setDislikes,
  extConfig,
  storedData,
  setLikes,
  getLikeCountFromButton,
} from "./state";
import { createRateBar } from "./bar";

function sendVote(vote) {
  if (extConfig.disableVoteSubmission !== true) {
    getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href),
    });
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

function dislikeClicked() {
  if (checkForSignInButton() == false) {
    if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(-1);
      storedData.dislikes++;
      updateDOMDislikes();
      storedData.previousState = DISLIKED_STATE;
    } else if (storedData.previousState === DISLIKED_STATE) {
      sendVote(0);
      if (storedData.dislikes > 0) storedData.dislikes--;
      updateDOMDislikes();
      storedData.previousState = NEUTRAL_STATE;
    } else if (storedData.previousState === LIKED_STATE) {
      sendVote(-1);
      if (storedData.likes > 0) storedData.likes--;
      storedData.dislikes++;
      updateDOMDislikes();
      storedData.previousState = DISLIKED_STATE;
      if (extConfig.numberDisplayReformatLikes === true) {
        const nativeLikes = getLikeCountFromButton();
        if (nativeLikes !== false) {
          setLikes(numberFormat(nativeLikes));
        }
      }
    }
  }
}

function addLikeDislikeEventListener() {
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
      },
      updateDOMDislikes,
    );
    smartimationObserver.container = null;
  }

  const smartimationContainer = getButtons().querySelector("yt-smartimation");
  if (
    smartimationContainer &&
    smartimationObserver.container != smartimationContainer
  ) {
    cLog("Initializing smartimation mutation observer");
    smartimationObserver.disconnect();
    smartimationObserver.observe(smartimationContainer);
    smartimationObserver.container = smartimationContainer;
  }
}

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue,
    );
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
    handleNumberDisplayReformatLikesChangeEvent(
      changes.numberDisplayReformatLikes.newValue,
    );
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

export {
  sendVote,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  createSmartimationObserver,
  storageChangeHandler,
};
