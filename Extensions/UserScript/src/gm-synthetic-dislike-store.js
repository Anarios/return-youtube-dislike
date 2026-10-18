const SYNTHETIC_DISLIKE_KEY_PREFIX = "rydSyntheticDislikedShort:";

// Each currently disliked Short owns one independent key. Deliberately do not
// evict selected videos: forgetting one would make the next click submit -1
// again instead of the required neutral (0) transition.

function hasModernMethod(name) {
  return typeof GM !== "undefined" && typeof GM?.[name] === "function";
}

async function getStoredValue(key, fallbackValue) {
  if (hasModernMethod("getValue")) {
    return GM.getValue(key, fallbackValue);
  }
  if (typeof GM_getValue === "function") {
    return GM_getValue(key, fallbackValue);
  }
  throw new Error("Userscript storage API is unavailable");
}

async function setStoredValue(key, value) {
  if (hasModernMethod("setValue")) {
    await GM.setValue(key, value);
    return;
  }
  if (typeof GM_setValue === "function") {
    await GM_setValue(key, value);
    return;
  }
  throw new Error("Userscript storage API is unavailable");
}

async function deleteStoredValue(key) {
  if (hasModernMethod("deleteValue")) {
    await GM.deleteValue(key);
    return;
  }
  if (typeof GM_deleteValue === "function") {
    await GM_deleteValue(key);
    return;
  }

  // Some legacy managers do not expose deleteValue. An explicit false value
  // has the same read semantics and prevents a stale state from returning.
  await setStoredValue(key, false);
}

function validateVideoId(videoId) {
  if (typeof videoId !== "string" || videoId.length === 0) {
    throw new TypeError("videoId must be a non-empty string");
  }
}

function syntheticDislikeKey(videoId) {
  return `${SYNTHETIC_DISLIKE_KEY_PREFIX}${videoId}`;
}

function createGmSyntheticDislikeStore() {
  let mutationQueue = Promise.resolve();

  function enqueueMutation(mutation) {
    const result = mutationQueue.catch(() => undefined).then(mutation);
    mutationQueue = result;
    return result;
  }

  return {
    async isDisliked(videoId) {
      validateVideoId(videoId);
      await mutationQueue.catch(() => undefined);
      return (await getStoredValue(syntheticDislikeKey(videoId), false)) === true;
    },

    async setDisliked(videoId, disliked) {
      validateVideoId(videoId);
      if (typeof disliked !== "boolean") {
        throw new TypeError("disliked must be a boolean");
      }

      return enqueueMutation(() =>
        disliked ? setStoredValue(syntheticDislikeKey(videoId), true) : deleteStoredValue(syntheticDislikeKey(videoId)),
      );
    },
  };
}

export { SYNTHETIC_DISLIKE_KEY_PREFIX, createGmSyntheticDislikeStore };
