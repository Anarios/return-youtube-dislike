/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://m.youtube.com/"}
 */

jest.mock("./buttons", () => {
  const dislikeTextContainer = {
    innerText: "native dislike",
    get textContent() {
      return this.innerText;
    },
    set textContent(value) {
      this.innerText = String(value);
    },
    removeAttribute: jest.fn(),
  };
  const likeButton = {
    classList: { contains: () => false },
    native: {
      getAttribute(name) {
        return name === "aria-label" ? this.ariaLabel : String(this.pressed);
      },
      ariaLabel: "35 likes",
      innerText: "35",
      pressed: false,
    },
  };
  const dislikeButton = {
    classList: { contains: () => false },
    native: {
      getAttribute(name) {
        return name === "aria-pressed" ? String(this.pressed) : "Dislike this video";
      },
      pressed: false,
    },
  };
  return {
    checkForSignInButton: () => false,
    getButtonControls: () => ({
      buttons: { children: [] },
      dislikeButton,
      likeButton,
      ready: !globalThis.__mockControlsUnavailable,
    }),
    getButtons: () => ({ children: [] }),
    getDislikeButton: () => dislikeButton,
    getDislikeTextContainer: () => {
      if (globalThis.__mockControlsUnavailable) return undefined;
      return dislikeTextContainer;
    },
    getLikeButton: () => likeButton,
    getNativeButton: (control) => control?.native,
    getLikeTextContainer: () => ({ innerText: "35" }),
    isSyntheticShortsDislike: (button) => button?.synthetic === true,
    setSyntheticShortsDislikeEnabled: jest.fn(),
    setSyntheticShortsDislikePressed: jest.fn(),
  };
});

jest.mock("./bar", () => ({
  createRateBar: jest.fn(),
}));

jest.mock("./config", () => ({
  DEV_API_URL: "https://example.test",
  PROD_API_URL: "https://example.test",
  config: {},
  getApiEndpoint: (pathname) => `https://example.test${pathname}`,
  isDevelopment: () => false,
}));

jest.mock("./utils", () => ({
  createObserver: () => ({ observe: jest.fn() }),
  getBrowser: () => globalThis.__mockBrowser,
  getColorFromTheme: () => undefined,
  getVideoId: (url) => new URL(url).searchParams.get("v"),
  initializeLogging: () => undefined,
  localize: (key) => key,
  numberFormat: (value) => String(value),
  querySelector: (selectors, root) => root?.native ?? null,
}));

import { createRateBar } from "./bar";
import { getDislikeButton, getDislikeTextContainer, getLikeButton, setSyntheticShortsDislikePressed } from "./buttons";
import { dislikeClicked, likeClicked } from "./events";
import { clearVoteDataRequestCache } from "./vote-data-request";
import {
  clearRenderedVoteState,
  extConfig,
  getLikeCountFromButton,
  initExtConfig,
  initializeHideClutterButtons,
  initializeSelectors,
  updateDisableLogging,
  restoreCurrentState,
  setDislikes,
  setState,
  storedData,
  persistSyntheticShortsDislikeState,
  __RewireAPI__ as stateRewire,
} from "./state";

const dislikeTextContainer = getDislikeTextContainer();

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  stateRewire.__set__("refreshReactionPresentation", jest.fn());
  stateRewire.__set__("nativeLikeCounts", new WeakMap());
  clearVoteDataRequestCache();
  globalThis.__mockBrowser = undefined;
  globalThis.__mockControlsUnavailable = false;
  const likeButton = getLikeButton();
  likeButton.native.innerText = "35";
  likeButton.native.ariaLabel = "35 likes";
  likeButton.native.pressed = false;
  getDislikeButton().native.pressed = false;
  getDislikeButton().synthetic = false;
  dislikeTextContainer.innerText = "native dislike";
  dislikeTextContainer.removeAttribute.mockClear();
  createRateBar.mockClear();
  global.fetch = jest.fn();
  window.history.replaceState(null, "", "/watch?v=abcdefghijk");
});

