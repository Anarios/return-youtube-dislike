import { getBrowser, localize } from "./utils";
import { readStoredVote } from "./voteState";

const voteStateByVideo = new Map();

function getActiveShortRenderer() {
  return (
    document.querySelector("ytd-reel-video-renderer[is-active]") ??
    Array.from(document.querySelectorAll("ytd-reel-video-renderer")).find(
      (renderer) => renderer.offsetParent !== null,
    ) ??
    null
  );
}

function getShortsActionBar(renderer = getActiveShortRenderer()) {
  return renderer?.querySelector("reel-action-bar-view-model") ?? null;
}

function getShortsVoteState(videoId) {
  if (!voteStateByVideo.has(videoId)) {
    voteStateByVideo.set(videoId, { pressed: false });
  }
  return voteStateByVideo.get(videoId);
}

function updateShortsVoteState(videoId, patch) {
  return Object.assign(getShortsVoteState(videoId), patch ?? {});
}

function getShortsDislikeControl(renderer = getActiveShortRenderer()) {
  const root = renderer?.querySelector("[data-ryd-shorts-dislike]");
  const button = root?.querySelector("[data-ryd-shorts-dislike-button]");
  const count = root?.querySelector("[data-ryd-shorts-dislike-count]");

  if (!root || !button || !count) return null;

  return { root, button, count, videoId: root.dataset.videoId };
}

function createShortsDislikeIcon() {
  const icon = document.createElement("span");
  icon.className = "ryd-shorts-dislike__icon";
  icon.setAttribute("data-ryd-shorts-dislike-icon", "");
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function updateControlLabels(control) {
  const estimate = control.count.textContent;
  const pressed = control.button.getAttribute("aria-pressed") === "true";
  const estimateLabel = localize(pressed ? "shortsDislikeActive" : "shortsDislikeEstimate", estimate);
  control.button.setAttribute("aria-label", estimateLabel);
  control.button.title = estimateLabel;
}

function setShortsDislikeCount(control, text) {
  control.count.textContent = text;
  updateControlLabels(control);
}

function setShortsDislikePressed(control, pressed) {
  control.button.setAttribute("aria-pressed", String(pressed));
  updateControlLabels(control);
}

async function restoreShortsVoteState(control, storageArea = getBrowser()?.storage?.local) {
  if (!control?.videoId || !storageArea) return false;

  let vote;
  try {
    vote = await readStoredVote(storageArea, control.videoId);
  } catch (error) {
    console.debug("Shorts vote restoration failed:", error?.message ?? error);
    return false;
  }

  if (!control.root.isConnected || control.root.dataset.videoId !== control.videoId) return false;
  const pressed = vote === -1;
  updateShortsVoteState(control.videoId, { pressed });
  setShortsDislikePressed(control, pressed);
  return pressed;
}

function ensureShortsDislikeControl({ videoId, formattedCount } = {}) {
  const renderer = getActiveShortRenderer();
  const actionBar = getShortsActionBar(renderer);
  if (!actionBar) return null;

  let control = getShortsDislikeControl(renderer);
  if (!control) {
    const root = document.createElement("div");
    root.className = "ryd-shorts-dislike";
    root.setAttribute("data-ryd-shorts-dislike", "");

    const button = document.createElement("button");
    button.className = "ryd-shorts-dislike__button";
    button.type = "button";
    button.setAttribute("data-ryd-shorts-dislike-button", "");
    button.setAttribute("aria-pressed", "false");
    button.append(createShortsDislikeIcon());

    const count = document.createElement("span");
    count.className = "ryd-shorts-dislike__count";
    count.setAttribute("data-ryd-shorts-dislike-count", "");
    root.append(button, count);

    const likeButton = actionBar.querySelector("like-button-view-model");
    if (likeButton) {
      likeButton.insertAdjacentElement("afterend", root);
    } else {
      actionBar.append(root);
    }
    control = { root, button, count, videoId };
  }

  control.root.dataset.videoId = videoId;
  control.videoId = videoId;
  if (formattedCount !== undefined) setShortsDislikeCount(control, formattedCount);
  setShortsDislikePressed(control, getShortsVoteState(videoId).pressed);
  return control;
}

export {
  ensureShortsDislikeControl,
  getActiveShortRenderer,
  getShortsActionBar,
  getShortsDislikeControl,
  getShortsVoteState,
  setShortsDislikeCount,
  setShortsDislikePressed,
  restoreShortsVoteState,
  updateShortsVoteState,
};
