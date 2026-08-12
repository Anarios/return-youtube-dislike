import { getButtons } from "./src/buttons";
import { initializeShortsStateForActiveVideo, isShorts, setInitialState, initExtConfig } from "./src/state";
import { getBrowser, getVideoId, isVideoLoaded } from "./src/utils";
import { addLikeDislikeEventListener, createSmartimationObserver, storageChangeHandler } from "./src/events";
import { initPatreonFeatures } from "./src/patreon";
import { ensureShortsDislikeControl, restoreShortsVoteState } from "./src/shortsDislike";

await initExtConfig();
initPatreonFeatures();

let jsInitChecktimer = null;
let isSetInitialStateDone = false;
let isStorageListenerRegistered = false;
let shortsNavigationObserver = null;
let shortsNavigationObserverTarget = null;

async function initializeShortsDislikeForActiveVideo(videoId) {
  const control = ensureShortsDislikeControl({ videoId });
  if (control) await restoreShortsVoteState(control);
  return control;
}

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
      let shortsInitializationGeneration;
      if (isShorts()) {
        const videoId = getVideoId(window.location.href);
        await initializeShortsDislikeForActiveVideo(videoId);
        if (getVideoId(window.location.href) !== videoId) return;
        shortsInitializationGeneration = initializeShortsStateForActiveVideo(videoId);
      }
      createSmartimationObserver();
      addLikeDislikeEventListener();
      await setInitialState(shortsInitializationGeneration);
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

function injectPageScript(fileName, marker) {
  const root = document.documentElement;
  if (!root || root.hasAttribute(marker)) return null;

  let source;
  try {
    source = chrome.runtime.getURL(fileName);
  } catch {
    return null;
  }

  root.setAttribute(marker, "");
  const script = document.createElement("script");
  script.src = source;
  script.onload = () => script.remove();
  script.onerror = () => script.remove();
  try {
    (document.head || root).appendChild(script);
  } catch {
    script.remove();
    return null;
  }
  return script;
}

injectPageScript("menu-fixer.js", "data-ryd-menu-fixer-installed");

export { initializeShortsDislikeForActiveVideo };
