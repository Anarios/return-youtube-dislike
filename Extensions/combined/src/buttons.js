import { isMobile, isShorts, extConfig } from "./state";
import { getVideoId, querySelector, querySelectorAll } from "./utils";
import {
  actionBarHasHydratedData,
  getShortsIdentityLinkVideoIds,
  isShortsControlSurfaceReadyForMutation as sharedShortsSurfaceIsReady,
  shortsNativeControlInventoryIsReadyForFallback as sharedShortsNativeInventoryIsReadyForFallback,
} from "../../common/shorts-control-readiness";

const buttonsVideoOwnership = new WeakMap();
const SYNTHETIC_SHORTS_DISLIKE_SELECTOR = "[data-ryd-synthetic-shorts-dislike]";
const SHORTS_DISLIKE_ICON_PATH =
  "m8.482 1.5.294.005a9.01 9.01 0 013.918 1.04l.257.143.203.116c.17.097.357.16.55.185l.194.012h1.477l.115.006c.53.054.95.475 1.004 1.005l.006.114v4.499c0 .621-.504 1.125-1.125 1.125h-1.343a.75.75 0 00-.66.395l-.048.107-2.24 6.402a.75.75 0 01-.832.491l-.78-.13a3 3 0 01-2.439-3.587L7.5 11.25H4.454a2.749 2.749 0 01-2.683-2.151 2.762 2.762 0 01.479-2.237l-.016-.065A2.862 2.862 0 013 4.125v-.032c0-.227.037-.453.108-.668l.08-.211A2.816 2.816 0 015.78 1.5h2.703ZM5.78 3c-.566 0-1.069.362-1.248.9a.613.613 0 00-.031.193v.654l-.44.44c-.333.332-.47.813-.364 1.271l.015.065.157.675-.413.557a1.248 1.248 0 00.999 1.995H7.5a1.501 1.501 0 011.467 1.815L8.5 13.742a1.5 1.5 0 001.22 1.794l.157.027 2.031-5.806a2.25 2.25 0 012.124-1.507H15V4.501h-1.102a3.001 3.001 0 01-1.489-.396l-.202-.116A7.504 7.504 0 008.482 3H5.78Z";

function hasRenderedBox(element) {
  if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) {
    return false;
  }
  for (let current = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
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
}

function intersectsViewport(element) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
    rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width
  );
}

function hasMeaningfulViewportPresence(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  const visibleWidth = Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
  return (visibleWidth * visibleHeight) / (rect.width * rect.height) >= 0.5;
}

function configuredMatches(selectors) {
  const matches = [];
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    if (selector) matches.push(...document.querySelectorAll(selector));
  }
  return matches;
}

function getDesktopWatchButtonCandidates() {
  return Array.from(
    new Set([
      ...configuredMatches(extConfig.selectors.buttons.regular.desktopMenu),
      ...configuredMatches(extConfig.selectors.buttons.regular.desktopNoMenu),
    ]),
  ).filter((candidate) => {
    const segmented = querySelector(extConfig.selectors.buttons.segmentedContainer, candidate);
    const like = querySelector(extConfig.selectors.buttons.likeButton.notSegmented, candidate);
    return segmented !== undefined || like !== undefined;
  });
}

function markButtonsForVideo(buttons, videoId) {
  if (buttons && videoId) {
    buttonsVideoOwnership.set(buttons, videoId);
  }
}

function getButtonsVideoOwnership(candidate) {
  return (
    buttonsVideoOwnership.get(candidate) ??
    candidate.getAttribute("video-id") ??
    candidate.getAttribute("data-video-id")
  );
}

