const assert = require("node:assert/strict");
const {
  USER_ID_PATTERN,
  hasExactKeys,
  isFourByteProofSolution,
  isVoteProtocolBodyPairValid,
} = require("../../../e2e/vote-protocol-contract");
const { inspectYoutubeSessionDocument, normalizeChannelHandle } = require("./live-authenticated-context");
const {
  assertExpectedWatchCounts,
  assertWatchRatioData,
  formattedWatchTooltipCandidates,
} = require("./watch-ratio-audit");

const API_ORIGIN = "https://returnyoutubedislikeapi.com";
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;
const LIVE_ACCEPT_HEADER_PATTERN =
  /^application\/json, application\/vnd\.ryd-live\+json; id=([a-p]{32}); build=([a-f0-9]{32})$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const RENDERED_NUMBER_PATTERN = /\p{Number}/u;
const DISLIKE_BUTTON_SELECTORS = [
  "[data-ryd-synthetic-shorts-dislike] button",
  "dislike-button-view-model button",
  "#segmented-dislike-button button",
  "button#segmented-dislike-button",
  "#dislike-button button",
  "ytd-dislike-button-renderer button",
].join(", ");
const LIKE_BUTTON_SELECTORS = [
  "like-button-view-model button",
  "#segmented-like-button button",
  "button#segmented-like-button",
  "#like-button button",
  "ytd-like-button-renderer button",
].join(", ");
const ACTION_BUTTON_SELECTORS = {
  dislike: DISLIKE_BUTTON_SELECTORS,
  like: LIKE_BUTTON_SELECTORS,
};
const VISIBLE_ACTION_BUTTON_SELECTORS = Object.fromEntries(
  Object.entries(ACTION_BUTTON_SELECTORS).map(([action, selectors]) => [
    action,
    selectors
      .split(",")
      .map((selector) => `${selector.trim()}:visible`)
      .join(", "),
  ]),
);
const RATE_BAR_SELECTORS = {
  extension: {
    bar: "#ryd-bar",
    container: "#ryd-bar-container",
    tooltip: "#ryd-dislike-tooltip",
  },
  userscript: {
    bar: "#return-youtube-dislike-bar",
    container: "#return-youtube-dislike-bar-container",
    tooltip: "#ryd-dislike-tooltip",
  },
};
const WATCH_OVERFLOW_POPUP_SELECTORS = Object.freeze([
  "ytd-popup-container ytd-menu-popup-renderer",
  "tp-yt-iron-dropdown ytd-menu-popup-renderer",
  "ytd-popup-container tp-yt-paper-listbox[role='menu']",
  "ytd-popup-container [role='menu']",
]);
const WATCH_OVERFLOW_POPUP_SELECTOR = WATCH_OVERFLOW_POPUP_SELECTORS.join(", ");
const PLAYLIST_WATCH_LINK_SELECTOR = 'ytd-playlist-panel-video-renderer a[href*="/watch"]';
const RELATED_WATCH_LINK_SELECTOR = '#related a[href*="/watch"]';
const SYNTHETIC_SHORTS_SELECTOR = "[data-ryd-synthetic-shorts-dislike]";
const SHORTS_NATIVE_ACTION_BAR_SELECTOR = "reel-action-bar-view-model, .slim-video-action-bar-actions";
const SHORTS_MINIMUM_NATIVE_ACTION_CONTROLS = 4;
const SHORTS_NEXT_BUTTON_SELECTOR = [
  "ytd-shorts #navigation-button-down button",
  "#navigation-button-down button",
  'ytd-shorts button[aria-label="Next video"]',
].join(", ");
const SHORTS_GEOMETRY = {
  buttonSize: 48,
  countHorizontalAllowance: 12,
  controlHeight: 78,
  fontSize: 12,
  geometryTolerance: 1,
  iconSize: 24,
  labelHeight: 70,
  lineHeight: 18,
  textTolerance: 0.5,
};
const SHORTS_ACTION_HOST_INSETS = {
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  paddingBottom: 8,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
};
const SHORTS_NEXT_FIRST_CLICK_TIMEOUT = 5_000;
const SHORTS_NEXT_RETRY_TIMEOUT = 25_000;
const CHANNEL_TARGET_ACTIVATION_TIMEOUT = 20_000;
const CHANNEL_TARGET_FIRST_NAVIGATION_TIMEOUT = 5_000;
const CHANNEL_TARGET_RETRY_NAVIGATION_TIMEOUT = 25_000;
const CHANNEL_TARGET_RETRY_INTERVAL_MS = 200;
const WATCH_OVERFLOW_FIRST_OPEN_TIMEOUT_MS = 3_000;
const SHORTS_CONTROL_SOAK_DURATION_MS = 2_000;
const SHORTS_CONTROL_SOAK_INTERVAL_MS = 400;
const SHORTS_NATIVE_CONTROLS_TIMEOUT_MS = 20_000;
const SHORTS_NATIVE_CONTROLS_OPERATION_TIMEOUT_MS = 2_000;
const SHORTS_BLANK_EVIDENCE_TIMEOUT_MS = 10_000;
const SHORTS_NATIVE_CONTROLS_WAKE_INTERVAL_MS = 1_000;
const SHORTS_VOTES_REQUEST_QUIET_MS = 250;
const VOTES_RESPONSE_REQUEST_QUIET_MS = 1_000;
const READ_ONLY_INTERACTION_GUARD_CLEANUP_TIMEOUT_MS = 10_000;
const SHORTS_VISUAL_PAINT_TIMEOUT = 5_000;
const VISUAL_TOOLTIP_TIMEOUT = 5_000;
const WATCH_RATIO_SOAK_DURATION_MS = 4_000;
const WATCH_RATIO_SOAK_INTERVAL_MS = 500;
const WATCH_RESULT_SOAK_DURATION_MS = 1_000;
const NATIVE_YOUTUBE_TOOLTIP_SELECTOR = [
  "tp-yt-paper-tooltip:not(#ryd-dislike-tooltip)",
  "ytd-tooltip-renderer",
  "ytm-tooltip-renderer",
  ".ytp-tooltip",
  '[role="tooltip"]:not(#ryd-dislike-tooltip):not(.ryd-tooltip)',
].join(", ");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withOperationTimeout(action, timeoutMs, timeoutMessage) {
  let timeoutId;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeRenderedCount(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function roundDownUserscriptCount(value) {
  if (value < 1_000) return value;
  const integerDigits = Math.floor(Math.log10(value) - 2);
  const decimal = integerDigits + (integerDigits % 3 ? 1 : 0);
  return Math.floor(value / 10 ** decimal) * 10 ** decimal;
}

function formattedDislikeCountCandidates(dislikes, locale, runtime) {
  assert.ok(Number.isSafeInteger(dislikes) && dislikes >= 0, "The API dislike count must be a non-negative integer.");
  assert.ok(runtime === "extension" || runtime === "userscript", `Unsupported live count runtime: ${runtime}`);

  const values = runtime === "userscript" ? [dislikes, roundDownUserscriptCount(dislikes)] : [dislikes];
  const formats = [
    { compactDisplay: "short", notation: "compact" },
    { compactDisplay: "long", notation: "compact" },
    { compactDisplay: "short", notation: "standard" },
  ];
  return [
    ...new Set(
      values.flatMap((value) =>
        formats.map((format) => normalizeRenderedCount(Intl.NumberFormat(locale || "en", format).format(value))),
      ),
    ),
  ];
}

function assertRenderedDislikeCountMatchesApi(renderedCount, dislikes, locale, runtime) {
  const normalizedCount = normalizeRenderedCount(renderedCount);
  const candidates = formattedDislikeCountCandidates(dislikes, locale, runtime);
  assert.ok(
    candidates.includes(normalizedCount),
    `Rendered dislike count ${JSON.stringify(normalizedCount)} does not represent API count ${dislikes} for ${runtime}; expected one of ${JSON.stringify(candidates)}.`,
  );
  return { candidates, normalizedCount };
}

function assertDislikeCountChangesObservable(changes, locale, runtime) {
  assert.ok(Array.isArray(changes) && changes.length > 0, "At least one dislike-count change is required.");
  return changes.map(({ after, before }, index) => {
    assert.notEqual(before, after, `Dislike-count observability change ${index + 1} does not change the count.`);
    const beforeCandidates = formattedDislikeCountCandidates(before, locale, runtime);
    const afterCandidates = formattedDislikeCountCandidates(after, locale, runtime);
    const afterSet = new Set(afterCandidates);
    const overlap = beforeCandidates.filter((candidate) => afterSet.has(candidate));
    assert.deepEqual(
      overlap,
      [],
      `A ${before} -> ${after} dislike change is not observable for ${runtime}; the formatted text can remain ${JSON.stringify(
        overlap,
      )}. Choose a low-count reaction target whose +/-1 changes are visibly distinct.`,
    );
    return { after, afterCandidates, before, beforeCandidates };
  });
}

function assertExactVotesRequestAudit(requests, expectedVideoId) {
  assert.match(expectedVideoId ?? "", VIDEO_ID_PATTERN, "A valid current video ID is required for the /votes audit.");
  assert.ok(Array.isArray(requests), "The /votes request audit is missing.");
  const staleRequests = requests.filter((request) => request.videoId !== expectedVideoId);
  assert.deepEqual(
    staleRequests,
    [],
    `The Shorts Next transition emitted a stale /votes request while targeting ${expectedVideoId}.`,
  );
  assert.equal(
    requests.length,
    1,
    `The Shorts Next transition must emit exactly one /votes request for ${expectedVideoId}; observed ${requests.length}.`,
  );
  assert.equal(requests[0].method, "GET", `The /votes request for ${expectedVideoId} did not use GET.`);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, API_ORIGIN, `The /votes request for ${expectedVideoId} used the wrong origin.`);
  assert.equal(requestUrl.pathname, "/votes", `The vote-count request for ${expectedVideoId} used the wrong path.`);
  const requestedVideoIds = requestUrl.searchParams.getAll("videoId");
  assert.equal(
    requestedVideoIds.length,
    1,
    `The /votes request for ${expectedVideoId} did not contain exactly one matching videoId parameter.`,
  );
  assert.equal(
    requestedVideoIds[0],
    expectedVideoId,
    `The /votes request for ${expectedVideoId} did not contain exactly one matching videoId parameter.`,
  );
  const unexpectedQueryParameters = [...new Set(requestUrl.searchParams.keys())].filter(
    (name) => name !== "videoId" && name !== "likeCount",
  );
  assert.deepEqual(
    unexpectedQueryParameters,
    [],
    `The /votes request for ${expectedVideoId} contained unexpected query parameters.`,
  );
  return requests[0];
}

function likeCountParameters(request) {
  return new URL(request.url).searchParams.getAll("likeCount");
}

function assertExactVotesRequestSequenceAudit(requests, expectedVideoId, { allowLikeCountRefinement = false } = {}) {
  assert.ok(Array.isArray(requests), "The /votes request audit is missing.");
  const staleRequests = requests.filter((request) => request.videoId !== expectedVideoId);
  assert.deepEqual(
    staleRequests,
    [],
    `The navigation emitted a stale /votes request while targeting ${expectedVideoId}.`,
  );

  if (!allowLikeCountRefinement) {
    return [assertExactVotesRequestAudit(requests, expectedVideoId)];
  }

  assert.ok(
    requests.length === 1 || requests.length === 2,
    `The extension navigation must emit one /votes request, or one base request followed by one Like-count refinement, for ${expectedVideoId}; observed ${requests.length}.`,
  );
  requests.forEach((request) => assertExactVotesRequestAudit([request], expectedVideoId));

  const likeCounts = requests.map(likeCountParameters);
  for (const parameters of likeCounts) {
    assert.ok(
      parameters.length === 0 ||
        (parameters.length === 1 && /^\d+$/.test(parameters[0]) && Number.isSafeInteger(Number(parameters[0]))),
      `The /votes request for ${expectedVideoId} has an invalid Like-count refinement.`,
    );
  }
  if (requests.length === 2) {
    assert.equal(
      likeCounts[0].length,
      0,
      `The first /votes request for ${expectedVideoId} must be the aggregate request before refinement.`,
    );
    assert.equal(
      likeCounts[1].length,
      1,
      `The second /votes request for ${expectedVideoId} must be the single Like-count refinement.`,
    );
  }
  return requests;
}

function assertExactVotesResponseAudit(
  requests,
  expectedVideoId,
  baselineRequestId,
  { allowLikeCountRefinement = false } = {},
) {
  assert.ok(
    Number.isSafeInteger(baselineRequestId) && baselineRequestId >= 0,
    "The /votes request baseline must be a non-negative request ID.",
  );
  const sequence = assertExactVotesRequestSequenceAudit(requests, expectedVideoId, {
    allowLikeCountRefinement,
  });
  let previousRequestId = baselineRequestId;
  for (const request of sequence) {
    assert.ok(
      Number.isSafeInteger(request.requestId) && request.requestId > previousRequestId,
      `The /votes request for ${expectedVideoId} was not created after request baseline ${previousRequestId}.`,
    );
    previousRequestId = request.requestId;
    assert.equal(
      request.responseStatus,
      200,
      `The production /votes request for ${expectedVideoId} returned HTTP ${request.responseStatus ?? "no response"}.`,
    );
    assert.ok(
      request.responseBody && typeof request.responseBody === "object",
      `The production /votes response for ${expectedVideoId} is not JSON.`,
    );
    assert.equal(
      request.responseBody.id,
      expectedVideoId,
      `The production /votes response returned video ${request.responseBody.id ?? "<missing>"} instead of ${expectedVideoId}.`,
    );
    assert.ok(
      Number.isSafeInteger(request.responseBody.dislikes) && request.responseBody.dislikes >= 0,
      `The production /votes response for ${expectedVideoId} has no valid dislike count.`,
    );
  }
  return sequence.at(-1);
}

function isSelectedRuntimeServiceWorkerUrl(workerUrl, runtime, selectedExtensionId) {
  if (runtime !== "extension" || !EXTENSION_ID_PATTERN.test(selectedExtensionId ?? "")) return false;

  let url;
  try {
    url = new URL(workerUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === "chrome-extension:" &&
    url.hostname === selectedExtensionId &&
    url.pathname === "/ryd.background.js" &&
    url.search === "" &&
    url.hash === ""
  );
}

function parseLiveExtensionAcceptHeader(value) {
  if (typeof value !== "string") return null;
  const match = value.match(LIVE_ACCEPT_HEADER_PATTERN);
  return match ? { buildId: match[2], extensionId: match[1] } : null;
}

function requestAcceptHeader(request) {
  try {
    const headers = request.headers();
    if (!headers || typeof headers !== "object") return null;
    const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === "accept");
    return typeof entry?.[1] === "string" ? entry[1] : null;
  } catch {
    return null;
  }
}

function attributeRuntimeRequest(request, page, runtime, selectedExtensionId = null, expectedBuildId = null) {
  if (runtime === "extension" && !EXTENSION_ID_PATTERN.test(selectedExtensionId ?? "")) return null;

  try {
    if (request.frame().page() !== page) return null;
    if (runtime !== "extension") return { source: "page", workerUrl: null };
    if (request.method() !== "GET" || !LIVE_BUILD_ID_PATTERN.test(expectedBuildId ?? "")) return null;
    const fingerprint = parseLiveExtensionAcceptHeader(requestAcceptHeader(request));
    if (fingerprint?.extensionId !== selectedExtensionId || fingerprint?.buildId !== expectedBuildId) return null;
    return { source: "page", workerUrl: null };
  } catch {
    let workerUrl;
    try {
      workerUrl = request.serviceWorker?.()?.url?.();
    } catch {
      return null;
    }
    if (!isSelectedRuntimeServiceWorkerUrl(workerUrl, runtime, selectedExtensionId)) return null;
    return { source: "service-worker", workerUrl };
  }
}

function requestVideoId(request, url = null) {
  let parsedUrl = url;
  if (!(parsedUrl instanceof URL)) {
    try {
      parsedUrl = new URL(request.url());
    } catch {
      parsedUrl = null;
    }
  }
  const queryVideoId = parsedUrl?.searchParams.get("videoId");
  if (queryVideoId) return queryVideoId;
  const bodyVideoId = readJsonBody(request)?.videoId;
  return typeof bodyVideoId === "string" ? bodyVideoId : null;
}

function snapshotSameVideoOtherPages(context, page, attribution, videoId) {
  if (attribution.source !== "service-worker") return [];
  if (typeof context?.pages !== "function" || !VIDEO_ID_PATTERN.test(videoId ?? "")) return null;
  return context
    .pages()
    .filter((candidate) => candidate !== page)
    .map((candidate) => {
      try {
        return candidate.url();
      } catch {
        return null;
      }
    })
    .filter((candidateUrl) => candidateUrl && videoIdFromUrl(candidateUrl) === videoId);
}

function assertWorkerRequestAttributionIsUnambiguous(context, page, requests, expectedVideoId) {
  for (const request of requests.filter((candidate) => candidate.source === "service-worker")) {
    const requestVideo = request.videoId ?? expectedVideoId;
    const matchingOtherPages = Object.hasOwn(request, "sameVideoOtherPagesAtRequest")
      ? request.sameVideoOtherPagesAtRequest
      : snapshotSameVideoOtherPages(context, page, request, requestVideo);
    assert.ok(
      Array.isArray(matchingOtherPages),
      `Cannot prove which tab initiated the selected runtime's service-worker request for ${requestVideo ?? "an unknown video"}.`,
    );
    assert.deepEqual(
      matchingOtherPages,
      [],
      `Cannot attribute the service-worker request for ${requestVideo}: another tab has the same video open at send time.`,
    );
  }
}

function readShortsRendererIdentityState(element, settings = {}) {
  const renderedInViewport = (candidate) => {
    if (!candidate?.isConnected || candidate.closest("[hidden], [aria-hidden='true'], [inert]")) return false;

    let effectiveOpacity = 1;
    for (let current = candidate; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
    }
    if (effectiveOpacity <= 0.01) return false;

    const rect = candidate.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    );
  };
  const reel = element?.closest?.("ytd-reel-video-renderer, ytm-reel-video-renderer") ?? null;
  const candidateVideoIds = new Set();
  const rendererVideoId = reel?.getAttribute("video-id");
  if (rendererVideoId) candidateVideoIds.add(rendererVideoId);

  const links = [...(reel?.querySelectorAll("a[href*='/shorts/']") ?? [])];
  const canonicalPlayerLinks = links.filter((link) => link.matches("a.ytp-title-link[href*='/shorts/']"));
  // Match the production readiness helper: when YouTube exposes its hidden
  // player-title permalink, description/metapanel Shorts links are not reel
  // identities. A renderer attribute is unioned with that canonical identity
  // so stale/conflicting metadata remains ambiguous instead of being trusted.
  const identityLinks = canonicalPlayerLinks.length > 0 ? canonicalPlayerLinks : links;
  for (const link of identityLinks) {
    try {
      const href = link.getAttribute("href");
      if (!href) continue;
      const videoId = new URL(href, settings.baseUrl ?? location.href).pathname.match(/^\/shorts\/([^/]+)\/?$/)?.[1];
      if (videoId) candidateVideoIds.add(videoId);
    } catch {
      // Ignore malformed or incomplete links while YouTube hydrates the reel.
    }
  }

  const identities = [...candidateVideoIds];
  return {
    candidateVideoIds: identities,
    elementRenderedInViewport: renderedInViewport(element),
    hasReel: reel !== null,
    reelRenderedInViewport: renderedInViewport(reel),
    rendererVideoId,
    videoMatches:
      identities.length === 1 &&
      Boolean(settings.expectedShortVideoId) &&
      identities[0] === settings.expectedShortVideoId,
  };
}

function isShortCandidateEligibilityState(state, settings) {
  if (!state?.elementRenderedInViewport) return false;
  if (!settings.activeShortRequired) return true;
  return Boolean(settings.expectedShortVideoId && state.hasReel && state.reelRenderedInViewport && state.videoMatches);
}

function isShortCandidateEligible(element, settings) {
  return isShortCandidateEligibilityState(
    readShortsRendererIdentityState(element, {
      baseUrl: typeof location === "undefined" ? "https://www.youtube.com/" : location.href,
      expectedShortVideoId: settings.expectedShortVideoId,
    }),
    settings,
  );
}

function readDislikeControlText(button) {
  const syntheticControl = button.closest("[data-ryd-synthetic-shorts-dislike]");
  const textSource = syntheticControl?.querySelector("#text, [role='text']") ?? button;
  return (textSource.innerText ?? textSource.textContent ?? "").replace(/\s+/g, " ").trim();
}

function readWatchTopRowTopology(topRow, expectedVideoId) {
  const readBox = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
  };
  const rendered = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) === 0
      ) {
        return false;
      }
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const normalizeText = (value) => (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const signature = (host) => {
    const textSelectors = [
      "[role='text']",
      ".yt-spec-button-shape-next__button-text-content",
      ".ytSpecButtonShapeNextButtonTextContent",
      ".yt-core-attributed-string",
      "yt-formatted-string",
    ];
    for (const selector of textSelectors) {
      for (const textNode of host.querySelectorAll(selector)) {
        if (!rendered(textNode)) continue;
        const value = normalizeText(textNode.innerText ?? textNode.textContent);
        if (value) return value;
      }
    }
    const interactive = [...host.querySelectorAll("button, a[href], [role='button']")].find(rendered) ?? host;
    return (
      [interactive, host]
        .flatMap((element) => [
          element.getAttribute?.("aria-label"),
          element.getAttribute?.("title"),
          element.innerText,
          element.textContent,
        ])
        .map(normalizeText)
        .find(Boolean) ?? ""
    );
  };
  const buttonsFor = (selector, scope) =>
    [...scope.querySelectorAll(selector)].filter((button) => rendered(button) && !button.disabled);
  const directChildOf = (element, parent) => {
    let current = element;
    while (current && current.parentElement !== parent) current = current.parentElement;
    return current?.parentElement === parent ? current : null;
  };

  const watchRoot = topRow.closest("ytd-watch-flexy, ytd-watch-grid");
  const visibleMenus = [...topRow.querySelectorAll("ytd-menu-renderer.ytd-watch-metadata")].filter(rendered);
  const menu = visibleMenus[0] ?? null;
  const visibleSurfaces = menu ? [...menu.querySelectorAll("#top-level-buttons-computed")].filter(rendered) : [];
  const surface = visibleSurfaces[0] ?? null;
  const likeButtons = surface
    ? buttonsFor(
        [
          "like-button-view-model button",
          "#segmented-like-button button",
          "button#segmented-like-button",
          "#like-button button",
          "ytd-like-button-renderer button",
        ].join(", "),
        surface,
      )
    : [];
  const dislikeButtons = surface
    ? buttonsFor(
        [
          "dislike-button-view-model button",
          "#segmented-dislike-button button",
          "button#segmented-dislike-button",
          "#dislike-button button",
          "ytd-dislike-button-renderer button",
        ].join(", "),
        surface,
      )
    : [];
  const likeHost = surface && likeButtons[0] ? directChildOf(likeButtons[0], surface) : null;
  const dislikeHost = surface && dislikeButtons[0] ? directChildOf(dislikeButtons[0], surface) : null;
  const reactionGroup = likeHost && likeHost === dislikeHost ? likeHost : null;
  const fixedActionHosts = surface
    ? [...surface.children].filter(
        (child) =>
          child !== reactionGroup &&
          !child.matches(".ryd-tooltip, [data-ryd-ratebar-wrapper], [data-ryd-rate-bar-wrapper]") &&
          rendered(child) &&
          [...child.querySelectorAll("button, a[href], [role='button']")].some(rendered),
      )
    : [];
  // YouTube's current Watch layout renders width-dependent actions in a
  // sibling #flexible-item-buttons container. Restricting discovery to
  // #top-level-buttons-computed silently missed Save/Thanks and could make a
  // failed resize restoration look green.
  const visibleFlexibleSurfaces = menu ? [...menu.querySelectorAll("#flexible-item-buttons")].filter(rendered) : [];
  const flexibleActionHosts = visibleFlexibleSurfaces.flatMap((flexibleSurface) =>
    [...flexibleSurface.children].filter(
      (child) => rendered(child) && [...child.querySelectorAll("button, a[href], [role='button']")].some(rendered),
    ),
  );
  const topLevelActionHosts = [...new Set([...fixedActionHosts, ...flexibleActionHosts])];
  const topLevelActions = topLevelActionHosts.map((host) => ({ box: readBox(host), signature: signature(host) }));
  const moreButtons = menu
    ? [...menu.querySelectorAll("button")].filter(
        (button) =>
          rendered(button) &&
          !button.disabled &&
          !surface?.contains(button) &&
          !button.closest("#flexible-item-buttons") &&
          button.closest("ytd-menu-renderer") === menu,
      )
    : [];

  return {
    boxes: {
      actionSurface: readBox(surface),
      dislikeButton: readBox(dislikeButtons[0]),
      likeButton: readBox(likeButtons[0]),
      menu: readBox(menu),
      moreButton: readBox(moreButtons[0]),
      reactionGroup: readBox(reactionGroup),
      topLevelActionHosts: topLevelActions.map(({ box }) => box),
      topRow: readBox(topRow),
    },
    counts: {
      dislikeButtons: dislikeButtons.length,
      likeButtons: likeButtons.length,
      moreButtons: moreButtons.length,
      reactionGroups: reactionGroup ? 1 : 0,
      visibleMenus: visibleMenus.length,
      visibleSurfaces: visibleSurfaces.length,
    },
    topLevelOptionalSignatures: topLevelActions.map(({ signature: value }) => value),
    videoId: watchRoot?.getAttribute("video-id") ?? null,
    videoMatches: watchRoot?.getAttribute("video-id") === expectedVideoId,
  };
}

