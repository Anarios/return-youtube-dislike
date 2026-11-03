import { shouldSubmitVote } from "../../common/vote-transition";

const DISABLE_VOTE_SUBMISSION_STORAGE_KEY = "disableVoteSubmission";

function readVoteSubmissionDisabled() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([DISABLE_VOTE_SUBMISSION_STORAGE_KEY], (values) =>
      resolve(values?.[DISABLE_VOTE_SUBMISSION_STORAGE_KEY] === true),
    );
  });
}

function allowVoteSubmission() {
  chrome.storage.sync.set({ [DISABLE_VOTE_SUBMISSION_STORAGE_KEY]: false });
}

function onVoteSubmissionSettingChanged(listener) {
  const changed = (changes, area) => {
    if (area === "sync" && changes[DISABLE_VOTE_SUBMISSION_STORAGE_KEY]) listener();
  };
  chrome.storage.onChanged.addListener(changed);
  return () => chrome.storage.onChanged.removeListener(changed);
}

function votesCounted({ granted, submissionDisabled }) {
  return granted && shouldSubmitVote({ disableVoteSubmission: submissionDisabled });
}

export { allowVoteSubmission, onVoteSubmissionSettingChanged, readVoteSubmissionDisabled, votesCounted };
