/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/"}
 */

jest.mock("../../common/vote-client", () => ({
  createVoteClient: () => ({ ensureRegistered: async () => undefined }),
}));

const originalFetch = globalThis.fetch;
let getVideoId;

beforeAll(() => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn();
  globalThis.__RYD_LIVE_TEST_BUILD__ = false;
  getVideoId = require("./userscript-entry").__RewireAPI__.__get__("getVideoId");
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterEach(() => {
  document.head.replaceChildren();
  history.replaceState({}, "", "/");
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__RYD_LIVE_TEST_BUILD__;
});

test.each([
  "/watch?v=a-B_c1D2e3F",
  "/watch?app=desktop&v=a-B_c1D2e3F&list=PLx&index=4&t=42s",
  "/watch?v=a-B_c1D2e3F#comments",
  "/shorts/a-B_c1D2e3F",
  "/shorts/a-B_c1D2e3F/?feature=share&si=abc",
  "/live/a-B_c1D2e3F?si=share",
])("reads the current video id from %s", (route) => {
  history.replaceState({}, "", route);

  expect(getVideoId()).toBe("a-B_c1D2e3F");
});

test("reads a clip's source video from the identifier meta tag and never returns the clip slug", () => {
  document.head.insertAdjacentHTML("beforeend", '<meta itemprop="identifier" content="a-B_c1D2e3F">');
  history.replaceState({}, "", "/clip/UgkxClipSlug_-?si=share");

  expect(getVideoId()).toBe("a-B_c1D2e3F");
});

test.each([
  "/embed/a-B_c1D2e3F",
  "/shorts/a-B_c1D2e3F/extra",
  "/results?search_query=a-B_c1D2e3F",
  "/feed/subscriptions",
])("returns no video identity for %s", (route) => {
  history.replaceState({}, "", route);

  expect(getVideoId()).toBeNull();
});
