import * as echarts from "echarts";

import { analyticsState } from "./premiumAnalytics.state";
import {
  clampRangeToBounds,
  combineBounds,
  computeChartBounds,
  resolveZoomBounds,
  updateGlobalBounds,
} from "./premiumAnalytics.time";
import { toEpoch } from "./premiumAnalytics.utils";
import { getTextColor, getMutedTextColor, getBorderColor } from "./premiumAnalytics.theme";
import { logRangeSelection, logTimeBounds, logZoomPreview } from "./premiumAnalytics.logging";

function pickFirstFinite(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

let activityHandlers = {
  onZoomCommit: () => {},
  onZoomReset: () => {},
};

export function configureActivityHandlers(newHandlers) {
  activityHandlers = { ...activityHandlers, ...newHandlers };
}

export function ensureActivityChart() {
  const state = analyticsState;
  if (!state.panelElement) return null;
  if (!state.activityChart) {
    const container = state.panelElement.querySelector("#ryd-analytics-activity");
    if (!container) return null;
    state.activityChart = echarts.init(container);
  }
  return state.activityChart;
}

export function renderActivityChart(timeSeries, requestedBounds) {
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

  const declaredBounds = {
    min: toEpoch(timeSeries?.rangeStartUtc),
    max: toEpoch(timeSeries?.rangeEndUtc),
  };

  const selectionEpoch = state.customRange
    ? {
        min: toEpoch(state.customRange.fromUtc),
        max: toEpoch(state.customRange.toUtc),
      }
    : null;

  const requestedEpoch = requestedBounds
    ? { min: requestedBounds.from, max: requestedBounds.to }
    : null;

  const globalBounds = {
    min: pickFirstFinite(declaredBounds.min, requestedEpoch?.min, computedBounds.min),
    max: pickFirstFinite(declaredBounds.max, requestedEpoch?.max, computedBounds.max),
  };

  updateGlobalBounds(globalBounds);

  const combinedFallback = combineBounds(requestedBounds ?? {}, declaredBounds);
  let chartBounds = combineBounds(computedBounds, combinedFallback);
  if (selectionEpoch) {
    chartBounds = combineBounds(selectionEpoch, chartBounds);
  }

  state.chartTimeBounds = chartBounds;
  logTimeBounds("chart", state.chartTimeBounds);
  logTimeBounds("global", state.globalTimeBounds);

  const sliderMin = pickFirstFinite(
    declaredBounds.min,
    requestedEpoch?.min,
    state.globalTimeBounds.min,
    state.chartTimeBounds.min,
    state.latestTimeAxis[0],
  );
  const sliderMax = pickFirstFinite(
    declaredBounds.max,
    requestedEpoch?.max,
    state.globalTimeBounds.max,
    state.chartTimeBounds.max,
    state.latestTimeAxis[state.latestTimeAxis.length - 1],
  );

  const sliderBounds = { min: sliderMin, max: sliderMax };

  let selectionBounds;
  if (state.customRange) {
    selectionBounds = clampRangeToBounds(
      {
        from: toEpoch(state.customRange.fromUtc),
        to: toEpoch(state.customRange.toUtc),
      },
      sliderBounds,
    );
  } else if (state.currentRange === 0) {
    selectionBounds = clampRangeToBounds(
      {
        from: sliderMin,
        to: sliderMax,
      },
      sliderBounds,
    );
  } else {
    selectionBounds = clampRangeToBounds(
      {
        from: pickFirstFinite(state.chartTimeBounds.min, sliderMin),
        to: pickFirstFinite(state.chartTimeBounds.max, sliderMax),
      },
      sliderBounds,
    );
  }

  if (!selectionBounds) {
    selectionBounds = {
      from: sliderMin ?? Date.now() - state.latestBucketMs,
      to: sliderMax ?? Date.now(),
    };
  }

  const effectiveSliderBounds = {
    min: Number.isFinite(sliderBounds.min) ? sliderBounds.min : selectionBounds.from,
    max: Number.isFinite(sliderBounds.max) ? sliderBounds.max : selectionBounds.to,
  };

  logRangeSelection("selection", selectionBounds);

  const dataZoom = createDataZoom(effectiveSliderBounds, selectionBounds);

  state.suppressZoomEvents = true;

  activityChart.setOption({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: { data: ["Likes", "Dislikes"], textStyle: { color: getTextColor() } },
    grid: { left: 40, right: 20, top: 30, bottom: 70 },
    xAxis: {
      type: "time",
      min: effectiveSliderBounds.min,
      max: effectiveSliderBounds.max,
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

  setTimeout(() => {
    state.suppressZoomEvents = false;
  }, 0);

  bindChartInteractions();
}

export function clearActivityChart() {
  const chart = analyticsState.activityChart;
  chart?.clear();
}

export function resetChartZoom() {
  const state = analyticsState;
  const chart = state.activityChart;
  if (!chart) return;
  state.suppressZoomEvents = true;
  const bounds = {
    min: state.globalTimeBounds.min ?? state.chartTimeBounds.min,
    max: state.globalTimeBounds.max ?? state.chartTimeBounds.max,
  };
  const { min, max } = bounds;
  if (min != null && max != null) {
    chart.dispatchAction({
      type: "dataZoom",
      startValue: min,
      endValue: max,
    });
  } else {
    chart.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  }
  setTimeout(() => {
    state.suppressZoomEvents = false;
  }, 0);
}

export function resizeActivityChart() {
  analyticsState.activityChart?.resize();
}

export function disposeActivityChart() {
  if (analyticsState.activityChart) {
    analyticsState.activityChart.dispose();
    analyticsState.activityChart = null;
  }
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

function bindChartInteractions() {
  const state = analyticsState;
  const activityChart = state.activityChart;
  if (!activityChart || activityChart.__rydZoomBound) return;

  activityChart.on("dataZoom", (event) => {
    if (state.suppressZoomEvents) return;

    const sliderBounds = {
      min: state.globalTimeBounds.min ?? state.chartTimeBounds.min,
      max: state.globalTimeBounds.max ?? state.chartTimeBounds.max,
    };

    if (sliderBounds.min == null || sliderBounds.max == null) {
      return;
    }

    const bounds = resolveZoomBounds(event, sliderBounds, state.latestTimeAxis);
    if (!bounds) return;

    const [startTime, endTime] = bounds;
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return;

    const tolerance = Math.max(state.latestBucketMs, 5 * 60 * 1000);
    const isFullRange =
      Math.abs(startTime - sliderBounds.min) <= tolerance && Math.abs(endTime - sliderBounds.max) <= tolerance;

    if (isFullRange) {
      state.pendingZoomRange = null;
      state.pendingZoomReset = true;
      logZoomPreview("zoom", { from: sliderBounds.min, to: sliderBounds.max });
      return;
    }

    if (endTime - startTime < state.latestBucketMs) {
      return;
    }

    const clamped = clampRangeToBounds({ from: startTime, to: endTime }, sliderBounds);
    if (!clamped) return;

    state.pendingZoomReset = false;
    state.pendingZoomRange = clamped;
    logZoomPreview("preview", clamped);
  });

  const commitPendingZoom = () => {
    if (state.pendingZoomReset) {
      state.pendingZoomReset = false;
      state.pendingZoomRange = null;
      activityHandlers.onZoomReset();
      return;
    }

    if (!state.pendingZoomRange) return;

    const range = state.pendingZoomRange;
    state.pendingZoomRange = null;

    activityHandlers.onZoomCommit(range);
  };

  const zr = activityChart.getZr();
  zr.on("mouseup", commitPendingZoom);
  zr.on("touchend", commitPendingZoom);
  zr.on("globalout", commitPendingZoom);
  activityChart.__rydZoomBound = true;
}
