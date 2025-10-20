import { analyticsState, resetStateForVideo, setSession } from "./state";
import {
  configurePanelCallbacks,
  ensurePanel,
  updateRangeButtons,
  updateRangeAnchorButtons,
  updateModeButtons,
  applyChartExpansionState,
} from "./panel";
import { resizeActivityChart, disposeActivityChart, registerZoomSelectionListener } from "./activity";
import { renderMap, resizeMapChart, disposeMapChart } from "./map";
import { debounce } from "./utils";
import { getVideoId } from "../utils";

import { MS_PER_DAY, EXPANDABLE_SECTIONS } from "./constants";
import { requestAnalytics, scheduleSelectionFetch, normalizeSelection } from "./requests";
import { setTeaserSuppressed } from "./teaser";

let resizeListener = null;

function initPremiumAnalytics() {
  if (analyticsState.initialized) return;
  analyticsState.initialized = true;

  if (!analyticsState.zoomListenerRegistered) {
    registerZoomSelectionListener(handleChartSelection);
    analyticsState.zoomListenerRegistered = true;
  }

  configurePanelCallbacks({
    onRangePreset: handleRangePreset,
    onRangeAnchorChange: handleRangeAnchorChange,
    onModeChange: handleModeChange,
    onChartExpand: handleChartExpand,
  });

  document.addEventListener("yt-navigate-finish", handleNavigation, { passive: true });
  resizeListener = resizeListener || debounce(resizeCharts, 200);
  window.addEventListener("resize", resizeListener);

  handleNavigation();
}

function handleNavigation() {
  const videoId = resolveVideoId();
  if (!videoId) {
    teardownPanel();
    return;
  }

  if (videoId === analyticsState.currentVideoId) {
    ensurePanel();
    return;
  }

  analyticsState.currentVideoId = videoId;
  resetStateForVideo();
  applyChartExpansionState();
  if (analyticsState.initialized) {
    ensurePanel();
  }
  requestAnalytics();
}

function handleRangePreset(rangeDays) {
  const state = analyticsState;
  const samePreset = rangeDays === state.currentRange;
  if (samePreset) {
    return;
  }
  state.usingCustomRange = false;
  state.customSelection = null;
  state.selectionRange = { from: null, to: null };
  state.currentRange = rangeDays;
  updateRangeButtons();
  updateRangeAnchorButtons();
  requestAnalytics();
}

function handleRangeAnchorChange(anchor) {
  const normalized = anchor === "last" ? "last" : "first";
  if (analyticsState.rangeAnchor === normalized) {
    return;
  }
  analyticsState.rangeAnchor = normalized;
  analyticsState.usingCustomRange = false;
  analyticsState.customSelection = null;
  analyticsState.selectionRange = { from: null, to: null };
  updateRangeButtons();
  updateRangeAnchorButtons();
  requestAnalytics();
}

function handleModeChange(mode) {
  if (!mode || mode === analyticsState.currentMode) return;
  analyticsState.currentMode = mode;
  updateModeButtons();
  renderMap();
}

function handleChartExpand(chartKey) {
  if (!EXPANDABLE_SECTIONS.has(chartKey)) {
    return;
  }

  const state = analyticsState;
  const previous = state.expandedChart;
  const next = state.expandedChart === chartKey ? null : chartKey;
  state.expandedChart = next;
  applyChartExpansionState();

  if (next === "activity") {
    resizeActivityChart();
  } else if (next === "map") {
    resizeMapChart();
    resizeActivityChart();
  } else if (next === "lists") {
    resizeActivityChart();
    resizeMapChart();
  } else {
    resizeActivityChart();
    resizeMapChart();
  }

  if (previous === "map" || next === "map") {
    renderMap();
  }
}

function handleChartSelection(range) {
  const normalized = normalizeSelection(range);
  if (!normalized) {
    return;
  }

  const sameAsCurrent =
    analyticsState.selectionRange.from === normalized.from &&
    analyticsState.selectionRange.to === normalized.to;

  analyticsState.selectionRange = normalized;
  analyticsState.customSelection = { ...normalized };
  analyticsState.usingCustomRange = true;
  analyticsState.currentRange = Math.max(0, Math.round((normalized.to - normalized.from) / MS_PER_DAY));
  updateRangeButtons();
  updateRangeAnchorButtons();

  if (!sameAsCurrent) {
    scheduleSelectionFetch(normalized);
  }
}

function teardownPanel() {
  const state = analyticsState;
  state.currentVideoId = null;
  state.activeRequestKey = null;
  state.latestCountries = [];
  resetStateForVideo();
  state.panelExpanded = false;
  state.isLoading = false;

  if (state.panelElement) {
    state.panelElement.remove();
    state.panelElement = null;
  }

  disposeActivityChart();
  disposeMapChart();
}

function teardownPremiumAnalytics() {
  teardownPanel();
  if (resizeListener) {
    window.removeEventListener("resize", resizeListener);
  }
  document.removeEventListener("yt-navigate-finish", handleNavigation);
  analyticsState.initialized = false;
}

function updatePremiumSession({ token, active }) {
  const previousToken = analyticsState.sessionToken;
  const wasActive = analyticsState.sessionActive;

  setSession(token || null, active);

  if (!analyticsState.sessionActive) {
    setTeaserSuppressed(false);
    teardownPanel();
    return;
  }

  setTeaserSuppressed(true);
  ensurePanel();

  const tokenChanged = analyticsState.sessionToken && analyticsState.sessionToken !== previousToken;
  const activated = !wasActive && analyticsState.sessionActive;

  if ((tokenChanged || activated) && analyticsState.currentVideoId) {
    requestAnalytics();
  }
}

function resolveVideoId() {
  const videoId = getVideoId(window.location.href);
  if (!videoId || videoId.length !== 11) return null;
  return videoId;
}

function resizeCharts() {
  applyChartExpansionState();
  resizeActivityChart();
  resizeMapChart();
}

export { initPremiumAnalytics, teardownPremiumAnalytics, updatePremiumSession };
