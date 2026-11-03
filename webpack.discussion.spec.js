const fs = require("node:fs");
const path = require("node:path");
const createBuild = require("./webpack.config");

const LOCALES_DIRECTORY = "Extensions/combined/_locales";
const DISCUSSION_DIRECTORY = "Extensions/combined/src/discussion";

function discussionCatalogParser() {
  const build = createBuild({}, { mode: "production" });
  const rule = build.module.rules.find((candidate) => candidate.issuer?.test(`${DISCUSSION_DIRECTORY}/localize.js`));
  return rule.parser.parse;
}

function extensionTextKeys() {
  const sources = fs
    .readdirSync(DISCUSSION_DIRECTORY)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".spec.js"))
    .map((name) => fs.readFileSync(path.join(DISCUSSION_DIRECTORY, name), "utf8"));
  return [
    ...new Set(sources.flatMap((source) => [...source.matchAll(/extensionText\("(\w+)"/g)].map(([, key]) => key))),
  ];
}

function builtManifest(env) {
  const build = createBuild(env, { mode: "production" });
  const copy = build.plugins.find((plugin) => plugin.constructor.name === "CopyPlugin");
  const transform = copy.patterns.find((pattern) => pattern.to === "./chrome/manifest.json").transform;
  return JSON.parse(transform(fs.readFileSync("Extensions/combined/manifest-chrome.json"), "manifest-chrome.json"));
}

test("production packaging never adds a local discussion host", () => {
  const manifest = builtManifest({});
  expect(manifest.host_permissions).toEqual(["*://*.youtube.com/*"]);
  expect(manifest.minimum_chrome_version).toBe("116");
  expect(manifest.permissions).toEqual(["storage"]);
  expect(manifest.web_accessible_resources[0].resources).toContain("comments-bridge.js");
});

test("bundled discussion catalogs keep every extension message the discussion panel reads", () => {
  const parse = discussionCatalogParser();
  const sharedKeys = extensionTextKeys();
  const isBundled = (key) => key.startsWith("discussion_") || sharedKeys.includes(key);
  expect(sharedKeys).toContain("paidFeaturesWhy");
  for (const locale of fs.readdirSync(LOCALES_DIRECTORY)) {
    const source = fs.readFileSync(path.join(LOCALES_DIRECTORY, locale, "messages.json"), "utf8");
    const messages = JSON.parse(source);
    const catalog = parse(source);
    for (const key of sharedKeys) {
      expect([locale, key, catalog[key]?.message]).toEqual([locale, key, messages[key].message]);
    }
    expect(Object.keys(catalog).filter((key) => !isBundled(key))).toEqual([]);
  }
});

test("local discussion host is available only in an explicit isolated test build", () => {
  expect(() => createBuild({ discussionTestOrigin: "http://127.0.0.1:5099" })).toThrow(/explicit live-test/);
  for (const origin of [
    "https://example.com",
    "http://localhost/path",
    "http://user@localhost",
    "http://localhost?token=secret",
  ]) {
    expect(() => createBuild({ liveTest: true, discussionTestOrigin: origin })).toThrow(/loopback HTTP origin/);
  }
  expect(builtManifest({ liveTest: true, discussionTestOrigin: "http://127.0.0.1:5099" }).host_permissions).toContain(
    "http://127.0.0.1/*",
  );
});
