const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
// Both dependency trees already include the parser; Website CI installs only its own dependencies.
const parser = require(require.resolve("@babel/parser", { paths: [ROOT, path.join(ROOT, "Website")] }));
const EMPTY_WEBSITE_FRAGMENTS = new Set([
  "cs:help.bullet11",
  "de:help.bullet11",
  "es:help.bullet11",
  "uk:help.bullet11",
  "vi:help.bullet11",
]);

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function propertyName(node) {
  if (node.computed || !["Identifier", "StringLiteral"].includes(node.key?.type)) {
    throw new Error("Expected a literal property name");
  }
  return node.key.name ?? node.key.value;
}

function readObject(node, rootSpreads = new Set()) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type !== "ObjectExpression") throw new Error("Expected an object or string literal");
  const result = Object.create(null);
  for (const prop of node.properties) {
    if (prop.type === "SpreadElement" && prop.argument.type === "Identifier" && rootSpreads.has(prop.argument.name)) {
      continue;
    }
    if (prop.type !== "ObjectProperty") throw new Error("Only literal locale properties are supported");
    const key = propertyName(prop);
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate key: ${key}`);
    result[key] = readObject(prop.value);
  }
  return result;
}

function parseModule(source) {
  return parser.parse(source, { sourceType: "module", plugins: ["typescript"] }).program.body;
}

function readWebsiteLocale(source) {
  const statements = parseModule(source);
  const spreads = new Set();
  for (const statement of statements) {
    if (statement.type === "ImportDeclaration" && statement.source.value === "vuetify/src/locale") {
      for (const specifier of statement.specifiers) spreads.add(specifier.local.name);
    } else if (statement.type !== "ExportDefaultDeclaration") {
      throw new Error("Expected only a Vuetify locale import and a default locale object");
    }
  }
  const exported = statements.find((statement) => statement.type === "ExportDefaultDeclaration");
  return readObject(exported?.declaration, spreads);
}

function readExtensionLocale(source) {
  JSON.parse(source); // Enforce JSON syntax before reading the object and detecting duplicate keys.
  return readObject(parser.parseExpression(source));
}

function tokens(text, website = false) {
  // $$ escapes a dollar in extension messages. Named placeholders are case-insensitive.
  const pattern = website ? /\{\d+\}|\$\$|\$[a-zA-Z0-9_]+\$|\$\d+/g : /\$\$|\$[a-zA-Z0-9_]+\$|\$\d+/g;
  return (text.match(pattern) || [])
    .filter((token) => token !== "$$")
    .map((token) => token.toLowerCase())
    .sort();
}

function sameTokens(left, right, website = false) {
  return JSON.stringify(tokens(left, website)) === JSON.stringify(tokens(right, website));
}

function extensionPlaceholders(entry, key, errors) {
  const result = Object.create(null);
  if (entry.placeholders !== undefined && !object(entry.placeholders)) {
    errors.push(`${key}: placeholders must be an object`);
    return result;
  }
  for (const [name, definition] of Object.entries(entry.placeholders || {})) {
    const normalized = name.toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(name) || Object.hasOwn(result, normalized)) {
      errors.push(`${key}: invalid or duplicate placeholder ${name}`);
      continue;
    }
    if (!object(definition) || typeof definition.content !== "string" || !definition.content.trim()) {
      errors.push(`${key}: placeholder ${name} needs nonempty string content`);
      continue;
    }
    if (definition.example !== undefined && typeof definition.example !== "string") {
      errors.push(`${key}: placeholder ${name} example must be a string`);
    }
    result[normalized] = definition.content;
  }
  for (const token of tokens(entry.message || "")) {
    if (token.endsWith("$") && !Object.hasOwn(result, token.slice(1, -1))) {
      errors.push(`${key}: undefined placeholder ${token}`);
    }
  }
  return result;
}

function compareExtension(base, locale) {
  const result = { errors: [], extra: [], identical: [] };
  if (!object(base) || !object(locale)) {
    result.errors.push("Locale must be an object");
    return result;
  }
  for (const key of Object.keys(base)) {
    if (!Object.hasOwn(locale, key)) result.errors.push(`${key}: missing key`);
  }
  for (const [key, entry] of Object.entries(locale)) {
    if (!Object.hasOwn(base, key)) result.extra.push(key);
    if (!object(entry) || typeof entry.message !== "string" || !entry.message.trim()) {
      result.errors.push(`${key}: message must be a nonempty string`);
      continue;
    }
    if (entry.description !== undefined && typeof entry.description !== "string") {
      result.errors.push(`${key}: description must be a string`);
    }
    const placeholders = extensionPlaceholders(entry, key, result.errors);
    const reference = base[key];
    if (!object(reference) || typeof reference.message !== "string") continue;
    if (!sameTokens(reference.message, entry.message))
      result.errors.push(`${key}: placeholder tokens differ from English`);
    const expected = extensionPlaceholders(reference, key, []);
    if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(placeholders).sort())) {
      result.errors.push(`${key}: placeholder definitions differ from English`);
    }
    if (entry.message === reference.message) result.identical.push(key);
  }
  return result;
}

function flattenWebsite(value, prefix = "", result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (object(item)) flattenWebsite(item, name, result);
    else result[name] = item;
  }
  return result;
}

function compareWebsite(base, locale, language) {
  const result = { errors: [], extra: [], identical: [] };
  if (!object(base) || !object(locale)) {
    result.errors.push("Locale must be an object");
    return result;
  }
  const reference = flattenWebsite(base);
  const translated = flattenWebsite(locale);
  for (const key of Object.keys(reference)) {
    if (!Object.hasOwn(translated, key)) result.errors.push(`${key}: missing key`);
  }
  for (const [key, value] of Object.entries(translated)) {
    if (!Object.hasOwn(reference, key)) result.extra.push(key);
    // These fragments follow the version number; their preceding sentence already supplies the meaning.
    const allowedEmpty = value === "" && EMPTY_WEBSITE_FRAGMENTS.has(`${language}:${key}`);
    if (typeof value !== "string" || (!value.trim() && !allowedEmpty)) {
      result.errors.push(`${key}: value must be a nonempty string`);
      continue;
    }
    if (typeof reference[key] !== "string") continue;
    if (!sameTokens(reference[key], value, true)) result.errors.push(`${key}: placeholder tokens differ from English`);
    if (value === reference[key]) result.identical.push(key);
  }
  return result;
}

function findProperty(node, name) {
  if (node?.type !== "ObjectExpression") throw new Error(`Expected an object containing ${name}`);
  const matches = node.properties.filter((prop) => prop.type === "ObjectProperty" && propertyName(prop) === name);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name} property`);
  return matches[0].value;
}

