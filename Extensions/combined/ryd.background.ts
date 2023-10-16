import { ColorTheme, ExtConfig, NumberDisplayFormat } from "./src/types";
import { getBrowser } from "./src/utils";

const apiUrl = "https://returnyoutubedislikeapi.com";
const voteDisabledIconName = "icon_hold128.png";
const defaultIconName = "icon128.png";
let api = getBrowser();

/** stores extension's global config */
let extConfig: ExtConfig = {
  disableVoteSubmission: false,
  coloredThumbs: false,
  coloredBar: false,
  colorTheme: "classic", // classic, accessible, neon
  numberDisplayFormat: "compactShort", // compactShort, compactLong, standard
  numberDisplayReformatLikes: false, // use existing (native) likes number
  showTooltipPercentage: undefined,
  tooltipPercentageMode: undefined,
};

initExtConfig();

api.runtime.onMessage.addListener(
  (
    request: any,
    _: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
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
      toSend = toSend.concat(
        request.videoIds.filter((x: string) => !sentIds.has(x))
      );
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
    console.warn("Unknown message received", request);
    return;
  }
);

api.runtime.onInstalled.addListener((details: any) => {
  const reason: chrome.runtime.InstalledDetails["reason"] | "browser_update" =
    details.reason;
  if (
    // No need to show changelog if its was a browser update (and not extension update)
    reason === "browser_update" ||
    // Chromium (e.g., Google Chrome Cannary) uses this name instead of the one above for some reason
    reason === "chrome_update" ||
    // No need to show changelog if developer just reloaded the extension
    reason === "update"
  ) {
    return;
  } else if (details.reason == "install") {
    api.tabs.create({
      url: api.runtime.getURL("/changelog/3/changelog_3.0.html"),
    });
  }
});

