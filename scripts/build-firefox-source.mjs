import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const firefoxOutputDirectory = join(repositoryRoot, "Extensions", "combined", "dist", "firefox");
const firefoxManifestPath = join(firefoxOutputDirectory, "manifest.json");
const contentScriptPath = join(firefoxOutputDirectory, "ryd.content-script.js");
const menuFixerPath = join(firefoxOutputDirectory, "menu-fixer.js");
const maxContentScriptBytes = 5 * 1024 * 1024;
const expectedNodeVersion = "v22.17.0";
const expectedNpmVersion = "10.8.2";
const expectedExtensionVersion = "4.0.6";
const expectedFirefoxExtensionId = "{762f9885-5a13-4abd-9c77-433dcd38b8fd}";
const expectedRequiredDataCollectionPermissions = [
  "personallyIdentifyingInfo",
  "browsingActivity",
  "websiteContent",
  "websiteActivity",
];
const expectedOptionalDataCollectionPermissions = ["authenticationInfo"];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const shouldUseShell = process.platform === "win32";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: "inherit",
    shell: shouldUseShell,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function readCommandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: shouldUseShell,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return result.stdout.trim();
}

function verifyFileExists(filePath, description) {
  if (!existsSync(filePath)) {
    throw new Error(`${description} was not generated at ${filePath}`);
  }
}

function verifyExactArray(actual, expected, description) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(`${description} must be exactly ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

const npmVersion = readCommandOutput(npmCommand, ["--version"]);
console.log(`Node.js: ${process.version}`);
console.log(`npm: ${npmVersion}`);

if (process.version !== expectedNodeVersion) {
  throw new Error(`Node.js ${expectedNodeVersion} is required, got ${process.version}`);
}

if (npmVersion !== expectedNpmVersion) {
  throw new Error(`npm ${expectedNpmVersion} is required, got ${npmVersion}`);
}

console.log("Installing dependencies...");
run(npmCommand, ["ci"], {
  env: {
    HUSKY: "0",
  },
});

console.log("Building Firefox extension output with the AMO release hook...");
run(npmCommand, ["run", "build-for-amo"]);

verifyFileExists(firefoxManifestPath, "Firefox manifest");
verifyFileExists(contentScriptPath, "Firefox content script");
verifyFileExists(menuFixerPath, "Firefox menu fixer");

const firefoxManifest = JSON.parse(readFileSync(firefoxManifestPath, "utf8"));
if (firefoxManifest.version !== expectedExtensionVersion) {
  throw new Error(`Firefox manifest version must be ${expectedExtensionVersion}, got ${firefoxManifest.version}`);
}

const browserSpecificSettings = firefoxManifest.browser_specific_settings;
if (browserSpecificSettings?.gecko?.id !== expectedFirefoxExtensionId) {
  throw new Error(
    `Firefox extension ID must be ${expectedFirefoxExtensionId}, got ${browserSpecificSettings?.gecko?.id}`,
  );
}

if (browserSpecificSettings?.gecko?.strict_min_version !== "140.0") {
  throw new Error(
    `Firefox strict_min_version must be 140.0, got ${browserSpecificSettings?.gecko?.strict_min_version}`,
  );
}

if (Object.hasOwn(browserSpecificSettings ?? {}, "gecko_android")) {
  throw new Error("Firefox manifest must omit gecko_android because this release is desktop-only");
}

const dataCollectionPermissions = browserSpecificSettings.gecko.data_collection_permissions;
verifyExactArray(
  dataCollectionPermissions?.required,
  expectedRequiredDataCollectionPermissions,
  "Required data collection permissions",
);
verifyExactArray(
  dataCollectionPermissions?.optional,
  expectedOptionalDataCollectionPermissions,
  "Optional data collection permissions",
);

const contentScriptSize = statSync(contentScriptPath).size;
if (contentScriptSize >= maxContentScriptBytes) {
  throw new Error(`ryd.content-script.js is ${contentScriptSize} bytes, expected less than ${maxContentScriptBytes}`);
}

const generatedJavaScriptFiles = collectJavaScriptFiles(firefoxOutputDirectory);
for (const generatedJavaScriptFile of generatedJavaScriptFiles) {
  if (readFileSync(generatedJavaScriptFile, "utf8").includes("sourceMappingURL")) {
    throw new Error(`${relative(firefoxOutputDirectory, generatedJavaScriptFile)} contains a source map reference`);
  }
}

console.log("Verifying generated extension artifact provenance...");
run(npmCommand, ["run", "check:extension-artifact"]);

console.log(`Firefox output: ${firefoxOutputDirectory}`);
console.log(`ryd.content-script.js: ${contentScriptSize} bytes`);
console.log(`Verified ${generatedJavaScriptFiles.length} generated JavaScript files without source map references.`);
console.log("AMO source build completed successfully.");
