export const NATIVE_STATE_ATTRIBUTE = "data-ryd-discussion-native-state";
export const NATIVE_STATE_REQUEST = "ryd-discussion-state-request";

export function discussionRoute(url = location.href) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.youtube.com") return null;
    const surface = parsed.pathname === "/watch" ? "watch" : parsed.pathname.startsWith("/shorts/") ? "shorts" : null;
    const videoId = surface === "shorts" ? parsed.pathname.split("/")[2] : parsed.searchParams.get("v");
    return surface && /^[A-Za-z0-9_-]{11}$/.test(videoId || "") ? { videoId, surface } : null;
  } catch {
    return null;
  }
}

export function isVisibleSurface(root) {
  if (!root?.isConnected || root.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
  for (let element = root; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function nativeState(root) {
  root.removeAttribute(NATIVE_STATE_ATTRIBUTE);
  root.dispatchEvent(new Event(NATIVE_STATE_REQUEST, { bubbles: false }));
  let state;
  try {
    state = JSON.parse(root.getAttribute(NATIVE_STATE_ATTRIBUTE));
  } catch {
    return null;
  } finally {
    root.removeAttribute(NATIVE_STATE_ATTRIBUTE);
  }
  return state;
}

function disabledWatchNotice(root) {
  return [...root.querySelectorAll("ytd-comments ytd-message-renderer a[href]")].some((anchor) => {
    try {
      const url = new URL(anchor.href);
      return (
        url.hostname === "support.google.com" && url.pathname === "/youtube/answer/9706180" && isVisibleSurface(anchor)
      );
    } catch {
      return false;
    }
  });
}

export function findDiscussionSurface(route = discussionRoute()) {
  if (!route) return null;
  const roots = document.querySelectorAll(
    route.surface === "watch" ? "ytd-watch-flexy, ytd-watch-grid" : "ytd-reel-video-renderer",
  );
  for (const root of roots) {
    if (!isVisibleSurface(root)) continue;
    if (route.surface === "shorts") {
      const rect = root.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= innerHeight ||
        rect.left >= innerWidth
      )
        continue;
    }
    if (route.surface === "watch" && root.getAttribute("video-id") !== route.videoId) continue;
    const state = nativeState(root);
    if (
      state?.madeForKids === true ||
      ["is-made-for-kids", "made-for-kids"].some((key) => root.hasAttribute(key) && root.getAttribute(key) !== "false")
    )
      continue;
    const disabled = state?.videoId === route.videoId && state.disabled === true;
    if (!disabled && !(route.surface === "watch" && disabledWatchNotice(root))) continue;
    const host =
      route.surface === "watch"
        ? root.querySelector("ytd-comments")
        : root.querySelector("reel-action-bar-view-model, #actions");
    if (host) return { ...route, root, host };
  }
  return null;
}
