import { handleVoteMessage, readStoredVote } from "./voteState";

function createStorageArea() {
  const values = {};
  return {
    get: async (key) => ({ [key]: values[key] }),
    set: async (patch) => Object.assign(values, patch),
  };
}

describe("persisted RYD vote state", () => {
  it("acknowledges a vote only after storing it for the video", async () => {
    const storageArea = createStorageArea();
    const responses = [];
    const submittedVotes = [];

    const keepChannelOpen = handleVoteMessage(
      { message: "send_vote", videoId: "stored-short", vote: -1 },
      {
        storageArea,
        submitVote: (videoId, vote) => submittedVotes.push({ videoId, vote }),
      },
      (response) => responses.push(response),
    );

    expect(keepChannelOpen).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(await readStoredVote(storageArea, "stored-short")).toBe(-1);
    expect(submittedVotes).toEqual([{ videoId: "stored-short", vote: -1 }]);
    expect(responses).toEqual([{ accepted: true }]);
  });
});
