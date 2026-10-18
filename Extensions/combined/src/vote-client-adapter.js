function createStorageCaller(storageArea, getLastError = () => undefined) {
  return function call(methodName, ...args) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback) => (value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const resolveOnce = finish(resolve);
      const rejectOnce = finish(reject);
      const callback = (result) => {
        const lastError = getLastError();
        if (lastError) {
          rejectOnce(new Error(lastError.message || String(lastError)));
        } else {
          resolveOnce(result);
        }
      };

      try {
        const maybePromise = storageArea[methodName](...args, callback);
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolveOnce, rejectOnce);
        }
      } catch (callbackError) {
        try {
          const maybePromise = storageArea[methodName](...args);
          Promise.resolve(maybePromise).then(resolveOnce, rejectOnce);
        } catch (promiseError) {
          rejectOnce(promiseError ?? callbackError);
        }
      }
    });
  };
}

function createBrowserCredentialStore(storageArea, getLastError) {
  if (!storageArea?.get || !storageArea?.set) {
    throw new TypeError("A browser storage area is required");
  }

  const call = createStorageCaller(storageArea, getLastError);
  return {
    async load() {
      const result = await call("get", ["userId", "registrationConfirmed"]);
      if (!result?.userId || result.registrationConfirmed !== true) return null;
      return { userId: result.userId, registrationConfirmed: true };
    },

    async save(credentials) {
      await call("set", {
        userId: credentials.userId,
        registrationConfirmed: credentials.registrationConfirmed === true,
      });
    },

    async clear() {
      if (typeof storageArea.remove === "function") {
        await call("remove", ["userId", "registrationConfirmed"]);
      } else {
        await call("set", { userId: null, registrationConfirmed: false });
      }
    },
  };
}

const SYNTHETIC_DISLIKE_KEY_PREFIX = "rydSyntheticDislikedShort:";

function syntheticDislikeKey(videoId) {
  if (typeof videoId !== "string" || videoId.length === 0) {
    throw new TypeError("videoId must be a non-empty string");
  }
  return `${SYNTHETIC_DISLIKE_KEY_PREFIX}${videoId}`;
}

function createBrowserSyntheticDislikeStore(storageArea, getLastError) {
  if (!storageArea?.get || !storageArea?.set) {
    throw new TypeError("A browser storage area is required");
  }

  const call = createStorageCaller(storageArea, getLastError);
  return {
    async isDisliked(videoId) {
      const key = syntheticDislikeKey(videoId);
      const result = await call("get", [key]);
      return result?.[key] === true;
    },

    async setDisliked(videoId, disliked) {
      const key = syntheticDislikeKey(videoId);
      if (typeof disliked !== "boolean") {
        throw new TypeError("disliked must be a boolean");
      }
      if (disliked || typeof storageArea.remove !== "function") {
        await call("set", { [key]: disliked });
      } else {
        await call("remove", [key]);
      }
    },
  };
}

export { SYNTHETIC_DISLIKE_KEY_PREFIX, createBrowserCredentialStore, createBrowserSyntheticDislikeStore };
