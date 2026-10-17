const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

const LIKE_ACTION = "like";
const DISLIKE_ACTION = "dislike";

const TRANSITIONS = {
  [NEUTRAL_STATE]: {
    [LIKE_ACTION]: { nextState: LIKED_STATE, value: 1, likesDelta: 1, dislikesDelta: 0 },
    [DISLIKE_ACTION]: { nextState: DISLIKED_STATE, value: -1, likesDelta: 0, dislikesDelta: 1 },
  },
  [LIKED_STATE]: {
    [LIKE_ACTION]: { nextState: NEUTRAL_STATE, value: 0, likesDelta: -1, dislikesDelta: 0 },
    [DISLIKE_ACTION]: { nextState: DISLIKED_STATE, value: -1, likesDelta: -1, dislikesDelta: 1 },
  },
  [DISLIKED_STATE]: {
    [LIKE_ACTION]: { nextState: LIKED_STATE, value: 1, likesDelta: 1, dislikesDelta: -1 },
    [DISLIKE_ACTION]: { nextState: NEUTRAL_STATE, value: 0, likesDelta: 0, dislikesDelta: -1 },
  },
};

function resolveVoteTransition(previousState, action) {
  const transition = TRANSITIONS[previousState]?.[action];
  if (!transition) {
    throw new TypeError(`Unsupported vote transition: ${previousState} -> ${action}`);
  }
  return { ...transition };
}

function applyVoteTransitionCounts(likes, dislikes, transition) {
  if (!transition || !Number.isFinite(transition.likesDelta) || !Number.isFinite(transition.dislikesDelta)) {
    throw new TypeError("A valid vote transition is required");
  }

  const normalizedLikes = Number.isFinite(likes) ? likes : 0;
  const normalizedDislikes = Number.isFinite(dislikes) ? dislikes : 0;
  return {
    likes: Math.max(0, normalizedLikes + transition.likesDelta),
    dislikes: Math.max(0, normalizedDislikes + transition.dislikesDelta),
  };
}

function shouldSubmitVote({ disableVoteSubmission = false, signedOut = false } = {}) {
  return disableVoteSubmission !== true && signedOut !== true;
}

module.exports = {
  DISLIKED_STATE,
  DISLIKE_ACTION,
  LIKED_STATE,
  LIKE_ACTION,
  NEUTRAL_STATE,
  applyVoteTransitionCounts,
  resolveVoteTransition,
  shouldSubmitVote,
};
