/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("../utils", () => ({
  getVideoId: jest.fn(),
  localize: jest.fn(),
}));

jest.mock("../vote-data-request", () => ({
  requestVoteData: jest.fn(),
}));

import { getVideoId, localize } from "../utils";
import { requestVoteData } from "../vote-data-request";
import { analyticsState } from "./state";
import { loadRawCounts, resetRawCounts, renderRawCounts } from "./rawCounts";

const VIDEO_A = "abcdefghijk";
const VIDEO_B = "zyxwvutsrqp";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function navigate(videoId) {
  analyticsState.currentVideoId = videoId;
  window.history.replaceState({}, "", `/watch?v=${videoId}`);
}

function mountPanel() {
  document.body.innerHTML = `
    <section>
      <span id="ryd-analytics-raw-likes"></span>
      <span id="ryd-analytics-raw-dislikes"></span>
      <span id="ryd-analytics-raw-status"></span>
    </section>
  `;
  analyticsState.panelElement = document.querySelector("section");
}

function readCounts() {
  return {
    likes: document.querySelector("#ryd-analytics-raw-likes").textContent,
    dislikes: document.querySelector("#ryd-analytics-raw-dislikes").textContent,
    status: document.querySelector("#ryd-analytics-raw-status").textContent,
  };
}

