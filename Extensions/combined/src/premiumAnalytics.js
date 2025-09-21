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
} from "./premiumAnalytics.panel";
import { renderActivityChart, resetChartZoom, resizeActivityChart, disposeActivityChart } from "./premiumAnalytics.activity";
import { ensureMapChart, renderMap, resizeMapChart, disposeMapChart } from "./premiumAnalytics.map";
import { debounce, safeJson, toEpoch } from "./premiumAnalytics.utils";
import { logFetchRequest } from "./premiumAnalytics.logging";

let resizeListener = null;

function initPremiumAnalytics() {
  if (analyticsState.initialized) return;
  analyticsState.initialized = true;

  configurePanelCallbacks({
    onRangePreset: handleRangePreset,
    onModeChange: handleModeChange,
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
  state.currentRange = rangeDays;
  updateRangeButtons();
  resetChartZoom();
  requestAnalytics();
}

function handleModeChange(mode) {
  if (!mode || mode === analyticsState.currentMode) return;
  analyticsState.currentMode = mode;
  updateModeButtons();
  renderMap();
}

function requestAnalytics() {
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
  params.set("rangeDays", `${state.currentRange}`);

  const requestKey = `${state.currentVideoId}:${state.currentRange}`;
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
    min: toEpoch(data?.timeSeries?.rangeStartUtc),
    max: toEpoch(data?.timeSeries?.rangeEndUtc),
  };

  analyticsState.selectionRange = {
    from: toEpoch(data?.timeSeries?.windowStartUtc),
    to: toEpoch(data?.timeSeries?.windowEndUtc),
  };

  renderActivityChart(data?.timeSeries);

  analyticsState.latestCountries = data?.geo?.countries ?? [];
  updateCountryList(panel.querySelector("#ryd-analytics-top-likes"), data?.geo?.topLikes ?? [], "likes");
  updateCountryList(panel.querySelector("#ryd-analytics-top-dislikes"), data?.geo?.topDislikes ?? [], "dislikes");

  renderSummary(data?.summary);
  updateRangeButtons();
  updateModeButtons();

  ensureMapChart();
  renderMap(analyticsState.latestCountries);
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
  resizeActivityChart();
  resizeMapChart();
}

export { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession };
