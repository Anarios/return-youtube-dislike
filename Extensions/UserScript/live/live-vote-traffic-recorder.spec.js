const { assertLogicalVoteHandshake } = require("../e2e/live/live-youtube-driver");

const VIDEO_ID = "abcdefghijk";
const USER_ID = "A".repeat(36);
const SOLUTION = Buffer.alloc(4).toString("base64");

function vote({ status = 200, userId = USER_ID, value = 1, videoId = VIDEO_ID } = {}) {
  return {
    body: { userId, value, videoId },
    pathname: "/interact/vote",
    responseError: null,
    status,
  };
}

function confirmation({ confirmed = true, status = 200, userId = USER_ID, videoId = VIDEO_ID } = {}) {
  return {
    body: { solution: SOLUTION, userId, videoId },
    pathname: "/interact/confirmVote",
    responseBody: confirmed,
    responseError: null,
    status,
  };
}

describe("live logical vote handshake validation", () => {
  test("accepts one vote puzzle followed by one true confirmation", () => {
    expect(assertLogicalVoteHandshake([vote(), confirmation()], VIDEO_ID, 1)).toBe(USER_ID);
  });

  test("accepts two matching vote puzzle requests followed by one true confirmation", () => {
    expect(assertLogicalVoteHandshake([vote(), vote(), confirmation()], VIDEO_ID, 1)).toBe(USER_ID);
  });

  test("accepts three matching vote puzzle requests followed by one true confirmation", () => {
    expect(assertLogicalVoteHandshake([vote(), vote(), vote(), confirmation()], VIDEO_ID, 1)).toBe(USER_ID);
  });

  test("rejects a fourth vote puzzle request", () => {
    expect(() => assertLogicalVoteHandshake([vote(), vote(), vote(), vote(), confirmation()], VIDEO_ID, 1)).toThrow(
      /one to three vote puzzle requests/,
    );
  });

  test.each([
    ["user", [vote(), vote({ userId: "B".repeat(36) }), confirmation()], /different user IDs/],
    ["video", [vote(), vote({ videoId: "lmnopqrstuv" }), confirmation()], /different video/],
    ["value", [vote(), vote({ value: 0 }), confirmation()], /changed the requested vote value/],
  ])("rejects a retry with a mismatched %s", (_field, records, message) => {
    expect(() => assertLogicalVoteHandshake(records, VIDEO_ID, 1)).toThrow(message);
  });

  test("rejects a complete handshake that targets the stale origin video", () => {
    const staleVideoId = "lmnopqrstuv";
    expect(() =>
      assertLogicalVoteHandshake(
        [vote({ videoId: staleVideoId }), confirmation({ videoId: staleVideoId })],
        VIDEO_ID,
        1,
      ),
    ).toThrow(/targeted a different video/);
  });

  test.each([
    ["extra confirmation", [vote(), confirmation(), confirmation()]],
    ["other interaction", [vote(), { ...vote(), pathname: "/interact/other" }, confirmation()]],
    ["traffic after confirmation", [vote(), confirmation(), vote()]],
  ])("rejects %s traffic", (_case, records) => {
    expect(() => assertLogicalVoteHandshake(records, VIDEO_ID, 1)).toThrow(
      /exactly one confirmation|logical vote may/i,
    );
  });

  test("rejects a false confirmation", () => {
    expect(() => assertLogicalVoteHandshake([vote(), confirmation({ confirmed: false })], VIDEO_ID, 1)).toThrow(
      /did not confirm the vote/,
    );
  });

  test.each([
    ["short user ID", [vote({ userId: "short" }), confirmation({ userId: "short" })], /36-character/],
    [
      "extra vote body key",
      [{ ...vote(), body: { ...vote().body, extra: true } }, confirmation()],
      /exactly userId, value, and videoId/,
    ],
    [
      "extra confirmation body key",
      [vote(), { ...confirmation(), body: { ...confirmation().body, extra: true } }],
      /exactly solution, userId, and videoId/,
    ],
    [
      "non-four-byte proof",
      [vote(), { ...confirmation(), body: { ...confirmation().body, solution: "AA==" } }],
      /four-byte proof/,
    ],
  ])("rejects a handshake with a %s", (_label, records, message) => {
    expect(() => assertLogicalVoteHandshake(records, VIDEO_ID, 1)).toThrow(message);
  });

  test("rejects a failed vote or confirmation response", () => {
    expect(() => assertLogicalVoteHandshake([vote({ status: 500 }), confirmation()], VIDEO_ID, 1)).toThrow(
      /Vote request failed with HTTP 500/,
    );
    expect(() => assertLogicalVoteHandshake([vote(), confirmation({ status: 500 })], VIDEO_ID, 1)).toThrow(
      /Vote confirmation failed with HTTP 500/,
    );
  });
});
