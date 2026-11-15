import { consentApi } from "./core-data-consent";

const VOTE_SUBMISSION_INTENT_MESSAGE = "ryd_vote_switch_on_grant";
const VOTE_SUBMISSION_INTENT_TTL_MS = 120000;

function createVoteSubmissionIntent({ hasVotingPermission, allowVoteSubmission, now = () => Date.now() }) {
  let intent = null;

  function isFresh(value) {
    return now() - value.rememberedAt <= VOTE_SUBMISSION_INTENT_TTL_MS;
  }

  function remember() {
    intent = { rememberedAt: now() };
  }

  function clear() {
    intent = null;
  }

  async function applyOnGrant() {
    const current = intent;
    if (!current) return false;
    if (!isFresh(current)) {
      clear();
      return false;
    }
    const granted = await hasVotingPermission();
    if (!granted || intent !== current || !isFresh(current)) return false;
    clear();
    allowVoteSubmission();
    return true;
  }

  return { applyOnGrant, clear, remember };
}

function sendVoteSubmissionIntent(request) {
  consentApi()
    .runtime.sendMessage(request)
    ?.catch?.(() => {});
}

function rememberVoteSubmissionIntent() {
  sendVoteSubmissionIntent({ message: VOTE_SUBMISSION_INTENT_MESSAGE });
}

function withdrawVoteSubmissionIntent() {
  sendVoteSubmissionIntent({ message: VOTE_SUBMISSION_INTENT_MESSAGE, withdraw: true });
}

export {
  VOTE_SUBMISSION_INTENT_MESSAGE,
  VOTE_SUBMISSION_INTENT_TTL_MS,
  createVoteSubmissionIntent,
  rememberVoteSubmissionIntent,
  withdrawVoteSubmissionIntent,
};
