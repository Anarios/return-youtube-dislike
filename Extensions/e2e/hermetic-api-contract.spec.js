const { assertExactSuccessfulVotesTraffic } = require("./hermetic-api-contract");

const VIDEO_A = "abcdefghijk";
const VIDEO_B = "zyxwvutsrqp";

function votes(videoId, overrides = {}) {
  return {
    method: "GET",
    pathname: "/votes",
    query: { videoId },
    respondedAt: 123,
    responseStatus: 200,
    ...overrides,
  };
}

test("accepts the exact ordered successful /votes sequence", () => {
  const records = [
    { method: "GET", pathname: "/configs/selectors", responseStatus: 200 },
    votes(VIDEO_A),
    votes(VIDEO_B),
  ];

  expect(assertExactSuccessfulVotesTraffic(records, [VIDEO_A, VIDEO_B])).toEqual(records.slice(1));
});

test.each([
  ["missing request", [votes(VIDEO_A)], /missing, duplicate, or stale/],
  ["duplicate request", [votes(VIDEO_A), votes(VIDEO_B), votes(VIDEO_B)], /missing, duplicate, or stale/],
  ["stale video ID", [votes(VIDEO_A), votes("stalevid001")], /missing, duplicate, or stale/],
  ["non-200 response", [votes(VIDEO_A), votes(VIDEO_B, { responseStatus: 204 })], /did not receive HTTP 200/],
  ["unfinished response", [votes(VIDEO_A), votes(VIDEO_B, { respondedAt: undefined })], /did not finish/],
])("rejects a %s", (_label, records, expectedError) => {
  expect(() => assertExactSuccessfulVotesTraffic(records, [VIDEO_A, VIDEO_B], "Shared runtime")).toThrow(expectedError);
});
