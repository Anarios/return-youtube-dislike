import { countLeadingZeroes, createVoteClient, generateUserId, solvePuzzle } from "./vote-client";
import { webcrypto } from "crypto";

const API_BASE_URL = "https://api.example";
const VIDEO_A = "dQw4w9WgXcQ";
const VIDEO_B = "abcdefghijk";
const CHALLENGE = Buffer.alloc(16, 7).toString("base64");
const ZERO_SOLUTION = "AAAAAA==";
const GENERATED_USER_ID = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function invalidJsonResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for asynchronous vote-client work");
}

function createCredentialStore(initialCredentials = null) {
  let credentials = initialCredentials ? { ...initialCredentials } : null;

  return {
    load: jest.fn(async () => (credentials ? { ...credentials } : null)),
    save: jest.fn(async (nextCredentials) => {
      credentials = { ...nextCredentials };
    }),
    clear: jest.fn(async () => {
      credentials = null;
    }),
    peek: () => (credentials ? { ...credentials } : null),
  };
}

function createCryptoImpl(hashFactory = () => new Uint8Array(64)) {
  return {
    getRandomValues: jest.fn((values) => {
      for (let index = 0; index < values.length; index++) {
        values[index] = index;
      }
      return values;
    }),
    subtle: {
      digest: jest.fn(async (algorithm, value) => {
        const hash = hashFactory(algorithm, new Uint8Array(value));
        return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
      }),
    },
  };
}

function createClient({
  fetchImpl,
  credentialStore,
  cryptoImpl = createCryptoImpl(),
  puzzleAttempts,
  votePuzzleAttempts,
} = {}) {
  return createVoteClient({
    apiBaseUrl: API_BASE_URL,
    fetchImpl,
    credentialStore,
    cryptoImpl,
    ...(puzzleAttempts === undefined ? {} : { puzzleAttempts }),
    ...(votePuzzleAttempts === undefined ? {} : { votePuzzleAttempts }),
  });
}

function registrationPuzzle() {
  return { challenge: CHALLENGE, difficulty: 1 };
}

function votePuzzle() {
  return { challenge: CHALLENGE, difficulty: 1 };
}

function parseBody(call) {
  return JSON.parse(call[1].body);
}

describe("proof-of-work helpers", () => {
  it.each([
    [[], 0],
    [[0x80], 0],
    [[0x40], 1],
    [[0x08], 4],
    [[0x00, 0x01], 15],
    [[0x00, 0x00, 0x10], 19],
  ])("counts leading zero bits in %p", (bytes, expected) => {
    expect(countLeadingZeroes(Uint8Array.from(bytes))).toBe(expected);
  });

  it("stops once the requested leading-zero limit is reached", () => {
    expect(countLeadingZeroes(Uint8Array.from([0x00, 0x00, 0xff]), 8)).toBe(8);
  });

  it("generates an alphanumeric ID of the requested length using injected crypto", () => {
    const cryptoImpl = createCryptoImpl();

    expect(generateUserId(cryptoImpl, 8)).toBe("ABCDEFGH");
    expect(cryptoImpl.getRandomValues).toHaveBeenCalledTimes(1);
    expect(cryptoImpl.getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint32Array);
  });

  it("rejects invalid ID lengths and unavailable random generation", () => {
    expect(() => generateUserId(createCryptoImpl(), 0)).toThrow(TypeError);
    expect(() => generateUserId({}, 36)).toThrow(/crypto|random/i);
  });

  it("solves the SHA-512 puzzle and returns the four-byte counter as base64", async () => {
    let digestCall = 0;
    const cryptoImpl = createCryptoImpl(() => {
      digestCall++;
      const hash = new Uint8Array(64);
      hash[0] = digestCall === 1 ? 0xff : 0x0f;
      return hash;
    });

    await expect(solvePuzzle({ challenge: CHALLENGE, difficulty: 4 }, cryptoImpl, 2)).resolves.toEqual({
      solution: "AQAAAA==",
    });
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledTimes(2);
    expect(cryptoImpl.subtle.digest.mock.calls[0][0]).toBe("SHA-512");
    expect(Array.from(new Uint8Array(cryptoImpl.subtle.digest.mock.calls[1][1]).slice(0, 4))).toEqual([1, 0, 0, 0]);
    expect(Array.from(new Uint8Array(cryptoImpl.subtle.digest.mock.calls[1][1]).slice(4))).toEqual(
      Array.from(Buffer.from(CHALLENGE, "base64")),
    );
  });

  it("matches a known low-difficulty SHA-512 proof-of-work vector", async () => {
    await expect(solvePuzzle({ challenge: CHALLENGE, difficulty: 8 }, webcrypto, 116)).resolves.toEqual({
      solution: "cwAAAA==",
    });
  });

  it("returns null when the hash-attempt bound is exhausted", async () => {
    const cryptoImpl = createCryptoImpl(() => new Uint8Array(64).fill(0xff));

    await expect(solvePuzzle({ challenge: CHALLENGE, difficulty: 1 }, cryptoImpl, 3)).resolves.toBeNull();
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledTimes(3);
  });
});

