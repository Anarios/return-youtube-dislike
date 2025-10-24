import { config, getApiUrl, getApiEndpoint, getChangelogUrl } from "./src/config";

const apiUrl = getApiUrl();
const voteDisabledIconName = config.voteDisabledIconName;
const defaultIconName = config.defaultIconName;
let api;
const CHANGELOG_STORAGE_KEY = "lastShownChangelogVersion";
const PENDING_CHANGELOG_STORAGE_KEY = "pendingChangelogVersion";

/** stores extension's global config */
let extConfig = { ...config.defaultExtConfig };

if (isChrome()) api = chrome;
else if (isFirefox()) api = browser;

initExtConfig();

function broadcastPatreonStatus(authenticated, user, sessionToken) {
  chrome.tabs.query({}, (tabs) => {
    tabs
      .filter((tab) => tab.url && tab.url.includes("youtube.com"))
      .forEach((tab) => {
        const maybePromise = chrome.tabs.sendMessage(
          tab.id,
          {
            message: "patreon_status_changed",
            authenticated,
            user: authenticated ? user : null,
            sessionToken: authenticated ? sessionToken : null,
          },
          () => {
            if (chrome.runtime.lastError) {
              console.debug("Patreon status broadcast skipped:", chrome.runtime.lastError.message);
            }
          },
        );

        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch((error) => {
            console.debug("Patreon status broadcast skipped:", error?.message ?? error);
          });
        }
      });
  });
}

function handlePatreonAuthComplete(user, sessionToken, done) {
  if (!user) {
    done?.();
    return;
  }

  chrome.storage.sync.set(
    {
      patreonAuthenticated: true,
      patreonUser: user,
      patreonSessionToken: sessionToken,
    },
    () => {
      broadcastPatreonStatus(true, user, sessionToken);
      done?.();
    },
  );
}

function getIdentityApi() {
  if (isFirefox() && browser.identity) return browser.identity;
  if (isChrome() && chrome.identity) return chrome.identity;
  return null;
}

function launchWebAuthFlow(url) {
  try {
    if (isFirefox() && browser.identity && typeof browser.identity.launchWebAuthFlow === "function") {
      return browser.identity.launchWebAuthFlow({ url, interactive: true });
    }
  } catch (_) {}
  return new Promise((resolve, reject) => {
    if (!isChrome() || !chrome.identity || typeof chrome.identity.launchWebAuthFlow !== "function") {
      reject(new Error("identity API not available"));
      return;
    }
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      const err = chrome.runtime && chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(responseUrl);
    });
  });
}

