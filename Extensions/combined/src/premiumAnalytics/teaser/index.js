import { getApiEndpoint } from "../../config";
import { getVideoId } from "../../utils";

const PATREON_JOIN_URL = "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649";
const PREMIUM_INFO_URL = "https://returnyoutubedislike.com/premium";

const teaserState = {
  initialized: false,
  suppressed: false,
  panelElement: null,
  currentVideoId: null,
  abortController: null,
};

export function initPremiumTeaser() {
  if (teaserState.initialized) return;
  teaserState.initialized = true;
  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });
  handleNavigation();
}

export function setTeaserSuppressed(shouldSuppress) {
  const next = !!shouldSuppress;

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
      setTeaserSuppressed(true);
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
      window.open(PATREON_JOIN_URL, "_blank", "noopener");
    });
  }

  const infoLink = panel.querySelector("#ryd-premium-teaser-learn");
  if (infoLink) {
    infoLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.open(PREMIUM_INFO_URL, "_blank", "noopener");
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
    status.textContent = isLoading ? "Getting the latest dislike totals…" : "";
  }
}

function showError() {
  setLoading(false);
  const status = teaserState.panelElement?.querySelector("#ryd-premium-teaser-status");
  if (status) {
    status.textContent = "We could not load dislike data just now. Try reloading the page.";
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
  return `
    <header class="ryd-premium-teaser__header">
      <div>
        <span class="ryd-premium-teaser__badge">Return YouTube Dislike</span>
        <h2 class="ryd-premium-teaser__title">Dislike insights snapshot</h2>
        <p class="ryd-premium-teaser__subtitle">Raw dislikes are direct reports from extension users watching this video.</p>
      </div>
      <div class="ryd-premium-teaser__actions">
        <a href="${PATREON_JOIN_URL}" class="ryd-premium-teaser__cta" id="ryd-premium-teaser-cta">Unlock Premium</a>
        <a href="${PREMIUM_INFO_URL}" class="ryd-premium-teaser__secondary" id="ryd-premium-teaser-learn">Preview full analytics</a>
      </div>
    </header>
    <div class="ryd-premium-teaser__body">
      <div class="ryd-premium-teaser__stats" role="status" aria-live="polite">
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">Raw dislike count</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-raw">—</span>
        </div>
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">Estimated dislikes</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-dislikes">—</span>
        </div>
        <div class="ryd-premium-teaser__stat">
          <span class="ryd-premium-teaser__stat-label">Estimated likes</span>
          <span class="ryd-premium-teaser__stat-value" id="ryd-premium-teaser-likes">—</span>
        </div>
      </div>
      <p class="ryd-premium-teaser__status" id="ryd-premium-teaser-status"></p>
      <section class="ryd-premium-teaser__breadcrumbs" aria-label="How to unlock Premium analytics">
        <h3 class="ryd-premium-teaser__breadcrumbs-title">Unlock Premium Video Insights in three quick steps:</h3>
        <ol class="ryd-premium-teaser__breadcrumbs-list">
          <li>Sign in with Patreon from the Return YouTube Dislike extension popup.</li>
          <li>Select the Premium tier to enable activity timelines, country leaderboards, and the interactive map.</li>
          <li>Reload YouTube to view hourly trends, top countries, and US state drill-downs for every video.</li>
        </ol>
      </section>
    </div>
  `;
}
