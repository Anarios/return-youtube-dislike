/** @jest-environment jsdom */

import { getLiveVideoId } from "./live-video-id";

const LIVE_VIDEO = "0sfDth4lMLc";
const PREVIOUS_VIDEO = "dQw4w9WgXcQ";

function renderWatchPage({
  canonical = `https://www.youtube.com/watch?v=${LIVE_VIDEO}`,
  root = "ytd-watch-flexy",
  hidden = false,
} = {}) {
  document.head.innerHTML = canonical === null ? "" : `<link rel="canonical" href="${canonical}">`;
  document.body.innerHTML = `<${root} video-id="${PREVIOUS_VIDEO}"${hidden ? " hidden" : ""}></${root}>`;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

test.each([`/live/${LIVE_VIDEO}`, `/live/${LIVE_VIDEO}/`])("reads the video from the live link %s", (pathname) => {
  renderWatchPage({ canonical: `https://www.youtube.com/watch?v=${PREVIOUS_VIDEO}` });
  expect(getLiveVideoId(pathname)).toBe(LIVE_VIDEO);
});

test.each([
  "/@LofiGirl/live",
  "/@LofiGirl/live/",
  "/channel/UCSJ4gkVC6NrvII8umztf0Ow/live",
  "/c/LofiGirl/live",
  "/user/ChilledCow/live",
])("reads the canonical watch identity for the channel live route %s", (pathname) => {
  renderWatchPage();
  expect(getLiveVideoId(pathname)).toBe(LIVE_VIDEO);
});

test("reads the canonical identity on the grid watch layout", () => {
  renderWatchPage({ root: "ytd-watch-grid" });
  expect(getLiveVideoId("/@LofiGirl/live")).toBe(LIVE_VIDEO);
});

test("uses the canonical identity, which YouTube updates first, instead of the lagging watch root", () => {
  renderWatchPage();
  expect(document.querySelector("ytd-watch-flexy").getAttribute("video-id")).toBe(PREVIOUS_VIDEO);
  expect(getLiveVideoId("/@LofiGirl/live")).toBe(LIVE_VIDEO);
});

test("reads the current canonical identity on every call instead of caching an earlier stream", () => {
  renderWatchPage({ canonical: `https://www.youtube.com/watch?v=${PREVIOUS_VIDEO}` });
  expect(getLiveVideoId("/@LofiGirl/live")).toBe(PREVIOUS_VIDEO);
  document.querySelector("link[rel='canonical']").href = `https://www.youtube.com/watch?v=${LIVE_VIDEO}`;
  expect(getLiveVideoId("/@LofiGirl/live")).toBe(LIVE_VIDEO);
});

test.each(["/", "/@LofiGirl", "/@LofiGirl/streams", "/live/short", "/@LofiGirl/live/extra", "/feed/live"])(
  "ignores the canonical watch identity on the non-live route %s",
  (pathname) => {
    renderWatchPage();
    expect(getLiveVideoId(pathname)).toBeNull();
  },
);

test("ignores the canonical link while no watch page is displayed", () => {
  renderWatchPage({ hidden: true });
  expect(getLiveVideoId("/@LofiGirl/live")).toBeNull();
});

test.each([
  ["a missing canonical link", null],
  ["a channel canonical link", "https://www.youtube.com/@LofiGirl"],
  ["a malformed video identity", "https://www.youtube.com/watch?v=abc"],
])("returns no identity for %s", (_, canonical) => {
  renderWatchPage({ canonical });
  expect(getLiveVideoId("/@LofiGirl/live")).toBeNull();
});
