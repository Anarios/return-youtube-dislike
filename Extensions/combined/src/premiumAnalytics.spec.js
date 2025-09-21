/**
 * @jest-environment jsdom
 */

jest.mock("./config", () => ({
  __esModule: true,
  getApiEndpoint: jest.fn((path) => `https://api.example${path}`),
}));

jest.mock("./premiumAnalytics.panel", () => ({
  configurePanelCallbacks: jest.fn(),
  ensurePanel: jest.fn(() => ({})),
  updateRangeButtons: jest.fn(),
  updateModeButtons: jest.fn(),
  setListsLoading: jest.fn(),
  updateCountryList: jest.fn(),
  renderSummary: jest.fn(),
  setFooterMessage: jest.fn(),
  setLoadingState: jest.fn(),
  showPanel: jest.fn(),
  hidePanel: jest.fn(),
  togglePanel: jest.fn(),
}));

jest.mock("./premiumAnalytics.activity", () => ({
  renderActivityChart: jest.fn(),
  clearActivityChart: jest.fn(),
  resetChartZoom: jest.fn(),
  resizeActivityChart: jest.fn(),
  disposeActivityChart: jest.fn(),
}));

jest.mock("./premiumAnalytics.map", () => ({
  ensureMapChart: jest.fn(),
  renderMap: jest.fn(),
  clearMapChart: jest.fn(),
  resizeMapChart: jest.fn(),
  disposeMapChart: jest.fn(),
}));

jest.mock("./premiumAnalytics.utils", () => {
  const actual = jest.requireActual("./premiumAnalytics.utils");
  return {
    __esModule: true,
    ...actual,
    debounce: jest.fn((fn) => fn),
    safeJson: jest.fn(async () => ({ error: "membership_inactive" })),
    toEpoch: jest.fn(actual.toEpoch),
  };
});

jest.mock("./premiumAnalytics.logging", () => ({
  logFetchRequest: jest.fn(),
}));

const panelMocks = jest.requireMock("./premiumAnalytics.panel");
const activityMocks = jest.requireMock("./premiumAnalytics.activity");
const mapMocks = jest.requireMock("./premiumAnalytics.map");
const utilsMocks = jest.requireMock("./premiumAnalytics.utils");
const loggingMocks = jest.requireMock("./premiumAnalytics.logging");

const {
  configurePanelCallbacks: mockConfigurePanelCallbacks,
  ensurePanel: mockEnsurePanel,
  updateRangeButtons: mockUpdateRangeButtons,
  updateModeButtons: mockUpdateModeButtons,
  updateCountryList: mockUpdateCountryList,
  renderSummary: mockRenderSummary,
  setFooterMessage: mockSetFooterMessage,
  setLoadingState: mockSetLoadingState,
} = panelMocks;

const {
  renderActivityChart: mockRenderActivityChart,
  resetChartZoom: mockResetChartZoom,
  resizeActivityChart: mockResizeActivityChart,
  disposeActivityChart: mockDisposeActivityChart,
} = activityMocks;

const {
  ensureMapChart: mockEnsureMapChart,
  renderMap: mockRenderMap,
  resizeMapChart: mockResizeMapChart,
  disposeMapChart: mockDisposeMapChart,
} = mapMocks;

const {
  debounce: mockDebounce,
  safeJson: mockSafeJson,
  toEpoch: mockToEpoch,
} = utilsMocks;

const { logFetchRequest: mockLogFetchRequest } = loggingMocks;

jest.mock("./utils", () => ({
  getVideoId: jest.fn(() => "video1234567"),
}));

