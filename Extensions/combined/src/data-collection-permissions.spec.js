import {
  authenticationDataPermissionWasRemoved,
  hasAuthenticationDataPermission,
  onAuthenticationDataPermissionRemoved,
  requestAuthenticationDataPermission,
  usesFirefoxDataCollectionConsent,
} from "./data-collection-permissions";

const firefoxManifest = {
  browser_specific_settings: {
    gecko: {
      data_collection_permissions: {
        required: ["personallyIdentifyingInfo", "browsingActivity", "websiteContent", "websiteActivity"],
        optional: ["authenticationInfo"],
      },
    },
  },
};

describe("Firefox data-collection permissions", () => {
  afterEach(() => {
    delete global.browser;
    delete global.chrome;
  });

  it("requests only authentication consent within the login gesture", async () => {
    let requestStarted = false;
    const request = jest.fn(() => {
      requestStarted = true;
      return Promise.resolve(true);
    });
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { request, getAll: jest.fn().mockResolvedValue({ data_collection: ["authenticationInfo"] }) },
    };

    const result = requestAuthenticationDataPermission();

    expect(requestStarted).toBe(true);
    expect(request).toHaveBeenCalledWith({ data_collection: ["authenticationInfo"] });
    await expect(result).resolves.toBe(true);
  });

  it("checks the existing Firefox grant without requesting it", async () => {
    const getAll = jest.fn().mockResolvedValue({ permissions: ["identity"], origins: [], data_collection: [] });
    const contains = jest.fn().mockResolvedValue(true);
    const request = jest.fn();
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, contains, request },
    };

    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
    expect(getAll).toHaveBeenCalledWith();
    expect(contains).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([{}, { data_collection: [] }, { data_collection: ["financialAndPaymentInfo"] }])(
    "does not accept a successful request without a recorded authentication grant: %j",
    async (grantedPermissions) => {
      global.browser = {
        runtime: { getManifest: () => firefoxManifest },
        permissions: {
          request: jest.fn().mockResolvedValue(true),
          getAll: jest.fn().mockResolvedValue(grantedPermissions),
          contains: jest.fn().mockResolvedValue(true),
        },
      };

      await expect(requestAuthenticationDataPermission()).resolves.toBe(false);
    },
  );

  it("does not let an existing grant override the user's denied request", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: {
        request: jest.fn().mockResolvedValue(false),
        getAll: jest.fn().mockResolvedValue({ data_collection: ["authenticationInfo"] }),
      },
    };

    await expect(requestAuthenticationDataPermission()).resolves.toBe(false);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
  });

  it("reads the current grant again after it is revoked without a cached result", async () => {
    const getAll = jest
      .fn()
      .mockResolvedValueOnce({ data_collection: ["authenticationInfo"] })
      .mockResolvedValueOnce({ data_collection: [] });
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll, contains: jest.fn().mockResolvedValue(true) },
    };

    await expect(hasAuthenticationDataPermission()).resolves.toBe(true);
    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
  });

  it("fails closed when getAll throws synchronously", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: {
        getAll: () => {
          throw new Error("unavailable");
        },
      },
    };

    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
  });

  it("leaves Chrome behavior unchanged", async () => {
    const request = jest.fn();
    global.chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
      permissions: { request },
    };

    expect(usesFirefoxDataCollectionConsent()).toBe(false);
    await expect(hasAuthenticationDataPermission()).resolves.toBe(true);
    await expect(requestAuthenticationDataPermission()).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("ends account access only when authentication consent is removed", () => {
    expect(authenticationDataPermissionWasRemoved({ data_collection: ["authenticationInfo"] })).toBe(true);
    expect(authenticationDataPermissionWasRemoved({ data_collection: ["financialAndPaymentInfo"] })).toBe(false);
    expect(authenticationDataPermissionWasRemoved({ data_collection: ["websiteContent"] })).toBe(false);
    expect(authenticationDataPermissionWasRemoved({ permissions: ["identity"] })).toBe(false);
    expect(authenticationDataPermissionWasRemoved(undefined)).toBe(false);
  });

  it.each([
    { granted: ["authenticationInfo"], expected: true },
    { granted: ["financialAndPaymentInfo"], expected: false },
    { granted: [], expected: false },
    { granted: undefined, expected: false },
    { granted: null, expected: false },
    { granted: "authenticationInfo", expected: false },
  ])("requires an explicit authentication grant in getAll: $granted", async ({ granted, expected }) => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: {
        contains: jest.fn().mockResolvedValue(true),
        getAll: jest.fn().mockResolvedValue({ permissions: ["identity"], origins: [], data_collection: granted }),
      },
    };
    await expect(hasAuthenticationDataPermission()).resolves.toBe(expected);
  });

  it("does not end the account session when only an obsolete financial grant is removed", () => {
    let removedListener;
    const listener = jest.fn();
    const removeListener = jest.fn();
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: {
        onRemoved: {
          addListener: (callback) => {
            removedListener = callback;
          },
          removeListener,
        },
      },
    };
    const unsubscribe = onAuthenticationDataPermissionRemoved(listener);
    removedListener({ data_collection: ["financialAndPaymentInfo"] });
    expect(listener).not.toHaveBeenCalled();
    removedListener({ data_collection: ["authenticationInfo"] });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(removedListener);
  });

  it("queries the background from a content script without the permissions API", async () => {
    const sendMessage = jest.fn().mockResolvedValue({ granted: true });
    global.browser = { runtime: { getManifest: () => firefoxManifest, sendMessage } };
    await expect(hasAuthenticationDataPermission()).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ message: "ryd_has_authentication_consent" });
    await expect(hasAuthenticationDataPermission({ queryBackground: false })).resolves.toBe(false);
  });

  it("does not fall back to contains or the background when getAll is unavailable", async () => {
    const sendMessage = jest.fn().mockResolvedValue({ granted: true });
    const contains = jest.fn().mockResolvedValue(true);
    global.browser = {
      runtime: { getManifest: () => firefoxManifest, sendMessage },
      permissions: { contains },
    };

    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
    expect(contains).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not fall back to a positive background result after getAll fails", async () => {
    const sendMessage = jest.fn().mockResolvedValue({ granted: true });
    global.browser = {
      runtime: { getManifest: () => firefoxManifest, sendMessage },
      permissions: { getAll: jest.fn().mockRejectedValue(new Error("unavailable")) },
    };

    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed on permission API and background failures", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest, sendMessage: () => Promise.reject(new Error("unavailable")) },
    };
    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
    await expect(requestAuthenticationDataPermission()).resolves.toBe(false);
    global.browser.permissions = {
      getAll: () => Promise.reject(new Error("unavailable")),
      request: () => {
        throw new Error("outside gesture");
      },
    };
    await expect(hasAuthenticationDataPermission()).resolves.toBe(false);
    await expect(requestAuthenticationDataPermission()).resolves.toBe(false);
  });
});
