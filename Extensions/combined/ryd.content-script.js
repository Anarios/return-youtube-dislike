function RYD() {
  const LIKED_STATE = "LIKED_STATE";
  const DISLIKED_STATE = "DISLIKED_STATE";
  const NEUTRAL_STATE = "NEUTRAL_STATE";

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

  function isMobile() {
    return location.hostname == "m.youtube.com";
  }

  function getButtons() {
    if (isMobile()) {
      return document.querySelector(".slim-video-action-bar-actions");
    }
    //---   If Menu Element Is Displayed:   ---//
    if (document.getElementById("menu-container")?.offsetParent === null) {
      return document.querySelector(
        "ytd-menu-renderer.ytd-watch-metadata > div"
      );
      //---   If Menu Element Isnt Displayed:   ---//
    } else {
      return document
        .getElementById("menu-container")
        ?.querySelector("#top-level-buttons-computed");
    }
  }

  function getLikeButton() {
    return getButtons().children[0];
  }

  function getDislikeButton() {
    return getButtons().children[1];
  }

  function isVideoLiked() {
    if (isMobile()) {
      return (
        getLikeButton().querySelector("button").getAttribute("aria-label") ==
        "true"
      );
    }
    return getLikeButton().classList.contains("style-default-active");
  }

  function isVideoDisliked() {
    if (isMobile()) {
      return (
        getDislikeButton().querySelector("button").getAttribute("aria-label") ==
        "true"
      );
    }
    return getDislikeButton().classList.contains("style-default-active");
  }

  function isVideoNotLiked() {
    return getLikeButton().classList.contains("style-text");
  }

  function isVideoNotDisliked() {
    return getDislikeButton().classList.contains("style-text");
  }

  function checkForSignInButton() {
    if (
      document.querySelector(
        "a[href^='https://accounts.google.com/ServiceLogin']"
      )
    ) {
      return true;
    } else {
      return false;
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
    getButtons().children[0].querySelector("#text").innerText = likesCount;
  }

  function setDislikes(dislikesCount) {
    if (isMobile()) {
      getButtons().children[1].querySelector(
        ".button-renderer-text"
      ).innerText = dislikesCount;
      return;
    }
    getButtons().children[1].querySelector("#text").innerText = dislikesCount;
  }

  function getLikeCountFromButton() {
    let likesStr = getLikeButton()
      .querySelector("button")
      .getAttribute("aria-label")
      .replace(/\D/g, "");
    return likesStr.length > 0 ? parseInt(likesStr) : false;
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
    RYDTools.getBrowser().runtime.sendMessage(
      {
        message: "fetch_from_youtube",
        videoId: getVideoId(window.location.href),
      },
      function (response) {
        if (response !== undefined) {
          cLog("response from youtube:");
          cLog(JSON.stringify(response));
          try {
            if (
              "likes" in response &&
              "dislikes" in response &&
              response.dislikes !== null
            ) {
              processResponse(response);
              statsSet = true;
            }
          } catch (e) {}
        }
      }
    );

    RYDTools.getBrowser().runtime.sendMessage(
      {
        message: "set_state",
        videoId: getVideoId(window.location.href),
        state: getState().current,
        likeCount: getLikeCountFromButton() || null
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
    RYDTools.getBrowser().runtime.sendMessage({
      message: "send_vote",
      vote: vote,
      videoId: getVideoId(window.location.href)
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
      document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !==
        null ||
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
    let userLocales;
    try {
      userLocales = new URL(
        Array.from(document.querySelectorAll("head > link[rel='search']"))
          ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
          ?.getAttribute("href")
      )?.searchParams?.get("locale");
    } catch {}
    const formatter = Intl.NumberFormat(
      document.documentElement.lang || userLocales || navigator.language,
      {
        notation: "compact",
      }
    );

    return formatter.format(roundDown(numberState));
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
    RYDTools.getBrowser().runtime.sendMessage({
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

  this.init = function () {};
}

RYD.getInstance = function () {
  if (typeof RYD.instance == "undefined") RYD.instance = new RYD();
  return RYD.instance;
};
