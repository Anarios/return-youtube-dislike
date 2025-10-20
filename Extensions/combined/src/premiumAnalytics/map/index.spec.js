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
  const polygon = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  };
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
    {
      iso2: "CD",
      iso3: "COD",
      country: "Democratic Republic of the Congo",
      officialName: "Democratic Republic of the Congo",
    },
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

jest.mock("../theme", () => ({
  getMutedTextColor: jest.fn(() => "#aaaaaa"),
  getBorderColor: jest.fn(() => "#bbbbbb"),
  getSurfaceColor: jest.fn(() => "rgba(0,0,0,0.04)"),
  getHoverFillColor: jest.fn(() => "rgba(0,0,0,0.18)"),
}));

import echarts from "echarts";
import { analyticsState } from "../state";
import {
  ensureMapChart,
  renderMap,
  disposeMapChart,
  clearMapChart,
  resizeMapChart,
  setMapTranslator,
  resetMapTranslator,
} from "./index";

const enMessages = require("../../../_locales/en/messages.json");

function getMessage(key, substitutions) {
  const entry = enMessages[key];
  if (!entry) return key;
  let message = entry.message ?? "";
  if (substitutions != null) {
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    values.forEach((value, index) => {
      const replacement = value != null ? `${value}` : "";
      message = message.replace(new RegExp(`\\$${index + 1}`, "g"), replacement);
    });
  }
  return message;
}

function setupI18nMock() {
  global.chrome = {
    i18n: {
      getMessage,
    },
  };
}

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
    setupI18nMock();
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
    setMapTranslator((key, substitutions) => getMessage(key, substitutions));
  });

  afterEach(() => {
    delete global.chrome;
    resetMapTranslator();
  });

  it("initializes the map chart when required", () => {
    const chart = ensureMapChart();
    expect(echarts.init).toHaveBeenCalled();
    expect(chart).toBe(analyticsState.mapChart);
  });

  it("renders processed map data for ratio mode", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
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

    expect(formatted).toContain(getMessage("premiumAnalytics_tooltipLikes", ["75"]));
    expect(formatted).toContain(getMessage("premiumAnalytics_tooltipDislikes", ["25"]));
    expect(formatted).toContain(getMessage("premiumAnalytics_tooltipRatio", ["75.0%"]));
  });

  it("normalizes United States naming differences", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    renderMap([{ countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 }]);

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

    renderMap([
      { countryCode: "CI", countryName: "Ivory Coast", likes: 2, dislikes: 1 },
      { countryCode: "SS", countryName: "South Sudan", likes: 3, dislikes: 0 },
    ]);

    const option = chart.setOption.mock.calls[0][0];
    const names = option.series[0].data.map((entry) => entry.name);
    expect(names).toContain("Côte d'Ivoire");
    expect(names).toContain("S. Sudan");
  });

  it("switches metric based on mode", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.currentMode = "likes";

    renderMap([{ countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].value).toBe(10);

    analyticsState.currentMode = "ratio";
    chart.setOption.mockClear();

    renderMap([{ countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 }]);

    const ratioOption = chart.setOption.mock.calls[0][0];
    expect(ratioOption.series[0].data[0].value).toBeCloseTo(10 / 15);
  });

  it("uses red palette for dislikes mode", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.currentMode = "dislikes";

    renderMap([{ countryCode: "US", countryName: "United States", likes: 10, dislikes: 5 }]);

    const option = chart.setOption.mock.calls[0][0];
    expect(option.series[0].data[0].value).toBe(5);
    expect(option.visualMap.inRange.color).toEqual(["#fecaca", "#b91c1c"]);
  });

  it("supports internal state dataset fallback", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 5, dislikes: 1 }];

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
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 5, dislikes: 2 }];
    analyticsState.latestSubdivisions = [
      { countryCode: "US", subdivisionCode: "CA", subdivisionName: "California", likes: 2, dislikes: 1 },
    ];

    renderMap();

    const initialOption = chart.setOption.mock.calls[0][0];
    expect(initialOption.geo.map).toBe("world");

    const clickHandler = chart.__listeners.click;
    clickHandler({ data: { code: "US" }, name: "United States" });

    const subdivisionOption = chart.setOption.mock.calls.at(-1)[0];
    expect(subdivisionOption.geo.map).toBe("usa-states");
    expect(subdivisionOption.geo.zoom).toBeCloseTo(2.35);
  });

  it("returns to the world map when the reset button is clicked", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 5, dislikes: 2 }];
    analyticsState.latestSubdivisions = [
      { countryCode: "US", subdivisionCode: "CA", subdivisionName: "California", likes: 2, dislikes: 1 },
    ];

    renderMap();

    const clickHandler = chart.__listeners.click;
    clickHandler({ data: { code: "US" }, name: "United States" });
    const resetButton = document.getElementById("ryd-analytics-map-reset");
    expect(resetButton.hidden).toBe(false);

    resetButton.click();
    const resetOption = chart.setOption.mock.calls.at(-1)[0];
    expect(resetOption.geo.map).toBe("world");
    expect(resetButton.hidden).toBe(true);
  });

  it("falls back to the world map when no subdivisions are available", () => {
    const chart = createChartStub();
    analyticsState.mapChart = chart;
    analyticsState.latestCountries = [{ countryCode: "US", countryName: "United States", likes: 5, dislikes: 2 }];
    analyticsState.latestSubdivisions = [];

    renderMap();

    const option = chart.setOption.mock.calls[0][0];
    expect(option.geo.map).toBe("world");
    const resetButton = document.getElementById("ryd-analytics-map-reset");
    expect(resetButton.hidden).toBe(true);
  });

  it("clears, resizes, and disposes the chart", () => {
    const chart = createChartStub();
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
