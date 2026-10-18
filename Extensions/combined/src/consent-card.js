import { getButtons, getDislikeButton, getLikeButton, hasRenderedBox } from "./buttons";

function createConsentCard({ api, dismissed = false }) {
  const host = document.createElement("div");
  host.id = "ryd-consent-prompt";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed !important;
      inset: var(--ryd-consent-top, 16px) auto auto var(--ryd-consent-left, 16px) !important;
      display: block !important;
      box-sizing: border-box !important;
      width: min(360px, calc(100vw - 32px)) !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      z-index: 2147483647 !important;
      color-scheme: light;
      --card-background: #fff;
      --card-color: #0f0f0f;
      --card-border: #dedede;
    }
    :host([data-theme="dark"]) {
      color-scheme: dark;
      --card-background: #272727;
      --card-color: #f1f1f1;
      --card-border: #ffffff40;
    }
    :host([collapsed]) { width: max-content !important; max-width: calc(100vw - 32px) !important; }
    * { box-sizing: border-box; }
    section, .reopen {
      border: 1px solid var(--card-border);
      border-radius: 12px;
      background: var(--card-background);
      color: var(--card-color);
      box-shadow: 0 4px 20px #0003;
      font: 14px/1.45 Roboto, Arial, sans-serif;
    }
    section { position: relative; padding: 16px; overflow-y: auto; overscroll-behavior: contain; }
    .pointer {
      position: absolute; width: 10px; height: 10px; top: -5px; left: var(--ryd-consent-pointer, 24px);
      background: var(--card-background); border: 1px solid var(--card-border); transform: rotate(45deg);
    }
    :host([data-placement="above"]) .pointer { top: auto; bottom: -5px; }
    :host([data-placement="fallback"]) .pointer, :host([collapsed]) .pointer { display: none; }
    .brand { display: flex; align-items: center; gap: 7px; margin: 0 24px 10px 0; font-size: 12px; font-weight: 500; }
    .brand svg { width: 24px; height: 24px; flex: none; }
    h2 { margin: 0 24px 8px 0; font-size: 18px; font-weight: 600; }
    p { margin: 0 0 16px; }
    .status { margin: 12px 0 0; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    button { cursor: pointer; font: inherit; }
    .actions button { padding: 8px 14px; border: 0; border-radius: 20px; font-weight: 500; }
    .continue { background: #cc0000; color: #fff; }
    .continue:hover { background: #ad0000; }
    .details { background: transparent; color: inherit; }
    .details:hover, .close:hover { background: #8882; }
    button:disabled { cursor: wait; opacity: .65; }
    .close {
      position: absolute; top: 8px; right: 8px; width: 32px; height: 32px;
      padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit;
      font: 24px/1 Arial, sans-serif;
    }
    .reopen { display: flex; align-items: center; gap: 8px; padding: 9px 12px; max-width: 100%; overflow-y: auto; }
    .reopen svg { width: 22px; height: 22px; flex: none; }
    :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
    [hidden] { display: none !important; }
  `;
  const panel = document.createElement("section");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "ryd-consent-title");
  panel.setAttribute("aria-describedby", "ryd-consent-description");
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
  const title = document.createElement("h2");
  title.id = "ryd-consent-title";
  title.textContent = "Enable dislike counts";
  const body = document.createElement("p");
  body.id = "ryd-consent-description";
  body.textContent =
    "Firefox needs permission to send the video ID and available like count to RYD for dislike counts. When you vote, RYD also sends your choice with a saved random voting ID.";
  const status = document.createElement("p");
  status.className = "status";
  status.setAttribute("role", "status");
  status.hidden = true;
  const actions = document.createElement("div");
  actions.className = "actions";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "continue";
  next.textContent = "Continue";
  const details = document.createElement("button");
  details.type = "button";
  details.className = "details";
  details.textContent = "Read more";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close");
  const reopen = document.createElement("button");
  reopen.type = "button";
  reopen.className = "reopen";
  reopen.append(logo.cloneNode(true), "Enable dislike counts");
  actions.append(next, details);
  panel.append(brand, title, body, actions, status, close);
  shadow.append(style, pointer, panel, reopen);

  let disposed = false;
  let frame = 0;
  let anchor = null;
  let sizeObserver;
  function setCollapsed(collapsed) {
    host.toggleAttribute("collapsed", collapsed);
    panel.hidden = collapsed;
    reopen.hidden = !collapsed;
    position();
  }
  function expand() {
    setCollapsed(false);
    next.focus();
  }
  async function collapse() {
    const restoreFocus = panel.contains(shadow.activeElement);
    setCollapsed(true);
    if (restoreFocus) reopen.focus();
    try {
      await api.storage.local.set({ rydConsentDismissed: true });
    } catch (_) {}
  }
  async function openPage(showDetails) {
    if (next.disabled || disposed) return;
    next.disabled = details.disabled = true;
    actions.setAttribute("aria-busy", "true");
    status.hidden = true;
    try {
      const result = await api.runtime.sendMessage({
        message: "ryd_open_consent",
        ...(showDetails ? { details: true } : {}),
      });
      if (result?.success === false) throw new Error("Consent page could not be opened");
    } catch (_) {
      status.textContent = "Could not open the permission page. Please try again.";
      status.hidden = false;
    } finally {
      next.disabled = details.disabled = false;
      actions.removeAttribute("aria-busy");
      schedulePosition();
    }
  }
  const continueClick = () => void openPage(false);
  const detailsClick = () => void openPage(true);
  function onKeyDown(event) {
    if (event.key === "Escape" && !panel.hidden) {
      event.stopPropagation();
      void collapse();
    }
  }
  function visibleAnchor() {
    const buttons = getButtons();
    return [getDislikeButton(buttons), getLikeButton(buttons), buttons].find((element) => {
      if (!hasRenderedBox(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
  }
  function position() {
    if (disposed) return;
    if (!host.isConnected) (document.body || document.documentElement).append(host);
    const currentAnchor = visibleAnchor();
    if (anchor !== currentAnchor) {
      if (anchor) sizeObserver?.unobserve(anchor);
      anchor = currentAnchor;
      if (anchor) sizeObserver?.observe(anchor);
    }
    const margin = 16;
    const gap = 12;
    const availableWidth = Math.max(0, innerWidth - margin * 2);
    const availableHeight = Math.max(0, innerHeight - margin * 2);
    const surface = panel.hidden ? reopen : panel;
    const width = Math.min(host.getBoundingClientRect().width || 360, availableWidth);
    const naturalHeight = surface.scrollHeight + 2;
    let left = innerWidth - margin - width;
    let top = Math.min(72, Math.max(margin, innerHeight - margin - Math.min(120, availableHeight)));
    let space = Math.max(0, innerHeight - top - margin);
    let placement = "fallback";
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const belowSpace = Math.max(0, innerHeight - margin - rect.bottom - gap);
      const aboveSpace = Math.max(0, rect.top - gap - margin);
      const above = naturalHeight > belowSpace && aboveSpace > belowSpace;
      const anchorSpace = above ? aboveSpace : belowSpace;
      if (anchorSpace >= Math.min(120, naturalHeight)) {
        space = anchorSpace;
        left = rect.left + rect.width / 2 - width / 2;
        top = above ? rect.top - gap - Math.min(naturalHeight, space) : rect.bottom + gap;
        placement = above ? "above" : "below";
      }
    }
    surface.style.maxHeight = `${space}px`;
    const height = Math.min(surface.getBoundingClientRect().height || naturalHeight, space);
    left = Math.max(margin, Math.min(left, innerWidth - margin - width));
    top = Math.max(margin, Math.min(top, innerHeight - margin - height));
    host.style.setProperty("--ryd-consent-left", `${left}px`);
    host.style.setProperty("--ryd-consent-top", `${top}px`);
    host.dataset.placement = placement;
    if (anchor && placement !== "fallback") {
      const rect = anchor.getBoundingClientRect();
      host.style.setProperty(
        "--ryd-consent-pointer",
        `${Math.max(16, Math.min(width - 26, rect.left + rect.width / 2 - left - 5))}px`,
      );
    }
  }
  function schedulePosition() {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      position();
    });
  }
  function syncTheme() {
    host.dataset.theme = document.documentElement.hasAttribute("dark") ? "dark" : "light";
  }
  close.addEventListener("click", collapse);
  reopen.addEventListener("click", expand);
  next.addEventListener("click", continueClick);
  details.addEventListener("click", detailsClick);
  shadow.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", schedulePosition);
  document.addEventListener("scroll", schedulePosition, true);
  document.addEventListener("yt-navigate-finish", schedulePosition);
  const domObserver = new MutationObserver(schedulePosition);
  domObserver.observe(document.documentElement, { childList: true, subtree: true });
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });
  if (typeof ResizeObserver !== "undefined") {
    sizeObserver = new ResizeObserver(schedulePosition);
    sizeObserver.observe(panel);
    sizeObserver.observe(reopen);
    sizeObserver.observe(document.documentElement);
  }
  syncTheme();
  setCollapsed(dismissed);
  return {
    host,
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      domObserver.disconnect();
      themeObserver.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      document.removeEventListener("yt-navigate-finish", schedulePosition);
      close.removeEventListener("click", collapse);
      reopen.removeEventListener("click", expand);
      next.removeEventListener("click", continueClick);
      details.removeEventListener("click", detailsClick);
      shadow.removeEventListener("keydown", onKeyDown);
      host.remove();
    },
  };
}

export { createConsentCard };