function checkWebsiteRegistration(configSource, layoutSource, languages) {
  const statements = parseModule(configSource);
  const imports = new Map();
  for (const statement of statements.filter((item) => item.type === "ImportDeclaration")) {
    for (const specifier of statement.specifiers) imports.set(specifier.local.name, statement.source.value);
  }
  let config = statements.find((statement) => statement.type === "ExportDefaultDeclaration")?.declaration;
  for (const key of ["vuetify", "lang", "locales"]) config = findProperty(config, key);
  const registered = new Set();
  const errors = [];
  for (const prop of config.properties) {
    if (prop.type !== "ObjectProperty") throw new Error("Expected literal website locale registrations");
    const language = propertyName(prop);
    if (registered.has(language)) errors.push(`${language}: duplicate registration`);
    registered.add(language);
    if (prop.value.type !== "Identifier" || imports.get(prop.value.name) !== `./_locales/${language}`) {
      errors.push(`${language}: registration must use its matching locale import`);
    }
  }
  const script = layoutSource.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("Website layout script is missing");
  const layout = parseModule(script).find((statement) => statement.type === "ExportDefaultDeclaration")?.declaration;
  const data = findProperty(layout, "data");
  const langs = findProperty(data.body, "langs");
  if (data.type !== "ArrowFunctionExpression" || langs.type !== "ArrayExpression") {
    throw new Error("Expected a literal website language picker array");
  }
  const selectable = new Set();
  for (const item of langs.elements) {
    const language = findProperty(item, "locale");
    if (language.type !== "StringLiteral") throw new Error("Expected literal picker locale codes");
    if (selectable.has(language.value)) errors.push(`${language.value}: duplicate picker entry`);
    selectable.add(language.value);
  }
  for (const language of new Set([...languages, ...registered, ...selectable])) {
    if (!languages.includes(language)) errors.push(`${language}: locale file is missing`);
    if (!registered.has(language)) errors.push(`${language}: locale is not registered`);
    if (!selectable.has(language)) errors.push(`${language}: locale is missing from the picker`);
  }
  return errors;
}

