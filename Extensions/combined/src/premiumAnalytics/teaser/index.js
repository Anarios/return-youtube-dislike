import { getChangelogUrl } from "../../config";
import { getBrowser, getVideoId, localize } from "../../utils";
import { extConfig } from "../../state";
import { requestVoteData } from "../../vote-data-request";

const PATREON_JOIN_URL = "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649";
const CHANGELOG_URL = getChangelogUrl();

export const TEASER_SUPPRESSION_REASON_LEGACY = "legacy";
export const TEASER_SUPPRESSION_REASON_PREMIUM = "premium";
export const TEASER_SUPPRESSION_REASON_SETTINGS = "settings";

const teaserState = {
  initialized: false,
  suppressed: false,
  panelElement: null,
  currentVideoId: null,
  abortController: null,
  suppressionReasons: new Set(),
  storageListener: null,
  expanded: false,
};

export async function initPremiumTeaser() {
  if (teaserState.initialized) return;
  teaserState.initialized = true;

  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });

  try {
    await syncSuppressionWithSettings();
  } catch {
    // Ignore storage sync failures; teaser suppression will remain manual.
  }

  handleNavigation();
}

export function setTeaserSuppressed(shouldSuppress, reason = TEASER_SUPPRESSION_REASON_LEGACY) {
  const normalizedReason = reason || TEASER_SUPPRESSION_REASON_LEGACY;
  const reasons = teaserState.suppressionReasons;

  if (shouldSuppress) {
    reasons.add(normalizedReason);
  } else {
    reasons.delete(normalizedReason);
  }

  const next = reasons.size > 0;

  if (next === teaserState.suppressed) {
    if (next) {
      removePanel(true);
      resetState();
    }
    return;
  }

  teaserState.suppressed = next;

  if (next) {
    removePanel(true);
    resetState();
  } else {
    handleNavigation();
  }
}

function applySettingsSuppression(shouldHide, persist = false) {
  const normalized = shouldHide === true;
  extConfig.hidePremiumTeaser = normalized;
  setTeaserSuppressed(normalized, TEASER_SUPPRESSION_REASON_SETTINGS);

  if (!persist) {
    return;
  }

  try {
    const browser = getBrowser();
    browser?.storage?.sync?.set?.({ hidePremiumTeaser: normalized });
  } catch {
    // Ignore persistence failures; suppression state already applied locally.
  }
}

async function syncSuppressionWithSettings() {
  try {
    const browser = getBrowser();
    if (!browser?.storage?.sync) {
      return;
    }

    await new Promise((resolve) => {
      browser.storage.sync.get(["hidePremiumTeaser"], (res) => {
        try {
          const shouldHide = res?.hidePremiumTeaser === true;
          applySettingsSuppression(shouldHide);
        } finally {
          resolve();
        }
      });
    });

    if (!teaserState.storageListener) {
      const listener = (changes, area) => {
        if (area !== "sync" || !changes.hidePremiumTeaser) {
          return;
        }
        const shouldHide = changes.hidePremiumTeaser.newValue === true;
        applySettingsSuppression(shouldHide);
      };
      teaserState.storageListener = listener;
      browser.storage.onChanged.addListener(listener);
    }
  } catch {
    // Ignore storage sync failures; teaser suppression will remain manual.
  }
}

function handleNavigation() {
  if (teaserState.suppressed) {
    return;
  }

  const videoId = resolveVideoId();
  if (!videoId) {
    resetState();
    removePanel();
    return;
  }

  if (teaserState.currentVideoId === videoId) {
    ensurePanel();
    return;
  }

  teaserState.currentVideoId = videoId;
  fetchAndRender(videoId);
}

