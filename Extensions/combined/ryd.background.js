const apiUrl = "https://returnyoutubedislikeapi.com";
const voteDisabledIconName = "icon_hold128.png";
const defaultIconName = "icon128.png";
let api;

/** stores extension's global config */
let extConfig = {
  disableVoteSubmission: false,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic", // classic, accessible, neon
  numberDisplayFormat: "compactShort", // compactShort, compactLong, standard
  numberDisplayRoundDown: true, // locale 'de' shows exact numbers by default
  showUpdatePopup: false, 
  numberDisplayReformatLikes: false, // use existing (native) likes number
};

if (isChrome()) api = chrome;
else if (isFirefox()) api = browser;

initExtConfig();

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "get_auth_token") {
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      console.log(token);
      chrome.identity.getProfileUserInfo(function (userInfo) {
        console.log(JSON.stringify(userInfo));
      });
    });
  } else if (request.message === "log_off") {
    // chrome.identity.clearAllCachedAuthTokens(() => console.log("logged off"));
  } else if (request.message == "set_state") {
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    let token = "";
    fetch(
      `${apiUrl}/votes?videoId=${request.videoId}&likeCount=${
        request.likeCount || ""
      }`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    )
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

api.runtime.onInstalled.addListener((details) => {
  // PLEASE DO NOT REMOVE Multiple user complained their UPDATED extension v3.0.0.1 keeps showing popups after browser updates, and this is causing a ton of confusions. 
  // Let's not create such a drama over this little feature. #576 #589 #553 (updated) #569 #572 #556 #544 #537 #535 #534
  // No need for further logic if it's the browser getting the update
  if (details.reason === "chrome_update" || details.reason === "browser_update") {
    return;
  }
  // The redundant logic below is to work around Chrome bug https://github.com/Anarios/return-youtube-dislike/issues/576#issuecomment-1116838544
  // this bug is likely only affecting this single option, since all others are read frequently throughout normal use
  // Also, keep all set inside get callback to avoid race condition, and vice versa
  let tmp_ReallyShowPopup = false;
  api.storage.sync.get(['lastShowChangelogVersion','showUpdatePopup'], (config_sync) => {
    if (config_sync.showUpdatePopup === undefined || config_sync.lastShowChangelogVersion === undefined) { // bug case -- try again with local storage before hard reset
      api.storage.local.get(['lastShowChangelogVersion','showUpdatePopup'], (config_local) => {
        if (config_local.showUpdatePopup === undefined || config_local.lastShowChangelogVersion === undefined) { // this can either be a bug case or uninitialized local storage
          api.storage.local.set({'lastShowChangelogVersion': chrome.runtime.getManifest().version, 'showUpdatePopup': false}, function() {
            api.storage.local.get(['lastShowChangelogVersion','showUpdatePopup'], function (t1) {}); // overcome that bug
          });
          api.storage.sync.set({'lastShowChangelogVersion': chrome.runtime.getManifest().version, 'showUpdatePopup': false}, function() {
            api.storage.sync.get(['lastShowChangelogVersion','showUpdatePopup'], function (t1) {}); // overcome that bug
          });
        } else { // local storage has valid values
          api.storage.sync.set({'lastShowChangelogVersion': config_local.lastShowChangelogVersion, 'showUpdatePopup': config_local.showUpdatePopup}, function() {
            api.storage.sync.get(['lastShowChangelogVersion','showUpdatePopup'], function (t1) {}); // overcome that bug
          });
        if (config_local.showUpdatePopup === true && 
          config_local.lastShowChangelogVersion !== chrome.runtime.getManifest().version
          ) {
          tmp_ReallyShowPopup = true;
        }
        } // if-local
      }); // local-get
    } else { // sync storage has valid values
      api.storage.local.set({'lastShowChangelogVersion': config_sync.lastShowChangelogVersion, 'showUpdatePopup': config_sync.showUpdatePopup}, function() {
        api.storage.local.get(['lastShowChangelogVersion','showUpdatePopup'], function (t1) {}); // overcome that bug
      });
      if (config_sync.showUpdatePopup === true && 
        config_sync.lastShowChangelogVersion !== chrome.runtime.getManifest().version
        ) {
        tmp_ReallyShowPopup = true;
      }
    } // if-sync
    if (details.reason === "install") {
      tmp_ReallyShowPopup = true;
    }
    if (tmp_ReallyShowPopup === true) {
      api.storage.local.set({'lastShowChangelogVersion': chrome.runtime.getManifest().version}, function() {
        api.storage.local.get(['lastShowChangelogVersion'], function (t1) {}); // overcome that bug
      });
      api.storage.sync.set({'lastShowChangelogVersion': chrome.runtime.getManifest().version}, function() {
        api.storage.sync.get(['lastShowChangelogVersion'], function (t1) {}); // overcome that bug
      });
      // don't steal tab focus #553
      api.tabs.create({url: api.runtime.getURL("/changelog/3/changelog_3.0.html"), active: false});
    }
  }); // sync-get
});

async function sendVote(videoId, vote) {
  api.storage.sync.get(null, async (storageResult) => {
    if (!storageResult.userId || !storageResult.registrationConfirmed) {
      await register();
    }
    let voteResponse = await fetch(`${apiUrl}/interact/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: storageResult.userId,
        videoId,
        value: vote,
      }),
    });

    if (voteResponse.status == 401) {
      await register();
      await sendVote(videoId, vote);
      return;
    }
    const voteResponseJson = await voteResponse.json();
    const solvedPuzzle = await solvePuzzle(voteResponseJson);
    if (!solvedPuzzle.solution) {
      await sendVote(videoId, vote);
      return;
    }

    await fetch(`${apiUrl}/interact/confirmVote`, {
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
}

async function register() {
  const userId = generateUserID();
  api.storage.sync.set({ userId });
  const registrationResponse = await fetch(
    `${apiUrl}/puzzle/registration?userId=${userId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  ).then((response) => response.json());
  const solvedPuzzle = await solvePuzzle(registrationResponse);
  if (!solvedPuzzle.solution) {
    await register();
    return;
  }
  const result = await fetch(`${apiUrl}/puzzle/registration?userId=${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(solvedPuzzle),
  }).then((response) => response.json());
  if (result === true) {
    return api.storage.sync.set({ registrationConfirmed: true });
  }
}

api.storage.sync.get(null, async (res) => {
  if (!res || !res.userId || !res.registrationConfirmed) {
    await register();
  }
});

const sentIds = new Set();
let toSend = [];

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
  let maxCount = Math.pow(2, puzzle.difficulty) * 3;
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
  return {};
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

function storageChangeHandler(changes, area) {
  if (changes.disableVoteSubmission !== undefined) {
    handleDisableVoteSubmissionChangeEvent(
      changes.disableVoteSubmission.newValue
    );
  }
  if (changes.coloredThumbs !== undefined) {
    handleColoredThumbsChangeEvent(changes.coloredThumbs.newValue);
  }
  if (changes.coloredBar !== undefined) {
    handleColoredBarChangeEvent(changes.coloredBar.newValue);
  }
  if (changes.colorTheme !== undefined) {
    handleColorThemeChangeEvent(changes.colorTheme.newValue);
  }
  if (changes.numberDisplayRoundDown !== undefined) {
    handleNumberDisplayRoundDownChangeEvent(
      changes.numberDisplayRoundDown.newValue
    );
  }
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (changes.showUpdatePopup !== undefined) {
    handleShowUpdatePopupChangeEvent(changes.showUpdatePopup.newValue);
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(
      changes.numberDisplayReformatLikes.newValue
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
  if (value === true) {
    changeIcon(voteDisabledIconName);
  } else {
    changeIcon(defaultIconName);
  }
}

function handleNumberDisplayFormatChangeEvent(value) {
  extConfig.numberDisplayFormat = value;
}

function handleNumberDisplayRoundDownChangeEvent(value) {
  extConfig.numberDisplayRoundDown = value;
}

function changeIcon(iconName) {
  if (api.action !== undefined)
    api.action.setIcon({ path: "/icons/" + iconName });
  else if (api.browserAction !== undefined)
    api.browserAction.setIcon({ path: "/icons/" + iconName });
  else console.log("changing icon is not supported");
}

function handleColoredThumbsChangeEvent(value) {
  extConfig.coloredThumbs = value;
}

function handleColoredBarChangeEvent(value) {
  extConfig.coloredBar = value;
}

function handleColorThemeChangeEvent(value) {
  if (!value) {
    value = "classic";
  }
  extConfig.colorTheme = value;
}

function handleShowUpdatePopupChangeEvent(value) {
  extConfig.showUpdatePopup = value;
}

function handleNumberDisplayReformatLikesChangeEvent(value) {
  extConfig.numberDisplayReformatLikes = value;
}

api.storage.onChanged.addListener(storageChangeHandler);

function initExtConfig() {
  initializeDisableVoteSubmission();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeNumberDisplayRoundDown();
  initializeShowUpdatePopup();
  initializeNumberDisplayReformatLikes();
}

function initializeDisableVoteSubmission() {
  api.storage.sync.get(["disableVoteSubmission"], (res) => {
    if (res.disableVoteSubmission === undefined) {
      api.storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
      if (res.disableVoteSubmission) changeIcon(voteDisabledIconName);
    }
  });
}

function initializeColoredThumbs() {
  api.storage.sync.get(["coloredThumbs"], (res) => {
    if (res.coloredThumbs === undefined) {
      api.storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeNumberDisplayRoundDown() {
  api.storage.sync.get(["numberDisplayRoundDown"], (res) => {
    if (res.numberDisplayRoundDown === undefined) {
      api.storage.sync.set({ numberDisplayRoundDown: true });
    } else {
      extConfig.numberDisplayRoundDown = res.numberDisplayRoundDown;
    }
  });
}

function initializeColoredBar() {
  api.storage.sync.get(["coloredBar"], (res) => {
    if (res.coloredBar === undefined) {
      api.storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  api.storage.sync.get(["colorTheme"], (res) => {
    if (res.colorTheme === undefined) {
      api.storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  api.storage.sync.get(["numberDisplayFormat"], (res) => {
    if (res.numberDisplayFormat === undefined) {
      api.storage.sync.set({ numberDisplayFormat: "compactShort" });
    } else {
      extConfig.numberDisplayFormat = res.numberDisplayFormat;
    }
  });
}

function initializeShowUpdatePopup() {
  api.storage.sync.get(["showUpdatePopup"], (res) => {
    if (res.showUpdatePopup === undefined) {
      api.storage.sync.set({ showUpdatePopup: false });
    } else {
      extConfig.showUpdatePopup = res.showUpdatePopup;
    }
  });
}

function initializeNumberDisplayReformatLikes() {
  api.storage.sync.get(["numberDisplayReformatLikes"], (res) => {
    if (res.numberDisplayReformatLikes === undefined) {
      api.storage.sync.set({ numberDisplayReformatLikes: false });
    } else {
      extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
    }
  });
}

function isChrome() {
  return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined";
}

function isFirefox() {
  return (
    typeof browser !== "undefined" && typeof browser.runtime !== "undefined"
  );
}
