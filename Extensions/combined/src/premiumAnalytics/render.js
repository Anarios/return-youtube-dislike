import { analyticsState } from "./state";
import {
  ensurePanel,
  renderSummary,
  updateRangeButtons,
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

export { renderAnalytics };
