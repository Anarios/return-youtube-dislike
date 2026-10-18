const path = require("node:path");
const {
  verifyBuildReceipt,
  verifyMirroredJavaScript,
  verifyProductionJavaScript,
  verifyStandaloneMv3Artifact,
} = require("../../../e2e/verify-extension-artifact");
const { verifyGeneratedUserscriptArtifact } = require("../../../e2e/verify-userscript-artifact");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const EXTENSION_DIST_ROOT = path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist");
const EXTENSION_CHROME_ARTIFACT = path.join(EXTENSION_DIST_ROOT, "chrome");

function assertCurrentLiveArtifact(
  runtime,
  expectedBuildId,
  {
    verifyExtensionBuildReceipt = () => verifyBuildReceipt(EXTENSION_DIST_ROOT, REPOSITORY_ROOT),
    verifyExtensionJavaScript = () => {
      verifyMirroredJavaScript(EXTENSION_DIST_ROOT);
      verifyProductionJavaScript(EXTENSION_DIST_ROOT);
      return verifyStandaloneMv3Artifact(EXTENSION_CHROME_ARTIFACT);
    },
    verifyUserscript = verifyGeneratedUserscriptArtifact,
  } = {},
) {
  if (runtime === "extension") {
    const receipt = verifyExtensionBuildReceipt();
    const artifact = verifyExtensionJavaScript();
    return { artifact, buildId: expectedBuildId, receipt, runtime };
  }
  if (runtime === "userscript") {
    const receipt = verifyUserscript({ expectedBuildId, liveTestBuild: true });
    return { buildId: expectedBuildId, receipt, runtime };
  }
  throw new TypeError(`Unsupported live artifact runtime: ${runtime}`);
}

module.exports = {
  EXTENSION_CHROME_ARTIFACT,
  EXTENSION_DIST_ROOT,
  assertCurrentLiveArtifact,
};
