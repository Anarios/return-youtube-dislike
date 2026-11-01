import { getButtons, getDislikeButton, getLikeButton, hasRenderedBox } from "./buttons";
import {
  FEATURE_DATA_PERMISSIONS,
  consentApi,
  hasFeaturePermission,
  onDataPermissionsChanged,
} from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getVideoId } from "./utils";

const VOTE_HINT_DISMISSED_KEY = "rydVoteConsentDismissed";
const LIVE_REGION_DELAY_MS = 100;

function createVoteConsentHintController() {
  const api = consentApi();
  let pageEpoch = 0;
  let pending = null;
  let host = null;
  let frame = 0;
  let announcement = 0;
  let destroyed = false;
  let closedForTab = false;

  function isVideoPage() {
    return location.pathname === "/watch" || location.pathname.startsWith("/shorts/");
  }

  function capturePageContext(videoId) {
    return { pageEpoch, url: location.href, videoId };
  }

  function isCurrent(context) {
    return (
      !destroyed &&
      !isPrivateBrowsingContext() &&
      context?.pageEpoch === pageEpoch &&
      context.url === location.href &&
      context.videoId === getVideoId(location.href) &&
      Boolean(context.videoId) &&
      isVideoPage()
    );
  }

  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(announcement);
    announcement = 0;
    host?.remove();
    host = null;
  }

  function clearPending() {
    pending = null;
    hide();
  }

  function discard() {
    pageEpoch += 1;
    clearPending();
  }

  function closeForTab() {
    closedForTab = true;
    clearPending();
  }

  function position() {
    frame = 0;
    if (!host || !isCurrent(pending?.context)) {
      hide();
      return;
    }
    const buttons = getButtons();
    const anchor = [getDislikeButton(buttons), getLikeButton(buttons), buttons].find(hasRenderedBox);
    if (!anchor) {
      hide();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const width = host.getBoundingClientRect().width || Math.min(320, innerWidth - margin * 2);
    const height = host.getBoundingClientRect().height || 120;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - margin));
    const top = Math.max(margin, Math.min(rect.bottom + margin, innerHeight - height - margin));
    host.style.setProperty(
      "--ryd-vote-hint-inline-start",
      `${host.dir === "rtl" ? innerWidth - left - width : left}px`,
    );
    host.style.setProperty("--ryd-vote-hint-block-start", `${top}px`);
  }

  function schedulePosition() {
    if (host && !frame) frame = requestAnimationFrame(position);
  }

  async function submitIfGranted() {
    const request = pending;
    if (!request || !isCurrent(request.context)) return;
    if (request.checking) {
      request.checkAgain = true;
      return;
    }
    request.checking = true;
    try {
      if (!(await hasFeaturePermission("voting"))) return;
      if (pending !== request || !isCurrent(request.context)) return;
      pending = null;
      hide();
      request.submitCurrentVote();
    } finally {
      request.checking = false;
      if (request.checkAgain && pending === request) {
        request.checkAgain = false;
        void submitIfGranted();
      }
    }
  }

  function show(request) {
    if (host || pending !== request || !isCurrent(request.context)) return;
    host = document.createElement("div");
    host.id = "ryd-vote-consent-hint";
    host.dir = api.i18n.getMessage("@@bidi_dir") === "rtl" ? "rtl" : "ltr";
    host.lang = api.i18n.getUILanguage?.() || document.documentElement.lang;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial; position: fixed; z-index: 2147483646; box-sizing: border-box;
        inset-block-start: var(--ryd-vote-hint-block-start, 12px);
        inset-inline-start: var(--ryd-vote-hint-inline-start, 12px);
        inline-size: min(320px, calc(100vw - 24px)); padding: 12px;
        color: var(--yt-spec-text-primary, #0f0f0f); background: var(--yt-spec-base-background, #fff);
        border: 1px solid var(--yt-spec-10-percent-layer, #ccc); border-radius: 10px;
        box-shadow: 0 2px 12px #0003; font: 14px/1.4 Roboto, Arial, sans-serif;
        text-align: start;
      }
      p { margin-block: 0 8px; }
      .message { padding-inline-end: 28px; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .close {
        position: absolute; inset-block-start: 6px; inset-inline-end: 6px;
        min-inline-size: 32px; padding: 0; border-color: transparent; font-size: 18px; line-height: 1;
      }
      button {
        min-block-size: 32px; min-inline-size: 24px; padding: 6px 10px; border: 1px solid currentColor;
        border-radius: 18px; font: inherit; color: inherit; background: transparent; cursor: pointer;
      }
      button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      button[aria-disabled="true"] { opacity: .65; cursor: wait; }
      .status { margin: 0; }
      .status:not(:empty) { margin-block-start: 8px; }
      @media (pointer: coarse) { button { min-block-size: 44px; } }
      @media (forced-colors: active) { :host { border-color: CanvasText; } }
    `;
    const text = document.createElement("p");
    text.className = "message";
    text.setAttribute("role", "status");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", api.i18n.getMessage("discussion_close"));
    const actions = document.createElement("div");
    actions.className = "actions";
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = api.i18n.getMessage("vote_consent_continue");
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = api.i18n.getMessage("vote_consent_dismiss");
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    next.addEventListener("click", async () => {
      if (next.getAttribute("aria-disabled") === "true" || !isCurrent(request.context)) return;
      next.setAttribute("aria-disabled", "true");
      status.textContent = "";
      try {
        const result = await api.runtime.sendMessage({ message: "ryd_open_consent", feature: "voteOptIn" });
        if (result?.success === false) throw new Error("Permission page unavailable");
      } catch (_) {
        status.textContent = api.i18n.getMessage("vote_consent_open_failed");
      } finally {
        next.removeAttribute("aria-disabled");
        schedulePosition();
      }
    });
    dismiss.addEventListener("click", () => {
      clearPending();
      void api.storage.local.set({ [VOTE_HINT_DISMISSED_KEY]: true }).catch(() => {});
    });
    close.addEventListener("click", closeForTab);
    shadow.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeForTab();
    });
    actions.append(next, dismiss);
    shadow.append(style, close, text, actions, status);
    (document.body || document.documentElement).append(host);
    announcement = setTimeout(() => {
      text.textContent = api.i18n.getMessage("vote_consent_hint");
      schedulePosition();
    }, LIVE_REGION_DELAY_MS);
    position();
  }

  async function offer(context, submitCurrentVote) {
    if (closedForTab || !isCurrent(context)) return;
    const request = { context, submitCurrentVote, checking: false };
    pending = request;
    hide();
    let dismissed = false;
    try {
      dismissed = (await api.storage.local.get(VOTE_HINT_DISMISSED_KEY))?.[VOTE_HINT_DISMISSED_KEY] === true;
    } catch (_) {}
    if (pending !== request || !isCurrent(context)) return;
    if (dismissed) {
      pending = null;
      return;
    }
    show(request);
    void submitIfGranted();
  }

  const unsubscribe = onDataPermissionsChanged(({ added, removed }) => {
    if (removed.includes("websiteActivity") || removed.includes("browsingActivity")) {
      discard();
    }
    if (added.some((category) => FEATURE_DATA_PERMISSIONS.voting.includes(category))) void submitIfGranted();
  });
  document.addEventListener("yt-navigate-start", discard);
  window.addEventListener("popstate", discard);
  window.addEventListener("pagehide", discard);
  window.addEventListener("pageshow", discard);
  window.addEventListener("resize", schedulePosition);
  document.addEventListener("scroll", schedulePosition, true);

  return {
    capturePageContext,
    clearPending,
    isCurrent,
    offer,
    destroy() {
      destroyed = true;
      discard();
      unsubscribe();
      document.removeEventListener("yt-navigate-start", discard);
      window.removeEventListener("popstate", discard);
      window.removeEventListener("pagehide", discard);
      window.removeEventListener("pageshow", discard);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
    },
  };
}

export { createVoteConsentHintController, VOTE_HINT_DISMISSED_KEY };