afterEach(() => {
  stateRewire.__ResetDependency__("refreshReactionPresentation");
  stateRewire.__ResetDependency__("nativeLikeCounts");
  stateRewire.__ResetDependency__("isMobile");
  stateRewire.__ResetDependency__("syntheticDislikeStore");
  stateRewire.__ResetDependency__("isPrivateBrowsingContext");
  stateRewire.__ResetDependency__("initializeLogging");
});

afterAll(() => {
  delete global.fetch;
  delete globalThis.__mockBrowser;
  delete globalThis.__mockControlsUnavailable;
});

test.each([true, false, undefined])("initializes the logging preference (%s)", (value) => {
  const initializeLogging = jest.fn();
  stateRewire.__set__("initializeLogging", initializeLogging);
  const set = jest.fn();
  globalThis.__mockBrowser = {
    storage: { sync: { get: (_keys, callback) => callback({ disableLogging: value }), set } },
  };

  stateRewire.__get__("initializeDisableLogging")();

  expect(extConfig.disableLogging).toBe(value ?? true);
  expect(initializeLogging).toHaveBeenCalledTimes(1);
  if (value === undefined) expect(set).toHaveBeenCalledWith({ disableLogging: true });
  else expect(set).not.toHaveBeenCalled();
});

test.each([true, false, undefined])("a late logging preference read cannot override a live update (%s)", (value) => {
  const initializeLogging = jest.fn();
  stateRewire.__set__("initializeLogging", initializeLogging);
  let finishRead;
  const set = jest.fn();
  globalThis.__mockBrowser = {
    storage: { sync: { get: (_keys, callback) => (finishRead = callback), set } },
  };
  stateRewire.__get__("initializeDisableLogging")();

  updateDisableLogging(false);
  finishRead({ disableLogging: value });

  expect(extConfig.disableLogging).toBe(false);
  expect(initializeLogging).toHaveBeenCalledTimes(1);
  expect(set).not.toHaveBeenCalled();
});

test("removing the logging preference restores the default suppression", () => {
  const initializeLogging = jest.fn();
  stateRewire.__set__("initializeLogging", initializeLogging);
  updateDisableLogging(false);
  updateDisableLogging(undefined);
  expect(extConfig.disableLogging).toBe(true);
  expect(initializeLogging).toHaveBeenCalledTimes(2);
});

test("hide-clutter initialization persists and publishes the default-off value", async () => {
  const set = jest.fn();
  globalThis.__mockBrowser = {
    storage: {
      sync: {
        get: jest.fn((_keys, callback) => callback({})),
        set,
      },
    },
  };

  await expect(initializeHideClutterButtons()).resolves.toBe(false);

  expect(set).toHaveBeenCalledWith({ hideClutterButtons: false });
  expect(extConfig.hideClutterButtons).toBe(false);
  expect(document.documentElement.getAttribute("data-ryd-hide-clutter-buttons")).toBe("false");
});

test("hide-clutter initialization reuses and publishes a stored enabled value", async () => {
  const set = jest.fn();
  globalThis.__mockBrowser = {
    storage: {
      sync: {
        get: jest.fn((_keys, callback) => callback({ hideClutterButtons: true })),
        set,
      },
    },
  };

  await expect(initializeHideClutterButtons()).resolves.toBe(true);

  expect(set).not.toHaveBeenCalled();
  expect(extConfig.hideClutterButtons).toBe(true);
  expect(document.documentElement.getAttribute("data-ryd-hide-clutter-buttons")).toBe("true");
});

