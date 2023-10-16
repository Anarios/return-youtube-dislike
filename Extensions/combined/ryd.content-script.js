//---   Import Button Functions   ---//
import { getButtons } from "./src/buttons";

//---   Import State Functions   ---//
import { initExtConfig, isShorts, setInitialState } from "./src/state";

//---   Import Video & Browser Functions   ---//
import {
  addLikeDislikeEventListener,
  storageChangeHandler,
} from "./src/events";
import { getBrowser, isVideoLoaded } from "./src/utils";

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
    } catch (exception) {
      if (!isSetInitialStateDone) {
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
