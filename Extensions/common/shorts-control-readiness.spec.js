/** @jest-environment jsdom */

import {
  SHORTS_HYDRATED_SURFACE_STABILITY_MS,
  SHORTS_UNHYDRATED_SURFACE_STABILITY_MS,
  actionBarHasHydratedData,
  captureShortsNativeControlInventory,
  getShortsControlSurfaceStabilityMs,
  getShortsIdentityLinkVideoIds,
  isShortsControlSurfaceReadyForMutation,
  shortsNativeControlInventoryIsReadyForFallback,
  shortsNativeControlInventoryMatches,
} from "./shorts-control-readiness";

const readySurface = {
  candidateVideoIds: ["BBBBBBBBBBB"],
  currentVideoId: "BBBBBBBBBBB",
  isConnected: true,
  isHydrated: true,
  isRendered: true,
  isStable: true,
  isViewportIntersecting: true,
  visibleCandidateCount: 1,
};

function appendNativeLikeSvg(actionBar, { height = 24, path = "M3 12h18", width = 24 } = {}) {
  const button = actionBar.querySelector("like-button-view-model button");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.getBoundingClientRect = () => ({ bottom: height, height, left: 0, right: width, top: 0, width });
  if (path !== null) {
    const graphic = document.createElementNS("http://www.w3.org/2000/svg", "path");
    graphic.setAttribute("d", path);
    svg.appendChild(graphic);
  }
  button.appendChild(svg);
  return svg;
}

