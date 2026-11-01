import { getButtonControls, hasRenderedBox } from "./buttons";
import {
  FEATURE_DATA_PERMISSIONS,
  consentApi,
  hasFeaturePermission,
  onDataPermissionsChanged,
} from "./core-data-consent";
import {
  POPOVER_BACKGROUND,
  POPOVER_HOST_RESET,
  POPOVER_OUTLINE,
  POPOVER_PRIMARY_BUTTON_BACKGROUND,
  POPOVER_PRIMARY_BUTTON_TEXT_COLOR,
  POPOVER_SECONDARY_BUTTON_BACKGROUND,
  POPOVER_SECONDARY_TEXT_COLOR,
  POPOVER_TEXT_COLOR,
} from "./page-popover-style";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getVideoId } from "./utils";

const DATA_CONSENT_PROMPT_ID = "ryd-data-consent-prompt";
const OPEN_CONSENT_POPUP_MESSAGE = "ryd_open_consent_popup";
const COUNTS_PROMPT_DISMISSED_KEY = "rydCountsConsentDismissed";
const VOTE_PROMPT_DISMISSED_KEY = "rydVoteConsentDismissed";
const PROMPT_Z_INDEX = 2019;
const LIVE_REGION_DELAY_MS = 100;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;
const CARET_SIZE = 10;
const CARET_INSET = 16;
const PROMPT_WIDTH = 336;
const FALLBACK_HEIGHT = 160;
const PAGE_MODE = Object.freeze({
  bodyKey: "data_consent_reason",
  dismissedKey: COUNTS_PROMPT_DISMISSED_KEY,
  announced: false,
});
const VOTE_MODE = Object.freeze({
  bodyKey: "vote_consent_hint",
  dismissedKey: VOTE_PROMPT_DISMISSED_KEY,
  announced: true,
});
const ISOLATED_EVENTS = ["click", "pointerdown", "pointerup", "keydown", "keyup"];
const PROMPT_STYLE = `
  :host {
    all: initial; position: fixed !important; z-index: ${PROMPT_Z_INDEX} !important; box-sizing: border-box !important;
    inset-block-start: var(--ryd-consent-block-start, ${VIEWPORT_MARGIN}px) !important;
    inset-inline-start: var(--ryd-consent-inline-start, ${VIEWPORT_MARGIN}px) !important;
    inline-size: min(${PROMPT_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px)) !important;
    ${POPOVER_HOST_RESET}
  }
  :host([hidden]) { visibility: hidden !important; }
  .panel {
    position: relative; box-sizing: border-box; padding: 16px 16px 12px;
    color: ${POPOVER_TEXT_COLOR}; background: ${POPOVER_BACKGROUND};
    border: 1px solid ${POPOVER_OUTLINE}; border-radius: 12px; box-shadow: 0 4px 32px #0000004d;
    font: 14px/20px Roboto, Arial, sans-serif; text-align: start;
  }
  .panel::before {
    content: ""; position: absolute; box-sizing: border-box; width: ${CARET_SIZE}px; height: ${CARET_SIZE}px;
    background: inherit; transform: rotate(45deg);
  }
  .panel[data-caret="below"]::before { top: -6px; left: var(--ryd-caret-x); border-top: inherit; border-left: inherit; }
  .panel[data-caret="beside"]::before {
    top: var(--ryd-caret-y); right: -6px; border-top: inherit; border-right: inherit;
  }
  .panel[data-caret="none"]::before { display: none; }
  h2 { margin: 0 0 4px; padding-inline-end: 28px; font: 500 16px/22px Roboto, Arial, sans-serif; }
  .body { margin: 0 0 12px; color: ${POPOVER_SECONDARY_TEXT_COLOR}; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button {
    box-sizing: border-box; min-block-size: 36px; padding: 8px 16px; border: 0; border-radius: 18px;
    font: 500 14px/20px Roboto, Arial, sans-serif; color: ${POPOVER_TEXT_COLOR};
    background: ${POPOVER_SECONDARY_BUTTON_BACKGROUND}; cursor: pointer;
  }
  .primary { color: ${POPOVER_PRIMARY_BUTTON_TEXT_COLOR}; background: ${POPOVER_PRIMARY_BUTTON_BACKGROUND}; }
  .close {
    position: absolute; inset-block-start: 8px; inset-inline-end: 8px; inline-size: 32px; min-block-size: 32px;
    padding: 0; border-radius: 50%; font: 400 20px/32px Roboto, Arial, sans-serif;
    color: ${POPOVER_SECONDARY_TEXT_COLOR}; background: transparent;
  }
  button:focus-visible { outline: 2px solid ${POPOVER_TEXT_COLOR}; outline-offset: 2px; }
  .status { margin: 0; }
  .status:not(:empty) { margin-block-start: 8px; }
  @media (pointer: coarse) {
    button { min-block-size: 44px; }
    .close { inline-size: 44px; }
  }
  @media (forced-colors: active) {
    .panel { border-color: CanvasText; }
    button { border: 1px solid ButtonText; }
  }
`;

