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

jest.mock("./premiumAnalytics.theme", () => ({
  getTextColor: jest.fn(() => "#111111"),
  getMutedTextColor: jest.fn(() => "#222222"),
  getBorderColor: jest.fn(() => "#333333"),
}));

jest.mock("./premiumAnalytics.logging", () => ({
  logRangeSelection: jest.fn(),
  logTimeBounds: jest.fn(),
  logZoomPreview: jest.fn(),
}));

import echarts from "echarts";
import { analyticsState, resetStateForVideo } from "./premiumAnalytics.state";
import {
  ensureActivityChart,
  renderActivityChart,
  clearActivityChart,
  resetChartZoom,
  resizeActivityChart,
  disposeActivityChart,
  registerZoomSelectionListener,
} from "./premiumAnalytics.activity";
import * as timeModule from "./premiumAnalytics.time";
import * as logging from "./premiumAnalytics.logging";

function createPanel() {
  const panel = document.createElement("section");
  const chartHost = document.createElement("div");
  chartHost.id = "ryd-analytics-activity";
  panel.appendChild(chartHost);
  analyticsState.panelElement = panel;
  document.body.appendChild(panel);
  return panel;
}

describe("premiumAnalytics.activity", () => {
  let chartInstance;

  beforeEach(() => {
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
    analyticsState.availableRange = { min: 0, max: 100 };
    renderActivityChart({
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-03-01T00:00:00Z",
      selectedRangeStartUtc: "2025-01-01T00:00:00Z",
      selectedRangeEndUtc: "2025-02-01T00:00:00Z",
      points: [],
    });

    expect(analyticsState.selectionRange.to).toBe(100);
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
});
