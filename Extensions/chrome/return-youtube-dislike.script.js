(function (extensionId) {
  let storedData = {
    dislikes: 0,
    previousState: 'neutral'
  };

  function cLog(message, writer) {
    message = `[return youtube dislike]: ${message}`;
    if (writer) {
      writer(message);
    } else {
      console.log(message);
    }
  }

  function getButtons() {

    //---   If Menu Element Is Displayed:   ---//
    if (document.getElementById('menu-container').offsetParent === null) {
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
      return {current: "liked", previous: storedData.previousState};
    }
    if (isVideoDisliked()) {
      return {current: "disliked", previous: storedData.previousState};
    }
    return {current: "neutral", previous: storedData.previousState};
  }

  //---   Sets The Likes And Dislikes Values   ---//
  function setLikes(likesCount) {
    getButtons().children[0].querySelector("#text").innerText = likesCount;
  }
  function setDislikes(dislikesCount) {
    getButtons().children[1].querySelector("#text").innerText = dislikesCount;
  }



  function setState() {
    let statsSet = false;
    chrome.runtime.sendMessage(
      extensionId,
      {
        message: "fetch_from_youtube",
        videoId: getVideoId(window.location.href),
      },
      function (response) {
        if (response != undefined) {
          cLog("response from youtube:");
          cLog(JSON.stringify(response));
          try {
            if (response.likes && response.dislikes) {
              const formattedDislike = numberFormat(response.dislikes);
              setDislikes(formattedDislike);
              storedData.dislikes = parseInt(response.dislikes);
              createRateBar(response.likes, response.dislikes);
              statsSet = true;
            }
          } catch (e) {
            statsSet = false;
          }
        }
      }
    );

    chrome.runtime.sendMessage(
      extensionId,
      {
        message: "set_state",
        videoId: getVideoId(window.location.href),
        state: getState().current,
      },
      function (response) {
        cLog("response from api:");
        cLog(JSON.stringify(response));
        if (response != undefined && !statsSet) {
          const formattedDislike = numberFormat(response.dislikes);
          // setLikes(response.likes);
          setDislikes(formattedDislike);
          createRateBar(response.likes, response.dislikes);
        } else {
        }
      }
    );
  }

  function likeClicked() {
    console.log(storedData.previousState)
    if (storedData.previousState == 'disliked') {
      storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = 'liked';
    }
  }

  function dislikeClicked() {
    let state = getState().current;

    console.log("Dislike State:",getState());

    if (state == 'disliked') {
      storedData.dislikes++;
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = 'disliked';
    } else if (state == 'neutral') {
      storedData.dislikes--;
      setDislikes(numberFormat(storedData.dislikes));
      storedData.previousState = 'neutral';
    }

    // setState();
  }

  function setInitalState() {
    setState();
    setTimeout(() => sendVideoIds(), 1500);
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

  function numberFormat(num) {
    const sign = [
      [1e6, "M"],
      [1e3, "K"],
      [1, ""],
    ];
    for (let i = 0; i <= sign.length; i++)
      if (num >= sign[i][0])
        return (num / sign[i][0]).toFixed(1).replace(".0", "") + sign[i][1];
  }

  var jsInitChecktimer = null;

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
        setInitalState();
      }
    }

    if (window.location.href.indexOf("watch?") >= 0) {
      jsInitChecktimer = setInterval(checkForJS_Finish, 111);
    }
  }

  function createRateBar(likes, dislikes) {
    var rateBar = document.getElementById(
      "return-youtube-dislike-bar-container"
    );

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

      document.querySelector(
        "#ryd-dislike-tooltip > #tooltip"
      ).innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
    }
  }

  function sendVideoIds() {
    const ids = Array.from(
      document.getElementsByClassName(
        "yt-simple-endpoint ytd-compact-video-renderer"
      )
    )
      .concat(
        Array.from(
          document.getElementsByClassName("yt-simple-endpoint ytd-thumbnail")
        )
      )
      .filter((x) => x.href && x.href.indexOf("/watch?v=") > 0)
      .map((x) => getVideoId(x.href));
    chrome.runtime.sendMessage(extensionId, {
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
})(document.currentScript.getAttribute("extension-id"));
