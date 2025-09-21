import { sanitizeCount, toEpoch } from "./premiumAnalytics.utils";
import { analyticsState } from "./premiumAnalytics.state";

export function computeChartBounds(points, timeline, bucketSizeMs) {
  if (!timeline.length) {
    const now = Date.now();
    const fallbackBucket = Math.max(bucketSizeMs, 60 * 1000);
    return { min: now - fallbackBucket, max: now };
  }

  const nonZeroTimes = points
    .filter((p) => p && (sanitizeCount(p.likes) > 0 || sanitizeCount(p.dislikes) > 0))
    .map((p) => toEpoch(p.timestampUtc))
    .filter((ms) => ms != null);

  const allTimes = timeline.filter((ms) => ms != null);

  let min = nonZeroTimes.length ? Math.min(...nonZeroTimes) : Math.min(...allTimes);
  let max = nonZeroTimes.length ? Math.max(...nonZeroTimes) : Math.max(...allTimes);

  if (min === max) {
    max = min + Math.max(bucketSizeMs, 60 * 1000);
  }

  return { min, max };
}

export function updateGlobalBounds(bounds) {
  const state = analyticsState;
  if (bounds.min != null) {
    state.globalTimeBounds.min = state.globalTimeBounds.min == null
      ? bounds.min
      : Math.min(state.globalTimeBounds.min, bounds.min);
  }
  if (bounds.max != null) {
    state.globalTimeBounds.max = state.globalTimeBounds.max == null
      ? bounds.max
      : Math.max(state.globalTimeBounds.max, bounds.max);
  }
  if (state.globalTimeBounds.min == null && bounds.min != null) {
    state.globalTimeBounds.min = bounds.min;
  }
  if (state.globalTimeBounds.max == null && bounds.max != null) {
    state.globalTimeBounds.max = bounds.max;
  }
}

export function clampRangeToBounds(range, bounds) {
  const { min, max } = bounds;
  if (min == null || max == null) return null;

  const startValue = Number.isFinite(range.from) ? range.from : min;
  const endValue = Number.isFinite(range.to) ? range.to : max;

  const clampedStart = Math.max(min, Math.min(max, startValue));
  const clampedEnd = Math.max(min, Math.min(max, endValue));
  if (clampedEnd <= clampedStart) {
    return null;
  }

  return { from: clampedStart, to: clampedEnd };
}

export function resolveZoomBounds(event, sliderBounds, timeline) {
  const payload = Array.isArray(event?.batch) ? event.batch[0] : event;
  if (!payload) return null;

  const startTime = resolveZoomValue(payload.startValue, payload.start, sliderBounds, timeline, 0);
  const endTime = resolveZoomValue(payload.endValue, payload.end, sliderBounds, timeline, timeline.length - 1);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return null;
  }

  return [startTime, endTime];
}

export function combineBounds(primary = {}, fallback = {}) {
  const min = resolvePreferredLower(primary?.min, fallback?.min);
  const max = resolvePreferredUpper(primary?.max, fallback?.max);
  return { min, max };
}

function resolveZoomValue(value, percent, sliderBounds, timeline, fallbackIndex) {
  const numeric = normalizeZoomNumeric(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const { min, max } = sliderBounds;
  if (Number.isFinite(min) && Number.isFinite(max) && max > min && typeof percent === "number") {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    return min + ((max - min) * clampedPercent) / 100;
  }

  if (timeline.length) {
    const index = typeof percent === "number"
      ? Math.max(0, Math.min(timeline.length - 1, Math.round((percent / 100) * (timeline.length - 1))))
      : fallbackIndex;
    return timeline[index] ?? null;
  }

  return null;
}

function normalizeZoomNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolvePreferredLower(primary, fallback) {
  if (Number.isFinite(primary)) {
    return primary;
  }
  if (Number.isFinite(fallback)) {
    return fallback;
  }
  return null;
}

function resolvePreferredUpper(primary, fallback) {
  if (Number.isFinite(primary)) {
    return primary;
  }
  if (Number.isFinite(fallback)) {
    return fallback;
  }
  return null;
}
