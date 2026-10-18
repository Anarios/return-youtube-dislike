/** @jest-environment node */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  readWebsiteLocale,
  readExtensionLocale,
  compareExtension,
  compareWebsite,
  checkWebsiteRegistration,
  checkCatalogs,
  main,
} = require("./check-locales");

const message = (text) => ({ message: text });
const websiteSource = (body) => `import { en } from "vuetify/src/locale"; export default { ...en, ${body} };`;

test("extension completeness follows added English keys and validates extra message shapes", () => {
  const result = compareExtension(
    { greeting: message("Hello"), added: message("New") },
    {
      greeting: message("Bonjour"),
      obsolete: { message: null },
    },
  );
  expect(result.errors).toEqual(["added: missing key", "obsolete: message must be a nonempty string"]);
  expect(result.extra).toEqual(["obsolete"]);
});

test.each([null, [], "text", 17])("rejects invalid extension catalogue shape %p", (value) => {
  expect(compareExtension({ hello: message("Hello") }, value).errors).toContain("Locale must be an object");
});

test.each([undefined, null, [], {}, "", "  "])("rejects invalid extension message %p", (value) => {
  expect(compareExtension({ hello: message("Hello") }, { hello: message(value) }).errors).toHaveLength(1);
});

test("checks positional placeholder identity and multiplicity while allowing reordering", () => {
  const base = { greeting: message("$1 has $2 and $1") };
  expect(compareExtension(base, { greeting: message("$1, $1, $2") }).errors).toEqual([]);
  expect(compareExtension(base, { greeting: message("$1, $2") }).errors).toContain(
    "greeting: placeholder tokens differ from English",
  );
  expect(compareExtension(base, { greeting: message("$1, $1, $3") }).errors).toContain(
    "greeting: placeholder tokens differ from English",
  );
});

test("escaped dollars are literal and named placeholders are case-insensitive", () => {
  const base = {
    greeting: { message: "Hello $NAME$ ($$1)", placeholders: { NAME: { content: "$1", example: "Alex" } } },
  };
  const translated = {
    greeting: { message: "Bonjour $name$ ($$2)", placeholders: { name: { content: "$1", example: "Léa" } } },
  };
  expect(compareExtension(base, translated).errors).toEqual([]);
});

test("detects undefined named placeholders and changed substitution definitions", () => {
  const base = { greeting: { message: "$NAME$", placeholders: { NAME: { content: "$1" } } } };
  const swapped = { greeting: { message: "$NAME$", placeholders: { NAME: { content: "$2" } } } };
  expect(compareExtension(base, swapped).errors).toContain("greeting: placeholder definitions differ from English");
  expect(compareExtension(base, { greeting: message("$NAME$") }).errors).toContain(
    "greeting: undefined placeholder $name$",
  );
  expect(compareExtension(base, { greeting: { message: "$NAME$", placeholders: [] } }).errors).toContain(
    "greeting: placeholders must be an object",
  );
});

test("reports identical English strings and extra keys as advisories only", () => {
  const result = compareExtension(
    { brand: message("YouTube") },
    { brand: message("YouTube"), extra: message("Extra") },
  );
  expect(result).toEqual({ errors: [], identical: ["brand"], extra: ["extra"] });
});

test("statically reads website custom strings while excluding the upstream Vuetify spread", () => {
  expect(readWebsiteLocale(websiteSource('home: { name: "Home", quoted: "café" }'))).toEqual({
    home: { name: "Home", quoted: "café" },
  });
  expect(() => readWebsiteLocale(websiteSource("home: { name: runCode() }"))).toThrow(/literal/);
  expect(() => readWebsiteLocale('import other from "elsewhere"; export default {...other}')).toThrow(/Vuetify/);
  expect(() => readWebsiteLocale(websiteSource("home: { ...en }"))).toThrow(/literal/);
});

test("detects duplicate keys before JSON or module object evaluation can hide them", () => {
  expect(() => readExtensionLocale('{"a":{"message":"one"},"a":{"message":"two"}}')).toThrow("Duplicate key: a");
  expect(() => readExtensionLocale('{"a":{"message":"one","message":"two"}}')).toThrow("Duplicate key: message");
  expect(() => readWebsiteLocale(websiteSource('home: { name: "One", name: "Two" }'))).toThrow("Duplicate key: name");
});

test("extension input uses strict JSON syntax", () => {
  expect(() => readExtensionLocale('{"a":{"message":"one",}}')).toThrow();
  expect(() => readExtensionLocale('{a:{message:"one"}}')).toThrow();
});

