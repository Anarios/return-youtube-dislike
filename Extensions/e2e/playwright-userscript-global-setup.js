const {
  resolveRequestedUserscriptArtifact,
  verifyRequestedUserscriptArtifact,
} = require("./verify-userscript-artifact");

function verifyPlaywrightUserscriptArtifact({
  env = process.env,
  verifyArtifact = verifyRequestedUserscriptArtifact,
} = {}) {
  const artifactPath = resolveRequestedUserscriptArtifact(env.RYD_USERSCRIPT_ARTIFACT);
  return verifyArtifact(artifactPath);
}

async function playwrightUserscriptGlobalSetup() {
  verifyPlaywrightUserscriptArtifact();
}

module.exports = playwrightUserscriptGlobalSetup;
module.exports.verifyPlaywrightUserscriptArtifact = verifyPlaywrightUserscriptArtifact;