function readWatchRatioSurroundings(wrapper) {
  const readBox = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
  };
  const rendered = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) === 0
      ) {
        return false;
      }
    }
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    );
  };
  const directChildOf = (element, parent) => {
    let current = element;
    while (current && current.parentElement !== parent) current = current.parentElement;
    return current?.parentElement === parent ? current : null;
  };

  const surface = wrapper?.parentElement ?? null;
  const topRow = wrapper?.closest("#top-row") ?? null;
  const likeButton = surface?.querySelector(
    "like-button-view-model button, #segmented-like-button button, button#segmented-like-button, #like-button button, ytd-like-button-renderer button",
  );
  const dislikeButton = surface?.querySelector(
    "dislike-button-view-model button, #segmented-dislike-button button, button#segmented-dislike-button, #dislike-button button, ytd-dislike-button-renderer button",
  );
  const likeHost = directChildOf(likeButton, surface);
  const dislikeHost = directChildOf(dislikeButton, surface);
  const reactionGroup = likeHost && likeHost === dislikeHost ? likeHost : null;
  const menu = wrapper?.closest("ytd-menu-renderer.ytd-watch-metadata") ?? null;
  const interactiveCandidates = menu
    ? [...menu.querySelectorAll("button, a[href], [role='button']")].filter(rendered)
    : [];
  const leafInteractiveCandidates = interactiveCandidates.filter(
    (candidate) =>
      !interactiveCandidates.some((descendant) => descendant !== candidate && candidate.contains(descendant)),
  );
  const nearbyActions = leafInteractiveCandidates.filter(
    (candidate) =>
      candidate !== likeButton &&
      candidate !== dislikeButton &&
      !reactionGroup?.contains(candidate) &&
      !wrapper?.contains(candidate),
  );

  return {
    hitArea: readBox(wrapper?.querySelector(".ryd-tooltip-bar-container")),
    nearbyActions: nearbyActions.map(readBox),
    topRow: readBox(topRow),
  };
}

function readWatchRatioAppearance(wrapper, selectors) {
  const container = wrapper?.querySelector(selectors.container) ?? null;
  const bar = wrapper?.querySelector(selectors.bar) ?? null;
  const tooltipHost = wrapper?.querySelector(selectors.tooltip) ?? null;
  const tooltipCandidates = [
    tooltipHost?.shadowRoot?.querySelector("#tooltip"),
    tooltipHost?.querySelector?.("#tooltip"),
    tooltipHost,
  ];
  const tooltip = tooltipCandidates.find((candidate) => candidate?.textContent?.trim()) ?? tooltipHost;
  const containerStyle = container ? getComputedStyle(container) : null;
  const effectiveOpacity = (() => {
    let opacity = 1;
    for (let current = container; current; current = current.parentElement) {
      const value = Number.parseFloat(getComputedStyle(current).opacity);
      if (Number.isFinite(value)) opacity *= value;
    }
    return opacity;
  })();
  const isOpaqueColor = (value) => {
    const color = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!color || color === "transparent") return false;
    const rgb = color.match(/^rgba?\((.*)\)$/u)?.[1];
    if (rgb) {
      const commaParts = rgb.includes(",") ? rgb.split(",").map((part) => part.trim()) : null;
      if (commaParts?.length === 4) return Number.parseFloat(commaParts[3]) >= 0.99;
      const alpha = rgb.match(/\/\s*([\d.]+%?)\s*$/u)?.[1];
      if (alpha) return alpha.endsWith("%") ? Number.parseFloat(alpha) >= 99 : Number.parseFloat(alpha) >= 0.99;
      return true;
    }
    const modernAlpha = color.match(/\/\s*([\d.]+%?)\s*\)$/u)?.[1];
    if (modernAlpha) {
      return modernAlpha.endsWith("%") ? Number.parseFloat(modernAlpha) >= 99 : Number.parseFloat(modernAlpha) >= 0.99;
    }
    return true;
  };

  const containerBox = container?.getBoundingClientRect();
  const barBox = bar?.getBoundingClientRect();
  const probeX = containerBox
    ? Math.min(containerBox.right - 0.5, Math.max(containerBox.left + 0.5, (barBox?.right ?? containerBox.left) + 0.5))
    : 0;
  const probeY = containerBox ? containerBox.top + containerBox.height / 2 : 0;
  const stackedElements =
    containerBox && typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(probeX, probeY) : [];
  const candidates = [
    ...stackedElements.filter((element) => !wrapper?.contains(element)),
    ...(() => {
      const ancestors = [];
      for (let current = wrapper?.parentElement; current; current = current.parentElement) ancestors.push(current);
      return ancestors;
    })(),
    document.body,
    document.documentElement,
  ].filter(Boolean);
  let pageBackgroundColor = null;
  let pageBackgroundSource = null;
  for (const candidate of [...new Set(candidates)]) {
    const color = getComputedStyle(candidate).backgroundColor;
    if (!isOpaqueColor(color)) continue;
    pageBackgroundColor = color;
    pageBackgroundSource = candidate.tagName?.toLowerCase() ?? "unknown";
    break;
  }
  if (!pageBackgroundColor) {
    const rootStyle = getComputedStyle(document.documentElement);
    const fallback = rootStyle.getPropertyValue("--yt-spec-base-background").trim();
    if (isOpaqueColor(fallback)) {
      pageBackgroundColor = fallback;
      pageBackgroundSource = "--yt-spec-base-background";
    }
  }

  return {
    inlineFillWidth: bar?.style.width ?? "",
    negativeTrackBackgroundImage: containerStyle?.backgroundImage ?? "none",
    negativeTrackColor: containerStyle?.backgroundColor ?? "",
    negativeTrackOpacity: effectiveOpacity,
    numberLocale: Intl.NumberFormat().resolvedOptions().locale || navigator.language || "en",
    pageBackgroundColor,
    pageBackgroundSource,
    pageTheme:
      document.documentElement.hasAttribute("dark") || document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light",
    tooltipText: tooltip?.textContent ?? "",
    wrapperVideoId: wrapper?.getAttribute("data-ryd-video-id") ?? null,
  };
}

function isWatchMoreButton(button) {
  const menu = button.closest("ytd-menu-renderer.ytd-watch-metadata");
  const surface = menu?.querySelector("#top-level-buttons-computed");
  if (
    !menu ||
    surface?.contains(button) ||
    button.closest("#flexible-item-buttons") ||
    button.closest("ytd-menu-renderer") !== menu ||
    button.disabled
  )
    return false;
  const rect = button.getBoundingClientRect();
  const style = getComputedStyle(button);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function readOverflowMenuTopology(popup) {
  const readBox = (element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width, x: rect.x, y: rect.y };
  };
  const rendered = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) === 0
      ) {
        return false;
      }
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const normalizeText = (value) => (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const signature = (host) => {
    const text = normalizeText(host.innerText ?? host.textContent);
    if (text) return text;
    const interactive = host.matches("button, a[href], [role='menuitem']")
      ? host
      : host.querySelector("button, a[href], [role='menuitem']");
    return normalizeText(
      interactive?.getAttribute("aria-label") ?? host.getAttribute("aria-label") ?? interactive?.getAttribute("title"),
    );
  };
  const itemSelector = [
    "ytd-menu-service-item-renderer",
    "ytd-menu-navigation-item-renderer",
    "yt-list-item-view-model",
    "[role='menuitem']",
  ].join(", ");
  const candidates = [...popup.querySelectorAll(itemSelector)].filter(rendered);
  const itemHosts = candidates.filter(
    (candidate) =>
      !candidates.some((possibleParent) => possibleParent !== candidate && possibleParent.contains(candidate)),
  );
  return {
    box: readBox(popup),
    itemBoxes: itemHosts.map(readBox),
    signatures: itemHosts.map(signature),
  };
}

function readRenderedElementIndexes(elements) {
  const rendered = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
    let effectiveOpacity = 1;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
    }
    const rect = element.getBoundingClientRect();
    return effectiveOpacity > 0.01 && rect.width > 0 && rect.height > 0;
  };
  return elements.flatMap((element, index) => (rendered(element) ? [index] : []));
}

function readShortsIconVisualState(element) {
  const svg = element.querySelector("svg");
  const svgBox = svg?.getBoundingClientRect() ?? null;
  const paintedGraphicCount = svg
    ? [...svg.querySelectorAll("path, circle, ellipse, line, polygon, polyline, rect")].filter((graphic) => {
        if (graphic.tagName.toLowerCase() !== "path") return true;
        return (graphic.getAttribute("d") ?? "").trim().length > 0;
      }).length
    : 0;
  let effectiveOpacity = 1;
  let rendered = true;
  for (let current = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      rendered = false;
    }
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
  }
  return {
    effectiveOpacity,
    paintedGraphicCount,
    rendered,
    svgHeight: svgBox?.height ?? 0,
    svgPresent: svg !== null,
    svgWidth: svgBox?.width ?? 0,
  };
}

function isShortsIconVisualReady(state) {
  return (
    state?.svgPresent === true &&
    state.svgWidth > 0 &&
    state.svgHeight > 0 &&
    state.paintedGraphicCount > 0 &&
    state.rendered === true &&
    state.effectiveOpacity > 0.01
  );
}

function readCurrentShortsNativeControlState(settings) {
  const { actionBarSelector, minimumActionControlCount = 4, syntheticSelector, videoId } = settings;
  const renderedInViewport = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;

    let effectiveOpacity = 1;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
    }
    if (effectiveOpacity <= 0.01) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    );
  };
  const rendererIdentityVideoIds = (renderer) => {
    const identities = new Set();
    const rendererVideoId = renderer.getAttribute("video-id");
    if (rendererVideoId) identities.add(rendererVideoId);
    const links = [...renderer.querySelectorAll("a[href*='/shorts/']")];
    const canonicalPlayerLinks = links.filter((link) => link.matches("a.ytp-title-link[href*='/shorts/']"));
    const identityLinks = canonicalPlayerLinks.length > 0 ? canonicalPlayerLinks : links;
    for (const link of identityLinks) {
      try {
        const href = link.getAttribute("href");
        if (!href) continue;
        const identity = new URL(href, location.href).pathname.match(/^\/shorts\/([^/]+)\/?$/)?.[1];
        if (identity) identities.add(identity);
      } catch {
        // Ignore malformed or incomplete links while YouTube hydrates the reel.
      }
    }
    return [...identities];
  };
  const rendererMatchesVideo = (renderer) => {
    const identities = rendererIdentityVideoIds(renderer);
    return identities.length === 1 && identities[0] === videoId;
  };
  const activationSelector = "button, a[href], a[role='button'][tabindex='0'], tp-yt-paper-button#button";
  const fallbackActionHostSelector =
    "like-button-view-model, dislike-button-view-model, button-view-model, pivot-button-view-model, yt-button-view-model";
  const likeActionSelector = "like-button-view-model, #like-button, ytd-like-button-renderer, ytm-like-button-renderer";
  const renderedReels = [...document.querySelectorAll("ytd-reel-video-renderer, ytm-reel-video-renderer")].filter(
    renderedInViewport,
  );
  const matchingReels = renderedReels.filter(rendererMatchesVideo);
  const viewport = { height: innerHeight, width: innerWidth };
  const visibleVideoBox = (video) => {
    if (!renderedInViewport(video)) return null;
    const rect = video.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewport.width, rect.right);
    const bottom = Math.min(viewport.height, rect.bottom);
    if (right <= left || bottom <= top) return null;
    return { height: bottom - top, width: right - left, x: left, y: top };
  };
  let currentVideoBox = null;
  let currentVideoVisibleArea = 0;
  for (const reel of matchingReels) {
    for (const video of reel.querySelectorAll("video")) {
      const candidateBox = visibleVideoBox(video);
      const candidateArea = candidateBox ? candidateBox.width * candidateBox.height : 0;
      if (candidateArea > currentVideoVisibleArea) {
        currentVideoBox = candidateBox;
        currentVideoVisibleArea = candidateArea;
      }
    }
  }
  const nativeControls = new Set();
  const matchingNativeControls = new Set();
  const independentActions = new Set();
  const matchingIndependentActions = new Set();
  let completeNativeActionBars = 0;
  let matchingCompleteNativeActionBars = 0;
  let completeIndependentActionBars = 0;
  let matchingCompleteIndependentActionBars = 0;
  const labels = [];
  const independentActionInventory = [];

  for (const reel of renderedReels) {
    const belongsToCurrentVideo = matchingReels.includes(reel);
    for (const actionBar of reel.querySelectorAll(actionBarSelector)) {
      const nativeHosts = [...actionBar.children].filter(
        (host) => !host.matches(syntheticSelector) && !host.querySelector(syntheticSelector),
      );
      const visibleControls = [];
      let hasVisibleReaction = false;
      let allControlsEnabled = true;
      for (const host of nativeHosts) {
        const control = host.matches(activationSelector) ? host : host.querySelector(activationSelector);
        if (!control || !renderedInViewport(control)) {
          allControlsEnabled = false;
          continue;
        }
        visibleControls.push(control);
        if (control.disabled || control.getAttribute("aria-disabled") === "true") allControlsEnabled = false;
        if (
          host.matches(likeActionSelector) ||
          host.querySelector(likeActionSelector) ||
          control.matches(likeActionSelector) ||
          control.closest(likeActionSelector) ||
          control.hasAttribute("aria-pressed")
        ) {
          hasVisibleReaction = true;
        }
        if (!nativeControls.has(control)) {
          nativeControls.add(control);
          if (belongsToCurrentVideo) matchingNativeControls.add(control);
          labels.push(control.getAttribute("aria-label") ?? control.textContent?.replace(/\s+/g, " ").trim() ?? "");
        }
      }
      if (
        nativeHosts.length >= minimumActionControlCount &&
        visibleControls.length === nativeHosts.length &&
        hasVisibleReaction &&
        allControlsEnabled
      ) {
        completeNativeActionBars += 1;
        if (belongsToCurrentVideo) matchingCompleteNativeActionBars += 1;
      }
    }

    // Keep a selector-drift fallback, but anchor it to a structural Like host and
    // its sibling action hosts. Scanning every button in the reel also sees the
    // player's Pause, Mute, and More chrome and can turn a blank rail into a
    // false positive.
    const fallbackSurfaces = new Set();
    for (const likeAction of reel.querySelectorAll(likeActionSelector)) {
      if (likeAction.closest(actionBarSelector) || likeAction.closest(syntheticSelector)) continue;
      const likeHost = likeAction.closest(fallbackActionHostSelector) ?? likeAction;
      if (likeHost.parentElement && reel.contains(likeHost.parentElement)) fallbackSurfaces.add(likeHost.parentElement);
    }
    for (const actionSurface of fallbackSurfaces) {
      const actionHosts = [...actionSurface.children].filter(
        (host) =>
          !host.matches(syntheticSelector) &&
          !host.querySelector(syntheticSelector) &&
          (host.matches(fallbackActionHostSelector) || host.querySelector(fallbackActionHostSelector)),
      );
      const visibleControls = [];
      let allControlsEnabled = true;
      for (const host of actionHosts) {
        const control = host.matches(activationSelector) ? host : host.querySelector(activationSelector);
        if (!control || !renderedInViewport(control)) {
          allControlsEnabled = false;
          continue;
        }
        visibleControls.push(control);
        if (control.disabled || control.getAttribute("aria-disabled") === "true") allControlsEnabled = false;
        if (independentActions.has(control)) continue;
        independentActions.add(control);
        if (belongsToCurrentVideo) matchingIndependentActions.add(control);
        const rect = control.getBoundingClientRect();
        independentActionInventory.push({
          ariaLabel: control.getAttribute("aria-label"),
          className: typeof control.className === "string" ? control.className : "",
          id: control.id || null,
          owningActionBar: control.closest(actionBarSelector)?.tagName?.toLowerCase() ?? null,
          rect: { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
          tagName: control.tagName.toLowerCase(),
          text: (control.innerText ?? control.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
        });
      }
      if (
        actionHosts.length >= minimumActionControlCount &&
        visibleControls.length === actionHosts.length &&
        allControlsEnabled
      ) {
        completeIndependentActionBars += 1;
        if (belongsToCurrentVideo) matchingCompleteIndependentActionBars += 1;
      }
    }
  }

  return {
    completeIndependentActionBars,
    completeNativeActionBars,
    currentVideoId: videoId,
    currentVideoBox,
    independentActionInventory,
    independentActionLabels: independentActionInventory.map(
      (control) => control.ariaLabel ?? control.text ?? `${control.tagName}${control.id ? `#${control.id}` : ""}`,
    ),
    labels,
    matchingCompleteIndependentActionBars,
    matchingCompleteNativeActionBars,
    matchingVisibleIndependentActions: matchingIndependentActions.size,
    matchingRenderedReels: matchingReels.length,
    matchingVisibleNativeControls: matchingNativeControls.size,
    rendererIdentities: renderedReels.map((renderer) => rendererIdentityVideoIds(renderer)),
    renderedReels: renderedReels.length,
    visibleIndependentActions: independentActions.size,
    visibleNativeControls: nativeControls.size,
    viewport,
  };
}

function readShortsReelDiagnosticState(reel, settings) {
  const readBox = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  };
  const renderedInViewport = (element) => {
    if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
    let effectiveOpacity = 1;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
    }
    if (effectiveOpacity <= 0.01) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    );
  };
  const describe = (element) => {
    const ancestors = [];
    for (
      let current = element.parentElement;
      current && current !== reel && ancestors.length < 5;
      current = current.parentElement
    ) {
      ancestors.push({
        className: typeof current.className === "string" ? current.className : "",
        id: current.id || null,
        tagName: current.tagName.toLowerCase(),
      });
    }
    return {
      ancestors,
      ariaDisabled: element.getAttribute("aria-disabled"),
      ariaLabel: element.getAttribute("aria-label"),
      box: readBox(element),
      className: typeof element.className === "string" ? element.className : "",
      disabled: Boolean(element.disabled),
      id: element.id || null,
      renderedInViewport: renderedInViewport(element),
      role: element.getAttribute("role"),
      synthetic: element.closest(settings.syntheticSelector) !== null,
      tagName: element.tagName.toLowerCase(),
      text: (element.innerText ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    };
  };
  const interactiveSelector =
    "button, [role='button'], input[type='button'], input[type='submit'], tp-yt-paper-button#button";
  const interactiveElements = [...reel.querySelectorAll(interactiveSelector)];
  const knownActionBars = [...reel.querySelectorAll(settings.actionBarSelector)];

  return {
    actionBars: knownActionBars.map((actionBar) => ({
      box: readBox(actionBar),
      childCount: actionBar.children.length,
      className: typeof actionBar.className === "string" ? actionBar.className : "",
      id: actionBar.id || null,
      renderedInViewport: renderedInViewport(actionBar),
      tagName: actionBar.tagName.toLowerCase(),
      visibleInteractiveCount: [...actionBar.querySelectorAll(interactiveSelector)].filter(renderedInViewport).length,
    })),
    box: readBox(reel),
    renderedInViewport: renderedInViewport(reel),
    tagName: reel.tagName.toLowerCase(),
    totalInteractiveCount: interactiveElements.length,
    visibleActions: interactiveElements.filter(renderedInViewport).map(describe),
  };
}

async function waitForValue(readValue, predicate, message, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await readValue();
    if (predicate(lastValue)) return lastValue;
    await delay(200);
  }
  throw new Error(`${message}. Last value: ${JSON.stringify(lastValue)}`);
}

async function firstVisible(
  locator,
  label,
  {
    expectedShortVideoId = null,
    requireActiveShort = false,
    requireEnabled = false,
    requireViewport = false,
    timeout = 20_000,
  } = {},
) {
  return waitForValue(
    async () => {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (!(await candidate.isVisible())) continue;
        if (requireEnabled && !(await candidate.isEnabled())) continue;
        if (requireActiveShort || requireViewport) {
          const eligibilityState = await candidate.evaluate(readShortsRendererIdentityState, { expectedShortVideoId });
          if (
            !isShortCandidateEligibilityState(eligibilityState, {
              activeShortRequired: requireActiveShort,
              expectedShortVideoId,
            })
          )
            continue;
        }
        return candidate;
      }
      return null;
    },
    Boolean,
    `Timed out waiting for visible ${label}`,
    timeout,
  );
}

async function visibleLocatorIndexes(locator) {
  const indexes = [];
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible()) indexes.push(index);
  }
  return indexes;
}

async function currentWatchMoreButtons(menu) {
  const buttons = menu.locator("button");
  const matches = [];
  for (let index = 0; index < (await buttons.count()); index += 1) {
    const candidate = buttons.nth(index);
    if (!(await candidate.isVisible()) || !(await candidate.isEnabled())) continue;
    if (await candidate.evaluate(isWatchMoreButton)) matches.push(candidate);
  }
  return matches;
}

async function visibleWatchOverflowMenu(page) {
  const menus = page.locator(WATCH_OVERFLOW_POPUP_SELECTOR);
  const visibleIndexes = await menus.evaluateAll(readRenderedElementIndexes);
  return visibleIndexes.length > 0
    ? {
        locator: menus.nth(visibleIndexes[0]),
        selector: WATCH_OVERFLOW_POPUP_SELECTOR,
        visibleCount: visibleIndexes.length,
      }
    : null;
}

async function firstVisibleWatchOverflowMenu(page, timeout = 20_000) {
  return waitForValue(
    () => visibleWatchOverflowMenu(page),
    Boolean,
    "Timed out waiting for the visible Watch More-actions menu",
    timeout,
  );
}

function relatedWatchVideoId(element, settings) {
  try {
    const url = new URL(element.getAttribute("href"), settings.origin);
    const videoId = url.searchParams.get("v");
    if (url.origin !== settings.origin || url.pathname !== "/watch") return null;
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return null;
    if (videoId === settings.currentVideoId || settings.excludedVideoIds.includes(videoId)) return null;
    return videoId;
  } catch {
    return null;
  }
}

