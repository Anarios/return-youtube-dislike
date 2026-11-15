/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("../private-browsing", () => ({
  ...jest.requireActual("../private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));
jest.mock("../core-data-consent", () => ({
  hasFeaturePermission: jest.fn(),
  usesFirefoxDataCollectionConsent: jest.fn(),
}));

import { readFileSync } from "fs";
import { join } from "path";
import { initDiscussion } from "./index";
import { isPrivateBrowsingContext } from "../private-browsing";
import { hasFeaturePermission, usesFirefoxDataCollectionConsent } from "../core-data-consent";
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
let storedSettings;
let settingsListener;

beforeEach(() => {
  eventListener = undefined;
  storedSettings = {};
  settingsListener = undefined;
  isPrivateBrowsingContext.mockReturnValue(false);
  hasFeaturePermission.mockResolvedValue(true);
  usesFirefoxDataCollectionConsent.mockReturnValue(false);
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
    storage: {
      sync: { get: jest.fn((keys, callback) => callback(storedSettings)) },
      onChanged: {
        addListener: (value) => {
          settingsListener = value;
        },
        removeListener: jest.fn(),
      },
    },
  };
  answerNativeState({ disabled: true });
});

function answerNativeState({ disabled }) {
  document.removeEventListener(NATIVE_STATE_REQUEST, listener, true);
  listener = (event) =>
    event.target.setAttribute(
      NATIVE_STATE_ATTRIBUTE,
      JSON.stringify({ videoId: event.target.getAttribute("video-id"), disabled }),
    );
  document.addEventListener(NATIVE_STATE_REQUEST, listener, true);
}

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
  jest.restoreAllMocks();
  delete global.chrome;
});

function request(operation) {
  if (operation === "session") return Promise.resolve({ authenticated: false, canPost: false, profile: null });
  if (operation === "capabilities") return Promise.resolve({ enabled: true });
  return Promise.resolve({ items: [], nextCursor: null });
}

test.each(["root", "reply", "edit"])(
  "a reaction permission grant keeps the %s editor and a failed draft visibly open",
  async (kind) => {
    const profile = { id: "33333333-3333-4333-8333-333333333333", nickname: "Writer" };
    const item = {
      id: ROOT_COMMENT,
      videoId: VIDEO,
      author: profile,
      text: "Original",
      createdAt: "2026-09-01T12:00:00Z",
      likes: 0,
      dislikes: 0,
    };
    let failing = true;
    const calls = jest.fn(async (operation) => {
      if (operation === "session") return { authenticated: true, canPost: true, profile };
      if (operation === "capabilities") return { enabled: true };
      if (["createComment", "editComment"].includes(operation)) {
        if (failing) throw { code: "request_failed" };
        return item;
      }
      return { items: [item], nextCursor: null };
    });
    feature = initDiscussion({ request: calls });
    await flush();
    const root = document.querySelector(".ryd-discussion");
    if (kind !== "root") root.querySelector(`[data-action='${kind}']`).click();
    const form = root.querySelector(
      kind === "root" ? ".ryd-discussion-composer form" : ".ryd-discussion-inline-editor form",
    );
    const textarea = form.querySelector("textarea");
    textarea.value = "Draft kept across a permission grant";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    failing = false;
    eventListener({
      message: "ryd_discussion_event",
      type: "permissions",
      data: { added: ["websiteActivity"], removed: [] },
    });
    await flush();
    expect(form.isConnected).toBe(true);
    expect(textarea.value).toBe("Draft kept across a permission grant");
    expect(calls.mock.calls.filter(([operation]) => ["createComment", "editComment"].includes(operation))).toHaveLength(
      1,
    );
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    expect(calls.mock.calls.filter(([operation]) => ["createComment", "editComment"].includes(operation))).toHaveLength(
      2,
    );
  },
);

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

describe("comment reactions", () => {
  const other = { id: "44444444-4444-4444-8444-444444444444", nickname: "Other" };
  const item = {
    id: ROOT_COMMENT,
    videoId: VIDEO,
    author: other,
    text: "Someone else's comment",
    createdAt: "2026-09-01T12:00:00Z",
    likes: 0,
    dislikes: 0,
    myReaction: 0,
  };
  const reactions = (call) => call.mock.calls.filter(([operation]) => operation === "react");
  const reactionCall = (operation, payload) =>
    operation === "react"
      ? Promise.resolve({ commentId: ROOT_COMMENT, likes: 1, dislikes: 0, myReaction: payload.value })
      : operation === "comments"
        ? Promise.resolve({ items: [{ ...item }], nextCursor: null })
        : request(operation);

  test("Chrome and Safari reactions are available before any permission lookup completes", async () => {
    hasFeaturePermission.mockImplementation((name) =>
      name === "voting" ? new Promise(() => {}) : Promise.resolve(true),
    );
    const call = jest.fn(reactionCall);
    feature = initDiscussion({ request: call });
    await flush();
    document.querySelector("[data-reaction='1']").click();
    await flush();
    expect(reactions(call)).toHaveLength(1);
    expect(reactions(call)[0][1]).toEqual({ id: ROOT_COMMENT, value: 1 });
    expect(document.querySelector("[data-action='voteOptIn-consent']")).toBeNull();
  });

  test("a Firefox reaction waits for the website activity grant made from its own prompt", async () => {
    usesFirefoxDataCollectionConsent.mockReturnValue(true);
    let voting = false;
    hasFeaturePermission.mockImplementation(async (name) => name !== "voting" || voting);
    const call = jest.fn(reactionCall);
    feature = initDiscussion({ request: call });
    await flush();
    document.querySelector("[data-reaction='1']").click();
    await flush();
    expect(reactions(call)).toHaveLength(0);
    expect(document.querySelector("[data-action='voteOptIn-consent']")).not.toBeNull();
    const commentReads = () => call.mock.calls.filter(([operation]) => operation === "comments").length;
    const readsBeforeGrant = commentReads();
    voting = true;
    eventListener({
      message: "ryd_discussion_event",
      type: "permissions",
      data: { added: ["websiteActivity"], removed: [] },
    });
    await flush();
    expect(reactions(call)).toHaveLength(1);
    expect(reactions(call)[0][1]).toEqual({ id: ROOT_COMMENT, value: 1 });
    expect(document.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
    expect(commentReads()).toBe(readsBeforeGrant);
  });
});

test.each(["watch", "shorts"])(
  "the hide setting keeps the %s surface and the capability request away",
  async (surface) => {
    if (surface === "shorts") shortsFixture();
    storedSettings = { hideRydComments: true };
    const call = jest.fn(request);
    feature = initDiscussion({ request: call });
    await flush();
    jest.advanceTimersByTime(4000);
    await flush();
    expect(call.mock.calls.some(([operation]) => ["capabilities", "comments"].includes(operation))).toBe(false);
    expect(document.getElementById("ryd-discussion-panel")).toBeNull();
    expect(document.getElementById("ryd-discussion-launcher")).toBeNull();
  },
);

test("changing the hide setting removes and restores the discussion on the open page", async () => {
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();

  settingsListener({ hideRydComments: { newValue: true } }, "local");
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();

  settingsListener({ hideRydComments: { newValue: true } }, "sync");
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();

  settingsListener({ hideRydComments: { newValue: false } }, "sync");
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "capabilities")).toHaveLength(2);
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();

  feature.destroy();
  expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(settingsListener);
  feature = null;
});

