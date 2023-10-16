import { createRateBar } from "./bar";
import {
  checkForSignInButton,
  getDislikeButton,
  getLikeButton,
} from "./buttons";
import {
  DISLIKED_STATE,
  LIKED_STATE,
  NEUTRAL_STATE,
  extConfig,
  getLikeCountFromButton,
  setDislikes,
  setLikes,
  storedData,
} from "./state";
import { ColorTheme, NumberDisplayFormat } from "./types";
import { getBrowser, getVideoId, numberFormat } from "./utils";

function sendVote(vote: 0 | 1 | -1) {
  if (extConfig.disableVoteSubmission !== true) {
    getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href),
    });
  }
}

function likeClicked() {
  if (checkForSignInButton() === false) {
    if (storedData.previousState === DISLIKED_STATE) {
      sendVote(1);
      if (storedData.dislikes > 0) storedData.dislikes--;
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState === NEUTRAL_STATE) {
      sendVote(1);
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = LIKED_STATE;
    } else if ((storedData.previousState = LIKED_STATE)) {
      sendVote(0);
      if (storedData.likes > 0) storedData.likes--;
      createRateBar(storedData.likes, storedData.dislikes);
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
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = DISLIKED_STATE;
    } else if (storedData.previousState === DISLIKED_STATE) {
      sendVote(0);
      if (storedData.dislikes > 0) storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = NEUTRAL_STATE;
    } else if (storedData.previousState === LIKED_STATE) {
      sendVote(-1);
      if (storedData.likes > 0) storedData.likes--;
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
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
  if (!window.returnDislikeButtonlistenersSet) {
    getLikeButton()?.addEventListener("click", likeClicked);
    getLikeButton()?.addEventListener("touchstart", likeClicked);
    if (getDislikeButton()) {
      getDislikeButton()?.addEventListener("click", dislikeClicked);
      getDislikeButton()?.addEventListener("touchstart", dislikeClicked);
    }
    window.returnDislikeButtonlistenersSet = true;
  }
}

function storageChangeHandler(changes: {
  [key: string]: chrome.storage.StorageChange;
}) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue
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
      changes.numberDisplayReformatLikes.newValue
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value: boolean) {
  extConfig.disableVoteSubmission = value;
}

function handleColoredThumbsChangeEvent(value: boolean) {
  extConfig.coloredThumbs = value;
}

function handleColoredBarChangeEvent(value: boolean) {
  extConfig.coloredBar = value;
}

function handleColorThemeChangeEvent(value: ColorTheme) {
  if (!value) value = "classic";
  extConfig.colorTheme = value;
}

function handleNumberDisplayFormatChangeEvent(value: NumberDisplayFormat) {
  extConfig.numberDisplayFormat = value;
}

function handleNumberDisplayReformatLikesChangeEvent(value: boolean) {
  extConfig.numberDisplayReformatLikes = value;
}

export {
  addLikeDislikeEventListener,
  dislikeClicked,
  likeClicked,
  sendVote,
  storageChangeHandler,
};