async function firstVisibleRelatedWatchLink(page, currentVideoId, excludedVideoIds, timeout = 30_000) {
  const locator = page.locator(RELATED_WATCH_LINK_SELECTOR);
  const origin = new URL(page.url()).origin;
  return waitForValue(
    async () => {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (!(await candidate.isVisible())) continue;
        const videoId = await candidate.evaluate(relatedWatchVideoId, {
          currentVideoId,
          excludedVideoIds,
          origin,
        });
        if (videoId) return { link: candidate, videoId };
      }
      return null;
    },
    Boolean,
    `Timed out waiting for a visible unvisited #related watch link after ${currentVideoId}`,
    timeout,
  );
}

async function firstActionableUnvisitedWatchLink(
  page,
  selector,
  currentVideoId,
  excludedVideoIds,
  label,
  timeout = 30_000,
) {
  const locator = page.locator(selector);
  const origin = new URL(page.url()).origin;
  let lastFailure = null;
  const state = await waitForValue(
    async () => {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        try {
          if (!(await candidate.isVisible())) continue;
          const videoId = await candidate.evaluate(relatedWatchVideoId, {
            currentVideoId,
            excludedVideoIds,
            origin,
          });
          if (!videoId) continue;
          const actionability = await waitForSettledNavigationLinkActionability(candidate, {
            expectedKind: "watch",
            expectedVideoId: videoId,
            label,
            origin,
            timeout: 5_000,
          });
          return { lastFailure, result: { actionability, link: candidate, videoId } };
        } catch (error) {
          lastFailure = error;
        }
      }
      return { lastFailure: lastFailure?.message ?? null, result: null };
    },
    (candidateState) => Boolean(candidateState.result),
    `Timed out waiting for an actionable unvisited ${label}`,
    timeout,
  );
  return state.result;
}

function isExactVideoLinkTarget(element, target) {
  try {
    const url = new URL(element.getAttribute("href"), target.origin);
    if (url.origin !== target.origin) return false;
    if (target.kind === "short") return url.pathname === `/shorts/${target.videoId}`;
    return url.pathname === "/watch" && url.searchParams.get("v") === target.videoId;
  } catch {
    return false;
  }
}

function channelTabUrl(channelUrl, kind) {
  assert.ok(kind === "short" || kind === "watch", `Unsupported channel-navigation kind: ${kind}`);
  const url = new URL(channelUrl);
  const channelPath = url.pathname.replace(/\/$/, "").replace(/\/(?:featured|shorts|videos)$/, "");
  url.pathname = `${channelPath}/${kind === "short" ? "shorts" : "videos"}`;
  return url;
}

function isExactVideoUrl(value, { kind, origin, videoId }) {
  try {
    const url = value instanceof URL ? value : new URL(value);
    if (url.origin !== origin) return false;
    if (kind === "short") return url.pathname === `/shorts/${videoId}`;
    return url.pathname === "/watch" && url.searchParams.get("v") === videoId;
  } catch {
    return false;
  }
}

async function firstVisibleExactVideoLink(page, videoId, kind, timeout = 30_000) {
  const locator = page.locator(kind === "short" ? 'a[href*="/shorts/"]' : 'a[href*="/watch"]');
  const origin = new URL(page.url()).origin;
  return waitForValue(
    async () => {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (!(await candidate.isVisible())) continue;
        const isExactTarget = await candidate.evaluate(isExactVideoLinkTarget, { kind, origin, videoId });
        if (isExactTarget) return candidate;
      }
      return null;
    },
    Boolean,
    `Timed out waiting for an exact visible ${kind} link for ${videoId} on the configured channel page`,
    timeout,
  );
}

async function clickStabilizedExactVideoLink(
  page,
  videoId,
  kind,
  {
    activation = "pointer",
    label = `exact ${kind} link for ${videoId}`,
    origin = new URL(page.url()).origin,
    pollInterval = CHANNEL_TARGET_RETRY_INTERVAL_MS,
    selector = kind === "short" ? 'a[href*="/shorts/"]' : 'a[href*="/watch"]',
    timeout = CHANNEL_TARGET_ACTIVATION_TIMEOUT,
  } = {},
) {
  assert.ok(kind === "short" || kind === "watch", `Unsupported exact-link navigation kind: ${kind}`);
  assert.ok(VIDEO_ID_PATTERN.test(videoId), `Invalid exact-link navigation video ID: ${videoId}`);
  assert.ok(
    activation === "pointer" || activation === "trusted-pointer" || activation === "keyboard",
    `Unsupported exact-link activation method: ${activation}`,
  );

  const locator = page.locator(selector);
  const deadline = Date.now() + timeout;
  let exactCandidateCount = 0;
  let lastFailure = null;

  do {
    let count;
    try {
      count = await locator.count();
    } catch (error) {
      lastFailure = error;
      count = 0;
    }

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      try {
        if (!(await candidate.isVisible())) continue;
        if (!(await candidate.evaluate(isExactVideoLinkTarget, { kind, origin, videoId }))) continue;
        exactCandidateCount += 1;
        const activationOptions = {
          expectedKind: kind,
          expectedVideoId: videoId,
          label,
          origin,
          timeout: Math.max(1, Math.min(5_000, deadline - Date.now())),
        };
        if (activation === "pointer") {
          return await clickHitTestedNavigationLink(candidate, activationOptions);
        }

        let actionability = await waitForSettledNavigationLinkActionability(candidate, activationOptions);
        if (activation === "trusted-pointer") {
          await candidate.click({ timeout: activationOptions.timeout });
          return actionability;
        }

        await candidate.focus({ timeout: activationOptions.timeout });
        actionability = await candidate.evaluate(
          readElementActionability,
          { includeHref: true, scroll: false },
          { timeout: activationOptions.timeout },
        );
        assertNavigationLinkTarget(actionability, {
          expectedKind: kind,
          expectedVideoId: videoId,
          label,
          origin,
        });
        assertNavigationLinkActionable(actionability, label);
        await candidate.press("Enter", { timeout: activationOptions.timeout });
        return actionability;
      } catch (error) {
        // Channel shelves can replace an exact-target anchor or briefly mark
        // it hidden while their carousel/hydration settles. Re-resolve every
        // exact candidate, but never click one that fails the strict center
        // hit test immediately before activation.
        lastFailure = error;
      }
    }

    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(pollInterval, remaining));
  } while (Date.now() < deadline);

  const lastFailureMessage = lastFailure ? ` Last failure: ${lastFailure.message}` : "";
  throw new Error(
    `Timed out waiting for an actionable exact ${kind} link for ${videoId}; observed ${exactCandidateCount} exact candidate checks.${lastFailureMessage}`,
    lastFailure ? { cause: lastFailure } : undefined,
  );
}

function readElementActionability(element, { includeHref = false, scroll = true } = {}) {
  if (scroll) element.scrollIntoView?.({ block: "center", inline: "nearest" });

  const ownerDocument = element.ownerDocument;
  const view = ownerDocument.defaultView ?? window;
  const rect = element.getBoundingClientRect();
  const viewportHeight = view.innerHeight || ownerDocument.documentElement.clientHeight;
  const viewportWidth = view.innerWidth || ownerDocument.documentElement.clientWidth;
  const describeElement = (candidate) =>
    candidate
      ? {
          ariaHidden: candidate.getAttribute("aria-hidden"),
          className: typeof candidate.className === "string" ? candidate.className : "",
          hidden: Boolean(candidate.hidden),
          id: candidate.id || null,
          inert: Boolean(candidate.inert || candidate.hasAttribute("inert")),
          tagName: candidate.tagName.toLowerCase(),
        }
      : null;
  const semanticVisibilityBlocker = element.closest("[hidden], [aria-hidden='true'], [inert]");
  let computedVisibilityBlocker = null;
  let visible = element.isConnected && !semanticVisibilityBlocker;
  let effectiveOpacity = 1;
  for (let current = element; visible && current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      computedVisibilityBlocker = current;
      visible = false;
      break;
    }
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
  }
  visible = Boolean(visible && effectiveOpacity > 0.01 && rect.width > 0 && rect.height > 0);

  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const centerInViewport = center.x >= 0 && center.y >= 0 && center.x < viewportWidth && center.y < viewportHeight;
  const enabled = !element.disabled && element.getAttribute("aria-disabled") !== "true";
  const hitTarget =
    visible && centerInViewport && typeof ownerDocument.elementFromPoint === "function"
      ? ownerDocument.elementFromPoint(center.x, center.y)
      : null;
  const centerHitTarget = Boolean(hitTarget && (hitTarget === element || element.contains(hitTarget)));

  return {
    center,
    centerHitTarget,
    centerInViewport,
    computedVisibilityBlocker: describeElement(computedVisibilityBlocker),
    connected: element.isConnected,
    effectiveOpacity,
    enabled,
    href: includeHref ? element.getAttribute("href") : null,
    hitTarget: hitTarget
      ? {
          className: typeof hitTarget.className === "string" ? hitTarget.className : "",
          id: hitTarget.id || null,
          tagName: hitTarget.tagName.toLowerCase(),
        }
      : null,
    rect: { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
    semanticVisibilityBlocker: describeElement(semanticVisibilityBlocker),
    visible,
    viewport: { height: viewportHeight, width: viewportWidth },
  };
}

function scrollElementIntoViewAndWaitForPaint(element) {
  element.scrollIntoView?.({ block: "center", inline: "nearest" });
  const scheduleFrame = element.ownerDocument?.defaultView?.requestAnimationFrame;
  if (typeof scheduleFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => scheduleFrame(() => scheduleFrame(resolve)));
}

async function readSettledElementActionability(element, { includeHref = false, timeout = 5_000 } = {}) {
  await element.evaluate(scrollElementIntoViewAndWaitForPaint, undefined, { timeout });
  return element.evaluate(readElementActionability, { includeHref, scroll: false }, { timeout });
}

function readNavigationLinkActionability(element) {
  return readElementActionability(element, { includeHref: true });
}

function assertElementActionable(state, label) {
  assert.equal(state?.connected, true, `${label} became disconnected before activation.`);
  assert.equal(state?.visible, true, `${label} is not visibly rendered: ${JSON.stringify(state)}.`);
  assert.equal(state?.centerInViewport, true, `${label} center is outside the viewport: ${JSON.stringify(state)}.`);
  assert.equal(state?.enabled, true, `${label} is disabled.`);
  assert.equal(
    state?.centerHitTarget,
    true,
    `${label} center is covered by another element: ${JSON.stringify(state?.hitTarget ?? null)}.`,
  );
  return state;
}

const assertNavigationLinkActionable = assertElementActionable;

function assertElementReadyForViewportMeasurement(state, label) {
  assert.equal(state?.connected, true, `${label} became disconnected before measurement.`);
  assert.equal(state?.visible, true, `${label} is not visibly rendered: ${JSON.stringify(state)}.`);
  assert.equal(state?.centerInViewport, true, `${label} center is outside the viewport: ${JSON.stringify(state)}.`);
  return state;
}

async function prepareElementForViewportMeasurement(element, label, { timeout = 5_000 } = {}) {
  const state = await readSettledElementActionability(element, { timeout });
  return assertElementReadyForViewportMeasurement(state, label);
}

async function clickHitTestedElement(element, { beforeClick = null, label = "control", timeout = 5_000 } = {}) {
  const actionability = await readSettledElementActionability(element, { timeout });
  assertElementActionable(actionability, label);
  if (beforeClick) await beforeClick(actionability);
  // Skip only Playwright's stability waiter after independently proving that
  // the intended control is visible, enabled, in-viewport, and hit-testable.
  await element.click({ force: true, timeout });
  return actionability;
}

async function pressHitTestedElement(element, { beforePress = null, label = "control", timeout = 5_000 } = {}) {
  const actionability = await readSettledElementActionability(element, { timeout });
  assertElementActionable(actionability, label);
  await element.focus({ timeout });
  const focusedActionability = await element.evaluate(readElementActionability, { scroll: false }, { timeout });
  assertElementActionable(focusedActionability, label);
  if (beforePress) await beforePress(focusedActionability);
  await element.press("Enter", { timeout });
  return focusedActionability;
}

function assertNavigationLinkTarget(state, { expectedKind, expectedVideoId, label, origin }) {
  let url;
  try {
    url = new URL(state?.href, origin);
  } catch {
    assert.fail(`${label} has an invalid target URL: ${state?.href ?? "missing"}.`);
  }
  assert.equal(url.origin, origin, `${label} unexpectedly targets another origin.`);
  if (expectedKind === "short") {
    assert.equal(url.pathname, `/shorts/${expectedVideoId}`, `${label} changed to another Shorts target.`);
  } else {
    assert.equal(url.pathname, "/watch", `${label} changed to a non-Watch target.`);
    assert.equal(url.searchParams.get("v"), expectedVideoId, `${label} changed to another Watch video.`);
  }
  return state;
}

async function waitForSettledNavigationLinkActionability(
  link,
  {
    expectedKind = null,
    expectedVideoId = null,
    label = "navigation link",
    origin = "https://www.youtube.com",
    timeout = 5_000,
  } = {},
) {
  await link.evaluate(scrollElementIntoViewAndWaitForPaint, undefined, { timeout });
  const deadline = Date.now() + timeout;
  let actionability = null;
  do {
    const remaining = Math.max(1, deadline - Date.now());
    actionability = await link.evaluate(
      readElementActionability,
      { includeHref: true, scroll: false },
      { timeout: Math.min(1_000, remaining) },
    );
    if (expectedVideoId !== null) {
      assertNavigationLinkTarget(actionability, { expectedKind, expectedVideoId, label, origin });
    }
    if (
      !actionability?.connected ||
      actionability.semanticVisibilityBlocker ||
      actionability.computedVisibilityBlocker ||
      !actionability.enabled ||
      !actionability.centerInViewport
    ) {
      assertNavigationLinkActionable(actionability, label);
    }
    if (
      actionability.visible &&
      actionability.centerInViewport &&
      actionability.enabled &&
      actionability.centerHitTarget
    ) {
      break;
    }
    if (Date.now() < deadline) await delay(Math.min(50, deadline - Date.now()));
  } while (Date.now() < deadline);

  assertNavigationLinkActionable(actionability, label);
  return actionability;
}

async function clickHitTestedNavigationLink(link, options = {}) {
  const timeout = options.timeout ?? 5_000;
  const actionability = await waitForSettledNavigationLinkActionability(link, options);
  // YouTube can keep a visible link in continuous layout motion. `force` skips
  // that native stability waiter only after our explicit safety checks pass.
  await link.click({ force: true, timeout });
  return actionability;
}

async function clickWithSingleNavigationRetry({
  click,
  failureMessage = "YouTube did not navigate after the first Shorts Next click or its single retry.",
  firstTimeout = SHORTS_NEXT_FIRST_CLICK_TIMEOUT,
  hasNavigated,
  reportProgress,
  retryProgressEvent = "shorts-next-control.retrying",
  retryDetails,
  retryTimeout = SHORTS_NEXT_RETRY_TIMEOUT,
  waitForNavigation,
}) {
  const runAttempt = async (attempt, timeout) => {
    const [navigationResult, clickResult] = await Promise.allSettled([
      waitForNavigation(timeout),
      click(attempt, timeout),
    ]);
    if (navigationResult.status === "fulfilled" && clickResult.status === "fulfilled") return;
    throw navigationResult.status === "rejected" ? navigationResult.reason : clickResult.reason;
  };
  let firstError;
  try {
    await runAttempt(1, firstTimeout);
    return { retried: false };
  } catch (error) {
    firstError = error;
    if (hasNavigated()) return { retried: false };
  }

  reportProgress(retryProgressEvent, {
    ...retryDetails,
    firstFailure: String(firstError?.message ?? firstError),
    firstTimeoutMs: firstTimeout,
    retryTimeoutMs: retryTimeout,
  });
  try {
    await runAttempt(2, retryTimeout);
    return { retried: true };
  } catch (retryError) {
    if (hasNavigated()) return { retried: true };
    throw new Error(
      `${failureMessage} First failure: ${String(firstError?.message ?? firstError)}. Retry failure: ${String(retryError?.message ?? retryError)}`,
      { cause: retryError },
    );
  }
}

function videoIdFromUrl(value) {
  const url = new URL(value);
  if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
  return url.searchParams.get("v");
}

function readJsonBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return null;
  }
}

function assertLogicalVoteHandshake(records, videoId, value) {
  assert.ok(
    records.length >= 2 && records.length <= 4,
    `Expected one to three vote puzzle requests followed by one confirmation; received ${records.length} interaction requests.`,
  );
  const voteCount = records.length - 1;
  assert.deepEqual(
    records.map((record) => record.pathname),
    [...Array(voteCount).fill("/interact/vote"), "/interact/confirmVote"],
    "A logical vote may make at most three matching puzzle requests, then must send exactly one confirmation and no other interaction traffic.",
  );

  const votes = records.slice(0, voteCount);
  const confirmation = records[voteCount];
  const userId = votes[0]?.body?.userId;
  assert.match(userId ?? "", USER_ID_PATTERN, "The vote request must use a 36-character protocol user ID.");
  for (const vote of votes) {
    assert.equal(
      hasExactKeys(vote.body, ["userId", "value", "videoId"]),
      true,
      "The vote request body must contain exactly userId, value, and videoId.",
    );
    assert.equal(vote.body?.userId, userId, "Vote puzzle retries used different user IDs.");
    assert.equal(vote.body?.videoId, videoId, "Vote puzzle retry targeted a different video.");
    assert.equal(vote.body?.value, value, "Vote puzzle retry changed the requested vote value.");
    assert.ok(vote.status >= 200 && vote.status < 300, `Vote request failed with HTTP ${vote.status}.`);
    assert.equal(vote.responseError, null, `Vote response could not be read: ${vote.responseError}`);
  }

  assert.equal(
    hasExactKeys(confirmation.body, ["solution", "userId", "videoId"]),
    true,
    "The confirmation body must contain exactly solution, userId, and videoId.",
  );
  assert.equal(confirmation.body?.userId, userId, "Vote and confirmation used different user IDs.");
  assert.equal(confirmation.body?.videoId, videoId, "Vote confirmation targeted a different video.");
  assert.equal(
    isFourByteProofSolution(confirmation.body?.solution),
    true,
    "The vote confirmation must contain one canonical base64-encoded four-byte proof.",
  );
  assert.ok(
    confirmation.status >= 200 && confirmation.status < 300,
    `Vote confirmation failed with HTTP ${confirmation.status}.`,
  );
  assert.equal(
    confirmation.responseError,
    null,
    `Confirmation response could not be read: ${confirmation.responseError}`,
  );
  assert.equal(confirmation.responseBody, true, "The production API did not confirm the vote.");
  assert.equal(
    isVoteProtocolBodyPairValid(votes[0].body, confirmation.body, { value, videoId }),
    true,
    "The live vote handshake did not match the shared hermetic protocol contract.",
  );
  return userId;
}

function assertVisibleBox(box, label) {
  assert.ok(box, `${label} has no rendered bounding box.`);
  assert.ok(box.width > 0 && box.height > 0, `${label} has non-positive geometry: ${JSON.stringify(box)}`);
}

function assertBoxInsideViewport(box, viewport, label, tolerance = 1) {
  assertVisibleBox(box, label);
  const geometry = ` box=${JSON.stringify(box)} viewport=${JSON.stringify(viewport)} tolerance=${tolerance}`;
  assert.ok(box.x >= -tolerance, `${label} is clipped past the viewport's left edge.${geometry}`);
  assert.ok(box.y >= -tolerance, `${label} is clipped past the viewport's top edge.${geometry}`);
  assert.ok(
    box.x + box.width <= viewport.width + tolerance,
    `${label} is clipped past the viewport's right edge.${geometry}`,
  );
  assert.ok(
    box.y + box.height <= viewport.height + tolerance,
    `${label} is clipped past the viewport's bottom edge.${geometry}`,
  );
}

function assertShortsActionStackGeometry(boxes, viewport, tolerance = 1) {
  assert.ok(Array.isArray(boxes), "The Shorts action-stack geometry is missing.");
  assert.ok(boxes.length >= 5, `Expected the full Shorts action stack; found only ${boxes.length} visible controls.`);
  const center = boxCenterX(boxes[0]);
  boxes.forEach((box, index) => {
    const label = `Shorts action ${index + 1}`;
    assertBoxInsideViewport(box, viewport, label, tolerance);
    assertNear(boxCenterX(box), center, tolerance, `${label} horizontal center`);
    if (index > 0) {
      const previous = boxes[index - 1];
      assert.ok(box.y >= previous.y + previous.height - tolerance, `${label} overlaps the preceding Shorts action.`);
    }
  });
}

function assertWatchRatioViewportAlignment(containerBox, likeBox, dislikeBox, viewport, tolerance = 1) {
  assertVisibleBox(containerBox, "Watch ratio bar");
  assertVisibleBox(likeBox, "Watch like control");
  assertVisibleBox(dislikeBox, "Watch dislike control");
  const controls = [likeBox, dislikeBox];
  const nativeLeft = Math.min(...controls.map((box) => box.x));
  const nativeRight = Math.max(...controls.map((box) => box.x + box.width));
  const nativeControlsAreHorizontallyClipped = nativeLeft < -tolerance || nativeRight > viewport.width + tolerance;
  for (const [box, label] of [
    [likeBox, "Watch like control"],
    [dislikeBox, "Watch dislike control"],
    [containerBox, "Watch ratio bar"],
  ]) {
    assertBoxInsideViewport(box, viewport, label, tolerance);
  }
  return { nativeControlsAreHorizontallyClipped, nativeLeft, nativeRight };
}

function assertWatchRatioSurroundings(surroundings, viewport, tolerance = 1) {
  assert.ok(surroundings && typeof surroundings === "object", "The Watch ratio-bar surroundings are missing.");
  assertVisibleBox(surroundings.topRow, "Watch top row");
  assertBoxInsideViewport(surroundings.hitArea, viewport, "Watch ratio bar hit area", tolerance);
  assert.ok(Array.isArray(surroundings.nearbyActions), "The nearby Watch action geometry is missing.");
  surroundings.nearbyActions.forEach((actionBox, index) => {
    const label = `Watch nearby action ${index + 1}`;
    assertBoxInsideViewport(actionBox, viewport, label, tolerance);
    assert.equal(boxesOverlap(surroundings.hitArea, actionBox, 0), false, `${label} overlaps the ratio bar hit area.`);
  });
  return surroundings;
}

