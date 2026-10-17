import {
  SYNTHETIC_DISLIKE_KEY_PREFIX,
  createBrowserCredentialStore,
  createBrowserSyntheticDislikeStore,
} from "./vote-client-adapter";

describe("createBrowserCredentialStore", () => {
  it("implements the credential contract with callback-based Chrome storage", async () => {
    const values = {};
    const storageArea = {
      get: jest.fn((keys, callback) => {
        callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
      }),
      set: jest.fn((nextValues, callback) => {
        Object.assign(values, nextValues);
        callback();
      }),
      remove: jest.fn((keys, callback) => {
        keys.forEach((key) => delete values[key]);
        callback();
      }),
    };
    const store = createBrowserCredentialStore(storageArea, () => undefined);

    expect(await store.load()).toBeNull();
    await store.save({ userId: "callback-user", registrationConfirmed: true });
    expect(await store.load()).toEqual({ userId: "callback-user", registrationConfirmed: true });
    expect(values).toEqual({ userId: "callback-user", registrationConfirmed: true });

    await store.clear();
    expect(values).toEqual({});
    expect(storageArea.remove).toHaveBeenCalledWith(["userId", "registrationConfirmed"], expect.any(Function));
  });

  it("implements the same contract with Promise-based browser storage", async () => {
    const values = { userId: "promise-user", registrationConfirmed: true };
    const storageArea = {
      get: jest.fn(async (keys) => Object.fromEntries(keys.map((key) => [key, values[key]]))),
      set: jest.fn(async (nextValues) => Object.assign(values, nextValues)),
      remove: jest.fn(async (keys) => keys.forEach((key) => delete values[key])),
    };
    const store = createBrowserCredentialStore(storageArea);

    expect(await store.load()).toEqual({ userId: "promise-user", registrationConfirmed: true });
    await store.save({ userId: "replacement-user", registrationConfirmed: true });
    expect(values).toEqual({ userId: "replacement-user", registrationConfirmed: true });
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("does not expose a partially confirmed legacy identity", async () => {
    const storageArea = {
      get: jest.fn(async () => ({ userId: "unconfirmed-user", registrationConfirmed: false })),
      set: jest.fn(async () => undefined),
    };

    expect(await createBrowserCredentialStore(storageArea).load()).toBeNull();
  });

  it("clears through set when remove is unavailable", async () => {
    const storageArea = {
      get: jest.fn(async () => ({})),
      set: jest.fn(async () => undefined),
    };

    await createBrowserCredentialStore(storageArea).clear();
    expect(storageArea.set).toHaveBeenCalledWith({ userId: null, registrationConfirmed: false }, expect.any(Function));
  });

  it("propagates callback storage failures", async () => {
    const storageArea = {
      get: jest.fn((_keys, callback) => callback({})),
      set: jest.fn((_values, callback) => callback()),
    };
    const store = createBrowserCredentialStore(storageArea, () => ({ message: "storage unavailable" }));

    await expect(store.load()).rejects.toThrow("storage unavailable");
  });

  it("rejects an invalid storage adapter", () => {
    expect(() => createBrowserCredentialStore()).toThrow(TypeError);
    expect(() => createBrowserCredentialStore({ get() {} })).toThrow(TypeError);
  });
});

describe("createBrowserSyntheticDislikeStore", () => {
  it("persists independent per-video states with callback-based storage", async () => {
    const values = {};
    const storageArea = {
      get: jest.fn((keys, callback) => {
        callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
      }),
      set: jest.fn((nextValues, callback) => {
        Object.assign(values, nextValues);
        callback();
      }),
      remove: jest.fn((keys, callback) => {
        keys.forEach((key) => delete values[key]);
        callback();
      }),
    };
    const store = createBrowserSyntheticDislikeStore(storageArea, () => undefined);

    expect(await store.isDisliked("short-a")).toBe(false);
    await store.setDisliked("short-a", true);
    await store.setDisliked("short-b", true);
    expect(await store.isDisliked("short-a")).toBe(true);
    expect(await store.isDisliked("short-b")).toBe(true);

    await store.setDisliked("short-a", false);
    expect(await store.isDisliked("short-a")).toBe(false);
    expect(await store.isDisliked("short-b")).toBe(true);
    expect(values).toEqual({ [`${SYNTHETIC_DISLIKE_KEY_PREFIX}short-b`]: true });
  });

  it("uses the same asynchronous contract with Promise-based storage", async () => {
    const values = {};
    const storageArea = {
      get: jest.fn(async (keys) => Object.fromEntries(keys.map((key) => [key, values[key]]))),
      set: jest.fn(async (nextValues) => Object.assign(values, nextValues)),
      remove: jest.fn(async (keys) => keys.forEach((key) => delete values[key])),
    };
    const store = createBrowserSyntheticDislikeStore(storageArea);

    await store.setDisliked("short-a", true);
    expect(await store.isDisliked("short-a")).toBe(true);
    await store.setDisliked("short-a", false);
    expect(await store.isDisliked("short-a")).toBe(false);
  });

  it("validates state and falls back to an explicit false value without remove", async () => {
    const storageArea = {
      get: jest.fn(async () => ({})),
      set: jest.fn(async () => undefined),
    };
    const store = createBrowserSyntheticDislikeStore(storageArea);

    await expect(store.isDisliked(1)).rejects.toThrow(TypeError);
    await expect(store.setDisliked("", true)).rejects.toThrow(TypeError);
    await expect(store.setDisliked("short-a", "true")).rejects.toThrow(TypeError);
    await store.setDisliked("short-a", false);
    expect(storageArea.set).toHaveBeenCalledWith(
      { [`${SYNTHETIC_DISLIKE_KEY_PREFIX}short-a`]: false },
      expect.any(Function),
    );
  });
});
