/** @jest-environment jsdom */

import { discussionError, discussionLanguage, discussionText } from "./localize";
import { shortDate } from "./dom";

const fs = require("fs");
const path = require("path");
const localeRoot = path.resolve(__dirname, "../../_locales");
const catalogues = fs.readdirSync(localeRoot).map((code) => [code, require(`${localeRoot}/${code}/messages.json`)]);
const english = require("../../_locales/en/messages.json");
const german = require("../../_locales/de/messages.json");
const dynamicKeys = Object.keys(english).filter(
  (key) => key.startsWith("discussion_") && /\$\d+/.test(english[key].message),
);

afterEach(() => {
  document.documentElement.lang = "";
  jest.restoreAllMocks();
});

test.each(catalogues)("selects the %s catalogue with a locale suitable for dates and counts", (code, catalogue) => {
  const language = discussionLanguage(code);
  expect(language).toBe(code.replace(/_/g, "-"));
  expect(discussionText("title", [], code)).toBe(catalogue.discussion_title.message);
  expect(() => (1234).toLocaleString(language)).not.toThrow();
  expect(() => shortDate("2026-10-18T12:00:00Z", language)).not.toThrow();
});

test.each(catalogues)("substitutes the dynamic discussion messages from %s", (code, catalogue) => {
  const substitutions = ["First value", "Second value"];
  for (const key of dynamicKeys) {
    const expected = catalogue[key].message.replace(/\$(\d+)/g, (_, number) => substitutions[Number(number) - 1]);
    expect(discussionText(key.slice("discussion_".length), substitutions, code)).toBe(expected);
  }
});

test.each([
  ["DE-de", "de"],
  ["be_BY", "be"],
  ["ru_RU", "ru"],
  ["es-419", "es"],
  ["in-ID", "id"],
  ["pt", "pt-BR"],
  [" pt_br ", "pt-BR"],
  ["pt-PT", "pt-BR"],
  ["sv", "sv-SE"],
  ["SV_se", "sv-SE"],
  ["sv-FI", "sv-SE"],
  ["zh", "zh-CN"],
  ["zh_cn", "zh-CN"],
  ["ZH_tw", "zh-TW"],
  ["zh-SG", "zh-CN"],
  ["zh-HK", "zh-TW"],
  ["zh-MO", "zh-TW"],
  ["zh-Hans", "zh-CN"],
  ["zh-Hant", "zh-TW"],
  ["zh-Hans-TW", "zh-CN"],
  ["zh-Hant-CN", "zh-TW"],
  ["zh-TW-u-nu-hanidec", "zh-TW"],
])("normalizes %s to %s", (input, expected) => {
  expect(discussionLanguage(input)).toBe(expected);
  expect(discussionText("title", [], input)).toBe(discussionText("title", [], expected));
});

test.each(["", "xx", "ar-SA", "not a locale", "ru--RU", "ru!", null, 42])(
  "falls back to English for %j",
  (language) => {
    expect(discussionLanguage(language)).toBe("en");
    expect(discussionText("title", [], language)).toBe(english.discussion_title.message);
  },
);

test("prefers YouTube's language over the browser and observes later language changes", () => {
  jest.spyOn(navigator, "language", "get").mockReturnValue("ru-RU");
  document.documentElement.lang = "de-DE";
  expect(discussionLanguage()).toBe("de");
  expect(discussionText("title")).toBe(german.discussion_title.message);
  document.documentElement.lang = "zh-Hant";
  expect(discussionLanguage()).toBe("zh-TW");
  document.documentElement.lang = "xx";
  expect(discussionLanguage()).toBe("en");
  document.documentElement.lang = "";
  expect(discussionLanguage()).toBe("ru");
});

test.each([undefined, { message: "" }])("falls back to English when a translated message is %j", (entry) => {
  const original = german.discussion_characters;
  try {
    german.discussion_characters = entry;
    expect(discussionText("characters", [12, 2000], "de")).toBe("12 / 2000");
  } finally {
    german.discussion_characters = original;
  }
});

test("keeps unknown keys and preserves literal and missing substitution values", () => {
  expect(discussionText("unknownKey", [], "de")).toBe("unknownKey");
  expect(discussionText("characters", [0, "$1"], "en")).toBe("0 / $1");
  expect(discussionText("characters", [12], "en")).toBe("12 / ");
});

test.each([
  [{ code: "invalid_session" }, "signInRequired"],
  [{ code: "membership_inactive" }, "tierRequired"],
  [{ code: "made_for_kids" }, "unavailable"],
  [{ code: "comment_not_found" }, "commentUnavailable"],
  [{ code: "nickname_taken" }, "nicknameTaken"],
  [{ code: "conflict", status: 403 }, "conflict"],
  [{ status: 401 }, "signInRequired"],
  [{ status: 403 }, "forbidden"],
  [{ status: 429 }, "rateLimited"],
  [{ code: "unknown", status: 500 }, "error"],
  [null, "error"],
])("preserves localized error mapping for %j", (error, key) => {
  document.documentElement.lang = "de";
  expect(discussionError(error)).toBe(discussionText(key, [], "de"));
});
