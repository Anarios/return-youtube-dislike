import { getButtons } from "./src/buttons";
import { isShorts, setInitialState, initExtConfig } from "./src/state";
import { getBrowser, isVideoLoaded } from "./src/utils";
import { addLikeDislikeEventListener, createSmartimationObserver, storageChangeHandler } from "./src/events";

await initExtConfig();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;

async function setEventListeners(evt) {
  async function checkForJS_Finish() {
    try {
      if ((isShorts() && isVideoLoaded()) || (getButtons()?.offsetParent && isVideoLoaded())) {
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
        console.log("error");
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

(document.head || document.documentElement).appendChild(s);
