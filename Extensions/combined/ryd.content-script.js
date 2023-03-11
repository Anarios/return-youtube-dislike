//---   Import Button Functions   ---//
import {
  getButtons,
  getLikeButton,
  getDislikeButton,
  checkForSignInButton,
} from "./src/buttons";

//---   Import State Functions   ---//
import {
  isMobile,
  isShorts,
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

//---   Import Video & Browser Functions   ---//
import {
  numberFormat,
  getBrowser,
  getVideoId,
  isVideoLoaded,
  cLog,
} from "./src/utils";
import { createRateBar } from "./src/bar";
import {
  sendVote,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  storageChangeHandler,
} from "./src/events";

initExtConfig();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;

function setEventListeners(evt) {
  function checkForJS_Finish() {
    try {
      if (isShorts() || (getButtons()?.offsetParent && isVideoLoaded())) {
        addLikeDislikeEventListener();
        setInitialState();
        isSetInitialStateDone = true;
        getBrowser().storage.onChanged.addListener(storageChangeHandler);
        clearInterval(jsInitChecktimer);
        jsInitChecktimer = null;
      } 
    } catch(exception) {
      if(!isSetInitialStateDone) {
        setInitialState();
      }
    }
  }


  jsInitChecktimer = setInterval(checkForJS_Finish, 111);
}

setEventListeners();

document.addEventListener("yt-navigate-finish", function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false;
  setEventListeners();
});
