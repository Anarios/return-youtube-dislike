const SHORTS_HYDRATED_SURFACE_STABILITY_MS = 250;
const SHORTS_UNHYDRATED_SURFACE_STABILITY_MS = 1500;
const SHORTS_LINK_SELECTOR = "a[href*='/shorts/']";
const SHORTS_CANONICAL_PLAYER_LINK_SELECTOR = "a.ytp-title-link[href*='/shorts/']";
const SHORTS_ICON_GRAPHIC_SELECTOR = "path, circle, ellipse, line, polygon, polyline, rect";

function getShortsIdentityLinkVideoIds(root, baseUrl = "https://www.youtube.com/") {
  const identities = new Set();
  if (!root?.querySelectorAll) {
    return identities;
  }

  const links = Array.from(root.querySelectorAll(SHORTS_LINK_SELECTOR));
  const canonicalPlayerLinks = links.filter((link) => link.matches(SHORTS_CANONICAL_PLAYER_LINK_SELECTOR));
  // The player title link identifies the reel. Other /shorts/ links can be
  // unrelated calls to action in the current Short's description/metapanel.
  // Choose the canonical subset before parsing so malformed player metadata
  // cannot make an unrelated description link look authoritative.
  const identityLinks = canonicalPlayerLinks.length > 0 ? canonicalPlayerLinks : links;

  for (const link of identityLinks) {
    try {
      const href = link.getAttribute("href");
      if (!href) continue;
      const videoId = new URL(href, baseUrl).pathname.match(/^\/shorts\/([^/]+)\/?$/)?.[1];
      if (videoId) identities.add(videoId);
    } catch {
      // Ignore malformed or incomplete links while YouTube hydrates the reel.
    }
  }

  return identities;
}

function getShortsControlSurfaceStabilityMs(isHydrated) {
  return isHydrated ? SHORTS_HYDRATED_SURFACE_STABILITY_MS : SHORTS_UNHYDRATED_SURFACE_STABILITY_MS;
}

function isShortsControlSurfaceReadyForMutation({
  allowUnhydratedFallback = false,
  candidateVideoIds = [],
  currentVideoId,
  isConnected,
  isHydrated,
  isRendered,
  isStable,
  isViewportIntersecting,
  visibleCandidateCount,
}) {
  const uniqueCandidateVideoIds = new Set(Array.from(candidateVideoIds).filter(Boolean));
  const hasExactIdentity = uniqueCandidateVideoIds.size === 1 && uniqueCandidateVideoIds.has(currentVideoId);
  const isUnambiguousIdentitylessSurface = uniqueCandidateVideoIds.size === 0 && visibleCandidateCount === 1;

  return Boolean(
    currentVideoId &&
      isConnected &&
      (isHydrated || allowUnhydratedFallback) &&
      isRendered &&
      isStable &&
      isViewportIntersecting &&
      (hasExactIdentity || isUnambiguousIdentitylessSurface),
  );
}

function actionBarHasHydratedData(actionBar) {
  return Boolean(actionBar) && (!("data" in actionBar) || Boolean(actionBar.data));
}

function capturePaintedShortsIcon(button) {
  const svg = button?.querySelector("svg") ?? null;
  if (!svg?.isConnected) return null;

  const graphic = Array.from(svg.querySelectorAll(SHORTS_ICON_GRAPHIC_SELECTOR)).find(
    (candidate) => candidate.tagName.toLowerCase() !== "path" || (candidate.getAttribute("d") ?? "").trim().length > 0,
  );
  if (!graphic?.isConnected) return null;

  const rect = svg.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;

  return { graphic, svg };
}

function captureShortsNativeControlInventory(
  actionBar,
  { syntheticSelector = "[data-ryd-synthetic-shorts-dislike]" } = {},
) {
  const nativeChildren = Array.from(actionBar?.children ?? []).filter((child) => !child.matches(syntheticSelector));
  const likeButton = actionBar?.querySelector("like-button-view-model") ?? null;
  const nativeLikeButton = likeButton?.querySelector("button") ?? null;
  const nativeLikeIcon = capturePaintedShortsIcon(nativeLikeButton);
  const activationTargets = nativeChildren.map((child) =>
    child.querySelector("button, a[href], a[role='button'][tabindex='0'], tp-yt-paper-button#button"),
  );
  if (
    !likeButton?.isConnected ||
    !nativeLikeButton?.isConnected ||
    !nativeLikeIcon ||
    nativeChildren.length < 4 ||
    !nativeChildren.includes(likeButton) ||
    activationTargets.some((target) => !target?.isConnected)
  ) {
    return null;
  }
  return {
    activationTargets,
    likeButton,
    nativeChildren,
    nativeLikeButton,
    nativeLikeGraphic: nativeLikeIcon.graphic,
    nativeLikeSvg: nativeLikeIcon.svg,
  };
}

function shortsNativeControlInventoryMatches(left, right) {
  return Boolean(
    left &&
      right &&
      left.likeButton === right.likeButton &&
      left.nativeLikeButton === right.nativeLikeButton &&
      left.nativeLikeGraphic === right.nativeLikeGraphic &&
      left.nativeLikeSvg === right.nativeLikeSvg &&
      left.nativeChildren.length === right.nativeChildren.length &&
      left.nativeChildren.every((child, index) => child === right.nativeChildren[index]) &&
      left.activationTargets.every((target, index) => target === right.activationTargets[index]),
  );
}

function shortsNativeControlInventoryIsReadyForFallback(
  inventory,
  { getTopmostElement, isMeaningfullyInViewport, isRendered },
) {
  if (
    !inventory?.activationTargets?.length ||
    typeof getTopmostElement !== "function" ||
    typeof isMeaningfullyInViewport !== "function" ||
    typeof isRendered !== "function"
  ) {
    return false;
  }

  return inventory.activationTargets.every((target) => {
    if (!target?.isConnected || !isRendered(target) || !isMeaningfullyInViewport(target)) {
      return false;
    }

    const rect = target.getBoundingClientRect();
    const topmostElement = getTopmostElement(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(topmostElement && (topmostElement === target || target.contains(topmostElement)));
  });
}

export {
  SHORTS_HYDRATED_SURFACE_STABILITY_MS,
  SHORTS_UNHYDRATED_SURFACE_STABILITY_MS,
  actionBarHasHydratedData,
  captureShortsNativeControlInventory,
  getShortsControlSurfaceStabilityMs,
  getShortsIdentityLinkVideoIds,
  isShortsControlSurfaceReadyForMutation,
  shortsNativeControlInventoryIsReadyForFallback,
  shortsNativeControlInventoryMatches,
};
