/**
 * @jest-environment jsdom
 */

import {
  analyticsState,
  resetStateForVideo,
  resetSessionState,
  setSession,
  RANGE_OPTIONS,
  COUNTRY_LIMIT,
} from "./state";

function resetGlobals() {
  analyticsState.initialized = false;
  analyticsState.panelElement = null;
  analyticsState.panelExpanded = false;
  analyticsState.isLoading = false;
  analyticsState.activityChart = null;
  analyticsState.mapChart = null;
  analyticsState.currentVideoId = null;
  analyticsState.currentRange = 30;
  analyticsState.currentMode = "ratio";
  analyticsState.activeRequestKey = null;
  analyticsState.latestCountries = [];
  analyticsState.latestSubdivisions = [];
  analyticsState.sessionToken = null;
  analyticsState.sessionActive = false;
  analyticsState.latestSeriesPoints = [];
  analyticsState.latestTimeAxis = [];
  analyticsState.latestBucketMs = 60 * 60 * 1000;
  analyticsState.chartTimeBounds = { min: null, max: null };
  analyticsState.globalTimeBounds = { min: null, max: null };
  analyticsState.availableRange = { min: null, max: null };
  analyticsState.selectionRange = { from: null, to: null };
  analyticsState.customSelection = null;
  analyticsState.suppressZoomEvents = false;
  analyticsState.zoomListenerRegistered = false;
  analyticsState.usingCustomRange = false;
  analyticsState.pendingSelection = null;
  analyticsState.expandedChart = null;
  analyticsState.mapView = "world";
  analyticsState.mapFocusCountry = null;
}

describe("premiumAnalytics.state", () => {
  beforeEach(resetGlobals);

  it("exposes configuration constants", () => {
    expect(RANGE_OPTIONS).toEqual([7, 30, 90, 0]);
    expect(COUNTRY_LIMIT).toBe(12);
  });

  describe("resetStateForVideo", () => {
    it("clears video-specific state and timers", () => {
      analyticsState.latestSeriesPoints = [{ foo: "bar" }];
      analyticsState.latestTimeAxis = [1, 2, 3];
      analyticsState.latestBucketMs = 1234;
      analyticsState.chartTimeBounds = { min: 1, max: 2 };
      analyticsState.globalTimeBounds = { min: 3, max: 4 };
      analyticsState.availableRange = { min: 5, max: 6 };
      analyticsState.selectionRange = { from: 7, to: 8 };
      analyticsState.customSelection = { from: 7, to: 8 };
      analyticsState.suppressZoomEvents = true;
      analyticsState.pendingSelection = { from: 1, to: 2 };
      analyticsState.usingCustomRange = true;
      analyticsState.expandedChart = "map";
      analyticsState.latestCountries = [{ countryCode: "US" }];
      analyticsState.latestSubdivisions = [{ subdivisionCode: "CA" }];
      analyticsState.mapView = "subdivision";
      analyticsState.mapFocusCountry = "US";

      resetStateForVideo();

      expect(analyticsState.latestSeriesPoints).toEqual([]);
      expect(analyticsState.latestTimeAxis).toEqual([]);
      expect(analyticsState.latestBucketMs).toBe(60 * 60 * 1000);
      expect(analyticsState.chartTimeBounds).toEqual({ min: null, max: null });
      expect(analyticsState.globalTimeBounds).toEqual({ min: null, max: null });
      expect(analyticsState.availableRange).toEqual({ min: null, max: null });
      expect(analyticsState.selectionRange).toEqual({ from: null, to: null });
      expect(analyticsState.customSelection).toBeNull();
      expect(analyticsState.suppressZoomEvents).toBe(false);
      expect(analyticsState.pendingSelection).toBeNull();
      expect(analyticsState.usingCustomRange).toBe(false);
      expect(analyticsState.expandedChart).toBeNull();
      expect(analyticsState.latestCountries).toEqual([]);
      expect(analyticsState.latestSubdivisions).toEqual([]);
      expect(analyticsState.mapView).toBe("world");
      expect(analyticsState.mapFocusCountry).toBeNull();
    });
  });

  describe("resetSessionState", () => {
    it("clears session token and status", () => {
      analyticsState.sessionToken = "token";
      analyticsState.sessionActive = true;

      resetSessionState();

      expect(analyticsState.sessionToken).toBeNull();
      expect(analyticsState.sessionActive).toBe(false);
    });
  });

  describe("setSession", () => {
    it("assigns session token and coerces active flag", () => {
      setSession("token", "truthy");

      expect(analyticsState.sessionToken).toBe("token");
      expect(analyticsState.sessionActive).toBe(true);

      setSession(null, 0);
      expect(analyticsState.sessionToken).toBeNull();
      expect(analyticsState.sessionActive).toBe(false);
    });
  });
});
