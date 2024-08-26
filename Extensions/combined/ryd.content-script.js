//---   Import Button Functions   ---//
import { getButtons } from "./src/buttons";

//---   Import State Functions   ---//
import { isShorts, setInitialState, initExtConfig } from "./src/state";

//---   Import Video & Browser Functions   ---//
import { getBrowser, isVideoLoaded, cLog } from "./src/utils";
import { addLikeDislikeEventListener, createSmartimationObserver, storageChangeHandler } from "./src/events";

await initExtConfig();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;

async function setEventListeners(evt) {
  async function checkForJS_Finish() {
    try {
      if (isShorts() || (getButtons()?.offsetParent && isVideoLoaded())) {
        clearInterval(jsInitChecktimer);
        jsInitChecktimer = null;
        createSmartimationObserver();
        addLikeDislikeEventListener();
        await setInitialState();
        isSetInitialStateDone = true;
        getBrowser().storage.onChanged.addListener(storageChangeHandler);
      }
    } catch (exception) {
      if (!isSetInitialStateDone) {
        cLog("error");
        await setInitialState();
      }
    }
  }

  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  jsInitChecktimer = setInterval(await checkForJS_Finish, 111);
}

await setEventListeners();

document.addEventListener("yt-navigate-finish", async function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  await setEventListeners();
});

const s = document.createElement("script");
s.src = chrome.runtime.getURL("menu-fixer.js");
s.onload = function () {
  this.remove();
};
// see also "Dynamic values in the injected code" section in this answer
(document.head || document.documentElement).appendChild(s);