function selectCurrentWatchButtons(candidates) {
  const videoId = getVideoId(window.location.href);
  return (
    candidates
      .map((candidate, index) => {
        const watchRoot = candidate.closest("ytd-watch-flexy, ytd-watch-grid");
        const rootVideoId = watchRoot?.getAttribute("video-id");
        const rootMatches = Boolean(videoId && rootVideoId === videoId);
        const rootConflicts = Boolean(videoId && rootVideoId && rootVideoId !== videoId);
        const controlsVideoId = getButtonsVideoOwnership(candidate);
        const controlsMatch = Boolean(videoId && controlsVideoId === videoId);
        const controlsConflict = Boolean(videoId && controlsVideoId && controlsVideoId !== videoId);
        const rendered = hasRenderedBox(candidate);
        const inViewport = rendered && intersectsViewport(candidate);
        const usable = hasUsableButtonStructure(candidate);
        // Visible controls must win while YouTube is reusing a button tree across
        // videos. Ownership is supporting evidence, not a reason to prefer a
        // hidden duplicate or an unrelated unowned menu group.
        const tier =
          rootMatches && inViewport && !controlsConflict
            ? 10
            : rootMatches && inViewport
              ? 9
              : inViewport && !controlsConflict
                ? 8
                : inViewport
                  ? 7
                  : rootMatches && rendered && !controlsConflict
                    ? 6
                    : rootMatches && rendered
                      ? 5
                      : rendered && !controlsConflict
                        ? 4
                        : rendered
                          ? 3
                          : (rootMatches || controlsMatch) && !controlsConflict
                            ? 2
                            : !controlsConflict
                              ? 1
                              : 0;
        return { candidate, index, rendered, rootConflicts, tier, usable };
      })
      // Do not bind outgoing controls to the destination video while YouTube is
      // switching the current watch root during an SPA navigation.
      .filter(({ rendered, rootConflicts, usable }) => rendered && !rootConflicts && usable)
      .sort((left, right) => right.tier - left.tier || left.index - right.index)[0]?.candidate
  );
}

function getNativeButton(buttonContainer) {
  if (!buttonContainer) return undefined;
  return querySelector(extConfig.selectors.buttons.nativeButton, buttonContainer);
}

function isSegmentedButtonLayout(buttons = getButtons()) {
  return Boolean(buttons && querySelector(extConfig.selectors.buttons.segmentedContainer, buttons) !== undefined);
}

function getShortsRenderer(buttons) {
  return buttons?.closest("ytd-reel-video-renderer, ytm-reel-video-renderer") ?? null;
}

function getShortsCandidateVideoIds(buttons) {
  const renderer = getShortsRenderer(buttons);
  const videoIds = new Set();
  const rendererVideoId = renderer?.getAttribute("video-id");
  if (rendererVideoId) videoIds.add(rendererVideoId);

  for (const videoId of getShortsIdentityLinkVideoIds(renderer, window.location.href)) {
    videoIds.add(videoId);
  }

  return videoIds;
}

function getShortsCandidateVideoId(buttons) {
  const videoIds = getShortsCandidateVideoIds(buttons);
  return videoIds.size === 1 ? videoIds.values().next().value : null;
}

function getShortsControlSurfaceSignature(buttons) {
  return Array.from(getShortsCandidateVideoIds(buttons)).sort().join("|") || "identityless";
}

function getVisibleShortsControlSurfaceCount() {
  const elements = isMobile()
    ? querySelectorAll(extConfig.selectors.buttons.shorts.mobile)
    : querySelectorAll(extConfig.selectors.buttons.shorts.desktop);
  return Array.from(elements).filter(
    (candidate) => hasRenderedBox(candidate) && hasMeaningfulViewportPresence(candidate),
  ).length;
}

function shortsControlSurfaceIsReadyForMutation(
  buttons,
  currentVideoId,
  { allowUnhydratedFallback = false, isHydrated = false, isStable = false } = {},
) {
  return sharedShortsSurfaceIsReady({
    allowUnhydratedFallback,
    candidateVideoIds: getShortsCandidateVideoIds(buttons),
    currentVideoId,
    isConnected: buttons?.isConnected,
    isHydrated,
    isRendered: hasRenderedBox(buttons),
    isStable,
    isViewportIntersecting: hasMeaningfulViewportPresence(buttons),
    visibleCandidateCount: getVisibleShortsControlSurfaceCount(),
  });
}

function shortsNativeControlInventoryIsReadyForFallback(inventory) {
  return sharedShortsNativeInventoryIsReadyForFallback(inventory, {
    getTopmostElement:
      typeof document.elementFromPoint === "function" ? (x, y) => document.elementFromPoint(x, y) : null,
    isMeaningfullyInViewport: hasMeaningfulViewportPresence,
    isRendered: hasRenderedBox,
  });
}

