import {
  createInitializationCycleRunner,
  createPendingNavigationTracker,
  pendingIncompleteShortsControlsCanInitialize,
  pendingNavigationControlsAreReady,
  reactionControlsCanInitialize,
} from "./initialization-cycle";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("queues a fresh initialization when navigation arrives during an in-flight cycle", async () => {
  const outgoing = deferred();
  const calls = [];
  const runner = createInitializationCycleRunner(async () => {
    calls.push(calls.length === 0 ? "A" : "B");
    if (calls.length === 1) await outgoing.promise;
  });

  const first = runner.request();
  const navigation = runner.request();

  expect(runner.isRunning()).toBe(true);
  expect(calls).toEqual(["A"]);

  outgoing.resolve();
  await Promise.all([first, navigation]);

  expect(calls).toEqual(["A", "B"]);
  expect(runner.isRunning()).toBe(false);
});

test("coalesces repeated navigation signals into one pending cycle", async () => {
  const outgoing = deferred();
  const runCycle = jest.fn(async () => {
    if (runCycle.mock.calls.length === 1) await outgoing.promise;
  });
  const runner = createInitializationCycleRunner(runCycle);

  const first = runner.request();
  const queued = [runner.request(), runner.request(), runner.request()];
  outgoing.resolve();
  await Promise.all([first, ...queued]);

  expect(runCycle).toHaveBeenCalledTimes(2);
});

test("continues accepting independent cycles after a queued rerun", async () => {
  const runner = createInitializationCycleRunner(jest.fn(async () => {}));

  await runner.request();
  await runner.request();

  expect(runner.isRunning()).toBe(false);
});

test("rejects invalid cycle callbacks", () => {
  expect(() => createInitializationCycleRunner()).toThrow(TypeError);
});

describe("pending navigation origin tracking", () => {
  test("preserves the first origin across repeated starts until initialization completes", () => {
    const tracker = createPendingNavigationTracker();
    const originA = { controls: { buttons: "A" }, videoId: "AAAAAAAAAAA" };
    const captureDestinationAsOrigin = jest.fn(() => ({ controls: { buttons: "B" }, videoId: "BBBBBBBBBBB" }));

    expect(tracker.begin(() => originA)).toBe(originA);
    expect(tracker.begin(captureDestinationAsOrigin)).toBe(originA);
    expect(tracker.get()).toBe(originA);
    expect(captureDestinationAsOrigin).not.toHaveBeenCalled();
  });

  test("captures a new origin after the completed navigation is cleared", () => {
    const tracker = createPendingNavigationTracker();
    const originA = { controls: null, videoId: "AAAAAAAAAAA" };
    const originB = { controls: null, videoId: "BBBBBBBBBBB" };

    tracker.begin(() => originA);
    tracker.clear();

    expect(tracker.get()).toBeNull();
    expect(tracker.begin(() => originB)).toBe(originB);
    expect(tracker.get()).toBe(originB);
  });

  test("rejects invalid first-origin capture without poisoning the tracker", () => {
    const tracker = createPendingNavigationTracker();

    expect(() => tracker.begin()).toThrow(TypeError);
    expect(() => tracker.begin(() => null)).toThrow(TypeError);
    expect(tracker.get()).toBeNull();
  });
});

function reactionControls() {
  const buttons = {};
  const likeButton = {};
  const dislikeButton = {};
  const nativeLikeButton = {};
  const nativeDislikeButton = {};
  return { buttons, dislikeButton, likeButton, nativeDislikeButton, nativeLikeButton };
}

describe("pending navigation control ownership", () => {
  test.each([
    ["no action surface yet", undefined],
    ["an ambiguous surface rejected by the read-only selector", null],
    ["a selected incomplete action surface", {}],
  ])("starts guarded initialization for a changed Shorts destination with %s", (_label, currentButtons) => {
    expect(
      pendingIncompleteShortsControlsCanInitialize({
        currentButtons,
        destinationVideoId: "BBBBBBBBBBB",
        isShortsRoute: true,
        previousVideoId: "AAAAAAAAAAA",
      }),
    ).toBe(true);
  });

  test.each([
    ["a Watch route", { destinationVideoId: "BBBBBBBBBBB", isShortsRoute: false, previousVideoId: "AAAAAAAAAAA" }],
    ["the same video", { destinationVideoId: "AAAAAAAAAAA", isShortsRoute: true, previousVideoId: "AAAAAAAAAAA" }],
    ["a missing destination", { destinationVideoId: null, isShortsRoute: true, previousVideoId: "AAAAAAAAAAA" }],
    ["a missing origin", { destinationVideoId: "BBBBBBBBBBB", isShortsRoute: true, previousVideoId: null }],
  ])("does not initialize incomplete controls for %s", (_label, options) => {
    expect(pendingIncompleteShortsControlsCanInitialize({ currentButtons: {}, ...options })).toBe(false);
  });

  test("accepts reused Shorts controls only after their canonical identity changes to the destination", () => {
    const reused = reactionControls();

    expect(
      pendingNavigationControlsAreReady({
        currentControls: reused,
        destinationVideoId: "BBBBBBBBBBB",
        previousControls: reused,
        shortsControlsVideoId: "BBBBBBBBBBB",
      }),
    ).toBe(true);
  });

  test.each(["AAAAAAAAAAA", null])(
    "does not bind reused outgoing Shorts controls when their identity is %p",
    (shortsControlsVideoId) => {
      const reused = reactionControls();

      expect(
        pendingNavigationControlsAreReady({
          currentControls: reused,
          destinationVideoId: "BBBBBBBBBBB",
          previousControls: reused,
          shortsControlsVideoId,
        }),
      ).toBe(false);
    },
  );

  test("accepts a replaced reaction-control tuple without Shorts ownership fallback", () => {
    const previousControls = reactionControls();
    const currentControls = { ...previousControls, dislikeButton: {} };

    expect(
      pendingNavigationControlsAreReady({
        currentControls,
        destinationVideoId: "BBBBBBBBBBB",
        previousControls,
      }),
    ).toBe(true);
  });
});

describe("reaction-control initialization readiness", () => {
  test("allows stable Shorts controls before the video element reports loaded", () => {
    expect(
      reactionControlsCanInitialize({
        hasRenderedButtons: true,
        isShortsRoute: true,
        isVideoLoaded: false,
      }),
    ).toBe(true);
  });

  test.each([
    ["an unloaded Watch video", { hasRenderedButtons: true, isShortsRoute: false, isVideoLoaded: false }],
    ["hidden Watch controls", { hasRenderedButtons: false, isShortsRoute: false, isVideoLoaded: true }],
  ])("rejects %s", (_label, options) => {
    expect(reactionControlsCanInitialize(options)).toBe(false);
  });
});
