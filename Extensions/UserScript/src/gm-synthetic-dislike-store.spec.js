import { SYNTHETIC_DISLIKE_KEY_PREFIX, createGmSyntheticDislikeStore } from "./gm-synthetic-dislike-store";

const LEGACY_METHODS = ["GM_getValue", "GM_setValue", "GM_deleteValue"];
const stateKey = (videoId) => `${SYNTHETIC_DISLIKE_KEY_PREFIX}${videoId}`;

function installModernStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  global.GM = {
    getValue: jest.fn(async (key, fallbackValue) => (values.has(key) ? values.get(key) : fallbackValue)),
    setValue: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
    deleteValue: jest.fn(async (key) => {
      values.delete(key);
    }),
  };
  return values;
}

afterEach(() => {
  delete global.GM;
  LEGACY_METHODS.forEach((name) => delete global[name]);
});

describe("createGmSyntheticDislikeStore", () => {
  it("uses independent per-video values as the authoritative modern GM state", async () => {
    const values = installModernStorage({ [stateKey("existing-video")]: true });
    const store = createGmSyntheticDislikeStore();

    await expect(store.isDisliked("existing-video")).resolves.toBe(true);
    await expect(store.isDisliked("missing-video")).resolves.toBe(false);

    await store.setDisliked("new-video", true);
    expect(values.get(stateKey("new-video"))).toBe(true);

    await store.setDisliked("existing-video", false);
    expect(values.has(stateKey("existing-video"))).toBe(false);
    await expect(store.isDisliked("existing-video")).resolves.toBe(false);
  });

  it("supports legacy synchronous GM methods", async () => {
    const values = new Map();
    global.GM_getValue = jest.fn((key, fallbackValue) => (values.has(key) ? values.get(key) : fallbackValue));
    global.GM_setValue = jest.fn((key, value) => values.set(key, value));
    global.GM_deleteValue = jest.fn((key) => values.delete(key));
    const store = createGmSyntheticDislikeStore();

    await store.setDisliked("legacy-video", true);
    expect(global.GM_setValue).toHaveBeenCalledWith(stateKey("legacy-video"), true);
    await expect(store.isDisliked("legacy-video")).resolves.toBe(true);

    await store.setDisliked("legacy-video", false);
    expect(global.GM_deleteValue).toHaveBeenCalledWith(stateKey("legacy-video"));
    await expect(store.isDisliked("legacy-video")).resolves.toBe(false);
  });

  it("stores false when a legacy manager has no delete method", async () => {
    const values = new Map();
    global.GM_getValue = jest.fn((key, fallbackValue) => (values.has(key) ? values.get(key) : fallbackValue));
    global.GM_setValue = jest.fn((key, value) => values.set(key, value));
    const store = createGmSyntheticDislikeStore();

    await store.setDisliked("legacy-video", true);
    await store.setDisliked("legacy-video", false);

    expect(values.get(stateKey("legacy-video"))).toBe(false);
    await expect(store.isDisliked("legacy-video")).resolves.toBe(false);
  });

  it("does not lose state when two store instances update different videos concurrently", async () => {
    const values = installModernStorage();
    const firstStore = createGmSyntheticDislikeStore();
    const secondStore = createGmSyntheticDislikeStore();

    await Promise.all([firstStore.setDisliked("first-video", true), secondStore.setDisliked("second-video", true)]);

    expect(values.get(stateKey("first-video"))).toBe(true);
    expect(values.get(stateKey("second-video"))).toBe(true);
    await expect(firstStore.isDisliked("first-video")).resolves.toBe(true);
    await expect(secondStore.isDisliked("second-video")).resolves.toBe(true);
  });

  it("uses the last completed per-video write for same-video races", async () => {
    const values = new Map();
    let releaseTrueWrite;
    let trueWriteStarted;
    const trueWriteGate = new Promise((resolve) => {
      releaseTrueWrite = resolve;
    });
    const trueWriteEntered = new Promise((resolve) => {
      trueWriteStarted = resolve;
    });
    global.GM = {
      getValue: jest.fn(async (key, fallbackValue) => (values.has(key) ? values.get(key) : fallbackValue)),
      setValue: jest.fn(async (key, value) => {
        if (key === stateKey("shared-video") && value === true) {
          trueWriteStarted();
          await trueWriteGate;
        }
        values.set(key, value);
      }),
      deleteValue: jest.fn(async (key) => {
        values.delete(key);
      }),
    };
    const firstStore = createGmSyntheticDislikeStore();
    const secondStore = createGmSyntheticDislikeStore();

    const delayedTrue = firstStore.setDisliked("shared-video", true);
    await trueWriteEntered;
    await secondStore.setDisliked("shared-video", false);
    releaseTrueWrite();
    await delayedTrue;

    await expect(firstStore.isDisliked("shared-video")).resolves.toBe(true);
  });

  it("treats non-true stored values as neutral", async () => {
    installModernStorage({
      [stateKey("false-video")]: false,
      [stateKey("corrupt-video")]: { disliked: true },
    });
    const store = createGmSyntheticDislikeStore();

    await expect(store.isDisliked("false-video")).resolves.toBe(false);
    await expect(store.isDisliked("corrupt-video")).resolves.toBe(false);
  });

  it("propagates storage errors and recovers its local mutation queue", async () => {
    global.GM = { getValue: jest.fn(async () => Promise.reject(new Error("read failed"))) };
    await expect(createGmSyntheticDislikeStore().isDisliked("video")).rejects.toThrow("read failed");

    const values = installModernStorage();
    global.GM.setValue.mockRejectedValueOnce(new Error("write failed"));
    const store = createGmSyntheticDislikeStore();
    await expect(store.setDisliked("video", true)).rejects.toThrow("write failed");
    await expect(store.setDisliked("video", true)).resolves.toBeUndefined();
    expect(values.get(stateKey("video"))).toBe(true);

    delete global.GM;
    await expect(createGmSyntheticDislikeStore().isDisliked("video")).rejects.toThrow(
      "Userscript storage API is unavailable",
    );
  });

  it("rejects invalid arguments without accessing storage", async () => {
    installModernStorage();
    const store = createGmSyntheticDislikeStore();

    await expect(store.isDisliked(123)).rejects.toThrow(TypeError);
    await expect(store.setDisliked("", true)).rejects.toThrow(TypeError);
    await expect(store.setDisliked("video", 1)).rejects.toThrow(TypeError);
    expect(global.GM.getValue).not.toHaveBeenCalled();
    expect(global.GM.setValue).not.toHaveBeenCalled();
  });
});
