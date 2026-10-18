const crypto = require("node:crypto");

const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;

function createLiveBuildId(enabled) {
  return enabled ? crypto.randomBytes(16).toString("hex") : "";
}

class LiveBuildMarkerPlugin {
  constructor(buildId, assetNames) {
    if (!LIVE_BUILD_ID_PATTERN.test(buildId)) {
      throw new TypeError("A live build marker requires a 32-character hexadecimal build ID.");
    }
    this.assetNames = assetNames;
    this.buildId = buildId;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap("LiveBuildMarkerPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "LiveBuildMarkerPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const source = new compiler.webpack.sources.RawSource(`${JSON.stringify({ buildId: this.buildId })}\n`);
          for (const assetName of this.assetNames) {
            compilation.emitAsset(assetName, source);
          }
        },
      );
    });
  }
}

module.exports = {
  LIVE_BUILD_ID_PATTERN,
  LiveBuildMarkerPlugin,
  createLiveBuildId,
};
