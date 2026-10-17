/** @jest-environment node */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  assertSafeRelativePath,
  buildSourceFileList,
  compareFileMaps,
  createZip,
  readZipFiles,
} = require("./package-amo-release.cjs");

let temporary;

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-amo-zip-test-"));
});

afterEach(() => {
  const actual = fs.realpathSync(temporary);
  expect(path.dirname(actual)).toBe(fs.realpathSync(os.tmpdir()));
  expect(path.basename(actual).startsWith("ryd-amo-zip-test-")).toBe(true);
  fs.rmSync(actual, { recursive: true, force: true });
});

test("standard ZIP round trip preserves root files, nested files, Unicode, and empty files", async () => {
  const files = new Map([
    ["manifest.json", Buffer.from('{"version":"4.0.5"}')],
    ["nested/café.txt", Buffer.from("Repeated content ".repeat(500))],
    ["empty.txt", Buffer.alloc(0)],
    ["binary.bin", Buffer.from([0, 255, 128, 64])],
  ]);
  const archive = path.join(temporary, "release.zip");
  await createZip(archive, files);
  expect(() => compareFileMaps(files, readZipFiles(archive), "Fixture")).not.toThrow();
});

test.each(["../outside.txt", "/absolute.txt", "C:/absolute.txt", "nested/../outside.txt", "nested\\file", "a//b"])(
  "rejects unsafe archive path %s",
  (name) => expect(() => assertSafeRelativePath(name)).toThrow(),
);

test("rejects mismatched ZIP checksums", async () => {
  const archive = path.join(temporary, "release.zip");
  await createZip(archive, new Map([["manifest.json", Buffer.from("fixture")]]));
  const bytes = fs.readFileSync(archive);
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bytes.writeUInt32LE(0, central + 16);
  fs.writeFileSync(archive, bytes);
  expect(() => readZipFiles(archive)).toThrow(/checksum differs/);
});

test("does not overwrite an existing archive", async () => {
  const archive = path.join(temporary, "release.zip");
  fs.writeFileSync(archive, "original");
  await expect(createZip(archive, new Map([["file.txt", Buffer.from("replacement")]]))).rejects.toThrow(/overwrite/);
  expect(fs.readFileSync(archive, "utf8")).toBe("original");
});

test("creates identical ZIP bytes from the same snapshot regardless of map insertion order", async () => {
  const entries = [
    ["z.txt", Buffer.from("last")],
    ["a.txt", Buffer.from("first")],
  ];
  const first = path.join(temporary, "first.zip");
  const second = path.join(temporary, "second.zip");
  await createZip(first, new Map(entries));
  await createZip(second, new Map([...entries].reverse()));
  expect(fs.readFileSync(second)).toEqual(fs.readFileSync(first));
});

test("rejects duplicate paths that collide on case-insensitive filesystems", async () => {
  const archive = path.join(temporary, "release.zip");
  await createZip(
    archive,
    new Map([
      ["file.txt", Buffer.from("a")],
      ["FILE.txt", Buffer.from("b")],
    ]),
  );
  expect(() => readZipFiles(archive)).toThrow(/Duplicate ZIP path/);
});

test("reports file additions, omissions, and content mismatches during reproducibility comparison", () => {
  const expected = new Map([["manifest.json", Buffer.from("expected")]]);
  expect(() => compareFileMaps(expected, new Map(), "Fixture")).toThrow(/file paths differ/);
  expect(() => compareFileMaps(expected, new Map([...expected, ["extra", Buffer.from("x")]]), "Fixture")).toThrow();
  expect(() => compareFileMaps(expected, new Map([["manifest.json", Buffer.from("different")]]), "Fixture")).toThrow(
    /contents differ/,
  );
});

test("source allowlist includes the standalone build and packaging tools but excludes test and userscript sources", () => {
  const files = buildSourceFileList(path.resolve(__dirname, ".."));
  expect(files).toEqual(
    expect.arrayContaining([
      "package-lock.json",
      "AMO_RELEASE_NOTES.md",
      "README_AMO_SOURCE.md",
      "scripts/build-firefox-source.mjs",
      "scripts/package-amo-release.cjs",
      "Extensions/e2e/verify-extension-artifact.js",
    ]),
  );
  expect(files.some((name) => /\.spec\.|Extensions\/UserScript|node_modules|\.env/.test(name))).toBe(false);
});
