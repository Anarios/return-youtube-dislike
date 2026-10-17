const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inflateRawSync } = require("node:zlib");
const { collectExtensionBuildInputs, createExtensionBuildReceipt } = require("../extension-build-receipt");
const { verifyBuildReceipt, verifyExtensionArtifacts } = require("../Extensions/e2e/verify-extension-artifact");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const EXPECTED_NODE = "v22.17.0";
const EXPECTED_NPM = "10.8.2";
const ARTIFACT_VERIFIER_PATH = "Extensions/e2e/verify-extension-artifact.js";
const EXTRA_SOURCE_FILES = Object.freeze([
  "AMO_RELEASE_NOTES.md",
  "AMO_SUBMISSION_NOTES.md",
  "Docs/Privacy Policy",
  ARTIFACT_VERIFIER_PATH,
  "README_AMO_SOURCE.md",
  "scripts/build-firefox-source.mjs",
  "scripts/package-amo-release.cjs",
]);
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const ZIP_DATE = new Date("2020-01-01T00:00:00.000Z");

function assertSafeRelativePath(name) {
  assert.equal(typeof name, "string", "An archive path must be a string.");
  assert.ok(name.length > 0 && !/[\\:\x00-\x1f]/.test(name), `Unsafe archive path: ${name}`);
  assert.ok(!name.startsWith("/"), `Absolute archive path: ${name}`);
  assert.ok(
    name.split("/").every((part) => part && part !== "." && part !== ".."),
    `Unsafe archive path: ${name}`,
  );
  return name;
}

function assertReleaseFile(name, allowVerifier = false) {
  assertSafeRelativePath(name);
  const parts = name.toLowerCase().split("/");
  assert.ok(
    !parts.some((part) => part.startsWith(".") && ![".babelrc", ".nvmrc"].includes(part)),
    `Hidden configuration or directory: ${name}`,
  );
  assert.ok(
    !parts.some((part) =>
      [
        ".git",
        ".agents",
        "node_modules",
        "userscript",
        "test-results",
        "playwright-report",
        "coverage",
        "cache",
      ].includes(part),
    ),
    `Non-release path: ${name}`,
  );
  assert.ok(!parts.some((part) => part.startsWith(".env") || part === ".npmrc"), `Private configuration: ${name}`);
  assert.ok(!/(?:^|[.])(e2e|spec|test)\.[cm]?[jt]sx?$/i.test(name), `Test file: ${name}`);
  assert.ok(!/\.(?:pem|key|pfx|p12|cert|log|map)$/i.test(name), `Non-release file: ${name}`);
  assert.ok(!parts.includes("e2e") || (allowVerifier && name === ARTIFACT_VERIFIER_PATH), `Test directory: ${name}`);
  assert.ok(!parts.includes("live-build.json"), `Live-test marker: ${name}`);
}

function readRegularFile(root, name) {
  const safeName = assertSafeRelativePath(name);
  let current = root;
  for (const part of safeName.split("/")) {
    current = path.join(current, part);
    assert.ok(!fs.lstatSync(current).isSymbolicLink(), `Symbolic link is not a release input: ${name}`);
  }
  assert.ok(fs.statSync(current).isFile(), `Missing regular file: ${name}`);
  return fs.readFileSync(current);
}

function listFiles(root, prefix = "") {
  return fs
    .readdirSync(path.join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      assertSafeRelativePath(name);
      assert.ok(!entry.isSymbolicLink(), `Symbolic link is not a release output: ${name}`);
      if (entry.isDirectory()) return listFiles(root, name);
      assert.ok(entry.isFile(), `Unsupported release output: ${name}`);
      return [name];
    })
    .sort();
}

function buildSourceFileList(root) {
  const licenseFiles = fs.existsSync(path.join(root, "LICENSE")) ? ["LICENSE"] : [];
  const files = [...new Set([...collectExtensionBuildInputs(root), ...EXTRA_SOURCE_FILES, ...licenseFiles])].sort();
  for (const name of files) assertReleaseFile(name, true);
  return files;
}

function snapshotFiles(root, names) {
  return new Map(names.map((name) => [name, readRegularFile(root, name)]));
}

