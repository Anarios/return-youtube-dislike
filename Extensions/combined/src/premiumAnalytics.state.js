export const RANGE_OPTIONS = [7, 30, 90, 0];
export const COUNTRY_LIMIT = 12;
export const BUCKET = "hour";

export const analyticsState = {
  initialized: false,
  panelElement: null,
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
  customRange: null,
  suppressZoomEvents: false,
  chartTimeBounds: { min: null, max: null },
  globalTimeBounds: { min: null, max: null },
  pendingZoomRange: null,
  pendingZoomReset: false,
  lastRequestedBounds: null,
};

export function resetStateForVideo() {
  analyticsState.customRange = null;
  analyticsState.latestSeriesPoints = [];
  analyticsState.latestTimeAxis = [];
  analyticsState.latestBucketMs = 60 * 60 * 1000;
  analyticsState.chartTimeBounds = { min: null, max: null };
  analyticsState.globalTimeBounds = { min: null, max: null };
  analyticsState.pendingZoomRange = null;
  analyticsState.pendingZoomReset = false;
  analyticsState.lastRequestedBounds = null;
}

export function resetSessionState() {
  analyticsState.sessionToken = null;
  analyticsState.sessionActive = false;
}

export function setSession(token, isActive) {
  analyticsState.sessionToken = token;
  analyticsState.sessionActive = !!isActive;
}
