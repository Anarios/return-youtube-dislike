/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./utils", () => ({
  getBrowser: jest.fn(),
  getVideoId: (url) => new URL(url).searchParams.get("v"),
  localize: (key) =>
    ({
      reviewPromptTitle: "Enjoying RYD?",
      reviewPromptBody:
        "Google changed the rules for Chrome Web Store ratings. Despite 16,000+ five-star reviews, a few recent negative ones dragged RYD’s rating from 4.6 to 2.5.\n\nIf RYD helps you, please leave an honest review.",
      reviewPromptAction: "Leave a review",
      discussion_close: "Close",
    })[key],
}));
jest.mock("./buttons", () => ({ getDislikeButton: jest.fn() }));

let getBrowser;
let getDislikeButton;
let recordReviewAction;
let api;
const videoId = "abcdefghijk";
const prompt = () => document.getElementById("ryd-review-prompt");

beforeEach(() => {
  jest.resetModules();
  getBrowser = require("./utils").getBrowser;
  getDislikeButton = require("./buttons").getDislikeButton;
  recordReviewAction = require("./review-prompt").recordReviewAction;
  document.dispatchEvent(new Event("yt-navigate-start"));
  document.body.replaceChildren();
  history.replaceState({}, "", `/watch?v=${videoId}`);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  const anchor = document.createElement("button");
  anchor.id = "dislike";
  anchor.getBoundingClientRect = () => ({ left: 100, right: 180, top: 100, bottom: 140, width: 80, height: 40 });
  document.body.append(anchor);
  getDislikeButton.mockReturnValue(anchor);
  api = {
    runtime: {
      getManifest: () => ({ manifest_version: 3, background: { service_worker: "ryd.background.js" } }),
      sendMessage: jest.fn(async () => ({ showPrompt: false })),
    },
    extension: { inIncognitoContext: false },
    i18n: { getMessage: () => "ltr" },
  };
  getBrowser.mockReturnValue(api);
});

afterEach(() => {
  document.dispatchEvent(new Event("yt-navigate-start"));
});

test.each([1, -1])("reports valid local reactions without showing until authorized (%s)", async (vote) => {
  await recordReviewAction(videoId, vote);
  expect(api.runtime.sendMessage).toHaveBeenCalledWith({
    message: "ryd_review_action",
    videoId,
    vote,
    canShow: true,
  });
  expect(prompt()).toBeNull();
});

test("renders a localized dismissible store link without stealing focus", async () => {
  const origin = document.createElement("button");
  document.body.append(origin);
  origin.focus();
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  await recordReviewAction(videoId, -1);
  const root = prompt().shadowRoot;
  expect(document.activeElement).toBe(origin);
  expect(root.querySelector('[role="status"]').textContent).toContain("Enjoying RYD?");
  expect(root.querySelector(".brand").textContent).toBe("Return YouTube Dislike");
  const link = root.querySelector("a");
  expect(link.href).toBe(
    "https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi/reviews",
  );
  expect(link.target).toBe("_blank");
  expect(link.rel).toBe("noopener noreferrer");
  expect(root.querySelector("button").getAttribute("aria-label")).toBe("Close");
  root.querySelector("button").click();
  expect(prompt()).toBeNull();
  expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
});

test("uses the manual popover when supported", async () => {
  Object.defineProperty(HTMLElement.prototype, "popover", { configurable: true, value: null });
  HTMLElement.prototype.showPopover = jest.fn();
  try {
    api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
    await recordReviewAction(videoId, -1);
    expect(prompt().getAttribute("popover")).toBe("manual");
    expect(prompt().showPopover).toHaveBeenCalledTimes(1);
  } finally {
    delete HTMLElement.prototype.popover;
    delete HTMLElement.prototype.showPopover;
  }
});

test.each(["yt-navigate-start", "fullscreenchange"])("dismisses on %s", async (event) => {
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  await recordReviewAction(videoId, -1);
  document.dispatchEvent(new Event(event));
  expect(prompt()).toBeNull();
});

test.each(["pagehide", "popstate"])("dismisses on %s", async (event) => {
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  await recordReviewAction(videoId, -1);
  window.dispatchEvent(new Event(event));
  expect(prompt()).toBeNull();
});

test("Escape dismisses without cancelling YouTube's keyboard event", async () => {
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  await recordReviewAction(videoId, -1);
  const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  document.dispatchEvent(event);
  expect(prompt()).toBeNull();
  expect(event.defaultPrevented).toBe(false);
});

