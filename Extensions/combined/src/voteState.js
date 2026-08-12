const VOTE_STORAGE_PREFIX = "ryd-video-vote:";

function getVoteStorageKey(videoId) {
  return `${VOTE_STORAGE_PREFIX}${videoId}`;
}

async function readStoredVote(storageArea, videoId) {
  const key = getVoteStorageKey(videoId);
  const values = await storageArea.get(key);
  return values?.[key] ?? 0;
}

async function persistStoredVote(storageArea, videoId, vote) {
  await storageArea.set({ [getVoteStorageKey(videoId)]: vote });
}

function handleVoteMessage(request, { storageArea, submitVote }, sendResponse) {
  persistStoredVote(storageArea, request.videoId, request.vote)
    .then(() => {
      try {
        const submission = submitVote(request.videoId, request.vote);
        if (submission && typeof submission.catch === "function") {
          submission.catch((error) => console.debug("RYD vote submission failed:", error?.message ?? error));
        }
      } catch (error) {
        console.debug("RYD vote submission failed:", error?.message ?? error);
      }
      sendResponse({ accepted: true });
    })
    .catch((error) => {
      console.debug("RYD vote persistence failed:", error?.message ?? error);
      sendResponse({ accepted: false });
    });

  return true;
}

export { handleVoteMessage, readStoredVote };
