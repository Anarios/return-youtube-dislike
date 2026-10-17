const path = require("path");
const fs = require("fs");
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const { BUILD_RECEIPT_FILENAME, createExtensionBuildReceipt } = require("./extension-build-receipt");
const { LiveBuildMarkerPlugin, createLiveBuildId } = require("./webpack.live-build-marker");

const extensionVersion = (process.env.npm_package_version || require("./package.json").version).replace("-", ".");
const entries = ["ryd.content-script", "ryd.background", "popup", "ryd.changelog"];

const ignorePatterns = [
  "**/manifest-**",
  "**/dist/**",
  "**/e2e/**",
  "**/src/**",
  "**/*.spec.js",
  "**/*.test.js",
  "**/*.e2e.js",
  "**/readme.md",
  ...entries.map((entry) => `**/${entry}.js`),
];

const manifestTransform = (content, filename) => {
  const filteredContent = content
    .toString()
    .split("\n")
    .filter((str) => !str.trimStart().startsWith("//"))
    .join("\n");

  const manifestData = JSON.parse(filteredContent);
  manifestData.version = extensionVersion;
  return JSON.stringify(manifestData, null, 2);
};

const i18nTransform = (content, filename) => {
  if (!filename.endsWith("messages.json")) return content;

  return content.toString().replace(/__RYD_VERSION__/g, extensionVersion);
};

class MirrorJsOutputsPlugin {
  constructor(targetDirs) {
    this.targetDirs = targetDirs;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise("MirrorJsOutputsPlugin", async () => {
      const { promises: fsp } = fs;
      const outputPath = compiler.options.output.path;
      const entries = await fsp.readdir(outputPath).catch(() => []);
      const jsAssets = entries.filter((name) => name.endsWith(".js"));

      await Promise.all(
        this.targetDirs.map(async (dir) => {
          const targetDir = path.join(outputPath, dir);
          await fsp.mkdir(targetDir, { recursive: true });

          const existingFiles = await fsp.readdir(targetDir).catch(() => []);
          await Promise.all(
            existingFiles
              .filter((file) => jsAssets.includes(file))
              .map((file) => fsp.rm(path.join(targetDir, file), { force: true })),
          );

          await Promise.all(
            jsAssets.map((asset) =>
              fsp.copyFile(path.join(outputPath, asset), path.join(targetDir, path.basename(asset))),
            ),
          );
        }),
      );
    });
  }
}

class ExtensionBuildReceiptPlugin {
  constructor(mode) {
    this.mode = mode;
    this.receipt = null;
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tap("ExtensionBuildReceiptPlugin", () => {
      this.receipt = createExtensionBuildReceipt(__dirname, this.mode);
    });
    compiler.hooks.thisCompilation.tap("ExtensionBuildReceiptPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "ExtensionBuildReceiptPlugin",
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          if (!this.receipt) throw new Error("The extension build receipt was not captured before compilation.");
          compilation.emitAsset(
            BUILD_RECEIPT_FILENAME,
            new webpack.sources.RawSource(`${JSON.stringify(this.receipt, null, 2)}\n`),
          );
        },
      );
    });
  }
}

module.exports = (env = {}, argv = {}) => {
  const liveTestBuild = env.liveTest === true || env.liveTest === "true";
  const liveBuildId = createLiveBuildId(liveTestBuild);
  const buildMode = argv.mode || "production";

  return {
    entry: Object.fromEntries(
      entries.map((entry) => [entry, path.join(__dirname, "./Extensions/combined/", `${entry}.js`)]),
    ),
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "Extensions/combined/dist"),
      clean: true,
    },
    cache: false,
    optimization: {
      minimize: false,
    },
    watchOptions: {
      ignored: "**/dist/**",
    },
    plugins: [
      new ExtensionBuildReceiptPlugin(buildMode),
      new webpack.DefinePlugin({
        __RYD_LIVE_BUILD_ID__: JSON.stringify(liveBuildId),
        __RYD_LIVE_TEST_BUILD__: JSON.stringify(liveTestBuild),
      }),
      ...(liveTestBuild
        ? [
            new LiveBuildMarkerPlugin(liveBuildId, [
              "chrome/live-build.json",
              "firefox/live-build.json",
              "safari/live-build.json",
            ]),
          ]
        : []),
      // exclude locale files in moment
      new CopyPlugin({
        patterns: [
          {
            from: "./Extensions/combined",
            to: "./chrome",
            globOptions: {
              ignore: ignorePatterns,
            },
            transform: i18nTransform,
          },
          {
            from: "./Extensions/combined/manifest-chrome.json",
            to: "./chrome/manifest.json",
            transform: manifestTransform,
          },
          {
            from: "./Extensions/combined",
            to: "./firefox",
            globOptions: {
              ignore: ignorePatterns,
            },
            transform: i18nTransform,
          },
          {
            from: "./Extensions/combined/manifest-firefox.json",
            to: "./firefox/manifest.json",
            transform: manifestTransform,
          },
          {
            from: "./Extensions/combined",
            to: "./safari",
            globOptions: {
              ignore: ignorePatterns,
            },
            transform: i18nTransform,
          },
          {
            from: "./Extensions/combined/manifest-safari.json",
            to: "./safari/manifest.json",
            transform: manifestTransform,
          },
        ],
      }),
      new MirrorJsOutputsPlugin(["chrome", "firefox", "safari"]),
    ],
    experiments: {
      topLevelAwait: true,
    },
    devtool: argv.mode === "development" ? "inline-source-map" : false,
  };
};
