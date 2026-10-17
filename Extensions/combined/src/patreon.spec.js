/**
 * @jest-environment jsdom
 */

jest.mock("./premiumAnalytics", () => ({
  initPremiumAnalytics: jest.fn(),
  teardownPremiumAnalytics: jest.fn(),
  updatePremiumSession: jest.fn(),
}));

jest.mock("./premiumAnalytics/teaser", () => ({
  initPremiumTeaser: jest.fn(),
  setTeaserSuppressed: jest.fn(),
  TEASER_SUPPRESSION_REASON_PREMIUM: "premium",
}));

jest.mock("./data-collection-permissions", () => ({
  hasAuthenticationDataPermission: jest.fn(),
  onAuthenticationDataPermissionRemoved: jest.fn(),
  usesFirefoxDataCollectionConsent: jest.fn(),
}));

import { initPatreonFeatures, patreonState } from "./patreon";

const analyticsMocks = jest.requireMock("./premiumAnalytics");
const consentMocks = jest.requireMock("./data-collection-permissions");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Patreon authentication consent", () => {
  let messageListener;
  let permissionRemovedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '<div class="ryd-premium-feature"></div>';
    patreonState.authenticated = false;
    patreonState.user = null;
    patreonState.sessionToken = null;

    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((listener) => {
            messageListener = listener;
          }),
        },
      },
      storage: {
        sync: {
          get: jest.fn(),
        },
      },
    };

    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(false);
    consentMocks.usesFirefoxDataCollectionConsent.mockReturnValue(true);
    consentMocks.onAuthenticationDataPermissionRemoved.mockImplementation((listener) => {
      permissionRemovedListener = listener;
      return () => {};
    });
  });

  afterEach(() => {
    delete global.chrome;
  });

  it("does not read a cached token without authentication consent", async () => {
    initPatreonFeatures();
    await flushPromises();

    expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.updatePremiumSession).toHaveBeenCalledWith({ token: null, active: false });
  });

  it("rejects a session-token broadcast when consent is absent", async () => {
    initPatreonFeatures();
    await flushPromises();

    messageListener({
      message: "patreon_status_changed",
      authenticated: true,
      user: { hasActiveMembership: true, membershipTier: "premium" },
      sessionToken: "secret-token",
    });
    await flushPromises();

    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.updatePremiumSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: "secret-token" }),
    );
  });

  it("tears down premium state when authentication consent is removed", async () => {
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "secret-token",
      });
    });

    initPatreonFeatures();
    await flushPromises();
    permissionRemovedListener();

    expect(patreonState.authenticated).toBe(false);
    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.updatePremiumSession).toHaveBeenLastCalledWith({ token: null, active: false });
    expect(analyticsMocks.teardownPremiumAnalytics).toHaveBeenCalled();
  });

  it("ignores a cached session read that completes after revocation", async () => {
    let completeRead;
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) => (completeRead = callback));
    initPatreonFeatures();
    await flushPromises();
    permissionRemovedListener();
    completeRead({
      patreonAuthenticated: true,
      patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
      patreonSessionToken: "old-token",
    });
    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
  });

  it("does not apply a delayed authenticated broadcast after logout", async () => {
    initPatreonFeatures();
    await flushPromises();
    let completeConsent;
    consentMocks.hasAuthenticationDataPermission.mockReturnValueOnce(
      new Promise((resolve) => (completeConsent = resolve)),
    );
    messageListener({
      message: "patreon_status_changed",
      authenticated: true,
      user: { hasActiveMembership: true, membershipTier: "premium" },
      sessionToken: "old-token",
    });
    messageListener({ message: "patreon_status_changed", authenticated: false });
    completeConsent(true);
    await flushPromises();
    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
  });
});
