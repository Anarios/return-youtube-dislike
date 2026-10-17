/** @jest-environment jsdom */

import { discussionRoute, findDiscussionSurface, NATIVE_STATE_ATTRIBUTE, NATIVE_STATE_REQUEST } from "./detector";

const VIDEO = "abcdefghijk";
let listener;

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = "en";
});
afterEach(() => {
  if (listener) document.removeEventListener(NATIVE_STATE_REQUEST, listener, true);
  listener = null;
});

function watch(videoId = VIDEO) {
  const root = document.createElement("ytd-watch-flexy");
  root.setAttribute("video-id", videoId);
  root.innerHTML = "<ytd-comments></ytd-comments>";
  document.body.append(root);
  return root;
}

function respond(state) {
  listener = (event) => event.target.setAttribute(NATIVE_STATE_ATTRIBUTE, JSON.stringify(state));
  document.addEventListener(NATIVE_STATE_REQUEST, listener, true);
}

test("only supports canonical desktop watch and Shorts routes with a valid identity", () => {
  expect(discussionRoute(`https://www.youtube.com/watch?v=${VIDEO}`)).toEqual({ videoId: VIDEO, surface: "watch" });
  expect(discussionRoute(`https://www.youtube.com/shorts/${VIDEO}`)).toEqual({ videoId: VIDEO, surface: "shorts" });
  for (const url of [
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?v=oops",
    `https://m.youtube.com/watch?v=${VIDEO}`,
    `https://www.youtube.com.evil.test/watch?v=${VIDEO}`,
  ])
    expect(discussionRoute(url)).toBeNull();
});

test.each(["Comments are turned off.", "Комментарии отключены."])(
  "recognizes the native disabled help endpoint independent of text: %s",
  (text) => {
    const root = watch();
    root.querySelector("ytd-comments").innerHTML =
      `<ytd-message-renderer><span>${text}</span><a href="https://support.google.com/youtube/answer/9706180?hl=ru">Подробнее</a></ytd-message-renderer>`;
    expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })?.root).toBe(root);
  },
);

test("missing comments and generic messages never count as disabled", () => {
  const root = watch();
  root.querySelector("ytd-comments").innerHTML = "<ytd-message-renderer>Loading comments</ytd-message-renderer>";
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })).toBeNull();
});

test("accepts positive native disabled evidence when kids status is unknown", () => {
  const root = watch();
  respond({ videoId: VIDEO, disabled: true });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })?.host).toBe(root.querySelector("ytd-comments"));
  expect(root.hasAttribute(NATIVE_STATE_ATTRIBUTE)).toBe(false);
});

test("positive made-for-kids proof overrides disabled proof and help link", () => {
  watch();
  respond({ videoId: VIDEO, disabled: true, madeForKids: true });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })).toBeNull();
});

test("ignores stale hidden roots and stale bridge identity", () => {
  const hidden = watch();
  hidden.hidden = true;
  watch("zyxwvutsrqp");
  respond({ videoId: VIDEO, disabled: true });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })).toBeNull();
  hidden.hidden = false;
  document.removeEventListener(NATIVE_STATE_REQUEST, listener, true);
  respond({ videoId: "zyxwvutsrqp", disabled: true });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "watch" })).toBeNull();
});

test("Shorts requires a current native disabled state and action surface", () => {
  document.body.innerHTML =
    "<ytd-reel-video-renderer is-active><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer>";
  document.querySelector("ytd-reel-video-renderer").getBoundingClientRect = () => ({
    width: 400,
    height: 700,
    top: 0,
    left: 0,
    bottom: 700,
    right: 400,
  });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "shorts" })).toBeNull();
  respond({ videoId: VIDEO, disabled: true, madeForKids: false });
  expect(findDiscussionSurface({ videoId: VIDEO, surface: "shorts" })?.host.tagName).toBe("REEL-ACTION-BAR-VIEW-MODEL");
});
