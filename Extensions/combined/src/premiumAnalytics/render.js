import { analyticsState } from "./state";
import {
  ensurePanel,
  renderSummary,
  updateRangeButtons,
  updateRangeAnchorButtons,
  updateModeButtons,
  applyChartExpansionState,
} from "./panel";
import { renderActivityChart, resizeActivityChart } from "./activity";
import { ensureMapChart, renderMap, resizeMapChart } from "./map";
import { toEpoch } from "./utils";
import { updateCountryList } from "./lists";

import { MS_PER_DAY } from "./constants";

function renderAnalytics(data) {
  const panel = ensurePanel();
  if (!panel) {
    setTimeout(() => renderAnalytics(data), 200);
    return;
  }

  const previousRangeDays = analyticsState.currentRange;
  const wasUsingCustomRange = analyticsState.usingCustomRange;

  analyticsState.availableRange = {
    min: toEpoch(data?.timeSeries?.totalRangeStartUtc),
    max: toEpoch(data?.timeSeries?.totalRangeEndUtc),
  };

  analyticsState.selectionRange = {
    from: toEpoch(data?.timeSeries?.selectedRangeStartUtc),
    to: toEpoch(data?.timeSeries?.selectedRangeEndUtc),
  };

  analyticsState.customSelection = wasUsingCustomRange ? { ...analyticsState.selectionRange } : null;
  analyticsState.usingCustomRange = analyticsState.customSelection != null;
  analyticsState.pendingSelection = null;

  if (analyticsState.selectionRange.from != null && analyticsState.selectionRange.to != null) {
    if (analyticsState.usingCustomRange) {
      analyticsState.currentRange = Math.max(
        0,
        Math.round((analyticsState.selectionRange.to - analyticsState.selectionRange.from) / MS_PER_DAY),
      );
    } else {
      analyticsState.currentRange = previousRangeDays;
    }
  }

  analyticsState.suppressZoomEvents = true;

  applyChartExpansionState();
  renderActivityChart(data?.timeSeries);

  analyticsState.latestCountries = data?.geo?.countries ?? [];
  analyticsState.latestSubdivisions = data?.geo?.subdivisions ?? [];

  if (analyticsState.mapView === "subdivision") {
    const focusCode = typeof analyticsState.mapFocusCountry === "string" ? analyticsState.mapFocusCountry.toUpperCase() : "";
    const hasFocusedSubdivisions =
      focusCode &&
      analyticsState.latestSubdivisions.some(
        (entry) => typeof entry?.countryCode === "string" && entry.countryCode.toUpperCase() === focusCode,
      );
    if (!hasFocusedSubdivisions) {
      analyticsState.mapView = "world";
      analyticsState.mapFocusCountry = null;
    }
  }

  updateCountryList(panel.querySelector("#ryd-analytics-top-likes"), data?.geo?.topLikes ?? [], "likes");
  updateCountryList(panel.querySelector("#ryd-analytics-top-dislikes"), data?.geo?.topDislikes ?? [], "dislikes");

  renderSummary(data?.summary);
  updateRangeButtons();
  updateRangeAnchorButtons();
  updateModeButtons();

  ensureMapChart();
  renderMap();

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

export { renderAnalytics };
