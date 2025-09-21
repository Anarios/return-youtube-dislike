import { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./premiumAnalytics";

let patreonState = {
  authenticated: false,
  user: null,
  sessionToken: null
};

function initPatreonFeatures() {
  chrome.storage.sync.get(['patreonAuthenticated', 'patreonUser', 'patreonSessionToken'], (data) => {
    if (data.patreonAuthenticated && data.patreonUser) {
      patreonState.authenticated = true;
      patreonState.user = data.patreonUser;
      patreonState.sessionToken = data.patreonSessionToken;
      updatePremiumSession({ token: patreonState.sessionToken, active: patreonState.user?.hasActiveMembership });
      enablePremiumFeatures();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'patreon_status_changed') {
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

  if (tier === 'premium' || tier === 'supporter') {
    enableDetailedStats();
    enableHistoricalData();
    enableCustomThemes();
    if (patreonState.user?.hasActiveMembership) {
      initPremiumAnalytics();
    }
  }

  if (tier === 'premium') {
    enableAdvancedAnalytics();
    enableExportFeatures();
  }
  
}

function disablePremiumFeatures() {
  const premiumElements = document.querySelectorAll('.ryd-premium-feature');
  premiumElements.forEach(el => el.remove());
  teardownPremiumAnalytics();
}


function enableDetailedStats() {
  console.log('Premium feature: Detailed stats enabled');
}

function enableHistoricalData() {
  console.log('Premium feature: Historical data enabled');
}

function enableCustomThemes() {
  console.log('Premium feature: Custom themes enabled');
}

function enableAdvancedAnalytics() {
  console.log('Premium feature: Advanced analytics enabled');
}

function enableExportFeatures() {
  console.log('Premium feature: Export features enabled');
}

function isPatreonUser() {
  return patreonState.authenticated && patreonState.user?.hasActiveMembership;
}

function getPatreonTier() {
  return patreonState.user?.membershipTier || 'none';
}

export { initPatreonFeatures, isPatreonUser, getPatreonTier, patreonState };