describe("Shorts control mutation readiness", () => {
  describe("renderer link identity", () => {
    test("prefers the hidden player-title permalink over a visible description cross-link", () => {
      const renderer = document.createElement("ytd-reel-video-renderer");
      renderer.innerHTML = `
        <div id="shorts-player">
          <a class="ytp-title-link yt-uix-sessionlink" href="/shorts/BBBBBBBBBBB?feature=share"></a>
        </div>
        <button-view-model>
          <a href="/shorts/AAAAAAAAAAA">This knot is very useful</a>
        </button-view-model>`;

      expect(Array.from(getShortsIdentityLinkVideoIds(renderer, "https://www.youtube.com/shorts/BBBBBBBBBBB"))).toEqual(
        ["BBBBBBBBBBB"],
      );
    });

    test("keeps conflicting canonical player and renderer identities ambiguous", () => {
      const renderer = document.createElement("ytd-reel-video-renderer");
      renderer.setAttribute("video-id", "BBBBBBBBBBB");
      renderer.innerHTML = '<a class="ytp-title-link" href="/shorts/AAAAAAAAAAA"></a>';
      const identities = new Set([renderer.getAttribute("video-id"), ...getShortsIdentityLinkVideoIds(renderer)]);

      expect(Array.from(identities).sort()).toEqual(["AAAAAAAAAAA", "BBBBBBBBBBB"]);
    });

    test("keeps multiple canonical player identities ambiguous", () => {
      const renderer = document.createElement("ytd-reel-video-renderer");
      renderer.innerHTML = `
        <a class="ytp-title-link" href="/shorts/AAAAAAAAAAA"></a>
        <a class="ytp-title-link" href="/shorts/BBBBBBBBBBB"></a>
        <a href="/shorts/CCCCCCCCCCC"></a>`;

      expect(Array.from(getShortsIdentityLinkVideoIds(renderer)).sort()).toEqual(["AAAAAAAAAAA", "BBBBBBBBBBB"]);
    });

    test("retains the generic exact-link fallback when no player-title permalink exists", () => {
      const renderer = document.createElement("ytm-reel-video-renderer");
      renderer.innerHTML = '<a href="/shorts/BBBBBBBBBBB"></a>';

      expect(Array.from(getShortsIdentityLinkVideoIds(renderer))).toEqual(["BBBBBBBBBBB"]);
    });

    test("does not fall through to description links when canonical player metadata is malformed", () => {
      const renderer = document.createElement("ytd-reel-video-renderer");
      renderer.innerHTML = `
        <a class="ytp-title-link" href="/shorts/"></a>
        <a href="/shorts/AAAAAAAAAAA"></a>`;

      expect(Array.from(getShortsIdentityLinkVideoIds(renderer))).toEqual([]);
    });
  });

  test("uses the shared hydrated and persistent-unhydrated stability windows", () => {
    expect(getShortsControlSurfaceStabilityMs(true)).toBe(SHORTS_HYDRATED_SURFACE_STABILITY_MS);
    expect(getShortsControlSurfaceStabilityMs(false)).toBe(SHORTS_UNHYDRATED_SURFACE_STABILITY_MS);
    expect(SHORTS_HYDRATED_SURFACE_STABILITY_MS).toBe(250);
    expect(SHORTS_UNHYDRATED_SURFACE_STABILITY_MS).toBe(1500);
  });

  test("accepts the current rendered action surface only after it intersects the viewport", () => {
    expect(isShortsControlSurfaceReadyForMutation(readySurface)).toBe(true);
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...readySurface,
        isViewportIntersecting: false,
      }),
    ).toBe(false);
  });

  test.each([
    ["detached", { isConnected: false }],
    ["not hydrated", { isHydrated: false }],
    ["not rendered", { isRendered: false }],
    ["not stable", { isStable: false }],
    ["owned by another video", { candidateVideoIds: ["AAAAAAAAAAA"] }],
    ["missing route identity", { currentVideoId: null }],
  ])("rejects a %s action surface", (_label, override) => {
    expect(isShortsControlSurfaceReadyForMutation({ ...readySurface, ...override })).toBe(false);
  });

  test("accepts one visible current surface while YouTube is still hydrating its own identity", () => {
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...readySurface,
        candidateVideoIds: [],
      }),
    ).toBe(true);
  });

  test("accepts a data-null surface only through the explicit fallback without bypassing other guards", () => {
    const unhydratedSurface = { ...readySurface, isHydrated: false };

    expect(isShortsControlSurfaceReadyForMutation(unhydratedSurface)).toBe(false);
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...unhydratedSurface,
        allowUnhydratedFallback: true,
      }),
    ).toBe(true);
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...unhydratedSurface,
        allowUnhydratedFallback: true,
        isStable: false,
      }),
    ).toBe(false);
  });

  test("rejects ambiguous and non-unique identity-less surfaces", () => {
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...readySurface,
        candidateVideoIds: ["BBBBBBBBBBB", "AAAAAAAAAAA"],
      }),
    ).toBe(false);
    expect(
      isShortsControlSurfaceReadyForMutation({
        ...readySurface,
        candidateVideoIds: [],
        visibleCandidateCount: 2,
      }),
    ).toBe(false);
  });

  test("requires truthy action-bar data only when YouTube exposes the property", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    expect(actionBarHasHydratedData(actionBar)).toBe(true);

    actionBar.data = null;
    expect(actionBarHasHydratedData(actionBar)).toBe(false);

    actionBar.data = { likeButtonViewModel: {} };
    expect(actionBarHasHydratedData(actionBar)).toBe(true);
  });

  test("requires a complete interactive inventory and detects native reconciliation", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    actionBar.innerHTML = `
      <like-button-view-model><button></button></like-button-view-model>
      <button-view-model><button></button></button-view-model>`;
    document.body.appendChild(actionBar);
    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();

    actionBar.insertAdjacentHTML(
      "beforeend",
      "<button-view-model><button></button></button-view-model>" +
        '<pivot-button-view-model><a role="button" tabindex="0"></a></pivot-button-view-model>',
    );
    appendNativeLikeSvg(actionBar);
    const before = captureShortsNativeControlInventory(actionBar);
    expect(before).not.toBeNull();
    expect(before.activationTargets.at(-1)).toBe(actionBar.querySelector("pivot-button-view-model > a"));
    expect(shortsNativeControlInventoryMatches(before, captureShortsNativeControlInventory(actionBar))).toBe(true);

    actionBar.children[1].replaceWith(actionBar.children[1].cloneNode(true));
    expect(shortsNativeControlInventoryMatches(before, captureShortsNativeControlInventory(actionBar))).toBe(false);
  });

  test("requires every native activation target to be rendered, meaningfully visible, and topmost for fallback", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    actionBar.innerHTML = `
      <like-button-view-model><button></button></like-button-view-model>
      <button-view-model><button></button></button-view-model>
      <button-view-model><button></button></button-view-model>
      <pivot-button-view-model><a role="button" tabindex="0"></a></pivot-button-view-model>`;
    document.body.appendChild(actionBar);
    appendNativeLikeSvg(actionBar);
    const inventory = captureShortsNativeControlInventory(actionBar);
    const targets = inventory.activationTargets;
    targets.forEach((target, index) => {
      target.getBoundingClientRect = () => ({ height: 40, left: index * 50, top: 10, width: 40 });
    });
    const getTopmostElement = jest.fn((x) => targets[Math.floor(x / 50)]);
    const readyOptions = {
      getTopmostElement,
      isMeaningfullyInViewport: () => true,
      isRendered: () => true,
    };

    expect(shortsNativeControlInventoryIsReadyForFallback(inventory, readyOptions)).toBe(true);
    expect(getTopmostElement).toHaveBeenCalledTimes(targets.length);
    expect(
      shortsNativeControlInventoryIsReadyForFallback(inventory, {
        ...readyOptions,
        isRendered: (target) => target !== targets[1],
      }),
    ).toBe(false);
    expect(
      shortsNativeControlInventoryIsReadyForFallback(inventory, {
        ...readyOptions,
        isMeaningfullyInViewport: (target) => target !== targets[2],
      }),
    ).toBe(false);
    expect(
      shortsNativeControlInventoryIsReadyForFallback(inventory, {
        ...readyOptions,
        getTopmostElement: () => document.body,
      }),
    ).toBe(false);
  });

  test("accepts only the real no-href Pivot anchor button topology", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    actionBar.innerHTML = `
      <like-button-view-model><button></button></like-button-view-model>
      <button-view-model><button></button></button-view-model>
      <button-view-model><button></button></button-view-model>
      <pivot-button-view-model><a role="button" tabindex="-1"></a></pivot-button-view-model>`;
    document.body.appendChild(actionBar);
    appendNativeLikeSvg(actionBar);

    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();
    actionBar.querySelector("pivot-button-view-model > a").setAttribute("tabindex", "0");
    expect(captureShortsNativeControlInventory(actionBar)).not.toBeNull();
  });

  test("waits for the exact native Like icon to progress from shell-only through empty SVG to painted", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    actionBar.innerHTML = `
      <like-button-view-model><button></button></like-button-view-model>
      <button-view-model><button></button></button-view-model>
      <button-view-model><button></button></button-view-model>
      <pivot-button-view-model><a role="button" tabindex="0"></a></pivot-button-view-model>`;
    document.body.appendChild(actionBar);

    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();

    const svg = appendNativeLikeSvg(actionBar, { path: null });
    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();

    const graphic = document.createElementNS("http://www.w3.org/2000/svg", "path");
    graphic.setAttribute("d", "");
    svg.appendChild(graphic);
    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();

    graphic.setAttribute("d", "M3 12h18");
    svg.getBoundingClientRect = () => ({ bottom: 0, height: 0, left: 0, right: 24, top: 0, width: 24 });
    expect(captureShortsNativeControlInventory(actionBar)).toBeNull();

    svg.getBoundingClientRect = () => ({ bottom: 24, height: 24, left: 0, right: 24, top: 0, width: 24 });
    const painted = captureShortsNativeControlInventory(actionBar);
    expect(painted).not.toBeNull();
    expect(painted.nativeLikeButton).toBe(actionBar.querySelector("like-button-view-model button"));
    expect(painted.nativeLikeSvg).toBe(svg);
    expect(painted.nativeLikeGraphic).toBe(graphic);

    graphic.replaceWith(graphic.cloneNode(true));
    expect(shortsNativeControlInventoryMatches(painted, captureShortsNativeControlInventory(actionBar))).toBe(false);
  });
});
