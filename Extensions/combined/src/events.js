import { logger } from "./logging";
import { getBrowser, getVideoId, numberFormat, createObserver, querySelector } from "./utils";
import {
  checkForSignInButton,
  getButtons,
  getDislikeButton,
  getLikeButton,
  getNativeButton,
  isSyntheticShortsDislike,
  setSyntheticShortsDislikePressed,
} from "./buttons";
import {
  setDislikes,
  extConfig,
  storedData,
  refreshReactionPresentation,
  persistSyntheticShortsDislikeState,
  updateDisableLogging,
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
import { normalizeCustomColors, observeYouTubeTheme } from "../../common/color-themes";
import { isPrivateBrowsingContext } from "./private-browsing";
import { recordReviewAction } from "./review-prompt";

function sendVote(vote) {
  if (isPrivateBrowsingContext()) return;
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
  const nativeLikeButton = getNativeButton(likeButton);
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
  if (isPrivateBrowsingContext()) return;
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
    void recordReviewAction(videoId, transition.value);
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
let presentationObserver = null;
let observedLikeButton = null;
let observedDislikeButton = null;

function observeReactionPresentation(likeButton, dislikeButton) {
  if (observedLikeButton === likeButton && observedDislikeButton === dislikeButton) return;
  if (!presentationObserver) presentationObserver = new MutationObserver(refreshReactionPresentation);
  presentationObserver.disconnect();
  const options = {
    attributes: true,
    attributeFilter: ["aria-label", "aria-pressed", "class"],
    characterData: true,
    childList: true,
    subtree: true,
  };
  presentationObserver.observe(likeButton, options);
  presentationObserver.observe(dislikeButton, options);
  observedLikeButton = likeButton;
  observedDislikeButton = dislikeButton;
}

function delegatedReactionClicked(event) {
  const buttons = getButtons();
  const likeButton = getLikeButton(buttons);
  const dislikeButton = getDislikeButton(buttons);
  const activation = resolveDelegatedVoteActivation({
    buttons,
    dislikeButton,
    event,
    getActivationTarget: getNativeButton,
    likeButton,
  });
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
  if (isPrivateBrowsingContext()) {
    observeReactionPresentation(likeButton, dislikeButton);
    return;
  }
  ensureDelegatedReactionListener();
  observeReactionPresentation(likeButton, dislikeButton);
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
    logger.log("Initializing smartimation mutation observer");
    smartimationObserver.disconnect();
    smartimationObserver.observe(smartimationContainer);
    smartimationObserver.container = smartimationContainer;
  }
}

function storageChangeHandler(changes, area) {
  if (isPrivateBrowsingContext()) return;
  if (changes.disableLogging !== undefined && area === "sync") {
    updateDisableLogging(changes.disableLogging.newValue);
  }
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
  if (changes.customColors !== undefined && (!area || area === "sync")) {
    extConfig.customColors = normalizeCustomColors(changes.customColors.newValue);
    refreshColorPresentation();
  }
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (area === "sync" && (changes.showTooltipPercentage !== undefined || changes.tooltipPercentageMode !== undefined)) {
    if (changes.showTooltipPercentage !== undefined) {
      extConfig.showTooltipPercentage = changes.showTooltipPercentage.newValue ?? false;
    }
    if (changes.tooltipPercentageMode !== undefined) {
      extConfig.tooltipPercentageMode = changes.tooltipPercentageMode.newValue || "dash_like";
    }
    const videoId = getVideoId(window.location.href);
    if (videoId && storedData.videoId === videoId) createRateBar(storedData.likes, storedData.dislikes);
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
  refreshReactionPresentation();
}

function handleColoredBarChangeEvent(value) {
  extConfig.coloredBar = value;
  refreshColorPresentation();
}

function handleColorThemeChangeEvent(value) {
  if (!value) value = "classic";
  extConfig.colorTheme = value;
  refreshColorPresentation();
}

function refreshColorPresentation() {
  refreshReactionPresentation();
  const videoId = getVideoId(window.location.href);
  if (videoId && storedData.videoId === videoId) createRateBar(storedData.likes, storedData.dislikes);
}

let colorThemeObserver = null;

function observeColorTheme() {
  if (!colorThemeObserver) colorThemeObserver = observeYouTubeTheme(refreshColorPresentation);
}

function handleNumberDisplayFormatChangeEvent(value) {
  extConfig.numberDisplayFormat = value;
  refreshReactionPresentation();
  updateDOMDislikes();
}

function handleNumberDisplayReformatLikesChangeEvent(value) {
  extConfig.numberDisplayReformatLikes = value;
  refreshReactionPresentation();
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
  observeColorTheme,
};
