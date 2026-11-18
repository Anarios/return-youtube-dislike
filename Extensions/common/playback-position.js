import { getShortsIdentityLinkVideoIds } from "./shorts-control-readiness";

const PLAYER_SELECTOR = "#shorts-player, #movie_player, .html5-video-player";
const SHORTS_RENDERER_SELECTOR = "ytd-reel-video-renderer, ytm-reel-video-renderer, ytm-shorts-video-renderer";
const PLAYER_OWNER_SELECTOR = `${SHORTS_RENDERER_SELECTOR}, ytd-watch-flexy, ytd-watch-grid`;
const VIDEO_SELECTOR = "video.html5-main-video";
const MAX_PLAYBACK_POSITION = 2_147_483_646;

function normalizePlaybackPosition(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PLAYBACK_POSITION ? value : undefined;
}

function getOwnerVideoIds(owner, shorts, pageUrl) {
  if (!owner) return [];
  const ids = [owner.getAttribute("video-id"), owner.getAttribute("data-video-id")].filter(Boolean);
  if (ids.length > 0 || !shorts) return ids;
  return [...getShortsIdentityLinkVideoIds(owner, pageUrl)];
}

function findPlayer(videoId, root) {
  const location = (root.ownerDocument ?? root).location;
  const shorts = location.pathname.startsWith("/shorts/");
  const players = Array.from(root.querySelectorAll(PLAYER_SELECTOR), (player) => {
    const owner = player.closest(PLAYER_OWNER_SELECTOR);
    return { player, owner, ownerIds: getOwnerVideoIds(owner, shorts, location.href) };
  }).filter(({ player, owner, ownerIds }) => {
    return (
      ownerIds.every((ownerId) => ownerId === videoId) &&
      (!owner || owner.matches(SHORTS_RENDERER_SELECTOR) === shorts) &&
      (shorts || player.id !== "shorts-player") &&
      !player.closest("#inline-preview-player, [hidden], [aria-hidden='true'], [inert]") &&
      player.getClientRects().length > 0
    );
  });
  // YouTube can keep players for previous or upcoming videos mounted during navigation.
  const matching = players.filter(({ ownerIds }) => ownerIds.length > 0);
  if (matching.length > 0) return matching.length === 1 ? matching[0].player : undefined;

  const active = players.filter(({ owner }) => shorts && owner?.hasAttribute("is-active"));
  if (active.length > 0) return active.length === 1 ? active[0].player : undefined;

  const primaryId = shorts ? "shorts-player" : "movie_player";
  const primary = players.filter(({ player }) => player.id === primaryId);
  const fallback = primary.length > 0 ? primary : players;
  return fallback.length === 1 ? fallback[0].player : undefined;
}

function readPlaybackPosition(videoId, root = document) {
  const player = findPlayer(videoId, root);
  if (!player || player.classList.contains("ad-showing")) return undefined;
  return normalizePlaybackPosition(Math.floor(player.querySelector(VIDEO_SELECTOR)?.currentTime));
}

export { normalizePlaybackPosition, readPlaybackPosition };
