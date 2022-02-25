import { getBrowser, getVideoId, numberFormat, cLog } from "./utils";
import { checkForSignInButton, getButtons } from "./buttons";
import {
  NEUTRAL_STATE,
  LIKED_STATE,
  DISLIKED_STATE,
  setDislikes,
  extConfig,
  storedData,
  setLikes,
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

function sendVideoIds() {
  let links = Array.from(
    document.getElementsByClassName(
      "yt-simple-endpoint ytd-compact-video-renderer"
    )
  ).concat(
    Array.from(
      document.getElementsByClassName("yt-simple-endpoint ytd-thumbnail")
    )
  );
  // Also try mobile
  if (links.length < 1)
    links = Array.from(
      document.querySelectorAll(
        ".large-media-item-metadata > a, a.large-media-item-thumbnail-container"
      )
    );
  const ids = links
    .filter((x) => x.href && x.href.indexOf("/watch?v=") > 0)
    .map((x) => getVideoId(x.href));
  getBrowser().runtime.sendMessage({
    message: "send_links",
    videoIds: ids,
  });
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
    }
  }
}

function commentLikeClicked() 
{
  if (checkForSignInButton() === false)
  {
    if (storedData.previousState === COMMENT_DISLIKED_STATE) 
    {
      sendVote(1);
      if (storedData.commentDislikes > 0) 
      {
        storedData.commentDislikes--;
      }
      storedData.commentLikes++;
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      setCommentDislikes(numberFormat(storedData.commentDislikes));
      storedData.previousState = COMMENT_LIKED_STATE;
    } 
    else if (storedData.previousState === COMMENT_NEUTRAL_STATE) 
    {
      sendVote(1);
      storedData.commentLikes++;
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      storedData.previousState = LIKED_STATE;
    } 
    else if ((storedData.previousState = COMMENT_LIKED_STATE)) 
    {
      sendVote(0);
      if (storedData.commentLikes > 0) 
      {
        storedData.commentLikes--;
      }
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      storedData.previousState = COMMENT_NEUTRAL_STATE;
    }
  }
}

function commentDislikeClicked() 
{
  if (checkForSignInButton() == false)
  {
    if (storedData.previousState === COMMENT_NEUTRAL_STATE)
    {
      sendVote(-1);
      storedData.commentDislikes++;
      setCommentDislikes(numberFormat(storedData.commentDislikes));
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      storedData.previousState = COMMENT_DISLIKED_STATE;
    } 
    else if (storedData.previousState === COMMENT_DISLIKED_STATE) 
    {
      sendVote(0);
      if (storedData.commentDislikes > 0) 
      {
        storedData.commentDislikes--;
      }
      setCommentDislikes(numberFormat(storedData.commentDislikes));
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      storedData.previousState = COMMENT_NEUTRAL_STATE;
    } 
    else if (storedData.previousState === COMMENT_LIKED_STATE) 
    {
      sendVote(-1);
      if (storedData.commentLikes > 0) 
      {
        storedData.commentLikes--;
      }
      storedData.commentDislikes++;
      setDislikes(numberFormat(storedData.commentDislikes));
      createRateBar(storedData.commentLikes, storedData.commentDislikes);
      storedData.previousState = COMMENT_DISLIKED_STATE;
    }
  }
}

function addLikeDislikeEventListener() {
  const buttons = getButtons();
  if (!window.returnDislikeButtonlistenersSet) {
    buttons.children[0].addEventListener("click", likeClicked);
    buttons.children[1].addEventListener("click", dislikeClicked);
    window.returnDislikeButtonlistenersSet = true;
  }
}

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
}

function addLikeDislikePercentageEvent(likeValue, dislikeValue) {
  // Create and intialize percentage value
  percentage = 0;
  // check if values are equal to zero
  if (likeValue == 0)
  {
    // return zero if number of like is equal to zero
    return 0;
  }
  else if (dislikeValue == 0)
  {
    // return zero if number of dislikes is equal to zero
    return 0;
  }
  else
  {
    // since both values are not equal to zero, caluculate percentage;
    percentage = likeValue / dislikeValue;
    // return percentage value, completing function
    return percentage;
  }
}


export {
  sendVote,
  sendVideoIds,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  storageChangeHandler,
  addLikeDislikePercentageEvent,
  commentLikeClicked,
  commentDislikeClicked
};