function sha256(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function compareFileMaps(expected, actual, label) {
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), `${label}: file paths differ.`);
  for (const [name, contents] of expected) {
    assert.equal(sha256(actual.get(name)), sha256(contents), `${label}: contents differ for ${name}.`);
  }
}

async function createZip(destination, files) {
  const archiver = require("archiver");
  assert.ok(!fs.existsSync(destination), `Refusing to overwrite an existing archive: ${destination}`);
  assert.ok(files.size > 0 && files.size < 0xffff, "Release ZIP must contain 1 to 65534 files.");
  const archive = archiver("zip", { zlib: { level: 9 }, forceLocalTime: false });
  const output = fs.createWriteStream(destination, { flags: "wx" });
  const completed = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", reject);
  });
  archive.pipe(output);
  for (const name of [...files.keys()].sort()) {
    assertSafeRelativePath(name);
    const contents = files.get(name);
    assert.ok(contents.length <= MAX_FILE_BYTES, `Release file is too large: ${name}`);
    archive.append(contents, { name, date: ZIP_DATE, mode: 0o644 });
  }
  await Promise.all([archive.finalize(), completed]);
}

function crc32(contents) {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Release ZIPs are small, non-encrypted ZIP32 archives containing only regular files.
// Reading the central directory independently verifies the archive bytes we distribute.
function readZipFiles(archivePath) {
  const zip = fs.readFileSync(archivePath);
  assert.ok(zip.length <= MAX_ARCHIVE_BYTES, "Release archive is too large.");
  let end = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset--) {
    if (zip.readUInt32LE(offset) === 0x06054b50 && offset + 22 + zip.readUInt16LE(offset + 20) === zip.length) {
      end = offset;
      break;
    }
  }
  assert.ok(end >= 0, "ZIP end-of-central-directory record is missing.");
  const count = zip.readUInt16LE(end + 10);
  assert.ok(count > 0 && count < 0xffff, "Unsupported ZIP file count.");
  assert.equal(zip.readUInt32LE(end + 4), 0, "Multi-disk ZIP archives are unsupported.");
  assert.equal(zip.readUInt16LE(end + 8), count, "ZIP entry counts differ.");
  let cursor = zip.readUInt32LE(end + 16);
  const centralEnd = cursor + zip.readUInt32LE(end + 12);
  assert.equal(centralEnd, end, "Invalid ZIP central directory bounds.");
  const files = new Map();
  const foldedNames = new Set();
  let totalBytes = 0;
  for (let entry = 0; entry < count; entry++) {
    assert.ok(cursor + 46 <= centralEnd, "Truncated ZIP central directory.");
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, "Invalid ZIP central directory entry.");
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const compressedBytes = zip.readUInt32LE(cursor + 20);
    const bytes = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    assert.ok(next <= centralEnd, "Truncated ZIP filename or metadata.");
    const name = assertSafeRelativePath(zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
    assert.ok(!foldedNames.has(name.toLowerCase()), `Duplicate ZIP path: ${name}`);
    foldedNames.add(name.toLowerCase());
    assert.equal(flags & 1, 0, "Encrypted ZIP entries are unsupported.");
    assert.ok(method === 0 || method === 8, `Unsupported ZIP compression: ${method}`);
    assert.notEqual((zip.readUInt32LE(cursor + 38) >>> 16) & 0xf000, 0xa000, `ZIP symbolic link: ${name}`);
    totalBytes += bytes;
    assert.ok(bytes <= MAX_FILE_BYTES && totalBytes <= MAX_ARCHIVE_BYTES, "ZIP expands beyond release size limits.");
    const local = zip.readUInt32LE(cursor + 42);
    assert.ok(local + 30 <= zip.readUInt32LE(end + 16), "Invalid ZIP local header offset.");
    assert.equal(zip.readUInt32LE(local), 0x04034b50, `Missing ZIP local header: ${name}`);
    assert.equal(zip.readUInt16LE(local + 8), method, `ZIP compression headers differ: ${name}`);
    const localNameLength = zip.readUInt16LE(local + 26);
    const start = local + 30 + localNameLength + zip.readUInt16LE(local + 28);
    assert.ok(start + compressedBytes <= zip.readUInt32LE(end + 16), `Invalid ZIP data bounds: ${name}`);
    assert.equal(zip.subarray(local + 30, local + 30 + localNameLength).toString("utf8"), name, "ZIP names differ.");
    const compressed = zip.subarray(start, start + compressedBytes);
    const contents = method === 8 ? inflateRawSync(compressed, { maxOutputLength: bytes + 1 }) : compressed;
    assert.equal(contents.length, bytes, `ZIP entry length differs: ${name}`);
    assert.equal(crc32(contents), zip.readUInt32LE(cursor + 16), `ZIP entry checksum differs: ${name}`);
    files.set(name, contents);
    cursor = next;
  }
  assert.equal(cursor, centralEnd, "ZIP central directory contains unexpected entries.");
  return files;
}

