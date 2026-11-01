const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const createBuild = require("./webpack.config");

test("copies the consent page and stylesheet only into the Firefox package", () => {
  const build = createBuild({}, { mode: "production" });
  const copy = build.plugins.find((plugin) => plugin.constructor.name === "CopyPlugin");
  for (const browser of ["chrome", "firefox", "safari"]) {
    const pattern = copy.patterns.find(({ to }) => to === `./${browser}`);
    for (const asset of ["**/consent.html", "**/consent.css"]) {
      expect(pattern.globOptions.ignore.includes(asset)).toBe(browser !== "firefox");
    }
  }
});

test("mirrors the consent script only into Firefox and removes stale copies elsewhere", async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-package-mirror-"));
  try {
    fs.writeFileSync(path.join(temporaryRoot, "consent.js"), "consent bundle");
    fs.writeFileSync(path.join(temporaryRoot, "popup.js"), "popup bundle");
    for (const browser of ["chrome", "firefox", "safari"]) {
      fs.mkdirSync(path.join(temporaryRoot, browser));
      fs.writeFileSync(path.join(temporaryRoot, browser, "consent.js"), "stale consent bundle");
    }
    const build = createBuild({}, { mode: "production" });
    const mirror = build.plugins.find((plugin) => plugin.constructor.name === "MirrorJsOutputsPlugin");
    let emit;
    mirror.apply({
      options: { output: { path: temporaryRoot } },
      hooks: { afterEmit: { tapPromise: (_name, handler) => (emit = handler) } },
    });

    await emit();

    for (const browser of ["chrome", "firefox", "safari"]) {
      expect(fs.readFileSync(path.join(temporaryRoot, browser, "popup.js"), "utf8")).toBe("popup bundle");
      expect(fs.existsSync(path.join(temporaryRoot, browser, "consent.js"))).toBe(browser === "firefox");
    }
    expect(fs.readFileSync(path.join(temporaryRoot, "firefox", "consent.js"), "utf8")).toBe("consent bundle");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
