/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./buttons", () => ({
  getButtonControls: jest.fn(),
  hasRenderedBox: (node) => Boolean(node?.isConnected && !node.closest("[hidden]")),
}));
jest.mock("./core-data-consent", () => ({
  FEATURE_DATA_PERMISSIONS: jest.requireActual("./core-data-consent").FEATURE_DATA_PERMISSIONS,
  consentApi: jest.fn(),
  hasFeaturePermission: jest.fn(),
  onDataPermissionsChanged: jest.fn(),
}));
jest.mock("./private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
jest.mock("./utils", () => ({
  getVideoId: (url) => {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/shorts/") ? parsed.pathname.slice(8) : parsed.searchParams.get("v");
  },
}));

import { getButtonControls } from "./buttons";
import { consentApi, hasFeaturePermission, onDataPermissionsChanged } from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import {
  COUNTS_PROMPT_DISMISSED_KEY,
  DATA_CONSENT_PROMPT_ID,
  OPEN_CONSENT_POPUP_MESSAGE,
  PROMPT_Z_INDEX,
  VOTE_PROMPT_DISMISSED_KEY,
  getDataConsentPrompt,
} from "./data-consent-prompt";
import {
  POPOVER_BACKGROUND,
  POPOVER_HOST_RESET,
  POPOVER_OUTLINE,
  POPOVER_PRIMARY_BUTTON_BACKGROUND,
  POPOVER_SECONDARY_BUTTON_BACKGROUND,
  POPOVER_SECONDARY_TEXT_COLOR,
  POPOVER_TEXT_COLOR,
} from "./page-popover-style";
import { resolveDelegatedVoteActivation } from "../../common/delegated-vote-activation";

const WATCH_LIKE = { left: 352, right: 400, top: 100, bottom: 140 };
const WATCH_DISLIKE = { left: 400, right: 448, top: 100, bottom: 140 };
const SHORTS_LIKE = { left: 900, right: 948, top: 300, bottom: 348 };
const SHORTS_DISLIKE = { left: 900, right: 948, top: 360, bottom: 408 };

let prompt;
let api;
let controls;
let permissionsChanged;
let storageChanged;
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
const hosts = () => document.querySelectorAll(`#${DATA_CONSENT_PROMPT_ID}`);
const card = () => document.getElementById(DATA_CONSENT_PROMPT_ID);
const shadow = () => card().shadowRoot;
const allowButton = () => shadow().querySelector("button.primary");
const dismissButton = () => shadow().querySelector("button.dismiss");
const closeButton = () => shadow().querySelector("button.close");
const body = () => shadow().querySelector(".body");
const status = () => shadow().querySelector(".status");
const panel = () => shadow().querySelector(".panel");
const offerVote = (submit = jest.fn(), videoId = "abcdefghijk") =>
  prompt.offerVote(prompt.capturePageContext(videoId), submit);

function setRect(element, { left, right, top, bottom }) {
  element.getBoundingClientRect = () => ({ left, right, top, bottom, width: right - left, height: bottom - top });
}

function mountControls(shorts = false) {
  const buttons = document.createElement("div");
  const likeButton = document.createElement("like-button-view-model");
  const dislikeButton = document.createElement("dislike-button-view-model");
  const nativeLikeButton = document.createElement("button");
  const nativeDislikeButton = document.createElement("button");
  nativeDislikeButton.setAttribute("aria-pressed", "false");
  for (const [element, rect] of [
    [likeButton, shorts ? SHORTS_LIKE : WATCH_LIKE],
    [nativeLikeButton, shorts ? SHORTS_LIKE : WATCH_LIKE],
    [dislikeButton, shorts ? SHORTS_DISLIKE : WATCH_DISLIKE],
    [nativeDislikeButton, shorts ? SHORTS_DISLIKE : WATCH_DISLIKE],
  ])
    setRect(element, rect);
  likeButton.append(nativeLikeButton);
  dislikeButton.append(nativeDislikeButton);
  buttons.append(likeButton, dislikeButton);
  document.body.append(buttons);
  return { buttons, likeButton, dislikeButton, nativeLikeButton, nativeDislikeButton, ready: true };
}

function syncPage() {
  prompt.syncPageOffer(controls, getVideoIdFromLocation());
}

function getVideoIdFromLocation() {
  return location.pathname.startsWith("/shorts/") ? location.pathname.slice(8) : "abcdefghijk";
}

beforeEach(() => {
  history.replaceState({}, "", "/watch?v=abcdefghijk");
  document.body.replaceChildren();
  jest.clearAllMocks();
  api = {
    i18n: { getMessage: jest.fn((key) => key), getUILanguage: () => "en" },
    runtime: { sendMessage: jest.fn(async () => ({ success: true })) },
    storage: {
      local: { get: jest.fn(async () => ({})), set: jest.fn(async () => undefined) },
      onChanged: {
        addListener: jest.fn((listener) => (storageChanged = listener)),
        removeListener: jest.fn(),
      },
    },
    permissions: { request: jest.fn() },
  };
  consentApi.mockReturnValue(api);
  hasFeaturePermission.mockResolvedValue(false);
  isPrivateBrowsingContext.mockReturnValue(false);
  onDataPermissionsChanged.mockImplementation((listener) => {
    permissionsChanged = listener;
    return jest.fn();
  });
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();
  controls = mountControls();
  getButtonControls.mockImplementation(() => controls);
  prompt = getDataConsentPrompt();
});

afterEach(() => {
  prompt.destroy();
  jest.useRealTimers();
});

describe("one prompt per document", () => {
  test("startup opens no UI or popup and reads no storage", () => {
    expect(card()).toBeNull();
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    expect(api.storage.local.get).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    expect(api.permissions.request).not.toHaveBeenCalled();
  });

  test("every caller in the document shares one controller", () => {
    expect(getDataConsentPrompt()).toBe(prompt);
  });

  test("a vote offer replaces the page-load card so two cards never coexist", async () => {
    syncPage();
    expect(hosts()).toHaveLength(1);
    expect(body().textContent).toBe("data_consent_reason");
    await offerVote();
    expect(hosts()).toHaveLength(1);
    syncPage();
    expect(hosts()).toHaveLength(1);
    expect(body().getAttribute("role")).toBe("status");
    prompt.clearPendingVote();
    expect(card()).toBeNull();
    syncPage();
    expect(hosts()).toHaveLength(1);
    expect(body().textContent).toBe("data_consent_reason");
  });

  test("a stray host from an earlier script instance is replaced, not duplicated", () => {
    const stray = document.createElement("div");
    stray.id = DATA_CONSENT_PROMPT_ID;
    document.body.append(stray);
    syncPage();
    expect(hosts()).toHaveLength(1);
    expect(stray.isConnected).toBe(false);
  });
});

describe("card surface", () => {
  test("draws a themed YouTube menu surface inside the shadow root, below YouTube's own layers", () => {
    syncPage();
    const root = shadow();
    expect([...root.children].map((node) => node.localName)).toEqual(["style", "div"]);
    for (const node of [closeButton(), allowButton(), dismissButton(), body(), status()])
      expect(panel().contains(node)).toBe(true);
    expect(root.querySelector("h2").textContent).toBe("extensionName");
    const css = root.querySelector("style").textContent;
    expect(PROMPT_Z_INDEX).toBe(2019);
    expect(css).toContain(`z-index: ${PROMPT_Z_INDEX} !important`);
    expect(css).not.toContain("2147483646");
    expect(css).toContain(POPOVER_HOST_RESET);
    expect(POPOVER_BACKGROUND).toContain("--yt-sys-color-baseline--menu-background");
    expect(css).toContain(`color: ${POPOVER_TEXT_COLOR}; background: ${POPOVER_BACKGROUND};`);
    expect(css).toContain(
      `border: 1px solid ${POPOVER_OUTLINE}; border-radius: 12px; box-shadow: 0 4px 32px #0000004d;`,
    );
    expect(css).toContain("padding: 16px 16px 12px");
    expect(css).toContain("min(336px, calc(100vw - 24px))");
    expect(css).toContain("font: 500 16px/22px");
    expect(css).toContain(`.body { margin: 0 0 12px; color: ${POPOVER_SECONDARY_TEXT_COLOR}; }`);
    expect(css).toContain(`background: ${POPOVER_SECONDARY_BUTTON_BACKGROUND}`);
    expect(css).toContain(`background: ${POPOVER_PRIMARY_BUTTON_BACKGROUND}`);
    expect(css).toContain("min-block-size: 36px");
    expect(css).toContain("button:focus-visible");
    expect(root.querySelector("[role=dialog], iframe")).toBeNull();
  });

  test("labels the buttons with the approved wording", () => {
    syncPage();
    expect(allowButton().textContent).toBe("consent_allow");
    expect(dismissButton().textContent).toBe("vote_consent_dismiss");
    expect(closeButton().getAttribute("aria-label")).toBe("discussion_close");
    expect([allowButton(), dismissButton(), closeButton()].every((button) => button.type === "button")).toBe(true);
    const described = allowButton()
      .getAttribute("aria-describedby")
      .split(" ")
      .map((id) => shadow().getElementById(id));
    expect(described).toEqual([body(), status()]);
    expect(status().getAttribute("role")).toBe("status");
  });

  test("centers under the like and dislike group with a caret pointing at it", () => {
    syncPage();
    expect(card().style.getPropertyValue("--ryd-consent-inline-start")).toBe("232px");
    expect(card().style.getPropertyValue("--ryd-consent-block-start")).toBe("150px");
    expect(panel().dataset.caret).toBe("below");
    expect(panel().style.getPropertyValue("--ryd-caret-x")).toBe("163px");
  });

  test("sits beside the Shorts action bar on its inline-start side", () => {
    history.replaceState({}, "", "/shorts/abcdefghijk");
    controls.buttons.remove();
    controls = mountControls(true);
    syncPage();
    expect(card().style.getPropertyValue("--ryd-consent-inline-start")).toBe("554px");
    expect(card().style.getPropertyValue("--ryd-consent-block-start")).toBe("300px");
    expect(panel().dataset.caret).toBe("beside");
    expect(panel().style.getPropertyValue("--ryd-caret-y")).toBe("49px");
  });

  test("mirrors for right-to-left locales", () => {
    api.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? "rtl" : key));
    syncPage();
    expect(card().dir).toBe("rtl");
    expect(card().style.getPropertyValue("--ryd-consent-inline-start")).toBe(`${innerWidth - 232 - 336}px`);
    expect(panel().style.getPropertyValue("--ryd-caret-x")).toBe("163px");
  });

  test("measures right-to-left placement without a classic vertical scrollbar", () => {
    const clientWidth = jest.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(innerWidth - 17);
    api.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? "rtl" : key));
    syncPage();
    expect(card().style.getPropertyValue("--ryd-consent-inline-start")).toBe(`${innerWidth - 17 - 232 - 336}px`);
    expect(panel().style.getPropertyValue("--ryd-caret-x")).toBe("163px");
    clientWidth.mockRestore();
  });

  test("hides while the anchor is off screen and returns when it scrolls back", () => {
    syncPage();
    expect(card().hidden).toBe(false);
    setRect(controls.nativeLikeButton, { left: 352, right: 400, top: -100, bottom: -60 });
    setRect(controls.nativeDislikeButton, { left: 400, right: 448, top: -100, bottom: -60 });
    syncPage();
    expect(card().hidden).toBe(true);
    setRect(controls.nativeLikeButton, WATCH_LIKE);
    setRect(controls.nativeDislikeButton, WATCH_DISLIKE);
    syncPage();
    expect(card().hidden).toBe(false);
  });

  test("repositions on scroll and resize", () => {
    syncPage();
    requestAnimationFrame.mockClear();
    document.dispatchEvent(new Event("scroll"));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    const [frame] = requestAnimationFrame.mock.calls[0];
    setRect(controls.nativeLikeButton, { ...WATCH_LIKE, top: 200, bottom: 240 });
    setRect(controls.nativeDislikeButton, { ...WATCH_DISLIKE, top: 200, bottom: 240 });
    frame();
    expect(card().style.getPropertyValue("--ryd-consent-block-start")).toBe("250px");
    window.dispatchEvent(new Event("resize"));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});