test("a delayed outgoing request failure cannot overwrite the destination before its successful initialization", async () => {
  const outgoing = deferred();
  const destinationResponse = {
    ok: true,
    json: jest.fn(async () => ({ dislikes: 65, likes: 35, rating: 3.5 })),
  };
  fetch.mockReturnValueOnce(outgoing.promise).mockResolvedValueOnce(destinationResponse);
  const testState = { dislikes: 0, likes: 0, previousState: "neutral", videoId: null };

  const outgoingInitialization = setState(testState);
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);

  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  outgoing.reject(new TypeError("outgoing request failed"));
  await outgoingInitialization;

  expect(dislikeTextContainer.innerText).toBe("native dislike");
  expect(createRateBar).not.toHaveBeenCalled();

  await setState(testState);

  expect(dislikeTextContainer.innerText).toBe("65");
  expect(createRateBar).toHaveBeenCalledWith(35, 65);
  expect(testState.videoId).toBe("zyxwvutsrqp");
});

test.each([
  ["non-2xx", { ok: false, error: new Error("unavailable") }],
  [
    "malformed JSON",
    {
      ok: true,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    },
  ],
])("a delayed outgoing %s response cannot write an error into the destination controls", async (name, response) => {
  const outgoing = deferred();
  fetch.mockReturnValueOnce(outgoing.promise);
  const testState = { dislikes: 0, likes: 0, previousState: "neutral", videoId: null };

  const initialization = setState(testState);
  await Promise.resolve();
  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  // Resolve the request only after navigation so every failure path exercises the stale-video guard.
  outgoing.resolve(response);
  await initialization;

  expect(dislikeTextContainer.innerText).toBe("native dislike");
  expect(createRateBar).not.toHaveBeenCalled();
});

test("keeps a valid response when destination controls disappear before rendering", async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: jest.fn(async () => ({ dislikes: 65, likes: 35, rating: 3.5 })),
  });
  const testState = { dislikes: 0, likes: 0, previousState: "neutral", videoId: null };
  globalThis.__mockControlsUnavailable = true;

  await expect(setState(testState)).resolves.toBe(false);

  expect(testState).toMatchObject({ dislikes: 65, likes: 35, videoId: "abcdefghijk" });
  expect(createRateBar).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([
  ["like", false, "LIKED_STATE", 0],
  ["dislike", false, "DISLIKED_STATE", 0],
  ["like", true, "NEUTRAL_STATE", 1],
  ["dislike", true, "NEUTRAL_STATE", -1],
])(
  "resamples an early native %s activation from pressed=%s before the next vote",
  async (action, initiallyPressed, expectedState, expectedVote) => {
    stateRewire.__set__("isMobile", () => false);
    const pending = deferred();
    const sendMessage = jest.fn();
    globalThis.__mockBrowser = { runtime: { sendMessage } };
    Object.assign(storedData, { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null });
    const button = action === "like" ? getLikeButton() : getDislikeButton();
    const activate = action === "like" ? likeClicked : dislikeClicked;
    button.native.pressed = initiallyPressed;
    fetch.mockReturnValueOnce(pending.promise);

    const initialization = setState(storedData);
    expect(fetch).toHaveBeenCalledTimes(1);
    activate();
    button.native.pressed = !initiallyPressed;
    expect(sendMessage).not.toHaveBeenCalled();

    pending.resolve({ ok: true, json: async () => ({ dislikes: 65, likes: 35 }) });
    await expect(initialization).resolves.toBe(true);
    expect(storedData.previousState).toBe(expectedState);

    activate();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      message: "send_vote",
      videoId: "abcdefghijk",
      vote: expectedVote,
    });
  },
);

