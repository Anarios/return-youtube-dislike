const { AttributedRuntimeTrafficLedger, attributeRuntimeRequest } = require("../e2e/live/live-youtube-driver");

const SELECTED_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const EXPECTED_BUILD_ID = "0123456789abcdef0123456789abcdef";

function createEventContext(pages = []) {
  const listeners = new Map();
  return {
    context: {
      off: jest.fn((event, listener) => listeners.get(event)?.delete(listener)),
      on: jest.fn((event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      }),
      pages: jest.fn(() => pages),
    },
    emit(event, value) {
      listeners.get(event)?.forEach((listener) => listener(value));
    },
    listeners,
  };
}

function pageRequest(page, { method, pathname, videoId }) {
  return {
    frame: () => ({ page: () => page }),
    method: () => method,
    postDataJSON: () => ({ userId: "A".repeat(36), value: -1, videoId }),
    url: () => `https://returnyoutubedislikeapi.com${pathname}${pathname === "/votes" ? `?videoId=${videoId}` : ""}`,
  };
}

async function advanceFakeTime(milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 25) {
    jest.advanceTimersByTime(Math.min(25, milliseconds - elapsed));
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe("run-wide attributed runtime traffic ledger", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    ["late vote-data GET", { method: "GET", pathname: "/votes" }],
    ["late interaction POST", { method: "POST", pathname: "/interact/vote" }],
  ])("rejects a %s emitted after the stage listener detached", async (_label, requestOptions) => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    const page = {};
    const harness = createEventContext([page]);
    const ledger = new AttributedRuntimeTrafficLedger(harness.context, page, (request) =>
      attributeRuntimeRequest(request, page, "userscript"),
    );
    const detachedStageListener = jest.fn();
    harness.context.on("request", detachedStageListener);
    harness.context.off("request", detachedStageListener);
    const request = pageRequest(page, { ...requestOptions, videoId: "abcdefghijk" });

    const audit = ledger.assertNoUnclaimed({ label: "detached stage", quietMs: 100, timeoutMs: 500 });
    const rejection = expect(audit).rejects.toThrow(/escaped every active audit/);
    setTimeout(() => harness.emit("request", request), 50);
    await advanceFakeTime(250);
    await rejection;

    expect(detachedStageListener).not.toHaveBeenCalled();
    expect(ledger.records).toEqual([
      expect.objectContaining({
        method: requestOptions.method,
        pathname: requestOptions.pathname,
        videoId: "abcdefghijk",
      }),
    ]);
    ledger.stop();
  });

  test("accepts delayed traffic only when an active stage claims that exact request", async () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    const page = {};
    const harness = createEventContext([page]);
    const ledger = new AttributedRuntimeTrafficLedger(harness.context, page, (request) =>
      attributeRuntimeRequest(request, page, "userscript"),
    );
    const request = pageRequest(page, { method: "GET", pathname: "/votes", videoId: "abcdefghijk" });
    harness.context.on("request", (candidate) => ledger.claim(candidate, "exact-votes-stage"));

    const audit = ledger.assertNoUnclaimed({ label: "claimed stage", quietMs: 100, timeoutMs: 500 });
    setTimeout(() => harness.emit("request", request), 50);
    await advanceFakeTime(250);

    await expect(audit).resolves.toEqual({ attributedRequests: 1, label: "claimed stage" });
    ledger.stop();
  });

  test("retains same-video other-tab ambiguity from request time after that tab navigates away", async () => {
    const page = { url: () => "https://www.youtube.com/watch?v=abcdefghijk" };
    let otherUrl = "https://www.youtube.com/shorts/abcdefghijk";
    const otherPage = { url: () => otherUrl };
    const harness = createEventContext([page, otherPage]);
    const ledger = new AttributedRuntimeTrafficLedger(harness.context, page, (request) =>
      attributeRuntimeRequest(request, page, "extension", SELECTED_EXTENSION_ID, EXPECTED_BUILD_ID),
    );
    const request = {
      frame: () => {
        throw new Error("Service Worker requests do not have a frame");
      },
      method: () => "GET",
      serviceWorker: () => ({ url: () => `chrome-extension://${SELECTED_EXTENSION_ID}/ryd.background.js` }),
      url: () => "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
    };

    harness.emit("request", request);
    expect(ledger.claim(request, "exact-votes-stage")).toBe(true);
    otherUrl = "https://www.youtube.com/watch?v=lmnopqrstuv";

    await expect(ledger.assertNoUnclaimed({ quietMs: 0 })).rejects.toThrow(/same video open at send time/);
    ledger.stop();
  });
});
