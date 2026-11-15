/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");

jest.mock("../utils", () => ({
  getBrowser: () => "Chrome",
  localize: (key) => require("../../_locales/en/messages.json")[key]?.message || "",
}));

const { initChangelogPage } = require("./index");

describe("release page locale metadata", () => {
  beforeEach(() => {
    jest.spyOn(document, "readyState", "get").mockReturnValue("complete");
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
    document.documentElement.innerHTML = fs.readFileSync(
      path.join(__dirname, "../../changelog/4/changelog_4.1.html"),
      "utf8",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
  });

  test.each([
    ["fa", "rtl"],
    ["en", "ltr"],
  ])("uses %s language and %s direction while localizing the release page", (locale, direction) => {
    global.chrome = { i18n: { getMessage: (key) => ({ "@@ui_locale": locale, "@@bidi_dir": direction })[key] } };

    initChangelogPage();

    expect(document.documentElement.lang).toBe(locale);
    expect(document.documentElement.dir).toBe(direction);
    expect(document.querySelector("h1").textContent).not.toContain("__MSG_");
    expect(document.documentElement.innerHTML).not.toContain("__MSG_");
  });

  test("explains why some features are paid right under the hero and the Firefox counts prompt", () => {
    global.chrome = { i18n: { getMessage: () => "" } };
    const messages = require("../../_locales/en/messages.json");

    initChangelogPage();

    const appeal = document.getElementById("ryd-appeal-title").closest("section");
    expect(appeal.querySelector("h2").textContent.trim()).toBe(messages.changelog_appeal_title.message);
    expect(appeal.querySelector(".ryd-letter__signature").textContent).toBe(
      messages.changelog_appeal_signature.message,
    );
    expect(appeal.previousElementSibling.id).toBe("ryd-firefox-optin");
    expect(appeal.previousElementSibling.previousElementSibling.classList.contains("ryd-hero")).toBe(true);
    expect(appeal.nextElementSibling.querySelector("#ryd-comments-title")).not.toBeNull();
  });

  test.each([
    ["ryd-changelog-appeal-join", "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649"],
    ["ryd-changelog-upgrade", "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649"],
    ["ryd-changelog-support", "https://returnyoutubedislike.com/help"],
  ])("the %s button opens %s", (id, url) => {
    global.chrome = { i18n: { getMessage: () => "" } };
    const open = jest.spyOn(window, "open").mockImplementation(() => null);

    initChangelogPage();
    document.getElementById(id).click();

    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener");
  });

  test("keeps the original stylesheet while localizing so the release page never renders unstyled", () => {
    global.chrome = { i18n: { getMessage: () => "" } };
    const stylesheet = document.querySelector("link[rel='stylesheet']");

    initChangelogPage();

    expect(stylesheet.isConnected).toBe(true);
    expect(document.title).toBe("Welcome to Return YouTube Dislike");
  });

  test.each(["", "auto"])("preserves document metadata when locale metadata is %j", (metadata) => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    global.chrome = { i18n: { getMessage: (key) => (key === "@@bidi_dir" ? metadata : "") } };

    initChangelogPage();

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
