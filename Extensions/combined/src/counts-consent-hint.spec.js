/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./buttons", () => ({
  getButtonControls: jest.fn(),
  hasRenderedBox: (node) => Boolean(node?.isConnected && !node.closest("[hidden]")),
}));
jest.mock("./core-data-consent", () => ({ consentApi: jest.fn() }));
jest.mock("./private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
jest.mock("./utils", () => ({
  getVideoId: (url) => {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/shorts/") ? parsed.pathname.slice(8) : parsed.searchParams.get("v");
  },
}));

import { getButtonControls } from "./buttons";
import { consentApi } from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";
import { COUNTS_HINT_DISMISSED_KEY, createCountsConsentHintController } from "./counts-consent-hint";
import { resolveDelegatedVoteActivation } from "../../common/delegated-vote-activation";

let controller;
let api;
let controls;
let onDismiss;
const hint = () => document.querySelector("#ryd-counts-consent-hint");
const button = () => hint().shadowRoot.querySelector("button");
const dismissButton = () => hint().shadowRoot.querySelector("button.dismiss");
const flush = async () => {
  for (let index = 0; index < 10; index++) await Promise.resolve();
};

function mountControls() {
  const buttons = document.createElement("div");
  const dislikeButton = document.createElement("dislike-button-view-model");
  const nativeDislikeButton = document.createElement("button");
  nativeDislikeButton.setAttribute("aria-pressed", "false");
  nativeDislikeButton.getBoundingClientRect = () => ({
    left: 400,
    right: 448,
    top: 100,
    bottom: 140,
    width: 48,
    height: 40,
  });
  dislikeButton.append(nativeDislikeButton);
  buttons.append(dislikeButton);
  document.body.append(buttons);
  return { buttons, dislikeButton, nativeDislikeButton, ready: true };
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
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
    },
    permissions: { request: jest.fn() },
  };
  consentApi.mockReturnValue(api);
  isPrivateBrowsingContext.mockReturnValue(false);
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();
  controls = mountControls();
  getButtonControls.mockImplementation(() => controls);
  onDismiss = jest.fn();
  controller = createCountsConsentHintController({ onDismiss });
});

afterEach(() => controller.destroy());

test("startup opens no UI or popup and reads no storage", () => {
  expect(hint()).toBeNull();
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  expect(api.storage.local.get).not.toHaveBeenCalled();
  expect(api.storage.local.set).not.toHaveBeenCalled();
  expect(api.permissions.request).not.toHaveBeenCalled();
});

test("Don't ask again hides the control, persists the choice and stops future offers", async () => {
  controller.sync(controls, "abcdefghijk");
  const nativeClick = jest.fn();
  controls.nativeDislikeButton.addEventListener("click", nativeClick);
  expect(dismissButton().type).toBe("button");
  expect(dismissButton().textContent).toBe("vote_consent_dismiss");
  dismissButton().click();
  await flush();
  expect(hint()).toBeNull();
  expect(api.storage.local.set).toHaveBeenCalledWith({ [COUNTS_HINT_DISMISSED_KEY]: true });
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(controller.isDismissed()).toBe(true);
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  expect(nativeClick).not.toHaveBeenCalled();
  controller.sync(controls, "abcdefghijk");
  expect(hint()).toBeNull();
});

