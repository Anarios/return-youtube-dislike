(() => {
  const REQUEST = "ryd-discussion-state-request";
  const ATTRIBUTE = "data-ryd-discussion-native-state";
  const INSTALL = Symbol.for("return-youtube-dislike.discussion-bridge");
  if (window[INSTALL]) return;
  window[INSTALL] = true;

  function data(element) {
    return element?.polymerController?.data || element?.data || null;
  }

  function hasDisabledNotice(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 14) return false;
    if (value.messageRenderer) {
      const runs = value.messageRenderer.text?.runs || [];
      if (
        runs.some((run) => {
          try {
            const url = new URL(run.navigationEndpoint?.urlEndpoint?.url);
            return url.hostname === "support.google.com" && url.pathname === "/youtube/answer/9706180";
          } catch {
            return false;
          }
        })
      )
        return true;
    }
    return Object.values(value).some((child) => hasDisabledNotice(child, depth + 1));
  }

  function positiveKidsFlag(value) {
    return ["isMadeForKids", "madeForKids", "is_made_for_kids"].some((key) => value?.[key] === true);
  }

  function hasKidsMiniplayerNotice(response) {
    const renderer = response?.playabilityStatus?.miniplayer?.miniplayerRenderer;
    if (renderer?.playbackMode !== "PLAYBACK_MODE_PAUSED_ONLY") return false;
    const warning = renderer.minimizedEndpoint?.openPopupAction?.popup?.notificationActionRenderer;
    const command = warning?.actionButton?.buttonRenderer?.command;
    return [command?.urlEndpoint?.url, command?.commandMetadata?.webCommandMetadata?.url].some((value) => {
      if (typeof value !== "string") return false;
      try {
        const url = new URL(value, "https://www.youtube.com");
        return (
          url.protocol === "https:" &&
          url.hostname === "support.google.com" &&
          (url.pathname === "/youtube/answer/9632097" ||
            (url.pathname === "/youtube/bin/answer.py" && url.searchParams.get("answer") === "9632097"))
        );
      } catch {
        return false;
      }
    });
  }

  function isMadeForKids(root, videoId) {
    if (
      ["is-made-for-kids", "made-for-kids"].some(
        (name) => root.hasAttribute(name) && root.getAttribute(name) !== "false",
      )
    )
      return true;
    const controller = root.polymerController || root;
    const rootData = data(root);
    if (
      positiveKidsFlag(rootData) ||
      ((!rootData?.videoDetails?.videoId || rootData.videoDetails.videoId === videoId) &&
        positiveKidsFlag(rootData?.videoDetails))
    )
      return true;
    const player = root.querySelector("#movie_player, #shorts-player") || document.querySelector("#shorts-player");
    const candidates = [controller.playerData, controller.playerResponse, data(root)?.playerResponse];
    try {
      candidates.push(player?.getPlayerResponse?.());
    } catch {
      /* Player may be between videos. */
    }
    if (window.ytInitialPlayerResponse?.videoDetails?.videoId === videoId)
      candidates.push(window.ytInitialPlayerResponse);
    return candidates.some((value) => {
      if (value?.videoDetails?.videoId !== videoId) return false;
      const microformat = value.microformat?.playerMicroformatRenderer;
      return (
        positiveKidsFlag(value) ||
        positiveKidsFlag(value.videoDetails) ||
        hasKidsMiniplayerNotice(value) ||
        ((!microformat?.videoId || microformat.videoId === videoId) && positiveKidsFlag(microformat))
      );
    });
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
      const actionData = data(root.querySelector("reel-action-bar-view-model"));
      disabled = (actionData?.buttonViewModels || []).some((item) => {
        const button = item.buttonViewModel;
        return button?.iconName === "SHORTS_COMMENT" && button.state === "BUTTON_VIEW_MODEL_STATE_DISABLED";
      });
      const overlayButtons =
        rootData?.overlay?.reelPlayerOverlayRenderer?.buttonBar?.reelActionBarViewModel?.buttonViewModels || [];
      disabled ||= overlayButtons.some(
        (item) =>
          item.buttonViewModel?.iconName === "SHORTS_COMMENT" &&
          item.buttonViewModel.state === "BUTTON_VIEW_MODEL_STATE_DISABLED",
      );
    } else {
      if (url.pathname !== "/watch" || root.getAttribute("video-id") !== videoId) return;
      disabled = [...root.querySelectorAll("ytd-comments")].some((comments) => hasDisabledNotice(data(comments)));
    }
    root.setAttribute(ATTRIBUTE, JSON.stringify({ videoId, disabled, madeForKids: isMadeForKids(root, videoId) }));
  }
  document.addEventListener(REQUEST, inspect, true);
})();
