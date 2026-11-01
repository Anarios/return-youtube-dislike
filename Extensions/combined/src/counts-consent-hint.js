import { getButtonControls, hasRenderedBox } from "./buttons";
import { consentApi } from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getVideoId } from "./utils";

const COUNTS_HINT_DISMISSED_KEY = "rydCountsConsentDismissed";

function createCountsConsentHintController({ onDismiss = () => {} } = {}) {
  const api = consentApi();
  let host = null;
  let context = null;
  let frame = 0;
  let observer = null;
  let dismissed = false;

  function isCurrent(value = context) {
    const controls = getButtonControls();
    return Boolean(
      value &&
        !isPrivateBrowsingContext() &&
        (location.pathname === "/watch" || location.pathname.startsWith("/shorts/")) &&
        value.url === location.href &&
        value.videoId === getVideoId(location.href) &&
        controls.buttons === value.buttons &&
        value.buttons.contains(value.anchor) &&
        hasRenderedBox(value.anchor),
    );
  }

  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    host?.remove();
    host = null;
    context = null;
  }

  function position() {
    frame = 0;
    if (!host || !isCurrent()) {
      hide();
      return;
    }
    const anchor = context.anchor.getBoundingClientRect();
    if (anchor.bottom <= 0 || anchor.right <= 0 || anchor.top >= innerHeight || anchor.left >= innerWidth) {
      hide();
      return;
    }
    const margin = 8;
    const width = host.getBoundingClientRect().width || 160;
    const height = host.getBoundingClientRect().height || 32;
    const shorts = location.pathname.startsWith("/shorts/");
    const preferredLeft = shorts ? anchor.left - width - margin : anchor.left + anchor.width / 2 - width / 2;
    const left = Math.max(margin, Math.min(preferredLeft, innerWidth - width - margin));
    const top = Math.max(margin, Math.min(shorts ? anchor.top : anchor.bottom + margin, innerHeight - height - margin));
    host.style.setProperty(
      "--ryd-counts-hint-inline-start",
      `${host.dir === "rtl" ? innerWidth - left - width : left}px`,
    );
    host.style.setProperty("--ryd-counts-hint-block-start", `${top}px`);
  }

  function schedulePosition() {
    if (host && !frame) frame = requestAnimationFrame(position);
  }

  async function loadDismissal() {
    try {
      dismissed ||= (await api.storage.local.get(COUNTS_HINT_DISMISSED_KEY))?.[COUNTS_HINT_DISMISSED_KEY] === true;
    } catch (_) {}
    if (dismissed) hide();
    return dismissed;
  }

  function applyDismissal() {
    dismissed = true;
    hide();
    onDismiss();
  }

  function dismiss() {
    void api.storage.local.set({ [COUNTS_HINT_DISMISSED_KEY]: true }).catch(() => {});
    applyDismissal();
  }

  function storageChanged(changes, area) {
    if (area === "local" && !dismissed && changes[COUNTS_HINT_DISMISSED_KEY]?.newValue === true) applyDismissal();
  }

  function sync(controls, videoId) {
    const anchor = controls?.nativeDislikeButton ?? controls?.nativeLikeButton;
    const next = { anchor, buttons: controls?.buttons, url: location.href, videoId };
    if (dismissed || !controls?.ready || !videoId || !isCurrent(next)) {
      hide();
      return;
    }
    if (context?.anchor === anchor && context.buttons === controls.buttons && context.url === location.href) {
      position();
      return;
    }
    hide();
    context = next;
    host = document.createElement("div");
    host.id = "ryd-counts-consent-hint";
    host.dir = api.i18n.getMessage("@@bidi_dir") === "rtl" ? "rtl" : "ltr";
    host.lang = api.i18n.getUILanguage?.() || document.documentElement.lang;
    const shadow = host.attachShadow({ mode: "open", delegatesFocus: true });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial; position: fixed; z-index: 2147483646; box-sizing: border-box;
        inset-block-start: var(--ryd-counts-hint-block-start, 8px);
        inset-inline-start: var(--ryd-counts-hint-inline-start, 8px);
        max-inline-size: min(240px, calc(100vw - 16px));
        color: var(--yt-spec-text-primary, #0f0f0f); background: var(--yt-spec-base-background, #fff);
        border-radius: 18px; font: 12px/1.4 Roboto, Arial, sans-serif; text-align: start;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 4px; }
      button {
        min-block-size: 32px; min-inline-size: 24px; padding: 6px 10px;
        border: 1px solid currentColor; border-radius: 18px; font: inherit;
        color: inherit; background: transparent; cursor: pointer;
      }
      button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      button[aria-disabled="true"] { opacity: .65; cursor: wait; }
      p { margin: 0; }
      p:not(:empty) { padding: 8px; }
      @media (pointer: coarse) { button { min-block-size: 44px; } }
      @media (forced-colors: active) { button { border-color: ButtonText; } }
    `;
    const reason = document.createElement("p");
    reason.id = "ryd-counts-consent-reason";
    reason.textContent = api.i18n.getMessage("counts_consent_reason");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = api.i18n.getMessage("counts_consent_enable");
    const status = document.createElement("p");
    status.id = "ryd-counts-consent-status";
    status.setAttribute("role", "status");
    button.setAttribute("aria-describedby", `${reason.id} ${status.id}`);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isCurrent(next) || button.getAttribute("aria-disabled") === "true") return;
      button.setAttribute("aria-disabled", "true");
      status.textContent = "";
      try {
        const result = await api.runtime.sendMessage({ message: "ryd_open_counts_popup" });
        if (result?.success !== true && isCurrent(next))
          status.textContent = api.i18n.getMessage("counts_consent_toolbar");
      } catch (_) {
        if (isCurrent(next)) status.textContent = api.i18n.getMessage("counts_consent_toolbar");
      } finally {
        button.removeAttribute("aria-disabled");
        schedulePosition();
      }
    });
    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "dismiss";
    dismissButton.textContent = api.i18n.getMessage("vote_consent_dismiss");
    dismissButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    });
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(button, dismissButton);
    for (const eventName of ["click", "pointerdown", "pointerup", "keydown", "keyup"]) {
      shadow.addEventListener(eventName, (event) => event.stopPropagation());
    }
    shadow.append(style, reason, actions, status);
    (document.body || document.documentElement).append(host);
    observer ??= new MutationObserver(schedulePosition);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "is-active", "video-id", "href"],
    });
    position();
  }

  api.storage.onChanged.addListener(storageChanged);
  document.addEventListener("yt-navigate-start", hide);
  window.addEventListener("pagehide", hide);
  window.addEventListener("popstate", hide);
  window.addEventListener("resize", schedulePosition);
  document.addEventListener("scroll", schedulePosition, true);
  return {
    hide,
    isDismissed: () => dismissed,
    loadDismissal,
    sync,
    destroy() {
      hide();
      api.storage.onChanged.removeListener(storageChanged);
      document.removeEventListener("yt-navigate-start", hide);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("popstate", hide);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
    },
  };
}

export { COUNTS_HINT_DISMISSED_KEY, createCountsConsentHintController };
