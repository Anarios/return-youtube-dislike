import { analyticsState, resetStateForVideo, setSession } from "./state";
import {
  configurePanelCallbacks,
  ensurePanel,
  updateRangeButtons,
  updateRangeAnchorButtons,
  updateModeButtons,
  applyChartExpansionState,
  applyPanelView,
  setPanelExpanded,
} from "./panel";
import {
  resizeActivityChart,
  disposeActivityChart,
  registerZoomSelectionListener,
  refreshActivityTheme,
} from "./activity";
import { renderMap, resizeMapChart, disposeMapChart, refreshMapTheme } from "./map";
import { debounce } from "./utils";
import { getBrowser, getVideoId } from "../utils";
import { loadRawCounts, resetRawCounts } from "./rawCounts";

import { MS_PER_DAY, EXPANDABLE_SECTIONS } from "./constants";
import { requestAnalytics, scheduleSelectionFetch, normalizeSelection } from "./requests";
import { setTeaserSuppressed, TEASER_SUPPRESSION_REASON_PREMIUM } from "./teaser";
import { showTierNotice, hideTierNotice } from "./tierNotice";
import { observeTheme } from "./theme";

let resizeListener = null;
let themeObserver = null;
let panelViewStorageListener = null;
let panelViewRevision = 0;
let panelDismissedRevision = 0;

function normalizePanelView(value) {
  return value === "raw" || value === "hidden" ? value : "full";
}

function applyPanelPreferences(view, dismissed) {
  analyticsState.panelView = normalizePanelView(view);
  analyticsState.panelDismissed = dismissed === true;
  if (analyticsState.panelView !== "full" || analyticsState.panelDismissed) {
    analyticsState.expandedChart = null;
    setPanelExpanded(false);
    applyChartExpansionState();
  }
  applyPanelView();
  if (analyticsState.panelView === "full" && !analyticsState.panelDismissed) {
    resizeCharts();
  }
}

function savePanelPreferences(preferences) {
  try {
    const saved = getBrowser()?.storage?.sync?.set(preferences);
    saved?.catch?.(() => {});
  } catch {
    // The display choice still applies when storage is unavailable.
  }
}

function handlePanelViewChange(value) {
  panelViewRevision++;
  applyPanelPreferences(value, analyticsState.panelDismissed);
  savePanelPreferences({ premiumAnalyticsView: analyticsState.panelView });
}

function handlePanelDismiss() {
  panelDismissedRevision++;
  applyPanelPreferences(analyticsState.panelView, true);
  savePanelPreferences({ hidePremiumTeaser: true });
}

function syncPanelView() {
  try {
    const storage = getBrowser()?.storage;
    if (!storage?.sync) return;
    panelViewStorageListener = (changes, area) => {
      if (area !== "sync" || (!changes.premiumAnalyticsView && !changes.hidePremiumTeaser)) return;
      if (changes.premiumAnalyticsView) panelViewRevision++;
      if (changes.hidePremiumTeaser) panelDismissedRevision++;
      applyPanelPreferences(
        changes.premiumAnalyticsView ? changes.premiumAnalyticsView.newValue : analyticsState.panelView,
        changes.hidePremiumTeaser ? changes.hidePremiumTeaser.newValue : analyticsState.panelDismissed,
      );
    };
    storage.onChanged.addListener(panelViewStorageListener);
    const revision = panelViewRevision;
    const dismissedRevision = panelDismissedRevision;
    storage.sync.get(["premiumAnalyticsView", "hidePremiumTeaser"], (result) => {
      if (analyticsState.initialized) {
        applyPanelPreferences(
          revision === panelViewRevision ? result?.premiumAnalyticsView : analyticsState.panelView,
          dismissedRevision === panelDismissedRevision ? result?.hidePremiumTeaser : analyticsState.panelDismissed,
        );
      }
    });
  } catch {
    // Keep the current display choice when storage is unavailable.
  }
}

function initPremiumAnalytics() {
  if (analyticsState.initialized) return;
  analyticsState.initialized = true;
  themeObserver = observeTheme(() => {
    refreshActivityTheme();
    refreshMapTheme();
  });

  if (!analyticsState.zoomListenerRegistered) {
    registerZoomSelectionListener(handleChartSelection);
    analyticsState.zoomListenerRegistered = true;
  }

  configurePanelCallbacks({
    onRangePreset: handleRangePreset,
    onRangeAnchorChange: handleRangeAnchorChange,
    onModeChange: handleModeChange,
    onChartExpand: handleChartExpand,
    onPanelViewChange: handlePanelViewChange,
    onPanelDismiss: handlePanelDismiss,
  });

  syncPanelView();

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
    loadRawCounts(videoId);
    return;
  }

  analyticsState.currentVideoId = videoId;
  resetStateForVideo();
  resetRawCounts();
  applyChartExpansionState();
  if (analyticsState.initialized) {
    ensurePanel();
  }
  requestAnalytics();
  loadRawCounts(videoId);
}

function handleRangePreset(rangeDays) {
  const state = analyticsState;
  const samePreset = !state.usingCustomRange && rangeDays === state.currentRange;
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
    analyticsState.selectionRange.from === normalized.from && analyticsState.selectionRange.to === normalized.to;

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
  resetRawCounts();
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
  panelViewRevision++;
  panelDismissedRevision++;
  if (panelViewStorageListener) {
    getBrowser()?.storage?.onChanged?.removeListener(panelViewStorageListener);
    panelViewStorageListener = null;
  }
  themeObserver?.disconnect();
  themeObserver = null;
  teardownPanel();
  if (resizeListener) {
    window.removeEventListener("resize", resizeListener);
  }
  document.removeEventListener("yt-navigate-finish", handleNavigation);
  hideTierNotice();
  analyticsState.initialized = false;
}

function updatePremiumSession({ token, active, membershipTier }) {
  const previousToken = analyticsState.sessionToken;
  const wasActive = analyticsState.sessionActive;
  const previousTier = analyticsState.membershipTier;

  setSession(token || null, active, membershipTier);

  if (!analyticsState.sessionActive) {
    setTeaserSuppressed(false, TEASER_SUPPRESSION_REASON_PREMIUM);
    hideTierNotice();
    teardownPanel();
    return;
  }

  const hasPremiumTier = analyticsState.membershipTier === "premium";

  if (!hasPremiumTier) {
    setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
    showTierNotice();
    teardownPanel();
    return;
  }

  hideTierNotice();
  setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
  ensurePanel();

  const tokenChanged = analyticsState.sessionToken && analyticsState.sessionToken !== previousToken;
  const tierUpgraded = previousTier !== "premium" && analyticsState.membershipTier === "premium";
  const activated = (!wasActive && analyticsState.sessionActive) || tierUpgraded;

  if ((tokenChanged || activated) && analyticsState.currentVideoId) {
    requestAnalytics();
    loadRawCounts(analyticsState.currentVideoId);
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
