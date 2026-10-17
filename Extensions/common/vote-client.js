const DEFAULT_API_BASE_URL = "https://returnyoutubedislikeapi.com";
const USER_ID_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const VALID_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VALID_VOTE_VALUES = new Set([-1, 0, 1]);

class VoteClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "VoteClientError";
    this.status = options.status;
    this.cause = options.cause;
  }
}

function countLeadingZeroes(bytes, limit = Infinity) {
  let zeroes = 0;

  for (const originalValue of bytes) {
    let value = originalValue;
    if (value === 0) {
      zeroes += 8;
    } else {
      let count = 1;
      if (value >>> 4 === 0) {
        count += 4;
        value <<= 4;
      }
      if (value >>> 6 === 0) {
        count += 2;
        value <<= 2;
      }
      zeroes += count - (value >>> 7);
      break;
    }

    if (zeroes >= limit) break;
  }

  return zeroes;
}

function generateUserId(cryptoImpl = globalThis.crypto, length = 36) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new TypeError("User ID length must be a positive integer");
  }
  if (!cryptoImpl?.getRandomValues) {
    throw new VoteClientError("Web Crypto random generation is unavailable");
  }

  const values = new Uint32Array(length);
  cryptoImpl.getRandomValues(values);
  let result = "";
  for (const value of values) {
    result += USER_ID_CHARSET[value % USER_ID_CHARSET.length];
  }
  return result;
}

