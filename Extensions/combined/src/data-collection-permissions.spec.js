import {
  hasAuthenticationDataPermission,
  onAuthenticationDataPermissionRemoved,
  usesFirefoxDataCollectionConsent,
} from "./data-collection-permissions";

const categories = ["authenticationInfo", "personallyIdentifyingInfo"];
const firefoxManifest = { browser_specific_settings: { gecko: { data_collection_permissions: {} } } };

describe("account permission compatibility helpers", () => {
  afterEach(() => {
    delete global.browser;
    delete global.chrome;
  });

  test.each([[], ["authenticationInfo"], ["personallyIdentifyingInfo"], undefined, null, "authenticationInfo"])(
    "fails closed for incomplete account grants %j",
    async (granted) => {
      global.browser = {
        runtime: { getManifest: () => firefoxManifest },
        permissions: {
          getAll: jest.fn().mockResolvedValue({ data_collection: granted }),
          contains: jest.fn().mockResolvedValue(true),
        },
      };
      expect(await hasAuthenticationDataPermission()).toBe(false);
      expect(browser.permissions.contains).not.toHaveBeenCalled();
    },
  );

  test("both account categories grant account access", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll: jest.fn().mockResolvedValue({ data_collection: categories }) },
    };
    expect(await hasAuthenticationDataPermission()).toBe(true);
  });

  test("content scripts query the feature map through the background", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest, sendMessage: jest.fn().mockResolvedValue({ granted: true }) },
    };
    expect(await hasAuthenticationDataPermission()).toBe(true);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      message: "ryd_has_feature_consent",
      feature: "account",
    });
    expect(await hasAuthenticationDataPermission({ queryBackground: false })).toBe(false);
  });

  test("private windows never query account permissions", async () => {
    global.browser = {
      extension: { inIncognitoContext: true },
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll: jest.fn() },
    };
    expect(await hasAuthenticationDataPermission()).toBe(false);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
  });

  test("only removal of authenticationInfo ends the account session", () => {
    let removed;
    const listener = jest.fn();
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: {
        onRemoved: { addListener: (value) => (removed = value), removeListener: jest.fn() },
      },
    };
    const unsubscribe = onAuthenticationDataPermissionRemoved(listener);
    for (const category of ["personallyIdentifyingInfo", "websiteActivity", "websiteContent"]) {
      removed({ data_collection: [category] });
    }
    expect(listener).not.toHaveBeenCalled();
    removed({ data_collection: ["authenticationInfo"] });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(browser.permissions.onRemoved.removeListener).toHaveBeenCalledWith(removed);
  });

  test("an unavailable permissions API fails closed", async () => {
    global.browser = {
      runtime: { getManifest: () => firefoxManifest },
      permissions: { getAll: jest.fn().mockRejectedValue(new Error("Unavailable")) },
    };
    expect(await hasAuthenticationDataPermission()).toBe(false);
  });

  test("Chrome keeps account access without Firefox categories", async () => {
    global.chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
      permissions: { request: jest.fn() },
    };
    expect(usesFirefoxDataCollectionConsent()).toBe(false);
    expect(await hasAuthenticationDataPermission()).toBe(true);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });
});
