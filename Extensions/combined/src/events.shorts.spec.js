/**
 * @jest-environment jsdom
 */

jest.mock("./bar", () => ({ createRateBar: jest.fn() }));

import { ensureShortsDislikeControl } from "./shortsDislike";
import { addLikeDislikeEventListener } from "./events";
import { updateShortsVoteState } from "./shortsDislike";
import {
  DISLIKED_STATE,
  NEUTRAL_STATE,
  extConfig,
  initializeShortsStateForActiveVideo,
  setDislikes,
  setInitialState,
  storedData,
} from "./state";

function renderShorts() {
  document.body.innerHTML = `
    <ytd-shorts>
      <ytd-reel-video-renderer is-active>
        <reel-action-bar-view-model>
          <like-button-view-model></like-button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>
    </ytd-shorts>`;
}

function renderRegularVideo() {
  document.body.innerHTML = `
    <div id="top-level-buttons-computed">
      <like-button-view-model><button aria-pressed="false"><span role="text">1</span></button></like-button-view-model>
      <dislike-button-view-model><button aria-pressed="false"><span role="text">0</span></button></dislike-button-view-model>
    </div>`;
}

describe("Shorts RYD voting", () => {
  beforeEach(() => {
    global.chrome = {
      runtime: { sendMessage: jest.fn() },
      i18n: { getMessage: jest.fn() },
    };
    delete window.rydPreNavigateLikeButton;
    delete window.rydPreNavigateShortsDislikeButton;
    storedData.likes = 0;
    storedData.dislikes = 0;
    storedData.previousState = NEUTRAL_STATE;
    extConfig.disableVoteSubmission = false;
  });

  afterEach(() => {
    delete global.chrome;
    delete global.fetch;
    document.body.innerHTML = "";
  });

  it("votes through the owned Shorts control once and updates its count optimistically", () => {
    window.history.replaceState(null, "", "/shorts/gNfVr0WAdCU");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "gNfVr0WAdCU", formattedCount: "10" });
    storedData.dislikes = 10;

    const ownedButton = document.querySelector("[data-ryd-shorts-dislike-button]");
    const addEventListener = jest.spyOn(ownedButton, "addEventListener");
    addLikeDislikeEventListener();
    addLikeDislikeEventListener();

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith("click", expect.any(Function));

    ownedButton.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      message: "send_vote",
      vote: -1,
      videoId: "gNfVr0WAdCU",
    });
    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("11");
    expect(ownedButton.getAttribute("aria-pressed")).toBe("true");

    ownedButton.click();
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      message: "send_vote",
      vote: 0,
      videoId: "gNfVr0WAdCU",
    });
    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("10");
    expect(ownedButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the owned control unchanged when the extension context rejects vote dispatch", async () => {
    window.history.replaceState(null, "", "/shorts/invalidated-context");
    renderShorts();
    const control = ensureShortsDislikeControl({ videoId: "invalidated-context", formattedCount: "10" });
    storedData.dislikes = 10;
    const rejectedDispatch = Promise.reject(new Error("Extension context invalidated."));
    rejectedDispatch.catch(() => {});
    chrome.runtime.sendMessage.mockReturnValueOnce(rejectedDispatch);
    addLikeDislikeEventListener();

    control.button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(control.button.getAttribute("aria-pressed")).toBe("false");
    expect(control.count.textContent).toBe("10");
    expect(storedData.dislikes).toBe(10);
    expect(control.root.dataset.rydPendingVoteDelta).toBeUndefined();
  });

  it("never dispatches native YouTube feedback from the owned Shorts control", () => {
    const feedbackRequests = [];
    const captureRequest = (event) => feedbackRequests.push(event.detail);
    document.addEventListener("ryd:shorts-feedback-request", captureRequest);
    window.history.replaceState(null, "", "/shorts/ryd-only");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "ryd-only", formattedCount: "10" });
    storedData.dislikes = 10;
    addLikeDislikeEventListener();

    const ownedButton = document.querySelector("[data-ryd-shorts-dislike-button]");
    ownedButton.click();
    ownedButton.click();
    ownedButton.click();
    document.removeEventListener("ryd:shorts-feedback-request", captureRequest);

    expect(chrome.runtime.sendMessage.mock.calls.map(([message]) => message.vote)).toEqual([-1, 0, -1]);
    expect(feedbackRequests).toEqual([]);
  });

  it("leaves the owned Shorts transition untouched when vote submission is disabled", () => {
    window.history.replaceState(null, "", "/shorts/voting-disabled");
    renderShorts();
    const control = ensureShortsDislikeControl({ videoId: "voting-disabled", formattedCount: "10" });
    storedData.likes = 2;
    storedData.dislikes = 10;
    storedData.previousState = NEUTRAL_STATE;
    extConfig.disableVoteSubmission = true;
    addLikeDislikeEventListener();

    control.button.click();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(control.button.getAttribute("aria-pressed")).toBe("false");
    expect(control.count.textContent).toBe("10");
    expect(control.root.dataset.rydPendingVoteDelta).toBeUndefined();
    expect(storedData).toEqual({ likes: 2, dislikes: 10, previousState: NEUTRAL_STATE });
  });

  it("ignores a reentrant owned click during the first dislike transition", () => {
    window.history.replaceState(null, "", "/shorts/reentrant-click");
    renderShorts();
    const control = ensureShortsDislikeControl({ videoId: "reentrant-click", formattedCount: "3" });
    chrome.runtime.sendMessage.mockImplementationOnce(() => control.button.click());
    addLikeDislikeEventListener();

    control.button.click();

    expect(chrome.runtime.sendMessage.mock.calls.map(([message]) => message.vote)).toEqual([-1]);
    expect(control.button.getAttribute("aria-pressed")).toBe("true");
  });

  it("never decrements an owned Shorts count below zero", () => {
    window.history.replaceState(null, "", "/shorts/zero-floor");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "zero-floor", formattedCount: "0" });
    updateShortsVoteState("zero-floor", { pressed: true });
    storedData.previousState = DISLIKED_STATE;

    addLikeDislikeEventListener();
    document.querySelector("[data-ryd-shorts-dislike-button]").click();

    expect(storedData.dislikes).toBe(0);
    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("0");
  });

  it("applies an early owned vote to the arriving API count", async () => {
    window.history.replaceState(null, "", "/shorts/early-owned");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "early-owned" });
    initializeShortsStateForActiveVideo("early-owned");
    addLikeDislikeEventListener();

    let resolveFetch;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const initialization = setInitialState();
    document.querySelector("[data-ryd-shorts-dislike-button]").click();
    resolveFetch({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    });
    await initialization;

    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("11");
    expect(storedData.dislikes).toBe(11);
  });

  it("preserves a pending vote through duplicate same-video initialization and out-of-order responses", async () => {
    const videoId = "duplicate-initialization";
    window.history.replaceState(null, "", `/shorts/${videoId}`);
    renderShorts();
    const control = ensureShortsDislikeControl({ videoId });
    initializeShortsStateForActiveVideo(videoId);

    const resolvers = [];
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const firstInitialization = setInitialState();
    addLikeDislikeEventListener();
    control.button.click();

    initializeShortsStateForActiveVideo(videoId);
    const secondInitialization = setInitialState();

    expect(control.button.getAttribute("aria-pressed")).toBe("true");
    expect(control.count.textContent).toBe("1");
    expect(storedData.dislikes).toBe(1);

    resolvers[1]({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    });
    await secondInitialization;
    resolvers[0]({
      ok: true,
      json: async () => ({ dislikes: 7, likes: 20 }),
    });
    await firstInitialization;

    expect(control.count.textContent).toBe("11");
    expect(storedData.dislikes).toBe(11);
  });

  it("starts a fresh Shorts baseline after visiting regular watch for the same video", async () => {
    const videoId = "shorts-watch-shorts";
    window.history.replaceState(null, "", `/shorts/${videoId}`);
    renderShorts();
    const firstControl = ensureShortsDislikeControl({ videoId, formattedCount: "0" });
    initializeShortsStateForActiveVideo(videoId);
    addLikeDislikeEventListener();
    firstControl.button.click();

    expect(storedData.dislikes).toBe(1);
    expect(firstControl.root.dataset.rydPendingVoteDelta).toBe("1");

    window.history.replaceState(null, "", `/watch?v=${videoId}`);
    renderRegularVideo();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ dislikes: 40, likes: 80 }),
    }));

    await setInitialState();

    expect(storedData.dislikes).toBe(40);

    window.history.replaceState(null, "", `/shorts/${videoId}`);
    renderShorts();
    const revisitedControl = ensureShortsDislikeControl({ videoId });
    initializeShortsStateForActiveVideo(videoId);

    expect(revisitedControl.button.getAttribute("aria-pressed")).toBe("true");
    expect(revisitedControl.count.textContent).toBe("0");
    expect(revisitedControl.root.dataset.rydPendingVoteDelta).toBe("0");
    expect(storedData.dislikes).toBe(0);
  });

  it("ignores an API response for a Short that is no longer active", async () => {
    window.history.replaceState(null, "", "/shorts/first-short");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "first-short" });
    initializeShortsStateForActiveVideo("first-short");

    let resolveFetch;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const initialization = setInitialState();

    window.history.replaceState(null, "", "/shorts/second-short");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "second-short" });
    initializeShortsStateForActiveVideo("second-short");
    resolveFetch({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    });
    await initialization;

    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("0");
    expect(storedData.dislikes).toBe(0);
  });

  it("keeps the current A vote when an earlier A request resolves after A to B to A navigation", async () => {
    window.history.replaceState(null, "", "/shorts/revisited-short");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "revisited-short" });
    initializeShortsStateForActiveVideo("revisited-short");

    const resolvers = [];
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const firstInitialization = setInitialState();

    window.history.replaceState(null, "", "/shorts/intermediate-short");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "intermediate-short" });
    initializeShortsStateForActiveVideo("intermediate-short");

    window.history.replaceState(null, "", "/shorts/revisited-short");
    renderShorts();
    ensureShortsDislikeControl({ videoId: "revisited-short" });
    initializeShortsStateForActiveVideo("revisited-short");
    addLikeDislikeEventListener();
    const secondInitialization = setInitialState();
    document.querySelector("[data-ryd-shorts-dislike-button]").click();

    resolvers[0]({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    });
    await firstInitialization;
    resolvers[1]({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    });
    await secondInitialization;

    expect(document.querySelector("[data-ryd-shorts-dislike-count]").textContent).toBe("11");
    expect(storedData.dislikes).toBe(11);
  });

  it("keeps the owned control label synchronized with API or error count text", () => {
    window.history.replaceState(null, "", "/shorts/gNfVr0WAdCU");
    renderShorts();
    const control = ensureShortsDislikeControl({ videoId: "gNfVr0WAdCU", formattedCount: "4" });

    setDislikes("7");

    expect(control.count.textContent).toBe("7");
    expect(control.button.getAttribute("aria-label")).toContain("7");
  });

  it("applies a regular-video API response without a Shorts generation", async () => {
    window.history.replaceState(null, "", "/watch?v=regular-video");
    renderRegularVideo();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ dislikes: 10, likes: 20 }),
    }));

    await setInitialState();

    expect(storedData.dislikes).toBe(10);
  });

  it("keeps the native regular-video touchstart listener", () => {
    window.history.replaceState(null, "", "/watch?v=regular-video");
    renderRegularVideo();
    const nativeDislikeButton = document.querySelector("dislike-button-view-model");
    const addEventListener = jest.spyOn(nativeDislikeButton, "addEventListener");

    addLikeDislikeEventListener();

    expect(addEventListener).toHaveBeenCalledWith("touchstart", expect.any(Function));
  });
});
