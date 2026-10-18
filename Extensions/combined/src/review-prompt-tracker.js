const STORAGE_KEY = "reviewPromptState";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VIDEO_THRESHOLD = 5;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

function isVideoId(value) {
  return typeof value === "string" && VIDEO_ID.test(value);
}

function isValidState(state) {
  if (state === undefined) return true;
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const keys = Object.keys(state);
  if (keys.length !== 1) return false;
  if (keys[0] === "shown") return state.shown === true;
  if (keys[0] === "eligible") return state.eligible === true;
  return (
    keys[0] === "videoIds" &&
    Array.isArray(state.videoIds) &&
    state.videoIds.length > 0 &&
    state.videoIds.length < VIDEO_THRESHOLD &&
    state.videoIds.every(isVideoId) &&
    new Set(state.videoIds).size === state.videoIds.length
  );
}

function videoPageKey(url, videoId) {
  try {
    const page = new URL(url);
    if (!["https:", "http:"].includes(page.protocol) || !YOUTUBE_HOSTS.has(page.hostname)) return null;
    if (
      (page.pathname === "/watch" && page.searchParams.get("v") === videoId) ||
      page.pathname === `/shorts/${videoId}` ||
      page.pathname === `/shorts/${videoId}/`
    )
      return `video:${videoId}`;
    const clip = /^\/clip\/([A-Za-z0-9_-]+)\/?$/.exec(page.pathname);
    return clip ? `clip:${clip[1]}` : null;
  } catch (_) {
    return null;
  }
}

function isAllowedAction(api, action, sender) {
  const manifest = api?.runtime?.getManifest?.();
  const pageKey = videoPageKey(sender?.url, action?.videoId);
  return (
    manifest?.manifest_version === 3 &&
    typeof manifest.background?.service_worker === "string" &&
    manifest.background.service_worker.length > 0 &&
    !manifest.browser_specific_settings?.gecko &&
    typeof api.runtime.id === "string" &&
    api.runtime.id.length > 0 &&
    sender?.id === api.runtime.id &&
    sender.frameId === 0 &&
    Number.isInteger(sender.tab?.id) &&
    sender.tab.id >= 0 &&
    sender.tab.incognito === false &&
    api.extension?.inIncognitoContext !== true &&
    isVideoId(action?.videoId) &&
    (action.vote === 1 || action.vote === -1) &&
    pageKey !== null &&
    (sender.tab.url == null || videoPageKey(sender.tab.url, action.videoId) === pageKey)
  );
}

export function createReviewPromptTracker(api) {
  let queue = Promise.resolve();
  let consumed = false;

  async function recordAction(action, sender) {
    const previous = queue;
    let release;
    queue = new Promise((resolve) => {
      release = resolve;
    });

    try {
      await previous;
      if (!isAllowedAction(api, action, sender)) return { showPrompt: false };
      if (consumed) return { showPrompt: false };

      const state = (await api.storage.local.get(STORAGE_KEY))?.[STORAGE_KEY];
      if (state?.shown === true) {
        consumed = true;
        return { showPrompt: false };
      }
      if (!isValidState(state)) return { showPrompt: false };
      if (state?.eligible === true) {
        if (action.vote !== -1 || action.canShow !== true) return { showPrompt: false };
        consumed = true;
        await api.storage.local.set({ [STORAGE_KEY]: { shown: true } });
        const confirmed = (await api.storage.local.get(STORAGE_KEY))?.[STORAGE_KEY];
        return { showPrompt: confirmed?.shown === true && isValidState(confirmed) };
      }

      const storedIds = state?.videoIds ?? [];
      if (storedIds.includes(action.videoId)) return { showPrompt: false };
      const videoIds = [...storedIds, action.videoId];
      if (videoIds.length >= VIDEO_THRESHOLD) {
        await api.storage.local.set({ [STORAGE_KEY]: { eligible: true } });
      } else {
        await api.storage.local.set({ [STORAGE_KEY]: { videoIds } });
      }
      return { showPrompt: false };
    } catch (_) {
      return { showPrompt: false };
    } finally {
      release();
    }
  }

  return { recordAction };
}
