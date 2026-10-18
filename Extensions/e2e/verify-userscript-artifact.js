const path = require("node:path");
const {
  USERSCRIPT_ARTIFACT_RELATIVE_PATH,
  USERSCRIPT_BUILD_RECEIPT_FILENAME,
  USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH,
  USERSCRIPT_LIVE_ARTIFACT_RELATIVE_PATH,
  USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH,
  verifyUserscriptBuildReceipt,
} = require("../../userscript-build-receipt");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const REPOSITORY_USERSCRIPT_ARTIFACT = path.join(REPOSITORY_ROOT, USERSCRIPT_ARTIFACT_RELATIVE_PATH);
const REPOSITORY_USERSCRIPT_BUILD_RECEIPT = path.join(REPOSITORY_ROOT, USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH);

function resolveRequestedUserscriptArtifact(requestedArtifact = process.env.RYD_USERSCRIPT_ARTIFACT) {
  const normalizedRequest = requestedArtifact?.trim();
  return normalizedRequest ? path.resolve(normalizedRequest) : REPOSITORY_USERSCRIPT_ARTIFACT;
}

function receiptPathForUserscriptArtifact(artifactPath) {
  const resolvedArtifact = path.resolve(artifactPath);
  if (path.relative(resolvedArtifact, REPOSITORY_USERSCRIPT_ARTIFACT) === "") {
    return REPOSITORY_USERSCRIPT_BUILD_RECEIPT;
  }
  return path.join(path.dirname(resolvedArtifact), USERSCRIPT_BUILD_RECEIPT_FILENAME);
}

function verifyRequestedUserscriptArtifact(requestedArtifact = process.env.RYD_USERSCRIPT_ARTIFACT) {
  const artifactPath = resolveRequestedUserscriptArtifact(requestedArtifact);
  return verifyUserscriptBuildReceipt({
    artifactPath,
    liveTestBuild: false,
    receiptPath: receiptPathForUserscriptArtifact(artifactPath),
    repositoryRoot: REPOSITORY_ROOT,
  });
}

function verifyGeneratedUserscriptArtifact({ expectedBuildId = "", liveTestBuild = false } = {}) {
  const artifactRelativePath = liveTestBuild
    ? USERSCRIPT_LIVE_ARTIFACT_RELATIVE_PATH
    : USERSCRIPT_ARTIFACT_RELATIVE_PATH;
  const receiptRelativePath = liveTestBuild
    ? USERSCRIPT_LIVE_BUILD_RECEIPT_RELATIVE_PATH
    : USERSCRIPT_BUILD_RECEIPT_RELATIVE_PATH;
  return verifyUserscriptBuildReceipt({
    artifactPath: path.join(REPOSITORY_ROOT, artifactRelativePath),
    expectedBuildId,
    liveTestBuild,
    receiptPath: path.join(REPOSITORY_ROOT, receiptRelativePath),
    repositoryRoot: REPOSITORY_ROOT,
  });
}

if (require.main === module) {
  try {
    const liveTestBuild = process.argv.includes("--live");
    const buildIdArgument = process.argv.find((argument) => argument.startsWith("--build-id="));
    const expectedBuildId = buildIdArgument?.slice("--build-id=".length) ?? "";
    const receipt = liveTestBuild
      ? verifyGeneratedUserscriptArtifact({ expectedBuildId, liveTestBuild })
      : verifyRequestedUserscriptArtifact();
    process.stdout.write(`Verified userscript artifact: ${JSON.stringify(receipt)}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  REPOSITORY_USERSCRIPT_ARTIFACT,
  REPOSITORY_USERSCRIPT_BUILD_RECEIPT,
  receiptPathForUserscriptArtifact,
  resolveRequestedUserscriptArtifact,
  verifyGeneratedUserscriptArtifact,
  verifyRequestedUserscriptArtifact,
};