test("browsing access enables capabilities and discussion on the current page after an initial denial", async () => {
  let browsing = false;
  hasFeaturePermission.mockImplementation(async (name) => name !== "counts" || browsing);
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  expect(call.mock.calls.some(([operation]) => operation === "capabilities")).toBe(false);
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
  expect(call.mock.calls.some(([operation]) => operation === "session")).toBe(true);
  browsing = true;
  eventListener({
    message: "ryd_discussion_event",
    type: "permissions",
    data: { added: ["browsingActivity"], removed: [] },
  });
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "capabilities")).toHaveLength(1);
  expect(call.mock.calls.some(([operation]) => operation === "comments")).toBe(true);
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();
});

test("a capability response from before browsing revocation cannot restore the discussion", async () => {
  let browsing = true;
  let complete;
  let hold = true;
  hasFeaturePermission.mockImplementation(async (name) => name !== "counts" || browsing);
  const call = jest.fn((operation) =>
    operation === "capabilities" && hold ? new Promise((resolve) => (complete = resolve)) : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  browsing = false;
  eventListener({
    message: "ryd_discussion_event",
    type: "permissions",
    data: { added: [], removed: ["browsingActivity"] },
  });
  complete({ enabled: true });
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
  expect(call.mock.calls.some(([operation]) => operation === "comments")).toBe(false);
  browsing = true;
  hold = false;
  eventListener({
    message: "ryd_discussion_event",
    type: "permissions",
    data: { added: ["browsingActivity"], removed: [] },
  });
  await flush();
  expect(document.getElementById("ryd-discussion-panel")).not.toBeNull();
  browsing = false;
  eventListener({
    message: "ryd_discussion_event",
    type: "permissions",
    data: { added: [], removed: ["browsingActivity"] },
  });
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
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
  await flush();
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

test("an inbox that arrives before the signed-in session still labels the notifications tab", async () => {
  let resolve;
  const profile = { id: "33333333-3333-4333-8333-333333333333", nickname: "Writer" };
  feature = initDiscussion({
    request: (operation) =>
      operation === "session"
        ? new Promise((done) => {
            resolve = done;
          })
        : request(operation),
  });
  await flush();
  eventListener({
    message: "ryd_discussion_event",
    type: "inbox",
    data: { items: [], unreadCount: 2, revision: "4", nextCursor: null },
  });
  resolve({ authenticated: true, canPost: true, membershipTier: "commenter", profile });
  await flush();
  expect(document.querySelector("[data-action='inbox']").textContent).toBe(`${discussionText("notifications")} (2)`);
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

test.each([
  ["before the native sound pivot", "<pivot-button-view-model></pivot-button-view-model>", "PIVOT-BUTTON-VIEW-MODEL"],
  ["at the end of the column", "", null],
])("places the Shorts launcher inside the native action column %s", async (_, trailingAction, nextTag) => {
  const actionBar = shortsFixture().querySelector("reel-action-bar-view-model");
  actionBar.innerHTML = `<like-button-view-model></like-button-view-model><button-view-model></button-view-model>${trailingAction}`;
  feature = initDiscussion({ request });
  await flush();
  const launcher = document.getElementById("ryd-discussion-launcher");
  expect(launcher.parentElement).toBe(actionBar);
  expect(launcher.previousElementSibling.tagName).toBe("BUTTON-VIEW-MODEL");
  expect(launcher.nextElementSibling?.tagName ?? null).toBe(nextTag);
  expect(actionBar.nextElementSibling).toBeNull();
});

test("sizes the Shorts launcher like a native action item instead of YouTube's sibling spacing", () => {
  const stylesheet = readFileSync(join(__dirname, "../../content-style.css"), "utf8");
  const launcher = stylesheet.match(/\.ryd-discussion-launcher\s*\{([^}]*)\}/)?.[1] ?? "";
  expect(launcher).toContain("width: 48px");
  expect(launcher).toContain("height: 48px");
  expect(launcher).toContain("flex: none");
  expect(launcher).toContain("margin: 0 auto 8px !important");
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
  shortsFixture();
  feature = initDiscussion({ request });
  await flush();
  document.getElementById("ryd-discussion-launcher").click();
  answerNativeState({ disabled: false });
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

test.each([
  ["pageshow", "window"],
  ["popstate", "window"],
  ["yt-navigate-finish", "document"],
  ["online", "window"],
  ["visibilitychange", "document"],
])("visible %s activity refreshes the existing session recovery path", async (type, target) => {
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(1);
  (target === "window" ? window : document).dispatchEvent(new Event(type));
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(2);
});

test("activity bursts coalesce with the current session request and allow a later recovery", async () => {
  let complete;
  const call = jest.fn((operation) =>
    operation === "session" ? new Promise((resolve) => (complete = resolve)) : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("popstate"));
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("yt-navigate-finish"));
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(1);
  complete({ authenticated: false, canPost: false, profile: null });
  await flush();
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(2);
});

test("DOM refresh intervals and mutations do not initiate session recovery", async () => {
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  call.mockClear();
  document.body.append(document.createElement("span"));
  await flush();
  jest.advanceTimersByTime(60000);
  await flush();
  expect(call).not.toHaveBeenCalled();
});

test("hidden pages defer all session recovery until they become visible", async () => {
  const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("popstate"));
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("yt-navigate-finish"));
  document.dispatchEvent(new Event("visibilitychange"));
  jest.advanceTimersByTime(30000);
  await flush();
  expect(call.mock.calls.some(([operation]) => operation === "session")).toBe(false);
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(1);
});

test("a page hidden during the account-permission check sends no session request", async () => {
  const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  let allowAccount;
  hasFeaturePermission.mockImplementation((feature) =>
    feature === "account" ? new Promise((resolve) => (allowAccount = resolve)) : Promise.resolve(true),
  );
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  visibility.mockReturnValue("hidden");
  allowAccount(true);
  await flush();
  expect(call.mock.calls.some(([operation]) => operation === "session")).toBe(false);
});

test("missing account consent skips activity recovery while public discussions remain available", async () => {
  hasFeaturePermission.mockImplementation(async (feature) => feature !== "account");
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("pageshow"));
  await flush();
  expect(call.mock.calls.some(([operation]) => operation === "session")).toBe(false);
  expect(call.mock.calls.some(([operation]) => operation === "comments")).toBe(true);
});

test("account-permission revocation prevents an older recovery reply from restoring account controls", async () => {
  let complete;
  const call = jest.fn((operation) =>
    operation === "session" ? new Promise((resolve) => (complete = resolve)) : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  hasFeaturePermission.mockImplementation(async (feature) => feature !== "account");
  eventListener({
    message: "ryd_discussion_event",
    type: "permissions",
    data: { removed: ["authenticationInfo"], added: [] },
  });
  complete({ authenticated: true, canPost: true, profile: { id: "old", nickname: "Previous" } });
  await flush();
  expect(document.querySelector("textarea[name='comment']")).toBeNull();
  expect(document.body.textContent).not.toContain("Previous");
  call.mockClear();
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(call.mock.calls.some(([operation]) => operation === "session")).toBe(false);
});

test("destroy removes activity listeners and ignores a pending permission check", async () => {
  let allowAccount;
  hasFeaturePermission.mockImplementation((feature) =>
    feature === "account" ? new Promise((resolve) => (allowAccount = resolve)) : Promise.resolve(true),
  );
  const call = jest.fn(request);
  feature = initDiscussion({ request: call });
  await flush();
  const removeWindow = jest.spyOn(window, "removeEventListener");
  const removeDocument = jest.spyOn(document, "removeEventListener");
  feature.destroy();
  allowAccount(true);
  call.mockClear();
  hasFeaturePermission.mockClear();
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("popstate"));
  document.dispatchEvent(new Event("visibilitychange"));
  document.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(call).not.toHaveBeenCalled();
  expect(hasFeaturePermission).not.toHaveBeenCalled();
  expect(removeWindow).toHaveBeenCalledWith("online", expect.any(Function));
  expect(removeWindow).toHaveBeenCalledWith("popstate", expect.any(Function));
  expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
});

test("unchanged activity session replies preserve the active comment draft and focus", async () => {
  const account = { authenticated: true, canPost: true, profile: { id: "reader", nickname: "Writer" } };
  const call = jest.fn((operation) =>
    operation === "session" ? Promise.resolve({ ...account, profile: { ...account.profile } }) : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  const textarea = document.querySelector("textarea[name='comment']");
  textarea.value = "Unsent draft";
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(document.querySelector("textarea[name='comment']")).toBe(textarea);
  expect(textarea.value).toBe("Unsent draft");
  expect(document.activeElement).toBe(textarea);
});

test("a failed session recovery can be retried by later activity", async () => {
  let failed = true;
  const call = jest.fn((operation) =>
    operation === "session" && failed ? Promise.reject(new Error("offline")) : request(operation),
  );
  feature = initDiscussion({ request: call });
  await flush();
  failed = false;
  window.dispatchEvent(new Event("online"));
  await flush();
  expect(call.mock.calls.filter(([operation]) => operation === "session")).toHaveLength(2);
});
