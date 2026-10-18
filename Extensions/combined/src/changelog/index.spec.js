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

  test.each(["", "auto"])("preserves document metadata when locale metadata is %j", (metadata) => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    global.chrome = { i18n: { getMessage: (key) => (key === "@@bidi_dir" ? metadata : "") } };

    initChangelogPage();

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
