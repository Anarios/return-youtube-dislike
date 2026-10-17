/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");
jest.mock("./src/core-data-consent", () => ({
  hasCoreDataPermission: jest.fn(),
  requestCoreDataPermission: jest.fn(),
  consentApi: jest.fn(),
}));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Firefox consent explainer", () => {
  let permission;
  let local;
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "consent.html"), "utf8");
    permission = require("./src/core-data-consent");
    local = { set: jest.fn(async () => {}), remove: jest.fn(async () => {}) };
    permission.consentApi.mockReturnValue({ storage: { local }, permissions: { request: jest.fn() } });
    permission.hasCoreDataPermission.mockResolvedValue(false);
    permission.requestCoreDataPermission.mockResolvedValue(false);
    require("./consent");
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
    jest.resetModules();
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "consent.html"), "utf8");
    permission = require("./src/core-data-consent");
    const sendMessage = jest.fn(async () => ({ success: true }));
    permission.consentApi.mockReturnValue({ storage: { local }, runtime: { sendMessage } });
    require("./consent");
    document.getElementById("consent-continue").click();
    await flush();
    expect(sendMessage).toHaveBeenCalledWith({ message: "ryd_open_consent" });
    expect(permission.requestCoreDataPermission).not.toHaveBeenCalled();
    expect(document.getElementById("consent-next-step").textContent).toMatch(/permission page/);
  });
});
