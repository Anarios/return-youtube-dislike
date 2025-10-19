/**
 * @jest-environment jsdom
 */

jest.mock("echarts", () => {
  const registerMap = jest.fn();
  const init = jest.fn(() => {
    const listeners = {};
    return {
      setOption: jest.fn(),
      clear: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
      on: jest.fn((event, handler) => {
        listeners[event] = handler;
      }),
      __listeners: listeners,
    };
  });
  return { registerMap, init };
});

jest.mock("topojson-client", () => {
  const polygon = { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 1],[0, 0]]] };
  const worldFeatures = [
    { properties: { name: "United States of America" }, geometry: polygon },
    { properties: { name: "Canada" }, geometry: polygon },
    { properties: { name: "S. Sudan" }, geometry: polygon },
    { properties: { name: "Côte d'Ivoire" }, geometry: polygon },
    { properties: { name: "Czechia" }, geometry: polygon },
    { properties: { name: "eSwatini" }, geometry: polygon },
    { properties: { name: "Dem. Rep. Congo" }, geometry: polygon },
    { properties: { name: "Eq. Guinea" }, geometry: polygon },
    { properties: { name: "Solomon Is." }, geometry: polygon },
    { properties: { name: "Timor-Leste" }, geometry: polygon },
    { properties: { name: "W. Sahara" }, geometry: polygon },
  ];
  const stateFeatures = [
    { properties: { name: "California" }, geometry: polygon },
    { properties: { name: "Texas" }, geometry: polygon },
    { properties: { name: "New York" }, geometry: polygon },
  ];
  let callIndex = 0;
  return {
    feature: jest.fn(() => {
      const result = callIndex === 0 ? worldFeatures : stateFeatures;
      callIndex += 1;
      return { features: result };
    }),
  };
});

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

jest.mock("../utils", () => ({
  sanitizeCount: jest.fn((value) => Number(value) || 0),
  capitalize: jest.requireActual("../utils").capitalize,
}));

jest.mock("../theme", () => ({
  getMutedTextColor: jest.fn(() => "#aaaaaa"),
  getBorderColor: jest.fn(() => "#bbbbbb"),
  getSurfaceColor: jest.fn(() => "rgba(0,0,0,0.04)"),
  getHoverFillColor: jest.fn(() => "rgba(0,0,0,0.18)"),
}));

import echarts from "echarts";
import { analyticsState } from "../state";
import { ensureMapChart, renderMap, disposeMapChart, clearMapChart, resizeMapChart } from "./index";

const { sanitizeCount } = jest.requireMock("../utils");

function createChartStub() {
  const listeners = {};
  return {
    setOption: jest.fn(),
    clear: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    __listeners: listeners,
  };
}

function setupPanel() {
  const panel = document.createElement("section");
  const controls = document.createElement("div");
  const resetButton = document.createElement("button");
  resetButton.id = "ryd-analytics-map-reset";
  resetButton.type = "button";
  resetButton.hidden = true;
  controls.appendChild(resetButton);
  const mapHost = document.createElement("div");
  mapHost.id = "ryd-analytics-map";
  panel.appendChild(controls);
  panel.appendChild(mapHost);
  analyticsState.panelElement = panel;
  document.body.appendChild(panel);
  return panel;
}

describe("premiumAnalytics.map", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    analyticsState.panelElement = null;
    analyticsState.mapChart = null;
    analyticsState.currentMode = "ratio";
    analyticsState.latestCountries = [];
    analyticsState.latestSubdivisions = [];
    analyticsState.mapView = "world";
    analyticsState.mapFocusCountry = null;
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
    const chart = createChartStub();
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
    const chart = createChartStub();
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
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    sanitizeCount.mockImplementation((value) => Number(value));

    renderMap([
      { countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 },
    ]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("falls back to synonyms when only country name present", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;

    renderMap([{ countryCode: "", countryName: "United States", likes: 4, dislikes: 1 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("handles grouped synonyms including parenthetical abbreviations", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;

    renderMap([{ countryCode: null, countryName: "United States (USA)", likes: 2, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("maps additional synonyms to their feature names", () => {
    const chart = createChartStub();
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
    const chart = createChartStub();
    analyticsState.mapChart = chart;

    renderMap([{ countryCode: null, countryName: "United States (USA)", likes: 2, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].name).toBe("United States of America");
  });

  it("switches metric based on mode", () => {
    const chart = createChartStub();
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
    const chart = createChartStub();
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
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", likes: 3, dislikes: 1 }];

    renderMap();

    expect(chart.setOption).toHaveBeenCalled();
  });

  it("hides the visual map legend when the section is collapsed", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.expandedChart = null;

    renderMap([{ countryCode: "US", likes: 1, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.visualMap.show).toBe(false);
  });

  it("shows the visual map legend when the section is expanded", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.expandedChart = "map";

    renderMap([{ countryCode: "US", likes: 1, dislikes: 0 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.visualMap.show).toBe(true);
  });

  it("renders the US state map when the United States is selected", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 10, dislikes: 4 }];
    analyticsState.latestSubdivisions = [
      { countryCode: "US", subdivisionCode: "CA", subdivisionName: "California", likes: 7, dislikes: 3 },
      { countryCode: "US", subdivisionCode: "TX", subdivisionName: "Texas", likes: 2, dislikes: 1 },
    ];

    renderMap();

    const initialOption = chart.setOption.mock.calls[0][0];
    expect(initialOption.geo.map).toBe("world");

    const clickHandler = chart.__listeners.click;
    expect(typeof clickHandler).toBe("function");
    clickHandler({ data: { code: "US" }, name: "United States of America" });

    const latestOption = chart.setOption.mock.calls[chart.setOption.mock.calls.length - 1][0];
    expect(latestOption.geo.map).toBe("usa-states");
    const regionNames = latestOption.series[0].data.map((entry) => entry.name);
    expect(regionNames).toContain("California");
    expect(regionNames).toContain("Texas");
    const resetButton = document.getElementById("ryd-analytics-map-reset");
    expect(resetButton.hidden).toBe(false);
    expect(analyticsState.mapView).toBe("subdivision");
    expect(analyticsState.mapFocusCountry).toBe("US");
  });

  it("returns to the world map when the reset button is clicked", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 3, dislikes: 1 }];
    analyticsState.latestSubdivisions = [
      { countryCode: "US", subdivisionCode: "CA", subdivisionName: "California", likes: 2, dislikes: 0 },
    ];
    analyticsState.mapView = "subdivision";
    analyticsState.mapFocusCountry = "US";

    renderMap();

    const resetButton = document.getElementById("ryd-analytics-map-reset");
    expect(resetButton.hidden).toBe(false);

    resetButton.click();

    const latestOption = chart.setOption.mock.calls[chart.setOption.mock.calls.length - 1][0];
    expect(latestOption.geo.map).toBe("world");
    expect(analyticsState.mapView).toBe("world");
    expect(resetButton.hidden).toBe(true);
  });

  it("falls back to the world map when no subdivisions are available", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "CA", countryName: "Canada", likes: 5, dislikes: 1 }];
    analyticsState.latestSubdivisions = [];
    analyticsState.mapView = "subdivision";
    analyticsState.mapFocusCountry = "US";

    renderMap();

    const option = chart.setOption.mock.calls[0][0];
    expect(option.geo.map).toBe("world");
    const resetButton = document.getElementById("ryd-analytics-map-reset");
    expect(resetButton.hidden).toBe(true);
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
