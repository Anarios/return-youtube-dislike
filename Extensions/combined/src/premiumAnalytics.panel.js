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
  if (analyticsState.panelElement && analyticsState.panelElement.isConnected) {
    applyExpansionState();
    applyLoadingState();
    return analyticsState.panelElement;
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
  analyticsState.panelElement = panel;

  bindUiControls(panel);
  updateRangeButtons();
  updateModeButtons();
  applyExpansionState();
  applyLoadingState();

  return panel;
}

export function updateRangeButtons() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  panel.querySelectorAll(".ryd-range").forEach((btn) => {
    const value = btn.dataset.range;
    const numeric = parseInt(value ?? "", 10);
    const shouldHighlight = !analyticsState.usingCustomRange;
    btn.classList.toggle("is-active", shouldHighlight && numeric === analyticsState.currentRange);
  });
}

export function updateModeButtons() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  panel.querySelectorAll(".ryd-mode").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.mode === analyticsState.currentMode);
  });
}

export function setListsLoading() {
  const panel = analyticsState.panelElement;
  if (!panel) return;
  panel.classList.add("is-loading");
}

export function setFooterMessage(text) {
  const footer = analyticsState.panelElement?.querySelector("#ryd-analytics-footer");
  if (footer) {
    footer.textContent = text || "";
  }
}

export function setPanelExpanded(expanded) {
  analyticsState.panelExpanded = expanded;
  applyExpansionState();
}

export function togglePanelExpanded() {
  setPanelExpanded(!analyticsState.panelExpanded);
}

export function setLoadingState(isLoading) {
  analyticsState.isLoading = isLoading;
  applyLoadingState();
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

function bindUiControls(container) {
  container.querySelectorAll(".ryd-range").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.range;
      if (!value || value === "custom") return;
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

  const expandButton = container.querySelector(".ryd-analytics__expand");
  if (expandButton) {
    expandButton.addEventListener("click", () => {
      togglePanelExpanded();
    });
  }
}

function createPanelMarkup() {
  const rangeControls = RANGE_OPTIONS.map((days) => {
    const label = formatRangeLabel(days);
    const isActive = days === analyticsState.currentRange;
    return `<button class="ryd-range${isActive ? " is-active" : ""}" data-range="${days}">${label}</button>`;
  }).join("");
  const modeControls = createModeControls();

  return `
    <header class="ryd-analytics__header">
      <div class="ryd-analytics__title">Premium Video Insights</div>
      <div class="ryd-analytics__controls">
        <div class="ryd-analytics__ranges">${rangeControls}</div>
      </div>
      <button class="ryd-analytics__expand" type="button" aria-expanded="${analyticsState.panelExpanded}">${
        analyticsState.panelExpanded ? "Collapse" : "Extend"
      }</button>
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
  const modes = [
    { key: "likes", label: "Likes" },
    { key: "dislikes", label: "Dislikes" },
    { key: "ratio", label: "Ratio" },
  ];

  return modes
    .map(({ key, label }) => {
      const isActive = analyticsState.currentMode === key;
      return `<button class="ryd-mode${isActive ? " is-active" : ""}" data-mode="${key}">${label}</button>`;
    })
    .join("");
}

function formatRangeLabel(days) {
  return days === 0 ? "All time" : `${days}d`;
}

function applyExpansionState() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  panel.classList.toggle("is-expanded", analyticsState.panelExpanded);
  const expandButton = panel.querySelector(".ryd-analytics__expand");
  if (analyticsState.panelExpanded) {
    positionExpandedPanel(panel, expandButton);
  } else {
    resetPanelPosition(panel, expandButton);
  }
}

function positionExpandedPanel(panel, button) {
  const primary = document.querySelector("#primary") || document.querySelector("ytd-watch-flexy");
  const rect = primary?.getBoundingClientRect();
  panel.style.position = "fixed";
  panel.style.top = "72px";
  panel.style.left = rect ? `${rect.left}px` : "50%";
  panel.style.width = rect ? `${rect.width}px` : "min(960px, calc(100vw - 48px))";
  panel.style.maxHeight = "calc(100vh - 96px)";
  panel.style.overflowY = "auto";
  panel.style.transform = rect ? "" : "translateX(-50%)";
  panel.style.zIndex = "2147483646";
  if (button) {
    button.textContent = "Collapse";
    button.setAttribute("aria-expanded", "true");
    button.classList.add("is-active");
  }
}

function resetPanelPosition(panel, button) {
  panel.removeAttribute("style");
  if (button) {
    button.textContent = "Extend";
    button.setAttribute("aria-expanded", "false");
    button.classList.remove("is-active");
  }
}

function applyLoadingState() {
  const panel = analyticsState.panelElement;
  if (!panel) return;
  panel.classList.toggle("is-loading", analyticsState.isLoading);
  panel.setAttribute("aria-busy", analyticsState.isLoading ? "true" : "false");
}
