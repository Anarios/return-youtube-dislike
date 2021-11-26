const apiUrl = "https://return-youtube-dislike-api.azurewebsites.net";

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case "set_state":
      console.log(request);
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
      return true;
    case "send_links":
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
      break;
    case "fetch_from_youtube":
      fetch(`https://www.youtube.com/watch?v=${request.videoId}`, {
        method: "GET",
      })
          .then((response) => response.text())
          .then((text) => {
            let result = getDislikesFromYoutubeResponse(text);
            sendResponse(result);
            try {
              sendUserSubmittedStatisticsToApi({
                ...result,
                videoId: request.videoId,
              });
            } catch {}
          });
      return true;
  }
});

const sentIds = new Set();
let toSend = [];
let lastCalled = new Date();

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status == "complete" && new Date() - lastCalled > 100) {
    lastCalled = new Date();
    console.log("Tab update complete");
    if (tab.url && tab.url.indexOf("youtube.") < 0) return;
    browser.tabs.get(tabId, (tab) => {
      browser.tabs.executeScript(tab.id, {
        file: "script.js",
      });
    });
  }
});

function getDislikesFromYoutubeResponse(htmlResponse) {
  let start =
    htmlResponse.indexOf('"videoDetails":') + '"videoDetails":'.length;
  let end =
    htmlResponse.indexOf('"isLiveContent":false}', start) +
    '"isLiveContent":false}'.length;
  if (end < start) {
    end =
      htmlResponse.indexOf('"isLiveContent":true}', start) +
      '"isLiveContent":true}'.length;
  }
  let jsonStr = htmlResponse.substring(start, end);
  let jsonResult = JSON.parse(jsonStr);
  let rating = jsonResult.averageRating;

  start = htmlResponse.indexOf('"topLevelButtons":[', end);
  start =
    htmlResponse.indexOf('"accessibilityData":', start) +
    '"accessibilityData":'.length;
  end = htmlResponse.indexOf("}", start);
  let likes = +htmlResponse.substring(start, end).replace(/\D/g, "");
  let dislikes = (likes * (5 - rating)) / (rating - 1);
  let result = {
    likes,
    dislikes: Math.round(dislikes),
    rating,
    viewCount: +jsonResult.viewCount,
  };
  return result;
}

function sendUserSubmittedStatisticsToApi(statistics) {
  fetch(`${apiUrl}/votes/user-submitted`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(statistics),
  });
}
