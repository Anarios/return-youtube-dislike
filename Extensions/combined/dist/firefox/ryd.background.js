const apiUrl = "https://returnyoutubedislikeapi.com";
let api;
if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined")
  api = chrome;
else if (
  typeof browser !== "undefined" &&
  typeof browser.runtime !== "undefined"
)
  api = browser;

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "get_auth_token") {
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    //   console.log(token);
    //   chrome.identity.getProfileUserInfo(function (userInfo) {
    //     console.log(JSON.stringify(userInfo));
    //   });
    // });
  } else if (request.message === "log_off") {
    // chrome.identity.clearAllCachedAuthTokens(() => console.log("logged off"));
  } else if (request.message == "set_state") {
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    let token = "";
    fetch(`${apiUrl}/votes?videoId=${request.videoId}&likeCount=${request.likeCount || ''}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => response.json())
      .then((response) => {
        sendResponse(response);
      })
      .catch();
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
  } else if (request.message == "register") {
    register();
    return true;
  } else if (request.message == "send_vote") {
    sendVote(request.videoId, request.vote);
    return true;
  }
});

async function sendVote(videoId, vote) {
  api.storage.sync.get(null, async (storageResult) => {
    if (!storageResult.userId || !storageResult.registrationConfirmed) {
      await register();
      return;
    }
    fetch(`${apiUrl}/interact/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: storageResult.userId,
        videoId,
        value: vote,
      }),
    })
      .then(async (response) => {
        if (response.status == 401) {
          await register();
          await sendVote(videoId, vote);
          return;
        }
        return response.json()
      })
      .then((response) => {
        solvePuzzle(response).then((solvedPuzzle) => {
          fetch(`${apiUrl}/interact/confirmVote`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...solvedPuzzle,
              userId: storageResult.userId,
              videoId,
            }),
          });
        });
      });
  });
}

function register() {
  let userId = generateUserID();
  api.storage.sync.set({ userId });
  return fetch(`${apiUrl}/puzzle/registration?userId=${userId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => response.json())
    .then((response) => {
      return solvePuzzle(response).then((solvedPuzzle) => {
        return fetch(`${apiUrl}/puzzle/registration?userId=${userId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(solvedPuzzle),
        }).then((response) =>
          response.json().then((result) => {
            if (result === true) {
              return api.storage.sync.set({ registrationConfirmed: true });
            }
          })
        );
      });
    })
    .catch();
}

api.storage.sync.get(null, (res) => {
  if (!res || !res.userId || !res.registrationConfirmed) {
    register();
  }
});

const sentIds = new Set();
let toSend = [];

function sendUserSubmittedStatisticsToApi(statistics) {
  fetch(`${apiUrl}/votes/user-submitted`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(statistics),
  });
}

function countLeadingZeroes(uInt8View, limit) {
  let zeroes = 0;
  let value = 0;
  for (let i = 0; i < uInt8View.length; i++) {
    value = uInt8View[i];
    if (value === 0) {
      zeroes += 8;
    } else {
      let count = 1;
      if (value >>> 4 === 0) {
        count += 4;
        value <<= 4;
      }
      if (value >>> 6 === 0) {
        count += 2;
        value <<= 2;
      }
      zeroes += count - (value >>> 7);
      break;
    }
    if (zeroes >= limit) {
      break;
    }
  }
  return zeroes;
}

async function solvePuzzle(puzzle) {
  let challenge = Uint8Array.from(atob(puzzle.challenge), (c) =>
    c.charCodeAt(0)
  );
  let buffer = new ArrayBuffer(20);
  let uInt8View = new Uint8Array(buffer);
  let uInt32View = new Uint32Array(buffer);
  let maxCount = Math.pow(2, puzzle.difficulty) * 5;
  for (let i = 4; i < 20; i++) {
    uInt8View[i] = challenge[i - 4];
  }

  for (let i = 0; i < maxCount; i++) {
    uInt32View[0] = i;
    let hash = await crypto.subtle.digest("SHA-512", buffer);
    let hashUint8 = new Uint8Array(hash);
    if (countLeadingZeroes(hashUint8) >= puzzle.difficulty) {
      return {
        solution: btoa(String.fromCharCode.apply(null, uInt8View.slice(0, 4))),
      };
    }
  }
}

function generateUserID(length = 36) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  if (crypto && crypto.getRandomValues) {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    return result;
  } else {
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
  }
}
