jest.mock("./config", () => ({
  getApiEndpoint: (pathname) => `https://api.test${pathname}`,
}));

import {
  cancelObsoleteVoteDataRequests,
  clearVoteDataRequestCache,
  createVoteDataAcceptHeader,
  normalizeLikeCount,
  requestVoteData,
} from "./vote-data-request";

const VIDEO_A = "abcdefghijk";
const VIDEO_B = "zyxwvutsrqp";
const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const BUILD_ID = "0123456789abcdef0123456789abcdef";

function response(payload = { dislikes: 12, likes: 34 }) {
  return {
    json: jest.fn(async () => payload),
    ok: true,
    status: 200,
  };
}

beforeEach(() => {
  clearVoteDataRequestCache();
  global.fetch = jest.fn().mockResolvedValue(response());
});

afterAll(() => {
  delete global.fetch;
});

test.each([
  [null, null],
  [undefined, null],
  [false, null],
  ["", null],
  ["not-a-number", null],
  [-1, null],
  [1.5, null],
  [0, "0"],
  [35, "35"],
  ["35", "35"],
])("normalizes the Like count %p to %p", (input, expected) => {
  expect(normalizeLikeCount(input)).toBe(expected);
});

describe("live-build request fingerprint", () => {
  test("keeps the ordinary production Accept header outside a live-test build", () => {
    expect(
      createVoteDataAcceptHeader({
        buildId: BUILD_ID,
        extensionId: EXTENSION_ID,
        isLiveTestBuild: false,
      }),
    ).toBe("application/json");
  });

  test("creates the exact CORS-safelisted live extension and build fingerprint", () => {
    const header = createVoteDataAcceptHeader({
      buildId: BUILD_ID,
      extensionId: EXTENSION_ID,
      isLiveTestBuild: true,
    });

    expect(header).toBe(`application/json, application/vnd.ryd-live+json; id=${EXTENSION_ID}; build=${BUILD_ID}`);
    expect(header.length).toBeLessThanOrEqual(128);
  });

  test.each([
    ["extension ID", { buildId: BUILD_ID, extensionId: "wrong", isLiveTestBuild: true }],
    ["build ID", { buildId: "wrong", extensionId: EXTENSION_ID, isLiveTestBuild: true }],
  ])("refuses a malformed live %s", (_label, options) => {
    expect(() => createVoteDataAcceptHeader(options)).toThrow(/requires a valid/);
  });
});

test("coalesces concurrent and completed requests without a Like count", async () => {
  const first = requestVoteData(VIDEO_A);
  const concurrent = requestVoteData(VIDEO_A, { likeCount: false });

  expect(first).toBe(concurrent);
  await expect(first).resolves.toEqual({ dislikes: 12, likes: 34 });

  const completed = requestVoteData(VIDEO_A, { likeCount: null });
  expect(completed).toBe(first);
  await completed;

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`https://api.test/votes?videoId=${VIDEO_A}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: expect.any(AbortSignal),
  });
});

test("does not suppress the richer refresh when a real Like count becomes available", async () => {
  const withoutLikeCount = requestVoteData(VIDEO_A);
  await withoutLikeCount;

  fetch.mockResolvedValueOnce(response({ dislikes: 13, likes: 35 }));
  const withLikeCount = requestVoteData(VIDEO_A, { likeCount: 35 });

  expect(withLikeCount).not.toBe(withoutLikeCount);
  await expect(withLikeCount).resolves.toEqual({ dislikes: 13, likes: 35 });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith(`https://api.test/votes?videoId=${VIDEO_A}&likeCount=35`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: expect.any(AbortSignal),
  });

  expect(requestVoteData(VIDEO_A, { likeCount: 35 })).toBe(withLikeCount);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("lets a count-only consumer reuse an in-flight request carrying a real Like count", async () => {
  const withLikeCount = requestVoteData(VIDEO_A, { likeCount: 35 });
  const aggregateOnly = requestVoteData(VIDEO_A);

  expect(aggregateOnly).toBe(withLikeCount);
  await aggregateOnly;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`https://api.test/votes?videoId=${VIDEO_A}&likeCount=35`, expect.any(Object));
});