function selectCurrentShortsButtons(elements) {
  const currentVideoId = getVideoId(window.location.href);
  const candidates = Array.from(elements)
    .map((buttons) => {
      const renderer = getShortsRenderer(buttons);
      const rendered = hasRenderedBox(buttons);
      const videoIds = getShortsCandidateVideoIds(buttons);
      return {
        active: renderer?.hasAttribute("is-active") === true,
        ambiguous: videoIds.size > 1,
        buttons,
        intersectsViewport: rendered && intersectsViewport(buttons),
        rendered,
        videoId: videoIds.size === 1 ? videoIds.values().next().value : null,
      };
    })
    .filter(({ rendered }) => rendered);
  const unambiguousCandidates = candidates.filter(({ ambiguous }) => !ambiguous);

  const currentVideoCandidates = currentVideoId
    ? unambiguousCandidates.filter((candidate) => candidate.videoId === currentVideoId)
    : [];
  const exactActive = currentVideoCandidates.find(({ active }) => active);
  if (exactActive) return exactActive.buttons;

  const exactVisible = currentVideoCandidates.find(({ intersectsViewport: visible }) => visible);
  if (exactVisible) return exactVisible.buttons;

  const activeCandidate = unambiguousCandidates.find(({ active }) => active);
  if (activeCandidate) {
    // During a Shorts transition the URL can advance before YouTube switches
    // the active reel. Do not write the destination count into the outgoing
    // reel when both identities are known to differ.
    if (currentVideoId && activeCandidate.videoId && activeCandidate.videoId !== currentVideoId) {
      return undefined;
    }
    return activeCandidate.buttons;
  }

  if (currentVideoCandidates.length > 0) return currentVideoCandidates[0].buttons;

  // Some layouts omit a usable video identity. In that case prefer any
  // rendered control intersecting the viewport, then the first rendered
  // fallback. Hidden preloaded reels have already been excluded above.
  const visibleIdentitylessCandidates = unambiguousCandidates.filter(
    ({ intersectsViewport: visible, videoId }) => visible && !videoId,
  );
  return visibleIdentitylessCandidates.length === 1 ? visibleIdentitylessCandidates[0].buttons : undefined;
}

function getButtons() {
  //---   If Watching Youtube Shorts:   ---//
  if (isShorts()) {
    const elements = isMobile()
      ? querySelectorAll(extConfig.selectors.buttons.shorts.mobile)
      : querySelectorAll(extConfig.selectors.buttons.shorts.desktop);
    return selectCurrentShortsButtons(elements);
  }
  //---   If Watching On Mobile:   ---//
  if (isMobile()) {
    return document.querySelector(extConfig.selectors.buttons.regular.mobile);
  }
  return selectCurrentWatchButtons(getDesktopWatchButtonCandidates());
}

function getLikeButton(buttons = getButtons()) {
  if (!buttons) return undefined;
  return isSegmentedButtonLayout(buttons)
    ? querySelector(extConfig.selectors.buttons.likeButton.segmented, buttons) ??
        querySelector(extConfig.selectors.buttons.likeButton.segmentedGetButtons, buttons)
    : querySelector(extConfig.selectors.buttons.likeButton.notSegmented, buttons);
}

function getLikeTextContainer(likeButton = getLikeButton()) {
  if (!likeButton) return undefined;
  return querySelector(extConfig.selectors.likeTextContainer, likeButton);
}

function isSyntheticShortsDislike(dislikeButton) {
  return dislikeButton?.matches?.(SYNTHETIC_SHORTS_DISLIKE_SELECTOR) === true;
}

function setSyntheticShortsDislikePressed(pressed, dislikeButton = getDislikeButton()) {
  if (!isSyntheticShortsDislike(dislikeButton)) return false;

  dislikeButton.classList.toggle("style-default-active", pressed);
  dislikeButton.classList.toggle("style-text", !pressed);
  dislikeButton.querySelector("button")?.setAttribute("aria-pressed", String(pressed));
  return true;
}

function setSyntheticShortsDislikeEnabled(enabled, dislikeButton = getDislikeButton()) {
  if (!isSyntheticShortsDislike(dislikeButton)) return false;

  const button = dislikeButton.querySelector("button");
  if (!button) return false;
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
  return true;
}

