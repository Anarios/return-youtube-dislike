import { getApiEndpoint } from "../config";
import { fetchWithAccountConsent } from "../account-data-consent";
import { analyticsState, COUNTRY_LIMIT } from "./state";
import { ensurePanel, updateRangeButtons, updateRangeAnchorButtons, setFooterMessage, setLoadingState } from "./panel";
import { safeJson } from "./utils";
import { logFetchRequest } from "./logging";
import { localize } from "../utils";
import { hasAuthenticationDataPermission, usesFirefoxDataCollectionConsent } from "../data-collection-permissions";

import { MS_PER_DAY } from "./constants";
import { renderAnalytics } from "./render";

const HOURLY_THRESHOLD_DAYS = 7;
const HOURLY_THRESHOLD_MS = HOURLY_THRESHOLD_DAYS * MS_PER_DAY;
const MS_PER_HOUR = 60 * 60 * 1000;
const SELECTION_FETCH_DELAY_MS = 400;
const DEFAULT_BUSY_RETRY_SECONDS = 3;
const MAX_BUSY_RETRY_SECONDS = 60;
let currentRequest = null;

function cancelAnalyticsRequests() {
  const request = currentRequest;
  currentRequest = null;
  clearTimeout(request?.timer);
  request?.controller?.abort();
}

function requestAnalytics({ selection } = {}, delay = 0) {
  cancelAnalyticsRequests();
  const state = analyticsState;
  const { currentVideoId, sessionToken, sessionActive, membershipTier } = state;
  if (!currentVideoId || !sessionToken || !sessionActive || membershipTier !== "premium") {
    clearLoadingMessage();
    return;
  }

  const request = {
    sessionToken,
    controller: null,
    timer: null,
  };
  currentRequest = request;
  const isCurrentRequest = () =>
    currentRequest === request &&
    state.currentVideoId === currentVideoId &&
    state.sessionToken === sessionToken &&
    state.sessionActive &&
    state.membershipTier === "premium";

  const startRequest = (granted) => {
    if (!isCurrentRequest()) return;
    if (!granted) {
      currentRequest = null;
      state.sessionToken = null;
      state.sessionActive = false;
      clearLoadingMessage();
      return;
    }

    requestAnalyticsWithConsent(selection, request, isCurrentRequest);
  };

  const checkConsent = () => {
    if (!isCurrentRequest()) return;
    if (!usesFirefoxDataCollectionConsent()) return startRequest(true);
    return hasAuthenticationDataPermission().then(startRequest);
  };

  if (delay) {
    scheduleRequest(request, checkConsent, delay);
    return;
  }
  return checkConsent();
}

function requestAnalyticsWithConsent(selection, request, isCurrentRequest) {
  const state = analyticsState;

  ensurePanel();
  setFooterMessage(localize("premiumAnalytics_loading"));
  setLoadingState(true);
  updateRangeButtons();
  updateRangeAnchorButtons();

  const effectiveSelection = normalizeSelection(selection ?? state.customSelection);
  const bucket = resolveBucket(effectiveSelection, state.currentRange);
  const rangeAnchor = resolveAnchor();
  state.rangeAnchor = rangeAnchor;

  const params = new URLSearchParams();
  params.set("bucket", bucket);
  params.set("countryLimit", `${COUNTRY_LIMIT}`);

  if (effectiveSelection) {
    const startIso = msToIso(effectiveSelection.from);
    const endIso = msToIso(effectiveSelection.to);
    if (startIso && endIso) {
      params.set("selectedRangeStartUtc", startIso);
      params.set("selectedRangeEndUtc", endIso);
      state.usingCustomRange = true;
      state.currentRange = Math.max(0, Math.round((effectiveSelection.to - effectiveSelection.from) / MS_PER_DAY));
      state.customSelection = { ...effectiveSelection };
      state.selectionRange = { ...effectiveSelection };
    } else {
      params.set("rangeDays", `${state.currentRange}`);
      params.set("rangeAnchor", rangeAnchor);
      state.usingCustomRange = false;
      state.customSelection = null;
    }
  } else {
    params.set("rangeDays", `${state.currentRange}`);
    params.set("rangeAnchor", rangeAnchor);
    state.usingCustomRange = false;
    state.customSelection = null;
  }

  state.pendingSelection = effectiveSelection || null;
  state.latestBucketMs = bucket === "hour" ? MS_PER_HOUR : MS_PER_DAY;

  logFetchRequest(state.currentVideoId, params);

  const url = getApiEndpoint(`/api/patreon/analytics/video/${state.currentVideoId}?${params.toString()}`);
  fetchAnalytics(url, request, isCurrentRequest);
}

