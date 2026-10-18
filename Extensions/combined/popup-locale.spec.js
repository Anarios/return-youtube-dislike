/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");

jest.mock("./src/consent-prompt", () => ({ waitForCoreDataConsent: () => new Promise(() => {}) }));
jest.mock("./src/core-data-consent", () => ({ onCoreDataPermissionChanged: jest.fn() }));

describe("popup locale direction", () => {
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.removeAttribute("dir");
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    const messages = require("./_locales/en/messages.json");
    global.chrome = {
      i18n: { getMessage: jest.fn((key) => messages[key]?.message || "") },
      runtime: { getManifest: () => ({ version: "1.0.0" }) },
      storage: {
        sync: { get: jest.fn(), set: jest.fn() },
        onChanged: { addListener: jest.fn() },
      },
    };
  });

  afterEach(() => {
    delete global.chrome;
    document.documentElement.removeAttribute("dir");
  });

  test.each(["rtl", "ltr"])("uses %s locale direction while localizing the popup", (direction) => {
    const getMessage = chrome.i18n.getMessage.getMockImplementation();
    chrome.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? direction : getMessage(key)));

    require("./popup");

    expect(document.documentElement.dir).toBe(direction);
    expect(document.querySelector("h1").textContent).toBe("Return YouTube Dislike");
    expect(document.documentElement.innerHTML).not.toContain("__MSG_");
  });

  test.each(["", "auto"])("preserves existing direction when locale metadata is %j", (direction) => {
    document.documentElement.dir = "rtl";
    chrome.i18n.getMessage.mockImplementation((key) => (key === "@@bidi_dir" ? direction : ""));

    require("./popup");

    expect(document.documentElement.dir).toBe("rtl");
  });
});