function decodeBase64(value) {
  if (typeof atob !== "function") {
    throw new VoteClientError("Base64 decoding is unavailable");
  }
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64(bytes) {
  if (typeof btoa !== "function") {
    throw new VoteClientError("Base64 encoding is unavailable");
  }
  return btoa(String.fromCharCode(...bytes));
}

async function solvePuzzle(puzzle, cryptoImpl = globalThis.crypto, maxAttempts) {
  if (!puzzle || typeof puzzle.challenge !== "string" || !Number.isInteger(puzzle.difficulty)) {
    throw new VoteClientError("The API returned an invalid puzzle");
  }
  if (!cryptoImpl?.subtle?.digest) {
    throw new VoteClientError("Web Crypto hashing is unavailable");
  }

  const challenge = decodeBase64(puzzle.challenge);
  if (challenge.length !== 16) {
    throw new VoteClientError("The API returned an invalid puzzle challenge");
  }

  const attempts = maxAttempts ?? Math.pow(2, puzzle.difficulty) * 3;
  if (!Number.isSafeInteger(attempts) || attempts <= 0) {
    throw new VoteClientError("The puzzle attempt limit is invalid");
  }

  const buffer = new ArrayBuffer(20);
  const byteView = new Uint8Array(buffer);
  const integerView = new Uint32Array(buffer);
  byteView.set(challenge, 4);

  for (let counter = 0; counter < attempts; counter++) {
    integerView[0] = counter;
    const hash = await cryptoImpl.subtle.digest("SHA-512", buffer);
    if (countLeadingZeroes(new Uint8Array(hash), puzzle.difficulty) >= puzzle.difficulty) {
      return { solution: encodeBase64(byteView.slice(0, 4)) };
    }
  }

  return null;
}

function isConfirmedCredential(value) {
  return Boolean(value?.userId && value.registrationConfirmed === true);
}

function createVoteClient({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  credentialStore,
  cryptoImpl = globalThis.crypto,
  puzzleAttempts = 2,
  votePuzzleAttempts = 3,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
  if (!credentialStore?.load || !credentialStore?.save || !credentialStore?.clear) {
    throw new TypeError("credentialStore must provide load, save, and clear");
  }
  if (!Number.isInteger(puzzleAttempts) || puzzleAttempts <= 0) {
    throw new TypeError("puzzleAttempts must be a positive integer");
  }
  if (!Number.isInteger(votePuzzleAttempts) || votePuzzleAttempts <= 0) {
    throw new TypeError("votePuzzleAttempts must be a positive integer");
  }

  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const voteQueues = new Map();
  let registrationPromise = null;
  let registrationIsForced = false;

  async function readJson(response, operation) {
    try {
      return await response.json();
    } catch (error) {
      throw new VoteClientError(`${operation} returned invalid JSON`, { status: response.status, cause: error });
    }
  }

  function isSuccessful(response) {
    if (typeof response.ok === "boolean") return response.ok;
    return response.status >= 200 && response.status < 300;
  }

  async function request(path, options, operation) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, options);
    } catch (error) {
      throw new VoteClientError(`${operation} request failed`, { cause: error });
    }

    if (!response || !Number.isInteger(response.status)) {
      throw new VoteClientError(`${operation} returned an invalid response`);
    }
    return response;
  }

  async function postJson(path, body, operation) {
    const response = await request(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      operation,
    );
    return response;
  }

  async function registerNewCredential() {
    const userId = generateUserId(cryptoImpl);

    for (let attempt = 0; attempt < puzzleAttempts; attempt++) {
      const path = `/puzzle/registration?userId=${encodeURIComponent(userId)}`;
      const puzzleResponse = await request(
        path,
        { method: "GET", headers: { Accept: "application/json" } },
        "Registration puzzle",
      );
      if (!isSuccessful(puzzleResponse)) {
        throw new VoteClientError("Registration puzzle request was rejected", { status: puzzleResponse.status });
      }

      const puzzle = await readJson(puzzleResponse, "Registration puzzle");
      const solvedPuzzle = await solvePuzzle(puzzle, cryptoImpl);
      if (!solvedPuzzle) continue;

      const confirmResponse = await postJson(path, solvedPuzzle, "Registration confirmation");
      if (!isSuccessful(confirmResponse)) {
        throw new VoteClientError("Registration confirmation was rejected", { status: confirmResponse.status });
      }
      const confirmed = await readJson(confirmResponse, "Registration confirmation");
      if (confirmed !== true) {
        throw new VoteClientError("Registration confirmation failed");
      }

      const credential = { userId, registrationConfirmed: true };
      await credentialStore.save(credential);
      return { userId };
    }

    throw new VoteClientError("Unable to solve the registration puzzle");
  }

  async function ensureRegisteredInternal(force) {
    if (force) {
      await credentialStore.clear();
    } else {
      const credential = await credentialStore.load();
      if (isConfirmedCredential(credential)) return { userId: credential.userId };
    }
    return registerNewCredential();
  }

  function trackRegistration(work, force) {
    let trackedPromise;
    trackedPromise = work.finally(() => {
      if (registrationPromise === trackedPromise) {
        registrationPromise = null;
        registrationIsForced = false;
      }
    });
    registrationPromise = trackedPromise;
    registrationIsForced = force;
    return trackedPromise;
  }

  function ensureRegistered(options = {}) {
    const force = options.force === true;
    if (!registrationPromise) {
      return trackRegistration(ensureRegisteredInternal(force), force);
    }
    if (!force || registrationIsForced) return registrationPromise;

    const pendingRegistration = registrationPromise;
    return trackRegistration(
      pendingRegistration.catch(() => undefined).then(() => ensureRegisteredInternal(true)),
      true,
    );
  }

  async function performVote(videoId, value, authenticationRetriesRemaining) {
    let { userId } = await ensureRegistered();

    for (let attempt = 0; attempt < votePuzzleAttempts; attempt++) {
      const voteResponse = await postJson("/interact/vote", { userId, videoId, value }, "Vote submission");

      if (voteResponse.status === 401) {
        if (authenticationRetriesRemaining <= 0) {
          throw new VoteClientError("Vote submission was unauthorized after re-registration", { status: 401 });
        }
        ({ userId } = await ensureRegistered({ force: true }));
        return performVote(videoId, value, authenticationRetriesRemaining - 1);
      }
      if (!isSuccessful(voteResponse)) {
        throw new VoteClientError("Vote submission was rejected", { status: voteResponse.status });
      }

      const puzzle = await readJson(voteResponse, "Vote submission");
      const solvedPuzzle = await solvePuzzle(puzzle, cryptoImpl);
      if (!solvedPuzzle) continue;

      const confirmResponse = await postJson(
        "/interact/confirmVote",
        { ...solvedPuzzle, userId, videoId },
        "Vote confirmation",
      );
      if (confirmResponse.status === 401) {
        if (authenticationRetriesRemaining <= 0) {
          throw new VoteClientError("Vote confirmation was unauthorized after re-registration", { status: 401 });
        }
        await ensureRegistered({ force: true });
        return performVote(videoId, value, authenticationRetriesRemaining - 1);
      }
      if (!isSuccessful(confirmResponse)) {
        throw new VoteClientError("Vote confirmation was rejected", { status: confirmResponse.status });
      }

      const confirmed = await readJson(confirmResponse, "Vote confirmation");
      if (confirmed !== true) throw new VoteClientError("Vote confirmation failed");
      return true;
    }

    throw new VoteClientError("Unable to solve the vote puzzle");
  }

  function submitVote(videoId, value) {
    if (typeof videoId !== "string" || !VALID_VIDEO_ID.test(videoId)) {
      return Promise.reject(new TypeError("videoId must be an 11-character YouTube video ID"));
    }
    if (!VALID_VOTE_VALUES.has(value)) {
      return Promise.reject(new TypeError("value must be -1, 0, or 1"));
    }

    const previous = voteQueues.get(videoId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => performVote(videoId, value, 1));
    voteQueues.set(videoId, current);
    current.then(
      () => {
        if (voteQueues.get(videoId) === current) voteQueues.delete(videoId);
      },
      () => {
        if (voteQueues.get(videoId) === current) voteQueues.delete(videoId);
      },
    );
    return current;
  }

  return { ensureRegistered, submitVote };
}

export { DEFAULT_API_BASE_URL, VoteClientError, countLeadingZeroes, generateUserId, solvePuzzle, createVoteClient };