test("website comparison finds nested missing keys and wrong shapes", () => {
  const base = { links: { name: "Links", added: "Added" } };
  expect(compareWebsite(base, { links: { name: "Liens" } }, "fr").errors).toEqual(["links.added: missing key"]);
  expect(compareWebsite(base, { links: [] }, "fr").errors).toEqual([
    "links.name: missing key",
    "links.added: missing key",
    "links: value must be a nonempty string",
  ]);
});

test("website interpolation checks multiplicity and retains legitimate brand advisories", () => {
  const base = { count: "{0} of {1} ({0})", brand: "Firefox" };
  expect(compareWebsite(base, { count: "{1}: {0}, {0}", brand: "Firefox" }, "fr")).toEqual({
    errors: [],
    extra: [],
    identical: ["brand"],
  });
  expect(compareWebsite(base, { count: "{0} of {1}", brand: "Firefox" }, "fr").errors).toContain(
    "count: placeholder tokens differ from English",
  );
});

test("empty website exceptions apply only to the existing sentence fragments", () => {
  const base = { help: { bullet11: "right now", name: "Help" } };
  expect(compareWebsite(base, { help: { bullet11: "", name: "Hilfe" } }, "de").errors).toEqual([]);
  expect(compareWebsite(base, { help: { bullet11: " ", name: "Hilfe" } }, "de").errors).toHaveLength(1);
  expect(compareWebsite(base, { help: { bullet11: "", name: "Aide" } }, "fr").errors).toHaveLength(1);
  expect(compareWebsite(base, { help: { bullet11: "", name: "" } }, "de").errors).toEqual([
    "help.name: value must be a nonempty string",
  ]);
});

const config = (registered = "en, fr") => `import en from "./_locales/en"; import fr from "./_locales/fr";
  export default { vuetify: { lang: { locales: { ${registered} } } } };`;
const layout = (locales = '"en", "fr"') =>
  `<script>export default {data: () => ({langs: [${locales
    .split(", ")
    .map((locale) => `{locale: ${locale}}`)
    .join(",")} ]})};</script>`;

test("validates website registration, matching imports, picker coverage, and duplicate codes", () => {
  expect(checkWebsiteRegistration(config(), layout(), ["en", "fr"])).toEqual([]);
  expect(checkWebsiteRegistration(config("en"), layout(), ["en", "fr"])).toEqual(["fr: locale is not registered"]);
  expect(checkWebsiteRegistration(config(), layout('"en"'), ["en", "fr"])).toEqual([
    "fr: locale is missing from the picker",
  ]);
  expect(checkWebsiteRegistration(config("en, fr: en"), layout(), ["en", "fr"])).toEqual([
    "fr: registration must use its matching locale import",
  ]);
  expect(checkWebsiteRegistration(config(), layout('"en", "fr", "fr"'), ["en", "fr"])).toEqual([
    "fr: duplicate picker entry",
  ]);
  expect(checkWebsiteRegistration(config(), layout(), ["en"])).toEqual(["fr: locale file is missing"]);
});

test("the filesystem checker reports missing messages and rejects a missing or empty English source", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-locales-test-"));
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const directory = path.join(temporary, "Extensions/combined/_locales");
    for (const language of ["en", "fr"]) fs.mkdirSync(path.join(directory, language), { recursive: true });
    const english = path.join(directory, "en/messages.json");
    fs.writeFileSync(english, JSON.stringify({ first: message("First"), added: message("New") }));
    fs.writeFileSync(path.join(directory, "fr/messages.json"), JSON.stringify({ first: message("Premier") }));
    expect(checkCatalogs(temporary, "extension").find((report) => report.name === "extension/fr").errors).toEqual([
      "added: missing key",
    ]);
    expect(main(["--extension"], temporary)).toBe(1);
    expect(error).toHaveBeenCalledWith("ERROR extension/fr: added: missing key");
    fs.writeFileSync(
      path.join(directory, "fr/messages.json"),
      JSON.stringify({ first: message("Premier"), added: message("Nouveau") }),
    );
    expect(main(["--extension"], temporary)).toBe(0);
    fs.writeFileSync(english, "{}");
    expect(() => checkCatalogs(temporary, "extension")).toThrow("English locale must contain messages");
    const withoutEnglish = path.join(temporary, "without-english");
    fs.mkdirSync(path.join(withoutEnglish, "Extensions/combined/_locales/fr"), { recursive: true });
    expect(() => checkCatalogs(withoutEnglish, "extension")).toThrow("English locale is missing");
  } finally {
    log.mockRestore();
    error.mockRestore();
    const actual = fs.realpathSync(temporary);
    expect(path.dirname(actual)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(actual).startsWith("ryd-locales-test-")).toBe(true);
    fs.rmSync(actual, { recursive: true, force: true });
  }
});
