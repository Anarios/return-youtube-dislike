function createInitializationCycleRunner(runCycle) {
  if (typeof runCycle !== "function") {
    throw new TypeError("An initialization cycle function is required.");
  }

  let activePromise = null;
  let rerunRequested = false;

  async function request() {
    if (activePromise) {
      rerunRequested = true;
      return activePromise;
    }

    activePromise = (async () => {
      do {
        rerunRequested = false;
        await runCycle();
      } while (rerunRequested);
    })();

    try {
      return await activePromise;
    } finally {
      activePromise = null;
    }
  }

  return {
    isRunning: () => activePromise !== null,
    request,
  };
}

function pendingNavigationControlsAreReady({
  currentControls,
  destinationVideoId,
  previousControls,
  shortsControlsVideoId = null,
}) {
  if (!previousControls) return true;

  const sameControls =
    currentControls.buttons === previousControls.buttons &&
    currentControls.likeButton === previousControls.likeButton &&
    currentControls.dislikeButton === previousControls.dislikeButton &&
    currentControls.nativeLikeButton === previousControls.nativeLikeButton &&
    currentControls.nativeDislikeButton === previousControls.nativeDislikeButton;
  if (!sameControls) return true;

  return Boolean(destinationVideoId && shortsControlsVideoId === destinationVideoId);
}

function pendingIncompleteShortsControlsCanInitialize({ destinationVideoId, isShortsRoute, previousVideoId }) {
  return Boolean(isShortsRoute && destinationVideoId && previousVideoId && destinationVideoId !== previousVideoId);
}

function reactionControlsCanInitialize({ hasRenderedButtons, isShortsRoute, isVideoLoaded }) {
  return Boolean(isShortsRoute || (hasRenderedButtons && isVideoLoaded));
}

function createPendingNavigationTracker() {
  let origin = null;

  function begin(captureOrigin) {
    if (origin) return origin;
    if (typeof captureOrigin !== "function") {
      throw new TypeError("A pending navigation origin capture function is required.");
    }

    const capturedOrigin = captureOrigin();
    if (!capturedOrigin || typeof capturedOrigin !== "object") {
      throw new TypeError("The pending navigation origin must be an object.");
    }
    origin = capturedOrigin;
    return origin;
  }

  return {
    begin,
    clear() {
      origin = null;
    },
    get: () => origin,
  };
}

export {
  createInitializationCycleRunner,
  createPendingNavigationTracker,
  pendingIncompleteShortsControlsCanInitialize,
  pendingNavigationControlsAreReady,
  reactionControlsCanInitialize,
};
