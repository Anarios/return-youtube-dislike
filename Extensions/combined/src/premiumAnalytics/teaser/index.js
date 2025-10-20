import { getApiEndpoint, getChangelogUrl } from "../../config";
import { getBrowser, getVideoId, localize } from "../../utils";
import { extConfig } from "../../state";

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
};

export function initPremiumTeaser() {
  if (teaserState.initialized) return;
  teaserState.initialized = true;

  syncSuppressionWithSettings();
  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });
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

function syncSuppressionWithSettings() {
  try {
    const browser = getBrowser();
    if (!browser?.storage?.sync) {
      return;
    }

    browser.storage.sync.get(["hidePremiumTeaser"], (res) => {
      const shouldHide = res?.hidePremiumTeaser === true;
      extConfig.hidePremiumTeaser = shouldHide;
      setTeaserSuppressed(shouldHide, TEASER_SUPPRESSION_REASON_SETTINGS);
    });

    if (!teaserState.storageListener) {
      const listener = (changes, area) => {
        if (area !== "sync" || !changes.hidePremiumTeaser) {
          return;
        }
        const shouldHide = changes.hidePremiumTeaser.newValue === true;
        extConfig.hidePremiumTeaser = shouldHide;
        setTeaserSuppressed(shouldHide, TEASER_SUPPRESSION_REASON_SETTINGS);
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
  if (teaserState.suppressed) {
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

  const url = getApiEndpoint(`/votes?videoId=${encodeURIComponent(videoId)}`);

  fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      if (teaserState.currentVideoId !== videoId || teaserState.suppressed) {
        return;
      }
      updateCounts(payload);
      setLoading(false);
    })
    .catch((error) => {
      if (error?.name === "AbortError") {
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
  panel.className = "ryd-premium-teaser";
  panel.innerHTML = createPanelMarkup();
  container.insertBefore(panel, container.firstChild);

  const cta = panel.querySelector("#ryd-premium-teaser-cta");
  if (cta) {
    cta.addEventListener("click", (event) => {
      event.preventDefault();
      openTab(PATREON_JOIN_URL);
    });
  }

  const infoLink = panel.querySelector("#ryd-premium-teaser-learn");
  if (infoLink) {
    infoLink.addEventListener("click", (event) => {
      event.preventDefault();
      openTab(CHANGELOG_URL);
    });
  }

  teaserState.panelElement = panel;
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
  const rawDislikesValue = panel.querySelector("#ryd-premium-teaser-raw");
  const likesValue = panel.querySelector("#ryd-premium-teaser-likes");

  const dislikes = normalizeNumber(payload?.dislikes);
  const rawDislikes = normalizeNumber(payload?.rawDislikes ?? payload?.dislikes);
  const likes = normalizeNumber(payload?.likes ?? payload?.rawLikes);

  if (dislikesValue) dislikesValue.textContent = dislikes;
  if (rawDislikesValue) rawDislikesValue.textContent = rawDislikes;
  if (likesValue) likesValue.textContent = likes;
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
  const extensionName = localize("extensionName");
  const title = localize("premiumTeaser_title");
  const subtitle = localize("premiumTeaser_subtitle");
  const ctaText = localize("premiumTeaser_cta");
  const secondaryText = localize("premiumTeaser_learn");
  const statRaw = localize("premiumTeaser_statRaw");
  const statDislikes = localize("premiumTeaser_statDislikes");
  const statLikes = localize("premiumTeaser_statLikes");
  const breadcrumbsAria = localize("premiumTeaser_breadcrumbsAria");
  const breadcrumbsTitle = localize("premiumTeaser_breadcrumbsTitle");
  const step1 = localize("premiumTeaser_breadcrumbStep1");
  const step2 = localize("premiumTeaser_breadcrumbStep2");
  const step3 = localize("premiumTeaser_breadcrumbStep3");

  return `
    <header class="ryd-premium-teaser__header">
      <div>
        <span class="ryd-premium-teaser__badge">${extensionName}</span>
        <h2 class="ryd-premium-teaser__title">${title}</h2>
        <p class="ryd-premium-teaser__subtitle">${subtitle}</p>
      </div>
      <div class="ryd-premium-teaser__actions">
        <a href="${PATREON_JOIN_URL}" class="ryd-premium-teaser__cta" id="ryd-premium-teaser-cta">${ctaText}</a>
        <a href="${CHANGELOG_URL}" class="ryd-premium-teaser__secondary" id="ryd-premium-teaser-learn">${secondaryText}</a>
      </div>
    </header>
    <div class="ryd-premium-teaser__body">
      <div class="ryd-premium-teaser__stats" role="status" aria-live="polite">
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">${statRaw}</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-raw">—</span>
        </div>
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">${statDislikes}</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-dislikes">—</span>
        </div>
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">${statLikes}</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-likes">—</span>
        </div>
      </div>
      <p class="ryd-premium-teaser__status" id="ryd-premium-teaser-status"></p>
      <section class="ryd-premium-teaser__breadcrumbs" aria-label="${breadcrumbsAria}">
        <h3 class="ryd-premium-teaser__breadcrumbs-title">${breadcrumbsTitle}</h3>
        <ol class="ryd-premium-teaser__breadcrumbs-list">
          <li>${step1}</li>
          <li>${step2}</li>
          <li>${step3}</li>
        </ol>
      </section>
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
