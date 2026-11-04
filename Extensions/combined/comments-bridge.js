(() => {
  const REQUEST = "ryd-discussion-state-request";
  const ATTRIBUTE = "data-ryd-discussion-native-state";
  const INSTALL = Symbol.for("return-youtube-dislike.discussion-bridge");
  const MAX_SEARCH_DEPTH = 20;
  const COMMENTS_PANEL_ID = "engagement-panel-comments-section";
  const DISABLED_BUTTON_STATE = "BUTTON_VIEW_MODEL_STATE_DISABLED";
  if (window[INSTALL]) return;
  window[INSTALL] = true;

  function data(element) {
    return element?.polymerController?.data || element?.data || null;
  }

  function findAll(value, matches, depth = 0, found = []) {
    if (!value || typeof value !== "object" || depth > MAX_SEARCH_DEPTH) return found;
    if (matches(value)) found.push(value);
    for (const child of Object.values(value)) findAll(child, matches, depth + 1, found);
    return found;
  }

  function isCommentsOffHelpLink(run) {
    try {
      const url = new URL(run.navigationEndpoint?.urlEndpoint?.url);
      return url.hostname === "support.google.com" && url.pathname === "/youtube/answer/9706180";
    } catch {
      return false;
    }
  }

  function hasCommentsOffHelpLink(value) {
    return findAll(value, (node) => node.messageRenderer).some((node) =>
      (node.messageRenderer.text?.runs || []).some(isCommentsOffHelpLink),
    );
  }

  function safetyModeEnabled() {
    try {
      const user = window.ytcfg?.get?.("INNERTUBE_CONTEXT")?.user;
      return user?.enableSafetyMode === true || user?.lockedSafetyMode === true;
    } catch {
      return false;
    }
  }

  function currentWatchResponse(root, videoId) {
    const response = data(root);
    return response?.currentVideoEndpoint?.watchEndpoint?.videoId === videoId ? response : null;
  }

  function commentSection(response) {
    return (response.contents?.twoColumnWatchNextResults?.results?.results?.contents || [])
      .map((item) => item?.itemSectionRenderer)
      .find((section) => section?.sectionIdentifier === "comment-item-section");
  }

  function hasCommentsPanel(response) {
    return (response.engagementPanels || []).some(
      (panel) => panel?.engagementPanelSectionListRenderer?.targetId === COMMENTS_PANEL_ID,
    );
  }

  function isNoticeOnlySection(section) {
    const contents = section?.contents;
    return (
      !section?.header &&
      Array.isArray(contents) &&
      contents.length > 0 &&
      contents.every((item) => item?.messageRenderer)
    );
  }

  function watchCommentsReplacedByNotice(root, videoId) {
    if (safetyModeEnabled()) return false;
    const response = currentWatchResponse(root, videoId);
    return Boolean(response) && !hasCommentsPanel(response) && isNoticeOnlySection(commentSection(response));
  }

  function watchCommentsUnavailable(root, videoId) {
    return (
      [...root.querySelectorAll("ytd-comments")].some((comments) => hasCommentsOffHelpLink(data(comments))) ||
      watchCommentsReplacedByNotice(root, videoId)
    );
  }

  function likeTarget(value) {
    const [node] = findAll(value, (candidate) => typeof candidate.likeEndpoint?.target?.videoId === "string");
    return node?.likeEndpoint.target.videoId ?? null;
  }

  function isCommentControl(node) {
    return [
      node.iconName,
      node.accessibilityId,
      node.onTap?.innertubeCommand?.showEngagementPanelEndpoint?.identifier?.tag,
    ].some((text) => typeof text === "string" && /comment/i.test(text));
  }

  function shortsCommentsUnavailable(buttonLists, videoId) {
    const current = buttonLists.filter((buttons) => likeTarget(buttons) === videoId);
    const controls = (current.length ? current : buttonLists).flatMap((buttons) => findAll(buttons, isCommentControl));
    if (controls.length) return controls.some((control) => control.state === DISABLED_BUTTON_STATE);
    return current.length > 0;
  }

  function inspect(event) {
    const root = event.target;
    if (!(root instanceof Element) || !root.matches("ytd-watch-flexy, ytd-watch-grid, ytd-reel-video-renderer")) return;
    const url = new URL(location.href);
    const shorts = url.pathname.startsWith("/shorts/");
    const videoId = shorts ? url.pathname.split("/")[2] : url.searchParams.get("v");
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return;
    let disabled = false;
    if (shorts) {
      const player = document.querySelector("#shorts-player");
      let playerId;
      try {
        playerId = player?.getVideoData?.()?.video_id;
      } catch {
        /* Player has not hydrated yet. */
      }
      const rootData = data(root);
      const identity = root.getAttribute("video-id") || rootData?.videoId || rootData?.videoDetails?.videoId;
      const linked = [...root.querySelectorAll("a[href*='/shorts/']")].some((anchor) => {
        try {
          return new URL(anchor.href).pathname === `/shorts/${videoId}`;
        } catch {
          return false;
        }
      });
      const ownsCurrentPlayer = playerId === videoId && root.contains(player);
      if (identity ? identity !== videoId : !linked && !ownsCurrentPlayer) return;
      const actionButtons = data(root.querySelector("reel-action-bar-view-model"))?.buttonViewModels || [];
      const overlayButtons =
        rootData?.overlay?.reelPlayerOverlayRenderer?.buttonBar?.reelActionBarViewModel?.buttonViewModels || [];
      disabled = shortsCommentsUnavailable([actionButtons, overlayButtons], videoId);
    } else {
      if (url.pathname !== "/watch" || root.getAttribute("video-id") !== videoId) return;
      disabled = watchCommentsUnavailable(root, videoId);
    }
    root.setAttribute(ATTRIBUTE, JSON.stringify({ videoId, disabled }));
  }
  document.addEventListener(REQUEST, inspect, true);
})();
