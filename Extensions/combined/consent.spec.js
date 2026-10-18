/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");
jest.mock("./src/core-data-consent", () => ({
  hasCoreDataPermission: jest.fn(),
  requestCoreDataPermission: jest.fn(),
  consentApi: jest.fn(),
}));
jest.mock("./src/private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Firefox consent explainer", () => {
  let permission;
  let local;
  let sendMessage;
  function openExplainer({ privateBrowsing = false, canRequest = true } = {}) {
    jest.resetModules();
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "consent.html"), "utf8");
    permission = require("./src/core-data-consent");
    require("./src/private-browsing").isPrivateBrowsingContext.mockReturnValue(privateBrowsing);
    local = { get: jest.fn(), set: jest.fn(async () => {}), remove: jest.fn(async () => {}) };
    sendMessage = jest.fn(async () => ({ success: true }));
    permission.consentApi.mockReturnValue({
      storage: { local },
      runtime: { sendMessage },
      ...(canRequest ? { permissions: { request: jest.fn() } } : {}),
    });
    permission.hasCoreDataPermission.mockResolvedValue(false);
    permission.requestCoreDataPermission.mockResolvedValue(false);
    const continueButton = document.getElementById("consent-continue");
    require("./consent");
    return continueButton;
  }
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    openExplainer();
  });

  test("the compact page leaves explanations collapsed until Read more is selected", () => {
    expect(document.getElementById("permission-details").open).toBe(false);
    expect(document.getElementById("consent-continue").textContent).toBe("Allow in Firefox");
  });

  test("Read more links expand explanations without requesting permission", () => {
    window.history.replaceState(null, "", "/#permission-details");
    openExplainer();
    expect(document.getElementById("permission-details").open).toBe(true);
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("reading the category explanations requests no permissions", () => {
    const details = document.getElementById("permission-details");
    expect(details.querySelectorAll("dt")).toHaveLength(4);
    expect(details.textContent).toContain("Authentication information");
    details.querySelector("summary").click();
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("opening the explainer and selecting Not now request no permissions", async () => {
    expect(document.querySelector("main").textContent).toMatch(/random ID/);
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    document.getElementById("consent-decline").click();
    await flush();
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    expect(local.set).toHaveBeenCalledWith({ rydConsentDismissed: true });
  });

  test("Continue requests native permission directly and denial keeps voting paused", async () => {
    document.getElementById("consent-continue").click();
    expect(permission.requestCoreDataPermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(local.set).toHaveBeenCalledWith({ rydConsentDismissed: true });
    expect(document.getElementById("consent-continue").disabled).toBe(false);
    expect(local.remove).not.toHaveBeenCalled();
  });

  test("acceptance requires a confirmed grant and clears the dismissal", async () => {
    permission.requestCoreDataPermission.mockResolvedValue(true);
    permission.hasCoreDataPermission.mockResolvedValue(true);
    document.getElementById("consent-continue").click();
    await flush();
    expect(local.remove).toHaveBeenCalledWith("rydConsentDismissed");
    expect(document.getElementById("consent-actions").hidden).toBe(true);
  });

  test("a page-embedded explainer opens the extension consent page without requesting permissions", async () => {
    openExplainer({ canRequest: false });
    document.getElementById("consent-continue").click();
    await flush();
    expect(sendMessage).toHaveBeenCalledWith({ message: "ryd_open_consent" });
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    expect(document.getElementById("consent-next-step").textContent).toMatch(/permission page/);
  });

  test.each([true, false])(
    "private setup stays local without requesting permissions or opening a normal page when request API availability is %s",
    async (canRequest) => {
      const continueButton = openExplainer({ privateBrowsing: true, canRequest });
      expect(document.getElementById("consent-next-step").textContent).toBe(
        "Enable RYD in a normal Firefox window to load counts here.",
      );
      expect(document.querySelector("main").textContent).toContain(
        "Counts only in private windows. Voting, sign-in, premium analytics and discussions are unavailable here.",
      );
      expect(document.querySelector("main").textContent).not.toMatch(/random ID|Allow in Firefox|Continue/);
      expect(document.getElementById("consent-continue")).toBeNull();
      continueButton.click();
      document.getElementById("consent-decline").click();
      await flush();

      expect(permission.consentApi).not.toHaveBeenCalled();
      expect(permission.hasCoreDataPermission).not.toHaveBeenCalled();
      expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
      expect(local.get).not.toHaveBeenCalled();
      expect(local.set).not.toHaveBeenCalled();
      expect(local.remove).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
      expect(document.getElementById("consent-status").textContent).toBe(
        "Enable RYD in a normal Firefox window to load counts here.",
      );
    },
  );
});
