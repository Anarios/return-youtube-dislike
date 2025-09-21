import * as echarts from "echarts";

import { analyticsState } from "./premiumAnalytics.state";
import { clampRangeToBounds, combineBounds, computeChartBounds, updateGlobalBounds } from "./premiumAnalytics.time";
import { toEpoch } from "./premiumAnalytics.utils";
import { getTextColor, getMutedTextColor, getBorderColor } from "./premiumAnalytics.theme";
import { logRangeSelection, logTimeBounds } from "./premiumAnalytics.logging";

const zoomListeners = new Set();

function pickFirstFinite(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function ensureActivityChart() {
  const state = analyticsState;
  if (!state.panelElement) return null;
  if (!state.activityChart) {
    const container = state.panelElement.querySelector("#ryd-analytics-activity");
    if (!container) return null;
    state.activityChart = echarts.init(container);
    state.activityChart.on("dataZoom", handleDataZoom);
  }
  return state.activityChart;
}

export function renderActivityChart(timeSeries) {
  const state = analyticsState;
  const activityChart = ensureActivityChart();
  if (!activityChart) return;

  const seriesPoints = timeSeries?.points ?? [];
  const likesSeries = seriesPoints.map((p) => [p.timestampUtc, p.likes]);
  const dislikesSeries = seriesPoints.map((p) => [p.timestampUtc, p.dislikes]);

  state.latestSeriesPoints = seriesPoints;
  state.latestTimeAxis = seriesPoints.map((p) => toEpoch(p.timestampUtc)).filter((ms) => ms != null);
  if (state.latestTimeAxis.length > 1) {
    state.latestBucketMs = Math.max(1, state.latestTimeAxis[1] - state.latestTimeAxis[0]);
  }

  const computedBounds = computeChartBounds(seriesPoints, state.latestTimeAxis, state.latestBucketMs);

  const availableBounds = {
    min: state.availableRange.min ?? toEpoch(timeSeries?.totalRangeStartUtc),
    max: state.availableRange.max ?? toEpoch(timeSeries?.totalRangeEndUtc),
  };

  const sliderBounds = combineBounds(availableBounds, computedBounds);

  state.globalTimeBounds = {
    min: availableBounds.min ?? sliderBounds.min ?? state.globalTimeBounds.min,
    max: availableBounds.max ?? sliderBounds.max ?? state.globalTimeBounds.max,
  };

  updateGlobalBounds(state.globalTimeBounds);

  state.chartTimeBounds = sliderBounds;
  logTimeBounds("chart", state.chartTimeBounds);
  logTimeBounds("global", state.globalTimeBounds);

  const requestedSelection = {
    from: state.selectionRange.from ?? toEpoch(timeSeries?.selectedRangeStartUtc),
    to: state.selectionRange.to ?? toEpoch(timeSeries?.selectedRangeEndUtc),
  };

  const selectionBounds = clampRangeToBounds(requestedSelection, sliderBounds)
    ?? (Number.isFinite(sliderBounds.min) && Number.isFinite(sliderBounds.max)
      ? { from: sliderBounds.min, to: sliderBounds.max }
      : null);

  if (selectionBounds) {
    state.selectionRange = selectionBounds;
    logRangeSelection("selection", selectionBounds);
  }

  const axisBounds = {
    min: pickFirstFinite(
      sliderBounds.min,
      computedBounds.min,
      selectionBounds?.from,
      state.latestTimeAxis[0],
      Date.now() - state.latestBucketMs,
    ),
    max: pickFirstFinite(
      sliderBounds.max,
      computedBounds.max,
      selectionBounds?.to,
      state.latestTimeAxis[state.latestTimeAxis.length - 1],
      Date.now(),
    ),
  };

  const dataZoom = createDataZoom(sliderBounds, selectionBounds);

  analyticsState.suppressZoomEvents = true;
  activityChart.setOption({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: { data: ["Likes", "Dislikes"], textStyle: { color: getTextColor() } },
    grid: { left: 40, right: 20, top: 30, bottom: 70 },
    xAxis: {
      type: "time",
      min: axisBounds.min,
      max: axisBounds.max,
      axisLabel: { color: getMutedTextColor() },
      axisLine: { lineStyle: { color: getBorderColor() } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: getMutedTextColor() },
      splitLine: { lineStyle: { color: getBorderColor(0.35) } },
    },
    series: [
      {
        name: "Likes",
        type: "line",
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#55c759" },
        data: likesSeries,
      },
      {
        name: "Dislikes",
        type: "line",
        smooth: true,
        symbol: "none",
        itemStyle: { color: "#f87171" },
        data: dislikesSeries,
      },
    ],
    dataZoom,
  });
  analyticsState.suppressZoomEvents = false;
}

export function clearActivityChart() {
  const chart = analyticsState.activityChart;
  chart?.clear();
}

export function resetChartZoom() {
  const state = analyticsState;
  const chart = state.activityChart;
  if (!chart) return;
  const bounds = {
    min: state.globalTimeBounds.min ?? state.chartTimeBounds.min,
    max: state.globalTimeBounds.max ?? state.chartTimeBounds.max,
  };
  const { min, max } = bounds;
  if (min != null && max != null) {
    analyticsState.suppressZoomEvents = true;
    chart.dispatchAction({
      type: "dataZoom",
      startValue: min,
      endValue: max,
    });
  } else {
    analyticsState.suppressZoomEvents = true;
    chart.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  }
}

export function resizeActivityChart() {
  analyticsState.activityChart?.resize();
}

export function disposeActivityChart() {
  if (analyticsState.activityChart) {
    analyticsState.activityChart.off?.("dataZoom", handleDataZoom);
    analyticsState.activityChart.dispose();
    analyticsState.activityChart = null;
  }
}

export function registerZoomSelectionListener(listener) {
  if (typeof listener === "function") {
    zoomListeners.add(listener);
  }
}

export function unregisterZoomSelectionListener(listener) {
  zoomListeners.delete(listener);
}

function createDataZoom(bounds, selection) {
  const slider = {
    type: "slider",
    xAxisIndex: 0,
    height: 18,
    bottom: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    textStyle: { color: getMutedTextColor() },
    handleStyle: { color: getTextColor(), borderColor: getBorderColor(0.6) },
    realtime: true,
  };

  const inside = {
    type: "inside",
    xAxisIndex: 0,
  };

  const { min, max } = bounds;

  if (min != null && max != null) {
    slider.rangeMode = "value";
    inside.rangeMode = "value";
  }

  if (selection && selection.from != null && selection.to != null) {
    const clamped = clampRangeToBounds(selection, bounds);
    if (clamped) {
      slider.startValue = clamped.from;
      slider.endValue = clamped.to;
      inside.startValue = clamped.from;
      inside.endValue = clamped.to;
    }
  } else if (min != null && max != null) {
    slider.startValue = min;
    slider.endValue = max;
    inside.startValue = min;
    inside.endValue = max;
  }

  return [slider, inside];
}

function handleDataZoom(event) {
  if (analyticsState.suppressZoomEvents) {
    analyticsState.suppressZoomEvents = false;
    return;
  }

  const payload = Array.isArray(event?.batch) && event.batch.length ? event.batch[0] : event;
  const bounds = analyticsState.chartTimeBounds;
  const minBound = bounds?.min ?? analyticsState.availableRange.min;
  const maxBound = bounds?.max ?? analyticsState.availableRange.max;

  const startValue = resolveZoomValue(payload, "startValue", "start", minBound, maxBound);
  const endValue = resolveZoomValue(payload, "endValue", "end", minBound, maxBound);

  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || startValue === endValue) {
    return;
  }

  const range = {
    from: startValue,
    to: endValue,
    source: payload?.type ?? event?.type ?? "dataZoom",
  };

  zoomListeners.forEach((listener) => {
    try {
      listener(range);
    } catch (error) {
      console.error("premium analytics zoom listener failed", error);
    }
  });
}

function resolveZoomValue(payload, valueKey, percentKey, minBound, maxBound) {
  const direct = Number(payload?.[valueKey]);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const percent = Number(payload?.[percentKey]);
  if (!Number.isFinite(percent) || minBound == null || maxBound == null) {
    return null;
  }

  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const span = maxBound - minBound;
  if (!Number.isFinite(span) || span <= 0) {
    return null;
  }

  return minBound + (clampedPercent / 100) * span;
}