function sortedSignatures(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function duplicateSignatures(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return sortedSignatures(duplicates);
}

function boxesOverlap(first, second, tolerance = 1) {
  if (!first || !second) return false;
  const horizontal = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const vertical = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  return horizontal > tolerance && vertical > tolerance;
}

function assertBoxInsideBox(child, parent, label, tolerance = 2) {
  assertVisibleBox(child, label);
  assertVisibleBox(parent, `${label} parent`);
  assert.ok(child.x >= parent.x - tolerance, `${label} escapes the top row on the left.`);
  assert.ok(child.y >= parent.y - tolerance, `${label} escapes the top row above.`);
  assert.ok(child.x + child.width <= parent.x + parent.width + tolerance, `${label} escapes the top row on the right.`);
  assert.ok(child.y + child.height <= parent.y + parent.height + tolerance, `${label} escapes the top row below.`);
}

function assertWatchActionTopologySnapshot(
  snapshot,
  {
    expectedInventorySignatures = null,
    expectedTopLevelOptionalSignatures = null,
    minimumTopLevelOptionalActions = 0,
  } = {},
) {
  assert.ok(snapshot && typeof snapshot === "object", "The Watch action-topology snapshot is missing.");
  assert.match(snapshot.videoId ?? "", VIDEO_ID_PATTERN, "The Watch action topology has no current video ID.");
  assert.equal(snapshot.videoMatches, true, "The visible Watch action row belongs to a stale video root.");
  assert.equal(snapshot.counts?.visibleCurrentWatchRoots, 1, "Expected exactly one visible current-video Watch root.");
  assert.equal(snapshot.counts?.visibleTopRows, 1, "Expected exactly one visible current-video Watch top row.");
  assert.equal(snapshot.counts?.visibleMenus, 1, "Expected exactly one visible current Watch action menu.");
  assert.equal(snapshot.counts?.visibleSurfaces, 1, "Expected exactly one visible current Watch action surface.");
  assert.equal(snapshot.counts?.reactionGroups, 1, "Expected exactly one visible Like/Dislike reaction group.");
  assert.equal(snapshot.counts?.likeButtons, 1, "Expected exactly one visible Like button in the reaction group.");
  assert.equal(
    snapshot.counts?.dislikeButtons,
    1,
    "Expected exactly one visible Dislike button in the reaction group.",
  );
  assert.equal(snapshot.counts?.moreButtons, 1, "Expected exactly one visible More-actions button.");
  assert.equal(
    snapshot.counts?.visibleOverflowMenus,
    1,
    "Expected exactly one visible More-actions menu after opening it.",
  );

  const topLevel = snapshot.topLevelOptionalSignatures ?? [];
  const overflow = snapshot.overflowSignatures ?? [];
  assert.ok(
    Number.isSafeInteger(minimumTopLevelOptionalActions) && minimumTopLevelOptionalActions >= 0,
    "The minimum top-level action count must be a non-negative integer.",
  );
  assert.ok(
    topLevel.length >= minimumTopLevelOptionalActions,
    `Expected at least ${minimumTopLevelOptionalActions} optional action(s) at top level; found ${topLevel.length}.`,
  );
  assert.ok(overflow.length > 0, "The visible More-actions menu contains no discoverable actions.");
  for (const [location, signatures] of [
    ["top level", topLevel],
    ["More menu", overflow],
  ]) {
    assert.ok(
      signatures.every((value) => typeof value === "string" && value.trim() !== ""),
      `A visible ${location} action has no accessible signature.`,
    );
    assert.deepEqual(duplicateSignatures(signatures), [], `Duplicate actions are visible in the ${location}.`);
  }
  const crossLocationDuplicates = sortedSignatures(new Set(topLevel.filter((value) => overflow.includes(value))));
  assert.deepEqual(
    crossLocationDuplicates,
    [],
    "The same optional action is visible both at top level and in the More menu.",
  );

  const inventory = sortedSignatures([...topLevel, ...overflow]);
  assert.deepEqual(snapshot.inventorySignatures, inventory, "The Watch action inventory snapshot is inconsistent.");
  if (expectedInventorySignatures !== null) {
    assert.deepEqual(
      inventory,
      sortedSignatures(expectedInventorySignatures),
      "A Watch action disappeared or duplicated while the layout changed.",
    );
  }
  if (expectedTopLevelOptionalSignatures !== null) {
    assert.deepEqual(
      sortedSignatures(topLevel),
      sortedSignatures(expectedTopLevelOptionalSignatures),
      "The top-level Watch actions did not return to their baseline layout.",
    );
  }

  const { boxes, viewport } = snapshot;
  assertVisibleBox(boxes?.topRow, "Watch top row");
  assertVisibleBox(boxes?.menu, "Watch action menu");
  assertVisibleBox(boxes?.actionSurface, "Watch top-level action surface");
  assertVisibleBox(boxes?.reactionGroup, "Watch reaction group");
  assertVisibleBox(boxes?.likeButton, "Watch Like button");
  assertVisibleBox(boxes?.dislikeButton, "Watch Dislike button");
  assertVisibleBox(boxes?.moreButton, "Watch More-actions button");
  assertVisibleBox(snapshot.overflowBox, "Watch More-actions menu");
  assertBoxInsideViewport(boxes.topRow, viewport, "Watch top row", 2);
  assertBoxInsideViewport(snapshot.overflowBox, viewport, "Watch More-actions menu", 2);
  assertBoxInsideViewport(boxes.menu, viewport, "Watch action menu", 2);
  assertBoxInsideBox(boxes.menu, boxes.topRow, "Watch action menu", 5);
  for (const [box, label] of [
    [boxes.actionSurface, "Watch top-level action surface"],
    [boxes.reactionGroup, "Watch reaction group"],
    [boxes.likeButton, "Watch Like button"],
    [boxes.dislikeButton, "Watch Dislike button"],
    [boxes.moreButton, "Watch More-actions button"],
    ...(boxes.topLevelActionHosts ?? []).map((box, index) => [box, `Watch top-level optional action ${index + 1}`]),
  ]) {
    assertBoxInsideViewport(box, viewport, label, 2);
    assertBoxInsideBox(box, boxes.topRow, label);
  }
  assert.equal(boxesOverlap(boxes.likeButton, boxes.dislikeButton), false, "Watch Like and Dislike buttons overlap.");
  const topLevelHosts = [boxes.reactionGroup, ...(boxes.topLevelActionHosts ?? []), boxes.moreButton];
  for (let left = 0; left < topLevelHosts.length; left += 1) {
    for (let right = left + 1; right < topLevelHosts.length; right += 1) {
      assert.equal(
        boxesOverlap(topLevelHosts[left], topLevelHosts[right]),
        false,
        `Watch top-row controls ${left + 1} and ${right + 1} overlap.`,
      );
    }
  }
  const overflowItemBoxes = snapshot.overflowItemBoxes ?? [];
  assert.equal(
    overflowItemBoxes.length,
    overflow.length,
    "The visible More-actions inventory and its rendered item geometry are inconsistent.",
  );
  overflowItemBoxes.forEach((box, index) => assertVisibleBox(box, `Watch More-actions item ${index + 1}`));
  for (let left = 0; left < overflowItemBoxes.length; left += 1) {
    for (let right = left + 1; right < overflowItemBoxes.length; right += 1) {
      assert.equal(
        boxesOverlap(overflowItemBoxes[left], overflowItemBoxes[right]),
        false,
        `Watch More-actions items ${left + 1} and ${right + 1} overlap.`,
      );
    }
  }
  return snapshot;
}

function croppedScreenshotClip(boxes, viewport, margin = 12) {
  boxes.forEach((box, index) => assertVisibleBox(box, `Screenshot target ${index + 1}`));
  const left = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.x)) - margin));
  const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.y)) - margin));
  const right = Math.min(viewport.width, Math.ceil(Math.max(...boxes.map((box) => box.x + box.width)) + margin));
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(...boxes.map((box) => box.y + box.height)) + margin));
  assert.ok(right > left && bottom > top, "The cropped screenshot target is outside the viewport.");
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function boxIntersectionWithViewport(box, viewport) {
  if (!box) return null;
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(viewport.width, box.x + box.width);
  const bottom = Math.min(viewport.height, box.y + box.height);
  if (right <= left || bottom <= top) return null;
  return { height: bottom - top, width: right - left, x: left, y: top };
}

function squaredDistanceFromBox(point, box) {
  const deltaX = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const deltaY = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return deltaX * deltaX + deltaY * deltaY;
}

function pointerPositionAwayFromBoxes(boxes, viewport, preferredBox = null) {
  const visiblePreferredBox = boxIntersectionWithViewport(preferredBox, viewport);
  if (visiblePreferredBox) {
    const preferredCandidates = [
      { x: 0.5, y: 0.5 },
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.25, y: 0.75 },
      { x: 0.75, y: 0.75 },
      { x: 0.5, y: 0.25 },
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
      { x: 0.5, y: 0.75 },
    ].map((position) => ({
      x: visiblePreferredBox.x + visiblePreferredBox.width * position.x,
      y: visiblePreferredBox.y + visiblePreferredBox.height * position.y,
    }));
    const safePreferredCandidates = preferredCandidates.filter((point) =>
      boxes.every((box) => squaredDistanceFromBox(point, box) > 0),
    );
    if (safePreferredCandidates.length > 0) {
      return safePreferredCandidates[0];
    }
  }

  const fallbackCandidates = [
    { x: viewport.width * 0.25, y: viewport.height * 0.25 },
    { x: viewport.width * 0.5, y: viewport.height * 0.25 },
    { x: viewport.width * 0.75, y: viewport.height * 0.25 },
    { x: viewport.width * 0.25, y: viewport.height * 0.5 },
    { x: viewport.width * 0.5, y: viewport.height * 0.5 },
    { x: viewport.width * 0.75, y: viewport.height * 0.5 },
    { x: viewport.width * 0.25, y: viewport.height * 0.75 },
    { x: viewport.width * 0.5, y: viewport.height * 0.75 },
    { x: viewport.width * 0.75, y: viewport.height * 0.75 },
  ];
  const ranked = fallbackCandidates
    .map((point) => ({
      distance: Math.min(...boxes.map((box) => squaredDistanceFromBox(point, box))),
      point,
    }))
    .sort((left, right) => right.distance - left.distance);
  assert.ok(ranked[0]?.distance > 0, "Could not place the screenshot pointer away from the reaction controls.");
  return ranked[0].point;
}

function assertNear(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label} is not a finite number: ${actual}`);
  assert.ok(Number.isFinite(expected), `${label} has no finite reference value: ${expected}`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} must be ${expected} +/- ${tolerance}px; received ${actual}px.`,
  );
}

function boxCenterX(box) {
  return box.x + box.width / 2;
}

function boxCenterY(box) {
  return box.y + box.height / 2;
}

function assertBoxSize(box, width, height, label, tolerance = SHORTS_GEOMETRY.geometryTolerance) {
  assertVisibleBox(box, label);
  assertNear(box.width, width, tolerance, `${label} width`);
  assertNear(box.height, height, tolerance, `${label} height`);
}

function assertHorizontallyContains(outer, inner, outerLabel, innerLabel, tolerance) {
  assert.ok(
    inner.x >= outer.x - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance,
    `${outerLabel} does not horizontally contain ${innerLabel}.`,
  );
}

function assertShortsControlShellGeometry(control, label, { nativeColumnWidth = null, reference = null } = {}) {
  assertVisibleBox(control.host, `${label} action host`);
  assertVisibleBox(control.label, `${label} label`);
  assertVisibleBox(control.button, `${label} button`);
  assertVisibleBox(control.count, `${label} count`);

  const tolerance = SHORTS_GEOMETRY.geometryTolerance;
  if (reference) {
    assertNear(
      control.host.height,
      reference.host.height,
      tolerance,
      `${label} action host height parity with native Like`,
    );
    assertNear(
      control.label.height,
      reference.label.height,
      tolerance,
      `${label} label height parity with native Like`,
    );
  } else {
    assertNear(control.host.height, SHORTS_GEOMETRY.controlHeight, tolerance, `${label} action host height`);
    assertNear(control.label.height, SHORTS_GEOMETRY.labelHeight, tolerance, `${label} label height`);
  }
  assertNear(control.host.width, control.label.width, tolerance, `${label} action host and label width`);

  const minimumWidth = Math.max(control.button.width, control.count.width);
  const maximumWidth = Math.max(
    control.button.width,
    control.count.width + SHORTS_GEOMETRY.countHorizontalAllowance,
    Number.isFinite(nativeColumnWidth) ? nativeColumnWidth : 0,
  );
  for (const [box, part] of [
    [control.host, "action host"],
    [control.label, "label"],
  ]) {
    assert.ok(
      box.width >= minimumWidth - tolerance,
      `${label} ${part} width is too narrow for its button or rendered count.`,
    );
    assert.ok(
      box.width <= maximumWidth + tolerance,
      `${label} ${part} width exceeds the content-aware maximum of ${maximumWidth}px; received ${box.width}px.`,
    );
  }

  const actionCenter = boxCenterX(control.host);
  for (const [box, part] of [
    [control.button, "button"],
    [control.icon, "icon container"],
    [control.svg, "SVG"],
    [control.label, "label"],
    [control.count, "count"],
  ]) {
    assertNear(boxCenterX(box), actionCenter, tolerance, `${label} ${part} horizontal center`);
  }
  for (const [box, part] of [
    [control.icon, "icon container"],
    [control.svg, "SVG"],
  ]) {
    assertNear(boxCenterY(box), boxCenterY(control.button), tolerance, `${label} ${part} vertical center`);
  }

  for (const [outer, outerPart] of [
    [control.host, "action host"],
    [control.label, "label"],
  ]) {
    assertHorizontallyContains(outer, control.button, `${label} ${outerPart}`, `${label} button`, tolerance);
    assertHorizontallyContains(outer, control.count, `${label} ${outerPart}`, `${label} count`, tolerance);
  }
}

function assertHostInsets(style, label) {
  assert.ok(style, `${label} computed style is missing.`);
  for (const [property, expected] of Object.entries(SHORTS_ACTION_HOST_INSETS)) {
    assertNear(style[property], expected, SHORTS_GEOMETRY.geometryTolerance, `${label} ${property}`);
  }
}

function assertCountTypography(actual, native) {
  assert.ok(actual, "Synthetic Shorts count typography is missing.");
  assert.ok(native, "Native Like count typography is missing.");
  for (const style of [
    [native, "Native Like count"],
    [actual, "Synthetic Shorts count"],
  ]) {
    assertNear(style[0].fontSize, SHORTS_GEOMETRY.fontSize, SHORTS_GEOMETRY.textTolerance, `${style[1]} font-size`);
    assertNear(
      style[0].lineHeight,
      SHORTS_GEOMETRY.lineHeight,
      SHORTS_GEOMETRY.textTolerance,
      `${style[1]} line-height`,
    );
  }
  for (const property of ["fontFamily", "fontStyle", "fontWeight"]) {
    assert.equal(
      actual[property],
      native[property],
      `Synthetic Shorts count ${property} does not match the native Like count.`,
    );
  }
}

const REACTION_PRESSED_STATES = {
  disliked: { dislikeState: "true", likeState: "false" },
  liked: { dislikeState: "false", likeState: "true" },
  neutral: { dislikeState: "false", likeState: "false" },
};

function assertReactionPressedStates(actual, expectedState) {
  const expected = REACTION_PRESSED_STATES[expectedState];
  assert.ok(expected, `Unsupported expected YouTube reaction state: ${expectedState}`);
  assert.ok(["true", "false"].includes(actual.likeState), `Unexpected YouTube like state: ${actual.likeState}`);
  assert.ok(
    ["true", "false"].includes(actual.dislikeState),
    `Unexpected YouTube dislike state: ${actual.dislikeState}`,
  );
  assert.ok(
    !(actual.likeState === "true" && actual.dislikeState === "true"),
    "YouTube reported Like and Dislike as selected.",
  );
  assert.equal(actual.likeState, expected.likeState, `Expected YouTube reaction state ${expectedState}.`);
  assert.equal(actual.dislikeState, expected.dislikeState, `Expected YouTube reaction state ${expectedState}.`);
}

function assertSyntheticShortsGeometry(measurement) {
  assert.ok(measurement, "Synthetic Shorts geometry measurement is missing.");
  const { like, nativeActionHosts, next, synthetic } = measurement;
  assert.ok(like, "Native Like geometry is missing.");
  assert.ok(synthetic, "Synthetic Shorts geometry is missing.");
  assert.ok(next, "The action following the synthetic Shorts control is missing.");
  assert.ok(
    Array.isArray(nativeActionHosts) && nativeActionHosts.length > 0,
    "Native Shorts action-column geometry is missing.",
  );

  for (const [box, label] of [
    [like.button, "Native Like button"],
    [like.icon, "Native Like icon container"],
    [like.svg, "Native Like SVG"],
    [synthetic.button, "Synthetic Shorts button"],
    [synthetic.icon, "Synthetic Shorts icon container"],
    [synthetic.svg, "Synthetic Shorts SVG"],
  ]) {
    assertVisibleBox(box, label);
  }
  assertVisibleBox(like.count, "Native Like count");
  assertVisibleBox(synthetic.count, "Synthetic Shorts count");
  assertVisibleBox(next.host, "Action following the synthetic Shorts control");
  nativeActionHosts.forEach((host, index) => assertVisibleBox(host, `Native Shorts action host ${index + 1}`));

  const tolerance = SHORTS_GEOMETRY.geometryTolerance;
  for (const [actual, reference, label] of [
    [synthetic.button, like.button, "Synthetic Shorts button"],
    [synthetic.icon, like.icon, "Synthetic Shorts icon container"],
    [synthetic.svg, like.svg, "Synthetic Shorts SVG"],
  ]) {
    assertNear(actual.width, reference.width, tolerance, `${label} width parity with native Like`);
    assertNear(actual.height, reference.height, tolerance, `${label} height parity with native Like`);
  }
  assertShortsControlShellGeometry(like, "Native Like");
  const nativeColumnWidth = Math.max(...nativeActionHosts.map((host) => host.width));
  assertShortsControlShellGeometry(synthetic, "Synthetic Shorts", { nativeColumnWidth, reference: like });

  assertHostInsets(like.hostStyle, "Native Like action host");
  assertHostInsets(synthetic.hostStyle, "Synthetic Shorts action host");
  assertCountTypography(synthetic.countStyle, like.countStyle);

  const actionCenter = boxCenterX(like.button);
  for (const [box, label] of [
    ...nativeActionHosts.map((host, index) => [host, `Native Shorts action host ${index + 1}`]),
    [like.host, "Native Like action host"],
    [like.label, "Native Like label"],
    [like.icon, "Native Like icon container"],
    [like.svg, "Native Like SVG"],
    [like.count, "Native Like count"],
    [synthetic.host, "Synthetic Shorts action host"],
    [synthetic.label, "Synthetic Shorts label"],
    [synthetic.button, "Synthetic Shorts button"],
    [synthetic.icon, "Synthetic Shorts icon container"],
    [synthetic.svg, "Synthetic Shorts SVG"],
    [synthetic.count, "Synthetic Shorts count"],
    [next.host, "Action following the synthetic Shorts control"],
  ]) {
    assertNear(boxCenterX(box), actionCenter, tolerance, `${label} horizontal center`);
  }

  for (const [control, label] of [
    [like, "Native Like"],
    [synthetic, "Synthetic Shorts"],
  ]) {
    assertNear(boxCenterY(control.icon), boxCenterY(control.button), tolerance, `${label} icon vertical center`);
    assertNear(boxCenterY(control.svg), boxCenterY(control.button), tolerance, `${label} SVG vertical center`);
  }

  assertNear(
    synthetic.host.y - (like.host.y + like.host.height),
    0,
    tolerance,
    "Gap between native Like and synthetic Shorts action hosts",
  );
  assertNear(
    next.host.y - (synthetic.host.y + synthetic.host.height),
    0,
    tolerance,
    "Gap between synthetic Shorts and following action hosts",
  );
}

function assertNativeShortsPairGeometry(measurement) {
  assert.ok(measurement, "Native Shorts pair geometry is missing.");
  const { dislike, like } = measurement;
  assert.ok(like, "Native Shorts Like geometry is missing.");
  assert.ok(dislike, "Native Shorts Dislike geometry is missing.");
  assert.equal(like.videoMatches, true, "The native Shorts Like control is outside the active reel.");
  assert.equal(dislike.videoMatches, true, "The native Shorts Dislike control is outside the active reel.");
  assert.ok(like.reelIndex >= 0, "The native Shorts Like control has no owning reel.");
  assert.equal(dislike.reelIndex, like.reelIndex, "Native Shorts Like and Dislike belong to different reels.");
  assert.ok(like.actionIndex >= 0, "The native Shorts Like control has no owning action stack.");
  assert.equal(
    dislike.actionIndex,
    like.actionIndex + 1,
    "Native Shorts Dislike is not immediately after Like in the active action stack.",
  );

  for (const [action, label] of [
    [like, "Native Shorts Like"],
    [dislike, "Native Shorts Dislike"],
  ]) {
    assertBoxSize(action.button, SHORTS_GEOMETRY.buttonSize, SHORTS_GEOMETRY.buttonSize, `${label} button`);
    assertBoxSize(action.icon, SHORTS_GEOMETRY.iconSize, SHORTS_GEOMETRY.iconSize, `${label} icon container`);
    assertBoxSize(action.svg, SHORTS_GEOMETRY.iconSize, SHORTS_GEOMETRY.iconSize, `${label} SVG`);
    assertVisibleBox(action.count, `${label} count`);
    assertShortsControlShellGeometry(action, label);
    assertHostInsets(action.hostStyle, `${label} action host`);
  }

  assertCountTypography(dislike.countStyle, like.countStyle);
  assertNear(
    boxCenterX(dislike.host),
    boxCenterX(like.host),
    SHORTS_GEOMETRY.geometryTolerance,
    "Native Shorts action-host horizontal center",
  );
  assertNear(
    boxCenterX(dislike.button),
    boxCenterX(like.button),
    SHORTS_GEOMETRY.geometryTolerance,
    "Native Shorts button horizontal center",
  );
  assertNear(
    dislike.host.y,
    like.host.y + like.host.height,
    SHORTS_GEOMETRY.geometryTolerance,
    "Gap between native Shorts Like and Dislike action hosts",
  );
}

function readNativeShortsActionMeasurement(element) {
  const reelSelector = "ytd-reel-video-renderer, ytm-reel-video-renderer";
  const reel = element.closest(reelSelector);
  const host =
    element.closest(
      "like-button-view-model, dislike-button-view-model, ytd-like-button-renderer, ytd-dislike-button-renderer",
    ) ??
    element.closest("label") ??
    element;
  const actionBar = host.parentElement;
  const label = element.closest("label") ?? host.querySelector("label");
  const icon =
    element.querySelector(".ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon, yt-icon") ??
    element.querySelector("svg")?.parentElement ??
    null;
  const svg = icon?.querySelector("svg") ?? element.querySelector("svg");
  const count = [
    ...host.querySelectorAll("#text, [role='text'], .yt-spec-button-shape-next__button-text-content"),
  ].find((candidate) => /\d/.test(candidate.innerText ?? candidate.textContent ?? ""));
  const readBox = (node) => {
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { height: box.height, width: box.width, x: box.x, y: box.y };
  };
  const cssPixels = (value) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  };
  const readHostStyle = (node) => {
    if (!node) return null;
    const style = getComputedStyle(node);
    return {
      marginBottom: cssPixels(style.marginBottom),
      marginLeft: cssPixels(style.marginLeft),
      marginRight: cssPixels(style.marginRight),
      marginTop: cssPixels(style.marginTop),
      paddingBottom: cssPixels(style.paddingBottom),
      paddingLeft: cssPixels(style.paddingLeft),
      paddingRight: cssPixels(style.paddingRight),
      paddingTop: cssPixels(style.paddingTop),
    };
  };
  const readCountStyle = (node) => {
    if (!node) return null;
    const style = getComputedStyle(node);
    return {
      fontFamily: style.fontFamily,
      fontSize: cssPixels(style.fontSize),
      fontStyle: style.fontStyle,
      fontWeight: style.fontWeight,
      lineHeight: cssPixels(style.lineHeight),
    };
  };
  const actionHosts = [...(actionBar?.children ?? [])]
    .filter((candidate) => {
      const button = candidate.matches("button") ? candidate : candidate.querySelector("button");
      if (!button) return false;
      const box = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return (
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.right > 0 &&
        box.top < innerHeight &&
        box.left < innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    })
    .map(readBox);

  return {
    actionIndex: actionBar ? [...actionBar.children].indexOf(host) : -1,
    actionHosts,
    button: readBox(element),
    count: readBox(count),
    countStyle: readCountStyle(count),
    host: readBox(host),
    hostStyle: readHostStyle(host),
    icon: readBox(icon),
    label: readBox(label),
    reelIndex: reel ? [...document.querySelectorAll(reelSelector)].indexOf(reel) : -1,
    svg: readBox(svg),
  };
}

