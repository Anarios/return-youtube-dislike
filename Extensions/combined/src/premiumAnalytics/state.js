export const RANGE_OPTIONS = [7, 30, 90, 0];
export const RANGE_ANCHORS = ["first", "last"];
export const COUNTRY_LIMIT = 12;

export const analyticsState = {
  initialized: false,
  panelElement: null,
  panelExpanded: false,
  isLoading: false,
  activityChart: null,
  mapChart: null,
  currentVideoId: null,
  currentRange: 30,
  rangeAnchor: "first",
  currentMode: "ratio",
  activeRequestKey: null,
  latestCountries: [],
  latestSubdivisions: [],
  sessionToken: null,
  sessionActive: false,
  membershipTier: "none",
  latestSeriesPoints: [],
  latestTimeAxis: [],
  latestBucketMs: 60 * 60 * 1000,
  latestBucketLabel: null,
  chartTimeBounds: { min: null, max: null },
  globalTimeBounds: { min: null, max: null },
  availableRange: { min: null, max: null },
  selectionRange: { from: null, to: null },
  customSelection: null,
  suppressZoomEvents: false,
  zoomListenerRegistered: false,
  usingCustomRange: false,
  pendingSelection: null,
  expandedChart: null,
  mapView: "world",
  mapFocusCountry: null,
};

export function resetStateForVideo() {
  analyticsState.latestSeriesPoints = [];
  analyticsState.latestTimeAxis = [];
  analyticsState.latestBucketMs = 60 * 60 * 1000;
  analyticsState.latestBucketLabel = null;
  analyticsState.chartTimeBounds = { min: null, max: null };
  analyticsState.globalTimeBounds = { min: null, max: null };
  analyticsState.availableRange = { min: null, max: null };
  analyticsState.selectionRange = { from: null, to: null };
  analyticsState.customSelection = null;
  analyticsState.suppressZoomEvents = false;
  analyticsState.pendingSelection = null;
  analyticsState.usingCustomRange = false;
  analyticsState.expandedChart = null;
  analyticsState.latestCountries = [];
  analyticsState.latestSubdivisions = [];
  analyticsState.mapView = "world";
  analyticsState.mapFocusCountry = null;
}

export function resetSessionState() {
  analyticsState.sessionToken = null;
  analyticsState.sessionActive = false;
  analyticsState.membershipTier = "none";
}

export function setSession(token, isActive, membershipTier = "none") {
  analyticsState.sessionToken = token;
  analyticsState.sessionActive = !!isActive;
  analyticsState.membershipTier = typeof membershipTier === "string" ? membershipTier : "none";
}
