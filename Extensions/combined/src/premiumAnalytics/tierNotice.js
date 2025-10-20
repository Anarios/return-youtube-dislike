import { localize } from "../utils";

const PATREON_UPGRADE_URL = "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649";

const noticeState = {
  initialized: false,
  active: false,
  panelElement: null,
};

function ensureListeners() {
  if (noticeState.initialized) return;
  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });
  noticeState.initialized = true;
}

function handleNavigation() {
  if (!noticeState.active) {
    removePanel();
    return;
  }

  const container = document.querySelector("#secondary #secondary-inner") || document.querySelector("#secondary-inner");
  if (!container) {
    setTimeout(handleNavigation, 250);
    return;
  }

  let panel = noticeState.panelElement;
  if (!panel || !panel.isConnected) {
    panel = document.createElement("section");
    panel.className = "ryd-premium-tier-notice ryd-premium-feature";
    container.insertBefore(panel, container.firstChild);
    noticeState.panelElement = panel;
  }

  panel.innerHTML = createPanelMarkup();
  wireCta(panel);
}

function createPanelMarkup() {
  const title = localize("premiumTierNotice_title");
  const message = localize("premiumTierNotice_message");
  const cta = localize("premiumTierNotice_cta");

  return `
    <div class="ryd-premium-tier-notice__content">
      <h2 class="ryd-premium-tier-notice__title">${title}</h2>
      <p class="ryd-premium-tier-notice__message">${message}</p>
      <div class="ryd-premium-tier-notice__actions">
        <a href="${PATREON_UPGRADE_URL}" class="ryd-premium-tier-notice__cta" id="ryd-premium-tier-upgrade">${cta}</a>
      </div>
    </div>
  `;
}

function wireCta(panel) {
  const cta = panel.querySelector("#ryd-premium-tier-upgrade");
  if (!cta) return;
  cta.addEventListener("click", (event) => {
    event.preventDefault();
    window.open(PATREON_UPGRADE_URL, "_blank", "noopener");
  });
}

function removePanel() {
  if (noticeState.panelElement) {
    noticeState.panelElement.remove();
    noticeState.panelElement = null;
  }
}

function resetState() {
  noticeState.panelElement = null;
}

export function showTierNotice() {
  noticeState.active = true;
  ensureListeners();
  handleNavigation();
}

export function hideTierNotice() {
  noticeState.active = false;
  removePanel();
  resetState();
}