test.each([
  [true, false, false, "DISLIKED_STATE"],
  [true, false, true, "LIKED_STATE"],
  [false, true, false, "NEUTRAL_STATE"],
])(
  "resamples native Like on synthetic Shorts with saved Dislike=%s and Like %s -> %s",
  async (savedDisliked, initialLiked, finalLiked, expectedState) => {
    stateRewire.__set__("isMobile", () => false);
    const store = {
      isDisliked: jest.fn(async () => savedDisliked),
      setDisliked: jest.fn(async () => undefined),
    };
    stateRewire.__set__("syntheticDislikeStore", store);
    const pending = deferred();
    const requestStarted = deferred();
    getDislikeButton().synthetic = true;
    getLikeButton().native.pressed = initialLiked;
    fetch.mockImplementationOnce(() => {
      requestStarted.resolve();
      return pending.promise;
    });
    const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };

    const initialization = setState(testState);
    await requestStarted.promise;
    getLikeButton().native.pressed = finalLiked;
    pending.resolve({ ok: true, json: async () => ({ dislikes: 65, likes: 35 }) });
    await expect(initialization).resolves.toBe(true);

    expect(testState.previousState).toBe(expectedState);
    expect(setSyntheticShortsDislikePressed).toHaveBeenLastCalledWith(
      expectedState === "DISLIKED_STATE",
      getDislikeButton(),
    );
    if (savedDisliked && finalLiked) {
      expect(store.setDisliked).toHaveBeenCalledWith("abcdefghijk", false);
    } else {
      expect(store.setDisliked).not.toHaveBeenCalled();
    }
  },
);

test("navigation cancellation does not display an API error or complete initialization", async () => {
  fetch.mockRejectedValueOnce(new DOMException("Navigation changed", "AbortError"));
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };

  await expect(setState(testState)).resolves.toBe(false);

  expect(dislikeTextContainer.innerText).toBe("native dislike");
  expect(testState.videoId).toBeNull();
  expect(createRateBar).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("clears a reused action surface while the destination video is loading", () => {
  const buttons = document.createElement("div");
  const wrapper = document.createElement("div");
  const count = document.createElement("span");
  wrapper.className = "ryd-tooltip";
  count.innerText = "100";
  buttons.append(wrapper);

  clearRenderedVoteState({ buttons, dislikeTextContainer: count });

  expect(count.innerText).toBe("");
  expect(buttons.querySelector(".ryd-tooltip")).toBeNull();
});

test("mobile dislike rendering writes only to the semantic Dislike text container", () => {
  const likeButton = getLikeButton();

  expect(setDislikes("11")).toBe(true);

  expect(likeButton.native.innerText).toBe("35");
  expect(dislikeTextContainer.innerText).toBe("11");
});

test("prefers the current native like count over the API count for the rate bar", async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: jest.fn(async () => ({ dislikes: 65, likes: 100, rating: 3.5 })),
  });
  const testState = { dislikes: 0, likes: 0, previousState: "neutral", videoId: null };

  await expect(setState(testState)).resolves.toBe(true);

  expect(fetch).toHaveBeenCalledWith("https://example.test/votes?videoId=abcdefghijk&likeCount=35", expect.any(Object));
  expect(testState).toMatchObject({ dislikes: 65, likes: 35, videoId: "abcdefghijk" });
  expect(createRateBar).toHaveBeenCalledWith(35, 65);
});

test.each([
  [0, "35 likes", 35],
  ["0", "35 likes", 35],
  [0, "0 likes", 0],
  [0, "Like this video", 0],
  [0, null, 0],
  [100, "35 likes", 35],
  [12, "35 likes", 35],
  [100, "0 likes", 100],
  [100, "Like this video", 100],
  [100, null, 100],
])("API likes=%s with native label=%s renders %s likes", async (apiLikes, nativeLabel, expectedLikes) => {
  getLikeButton().native.ariaLabel = nativeLabel;
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: apiLikes }) });
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };

  await expect(setState(testState)).resolves.toBe(true);

  expect(testState).toMatchObject({ dislikes: 65, likes: expectedLikes, videoId: "abcdefghijk" });
  expect(createRateBar).toHaveBeenCalledWith(expectedLikes, 65);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each([0, 100])("reads the current native count at render time with API likes=%s", async (apiLikes) => {
  const pending = deferred();
  fetch.mockReturnValueOnce(pending.promise);
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };

  const initialization = setState(testState);
  getLikeButton().native.ariaLabel = "73 likes";
  pending.resolve({ ok: true, json: async () => ({ dislikes: 65, likes: apiLikes }) });
  await expect(initialization).resolves.toBe(true);

  expect(createRateBar).toHaveBeenCalledWith(73, 65);
  expect(testState.likes).toBe(73);
});

