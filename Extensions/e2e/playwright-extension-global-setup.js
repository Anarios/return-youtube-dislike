const path = require("node:path");
const { verifyRequestedExtensionArtifact } = require("./verify-extension-artifact");

const ALLOW_CUSTOM_ARTIFACT_ENV = "RYD_E2E_ALLOW_CUSTOM_EXTENSION_ARTIFACT";
const REPOSITORY_EXTENSION_ARTIFACT = path.resolve(__dirname, "../combined/dist/chrome");

function selectedArtifact(env) {
  const requested = env.RYD_EXTENSION_ARTIFACT?.trim();
  return requested ? path.resolve(requested) : REPOSITORY_EXTENSION_ARTIFACT;
}

function verifyPlaywrightExtensionArtifact({
  env = process.env,
  verifyArtifact = verifyRequestedExtensionArtifact,
} = {}) {
  const artifact = selectedArtifact(env);
  const custom = artifact !== REPOSITORY_EXTENSION_ARTIFACT;
  if (custom && env[ALLOW_CUSTOM_ARTIFACT_ENV] !== "1") {
    throw new Error(
      `Refusing to run extension Playwright against custom artifact ${artifact}. ` +
        `Set ${ALLOW_CUSTOM_ARTIFACT_ENV}=1 only for an intentional custom or negative-control fixture.`,
    );
  }
  return verifyArtifact(custom ? artifact : undefined);
}

async function playwrightExtensionGlobalSetup() {
  verifyPlaywrightExtensionArtifact();
}

module.exports = playwrightExtensionGlobalSetup;
module.exports.ALLOW_CUSTOM_ARTIFACT_ENV = ALLOW_CUSTOM_ARTIFACT_ENV;
module.exports.REPOSITORY_EXTENSION_ARTIFACT = REPOSITORY_EXTENSION_ARTIFACT;
module.exports.selectedArtifact = selectedArtifact;
module.exports.verifyPlaywrightExtensionArtifact = verifyPlaywrightExtensionArtifact;
