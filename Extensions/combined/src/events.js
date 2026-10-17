import { getBrowser, getVideoId, numberFormat, createObserver, querySelector } from "./utils";
import {
  checkForSignInButton,
  getButtons,
  getDislikeButton,
  getLikeButton,
  isSyntheticShortsDislike,
  setSyntheticShortsDislikePressed,
} from "./buttons";
import {
  setDislikes,
  extConfig,
  storedData,
  setLikes,
  getLikeCountFromButton,
  persistSyntheticShortsDislikeState,
} from "./state";
import { publishHideClutterButtons } from "./clutter-button-setting";
import { createRateBar } from "./bar";
import {
  LIKE_ACTION,
  DISLIKE_ACTION,
  DISLIKED_STATE,
  LIKED_STATE,
  resolveVoteTransition,
  applyVoteTransitionCounts,
  shouldSubmitVote,
} from "../../common/vote-transition";
import { resolveDelegatedVoteActivation } from "../../common/delegated-vote-activation";

function sendVote(vote) {
  if (shouldSubmitVote({ disableVoteSubmission: extConfig.disableVoteSubmission })) {
    const result = getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href),
    });
    if (result && typeof result.catch === "function") {
      result.catch((error) => console.error("Vote submission failed", error));
    }
  }
}

function updateDOMDislikes() {
  const videoId = getVideoId(window.location.href);
  if (!videoId || storedData.videoId !== videoId) return false;
  setDislikes(numberFormat(storedData.dislikes));
  createRateBar(storedData.likes, storedData.dislikes);
  return true;
}

let suppressNextLikeActivation = false;

function clearNativeLikeForSyntheticDislike(action, stateBeforeActivation, syntheticShortsDislike) {
  if (!syntheticShortsDislike || action !== DISLIKE_ACTION || stateBeforeActivation !== LIKED_STATE) return;

  const likeButton = getLikeButton();
  const nativeLikeButton = likeButton?.querySelector("button");
  if (!nativeLikeButton) return;
  suppressNextLikeActivation = true;
  try {
    nativeLikeButton.click();
  } finally {
    suppressNextLikeActivation = false;
  }
  nativeLikeButton.setAttribute("aria-pressed", "false");
  for (const className of extConfig.selectors.activeButtonClasses) likeButton.classList.remove(className);
}

function handleVoteAction(action) {
  if (checkForSignInButton() === false) {
    const videoId = getVideoId(window.location.href);
    if (!videoId || storedData.videoId !== videoId) return;

    const previousState = storedData.previousState;
    const transition = resolveVoteTransition(previousState, action);
    const counts = applyVoteTransitionCounts(storedData.likes, storedData.dislikes, transition);
    const syntheticShortsDislike = isSyntheticShortsDislike(getDislikeButton());
    clearNativeLikeForSyntheticDislike(action, previousState, syntheticShortsDislike);
    sendVote(transition.value);
    storedData.likes = counts.likes;
    storedData.dislikes = counts.dislikes;
    storedData.previousState = transition.nextState;
    if (syntheticShortsDislike) {
      setSyntheticShortsDislikePressed(transition.nextState === DISLIKED_STATE);
      void persistSyntheticShortsDislikeState(videoId, transition.nextState === DISLIKED_STATE).catch((error) =>
        console.error("Could not persist the synthetic Shorts Dislike state.", error),
      );
    }
    updateDOMDislikes();

    if (extConfig.numberDisplayReformatLikes === true) {
      const nativeLikes = getLikeCountFromButton();
      if (nativeLikes !== false) {
        setLikes(numberFormat(nativeLikes));
      }
    }
  }
}

function likeClicked() {
  if (suppressNextLikeActivation) return;
  handleVoteAction(LIKE_ACTION);
}

function dislikeClicked() {
  handleVoteAction(DISLIKE_ACTION);
}

const boundDislikeButtons = new WeakSet();
let delegatedReactionListenerRegistered = false;

function delegatedReactionClicked(event) {
  const buttons = getButtons();
  const likeButton = getLikeButton(buttons);
  const dislikeButton = getDislikeButton(buttons);
  const activation = resolveDelegatedVoteActivation({ buttons, dislikeButton, event, likeButton });
  if (activation?.action === DISLIKE_ACTION) {
    dislikeClicked();
  } else if (activation?.action === LIKE_ACTION) {
    likeClicked();
  }
}

function ensureDelegatedReactionListener() {
  if (delegatedReactionListenerRegistered) return;
  document.addEventListener("click", delegatedReactionClicked, true);
  delegatedReactionListenerRegistered = true;
}

function addLikeDislikeEventListener(likeButton = getLikeButton(), dislikeButton = getDislikeButton()) {
  if (!likeButton || !dislikeButton) return;
  ensureDelegatedReactionListener();
  if (!boundDislikeButtons.has(dislikeButton)) {
    dislikeButton.addEventListener("focusin", updateDOMDislikes);
    dislikeButton.addEventListener("focusout", updateDOMDislikes);
    boundDislikeButtons.add(dislikeButton);
  }
}

let smartimationObserver = null;

function createSmartimationObserver(buttons = getButtons()) {
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

  const smartimationContainer = querySelector(extConfig.selectors.buttons.smartimation, buttons);
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
  if (changes.hideClutterButtons !== undefined) {
    handleHideClutterButtonsChangeEvent(changes.hideClutterButtons.newValue);
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

function handleHideClutterButtonsChangeEvent(value) {
  extConfig.hideClutterButtons = publishHideClutterButtons(value);
}

export {
  sendVote,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  createSmartimationObserver,
  storageChangeHandler,
  updateDOMDislikes,
};
