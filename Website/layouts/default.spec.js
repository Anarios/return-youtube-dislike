const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readLocalePreference, writeLocalePreference } = require("../utils/locale");

const layoutPath = path.join(__dirname, "default.vue");
const layoutScript = fs.readFileSync(layoutPath, "utf8").match(/<script setup>([\s\S]*?)<\/script>/)[1];

function createLayout(browserLocale, savedLocale, browser = { name: "Chrome", version: "130.0" }) {
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
  const locale = {
    current: { value: "en" },
    messages: { value: { en: {}, fa: {}, pt_BR: {} } },
  };
  locale.isRtl = {
    get value() {
      return locale.current.value === "fa";
    },
  };
  const route = { path: "/" };
  let head;
  let mount;
  let unmount;
  let warning;
  const clearTimeout = jest.fn();
  const context = {
    module: { exports: {} },
    navigator: { language: browserLocale },
    localStorage,
    ref: (value) => ({ value }),
    computed: (options) => ({
      get value() {
        return options.get();
      },
    }),
    useRoute: () => route,
    useLocale: () => locale,
    useUserAgent: () => ({ value: browser }),
    useHead: (callback) => {
      head = callback;
    },
    onMounted: (callback) => {
      mount = callback;
    },
    onBeforeUnmount: (callback) => {
      unmount = callback;
    },
    setTimeout: (callback) => {
      warning = callback;
      return 1;
    },
    clearTimeout,
    readLocalePreference,
    writeLocalePreference,
  };
  const executableScript = layoutScript.replace(/^import .*;$/gm, "");
  vm.runInNewContext(
    `${executableScript}\nmodule.exports = { changeLocale, showBrowserAlert, unsupportedBrowser, activeTab };`,
    context,
    { filename: layoutPath },
  );

  return {
    ...context.module.exports,
    locale,
    route,
    htmlAttrs: () => head().htmlAttrs,
    mount: () => mount(),
    unmount: () => unmount(),
    warn: () => warning(),
    clearTimeout,
    localStorage,
  };
}

test.each([
  ["/", "/"],
  ["/install", "/install"],
  ["/docs/fetching", "/docs"],
  ["/pay/crypto", null],
  ["/debug", null],
])("selects the matching navigation tab on %s", (path, selected) => {
  const layout = createLayout("en-US");
  layout.route.path = path;
  expect(layout.activeTab.value).toBe(selected);
});

test("keeps the prerendered English language until the client mounts", () => {
  const layout = createLayout("fa-IR");
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  layout.mount();
  expect(layout.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
});

test.each([
  ["browser preference", "fa-IR", undefined],
  ["saved preference", "en-US", "fa"],
])("initializes Persian direction from the %s", (_, browserLocale, savedLocale) => {
  const layout = createLayout(browserLocale, savedLocale);
  layout.mount();
  expect(layout.locale.current.value).toBe("fa");
  expect(layout.locale.isRtl.value).toBe(true);
  expect(layout.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
});

test("manual Persian selection updates direction and persists for the next visit", () => {
  const layout = createLayout("en-US");
  layout.mount();
  layout.changeLocale("fa");
  expect(layout.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
  const nextVisit = createLayout("en-US", layout.localStorage.locale);
  nextVisit.mount();
  expect(nextVisit.htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
});

test("switching from Persian to English restores application and document direction", () => {
  const layout = createLayout("fa-IR");
  layout.mount();
  layout.changeLocale("en");
  expect(layout.locale.isRtl.value).toBe(false);
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  const nextVisit = createLayout("fa-IR", layout.localStorage.locale);
  nextVisit.mount();
  expect(nextVisit.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
});

test("returning to the browser's English locale clears RTL direction and the saved choice", () => {
  const layout = createLayout("en-US", "fa");
  layout.mount();
  layout.changeLocale("en");
  expect(layout.locale.isRtl.value).toBe(false);
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  expect(layout.localStorage.locale).toBeUndefined();
});

test("uses a valid language tag for locales with an underscore", () => {
  const layout = createLayout("en-US", "pt_BR");
  layout.mount();
  expect(layout.htmlAttrs()).toEqual({ lang: "pt-BR", dir: "ltr" });
});

test.each([
  ["browser preference", "nl-NL", undefined],
  ["saved preference", "en-US", "nl"],
])("uses the displayed fallback language for an unsupported %s", (_, browserLocale, savedLocale) => {
  const layout = createLayout(browserLocale, savedLocale);
  layout.mount();
  expect(layout.htmlAttrs()).toEqual({ lang: "en", dir: "ltr" });
  expect(layout.localStorage.locale).toBe(savedLocale);
});

test.each([
  ["Chrome", "69.0", true],
  ["Chrome", "70.0", false],
  ["Firefox", "59.0", true],
  ["Firefox", "60.0", false],
  ["Safari", "13.0", false],
])("preserves the unsupported browser warning for %s %s", (name, version, expected) => {
  const layout = createLayout("en-US", undefined, { name, version });
  layout.mount();
  expect(layout.showBrowserAlert.value).toBe(false);
  layout.warn();
  expect(layout.showBrowserAlert.value).toBe(expected);
  if (expected) expect(layout.unsupportedBrowser.value).toEqual({ name, major: Number.parseInt(version, 10) });
});

test("clears the delayed browser warning when the layout unmounts", () => {
  const layout = createLayout("en-US");
  layout.mount();
  layout.unmount();
  expect(layout.clearTimeout).toHaveBeenCalledWith(1);
});
