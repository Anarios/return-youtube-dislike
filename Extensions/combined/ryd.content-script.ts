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

let jsInitChecktimer: any;
let isSetInitialStateDone: boolean = false;

function setEventListeners(): void {
  function checkForJS_Finish(): void {
    try {
      if (
        isShorts() ||
        ((getButtons() as HTMLElement)?.offsetParent && isVideoLoaded())
      ) {
        addLikeDislikeEventListener();
        setInitialState();
        isSetInitialStateDone = true;
        getBrowser().storage.onChanged.addListener(storageChangeHandler);
        if (jsInitChecktimer !== null) {
          clearInterval(jsInitChecktimer);
          jsInitChecktimer = null;
        }
      }
    } catch (exception: unknown) {
      if (!isSetInitialStateDone) {
        setInitialState();
      }
    }
  }

  jsInitChecktimer = setInterval(checkForJS_Finish, 111);
}

setEventListeners();

document.addEventListener("yt-navigate-finish", function () {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false; // Consider adding a type for `window.returnDislikeButtonlistenersSet`
  setEventListeners();
});
