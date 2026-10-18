/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("../private-browsing", () => ({
  ...jest.requireActual("../private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));

import { initDiscussion } from "./index";
import { isPrivateBrowsingContext } from "../private-browsing";
import { NATIVE_STATE_REQUEST, NATIVE_STATE_ATTRIBUTE } from "./detector";
import { threadUrl } from "./dom";
import { discussionText } from "./localize";

const VIDEO = "abcdefghijk";
const OTHER = "zyxwvutsrqp";
const ROOT_COMMENT = "11111111-1111-4111-8111-111111111111";
const REPLY_COMMENT = "22222222-2222-4222-8222-222222222222";
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
let feature;
let listener;
let eventListener;

beforeEach(() => {
  isPrivateBrowsingContext.mockReturnValue(false);
  jest.useFakeTimers();
  document.body.innerHTML = `<ytd-watch-flexy video-id="${VIDEO}"><ytd-comments></ytd-comments></ytd-watch-flexy>`;
  window.history.replaceState({}, "", `/watch?v=${VIDEO}`);
  document.documentElement.lang = "en";
  global.chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onMessage: {
        addListener: (value) => {
          eventListener = value;
        },
        removeListener: jest.fn(),
      },
    },
  };
  listener = (event) =>
    event.target.setAttribute(
      NATIVE_STATE_ATTRIBUTE,
      JSON.stringify({ videoId: event.target.getAttribute("video-id"), disabled: true, madeForKids: false }),
    );
  document.addEventListener(NATIVE_STATE_REQUEST, listener, true);
});

test("private discussion initialization creates no requests, bridge, UI or subscriptions", () => {
  isPrivateBrowsingContext.mockReturnValue(true);
  const privateRequest = jest.fn();
  const append = jest.spyOn(document.head, "append");
  const timer = jest.spyOn(global, "setInterval");
  try {
    expect(initDiscussion({ request: privateRequest })).toBeNull();
    expect(privateRequest).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
    expect(document.querySelector(".ryd-discussion-panel")).toBeNull();
    expect(eventListener).toBeUndefined();
  } finally {
    append.mockRestore();
    timer.mockRestore();
  }
});
afterEach(() => {
  feature?.destroy();
  document.removeEventListener(NATIVE_STATE_REQUEST, listener, true);
  jest.useRealTimers();
  delete global.chrome;
});

function request(operation) {
  if (operation === "session") return Promise.resolve({ authenticated: false, canPost: false, profile: null });
  if (operation === "capabilities") return Promise.resolve({ enabled: true });
  return Promise.resolve({ items: [], nextCursor: null });
}

function shortsFixture(videoId = VIDEO) {
  window.history.replaceState({}, "", `/shorts/${videoId}`);
  document.body.innerHTML = `<ytd-reel-video-renderer video-id="${videoId}"><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer>`;
  const reel = document.querySelector("ytd-reel-video-renderer");
  reel.getBoundingClientRect = () => ({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600 });
  return reel;
}

function linkRequest(operation, payload) {
  if (operation === "session")
    return Promise.resolve({ authenticated: true, canPost: false, profile: { id: "reader" } });
  if (operation === "comment")
    return Promise.resolve({
      id: payload.id,
      videoId: VIDEO,
      parentId: payload.id === REPLY_COMMENT ? ROOT_COMMENT : null,
      replyToId: payload.id === REPLY_COMMENT ? ROOT_COMMENT : null,
      author: { id: "author", nickname: "Writer" },
      text: payload.id === REPLY_COMMENT ? "Linked reply" : "Root comment",
      createdAt: "2026-09-01T00:00:00Z",
      replyCount: 1,
      likes: 0,
      dislikes: 0,
    });
  return request(operation);
}

function notificationAnchor({ target = "", videoId = VIDEO } = {}) {
  const toast = document.createElement("aside");
  toast.className = "ryd-discussion-toast";
  const anchor = document.createElement("a");
  anchor.href = threadUrl({ videoId, commentId: REPLY_COMMENT });
  anchor.target = target;
  anchor.dataset.notificationId = ROOT_COMMENT;
  toast.append(anchor);
  document.body.append(toast);
  return anchor;
}

test("repeated native observer checks mount exactly one panel and fetch once", async () => {
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  jest.advanceTimersByTime(4000);
  await flush();
  expect(document.querySelectorAll("#ryd-discussion-panel")).toHaveLength(1);
  expect(call.mock.calls.filter(([operation]) => operation === "comments")).toHaveLength(1);
});

test.each(["pending", "unavailable", "disabled"])(
  "%s capabilities leave the native comments page untouched",
  async (state) => {
    const native = document.body.innerHTML;
    const call = jest.fn((operation) => {
      if (operation !== "capabilities") return request(operation);
      if (state === "pending") return new Promise(() => {});
      if (state === "unavailable") return Promise.reject(Object.assign(new Error("Not found"), { status: 404 }));
      return Promise.resolve({ enabled: false });
    });
    feature = initDiscussion({ request: call });
    await flush();
    jest.advanceTimersByTime(4000);
    await flush();
    expect(document.body.innerHTML).toBe(native);
    expect(call.mock.calls.some(([operation]) => operation === "comments")).toBe(false);
  },
);

test("an enabled service still shows subsequent comment request failures", async () => {
  feature = initDiscussion({
    request: (operation) =>
      operation === "comments"
        ? Promise.reject(Object.assign(new Error("Unavailable"), { code: "network_error" }))
        : request(operation),
  });
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();
  expect(document.querySelector(".ryd-discussion-thread > .ryd-discussion-status").textContent).toBe(
    "Unable to connect. Please try again.",
  );
});

test("navigation removes outgoing content immediately and ignores its delayed response", async () => {
  let resolve;
  const call = jest.fn((operation) =>
    operation === "comments"
      ? new Promise((done) => {
          resolve = done;
        })
      : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  document.dispatchEvent(new Event("yt-navigate-start"));
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
  const commentsScope = call.mock.calls.find(([operation]) => operation === "comments")[2];
  expect(commentsScope.videoId).toBe(VIDEO);
  expect(call).toHaveBeenCalledWith("cancelScope", {}, commentsScope);
  resolve({ items: [{ id: "late", text: "Old private draft" }] });
  await flush();
  window.history.replaceState({}, "", `/watch?v=${OTHER}`);
  document.querySelector("ytd-watch-flexy").setAttribute("video-id", OTHER);
  call.mockImplementation(request);
  document.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(document.getElementById("ryd-discussion-panel").dataset.videoId).toBe(OTHER);
  expect(document.body.textContent).not.toContain("Old private draft");
});

test("a logout event wins over an older initial session read", async () => {
  let resolve;
  feature = initDiscussion({
    request: (operation) =>
      operation === "session"
        ? new Promise((done) => {
            resolve = done;
          })
        : request(operation),
  });
  eventListener({
    message: "ryd_discussion_event",
    type: "session",
    data: { authenticated: false, canPost: false, profile: null },
  });
  resolve({ authenticated: true, canPost: true, profile: { id: "old", nickname: "Previous" } });
  await flush();
  expect(document.querySelector("textarea[name='comment']")).toBeNull();
  expect(document.body.textContent).not.toContain("Previous");
});

test("restoring a cached page recreates the panel with a fresh request scope", async () => {
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  const previousScope = call.mock.calls.find(([operation]) => operation === "comments")[2];
  window.dispatchEvent(new Event("pagehide"));
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
  expect(call).toHaveBeenCalledWith("cancelScope", {}, previousScope);
  window.dispatchEvent(new Event("pageshow"));
  await flush();
  const reads = call.mock.calls.filter(([operation]) => operation === "comments");
  expect(reads).toHaveLength(2);
  expect(reads[1][2].videoId).toBe(VIDEO);
  expect(reads[1][2].id).not.toBe(previousScope.id);
  expect(document.querySelectorAll("#ryd-discussion-panel")).toHaveLength(1);
});

test.each(["ru", "be-BY", "de-DE", "pt_BR", "sv_SE", "zh-Hans", "zh-Hant"])(
  "switching YouTube language to %s refreshes the panel language",
  async (language) => {
    feature = initDiscussion({ request });
    await flush();
    const previousPanel = document.getElementById("ryd-discussion-panel");
    document.documentElement.lang = language;
    await flush();
    jest.advanceTimersByTime(150);
    await flush();
    expect(document.getElementById("ryd-discussion-panel")).not.toBe(previousPanel);
    expect(document.querySelector(".ryd-discussion-title").textContent).toBe(discussionText("title", [], language));
  },
);

test("switching between Chinese scripts refreshes an existing translated panel", async () => {
  document.documentElement.lang = "zh-Hans";
  feature = initDiscussion({ request });
  await flush();
  const previousPanel = document.getElementById("ryd-discussion-panel");
  document.documentElement.lang = "zh-Hant";
  await feature.refresh();
  expect(document.getElementById("ryd-discussion-panel")).not.toBe(previousPanel);
  expect(document.querySelector(".ryd-discussion-title").textContent).toBe(discussionText("title", [], "zh-TW"));
});

test("an opened Shorts drawer survives a transiently hidden and replaced same-video container", async () => {
  const oldReel = shortsFixture();
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  document.getElementById("ryd-discussion-launcher").click();
  const oldDrawer = document.getElementById("ryd-discussion-drawer");
  const oldScope = call.mock.calls.find(([operation]) => operation === "comments")[2];
  expect(oldDrawer.hidden).toBe(false);
  oldReel.hidden = true;
  await feature.refresh();
  expect(document.getElementById("ryd-discussion-drawer")).toBeNull();
  expect(call).toHaveBeenCalledWith("cancelScope", {}, oldScope);
  shortsFixture();
  await feature.refresh();
  const nextDrawer = document.getElementById("ryd-discussion-drawer");
  expect(nextDrawer).not.toBe(oldDrawer);
  expect(nextDrawer.hidden).toBe(false);
  expect(document.querySelector(".ryd-discussion-backdrop").hidden).toBe(false);
  expect(document.getElementById("ryd-discussion-launcher").getAttribute("aria-expanded")).toBe("true");
  expect(document.querySelectorAll("#ryd-discussion-drawer")).toHaveLength(1);
  const nextScope = call.mock.calls.filter(([operation]) => operation === "comments").at(-1)[2];
  expect(nextScope.videoId).toBe(VIDEO);
  expect(nextScope.id).not.toBe(oldScope.id);
});

test("closing a Shorts drawer clears its intent before the native container is replaced", async () => {
  shortsFixture();
  feature = initDiscussion({ request });
  await flush();
  document.getElementById("ryd-discussion-launcher").click();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  shortsFixture();
  await feature.refresh();
  expect(document.getElementById("ryd-discussion-drawer").hidden).toBe(true);
  expect(document.getElementById("ryd-discussion-launcher").getAttribute("aria-expanded")).toBe("false");
});

test.each(["navigation-event", "different-video"])(
  "%s does not carry an opened Shorts drawer into the next panel",
  async (change) => {
    shortsFixture();
    feature = initDiscussion({ request });
    await flush();
    document.getElementById("ryd-discussion-launcher").click();
    if (change === "navigation-event") document.dispatchEvent(new Event("yt-navigate-start"));
    shortsFixture(change === "different-video" ? OTHER : VIDEO);
    if (change === "navigation-event") document.dispatchEvent(new Event("yt-navigate-finish"));
    else await feature.refresh();
    await flush();
    expect(document.getElementById("ryd-discussion-drawer").hidden).toBe(true);
  },
);

test("remembered Shorts open intent cannot retain an ineligible panel", async () => {
  const reel = shortsFixture();
  feature = initDiscussion({ request });
  await flush();
  document.getElementById("ryd-discussion-launcher").click();
  reel.setAttribute("made-for-kids", "true");
  await feature.refresh();
  expect(document.getElementById("ryd-discussion-drawer")).toBeNull();
  expect(document.getElementById("ryd-discussion-launcher")).toBeNull();
  expect(document.querySelector(".ryd-discussion-backdrop")).toBeNull();
});

test("a hash target focuses a reply in an existing panel and switches from inbox without stealing focus again", async () => {
  const call = jest.fn(linkRequest);
  feature = initDiscussion({ request: call });
  await flush();
  const original = document.getElementById("ryd-discussion-panel");
  original.querySelector("[data-action=inbox]").click();
  window.history.replaceState({}, "", `/watch?v=${VIDEO}#rydComment=${REPLY_COMMENT}`);
  window.dispatchEvent(new Event("hashchange"));
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).toBe(original);
  expect(original.querySelector(".ryd-discussion-inbox").hidden).toBe(true);
  expect(document.activeElement.dataset.commentId).toBe(REPLY_COMMENT);
  const before = call.mock.calls.filter(([operation]) => operation === "comment").length;
  const tab = original.querySelector("[data-action=discussion]");
  tab.focus();
  await feature.refresh();
  expect(document.activeElement).toBe(tab);
  expect(call.mock.calls.filter(([operation]) => operation === "comment")).toHaveLength(before);
  window.history.replaceState({}, "", `/watch?v=${VIDEO}#rydComment=${ROOT_COMMENT}`);
  window.dispatchEvent(new Event("popstate"));
  await flush();
  expect(document.activeElement.dataset.commentId).toBe(ROOT_COMMENT);
});

test.each(["watch", "shorts"])(
  "a same-video %s toast click focuses directly before native navigation",
  async (surface) => {
    if (surface === "shorts") shortsFixture();
    const call = jest.fn(linkRequest);
    feature = initDiscussion({ request: call });
    await flush();
    const anchor = notificationAnchor();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(location.hash).toBe(`#rydComment=${REPLY_COMMENT}`);
    expect(location.pathname).toBe(surface === "shorts" ? `/shorts/${VIDEO}` : "/watch");
    await flush();
    expect(document.activeElement.dataset.commentId).toBe(REPLY_COMMENT);
    expect(call).toHaveBeenCalledWith("readNotifications", { ids: [ROOT_COMMENT] });
    if (surface === "shorts") expect(document.getElementById("ryd-discussion-drawer").hidden).toBe(false);
  },
);

test.each([
  { ctrlKey: true },
  { metaKey: true },
  { shiftKey: true },
  { altKey: true },
  { button: 1 },
  { target: "_blank" },
  { videoId: OTHER },
])("notification links preserve modified clicks and separate destinations: %j", async (options) => {
  feature = initDiscussion({ request: linkRequest });
  await flush();
  const anchor = notificationAnchor(options);
  let preventedByFeature;
  anchor.addEventListener("click", (event) => {
    preventedByFeature = event.defaultPrevented;
    event.preventDefault();
  });
  anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options }));
  expect(preventedByFeature).toBe(false);
  expect(location.hash).toBe("");
});

test("a new page opened with a fragment focuses its target after initial panel hydration", async () => {
  window.history.replaceState({}, "", `/watch?v=${VIDEO}#rydComment=${REPLY_COMMENT}`);
  feature = initDiscussion({ request: linkRequest });
  await flush();
  expect(document.activeElement.dataset.commentId).toBe(REPLY_COMMENT);
});
