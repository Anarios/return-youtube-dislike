import { getBrowser, getVideoId, localize } from "./utils";
import { getDislikeButton } from "./buttons";

const PROMPT_ID = "ryd-review-prompt";
const MIN_PROMPT_SPACE = 96;
const REVIEW_URL =
  "https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi/reviews";
let displayAttempted = false;

function isCurrentVideo(videoId) {
  return (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(window.location.hostname) &&
    getVideoId(window.location.href) === videoId
  );
}

function canShowPrompt(videoId) {
  const anchor = getDislikeButton();
  const rect = anchor?.getBoundingClientRect();
  return (
    isCurrentVideo(videoId) &&
    document.visibilityState === "visible" &&
    !document.fullscreenElement &&
    !!document.body &&
    !!anchor?.isConnected &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth &&
    Math.max(rect.top - 28, window.innerHeight - rect.bottom - 28) >= MIN_PROMPT_SPACE &&
    !document.querySelector(`#${PROMPT_ID}, #ryd-consent-prompt, .ryd-premium-analytics.is-expanded`)
  );
}

function showReviewPrompt(videoId) {
  if (!canShowPrompt(videoId)) return;
  const anchor = getDislikeButton();

  const host = document.createElement("div");
  host.id = PROMPT_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed !important;
      inset: var(--ryd-review-top, 0px) auto auto var(--ryd-review-left, 0px) !important;
      display: block !important;
      box-sizing: border-box !important;
      width: min(320px, calc(100vw - 32px)) !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      overflow: visible !important;
      z-index: 2147483645 !important;
    }
    section {
      position: relative;
      padding: 16px;
      border: 1px solid var(--yt-spec-10-percent-layer, #dedede);
      border-radius: 12px;
      background: var(--yt-spec-base-background, #fff);
      color: var(--yt-spec-text-primary, #0f0f0f);
      box-shadow: 0 4px 20px #0003;
      font: 14px/1.45 Roboto, Arial, sans-serif;
      direction: var(--ryd-review-direction, ltr);
    }
    :host-context(html[dark]) section {
      background: #272727;
      color: var(--yt-spec-text-primary, #f1f1f1);
      border-color: var(--yt-spec-10-percent-layer, #ffffff26);
    }
    * { box-sizing: border-box; }
    .brand { display: flex; align-items: center; gap: 7px; margin: 0 24px 10px 0; font-size: 12px; font-weight: 500; }
    .brand svg { width: 24px; height: 24px; flex: none; }
    .pointer {
      position: absolute;
      width: 10px;
      height: 10px;
      left: var(--ryd-review-pointer, 24px);
      top: -6px;
      background: inherit;
      border-top: inherit;
      border-left: inherit;
      transform: rotate(45deg);
    }
    :host([data-placement="above"]) .pointer { top: auto; bottom: -6px; transform: rotate(225deg); }
    h2 { margin: 0 32px 6px 0; font-size: 16px; font-weight: 600; }
    p { margin: 0 0 14px; white-space: pre-line; }
    a {
      display: inline-block;
      padding: 7px 12px;
      border-radius: 18px;
      background: #cc0000;
      color: #fff;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { background: #ad0000; }
    button {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font: 24px/1 Arial, sans-serif;
      cursor: pointer;
    }
    button:hover { background: #8882; }
    :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  `;
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", localize("reviewPromptTitle"));
  const pointer = document.createElement("span");
  pointer.className = "pointer";
  pointer.setAttribute("aria-hidden", "true");
  const brand = document.createElement("div");
  brand.className = "brand";
  const logo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  logo.setAttribute("viewBox", "0 0 24 24");
  logo.setAttribute("aria-hidden", "true");
  for (const [d, fill] of [
    [
      "M14.9 3H6c-.9 0-1.6.5-1.9 1.2l-3 7c-.1.3-.1.5-.1.7v2c0 1.1.9 2 2 2h6.3l-.9 4.5c-.1.5 0 1 .4 1.4l1.1 1.1 6.5-6.6c.4-.4.6-.9.6-1.4V5c-.1-1.1-1-2-2.1-2zm7.4 12.8h-2.9c-.4 0-.7-.3-.7-.7V3.9c0-.4.3-.7.7-.7h2.9c.4 0 .7.3.7.7V15c0 .4-.3.8-.7.8z",
      "#f00",
    ],
    ["m8 12.5 5.1-2.9L8 6.7v5.8z", "#fff"],
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", fill);
    logo.append(path);
  }
  brand.append(logo, "Return YouTube Dislike");
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  const title = document.createElement("h2");
  title.textContent = localize("reviewPromptTitle");
  const body = document.createElement("p");
  body.textContent = localize("reviewPromptBody");
  announcement.append(title, body);
  const review = document.createElement("a");
  review.href = REVIEW_URL;
  review.target = "_blank";
  review.rel = "noopener noreferrer";
  review.textContent = localize("reviewPromptAction");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", localize("discussion_close"));

  let frame = 0;
  let observer;
  const dismiss = () => {
    host.remove();
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("resize", schedulePosition);
    document.removeEventListener("scroll", schedulePosition, true);
    document.removeEventListener("yt-navigate-start", dismiss);
    document.removeEventListener("fullscreenchange", dismiss);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("pagehide", dismiss);
    window.removeEventListener("popstate", dismiss);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") dismiss();
  };
  const position = () => {
    const rect = anchor.getBoundingClientRect();
    if (
      !anchor.isConnected ||
      !rect.width ||
      !rect.height ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight ||
      rect.right <= 0 ||
      rect.left >= innerWidth
    ) {
      dismiss();
      return;
    }
    const margin = 16;
    const gap = 12;
    const width = host.getBoundingClientRect().width;
    const naturalHeight = panel.scrollHeight + 2;
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - margin));
    const belowSpace = Math.max(0, innerHeight - margin - rect.bottom - gap);
    const aboveSpace = Math.max(0, rect.top - gap - margin);
    const placeAbove = naturalHeight > belowSpace && aboveSpace > belowSpace;
    const space = placeAbove ? aboveSpace : belowSpace;
    if (space < MIN_PROMPT_SPACE) {
      dismiss();
      return;
    }
    panel.style.maxHeight = `${space}px`;
    panel.style.overflowY = naturalHeight > space ? "auto" : "visible";
    const height = host.getBoundingClientRect().height;
    const top = placeAbove ? rect.top - gap - height : rect.bottom + gap;
    host.style.setProperty("--ryd-review-left", `${left}px`);
    host.style.setProperty("--ryd-review-top", `${top}px`);
    host.style.setProperty(
      "--ryd-review-pointer",
      `${Math.max(16, Math.min(width - 26, rect.left + rect.width / 2 - left - 5))}px`,
    );
    host.dataset.placement = placeAbove ? "above" : "below";
  };
  const schedulePosition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  };
  close.addEventListener("click", dismiss);
  review.addEventListener("click", dismiss);
  document.addEventListener("yt-navigate-start", dismiss);
  document.addEventListener("fullscreenchange", dismiss);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("pagehide", dismiss);
  window.addEventListener("popstate", dismiss);
  panel.append(pointer, brand, announcement, review, close);
  shadow.append(style, panel);

  // Older Chromium builds keep the same fixed-position presentation.
  const hasPopover = "popover" in HTMLElement.prototype && typeof host.showPopover === "function";
  if (hasPopover) {
    host.setAttribute("popover", "manual");
    close.setAttribute("popovertarget", PROMPT_ID);
    close.setAttribute("popovertargetaction", "hide");
  }
  const direction = getBrowser().i18n?.getMessage("@@bidi_dir");
  if (direction === "rtl") host.style.setProperty("--ryd-review-direction", "rtl");
  document.body.append(host);
  if (hasPopover) host.showPopover();
  position();
  window.addEventListener("resize", schedulePosition);
  document.addEventListener("scroll", schedulePosition, true);
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(schedulePosition);
    observer.observe(anchor);
    observer.observe(panel);
    observer.observe(document.body);
  }
}

async function recordReviewAction(videoId, vote) {
  try {
    if (displayAttempted) return;
    const api = getBrowser();
    const manifest = api?.runtime?.getManifest?.();
    if (
      manifest?.manifest_version !== 3 ||
      !manifest.background?.service_worker ||
      api.extension?.inIncognitoContext === true ||
      ![1, -1].includes(vote) ||
      !isCurrentVideo(videoId)
    ) {
      return;
    }
    const response = await api.runtime.sendMessage({
      message: "ryd_review_action",
      videoId,
      vote,
      canShow: canShowPrompt(videoId),
    });
    if (response?.showPrompt === true && !displayAttempted) {
      // A failed or interrupted display still consumes this page's only attempt.
      displayAttempted = true;
      showReviewPrompt(videoId);
    }
  } catch (_) {
    // An optional review request must never interrupt a reaction.
  }
}

export { recordReviewAction };
