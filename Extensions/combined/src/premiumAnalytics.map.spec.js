/**
 * @jest-environment jsdom
 */

jest.mock("echarts", () => {
  return {
    registerMap: jest.fn(),
    init: jest.fn(() => ({
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    })),
  };
});

jest.mock("topojson-client", () => ({
  feature: jest.fn(() => ({
    features: [
      {
        properties: { name: "United States of America" },
        geometry: { type: "Polygon", coordinates: [[[0, 0],[1,0],[1,1],[0,1],[0,0]]] },
      },
      {
        properties: { name: "Canada" },
        geometry: { type: "Polygon", coordinates: [[[0, 0],[1,0],[1,1],[0,1],[0,0]]] },
      },
    ],
  })),
}));

jest.mock("country-code-lookup", () => {
  const countries = [
    { iso2: "US", iso3: "USA", country: "United States", officialName: "United States of America" },
    { iso2: "CA", iso3: "CAN", country: "Canada", officialName: "Canada" },
  ];
  const byIso = jest.fn((code) => countries.find((c) => c.iso2 === code || c.iso3 === code));
  const byCountry = jest.fn((name) => countries.find((c) => c.country === name));
  return {
    countries,
    byIso,
    byCountry,
  };
});

jest.mock("./premiumAnalytics.utils", () => ({
  sanitizeCount: jest.fn((value) => Number(value) || 0),
  capitalize: jest.requireActual("./premiumAnalytics.utils").capitalize,
}));

jest.mock("./premiumAnalytics.theme", () => ({
  getMutedTextColor: jest.fn(() => "#aaaaaa"),
  getBorderColor: jest.fn(() => "#bbbbbb"),
}));

import echarts from "echarts";
import { analyticsState } from "./premiumAnalytics.state";
import { ensureMapChart, renderMap, disposeMapChart, clearMapChart, resizeMapChart } from "./premiumAnalytics.map";

const { sanitizeCount } = jest.requireMock("./premiumAnalytics.utils");

function setupPanel() {
  const panel = document.createElement("section");
  const mapHost = document.createElement("div");
  mapHost.id = "ryd-analytics-map";
  panel.appendChild(mapHost);
  analyticsState.panelElement = panel;
  document.body.appendChild(panel);
  return panel;
}

describe("premiumAnalytics.map", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    analyticsState.panelElement = null;
    analyticsState.mapChart = null;
    analyticsState.currentMode = "ratio";
    analyticsState.latestCountries = [];
    setupPanel();
    sanitizeCount.mockReset();
    sanitizeCount.mockImplementation((value) => Number(value) || 0);
  });

  it("initializes the map chart when required", () => {
    const chart = ensureMapChart();
    expect(echarts.init).toHaveBeenCalled();
    expect(chart).toBe(analyticsState.mapChart);
  });

  it("renders processed map data for ratio mode", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    sanitizeCount.mockImplementation((value) => Number(value));

    renderMap([
      { countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 },
      { countryCode: "CA", countryName: "Canada", likes: 0, dislikes: 4 },
    ]);

    expect(chart.setOption).toHaveBeenCalled();
    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data).toHaveLength(2);
    expect(option.visualMap.min).toBe(0);
    expect(option.visualMap.max).toBe(1);
  });

  it("normalizes United States naming differences", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    sanitizeCount.mockImplementation((value) => Number(value));

    renderMap([
      { countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 },
    ]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("falls back to synonyms when only country name present", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;

    renderMap([{ countryCode: "", countryName: "United States", likes: 4, dislikes: 1 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("handles grouped synonyms including parenthetical abbreviations", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;

    renderMap([{ countryCode: null, countryName: "United States (USA)", likes: 2, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("switches metric based on mode", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.currentMode = "likes";

    renderMap([
      { countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 },
    ]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].value).toBe(10);
    expect(option.visualMap.inRange.color).toEqual(["#bbf7d0", "#15803d"]);
  });

  it("uses red palette for dislikes mode", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.currentMode = "dislikes";

    renderMap([
      { countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 },
    ]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].value).toBe(5);
    expect(option.visualMap.inRange.color).toEqual(["#fecaca", "#b91c1c"]);
  });

  it("supports internal state dataset fallback", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", likes: 3, dislikes: 1 }];

    renderMap();

    expect(chart.setOption).toHaveBeenCalled();
  });

  it("clears, resizes, and disposes the chart", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;

    clearMapChart();
    expect(chart.clear).toHaveBeenCalled();

    resizeMapChart();
    expect(chart.resize).toHaveBeenCalled();

    disposeMapChart();
    expect(chart.dispose).toHaveBeenCalled();
    expect(analyticsState.mapChart).toBeNull();
  });
});
