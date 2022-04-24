//---   Import Button Functions   ---//
import {
  getButtons,
  getLikeButton,
  getDislikeButton,
  checkForSignInButton,
} from "./src/buttons";

//---   Import State Functions   ---//
import {
  isMobile,
  isShorts,
  isVideoDisliked,
  isVideoLiked,
  getState,
  setState,
  setInitialState,
  setLikes,
  setDislikes,
  getLikeCountFromButton,
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  initExtConfig,
} from "./src/state";

//---   Import Video & Browser Functions   ---//
import {
  numberFormat,
  getBrowser,
  getVideoId,
  isVideoLoaded,
  cLog,
} from "./src/utils";
import { createRateBar } from "./src/bar";
import {
  sendVideoIds,
  sendVote,
  likeClicked,
  dislikeClicked,
  addLikeDislikeEventListener,
  storageChangeHandler,
} from "./src/events";

initExtConfig();

let jsInitChecktimer = null;

function setEventListeners(evt) {
  function checkForJS_Finish() {
    if (isShorts() || (getButtons()?.offsetParent && isVideoLoaded())) {
      addLikeDislikeEventListener();
      setInitialState();
      getBrowser().storage.onChanged.addListener(storageChangeHandler);
      clearInterval(jsInitChecktimer);
      jsInitChecktimer = null;
    }
  }

  jsInitChecktimer = setInterval(checkForJS_Finish, 111);
}

setEventListeners();

document.addEventListener("yt-navigate-finish", function (event) {
  if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
  window.returnDislikeButtonlistenersSet = false;
  setEventListeners();
});

setTimeout(() => sendVideoIds(), 2500);

function initializeInfoPanelButton() {
  let ytpRightControls = document.querySelector("#movie_player > div.ytp-chrome-bottom > div.ytp-chrome-controls > div.ytp-right-controls");
  let RYDInfoPanelButton = document.createElement("button");
  RYDInfoPanelButton.setAttribute("id", "RYDInfoPanelButton");
  RYDInfoPanelButton.setAttribute("class", "ytp-button");
  RYDInfoPanelButton.innerHTML = '<svg height="100%" viewBox="0 -9 36 36" width="100%"><use class="ytp-svg-shadow"></use><path d="M5 0h8.9c1.1 0 2 .9 2.1 2v9.9c0 .5-.2 1-.6 1.4l-6.5 6.6-1.1-1.1c-.4-.4-.5-.9-.4-1.4l.9-4.5H2c-1.1 0-2-.9-2-2v-2c0-.2 0-.4.1-.7l3-7C3.4.5 4.1 0 5 0Zm13.4 12.8h2.9c.4 0 .7-.4.7-.8V.9c0-.4-.3-.7-.7-.7h-2.9c-.4 0-.7.3-.7.7v11.2c0 .4.3.7.7.7Zm-6.3-6.2L7 9.5V3.7l5.1 2.9Z" fill="#fff"></path></svg>';
  ytpRightControls.firstElementChild.insertAdjacentElement('beforebegin', RYDInfoPanelButton);
  document.getElementById("RYDInfoPanelButton").addEventListener('click', showRYDInfoPanel);
}

