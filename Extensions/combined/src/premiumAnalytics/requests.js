import { getApiEndpoint } from "../config";
import { analyticsState, COUNTRY_LIMIT } from "./state";
import { ensurePanel, updateRangeButtons, updateRangeAnchorButtons, setFooterMessage, setLoadingState } from "./panel";
import { debounce, safeJson } from "./utils";
import { logFetchRequest } from "./logging";
import { localize } from "../utils";
import { hasAuthenticationDataPermission, usesFirefoxDataCollectionConsent } from "../data-collection-permissions";

import { MS_PER_DAY } from "./constants";
import { renderAnalytics } from "./render";

const HOURLY_THRESHOLD_DAYS = 7;
const HOURLY_THRESHOLD_MS = HOURLY_THRESHOLD_DAYS * MS_PER_DAY;
const MS_PER_HOUR = 60 * 60 * 1000;
let requestSequence = 0;

function requestAnalytics(options = {}) {
  const state = analyticsState;

  if (!state.currentVideoId || !state.sessionToken || !state.sessionActive) {
    return;
  }

  if (state.membershipTier !== "premium") {
    return;
  }

  if (!usesFirefoxDataCollectionConsent()) return requestAnalyticsWithConsent(options);

  const sessionToken = state.sessionToken;
  return hasAuthenticationDataPermission().then((granted) => {
    if (state.sessionToken !== sessionToken) return;
    if (!granted) {
      state.sessionToken = null;
      state.sessionActive = false;
      return;
    }

    return requestAnalyticsWithConsent(options);
  });
}

function requestAnalyticsWithConsent({ selection } = {}) {
  const state = analyticsState;

  if (!state.currentVideoId || !state.sessionToken || !state.sessionActive || state.membershipTier !== "premium") {
    return;
  }

  ensurePanel();
  setFooterMessage("Loading insights…");
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

  let requestKey;
  if (effectiveSelection) {
    const startIso = msToIso(effectiveSelection.from);
    const endIso = msToIso(effectiveSelection.to);
    if (startIso && endIso) {
      params.set("selectedRangeStartUtc", startIso);
      params.set("selectedRangeEndUtc", endIso);
      requestKey = `${state.currentVideoId}:${startIso}:${endIso}`;
      state.usingCustomRange = true;
      state.currentRange = Math.max(0, Math.round((effectiveSelection.to - effectiveSelection.from) / MS_PER_DAY));
      state.customSelection = { ...effectiveSelection };
      state.selectionRange = { ...effectiveSelection };
    } else {
      params.set("rangeDays", `${state.currentRange}`);
      params.set("rangeAnchor", rangeAnchor);
      requestKey = `${state.currentVideoId}:${state.currentRange}:${rangeAnchor}`;
      state.usingCustomRange = false;
      state.customSelection = null;
    }
  } else {
    params.set("rangeDays", `${state.currentRange}`);
    params.set("rangeAnchor", rangeAnchor);
    requestKey = `${state.currentVideoId}:${state.currentRange}:${rangeAnchor}`;
    state.usingCustomRange = false;
    state.customSelection = null;
  }

  state.pendingSelection = effectiveSelection || null;
  requestKey = `${requestKey}:${++requestSequence}`;
  state.activeRequestKey = requestKey;
  state.latestBucketMs = bucket === "hour" ? MS_PER_HOUR : MS_PER_DAY;

  logFetchRequest(state.currentVideoId, params);

  const url = getApiEndpoint(`/api/patreon/analytics/video/${state.currentVideoId}?${params.toString()}`);
  const sessionToken = state.sessionToken;
  const isCurrentRequest = () =>
    analyticsState.activeRequestKey === requestKey &&
    analyticsState.sessionToken === sessionToken &&
    analyticsState.sessionActive;

  fetch(url, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  })
    .then(async (response) => {
      if (!isCurrentRequest()) return null;
      if (!response.ok) {
        const payload = await safeJson(response);
        if (isCurrentRequest()) handleError(response.status, payload?.error);
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (!data || !isCurrentRequest()) return;
      renderAnalytics(data);
    })
    .catch((error) => {
      console.error("Premium analytics failed", error);
      if (isCurrentRequest()) {
        handleError(0, "network_error");
      }
    })
    .finally(() => {
      if (isCurrentRequest()) {
        setLoadingState(false);
      }
    });
}

function commitSelectionFetch(selection) {
  requestAnalytics({ selection });
}

const debounceSelectionFetch = debounce(commitSelectionFetch, 400);

function scheduleSelectionFetch(selection) {
  debounceSelectionFetch(selection);
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

export { requestAnalytics, scheduleSelectionFetch, normalizeSelection };

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
