/**
 * @jest-environment jsdom
 */

jest.mock("echarts", () => {
  return {
    init: jest.fn(() => {
      const zrHandlers = {};
      const chart = {
        setOption: jest.fn(),
        clear: jest.fn(),
        resize: jest.fn(),
        dispose: jest.fn(),
        on: jest.fn(),
        dispatchAction: jest.fn(),
        getZr: () => ({
          on: (event, handler) => {
            zrHandlers[event] = handler;
          },
          trigger: (event) => zrHandlers[event]?.(),
        }),
      };
      chart.__zrHandlers = zrHandlers;
      return chart;
    }),
  };
});

jest.mock("../theme", () => ({
  getTextColor: jest.fn(() => "#111111"),
  getMutedTextColor: jest.fn(() => "#222222"),
  getBorderColor: jest.fn(() => "#333333"),
}));

jest.mock("../logging", () => ({
  logRangeSelection: jest.fn(),
  logTimeBounds: jest.fn(),
  logZoomPreview: jest.fn(),
}));

import echarts from "echarts";
import { analyticsState, resetStateForVideo } from "../state";
import {
  ensureActivityChart,
  renderActivityChart,
  clearActivityChart,
  resetChartZoom,
  resizeActivityChart,
  disposeActivityChart,
  registerZoomSelectionListener,
  setActivityTranslator,
  resetActivityTranslator,
} from "./index";
import * as timeModule from "./time";
import * as logging from "../logging";

const enMessages = require("../../../_locales/en/messages.json");

function getMessage(key, substitutions) {
  const entry = enMessages[key];
  if (!entry) {
    return key;
  }
  let message = entry.message ?? "";
  if (substitutions == null) {
    return message;
  }
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  values.forEach((value, index) => {
    const replacement = value != null ? `${value}` : "";
    message = message.replace(new RegExp(`\\$${index + 1}`, "g"), replacement);
  });
  return message;
}

function createPanel() {
  const panel = document.createElement("section");
  const meta = document.createElement("div");
  meta.id = "ryd-analytics-activity-meta";
  meta.className = "ryd-analytics__chart-meta";
  meta.hidden = true;
  const bucketLabel = document.createElement("span");
  bucketLabel.id = "ryd-analytics-bucket-label";
  meta.appendChild(bucketLabel);
  const chartHost = document.createElement("div");
  chartHost.id = "ryd-analytics-activity";
  panel.appendChild(meta);
  panel.appendChild(chartHost);
  analyticsState.panelElement = panel;
  document.body.appendChild(panel);
  return panel;
}