function ensureSyntheticShortsDislikeButton(
  buttons,
  {
    allowUnhydratedFallback = false,
    currentVideoId = getVideoId(window.location.href),
    isHydrated = false,
    isStable = false,
  } = {},
) {
  if (!buttons || !isShorts() || isMobile()) return undefined;

  const existingSynthetics = Array.from(buttons.querySelectorAll(SYNTHETIC_SHORTS_DISLIKE_SELECTOR));
  const existing = existingSynthetics[0];
  const nativeDislike = buttons.querySelector("dislike-button-view-model, #dislike-button");
  const candidateVideoId = getShortsCandidateVideoId(buttons);
  const readyForMutation = shortsControlSurfaceIsReadyForMutation(buttons, currentVideoId, {
    allowUnhydratedFallback,
    isHydrated: isHydrated && actionBarHasHydratedData(buttons),
    isStable,
  });
  if (nativeDislike) {
    if (readyForMutation) existingSynthetics.forEach((synthetic) => synthetic.remove());
    return nativeDislike;
  }

  // YouTube routes to the next Short before activating its pre-rendered reel.
  // Mutating that offscreen managed action tree can leave every native action
  // with valid layout but no painted compositor layer when the reel activates.
  if (!readyForMutation) return existing ?? undefined;

  const videoId = candidateVideoId ?? currentVideoId;
  if (existing) {
    existingSynthetics.slice(1).forEach((synthetic) => synthetic.remove());
    if (videoId && existing.getAttribute("data-ryd-video-id") !== videoId) {
      existing.setAttribute("data-ryd-video-id", videoId);
      setSyntheticShortsDislikePressed(false, existing);
      setSyntheticShortsDislikeEnabled(false, existing);
      const count = existing.querySelector("#text, [role='text']");
      if (count) count.textContent = "";
    }
    return existing;
  }

  const likeButton = buttons.querySelector("like-button-view-model");
  const nativeLikeButton = likeButton?.querySelector("button");
  if (!likeButton || !nativeLikeButton) return undefined;

  const dislikeButton = document.createElement("div");
  dislikeButton.className = likeButton.getAttribute("class") || "";
  dislikeButton.classList.add("ryd-synthetic-shorts-dislike", "style-text");
  dislikeButton.setAttribute("data-ryd-role", "dislike");
  dislikeButton.setAttribute("data-ryd-synthetic-shorts-dislike", "true");
  if (videoId) dislikeButton.setAttribute("data-ryd-video-id", videoId);

  const label = document.createElement("label");
  label.className = nativeLikeButton.closest("label")?.getAttribute("class") || "ytSpecButtonShapeWithLabelHost";
  label.classList.add("ryd-synthetic-shorts-dislike-label");

  const button = document.createElement("button");
  button.type = "button";
  button.className = nativeLikeButton.getAttribute("class") || "ytSpecButtonShapeNextHost";
  button.setAttribute("aria-label", "Dislike this video");
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-disabled", "true");
  button.disabled = true;

  const icon = document.createElement("span");
  icon.className =
    nativeLikeButton
      .querySelector(".ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon")
      ?.getAttribute("class") || "ytSpecButtonShapeNextIcon";
  icon.setAttribute("aria-hidden", "true");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("width", "24");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", SHORTS_DISLIKE_ICON_PATH);
  svg.appendChild(path);
  icon.appendChild(svg);
  button.appendChild(icon);

  const countContainer = document.createElement("div");
  countContainer.className =
    likeButton
      .querySelector(".ytSpecButtonShapeWithLabelLabel, .yt-spec-button-shape-with-label__label")
      ?.getAttribute("class") || "ytSpecButtonShapeWithLabelLabel";
  const count = document.createElement("span");
  count.id = "text";
  count.className =
    likeButton.querySelector("span[role='text']")?.getAttribute("class") ||
    "ytAttributedStringHost ytAttributedStringTextAlignmentCenter";
  count.setAttribute("role", "text");
  countContainer.appendChild(count);

  label.append(button, countContainer);
  dislikeButton.appendChild(label);
  likeButton.insertAdjacentElement("afterend", dislikeButton);
  return dislikeButton;
}