test("starts a fresh request for a new navigation and does not reuse an older visit", async () => {
  await requestVoteData(VIDEO_A);
  await requestVoteData(VIDEO_B);
  await requestVoteData(VIDEO_A);

  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    `https://api.test/votes?videoId=${VIDEO_A}`,
    `https://api.test/votes?videoId=${VIDEO_B}`,
    `https://api.test/votes?videoId=${VIDEO_A}`,
  ]);
});

test("cancels every pending request variant when navigation clears the cache", async () => {
  fetch.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
  );
  const aggregate = requestVoteData(VIDEO_A);
  const enriched = requestVoteData(VIDEO_A, { likeCount: 35 });
  const aggregateAborted = expect(aggregate).rejects.toMatchObject({ name: "AbortError" });
  const enrichedAborted = expect(enriched).rejects.toMatchObject({ name: "AbortError" });

  clearVoteDataRequestCache();

  await Promise.all([aggregateAborted, enrichedAborted]);
  expect(fetch.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("route observation preserves a pending request for the current video", async () => {
  let resolveResponse;
  fetch.mockReturnValueOnce(new Promise((resolve) => (resolveResponse = resolve)));
  const pending = requestVoteData(VIDEO_B);
  const signal = fetch.mock.calls[0][1].signal;

  cancelObsoleteVoteDataRequests(VIDEO_B);

  expect(signal.aborted).toBe(false);
  expect(requestVoteData(VIDEO_B)).toBe(pending);
  resolveResponse(response());
  await expect(pending).resolves.toEqual({ dislikes: 12, likes: 34 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(["resolve", "reject"])(
  "rejects a cancelled response body that later %ss without evicting the destination",
  async (settlement) => {
    let resolveBody;
    let rejectBody;
    const body = new Promise((resolve, reject) => {
      resolveBody = resolve;
      rejectBody = reject;
    });
    let notifyBodyRequested;
    const bodyRequested = new Promise((resolve) => (notifyBodyRequested = resolve));
    const outgoingResponse = {
      ok: true,
      status: 200,
      json: jest.fn(() => {
        notifyBodyRequested();
        return body;
      }),
    };
    fetch.mockResolvedValueOnce(outgoingResponse);
    const outgoing = requestVoteData(VIDEO_A);
    const aborted = expect(outgoing).rejects.toMatchObject({ name: "AbortError" });
    await bodyRequested;
    expect(outgoingResponse.json).toHaveBeenCalledTimes(1);

    cancelObsoleteVoteDataRequests(VIDEO_B);
    const destination = requestVoteData(VIDEO_B);
    await expect(destination).resolves.toEqual({ dislikes: 12, likes: 34 });
    if (settlement === "resolve") resolveBody({ dislikes: 999, likes: 1 });
    else rejectBody(new SyntaxError("Late invalid JSON"));

    await aborted;
    expect(requestVoteData(VIDEO_B)).toBe(destination);
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

test("a new video request cancels the previous scope even without an explicit cache clear", async () => {
  let resolveOutgoing;
  fetch.mockReturnValueOnce(new Promise((resolve) => (resolveOutgoing = resolve)));
  const outgoing = requestVoteData(VIDEO_A);
  const aborted = expect(outgoing).rejects.toMatchObject({ name: "AbortError" });
  const outgoingSignal = fetch.mock.calls[0][1].signal;

  await requestVoteData(VIDEO_B);
  expect(outgoingSignal.aborted).toBe(true);
  const revisited = requestVoteData(VIDEO_A);
  resolveOutgoing(response({ dislikes: 999, likes: 1 }));

  await aborted;
  await expect(revisited).resolves.toEqual({ dislikes: 12, likes: 34 });
  expect(requestVoteData(VIDEO_A)).toBe(revisited);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test.each([
  ["network failure", () => Promise.reject(new TypeError("offline"))],
  ["non-2xx response", () => Promise.resolve({ ok: false, status: 503 })],
  [
    "malformed JSON",
    () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("invalid JSON")),
      }),
  ],
])("evicts a failed %s so an explicit later request can retry", async (_name, failedResult) => {
  fetch.mockImplementationOnce(failedResult).mockResolvedValueOnce(response());

  await expect(requestVoteData(VIDEO_A)).rejects.toThrow();
  await expect(requestVoteData(VIDEO_A)).resolves.toEqual({ dislikes: 12, likes: 34 });

  expect(fetch).toHaveBeenCalledTimes(2);
});
