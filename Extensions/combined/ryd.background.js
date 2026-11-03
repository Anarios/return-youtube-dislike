import { config, getApiUrl, getApiEndpoint, getChangelogUrl } from "./src/config";
import { createVoteClient } from "../common/vote-client";
import { createBrowserCredentialStore } from "./src/vote-client-adapter";
import { loginWithGitHub } from "./src/github-auth";
import { createDiscussionBackground } from "./src/discussion-background";
import { fetchWithAccountConsent } from "./src/account-data-consent";
import { isFirefoxExtension, isNormalMessageSender } from "./src/private-browsing";
import { createReviewPromptTracker } from "./src/review-prompt-tracker";
import {
  FEATURE_DATA_PERMISSIONS,
  coreConsentError,
  fetchWithCoreConsent,
  fetchWithFeatureConsent,
  hasFeaturePermission,
  onDataPermissionsChanged,
} from "./src/core-data-consent";
import { hasAuthenticationDataPermission, usesFirefoxDataCollectionConsent } from "./src/data-collection-permissions";
import { allowVoteSubmission, votesCounted } from "./src/vote-submission-setting";
import { VOTE_SUBMISSION_INTENT_MESSAGE, createVoteSubmissionIntent } from "./src/vote-submission-intent";

const apiUrl = getApiUrl();
const voteDisabledIconName = config.voteDisabledIconName;
const defaultIconName = config.defaultIconName;
let api;
const CHANGELOG_STORAGE_KEY = "lastShownChangelogVersion";
const DATA_PERMISSIONS_MIGRATION_KEY = "featureDataPermissionsMigrated";

/** stores extension's global config */
let extConfig = { ...config.defaultExtConfig };
let authenticationGeneration = 0;
let accountStorageQueue = Promise.resolve();
let consentPageOpening = null;
let consentPageTabId = null;
let consentPromptPending = false;
let votingPermissionGeneration = 0;
let votingIconRevision = 0;

if (isChrome()) api = chrome;
else if (isFirefox()) api = browser;

const reviewPromptTracker = createReviewPromptTracker(api);
const voteSubmissionIntent = createVoteSubmissionIntent({
  hasVotingPermission: () => hasFeaturePermission("voting", { queryBackground: false }),
  allowVoteSubmission,
});

if (__RYD_LIVE_TEST_BUILD__) {
  globalThis.__RYD_LIVE_EXTENSION_BUILD__ = Object.freeze({
    buildId: __RYD_LIVE_BUILD_ID__,
    runtime: "extension",
    version: api.runtime.getManifest().version,
  });
}

const credentialStore = createBrowserCredentialStore(api.storage.sync, () => api.runtime?.lastError);
function createCurrentVoteClient() {
  const generation = votingPermissionGeneration;
  const assertCurrent = () => {
    if (generation !== votingPermissionGeneration) throw coreConsentError();
  };
  const guard = async () => {
    assertCurrent();
    await requireVotingConsent();
    assertCurrent();
  };
  return createVoteClient({
    apiBaseUrl: apiUrl,
    fetchImpl: async (input, options) => {
      if (usesFirefoxDataCollectionConsent()) await guard();
      return fetchWithFeatureConsent("voting", input, options);
    },
    credentialStore: Object.fromEntries(
      ["load", "save", "clear"].map((method) => [
        method,
        async (...args) => {
          if (usesFirefoxDataCollectionConsent()) await guard();
          const result = await credentialStore[method](...args);
          if (usesFirefoxDataCollectionConsent()) assertCurrent();
          return result;
        },
      ]),
    ),
    cryptoImpl: globalThis.crypto,
  });
}

let currentVoteClient = createCurrentVoteClient();
const voteClient = Object.fromEntries(
  ["ensureRegistered", "submitVote"].map((method) => [
    method,
    async (...args) => {
      const generation = votingPermissionGeneration;
      if (!currentVoteClient) currentVoteClient = createCurrentVoteClient();
      const result = await currentVoteClient[method](...args);
      if (usesFirefoxDataCollectionConsent() && generation !== votingPermissionGeneration) throw coreConsentError();
      return result;
    },
  ]),
);

const discussionBackground = createDiscussionBackground({
  api,
  voteClient,
  fetchImpl: fetchWithCoreConsent,
  accountFetchImpl: fetchWithAccountConsent,
  hasConsent: () => hasFeaturePermission("account", { queryBackground: false }),
  hasFeatureConsent: (feature) => hasFeaturePermission(feature, { queryBackground: false }),
});
discussionBackground.initialize();

