import { initPremiumAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./premiumAnalytics";
import {
  initPremiumTeaser,
  refreshPremiumTeaser,
  setTeaserSuppressed,
  TEASER_SUPPRESSION_REASON_PREMIUM,
} from "./premiumAnalytics/teaser";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getBrowser } from "./utils";
import { hasFeaturePermission, onDataPermissionsChanged } from "./core-data-consent";
import { hasAuthenticationDataPermission, usesFirefoxDataCollectionConsent } from "./data-collection-permissions";

let patreonState = {
  authenticated: false,
  user: null,
  sessionToken: null,
};
let premiumGeneration = 0;
const COUNTS_SUPPRESSION_REASON = "counts";
const ORPHANED_SUPPRESSION_REASON = "orphaned";

// Turning off or updating the extension leaves this script running in open tabs
// without extension APIs, so the panels would show raw message keys and no data.
function removePremiumFeaturesIfOrphaned() {
  if (getBrowser()?.runtime?.id) return;
  document.removeEventListener("yt-navigate-finish", removePremiumFeaturesIfOrphaned, true);
  setTeaserSuppressed(true, ORPHANED_SUPPRESSION_REASON);
  disablePremiumFeatures();
}

function initPatreonFeatures() {
  if (isPrivateBrowsingContext()) return;
  document.addEventListener("yt-navigate-finish", removePremiumFeaturesIfOrphaned, true);
  if (usesFirefoxDataCollectionConsent()) setTeaserSuppressed(true, COUNTS_SUPPRESSION_REASON);
  initPremiumTeaser();
  if (usesFirefoxDataCollectionConsent()) enablePremiumFeatures();
  let sessionGeneration = 0;
  const loadCachedSession = (granted, generation) => {
    if (generation !== sessionGeneration) return;
    if (!granted) {
      clearPatreonState();
      return;
    }

    chrome.storage.sync.get(["patreonAuthenticated", "patreonUser", "patreonSessionToken"], (data) => {
      if (generation !== sessionGeneration) return;
      if (data.patreonAuthenticated && data.patreonUser && data.patreonSessionToken) {
        patreonState.authenticated = true;
        patreonState.user = data.patreonUser;
        patreonState.sessionToken = data.patreonSessionToken;
        enablePremiumFeatures();
      }
    });
  };

  const restoreSession = () => {
    const generation = ++sessionGeneration;
    if (usesFirefoxDataCollectionConsent()) {
      void hasAuthenticationDataPermission().then((granted) => loadCachedSession(granted, generation));
    } else {
      loadCachedSession(true, generation);
    }
  };
  restoreSession();

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
        enablePremiumFeatures();
      };

      if (usesFirefoxDataCollectionConsent()) {
        hasAuthenticationDataPermission().then(applyStatus);
      } else {
        applyStatus(true);
      }
    }
  });

  onDataPermissionsChanged(({ added, removed }) => {
    const accountCategories = ["authenticationInfo", "personallyIdentifyingInfo"];
    if (removed.some((permission) => accountCategories.includes(permission))) {
      sessionGeneration++;
      clearPatreonState();
    } else if (added.some((permission) => accountCategories.includes(permission))) {
      restoreSession();
    }
    if (removed.includes("browsingActivity")) {
      premiumGeneration++;
      setTeaserSuppressed(true, COUNTS_SUPPRESSION_REASON);
      updatePremiumSession({ token: null, active: false });
      disablePremiumFeatures();
    } else if (added.includes("browsingActivity")) {
      enablePremiumFeatures();
    }
    refreshPremiumTeaser();
  });
}

function clearPatreonState() {
  premiumGeneration++;
  patreonState.authenticated = false;
  patreonState.user = null;
  patreonState.sessionToken = null;
  updatePremiumSession({ token: null, active: false });
  disablePremiumFeatures();
  if (usesFirefoxDataCollectionConsent()) enablePremiumFeatures();
}

function enablePremiumFeatures() {
  const generation = ++premiumGeneration;
  const applyPermission = (granted) => {
    if (generation !== premiumGeneration) return;
    if (usesFirefoxDataCollectionConsent()) setTeaserSuppressed(!granted, COUNTS_SUPPRESSION_REASON);
    if (!granted) {
      updatePremiumSession({ token: null, active: false });
      disablePremiumFeatures();
      return;
    }
    if (!patreonState.authenticated) return;
    updatePremiumSession({
      token: patreonState.sessionToken,
      active: patreonState.user?.hasActiveMembership,
      membershipTier: patreonState.user?.membershipTier,
    });
    if (patreonState.user?.hasActiveMembership && patreonState.user?.membershipTier === "premium") {
      setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
      initPremiumAnalytics();
    }
  };
  if (usesFirefoxDataCollectionConsent()) {
    void hasFeaturePermission("counts").then(applyPermission, () => applyPermission(false));
  } else {
    applyPermission(true);
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
