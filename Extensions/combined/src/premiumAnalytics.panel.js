import { analyticsState, RANGE_OPTIONS } from "./premiumAnalytics.state";
import { sanitizeCount } from "./premiumAnalytics.utils";

let callbacks = {
  onRangePreset: () => {},
  onModeChange: () => {},
};

export function configurePanelCallbacks(newCallbacks) {
  callbacks = { ...callbacks, ...newCallbacks };
}

export function ensurePanel() {
  const state = analyticsState;
  if (state.panelElement) {
    return state.panelElement;
  }

  const secondaryInner =
    document.querySelector("#secondary #secondary-inner") || document.querySelector("#secondary-inner");
  if (!secondaryInner) {
    setTimeout(ensurePanel, 500);
    return null;
  }

  const panel = document.createElement("section");
  panel.className = "ryd-premium-analytics ryd-premium-feature";
  panel.innerHTML = createPanelMarkup();
  secondaryInner.insertBefore(panel, secondaryInner.firstChild);
  bindUiControls(panel);
  state.panelElement = panel;
  updateRangeButtons();
  updateModeButtons();
  return panel;
}

export function updateRangeButtons() {
  const state = analyticsState;
  const panel = state.panelElement;
  if (!panel) return;
  panel.querySelectorAll(".ryd-range").forEach((btn) => {
    const value = btn.dataset.range;
    if (value === "custom") {
      btn.classList.toggle("is-active", !!state.customRange);
    } else {
      const numeric = parseInt(value, 10);
      btn.classList.toggle("is-active", !state.customRange && numeric === state.currentRange);
    }
  });
}

export function updateModeButtons() {
  const state = analyticsState;
  const panel = state.panelElement;
  if (!panel) return;
  panel.querySelectorAll(".ryd-mode").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.mode === state.currentMode);
  });
}

export function setListsLoading() {
  const panel = analyticsState.panelElement;
  if (!panel) return;
  const likesList = panel.querySelector("#ryd-analytics-top-likes");
  const dislikesList = panel.querySelector("#ryd-analytics-top-dislikes");
  if (likesList) likesList.innerHTML = `<li class="ryd-analytics__placeholder">Loading…</li>`;
  if (dislikesList) dislikesList.innerHTML = `<li class="ryd-analytics__placeholder">Loading…</li>`;
}

export function updateCountryList(container, entries, type) {
  if (!container) return;
  if (!entries?.length) {
    container.innerHTML = `<li class="ryd-analytics__placeholder">No data yet</li>`;
    return;
  }

  container.innerHTML = entries
    .map(({ countryCode, countryName, likes, dislikes }) => {
      const value = type === "likes" ? likes : dislikes;
      const safeValue = sanitizeCount(value);
      const name = countryName || countryCode || "Unknown";
      const codeSuffix = countryCode ? ` (${countryCode})` : "";
      return `<li><span class="ryd-analytics__country">${name}${codeSuffix}</span><span class="ryd-analytics__value">${safeValue.toLocaleString()}</span></li>`;
    })
    .join("");
}

export function renderSummary(summary) {
  if (!summary) return;
  const panel = analyticsState.panelElement;
  if (!panel) return;
  const footer = panel.querySelector("#ryd-analytics-footer");
  if (!footer) return;

  const totalInteractions = summary.totalLikes + summary.totalDislikes;
  footer.textContent = `Captured ${totalInteractions.toLocaleString()} interactions from ${summary.countriesRepresented} countries (${summary.uniqueIps.toLocaleString()} unique IPs)`;
}

export function setFooterMessage(text) {
  const footer = analyticsState.panelElement?.querySelector("#ryd-analytics-footer");
  if (footer) {
    footer.textContent = text || "";
  }
}

function bindUiControls(container) {
  container.querySelectorAll(".ryd-range").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.range;
      if (!value) return;
      if (value === "custom") return;
      const numeric = parseInt(value, 10);
      if (Number.isNaN(numeric)) return;
      callbacks.onRangePreset(numeric);
    });
  });

  container.querySelectorAll(".ryd-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (!mode) return;
      callbacks.onModeChange(mode);
    });
  });
}

function createPanelMarkup() {
  const state = analyticsState;
  const rangeControls = RANGE_OPTIONS.map((days) => {
    const label = formatRangeLabel(days);
    const isActive = days === state.currentRange;
    return `<button class="ryd-range${isActive ? " is-active" : ""}" data-range="${days}">${label}</button>`;
  }).join("");
  const customChip = `<button class="ryd-range ryd-range--custom${state.customRange ? " is-active" : ""}" data-range="custom" disabled>Custom</button>`;
  const modeControls = createModeControls();
  return `
    <header class="ryd-analytics__header">
      <div class="ryd-analytics__title">Premium Video Insights</div>
      <div class="ryd-analytics__controls">
        <div class="ryd-analytics__ranges">${rangeControls}${customChip}</div>
      </div>
    </header>
    <div class="ryd-analytics__body">
      <div class="ryd-analytics__chart" id="ryd-analytics-activity"></div>
      <div class="ryd-analytics__lists">
        <div class="ryd-analytics__list" data-type="likes">
          <h4>Top Like Countries</h4>
          <ul class="ryd-analytics__list-items" id="ryd-analytics-top-likes"></ul>
        </div>
        <div class="ryd-analytics__list" data-type="dislikes">
          <h4>Top Dislike Countries</h4>
          <ul class="ryd-analytics__list-items" id="ryd-analytics-top-dislikes"></ul>
        </div>
      </div>
      <div class="ryd-analytics__map-block">
        <div class="ryd-analytics__map-controls">
          <span class="ryd-analytics__map-label">Map metric</span>
          <div class="ryd-analytics__modes" role="tablist">${modeControls}</div>
        </div>
        <div class="ryd-analytics__map" id="ryd-analytics-map"></div>
      </div>
      <div class="ryd-analytics__footer" id="ryd-analytics-footer"></div>
    </div>
  `;
}

function createModeControls() {
  const state = analyticsState;
  const modes = [
    { key: "likes", label: "Likes" },
    { key: "dislikes", label: "Dislikes" },
    { key: "ratio", label: "Ratio" },
  ];

  return modes
    .map(({ key, label }) => {
      const isActive = state.currentMode === key;
      return `<button class="ryd-mode${isActive ? " is-active" : ""}" data-mode="${key}">${label}</button>`;
    })
    .join("");
}

function formatRangeLabel(days) {
  if (days === 0) {
    return "All time";
  }
  return `${days}d`;
}
