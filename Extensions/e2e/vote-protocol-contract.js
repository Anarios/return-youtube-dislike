const USER_ID_PATTERN = /^[A-Za-z0-9]{36}$/;
const FOUR_BYTE_PROOF_PATTERN = /^[A-Za-z0-9+/]{6}==$/;

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

function isVoteProtocolBodyPairValid(voteBody, confirmationBody, { value, videoId } = {}) {
  const userId = voteBody?.userId;
  return (
    USER_ID_PATTERN.test(userId ?? "") &&
    hasExactKeys(voteBody, ["userId", "value", "videoId"]) &&
    voteBody.videoId === videoId &&
    voteBody.value === value &&
    hasExactKeys(confirmationBody, ["solution", "userId", "videoId"]) &&
    confirmationBody.userId === userId &&
    confirmationBody.videoId === videoId &&
    isFourByteProofSolution(confirmationBody.solution)
  );
}

module.exports = {
  USER_ID_PATTERN,
  hasExactKeys,
  isFourByteProofSolution,
  isVoteProtocolBodyPairValid,
};
