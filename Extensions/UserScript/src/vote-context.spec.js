/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/"}
 */

jest.mock("../../common/vote-client", () => {
  const submitVote = jest.fn();
  return { createVoteClient: jest.fn(() => ({ ensureRegistered: async () => undefined, submitVote })) };
});
jest.mock("../../common/playback-position", () => ({ readPlaybackPosition: jest.fn() }));

const { readPlaybackPosition } = require("../../common/playback-position");
const { createVoteClient } = require("../../common/vote-client");
const originalFetch = globalThis.fetch;
let clientOptions;
let submitVote;
let submitVoteTransition;

beforeAll(() => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn();
  globalThis.__RYD_LIVE_TEST_BUILD__ = false;
  submitVoteTransition = require("./userscript-entry").__RewireAPI__.__get__("submitVoteTransition");
  clientOptions = createVoteClient.mock.calls[0][0];
  submitVote = createVoteClient.mock.results[0].value.submitVote;
  jest.clearAllTimers();
  jest.useRealTimers();
});

beforeEach(() => {
  submitVote.mockResolvedValue(true);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__RYD_LIVE_TEST_BUILD__;
});

test("identifies votes as coming from this userscript version", () => {
  expect(clientOptions.clientDetails).toEqual({
    clientVersion: require("../userscript-version.json"),
    clientKind: "userscript",
  });
});

test("sends the playback position read at the click with the vote", () => {
  readPlaybackPosition.mockReturnValueOnce(52);

  submitVoteTransition("abcdefghijk", { value: -1 }, false);

  expect(submitVote).toHaveBeenLastCalledWith("abcdefghijk", -1, { playbackPosition: 52 });
});

test("reads no position when a signed-out click is not submitted", () => {
  submitVoteTransition("abcdefghijk", { value: 1 }, true);

  expect(readPlaybackPosition).not.toHaveBeenCalled();
  expect(submitVote).not.toHaveBeenCalled();
});
