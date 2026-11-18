const USER_ID_PATTERN = /^[A-Za-z0-9]{36}$/;
const FOUR_BYTE_PROOF_PATTERN = /^[A-Za-z0-9+/]{6}==$/;
const CLIENT_VERSION_PATTERN = /^[0-9]{1,9}(?:\.[0-9]{1,9}){0,3}$/;
const CLIENT_KINDS = new Set(["chromium", "firefox", "safari", "userscript"]);
const VOTE_BODY_KEYS = ["clientKind", "clientVersion", "userId", "value", "videoId"];

function hasExactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",")
  );
}

function isFourByteProofSolution(value) {
  if (typeof value !== "string" || !FOUR_BYTE_PROOF_PATTERN.test(value)) return false;
  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.length === 4 && bytes.toString("base64") === value;
  } catch {
    return false;
  }
}

function isPlaybackPosition(value) {
  return value === undefined || (Number.isInteger(value) && value >= 0 && value < 2_147_483_647);
}

function isVoteBodyShapeValid(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false;
  const { playbackPosition, ...required } = body;
  return (
    hasExactKeys(required, VOTE_BODY_KEYS) &&
    USER_ID_PATTERN.test(body.userId ?? "") &&
    CLIENT_VERSION_PATTERN.test(body.clientVersion ?? "") &&
    CLIENT_KINDS.has(body.clientKind) &&
    isPlaybackPosition(playbackPosition)
  );
}

function isVoteProtocolBodyPairValid(voteBody, confirmationBody, { value, videoId } = {}) {
  const userId = voteBody?.userId;
  return (
    isVoteBodyShapeValid(voteBody) &&
    voteBody.videoId === videoId &&
    voteBody.value === value &&
    hasExactKeys(confirmationBody, ["solution", "userId", "videoId"]) &&
    confirmationBody.userId === userId &&
    confirmationBody.videoId === videoId &&
    isFourByteProofSolution(confirmationBody.solution)
  );
}

module.exports = {
  CLIENT_VERSION_PATTERN,
  USER_ID_PATTERN,
  hasExactKeys,
  isFourByteProofSolution,
  isVoteBodyShapeValid,
  isVoteProtocolBodyPairValid,
};
