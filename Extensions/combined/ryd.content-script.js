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
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
} from "./src/state";

import { numberFormat } from "./src/utils";

let storedData = {
  likes: 0,
  dislikes: 0,
  previousState: NEUTRAL_STATE,
};

function cLog(message, writer) {
  message = `[return youtube dislike]: ${message}`;
  if (writer) {
    writer(message);
  } else {
    console.log(message);
  }
}

function processResponse(response) {
  const formattedDislike = numberFormat(response.dislikes);
  setDislikes(formattedDislike);
  storedData.dislikes = parseInt(response.dislikes);
  storedData.likes = getLikeCountFromButton() || parseInt(response.likes);
  createRateBar(storedData.likes, storedData.dislikes);
}

function setState() {
  storedData.previousState = isVideoDisliked()
    ? DISLIKED_STATE
    : isVideoLiked()
    ? LIKED_STATE
    : NEUTRAL_STATE;
  let statsSet = false;

  getBrowser().runtime.sendMessage(
    {
      message: "set_state",
      videoId: getVideoId(window.location.href),
      state: getState(storedData).current,
      likeCount: getLikeCountFromButton() || null,
    },
    function (response) {
      cLog("response from api:");
      cLog(JSON.stringify(response));
      if (response !== undefined && !("traceId" in response) && !statsSet) {
        processResponse(response);
      } else {
      }
    }
  );
}

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
  setState();
  setTimeout(() => {
    sendVideoIds();
  }, 1500);
}

function getVideoId(url) {
  const urlObject = new URL(url);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return document.querySelector("meta[itemprop='videoId']").content;
  } else {
    return urlObject.searchParams.get("v");
  }
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

function createRateBar(likes, dislikes) {
  let rateBar = document.getElementById("ryd-bar-container");

  const widthPx =
    getButtons().children[0].clientWidth +
    getButtons().children[1].clientWidth +
    8;

  const widthPercent =
    likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  if (!rateBar) {
    (
      document.getElementById("menu-container") ||
      document.querySelector("ytm-slim-video-action-bar-renderer")
    ).insertAdjacentHTML(
      "beforeend",
      `
          <div class="ryd-tooltip" style="width: ${widthPx}px">
          <div class="ryd-tooltip-bar-container">
             <div
                id="ryd-bar-container"
                style="width: 100%; height: 2px;"
                >
                <div
                   id="ryd-bar"
                   style="width: ${widthPercent}%; height: 100%"
                   ></div>
             </div>
          </div>
          <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
             <!--css-build:shady-->${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}
          </tp-yt-paper-tooltip>
          </div>
  `
    );
  } else {
    document.getElementById("ryd-bar-container").style.width = widthPx + "px";
    document.getElementById("ryd-bar").style.width = widthPercent + "%";

    document.querySelector(
      "#ryd-dislike-tooltip > #tooltip"
    ).innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
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

function getBrowser() {
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
    return chrome;
  } else if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined"
  ) {
    return browser;
  } else {
    console.log("browser is not supported");
    return false;
  }
}
