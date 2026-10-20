import { getVideoId, localize } from "../utils";
import { requestVoteData } from "../vote-data-request";
import { analyticsState } from "./state";

let generation = 0;
let countsVideoId = null;
let cachedPayload = null;
let loadState = "idle";
let activeRequest = null;

export async function loadRawCounts(videoId) {
  if (!isCurrentVideo(videoId)) return;

  if (countsVideoId === videoId && loadState === "loaded") {
    renderRawCounts();
    return;
  }

  if (activeRequest?.videoId === videoId) {
    renderRawCounts();
    await activeRequest.promise;
    return;
  }

  const request = { videoId, generation: ++generation, promise: null };
  activeRequest = request;
  countsVideoId = videoId;
  cachedPayload = null;
  loadState = "loading";
  renderRawCounts();
  request.promise = fetchRawCounts(request);
  await request.promise;
}

export function resetRawCounts() {
  generation += 1;
  activeRequest = null;
  countsVideoId = null;
  cachedPayload = null;
  loadState = "idle";
  renderRawCounts();
}

export function renderRawCounts() {
  const panel = analyticsState.panelElement;
  if (!panel) return;

  const isCurrent = isCurrentVideo(countsVideoId);
  const payload = isCurrent ? cachedPayload : null;
  const likes = panel.querySelector("#ryd-analytics-raw-likes");
  const dislikes = panel.querySelector("#ryd-analytics-raw-dislikes");
  const status = panel.querySelector("#ryd-analytics-raw-status");

  if (likes) likes.textContent = formatCount(payload?.rawLikes ?? payload?.likes);
  if (dislikes) dislikes.textContent = formatCount(payload?.rawDislikes ?? payload?.dislikes);
  if (status) {
    status.textContent =
      isCurrent && loadState === "loading"
        ? localize("premiumTeaser_statusLoading")
        : isCurrent && loadState === "error"
          ? localize("premiumTeaser_statusError")
          : "";
  }
}

async function fetchRawCounts(request) {
  try {
    const payload = await requestVoteData(request.videoId);
    if (!ownsRequest(request) || !isCurrentVideo(request.videoId)) return;
    cachedPayload = payload;
    loadState = "loaded";
  } catch (error) {
    if (!ownsRequest(request) || !isCurrentVideo(request.videoId)) return;
    loadState = error?.name === "AbortError" ? "idle" : "error";
  } finally {
    if (ownsRequest(request)) {
      activeRequest = null;
      if (loadState === "loading") loadState = "idle";
      renderRawCounts();
    }
  }
}

function ownsRequest(request) {
  return activeRequest === request && generation === request.generation && countsVideoId === request.videoId;
}

function isCurrentVideo(videoId) {
  if (typeof videoId !== "string" || videoId.length !== 11 || analyticsState.currentVideoId !== videoId) return false;
  try {
    return getVideoId(window.location.href) === videoId;
  } catch {
    return false;
  }
}

function formatCount(value) {
  return Number.isFinite(value) && value >= 0 ? value.toLocaleString() : "—";
}
