/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/"}
 */

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  globalThis.__RYD_LIVE_TEST_BUILD__ = false;
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  globalThis.GM = {
    getValue: jest.fn(async (_key, fallback) => fallback),
    setValue: jest.fn(async () => undefined),
    deleteValue: jest.fn(async () => undefined),
  };
  history.replaceState({}, "", "/");
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
  delete globalThis.GM;
  delete globalThis.__RYD_LIVE_TEST_BUILD__;
  document.body.replaceChildren();
  history.replaceState({}, "", "/");
});

test.each([false, true])("passive navigation never registers a voter (submission disabled: %s)", async (disabled) => {
  const userscript = require("./userscript-entry").__RewireAPI__;
  userscript.__get__("extConfig").disableVoteSubmission = disabled;

  for (const pathname of ["/", "/results?search_query=test", "/watch?v=abcdefghijk", "/shorts/lmnopqrstuv"]) {
    window.dispatchEvent(new Event("yt-navigate-start"));
    history.replaceState({}, "", pathname);
    window.dispatchEvent(new Event("yt-navigate-finish"));
    await jest.advanceTimersByTimeAsync(1200);
  }

  expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes("/puzzle/registration"))).toEqual([]);
  expect(globalThis.fetch.mock.calls.filter(([url, options]) => /userId/.test(`${url}${options?.body || ""}`))).toEqual(
    [],
  );
  expect(globalThis.GM.setValue).not.toHaveBeenCalled();
  expect(globalThis.GM.getValue.mock.calls.some(([key]) => key === "rydVoteCredentials")).toBe(false);
});
