/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
const localesDirectory = path.join(__dirname, "_locales");
const locales = fs.readdirSync(localesDirectory);
const messagesFor = (locale) => require(path.join(localesDirectory, locale, "messages.json"));
const messageKey = (element) => element.textContent.trim().match(/^__MSG_(\w+)__$/)?.[1];

describe("popup settings layout", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test("console logging sits alone in the last group under the developer heading", () => {
    const groups = [...document.querySelectorAll("#advancedSettings .settings-group")];
    const developer = groups.at(-1);
    const heading = document.getElementById(developer.getAttribute("aria-labelledby"));
    expect(messageKey(heading)).toBe("developerSettings");
    expect(developer.querySelectorAll("input")).toHaveLength(1);
    expect(developer.querySelector("#disable_logging")).not.toBeNull();
    expect(groups.slice(0, -1).some((group) => group.querySelector("#disable_logging"))).toBe(false);
  });

  test.each(locales)("%s settings labels do not end with a period", (locale) => {
    const messages = messagesFor(locale);
    const keys = [...document.querySelectorAll("#advancedSettings .switchLabel, #advancedSettings h3")]
      .map(messageKey)
      .filter(Boolean);
    expect(keys.length).toBeGreaterThan(5);
    const withPeriod = keys.filter((key) => /[.。]$/.test(messages[key]?.message ?? ""));
    expect(withPeriod).toEqual([]);
  });
});
