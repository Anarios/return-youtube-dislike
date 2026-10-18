/* eslint-env jest */
const { readLocalePreference, resolveLocale, writeLocalePreference } = require("./locale");

const supportedLocales = ["en", "es", "it-IT", "pt_BR", "az", "nl", "sv", "hu"];

describe("website locale resolution", () => {
  test.each([
    ["en-US", "en"],
    ["es-MX", "es"],
    ["it-IT", "it-IT"],
    ["it", "it-IT"],
    ["it-CH", "it-IT"],
    ["pt-BR", "pt_BR"],
    ["pt_BR", "pt_BR"],
    ["pt-PT", "pt_BR"],
    ["PT-br", "pt_BR"],
    ["az-AZ", "az"],
    ["nl-NL", "nl"],
    ["sv-SE", "sv"],
    ["hu-HU", "hu"],
    ["zz-ZZ", "en"],
    ["", "en"],
    [undefined, "en"],
  ])("resolves %s to registered locale %s", (locale, expected) => {
    expect(resolveLocale(locale, supportedLocales)).toBe(expected);
  });
});

describe("website locale preferences", () => {
  function createStorage(values = {}) {
    const items = new Map(Object.entries(values));
    return {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, value),
      removeItem: (key) => items.delete(key),
    };
  }

  test("uses the browser locale when no preference is saved", () => {
    expect(readLocalePreference(createStorage(), "pt-BR", supportedLocales)).toBe("pt_BR");
  });

  test.each(["pt_BR", "pt-BR", "it-IT", "es"])("preserves a supported saved choice %s", (locale) => {
    expect(readLocalePreference(createStorage({ locale }), "nl-NL", supportedLocales)).toBe(
      resolveLocale(locale, supportedLocales)
    );
  });

  test("falls back to English for an unsupported saved choice", () => {
    expect(readLocalePreference(createStorage({ locale: "zz" }), "nl-NL", supportedLocales)).toBe("en");
  });

  test("saves a manual choice that differs from the browser locale", () => {
    const storage = createStorage();
    expect(writeLocalePreference(storage, "nl-NL", "pt_BR", supportedLocales)).toBe("pt_BR");
    expect(storage.getItem("locale")).toBe("pt_BR");
    expect(readLocalePreference(storage, "nl-NL", supportedLocales)).toBe("pt_BR");
  });

  test("resets only the locale preference when selecting the browser default", () => {
    const storage = createStorage({ locale: "es", otherSetting: "retained" });
    expect(writeLocalePreference(storage, "pt-BR", "pt_BR", supportedLocales)).toBe("pt_BR");
    expect(storage.getItem("locale")).toBeNull();
    expect(storage.getItem("otherSetting")).toBe("retained");
    expect(readLocalePreference(storage, "pt-BR", supportedLocales)).toBe("pt_BR");
  });
});