function resolveVideoId() {
  try {
    const id = getVideoId(window.location.href);
    if (!id || id.length !== 11) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

function fetchAndRender(videoId) {
  if (teaserState.suppressed || teaserState.currentVideoId !== videoId || resolveVideoId() !== videoId) {
    return;
  }

  const panel = ensurePanel();
  if (!panel) {
    setTimeout(() => {
      if (!teaserState.suppressed) {
        fetchAndRender(videoId);
      }
    }, 200);
    return;
  }

  setLoading(true);
  updateCounts({ dislikes: null, rawDislikes: null, likes: null });

  if (teaserState.abortController) {
    teaserState.abortController.abort();
  }

  const controller = new AbortController();
  teaserState.abortController = controller;

  requestVoteData(videoId)
    .then((payload) => {
      if (controller.signal.aborted || teaserState.currentVideoId !== videoId || teaserState.suppressed) {
        return;
      }
      updateCounts(payload);
      setLoading(false);
    })
    .catch((error) => {
      if (controller.signal.aborted || error?.name === "AbortError") {
        return;
      }
      if (teaserState.suppressed) {
        return;
      }
      showError();
    });
}

function ensurePanel() {
  const premiumPanel = document.querySelector(".ryd-premium-analytics");
  if (premiumPanel) {
    if (!teaserState.suppressed) {
      setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
    } else {
      removePanel(true);
    }
    return null;
  }

  if (teaserState.panelElement && teaserState.panelElement.isConnected) {
    return teaserState.panelElement;
  }

  const container = document.querySelector("#secondary #secondary-inner") || document.querySelector("#secondary-inner");
  if (!container) {
    setTimeout(ensurePanel, 250);
    return null;
  }

  const panel = document.createElement("section");
  panel.className = "ryd-premium-teaser is-collapsed";
  panel.innerHTML = createPanelMarkup();
  container.insertBefore(panel, container.firstChild);

  const dismissButton = panel.querySelector("#ryd-premium-teaser-close");
  if (dismissButton) {
    dismissButton.addEventListener("click", handleManualDismiss);
  }

  const toggle = panel.querySelector("#ryd-premium-teaser-toggle");
  if (toggle) {
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      setExpanded(!teaserState.expanded);
    });
  }

  const expandCta = panel.querySelector("#ryd-premium-teaser-cta");
  if (expandCta) {
    expandCta.addEventListener("click", (event) => {
      event.preventDefault();
      openTab(PATREON_JOIN_URL);
    });
  }

  const learnMore = panel.querySelector("#ryd-premium-teaser-learn");
  if (learnMore) {
    learnMore.addEventListener("click", (event) => {
      event.preventDefault();
      openTab(CHANGELOG_URL);
    });
  }

  teaserState.panelElement = panel;
  setExpanded(false);
  return panel;
}

function removePanel(includeStrayNodes = false) {
  if (teaserState.panelElement) {
    teaserState.panelElement.remove();
    teaserState.panelElement = null;
  }
  if (includeStrayNodes) {
    document.querySelectorAll(".ryd-premium-teaser").forEach((node) => {
      if (node !== teaserState.panelElement) {
        node.remove();
      }
    });
  }
}

function resetState() {
  teaserState.currentVideoId = null;
  if (teaserState.abortController) {
    teaserState.abortController.abort();
    teaserState.abortController = null;
  }
  teaserState.expanded = false;
}

function setLoading(isLoading) {
  const panel = teaserState.panelElement;
  if (!panel) return;
  panel.classList.toggle("is-loading", !!isLoading);
  const status = panel.querySelector("#ryd-premium-teaser-status");
  if (status) {
    status.textContent = isLoading ? localize("premiumTeaser_statusLoading") : "";
  }
}

function showError() {
  setLoading(false);
  const status = teaserState.panelElement?.querySelector("#ryd-premium-teaser-status");
  if (status) {
    status.textContent = localize("premiumTeaser_statusError");
  }
  updateCounts({ dislikes: null, rawDislikes: null, likes: null });
}

function updateCounts(payload) {
  const panel = teaserState.panelElement;
  if (!panel) return;

  const dislikesValue = panel.querySelector("#ryd-premium-teaser-dislikes");
  const likesValue = panel.querySelector("#ryd-premium-teaser-likes");

  const rawDislikes = normalizeNumber(payload?.rawDislikes ?? payload?.dislikes);
  const rawLikes = normalizeNumber(payload?.rawLikes ?? payload?.likes);

  if (dislikesValue) dislikesValue.textContent = rawDislikes;
  if (likesValue) likesValue.textContent = rawLikes;
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  try {
    return Number(value).toLocaleString();
  } catch {
    return `${value}`;
  }
}

