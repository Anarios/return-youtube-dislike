const apiUrl = "https://return-youtube-dislike-api.azurewebsites.net";

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "get_auth_token") {
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    //   console.log(token);
    //   chrome.identity.getProfileUserInfo(function (userInfo) {
    //     console.log(JSON.stringify(userInfo));
    //   });
    // });
  } else if (request.message === "log_off") {
    // console.log("logging off");
    // chrome.identity.clearAllCachedAuthTokens(() => console.log("logged off"));
  } else if (request.message == "set_state") {
    console.log(request);
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    let token = "";
    fetch(`${apiUrl}/votes?videoId=${request.videoId}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((response) => {
        console.log(response);
        sendResponse(response);
      })
      .catch();
    //});
    return true;
  } else if (request.message == "send_links") {
    toSend = toSend.concat(request.videoIds.filter((x) => !sentIds.has(x)));
    if (toSend.length >= 20) {
      fetch(`${apiUrl}/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toSend),
      });
      for (const toSendUrl of toSend) {
        sentIds.add(toSendUrl);
      }
      toSend = [];
    }
  }
});

const sentIds = new Set();
let toSend = [];

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status == "complete") {
    if (tab.url && tab.url.indexOf("youtube.") < 0) return;
    browser.tabs.get(tabId, (tab) => {
      browser.tabs.executeScript(tab.id, {
        file: "script.js",
      });
    });
  }
});
