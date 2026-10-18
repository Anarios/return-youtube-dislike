export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function button(text, onClick, className = "ryd-discussion-button") {
  const node = element("button", className, text);
  node.type = "button";
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

export function statusNode() {
  const node = element("p", "ryd-discussion-status");
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  return node;
}

export function isDiscussionCommentId(value) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || "");
}

export function discussionLinkTarget(value = location.href) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.youtube.com") return null;
    const videoId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    const commentId = new URLSearchParams(url.hash.slice(1)).get("rydComment") || url.searchParams.get("rydComment");
    return /^[A-Za-z0-9_-]{11}$/.test(videoId || "") && isDiscussionCommentId(commentId)
      ? { videoId, commentId }
      : null;
  } catch {
    return null;
  }
}

export function threadUrl(notification) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(notification?.videoId || "") || !isDiscussionCommentId(notification?.commentId))
    return null;
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", notification.videoId);
  url.hash = new URLSearchParams({ rydComment: notification.commentId }).toString();
  return url.href;
}

export function shortDate(value, language) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(language, { month: "short", day: "numeric", year: "numeric" });
}

export function thumbIcon(dislike = false) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add("ryd-discussion-thumb");
  if (dislike) icon.classList.add("is-down");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M7 10v12H2V10h5Zm2 12V10l5-8 1.1.4c.9.4 1.4 1.4 1.2 2.4L15.5 9H20a2 2 0 0 1 2 2v2l-3 9H9ZM3.5 11.5v9H5.5v-9h-2Zm7 9h7.4l2.6-7.7V11a.5.5 0 0 0-.5-.5h-6.3l1.1-6a.8.8 0 0 0-.2-.6L10.5 10.4v10.1Z",
  );
  icon.append(path);
  return icon;
}
