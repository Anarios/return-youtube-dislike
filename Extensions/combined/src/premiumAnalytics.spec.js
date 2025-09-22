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
  applyChartExpansionState: jest.fn(),
}));

jest.mock("./premiumAnalytics.activity", () => ({
  renderActivityChart: jest.fn(),
  clearActivityChart: jest.fn(),
  resetChartZoom: jest.fn(),
  resizeActivityChart: jest.fn(),
  disposeActivityChart: jest.fn(),
  registerZoomSelectionListener: jest.fn(),
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
const configMocks = jest.requireMock("./config");

const {
  configurePanelCallbacks: mockConfigurePanelCallbacks,
  ensurePanel: mockEnsurePanel,
  updateRangeButtons: mockUpdateRangeButtons,
  updateModeButtons: mockUpdateModeButtons,
  updateCountryList: mockUpdateCountryList,
  renderSummary: mockRenderSummary,
  setFooterMessage: mockSetFooterMessage,
  setLoadingState: mockSetLoadingState,
  applyChartExpansionState: mockApplyChartExpansionState,
} = panelMocks;

const {
  renderActivityChart: mockRenderActivityChart,
  resetChartZoom: mockResetChartZoom,
  resizeActivityChart: mockResizeActivityChart,
  disposeActivityChart: mockDisposeActivityChart,
  registerZoomSelectionListener: mockRegisterZoomSelectionListener,
} = activityMocks;

const {
  ensureMapChart: mockEnsureMapChart,
  renderMap: mockRenderMap,
  resizeMapChart: mockResizeMapChart,
  disposeMapChart: mockDisposeMapChart,
} = mapMocks;

const { debounce: mockDebounce, safeJson: mockSafeJson, toEpoch: mockToEpoch } = utilsMocks;

const { logFetchRequest: mockLogFetchRequest } = loggingMocks;
const { getApiEndpoint: mockGetApiEndpoint } = configMocks;

jest.mock("./utils", () => ({
  getVideoId: jest.fn(() => "video1234567"),
}));

import { analyticsState, resetSessionState, resetStateForVideo } from "./premiumAnalytics.state";
import {
  initPremiumAnalytics,
  requestAnalytics,
  teardownPremiumAnalytics,
  updatePremiumSession,
} from "./premiumAnalytics";
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
    analyticsState.zoomListenerRegistered = false;
    analyticsState.initialized = false;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            timeSeries: {
              points: [],
              totalRangeStartUtc: "2025-01-01T00:00:00Z",
              totalRangeEndUtc: "2025-01-10T00:00:00Z",
              selectedRangeStartUtc: "2025-01-01T00:00:00Z",
              selectedRangeEndUtc: "2025-01-07T00:00:00Z",
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
    expect(mockRegisterZoomSelectionListener).toHaveBeenCalledTimes(1);
    const listener = mockRegisterZoomSelectionListener.mock.calls.at(-1)?.[0];
    expect(typeof listener).toBe("function");

    const callbacks = mockConfigurePanelCallbacks.mock.calls.at(-1)?.[0];
    expect(typeof callbacks?.onChartExpand).toBe("function");

    initPremiumAnalytics();
    expect(mockConfigurePanelCallbacks).toHaveBeenCalledTimes(1);
    expect(mockRegisterZoomSelectionListener).toHaveBeenCalledTimes(1);
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

    expect(mockSetFooterMessage).toHaveBeenCalledWith("Premium analytics are available for active Patreon supporters.");
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
    expect(params.has("selectedRangeStartUtc")).toBe(false);
    expect(params.has("selectedRangeEndUtc")).toBe(false);
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

  it("defers chart zoom resets until preset data arrives", () => {
    initPremiumAnalytics();
    const callbacks = mockConfigurePanelCallbacks.mock.calls.at(-1)?.[0];
    expect(typeof callbacks?.onRangePreset).toBe("function");

    mockResetChartZoom.mockClear();
    analyticsState.currentRange = 30;

    callbacks.onRangePreset(7);

    expect(mockResetChartZoom).not.toHaveBeenCalled();
  });

  it("toggles chart expansion via callback", () => {
    initPremiumAnalytics();
    const callbacks = mockConfigurePanelCallbacks.mock.calls.at(-1)?.[0];
    const expand = callbacks.onChartExpand;

    analyticsState.latestCountries = [{ countryCode: "US", likes: 10, dislikes: 4 }];

    mockApplyChartExpansionState.mockClear();
    mockResizeActivityChart.mockClear();
    mockResizeMapChart.mockClear();
    mockRenderMap.mockClear();

    expand("activity");
    expect(analyticsState.expandedChart).toBe("activity");
    expect(mockApplyChartExpansionState).toHaveBeenCalled();
    expect(mockResizeActivityChart).toHaveBeenCalledTimes(1);
    expect(mockResizeMapChart).not.toHaveBeenCalled();
    expect(mockRenderMap).not.toHaveBeenCalled();

    mockApplyChartExpansionState.mockClear();
    expand("map");
    expect(analyticsState.expandedChart).toBe("map");
    expect(mockResizeMapChart).toHaveBeenCalledTimes(1);
    expect(mockResizeActivityChart).toHaveBeenCalledTimes(2);
    expect(mockRenderMap).toHaveBeenCalledTimes(1);

    mockRenderMap.mockClear();
    expand("map");
    expect(analyticsState.expandedChart).toBeNull();
    expect(mockRenderMap).toHaveBeenCalledTimes(1);

    mockRenderMap.mockClear();
    expand("lists");
    expect(analyticsState.expandedChart).toBe("lists");
    expect(mockRenderMap).not.toHaveBeenCalled();
  });

  it("re-renders map when switching modes", () => {
    initPremiumAnalytics();
    const callbacks = mockConfigurePanelCallbacks.mock.calls.at(-1)?.[0];
    const expand = callbacks.onChartExpand;
    const changeMode = callbacks.onModeChange;

    analyticsState.latestCountries = [{ countryCode: "US", likes: 10, dislikes: 4 }];
    analyticsState.currentMode = "ratio";

    expand("map");
    mockRenderMap.mockClear();

    ["likes", "dislikes", "ratio"].forEach((mode) => {
      expect(() => changeMode(mode)).not.toThrow();
      expect(analyticsState.currentMode).toBe(mode);
      expect(mockRenderMap).toHaveBeenCalledTimes(1);
      mockRenderMap.mockClear();
    });
  });

  it("refetches analytics when zoom selection changes", async () => {
    initPremiumAnalytics();
    requestAnalytics();
    await flushPromises();

    const previousKey = analyticsState.activeRequestKey;

    const from = Date.UTC(2025, 0, 2);
    const to = Date.UTC(2025, 0, 5);
    analyticsState.sessionActive = true;
    analyticsState.sessionToken = "token";
    analyticsState.currentVideoId = "video1234567";
    const initialApiCalls = mockGetApiEndpoint.mock.calls.length;

    requestAnalytics({ selection: { from, to } });
    await flushPromises();

    expect(mockGetApiEndpoint.mock.calls.length).toBeGreaterThan(initialApiCalls);
    const lastCall = mockGetApiEndpoint.mock.calls.at(-1)?.[0];
    expect(lastCall).toContain(encodeURIComponent(new Date(from).toISOString()));
    expect(lastCall).toContain(encodeURIComponent(new Date(to).toISOString()));
    expect(analyticsState.activeRequestKey).not.toBe(previousKey);
    expect(analyticsState.activeRequestKey).toContain(new Date(from).toISOString());
  });
});
