const LOG_PREFIX = '[PremiumAnalytics]';

export function logTimeBounds(label, bounds) {
  if (!bounds) return;
  console.log(
    `${LOG_PREFIX} ${label} bounds:`,
    bounds.min != null ? new Date(bounds.min).toISOString() : 'null',
    '->',
    bounds.max != null ? new Date(bounds.max).toISOString() : 'null',
  );
}

export function logRangeSelection(label, range) {
  if (!range) return;
  console.log(
    `${LOG_PREFIX} ${label} selection:`,
    range.from != null ? new Date(range.from).toISOString() : 'null',
    '->',
    range.to != null ? new Date(range.to).toISOString() : 'null',
  );
}

export function logFetchRequest(videoId, params) {
  console.log(`${LOG_PREFIX} fetch video=${videoId} params=`, params.toString());
}

export function logZoomPreview(label, bounds) {
  if (!bounds) return;
  console.log(
    `${LOG_PREFIX} ${label} preview:`,
    new Date(bounds.from).toISOString(),
    '->',
    new Date(bounds.to).toISOString(),
  );
}