class AttributedRuntimeTrafficLedger {
  constructor(context, page, attributeRequest) {
    assert.equal(typeof context?.on, "function", "The traffic ledger requires a browser context event source.");
    assert.ok(page, "The traffic ledger requires the selected live YouTube page.");
    assert.equal(typeof attributeRequest, "function", "The traffic ledger requires a request attribution function.");
    this.attributeRequest = attributeRequest;
    this.context = context;
    this.page = page;
    this.lastAttributedAt = Date.now();
    this.nextRequestId = 0;
    this.records = [];
    this.recordsByRequest = new WeakMap();
    this.onRequest = this.onRequest.bind(this);
    context.on("request", this.onRequest);
  }

  onRequest(request) {
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (url.origin !== API_ORIGIN || (url.pathname !== "/votes" && !url.pathname.startsWith("/interact/"))) {
      return;
    }
    const attribution = this.attributeRequest(request);
    if (!attribution) return;

    const videoId = requestVideoId(request, url);
    this.nextRequestId += 1;
    const record = {
      ...attribution,
      claimedBy: new Set(),
      method: request.method(),
      pathname: url.pathname,
      requestId: this.nextRequestId,
      requestedAt: Date.now(),
      sameVideoOtherPagesAtRequest: snapshotSameVideoOtherPages(this.context, this.page, attribution, videoId),
      url: url.toString(),
      videoId,
    };
    this.lastAttributedAt = record.requestedAt;
    this.records.push(record);
    this.recordsByRequest.set(request, record);
  }

  claim(request, owner) {
    const record = this.recordsByRequest.get(request);
    if (!record) return false;
    record.claimedBy.add(owner);
    return true;
  }

  async assertNoUnclaimed({ label = "live run", quietMs = 500, timeoutMs = 5_000 } = {}) {
    assert.ok(Number.isFinite(quietMs) && quietMs >= 0, "The traffic-ledger quiet period must be non-negative.");
    assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= quietMs, "The traffic-ledger timeout is too short.");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() - this.lastAttributedAt < quietMs) {
      if (Date.now() >= deadline) {
        throw new Error(`Attributed runtime traffic did not become quiet before ${label} completed.`);
      }
      await delay(Math.min(50, quietMs - (Date.now() - this.lastAttributedAt)));
    }

    for (const record of this.records) {
      assertWorkerRequestAttributionIsUnambiguous(this.context, this.page, [record], record.videoId);
    }
    const unclaimed = this.records
      .filter((record) => record.claimedBy.size === 0)
      .map(({ method, pathname, requestId, source, url, videoId, workerUrl }) => ({
        method,
        pathname,
        requestId,
        source,
        url,
        videoId,
        workerUrl,
      }));
    assert.deepEqual(
      unclaimed,
      [],
      `Attributed runtime traffic escaped every active audit before ${label} completed: ${JSON.stringify(unclaimed)}.`,
    );
    return { attributedRequests: this.records.length, label };
  }

  stop() {
    this.context.off("request", this.onRequest);
  }
}

class VoteTrafficRecorder {
  constructor(
    context,
    videoId,
    { handshakeTimeout = 120_000, page, runtime, selectedExtensionId = null, trafficLedger = null } = {},
  ) {
    assert.ok(runtime === "extension" || runtime === "userscript", `Unsupported vote-recorder runtime: ${runtime}`);
    assert.ok(page, "The vote recorder requires the selected live YouTube page.");
    if (runtime === "extension") {
      assert.match(
        selectedExtensionId ?? "",
        EXTENSION_ID_PATTERN,
        "The extension vote recorder requires the exact selected extension ID.",
      );
    }
    this.context = context;
    this.handshakeTimeout = handshakeTimeout;
    this.page = page;
    this.runtime = runtime;
    this.selectedExtensionId = selectedExtensionId;
    this.trafficLedger = trafficLedger;
    this.videoId = videoId;
    this.records = [];
    this.recordsByRequest = new WeakMap();
    this.onRequest = this.onRequest.bind(this);
    this.onResponse = this.onResponse.bind(this);
    context.on("request", this.onRequest);
    context.on("response", this.onResponse);
  }

  onRequest(request) {
    const url = new URL(request.url());
    if (url.origin !== API_ORIGIN || request.method() !== "POST" || !url.pathname.startsWith("/interact/")) return;
    const attribution = attributeRuntimeRequest(request, this.page, this.runtime, this.selectedExtensionId);
    if (!attribution) return;
    if (this.trafficLedger) {
      assert.equal(
        this.trafficLedger.claim(request, `vote-recorder:${this.videoId}`),
        true,
        "The vote recorder observed attributed traffic that escaped the run-wide ledger.",
      );
    }

    const body = readJsonBody(request);
    const record = {
      ...attribution,
      body,
      pathname: url.pathname,
      requestedAt: Date.now(),
      responseBody: undefined,
      responseError: null,
      respondedAt: null,
      sameVideoOtherPagesAtRequest: snapshotSameVideoOtherPages(this.context, this.page, attribution, body?.videoId),
      status: null,
    };
    this.records.push(record);
    this.recordsByRequest.set(request, record);
  }

  onResponse(response) {
    const record = this.recordsByRequest.get(response.request());
    if (!record) return;

    record.status = response.status();
    record.respondedAt = Date.now();
    void response
      .text()
      .then((text) => {
        try {
          record.responseBody = JSON.parse(text);
        } catch {
          record.responseBody = text;
        }
      })
      .catch((error) => {
        record.responseError = error.message;
      });
  }

  mark() {
    return this.records.length;
  }

  hasVote(value, startIndex) {
    return this.records
      .slice(startIndex)
      .some(
        (record) =>
          record.pathname === "/interact/vote" && record.body?.videoId === this.videoId && record.body?.value === value,
      );
  }

  voteUserId(value, startIndex) {
    return this.records
      .slice(startIndex)
      .find(
        (record) =>
          record.pathname === "/interact/vote" && record.body?.videoId === this.videoId && record.body?.value === value,
      )?.body?.userId;
  }

  async waitForHandshake(value, startIndex) {
    const records = await waitForValue(
      () => {
        const current = this.records.slice(startIndex);
        const voteIndex = current.findIndex(
          (record) =>
            record.pathname === "/interact/vote" &&
            record.body?.videoId === this.videoId &&
            record.body?.value === value &&
            record.status !== null,
        );
        const vote = current[voteIndex];
        const confirmation = current.find(
          (record, index) =>
            index > voteIndex &&
            record.pathname === "/interact/confirmVote" &&
            record.body?.videoId === this.videoId &&
            record.body?.userId === vote?.body?.userId &&
            record.responseBody !== undefined,
        );
        return voteIndex >= 0 && confirmation ? current : null;
      },
      Boolean,
      `Timed out waiting for the production vote handshake for value ${value}`,
      this.handshakeTimeout,
    );

    return this.assertOneHandshake(value, startIndex);
  }

  async assertOneHandshake(value, startIndex) {
    let previousLength = -1;
    let stableSince = Date.now();
    const quietPeriodDeadline = Date.now() + 5_000;
    while (Date.now() - stableSince < 500) {
      if (Date.now() >= quietPeriodDeadline) {
        throw new Error("Interaction traffic did not become quiet. Ensure only one RYD runtime is enabled.");
      }
      const currentLength = this.records.length;
      if (currentLength !== previousLength) {
        previousLength = currentLength;
        stableSince = Date.now();
      }
      await delay(100);
    }

    const records = this.records.slice(startIndex);
    assertWorkerRequestAttributionIsUnambiguous(this.context, this.page, records, this.videoId);
    return assertLogicalVoteHandshake(records, this.videoId, value);
  }

  stop() {
    this.context.off("request", this.onRequest);
    this.context.off("response", this.onResponse);
  }
}

class LiveYoutubeDriver {
  constructor(
    page,
    context,
    {
      authenticatedHandle = null,
      expectedBuildId = null,
      readOnlyInteractionGuardCleanupTimeout = READ_ONLY_INTERACTION_GUARD_CLEANUP_TIMEOUT_MS,
      reportProgress = () => {},
      selectedExtensionId = null,
      visualTooltipTimeout = VISUAL_TOOLTIP_TIMEOUT,
    } = {},
  ) {
    if (selectedExtensionId !== null) {
      assert.match(
        selectedExtensionId,
        EXTENSION_ID_PATTERN,
        "The selected extension ID must be a 32-character Chrome extension ID.",
      );
    }
    if (expectedBuildId !== null) {
      assert.match(
        expectedBuildId,
        LIVE_BUILD_ID_PATTERN,
        "The expected live build ID must be a 32-character hexadecimal value.",
      );
    }
    assert.ok(
      Number.isFinite(readOnlyInteractionGuardCleanupTimeout) && readOnlyInteractionGuardCleanupTimeout > 0,
      "The read-only interaction guard cleanup timeout must be positive.",
    );
    this.page = page;
    this.context = context;
    this.authenticatedHandle = authenticatedHandle === null ? null : normalizeChannelHandle(authenticatedHandle);
    this.expectedBuildId = expectedBuildId;
    this.readOnlyInteractionGuardCleanupTimeout = readOnlyInteractionGuardCleanupTimeout;
    this.reportProgress = reportProgress;
    this.selectedExtensionId = selectedExtensionId;
    this.visualTooltipTimeout = visualTooltipTimeout;
    this.readOnlyInteractionGuard = null;
    this.requestAttributionRuntime = null;
    this.trafficLedger = null;
    this.nextVotesRequestId = 0;
    this.votesRequestIds = new WeakMap();
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(30_000);
  }

  identifyVotesRequest(request) {
    const existing = this.votesRequestIds.get(request);
    if (existing) return existing;
    this.nextVotesRequestId += 1;
    this.votesRequestIds.set(request, this.nextVotesRequestId);
    return this.nextVotesRequestId;
  }

  configureRequestAttributionRuntime(runtime) {
    assert.ok(runtime === "extension" || runtime === "userscript", `Unsupported live request runtime: ${runtime}`);
    if (runtime === "extension") {
      assert.match(
        this.selectedExtensionId ?? "",
        EXTENSION_ID_PATTERN,
        "The extension live driver requires the exact selected extension ID for request attribution.",
      );
      assert.match(
        this.expectedBuildId ?? "",
        LIVE_BUILD_ID_PATTERN,
        "The extension live driver requires the exact live build ID for request attribution.",
      );
    }
    if (this.requestAttributionRuntime !== null) {
      assert.equal(
        this.requestAttributionRuntime,
        runtime,
        "The live driver cannot attribute requests for two runtimes in the same browser tab.",
      );
    }
    this.requestAttributionRuntime = runtime;
    if (!this.trafficLedger) {
      this.trafficLedger = new AttributedRuntimeTrafficLedger(this.context, this.page, (request) =>
        attributeRuntimeRequest(
          request,
          this.page,
          this.requestAttributionRuntime,
          this.selectedExtensionId,
          this.expectedBuildId,
        ),
      );
    }
  }

  claimAttributedTraffic(request, owner) {
    if (!this.trafficLedger) return;
    assert.equal(
      this.trafficLedger.claim(request, owner),
      true,
      "A stage observed attributed traffic that escaped the run-wide ledger.",
    );
  }

  async assertNoUnclaimedAttributedTraffic(label, options = {}) {
    assert.ok(this.trafficLedger, "The live request-attribution runtime was not configured.");
    return this.trafficLedger.assertNoUnclaimed({ ...options, label });
  }

  stop() {
    this.trafficLedger?.stop();
    this.trafficLedger = null;
  }

  async readViewportSize() {
    return this.page.evaluate(() => ({ height: innerHeight, width: innerWidth }));
  }

  async setViewportSize(viewport) {
    await this.page.setViewportSize(viewport);
    await waitForValue(
      () => this.readViewportSize(),
      (current) => current.width === viewport.width && current.height === viewport.height,
      `Timed out resizing the live tab to ${viewport.width}x${viewport.height}`,
    );
    await this.page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }

  async readLargestVisibleVideoBox(viewport, expectedShortVideoId = null) {
    const videos = this.page.locator("video");
    let largest = null;
    let largestVisibleArea = 0;
    let largestCurrentShort = null;
    let largestCurrentShortVisibleArea = 0;
    for (let index = 0; index < (await videos.count()); index += 1) {
      const video = videos.nth(index);
      if (!(await video.isVisible())) continue;
      const [box, identity] = await Promise.all([
        video.boundingBox(),
        expectedShortVideoId === null
          ? Promise.resolve(null)
          : video.evaluate(readShortsRendererIdentityState, { expectedShortVideoId }),
      ]);
      if (identity && !identity.elementRenderedInViewport) continue;
      const visibleBox = boxIntersectionWithViewport(box, viewport);
      const visibleArea = visibleBox ? visibleBox.width * visibleBox.height : 0;
      if (visibleArea > largestVisibleArea) {
        largest = box;
        largestVisibleArea = visibleArea;
      }
      if (identity?.videoMatches && identity.reelRenderedInViewport && visibleArea > largestCurrentShortVisibleArea) {
        largestCurrentShort = box;
        largestCurrentShortVisibleArea = visibleArea;
      }
    }
    return largestCurrentShort ?? largest;
  }

  async wakeCurrentShortsNativeControls(videoId, measurement, pulseIndex = 0) {
    this.assertCurrentVideo(videoId);
    if (typeof this.page.mouse?.move !== "function") return null;
    assert.equal(
      measurement?.currentVideoId,
      videoId,
      "The Shorts native-control wake measurement must belong to the current video.",
    );

    const viewport = measurement.viewport;
    const visibleVideoBox = boxIntersectionWithViewport(measurement.currentVideoBox, viewport);
    if (!visibleVideoBox || visibleVideoBox.width < 4 || visibleVideoBox.height < 4) return null;

    const horizontalPulse = pulseIndex % 2 === 0 ? -1 : 1;
    const point = {
      x: visibleVideoBox.x + visibleVideoBox.width / 2 + horizontalPulse,
      y: visibleVideoBox.y + visibleVideoBox.height / 2,
    };
    await this.page.mouse.move(point.x, point.y);
    this.assertCurrentVideo(videoId);
    return point;
  }

  async captureCroppedScreenshot(screenshotPath, boxes, { waitForVisualReadiness = null } = {}) {
    const viewport = await this.readViewportSize();
    const clip = croppedScreenshotClip(boxes, viewport);
    const videoBox = await this.readLargestVisibleVideoBox(viewport);
    const pointer = pointerPositionAwayFromBoxes(boxes, viewport, videoBox);
    await this.page.mouse.move(pointer.x, pointer.y);
    await waitForValue(
      async () => {
        const tooltips = this.page.locator(NATIVE_YOUTUBE_TOOLTIP_SELECTOR);
        const visibleTooltips = [];
        for (let index = 0; index < (await tooltips.count()); index += 1) {
          const tooltip = tooltips.nth(index);
          if (await tooltip.isVisible()) {
            visibleTooltips.push((await tooltip.innerText()).replace(/\s+/g, " ").trim() || "<empty tooltip>");
          }
        }
        return visibleTooltips;
      },
      (visibleTooltips) => visibleTooltips.length === 0,
      "Timed out waiting for native YouTube tooltips to hide before screenshot capture",
      this.visualTooltipTimeout,
    );
    if (waitForVisualReadiness) await waitForVisualReadiness();
    await this.page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await this.page.screenshot({
      animations: "disabled",
      caret: "hide",
      clip,
      path: screenshotPath,
    });
    return clip;
  }

  async waitForShortsVisualPaint(buttons, timeout = SHORTS_VISUAL_PAINT_TIMEOUT) {
    return waitForValue(
      () => Promise.all(buttons.map((button) => button.evaluate(readShortsIconVisualState))),
      (states) => states.every(isShortsIconVisualReady),
      "Timed out waiting for the visible Shorts reaction icons to finish painting",
      timeout,
    );
  }