test.each(["hidden", "fullscreen", "consent", "analytics"])(
  "counts but does not request display during %s",
  async (state) => {
    if (state === "hidden") Object.defineProperty(document, "visibilityState", { value: "hidden" });
    if (state === "fullscreen") Object.defineProperty(document, "fullscreenElement", { value: document.body });
    if (state === "consent") document.body.insertAdjacentHTML("beforeend", '<div id="ryd-consent-prompt"></div>');
    if (state === "analytics")
      document.body.insertAdjacentHTML("beforeend", '<div class="ryd-premium-analytics is-expanded"></div>');
    await recordReviewAction(videoId, -1);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ canShow: false }));
    expect(prompt()).toBeNull();
  },
);

test.each(["missing", "detached", "offscreen"])("does not request display with a %s dislike anchor", async (state) => {
  const anchor = getDislikeButton();
  if (state === "missing") getDislikeButton.mockReturnValue(undefined);
  if (state === "detached") anchor.remove();
  if (state === "offscreen")
    anchor.getBoundingClientRect = () => ({ left: 100, right: 180, top: -100, bottom: -60, width: 80, height: 40 });
  await recordReviewAction(videoId, -1);
  expect(api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ canShow: false }));
  expect(prompt()).toBeNull();
});

test("defers display when the viewport has no usable space beside the anchor", async () => {
  const height = window.innerHeight;
  window.innerHeight = 100;
  getDislikeButton().getBoundingClientRect = () => ({
    left: 100,
    right: 180,
    top: 30,
    bottom: 70,
    width: 80,
    height: 40,
  });
  try {
    await recordReviewAction(videoId, -1);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ canShow: false }));
    expect(prompt()).toBeNull();
  } finally {
    window.innerHeight = height;
  }
});

test.each(["navigation", "hidden", "fullscreen"])("does not paint a late reply after %s", async (change) => {
  let respond;
  api.runtime.sendMessage.mockImplementation(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  );
  const pending = recordReviewAction(videoId, -1);
  if (change === "navigation") history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  if (change === "hidden") Object.defineProperty(document, "visibilityState", { value: "hidden" });
  if (change === "fullscreen") Object.defineProperty(document, "fullscreenElement", { value: document.body });
  respond({ showPrompt: true });
  await pending;
  expect(prompt()).toBeNull();
});

test.each(["firefox", "safari", "incognito", "neutral", "stale", "feed"])("does not send for %s", async (state) => {
  if (["firefox", "safari"].includes(state))
    api.runtime.getManifest = () => ({ manifest_version: 2, background: { scripts: ["background.js"] } });
  if (state === "incognito") api.extension.inIncognitoContext = true;
  if (state === "stale") history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  if (state === "feed") history.replaceState({}, "", "/feed/subscriptions");
  await recordReviewAction(videoId, state === "neutral" ? 0 : -1);
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
});

test("storage or extension invalidation failures stay out of the vote flow", async () => {
  api.runtime.sendMessage.mockRejectedValue(new Error("Extension context invalidated"));
  await expect(recordReviewAction(videoId, -1)).resolves.toBeUndefined();
  expect(prompt()).toBeNull();
});

test("dismissal and SPA navigation never reset a consumed display attempt", async () => {
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  await recordReviewAction(videoId, -1);
  prompt().shadowRoot.querySelector("button").click();
  document.dispatchEvent(new Event("yt-navigate-start"));
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  await recordReviewAction("zyxwvutsrqp", -1);
  expect(prompt()).toBeNull();
  expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
});

test("concurrent affirmative replies cannot reopen a dismissed card", async () => {
  const responses = [];
  api.runtime.sendMessage.mockImplementation(() => new Promise((resolve) => responses.push(resolve)));
  const first = recordReviewAction(videoId, -1);
  const second = recordReviewAction(videoId, -1);
  responses[0]({ showPrompt: true });
  await first;
  prompt().shadowRoot.querySelector("button").click();
  responses[1]({ showPrompt: true });
  await second;
  expect(prompt()).toBeNull();
});

test("a lost display opportunity stays consumed after visibility returns", async () => {
  let respond;
  api.runtime.sendMessage.mockImplementation(() => new Promise((resolve) => (respond = resolve)));
  const pending = recordReviewAction(videoId, -1);
  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  respond({ showPrompt: true });
  await pending;
  Object.defineProperty(document, "visibilityState", { value: "visible" });
  await recordReviewAction(videoId, -1);
  expect(prompt()).toBeNull();
  expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
});

test("a DOM failure consumes the attempt before rendering and never retries", async () => {
  api.runtime.sendMessage.mockResolvedValue({ showPrompt: true });
  const attach = jest.spyOn(HTMLElement.prototype, "attachShadow").mockImplementationOnce(() => {
    throw new Error("Rendering unavailable");
  });
  try {
    await expect(recordReviewAction(videoId, -1)).resolves.toBeUndefined();
    await recordReviewAction(videoId, -1);
    expect(prompt()).toBeNull();
    expect(attach).toHaveBeenCalledTimes(1);
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(1);
  } finally {
    attach.mockRestore();
  }
});
