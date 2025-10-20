/**
 * @jest-environment jsdom
 */

jest.mock("../config", () => ({
  __esModule: true,
  getApiEndpoint: jest.fn((path) => `https://api.example${path}`),
}));

jest.mock("./panel", () => ({
  configurePanelCallbacks: jest.fn(),
  ensurePanel: jest.fn(() => ({})),
  updateRangeButtons: jest.fn(),
  updateRangeAnchorButtons: jest.fn(),
  updateModeButtons: jest.fn(),
  setListsLoading: jest.fn(),
  renderSummary: jest.fn(),
  setFooterMessage: jest.fn(),
  setLoadingState: jest.fn(),
  showPanel: jest.fn(),
  hidePanel: jest.fn(),
  togglePanel: jest.fn(),
  applyChartExpansionState: jest.fn(),
}));

jest.mock("./activity", () => ({
  renderActivityChart: jest.fn(),
  clearActivityChart: jest.fn(),
  resetChartZoom: jest.fn(),
  resizeActivityChart: jest.fn(),
  disposeActivityChart: jest.fn(),
  registerZoomSelectionListener: jest.fn(),
}));

jest.mock("./map", () => ({
  ensureMapChart: jest.fn(),
  renderMap: jest.fn(),
  clearMapChart: jest.fn(),
  resizeMapChart: jest.fn(),
  disposeMapChart: jest.fn(),
}));

jest.mock("./lists", () => ({
  updateCountryList: jest.fn(),
}));

jest.mock("./teaser", () => ({
  setTeaserSuppressed: jest.fn(),
  TEASER_SUPPRESSION_REASON_PREMIUM: "premium",
}));

jest.mock("./tierNotice", () => ({
  showTierNotice: jest.fn(),
  hideTierNotice: jest.fn(),
}));

jest.mock("./utils", () => {
  const actual = jest.requireActual("./utils");
  return {
    __esModule: true,
    ...actual,
    debounce: jest.fn((fn) => fn),
    safeJson: jest.fn(async () => ({ error: "membership_inactive" })),
    toEpoch: jest.fn(actual.toEpoch),
  };
});

jest.mock("./logging", () => ({
  logFetchRequest: jest.fn(),
}));

const panelMocks = jest.requireMock("./panel");
const activityMocks = jest.requireMock("./activity");
const mapMocks = jest.requireMock("./map");
const listsMocks = jest.requireMock("./lists");
const utilsMocks = jest.requireMock("./utils");
const loggingMocks = jest.requireMock("./logging");
const configMocks = jest.requireMock("../config");

const {
  configurePanelCallbacks: mockConfigurePanelCallbacks,
  ensurePanel: mockEnsurePanel,
  updateRangeButtons: mockUpdateRangeButtons,
  updateModeButtons: mockUpdateModeButtons,
  renderSummary: mockRenderSummary,
  setFooterMessage: mockSetFooterMessage,
  setLoadingState: mockSetLoadingState,
  applyChartExpansionState: mockApplyChartExpansionState,
} = panelMocks;

const { updateCountryList: mockUpdateCountryList } = listsMocks;

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
const {
  setTeaserSuppressed: mockSetTeaserSuppressed,
  TEASER_SUPPRESSION_REASON_PREMIUM,
} = jest.requireMock("./teaser");
const { showTierNotice: mockShowTierNotice, hideTierNotice: mockHideTierNotice } = jest.requireMock("./tierNotice");

jest.mock("../utils", () => {
  const actual = jest.requireActual("../utils");
  return {
    ...actual,
    getVideoId: jest.fn(() => "video1234567"),
  };
});

import { analyticsState, resetSessionState, resetStateForVideo } from "./state";
import {
  initPremiumAnalytics,
  requestAnalytics,
  teardownPremiumAnalytics,
  updatePremiumSession,
} from "./index";
const premiumAnalyticsModule = require("./index");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const enMessages = require("../../_locales/en/messages.json");

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