function createPanelMarkup() {
  const title = localize("premiumTeaser_title");
  const subtitle = localize("premiumTeaser_subtitle");
  const ctaText = localize("premiumTeaser_cta");
  const secondaryText = localize("premiumTeaser_learn");
  const closeLabel = localize("hidePremiumTeaser");
  const statDislikes = localize("premiumTeaser_statRaw");
  const statLikes = localize("premiumTeaser_statLikes");
  const expandLabel = localize("premiumAnalytics_expand");
  const collapseLabel = localize("premiumAnalytics_collapse");
  const highlightsAria = localize("changelog_section_highlights");
  const highlightsTitle = localize("changelog_section_highlights");
  const highlightOne = localize("changelog_feature_timeline_title");
  const highlightTwo = localize("changelog_feature_map_title");
  const highlightThree = localize("changelog_feature_quality_title");

  return `
    <button type="button" class="ryd-premium-teaser__close" id="ryd-premium-teaser-close" aria-label="${closeLabel}" title="${closeLabel}">
      <span class="ryd-premium-teaser__close-icon" aria-hidden="true">&times;</span>
    </button>
    <div class="ryd-premium-teaser__summary">
      <div class="ryd-premium-teaser__counts" role="status" aria-live="polite">
        <div class="ryd-premium-teaser__count">
          <span class="ryd-premium-teaser__count-label">${statLikes}</span>
          <span class="ryd-premium-teaser__count-value" id="ryd-premium-teaser-likes">—</span>
        </div>
        <div class="ryd-premium-teaser__count">
          <span class="ryd-premium-teaser__count-label">${statDislikes}</span>
          <span class="ryd-premium-teaser__count-value" id="ryd-premium-teaser-dislikes">—</span>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="ryd-premium-teaser__toggle"
      id="ryd-premium-teaser-toggle"
      aria-expanded="false"
      aria-controls="ryd-premium-teaser-details"
      aria-label="${expandLabel}"
      title="${expandLabel}"
      data-expand-label="${expandLabel}"
      data-collapse-label="${collapseLabel}"
    >
      <span class="ryd-premium-teaser__toggle-icon" aria-hidden="true"></span>
    </button>
    <div class="ryd-premium-teaser__details" id="ryd-premium-teaser-details" aria-hidden="true">
      <h3 class="ryd-premium-teaser__title">${title}</h3>
      <p class="ryd-premium-teaser__subtitle">${subtitle}</p>
      <section class="ryd-premium-teaser__highlights" aria-label="${highlightsAria}">
        <h4 class="ryd-premium-teaser__highlights-title">${highlightsTitle}</h4>
        <ul class="ryd-premium-teaser__highlights-list">
          <li>${highlightOne}</li>
          <li>${highlightTwo}</li>
          <li>${highlightThree}</li>
        </ul>
      </section>
      <div class="ryd-premium-teaser__links">
        <a href="${PATREON_JOIN_URL}" class="ryd-premium-teaser__cta" id="ryd-premium-teaser-cta">${ctaText}</a>
        <a href="${CHANGELOG_URL}" class="ryd-premium-teaser__secondary" id="ryd-premium-teaser-learn">${secondaryText}</a>
      </div>
      <p class="ryd-premium-teaser__status" id="ryd-premium-teaser-status"></p>
    </div>
  `;
}

function openTab(url) {
  if (!url) return;

  const browser = getBrowser();
  try {
    if (browser && browser.tabs && typeof browser.tabs.create === "function") {
      browser.tabs.create({ url });
      return;
    }
  } catch {
    // ignore and fall back to window.open
  }

  try {
    if (browser?.runtime?.sendMessage) {
      browser.runtime.sendMessage({ message: "ryd_open_tab", url });
      return;
    }
  } catch {
    // ignore and fall back to window.open
  }

  try {
    window.open(url, "_blank", "noopener");
  } catch {
    // ignore navigation failures
  }
}

function handleManualDismiss(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  applySettingsSuppression(true, true);
}

function setExpanded(next) {
  teaserState.expanded = !!next;
  const panel = teaserState.panelElement;
  if (!panel) return;

  panel.classList.toggle("is-expanded", teaserState.expanded);
  panel.classList.toggle("is-collapsed", !teaserState.expanded);

  const details = panel.querySelector("#ryd-premium-teaser-details");
  if (details) {
    details.toggleAttribute("hidden", !teaserState.expanded);
    details.setAttribute("aria-hidden", teaserState.expanded ? "false" : "true");
  }

  const toggle = panel.querySelector("#ryd-premium-teaser-toggle");
  if (toggle) {
    const expandText = toggle.getAttribute("data-expand-label") || "";
    const collapseText = toggle.getAttribute("data-collapse-label") || expandText;
    toggle.setAttribute("aria-expanded", teaserState.expanded ? "true" : "false");
    const nextLabel = teaserState.expanded ? collapseText : expandText;
    if (nextLabel) {
      toggle.setAttribute("aria-label", nextLabel);
      toggle.setAttribute("title", nextLabel);
    }
  }
}
