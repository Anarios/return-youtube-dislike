/**
 * @jest-environment node
 */

jest.mock("../panel", () => ({ setActivityBucketLabel: jest.fn() }));
jest.mock("../../utils", () => ({
  localize: (key) => ({ premiumAnalytics_modeLikes: "Likes", premiumAnalytics_modeDislikes: "Dislikes" })[key] || key,
}));
jest.mock("../theme", () => ({
  getTextColor: () => "#ffffff",
  getMutedTextColor: () => "#b3b3b3",
  getBorderColor: () => "#444444",
  getSurfaceColor: () => "rgba(255,255,255,0.06)",
}));
jest.mock("../logging", () => ({ logRangeSelection: jest.fn(), logTimeBounds: jest.fn() }));

import * as echarts from "echarts";
import { analyticsState, resetStateForVideo } from "../state";
import { renderActivityChart } from "./index";

function renderedBounds(chart, componentType) {
  const component = chart.getModel().getComponent(componentType);
  const view = chart.getViewOfComponentModel(component);
  const bounds = view.group.getBoundingRect().clone();
  bounds.applyTransform(view.group.getComputedTransform());
  return bounds;
}

describe("activity chart layout", () => {
  afterEach(() => {
    analyticsState.activityChart?.dispose();
    analyticsState.activityChart = null;
    analyticsState.panelElement = null;
    resetStateForVideo();
  });

  it.each([
    ["compact", 600, 220],
    ["narrow", 320, 220],
    ["expanded", 1100, 560],
  ])("keeps the rendered legend above the zoom slider when %s", (_layout, width, height) => {
    const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
    analyticsState.activityChart = chart;
    analyticsState.panelElement = {};

    renderActivityChart({
      bucket: "hour",
      totalRangeStartUtc: "2025-01-01T00:00:00Z",
      totalRangeEndUtc: "2025-01-02T00:00:00Z",
      points: [
        { timestampUtc: "2025-01-01T00:00:00Z", likes: 15, dislikes: 3 },
        { timestampUtc: "2025-01-01T01:00:00Z", likes: 35, dislikes: 7 },
        { timestampUtc: "2025-01-01T02:00:00Z", likes: 55, dislikes: 11 },
      ],
    });

    const legend = renderedBounds(chart, "legend");
    const slider = renderedBounds(chart, "dataZoom");

    expect(legend.height).toBeGreaterThan(0);
    expect(slider.height).toBeGreaterThan(0);
    expect(legend.y).toBeGreaterThanOrEqual(0);
    expect(legend.y + legend.height).toBeLessThanOrEqual(slider.y);
    expect(slider.y + slider.height).toBeLessThanOrEqual(height);
  });
});