describe("premiumAnalytics.activity", () => {
  let chartInstance;

  beforeEach(() => {
    global.chrome = {
      i18n: {
        getMessage,
      },
    };
    setActivityTranslator((key, substitutions) => getMessage(key, substitutions));
    document.body.innerHTML = "";
    resetStateForVideo();
    analyticsState.panelElement = null;
    analyticsState.activityChart = null;
    analyticsState.globalTimeBounds = { min: null, max: null };
    echarts.init.mockImplementation(() => {
      const zrHandlers = {};
      chartInstance = {
        setOption: jest.fn(),
        clear: jest.fn(),
        resize: jest.fn(),
        dispose: jest.fn(),
        on: jest.fn(),
        dispatchAction: jest.fn(),
        getZr: () => ({
          on: (event, handler) => {
            zrHandlers[event] = handler;
          },
          trigger: (event) => zrHandlers[event]?.(),
        }),
        __zrHandlers: zrHandlers,
      };
      return chartInstance;
    });
    createPanel();
  });

  afterEach(() => {
    delete global.chrome;
    resetActivityTranslator();
    jest.restoreAllMocks();
  });

  it("initializes and caches the chart", () => {
    const chart = ensureActivityChart();

    expect(echarts.init).toHaveBeenCalled();
    expect(chart).toBe(chartInstance);
    expect(ensureActivityChart()).toBe(chartInstance);
    expect(chartInstance.on).toHaveBeenCalledWith("dataZoom", expect.any(Function));
  });

  it("renders series data and updates state", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 0, max: 1000 });

    renderActivityChart({
      bucket: "hour",
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-01-02T00:00:00Z",
      points: [
        { timestampUtc: "2025-01-01T12:00:00Z", likes: 10, dislikes: 2 },
        { timestampUtc: "2025-01-01T13:00:00Z", likes: 20, dislikes: 4 },
      ],
    });

    expect(chartInstance.setOption).toHaveBeenCalled();
    expect(logging.logRangeSelection).toHaveBeenCalled();
    expect(analyticsState.latestSeriesPoints).toHaveLength(2);
    expect(analyticsState.selectionRange.from).toBeLessThanOrEqual(analyticsState.selectionRange.to);

  });

  it("updates the bucket label when rendering", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 0, max: 0 });
    const meta = document.getElementById("ryd-analytics-activity-meta");
    const label = document.getElementById("ryd-analytics-bucket-label");
    expect(meta.hidden).toBe(true);
    expect(label.textContent).toBe("");

    renderActivityChart({
      bucket: "day",
      points: [],
    });

    expect(meta.hidden).toBe(false);
    expect(label.textContent).toBe(getMessage("premiumAnalytics_bucketDay"));
  });

  it("fills missing buckets with zero counts", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 0, max: 3 * 60 * 60 * 1000 });

    renderActivityChart({
      bucket: "hour",
      points: [
        { timestampUtc: "2025-01-01T00:00:00Z", likes: 5, dislikes: 1 },
        { timestampUtc: "2025-01-01T02:00:00Z", likes: 2, dislikes: 0 },
      ],
    });

    const options = chartInstance.setOption.mock.calls.at(-1)[0];
    const likesSeries = options.series[0].data;
    const dislikesSeries = options.series[1].data;

    const hour0 = new Date("2025-01-01T00:00:00Z").toISOString();
    const hour1 = new Date("2025-01-01T01:00:00Z").toISOString();
    const hour2 = new Date("2025-01-01T02:00:00Z").toISOString();

    expect(likesSeries.map(([timestamp]) => new Date(timestamp).toISOString())).toEqual([hour0, hour1, hour2]);
    expect(likesSeries.map(([, value]) => value)).toEqual([5, 0, 2]);

    expect(dislikesSeries.map(([timestamp]) => new Date(timestamp).toISOString())).toEqual([hour0, hour1, hour2]);
    expect(dislikesSeries.map(([, value]) => value)).toEqual([1, 0, 0]);

    expect(analyticsState.latestSeriesPoints).toHaveLength(3);
    expect(analyticsState.latestBucketMs).toBe(60 * 60 * 1000);
    const latestOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    expect(latestOptions.series[0].type).toBe("line");
    expect(latestOptions.series[0].showSymbol).toBe(false);
    expect(latestOptions.series[0].symbol).toBe("none");
  });

  it("configures slider bounds from declared range", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 100, max: 200 });
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-01-01T12:00:00Z",
      points: [],
    });

    const chartOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    const slider = chartOptions.dataZoom[0];
    expect(slider.startValue).toBeLessThan(slider.endValue);
    expect(slider.startValue).toBe(new Date("2025-01-01T00:00:00Z").getTime());
    expect(slider.rangeMode).toBe("value");
  });

  it("extends slider bounds to include bucket-aligned points before declared range", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockRestore();
    renderActivityChart({
      bucket: "day",
      totalRangeStartUtc: "2025-01-01T06:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T06:00:00Z",
      selectedRangeEndUtc: "2025-01-02T00:00:00Z",
      points: [{ timestampUtc: "2025-01-01T00:00:00Z", likes: 5, dislikes: 1 }],
    });

    const chartOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    const pointMs = new Date("2025-01-01T00:00:00Z").getTime();
    expect(chartOptions.xAxis.min).toBeLessThanOrEqual(pointMs);
    expect(chartOptions.dataZoom[0].startValue).toBe(pointMs);
    expect(analyticsState.chartTimeBounds.min).toBeLessThanOrEqual(pointMs);
    expect(analyticsState.selectionRange.from).toBe(pointMs);
  });

  it("expands collapsed ranges for single-bucket day series", () => {
    renderActivityChart({
      bucket: "day",
      totalRangeStartUtc: "2025-01-01T12:00:00Z",
      totalRangeEndUtc: "2025-01-01T12:00:00Z",
      selectedRangeStartUtc: "2025-01-01T12:00:00Z",
      selectedRangeEndUtc: "2025-01-01T12:00:00Z",
      points: [{ timestampUtc: "2025-01-01T12:00:00Z", likes: 3, dislikes: 1 }],
    });

    const chartOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    const slider = chartOptions.dataZoom[0];
    const inside = chartOptions.dataZoom[1];

    expect(slider.startValue).toBeLessThan(slider.endValue);
    expect(inside.startValue).toBeLessThan(inside.endValue);
    expect(analyticsState.selectionRange.from).toBeLessThan(analyticsState.selectionRange.to);
    expect(analyticsState.chartTimeBounds.min).toBeLessThan(analyticsState.chartTimeBounds.max);
    expect(analyticsState.globalTimeBounds.min).toBeLessThan(analyticsState.globalTimeBounds.max);
    expect(chartOptions.series[0].type).toBe("scatter");
    expect(chartOptions.series[0].showSymbol).toBe(true);
    expect(chartOptions.series[0].symbol).toBe("circle");
    expect(chartOptions.series[0].symbolSize).toBe(14);
    expect(chartOptions.series[1].type).toBe("scatter");
    expect(chartOptions.series[1].showSymbol).toBe(true);
    expect(chartOptions.series[1].symbol).toBe("circle");
    expect(chartOptions.series[1].symbolSize).toBe(14);
  });

  it("derives bounds from data when range metadata is missing", () => {
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 1_000, max: 2_000 });
    renderActivityChart({
      points: [],
    });

    const chartOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    const slider = chartOptions.dataZoom[0];
    expect(slider.startValue).toBe(chartOptions.xAxis.min);
    expect(slider.endValue).toBe(chartOptions.xAxis.max);
    expect(slider.startValue).toBe(analyticsState.chartTimeBounds.min);
    expect(slider.endValue).toBe(analyticsState.chartTimeBounds.max);
    expect(Number.isFinite(slider.startValue)).toBe(true);
  });

  it("clamps selection to available bounds", () => {
    const availableMin = new Date("2025-01-01T00:00:00Z").getTime();
    const availableMax = new Date("2025-03-01T00:00:00Z").getTime();
    analyticsState.availableRange = { min: availableMin, max: availableMax };
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-03-01T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-02-01T00:00:00Z",
      points: [],
    });

    expect(analyticsState.selectionRange.from).toBeGreaterThanOrEqual(availableMin);
    expect(analyticsState.selectionRange.to).toBeLessThanOrEqual(availableMax);
  });

  it("keeps the slider bounds anchored to the total range after render", () => {
    const totalRangeStart = "2025-01-01T00:00:00Z";
    const totalRangeEnd = "2025-03-01T00:00:00Z";
    const selectedRangeStart = "2025-02-01T00:00:00Z";
    const selectedRangeEnd = "2025-02-15T00:00:00Z";

    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({
      min: new Date(selectedRangeStart).getTime(),
      max: new Date(selectedRangeEnd).getTime(),
    });

    renderActivityChart({
      totalRangeStartUtc: totalRangeStart,
      totalRangeEndUtc: totalRangeEnd,
      selectedRangeStartUtc: selectedRangeStart,
      selectedRangeEndUtc: selectedRangeEnd,
      points: [
        { timestampUtc: selectedRangeStart, likes: 1, dislikes: 0 },
        { timestampUtc: selectedRangeEnd, likes: 2, dislikes: 1 },
      ],
    });

    const chartOptions = chartInstance.setOption.mock.calls.at(-1)[0];
    const slider = chartOptions.dataZoom[0];

    expect(chartOptions.xAxis.min).toBe(new Date(totalRangeStart).getTime());
    expect(chartOptions.xAxis.max).toBe(new Date(totalRangeEnd).getTime());
    expect(slider.startValue).toBe(new Date(selectedRangeStart).getTime());
    expect(slider.endValue).toBe(new Date(selectedRangeEnd).getTime());
  });

  it("clears the chart", () => {
    ensureActivityChart();
    clearActivityChart();
    expect(chartInstance.clear).toHaveBeenCalled();
  });

  it("resets zoom to global bounds", () => {
    ensureActivityChart();
    analyticsState.globalTimeBounds = { min: 10, max: 20 };
    analyticsState.chartTimeBounds = { min: 10, max: 20 };

    resetChartZoom();
    expect(chartInstance.dispatchAction).toHaveBeenCalledWith({ type: "dataZoom", startValue: 10, endValue: 20 });
  });

  it("resizes and disposes the chart", () => {
    ensureActivityChart();

    resizeActivityChart();
    expect(chartInstance.resize).toHaveBeenCalled();

    disposeActivityChart();
    expect(chartInstance.dispose).toHaveBeenCalled();
    expect(analyticsState.activityChart).toBeNull();
  });

  it("notifies zoom listeners when selection changes", () => {
    const listener = jest.fn();
    registerZoomSelectionListener(listener);
    ensureActivityChart();
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 0, max: 1_000_000 });
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-02-01T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-01-05T00:00:00Z",
      points: [],
    });

    const handler = chartInstance.on.mock.calls.find(([event]) => event === "dataZoom")[1];
    analyticsState.suppressZoomEvents = false;
    handler({ startValue: 1000, endValue: 2000 });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ from: 1000, to: 2000 }));
  });

  it("ignores zoom events when suppression flag is set", () => {
    const listener = jest.fn();
    registerZoomSelectionListener(listener);
    ensureActivityChart();
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-01-01T12:00:00Z",
      points: [],
    });

    const handler = chartInstance.on.mock.calls.find(([event]) => event === "dataZoom")[1];
    analyticsState.suppressZoomEvents = true;
    handler({ startValue: 100, endValue: 200 });

    expect(listener).not.toHaveBeenCalled();
    expect(analyticsState.suppressZoomEvents).toBe(false);
  });

  it("derives zoom values from percentage payloads", () => {
    const listener = jest.fn();
    registerZoomSelectionListener(listener);
    ensureActivityChart();
    jest.spyOn(timeModule, "computeChartBounds").mockReturnValue({ min: 0, max: 1000 });
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-01-01T12:00:00Z",
      points: [],
    });

    const handler = chartInstance.on.mock.calls.find(([event]) => event === "dataZoom")[1];
    analyticsState.suppressZoomEvents = false;
    handler({ start: 10, end: 60 });

    expect(listener).toHaveBeenCalled();
    const call = listener.mock.calls.at(-1)[0];
    const bounds = analyticsState.chartTimeBounds;
    const min = bounds.min;
    const max = bounds.max;
    const expectedFrom = min + 0.1 * (max - min);
    const expectedTo = min + 0.6 * (max - min);
    expect(call.from).toBeCloseTo(expectedFrom, 0);
    expect(call.to).toBeCloseTo(expectedTo, 0);
  });
});