function getDislikeButton(buttons = getButtons()) {
  if (!buttons) return undefined;
  const syntheticShortsDislike = isShorts()
    ? buttons.querySelector(SYNTHETIC_SHORTS_DISLIKE_SELECTOR) ?? undefined
    : undefined;
  if (isSegmentedButtonLayout(buttons)) {
    return (
      querySelector(extConfig.selectors.buttons.dislikeButton.segmented, buttons) ??
      querySelector(extConfig.selectors.buttons.dislikeButton.segmentedGetButtons, buttons)
    );
  }

  if (isShorts()) {
    const semanticSelectors = extConfig.selectors.buttons.dislikeButton.notSegmented.filter(
      (selector) => selector !== ":nth-child(2)",
    );
    return (
      querySelector(semanticSelectors, buttons) ??
      querySelector(extConfig.selectors.buttons.dislikeButton.shortsFallback, buttons) ??
      syntheticShortsDislike
    );
  }

  const notSegmentedMatch = querySelector(extConfig.selectors.buttons.dislikeButton.notSegmented, buttons);

  if (notSegmentedMatch != null) {
    return notSegmentedMatch;
  }

  return null;
}

function getTextContainerTemplate(likeButton, buttons) {
  if (!likeButton || !buttons || !buttons.contains(likeButton)) return undefined;
  const parentTemplate =
    querySelector(extConfig.selectors.likeTextContainerTemplateParent, likeButton) ??
    querySelector(extConfig.selectors.likeTextContainerTemplateParent, buttons);

  return (
    querySelector(extConfig.selectors.likeTextContainerTemplate, likeButton) ??
    querySelector(extConfig.selectors.likeTextContainerTemplate, buttons) ??
    parentTemplate?.parentNode
  );
}

function findDislikeTextContainer(dislikeButton, nativeDislikeButton) {
  if (!dislikeButton) return undefined;
  for (const selector of extConfig.selectors.dislikeTextContainer) {
    const result = dislikeButton.querySelector(selector);
    if (result !== null && result !== nativeDislikeButton) {
      return matchesConfiguredSelector(result, extConfig.selectors.textContainerInner)
        ? result
        : querySelector(extConfig.selectors.textContainerInner, result) ?? result;
    }
  }
}

function isReactionControlHost(element) {
  const tagName = element?.tagName?.toLowerCase() ?? "";
  return tagName === "button" || tagName.includes("-") || element?.hasAttribute("data-ryd-role");
}

function matchesConfiguredSelector(element, selectors) {
  if (!element) return false;
  return (Array.isArray(selectors) ? selectors : [selectors]).some((selector) => selector && element.matches(selector));
}

function getSemanticControlSelectors(role) {
  const selectorConfig = extConfig.selectors.buttons[`${role}Button`];
  return [...selectorConfig.segmented, ...selectorConfig.notSegmented].filter(
    (selector) => selector && !selector.trim().startsWith(":"),
  );
}

function hasSemanticReactionStructure(buttons, likeButton, dislikeButton, nativeLikeButton, nativeDislikeButton) {
  const segmentedSelectors = extConfig.selectors.buttons.segmentedContainer;
  const hasSegmentedContainer =
    matchesConfiguredSelector(buttons, segmentedSelectors) || querySelector(segmentedSelectors, buttons) !== undefined;
  const hasSemanticPair =
    matchesConfiguredSelector(likeButton, getSemanticControlSelectors("like")) &&
    matchesConfiguredSelector(dislikeButton, getSemanticControlSelectors("dislike"));

  if (hasSegmentedContainer || hasSemanticPair) return true;

  // Older/mobile layouts can expose the pair only by position. Permit that
  // fallback solely inside a configured reaction root, and require both
  // controls to behave like toggle buttons. This excludes adjacent menu
  // groups such as Share/Download without relying on localized labels.
  const positionalRootSelectors = [
    ...extConfig.selectors.buttons.regular.desktopNoMenu,
    ...extConfig.selectors.buttons.regular.mobile,
    ...extConfig.selectors.buttons.shorts.desktop,
    ...extConfig.selectors.buttons.shorts.mobile,
  ];
  return (
    matchesConfiguredSelector(buttons, positionalRootSelectors) &&
    nativeLikeButton?.hasAttribute("aria-pressed") &&
    nativeDislikeButton?.hasAttribute("aria-pressed")
  );
}