function extractOAuthParams(responseUrl) {
  try {
    const u = new URL(responseUrl);
    let code = u.searchParams.get("code");
    let state = u.searchParams.get("state");
    if (!code && u.hash) {
      const hashParams = new URLSearchParams(u.hash.startsWith("#") ? u.hash.substring(1) : u.hash);
      code = hashParams.get("code");
      state = state || hashParams.get("state");
    }
    return { code, state };
  } catch (_) {
    return { code: null, state: null };
  }
}

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
  } else if (request.message === "patreon_auth_complete") {
    handlePatreonAuthComplete(request.user, request.sessionToken);
  } else if (request.message === "patreon_logout") {
    // Clear Patreon authentication
    chrome.storage.sync.remove(["patreonAuthenticated", "patreonUser", "patreonSessionToken"], () => {
      broadcastPatreonStatus(false, null, null);
    });
  } else if (request.message === "ryd_open_tab") {
    const targetUrl = typeof request?.url === "string" ? request.url : null;
    if (!targetUrl) {
      sendResponse?.({ success: false, error: "invalid_url" });
      return;
    }

    try {
      if (api?.tabs?.create) {
        api.tabs.create({ url: targetUrl }, () => {
          if (api.runtime?.lastError) {
            console.debug("Tab open failed:", api.runtime.lastError.message);
          }
        });
        sendResponse?.({ success: true });
        return;
      }
    } catch (error) {
      console.debug("Tab open threw:", error?.message ?? error);
    }

    sendResponse?.({ success: false, error: "tabs_api_unavailable" });
    return;
  } else if (request.message == "set_state") {
    // chrome.identity.getAuthToken({ interactive: true }, function (token) {
    let token = "";
    fetch(getApiEndpoint(`/votes?videoId=${request.videoId}&likeCount=${request.likeCount || ""}`), {
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
      fetch(getApiEndpoint("/votes"), {
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
  } else if (request.message === "patreon_oauth_login") {
    (async () => {
      try {
        const idApi = getIdentityApi();
        if (
          !idApi ||
          typeof (idApi.getRedirectURL || (isChrome() && chrome.identity && chrome.identity.getRedirectURL)) !==
            "function"
        ) {
          sendResponse({ success: false, error: "identity API not available" });
          return;
        }
        const redirectUri =
          isFirefox() && browser.identity.getRedirectURL
            ? browser.identity.getRedirectURL()
            : isChrome() && chrome.identity.getRedirectURL
              ? chrome.identity.getRedirectURL()
              : "";

        const startRes = await fetch(
          getApiEndpoint(`/api/auth/oauth/login?redirectUri=${encodeURIComponent(redirectUri)}`),
        );
        const startData = await startRes.json();

        const responseUrl = await launchWebAuthFlow(startData.authUrl);
        const { code, state } = extractOAuthParams(responseUrl);
        if (!code) {
          sendResponse({ success: false, error: "No authorization code received" });
          return;
        }

        const exchangeRes = await fetch(getApiEndpoint("/api/auth/oauth/exchange"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            state,
            expectedState: startData.state,
            redirectUri: startData.redirectUri || redirectUri,
          }),
        });
        const authData = await exchangeRes.json();
        if (authData && authData.success) {
          handlePatreonAuthComplete(authData.user, authData.sessionToken, () => {
            sendResponse({ success: true, user: authData.user });
          });
        } else {
          sendResponse({ success: false, error: (authData && authData.error) || "OAuth exchange failed" });
        }
      } catch (e) {
        console.error("patreon_oauth_login error", e);
        sendResponse({ success: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }
});

function openChangelogTab(version) {
  try {
    const url = getChangelogUrl();
    api.tabs.create({ url }, () => {
      if (api.runtime.lastError) {
        console.debug("Changelog tab could not open:", api.runtime.lastError.message);
      }
      persistChangelogVersion(version);
    });
  } catch (error) {
    console.debug("Failed to open changelog tab", error);
  }
}

function scheduleChangelogVersion(version) {
  const storage = api?.storage?.local;
  if (!storage || typeof storage.set !== "function") {
    return false;
  }
  try {
    const valueToStore = version || true;
    storage.set({ [PENDING_CHANGELOG_STORAGE_KEY]: valueToStore }, () => {
      if (api.runtime.lastError) {
        console.debug("Failed to persist pending changelog version:", api.runtime.lastError.message);
      }
    });
    return true;
  } catch (error) {
    console.debug("Storage set failed for pending changelog version", error);
    return false;
  }
}

function clearPendingChangelogVersion() {
  const storage = api?.storage?.local;
  if (!storage || typeof storage.remove !== "function") {
    return;
  }
  try {
    storage.remove(PENDING_CHANGELOG_STORAGE_KEY, () => {
      if (api.runtime.lastError) {
        console.debug("Failed to clear pending changelog version:", api.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.debug("Storage remove failed for pending changelog version", error);
  }
}

function showPendingChangelogIfNeeded() {
  const storage = api?.storage?.local;
  if (!storage || typeof storage.get !== "function") {
    return;
  }

  try {
    storage.get([PENDING_CHANGELOG_STORAGE_KEY, CHANGELOG_STORAGE_KEY], (result) => {
      if (api.runtime.lastError) {
        console.debug("Changelog storage read failed:", api.runtime.lastError.message);
        return;
      }

      const pendingValue = result?.[PENDING_CHANGELOG_STORAGE_KEY];
      if (pendingValue === undefined || pendingValue === null || pendingValue === "") {
        return;
      }

      const lastShownValue = result?.[CHANGELOG_STORAGE_KEY];
      if (lastShownValue !== undefined && lastShownValue !== null && lastShownValue !== "") {
        clearPendingChangelogVersion();
        return;
      }

      openChangelogTab(typeof pendingValue === "string" ? pendingValue : null);
    });
  } catch (error) {
    console.debug("Storage get failed for pending changelog version", error);
  }
}

function persistChangelogVersion(version) {
  const storage = api?.storage?.local;
  if (!storage || typeof storage.set !== "function") {
    clearPendingChangelogVersion();
    return;
  }
  try {
    const valueToStore = version || true;
    storage.set({ [CHANGELOG_STORAGE_KEY]: valueToStore }, () => {
      if (api.runtime.lastError) {
        console.debug("Failed to persist changelog version:", api.runtime.lastError.message);
        return;
      }
      clearPendingChangelogVersion();
    });
  } catch (error) {
    console.debug("Storage set failed for changelog version", error);
  }
}

function maybeShowChangelog(details) {
  const reason = details?.reason;
  if (!reason) {
    return;
  }

  if (reason === "browser_update" || reason === "chrome_update") {
    return;
  }

  if (reason !== "install" && reason !== "update") {
    return;
  }

  const manifest = api.runtime.getManifest();
  const currentVersion = manifest?.version;
  const storage = api?.storage?.local;
  const isInstall = reason === "install";

  const showChangelog = () => {
    openChangelogTab(currentVersion || null);
  };

  if (!storage || typeof storage.get !== "function") {
    showChangelog();
    return;
  }

  try {
    storage.get([CHANGELOG_STORAGE_KEY, PENDING_CHANGELOG_STORAGE_KEY], (result) => {
      if (api.runtime.lastError) {
        console.debug("Changelog storage read failed:", api.runtime.lastError.message);
        showChangelog();
        return;
      }

      const hasStoredValue = (value) => value !== undefined && value !== null && value !== "";
      const lastShownValue = result?.[CHANGELOG_STORAGE_KEY];
      const pendingValue = result?.[PENDING_CHANGELOG_STORAGE_KEY];

      if (isInstall) {
        if (hasStoredValue(pendingValue)) {
          clearPendingChangelogVersion();
        }
        if (!hasStoredValue(lastShownValue)) {
          showChangelog();
        }
        return;
      }

      if (hasStoredValue(lastShownValue)) {
        return;
      }

      if (hasStoredValue(pendingValue)) {
        if (currentVersion && pendingValue !== currentVersion) {
          scheduleChangelogVersion(currentVersion);
        }
        return;
      }

      if (!scheduleChangelogVersion(currentVersion || null)) {
        showChangelog();
      }
    });
  } catch (error) {
    console.debug("Storage get failed for changelog version", error);
    showChangelog();
  }
}

api.runtime.onInstalled.addListener((details) => {
  maybeShowChangelog(details);
});

if (api?.runtime?.onStartup && typeof api.runtime.onStartup.addListener === "function") {
  api.runtime.onStartup.addListener(() => {
    showPendingChangelogIfNeeded();
  });
}

// api.storage.sync.get(['lastShowChangelogVersion'], (details) => {
//   if (extConfig.showUpdatePopup === true &&
//     details.lastShowChangelogVersion !== chrome.runtime.getManifest().version
//     ) {
//     // keep it inside get to avoid race condition
//     api.storage.sync.set({'lastShowChangelogVersion ': chrome.runtime.getManifest().version});
//     // wait until async get runs & don't steal tab focus
//     api.tabs.create({url: api.runtime.getURL("/changelog/4/changelog_4.0.html"), active: false});
//   }
// });

async function sendVote(videoId, vote, depth = 1) {
  api.storage.sync.get(null, async (storageResult) => {
    if (!storageResult.userId || !storageResult.registrationConfirmed) {
      await register();
    }
    let voteResponse = await fetch(getApiEndpoint("/interact/vote"), {
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

    if (voteResponse.status == 401 && depth > 0) {
      await register();
      await sendVote(videoId, vote, depth - 1);
      return;
    } else if (voteResponse.status == 401) {
      // We have already tried registering
      return;
    }

    const voteResponseJson = await voteResponse.json();
    const solvedPuzzle = await solvePuzzle(voteResponseJson);
    if (!solvedPuzzle.solution) {
      await sendVote(videoId, vote);
      return;
    }

    await fetch(getApiEndpoint("/interact/confirmVote"), {
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
  const registrationResponse = await fetch(getApiEndpoint(`/puzzle/registration?userId=${userId}`), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json());
  const solvedPuzzle = await solvePuzzle(registrationResponse);
  if (!solvedPuzzle.solution) {
    await register();
    return;
  }
  const result = await fetch(getApiEndpoint(`/puzzle/registration?userId=${userId}`), {
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
  let challenge = Uint8Array.from(atob(puzzle.challenge), (c) => c.charCodeAt(0));
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
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
    handleDisableVoteSubmissionChangeEvent(changes.disableVoteSubmission.newValue);
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
    handleNumberDisplayReformatLikesChangeEvent(changes.numberDisplayReformatLikes.newValue);
  }
  if (changes.disableLogging !== undefined) {
    handleDisableLoggingChangeEvent(changes.disableLogging.newValue);
  }
  if (changes.showTooltipPercentage !== undefined) {
    handleShowTooltipPercentageChangeEvent(changes.showTooltipPercentage.newValue);
  }
  if (changes.numberDisplayReformatLikes !== undefined) {
    handleNumberDisplayReformatLikesChangeEvent(changes.numberDisplayReformatLikes.newValue);
  }
  if (changes.hidePremiumTeaser !== undefined) {
    handleHidePremiumTeaserChangeEvent(changes.hidePremiumTeaser.newValue);
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

function handleDisableLoggingChangeEvent(value) {
  extConfig.disableLogging = value;
}

function handleNumberDisplayFormatChangeEvent(value) {
  extConfig.numberDisplayFormat = value;
}

function handleShowTooltipPercentageChangeEvent(value) {
  extConfig.showTooltipPercentage = value;
}

function handleTooltipPercentageModeChangeEvent(value) {
  if (!value) {
    value = "dash_like";
  }
  extConfig.tooltipPercentageMode = value;
}

function changeIcon(iconName) {
  if (api.action !== undefined) api.action.setIcon({ path: "/icons/" + iconName });
  else if (api.browserAction !== undefined) api.browserAction.setIcon({ path: "/icons/" + iconName });
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

function handleNumberDisplayReformatLikesChangeEvent(value) {
  extConfig.numberDisplayReformatLikes = value;
}

function handleHidePremiumTeaserChangeEvent(value) {
  extConfig.hidePremiumTeaser = value === true;
}

api.storage.onChanged.addListener(storageChangeHandler);

function initExtConfig() {
  initializeDisableVoteSubmission();
  initializeDisableLogging();
  initializeColoredThumbs();
  initializeColoredBar();
  initializeColorTheme();
  initializeNumberDisplayFormat();
  initializeNumberDisplayReformatLikes();
  initializeTooltipPercentage();
  initializeTooltipPercentageMode();
  initializeHidePremiumTeaser();
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

function initializeDisableLogging() {
  api.storage.sync.get(["disableLogging"], (res) => {
    if (res.disableLogging === undefined) {
      api.storage.sync.set({ disableLogging: true });
    } else {
      extConfig.disableLogging = res.disableLogging;
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

function initializeTooltipPercentage() {
  api.storage.sync.get(["showTooltipPercentage"], (res) => {
    if (res.showTooltipPercentage === undefined) {
      api.storage.sync.set({ showTooltipPercentage: false });
    } else {
      extConfig.showTooltipPercentage = res.showTooltipPercentage;
    }
  });
}

function initializeTooltipPercentageMode() {
  api.storage.sync.get(["tooltipPercentageMode"], (res) => {
    if (res.tooltipPercentageMode === undefined) {
      api.storage.sync.set({ tooltipPercentageMode: "dash_like" });
    } else {
      extConfig.tooltipPercentageMode = res.tooltipPercentageMode;
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

function initializeHidePremiumTeaser() {
  api.storage.sync.get(["hidePremiumTeaser"], (res) => {
    if (res.hidePremiumTeaser === undefined) {
      api.storage.sync.set({ hidePremiumTeaser: false });
      extConfig.hidePremiumTeaser = false;
    } else {
      extConfig.hidePremiumTeaser = res.hidePremiumTeaser === true;
    }
  });
}

function isChrome() {
  return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined";
}

function isFirefox() {
  return typeof browser !== "undefined" && typeof browser.runtime !== "undefined";
}
