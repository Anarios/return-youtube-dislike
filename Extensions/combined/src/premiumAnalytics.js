import { getApiEndpoint } from "./config";
import { getVideoId } from "./utils";

import { analyticsState, COUNTRY_LIMIT, BUCKET, resetStateForVideo, setSession } from "./premiumAnalytics.state";
import {
  configurePanelCallbacks,
  ensurePanel,
  updateRangeButtons,
  updateModeButtons,
  updateCountryList,
  renderSummary,
  setFooterMessage,
  setLoadingState,
  applyChartExpansionState,
} from "./premiumAnalytics.panel";
import {
  renderActivityChart,
  resetChartZoom,
  resizeActivityChart,
  disposeActivityChart,
  registerZoomSelectionListener,
} from "./premiumAnalytics.activity";
import { ensureMapChart, renderMap, resizeMapChart, disposeMapChart } from "./premiumAnalytics.map";
import { debounce, safeJson, toEpoch } from "./premiumAnalytics.utils";
import { logFetchRequest } from "./premiumAnalytics.logging";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPANDABLE_SECTIONS = new Set(["activity", "map", "lists"]);
let resizeListener = null;
const debounceSelectionFetch = debounce(commitSelectionFetch, 400);

function initPremiumAnalytics() {
  if (analyticsState.initialized) return;
  analyticsState.initialized = true;

  if (!analyticsState.zoomListenerRegistered) {
    registerZoomSelectionListener(handleChartSelection);
    analyticsState.zoomListenerRegistered = true;
  }

  configurePanelCallbacks({
    onRangePreset: handleRangePreset,
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
  requestAnalytics();
}

function handleModeChange(mode) {
  if (!mode || mode === analyticsState.currentMode) return;
  analyticsState.currentMode = mode;
  updateModeButtons();
  renderMap();
}

function requestAnalytics({ selection } = {}) {
  const state = analyticsState;

  if (!state.currentVideoId || !state.sessionToken || !state.sessionActive) {
    return;
  }

  ensurePanel();
  setFooterMessage("Loading insights…");
  setLoadingState(true);
  updateRangeButtons();

  const params = new URLSearchParams();
  params.set("bucket", BUCKET);
  params.set("countryLimit", `${COUNTRY_LIMIT}`);
  const effectiveSelection = normalizeSelection(selection ?? state.customSelection);

  let requestKey;
  if (effectiveSelection) {
    const startIso = msToIso(effectiveSelection.from);
    const endIso = msToIso(effectiveSelection.to);
    if (startIso && endIso) {
      params.set("selectedRangeStartUtc", startIso);
      params.set("selectedRangeEndUtc", endIso);
      requestKey = `${state.currentVideoId}:${startIso}:${endIso}`;
      state.usingCustomRange = true;
      state.currentRange = Math.max(0, Math.round((effectiveSelection.to - effectiveSelection.from) / MS_PER_DAY));
      state.customSelection = { ...effectiveSelection };
      state.selectionRange = { ...effectiveSelection };
    } else {
      params.set("rangeDays", `${state.currentRange}`);
      requestKey = `${state.currentVideoId}:${state.currentRange}`;
      state.usingCustomRange = false;
      state.customSelection = null;
    }
  } else {
    params.set("rangeDays", `${state.currentRange}`);
    requestKey = `${state.currentVideoId}:${state.currentRange}`;
    state.usingCustomRange = false;
    state.customSelection = null;
  }

  state.pendingSelection = effectiveSelection || null;
  state.activeRequestKey = requestKey;

  logFetchRequest(state.currentVideoId, params);

  const url = getApiEndpoint(`/api/patreon/analytics/video/${state.currentVideoId}?${params.toString()}`);

  fetch(url, {
    headers: {
      Authorization: `Bearer ${state.sessionToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await safeJson(response);
        handleError(response.status, payload?.error);
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (!data || analyticsState.activeRequestKey !== requestKey) return;
      renderAnalytics(data);
    })
    .catch((error) => {
      console.error("Premium analytics failed", error);
      if (analyticsState.activeRequestKey === requestKey) {
        handleError(0, "network_error");
      }
    })
    .finally(() => {
      if (analyticsState.activeRequestKey === requestKey) {
        setLoadingState(false);
      }
    });
}

function renderAnalytics(data) {
  const panel = ensurePanel();
  if (!panel) {
    setTimeout(() => renderAnalytics(data), 200);
    return;
  }

  analyticsState.availableRange = {
    min: toEpoch(data?.timeSeries?.totalRangeStartUtc),
    max: toEpoch(data?.timeSeries?.totalRangeEndUtc),
  };

  analyticsState.selectionRange = {
    from: toEpoch(data?.timeSeries?.selectedRangeStartUtc),
    to: toEpoch(data?.timeSeries?.selectedRangeEndUtc),
  };

  analyticsState.customSelection = analyticsState.usingCustomRange
    ? { ...analyticsState.selectionRange }
    : null;
  analyticsState.usingCustomRange = analyticsState.customSelection != null;
  analyticsState.pendingSelection = null;

  if (analyticsState.selectionRange.from != null && analyticsState.selectionRange.to != null) {
    analyticsState.currentRange = Math.max(
      0,
      Math.round((analyticsState.selectionRange.to - analyticsState.selectionRange.from) / MS_PER_DAY),
    );
  }

  analyticsState.suppressZoomEvents = true;

  applyChartExpansionState();
  renderActivityChart(data?.timeSeries);

  analyticsState.latestCountries = data?.geo?.countries ?? [];
  updateCountryList(panel.querySelector("#ryd-analytics-top-likes"), data?.geo?.topLikes ?? [], "likes");
  updateCountryList(panel.querySelector("#ryd-analytics-top-dislikes"), data?.geo?.topDislikes ?? [], "dislikes");

  renderSummary(data?.summary);
  updateRangeButtons();
  updateModeButtons();

  ensureMapChart();
  renderMap(analyticsState.latestCountries);

  if (analyticsState.expandedChart === "activity") {
    resizeActivityChart();
  } else if (analyticsState.expandedChart === "map") {
    resizeMapChart();
    resizeActivityChart();
  } else if (analyticsState.expandedChart === "lists") {
    resizeActivityChart();
    resizeMapChart();
  }
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

  if (!sameAsCurrent) {
    debounceSelectionFetch(normalized);
  }
}

function commitSelectionFetch(selection) {
  requestAnalytics({ selection });
}

function normalizeSelection(selection) {
  if (!selection) return null;
  const from = Number(selection.from);
  const to = Number(selection.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null;
  }
  return { from, to };
}

function msToIso(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function handleError(status, code) {
  let message;
  if (status === 409 || code === "session_upgrade_required") {
    message = "Please re-authorize Patreon to unlock analytics.";
  } else if (status === 403 || code === "membership_inactive") {
    message = "Premium analytics are available for active Patreon supporters.";
  } else if (status === 401 || code === "invalid_session") {
    message = "Session expired. Sign in with Patreon again.";
  } else if (code === "analytics_failure") {
    message = "Analytics backend unavailable right now.";
  } else if (code === "network_error") {
    message = "Unable to reach analytics service.";
  } else {
    message = "Unable to load premium analytics.";
  }

  setFooterMessage(message);
  setLoadingState(false);
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
    teardownPanel();
    return;
  }

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

export { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession };
