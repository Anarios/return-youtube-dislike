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
      { properties: { name: "United States of America" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Canada" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "S. Sudan" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Côte d'Ivoire" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Czechia" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "eSwatini" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Dem. Rep. Congo" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Eq. Guinea" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Solomon Is." }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "Timor-Leste" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      { properties: { name: "W. Sahara" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
    ],
  })),
}));

jest.mock("country-code-lookup", () => {
  const countries = [
    { iso2: "US", iso3: "USA", country: "United States", officialName: "United States of America" },
    { iso2: "CA", iso3: "CAN", country: "Canada", officialName: "Canada" },
    { iso2: "SS", iso3: "SSD", country: "South Sudan", officialName: "Republic of South Sudan" },
    { iso2: "CI", iso3: "CIV", country: "Ivory Coast", officialName: "Côte d'Ivoire" },
    { iso2: "CZ", iso3: "CZE", country: "Czech Republic", officialName: "Czechia" },
    { iso2: "SZ", iso3: "SWZ", country: "Swaziland", officialName: "Eswatini" },
    { iso2: "CD", iso3: "COD", country: "Democratic Republic of the Congo", officialName: "Democratic Republic of the Congo" },
    { iso2: "GQ", iso3: "GNQ", country: "Equatorial Guinea", officialName: "Republic of Equatorial Guinea" },
    { iso2: "SB", iso3: "SLB", country: "Solomon Islands", officialName: "Solomon Islands" },
    { iso2: "TL", iso3: "TLS", country: "East Timor", officialName: "Democratic Republic of Timor-Leste" },
    { iso2: "EH", iso3: "ESH", country: "Western Sahara", officialName: "Sahrawi Arab Democratic Republic" },
  ];
  const byIso = jest.fn((code) => countries.find((c) => c.iso2 === code || c.iso3 === code));
  const byCountry = jest.fn((name) => countries.find((c) => c.country === name || c.officialName === name));
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
  getSurfaceColor: jest.fn(() => "rgba(0,0,0,0.04)"),
  getHoverFillColor: jest.fn(() => "rgba(0,0,0,0.18)"),
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
    analyticsState.expandedChart = null;
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

  it("formats tooltip with likes, dislikes, and ratio regardless of mode", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.currentMode = "likes";

    renderMap([{ countryCode: "US", countryName: "United States", likes: 75, dislikes: 25 }]);

    const option = chart.setOption.mock.calls[0][0];
    const formatter = option.tooltip.formatter;
    const formatted = formatter({
      name: "United States",
      data: option.series[0].data[0],
    });

    expect(formatted).toContain("Likes: 75");
    expect(formatted).toContain("Dislikes: 25");
    expect(formatted).toContain("Like ratio: 75.0%");
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

  it("maps additional synonyms to their feature names", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    const cases = [
      { name: "South Sudan", expected: "S. Sudan" },
      { name: "S Sudan", expected: "S. Sudan" },
      { name: "Ivory Coast", expected: "Côte d'Ivoire" },
      { name: "Democratic Republic of the Congo", expected: "Dem. Rep. Congo" },
      { name: "DR Congo", expected: "Dem. Rep. Congo" },
      { name: "Equatorial Guinea", expected: "Eq. Guinea" },
      { name: "Solomon Islands", expected: "Solomon Is." },
      { name: "Swaziland", expected: "eSwatini" },
      { name: "East Timor", expected: "Timor-Leste" },
      { name: "Western Sahara", expected: "W. Sahara" },
      { name: "Czech Republic", expected: "Czechia" },
    ];

    for (const testCase of cases) {
      chart.setOption.mockClear();
      renderMap([{ countryCode: "", countryName: testCase.name, likes: 5, dislikes: 1 }]);
      const option = chart.setOption.mock.calls[0][0];
      expect(option.series[0].data[0].name).toBe(testCase.expected);
    }
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

  it("hides the visual map legend when the section is collapsed", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.expandedChart = null;

    renderMap([{ countryCode: "US", likes: 1, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.visualMap.show).toBe(false);
  });

  it("shows the visual map legend when the section is expanded", () => {
    const chart = {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
    };
    analyticsState.mapChart = chart;
    analyticsState.expandedChart = "map";

    renderMap([{ countryCode: "US", likes: 1, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.visualMap.show).toBe(true);
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