describe("premiumAnalytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStateForVideo();
    resetSessionState();
    analyticsState.sessionToken = "token";
    analyticsState.sessionActive = true;
    analyticsState.membershipTier = "premium";
    analyticsState.currentRange = 7;
    analyticsState.rangeAnchor = "first";
    analyticsState.currentVideoId = "video1234567";
    analyticsState.zoomListenerRegistered = false;
    analyticsState.initialized = false;
    global.chrome = {
      i18n: {
        getMessage,
      },
    };
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

  afterEach(() => {
    delete global.fetch;
    delete global.chrome;
  });

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

    expect(mockSetFooterMessage).toHaveBeenCalledWith(getMessage("premiumAnalytics_errorInactive"));
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

    updatePremiumSession({ token: "new", active: true, membershipTier: "premium" });
    await flushPromises();

    expect(analyticsState.sessionToken).toBe("new");
    expect(global.fetch.mock.calls.length).toBeGreaterThan(initialFetchCalls);
    expect(mockSetLoadingState).toHaveBeenCalledWith(true);
    expect(mockSetTeaserSuppressed).toHaveBeenCalledWith(true, TEASER_SUPPRESSION_REASON_PREMIUM);
    expect(mockHideTierNotice).toHaveBeenCalled();

    updatePremiumSession({ token: null, active: false });
    expect(mockDisposeActivityChart).toHaveBeenCalled();
    expect(mockSetLoadingState).toHaveBeenCalledWith(false);
    expect(mockSetTeaserSuppressed).toHaveBeenCalledWith(false, TEASER_SUPPRESSION_REASON_PREMIUM);
    expect(mockHideTierNotice).toHaveBeenCalled();
  });

  it("avoids duplicate fetch when session details unchanged", async () => {
    const initialFetchCalls = global.fetch.mock.calls.length;

    updatePremiumSession({ token: analyticsState.sessionToken, active: true, membershipTier: "premium" });
    await flushPromises();

    expect(global.fetch.mock.calls.length).toBe(initialFetchCalls);
  });

  it("shows tier notice when membership is not premium", () => {
    updatePremiumSession({ token: "token", active: true, membershipTier: "supporter" });

    expect(mockShowTierNotice).toHaveBeenCalled();
    expect(mockEnsurePanel).not.toHaveBeenCalled();
    expect(mockSetTeaserSuppressed).toHaveBeenCalledWith(true, TEASER_SUPPRESSION_REASON_PREMIUM);
  });

  it("sends the selected range in days without explicit timestamps", async () => {
    analyticsState.currentRange = 30;

    requestAnalytics();

    await flushPromises();

    expect(mockLogFetchRequest).toHaveBeenCalled();
    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("30");
    expect(params.get("rangeAnchor")).toBe("first");
    expect(params.has("selectedRangeStartUtc")).toBe(false);
    expect(params.has("selectedRangeEndUtc")).toBe(false);
  });

  it("supports all-time range by passing zero days", async () => {
    analyticsState.currentRange = 0;

    requestAnalytics();

    await flushPromises();

    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("0");
    expect(params.get("rangeAnchor")).toBe("first");
  });

  it("includes the selected range anchor when requesting presets", async () => {
    analyticsState.currentRange = 90;
    analyticsState.rangeAnchor = "last";

    requestAnalytics();

    await flushPromises();

    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("90");
    expect(params.get("rangeAnchor")).toBe("last");
  });

  it("keeps the all-time preset anchored to the full history", async () => {
    analyticsState.currentRange = 0;
    analyticsState.rangeAnchor = "first";
    mockLogFetchRequest.mockClear();

    const longRangeResponse = {
      timeSeries: {
        points: [],
        totalRangeStartUtc: "2024-01-01T00:00:00Z",
        totalRangeEndUtc: "2024-12-31T00:00:00Z",
        selectedRangeStartUtc: "2024-01-01T00:00:00Z",
        selectedRangeEndUtc: "2024-12-31T00:00:00Z",
      },
      geo: { topLikes: [], topDislikes: [], countries: [], subdivisions: [] },
      summary: {
        totalLikes: 0,
        totalDislikes: 0,
        uniqueIps: 0,
        countriesRepresented: 0,
        peakLikes: { timestampUtc: "2024-01-01T00:00:00Z", count: 0 },
        peakDislikes: { timestampUtc: "2024-01-01T00:00:00Z", count: 0 },
      },
    };

    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(longRangeResponse),
      }),
    );

    requestAnalytics();
    await flushPromises();

    expect(analyticsState.currentRange).toBe(0);

    mockLogFetchRequest.mockClear();
    analyticsState.rangeAnchor = "last";

    requestAnalytics();
    await flushPromises();

    expect(analyticsState.currentRange).toBe(0);
    expect(mockLogFetchRequest).toHaveBeenCalled();
    const [, params] = mockLogFetchRequest.mock.calls.at(-1);
    expect(params.get("rangeDays")).toBe("0");
    expect(params.get("rangeAnchor")).toBe("last");
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