let activePrompt = null;

function isVideoPage() {
  return location.pathname === "/watch" || location.pathname.startsWith("/shorts/");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function boundingRect(elements) {
  const rects = elements.filter(hasRenderedBox).map((element) => element.getBoundingClientRect());
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function viewportWidth() {
  return document.documentElement.clientWidth || innerWidth;
}

function isOnScreen(rect) {
  return rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < viewportWidth();
}

function createNode(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function createButton(className, text) {
  const button = createNode("button", className, text);
  button.type = "button";
  return button;
}

function buildCard(api, mode, { onAllow, onDismiss, onClose }) {
  const message = (key) => api.i18n.getMessage(key);
  const host = document.createElement("div");
  host.id = DATA_CONSENT_PROMPT_ID;
  host.dir = message("@@bidi_dir") === "rtl" ? "rtl" : "ltr";
  host.lang = api.i18n.getUILanguage?.() || document.documentElement.lang;
  const shadow = host.attachShadow({ mode: "open", delegatesFocus: true });
  const style = createNode("style", "", PROMPT_STYLE);
  const close = createButton("close", "×");
  close.setAttribute("aria-label", message("discussion_close"));
  const title = createNode("h2", "", message("extensionName"));
  const body = createNode("p", "body", mode.announced ? "" : message(mode.bodyKey));
  body.id = "ryd-data-consent-body";
  if (mode.announced) body.setAttribute("role", "status");
  const allow = createButton("primary", message("consent_allow"));
  const dismiss = createButton("dismiss", message("vote_consent_dismiss"));
  const status = createNode("p", "status");
  status.id = "ryd-data-consent-status";
  status.setAttribute("role", "status");
  allow.setAttribute("aria-describedby", `${body.id} ${status.id}`);
  const actions = createNode("div", "actions");
  actions.append(allow, dismiss);
  const panel = createNode("div", "panel");
  panel.append(close, title, body, actions, status);
  shadow.append(style, panel);
  allow.addEventListener("click", onAllow);
  dismiss.addEventListener("click", onDismiss);
  close.addEventListener("click", onClose);
  for (const eventName of ISOLATED_EVENTS) shadow.addEventListener(eventName, (event) => event.stopPropagation());
  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape") onClose();
  });
  return { host, panel, body, status };
}

function createDataConsentPrompt() {
  const api = consentApi();
  const pageOfferEndedListeners = new Set();
  const observer = new MutationObserver(() => schedulePosition());
  let pageEpoch = 0;
  let card = null;
  let pendingVote = null;
  let handedOffPage = null;
  let countsDismissed = false;
  let votesDismissed = false;
  let closedForTab = false;
  let destroyed = false;

  function capturePageContext(videoId) {
    return { pageEpoch, url: location.href, videoId };
  }

  function isCurrent(context) {
    return (
      !destroyed &&
      !isPrivateBrowsingContext() &&
      isVideoPage() &&
      Boolean(context?.videoId) &&
      context.pageEpoch === pageEpoch &&
      context.url === location.href &&
      context.videoId === getVideoId(location.href)
    );
  }

  function pageOfferIsCurrent(offer) {
    return (
      isCurrent(offer) &&
      getButtonControls().buttons === offer.buttons &&
      Boolean(offer.buttons?.contains(offer.anchor)) &&
      hasRenderedBox(offer.anchor)
    );
  }

  function canOfferOnPage() {
    return !countsDismissed && !closedForTab;
  }

  function onPageOfferEnded(listener) {
    pageOfferEndedListeners.add(listener);
    return () => pageOfferEndedListeners.delete(listener);
  }

  function notifyPageOfferEnded() {
    for (const listener of pageOfferEndedListeners) listener();
  }

  function removeCard() {
    if (!card) return;
    cancelAnimationFrame(card.frame);
    clearTimeout(card.announcement);
    card.host.remove();
    card = null;
    observer.disconnect();
  }

  function schedulePosition() {
    if (card && !card.frame) card.frame = requestAnimationFrame(position);
  }

  function position() {
    if (!card) return;
    card.frame = 0;
    if (!card.isCurrent()) {
      removeCard();
      return;
    }
    const anchor = boundingRect(card.anchors());
    const onScreen = Boolean(anchor && isOnScreen(anchor));
    const { host, panel } = card;
    const hidden = card.handingOff || !onScreen;
    if (host.hidden !== hidden) host.hidden = hidden;
    if (!onScreen) return;
    const box = host.getBoundingClientRect();
    const viewport = viewportWidth();
    const width = box.width || Math.min(PROMPT_WIDTH, viewport - VIEWPORT_MARGIN * 2);
    const height = box.height || FALLBACK_HEIGHT;
    const beside = location.pathname.startsWith("/shorts/");
    const preferredLeft = beside ? anchor.left - width - ANCHOR_GAP : anchor.left + anchor.width / 2 - width / 2;
    const left = clamp(preferredLeft, VIEWPORT_MARGIN, viewport - width - VIEWPORT_MARGIN);
    const top = clamp(
      beside ? anchor.top : anchor.bottom + ANCHOR_GAP,
      VIEWPORT_MARGIN,
      innerHeight - height - VIEWPORT_MARGIN,
    );
    host.style.setProperty("--ryd-consent-inline-start", `${host.dir === "rtl" ? viewport - left - width : left}px`);
    host.style.setProperty("--ryd-consent-block-start", `${top}px`);
    const caretFits = beside ? left + width <= anchor.left : top >= anchor.bottom;
    panel.dataset.caret = caretFits ? (beside ? "beside" : "below") : "none";
    if (beside) {
      const caretTop = anchor.top + anchor.height / 2 - top - CARET_SIZE / 2;
      panel.style.setProperty("--ryd-caret-y", `${clamp(caretTop, CARET_INSET, height - CARET_INSET - CARET_SIZE)}px`);
    } else {
      const caretLeft = anchor.left + anchor.width / 2 - left - CARET_SIZE / 2;
      panel.style.setProperty("--ryd-caret-x", `${clamp(caretLeft, CARET_INSET, width - CARET_INSET - CARET_SIZE)}px`);
    }
  }

  function mountCard(mode, { isCardCurrent, anchors, offer = null }) {
    removeCard();
    document.getElementById(DATA_CONSENT_PROMPT_ID)?.remove();
    const mounted = { mode, offer, isCurrent: isCardCurrent, anchors, frame: 0, announcement: 0, handingOff: false };
    Object.assign(
      mounted,
      buildCard(api, mode, {
        onAllow: () => void handOff(mounted),
        onDismiss: () => dismiss(mode),
        onClose: closeForTab,
      }),
    );
    card = mounted;
    (document.body || document.documentElement).append(mounted.host);
    if (mode.announced) {
      mounted.announcement = setTimeout(() => {
        mounted.body.textContent = api.i18n.getMessage(mode.bodyKey);
        schedulePosition();
      }, LIVE_REGION_DELAY_MS);
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "is-active", "video-id", "href"],
    });
    position();
  }

  async function handOff(mounted) {
    if (mounted !== card || mounted.handingOff || !mounted.isCurrent()) return;
    mounted.handingOff = true;
    mounted.host.hidden = true;
    mounted.status.textContent = "";
    let opened = false;
    try {
      opened = (await api.runtime.sendMessage({ message: OPEN_CONSENT_POPUP_MESSAGE }))?.success === true;
    } catch (_) {}
    if (mounted !== card) return;
    mounted.handingOff = false;
    if (opened) {
      if (mounted.mode === PAGE_MODE) handedOffPage = { pageEpoch, url: location.href };
      removeCard();
      return;
    }
    mounted.status.textContent = api.i18n.getMessage("counts_consent_toolbar");
    position();
  }

  function applyDismissal(key) {
    if (key === COUNTS_PROMPT_DISMISSED_KEY) {
      if (countsDismissed) return;
      countsDismissed = true;
      hidePageOffer();
      notifyPageOfferEnded();
      return;
    }
    votesDismissed = true;
    clearPendingVote();
  }

  function dismiss(mode) {
    void api.storage.local.set({ [mode.dismissedKey]: true }).catch(() => {});
    applyDismissal(mode.dismissedKey);
  }

  function storageChanged(changes, area) {
    if (area !== "local") return;
    for (const key of [COUNTS_PROMPT_DISMISSED_KEY, VOTE_PROMPT_DISMISSED_KEY]) {
      if (changes[key]?.newValue === true) applyDismissal(key);
    }
  }

  function closeForTab() {
    const pageOfferWasAvailable = canOfferOnPage();
    closedForTab = true;
    pendingVote = null;
    removeCard();
    if (pageOfferWasAvailable) notifyPageOfferEnded();
  }

  function discard() {
    pageEpoch += 1;
    pendingVote = null;
    removeCard();
  }

  async function loadPageOfferDismissal() {
    try {
      countsDismissed ||=
        (await api.storage.local.get(COUNTS_PROMPT_DISMISSED_KEY))?.[COUNTS_PROMPT_DISMISSED_KEY] === true;
    } catch (_) {}
    if (countsDismissed) hidePageOffer();
    return countsDismissed;
  }

  function hidePageOffer() {
    if (card?.mode === PAGE_MODE) removeCard();
  }

  function syncPageOffer(controls, videoId) {
    const anchor = controls?.nativeDislikeButton ?? controls?.nativeLikeButton;
    const offer = { anchor, buttons: controls?.buttons, pageEpoch, url: location.href, videoId };
    if (
      !canOfferOnPage() ||
      pendingVote ||
      (handedOffPage?.pageEpoch === pageEpoch && handedOffPage.url === location.href) ||
      !controls?.ready ||
      !pageOfferIsCurrent(offer)
    ) {
      hidePageOffer();
      return;
    }
    const shown = card?.mode === PAGE_MODE ? card.offer : null;
    if (shown?.anchor === anchor && shown.buttons === offer.buttons && shown.url === offer.url) {
      position();
      return;
    }
    const anchors = [controls.nativeLikeButton, controls.nativeDislikeButton];
    mountCard(PAGE_MODE, { offer, isCardCurrent: () => pageOfferIsCurrent(offer), anchors: () => anchors });
  }

  function voteAnchors() {
    const { buttons, dislikeButton, likeButton } = getButtonControls();
    const reactions = [likeButton, dislikeButton];
    return reactions.some(hasRenderedBox) ? reactions : [buttons];
  }

  function clearPendingVote() {
    pendingVote = null;
    if (card?.mode === VOTE_MODE) removeCard();
  }

  async function submitIfGranted() {
    const request = pendingVote;
    if (!request || !isCurrent(request.context)) return;
    if (request.checking) {
      request.checkAgain = true;
      return;
    }
    request.checking = true;
    try {
      if (!(await hasFeaturePermission("voting"))) return;
      if (pendingVote !== request || !isCurrent(request.context)) return;
      clearPendingVote();
      request.submitCurrentVote();
    } finally {
      request.checking = false;
      if (request.checkAgain && pendingVote === request) {
        request.checkAgain = false;
        void submitIfGranted();
      }
    }
  }

  async function offerVote(context, submitCurrentVote) {
    if (closedForTab || votesDismissed || !isCurrent(context)) return;
    const request = { context, submitCurrentVote, checking: false, checkAgain: false };
    pendingVote = request;
    removeCard();
    let dismissed = false;
    try {
      dismissed = (await api.storage.local.get(VOTE_PROMPT_DISMISSED_KEY))?.[VOTE_PROMPT_DISMISSED_KEY] === true;
    } catch (_) {}
    if (pendingVote !== request || !isCurrent(context)) return;
    if (dismissed) {
      applyDismissal(VOTE_PROMPT_DISMISSED_KEY);
      return;
    }
    mountCard(VOTE_MODE, {
      isCardCurrent: () => pendingVote === request && isCurrent(request.context),
      anchors: voteAnchors,
    });
    void submitIfGranted();
  }

  const unsubscribePermissions = onDataPermissionsChanged(({ added, removed }) => {
    const voting = (category) => FEATURE_DATA_PERMISSIONS.voting.includes(category);
    if (removed.some(voting)) discard();
    if (added.some(voting)) void submitIfGranted();
  });
  const windowDiscardEvents = ["popstate", "pagehide", "pageshow"];
  api.storage.onChanged.addListener(storageChanged);
  document.addEventListener("yt-navigate-start", discard);
  for (const eventName of windowDiscardEvents) window.addEventListener(eventName, discard);
  window.addEventListener("resize", schedulePosition);
  document.addEventListener("scroll", schedulePosition, true);

  const controller = {
    canOfferOnPage,
    capturePageContext,
    clearPendingVote,
    hidePageOffer,
    isCurrent,
    loadPageOfferDismissal,
    offerVote,
    onPageOfferEnded,
    syncPageOffer,
    destroy() {
      destroyed = true;
      discard();
      unsubscribePermissions();
      pageOfferEndedListeners.clear();
      api.storage.onChanged.removeListener(storageChanged);
      document.removeEventListener("yt-navigate-start", discard);
      for (const eventName of windowDiscardEvents) window.removeEventListener(eventName, discard);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      if (activePrompt === controller) activePrompt = null;
    },
  };
  return controller;
}

function getDataConsentPrompt() {
  if (!activePrompt) activePrompt = createDataConsentPrompt();
  return activePrompt;
}

export {
  COUNTS_PROMPT_DISMISSED_KEY,
  DATA_CONSENT_PROMPT_ID,
  OPEN_CONSENT_POPUP_MESSAGE,
  PROMPT_Z_INDEX,
  VOTE_PROMPT_DISMISSED_KEY,
  getDataConsentPrompt,
};
