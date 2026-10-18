/** @jest-environment jsdom */
jest.mock("./core-data-consent", () => ({
  consentApi: jest.fn(),
  hasCoreDataPermission: jest.fn(),
  onCoreDataPermissionChanged: jest.fn(),
}));
jest.mock("./data-collection-permissions", () => ({ usesFirefoxDataCollectionConsent: jest.fn() }));
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
    local = { get: jest.fn(async () => ({})) };
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
});