  async waitForCurrentShortsNativeControls(
    videoId,
    {
      intervalMs = 200,
      operationTimeoutMs = SHORTS_NATIVE_CONTROLS_OPERATION_TIMEOUT_MS,
      timeoutMs = SHORTS_NATIVE_CONTROLS_TIMEOUT_MS,
    } = {},
  ) {
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "A valid current video ID is required for the Shorts native rail.");
    assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 0, "The Shorts native-control timeout must be non-negative.");
    assert.ok(Number.isFinite(intervalMs) && intervalMs > 0, "The Shorts native-control interval must be positive.");
    assert.ok(
      Number.isFinite(operationTimeoutMs) && operationTimeoutMs > 0,
      "The Shorts native-control operation timeout must be positive.",
    );

    const startedAt = Date.now();
    const observationDeadline = startedAt + timeoutMs;
    const invalidObservationMessage = `Timed out probing Shorts native controls for ${videoId}; the ${timeoutMs}ms observation window is invalid.`;
    const measure = () =>
      withOperationTimeout(
        () =>
          this.page.evaluate(readCurrentShortsNativeControlState, {
            actionBarSelector: SHORTS_NATIVE_ACTION_BAR_SELECTOR,
            minimumActionControlCount: SHORTS_MINIMUM_NATIVE_ACTION_CONTROLS,
            syntheticSelector: SYNTHETIC_SHORTS_SELECTOR,
            videoId,
          }),
        operationTimeoutMs,
        invalidObservationMessage,
      );
    let measurement;
    let lastNativeUiWakeAt = Number.NEGATIVE_INFINITY;
    let lastNativeUiWakePoint = null;
    let nativeUiWakeAttempts = 0;
    measurement = await measure();
    do {
      this.assertCurrentVideo(videoId);
      const hasMatchingNativeControls =
        measurement.matchingVisibleNativeControls > 0 || measurement.matchingVisibleIndependentActions > 0;
      if (
        hasMatchingNativeControls ||
        measurement.matchingCompleteNativeActionBars > 0 ||
        measurement.matchingCompleteIndependentActionBars > 0
      ) {
        const result = {
          ...measurement,
          lastNativeUiWakePoint,
          nativeUiWakeAttempts,
          observedForMs: Date.now() - startedAt,
          status: "present",
        };
        this.reportProgress("shorts-native-controls.present", result);
        return result;
      }

      const now = Date.now();
      if (now >= observationDeadline) break;
      if (now - lastNativeUiWakeAt >= SHORTS_NATIVE_CONTROLS_WAKE_INTERVAL_MS) {
        const wakeTimeoutMs = Math.max(1, Math.min(operationTimeoutMs, observationDeadline - now));
        const wakePoint = await withOperationTimeout(
          () => this.wakeCurrentShortsNativeControls(videoId, measurement, nativeUiWakeAttempts),
          wakeTimeoutMs,
          invalidObservationMessage,
        );
        lastNativeUiWakeAt = Date.now();
        if (wakePoint) {
          lastNativeUiWakePoint = wakePoint;
          nativeUiWakeAttempts += 1;
          measurement = await measure();
          continue;
        }
      }

      const remainingMs = observationDeadline - Date.now();
      if (remainingMs <= 0) break;
      await delay(Math.min(intervalMs, remainingMs));
      measurement = await measure();
    } while (true);

    const hasUnownedNativeControls = measurement.visibleNativeControls > 0 || measurement.visibleIndependentActions > 0;
    const result = {
      ...measurement,
      lastNativeUiWakePoint,
      nativeUiWakeAttempts,
      observedForMs: Date.now() - startedAt,
      reason: hasUnownedNativeControls
        ? "visible-native-shorts-actions-not-owned-by-current-video"
        : "no-visible-native-shorts-actions",
      status: hasUnownedNativeControls ? "present" : "blank",
    };
    this.reportProgress(
      hasUnownedNativeControls ? "shorts-native-controls.present-unowned" : "shorts-native-controls.blank",
      result,
    );
    return result;
  }

  reportBlankShortsSample(details) {
    this.reportProgress("shorts-sample.skipped", details);
  }

  async captureBlankShortsDiagnostics(
    videoId,
    screenshotPath,
    {
      evidenceTimeoutMs = SHORTS_BLANK_EVIDENCE_TIMEOUT_MS,
      operationTimeoutMs = SHORTS_NATIVE_CONTROLS_OPERATION_TIMEOUT_MS,
    } = {},
  ) {
    this.assertCurrentVideo(videoId);
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "A valid current video ID is required for blank Shorts evidence.");
    assert.ok(screenshotPath, "A screenshot path is required for blank Shorts evidence.");
    assert.ok(
      Number.isFinite(operationTimeoutMs) && operationTimeoutMs > 0,
      "The blank Shorts evidence operation timeout must be positive.",
    );
    assert.ok(
      Number.isFinite(evidenceTimeoutMs) && evidenceTimeoutMs > 0,
      "The blank Shorts evidence timeout must be positive.",
    );

    const evidenceDeadline = Date.now() + evidenceTimeoutMs;
    const runBrowserOperation = (action, description) => {
      const remainingEvidenceMs = evidenceDeadline - Date.now();
      const overallTimeoutMessage = `Timed out capturing blank Shorts diagnostics for ${videoId} within ${evidenceTimeoutMs}ms while ${description}`;
      if (remainingEvidenceMs <= 0) throw new Error(overallTimeoutMessage);
      const timeoutMs = Math.min(operationTimeoutMs, remainingEvidenceMs);
      return withOperationTimeout(
        () => action(timeoutMs),
        timeoutMs,
        timeoutMs < operationTimeoutMs ? overallTimeoutMessage : `Timed out ${description} for blank Short ${videoId}`,
      );
    };

    const reelLocator = this.page.locator("ytd-reel-video-renderer, ytm-reel-video-renderer");
    const reels = [];
    const reelCount = await runBrowserOperation(() => reelLocator.count(), "counting Shorts renderers");
    for (let index = 0; index < reelCount; index += 1) {
      const reel = reelLocator.nth(index);
      const [identity, dom] = await runBrowserOperation(
        (timeoutMs) =>
          Promise.all([
            reel.evaluate(readShortsRendererIdentityState, { expectedShortVideoId: videoId }, { timeout: timeoutMs }),
            reel.evaluate(
              readShortsReelDiagnosticState,
              {
                actionBarSelector: SHORTS_NATIVE_ACTION_BAR_SELECTOR,
                syntheticSelector: SYNTHETIC_SHORTS_SELECTOR,
              },
              { timeout: timeoutMs },
            ),
          ]),
        `reading Shorts renderer ${index} diagnostics`,
      );
      reels.push({ dom, identity, index });
    }

    await runBrowserOperation(
      () =>
        this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
      "waiting for pre-screenshot paint",
    );
    await runBrowserOperation(
      (timeoutMs) =>
        this.page.screenshot({ animations: "disabled", caret: "hide", path: screenshotPath, timeout: timeoutMs }),
      "capturing screenshot evidence",
    );
    await runBrowserOperation(
      () =>
        this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))),
      "waiting for post-screenshot paint",
    );
    const nativeControlsAfterEvidence = await runBrowserOperation(
      (timeoutMs) =>
        this.waitForCurrentShortsNativeControls(videoId, {
          operationTimeoutMs: timeoutMs,
          timeoutMs: 0,
        }),
      "rechecking native Shorts controls after evidence capture",
    );
    const viewport = await runBrowserOperation(
      () => this.readViewportSize(),
      "reading the viewport after evidence capture",
    );
    const evidence = {
      capturedAt: new Date().toISOString(),
      currentUrl: this.page.url(),
      expectedVideoId: videoId,
      nativeControlsAfterEvidence,
      reels,
      screenshotPath,
      viewport,
    };
    this.reportProgress("shorts-blank-evidence.captured", {
      renderedReels: reels.filter(({ dom }) => dom.renderedInViewport).length,
      screenshotPath,
      statusAfterEvidence: nativeControlsAfterEvidence.status,
      videoId,
      visibleActions: reels.reduce((count, { dom }) => count + dom.visibleActions.length, 0),
    });
    return evidence;
  }

  async withShortsSampleVotesResponse(
    action,
    {
      allowLikeCountRefinement = false,
      nativeControlsTimeoutMs = SHORTS_NATIVE_CONTROLS_TIMEOUT_MS,
      quietMs = VOTES_RESPONSE_REQUEST_QUIET_MS,
      trafficTimeoutMs = 30_000,
    } = {},
  ) {
    assert.equal(typeof action, "function", "A Shorts navigation action is required for the sample audit.");
    assert.ok(Number.isFinite(quietMs) && quietMs >= 0, "The /votes request quiet period must be non-negative.");
    assert.ok(
      Number.isFinite(trafficTimeoutMs) && trafficTimeoutMs >= 0,
      "The /votes traffic timeout must be non-negative.",
    );

    const baselineRequestId = this.nextVotesRequestId;
    const requests = [];
    const requestsByObject = new WeakMap();
    let lastActivityAt = Date.now();
    const onRequest = (request) => {
      const url = new URL(request.url());
      if (url.origin !== API_ORIGIN || url.pathname !== "/votes") return;
      const attribution = attributeRuntimeRequest(
        request,
        this.page,
        this.requestAttributionRuntime,
        this.selectedExtensionId,
        this.expectedBuildId,
      );
      if (!attribution) return;
      this.claimAttributedTraffic(request, "shorts-sample-votes-response");
      const videoId = url.searchParams.get("videoId");
      const record = {
        ...attribution,
        method: request.method(),
        requestId: this.identifyVotesRequest(request),
        response: null,
        responseBody: undefined,
        responseStatus: null,
        sameVideoOtherPagesAtRequest: snapshotSameVideoOtherPages(this.context, this.page, attribution, videoId),
        url: url.toString(),
        videoId,
      };
      requests.push(record);
      requestsByObject.set(request, record);
      lastActivityAt = Date.now();
    };
    const onResponse = (response) => {
      const record = requestsByObject.get(response.request());
      if (!record) return;
      record.response = response;
      record.responseStatus = response.status();
      lastActivityAt = Date.now();
    };

    this.context.on("request", onRequest);
    this.context.on("response", onResponse);
    let result;
    let videoId;
    let nativeControls;
    try {
      result = await action();
      videoId = result?.videoId;
      assert.match(videoId ?? "", VIDEO_ID_PATTERN, "The Shorts sample produced an invalid video ID.");
      nativeControls = await this.waitForCurrentShortsNativeControls(videoId, {
        timeoutMs: nativeControlsTimeoutMs,
      });
      this.reportProgress("ryd-votes-response.waiting", {
        allowMissing: nativeControls.status === "blank",
        baselineRequestId,
        videoId,
      });
      await waitForValue(
        () =>
          Promise.resolve({
            allResponsesReceived: requests.every((request) => request.response !== null),
            quietForMs: Date.now() - lastActivityAt,
            requestCount: requests.length,
          }),
        (state) =>
          state.allResponsesReceived &&
          state.quietForMs >= quietMs &&
          (nativeControls.status === "blank" || state.requestCount > 0),
        nativeControls.status === "blank"
          ? `Timed out waiting for attributed production /votes traffic on blank Short ${videoId} to settle`
          : `Timed out waiting for new attributed production /votes traffic for Short ${videoId}`,
        trafficTimeoutMs,
      );
    } finally {
      this.context.off("request", onRequest);
      this.context.off("response", onResponse);
    }

    const staleRequests = requests.filter((request) => request.videoId !== videoId);
    assert.deepEqual(
      staleRequests,
      [],
      `The Shorts transition emitted a stale /votes request while targeting ${videoId}.`,
    );
    if (requests.length === 0) {
      assert.equal(
        nativeControls.status,
        "blank",
        `The current Short ${videoId} rendered native controls but the selected runtime issued no /votes request.`,
      );
      this.reportProgress("ryd-votes-response.skipped", {
        baselineRequestId,
        reason: nativeControls.reason,
        videoId,
      });
      return { body: null, nativeControls, request: null, result, status: null, videoId };
    }

    const requestSequence = assertExactVotesRequestSequenceAudit(requests, videoId, { allowLikeCountRefinement });
    assertWorkerRequestAttributionIsUnambiguous(this.context, this.page, requests, videoId);
    for (const request of requestSequence) {
      assert.equal(
        request.responseStatus,
        200,
        `The production /votes request for ${videoId} returned HTTP ${request.responseStatus ?? "no response"}.`,
      );
      try {
        request.responseBody = await request.response.json();
      } catch (error) {
        throw new Error(`The production /votes response for ${videoId} is not valid JSON. ${error.message}`, {
          cause: error,
        });
      }
    }
    const request = assertExactVotesResponseAudit(requests, videoId, baselineRequestId, { allowLikeCountRefinement });
    const responseRecord = {
      method: request.method,
      requestId: request.requestId,
      source: request.source,
      url: request.url,
      videoId: request.videoId,
      workerUrl: request.workerUrl,
    };
    this.reportProgress("ryd-votes-response.received", {
      baselineRequestId,
      requestCount: requests.length,
      requestIds: requests.map((candidate) => candidate.requestId),
      requestId: request.requestId,
      source: request.source,
      status: request.responseStatus,
      videoId,
    });
    return {
      body: request.responseBody,
      nativeControls,
      request: responseRecord,
      result,
      status: request.responseStatus,
      videoId,
    };
  }

  async withExactVotesRequest(action, { quietMs = SHORTS_VOTES_REQUEST_QUIET_MS } = {}) {
    assert.equal(typeof action, "function", "A Shorts Next action is required for the /votes request audit.");
    assert.ok(Number.isFinite(quietMs) && quietMs >= 0, "The /votes request quiet period must be non-negative.");

    const requests = [];
    const onRequest = (request) => {
      const url = new URL(request.url());
      if (url.origin !== API_ORIGIN || url.pathname !== "/votes") return;
      const attribution = attributeRuntimeRequest(
        request,
        this.page,
        this.requestAttributionRuntime,
        this.selectedExtensionId,
        this.expectedBuildId,
      );
      if (!attribution) return;
      this.claimAttributedTraffic(request, "exact-votes-request");
      const videoId = url.searchParams.get("videoId");
      requests.push({
        ...attribution,
        method: request.method(),
        requestId: this.identifyVotesRequest(request),
        sameVideoOtherPagesAtRequest: snapshotSameVideoOtherPages(this.context, this.page, attribution, videoId),
        url: url.toString(),
        videoId,
      });
    };

    this.context.on("request", onRequest);
    let result;
    try {
      result = await action();
      if (quietMs > 0) await delay(quietMs);
    } finally {
      this.context.off("request", onRequest);
    }

    const request = assertExactVotesRequestAudit(requests, result?.videoId);
    assertWorkerRequestAttributionIsUnambiguous(this.context, this.page, requests, result.videoId);
    this.reportProgress("shorts-votes-request-audit.confirmed", {
      method: request.method,
      source: request.source,
      url: request.url,
      videoId: request.videoId,
    });
    return result;
  }

  async withNoProductionInteractions(action) {
    if (this.readOnlyInteractionGuard) {
      this.readOnlyInteractionGuard.depth += 1;
      try {
        return await action();
      } finally {
        this.readOnlyInteractionGuard.depth -= 1;
      }
    }

    const guard = {
      abortedRequests: [],
      depth: 1,
      observedRequests: [],
      routeErrors: [],
    };
    this.readOnlyInteractionGuard = guard;
    const routeMatcher = (url) => url.origin === API_ORIGIN && url.pathname.startsWith("/interact/");
    const onRequest = (request) => {
      const url = new URL(request.url());
      if (url.origin !== API_ORIGIN || request.method() !== "POST" || !url.pathname.startsWith("/interact/")) return;
      guard.observedRequests.push({ method: request.method(), pathname: url.pathname });
    };
    const onRoute = async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      guard.abortedRequests.push({ method: request.method(), pathname: url.pathname });
      try {
        await route.abort("blockedbyclient");
      } catch (error) {
        guard.routeErrors.push(error.message);
      }
    };
    let requestListenerInstalled = false;
    let routeInstalled = false;
    let result;
    let actionError;
    let cleanupError;
    try {
      await this.context.route(routeMatcher, onRoute);
      routeInstalled = true;
      this.context.on("request", onRequest);
      requestListenerInstalled = true;
      try {
        result = await action();
      } catch (error) {
        actionError = error;
      }
      await delay(250);
    } finally {
      if (requestListenerInstalled) this.context.off("request", onRequest);
      try {
        if (routeInstalled) {
          const timeoutMs = this.readOnlyInteractionGuardCleanupTimeout;
          this.reportProgress("read-only-interaction-guard.unroute-started", { timeoutMs });
          try {
            await withOperationTimeout(
              () => this.context.unroute(routeMatcher, onRoute),
              timeoutMs,
              `Timed out after ${timeoutMs}ms while removing the live read-only production-interaction route.`,
            );
            this.reportProgress("read-only-interaction-guard.unroute-completed", { timeoutMs });
          } catch (error) {
            cleanupError = error;
            this.reportProgress("read-only-interaction-guard.unroute-failed", {
              message: error.message,
              timeoutMs,
            });
          }
        }
      } finally {
        this.readOnlyInteractionGuard = null;
      }
    }
    let interactionError;
    try {
      assert.deepEqual(
        {
          abortedRequests: guard.abortedRequests,
          observedRequests: guard.observedRequests,
          routeErrors: guard.routeErrors,
        },
        { abortedRequests: [], observedRequests: [], routeErrors: [] },
        "The read-only live scenario attempted a production interaction. The request was blocked before transmission.",
      );
    } catch (error) {
      interactionError = error;
    }
    const failures = [actionError, interactionError, cleanupError].filter(Boolean);
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        "The read-only live scenario and its production-interaction guard both failed.",
      );
    }
    if (failures.length === 1) throw failures[0];
    return result;
  }

  async inspectWatchActionTopology(
    runtime,
    {
      expectedCounts = null,
      expectedInventorySignatures = null,
      expectedTopLevelOptionalSignatures = null,
      minimumTopLevelOptionalActions = 0,
      presenceTimeoutMs = 20_000,
    } = {},
  ) {
    if (!RATE_BAR_SELECTORS[runtime]) throw new Error(`Unsupported live topology runtime: ${runtime}`);
    const videoId = videoIdFromUrl(this.page.url());
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "The action-topology check requires a current Watch video ID.");
    assert.ok(this.page.url().includes("/watch"), "The action-topology check requires a Watch page.");
    this.assertCurrentVideo(videoId);
    this.reportProgress("watch-action-topology.waiting", { runtime, videoId });

    const ratio = await this.inspectWatchRatioVisual(runtime, {
      expectedCounts,
      expectedVideoId: videoId,
      presenceTimeoutMs,
      waitForPresence: true,
    });
    const resolveCurrentTopology = async () => {
      this.assertCurrentVideo(videoId);
      const watchRoots = this.page.locator(
        `ytd-watch-flexy[video-id="${videoId}"], ytd-watch-grid[video-id="${videoId}"]`,
      );
      const visibleRootIndexes = await waitForValue(
        () => visibleLocatorIndexes(watchRoots),
        (indexes) => indexes.length > 0,
        `Timed out waiting for the visible current-video Watch root for ${videoId}`,
        presenceTimeoutMs,
      );
      const watchRoot = watchRoots.nth(visibleRootIndexes[0]);
      const topRows = watchRoot.locator("#top-row");
      const visibleTopRowIndexes = await waitForValue(
        () => visibleLocatorIndexes(topRows),
        (indexes) => indexes.length > 0,
        `Timed out waiting for the visible Watch top row for ${videoId}`,
        presenceTimeoutMs,
      );
      const topRow = topRows.nth(visibleTopRowIndexes[0]);
      await prepareElementForViewportMeasurement(topRow, "current Watch top row", {
        timeout: presenceTimeoutMs,
      });
      await this.page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );

      const topology = await topRow.evaluate(readWatchTopRowTopology, videoId);
      const menu = await firstVisible(
        topRow.locator("ytd-menu-renderer.ytd-watch-metadata"),
        "current Watch action menu",
        {
          timeout: presenceTimeoutMs,
        },
      );
      return {
        moreButtons: await currentWatchMoreButtons(menu),
        topology,
        visibleRootIndexes,
        visibleTopRowIndexes,
      };
    };

    let currentTopology = await resolveCurrentTopology();
    let overflow;
    let overflowActivation = "pointer";
    let popupResult;
    try {
      assert.equal(
        currentTopology.moreButtons.length,
        1,
        `Expected exactly one visible More-actions button; found ${currentTopology.moreButtons.length}.`,
      );
      await clickHitTestedElement(currentTopology.moreButtons[0], {
        beforeClick: () => this.assertCurrentVideo(videoId),
        label: `Watch More-actions button for ${videoId}`,
        timeout: presenceTimeoutMs,
      });
      const firstOpenTimeoutMs = Math.min(WATCH_OVERFLOW_FIRST_OPEN_TIMEOUT_MS, presenceTimeoutMs);
      try {
        popupResult = await firstVisibleWatchOverflowMenu(this.page, firstOpenTimeoutMs);
      } catch (firstOpenError) {
        popupResult = await visibleWatchOverflowMenu(this.page);
        if (!popupResult) {
          const retryOpenTimeoutMs = Math.max(1, presenceTimeoutMs - firstOpenTimeoutMs);
          this.reportProgress("watch-action-topology.more-menu.retrying", {
            firstFailure: String(firstOpenError?.message ?? firstOpenError),
            firstTimeoutMs: firstOpenTimeoutMs,
            retryTimeoutMs: retryOpenTimeoutMs,
            runtime,
            videoId,
          });
          currentTopology = await resolveCurrentTopology();
          assert.equal(
            currentTopology.moreButtons.length,
            1,
            `Expected exactly one visible More-actions button before retry; found ${currentTopology.moreButtons.length}.`,
          );
          await pressHitTestedElement(currentTopology.moreButtons[0], {
            beforePress: () => this.assertCurrentVideo(videoId),
            label: `Watch More-actions button retry for ${videoId}`,
            timeout: presenceTimeoutMs,
          });
          overflowActivation = "keyboard-retry";
          try {
            popupResult = await firstVisibleWatchOverflowMenu(this.page, retryOpenTimeoutMs);
          } catch (retryOpenError) {
            throw new Error(
              `YouTube did not open the Watch More-actions menu after a hit-tested pointer activation or its single keyboard retry. First failure: ${String(firstOpenError?.message ?? firstOpenError)}. Retry failure: ${String(retryOpenError?.message ?? retryOpenError)}`,
              { cause: retryOpenError },
            );
          }
        }
      }
      overflow = await popupResult.locator.evaluate(readOverflowMenuTopology);
    } finally {
      await this.page.keyboard.press("Escape").catch(() => {});
      await waitForValue(
        async () => {
          return (await visibleWatchOverflowMenu(this.page)) === null;
        },
        Boolean,
        "Timed out closing the Watch More-actions menu after topology inspection",
        5_000,
      );
    }

    const snapshot = {
      ...currentTopology.topology,
      counts: {
        ...currentTopology.topology.counts,
        visibleCurrentWatchRoots: currentTopology.visibleRootIndexes.length,
        visibleOverflowMenus: popupResult?.visibleCount ?? 0,
        visibleTopRows: currentTopology.visibleTopRowIndexes.length,
      },
      inventorySignatures: sortedSignatures([
        ...currentTopology.topology.topLevelOptionalSignatures,
        ...(overflow?.signatures ?? []),
      ]),
      overflowActivation,
      overflowBox: overflow?.box ?? null,
      overflowItemBoxes: overflow?.itemBoxes ?? [],
      overflowSignatures: overflow?.signatures ?? [],
      ratio,
      viewport: await this.readViewportSize(),
    };
    assertWatchActionTopologySnapshot(snapshot, {
      expectedInventorySignatures,
      expectedTopLevelOptionalSignatures,
      minimumTopLevelOptionalActions,
    });
    this.reportProgress("watch-action-topology.confirmed", {
      inventoryCount: snapshot.inventorySignatures.length,
      overflowCount: snapshot.overflowSignatures.length,
      runtime,
      topLevelOptionalCount: snapshot.topLevelOptionalSignatures.length,
      videoId,
      viewport: snapshot.viewport,
    });
    return snapshot;
  }

  async captureWatchActionTopologyVisual(runtime, screenshotPath, options = {}) {
    const snapshot = await this.inspectWatchActionTopology(runtime, options);
    const screenshotClip = await this.captureCroppedScreenshot(screenshotPath, [snapshot.boxes.topRow]);
    return { ...snapshot, screenshotClip, screenshotPath };
  }

  async inspectWatchRatioVisual(
    runtime,
    {
      expectedCount = null,
      expectedCounts = null,
      expectedVideoId = null,
      presenceTimeoutMs = 20_000,
      waitForPresence = false,
    } = {},
  ) {
    const selectors = RATE_BAR_SELECTORS[runtime];
    if (!selectors) throw new Error(`Unsupported live visual runtime: ${runtime}`);
    const videoId = expectedVideoId ?? videoIdFromUrl(typeof this.page.url === "function" ? this.page.url() : "");
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "The Watch ratio audit requires the exact current video ID.");
    this.assertCurrentVideo(videoId);
    if (expectedCounts !== null) assertExpectedWatchCounts(expectedCounts);

    const containers = this.page.locator(selectors.container);
    const bars = this.page.locator(selectors.bar);
    let presenceLatencyMs = null;
    if (waitForPresence) {
      const presenceStartedAt = Date.now();
      await Promise.all([
        firstVisible(containers, `${runtime} watch ratio bar`, { timeout: presenceTimeoutMs }),
        firstVisible(bars, `${runtime} watch ratio fill`, { timeout: presenceTimeoutMs }),
      ]);
      presenceLatencyMs = Date.now() - presenceStartedAt;
    }

    const [visibleContainerIndexes, visibleBarIndexes] = await Promise.all([
      visibleLocatorIndexes(containers),
      visibleLocatorIndexes(bars),
    ]);
    assert.equal(
      visibleContainerIndexes.length,
      1,
      `Expected exactly one visible ${runtime} watch ratio bar; found ${visibleContainerIndexes.length}.`,
    );
    assert.equal(
      visibleBarIndexes.length,
      1,
      `Expected exactly one visible ${runtime} watch ratio fill; found ${visibleBarIndexes.length}.`,
    );

    const count = await this.waitForDislikeText();
    if (expectedCount !== null) {
      assert.equal(count, expectedCount, "The current watch dislike count changed during the ratio-bar soak.");
    }
    const container = containers.nth(visibleContainerIndexes[0]);
    const bar = bars.nth(visibleBarIndexes[0]);
    const likeButton = await this.visibleLikeButton();
    const dislikeButton = await this.visibleDislikeButton();
    await prepareElementForViewportMeasurement(container, `${runtime} watch ratio bar`, {
      timeout: presenceTimeoutMs,
    });

    const wrapper = container.locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ryd-tooltip ')][1]",
    );
    const [appearance, barBox, containerBox, dislikeBox, likeBox, wrapperBox, surroundings, viewport] =
      await Promise.all([
        wrapper.evaluate(readWatchRatioAppearance, selectors),
        bar.boundingBox(),
        container.boundingBox(),
        dislikeButton.boundingBox(),
        likeButton.boundingBox(),
        wrapper.boundingBox(),
        wrapper.evaluate(readWatchRatioSurroundings),
        this.readViewportSize(),
      ]);

    assert.match(count, /\d/, "The watch dislike control has no rendered count.");
    const countAudit =
      expectedCounts === null ? null : await this.assertRenderedDislikeCount(count, expectedCounts.dislikes, runtime);
    assertVisibleBox(barBox, "Watch ratio fill");
    assertVisibleBox(wrapperBox, "Watch ratio wrapper");
    const viewportAlignment = assertWatchRatioViewportAlignment(containerBox, likeBox, dislikeBox, viewport);
    assertBoxInsideViewport(wrapperBox, viewport, "Watch ratio wrapper");
    assertWatchRatioSurroundings(surroundings, viewport);
    assert.ok(barBox.x >= containerBox.x - 1, "The watch ratio fill starts outside its container.");
    assert.ok(
      barBox.x + barBox.width <= containerBox.x + containerBox.width + 1,
      "The watch ratio fill extends outside its container.",
    );
    assert.ok(
      containerBox.y >= Math.max(likeBox.y + likeBox.height, dislikeBox.y + dislikeBox.height) - 4,
      "The watch ratio bar overlaps the reaction controls.",
    );
    const expectedWrapperWidth = likeBox.width + dislikeBox.width;
    assert.ok(
      wrapperBox.width >= expectedWrapperWidth * 0.75 && wrapperBox.width <= expectedWrapperWidth * 1.25,
      `The watch ratio wrapper width ${wrapperBox.width} does not track the reaction controls (${expectedWrapperWidth}).`,
    );
    const ratioAudit = assertWatchRatioData(
      { appearance, geometry: { bar: barBox, container: containerBox } },
      {
        expectedCounts,
        expectedTooltipCandidates:
          expectedCounts === null ? [] : formattedWatchTooltipCandidates(expectedCounts, appearance.numberLocale),
        runtime,
        videoId,
      },
    );

    return {
      appearance,
      count,
      countAudit,
      geometry: {
        bar: barBox,
        container: containerBox,
        dislike: dislikeBox,
        hitArea: surroundings.hitArea,
        like: likeBox,
        nearbyActions: surroundings.nearbyActions,
        topRow: surroundings.topRow,
        wrapper: wrapperBox,
      },
      ratioAudit,
      presenceLatencyMs,
      videoId,
      viewport,
      viewportAlignment,
    };
  }

  async assertWatchRatioVisual(runtime, options = {}) {
    return this.inspectWatchRatioVisual(runtime, options);
  }

  async captureWatchRatioVisual(
    runtime,
    screenshotPath,
    { expectedCount = null, expectedCounts = null, expectedVideoId = null, presenceTimeoutMs = 20_000 } = {},
  ) {
    const measurement = await this.inspectWatchRatioVisual(runtime, {
      expectedCount,
      expectedCounts,
      expectedVideoId,
      presenceTimeoutMs,
      waitForPresence: true,
    });
    const { container, dislike, hitArea, like, nearbyActions, topRow, wrapper } = measurement.geometry;
    const clip = await this.captureCroppedScreenshot(screenshotPath, [
      topRow,
      like,
      dislike,
      container,
      wrapper,
      hitArea,
      ...nearbyActions,
    ]);
    return {
      ...measurement,
      screenshotPath,
      screenshotClip: clip,
    };
  }

  async soakWatchRatioVisual(
    runtime,
    {
      durationMs = WATCH_RATIO_SOAK_DURATION_MS,
      expectedCount,
      expectedCounts,
      intervalMs = WATCH_RATIO_SOAK_INTERVAL_MS,
      videoId,
    },
  ) {
    assert.match(expectedCount, /\d/, "A rendered dislike count is required before soaking the watch ratio bar.");
    assertExpectedWatchCounts(expectedCounts);
    assert.match(videoId, VIDEO_ID_PATTERN, "A valid current video ID is required for the watch ratio-bar soak.");
    assert.ok(
      Number.isFinite(durationMs) && durationMs >= 0,
      "The watch ratio-bar soak duration must be non-negative.",
    );
    assert.ok(Number.isFinite(intervalMs) && intervalMs > 0, "The watch ratio-bar soak interval must be positive.");

    const deadline = Date.now() + durationMs;
    let lastMeasurement;
    let sampleCount = 0;
    this.reportProgress("watch-ratio-soak.start", { durationMs, expectedCount, runtime, videoId });
    do {
      this.assertCurrentVideo(videoId);
      lastMeasurement = await this.assertWatchRatioVisual(runtime, {
        expectedCount,
        expectedCounts,
        expectedVideoId: videoId,
      });
      sampleCount += 1;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await delay(Math.min(intervalMs, remaining));
    } while (true);
    this.reportProgress("watch-ratio-soak.complete", { durationMs, expectedCount, runtime, sampleCount, videoId });

    return { count: lastMeasurement.count, durationMs, ratioAudit: lastMeasurement.ratioAudit, sampleCount, videoId };
  }

  async assertRenderedDislikeCount(renderedCount, dislikes, runtime) {
    const locale = await this.page.evaluate(() => document.documentElement.lang || navigator.language || "en");
    return assertRenderedDislikeCountMatchesApi(renderedCount, dislikes, locale, runtime);
  }

  async assertDislikeCountChangesObservable(changes, runtime) {
    const locale = await this.page.evaluate(() => document.documentElement.lang || navigator.language || "en");
    return assertDislikeCountChangesObservable(changes, locale, runtime);
  }

  async assertCurrentWatchResult(
    videoId,
    runtime,
    expectedCounts,
    { durationMs = WATCH_RESULT_SOAK_DURATION_MS, presenceTimeoutMs = 20_000 } = {},
  ) {
    const selectors = RATE_BAR_SELECTORS[runtime];
    if (!selectors) throw new Error(`Unsupported live visual runtime: ${runtime}`);
    assertExpectedWatchCounts(expectedCounts);
    this.assertCurrentVideo(videoId);

    const visual = await this.inspectWatchRatioVisual(runtime, {
      expectedCounts,
      expectedVideoId: videoId,
      presenceTimeoutMs,
      waitForPresence: true,
    });
    const countAudit = await this.assertRenderedDislikeCount(visual.count, expectedCounts.dislikes, runtime);
    const currentRoots = this.page.locator(
      `ytd-watch-flexy[video-id="${videoId}"], ytd-watch-grid[video-id="${videoId}"]`,
    );
    const [currentContainers, currentBars] = await Promise.all([
      visibleLocatorIndexes(currentRoots.locator(selectors.container)),
      visibleLocatorIndexes(currentRoots.locator(selectors.bar)),
    ]);
    assert.equal(
      currentContainers.length,
      1,
      `Expected exactly one visible ${runtime} ratio bar owned by current Watch video ${videoId}; found ${currentContainers.length}.`,
    );
    assert.equal(
      currentBars.length,
      1,
      `Expected exactly one visible ${runtime} ratio fill owned by current Watch video ${videoId}; found ${currentBars.length}.`,
    );

    const stability = await this.soakWatchRatioVisual(runtime, {
      durationMs,
      expectedCount: visual.count,
      expectedCounts,
      videoId,
    });
    this.assertCurrentVideo(videoId);
    this.reportProgress("watch-result.confirmed", {
      apiDislikes: expectedCounts.dislikes,
      apiLikes: expectedCounts.likes,
      count: visual.count,
      runtime,
      sampleCount: stability.sampleCount,
      videoId,
    });
    return { count: visual.count, countAudit, stability, videoId, visual };
  }

  async captureSyntheticShortsVisual(videoId, screenshotPath) {
    this.assertCurrentVideo(videoId);
    const controls = this.page.locator(SYNTHETIC_SHORTS_SELECTOR);
    const control = await firstVisible(controls, `synthetic Shorts dislike control for ${videoId}`, {
      expectedShortVideoId: videoId,
      requireActiveShort: true,
      requireViewport: true,
    });
    const button = await firstVisible(control.locator("button"), "synthetic Shorts dislike button", {
      expectedShortVideoId: videoId,
      requireActiveShort: true,
      requireViewport: true,
    });
    const likeButton = await this.visibleLikeButton();
    const countLocator = control.locator("#text, [role='text']").first();
    const count = await waitForValue(
      () => countLocator.evaluate((element) => (element.innerText ?? element.textContent ?? "").trim()),
      (text) => RENDERED_NUMBER_PATTERN.test(text),
      "The synthetic Shorts dislike control has no rendered count",
      30_000,
    );
    await this.waitForShortsVisualPaint([likeButton, button]);
    const [measurement, identityState] = await Promise.all([
      control.evaluate((element) => {
        const actionBar = element.closest("reel-action-bar-view-model");
        const reel = element.closest("ytd-reel-video-renderer, ytm-reel-video-renderer");
        const likeHost = element.previousElementSibling;
        const nextHost = element.nextElementSibling;
        const likeLabel = likeHost?.querySelector("label") ?? null;
        const likeButton = likeHost?.querySelector("button") ?? null;
        const likeIcon = likeButton?.querySelector(".ytSpecButtonShapeNextIcon") ?? null;
        const likeSvg = likeIcon?.querySelector("svg") ?? likeButton?.querySelector("svg") ?? null;
        const likeCount = likeHost?.querySelector("#text, [role='text']") ?? null;
        const syntheticLabel = element.querySelector("label");
        const syntheticButton = element.querySelector("button");
        const syntheticIcon = syntheticButton?.querySelector(".ytSpecButtonShapeNextIcon") ?? null;
        const syntheticSvg = syntheticIcon?.querySelector("svg") ?? syntheticButton?.querySelector("svg") ?? null;
        const syntheticCount = element.querySelector("#text, [role='text']");

        const readBox = (node) => {
          if (!node) return null;
          const box = node.getBoundingClientRect();
          return { height: box.height, width: box.width, x: box.x, y: box.y };
        };
        const cssPixels = (value) => {
          const number = Number.parseFloat(value);
          return Number.isFinite(number) ? number : null;
        };
        const readHostStyle = (node) => {
          if (!node) return null;
          const style = getComputedStyle(node);
          return {
            marginBottom: cssPixels(style.marginBottom),
            marginLeft: cssPixels(style.marginLeft),
            marginRight: cssPixels(style.marginRight),
            marginTop: cssPixels(style.marginTop),
            paddingBottom: cssPixels(style.paddingBottom),
            paddingLeft: cssPixels(style.paddingLeft),
            paddingRight: cssPixels(style.paddingRight),
            paddingTop: cssPixels(style.paddingTop),
          };
        };
        const readCountStyle = (node) => {
          if (!node) return null;
          const style = getComputedStyle(node);
          return {
            fontFamily: style.fontFamily,
            fontSize: cssPixels(style.fontSize),
            fontStyle: style.fontStyle,
            fontWeight: style.fontWeight,
            lineHeight: cssPixels(style.lineHeight),
          };
        };
        const actionHosts = [...(actionBar?.children ?? [])]
          .filter((candidate) => {
            const button = candidate.matches("button") ? candidate : candidate.querySelector("button");
            if (!button) return false;
            const box = candidate.getBoundingClientRect();
            const style = getComputedStyle(candidate);
            return (
              box.width > 0 &&
              box.height > 0 &&
              box.bottom > 0 &&
              box.right > 0 &&
              box.top < innerHeight &&
              box.left < innerWidth &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .map(readBox);
        const nativeActionHosts = [...(actionBar?.children ?? [])]
          .filter(
            (candidate) =>
              candidate !== element &&
              !candidate.matches("[data-ryd-synthetic-shorts-dislike]") &&
              !candidate.querySelector("[data-ryd-synthetic-shorts-dislike]"),
          )
          .filter((candidate) => {
            const button = candidate.matches("button") ? candidate : candidate.querySelector("button");
            if (!button) return false;
            const box = candidate.getBoundingClientRect();
            const style = getComputedStyle(candidate);
            return (
              box.width > 0 &&
              box.height > 0 &&
              box.bottom > 0 &&
              box.right > 0 &&
              box.top < innerHeight &&
              box.left < innerWidth &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .map(readBox);

        return {
          actionHosts,
          activeVideoId: element.getAttribute("data-ryd-video-id"),
          geometry: {
            like: {
              button: readBox(likeButton),
              count: readBox(likeCount),
              countStyle: readCountStyle(likeCount),
              host: readBox(likeHost),
              hostStyle: readHostStyle(likeHost),
              icon: readBox(likeIcon),
              label: readBox(likeLabel),
              svg: readBox(likeSvg),
            },
            nativeActionHosts,
            next: { host: readBox(nextHost) },
            synthetic: {
              button: readBox(syntheticButton),
              count: readBox(syntheticCount),
              countStyle: readCountStyle(syntheticCount),
              host: readBox(element),
              hostStyle: readHostStyle(element),
              icon: readBox(syntheticIcon),
              label: readBox(syntheticLabel),
              svg: readBox(syntheticSvg),
            },
          },
          likeIsImmediatePreviousAction:
            likeHost?.matches("like-button-view-model") === true && likeHost?.parentElement === actionBar,
          nativeDislikes: actionBar?.querySelectorAll("dislike-button-view-model, #dislike-button").length ?? -1,
          nextIsImmediateAction: nextHost !== null && nextHost.parentElement === actionBar,
          syntheticControls: actionBar?.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").length ?? -1,
        };
      }),
      control.evaluate(readShortsRendererIdentityState, { expectedShortVideoId: videoId }),
    ]);
    const viewport = await this.readViewportSize();

    assert.equal(measurement.activeVideoId, videoId, "The synthetic Shorts control targets the wrong video.");
    assert.equal(identityState.videoMatches, true, "The synthetic Shorts control is outside the active reel.");
    assert.equal(measurement.nativeDislikes, 0, "The modern Shorts action bar unexpectedly has a native dislike.");
    assert.equal(measurement.syntheticControls, 1, "The active Shorts action bar has duplicate synthetic controls.");
    assert.equal(
      measurement.likeIsImmediatePreviousAction,
      true,
      "The synthetic Shorts control is not immediately after the native Like action.",
    );
    assert.equal(
      measurement.nextIsImmediateAction,
      true,
      "The synthetic Shorts control has no immediately following action.",
    );
    assert.equal(await button.getAttribute("aria-label"), "Dislike this video");
    assert.equal(await button.getAttribute("aria-disabled"), "false");
    assert.ok(["true", "false"].includes(await button.getAttribute("aria-pressed")), "Invalid Shorts pressed state.");
    assert.match(count, RENDERED_NUMBER_PATTERN, "The synthetic Shorts dislike count is not numeric.");
    assertSyntheticShortsGeometry(measurement.geometry);
    assertBoxInsideViewport(measurement.geometry.like.host, viewport, "Native Like action host");
    assertBoxInsideViewport(measurement.geometry.synthetic.host, viewport, "Synthetic Shorts action host");
    assertBoxInsideViewport(measurement.geometry.next.host, viewport, "Action following the synthetic Shorts control");
    assertShortsActionStackGeometry(measurement.actionHosts, viewport);

    const clip = await this.captureCroppedScreenshot(screenshotPath, measurement.actionHosts, {
      waitForVisualReadiness: () => this.waitForShortsVisualPaint([likeButton, button]),
    });
    return {
      count,
      geometry: measurement.geometry,
      screenshotPath,
      screenshotClip: clip,
      viewport,
    };
  }

  async captureNativeShortsVisual(videoId, screenshotPath) {
    this.assertCurrentVideo(videoId);
    const count = await this.waitForDislikeText();
    assert.match(count, RENDERED_NUMBER_PATTERN, "The native Shorts dislike control has no rendered numeric count.");
    const [likeButton, dislikeButton] = await Promise.all([this.visibleLikeButton(), this.visibleDislikeButton()]);
    await this.waitForShortsVisualPaint([likeButton, dislikeButton]);
    const [dislike, like, dislikeIdentityState, likeIdentityState, viewport] = await Promise.all([
      dislikeButton.evaluate(readNativeShortsActionMeasurement),
      likeButton.evaluate(readNativeShortsActionMeasurement),
      dislikeButton.evaluate(readShortsRendererIdentityState, { expectedShortVideoId: videoId }),
      likeButton.evaluate(readShortsRendererIdentityState, { expectedShortVideoId: videoId }),
      this.readViewportSize(),
    ]);
    dislike.videoMatches = dislikeIdentityState.videoMatches;
    like.videoMatches = likeIdentityState.videoMatches;
    const geometry = { dislike, like };
    assertNativeShortsPairGeometry(geometry);
    assertBoxInsideViewport(like.host, viewport, "Shorts Like action");
    assertBoxInsideViewport(dislike.host, viewport, "Shorts Dislike action");
    assertShortsActionStackGeometry(like.actionHosts, viewport);
    const clip = await this.captureCroppedScreenshot(screenshotPath, like.actionHosts, {
      waitForVisualReadiness: () => this.waitForShortsVisualPaint([likeButton, dislikeButton]),
    });
    return {
      count,
      geometry,
      screenshotClip: clip,
      screenshotPath,
      viewport,
    };
  }

  async captureReactionStateVisual({
    expectedCounts,
    expectedState,
    isShort,
    runtime,
    screenshotPath,
    shortsVisualModel,
    videoId,
  }) {
    this.assertCurrentVideo(videoId);
    assertExpectedWatchCounts(expectedCounts);
    const pressedStates = await this.readReactionPressedStates();
    assertReactionPressedStates(pressedStates, expectedState);
    const count = await this.waitForDislikeText();
    assert.match(count, /\d/, "The dislike control has no rendered numeric count.");
    const countAudit = await this.assertRenderedDislikeCount(count, expectedCounts.dislikes, runtime);

    let visual;
    if (!isShort) {
      visual = await this.captureWatchRatioVisual(runtime, screenshotPath, {
        expectedCounts,
        expectedVideoId: videoId,
      });
    } else {
      const captureShortsVisual = {
        "native-pair": () => this.captureNativeShortsVisual(videoId, screenshotPath),
        "strict-synthetic": () => this.captureSyntheticShortsVisual(videoId, screenshotPath),
      }[shortsVisualModel];
      assert.equal(
        typeof captureShortsVisual,
        "function",
        `Unsupported reaction Shorts visual model: ${shortsVisualModel ?? "missing"}.`,
      );
      visual = await captureShortsVisual();
    }

    return {
      ...visual,
      count,
      countAudit,
      expectedCounts,
      expectedState,
      isShort,
      pressedStates,
      runtime,
      screenshotPath,
      videoId,
    };
  }

  async pausePlayback() {
    const pauseResult = await this.page.locator("video").evaluateAll((videos) => {
      const result = { pauseFailures: [], pausedVideos: 0 };
      videos.forEach((video) => {
        try {
          video.pause();
          result.pausedVideos += 1;
        } catch (error) {
          result.pauseFailures.push(String(error?.message ?? error));
        }
      });
      return result;
    });
    this.reportProgress("playback.paused", {
      explanation: "The live smoke pauses media intentionally while it validates the current page",
      ...pauseResult,
      url: this.page.url(),
    });
    return pauseResult;
  }

  async assertSignedIn(expectedChannel) {
    const normalizedExpectedChannel = normalizeChannelHandle(expectedChannel);
    this.reportProgress("signed-in-account.waiting", { expectedChannel: normalizedExpectedChannel });
    assert.equal(
      this.authenticatedHandle,
      normalizedExpectedChannel,
      `The live driver is not bound to the authenticated browser context for ${normalizedExpectedChannel}.`,
    );
    const documentState = await this.page.evaluate(inspectYoutubeSessionDocument);
    assert.equal(documentState?.committed, true, "The current live page is not a committed HTTPS YouTube document.");
    assert.equal(documentState?.configuredLoggedIn, true, "The current YouTube page reports LOGGED_IN is not true.");
    this.reportProgress("signed-in-account.confirmed", { expectedChannel: normalizedExpectedChannel });
  }

  async assertRuntime(runtime, expectedVersion, expectedBuildId) {
    assert.match(
      expectedBuildId ?? "",
      /^[a-f0-9]{32}$/,
      "An exact 32-character live build ID is required before testing an installed runtime.",
    );
    const markers = await this.page.locator("html").evaluate((element) => ({
      extensionBuild: element.getAttribute("data-ryd-extension-build"),
      extension: element.getAttribute("data-ryd-extension-version"),
      userscriptBuild: element.getAttribute("data-ryd-userscript-build"),
      userscript: element.getAttribute("data-ryd-userscript-version"),
    }));
    const otherRuntime = runtime === "userscript" ? "extension" : "userscript";
    assert.equal(markers[runtime], expectedVersion, `Expected ${runtime} version ${expectedVersion} to be active.`);
    assert.equal(
      markers[`${runtime}Build`],
      expectedBuildId,
      `Expected the installed ${runtime} live build to match the freshly generated artifact.`,
    );
    assert.equal(markers[otherRuntime], null, `Disable the ${otherRuntime} before running the ${runtime} smoke.`);
    assert.equal(
      markers[`${otherRuntime}Build`],
      null,
      `Disable the ${otherRuntime} before running the ${runtime} smoke.`,
    );
    this.reportProgress("runtime.confirmed", { expectedBuildId, expectedVersion, runtime });
  }

  async assertCurrentShortsControl(videoId, runtime, { expectedDislikes = null, presenceTimeoutMs = 20_000 } = {}) {
    this.reportProgress("shorts-control.waiting", { runtime, videoId });
    this.assertCurrentVideo(videoId);
    assert.ok(this.page.url().includes("/shorts/"), "The current live page is not a Shorts page.");
    const button = await this.visibleDislikeButton({ timeout: presenceTimeoutMs });
    const [count, measurement, identityState] = await Promise.all([
      button.evaluate(readDislikeControlText),
      button.evaluate(
        (element, settings) => {
          const syntheticHost = element.closest(settings.syntheticSelector);
          const reel = element.closest("ytd-reel-video-renderer, ytm-reel-video-renderer");
          const visibleInViewport = (control) => {
            if (control.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
            let effectiveOpacity = 1;
            for (let current = control; current; current = current.parentElement) {
              const style = getComputedStyle(current);
              if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
                return false;
              }
              const opacity = Number.parseFloat(style.opacity);
              if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
            }
            if (effectiveOpacity <= 0.01) return false;
            const rect = control.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.top < innerHeight &&
              rect.left < innerWidth
            );
          };
          const visibleSyntheticControls = [...(reel?.querySelectorAll(settings.syntheticSelector) ?? [])].filter(
            visibleInViewport,
          );
          const visibleDocumentSyntheticControls = [...document.querySelectorAll(settings.syntheticSelector)].filter(
            visibleInViewport,
          );
          const actionBar = element.closest("reel-action-bar-view-model, ytd-reel-player-overlay-renderer");
          const activationSelector = "button, a[role='button'][tabindex='0'], tp-yt-paper-button#button";
          const visibleActionButtons = [...(actionBar?.children ?? [])]
            .map((host) => (host.matches(activationSelector) ? host : host.querySelector(activationSelector)))
            .filter((control) => control && visibleInViewport(control));
          const hitTestedAtCenter = (control) => {
            const rect = control.getBoundingClientRect();
            const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
            const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
            const hit =
              typeof document.elementFromPoint === "function"
                ? document.elementFromPoint(x, y)
                : document.elementsFromPoint?.(x, y)?.[0] ?? null;
            return hit === control || control.contains(hit);
          };
          const actionButtonHitTests = visibleActionButtons.map(hitTestedAtCenter);
          return {
            actionLabels: visibleActionButtons.map(
              (control) => control.getAttribute("aria-label") ?? control.textContent?.trim() ?? "",
            ),
            hitTestedActionButtons: actionButtonHitTests.filter(Boolean).length,
            nonHitTestedActionLabels: visibleActionButtons
              .filter((_control, index) => !actionButtonHitTests[index])
              .map((control) => control.getAttribute("aria-label") ?? control.textContent?.trim() ?? ""),
            pressed: element.getAttribute("aria-pressed"),
            synthetic: syntheticHost !== null,
            syntheticVideoId: syntheticHost?.getAttribute("data-ryd-video-id") ?? null,
            activeActionBarSyntheticControls: actionBar?.querySelectorAll(settings.syntheticSelector).length ?? -1,
            currentReelSyntheticControls: reel?.querySelectorAll(settings.syntheticSelector).length ?? -1,
            visibleDocumentSyntheticControls: visibleDocumentSyntheticControls.length,
            visibleStaleSyntheticControls: visibleDocumentSyntheticControls.filter(
              (control) => control.getAttribute("data-ryd-video-id") !== settings.videoId,
            ).length,
            visibleSyntheticControls: visibleSyntheticControls.length,
            visibleActionButtons: visibleActionButtons.length,
          };
        },
        { syntheticSelector: SYNTHETIC_SHORTS_SELECTOR, videoId },
      ),
      button.evaluate(readShortsRendererIdentityState, { expectedShortVideoId: videoId }),
    ]);

    assert.equal(identityState.videoMatches, true, `The rendered Shorts control is not owned by video ${videoId}.`);
    assert.ok(
      ["true", "false"].includes(measurement.pressed),
      "The current Shorts control has no valid pressed state.",
    );
    assert.match(count, RENDERED_NUMBER_PATTERN, "The current Shorts dislike control has no rendered count.");
    let countAudit = null;
    if (expectedDislikes !== null) {
      const locale = await this.page.evaluate(() => document.documentElement.lang || navigator.language || "en");
      countAudit = assertRenderedDislikeCountMatchesApi(count, expectedDislikes, locale, runtime);
    }
    assert.ok(
      measurement.visibleActionButtons >= 5,
      `The current Shorts reel rendered only ${measurement.visibleActionButtons} visible action controls: ${measurement.actionLabels.join(
        ", ",
      )}`,
    );
    if (runtime === "userscript" || runtime === "extension") {
      assert.equal(measurement.synthetic, true, `The ${runtime} did not render its synthetic current Shorts control.`);
      assert.equal(measurement.syntheticVideoId, videoId, "The synthetic Shorts control targets a stale video ID.");
      assert.equal(
        measurement.activeActionBarSyntheticControls,
        1,
        `The current Shorts action stack must contain exactly one ${runtime} synthetic dislike control.`,
      );
      assert.equal(
        measurement.currentReelSyntheticControls,
        1,
        `The current Shorts reel must contain exactly one ${runtime} synthetic dislike control, including hidden controls.`,
      );
      assert.equal(
        measurement.visibleSyntheticControls,
        1,
        `The current Shorts reel must contain exactly one visible ${runtime} synthetic dislike control.`,
      );
      assert.equal(
        measurement.visibleStaleSyntheticControls,
        0,
        `The viewport contains a visible ${runtime} synthetic dislike control for a stale video ID.`,
      );
      assert.equal(
        measurement.visibleDocumentSyntheticControls,
        1,
        `The viewport must contain exactly one visible ${runtime} synthetic dislike control.`,
      );
      assert.equal(
        measurement.hitTestedActionButtons,
        measurement.visibleActionButtons,
        `Every visible Shorts action must be hit-testable at its center; blocked controls: ${measurement.nonHitTestedActionLabels.join(
          ", ",
        )}.`,
      );
    }

    const result = {
      activeActionBarSyntheticControls: measurement.activeActionBarSyntheticControls,
      actionLabels: measurement.actionLabels,
      count,
      countAudit,
      currentReelSyntheticControls: measurement.currentReelSyntheticControls,
      hitTestedActionButtons: measurement.hitTestedActionButtons,
      nonHitTestedActionLabels: measurement.nonHitTestedActionLabels,
      synthetic: measurement.synthetic,
      syntheticVideoId: measurement.syntheticVideoId,
      videoId,
      visibleActionButtons: measurement.visibleActionButtons,
      visibleDocumentSyntheticControls: measurement.visibleDocumentSyntheticControls,
      visibleStaleSyntheticControls: measurement.visibleStaleSyntheticControls,
      visibleSyntheticControls: measurement.visibleSyntheticControls,
    };
    this.reportProgress("shorts-control.confirmed", result);
    return result;
  }

  async soakCurrentShortsControl(
    videoId,
    runtime,
    expectedDislikes,
    {
      durationMs = SHORTS_CONTROL_SOAK_DURATION_MS,
      intervalMs = SHORTS_CONTROL_SOAK_INTERVAL_MS,
      minimumSamples = 2,
      presenceTimeoutMs = 2_000,
    } = {},
  ) {
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "A valid current video ID is required for the Shorts control soak.");
    assert.ok(Number.isFinite(durationMs) && durationMs >= 0, "The Shorts control soak duration must be non-negative.");
    assert.ok(Number.isFinite(intervalMs) && intervalMs > 0, "The Shorts control soak interval must be positive.");
    assert.ok(
      Number.isSafeInteger(minimumSamples) && minimumSamples >= 2,
      "The Shorts control soak needs at least two samples.",
    );
    assert.ok(
      Number.isFinite(presenceTimeoutMs) && presenceTimeoutMs > 0,
      "The Shorts control soak presence timeout must be positive.",
    );

    const deadline = Date.now() + durationMs;
    const samples = [];
    this.reportProgress("shorts-control-soak.start", { durationMs, expectedDislikes, runtime, videoId });
    do {
      this.assertCurrentVideo(videoId);
      samples.push(
        await this.assertCurrentShortsControl(videoId, runtime, {
          expectedDislikes,
          presenceTimeoutMs,
        }),
      );
      const remaining = deadline - Date.now();
      if (samples.length >= minimumSamples && remaining <= 0) break;
      await delay(Math.max(1, Math.min(intervalMs, Math.max(remaining, 1))));
    } while (true);
    this.reportProgress("shorts-control-soak.complete", {
      durationMs,
      expectedDislikes,
      runtime,
      sampleCount: samples.length,
      videoId,
    });
    return { durationMs, expectedDislikes, sampleCount: samples.length, samples, videoId };
  }

  async withExactVotesResponse(videoId, action, { quietMs = VOTES_RESPONSE_REQUEST_QUIET_MS } = {}) {
    assert.match(videoId ?? "", VIDEO_ID_PATTERN, "A valid destination video ID is required for the /votes audit.");
    assert.equal(typeof action, "function", "A navigation action is required for the /votes response audit.");
    assert.ok(Number.isFinite(quietMs) && quietMs >= 0, "The /votes request quiet period must be non-negative.");

    const baselineRequestId = this.nextVotesRequestId;
    const requests = [];
    const requestsByObject = new WeakMap();
    let lastActivityAt = Date.now();
    const onRequest = (request) => {
      const url = new URL(request.url());
      if (url.origin !== API_ORIGIN || url.pathname !== "/votes") return;
      const attribution = attributeRuntimeRequest(
        request,
        this.page,
        this.requestAttributionRuntime,
        this.selectedExtensionId,
        this.expectedBuildId,
      );
      if (!attribution) return;
      this.claimAttributedTraffic(request, "exact-votes-response");
      const requestVideoId = url.searchParams.get("videoId");
      const record = {
        ...attribution,
        method: request.method(),
        requestId: this.identifyVotesRequest(request),
        response: null,
        responseBody: undefined,
        responseStatus: null,
        sameVideoOtherPagesAtRequest: snapshotSameVideoOtherPages(this.context, this.page, attribution, requestVideoId),
        url: url.toString(),
        videoId: requestVideoId,
      };
      requests.push(record);
      requestsByObject.set(request, record);
      lastActivityAt = Date.now();
    };
    const onResponse = (response) => {
      const record = requestsByObject.get(response.request());
      if (!record) return;
      record.response = response;
      record.responseStatus = response.status();
      lastActivityAt = Date.now();
    };

    this.reportProgress("ryd-votes-response.waiting", { baselineRequestId, videoId });
    this.context.on("request", onRequest);
    this.context.on("response", onResponse);
    let result;
    try {
      result = await action();
      await waitForValue(
        () =>
          Promise.resolve({
            allResponsesReceived: requests.length > 0 && requests.every((request) => request.response !== null),
            quietForMs: Date.now() - lastActivityAt,
            requestCount: requests.length,
            responseCount: requests.filter((request) => request.response !== null).length,
          }),
        (state) => state.allResponsesReceived && state.quietForMs >= quietMs,
        `Timed out waiting for new attributed production /votes traffic for ${videoId} to finish and settle`,
        30_000,
      );
    } finally {
      this.context.off("request", onRequest);
      this.context.off("response", onResponse);
    }

    const allowLikeCountRefinement = this.requestAttributionRuntime === "extension";
    const requestSequence = assertExactVotesRequestSequenceAudit(requests, videoId, {
      allowLikeCountRefinement,
    });
    assertWorkerRequestAttributionIsUnambiguous(this.context, this.page, requests, videoId);
    for (const request of requestSequence) {
      assert.equal(
        request.responseStatus,
        200,
        `The production /votes request for ${videoId} returned HTTP ${request.responseStatus ?? "no response"}.`,
      );
      try {
        request.responseBody = await request.response.json();
      } catch (error) {
        throw new Error(`The production /votes response for ${videoId} is not valid JSON. ${error.message}`, {
          cause: error,
        });
      }
    }
    const request = assertExactVotesResponseAudit(requests, videoId, baselineRequestId, {
      allowLikeCountRefinement,
    });
    const responseRecord = {
      method: request.method,
      requestId: request.requestId,
      source: request.source,
      url: request.url,
      videoId: request.videoId,
      workerUrl: request.workerUrl,
    };
    this.reportProgress("ryd-votes-response.received", {
      baselineRequestId,
      requestCount: requests.length,
      requestIds: requests.map((candidate) => candidate.requestId),
      requestId: request.requestId,
      source: request.source,
      status: request.responseStatus,
      videoId,
    });
    return {
      body: request.responseBody,
      request: responseRecord,
      result,
      status: request.responseStatus,
      videoId,
    };
  }

  async navigateFromColdChannel(channelUrl, videoId, kind) {
    const expectedChannelUrl = channelTabUrl(channelUrl, kind);
    this.reportProgress("cold-channel.load.start", {
      channelTabUrl: expectedChannelUrl.toString(),
      channelUrl,
      kind,
      videoId,
    });
    await this.page.goto(expectedChannelUrl.toString(), { waitUntil: "domcontentloaded" });
    await this.page.reload({ waitUntil: "domcontentloaded" });
    const actualChannelUrl = new URL(this.page.url());
    assert.equal(actualChannelUrl.origin, expectedChannelUrl.origin, "The cold channel load left youtube.com.");
    assert.equal(
      actualChannelUrl.pathname.replace(/\/$/, ""),
      expectedChannelUrl.pathname.replace(/\/$/, ""),
      "The cold channel load did not remain on the configured channel path.",
    );
    this.reportProgress("cold-channel.load.complete", { channelUrl: this.page.url(), kind, videoId });

    this.reportProgress("cold-channel.target-link.waiting", { kind, videoId });
    await firstVisibleExactVideoLink(this.page, videoId, kind);
    this.reportProgress("cold-channel.target-link.found", { kind, videoId });
    const documentMarker = await this.page.evaluate(() => {
      const value = `${Date.now()}-${Math.random()}`;
      globalThis.__rydLiveSpaDocumentMarker = value;
      return value;
    });
    const navigate = async () => {
      const target = { kind, origin: expectedChannelUrl.origin, videoId };
      this.reportProgress("cold-channel.target-link.clicking", { activation: "trusted-pointer", kind, videoId });
      await clickWithSingleNavigationRetry({
        click: async (attempt, timeout) => {
          const activation = attempt === 1 ? "trusted-pointer" : "keyboard";
          this.reportProgress("cold-channel.target-link.activating", { activation, attempt, kind, videoId });
          return clickStabilizedExactVideoLink(this.page, videoId, kind, {
            activation,
            label: `cold-channel ${kind} link for ${videoId}`,
            origin: expectedChannelUrl.origin,
            timeout,
          });
        },
        failureMessage: `YouTube did not navigate to the exact channel ${kind} target ${videoId} after a hit-tested pointer activation or its single keyboard retry.`,
        firstTimeout: CHANNEL_TARGET_FIRST_NAVIGATION_TIMEOUT,
        hasNavigated: () => isExactVideoUrl(this.page.url(), target),
        reportProgress: this.reportProgress,
        retryDetails: { kind, videoId },
        retryProgressEvent: "cold-channel.target-link.retrying",
        retryTimeout: CHANNEL_TARGET_RETRY_NAVIGATION_TIMEOUT,
        waitForNavigation: (timeout) =>
          this.page.waitForURL((url) => isExactVideoUrl(url, target), { timeout, waitUntil: "commit" }),
      });
      await this.waitForVideo(videoId);
      return { videoId };
    };
    const navigation =
      kind === "short"
        ? await this.withShortsSampleVotesResponse(navigate, {
            allowLikeCountRefinement: this.requestAttributionRuntime === "extension",
          })
        : await this.withExactVotesResponse(videoId, navigate);
    assert.equal(
      await this.page.evaluate(() => globalThis.__rydLiveSpaDocumentMarker),
      documentMarker,
      `The channel-to-${kind} transition replaced the document instead of using YouTube SPA navigation.`,
    );
    this.reportProgress("cold-channel.navigation.confirmed", { kind, url: this.page.url(), videoId });
    return navigation;
  }

  async navigateFromColdChannelToShort(channelUrl, videoId) {
    return this.navigateFromColdChannel(channelUrl, videoId, "short");
  }

  async navigateFromColdChannelToWatch(channelUrl, videoId) {
    return this.navigateFromColdChannel(channelUrl, videoId, "watch");
  }

  async navigateToNextShort(previousVideoId, sampleAuditOptions = {}) {
    this.assertCurrentVideo(previousVideoId);
    const documentMarker = await this.page.evaluate(() => {
      const value = `${Date.now()}-${Math.random()}`;
      globalThis.__rydLiveSpaDocumentMarker = value;
      return value;
    });
    const navigation = await this.withShortsSampleVotesResponse(async () => {
      this.reportProgress("shorts-next-control.waiting", { previousVideoId });
      const nextButton = await firstVisible(
        this.page.locator(SHORTS_NEXT_BUTTON_SELECTOR),
        "Shorts Next video button",
        {
          expectedShortVideoId: previousVideoId,
          requireViewport: true,
        },
      );
      this.reportProgress("shorts-next-control.found", { previousVideoId });
      const isNextShortUrl = (value) => {
        const url = value instanceof URL ? value : new URL(value);
        const candidate = videoIdFromUrl(url.toString());
        return (
          url.pathname.startsWith("/shorts/") && VIDEO_ID_PATTERN.test(candidate || "") && candidate !== previousVideoId
        );
      };
      await clickWithSingleNavigationRetry({
        click: async (attempt, timeout) => {
          this.reportProgress("shorts-next-control.clicking", { attempt, previousVideoId });
          await clickHitTestedElement(nextButton, {
            beforeClick: () => this.assertCurrentVideo(previousVideoId),
            label: `Shorts Next video button after ${previousVideoId}`,
            timeout,
          });
        },
        hasNavigated: () => isNextShortUrl(this.page.url()),
        reportProgress: this.reportProgress,
        retryDetails: { previousVideoId },
        waitForNavigation: (timeout) => this.page.waitForURL(isNextShortUrl, { timeout, waitUntil: "commit" }),
      });
      const nextVideoId = videoIdFromUrl(this.page.url());
      assert.match(nextVideoId, VIDEO_ID_PATTERN, "The Shorts Next video navigation produced an invalid video ID.");
      assert.notEqual(nextVideoId, previousVideoId, "The Shorts Next video control did not advance to a new video.");
      await this.waitForVideoUrl(nextVideoId);
      return { videoId: nextVideoId };
    }, sampleAuditOptions);

    assert.equal(
      await this.page.evaluate(() => globalThis.__rydLiveSpaDocumentMarker),
      documentMarker,
      "The Shorts Next video transition replaced the document instead of using YouTube SPA navigation.",
    );
    this.reportProgress("shorts-next-navigation.confirmed", {
      previousVideoId,
      url: this.page.url(),
      videoId: navigation.videoId,
    });
    return navigation;
  }

  async waitForVideoUrl(videoId) {
    this.reportProgress("video-url.waiting", { videoId });
    await waitForValue(
      () => Promise.resolve(videoIdFromUrl(this.page.url())),
      (currentVideoId) => currentVideoId === videoId,
      `Timed out waiting for YouTube video ${videoId}`,
    );
    this.reportProgress("video-url.confirmed", { url: this.page.url(), videoId });
  }

  async waitForVideo(videoId) {
    await this.waitForVideoUrl(videoId);
    await this.pausePlayback();
  }

  assertCurrentVideo(videoId) {
    assert.equal(
      videoIdFromUrl(this.page.url()),
      videoId,
      `The live tab is no longer on the allowlisted video ${videoId}.`,
    );
  }

  async openPlaylist(url, videoId) {
    return this.withExactVotesResponse(videoId, async () => {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });
      await this.waitForVideo(videoId);
    });
  }

  async openWatch(videoId) {
    return this.withExactVotesResponse(videoId, async () => {
      await this.page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: "domcontentloaded" });
      await this.waitForVideo(videoId);
    });
  }

  async reload(videoId) {
    return this.withExactVotesResponse(videoId, async () => {
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.waitForVideo(videoId);
    });
  }

  async navigateWithinPlaylist(target = {}) {
    const currentVideoId = videoIdFromUrl(this.page.url());
    assert.match(currentVideoId, VIDEO_ID_PATTERN, "Playlist navigation must start on a watch video.");
    const dynamicTarget = typeof target !== "string";
    const targetOptions = target && typeof target === "object" ? target : {};
    const excludedVideoIds = dynamicTarget ? [...new Set(targetOptions.excludedVideoIds ?? [])] : [];
    for (const excludedVideoId of excludedVideoIds) {
      assert.match(excludedVideoId, VIDEO_ID_PATTERN, "Playlist navigation exclusions must be valid video IDs.");
    }
    const videoId = dynamicTarget
      ? (
          await firstActionableUnvisitedWatchLink(
            this.page,
            PLAYLIST_WATCH_LINK_SELECTOR,
            currentVideoId,
            [...new Set([...excludedVideoIds, currentVideoId])],
            "playlist watch link",
          )
        ).videoId
      : target;
    assert.match(videoId, VIDEO_ID_PATTERN, "Playlist navigation requires a valid destination video ID.");
    assert.notEqual(videoId, currentVideoId, "Playlist navigation must select a different video.");
    assert.ok(!excludedVideoIds.includes(videoId), `Playlist navigation selected excluded video ${videoId}.`);
    const documentMarker = await this.page.evaluate(() => {
      const value = `${Date.now()}-${Math.random()}`;
      globalThis.__rydLiveSpaDocumentMarker = value;
      return value;
    });
    const navigation = await this.withExactVotesResponse(videoId, async () => {
      await Promise.all([
        this.page.waitForURL((url) => videoIdFromUrl(url.toString()) === videoId, { waitUntil: "commit" }),
        clickStabilizedExactVideoLink(this.page, videoId, "watch", {
          label: `playlist link for ${videoId}`,
          origin: new URL(this.page.url()).origin,
          selector: PLAYLIST_WATCH_LINK_SELECTOR,
        }),
      ]);
      await this.waitForVideo(videoId);
    });
    assert.equal(
      await this.page.evaluate(() => globalThis.__rydLiveSpaDocumentMarker),
      documentMarker,
      "The playlist transition replaced the document instead of using YouTube SPA navigation.",
    );
    return { ...navigation, videoId };
  }

  async navigateToRelatedWatch(excludedVideoIds = []) {
    const currentVideoId = videoIdFromUrl(this.page.url());
    assert.match(currentVideoId, VIDEO_ID_PATTERN, "The sidebar stress scenario must start on a watch video.");
    const exclusions = [...new Set(excludedVideoIds)];
    for (const excludedVideoId of exclusions) {
      assert.match(excludedVideoId, VIDEO_ID_PATTERN, "Sidebar navigation exclusions must be valid video IDs.");
    }

    this.reportProgress("related-watch-link.waiting", { currentVideoId, excludedVideoIds: exclusions });
    const relatedExclusions = [...new Set([...exclusions, currentVideoId])];
    const { videoId } = await firstActionableUnvisitedWatchLink(
      this.page,
      RELATED_WATCH_LINK_SELECTOR,
      currentVideoId,
      relatedExclusions,
      "#related watch link",
    );
    this.reportProgress("related-watch-link.found", { currentVideoId, videoId });
    const documentMarker = await this.page.evaluate(() => {
      const value = `${Date.now()}-${Math.random()}`;
      globalThis.__rydLiveSpaDocumentMarker = value;
      return value;
    });

    const navigation = await this.withExactVotesResponse(videoId, async () => {
      assert.ok(!relatedExclusions.includes(videoId), `The selected #related video ${videoId} is excluded.`);
      this.reportProgress("related-watch-link.clicking", { currentVideoId, videoId });
      await Promise.all([
        this.page.waitForURL((url) => videoIdFromUrl(url.toString()) === videoId, { waitUntil: "commit" }),
        clickStabilizedExactVideoLink(this.page, videoId, "watch", {
          label: `#related watch link for ${videoId}`,
          origin: new URL(this.page.url()).origin,
          selector: RELATED_WATCH_LINK_SELECTOR,
        }),
      ]);
      await this.waitForVideo(videoId);
    });

    assert.equal(
      await this.page.evaluate(() => globalThis.__rydLiveSpaDocumentMarker),
      documentMarker,
      "The #related watch transition replaced the document instead of using YouTube SPA navigation.",
    );
    this.reportProgress("related-watch-navigation.confirmed", {
      apiDislikes: navigation.body.dislikes,
      currentVideoId,
      url: this.page.url(),
      videoId,
    });
    return { ...navigation, videoId };
  }

  async openShort(videoId) {
    return this.withExactVotesResponse(videoId, async () => {
      await this.page.goto(`https://www.youtube.com/shorts/${videoId}`, { waitUntil: "domcontentloaded" });
      await this.waitForVideo(videoId);
    });
  }

  async visibleDislikeButton(options) {
    return this.visibleActionButton("dislike", options);
  }

  async visibleLikeButton(options) {
    return this.visibleActionButton("like", options);
  }

  async visibleActionButton(action, { timeout = 20_000 } = {}) {
    const selectors = VISIBLE_ACTION_BUTTON_SELECTORS[action];
    if (!selectors) throw new Error(`Unsupported YouTube reaction action: ${action}`);

    const isShort = this.page.url().includes("/shorts/");
    const videoId = videoIdFromUrl(this.page.url());
    const locator = isShort
      ? this.page.locator(selectors)
      : this.page
          .locator(`ytd-watch-flexy[video-id="${videoId}"], ytd-watch-grid[video-id="${videoId}"]`)
          .locator(selectors);
    const button = await firstVisible(locator, `YouTube ${action} button`, {
      expectedShortVideoId: isShort ? videoIdFromUrl(this.page.url()) : null,
      requireActiveShort: isShort,
      requireEnabled: true,
      // A valid Watch action row can initially be below the fold (for example
      // on a 639px-high authenticated desktop viewport). Rejecting that button
      // before scrolling made a healthy runtime look absent. Shorts must keep
      // the viewport gate because YouTube retains multiple pre-rendered reels.
      requireViewport: isShort,
      timeout,
    });
    if (!isShort) {
      await prepareElementForViewportMeasurement(button, `YouTube ${action} button`, { timeout });
    }
    return button;
  }

  async waitForDislikeText({ differentFrom = null } = {}) {
    return waitForValue(
      async () => (await this.visibleDislikeButton()).evaluate(readDislikeControlText),
      (text) => /\d/.test(text) && (differentFrom === null || text !== differentFrom),
      "The enabled RYD runtime did not render a dislike count",
      30_000,
    );
  }

  async readVoteState() {
    return (await this.visibleDislikeButton()).getAttribute("aria-pressed");
  }

  async readLikeState() {
    return (await this.visibleLikeButton()).getAttribute("aria-pressed");
  }

  async readReactionPressedStates() {
    const [likeState, dislikeState] = await Promise.all([this.readLikeState(), this.readVoteState()]);
    assert.ok(["true", "false"].includes(likeState), `Unexpected YouTube like state: ${likeState}`);
    assert.ok(["true", "false"].includes(dislikeState), `Unexpected YouTube dislike state: ${dislikeState}`);
    assert.ok(!(likeState === "true" && dislikeState === "true"), "YouTube reported Like and Dislike as selected.");
    return { dislikeState, likeState };
  }

  async readReactionState() {
    const { dislikeState, likeState } = await this.readReactionPressedStates();
    if (likeState === "true") return "liked";
    if (dislikeState === "true") return "disliked";
    return "neutral";
  }

  async waitForVoteState(expected) {
    return waitForValue(
      () => this.readVoteState(),
      (state) => state === String(expected),
      `Timed out waiting for dislike aria-pressed=${expected}`,
    );
  }

  async waitForReactionState(expected) {
    return waitForValue(
      () => this.readReactionState(),
      (state) => state === expected,
      `Timed out waiting for YouTube reaction state ${expected}`,
    );
  }

  async clickDislike(videoId) {
    return this.clickAction(videoId, "dislike");
  }

  async clickLike(videoId) {
    return this.clickAction(videoId, "like");
  }

  async clickAction(videoId, action) {
    this.assertCurrentVideo(videoId);
    const button = await this.visibleActionButton(action);
    this.assertCurrentVideo(videoId);
    await clickHitTestedElement(button, {
      beforeClick: () => this.assertCurrentVideo(videoId),
      label: `YouTube ${action} button for ${videoId}`,
    });
  }
}

