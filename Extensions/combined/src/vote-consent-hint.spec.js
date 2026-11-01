/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./buttons", () => ({
  getButtons: jest.fn(),
  getDislikeButton: jest.fn(),
  getLikeButton: jest.fn(),
  hasRenderedBox: (node) => Boolean(node?.isConnected),
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

import { getButtons, getDislikeButton, getLikeButton } from "./buttons";
import { consentApi, hasFeaturePermission, onDataPermissionsChanged } from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import { createVoteConsentHintController, VOTE_HINT_DISMISSED_KEY } from "./vote-consent-hint";

let controller;
let permissionsChanged;
let api;
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
const hint = () => document.querySelector("#ryd-vote-consent-hint");
const actions = () => hint().shadowRoot.querySelectorAll(".actions button");
const closeButton = () => hint().shadowRoot.querySelector("button.close");
const message = () => hint().shadowRoot.querySelector(".message");

beforeEach(() => {
  history.replaceState({}, "", "/watch?v=abcdefghijk");
  document.body.replaceChildren();
  jest.clearAllMocks();
  api = {
    i18n: {
      getMessage: jest.fn((key) => key),
      getUILanguage: () => "en",
    },
    storage: { local: { get: jest.fn(async () => ({})), set: jest.fn(async () => undefined) } },
    runtime: { sendMessage: jest.fn(async () => ({ success: true })) },
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
  const anchor = document.createElement("div");
  document.body.append(anchor);
  getButtons.mockReturnValue(anchor);
  getDislikeButton.mockReturnValue(anchor);
  getLikeButton.mockReturnValue(anchor);
  controller = createVoteConsentHintController();
});

afterEach(() => {
  controller.destroy();
  jest.useRealTimers();
});

test("count startup mounts no consent UI and reads no preference", () => {
  expect(hint()).toBeNull();
  expect(api.storage.local.get).not.toHaveBeenCalled();
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
});

test.each(["/watch?v=abcdefghijk", "/shorts/abcdefghijk"])(
  "shows a non-modal hint at %s only after an offer",
  async (url) => {
    jest.useFakeTimers();
    history.replaceState({}, "", url);
    await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
    expect(hint()).not.toBeNull();
    const shadow = hint().shadowRoot;
    expect(shadow.querySelector('[role="dialog"], iframe')).toBeNull();
    expect(message().getAttribute("role")).toBe("status");
    expect(message().textContent).toBe("");
    jest.advanceTimersByTime(100);
    expect(message().textContent).toBe("vote_consent_hint");
    expect(closeButton().getAttribute("aria-label")).toBe("discussion_close");
    expect(closeButton().type).toBe("button");
    expect([...actions()].map((button) => button.textContent)).toEqual([
      "vote_consent_continue",
      "vote_consent_dismiss",
    ]);
    expect([...actions()].every((button) => button.type === "button")).toBe(true);
    actions()[0].click();
    await flush();
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_open_consent", feature: "voteOptIn" });
  },
);

test("Don't ask again persists locally and discards the pending vote", async () => {
  const submit = jest.fn();
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  actions()[1].click();
  expect(hint()).toBeNull();
  expect(api.storage.local.set).toHaveBeenCalledWith({ [VOTE_HINT_DISMISSED_KEY]: true });
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["websiteActivity"], removed: [] });
  await flush();
  expect(submit).not.toHaveBeenCalled();
  api.storage.local.get.mockResolvedValue({ [VOTE_HINT_DISMISSED_KEY]: true });
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  expect(hint()).toBeNull();
});

test.each(["close", "Escape"])(
  "%s hides the hint for the rest of this tab without storing a choice",
  async (method) => {
    const submit = jest.fn();
    await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
    const outside = jest.fn();
    document.addEventListener("keydown", outside);
    if (method === "close") closeButton().click();
    else actions()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    document.removeEventListener("keydown", outside);
    expect(hint()).toBeNull();
    expect(outside).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
    hasFeaturePermission.mockResolvedValue(false);
    api.storage.local.get.mockClear();
    await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
    document.dispatchEvent(new Event("yt-navigate-start"));
    history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
    await controller.offer(controller.capturePageContext("zyxwvutsrqp"), jest.fn());
    expect(hint()).toBeNull();
    expect(api.storage.local.get).not.toHaveBeenCalled();

    const nextTab = createVoteConsentHintController();
    await nextTab.offer(nextTab.capturePageContext("zyxwvutsrqp"), jest.fn());
    expect(hint()).not.toBeNull();
    nextTab.destroy();
  },
);

