import { CREDENTIALS_KEY, createGmCredentialStore } from "./gm-credential-store";

const LEGACY_METHODS = ["GM_getValue", "GM_setValue", "GM_deleteValue"];

afterEach(() => {
  delete global.GM;
  LEGACY_METHODS.forEach((name) => delete global[name]);
});

describe("createGmCredentialStore", () => {
  it("uses the modern GM storage contract", async () => {
    let value = null;
    global.GM = {
      getValue: jest.fn(async (_key, fallbackValue) => value ?? fallbackValue),
      setValue: jest.fn(async (_key, nextValue) => {
        value = nextValue;
      }),
      deleteValue: jest.fn(async () => {
        value = null;
      }),
    };
    const store = createGmCredentialStore();

    expect(await store.load()).toBeNull();
    await store.save({ userId: "modern-user", registrationConfirmed: true });
    expect(await store.load()).toEqual({ userId: "modern-user", registrationConfirmed: true });
    expect(global.GM.setValue).toHaveBeenCalledWith(CREDENTIALS_KEY, {
      userId: "modern-user",
      registrationConfirmed: true,
    });

    await store.clear();
    expect(global.GM.deleteValue).toHaveBeenCalledWith(CREDENTIALS_KEY);
    expect(await store.load()).toBeNull();
  });

  it("uses legacy synchronous storage methods when modern GM methods are absent", async () => {
    let value = null;
    global.GM_getValue = jest.fn((_key, fallbackValue) => value ?? fallbackValue);
    global.GM_setValue = jest.fn((_key, nextValue) => {
      value = nextValue;
    });
    global.GM_deleteValue = jest.fn(() => {
      value = null;
    });
    const store = createGmCredentialStore();

    await store.save({ userId: "legacy-user", registrationConfirmed: true });
    expect(await store.load()).toEqual({ userId: "legacy-user", registrationConfirmed: true });
    await store.clear();
    expect(global.GM_deleteValue).toHaveBeenCalledWith(CREDENTIALS_KEY);
    expect(await store.load()).toBeNull();
  });

  it("falls back to a null value when a legacy manager has no delete method", async () => {
    global.GM_getValue = jest.fn(async (_key, fallbackValue) => fallbackValue);
    global.GM_setValue = jest.fn(async () => undefined);

    await createGmCredentialStore().clear();
    expect(global.GM_setValue).toHaveBeenCalledWith(CREDENTIALS_KEY, null);
  });

  it("normalizes invalid and unconfirmed stored values", async () => {
    global.GM = {
      getValue: jest
        .fn()
        .mockResolvedValueOnce("invalid")
        .mockResolvedValueOnce({ userId: "pending", registrationConfirmed: false }),
    };
    const store = createGmCredentialStore();

    expect(await store.load()).toBeNull();
    expect(await store.load()).toEqual({ userId: "pending", registrationConfirmed: false });
  });

  it("propagates storage failures and reports a missing storage API", async () => {
    global.GM = { getValue: jest.fn(async () => Promise.reject(new Error("GM storage failed"))) };
    await expect(createGmCredentialStore().load()).rejects.toThrow("GM storage failed");

    delete global.GM;
    await expect(createGmCredentialStore().load()).rejects.toThrow("Userscript storage API is unavailable");
    await expect(createGmCredentialStore().save({ userId: "no-storage", registrationConfirmed: true })).rejects.toThrow(
      "Userscript storage API is unavailable",
    );
  });
});