test("a dismissal made in another tab stops this tab's offers", () => {
  controller.sync(controls, "abcdefghijk");
  const [listener] = api.storage.onChanged.addListener.mock.calls[0];
  listener({ [COUNTS_HINT_DISMISSED_KEY]: { newValue: true } }, "sync");
  expect(hint()).not.toBeNull();
  listener({ [COUNTS_HINT_DISMISSED_KEY]: { newValue: true } }, "local");
  expect(hint()).toBeNull();
  expect(controller.isDismissed()).toBe(true);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  listener({ [COUNTS_HINT_DISMISSED_KEY]: { newValue: true } }, "local");
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(api.storage.local.set).not.toHaveBeenCalled();
  controller.destroy();
  expect(api.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
});

test.each([
  [{ [COUNTS_HINT_DISMISSED_KEY]: true }, true],
  [{}, false],
  ["reject", false],
])("a stored dismissal %j is loaded before any offer", async (stored, dismissed) => {
  if (stored === "reject") api.storage.local.get.mockRejectedValue(new Error("Storage unavailable"));
  else api.storage.local.get.mockResolvedValue(stored);
  await expect(controller.loadDismissal()).resolves.toBe(dismissed);
  expect(api.storage.local.get).toHaveBeenCalledWith(COUNTS_HINT_DISMISSED_KEY);
  expect(controller.isDismissed()).toBe(dismissed);
  controller.sync(controls, "abcdefghijk");
  expect(Boolean(hint())).toBe(!dismissed);
  expect(api.storage.local.set).not.toHaveBeenCalled();
  expect(onDismiss).not.toHaveBeenCalled();
});

test("a consent-only Shorts surface can anchor to Like when no native Dislike exists", () => {
  history.replaceState({}, "", "/shorts/abcdefghijk");
  controls.nativeLikeButton = controls.nativeDislikeButton;
  controls.nativeDislikeButton = null;
  controller.sync(controls, "abcdefghijk");
  expect(hint()).not.toBeNull();
  expect(button().textContent).toBe("counts_consent_enable");
  const [reason, status] = button()
    .getAttribute("aria-describedby")
    .split(" ")
    .map((id) => hint().shadowRoot.getElementById(id));
  expect(reason.textContent).toBe("counts_consent_reason");
  expect(status.getAttribute("role")).toBe("status");
});

test.each(["/watch?v=abcdefghijk", "/shorts/abcdefghijk"])(
  "mounts one separate accessible button at %s",
  async (url) => {
    history.replaceState({}, "", url);
    const originalParent = controls.nativeDislikeButton.parentElement;
    const nativeClick = jest.fn();
    controls.nativeDislikeButton.addEventListener("click", nativeClick);
    const delegatedVote = jest.fn();
    controls.buttons.addEventListener("click", delegatedVote);
    controller.sync(controls, "abcdefghijk");
    controller.sync(controls, "abcdefghijk");
    expect(document.querySelectorAll("#ryd-counts-consent-hint")).toHaveLength(1);
    expect(controls.nativeDislikeButton.parentElement).toBe(originalParent);
    expect(hint().closest("button, [role=button]")).toBeNull();
    expect(button().type).toBe("button");
    expect(button().textContent).toBe("counts_consent_enable");
    expect(hint().shadowRoot.firstElementChild.nextElementSibling.textContent).toBe("counts_consent_reason");
    expect(hint().shadowRoot.querySelector("style").textContent).toContain("button:focus-visible");
    expect(hint().shadowRoot.querySelector("[role=dialog], iframe")).toBeNull();
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    button().click();
    await flush();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_open_counts_popup" });
    expect(nativeClick).not.toHaveBeenCalled();
    expect(delegatedVote).not.toHaveBeenCalled();
    expect(controls.nativeDislikeButton.getAttribute("aria-pressed")).toBe("false");
    controls.nativeDislikeButton.click();
    expect(nativeClick).toHaveBeenCalledTimes(1);
    expect(delegatedVote).toHaveBeenCalledTimes(1);
    expect(api.permissions.request).not.toHaveBeenCalled();
  },
);

test.each([false, undefined, "reject"])("popup failure %s shows the localized toolbar instruction", async (result) => {
  if (result === "reject") api.runtime.sendMessage.mockRejectedValue(new Error("Unavailable"));
  else api.runtime.sendMessage.mockResolvedValue(result === undefined ? undefined : { success: result });
  controller.sync(controls, "abcdefghijk");
  button().click();
  await flush();
  expect(hint().shadowRoot.querySelector('[role="status"]').textContent).toBe("counts_consent_toolbar");
  expect(button().hasAttribute("aria-disabled")).toBe(false);
});

test("repeat clicks while opening do not open a second popup", async () => {
  let resolve;
  api.runtime.sendMessage.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
  controller.sync(controls, "abcdefghijk");
  button().click();
  button().click();
  expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
  resolve({ success: true });
  await flush();
  expect(button().hasAttribute("aria-disabled")).toBe(false);
});

test("a document capture vote listener cannot interpret activation as a YouTube vote", () => {
  const activations = [];
  const capture = (event) =>
    activations.push(
      resolveDelegatedVoteActivation({
        buttons: controls.buttons,
        dislikeButton: controls.dislikeButton,
        event,
      }),
    );
  document.addEventListener("click", capture, true);
  try {
    controller.sync(controls, "abcdefghijk");
    button().click();
    controls.nativeDislikeButton.click();
    expect(activations[0]).toBeNull();
    expect(activations[1]?.action).toBe("dislike");
  } finally {
    document.removeEventListener("click", capture, true);
  }
});

test("recycled controls replace the control and late failures cannot attach to a new video", async () => {
  let resolve;
  api.runtime.sendMessage.mockImplementationOnce(() => new Promise((done) => (resolve = done)));
  controller.sync(controls, "abcdefghijk");
  const previous = hint();
  button().click();
  controls.buttons.remove();
  controls = mountControls();
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  controller.sync(controls, "zyxwvutsrqp");
  expect(previous.isConnected).toBe(false);
  expect(document.querySelectorAll("#ryd-counts-consent-hint")).toHaveLength(1);
  resolve({ success: false });
  await flush();
  expect(hint().shadowRoot.querySelector('[role="status"]').textContent).toBe("");
});

test.each(["yt-navigate-start", "pagehide", "popstate"])("%s removes stale activation UI", (event) => {
  controller.sync(controls, "abcdefghijk");
  (event === "yt-navigate-start" ? document : window).dispatchEvent(new Event(event));
  expect(hint()).toBeNull();
});

test.each(["private", "non-video", "hidden", "unready", "wrong-video", "offscreen"])(
  "%s context shows no activation control",
  (state) => {
    if (state === "private") isPrivateBrowsingContext.mockReturnValue(true);
    if (state === "non-video") history.replaceState({}, "", "/results?search_query=video");
    if (state === "hidden") controls.buttons.hidden = true;
    if (state === "unready") controls.ready = false;
    if (state === "offscreen")
      controls.nativeDislikeButton.getBoundingClientRect = () => ({ left: 400, right: 448, top: -100, bottom: -60 });
    controller.sync(controls, state === "wrong-video" ? "zyxwvutsrqp" : "abcdefghijk");
    expect(hint()).toBeNull();
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
    expect(api.storage.local.get).not.toHaveBeenCalled();
    expect(api.storage.local.set).not.toHaveBeenCalled();
  },
);

test("uses locale direction for logical positioning", () => {
  api.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? "rtl" : key));
  controller.sync(controls, "abcdefghijk");
  expect(hint().dir).toBe("rtl");
  expect(hint().style.getPropertyValue("--ryd-counts-hint-inline-start")).not.toBe("");
});
