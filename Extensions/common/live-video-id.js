const LIVE_VIDEO_PATHNAME = /^\/live\/([A-Za-z0-9_-]{11})\/?$/;
const CHANNEL_LIVE_PATHNAME = /^\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/live\/?$/;
const VISIBLE_WATCH_ROOT_SELECTOR = "ytd-watch-flexy:not([hidden]), ytd-watch-grid:not([hidden])";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function getCanonicalWatchVideoId() {
  const href = document.querySelector("link[rel='canonical']")?.href;
  if (!href || !document.querySelector(VISIBLE_WATCH_ROOT_SELECTOR)) return null;
  const canonical = new URL(href);
  const videoId = canonical.pathname === "/watch" ? canonical.searchParams.get("v") : null;
  return VIDEO_ID_PATTERN.test(videoId ?? "") ? videoId : null;
}

function getLiveVideoId(pathname) {
  const linkedVideoId = LIVE_VIDEO_PATHNAME.exec(pathname)?.[1];
  if (linkedVideoId) return linkedVideoId;
  return CHANNEL_LIVE_PATHNAME.test(pathname) ? getCanonicalWatchVideoId() : null;
}

export { getLiveVideoId };
