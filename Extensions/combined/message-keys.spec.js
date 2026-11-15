const fs = require("node:fs");
const path = require("node:path");

const SKIPPED_DIRECTORIES = new Set(["dist", "node_modules", "_locales"]);
const SOURCE_EXTENSIONS = new Set([".js", ".html", ".json"]);
const LITERAL_LOOKUP = /\b(?:localize|getMessage)\(\s*["']([A-Za-z0-9_]+)["']|__MSG_([A-Za-z0-9_]+)__/g;

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(fullPath);
    const isSource = SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".spec.js");
    return isSource ? [fullPath] : [];
  });
}

function literalLookups() {
  const lookups = new Map();
  for (const file of sourceFiles(__dirname)) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(LITERAL_LOOKUP)) {
      const key = match[1] || match[2];
      if (!lookups.has(key)) lookups.set(key, path.relative(__dirname, file));
    }
  }
  return lookups;
}

test("every literal message lookup names a default-locale key with the same casing", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest-chrome.json"), "utf8"));
  const catalogPath = path.join(__dirname, "_locales", manifest.default_locale, "messages.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const lookups = literalLookups();
  expect(lookups.size).toBeGreaterThan(100);
  const missing = [...lookups]
    .filter(([key]) => !Object.hasOwn(catalog, key))
    .map(([key, file]) => `${key} in ${file}`);
  expect(missing).toEqual([]);
});
