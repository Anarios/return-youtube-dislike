import { getApiEndpoint } from "./config";

const WITHOUT_LIKE_COUNT = "without-like-count";
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;
const LIVE_ACCEPT_MEDIA_TYPE = "application/vnd.ryd-live+json";

const liveTestBuild = typeof __RYD_LIVE_TEST_BUILD__ !== "undefined" && __RYD_LIVE_TEST_BUILD__ === true;
const compiledLiveBuildId = typeof __RYD_LIVE_BUILD_ID__ === "undefined" ? "" : __RYD_LIVE_BUILD_ID__;

let activeVideoId = null;
let activeRequestController = null;
let requestsByLikeCount = new Map();
let latestRequest = null;

function currentExtensionId() {
  return globalThis.chrome?.runtime?.id ?? globalThis.browser?.runtime?.id ?? "";
}

function createVoteDataAcceptHeader({
  buildId = compiledLiveBuildId,
  extensionId = currentExtensionId(),
  isLiveTestBuild = liveTestBuild,
} = {}) {
  if (!isLiveTestBuild) return "application/json";
  if (!EXTENSION_ID_PATTERN.test(extensionId)) {
    throw new Error("A live-test vote-data request requires a valid extension ID.");
  }
  if (!LIVE_BUILD_ID_PATTERN.test(buildId)) {
    throw new Error("A live-test vote-data request requires a valid build ID.");
  }
  const header = `application/json, ${LIVE_ACCEPT_MEDIA_TYPE}; id=${extensionId}; build=${buildId}`;
  if (header.length > 128) throw new Error("The live-test vote-data fingerprint exceeds the CORS safelist limit.");
  return header;
}

function normalizeLikeCount(likeCount) {
  if (likeCount === null || likeCount === undefined || likeCount === false || likeCount === "") {
    return null;
  }

  const parsed = typeof likeCount === "number" ? likeCount : Number(likeCount);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? String(parsed) : null;
}

function resetForVideo(videoId) {
  if (activeVideoId === videoId) return;
  clearVoteDataRequestCache();
  activeVideoId = videoId;
  activeRequestController = new AbortController();
}

function removeFailedRequest(record) {
  if (requestsByLikeCount.get(record.key) === record) {
    requestsByLikeCount.delete(record.key);
  }
  if (latestRequest === record) {
    const remainingRequests = Array.from(requestsByLikeCount.values());
    latestRequest = remainingRequests[remainingRequests.length - 1] ?? null;
  }
}

function requestVoteData(videoId, { fetchImpl = globalThis.fetch, likeCount = null } = {}) {
  if (typeof videoId !== "string" || videoId.length === 0) {
    return Promise.reject(new TypeError("A video ID is required to request vote data."));
  }
  if (typeof fetchImpl !== "function") {
    return Promise.reject(new TypeError("A fetch implementation is required to request vote data."));
  }

  resetForVideo(videoId);

  const normalizedLikeCount = normalizeLikeCount(likeCount);
  // A consumer that only needs aggregate counts can reuse a request carrying a
  // native Like count. That response is at least as informative as the base
  // request and avoids the premium teaser duplicating the main renderer's GET.
  if (normalizedLikeCount === null && latestRequest) {
    return latestRequest.promise;
  }

  const key = normalizedLikeCount ?? WITHOUT_LIKE_COUNT;
  const existing = requestsByLikeCount.get(key);
  if (existing) {
    return existing.promise;
  }

  const likeCountQuery = normalizedLikeCount === null ? "" : `&likeCount=${encodeURIComponent(normalizedLikeCount)}`;
  const url = getApiEndpoint(`/votes?videoId=${encodeURIComponent(videoId)}${likeCountQuery}`);
  const record = { key, promise: null };
  const { signal } = activeRequestController;

  let fetchResult;
  try {
    fetchResult = fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: createVoteDataAcceptHeader(),
      },
      signal,
    });
  } catch (error) {
    fetchResult = Promise.reject(error);
  }

  record.promise = Promise.resolve(fetchResult)
    .then((response) => {
      if (!response?.ok) {
        throw new Error(`Vote data request failed with HTTP ${response?.status ?? "unknown"}.`);
      }
      return response.json();
    })
    .then((payload) => {
      if (signal.aborted) {
        throw new DOMException("Vote data request cancelled by navigation.", "AbortError");
      }
      return payload;
    })
    .catch((error) => {
      removeFailedRequest(record);
      if (signal.aborted && error?.name !== "AbortError") {
        throw new DOMException("Vote data request cancelled by navigation.", "AbortError");
      }
      throw error;
    });

  requestsByLikeCount.set(key, record);
  latestRequest = record;
  return record.promise;
}

function clearVoteDataRequestCache() {
  activeRequestController?.abort();
  activeRequestController = null;
  activeVideoId = null;
  requestsByLikeCount = new Map();
  latestRequest = null;
}

function cancelObsoleteVoteDataRequests(videoId) {
  if (activeVideoId !== videoId) clearVoteDataRequestCache();
}

export {
  cancelObsoleteVoteDataRequests,
  clearVoteDataRequestCache,
  createVoteDataAcceptHeader,
  normalizeLikeCount,
  requestVoteData,
};
