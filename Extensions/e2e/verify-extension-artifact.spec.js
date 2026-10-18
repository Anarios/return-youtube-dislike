/**
 * @jest-environment node
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  EMITTED_JS_FILES,
  manifestExposesWebAccessibleResource,
  verifyMirroredJavaScript,
  verifyProductionJavaScript,
  verifyRequestedExtensionArtifact,
} = require("./verify-extension-artifact");

const BROWSER_DIRECTORIES = ["chrome", "firefox", "safari"];
const MANIFEST_DIRECTORY = path.resolve(__dirname, "../combined");
let temporaryRoot;

function readSourceManifest(browser) {
  const source = fs.readFileSync(path.join(MANIFEST_DIRECTORY, `manifest-${browser}.json`), "utf8");
  return JSON.parse(
    source
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n"),
  );
}

function writeBundle(directory, bundle, contents) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, bundle), contents);
}

beforeEach(() => {
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-artifact-verifier-"));
  for (const bundle of EMITTED_JS_FILES) {
    const contents = `generated ${bundle}`;
    writeBundle(temporaryRoot, bundle, contents);
    for (const directory of BROWSER_DIRECTORIES) {
      writeBundle(path.join(temporaryRoot, directory), bundle, contents);
    }
  }
});

afterEach(() => {
  fs.rmSync(temporaryRoot, { force: true, recursive: true });
});

test.each(BROWSER_DIRECTORIES)("%s manifest exposes the page-world menu helper", (browser) => {
  expect(manifestExposesWebAccessibleResource(readSourceManifest(browser), "menu-fixer.js")).toBe(true);
});

test("rejects a stale browser bundle even when every expected file exists", () => {
  expect(() => verifyMirroredJavaScript(temporaryRoot)).not.toThrow();

  fs.writeFileSync(path.join(temporaryRoot, "chrome", "ryd.content-script.js"), "stale content script");

  expect(() => verifyMirroredJavaScript(temporaryRoot)).toThrow(
    "chrome/ryd.content-script.js is stale or differs from the emitted root bundle.",
  );
});

test.each([
  ["root output", "ryd.background.js", "ryd.background.js"],
  ["browser mirror", path.join("safari", "popup.js"), "safari/popup.js"],
])("rejects an inline development source map in a %s", (_case, relativePath, expectedLabel) => {
  expect(() => verifyProductionJavaScript(temporaryRoot)).not.toThrow();

  fs.writeFileSync(
    path.join(temporaryRoot, relativePath),
    'console.log("development");\n//# sourceMappingURL=data:application/json;base64,e30=',
  );

  expect(() => verifyProductionJavaScript(temporaryRoot)).toThrow(
    `${expectedLabel} contains an inline source map and is not a production bundle.`,
  );
});

test("allows a custom production MV3 artifact without requiring repository mirrors", () => {
  const customDirectory = path.join(temporaryRoot, "custom");
  fs.mkdirSync(customDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(customDirectory, "manifest.json"),
    JSON.stringify({
      background: { service_worker: "ryd.background.js" },
      content_scripts: [
        { css: ["content-style.css"], js: ["ryd.content-script.js"], matches: ["*://www.youtube.com/*"] },
      ],
      manifest_version: 3,
      version: "4.0.5",
    }),
  );
  fs.writeFileSync(
    path.join(customDirectory, "ryd.background.js"),
    'fetch("https://returnyoutubedislikeapi.com/puzzle/registration")',
  );
  fs.writeFileSync(
    path.join(customDirectory, "ryd.content-script.js"),
    'fetch("https://returnyoutubedislikeapi.com/votes")',
  );
  fs.writeFileSync(path.join(customDirectory, "content-style.css"), "#ryd-bar { display: block; }");

  expect(verifyRequestedExtensionArtifact(customDirectory)).toEqual({
    kind: "custom",
    results: [{ directory: customDirectory, manifestVersion: 3, version: "4.0.5" }],
  });
});
