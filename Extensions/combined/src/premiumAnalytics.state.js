export const RANGE_OPTIONS = [7, 30, 90, 0];
export const COUNTRY_LIMIT = 12;
export const BUCKET = "hour";

export const analyticsState = {
  initialized: false,
  panelElement: null,
  panelExpanded: false,
  isLoading: false,
  activityChart: null,
  mapChart: null,
  currentVideoId: null,
  currentRange: 30,
  currentMode: "ratio",
  activeRequestKey: null,
  latestCountries: [],
  sessionToken: null,
  sessionActive: false,
  latestSeriesPoints: [],
  latestTimeAxis: [],
  latestBucketMs: 60 * 60 * 1000,
  chartTimeBounds: { min: null, max: null },
  globalTimeBounds: { min: null, max: null },
  availableRange: { min: null, max: null },
  selectionRange: { from: null, to: null },
  customSelection: null,
  suppressZoomEvents: false,
  zoomListenerRegistered: false,
  usingCustomRange: false,
  pendingSelection: null,
};

export function resetStateForVideo() {
  analyticsState.latestSeriesPoints = [];
  analyticsState.latestTimeAxis = [];
  analyticsState.latestBucketMs = 60 * 60 * 1000;
  analyticsState.chartTimeBounds = { min: null, max: null };
  analyticsState.globalTimeBounds = { min: null, max: null };
  analyticsState.availableRange = { min: null, max: null };
  analyticsState.selectionRange = { from: null, to: null };
  analyticsState.customSelection = null;
  analyticsState.suppressZoomEvents = false;
  analyticsState.pendingSelection = null;
  analyticsState.usingCustomRange = false;
}

export function resetSessionState() {
  analyticsState.sessionToken = null;
  analyticsState.sessionActive = false;
}

export function setSession(token, isActive) {
  analyticsState.sessionToken = token;
  analyticsState.sessionActive = !!isActive;
}
