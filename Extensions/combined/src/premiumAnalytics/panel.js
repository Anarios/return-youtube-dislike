import { analyticsState, RANGE_OPTIONS, RANGE_ANCHORS } from "./state";
import { sanitizeCount } from "./utils";

let callbacks = {
  onRangePreset: () => {},
  onRangeAnchorChange: () => {},
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
    updateRangeAnchorButtons();
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
  updateRangeAnchorButtons();
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

export function updateRangeAnchorButtons() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  const resolvedAnchor = resolveRangeAnchor();
  panel.querySelectorAll(".ryd-range-anchor").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.anchor === resolvedAnchor);
  });

  const descriptor = panel.querySelector("#ryd-analytics-range-window");
  if (descriptor) {
    descriptor.textContent = formatRangeWindowLabel(resolvedAnchor);
  }
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

export function setActivityBucketLabel(text) {
  const panel = analyticsState.panelElement;
  if (!panel) return;
  const container = panel.querySelector("#ryd-analytics-activity-meta");
  const label = panel.querySelector("#ryd-analytics-bucket-label");
  if (!container || !label) return;
  const content = typeof text === "string" ? text.trim() : "";
  label.textContent = content;
  container.hidden = content.length === 0;
}

export function renderSummary(summary) {
  if (!summary) return;
  const panel = analyticsState.panelElement;
  if (!panel) return;
  const footer = panel.querySelector("#ryd-analytics-footer");
  if (!footer) return;

  const likes = sanitizeCount(summary.totalLikes);
  const dislikes = sanitizeCount(summary.totalDislikes);
  const totalInteractions = likes + dislikes;
  const countries = sanitizeCount(summary.countriesRepresented);
  const uniqueIps = sanitizeCount(summary.uniqueIps);
  const periodLabel = formatSelectedPeriod();

  const periodMarkup = periodLabel
    ? `<span class="ryd-analytics__period-label">Selected period: ${periodLabel}</span>`
    : "";

  footer.innerHTML = `
    <div class="ryd-analytics__totals" role="status" aria-live="polite">
      <div class="ryd-analytics__totals-header">
        <span class="ryd-analytics__totals-label">Extension users</span>
        ${periodMarkup}
      </div>
      <div class="ryd-analytics__totals-values">
        <span class="ryd-analytics__totals-value ryd-analytics__totals-likes">${likes.toLocaleString()} likes</span>
        <span class="ryd-analytics__totals-divider" aria-hidden="true">•</span>
        <span class="ryd-analytics__totals-value ryd-analytics__totals-dislikes">${dislikes.toLocaleString()} dislikes</span>
      </div>
    </div>
    <div class="ryd-analytics__summary-meta">
      Captured ${totalInteractions.toLocaleString()} interactions from ${countries.toLocaleString()} countries (${uniqueIps.toLocaleString()} unique IPs)
    </div>
  `;
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

  container.querySelectorAll(".ryd-range-anchor").forEach((btn) => {
    btn.addEventListener("click", () => {
      const anchor = btn.dataset.anchor;
      if (!anchor) return;
      callbacks.onRangeAnchorChange(anchor);
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
  const anchorControls = createRangeAnchorControls();
  const modeControls = createModeControls();

  return `
    <header class="ryd-analytics__header">
      <div class="ryd-analytics__title">Premium Video Insights</div>
      <div class="ryd-analytics__controls">
        <div class="ryd-analytics__ranges">${rangeControls}</div>
        ${anchorControls}
      </div>
    </header>
    <div class="ryd-analytics__body">
      <section class="ryd-analytics__section" data-chart="activity">
        <div class="ryd-analytics__section-header">
          <h3 class="ryd-analytics__section-title">Engagement over time</h3>
          <button class="ryd-analytics__section-expand" type="button" data-chart="activity" aria-expanded="false">Expand</button>
        </div>
        <div class="ryd-analytics__section-content">
          <div class="ryd-analytics__chart-meta" id="ryd-analytics-activity-meta" hidden>
            <span class="ryd-analytics__bucket-label" id="ryd-analytics-bucket-label"></span>
          </div>
          <div class="ryd-analytics__chart" id="ryd-analytics-activity"></div>  
        </div>
      </section>
      <section class="ryd-analytics__section" data-chart="lists">
        <div class="ryd-analytics__section-header">
          <h3 class="ryd-analytics__section-title">Top countries</h3>
          <button class="ryd-analytics__section-expand" type="button" data-chart="lists" aria-expanded="false">Expand</button> 
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
          <button class="ryd-analytics__section-expand" type="button" data-chart="map" aria-expanded="false">Expand</button>
        </div>
        <div class="ryd-analytics__section-content">
          <div class="ryd-analytics__map-block">
            <div class="ryd-analytics__map-controls">
              <span class="ryd-analytics__map-label">Map metric</span>
              <div class="ryd-analytics__modes" role="tablist">${modeControls}</div>
              <button class="ryd-analytics__map-reset" type="button" id="ryd-analytics-map-reset" hidden>Back to world map</button>
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

function createRangeAnchorControls() {
  const resolvedAnchor = resolveRangeAnchor();
  const buttons = RANGE_ANCHORS.map((anchor) => {
    const label = anchor === "last" ? "Latest days" : "First days";
    const isActive = anchor === resolvedAnchor;
    const title =
      anchor === "last"
        ? "Show the most recent days within the selected window"
        : "Show the earliest days within the selected window";
    return `<button class="ryd-range-anchor${isActive ? " is-active" : ""}" type="button" data-anchor="${anchor}" title="${title}">${label}</button>`;
  }).join("");

  return `
    <div class="ryd-analytics__window" role="group" aria-label="Data window">
      <span class="ryd-analytics__window-label">Data window</span>
      <div class="ryd-analytics__window-toggle">${buttons}</div>
      <span class="ryd-analytics__window-hint" id="ryd-analytics-range-window">${formatRangeWindowLabel(resolvedAnchor)}</span>
    </div>
  `;
}

function formatRangeLabel(days) {
  return days === 0 ? "All time" : `${days}d`;
}

function resolveRangeAnchor() {
  const anchor = typeof analyticsState.rangeAnchor === "string" ? analyticsState.rangeAnchor.toLowerCase() : "";
  return anchor === "last" ? "last" : "first";
}

function formatRangeWindowLabel(anchor) {
  if (
    analyticsState.usingCustomRange &&
    analyticsState.selectionRange?.from != null &&
    analyticsState.selectionRange?.to != null
  ) {
    return "Custom selection";
  }

  const range = analyticsState.currentRange;
  if (!Number.isFinite(range) || range <= 0) {
    return "All time";
  }
  const absoluteRange = Math.max(0, Math.round(range));
  if (absoluteRange <= 0) {
    return "All time";
  }
  const unit = absoluteRange === 1 ? "day" : "days";
  return anchor === "last" ? `Last ${absoluteRange} ${unit}` : `First ${absoluteRange} ${unit}`;
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
  const anchorRect = resolveAnchorRect();
  panel.style.position = "fixed";
  panel.style.top = "72px";
  applyAnchorPosition(panel, anchorRect, { maxWidthFallback: "min(960px, calc(100vw - 48px))" });
  panel.style.maxHeight = "calc(100vh - 96px)";
  panel.style.overflowY = "auto";
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
    button.textContent = "Expand";
    button.setAttribute("aria-expanded", "false");
    button.classList.remove("is-active");
  }
}

function positionExpandedSection(section, button) {
  const anchorRect = resolveAnchorRect();
  section.style.position = "fixed";
  section.style.top = "72px";
  applyAnchorPosition(section, anchorRect, { maxWidthFallback: "min(960px, calc(100vw - 48px))" });
  section.style.maxHeight = "calc(100vh - 120px)";
  section.style.zIndex = "2147483647";
  section.style.background = "var(--yt-spec-base-background, #202020)";
  section.style.boxShadow = "0 30px 60px rgba(0, 0, 0, 0.45)";
  section.style.padding = "16px";
  section.style.overflowY = "auto";

  const viewportHeight = window.innerHeight || 0;
  const computed = viewportHeight > 0 ? Math.min(viewportHeight * 0.8, viewportHeight - 160) : NaN;
  const targetHeight = Math.max(360, Number.isFinite(computed) && computed > 0 ? computed : 560);
  section.style.height = `${Math.round(targetHeight)}px`;

  section.querySelectorAll(".ryd-analytics__chart, .ryd-analytics__map").forEach((element) => {
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
    button.textContent = "Expand";
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

function formatSelectedPeriod() {
  const { usingCustomRange, selectionRange, currentRange } = analyticsState;

  if (usingCustomRange && selectionRange?.from && selectionRange?.to) {
    const from = formatDate(selectionRange.from);
    const to = formatDate(selectionRange.to);
    if (from && to) {
      return from === to ? from : `${from} – ${to}`;
    }
  }

  return formatRangeWindowLabel(resolveRangeAnchor());
}

function formatDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function resolveAnchorRect() {
  const selectors = [
    "#primary-inner",
    "#columns #primary-inner",
    "#primary",
    "#columns #primary",
    "ytd-watch-flexy #primary",
    "#columns",
    "ytd-watch-flexy",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element || typeof element.getBoundingClientRect !== "function") continue;
    const rect = element.getBoundingClientRect();
    if (rect && typeof rect.width === "number" && rect.width > 1) {
      return rect;
    }
  }

  return null;
}

function applyAnchorPosition(target, rect, { maxWidthFallback }) {
  if (rect) {
    target.style.left = `${Math.round(rect.left)}px`;
    target.style.width = `${Math.round(rect.width)}px`;
    target.style.transform = "";
    return;
  }

  target.style.left = "50%";
  target.style.width = maxWidthFallback;
  target.style.transform = "translateX(-50%)";
}
