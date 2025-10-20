import { getApiEndpoint } from "../config";
import { analyticsState, COUNTRY_LIMIT } from "./state";
import { ensurePanel, updateRangeButtons, updateRangeAnchorButtons, setFooterMessage, setLoadingState } from "./panel";
import { debounce, safeJson } from "./utils";
import { logFetchRequest } from "./logging";
import { localize } from "../utils";

import { MS_PER_DAY } from "./constants";
import { renderAnalytics } from "./render";

const HOURLY_THRESHOLD_DAYS = 7;
const HOURLY_THRESHOLD_MS = HOURLY_THRESHOLD_DAYS * MS_PER_DAY;
const MS_PER_HOUR = 60 * 60 * 1000;

function requestAnalytics({ selection } = {}) {
  const state = analyticsState;

  if (!state.currentVideoId || !state.sessionToken || !state.sessionActive) {
    return;
  }

  if (state.membershipTier !== "premium") {
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
  state.activeRequestKey = requestKey;
  state.latestBucketMs = bucket === "hour" ? MS_PER_HOUR : MS_PER_DAY;

  logFetchRequest(state.currentVideoId, params);

  const url = getApiEndpoint(`/api/patreon/analytics/video/${state.currentVideoId}?${params.toString()}`);

  fetch(url, {
    headers: {
      Authorization: `Bearer ${state.sessionToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await safeJson(response);
        handleError(response.status, payload?.error);
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (!data || analyticsState.activeRequestKey !== requestKey) return;
      renderAnalytics(data);
    })
    .catch((error) => {
      console.error("Premium analytics failed", error);
      if (analyticsState.activeRequestKey === requestKey) {
        handleError(0, "network_error");
      }
    })
    .finally(() => {
      if (analyticsState.activeRequestKey === requestKey) {
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
