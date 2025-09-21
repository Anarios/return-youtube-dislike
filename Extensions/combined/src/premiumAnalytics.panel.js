import { analyticsState, RANGE_OPTIONS } from "./premiumAnalytics.state";
import { sanitizeCount } from "./premiumAnalytics.utils";

let callbacks = {
  onRangePreset: () => {},
  onModeChange: () => {},
  onChartExpand: () => {},
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
  applyChartExpansionState();

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

  container.querySelectorAll(".ryd-analytics__section-expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chart = btn.dataset.chart;
      if (!chart) return;
      callbacks.onChartExpand(chart);
    });
  });

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
    </header>
    <div class="ryd-analytics__body">
      <section class="ryd-analytics__section" data-chart="activity">
        <div class="ryd-analytics__section-header">
          <h3 class="ryd-analytics__section-title">Engagement over time</h3>
          <button class="ryd-analytics__section-expand" type="button" data-chart="activity" aria-expanded="false">Extend</button>
        </div>
        <div class="ryd-analytics__section-content">
          <div class="ryd-analytics__chart" id="ryd-analytics-activity"></div>
        </div>
      </section>
      <section class="ryd-analytics__section" data-chart="lists">
        <div class="ryd-analytics__section-header">
          <h3 class="ryd-analytics__section-title">Top countries</h3>
          <button class="ryd-analytics__section-expand" type="button" data-chart="lists" aria-expanded="false">Extend</button>
        </div>
        <div class="ryd-analytics__section-content">
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
        </div>
      </section>
      <section class="ryd-analytics__section" data-chart="map">
        <div class="ryd-analytics__section-header">
          <h3 class="ryd-analytics__section-title">Geography</h3>
          <button class="ryd-analytics__section-expand" type="button" data-chart="map" aria-expanded="false">Extend</button>
        </div>
        <div class="ryd-analytics__section-content">
          <div class="ryd-analytics__map-block">
            <div class="ryd-analytics__map-controls">
              <span class="ryd-analytics__map-label">Map metric</span>
              <div class="ryd-analytics__modes" role="tablist">${modeControls}</div>
            </div>
            <div class="ryd-analytics__map" id="ryd-analytics-map"></div>
          </div>
        </div>
      </section>
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

export function applyChartExpansionState() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  const expandedChart = analyticsState.expandedChart;
  const sections = panel.querySelectorAll(".ryd-analytics__section");

  sections.forEach((section) => {
    const chartKey = section.dataset.chart;
    const button = section.querySelector(".ryd-analytics__section-expand");
    const isMatch = expandedChart && chartKey === expandedChart;

    section.classList.toggle("is-expanded", isMatch);

    if (isMatch) {
      positionExpandedSection(section, button);
    } else {
      resetSectionPosition(section, button);
    }
  });
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

function positionExpandedSection(section, button) {
  const primary = document.querySelector("#primary") || document.querySelector("ytd-watch-flexy");
  const rect = primary?.getBoundingClientRect();
  const hasRect = rect && Number.isFinite(rect.width) && rect.width > 0;
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
  const maxViewportWidth = viewportWidth > 0 ? Math.max(viewportWidth - 48, 360) : 960;
  const primaryWidth = hasRect ? rect.width : NaN;
  const baseWidth = Number.isFinite(primaryWidth) && primaryWidth > 0 ? primaryWidth : maxViewportWidth;
  const safeWidth = Math.max(360, Math.min(baseWidth, maxViewportWidth, 960));
  section.style.position = "fixed";
  section.style.top = "72px";
  let left;
  if (hasRect) {
    const primaryLeft = Number.isFinite(rect.left) ? rect.left : 0;
    left = primaryLeft + (rect.width - safeWidth) / 2;
  } else if (viewportWidth > 0) {
    left = (viewportWidth - safeWidth) / 2;
  }
  if (!Number.isFinite(left)) {
    left = 24;
  }
  const maxLeft = viewportWidth > 0 ? viewportWidth - safeWidth - 24 : left;
  if (Number.isFinite(maxLeft)) {
    left = Math.max(24, Math.min(left, maxLeft));
  }
  section.style.left = `${Math.round(left)}px`;
  section.style.width = `${Math.round(safeWidth)}px`;
  section.style.maxHeight = "calc(100vh - 120px)";
  section.style.transform = "";
  section.style.zIndex = "2147483647";
  section.style.background = "var(--yt-spec-base-background, #202020)";
  section.style.boxShadow = "0 30px 60px rgba(0, 0, 0, 0.45)";
  section.style.padding = "16px";
  section.style.overflowY = "auto";

  const viewportHeight = window.innerHeight || 0;
  const computed = viewportHeight > 0 ? Math.min(viewportHeight * 0.8, viewportHeight - 160) : NaN;
  const targetHeight = Math.max(360, Number.isFinite(computed) && computed > 0 ? computed : 560);
  section.style.height = `${Math.round(targetHeight)}px`;

  section
    .querySelectorAll(".ryd-analytics__chart, .ryd-analytics__map")
    .forEach((element) => {
      const chartHeight = Math.max(320, Math.round(targetHeight - 120));
      element.style.height = `${chartHeight}px`;
    });
  if (button) {
    button.textContent = "Collapse";
    button.setAttribute("aria-expanded", "true");
    button.classList.add("is-active");
  }
}

function resetSectionPosition(section, button) {
  section.removeAttribute("style");
  section
    .querySelectorAll(".ryd-analytics__chart, .ryd-analytics__map")
    .forEach((element) => element.removeAttribute("style"));
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
