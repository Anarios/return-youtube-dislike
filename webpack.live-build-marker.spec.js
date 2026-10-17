const { LIVE_BUILD_ID_PATTERN, LiveBuildMarkerPlugin, createLiveBuildId } = require("./webpack.live-build-marker");
const createExtensionConfig = require("./webpack.config");
const createUserscriptConfig = require("./webpack.userscript.config");

function liveIdentity(config) {
  const definePlugin = config.plugins.find(({ constructor }) => constructor.name === "DefinePlugin");
  const markerPlugin = config.plugins.find((plugin) => plugin instanceof LiveBuildMarkerPlugin);
  return {
    definedBuildId: JSON.parse(definePlugin.definitions.__RYD_LIVE_BUILD_ID__),
    definedLiveFlag: definePlugin.definitions.__RYD_LIVE_TEST_BUILD__,
    markerAssetNames: markerPlugin?.assetNames,
    markerBuildId: markerPlugin?.buildId,
  };
}

describe("live build marker", () => {
  test("keeps production builds deterministic and gives each live build a fresh exact identity", () => {
    expect(createLiveBuildId(false)).toBe("");
    const first = createLiveBuildId(true);
    const second = createLiveBuildId(true);
    expect(first).toMatch(LIVE_BUILD_ID_PATTERN);
    expect(second).toMatch(LIVE_BUILD_ID_PATTERN);
    expect(second).not.toBe(first);
  });

  test("refuses malformed marker IDs", () => {
    expect(() => new LiveBuildMarkerPlugin("stale", ["live-build.json"])).toThrow("32-character hexadecimal build ID");
  });

  test.each([
    ["userscript", createUserscriptConfig, ["live-build.json"]],
    [
      "extension",
      createExtensionConfig,
      ["chrome/live-build.json", "firefox/live-build.json", "safari/live-build.json"],
    ],
  ])("binds one exact nonce into the %s live bundle and its marker file", (_runtime, createConfig, assetNames) => {
    const identity = liveIdentity(createConfig({ liveTest: true }, { mode: "production" }));

    expect(identity.definedBuildId).toMatch(LIVE_BUILD_ID_PATTERN);
    expect(identity.definedBuildId).toBe(identity.markerBuildId);
    expect(identity.definedLiveFlag).toBe("true");
    expect(identity.markerAssetNames).toEqual(assetNames);
  });

  test.each([
    ["userscript", createUserscriptConfig],
    ["extension", createExtensionConfig],
  ])("does not emit or expose a live identity in a normal %s build", (_runtime, createConfig) => {
    const identity = liveIdentity(createConfig({}, { mode: "production" }));

    expect(identity).toEqual({
      definedBuildId: "",
      definedLiveFlag: "false",
      markerAssetNames: undefined,
      markerBuildId: undefined,
    });
  });
});