initExtConfig();

function broadcastPatreonStatus(authenticated, user, sessionToken, generation = authenticationGeneration) {
  chrome.tabs.query({}, (tabs) => {
    if (generation !== authenticationGeneration) return;
    tabs
      .filter((tab) => {
        if (isFirefoxExtension(api) && tab.incognito !== false) return false;
        try {
          const hostname = new URL(tab.url).hostname;
          return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
        } catch {
          return false;
        }
      })
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

function handlePatreonAuthComplete(user, sessionToken, generation, done) {
  if (!user || !sessionToken || generation !== authenticationGeneration) {
    done?.(false);
    return;
  }

  if (usesFirefoxDataCollectionConsent()) {
    hasAuthenticationDataPermission({ queryBackground: false }).then((granted) => {
      if (granted && generation === authenticationGeneration) persistPatreonAuth(user, sessionToken, generation, done);
      else done?.(false);
    });
    return;
  }

  persistPatreonAuth(user, sessionToken, generation, done);
}

function persistPatreonAuth(user, sessionToken, generation, done) {
  queueAccountStorageMutation((complete) => {
    if (generation !== authenticationGeneration) {
      complete();
      return;
    }
    chrome.storage.sync.set(
      {
        patreonAuthenticated: true,
        patreonUser: user,
        patreonSessionToken: sessionToken,
      },
      () => {
        if (chrome.runtime.lastError || generation !== authenticationGeneration) {
          complete();
          return;
        }
        chrome.storage.sync.set({ hidePremiumTeaser: false }, complete);
      },
    );
  })
    .then(() => {
      if (generation !== authenticationGeneration) {
        done?.(false);
        return;
      }
      broadcastPatreonStatus(true, user, sessionToken, generation);
      done?.(true);
    })
    .catch(() => done?.(false));
}

function queueAccountStorageMutation(operation) {
  const pending = accountStorageQueue.then(
    () =>
      new Promise((resolve, reject) => {
        operation(() => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      }),
  );
  accountStorageQueue = pending.catch(() => {});
  return pending;
}

function clearPatreonAuth(done) {
  const generation = ++authenticationGeneration;
  discussionBackground.clearSession(true);
  broadcastPatreonStatus(false, null, null, generation);
  queueAccountStorageMutation((complete) => {
    chrome.storage.sync.remove(["patreonAuthenticated", "patreonUser", "patreonSessionToken"], complete);
  })
    .then(() => {
      discussionBackground.resumeSession().catch(() => {});
      done?.();
    })
    .catch((error) => console.error("Account session cleanup failed", error));
}

onDataPermissionsChanged((change) => {
  const voting = (category) => FEATURE_DATA_PERMISSIONS.voting.includes(category);
  if (change.removed.some(voting)) {
    votingPermissionGeneration++;
    currentVoteClient = null;
    voteSubmissionIntent.clear();
  }
  if (change.added.some(voting)) void voteSubmissionIntent.applyOnGrant();
  if (change.removed.includes("authenticationInfo")) clearPatreonAuth();
  discussionBackground.onDataPermissionsChanged(change).catch((error) => {
    console.debug("Discussion permission update failed", error);
  });
  if ([...change.added, ...change.removed].some(voting)) {
    void refreshVotingIcon();
  }
  api.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
    for (const tab of tabs) {
      let tabChange = change;
      if (isFirefoxExtension(api) && tab.incognito !== false) {
        if (tab.incognito !== true) continue;
        tabChange = {
          added: change.added.filter((category) => category === "browsingActivity"),
          removed: change.removed.filter((category) => category === "browsingActivity"),
        };
        if (!tabChange.added.length && !tabChange.removed.length) continue;
      }
      const result = api.tabs.sendMessage(tab.id, { message: "ryd_data_permissions_changed", ...tabChange }, () => {
        void api.runtime.lastError;
      });
      result?.catch?.(() => {});
    }
  });
});

async function requireVotingConsent() {
  if (!(await hasFeaturePermission("voting", { queryBackground: false }))) throw coreConsentError();
}

async function requireCurrentAuthenticationConsent(generation) {
  if (
    generation !== authenticationGeneration ||
    (usesFirefoxDataCollectionConsent() && !(await hasAuthenticationDataPermission({ queryBackground: false }))) ||
    generation !== authenticationGeneration
  ) {
    throw new Error("authentication data consent removed or sign-in cancelled");
  }
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
  if (
    (request?.message === "ryd_has_feature_consent" && request.feature === "counts") ||
    isNormalMessageSender(api, sender)
  ) {
    return handleMessage(request, sender, sendResponse);
  }
  sendResponse({
    success: false,
    ok: false,
    granted: false,
    error: { code: "private_browsing", message: "Only count display is available in private windows." },
  });
});

function isOwnPopupSender(sender) {
  try {
    const url = new URL(sender.url);
    const popup = new URL(api.runtime.getURL("popup.html"));
    return (
      sender.id === api.runtime.id &&
      sender.tab?.incognito !== true &&
      url.protocol === popup.protocol &&
      url.host === popup.host &&
      url.pathname === popup.pathname
    );
  } catch (_) {
    return false;
  }
}

function handleMessage(request, sender, sendResponse) {
  if (request?.message === "ryd_review_action") {
    void (async () => {
      sendResponse(await reviewPromptTracker.recordAction(request, sender));
    })();
    return true;
  } else if (request?.message === "ryd_open_consent_popup") {
    let validSender = false;
    try {
      const { protocol, hostname } = new URL(sender.url);
      validSender =
        usesFirefoxDataCollectionConsent() &&
        sender.id === api.runtime.id &&
        sender.tab?.incognito === false &&
        sender.frameId === 0 &&
        protocol === "https:" &&
        (hostname === "youtube.com" || hostname.endsWith(".youtube.com"));
    } catch (_) {}
    if (!validSender) {
      sendResponse({ success: false });
      return;
    }
    void (async () => {
      try {
        await browser.browserAction.openPopup({ windowId: sender.tab.windowId });
        sendResponse({ success: true });
      } catch (_) {
        sendResponse({ success: false });
      }
    })();
    return true;
  } else if (request?.message === "ryd_open_consent") {
    if (!usesFirefoxDataCollectionConsent()) {
      sendResponse({ success: false });
      return;
    }
    const consentUrl = api.runtime.getURL("consent.html");
    const isConsentPage = (url) => {
      try {
        const parsed = new URL(url);
        const target = new URL(consentUrl);
        return (
          parsed.protocol === target.protocol && parsed.host === target.host && parsed.pathname === target.pathname
        );
      } catch (_) {
        return false;
      }
    };
    const feature = ["voteOptIn", "account"].includes(request.feature) ? request.feature : "voteOptIn";
    const targetUrl = `${consentUrl}?feature=${feature}${request.details === true ? "#permission-details" : ""}`;
    let isYouTubeLauncher = false;
    if (sender.tab?.incognito === false && sender.frameId === 0) {
      try {
        const { protocol, hostname } = new URL(sender.url);
        isYouTubeLauncher = protocol === "https:" && (hostname === "youtube.com" || hostname.endsWith(".youtube.com"));
      } catch (_) {}
    }
    if (sender.id !== api.runtime.id || !isYouTubeLauncher) {
      sendResponse({ success: false });
      return;
    }
    if (!consentPageOpening) {
      consentPageOpening = (async () => {
        const tabs = (typeof browser !== "undefined" ? browser : api).tabs;
        if (consentPageTabId !== null) {
          try {
            const existing = await tabs.get(consentPageTabId);
            if (isConsentPage(existing.url) && existing.incognito === false) {
              if (!consentPromptPending && existing.url !== targetUrl) {
                await tabs.update(consentPageTabId, { url: targetUrl });
              }
              await tabs.update(consentPageTabId, { active: true });
              if (Number.isInteger(existing.windowId))
                await api.windows?.update?.(existing.windowId, { focused: true });
              return;
            }
          } catch (_) {}
        }
        const tab = await tabs.create({
          url: targetUrl,
          ...(Number.isInteger(sender.tab?.windowId) ? { windowId: sender.tab.windowId } : {}),
        });
        consentPageTabId = tab.id;
        consentPromptPending = false;
      })().finally(() => {
        consentPageOpening = null;
      });
    }
    consentPageOpening.then(
      () => sendResponse({ success: true }),
      () => sendResponse({ success: false }),
    );
    return true;
  } else if (request?.message === VOTE_SUBMISSION_INTENT_MESSAGE) {
    const accepted = usesFirefoxDataCollectionConsent() && isOwnPopupSender(sender);
    if (accepted && request.withdraw === true) voteSubmissionIntent.clear();
    else if (accepted) voteSubmissionIntent.remember();
    sendResponse({ success: accepted });
    return;
  } else if (request?.message === "ryd_consent_prompt_state") {
    if (
      usesFirefoxDataCollectionConsent() &&
      sender.id === api.runtime.id &&
      sender.tab?.id === consentPageTabId &&
      sender.url?.startsWith(`${api.runtime.getURL("consent.html")}?feature=`)
    ) {
      consentPromptPending = request.pending === true;
      sendResponse({ success: true });
    } else sendResponse({ success: false });
    return;
  } else if (request?.message === "ryd_has_feature_consent") {
    if (!usesFirefoxDataCollectionConsent()) {
      sendResponse({ granted: false });
      return;
    }
    hasFeaturePermission(request.feature, { queryBackground: false }).then((granted) => sendResponse({ granted }));
    return true;
  } else if (request?.message === "ryd_discussion") {
    discussionBackground
      .handleMessage(request, sender)
      .then(sendResponse)
      .catch(() =>
        sendResponse({ ok: false, error: { code: "consent_required", message: "Enable RYD to continue." } }),
      );
    return true;
  } else if (request.message === "patreon_logout") {
    clearPatreonAuth();
  } else if (request.message === "ryd_open_tab") {
    const targetUrl = typeof request?.url === "string" ? request.url : null;
    const allowedUrls = new Set([
      "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649",
      getChangelogUrl(),
    ]);
    if (!allowedUrls.has(targetUrl)) {
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
  } else if (request.message == "send_vote") {
    const generation = votingPermissionGeneration;
    requireVotingConsent()
      .then(() => {
        if (usesFirefoxDataCollectionConsent() && generation !== votingPermissionGeneration) throw coreConsentError();
        if (extConfig.disableVoteSubmission) throw new Error("Vote submission is disabled.");
        return voteClient.submitVote(request.videoId, request.vote);
      })
      .then(() => sendResponse?.({ success: true }))
      .catch((error) => sendResponse?.({ success: false, error: error.message }));
    return true;
  } else if (request.message === "patreon_oauth_login") {
    const generation = ++authenticationGeneration;
    (async () => {
      try {
        await requireCurrentAuthenticationConsent(generation);

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

        const startRes = await fetchWithAccountConsent(
          getApiEndpoint(`/api/auth/oauth/login?redirectUri=${encodeURIComponent(redirectUri)}`),
        );
        const startData = await startRes.json();

        await requireCurrentAuthenticationConsent(generation);
        const responseUrl = await launchWebAuthFlow(startData.authUrl);
        const { code, state } = extractOAuthParams(responseUrl);
        if (!code) {
          sendResponse({ success: false, error: "No authorization code received" });
          return;
        }

        await requireCurrentAuthenticationConsent(generation);

        const exchangeRes = await fetchWithAccountConsent(getApiEndpoint("/api/auth/oauth/exchange"), {
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
          handlePatreonAuthComplete(authData.user, authData.sessionToken, generation, (stored) => {
            sendResponse(
              stored
                ? { success: true, user: authData.user }
                : { success: false, error: "authentication data consent removed" },
            );
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
  } else if (request.message === "github_oauth_login") {
    const generation = ++authenticationGeneration;
    (async () => {
      try {
        await requireCurrentAuthenticationConsent(generation);

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

        const authData = await loginWithGitHub({
          fetchImpl: fetchWithAccountConsent,
          redirectUri,
          launchWebAuthFlow,
          requireConsent: () => requireCurrentAuthenticationConsent(generation),
        });
        if (authData && authData.success) {
          handlePatreonAuthComplete(authData.user, authData.sessionToken, generation, (stored) => {
            sendResponse(
              stored
                ? { success: true, user: authData.user }
                : { success: false, error: "authentication data consent removed" },
            );
          });
        } else {
          sendResponse({ success: false, error: (authData && authData.error) || "OAuth exchange failed" });
        }
      } catch (e) {
        console.error("github_oauth_login error", e);
        sendResponse({ success: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }
}

function openChangelogTab(version, { active } = {}) {
  try {
    const url = getChangelogUrl();
    api.tabs.create({ url, ...(active === false ? { active: false } : {}) }, () => {
      if (api.runtime.lastError) {
        console.debug("Changelog tab could not open:", api.runtime.lastError.message);
        return;
      }
      persistChangelogVersion(version);
    });
  } catch (error) {
    console.debug("Failed to open changelog tab", error);
  }
}

function persistChangelogVersion(version) {
  api.storage.local?.set?.({ [CHANGELOG_STORAGE_KEY]: version || true });
}

function readStorage(area, keys) {
  return new Promise((resolve, reject) => {
    const storage = api.storage[area];
    if (!storage?.get) return reject(new Error("Storage is unavailable."));
    storage.get(keys, (value) => {
      if (api.runtime.lastError) reject(new Error(api.runtime.lastError.message));
      else resolve(value ?? {});
    });
  });
}

async function refreshVotingIcon() {
  const current = ++votingIconRevision;
  const granted = await hasFeaturePermission("voting", { queryBackground: false });
  if (current !== votingIconRevision) return;
  const counted = votesCounted({ granted, submissionDisabled: extConfig.disableVoteSubmission });
  const name = api.i18n.getMessage("extensionName");
  setToolbarState(
    counted ? defaultIconName : voteDisabledIconName,
    counted ? name : `${name}\n${api.i18n.getMessage("vote_not_counted")}`,
  );
}

function markDataPermissionsMigrated() {
  api.storage.local?.set?.({ [DATA_PERMISSIONS_MIGRATION_KEY]: true });
}

async function migrateDataPermissions() {
  if (!usesFirefoxDataCollectionConsent()) return;
  const local = await readStorage("local", [DATA_PERMISSIONS_MIGRATION_KEY]);
  if (local[DATA_PERMISSIONS_MIGRATION_KEY]) return;
  const generation = authenticationGeneration;
  const previous = await readStorage("sync", ["patreonSessionToken"]);
  if (!previous.patreonSessionToken && generation === authenticationGeneration) {
    await api.permissions.remove({ data_collection: ["personallyIdentifyingInfo"] });
  }
  markDataPermissionsMigrated();
  await refreshVotingIcon();
}

async function handleInstallation(details) {
  api.storage.local?.remove?.("pendingChangelogVersion");
  if (details?.reason === "update") {
    try {
      await migrateDataPermissions();
    } catch (error) {
      console.debug("Permission settings migration could not finish", error);
    }
    return;
  }
  if (details?.reason !== "install") return;
  if (usesFirefoxDataCollectionConsent()) markDataPermissionsMigrated();
  const stored = await readStorage("local", [CHANGELOG_STORAGE_KEY]).catch(() => ({}));
  if (!stored[CHANGELOG_STORAGE_KEY]) openChangelogTab(api.runtime.getManifest()?.version);
}

api.runtime.onInstalled.addListener((details) => {
  void handleInstallation(details);
});

api.runtime.onStartup?.addListener?.(() => {
  api.storage.local?.remove?.("pendingChangelogVersion");
});

function storageChangeHandler(changes, area) {
  discussionBackground.onStorageChanged(changes, area);
  if (changes.disableVoteSubmission !== undefined) {
    voteSubmissionIntent.clear();
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
  if (changes.hideClutterButtons !== undefined) {
    handleHideClutterButtonsChangeEvent(changes.hideClutterButtons.newValue);
  }
}

function handleDisableVoteSubmissionChangeEvent(value) {
  extConfig.disableVoteSubmission = value;
  void refreshVotingIcon();
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

function setToolbarState(iconName, title) {
  const toolbar = api.action ?? api.browserAction;
  if (toolbar === undefined) {
    console.log("changing icon is not supported");
    return;
  }
  toolbar.setIcon({ path: "/icons/" + iconName });
  toolbar.setTitle({ title });
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

function handleHideClutterButtonsChangeEvent(value) {
  extConfig.hideClutterButtons = value === true;
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
  initializeHideClutterButtons();
}

function initializeDisableVoteSubmission() {
  api.storage.sync.get(["disableVoteSubmission"], (res) => {
    if (res.disableVoteSubmission === undefined) {
      api.storage.sync.set({ disableVoteSubmission: false });
    } else {
      extConfig.disableVoteSubmission = res.disableVoteSubmission;
    }
    void refreshVotingIcon();
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

function initializeHideClutterButtons() {
  api.storage.sync.get(["hideClutterButtons"], (res) => {
    if (res.hideClutterButtons === undefined) {
      api.storage.sync.set({ hideClutterButtons: false });
      extConfig.hideClutterButtons = false;
    } else {
      extConfig.hideClutterButtons = res.hideClutterButtons === true;
    }
  });
}

function isChrome() {
  return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined";
}

function isFirefox() {
  return typeof browser !== "undefined" && typeof browser.runtime !== "undefined";
}
