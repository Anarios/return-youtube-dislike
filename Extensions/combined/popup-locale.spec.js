/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");

jest.mock("./src/discussion/popup", () => ({ initDiscussionPopup: jest.fn() }));

describe("popup locale direction", () => {
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
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
    document.documentElement.removeAttribute("lang");
  });

  test.each([
    ["en_US", "en-US", "123,456"],
    ["pt_BR", "pt-BR", "123.456"],
  ])("initializes number-format controls for browser locale %s", (locale, language, standardExample) => {
    const getMessage = chrome.i18n.getMessage.getMockImplementation();
    chrome.i18n.getMessage.mockImplementation((key) => (key === "@@ui_locale" ? locale : getMessage(key)));

    expect(() => require("./popup")).not.toThrow();

    expect(document.documentElement.lang).toBe(language);
    expect(document.getElementById("number_format_standard").textContent).toBe(standardExample);
    expect(document.getElementById("number_format_compactShort").textContent).toMatch(/123/);
    expect(document.getElementById("number_format_compactLong").textContent).toMatch(/123/);
  });

  test("keeps the original stylesheets while localizing so the popup never renders unstyled", () => {
    const stylesheets = [...document.querySelectorAll("link[rel='stylesheet']")];

    require("./popup");

    expect(stylesheets.length).toBeGreaterThan(0);
    expect(stylesheets.every((link) => link.isConnected)).toBe(true);
    expect(document.title).toBe("Return YouTube Dislike");
    expect(document.querySelector("title").title).toBe("Return YouTube Dislike");
  });

  test("explains why paid features exist in the signed-out account card", () => {
    require("./popup");

    const messages = require("./_locales/en/messages.json");
    const why = document.getElementById("paid-features-why");
    expect(why.textContent).toBe(messages.paidFeaturesWhy.message);
    expect(why.previousElementSibling.id).toBe("patreon-login-btn");
    expect(why.nextElementSibling.id).toBe("patreon-privacy-note");
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
