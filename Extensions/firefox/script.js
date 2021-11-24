function cLog(message, writer) {
  message = `[return youtube dislike]: ${message}`;
  if (writer) {
    writer(message);
  } else {
    console.log(message);
  }
}

function getButtons() {
  return document
    .getElementById("menu-container")
    ?.querySelector("#top-level-buttons-computed");
}

function getLikeButton() {
  return getButtons().children[0];
}

function getDislikeButton() {
  return getButtons().children[1];
}

function isVideoLiked() {
  return getLikeButton().classList.contains("style-default-active");
}

function isVideoDisliked() {
  return getDislikeButton().classList.contains("style-default-active");
}

function isVideoNotLiked() {
  return getLikeButton().classList.contains("style-text");
}

function isVideoNotDisliked() {
  return getDislikeButton().classList.contains("style-text");
}

function getState() {
  if (isVideoLiked()) {
    return "liked";
  }
  if (isVideoDisliked()) {
    return "disliked";
  }
  return "neutral";
}

function setLikes(likesCount) {
  getButtons().children[0].querySelector("#text").innerText = likesCount;
}

function setDislikes(dislikesCount) {
  getButtons().children[1].querySelector("#text").innerText = dislikesCount;
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
          if (response.likes || response.dislikes) {
            const formattedDislike = numberFormat(response.dislikes);
            setDislikes(formattedDislike);
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
      state: getState(),
    },
    function (response) {
      cLog("response from api:");
      cLog(JSON.stringify(response));
      if (response != undefined && !statsSet) {
        const formattedDislike = numberFormat(response.dislikes);
        // setLikes(response.likes);
        console.log(response);
        setDislikes(formattedDislike);
        createRateBar(response.likes, response.dislikes);
      } else {
      }
    }
  );
}

function getVideoId(url) {
  const urlObject = new URL(url);
  const videoId = urlObject.searchParams.get("v");
  return videoId;
}

function isVideoLoaded() {
  const videoId = getVideoId(window.location.href);
  return (
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null
  );
}

function numberFormat(numberState) {
  const userLocales = navigator.language;
  const formatter = Intl.NumberFormat(userLocales, { notation: "compact" });
  return formatter.format(numberState);
}

function setEventListeners(evt) {
  function checkForJS_Finish() {
    if (getButtons()?.offsetParent && isVideoLoaded()) {
      clearInterval(jsInitChecktimer);
      const buttons = getButtons();
      if (!window.returnDislikeButtonlistenersSet) {
        buttons.children[0].addEventListener("click", likeClicked);
        buttons.children[1].addEventListener("click", dislikeClicked);
        let lastKnownScrollPosition = 0;
        let ticking = false;
        window.returnDislikeButtonlistenersSet = true;
      }
      setInitalState();
    }
  }

  if (window.location.href.indexOf("watch?") >= 0) {
    var jsInitChecktimer = setInterval(checkForJS_Finish, 111);
  }
}

function createRateBar(likes, dislikes) {
  var rateBar = document.getElementById("return-youtube-dislike-bar-container");

  const widthPx =
      getButtons().children[0].clientWidth +
      getButtons().children[1].clientWidth +
      8;

    const widthPercent =
      likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

    if (!rateBar) {
      document.getElementById("menu-container").insertAdjacentHTML(
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

      document
        .getElementById("ryd-dislike-tooltip")
        .firstChild().innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}</div>`;
    }
}

setEventListeners();