describe("createVoteClient registration", () => {
  it("validates required client dependencies and retry bounds", () => {
    expect(() => createVoteClient()).toThrow(TypeError);
    expect(() => createVoteClient({ fetchImpl: jest.fn(), credentialStore: {} })).toThrow(TypeError);
    expect(() =>
      createVoteClient({
        fetchImpl: jest.fn(),
        credentialStore: createCredentialStore(),
        puzzleAttempts: 0,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createVoteClient({
        fetchImpl: jest.fn(),
        credentialStore: createCredentialStore(),
        votePuzzleAttempts: 0,
      }),
    ).toThrow(TypeError);
  });

  it("registers cold credentials with exact request shapes and persists the confirmed identity", async () => {
    const credentialStore = createCredentialStore();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.ensureRegistered()).resolves.toEqual({ userId: GENERATED_USER_ID });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]).toEqual([
      `${API_BASE_URL}/puzzle/registration?userId=${GENERATED_USER_ID}`,
      { method: "GET", headers: { Accept: "application/json" } },
    ]);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${API_BASE_URL}/puzzle/registration?userId=${GENERATED_USER_ID}`);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(parseBody(fetchImpl.mock.calls[1])).toEqual({ solution: ZERO_SOLUTION });
    expect(credentialStore.save).toHaveBeenCalledWith({
      userId: GENERATED_USER_ID,
      registrationConfirmed: true,
    });
    expect(credentialStore.peek()).toEqual({ userId: GENERATED_USER_ID, registrationConfirmed: true });
    expect(credentialStore.clear).not.toHaveBeenCalled();
  });

  it("reuses warm confirmed credentials without making a registration request", async () => {
    const credentials = { userId: "existing-user", registrationConfirmed: true };
    const credentialStore = createCredentialStore(credentials);
    const fetchImpl = jest.fn();
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.ensureRegistered()).resolves.toEqual({ userId: credentials.userId });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(credentialStore.save).not.toHaveBeenCalled();
    expect(credentialStore.clear).not.toHaveBeenCalled();
  });

  it("reuses a persisted identity after client recreation", async () => {
    const credentialStore = createCredentialStore();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));

    await expect(createClient({ fetchImpl, credentialStore }).ensureRegistered()).resolves.toEqual({
      userId: GENERATED_USER_ID,
    });
    await expect(createClient({ fetchImpl, credentialStore }).ensureRegistered()).resolves.toEqual({
      userId: GENERATED_USER_ID,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(credentialStore.save).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent cold registration", async () => {
    const credentialStore = createCredentialStore();
    const registrationResponse = deferred();
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(() => registrationResponse.promise)
      .mockResolvedValueOnce(jsonResponse(true));
    const client = createClient({ fetchImpl, credentialStore });

    const first = client.ensureRegistered();
    const second = client.ensureRegistered();
    await waitUntil(() => fetchImpl.mock.calls.length === 1);

    registrationResponse.resolve(jsonResponse(registrationPuzzle()));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { userId: GENERATED_USER_ID },
      { userId: GENERATED_USER_ID },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(credentialStore.save).toHaveBeenCalledTimes(1);
  });

  it("bounds fresh registration challenges when no puzzle can be solved", async () => {
    const credentialStore = createCredentialStore();
    const cryptoImpl = createCryptoImpl(() => new Uint8Array(64).fill(0xff));
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(registrationPuzzle()));
    const client = createClient({ fetchImpl, credentialStore, cryptoImpl, puzzleAttempts: 2 });

    await expect(client.ensureRegistered()).rejects.toThrow(/registration|puzzle/i);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      fetchImpl.mock.calls.every(([url, options]) => url.includes("/puzzle/registration") && options.method === "GET"),
    ).toBe(true);
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledTimes(12);
    expect(credentialStore.save).not.toHaveBeenCalled();
  });

  it("fails without persisting credentials when registration confirmation is false", async () => {
    const credentialStore = createCredentialStore();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(false));
    const client = createClient({ fetchImpl, credentialStore, puzzleAttempts: 1 });

    await expect(client.ensureRegistered()).rejects.toThrow(/registration|confirm/i);
    expect(credentialStore.save).not.toHaveBeenCalled();
  });

  it("surfaces registration HTTP failures and does not continue to confirmation", async () => {
    const credentialStore = createCredentialStore();
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.ensureRegistered()).rejects.toThrow(/503|registration/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(credentialStore.save).not.toHaveBeenCalled();
  });

  it("surfaces registration network and malformed JSON failures without recursion", async () => {
    const networkStore = createCredentialStore();
    const networkFetch = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(
      createClient({ fetchImpl: networkFetch, credentialStore: networkStore }).ensureRegistered(),
    ).rejects.toThrow(/request failed/i);
    expect(networkFetch).toHaveBeenCalledTimes(1);
    expect(networkStore.save).not.toHaveBeenCalled();

    const malformedStore = createCredentialStore();
    const malformedFetch = jest.fn().mockResolvedValue(invalidJsonResponse());
    await expect(
      createClient({ fetchImpl: malformedFetch, credentialStore: malformedStore }).ensureRegistered(),
    ).rejects.toThrow(/invalid JSON/i);
    expect(malformedFetch).toHaveBeenCalledTimes(1);
    expect(malformedStore.save).not.toHaveBeenCalled();
  });

  it("propagates credential load and save failures", async () => {
    const loadFailureStore = createCredentialStore();
    loadFailureStore.load.mockRejectedValue(new Error("load failed"));
    const unusedFetch = jest.fn();
    await expect(
      createClient({ fetchImpl: unusedFetch, credentialStore: loadFailureStore }).ensureRegistered(),
    ).rejects.toThrow("load failed");
    expect(unusedFetch).not.toHaveBeenCalled();

    const saveFailureStore = createCredentialStore();
    saveFailureStore.save.mockRejectedValue(new Error("save failed"));
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));
    await expect(createClient({ fetchImpl, credentialStore: saveFailureStore }).ensureRegistered()).rejects.toThrow(
      "save failed",
    );
    expect(saveFailureStore.peek()).toBeNull();
  });
});

describe("createVoteClient submission", () => {
  it.each([null, undefined, "", "short", "way-too-long-video-id", "invalid$id"])(
    "rejects invalid video ID %p before making a request",
    async (videoId) => {
      const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
      const fetchImpl = jest.fn();
      const client = createClient({ fetchImpl, credentialStore });

      await expect(client.submitVote(videoId, 1)).rejects.toThrow(TypeError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([-2, 2, null, undefined, "1"])("rejects invalid vote value %p before making a request", async (value) => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const fetchImpl = jest.fn();
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, value)).rejects.toThrow(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("submits and confirms a vote with exact payloads", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, -1)).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${API_BASE_URL}/interact/vote`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(parseBody(fetchImpl.mock.calls[0])).toEqual({
      userId: "existing-user",
      videoId: VIDEO_A,
      value: -1,
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(`${API_BASE_URL}/interact/confirmVote`);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(parseBody(fetchImpl.mock.calls[1])).toEqual({
      solution: ZERO_SOLUTION,
      userId: "existing-user",
      videoId: VIDEO_A,
    });
  });

  it("shares one cold registration across concurrent first votes", async () => {
    const credentialStore = createCredentialStore();
    const registrationResponse = deferred();
    const fetchImpl = jest.fn(async (url) => {
      if (url.includes("/puzzle/registration")) {
        if (fetchImpl.mock.calls.filter(([calledUrl]) => calledUrl.includes("/puzzle/registration")).length === 1) {
          return registrationResponse.promise;
        }
        return jsonResponse(true);
      }
      if (url.endsWith("/interact/vote")) return jsonResponse(votePuzzle());
      return jsonResponse(true);
    });
    const client = createClient({ fetchImpl, credentialStore });

    const first = client.submitVote(VIDEO_A, 1);
    const second = client.submitVote(VIDEO_B, -1);
    await waitUntil(() => fetchImpl.mock.calls.length === 1);
    registrationResponse.resolve(jsonResponse(registrationPuzzle()));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetchImpl.mock.calls.filter(([url]) => url.includes("/puzzle/registration"))).toHaveLength(2);
    expect(credentialStore.save).toHaveBeenCalledTimes(1);
    expect(
      fetchImpl.mock.calls.filter(([url]) => url.endsWith("/interact/vote")).map((call) => parseBody(call).userId),
    ).toEqual([GENERATED_USER_ID, GENERATED_USER_ID]);
  });

  it("clears credentials, registers once, and retries once after a 401", async () => {
    const credentialStore = createCredentialStore({ userId: "expired-user", registrationConfirmed: true });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, 401))
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(true))
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, 1)).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(credentialStore.clear).toHaveBeenCalledTimes(1);
    expect(credentialStore.save).toHaveBeenCalledTimes(1);
    expect(parseBody(fetchImpl.mock.calls[0])).toEqual({
      userId: "expired-user",
      videoId: VIDEO_A,
      value: 1,
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(`${API_BASE_URL}/puzzle/registration?userId=${GENERATED_USER_ID}`);
    expect(parseBody(fetchImpl.mock.calls[3])).toEqual({
      userId: GENERATED_USER_ID,
      videoId: VIDEO_A,
      value: 1,
    });
    expect(parseBody(fetchImpl.mock.calls[4])).toEqual({
      solution: ZERO_SOLUTION,
      userId: GENERATED_USER_ID,
      videoId: VIDEO_A,
    });
  });

  it("does not retry registration more than once when the retried vote is also unauthorized", async () => {
    const credentialStore = createCredentialStore({ userId: "expired-user", registrationConfirmed: true });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, 401))
      .mockResolvedValueOnce(jsonResponse(registrationPuzzle()))
      .mockResolvedValueOnce(jsonResponse(true))
      .mockResolvedValueOnce(jsonResponse(null, 401));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, 0)).rejects.toThrow(/401|unauthorized/i);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(credentialStore.clear).toHaveBeenCalledTimes(1);
    expect(credentialStore.save).toHaveBeenCalledTimes(1);
  });

  it("honors forced re-registration while a normal credential read is in flight", async () => {
    const expiredCredentials = { userId: "expired-user", registrationConfirmed: true };
    const credentialStore = createCredentialStore(expiredCredentials);
    const firstUnauthorizedVote = deferred();
    let expiredVoteCount = 0;
    const fetchImpl = jest.fn(async (url, options) => {
      if (url.endsWith("/interact/vote")) {
        const body = JSON.parse(options.body);
        if (body.userId === expiredCredentials.userId) {
          expiredVoteCount++;
          return expiredVoteCount === 1 ? firstUnauthorizedVote.promise : jsonResponse(null, 401);
        }
        return jsonResponse(votePuzzle());
      }
      if (url.includes("/puzzle/registration")) {
        return options.method === "GET" ? jsonResponse(registrationPuzzle()) : jsonResponse(true);
      }
      return jsonResponse(true);
    });
    const client = createClient({ fetchImpl, credentialStore });

    const submission = client.submitVote(VIDEO_A, 1);
    await waitUntil(() => expiredVoteCount === 1);

    const pendingCredentialRead = deferred();
    credentialStore.load.mockImplementationOnce(() => pendingCredentialRead.promise);
    const ordinaryRegistration = client.ensureRegistered();
    await waitUntil(() => credentialStore.load.mock.calls.length === 2);

    firstUnauthorizedVote.resolve(jsonResponse(null, 401));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(credentialStore.clear).not.toHaveBeenCalled();

    pendingCredentialRead.resolve(expiredCredentials);
    await expect(ordinaryRegistration).resolves.toEqual({ userId: expiredCredentials.userId });
    await expect(submission).resolves.toBe(true);

    expect(expiredVoteCount).toBe(1);
    expect(credentialStore.clear).toHaveBeenCalledTimes(1);
    expect(credentialStore.save).toHaveBeenCalledWith({
      userId: GENERATED_USER_ID,
      registrationConfirmed: true,
    });
    expect(fetchImpl.mock.calls.filter(([url]) => url.includes("/puzzle/registration"))).toHaveLength(2);
  });

  it("stops when clearing stale credentials fails after a 401", async () => {
    const credentialStore = createCredentialStore({ userId: "expired-user", registrationConfirmed: true });
    credentialStore.clear.mockRejectedValue(new Error("clear failed"));
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(null, 401));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, 1)).rejects.toThrow("clear failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(credentialStore.save).not.toHaveBeenCalled();
  });

  it("uses a third fresh vote puzzle after the first two solvers are exhausted", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    let digestCall = 0;
    const cryptoImpl = createCryptoImpl(() => {
      digestCall++;
      return new Uint8Array(64).fill(digestCall <= 12 ? 0xff : 0);
    });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(true));
    const client = createClient({ fetchImpl, credentialStore, cryptoImpl });

    await expect(client.submitVote(VIDEO_A, 1)).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${API_BASE_URL}/interact/vote`,
      `${API_BASE_URL}/interact/vote`,
      `${API_BASE_URL}/interact/vote`,
      `${API_BASE_URL}/interact/confirmVote`,
    ]);
    expect(fetchImpl.mock.calls.slice(0, 3).map((call) => parseBody(call))).toEqual([
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
    ]);
    expect(parseBody(fetchImpl.mock.calls[3])).toEqual({
      solution: ZERO_SOLUTION,
      userId: "existing-user",
      videoId: VIDEO_A,
    });
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledTimes(13);
  });

  it("bounds fresh vote challenges after all three puzzles are exhausted", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const cryptoImpl = createCryptoImpl(() => new Uint8Array(64).fill(0xff));
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(votePuzzle()));
    const client = createClient({ fetchImpl, credentialStore, cryptoImpl });

    await expect(client.submitVote(VIDEO_A, 1)).rejects.toThrow(/vote|puzzle/i);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls.every(([url]) => url === `${API_BASE_URL}/interact/vote`)).toBe(true);
    expect(fetchImpl.mock.calls.map((call) => parseBody(call))).toEqual([
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
      { userId: "existing-user", videoId: VIDEO_A, value: 1 },
    ]);
    expect(cryptoImpl.subtle.digest).toHaveBeenCalledTimes(18);
  });

  it("rejects a failed confirmation instead of reporting success", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse(false));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, 1)).rejects.toThrow(/confirm/i);
  });

  it("surfaces a non-authentication vote rejection without registering or confirming", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, 1)).rejects.toThrow(/503|rejected|submission/i);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(credentialStore.clear).not.toHaveBeenCalled();
    expect(credentialStore.save).not.toHaveBeenCalled();
  });

  it("surfaces a confirmation HTTP failure instead of reporting success", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503));
    const client = createClient({ fetchImpl, credentialStore });

    await expect(client.submitVote(VIDEO_A, -1)).rejects.toThrow(/503|confirm|rejected/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces vote and confirmation malformed JSON without retrying indefinitely", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const malformedVoteFetch = jest.fn().mockResolvedValue(invalidJsonResponse());
    await expect(
      createClient({ fetchImpl: malformedVoteFetch, credentialStore }).submitVote(VIDEO_A, 1),
    ).rejects.toThrow(/invalid JSON/i);
    expect(malformedVoteFetch).toHaveBeenCalledTimes(1);

    const malformedConfirmationFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockResolvedValueOnce(invalidJsonResponse());
    await expect(
      createClient({ fetchImpl: malformedConfirmationFetch, credentialStore }).submitVote(VIDEO_A, -1),
    ).rejects.toThrow(/invalid JSON/i);
    expect(malformedConfirmationFetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces vote and confirmation network failures without recursion", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const voteNetworkFetch = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(createClient({ fetchImpl: voteNetworkFetch, credentialStore }).submitVote(VIDEO_A, 1)).rejects.toThrow(
      /request failed/i,
    );
    expect(voteNetworkFetch).toHaveBeenCalledTimes(1);

    const confirmationNetworkFetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(votePuzzle()))
      .mockRejectedValueOnce(new Error("offline"));
    await expect(
      createClient({ fetchImpl: confirmationNetworkFetch, credentialStore }).submitVote(VIDEO_A, -1),
    ).rejects.toThrow(/request failed/i);
    expect(confirmationNetworkFetch).toHaveBeenCalledTimes(2);
  });

  it("serializes submissions for the same video through confirmation", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const firstConfirmation = deferred();
    let confirmationCount = 0;
    const fetchImpl = jest.fn(async (url) => {
      if (url.endsWith("/interact/vote")) return jsonResponse(votePuzzle());
      confirmationCount++;
      return confirmationCount === 1 ? firstConfirmation.promise : jsonResponse(true);
    });
    const client = createClient({ fetchImpl, credentialStore });

    const first = client.submitVote(VIDEO_A, 1);
    const second = client.submitVote(VIDEO_A, -1);

    await waitUntil(() => fetchImpl.mock.calls.some(([url]) => url.endsWith("/interact/confirmVote")));
    expect(fetchImpl.mock.calls.filter(([url]) => url.endsWith("/interact/vote"))).toHaveLength(1);

    firstConfirmation.resolve(jsonResponse(true));
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);

    expect(fetchImpl.mock.calls.map(([url]) => url.replace(API_BASE_URL, ""))).toEqual([
      "/interact/vote",
      "/interact/confirmVote",
      "/interact/vote",
      "/interact/confirmVote",
    ]);
    expect(parseBody(fetchImpl.mock.calls[0]).value).toBe(1);
    expect(parseBody(fetchImpl.mock.calls[2]).value).toBe(-1);
  });

  it("does not block a different video's submission behind an in-flight confirmation", async () => {
    const credentialStore = createCredentialStore({ userId: "existing-user", registrationConfirmed: true });
    const videoAConfirmation = deferred();
    const fetchImpl = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      if (url.endsWith("/interact/vote")) return jsonResponse(votePuzzle());
      return body.videoId === VIDEO_A ? videoAConfirmation.promise : jsonResponse(true);
    });
    const client = createClient({ fetchImpl, credentialStore });

    const videoA = client.submitVote(VIDEO_A, 1);
    const videoB = client.submitVote(VIDEO_B, -1);

    await expect(videoB).resolves.toBe(true);
    expect(
      fetchImpl.mock.calls.some(([url, options]) => {
        return url.endsWith("/interact/confirmVote") && JSON.parse(options.body).videoId === VIDEO_B;
      }),
    ).toBe(true);

    videoAConfirmation.resolve(jsonResponse(true));
    await expect(videoA).resolves.toBe(true);
  });
});