import { analyticsState, resetSessionState, resetStateForVideo } from "./premiumAnalytics.state";
import { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./premiumAnalytics";
const premiumAnalyticsModule = require("./premiumAnalytics");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("premiumAnalytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStateForVideo();
    resetSessionState();
    analyticsState.sessionToken = "token";
    analyticsState.sessionActive = true;
    analyticsState.currentRange = 7;
    analyticsState.currentVideoId = "video1234567";
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            timeSeries: {
              points: [],
              rangeStartUtc: "2025-01-01T00:00:00Z",
              rangeEndUtc: "2025-01-10T00:00:00Z",
              windowStartUtc: "2025-01-01T00:00:00Z",
              windowEndUtc: "2025-01-07T00:00:00Z",
            },
            geo: { topLikes: [], topDislikes: [], countries: [] },
            summary: {
              totalLikes: 10,
              totalDislikes: 5,
              uniqueIps: 3,
              countriesRepresented: 2,
              peakLikes: { timestampUtc: "2025-01-01T00:00:00Z", count: 5 },
              peakDislikes: { timestampUtc: "2025-01-01T01:00:00Z", count: 2 },
            },
          }),
      }),
    );
    mockEnsurePanel.mockReturnValue({
      querySelector: jest.fn(() => ({
        innerHTML: "",
        querySelector: jest.fn(),
      })),
    });
  });

  afterEach(() => {});

  it("initializes only once and wires listeners", () => {
    initPremiumAnalytics();
    expect(mockConfigurePanelCallbacks).toHaveBeenCalled();

    initPremiumAnalytics();
    expect(mockConfigurePanelCallbacks).toHaveBeenCalledTimes(1);
  });

  it("requests analytics and renders results", async () => {
    requestAnalytics();

    await flushPromises();

    expect(fetch).toHaveBeenCalled();
    expect(mockRenderActivityChart).toHaveBeenCalled();
    expect(mockUpdateCountryList).toHaveBeenCalled();
    expect(mockRenderSummary).toHaveBeenCalled();
    expect(mockSetLoadingState).toHaveBeenCalledWith(true);
    expect(mockSetLoadingState).toHaveBeenCalledWith(false);
    expect(mockToEpoch).toHaveBeenCalledWith("2025-01-01T00:00:00Z");
    expect(mockToEpoch).toHaveBeenCalledWith("2025-01-07T00:00:00Z");
  });

  it("handles error responses gracefully", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
      }),
    );

    requestAnalytics();
    await flushPromises();

    expect(mockSetFooterMessage).toHaveBeenCalledWith(
      "Premium analytics are available for active Patreon supporters.",
    );
    expect(mockSetLoadingState).toHaveBeenCalledWith(true);
    expect(mockSetLoadingState).toHaveBeenCalledWith(false);
  });

  it("tears down listeners and disposes charts", () => {
    initPremiumAnalytics();
    teardownPremiumAnalytics();

    expect(mockDisposeActivityChart).toHaveBeenCalled();
    expect(mockDisposeMapChart).toHaveBeenCalled();
    expect(analyticsState.initialized).toBe(false);
  });

  it("updates session state and triggers refresh", async () => {
    const initialFetchCalls = global.fetch.mock.calls.length;

    updatePremiumSession({ token: "new", active: true });
    await flushPromises();

    expect(analyticsState.sessionToken).toBe("new");
    expect(global.fetch.mock.calls.length).toBeGreaterThan(initialFetchCalls);
    expect(mockSetLoadingState).toHaveBeenCalledWith(true);

    updatePremiumSession({ token: null, active: false });
    expect(mockDisposeActivityChart).toHaveBeenCalled();
    expect(mockSetLoadingState).toHaveBeenCalledWith(false);
  });

  it("avoids duplicate fetch when session details unchanged", async () => {
    const initialFetchCalls = global.fetch.mock.calls.length;

    updatePremiumSession({ token: analyticsState.sessionToken, active: true });
    await flushPromises();

    expect(global.fetch.mock.calls.length).toBe(initialFetchCalls);
  });

  it("sends the selected range in days without explicit timestamps", async () => {
    analyticsState.currentRange = 30;

    requestAnalytics();

    await flushPromises();

    expect(mockLogFetchRequest).toHaveBeenCalled();
    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("30");
    expect(params.has("fromUtc")).toBe(false);
    expect(params.has("toUtc")).toBe(false);
  });

  it("supports all-time range by passing zero days", async () => {
    analyticsState.currentRange = 0;

    requestAnalytics();

    await flushPromises();

    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("0");
  });

  it("reuses existing session data when refreshing analytics", async () => {
    requestAnalytics();
    await flushPromises();
    const firstUrl = fetch.mock.calls[0][0];

    requestAnalytics();
    await flushPromises();

    const secondUrl = fetch.mock.calls[fetch.mock.calls.length - 1][0];
    expect(firstUrl).toBe(secondUrl);
  });
});
