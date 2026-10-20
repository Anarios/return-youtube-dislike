/**
 * @jest-environment jsdom
 */

jest.mock("../config", () => ({
  __esModule: true,
  getApiEndpoint: jest.fn((path) => `https://api.example${path}`),
}));

jest.mock("../data-collection-permissions", () => ({
  hasAuthenticationDataPermission: jest.fn(),
  onAuthenticationDataPermissionRemoved: () => () => {},
  usesFirefoxDataCollectionConsent: jest.fn(),
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
  applyPanelView: jest.fn(),
  setPanelExpanded: jest.fn(),
}));

jest.mock("./rawCounts", () => ({
  loadRawCounts: jest.fn(),
  resetRawCounts: jest.fn(),
}));

jest.mock("./activity", () => ({
  renderActivityChart: jest.fn(),
  clearActivityChart: jest.fn(),
  resetChartZoom: jest.fn(),
  resizeActivityChart: jest.fn(),
  refreshActivityTheme: jest.fn(),
  disposeActivityChart: jest.fn(),
  registerZoomSelectionListener: jest.fn(),
}));

jest.mock("./map", () => ({
  ensureMapChart: jest.fn(),
  renderMap: jest.fn(),
  refreshMapTheme: jest.fn(),
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
const { hasAuthenticationDataPermission: mockHasAuthenticationDataPermission } = jest.requireMock(
  "../data-collection-permissions",
);
const { usesFirefoxDataCollectionConsent: mockUsesFirefoxDataCollectionConsent } = jest.requireMock(
  "../data-collection-permissions",
);

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
const { setTeaserSuppressed: mockSetTeaserSuppressed, TEASER_SUPPRESSION_REASON_PREMIUM } =
  jest.requireMock("./teaser");
const { showTierNotice: mockShowTierNotice, hideTierNotice: mockHideTierNotice } = jest.requireMock("./tierNotice");

jest.mock("../utils", () => {
  const actual = jest.requireActual("../utils");
  return {
    ...actual,
    getVideoId: jest.fn(() => "video1234567"),
  };
});

import { analyticsState, resetSessionState, resetStateForVideo } from "./state";
import { initPremiumAnalytics, requestAnalytics, teardownPremiumAnalytics, updatePremiumSession } from "./index";
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
    mockHasAuthenticationDataPermission.mockResolvedValue(true);
    mockUsesFirefoxDataCollectionConsent.mockReturnValue(false);
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
    analyticsState.panelView = "full";
    analyticsState.panelDismissed = false;
    global.chrome = {
      runtime: {},
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
    teardownPremiumAnalytics();
    document.documentElement.removeAttribute("dark");
    delete global.fetch;
    delete global.chrome;
  });

  it("persists display changes, closes enlarged charts, and resizes on reopening", () => {
    const set = jest.fn();
    chrome.storage = { sync: { set } };
    initPremiumAnalytics();
    const { onPanelViewChange } = mockConfigurePanelCallbacks.mock.calls.at(-1)[0];
    analyticsState.expandedChart = "map";
    onPanelViewChange("raw");
    expect(analyticsState.panelView).toBe("raw");
    expect(analyticsState.expandedChart).toBeNull();
    expect(panelMocks.setPanelExpanded).toHaveBeenCalledWith(false);
    expect(set).toHaveBeenLastCalledWith({ premiumAnalyticsView: "raw" });
    onPanelViewChange("hidden");
    expect(analyticsState.panelView).toBe("hidden");
    expect(analyticsState.panelDismissed).toBe(false);
    expect(set).toHaveBeenLastCalledWith({ premiumAnalyticsView: "hidden" });
    mockResizeActivityChart.mockClear();
    mockResizeMapChart.mockClear();
    onPanelViewChange("full");
    expect(mockResizeActivityChart).toHaveBeenCalledTimes(1);
    expect(mockResizeMapChart).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenLastCalledWith({ premiumAnalyticsView: "full" });
  });

  it("restores and synchronizes the display preference without overwriting a newer click", () => {
    let storageCallback;
    let storageListener;
    const removeListener = jest.fn();
    chrome.storage = {
      sync: {
        get: jest.fn((keys, callback) => {
          storageCallback = callback;
        }),
        set: jest.fn(),
      },
      onChanged: {
        addListener: jest.fn((listener) => {
          storageListener = listener;
        }),
        removeListener,
      },
    };
    initPremiumAnalytics();
    storageCallback({ premiumAnalyticsView: "raw" });
    expect(analyticsState.panelView).toBe("raw");
    const { onPanelViewChange } = mockConfigurePanelCallbacks.mock.calls.at(-1)[0];
    onPanelViewChange("full");
    storageCallback({ premiumAnalyticsView: "raw" });
    expect(analyticsState.panelView).toBe("full");
    storageListener({ premiumAnalyticsView: { newValue: "raw" } }, "sync");
    expect(analyticsState.panelView).toBe("raw");
    storageListener({ hidePremiumTeaser: { newValue: true } }, "sync");
    expect(analyticsState.panelView).toBe("raw");
    expect(analyticsState.panelDismissed).toBe(true);
    storageListener({ premiumAnalyticsView: { newValue: "full" } }, "sync");
    expect(analyticsState.panelView).toBe("full");
    expect(analyticsState.panelDismissed).toBe(true);
    storageListener({ hidePremiumTeaser: { newValue: false } }, "sync");
    expect(analyticsState.panelView).toBe("full");
    expect(analyticsState.panelDismissed).toBe(false);
    storageListener({ premiumAnalyticsView: { newValue: "raw" } }, "sync");
    resetStateForVideo();
    expect(analyticsState.panelView).toBe("raw");
    teardownPremiumAnalytics();
    expect(removeListener).toHaveBeenCalledWith(storageListener);
    storageCallback({ premiumAnalyticsView: "full" });
    expect(analyticsState.panelView).toBe("raw");
  });

  it.each(["raw", "hidden"])("restores a saved dismissed panel in its %s view from the popup setting", (view) => {
    let listener;
    chrome.storage = {
      sync: { get: jest.fn((keys, callback) => callback({ premiumAnalyticsView: view, hidePremiumTeaser: true })) },
      onChanged: {
        addListener: jest.fn((callback) => {
          listener = callback;
        }),
        removeListener: jest.fn(),
      },
    };
    initPremiumAnalytics();
    expect(analyticsState.panelView).toBe(view);
    expect(analyticsState.panelDismissed).toBe(true);
    listener({ hidePremiumTeaser: { newValue: false } }, "sync");
    expect(analyticsState.panelView).toBe(view);
    expect(analyticsState.panelDismissed).toBe(false);
  });

  it("dismisses a header-only panel through the shared setting without losing its display mode", () => {
    let initialRead;
    let listener;
    const set = jest.fn();
    chrome.storage = {
      sync: {
        get: jest.fn((keys, callback) => {
          initialRead = callback;
        }),
        set,
      },
      onChanged: {
        addListener: jest.fn((callback) => {
          listener = callback;
        }),
        removeListener: jest.fn(),
      },
    };
    initPremiumAnalytics();
    const { onPanelViewChange, onPanelDismiss } = mockConfigurePanelCallbacks.mock.calls.at(-1)[0];
    onPanelViewChange("hidden");
    expect(analyticsState.panelView).toBe("hidden");
    expect(analyticsState.panelDismissed).toBe(false);
    onPanelDismiss();
    expect(set).toHaveBeenLastCalledWith({ hidePremiumTeaser: true });
    expect(analyticsState.panelDismissed).toBe(true);
    initialRead({ premiumAnalyticsView: "full", hidePremiumTeaser: false });
    resetStateForVideo();
    expect(analyticsState.panelView).toBe("hidden");
    expect(analyticsState.panelDismissed).toBe(true);
    listener({ hidePremiumTeaser: { newValue: false } }, "sync");
    expect(analyticsState.panelView).toBe("hidden");
    expect(analyticsState.panelDismissed).toBe(false);
    onPanelViewChange("full");
    expect(analyticsState.panelView).toBe("full");
    expect(analyticsState.panelDismissed).toBe(false);
  });

  it("applies saved dismissal even when a view click wins the initial storage race", () => {
    let initialRead;
    chrome.storage = {
      sync: {
        get: jest.fn((keys, callback) => {
          initialRead = callback;
        }),
        set: jest.fn(),
      },
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
    };
    initPremiumAnalytics();
    const { onPanelViewChange } = mockConfigurePanelCallbacks.mock.calls.at(-1)[0];
    onPanelViewChange("raw");
    initialRead({ premiumAnalyticsView: "full", hidePremiumTeaser: true });
    expect(analyticsState.panelView).toBe("raw");
    expect(analyticsState.panelDismissed).toBe(true);
    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith({ premiumAnalyticsView: "raw" });
  });

  it("repaints existing charts after a host theme toggle without fetching or changing the selected range", async () => {
    document.documentElement.removeAttribute("dark");
    initPremiumAnalytics();
    await flushPromises();
    analyticsState.selectionRange = { from: 10, to: 20 };
    analyticsState.mapView = "us";
    fetch.mockClear();
    activityMocks.refreshActivityTheme.mockClear();
    mapMocks.refreshMapTheme.mockClear();
    mockRenderMap.mockClear();
    document.documentElement.setAttribute("dark", "");
    await flushPromises();
    expect(activityMocks.refreshActivityTheme).toHaveBeenCalledTimes(1);
    expect(mapMocks.refreshMapTheme).toHaveBeenCalledTimes(1);
    expect(mockRenderMap).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(analyticsState.selectionRange).toEqual({ from: 10, to: 20 });
    expect(analyticsState.mapView).toBe("us");
    teardownPremiumAnalytics();
    document.documentElement.removeAttribute("dark");
    await flushPromises();
    expect(activityMocks.refreshActivityTheme).toHaveBeenCalledTimes(1);
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

  it("does not use a cached analytics token after authentication consent is removed", async () => {
    mockUsesFirefoxDataCollectionConsent.mockReturnValueOnce(true);
    mockHasAuthenticationDataPermission.mockResolvedValueOnce(false);

    await requestAnalytics();

    expect(fetch).not.toHaveBeenCalled();
    expect(analyticsState.sessionToken).toBeNull();
    expect(analyticsState.sessionActive).toBe(false);
  });

  it.each([[], undefined])("does not send a bearer token without an explicit Firefox grant: %j", async (granted) => {
    const actualConsent = jest.requireActual("../data-collection-permissions");
    chrome.runtime = { getManifest: () => require("../../manifest-firefox.json") };
    chrome.permissions = {
      contains: jest.fn().mockResolvedValue(true),
      getAll: jest.fn().mockResolvedValue({ permissions: ["identity"], data_collection: granted }),
    };
    mockUsesFirefoxDataCollectionConsent.mockImplementationOnce(actualConsent.usesFirefoxDataCollectionConsent);
    mockHasAuthenticationDataPermission.mockImplementationOnce(actualConsent.hasAuthenticationDataPermission);

    await requestAnalytics();

    expect(fetch).not.toHaveBeenCalled();
    expect(analyticsState.sessionToken).toBeNull();
    expect(analyticsState.sessionActive).toBe(false);
  });

  it("ignores an analytics response from a session that was signed out", async () => {
    let completeRequest;
    const response = await fetch();
    fetch.mockClear();
    fetch.mockReturnValueOnce(new Promise((resolve) => (completeRequest = resolve)));
    requestAnalytics();
    updatePremiumSession({ token: null, active: false });
    completeRequest(response);
    await flushPromises();
    expect(mockRenderActivityChart).not.toHaveBeenCalled();
    expect(mockRenderSummary).not.toHaveBeenCalled();
  });

  it("does not render a previous account response after a new account requests the same range", async () => {
    let completeOldRequest;
    const response = await fetch();
    fetch.mockClear();
    fetch.mockReturnValueOnce(new Promise((resolve) => (completeOldRequest = resolve)));
    requestAnalytics();
    updatePremiumSession({ token: "new-account-token", active: true, membershipTier: "premium" });
    await flushPromises();
    const renderCount = mockRenderSummary.mock.calls.length;
    completeOldRequest(response);
    await flushPromises();
    expect(mockRenderSummary).toHaveBeenCalledTimes(renderCount);
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

  it("restores a preset when a custom selection rounds to the same number of days", async () => {
    mockGetApiEndpoint.mockImplementation((path) => `https://api.example${path}`);
    initPremiumAnalytics();
    const callbacks = mockConfigurePanelCallbacks.mock.calls.at(-1)[0];
    analyticsState.currentVideoId = "abcdefghijk";
    analyticsState.currentRange = 30;
    analyticsState.usingCustomRange = true;
    analyticsState.customSelection = { from: 10, to: 20 };
    analyticsState.selectionRange = { from: 10, to: 20 };
    fetch.mockClear();

    callbacks.onRangePreset(30);

    expect(analyticsState.usingCustomRange).toBe(false);
    expect(analyticsState.customSelection).toBeNull();
    expect(analyticsState.selectionRange).toEqual({ from: null, to: null });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.has("selectedRangeStartUtc")).toBe(false);
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