function showRYDInfoPanel() {
  if (document.getElementById("RYDInfoPanel")) { document.getElementById("RYDInfoPanel").remove(); return; }
  console.log("qwerty");
  let YTPageRightSide = document.querySelector("#secondary");
  let RYDInfoPanel = document.createElement("div");
  RYDInfoPanel.setAttribute("id", "RYDInfoPanel");
  RYDInfoPanel.setAttribute("style", "color: white; background-color: rgb(68, 68, 68); border-radius: 2rem; padding: 2rem; box-shadow: 0.5em 1em 2em 0.5rem rgba(0,0,0,0.2);");

  // expected API response
  let response = {
      "id": "swLyst02ZK4",
      "dateCreated": "2022-04-24T07:14:29.808647Z",
      "likes": 105696,
      "dislikes": 180,
      "rating": 4.993199591975518,
      "viewCount": 2016789,
      "deleted": false,
      "extensionUsersLikeCount": 10569,
      "extensionUsersDislikeCount": 18,
      "extensionUsersVotes": 10600
  };

  RYDInfoPanel.innerHTML = `
  <p style="text-align: center; font-size: 3rem;">
  <svg style="align: start;" width="1em" height="0.7em" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="red" fill-rule="evenodd" clip-rule="evenodd" d="M5 0h8.9c1.1 0 2 .9 2.1 2v9.9c0 .5-.2 1-.6 1.4l-6.5 6.6-1.1-1.1c-.4-.4-.5-.9-.4-1.4l.9-4.5H2c-1.1 0-2-.9-2-2v-2c0-.2 0-.4.1-.7l3-7C3.4.5 4.1 0 5 0Zm13.4 12.8h2.9c.4 0 .7-.4.7-.8V.9c0-.4-.3-.7-.7-.7h-2.9c-.4 0-.7.3-.7.7v11.2c0 .4.3.7.7.7Zm-6.3-6.2L7 9.5V3.7l5.1 2.9Z" fill="#fff"/>
  </svg>      
  Return YouTube Dislike
  </p>

  <br><br>

  <div id="RYDInfoPanel_GeneralInfo" style="border-radius:1.5rem; padding: 1rem; box-shadow: 0.5rem 0.25rem 0.5rem 0.9rem rgba(0, 0, 0, 0.3);">
  <h2 style="text-align: center;">General Stats</h2><br>
  <table style="width:100%; color: white;">
  <tr>
    <th>Likes:</th>
    <td>${response.likes}</td>
  </tr>
  <tr>
    <th>Dislikes:</th>
    <td>${response.dislikes}</td>
  </tr>
  <tr>
    <th>Views:</th>
    <td>${response.viewCount}</td>
  </tr>
  <tr>
  <th>Rating: </th>
  <td>${response.rating}</td>
  </tr>
  <tr>
  <th>Entry Created on: </th>
  <td>${response.dateCreated}</td>
  </tr>
  </table>
  </div>

  <br><br>

  <div id="RYDInfoPanel_ExtensionUsersInfo" style="border-radius:1.5rem; padding: 1rem; box-shadow: 0.5rem 0.25rem 0.5rem 0.9rem rgba(0,0,0,0.3);">
  <h2 style="text-align: center;">Extension Users' Stats</h2><br>

  <table style="width:100%; color: white;">
  <tr>
    <th>Likes:</th>
    <td>${response.extensionUsersLikeCount}</td>
  </tr>
  <tr>
    <th>Dislikes:</th>
    <td>${response.extensionUsersDislikeCount}</td>
  </tr>
  <tr>
  <th>Neutral Votes:</th>
  <td>${response.extensionUsersVotes - response.extensionUsersDislikeCount - response.extensionUsersLikeCount}</td>
  </tr>
  <tr>
    <th>Rating:</th>
    <td>${response.extensionUsersLikeCount / (response.extensionUsersLikeCount + response.extensionUsersDislikeCount)}</td>
  </tr>
  <tr>
  <th>Votes: </th>
  <td>${response.extensionUsersVotes}</td>
  </tr>
  <tr>
  <th>User Percentage: </th>
  <td>${(response.extensionUsersVotes / (response.likes + response.dislikes))*100}%</td>
  </tr>
  </table>

  </div>
  <br>
  `;

  YTPageRightSide.firstElementChild.insertAdjacentElement('beforebegin', RYDInfoPanel);

  let brTag = document.createElement('div');
  brTag.innerHTML = '<br><br>';
  document.getElementById('RYDInfoPanel').insertAdjacentElement('afterend', brTag);
}

initializeInfoPanelButton();
