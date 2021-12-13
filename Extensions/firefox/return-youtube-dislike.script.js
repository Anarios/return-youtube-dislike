var LIKED_STATE = "LIKED_STATE";
var DISLIKED_STATE = "DISLIKED_STATE";
var NEUTRAL_STATE = "NEUTRAL_STATE";

if (!storedData) {
  var storedData = {
    likes: 0,
    dislikes: 0,
    previousState: NEUTRAL_STATE,
  };
}

function cLog(message, writer) {
  message = `[return youtube dislike]: ${message}`;
  if (writer) {
    writer(message);
  } else {
    console.log(message);
  }
}

function getButtons() {
  let menu_container = document.getElementById("menu-container");
  //---   m.youtube.com:   ---//
  if (menu_container === null) {
    return document.querySelector(".slim-video-action-bar-actions");
    //---   If Menu Element Is Displayed:   ---//
  } else if (menu_container.offsetParent === null) {
    return document.querySelector("ytd-menu-renderer.ytd-watch-metadata > div");
    //---   If Menu Element Isnt Displayed:   ---//
  } else {
    return menu_container.querySelector("#top-level-buttons-computed");
  }
}

function getLikeButton() {
  return getButtons().children[0];
}

function getDislikeButton() {
  return getButtons().children[1];
}

function isVideoLiked() {
  return getLikeButton().classList.contains("style-default-active")
      || getLikeButton().querySelector('[aria-pressed="true"]') !== null;
}

function isVideoDisliked() {
  return getDislikeButton().classList.contains("style-default-active")
      || getDislikeButton().querySelector('[aria-pressed="true"]') !== null;
}

function isVideoNotLiked() {
  return getLikeButton().classList.contains("style-text")
      || getLikeButton().querySelector('[aria-pressed="false"]') !== null;
}

function isVideoNotDisliked() {
  return getDislikeButton().classList.contains("style-text")
      || getDislikeButton().querySelector('[aria-pressed="false"]') !== null;
}

function checkForUserAvatarButton() {
  if (document.querySelector('#avatar-btn')) {
    return true
  } else {
    return false
  }
}

function getState() {
  if (isVideoLiked()) {
    return { current: LIKED_STATE, previous: storedData.previousState };
  }
  if (isVideoDisliked()) {
    return { current: DISLIKED_STATE, previous: storedData.previousState };
  }
  return { current: NEUTRAL_STATE, previous: storedData.previousState };
}

//---   Sets The Likes And Dislikes Values   ---//
function setLikes(likesCount) {
  getLikeButton().querySelector("#text, .button-renderer-text").innerText = likesCount;
}
function setDislikes(dislikesCount) {
  getDislikeButton().querySelector("#text, .button-renderer-text").innerText = dislikesCount;
}

function setState() {
  let statsSet = false;
  browser.runtime.sendMessage(
    {
      message: "fetch_from_youtube",
      videoId: getVideoId(window.location.href),
    },
    function (response) {
      if (response != undefined) {
        cLog("response from youtube:");
        cLog(JSON.stringify(response));
        try {
          if ("likes" in response && "dislikes" in response) {
            const formattedDislike = numberFormat(response.dislikes);
            setDislikes(formattedDislike);
            storedData.dislikes = parseInt(response.dislikes);
            storedData.likes = parseInt(response.likes)
            createRateBar(response.likes, response.dislikes);
            statsSet = true;
          }
        } catch (e) {
          statsSet = false;
        }
      }
    }
  );

  browser.runtime.sendMessage(
    {
      message: "set_state",
      videoId: getVideoId(window.location.href),
      state: getState().current,
    },
    function (response) {
      cLog("response from api:");
      cLog(JSON.stringify(response));
      if (response != undefined && !("traceId" in response) && !statsSet) {
        const formattedDislike = numberFormat(response.dislikes);
        storedData.dislikes = response.dislikes;
        // setLikes(response.likes);
        console.log(response);
        setDislikes(formattedDislike);
        createRateBar(response.likes, response.dislikes);
      } else {
      }
    }
  );
}

