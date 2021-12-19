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
  setInitialState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  initExtConfig,
} from "./src/state";
import { numberFormat, getBrowser, getVideoId, isVideoLoaded, cLog } from "./src/utils";
import { createRateBar } from "./src/bar";
import { sendVideoIds, sendVote, likeClicked, dislikeClicked, addLikeDislikeEventListener, storageChangeHandler  } from "./src/events"

initExtConfig()

let jsInitChecktimer = null;

function setEventListeners(evt) {
  function checkForJS_Finish() {
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      jsInitChecktimer = null;
      addLikeDislikeEventListener();
      setInitialState();
      getBrowser().storage.onChanged.addListener(storageChangeHandler);
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
}

setEventListeners();

document.addEventListener("yt-navigate-finish", function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false;
  setEventListeners();
});

setTimeout(() => sendVideoIds(), 2500);