function getButtonControls(buttons = getButtons()) {
  const likeButton = getLikeButton(buttons);
  const dislikeButton = getDislikeButton(buttons);
  const nativeLikeButton = getNativeButton(likeButton);
  const nativeDislikeButton = getNativeButton(dislikeButton);
  const dislikeTextContainer = findDislikeTextContainer(dislikeButton, nativeDislikeButton);
  const textContainerTemplate = getTextContainerTemplate(likeButton, buttons);
  const ready = Boolean(
    buttons?.isConnected &&
      likeButton?.isConnected &&
      dislikeButton?.isConnected &&
      nativeLikeButton?.isConnected &&
      nativeDislikeButton?.isConnected &&
      isReactionControlHost(likeButton) &&
      isReactionControlHost(dislikeButton) &&
      buttons.contains(likeButton) &&
      buttons.contains(dislikeButton) &&
      likeButton.contains(nativeLikeButton) &&
      dislikeButton.contains(nativeDislikeButton) &&
      hasSemanticReactionStructure(buttons, likeButton, dislikeButton, nativeLikeButton, nativeDislikeButton) &&
      (dislikeTextContainer || textContainerTemplate),
  );

  return {
    buttons,
    dislikeButton,
    dislikeTextContainer,
    likeButton,
    nativeDislikeButton,
    nativeLikeButton,
    ready,
    textContainerTemplate,
  };
}

function hasUsableButtonStructure(buttons) {
  return getButtonControls(buttons).ready;
}

function updateDislikeButtonShape(dislikeButton) {
  for (const className of extConfig.selectors.buttonClasses.iconButton) {
    dislikeButton.classList.remove(className);
  }

  for (const className of extConfig.selectors.buttonClasses.iconLeading) {
    dislikeButton.classList.add(className);
  }
}

function createDislikeTextContainer(controls = getButtonControls()) {
  const { dislikeButton, dislikeTextContainer, nativeDislikeButton, textContainerTemplate } = controls;
  if (dislikeTextContainer) return dislikeTextContainer;
  if (
    !controls.ready ||
    !nativeDislikeButton?.isConnected ||
    !dislikeButton?.contains(nativeDislikeButton) ||
    !textContainerTemplate?.isConnected
  ) {
    return undefined;
  }

  const textNodeClone = textContainerTemplate.cloneNode(true);
  let textContainer = matchesConfiguredSelector(textNodeClone, extConfig.selectors.textContainerInner)
    ? textNodeClone
    : querySelector(extConfig.selectors.textContainerInner, textNodeClone);
  if (textContainer === undefined) {
    textContainer = document.createElement("span");
    textContainer.setAttribute("role", "text");
    while (textNodeClone.firstChild) {
      textNodeClone.removeChild(textNodeClone.firstChild);
    }
    textNodeClone.appendChild(textContainer);
  }
  if (!textContainer.id) textContainer.id = "text";
  textContainer.innerText = "";
  nativeDislikeButton.insertBefore(textNodeClone, null);
  updateDislikeButtonShape(nativeDislikeButton);
  return textContainer;
}

function getDislikeTextContainer(controls = getButtonControls()) {
  return controls.dislikeTextContainer ?? createDislikeTextContainer(controls);
}

function checkForSignInButton() {
  if (querySelector(extConfig.selectors.signInButton)) {
    return true;
  } else {
    return false;
  }
}

export {
  ensureSyntheticShortsDislikeButton,
  getButtons,
  getButtonControls,
  getLikeButton,
  getDislikeButton,
  getLikeTextContainer,
  getDislikeTextContainer,
  getShortsCandidateVideoId,
  getShortsCandidateVideoIds,
  getShortsControlSurfaceSignature,
  checkForSignInButton,
  hasRenderedBox,
  isSyntheticShortsDislike,
  markButtonsForVideo,
  setSyntheticShortsDislikeEnabled,
  setSyntheticShortsDislikePressed,
  shortsControlSurfaceIsReadyForMutation,
  shortsNativeControlInventoryIsReadyForFallback,
};
