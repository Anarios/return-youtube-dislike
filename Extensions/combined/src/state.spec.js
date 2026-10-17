/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://m.youtube.com/"}
 */

jest.mock("./buttons", () => {
  const dislikeTextContainer = {
    innerText: "native dislike",
    removeAttribute: jest.fn(),
  };
  const likeButton = {
    classList: { contains: () => false },
    native: {
      getAttribute(name) {
        return name === "aria-label" ? "35 likes" : String(this.pressed);
      },
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
  initializeHideClutterButtons,
  initializeSelectors,
  setDislikes,
  setState,
  storedData,
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
  clearVoteDataRequestCache();
  globalThis.__mockBrowser = undefined;
  globalThis.__mockControlsUnavailable = false;
  const likeButton = getLikeButton();
  likeButton.native.innerText = "35";
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
  stateRewire.__ResetDependency__("isMobile");
  stateRewire.__ResetDependency__("syntheticDislikeStore");
});

afterAll(() => {
  delete global.fetch;
  delete globalThis.__mockBrowser;
  delete globalThis.__mockControlsUnavailable;
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

test("uses destination API likes for the rate bar when reused native Like text is stale", async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: jest.fn(async () => ({ dislikes: 65, likes: 100, rating: 3.5 })),
  });
  const testState = { dislikes: 0, likes: 0, previousState: "neutral", videoId: null };

  await expect(setState(testState)).resolves.toBe(true);

  expect(fetch).toHaveBeenCalledWith("https://example.test/votes?videoId=abcdefghijk&likeCount=35", expect.any(Object));
  expect(testState).toMatchObject({ dislikes: 65, likes: 100, videoId: "abcdefghijk" });
  expect(createRateBar).toHaveBeenCalledWith(100, 65);
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