describe("premiumAnalytics.rawCounts", () => {
  beforeEach(() => {
    analyticsState.panelElement = null;
    resetRawCounts();
    navigate(VIDEO_A);
    mountPanel();
    getVideoId.mockImplementation((url) => new URL(url).searchParams.get("v"));
    localize.mockImplementation(
      (key) =>
        ({ premiumTeaser_statusLoading: "Loading raw counts", premiumTeaser_statusError: "Counts unavailable" })[key],
    );
  });

  afterEach(() => {
    resetRawCounts();
    analyticsState.panelElement = null;
    analyticsState.currentVideoId = null;
    document.body.innerHTML = "";
  });

  it("renders public raw counts, preserving zero and ignoring selected-period totals", async () => {
    const response = deferred();
    requestVoteData.mockReturnValue(response.promise);

    const loading = loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "Loading raw counts" });

    response.resolve({ rawLikes: 1200, rawDislikes: 0, likes: 9999, dislikes: 999, summary: { totalLikes: 18 } });
    await loading;

    expect(requestVoteData).toHaveBeenCalledWith(VIDEO_A);
    expect(readCounts()).toEqual({ likes: (1200).toLocaleString(), dislikes: "0", status: "" });
  });

  it("uses existing aggregate fields when raw fields are absent", async () => {
    requestVoteData.mockResolvedValue({ rawLikes: null, likes: 42, dislikes: 3 });
    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "42", dislikes: "3", status: "" });
  });

  it.each([undefined, null, NaN, Infinity, -1, "17"])("shows placeholders for invalid count %p", async (value) => {
    requestVoteData.mockResolvedValue({ rawLikes: value, rawDislikes: value });
    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });
  });

  it("shares a pending request for the same video", async () => {
    const response = deferred();
    requestVoteData.mockReturnValue(response.promise);
    const first = loadRawCounts(VIDEO_A);
    const second = loadRawCounts(VIDEO_A);
    expect(requestVoteData).toHaveBeenCalledTimes(1);

    response.resolve({ rawLikes: 10, rawDislikes: 2 });
    await Promise.all([first, second]);
    expect(readCounts()).toEqual({ likes: "10", dislikes: "2", status: "" });
  });

  it("retains loaded data for panel reinsertion without another request", async () => {
    analyticsState.panelElement = null;
    document.body.innerHTML = "";
    requestVoteData.mockResolvedValue({ rawLikes: 12, rawDislikes: 3 });
    await loadRawCounts(VIDEO_A);

    mountPanel();
    renderRawCounts();
    expect(readCounts()).toEqual({ likes: "12", dislikes: "3", status: "" });

    await loadRawCounts(VIDEO_A);
    expect(requestVoteData).toHaveBeenCalledTimes(1);
  });

  it.each(["url", "state"])("does not start an outgoing-video request when %s has changed", async (changed) => {
    if (changed === "url") window.history.replaceState({}, "", `/watch?v=${VIDEO_B}`);
    else analyticsState.currentVideoId = VIDEO_B;

    await loadRawCounts(VIDEO_A);
    expect(requestVoteData).not.toHaveBeenCalled();
  });

  it("does not start requests for invalid videos or an unreadable URL", async () => {
    analyticsState.currentVideoId = "invalid";
    await loadRawCounts("invalid");
    navigate(VIDEO_A);
    getVideoId.mockImplementation(() => {
      throw new Error("Video unavailable");
    });
    await loadRawCounts(VIDEO_A);
    expect(requestVoteData).not.toHaveBeenCalled();
  });

  it("ignores obsolete responses when navigation returns to the original video", async () => {
    const oldA = deferred();
    const responseB = deferred();
    const newA = deferred();
    requestVoteData
      .mockReturnValueOnce(oldA.promise)
      .mockReturnValueOnce(responseB.promise)
      .mockReturnValueOnce(newA.promise);

    const first = loadRawCounts(VIDEO_A);
    navigate(VIDEO_B);
    const second = loadRawCounts(VIDEO_B);
    navigate(VIDEO_A);
    const third = loadRawCounts(VIDEO_A);

    oldA.resolve({ rawLikes: 1, rawDislikes: 1 });
    responseB.reject(new Error("Old request failed"));
    await Promise.all([first, second]);
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "Loading raw counts" });

    newA.resolve({ rawLikes: 30, rawDislikes: 4 });
    await third;
    expect(readCounts()).toEqual({ likes: "30", dislikes: "4", status: "" });
    expect(requestVoteData.mock.calls.map(([videoId]) => videoId)).toEqual([VIDEO_A, VIDEO_B, VIDEO_A]);
  });

  it("clears cached counts on reset and ignores a pending result after teardown", async () => {
    const response = deferred();
    requestVoteData.mockReturnValue(response.promise);
    const loading = loadRawCounts(VIDEO_A);
    resetRawCounts();
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });

    analyticsState.panelElement = null;
    document.body.innerHTML = "";
    response.resolve({ rawLikes: 99, rawDislikes: 3 });
    await loading;
    mountPanel();
    renderRawCounts();
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });
  });

  it("does not reuse an invalidated pending request for the same video", async () => {
    const oldResponse = deferred();
    const newResponse = deferred();
    requestVoteData.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const oldLoading = loadRawCounts(VIDEO_A);
    resetRawCounts();
    const newLoading = loadRawCounts(VIDEO_A);

    oldResponse.reject(new Error("Discarded"));
    await oldLoading;
    expect(readCounts().status).toBe("Loading raw counts");
    newResponse.resolve({ rawLikes: 6, rawDislikes: 1 });
    await newLoading;
    expect(readCounts()).toEqual({ likes: "6", dislikes: "1", status: "" });
    expect(requestVoteData).toHaveBeenCalledTimes(2);
  });

  it("discards a response after the URL changes before the navigation handler runs", async () => {
    const response = deferred();
    requestVoteData.mockReturnValueOnce(response.promise).mockResolvedValueOnce({ rawLikes: 7, rawDislikes: 2 });
    const loading = loadRawCounts(VIDEO_A);
    window.history.replaceState({}, "", `/watch?v=${VIDEO_B}`);
    response.resolve({ rawLikes: 99, rawDislikes: 3 });
    await loading;
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });

    navigate(VIDEO_A);
    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "7", dislikes: "2", status: "" });
    expect(requestVoteData).toHaveBeenCalledTimes(2);
  });

  it("does not render cached counts for another current video", async () => {
    requestVoteData.mockResolvedValue({ rawLikes: 99, rawDislikes: 3 });
    await loadRawCounts(VIDEO_A);
    navigate(VIDEO_B);
    renderRawCounts();
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });
  });

  it.each([false, true])("renders request failures and allows retry (synchronous throw: %p)", async (synchronous) => {
    if (synchronous) {
      requestVoteData.mockImplementationOnce(() => {
        throw new Error("Unavailable");
      });
    } else requestVoteData.mockRejectedValueOnce(new Error("Unavailable"));

    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "Counts unavailable" });

    requestVoteData.mockResolvedValueOnce({ rawLikes: 8, rawDislikes: 0 });
    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "8", dislikes: "0", status: "" });
  });

  it("does not display a request cancellation as an error", async () => {
    requestVoteData.mockRejectedValueOnce(new DOMException("Navigation", "AbortError"));
    await loadRawCounts(VIDEO_A);
    expect(readCounts()).toEqual({ likes: "—", dislikes: "—", status: "" });
  });
});
