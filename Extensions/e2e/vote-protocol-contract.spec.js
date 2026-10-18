const { hasExactKeys, isFourByteProofSolution, isVoteProtocolBodyPairValid } = require("./vote-protocol-contract");

const USER_ID = "A".repeat(36);
const VIDEO_ID = "abcdefghijk";
const SOLUTION = Buffer.alloc(4).toString("base64");

function validBodies() {
  return {
    confirmation: { solution: SOLUTION, userId: USER_ID, videoId: VIDEO_ID },
    vote: { userId: USER_ID, value: -1, videoId: VIDEO_ID },
  };
}

test("accepts only the exact vote and four-byte confirmation protocol bodies", () => {
  const bodies = validBodies();
  expect(isVoteProtocolBodyPairValid(bodies.vote, bodies.confirmation, { value: -1, videoId: VIDEO_ID })).toBe(true);
});

test.each([
  ["short user ID", ({ vote }) => ({ ...vote, userId: "short" })],
  ["extra vote key", ({ vote }) => ({ ...vote, unexpected: true })],
  ["wrong video", ({ vote }) => ({ ...vote, videoId: "lmnopqrstuv" })],
  ["wrong value", ({ vote }) => ({ ...vote, value: 1 })],
])("rejects a vote body with a %s", (_label, changeVote) => {
  const bodies = validBodies();
  bodies.vote = changeVote(bodies);
  expect(isVoteProtocolBodyPairValid(bodies.vote, bodies.confirmation, { value: -1, videoId: VIDEO_ID })).toBe(false);
});

test.each([
  ["different user ID", ({ confirmation }) => ({ ...confirmation, userId: "B".repeat(36) })],
  ["extra confirmation key", ({ confirmation }) => ({ ...confirmation, unexpected: true })],
  ["wrong video", ({ confirmation }) => ({ ...confirmation, videoId: "lmnopqrstuv" })],
  ["short proof", ({ confirmation }) => ({ ...confirmation, solution: "AA==" })],
  ["non-canonical proof", ({ confirmation }) => ({ ...confirmation, solution: "AAAAAA==\n" })],
])("rejects a confirmation body with a %s", (_label, changeConfirmation) => {
  const bodies = validBodies();
  bodies.confirmation = changeConfirmation(bodies);
  expect(isVoteProtocolBodyPairValid(bodies.vote, bodies.confirmation, { value: -1, videoId: VIDEO_ID })).toBe(false);
});

test("exact-key and proof helpers fail closed", () => {
  expect(hasExactKeys({ a: 1, b: 2 }, ["b", "a"])).toBe(true);
  expect(hasExactKeys({ a: 1, b: 2, c: 3 }, ["a", "b"])).toBe(false);
  expect(isFourByteProofSolution(SOLUTION)).toBe(true);
  expect(isFourByteProofSolution("not-base64")).toBe(false);
});