function extractFiles(files, destination) {
  fs.mkdirSync(destination);
  for (const [name, contents] of files) {
    assertSafeRelativePath(name);
    const target = path.join(destination, ...name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, { flag: "wx" });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: REPOSITORY_ROOT, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${path.basename(command)} ${args.join(" ")} failed.`);
  return result;
}

function packageEnvironment() {
  return {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ""}`,
    HUSKY: "0",
    NODE_ENV: "development",
    npm_config_include: "dev",
    RYD_EXTENSION_ARTIFACT: "",
  };
}

function verifyToolchain(env) {
  assert.equal(process.version, EXPECTED_NODE, `Run this script with Node.js ${EXPECTED_NODE}.`);
  const npm = run(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
    env,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  }).stdout.trim();
  assert.equal(npm, EXPECTED_NPM, `Use npm ${EXPECTED_NPM} to package the release.`);
  return npm;
}

function removeTemporaryDirectory(directory) {
  const actual = fs.realpathSync(directory);
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(actual), temporaryRoot, "Refusing to remove a directory outside the temporary root.");
  assert.ok(path.basename(actual).startsWith("ryd-amo-release-"), "Unexpected temporary directory name.");
  fs.rmSync(actual, { recursive: true, force: true });
}

async function packageRelease(outputDirectory) {
  const output = path.resolve(outputDirectory);
  assert.ok(!fs.existsSync(output), `Output already exists; choose a new directory: ${output}`);
  assert.ok(fs.statSync(path.dirname(output)).isDirectory(), "The output parent directory must already exist.");
  const env = packageEnvironment();
  const npm = verifyToolchain(env);
  verifyExtensionArtifacts();
  const receipt = verifyBuildReceipt();
  const version = JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, "package.json"), "utf8")).version;
  assert.match(version, /^\d+(?:\.\d+){1,3}$/, "Release version must be a numeric extension version.");
  const firefoxRoot = path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "firefox");
  const firefoxNames = listFiles(firefoxRoot);
  firefoxNames.forEach((name) => assertReleaseFile(name));
  const firefoxFiles = snapshotFiles(firefoxRoot, firefoxNames);
  assert.equal(JSON.parse(firefoxFiles.get("manifest.json")).version, version, "Firefox artifact version differs.");
  const sourceFiles = snapshotFiles(REPOSITORY_ROOT, buildSourceFileList(REPOSITORY_ROOT));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-amo-release-"));
  try {
    const staged = path.join(temporary, "release");
    fs.mkdirSync(staged);
    const firefoxName = `return-youtube-dislike-firefox-${version}.zip`;
    const sourceName = `return-youtube-dislike-source-${version}.zip`;
    console.log("Packaging the production Firefox output and allowlisted source inputs...");
    await createZip(path.join(staged, firefoxName), firefoxFiles);
    await createZip(path.join(staged, sourceName), sourceFiles);
    const archivedFirefox = readZipFiles(path.join(staged, firefoxName));
    const archivedSource = readZipFiles(path.join(staged, sourceName));
    compareFileMaps(firefoxFiles, archivedFirefox, "Firefox ZIP round trip");
    compareFileMaps(sourceFiles, archivedSource, "Source ZIP round trip");
    const rebuildRoot = path.join(temporary, "source");
    extractFiles(archivedSource, rebuildRoot);
    assert.deepEqual(
      createExtensionBuildReceipt(rebuildRoot, "production"),
      receipt,
      "Archived source receipt differs.",
    );
    console.log("Rebuilding the extracted source archive in a fresh temporary directory...");
    run(process.execPath, [path.join(rebuildRoot, "scripts", "build-firefox-source.mjs")], { cwd: rebuildRoot, env });
    const rebuiltFirefoxRoot = path.join(rebuildRoot, "Extensions", "combined", "dist", "firefox");
    const rebuiltFiles = snapshotFiles(rebuiltFirefoxRoot, listFiles(rebuiltFirefoxRoot));
    compareFileMaps(archivedFirefox, rebuiltFiles, "Source reproducibility");
    compareFileMaps(
      sourceFiles,
      snapshotFiles(REPOSITORY_ROOT, [...sourceFiles.keys()]),
      "Source changed during packaging",
    );
    verifyBuildReceipt();
    for (const [source, destination] of [
      ["AMO_RELEASE_NOTES.md", "AMO_RELEASE_NOTES.md"],
      ["AMO_SUBMISSION_NOTES.md", "AMO_SUBMISSION_NOTES.md"],
      ["README_AMO_SOURCE.md", "README_AMO_SOURCE.md"],
      ["Docs/Privacy Policy", "PRIVACY_POLICY.md"],
    ])
      fs.writeFileSync(path.join(staged, destination), sourceFiles.get(source), { flag: "wx" });
    const git = spawnSync(
      "git",
      ["-c", `safe.directory=${REPOSITORY_ROOT.replaceAll("\\", "/")}`, "rev-parse", "HEAD"],
      {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    const provenance = {
      version,
      gitHead: git.status === 0 ? git.stdout.trim() : null,
      workingTreeSnapshot: true,
      node: process.version,
      npm,
      sourceInputHashAlgorithm: receipt.inputHashAlgorithm,
      sourceInputHash: receipt.inputHash,
      productionInputCount: receipt.inputs.length,
      sourceArchiveFileCount: sourceFiles.size,
      firefoxPackageFileCount: firefoxFiles.size,
    };
    fs.writeFileSync(path.join(staged, "BUILD_PROVENANCE.json"), `${JSON.stringify(provenance, null, 2)}\n`);
    const report = [
      `AMO ${version} source reproducibility check`,
      "Result: PASS",
      `Checked (UTC): ${new Date().toISOString()}`,
      `Build platform: ${process.platform} ${process.arch}`,
      `Node.js: ${process.version}`,
      `npm: ${npm}`,
      `Source archive SHA256: ${sha256(fs.readFileSync(path.join(staged, sourceName)))}`,
      `Firefox archive SHA256: ${sha256(fs.readFileSync(path.join(staged, firefoxName)))}`,
      `Rebuilt Firefox files: ${rebuiltFiles.size}`,
      `Uploaded Firefox files: ${archivedFirefox.size}`,
      "Comparison: every relative path and SHA256 digest matches",
      "Source build: fresh extraction of the exact source ZIP, followed by npm ci and production build",
      "Build command: node scripts/build-firefox-source.mjs",
    ];
    fs.writeFileSync(path.join(staged, "REPRODUCIBILITY.txt"), `${report.join("\n")}\n`);
    const sums = listFiles(staged).map((name) => `${sha256(fs.readFileSync(path.join(staged, name)))}  ${name}`);
    fs.writeFileSync(path.join(staged, "SHA256SUMS.txt"), `${sums.join("\n")}\n`);
    fs.mkdirSync(output);
    for (const name of listFiles(staged)) {
      fs.copyFileSync(path.join(staged, name), path.join(output, name), fs.constants.COPYFILE_EXCL);
    }
    console.log(`Verified release written to ${output}`);
  } finally {
    removeTemporaryDirectory(temporary);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/package-amo-release.cjs --output <new-release-directory>");
    console.log("Requires an existing production build. Rebuilds the source ZIP before publishing verified artifacts.");
  } else if (args.length !== 2 || args[0] !== "--output" || !args[1].trim()) {
    console.error("Usage: node scripts/package-amo-release.cjs --output <new-release-directory>");
    process.exitCode = 1;
  } else {
    packageRelease(args[1]).catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { assertSafeRelativePath, buildSourceFileList, compareFileMaps, createZip, readZipFiles };
