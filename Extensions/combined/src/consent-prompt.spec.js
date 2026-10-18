/** @jest-environment jsdom */
jest.mock("./core-data-consent", () => ({
  consentApi: jest.fn(),
  hasCoreDataPermission: jest.fn(),
  onCoreDataPermissionChanged: jest.fn(),
}));
jest.mock("./data-collection-permissions", () => ({ usesFirefoxDataCollectionConsent: jest.fn() }));
jest.mock("./private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("consent overlay lifecycle", () => {
  let core;
  let changed;
  let local;
  let waitForConsent;
  beforeEach(() => {
    jest.resetModules();
    core = require("./core-data-consent");
    require("./data-collection-permissions").usesFirefoxDataCollectionConsent.mockReturnValue(true);
    require("./private-browsing").isPrivateBrowsingContext.mockReturnValue(false);
    local = { get: jest.fn(async () => ({})), set: jest.fn(), remove: jest.fn() };
    core.consentApi.mockReturnValue({
      storage: { local },
      runtime: { getURL: () => "moz-extension://fixture/consent.html" },
    });
    core.hasCoreDataPermission.mockResolvedValue(false);
    core.onCoreDataPermissionChanged.mockImplementation((listener) => {
      changed = listener;
      return () => {};
    });
    waitForConsent = require("./consent-prompt").waitForCoreDataConsent;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function mounted() {
    await flush();
    const host = document.querySelector("#ryd-consent-prompt");
    const frame = host.shadowRoot.querySelector("iframe");
    Object.defineProperty(frame, "contentWindow", { value: {} });
    return { host, frame };
  }
  function message(frame, type, source = frame.contentWindow) {
    window.dispatchEvent(
      new MessageEvent("message", {
        source,
        origin: new URL(frame.src).origin,
        data: { type },
      }),
    );
  }

  test("deduplicates prompts and does not resolve until consent is granted", async () => {
    const pending = waitForConsent();
    expect(waitForConsent()).toBe(pending);
    const { host } = await mounted();
    expect(host.hasAttribute("collapsed")).toBe(false);
    changed(true);
    await pending;
    expect(host.isConnected).toBe(false);
  });

  test("a dismissed prompt stays collapsed and can be reopened", async () => {
    local.get.mockResolvedValue({ rydConsentDismissed: true });
    const pending = waitForConsent();
    const { host } = await mounted();
    expect(host.hasAttribute("collapsed")).toBe(true);
    host.shadowRoot.querySelector("button").click();
    expect(host.hasAttribute("collapsed")).toBe(false);
    changed(true);
    await pending;
  });

  test("waits for the active iframe request to finish before unloading it", async () => {
    const pending = waitForConsent({ alwaysExplain: true });
    const { frame, host } = await mounted();
    message(frame, "ryd-consent-requested");
    changed(true);
    await flush();
    expect(host.isConnected).toBe(true);
    core.hasCoreDataPermission.mockResolvedValue(true);
    message(frame, "ryd-consent-granted");
    await pending;
    expect(host.isConnected).toBe(false);
  });

  test("ignores another window's messages and rechecks claimed grants", async () => {
    const pending = waitForConsent();
    const { frame, host } = await mounted();
    message(frame, "ryd-consent-dismissed", {});
    expect(host.hasAttribute("collapsed")).toBe(false);
    message(frame, "ryd-consent-granted");
    await flush();
    expect(host.isConnected).toBe(true);
    message(frame, "ryd-consent-dismissed");
    expect(host.hasAttribute("collapsed")).toBe(true);
    changed(true);
    await pending;
  });

  test("private setup skips stored dismissal state and dismisses only the current overlay", async () => {
    require("./private-browsing").isPrivateBrowsingContext.mockReturnValue(true);
    local.get.mockResolvedValue({ rydConsentDismissed: true });
    const pending = waitForConsent();
    let granted = false;
    void pending.then(() => (granted = true));
    const { frame, host } = await mounted();
    expect(host.hasAttribute("collapsed")).toBe(false);
    expect(local.get).not.toHaveBeenCalled();
    message(frame, "ryd-consent-dismissed");
    await flush();
    expect(host.hasAttribute("collapsed")).toBe(true);
    expect(granted).toBe(false);
    host.shadowRoot.querySelector("button").click();
    expect(host.hasAttribute("collapsed")).toBe(false);
    expect(local.set).not.toHaveBeenCalled();
    expect(local.remove).not.toHaveBeenCalled();
    core.hasCoreDataPermission.mockResolvedValue(true);
    changed(true);
    await pending;
    expect(host.isConnected).toBe(false);
  });

  test.each([false, true])(
    "an existing grant skips setup and stored dismissal state (private=%s)",
    async (privateBrowsing) => {
      require("./private-browsing").isPrivateBrowsingContext.mockReturnValue(privateBrowsing);
      local.get.mockResolvedValue({ rydConsentDismissed: true });
      core.hasCoreDataPermission.mockResolvedValue(true);
      await waitForConsent();
      expect(document.querySelector("#ryd-consent-prompt")).toBeNull();
      expect(core.consentApi).not.toHaveBeenCalled();
      expect(core.onCoreDataPermissionChanged).not.toHaveBeenCalled();
      expect(local.get).not.toHaveBeenCalled();
      expect(local.set).not.toHaveBeenCalled();
      expect(local.remove).not.toHaveBeenCalled();
    },
  );
});
