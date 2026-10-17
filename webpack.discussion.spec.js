const fs = require("node:fs");
const createBuild = require("./webpack.config");

function builtManifest(env) {
  const build = createBuild(env, { mode: "production" });
  const copy = build.plugins.find((plugin) => plugin.constructor.name === "CopyPlugin");
  const transform = copy.patterns.find((pattern) => pattern.to === "./chrome/manifest.json").transform;
  return JSON.parse(transform(fs.readFileSync("Extensions/combined/manifest-chrome.json"), "manifest-chrome.json"));
}

test("production packaging never adds a local discussion host", () => {
  const manifest = builtManifest({});
  expect(manifest.host_permissions).toEqual(["*://*.youtube.com/*", "*://returnyoutubedislikeapi.com/*"]);
  expect(manifest.minimum_chrome_version).toBe("116");
  expect(manifest.permissions).toContain("alarms");
  expect(manifest.web_accessible_resources[0].resources).toContain("comments-bridge.js");
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