async function sendVote(videoId: string, vote: 0 | 1 | -1) {
  api.storage.sync.get(null, async (storageResult: { [key: string]: any }) => {
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

api.storage.sync.get(null, async (res: any) => {
  if (!res || !res.userId || !res.registrationConfirmed) {
    await register();
  }
});

const sentIds = new Set();
let toSend: any[] = [];

function countLeadingZeroes(uInt8View: Uint8Array, limit?: number) {
  let zeroes = 0;
  let value = 0;
  for (let i = 0; i < uInt8View.length; i++) {
    // @ts-ignore
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
    if (limit && zeroes >= limit) {
      break;
    }
  }
  return zeroes;
}

async function solvePuzzle(puzzle: { challenge: string; difficulty: number }) {
  let challenge = Uint8Array.from(atob(puzzle.challenge), (c) =>
    c.charCodeAt(0)
  );
  let buffer = new ArrayBuffer(20);
  let uInt8View = new Uint8Array(buffer);
  let uInt32View = new Uint32Array(buffer);
  let maxCount = Math.pow(2, puzzle.difficulty) * 3;
  for (let i = 4; i < 20; i++) {
    //@ts-ignore
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
      const value = values[i]!;
      const idx = value % charset.length;
      const char = charset[idx];
      result += char;
    }
    return result;
  } else {
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
  }
}

function storageChangeHandler(changes: {
  [key: string]: chrome.storage.StorageChange;
}) {
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
  if (changes.numberDisplayFormat !== undefined) {
    handleNumberDisplayFormatChangeEvent(changes.numberDisplayFormat.newValue);
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(
      changes.numberDisplayReformatLikes.newValue
    );
  }
  if (changes.showTooltipPercentage !== undefined) {
    handleShowTooltipPercentageChangeEvent(
      changes.showTooltipPercentage.newValue
    );
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(
      changes.numberDisplayReformatLikes.newValue
    );
  }
}

function handleDisableVoteSubmissionChangeEvent(value: boolean) {
  extConfig.disableVoteSubmission = value;
  if (value === true) {
    changeIcon(voteDisabledIconName);
  } else {
    changeIcon(defaultIconName);
  }
}

function handleNumberDisplayFormatChangeEvent(value: NumberDisplayFormat) {
  extConfig.numberDisplayFormat = value;
}

function handleShowTooltipPercentageChangeEvent(value: boolean | undefined) {
  extConfig.showTooltipPercentage = value;
}

function changeIcon(iconName: string) {
  if (api.action !== undefined)
    api.action.setIcon({ path: "/icons/" + iconName });
  else if (api.browserAction !== undefined)
    api.browserAction.setIcon({ path: "/icons/" + iconName });
  else console.log("changing icon is not supported");
}

function handleColoredThumbsChangeEvent(value: boolean) {
  extConfig.coloredThumbs = value;
}

function handleColoredBarChangeEvent(value: boolean) {
  extConfig.coloredBar = value;
}

function handleColorThemeChangeEvent(value: ColorTheme) {
  if (!value) {
    value = "classic";
  }
  extConfig.colorTheme = value;
}

function handleNumberDisplayReformatLikesChangeEvent(value: boolean) {
  extConfig.numberDisplayReformatLikes = value;
}

api.storage.onChanged.addListener(storageChangeHandler);

function initExtConfig() {
  initializeDisableVoteSubmission();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeNumberDisplayReformatLikes();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
}

function initializeDisableVoteSubmission() {
  api.storage.sync.get(
    ["disableVoteSubmission"],
    (res: { [key: string]: any }) => {
      if (res.disableVoteSubmission === undefined) {
        api.storage.sync.set({ disableVoteSubmission: false });
      } else {
        extConfig.disableVoteSubmission = res.disableVoteSubmission;
        if (res.disableVoteSubmission) changeIcon(voteDisabledIconName);
      }
    }
  );
}

function initializeColoredThumbs() {
  api.storage.sync.get(["coloredThumbs"], (res: { [key: string]: any }) => {
    if (res.coloredThumbs === undefined) {
      api.storage.sync.set({ coloredThumbs: false });
    } else {
      extConfig.coloredThumbs = res.coloredThumbs;
    }
  });
}

function initializeColoredBar() {
  api.storage.sync.get(["coloredBar"], (res: { [key: string]: any }) => {
    if (res.coloredBar === undefined) {
      api.storage.sync.set({ coloredBar: false });
    } else {
      extConfig.coloredBar = res.coloredBar;
    }
  });
}

function initializeColorTheme() {
  api.storage.sync.get(["colorTheme"], (res: { [key: string]: any }) => {
    if (res.colorTheme === undefined) {
      api.storage.sync.set({ colorTheme: false });
    } else {
      extConfig.colorTheme = res.colorTheme;
    }
  });
}

function initializeNumberDisplayFormat() {
  api.storage.sync.get(
    ["numberDisplayFormat"],
    (res: { [key: string]: any }) => {
      if (res.numberDisplayFormat === undefined) {
        api.storage.sync.set({ numberDisplayFormat: "compactShort" });
      } else {
        extConfig.numberDisplayFormat = res.numberDisplayFormat;
      }
    }
  );
}

function initializeTooltipPercentage() {
  api.storage.sync.get(
    ["showTooltipPercentage"],
    (res: { [key: string]: any }) => {
      if (res.showTooltipPercentage === undefined) {
        api.storage.sync.set({ showTooltipPercentage: false });
      } else {
        extConfig.showTooltipPercentage = res.showTooltipPercentage;
      }
    }
  );
}

function initializeTooltipPercentageMode() {
  api.storage.sync.get(
    ["tooltipPercentageMode"],
    (res: { [key: string]: any }) => {
      if (res.tooltipPercentageMode === undefined) {
        api.storage.sync.set({ tooltipPercentageMode: "dash_like" });
      } else {
        extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
      }
    }
  );
}

function initializeNumberDisplayReformatLikes() {
  api.storage.sync.get(
    ["numberDisplayReformatLikes"],
    (res: { [key: string]: any }) => {
      if (res.numberDisplayReformatLikes === undefined) {
        api.storage.sync.set({ numberDisplayReformatLikes: false });
      } else {
        extConfig.numberDisplayReformatLikes = res.numberDisplayReformatLikes;
      }
    }
  );
}
