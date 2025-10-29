import { getButtons } from "./src/buttons";
import { isShorts, setInitialState, initExtConfig } from "./src/state";
import { getBrowser, isVideoLoaded } from "./src/utils";
import { addLikeDislikeEventListener, createSmartimationObserver, storageChangeHandler } from "./src/events";
import { initPatreonFeatures } from "./src/patreon";

await initExtConfig();
initPatreonFeatures();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;
let isStorageListenerRegistered = false;
let shortsNavigationObserver = null;
let shortsNavigationObserverTarget = null;

function ensureShortsNavigationObserver() {
  if (!isShorts()) {
    return;
  }

  const shortsRoot = document.querySelector("ytd-shorts");
  if (!shortsRoot) {
    return;
  }

  if (!shortsNavigationObserver) {
    shortsNavigationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "is-active" &&
          mutation.target.tagName === "YTD-REEL-VIDEO-RENDERER" &&
          mutation.target.hasAttribute("is-active")
        ) {
          triggerInitializationCycle();
          break;
        }
      }
    });
  }

  if (shortsNavigationObserverTarget !== shortsRoot) {
    shortsNavigationObserver.disconnect();
    shortsNavigationObserver.observe(shortsRoot, {
      attributes: true,
      subtree: true,
      attributeFilter: ["is-active"],
    });
    shortsNavigationObserverTarget = shortsRoot;
  }
}

async function checkForInitialization() {
  try {
    if (isShorts()) {
      ensureShortsNavigationObserver();
    }

    if ((isShorts() && isVideoLoaded()) || (getButtons()?.offsetParent && isVideoLoaded())) {
      if (jsInitChecktimer !== null) {
        clearInterval(jsInitChecktimer);
        jsInitChecktimer = null;
      }
      createSmartimationObserver();
      addLikeDislikeEventListener();
      await setInitialState();
      isSetInitialStateDone = true;
      if (!isStorageListenerRegistered) {
        getBrowser().storage.onChanged.addListener(storageChangeHandler);
        isStorageListenerRegistered = true;
      }
    }
  } catch (exception) {
    if (!isSetInitialStateDone) {
      console.log("error");
      await setInitialState();
    }
  }
}

async function triggerInitializationCycle() {
  isSetInitialStateDone = false;

  if (jsInitChecktimer !== null) {
    clearInterval(jsInitChecktimer);
    jsInitChecktimer = null;
  }

  await checkForInitialization();

  if (!isSetInitialStateDone) {
    jsInitChecktimer = setInterval(() => {
      checkForInitialization();
    }, 111);

    setTimeout(() => {
      if (!isSetInitialStateDone) {
        checkForInitialization();
      }
    }, 2000);
  }
}

async function setEventListeners() {
  await triggerInitializationCycle();
}

await setEventListeners();

document.addEventListener("yt-navigate-finish", async function (event) {
  await setEventListeners();
});

const s = document.createElement("script");
s.src = chrome.runtime.getURL("menu-fixer.js");
s.onload = function () {
  this.remove();
};

(document.head || document.documentElement).appendChild(s);