function checkCatalogs(root, system) {
  const website = system === "website";
  const directory = path.join(root, website ? "Website/_locales" : "Extensions/combined/_locales");
  const files = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => (website ? entry.isFile() && entry.name.endsWith(".ts") : entry.isDirectory()))
    .map((entry) => ({
      language: website ? entry.name.slice(0, -3) : entry.name,
      file: path.join(directory, entry.name, ...(website ? [] : ["messages.json"])),
    }))
    .sort((left, right) => left.language.localeCompare(right.language));
  const read = (file) => (website ? readWebsiteLocale : readExtensionLocale)(fs.readFileSync(file, "utf8"));
  const baseFile = files.find(({ language }) => language === "en");
  if (!baseFile) throw new Error(`${system}: English locale is missing`);
  const base = read(baseFile.file);
  if (!(website ? Object.keys(flattenWebsite(base)) : Object.keys(base)).length) {
    throw new Error(`${system}: English locale must contain messages`);
  }
  const reports = files.map(({ language, file }) => {
    try {
      const catalog = language === "en" ? base : read(file);
      const report = website ? compareWebsite(base, catalog, language) : compareExtension(base, catalog);
      if (language === "en") report.identical = [];
      return { name: `${system}/${language}`, ...report };
    } catch (error) {
      return { name: `${system}/${language}`, errors: [error.message], extra: [], identical: [] };
    }
  });
  if (website) {
    const errors = checkWebsiteRegistration(
      fs.readFileSync(path.join(root, "Website/nuxt.config.js"), "utf8"),
      fs.readFileSync(path.join(root, "Website/layouts/default.vue"), "utf8"),
      files.map(({ language }) => language),
    );
    reports.push({ name: "website/registration", errors, extra: [], identical: [] });
  }
  return reports;
}

function main(args = process.argv.slice(2), root = ROOT) {
  const allowed = new Set(["--extension", "--website", "--verbose"]);
  if (args.some((argument) => !allowed.has(argument)))
    throw new Error("Usage: node scripts/check-locales.js [--extension|--website] [--verbose]");
  const selected = ["extension", "website"].filter((system) => args.includes(`--${system}`));
  const reports = (selected.length ? selected : ["extension", "website"]).flatMap((system) =>
    checkCatalogs(root, system),
  );
  for (const report of reports) {
    for (const error of report.errors) console.error(`ERROR ${report.name}: ${error}`);
    for (const [kind, keys] of [
      ["extra keys", report.extra],
      ["identical to English (may be intentional)", report.identical],
    ]) {
      if (!keys.length) continue;
      const shown = args.includes("--verbose") ? keys : keys.slice(0, 5);
      console.log(
        `Advisory ${report.name}: ${keys.length} ${kind}: ${shown.join(", ")}${shown.length < keys.length ? ", ... (use --verbose)" : ""}`,
      );
    }
  }
  const count = reports.reduce((sum, report) => sum + report.errors.length, 0);
  console.log(
    `Checked ${reports.filter((report) => !report.name.endsWith("/registration")).length} locales; ${count} error(s).`,
  );
  return count ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  readWebsiteLocale,
  readExtensionLocale,
  compareExtension,
  compareWebsite,
  checkWebsiteRegistration,
  checkCatalogs,
  main,
};
