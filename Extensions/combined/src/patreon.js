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
  
  showPremiumBadge();
}

function disablePremiumFeatures() {
  const premiumElements = document.querySelectorAll('.ryd-premium-feature');
  premiumElements.forEach(el => el.remove());
  teardownPremiumAnalytics();
}

function showPremiumBadge() {
  const badge = document.createElement('div');
  badge.className = 'ryd-premium-badge ryd-premium-feature';
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f96854 0%, #ff6b6b 100%);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(249, 104, 84, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  const icon = document.createElement('svg');
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21c0 3.96-3.22 7.18-7.18 7.18c-3.97 0-7.21-3.22-7.21-7.18c0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z"/></svg>';
  badge.appendChild(icon);
  
  const text = document.createElement('span');
  try {
    const prefix = (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('patreonBadgePrefix') : 'Patreon';
    const tierMap = {
      premium: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('patreonTierPremium') : 'Premium Supporter',
      supporter: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('patreonTierSupporter') : 'Supporter',
      basic: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('patreonTierBasic') : 'Basic Tier',
      none: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('patreonTierNone') : 'No Active Membership',
    };
    const tierLabel = tierMap[patreonState.user?.membershipTier] || '';
    text.textContent = `${prefix} ${tierLabel}`.trim();
  } catch (_) {
    text.textContent = `Patreon ${patreonState.user?.membershipTier || ''}`.trim();
  }
  badge.appendChild(text);
  
  document.body.appendChild(badge);
  
  setTimeout(() => {
    badge.style.opacity = '0.7';
  }, 3000);
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