test("ignores an unchanged outgoing native label when the same button is reused for another video", async () => {
  fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: 100 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 12, likes: 73 }) });
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };
  await setState(testState);
  expect(testState.likes).toBe(35);

  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  await expect(setState(testState)).resolves.toBe(true);

  expect(fetch).toHaveBeenLastCalledWith("https://example.test/votes?videoId=zyxwvutsrqp", expect.any(Object));
  expect(testState).toMatchObject({ dislikes: 12, likes: 73, videoId: "zyxwvutsrqp" });
  expect(createRateBar).toHaveBeenLastCalledWith(73, 12);
  expect(getLikeCountFromButton()).toBe(false);
});

test("accepts a reused button's destination label when it changes while the API request is pending", async () => {
  const pending = deferred();
  fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: 100 }) })
    .mockReturnValueOnce(pending.promise);
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };
  await setState(testState);

  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  const initialization = setState(testState);
  getLikeButton().native.ariaLabel = "92 likes";
  pending.resolve({ ok: true, json: async () => ({ dislikes: 12, likes: 73 }) });
  await expect(initialization).resolves.toBe(true);

  expect(testState.likes).toBe(92);
  expect(createRateBar).toHaveBeenLastCalledWith(92, 12);
});

test("accepts a replacement native button even when its label matches the outgoing count", () => {
  expect(getLikeCountFromButton()).toBe(35);
  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  expect(getLikeCountFromButton()).toBe(false);
  const likeButton = getLikeButton();
  const outgoingNativeButton = likeButton.native;
  try {
    likeButton.native = { ...outgoingNativeButton };
    expect(getLikeCountFromButton()).toBe(35);
  } finally {
    likeButton.native = outgoingNativeButton;
  }
});

test("restoration keeps destination API likes until a reused native label changes", async () => {
  fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: 100 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 12, likes: 73 }) });
  Object.assign(storedData, { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null });
  await setState(storedData);

  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  await setState(storedData);
  expect(restoreCurrentState()).toBe(true);
  expect(storedData.likes).toBe(73);
  expect(createRateBar).toHaveBeenLastCalledWith(73, 12);

  getLikeButton().native.ariaLabel = "92 likes";
  expect(restoreCurrentState()).toBe(true);
  expect(storedData.likes).toBe(92);
  expect(createRateBar).toHaveBeenLastCalledWith(92, 12);
});

test.each([
  [0, "73 likes", 73],
  [100, "73 likes", 73],
  [100, "0 likes", 100],
  [100, null, 100],
])("restores API likes=%s with native label=%s as %s likes", async (apiLikes, nativeLabel, expectedLikes) => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: apiLikes }) });
  Object.assign(storedData, { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null });
  globalThis.__mockControlsUnavailable = true;

  await expect(setState(storedData)).resolves.toBe(false);
  expect(storedData.likes).toBe(apiLikes);
  expect(createRateBar).not.toHaveBeenCalled();

  globalThis.__mockControlsUnavailable = false;
  getLikeButton().native.ariaLabel = nativeLabel;
  expect(restoreCurrentState()).toBe(true);

  expect(storedData.likes).toBe(expectedLikes);
  expect(createRateBar).toHaveBeenCalledWith(expectedLikes, 65);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a zero-like outgoing response cannot apply its fallback after navigation", async () => {
  const pending = deferred();
  fetch.mockReturnValueOnce(pending.promise);
  const testState = { dislikes: 0, likes: 0, previousState: "NEUTRAL_STATE", videoId: null };

  const initialization = setState(testState);
  window.history.replaceState(null, "", "/watch?v=zyxwvutsrqp");
  getLikeButton().native.ariaLabel = "73 likes";
  pending.resolve({ ok: true, json: async () => ({ dislikes: 65, likes: 0 }) });
  await initialization;

  expect(testState).toMatchObject({ likes: 0, videoId: null });
  expect(createRateBar).not.toHaveBeenCalled();
});

