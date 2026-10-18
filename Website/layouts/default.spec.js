/* eslint-env jest */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const layoutPath = path.join(__dirname, "default.vue");
const layoutScript = fs.readFileSync(layoutPath, "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];

function createLayout(browserLocale, savedLocale) {
  const localStorage = {
    getItem(key) {
      return this[key] ?? null;
    },
    setItem(key, value) {
      this[key] = value;
    },
    removeItem(key) {
      delete this[key];
    },
  };
  if (savedLocale !== undefined) localStorage.locale = savedLocale;

  const context = {
    module: { exports: {} },
    process: { client: true },
    navigator: { language: browserLocale },
    localStorage,
    require,
  };
  const executableScript = layoutScript
    .replace(
      'import { readLocalePreference, writeLocalePreference } from "../utils/locale";',
      'const { readLocalePreference, writeLocalePreference } = require("../utils/locale");'
    )
    .replace("export default", "module.exports =");
  vm.runInNewContext(executableScript, context, { filename: layoutPath });

  const component = context.module.exports;
  const instance = {
    $vuetify: {
      lang: {
        current: "en",
        defaultLocale: "en",
        locales: { en: {}, fa: {}, pt_BR: {} },
      },
      rtl: false,
    },
  };
  for (const [name, method] of Object.entries(component.methods)) {
    instance[name] = method.bind(instance);
  }
  component.created.call(instance);

  return {
    instance,
    htmlAttrs: () => component.head.call(instance).htmlAttrs,
    localStorage,
  };
}

test.each([
  ["browser preference", "fa-IR", undefined],
  ["saved preference", "en-US", "fa"],
])("initializes Persian direction from the %s", (_, browserLocale, savedLocale) => {
  const layout = createLayout(browserLocale, savedLocale);

  expect(layout.instance.$vuetify.lang.current).toBe("fa");
  expect(layout.instance.$vuetify.rtl).toBe(true);
  expect(layout.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
});

test("manual Persian selection updates direction and persists for the next visit", () => {
  const layout = createLayout("en-US");

  layout.instance.changeLocale("fa");

  expect(layout.instance.$vuetify.lang.current).toBe("fa");
  expect(layout.instance.$vuetify.rtl).toBe(true);
  expect(layout.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
  expect(createLayout("en-US", layout.localStorage.locale).htmlAttrs()).toEqual({
    lang: "fa",
    dir: "rtl",
  });
});

test("switching from Persian to English restores application and document direction", () => {
  const layout = createLayout("fa-IR");

  layout.instance.changeLocale("en");

  expect(layout.instance.$vuetify.lang.current).toBe("en");
  expect(layout.instance.$vuetify.rtl).toBe(false);
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  expect(createLayout("fa-IR", layout.localStorage.locale).htmlAttrs()).toEqual({
    lang: "en",
    dir: "ltr",
  });
});

test("returning to the browser's English locale clears RTL direction", () => {
  const layout = createLayout("en-US", "fa");

  layout.instance.changeLocale("en");

  expect(layout.instance.$vuetify.rtl).toBe(false);
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
});

test("uses a valid language tag for locales with an underscore", () => {
  const layout = createLayout("en-US", "pt_BR");

  expect(layout.htmlAttrs()).toEqual({ lang: "pt-BR", dir: "ltr" });
});

test.each([
  ["browser preference", "nl-NL", undefined],
  ["saved preference", "en-US", "nl"],
])("uses the displayed fallback language for an unsupported %s", (_, browserLocale, savedLocale) => {
  const layout = createLayout(browserLocale, savedLocale);

  expect(layout.instance.$vuetify.lang.current).toBe("en");
  expect(layout.instance.$vuetify.rtl).toBe(false);
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  expect(layout.localStorage.locale).toBe(savedLocale);
});
