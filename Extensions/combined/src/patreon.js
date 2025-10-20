import { initPremiumAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./premiumAnalytics";
import { initPremiumTeaser, setTeaserSuppressed } from "./premiumAnalytics/teaser";

let patreonState = {
  authenticated: false,
  user: null,
  sessionToken: null,
};

function initPatreonFeatures() {
  initPremiumTeaser();

  chrome.storage.sync.get(["patreonAuthenticated", "patreonUser", "patreonSessionToken"], (data) => {
    if (data.patreonAuthenticated && data.patreonUser) {
      patreonState.authenticated = true;
      patreonState.user = data.patreonUser;
      patreonState.sessionToken = data.patreonSessionToken;
      updatePremiumSession({ token: patreonState.sessionToken, active: patreonState.user?.hasActiveMembership });
      enablePremiumFeatures();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "patreon_status_changed") {
      patreonState.authenticated = request.authenticated;
      patreonState.user = request.user || null;

      if (request.authenticated) {
        patreonState.sessionToken = request.sessionToken ?? patreonState.sessionToken;
        updatePremiumSession({ token: patreonState.sessionToken, active: patreonState.user?.hasActiveMembership });
        enablePremiumFeatures();
      } else {
        patreonState.sessionToken = null;
        updatePremiumSession({ token: null, active: false });
        disablePremiumFeatures();
      }
    }
  });
}

function enablePremiumFeatures() {
  const tier = patreonState.user?.membershipTier;
  const hasActiveMembership = patreonState.user?.hasActiveMembership;

  if (hasActiveMembership && (tier === "premium" || tier === "supporter")) {
    setTeaserSuppressed(true);
    initPremiumAnalytics();
  }
}

function disablePremiumFeatures() {
  const premiumElements = document.querySelectorAll(".ryd-premium-feature");
  premiumElements.forEach((el) => el.remove());
  teardownPremiumAnalytics();
  setTeaserSuppressed(false);
}

function isPatreonUser() {
  return patreonState.authenticated && patreonState.user?.hasActiveMembership;
}

function getPatreonTier() {
  return patreonState.user?.membershipTier || "none";
}

export { initPatreonFeatures, isPatreonUser, getPatreonTier, patreonState };
