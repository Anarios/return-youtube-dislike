import {
  LIKED_STATE,
  DISLIKED_STATE,
  NEUTRAL_STATE,
  resolveVoteTransition,
  applyVoteTransitionCounts,
  shouldSubmitVote,
} from "./vote-transition";

describe("resolveVoteTransition", () => {
  it("keeps the state constants compatible with the existing extension state", () => {
    expect(LIKED_STATE).toBe("LIKED_STATE");
    expect(DISLIKED_STATE).toBe("DISLIKED_STATE");
    expect(NEUTRAL_STATE).toBe("NEUTRAL_STATE");
  });

  it.each([
    {
      description: "likes a neutral video",
      previousState: NEUTRAL_STATE,
      action: "like",
      expected: { nextState: LIKED_STATE, value: 1, likesDelta: 1, dislikesDelta: 0 },
    },
    {
      description: "removes an existing like",
      previousState: LIKED_STATE,
      action: "like",
      expected: { nextState: NEUTRAL_STATE, value: 0, likesDelta: -1, dislikesDelta: 0 },
    },
    {
      description: "changes a dislike to a like",
      previousState: DISLIKED_STATE,
      action: "like",
      expected: { nextState: LIKED_STATE, value: 1, likesDelta: 1, dislikesDelta: -1 },
    },
    {
      description: "dislikes a neutral video",
      previousState: NEUTRAL_STATE,
      action: "dislike",
      expected: { nextState: DISLIKED_STATE, value: -1, likesDelta: 0, dislikesDelta: 1 },
    },
    {
      description: "removes an existing dislike",
      previousState: DISLIKED_STATE,
      action: "dislike",
      expected: { nextState: NEUTRAL_STATE, value: 0, likesDelta: 0, dislikesDelta: -1 },
    },
    {
      description: "changes a like to a dislike",
      previousState: LIKED_STATE,
      action: "dislike",
      expected: { nextState: DISLIKED_STATE, value: -1, likesDelta: -1, dislikesDelta: 1 },
    },
  ])("$description", ({ previousState, action, expected }) => {
    expect(resolveVoteTransition(previousState, action)).toEqual(expected);
  });

  it.each([undefined, null, "", "UNKNOWN_STATE", 1])("rejects invalid previous state %p", (previousState) => {
    expect(() => resolveVoteTransition(previousState, "like")).toThrow(TypeError);
  });

  it.each([undefined, null, "", "LIKED_STATE", "upvote", 1])("rejects invalid action %p", (action) => {
    expect(() => resolveVoteTransition(NEUTRAL_STATE, action)).toThrow(TypeError);
  });
});

describe("applyVoteTransitionCounts", () => {
  it("applies a transition without mutating it", () => {
    const transition = resolveVoteTransition(NEUTRAL_STATE, "dislike");

    expect(applyVoteTransitionCounts(10, 4, transition)).toEqual({ likes: 10, dislikes: 5 });
    expect(transition).toEqual({ nextState: DISLIKED_STATE, value: -1, likesDelta: 0, dislikesDelta: 1 });
  });

  it.each([
    [LIKED_STATE, "like", 0, 5, { likes: 0, dislikes: 5 }],
    [DISLIKED_STATE, "dislike", 5, 0, { likes: 5, dislikes: 0 }],
    [LIKED_STATE, "dislike", 0, 0, { likes: 0, dislikes: 1 }],
    [DISLIKED_STATE, "like", 0, 0, { likes: 1, dislikes: 0 }],
  ])("never produces negative counts for %s -> %s", (state, action, likes, dislikes, expected) => {
    expect(applyVoteTransitionCounts(likes, dislikes, resolveVoteTransition(state, action))).toEqual(expected);
  });

  it("normalizes non-finite counts and rejects malformed transitions", () => {
    const transition = resolveVoteTransition(NEUTRAL_STATE, "like");
    expect(applyVoteTransitionCounts(Number.NaN, Infinity, transition)).toEqual({ likes: 1, dislikes: 0 });
    expect(() => applyVoteTransitionCounts(1, 1, null)).toThrow(TypeError);
  });
});

describe("shouldSubmitVote", () => {
  it.each([
    [{}, true],
    [{ disableVoteSubmission: false, signedOut: false }, true],
    [{ disableVoteSubmission: true, signedOut: false }, false],
    [{ disableVoteSubmission: false, signedOut: true }, false],
    [{ disableVoteSubmission: true, signedOut: true }, false],
  ])("gates submission for %p", (options, expected) => {
    expect(shouldSubmitVote(options)).toBe(expected);
  });
});
