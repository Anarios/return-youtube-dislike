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
  refreshPremiumTeaser: jest.fn(),
  setTeaserSuppressed: jest.fn(),
  TEASER_SUPPRESSION_REASON_PREMIUM: "premium",
}));

jest.mock("./data-collection-permissions", () => ({
  hasAuthenticationDataPermission: jest.fn(),
  usesFirefoxDataCollectionConsent: jest.fn(),
}));

jest.mock("./core-data-consent", () => ({ hasFeaturePermission: jest.fn(), onDataPermissionsChanged: jest.fn() }));

jest.mock("./private-browsing", () => ({
  ...jest.requireActual("./private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));
import { isPrivateBrowsingContext } from "./private-browsing";

import { initPatreonFeatures, patreonState } from "./patreon";

const analyticsMocks = jest.requireMock("./premiumAnalytics");
const consentMocks = jest.requireMock("./data-collection-permissions");
const permissionMocks = jest.requireMock("./core-data-consent");

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Patreon authentication consent", () => {
  let messageListener;
  let permissionRemovedListener;

  beforeEach(() => {
    isPrivateBrowsingContext.mockReturnValue(false);
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
    permissionMocks.hasFeaturePermission.mockResolvedValue(true);
    permissionMocks.onDataPermissionsChanged.mockImplementation((listener) => {
      permissionRemovedListener = listener;
      return () => {};
    });
  });

  afterEach(() => {
    delete global.chrome;
  });

  it("skips all private account reads, teasers and session listeners even when initialized directly", async () => {
    isPrivateBrowsingContext.mockReturnValue(true);
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    initPatreonFeatures();
    await flushPromises();
    expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
    expect(consentMocks.hasAuthenticationDataPermission).not.toHaveBeenCalled();
    expect(permissionMocks.onDataPermissionsChanged).not.toHaveBeenCalled();
    expect(jest.requireMock("./premiumAnalytics/teaser").initPremiumTeaser).not.toHaveBeenCalled();
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
  });

  it("removes premium panels on navigation only once the extension context is gone", async () => {
    const { setTeaserSuppressed } = jest.requireMock("./premiumAnalytics/teaser");
    const navigate = () => document.dispatchEvent(new Event("yt-navigate-finish"));
    chrome.runtime.id = "extension-id";
    initPatreonFeatures();
    await flushPromises();
    document.body.innerHTML = '<div class="ryd-premium-feature"></div>';
    analyticsMocks.teardownPremiumAnalytics.mockClear();
    setTeaserSuppressed.mockClear();

    navigate();
    expect(document.querySelector(".ryd-premium-feature")).not.toBeNull();
    expect(analyticsMocks.teardownPremiumAnalytics).not.toHaveBeenCalled();
    expect(setTeaserSuppressed).not.toHaveBeenCalled();

    delete chrome.runtime.id;
    navigate();
    expect(document.querySelector(".ryd-premium-feature")).toBeNull();
    expect(setTeaserSuppressed).toHaveBeenCalledWith(true, "orphaned");
    expect(analyticsMocks.teardownPremiumAnalytics).toHaveBeenCalledTimes(1);

    navigate();
    expect(analyticsMocks.teardownPremiumAnalytics).toHaveBeenCalledTimes(1);
  });

  it("does not restore premium panels when a permission check resolves after the extension context is gone", async () => {
    const pending = [];
    permissionMocks.hasFeaturePermission.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((_keys, callback) =>
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "token",
      }),
    );
    chrome.runtime.id = "extension-id";
    initPatreonFeatures();
    await flushPromises();
    expect(pending.length).toBeGreaterThan(0);

    delete chrome.runtime.id;
    document.dispatchEvent(new Event("yt-navigate-finish"));
    pending.forEach((resolve) => resolve(true));
    await flushPromises();

    expect(analyticsMocks.updatePremiumSession).not.toHaveBeenCalled();
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
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
    permissionRemovedListener({ added: [], removed: ["authenticationInfo"] });

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
    permissionRemovedListener({ added: [], removed: ["authenticationInfo"] });
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

  it("preserves account state when vote sharing is revoked", async () => {
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) =>
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "fixture-session",
      }),
    );
    initPatreonFeatures();
    await flushPromises();
    permissionRemovedListener({ added: [], removed: ["websiteActivity"] });
    expect(patreonState.sessionToken).toBe("fixture-session");
    expect(jest.requireMock("./premiumAnalytics/teaser").refreshPremiumTeaser).toHaveBeenCalled();
  });

  it("hides premium data on profile permission removal and restores it after a grant", async () => {
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) =>
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "fixture-session",
      }),
    );
    initPatreonFeatures();
    await flushPromises();
    permissionRemovedListener({ added: [], removed: ["personallyIdentifyingInfo"] });
    expect(patreonState.sessionToken).toBeNull();
    expect(analyticsMocks.teardownPremiumAnalytics).toHaveBeenCalled();
    permissionRemovedListener({ added: ["personallyIdentifyingInfo"], removed: [] });
    await flushPromises();
    expect(patreonState.sessionToken).toBe("fixture-session");
  });

  it("retains the account while browsing access is denied and starts premium data after a grant", async () => {
    let browsing = false;
    permissionMocks.hasFeaturePermission.mockImplementation(async () => browsing);
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) =>
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "fixture-session",
      }),
    );
    initPatreonFeatures();
    await flushPromises();
    expect(patreonState.authenticated).toBe(true);
    expect(patreonState.sessionToken).toBe("fixture-session");
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
    expect(analyticsMocks.updatePremiumSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: "fixture-session" }),
    );
    const reads = chrome.storage.sync.get.mock.calls.length;
    browsing = true;
    permissionRemovedListener({ added: ["browsingActivity"], removed: [] });
    await flushPromises();
    expect(analyticsMocks.initPremiumAnalytics).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.updatePremiumSession).toHaveBeenLastCalledWith({
      token: "fixture-session",
      active: true,
      membershipTier: "premium",
    });
    expect(chrome.storage.sync.get).toHaveBeenCalledTimes(reads);
    browsing = false;
    permissionRemovedListener({ added: [], removed: ["browsingActivity"] });
    expect(analyticsMocks.teardownPremiumAnalytics).toHaveBeenCalled();
    expect(analyticsMocks.updatePremiumSession).toHaveBeenLastCalledWith({ token: null, active: false });
    expect(patreonState.sessionToken).toBe("fixture-session");
  });

  it("does not restore premium UI from a permission check started before browsing revocation", async () => {
    consentMocks.hasAuthenticationDataPermission.mockResolvedValue(true);
    chrome.storage.sync.get.mockImplementation((keys, callback) =>
      callback({
        patreonAuthenticated: true,
        patreonUser: { hasActiveMembership: true, membershipTier: "premium" },
        patreonSessionToken: "fixture-session",
      }),
    );
    initPatreonFeatures();
    await flushPromises();
    permissionRemovedListener({ added: [], removed: ["browsingActivity"] });
    let complete;
    permissionMocks.hasFeaturePermission.mockReturnValueOnce(new Promise((resolve) => (complete = resolve)));
    permissionRemovedListener({ added: ["browsingActivity"], removed: [] });
    permissionRemovedListener({ added: [], removed: ["browsingActivity"] });
    analyticsMocks.initPremiumAnalytics.mockClear();
    complete(true);
    await flushPromises();
    expect(analyticsMocks.initPremiumAnalytics).not.toHaveBeenCalled();
    expect(analyticsMocks.updatePremiumSession).toHaveBeenLastCalledWith({ token: null, active: false });
    expect(patreonState.sessionToken).toBe("fixture-session");
    permissionRemovedListener({ added: ["browsingActivity"], removed: [] });
    await flushPromises();
    expect(analyticsMocks.initPremiumAnalytics).toHaveBeenCalledTimes(1);
  });
});
