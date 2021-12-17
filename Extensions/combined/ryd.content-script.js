import {
  getButtons,
  getLikeButton,
  getDislikeButton,
  checkForSignInButton,
} from "./src/buttons";
import {
  isMobile,
  isVideoDisliked,
  isVideoLiked,
  getState,
  setState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
} from "./src/state";
import { numberFormat, getBrowser, getVideoId, cLog } from "./src/utils";
import { createRateBar } from "./src/bar";

let storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
};

function sendVote(vote) {
  getBrowser().runtime.sendMessage({
    message: "send_vote",
    vote: vote,
    videoId: getVideoId(window.location.href),
  });
}

function likeClicked() {
  if (checkForSignInButton() === false) {
    if (storedData.previousState === DISLIKED_STATE) {
      sendVote(1);
      storedData.dislikes--;
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
      storedData.likes--;
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
      storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = NEUTRAL_STATE;
    } else if (storedData.previousState === LIKED_STATE) {
      sendVote(-1);
      storedData.likes--;
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = DISLIKED_STATE;
    }
  }
}

function setInitialState() {
  setState(storedData);
  setTimeout(() => {
    sendVideoIds();
  }, 1500);
}

function isVideoLoaded() {
  const videoId = getVideoId(window.location.href);
  return (
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null ||
    // mobile: no video-id attribute
    document.querySelector('#player[loading="false"]:not([hidden])') !== null
  );
}

let jsInitChecktimer = null;

function setEventListeners(evt) {
  function checkForJS_Finish() {
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      jsInitChecktimer = null;
      const buttons = getButtons();
      if (!window.returnDislikeButtonlistenersSet) {
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        window.returnDislikeButtonlistenersSet = true;
      }
      setInitialState();
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    jsInitChecktimer = setInterval(checkForJS_Finish, 111);
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

setEventListeners();

document.addEventListener("yt-navigate-finish", function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false;
  setEventListeners();
});

setTimeout(() => sendVideoIds(), 2500);