function likeClicked() {
  if (checkForUserAvatarButton() == true) {
    if (storedData.previousState == DISLIKED_STATE) {
      storedData.dislikes--;
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState == NEUTRAL_STATE) {
      storedData.likes++;
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = LIKED_STATE;
    } else if (storedData.previousState == LIKED_STATE) {
      storedData.likes--;
      createRateBar(storedData.likes, storedData.dislikes)
      storedData.previousState = NEUTRAL_STATE;
    }
  }
}

function dislikeClicked() {
  if (checkForUserAvatarButton() == true) {
    if (storedData.previousState == NEUTRAL_STATE) {
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = DISLIKED_STATE;
    } else if (storedData.previousState == DISLIKED_STATE) {
      storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      createRateBar(storedData.likes, storedData.dislikes);
      storedData.previousState = NEUTRAL_STATE;
    } else if (storedData.previousState == LIKED_STATE) {
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
  // setTimeout(() => sendVideoIds(), 1500);
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

function roundDown(num) {
  if (num < 1000) return num;
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  const userLocales = new URL(
    Array.from(document.querySelectorAll("head > link[rel='search']"))
      ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
      ?.getAttribute("href")
  )?.searchParams?.get("locale");
  const formatter = Intl.NumberFormat(document.documentElement.lang || userLocales || navigator.language, {
    notation: "compact",
  });

  return formatter.format(roundDown(numberState));
}

function setEventListeners(evt) {
  let jsInitChecktimer;
  function checkForJS_Finish() {
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      const buttons = getButtons();
      if (!window.returnDislikeButtonlistenersSet) {
        getLikeButton().addEventListener("click", likeClicked);
        getDislikeButton().addEventListener("click", dislikeClicked);
        let lastKnownScrollPosition = 0;
        let ticking = false;
        // document.addEventListener('scroll', function(e) {
        //   lastKnownScrollPosition = window.scrollY;
        //
        //   if (!ticking) {
        //     window.requestAnimationFrame(function() {
        //       // sendVideoIds();
        //       ticking = false;
        //     });
        //
        //     ticking = true;
        //   }
        // });
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
  let rateBar = document.getElementById("return-youtube-dislike-bar-container");

  const widthPx =
    getLikeButton().clientWidth +
    getDislikeButton().clientWidth +
    8;

  const widthPercent =
    likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

  if (!rateBar) {
    (
      document.getElementById("actions-inner") ||
      document.getElementById("menu-container") ||
      document.querySelector("ytm-slim-video-action-bar-renderer")
    ).insertAdjacentHTML(
      "beforeend",
      `
          <div class="ryd-tooltip" style="width: ${widthPx}px">
          <div class="ryd-tooltip-bar-container">
             <div
                id="return-youtube-dislike-bar-container"
                style="width: 100%; height: 2px;"
                >
                <div
                   id="return-youtube-dislike-bar"
                   style="width: ${widthPercent}%; height: 100%"
                   ></div>
             </div>
          </div>
          <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
          <div>
             <!--css-build:shady-->${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}
          </tp-yt-paper-tooltip>
          </div>
  `
    );
  } else {
    document.getElementById(
      "return-youtube-dislike-bar-container"
    ).style.width = widthPx + "px";
    document.getElementById("return-youtube-dislike-bar").style.width =
      widthPercent + "%";

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
  if (links.length < 1) links = Array.from(
    document.querySelectorAll(".large-media-item-metadata > a, a.large-media-item-thumbnail-container")
  );
  const ids = links.filter((x) => x.href && x.href.indexOf("/watch?v=") > 0)
    .map((x) => getVideoId(x.href));
  browser.runtime.sendMessage({
    message: "send_links",
    videoIds: ids,
  });
}

setEventListeners();

setTimeout(() => sendVideoIds(), 1500);