test("falls back to bundled selectors when the remote selector request never settles", async () => {
  jest.useFakeTimers();
  fetch.mockImplementationOnce((_url, { signal }) => {
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
  });

  try {
    const initialization = initializeSelectors();
    jest.advanceTimersByTime(1500);

    await expect(initialization).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/configs/selectors",
      expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) }),
    );
    expect(extConfig.selectors.buttons.regular.desktopNoMenu).toEqual(["#top-level-buttons-computed"]);
    expect(extConfig.selectors.rateBar.newDesignActions).toEqual(["#top-level-buttons-computed"]);
  } finally {
    jest.useRealTimers();
  }
});

describe("private count display", () => {
  beforeEach(() => {
    stateRewire.__set__("isPrivateBrowsingContext", () => true);
  });

  test.each([false, true])("reads only display preferences without default writes (saved=%s)", async (saved) => {
    const initializeLogging = jest.fn();
    stateRewire.__set__("initializeLogging", initializeLogging);
    const preferences = saved
      ? {
          coloredThumbs: true,
          coloredBar: true,
          colorTheme: "custom",
          customColors: { light: { like: "#123456", dislike: "#654321" } },
          numberDisplayFormat: "standard",
          showTooltipPercentage: true,
          tooltipPercentageMode: "percentage",
          numberDisplayReformatLikes: true,
          hideClutterButtons: true,
          disableLogging: false,
          patreonSessionToken: "synthetic-normal-session",
        }
      : {};
    Object.assign(extConfig, {
      coloredThumbs: false,
      coloredBar: false,
      colorTheme: "classic",
      numberDisplayFormat: "compactShort",
      showTooltipPercentage: false,
      tooltipPercentageMode: "dash_like",
      numberDisplayReformatLikes: false,
      hideClutterButtons: false,
    });
    const storage = {
      sync: {
        get: jest.fn((_keys, callback) => callback(preferences)),
        set: jest.fn(),
      },
      local: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
    };
    globalThis.__mockBrowser = { storage };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const consoleLog = console.log;
    const consoleDebug = console.debug;

    await initExtConfig();

    expect(storage.sync.get).toHaveBeenCalledTimes(1);
    expect(storage.sync.get).toHaveBeenCalledWith(
      [
        "coloredThumbs",
        "coloredBar",
        "colorTheme",
        "customColors",
        "numberDisplayFormat",
        "showTooltipPercentage",
        "tooltipPercentageMode",
        "numberDisplayReformatLikes",
        "hideClutterButtons",
      ],
      expect.any(Function),
    );
    expect(storage.sync.set).not.toHaveBeenCalled();
    expect(storage.local.get).not.toHaveBeenCalled();
    expect(storage.local.set).not.toHaveBeenCalled();
    expect(storage.local.remove).not.toHaveBeenCalled();
    expect(storage.onChanged.addListener).not.toHaveBeenCalled();
    expect(initializeLogging).toHaveBeenCalledTimes(1);
    expect(console.log).toBe(consoleLog);
    expect(console.debug).toBe(consoleDebug);
    expect(extConfig.coloredBar).toBe(saved);
    expect(extConfig.numberDisplayFormat).toBe(saved ? "standard" : "compactShort");
    expect(extConfig.customColors.light.like).toBe(saved ? "#123456" : "#007600");
    expect(extConfig.disableLogging).toBe(true);
    expect(extConfig).not.toHaveProperty("patreonSessionToken");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/configs/selectors",
      expect.objectContaining({ method: "GET", credentials: "omit", cache: "no-store" }),
    );
  });

  test("private initialization suppresses its own count diagnostics without replacing console methods", async () => {
    const { logger, setLoggingDisabled } = jest.requireActual("./logging");
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const debug = jest.spyOn(console, "debug").mockImplementation(() => {});
    const ownLog = jest.spyOn(logger, "log");
    const initializeLogging = jest.fn(() => setLoggingDisabled(extConfig.disableLogging));
    stateRewire.__set__("initializeLogging", initializeLogging);
    const storage = {
      sync: {
        get: jest.fn((_keys, callback) => callback({ disableLogging: false })),
        set: jest.fn(),
      },
    };
    globalThis.__mockBrowser = { storage };
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: 100 }) });
    extConfig.disableLogging = false;
    setLoggingDisabled(false);

    try {
      await initExtConfig();
      await setState(storedData);
      logger.debug("Private count diagnostic");

      expect(initializeLogging).toHaveBeenCalledTimes(1);
      expect(extConfig.disableLogging).toBe(true);
      expect(ownLog).toHaveBeenCalledWith("Video is loaded. Adding buttons...");
      expect(log).not.toHaveBeenCalled();
      expect(debug).not.toHaveBeenCalled();
      expect(console.log).toBe(log);
      expect(console.debug).toBe(debug);
      expect(storage.sync.get.mock.calls[0][0]).not.toContain("disableLogging");
      expect(storage.sync.set).not.toHaveBeenCalled();
    } finally {
      setLoggingDisabled(false);
      ownLog.mockRestore();
      log.mockRestore();
      debug.mockRestore();
    }
  });

  test("never restores or writes synthetic Shorts history, including direct persistence calls", async () => {
    const store = { isDisliked: jest.fn(async () => true), setDisliked: jest.fn(async () => undefined) };
    stateRewire.__set__("syntheticDislikeStore", store);
    stateRewire.__set__("isMobile", () => false);
    getDislikeButton().synthetic = true;
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dislikes: 65, likes: 100 }) });

    await setState(storedData);
    await persistSyntheticShortsDislikeState("abcdefghijk", true);
    await persistSyntheticShortsDislikeState("abcdefghijk", false);

    expect(store.isDisliked).not.toHaveBeenCalled();
    expect(store.setDisliked).not.toHaveBeenCalled();
    expect(storedData).toMatchObject({ dislikes: 65, previousState: "NEUTRAL_STATE", videoId: "abcdefghijk" });
    expect(setSyntheticShortsDislikePressed).toHaveBeenLastCalledWith(false, getDislikeButton());
  });

  test("omits private response and count payloads from diagnostics", async () => {
    const payload = { dislikes: 654321, likes: 100, videoId: "private-test-video", marker: "private-count-payload" };
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
    try {
      await setState(storedData);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/654321|private-test-video|private-count-payload/);
    } finally {
      log.mockRestore();
    }
  });

  test("does not save a missing clutter preference when initialized directly", async () => {
    const storage = { get: jest.fn((_keys, callback) => callback({})), set: jest.fn() };
    globalThis.__mockBrowser = { storage: { sync: storage } };
    await initializeHideClutterButtons();
    expect(storage.set).not.toHaveBeenCalled();
  });

  test("discards a late private selector response after page exit", async () => {
    const pending = deferred();
    fetch.mockReturnValueOnce(pending.promise);
    const initialization = initializeSelectors();
    const signal = fetch.mock.calls[0][1].signal;
    window.dispatchEvent(new Event("pagehide"));
    expect(signal.aborted).toBe(true);
    pending.resolve({ ok: true, json: async () => ({ privateSelectorMarker: true }) });
    await expect(initialization).resolves.toBe(false);
    expect(extConfig.selectors).not.toHaveProperty("privateSelectorMarker");
  });
});
