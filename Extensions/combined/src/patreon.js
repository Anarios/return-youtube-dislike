import { initPremiumAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./premiumAnalytics";
import { initPremiumTeaser, setTeaserSuppressed, TEASER_SUPPRESSION_REASON_PREMIUM } from "./premiumAnalytics/teaser";
import {
  hasAuthenticationDataPermission,
  onAuthenticationDataPermissionRemoved,
  usesFirefoxDataCollectionConsent,
} from "./data-collection-permissions";

let patreonState = {
  authenticated: false,
  user: null,
  sessionToken: null,
};

function initPatreonFeatures() {
  initPremiumTeaser();
  let sessionGeneration = 0;
  const initialGeneration = sessionGeneration;

  const loadCachedSession = (granted) => {
    if (initialGeneration !== sessionGeneration) return;
    if (!granted) {
      clearPatreonState();
      return;
    }

    chrome.storage.sync.get(["patreonAuthenticated", "patreonUser", "patreonSessionToken"], (data) => {
      if (initialGeneration !== sessionGeneration) return;
      if (data.patreonAuthenticated && data.patreonUser && data.patreonSessionToken) {
        patreonState.authenticated = true;
        patreonState.user = data.patreonUser;
        patreonState.sessionToken = data.patreonSessionToken;
        updatePremiumSession({
          token: patreonState.sessionToken,
          active: patreonState.user?.hasActiveMembership,
          membershipTier: patreonState.user?.membershipTier,
        });
        enablePremiumFeatures();
      }
    });
  };

  if (usesFirefoxDataCollectionConsent()) {
    hasAuthenticationDataPermission().then(loadCachedSession);
  } else {
    loadCachedSession(true);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "patreon_status_changed") {
      const generation = ++sessionGeneration;
      if (!request.authenticated) {
        clearPatreonState();
        return;
      }
      const applyStatus = (granted) => {
        if (generation !== sessionGeneration) return;
        if (!granted || !request.user || !request.sessionToken) {
          clearPatreonState();
          return;
        }

        patreonState.authenticated = true;
        patreonState.user = request.user || null;
        patreonState.sessionToken = request.sessionToken ?? null;
        updatePremiumSession({
          token: patreonState.sessionToken,
          active: patreonState.user?.hasActiveMembership,
          membershipTier: patreonState.user?.membershipTier,
        });
        enablePremiumFeatures();
      };

      if (usesFirefoxDataCollectionConsent()) {
        hasAuthenticationDataPermission().then(applyStatus);
      } else {
        applyStatus(true);
      }
    }
  });

  onAuthenticationDataPermissionRemoved(() => {
    sessionGeneration++;
    clearPatreonState();
  });
}

function clearPatreonState() {
  patreonState.authenticated = false;
  patreonState.user = null;
  patreonState.sessionToken = null;
  updatePremiumSession({ token: null, active: false });
  disablePremiumFeatures();
}

function enablePremiumFeatures() {
  const tier = patreonState.user?.membershipTier;
  const hasActiveMembership = patreonState.user?.hasActiveMembership;

  if (hasActiveMembership && tier === "premium") {
    setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
    initPremiumAnalytics();
  }
}

function disablePremiumFeatures() {
  const premiumElements = document.querySelectorAll(".ryd-premium-feature");
  premiumElements.forEach((el) => el.remove());
  teardownPremiumAnalytics();
  setTeaserSuppressed(false, TEASER_SUPPRESSION_REASON_PREMIUM);
}

function isPatreonUser() {
  return patreonState.authenticated && patreonState.user?.hasActiveMembership;
}

function getPatreonTier() {
  return patreonState.user?.membershipTier || "none";
}

export { initPatreonFeatures, isPatreonUser, getPatreonTier, patreonState };