function fetchAnalytics(url, request, isCurrentRequest, retryOnBusy = true) {
  request.controller = new AbortController();

  fetchWithAccountConsent(url, {
    headers: {
      Authorization: `Bearer ${request.sessionToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    signal: request.controller.signal,
  })
    .then(async (response) => {
      if (!isCurrentRequest()) return null;
      if (!response.ok) {
        const payload = await safeJson(response);
        if (!isCurrentRequest()) return null;
        if (retryOnBusy && response.status === 429 && payload?.error === "analytics_busy") {
          scheduleRequest(
            request,
            () => {
              if (isCurrentRequest()) fetchAnalytics(url, request, isCurrentRequest, false);
            },
            retryAfterMs(response),
          );
        } else {
          handleError(response.status, payload?.error);
        }
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (!data) return;
      renderAnalytics(data, isCurrentRequest);
    })
    .catch((error) => {
      if (!isCurrentRequest() || error?.name === "AbortError") return;
      console.error("Premium analytics failed", error);
      handleError(0, "network_error");
    })
    .finally(() => {
      request.controller = null;
      if (request.timer !== null) return;
      if (isCurrentRequest()) {
        setLoadingState(false);
      }
    });
}

function retryAfterMs(response) {
  const header = response.headers?.get("Retry-After")?.trim();
  const seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : DEFAULT_BUSY_RETRY_SECONDS;
  return Math.min(seconds, MAX_BUSY_RETRY_SECONDS) * 1000;
}

function scheduleRequest(request, callback, delay) {
  request.timer = setTimeout(() => {
    request.timer = null;
    callback();
  }, delay);
}

function scheduleSelectionFetch(selection) {
  requestAnalytics({ selection }, SELECTION_FETCH_DELAY_MS);
}

function clearLoadingMessage() {
  if (!analyticsState.isLoading) return;
  setFooterMessage("");
  setLoadingState(false);
}

function normalizeSelection(selection) {
  if (!selection) return null;
  const from = Number(selection.from);
  const to = Number(selection.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null;
  }
  return { from, to };
}

function msToIso(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function handleError(status, code) {
  let message;
  if (status === 409 || code === "session_upgrade_required") {
    message = localize("premiumAnalytics_errorReauth");
  } else if (status === 403 && code === "membership_tier_insufficient") {
    message = localize("premiumTierNotice_message");
  } else if (status === 403 || code === "membership_inactive") {
    message = localize("premiumAnalytics_errorInactive");
  } else if (status === 401 || code === "invalid_session") {
    message = localize("premiumAnalytics_errorSession");
  } else if (code === "analytics_failure") {
    message = localize("premiumAnalytics_errorBackend");
  } else if (code === "network_error") {
    message = localize("premiumAnalytics_errorNetwork");
  } else {
    message = localize("premiumAnalytics_errorGeneric");
  }

  setFooterMessage(message);
  setLoadingState(false);
}

export { cancelAnalyticsRequests, requestAnalytics, scheduleSelectionFetch, normalizeSelection };

function resolveAnchor() {
  const anchor = typeof analyticsState.rangeAnchor === "string" ? analyticsState.rangeAnchor.toLowerCase() : "";
  return anchor === "last" ? "last" : "first";
}

function resolveBucket(selection, rangeDays) {
  if (selection) {
    const durationMs = Number(selection.to) - Number(selection.from);
    if (Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= HOURLY_THRESHOLD_MS) {
      return "hour";
    }
    return "day";
  }

  if (Number.isFinite(rangeDays) && rangeDays > 0 && rangeDays <= HOURLY_THRESHOLD_DAYS) {
    return "hour";
  }

  return "day";
}