module.exports = {
  AttributedRuntimeTrafficLedger,
  LiveYoutubeDriver,
  SHORTS_CONTROL_SOAK_DURATION_MS,
  SHORTS_CONTROL_SOAK_INTERVAL_MS,
  SHORTS_NATIVE_CONTROLS_TIMEOUT_MS,
  READ_ONLY_INTERACTION_GUARD_CLEANUP_TIMEOUT_MS,
  VoteTrafficRecorder,
  WATCH_RATIO_SOAK_DURATION_MS,
  assertDislikeCountChangesObservable,
  assertExactVotesRequestAudit,
  assertExactVotesResponseAudit,
  assertWorkerRequestAttributionIsUnambiguous,
  assertElementActionable,
  assertElementReadyForViewportMeasurement,
  assertReactionPressedStates,
  assertRenderedDislikeCountMatchesApi,
  assertLogicalVoteHandshake,
  assertNativeShortsPairGeometry,
  assertShortsActionStackGeometry,
  assertSyntheticShortsGeometry,
  assertWatchActionTopologySnapshot,
  assertWatchRatioViewportAlignment,
  assertWatchRatioSurroundings,
  assertNavigationLinkActionable,
  attributeRuntimeRequest,
  channelTabUrl,
  clickHitTestedElement,
  clickHitTestedNavigationLink,
  clickStabilizedExactVideoLink,
  clickWithSingleNavigationRetry,
  croppedScreenshotClip,
  firstVisibleRelatedWatchLink,
  formattedDislikeCountCandidates,
  isShortCandidateEligible,
  isShortsIconVisualReady,
  isExactVideoUrl,
  normalizeRenderedCount,
  parseLiveExtensionAcceptHeader,
  pointerPositionAwayFromBoxes,
  prepareElementForViewportMeasurement,
  readCurrentShortsNativeControlState,
  readDislikeControlText,
  readElementActionability,
  readNavigationLinkActionability,
  scrollElementIntoViewAndWaitForPaint,
  readOverflowMenuTopology,
  readShortsReelDiagnosticState,
  readShortsRendererIdentityState,
  readWatchRatioAppearance,
  readWatchTopRowTopology,
  readWatchRatioSurroundings,
  relatedWatchVideoId,
  requestVideoId,
  snapshotSameVideoOtherPages,
  videoIdFromUrl,
  withOperationTimeout,
};