test("other keys inside the hint do not close it", async () => {
  await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
  actions()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, composed: true }));
  expect(hint()).not.toBeNull();
});

test("completing the voting categories with a counts grant submits the pending vote", async () => {
  const submit = jest.fn();
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
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
  await controller.offer(controller.capturePageContext("abcdefghijk"), previousClick);
  await controller.offer(controller.capturePageContext("abcdefghijk"), currentClick);
  await flush();
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["websiteActivity", "websiteContent"], removed: [] });
  await flush();
  expect(previousClick).not.toHaveBeenCalled();
  expect(currentClick).toHaveBeenCalledTimes(1);
  expect(hint()).toBeNull();
  permissionsChanged({ added: ["websiteActivity"], removed: [] });
  await flush();
  expect(currentClick).toHaveBeenCalledTimes(1);
});

test("count revocation discards the pending vote before a later grant", async () => {
  const submit = jest.fn();
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  permissionsChanged({ added: [], removed: ["browsingActivity"] });
  expect(hint()).toBeNull();
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["browsingActivity", "websiteActivity"], removed: [] });
  await flush();
  expect(submit).not.toHaveBeenCalled();
});

test.each(["yt-navigate-start", "pagehide", "pageshow", "popstate"])(
  "%s discards the vote even on the same URL",
  async (event) => {
    const submit = jest.fn();
    await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
    (event === "yt-navigate-start" ? document : window).dispatchEvent(new Event(event));
    hasFeaturePermission.mockResolvedValue(true);
    permissionsChanged({ added: ["websiteActivity"], removed: [] });
    await flush();
    expect(submit).not.toHaveBeenCalled();
    expect(hint()).toBeNull();
  },
);

test("grant completion after navigation cannot submit an earlier page's click", async () => {
  const submit = jest.fn();
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
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
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["websiteActivity"], removed: [] });
  resolvePreviousPermission(false);
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
});

test("a newer activation cancels an earlier hint still reading the dismissal preference", async () => {
  const submit = jest.fn();
  let resolvePreference;
  api.storage.local.get.mockImplementationOnce(() => new Promise((resolve) => (resolvePreference = resolve)));
  const earlierOffer = controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  controller.clearPending();
  resolvePreference({});
  await earlierOffer;
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["websiteActivity"], removed: [] });
  await flush();
  expect(hint()).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

test("a changed video cannot receive a previous video's vote", async () => {
  const submit = jest.fn();
  await controller.offer(controller.capturePageContext("abcdefghijk"), submit);
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  hasFeaturePermission.mockResolvedValue(true);
  permissionsChanged({ added: ["websiteActivity"], removed: [] });
  await flush();
  expect(submit).not.toHaveBeenCalled();
});

test.each(["private", "non-video"])("%s pages show no hint and access no storage", async (context) => {
  if (context === "private") isPrivateBrowsingContext.mockReturnValue(true);
  else history.replaceState({}, "", "/results?search_query=video");
  await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
  expect(hint()).toBeNull();
  expect(api.storage.local.get).not.toHaveBeenCalled();
  expect(api.storage.local.set).not.toHaveBeenCalled();
});

test("Continue failure is localized and allows retry", async () => {
  api.runtime.sendMessage.mockResolvedValue({ success: false });
  await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
  const next = actions()[0];
  next.click();
  expect(next.getAttribute("aria-disabled")).toBe("true");
  await flush();
  expect(next.hasAttribute("aria-disabled")).toBe(false);
  expect(hint().shadowRoot.querySelector(".status").textContent).toBe("vote_consent_open_failed");
});

test("uses extension locale direction for logical positioning", async () => {
  api.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? "rtl" : key));
  await controller.offer(controller.capturePageContext("abcdefghijk"), jest.fn());
  expect(hint().dir).toBe("rtl");
  expect(hint().style.getPropertyValue("--ryd-vote-hint-inline-start")).not.toBe("");
});
