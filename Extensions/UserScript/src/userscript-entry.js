import { getButtons } from "../../common/buttons";
import { isShorts, setInitialState, initExtConfig } from "../../common/state";
import { isVideoLoaded } from "./utils.userscript";
import { addLikeDislikeEventListener, createSmartimationObserver } from "../../common/events";

// The core bar/tooltip/menu-fix rules from Extensions/combined/content-style.css.
// Kept as a small literal copy rather than importing that file directly: the
// rest of content-style.css is premium-analytics-only CSS with no meaning in
// the userscript, and there is no build-time mechanism to share a CSS partial
// across the Extensions/common boundary at runtime once each side is packaged
// separately. If these rules drift from content-style.css, Extensions/common/bar.js's
// actual DOM output (#ryd-bar-container/#ryd-bar/.ryd-tooltip*) is the tiebreaker.
const CORE_STYLES = `
#ryd-bar-container {
  background: var(--yt-spec-icon-disabled);
  border-radius: 2px;
}

#ryd-bar {
  background: var(--yt-spec-text-primary);
  border-radius: 2px;
  transition: all 0.15s ease-in-out;
}

.ryd-tooltip {
  display: block;
  height: 2px;
}

.ryd-tooltip-old-design {
  position: relative;
  top: 9px;
}

.ryd-tooltip-new-design {
  position: absolute;
  bottom: -10px;
}

.ryd-tooltip-bar-container {
  width: 100%;
  height: 2px;
  position: absolute;
  padding-top: 6px;
  padding-bottom: 12px;
  top: -6px;
}

/* required to make the ratio bar visible in the new design */
ytd-menu-renderer.ytd-watch-metadata {
  overflow-y: visible !important;
}

#top-level-buttons-computed {
  position: relative !important;
}
`;

(typeof GM_addStyle !== "undefined"
  ? GM_addStyle
  : (styles) => {
      const styleNode = document.createElement("style");
      styleNode.textContent = styles;
      document.head.appendChild(styleNode);
    })(CORE_STYLES);

let jsInitChecktimer = null;
let isSetInitialStateDone = false;
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
      // Intentionally no storage.onChanged listener here: the userscript has
      // no options UI or background script to broadcast a config change from.
    }
  } catch (exception) {
    if (!isSetInitialStateDone) {
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

(async function () {
  "use strict";
  await initExtConfig();
  await setEventListeners();
  document.addEventListener("yt-navigate-finish", async function () {
    await setEventListeners();
  });
})();