describe("page-load mode", () => {
  test.each(["/watch?v=abcdefghijk", "/shorts/abcdefghijk"])(
    "Allow at %s hides the card at once and opens the toolbar popup without touching YouTube's vote",
    async (url) => {
      history.replaceState({}, "", url);
      const nativeClick = jest.fn();
      controls.nativeDislikeButton.addEventListener("click", nativeClick);
      const delegatedVote = jest.fn();
      controls.buttons.addEventListener("click", delegatedVote);
      let resolve;
      api.runtime.sendMessage.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
      syncPage();
      syncPage();
      expect(hosts()).toHaveLength(1);
      expect(body().textContent).toBe("data_consent_reason");
      expect(body().hasAttribute("role")).toBe(false);
      allowButton().click();
      expect(card().hidden).toBe(true);
      expect(api.runtime.sendMessage).toHaveBeenCalledWith({ message: OPEN_CONSENT_POPUP_MESSAGE });
      resolve({ success: true });
      await flush();
      expect(card()).toBeNull();
      expect(nativeClick).not.toHaveBeenCalled();
      expect(delegatedVote).not.toHaveBeenCalled();
      expect(api.permissions.request).not.toHaveBeenCalled();
      expect(api.storage.local.set).not.toHaveBeenCalled();
    },
  );

  test("after the popup opens the card stays away on this page and returns after navigation", async () => {
    syncPage();
    allowButton().click();
    await flush();
    syncPage();
    expect(card()).toBeNull();
    document.dispatchEvent(new Event("yt-navigate-start"));
    syncPage();
    expect(card()).not.toBeNull();
  });

  test("after the popup opens the card returns on another video even without a navigation event", async () => {
    syncPage();
    allowButton().click();
    await flush();
    history.pushState({}, "", "/watch?v=zyxwvutsrqp");
    prompt.syncPageOffer(controls, "zyxwvutsrqp");
    expect(card()).not.toBeNull();
  });

  test.each([false, undefined, "reject"])(
    "popup failure %s keeps the card with the toolbar instruction",
    async (result) => {
      if (result === "reject") api.runtime.sendMessage.mockRejectedValue(new Error("Unavailable"));
      else api.runtime.sendMessage.mockResolvedValue(result === undefined ? undefined : { success: result });
      syncPage();
      allowButton().click();
      await flush();
      expect(card().hidden).toBe(false);
      expect(status().textContent).toBe("counts_consent_toolbar");
    },
  );

  test("repeat clicks while opening do not open a second popup", async () => {
    let resolve;
    api.runtime.sendMessage.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    syncPage();
    allowButton().click();
    allowButton().click();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
    resolve({ success: false });
    await flush();
    allowButton().click();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  test("Don't ask again hides the card, persists the choice and stops page-load offers", async () => {
    const ended = jest.fn();
    prompt.onPageOfferEnded(ended);
    syncPage();
    dismissButton().click();
    await flush();
    expect(card()).toBeNull();
    expect(api.storage.local.set).toHaveBeenCalledWith({ [COUNTS_PROMPT_DISMISSED_KEY]: true });
    expect(api.storage.local.set).not.toHaveBeenCalledWith({ [VOTE_PROMPT_DISMISSED_KEY]: true });
    expect(ended).toHaveBeenCalledTimes(1);
    expect(prompt.canOfferOnPage()).toBe(false);
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    syncPage();
    expect(card()).toBeNull();
  });

  test("a page-load dismissal made in another tab hides this tab's card", () => {
    const ended = jest.fn();
    prompt.onPageOfferEnded(ended);
    syncPage();
    storageChanged({ [COUNTS_PROMPT_DISMISSED_KEY]: { newValue: true } }, "sync");
    expect(card()).not.toBeNull();
    storageChanged({ [COUNTS_PROMPT_DISMISSED_KEY]: { newValue: true } }, "local");
    expect(card()).toBeNull();
    expect(prompt.canOfferOnPage()).toBe(false);
    storageChanged({ [COUNTS_PROMPT_DISMISSED_KEY]: { newValue: true } }, "local");
    expect(ended).toHaveBeenCalledTimes(1);
    expect(api.storage.local.set).not.toHaveBeenCalled();
    const listener = storageChanged;
    prompt.destroy();
    expect(api.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
  });

  test.each([
    [{ [COUNTS_PROMPT_DISMISSED_KEY]: true }, true],
    [{ [VOTE_PROMPT_DISMISSED_KEY]: true }, false],
    [{}, false],
    ["reject", false],
  ])("a stored dismissal %j is loaded before any offer", async (stored, dismissed) => {
    if (stored === "reject") api.storage.local.get.mockRejectedValue(new Error("Storage unavailable"));
    else api.storage.local.get.mockResolvedValue(stored);
    await expect(prompt.loadPageOfferDismissal()).resolves.toBe(dismissed);
    expect(api.storage.local.get).toHaveBeenCalledWith(COUNTS_PROMPT_DISMISSED_KEY);
    expect(prompt.canOfferOnPage()).toBe(!dismissed);
    syncPage();
    expect(Boolean(card())).toBe(!dismissed);
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  test("a consent-only Shorts surface can anchor to Like when no native Dislike exists", () => {
    history.replaceState({}, "", "/shorts/abcdefghijk");
    controls.nativeDislikeButton.remove();
    controls.nativeDislikeButton = null;
    syncPage();
    expect(card()).not.toBeNull();
    expect(card().hidden).toBe(false);
  });

  test("a document capture vote listener cannot interpret activation as a YouTube vote", () => {
    const activations = [];
    const capture = (event) =>
      activations.push(
        resolveDelegatedVoteActivation({ buttons: controls.buttons, dislikeButton: controls.dislikeButton, event }),
      );
    document.addEventListener("click", capture, true);
    try {
      syncPage();
      allowButton().click();
      controls.nativeDislikeButton.click();
      expect(activations[0]).toBeNull();
      expect(activations[1]?.action).toBe("dislike");
    } finally {
      document.removeEventListener("click", capture, true);
    }
  });

  test("recycled controls replace the card and late failures cannot attach to a new video", async () => {
    let resolve;
    api.runtime.sendMessage.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
    syncPage();
    const previous = card();
    allowButton().click();
    controls.buttons.remove();
    controls = mountControls();
    history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
    prompt.syncPageOffer(controls, "zyxwvutsrqp");
    expect(previous.isConnected).toBe(false);
    expect(hosts()).toHaveLength(1);
    resolve({ success: false });
    await flush();
    expect(status().textContent).toBe("");
    expect(card().hidden).toBe(false);
  });

  test.each(["yt-navigate-start", "pagehide", "pageshow", "popstate"])("%s removes the stale card", (event) => {
    syncPage();
    (event === "yt-navigate-start" ? document : window).dispatchEvent(new Event(event));
    expect(card()).toBeNull();
  });

  test("hidePageOffer leaves a vote card alone", async () => {
    await offerVote();
    prompt.hidePageOffer();
    expect(card()).not.toBeNull();
  });

  test.each(["private", "non-video", "hidden", "unready", "wrong-video"])(
    "%s context shows no card and touches no storage",
    (state) => {
      if (state === "private") isPrivateBrowsingContext.mockReturnValue(true);
      if (state === "non-video") history.replaceState({}, "", "/results?search_query=video");
      if (state === "hidden") controls.buttons.hidden = true;
      if (state === "unready") controls.ready = false;
      prompt.syncPageOffer(controls, state === "wrong-video" ? "zyxwvutsrqp" : "abcdefghijk");
      expect(card()).toBeNull();
      expect(api.runtime.sendMessage).not.toHaveBeenCalled();
      expect(api.storage.local.get).not.toHaveBeenCalled();
      expect(api.storage.local.set).not.toHaveBeenCalled();
    },
  );
});

describe("Not now", () => {
  test.each(["close", "Escape"])(
    "%s hides the card for the rest of this document without storing a choice",
    async (method) => {
      const ended = jest.fn();
      prompt.onPageOfferEnded(ended);
      const submit = jest.fn();
      await offerVote(submit);
      const outside = jest.fn();
      document.addEventListener("keydown", outside);
      if (method === "close") closeButton().click();
      else allowButton().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
      document.removeEventListener("keydown", outside);
      expect(card()).toBeNull();
      expect(outside).not.toHaveBeenCalled();
      expect(api.storage.local.set).not.toHaveBeenCalled();
      expect(ended).toHaveBeenCalledTimes(1);
      hasFeaturePermission.mockResolvedValue(true);
      permissionsChanged({ added: ["websiteActivity"], removed: [] });
      await flush();
      expect(submit).not.toHaveBeenCalled();
      hasFeaturePermission.mockResolvedValue(false);
      api.storage.local.get.mockClear();
      document.dispatchEvent(new Event("yt-navigate-start"));
      history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
      await offerVote(jest.fn(), "zyxwvutsrqp");
      prompt.syncPageOffer(controls, "zyxwvutsrqp");
      expect(card()).toBeNull();
      expect(api.storage.local.get).not.toHaveBeenCalled();

      prompt.destroy();
      prompt = getDataConsentPrompt();
      await offerVote(jest.fn(), "zyxwvutsrqp");
      expect(card()).not.toBeNull();
    },
  );

  test("closing the page-load card stops page-load offers in this document only", () => {
    const ended = jest.fn();
    prompt.onPageOfferEnded(ended);
    syncPage();
    closeButton().click();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(prompt.canOfferOnPage()).toBe(false);
    syncPage();
    expect(card()).toBeNull();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  test("other keys inside the card do not close it", async () => {
    await offerVote();
    allowButton().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, composed: true }));
    expect(card()).not.toBeNull();
  });
});

describe("vote-click mode", () => {
  test.each(["/watch?v=abcdefghijk", "/shorts/abcdefghijk"])(
    "shows a non-modal card at %s only after an offer and announces the vote message",
    async (url) => {
      jest.useFakeTimers();
      history.replaceState({}, "", url);
      expect(card()).toBeNull();
      expect(api.storage.local.get).not.toHaveBeenCalled();
      await offerVote();
      expect(api.storage.local.get).toHaveBeenCalledWith(VOTE_PROMPT_DISMISSED_KEY);
      expect(card()).not.toBeNull();
      expect(shadow().querySelector('[role="dialog"], iframe')).toBeNull();
      expect(body().getAttribute("role")).toBe("status");
      expect(body().textContent).toBe("");
      jest.advanceTimersByTime(100);
      expect(body().textContent).toBe("vote_consent_hint");
      expect([...shadow().querySelectorAll(".actions button")].map((button) => button.textContent)).toEqual([
        "consent_allow",
        "vote_consent_dismiss",
      ]);
    },
  );

  test("Allow opens the toolbar popup and the pending vote is sent once after the grant", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    allowButton().click();
    expect(card().hidden).toBe(true);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ message: OPEN_CONSENT_POPUP_MESSAGE });
    expect(api.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ message: "ryd_open_consent" }));
    await flush();
    expect(card()).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity", "websiteContent"], removed: [] });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test("a failed popup keeps the vote card with the toolbar instruction and the pending vote", async () => {
    api.runtime.sendMessage.mockResolvedValue({ success: false });
    const submit = jest.fn();
    await offerVote(submit);
    allowButton().click();
    await flush();
    expect(card().hidden).toBe(false);
    expect(status().textContent).toBe("counts_consent_toolbar");
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(card()).toBeNull();
  });

  test("Don't ask again persists the vote choice and discards the pending vote", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    dismissButton().click();
    expect(card()).toBeNull();
    expect(api.storage.local.set).toHaveBeenCalledWith({ [VOTE_PROMPT_DISMISSED_KEY]: true });
    expect(api.storage.local.set).not.toHaveBeenCalledWith({ [COUNTS_PROMPT_DISMISSED_KEY]: true });
    expect(prompt.canOfferOnPage()).toBe(true);
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
    await offerVote(submit);
    expect(card()).toBeNull();
  });

  test("a vote dismissal made in another tab hides this tab's vote card and drops its vote", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    storageChanged({ [VOTE_PROMPT_DISMISSED_KEY]: { newValue: true } }, "local");
    expect(card()).toBeNull();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });

  test("a stored vote dismissal shows nothing", async () => {
    api.storage.local.get.mockResolvedValue({ [VOTE_PROMPT_DISMISSED_KEY]: true });
    await offerVote();
    expect(card()).toBeNull();
  });

  test("completing the voting categories with a counts grant submits the pending vote", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    await flush();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["browsingActivity"], removed: [] });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(hasFeaturePermission).toHaveBeenLastCalledWith("voting");
  });

  test("a grant submits only the latest pending click on the current page", async () => {
    const previousClick = jest.fn();
    const currentClick = jest.fn();
    await offerVote(previousClick);
    await offerVote(currentClick);
    await flush();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity", "websiteContent"], removed: [] });
    await flush();
    expect(previousClick).not.toHaveBeenCalled();
    expect(currentClick).toHaveBeenCalledTimes(1);
    expect(card()).toBeNull();
  });

  test("a voting revocation discards the pending vote before a later grant", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    permissionsChanged({ added: [], removed: ["browsingActivity"] });
    expect(card()).toBeNull();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["browsingActivity", "websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  test.each(["yt-navigate-start", "pagehide", "pageshow", "popstate"])(
    "%s discards the vote even on the same URL",
    async (event) => {
      const submit = jest.fn();
      await offerVote(submit);
      (event === "yt-navigate-start" ? document : window).dispatchEvent(new Event(event));
      hasFeaturePermission.mockResolvedValue(true);
      permissionsChanged({ added: ["websiteActivity"], removed: [] });
      await flush();
      expect(submit).not.toHaveBeenCalled();
      expect(card()).toBeNull();
    },
  );

  test("grant completion after navigation cannot submit an earlier page's click", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    await flush();
    let resolvePermission;
    hasFeaturePermission.mockImplementation(() => new Promise((resolve) => (resolvePermission = resolve)));
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    document.dispatchEvent(new Event("yt-navigate-start"));
    resolvePermission(true);
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  test("a grant arriving during an earlier permission lookup is not lost", async () => {
    const submit = jest.fn();
    let resolvePreviousPermission;
    hasFeaturePermission.mockImplementationOnce(() => new Promise((resolve) => (resolvePreviousPermission = resolve)));
    await offerVote(submit);
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    resolvePreviousPermission(false);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test("a newer activation cancels an earlier card still reading the dismissal preference", async () => {
    const submit = jest.fn();
    let resolvePreference;
    api.storage.local.get.mockImplementationOnce(() => new Promise((resolve) => (resolvePreference = resolve)));
    const earlierOffer = offerVote(submit);
    prompt.clearPendingVote();
    resolvePreference({});
    await earlierOffer;
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(card()).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  test("a changed video cannot receive a previous video's vote", async () => {
    const submit = jest.fn();
    await offerVote(submit);
    history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
  });

  test.each(["private", "non-video"])("%s pages show no card and access no storage", async (context) => {
    if (context === "private") isPrivateBrowsingContext.mockReturnValue(true);
    else history.replaceState({}, "", "/results?search_query=video");
    await offerVote();
    expect(card()).toBeNull();
    expect(api.storage.local.get).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  });
});
