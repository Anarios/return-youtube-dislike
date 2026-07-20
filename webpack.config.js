const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const userscriptMeta = require("./Extensions/UserScript/userscript.meta.js");

const extensionVersion = process.env.npm_package_version.replace("-", ".");
const entries = ["ryd.content-script", "ryd.background", "popup", "ryd.changelog"];

const ignorePatterns = [
  "**/manifest-**",
  "**/dist/**",
  "**/src/**",
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
              .filter((file) => file.endsWith(".js"))
              .map((file) => fsp.rm(path.join(targetDir, file), { force: true }))
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

// The committed userscript file is fetched raw from GitHub by every
// Tampermonkey/Greasemonkey install's @updateURL, and has always used LF line
// endings, unlike the rest of this repo's hand-written sources (which use
// CRLF). Bundling CRLF source files together produces a mixed-newline output,
// so normalize the emitted file back to LF to match its own established
// history and keep it cleanly diffable.
class NormalizeLineEndingsPlugin {
  constructor(filename) {
    this.filename = filename;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise("NormalizeLineEndingsPlugin", async () => {
      const { promises: fsp } = fs;
      const filePath = path.join(compiler.options.output.path, this.filename);
      const content = await fsp.readFile(filePath, "utf8");
      const normalized = content.replace(/\r\n/g, "\n");
      if (normalized !== content) {
        await fsp.writeFile(filePath, normalized, "utf8");
      }
    });
  }
}

// Redirects imports of a shared Extensions/common module to a userscript-only
// override (see Extensions/UserScript/src/utils.userscript.js and
// bar.userscript.js), without editing the shared module itself. A plain
// resolve.alias can't be used here: it matches on the imported module's final
// resolved path, and the override files themselves need to import the real
// shared module they're wrapping - a path-keyed alias would redirect that
// self-reference right back to the override, looping forever. Matching only
// requests whose *resolved* path equals the real module, while excluding
// requests whose issuer is the override file's own directory, avoids that.
function redirectSharedModule(realRelPath, overrideRelPath) {
  const realAbsNoExt = path.resolve(__dirname, realRelPath).replace(/\.js$/, "");
  const overrideAbs = path.resolve(__dirname, overrideRelPath);
  const overrideDir = path.dirname(overrideAbs);

  return (resource) => {
    if (!resource.request.startsWith(".")) return;
    const resolvedNoExt = path.resolve(resource.context, resource.request).replace(/\.js$/, "");
    if (resolvedNoExt !== realAbsNoExt) return;
    if (resource.context === overrideDir) return;
    resource.request = overrideAbs;
  };
}

function buildUserscriptBanner() {
  const m = userscriptMeta;
  const lines = [
    "// ==UserScript==",
    `// @name         ${m.name}`,
    `// @namespace    ${m.namespace}`,
    `// @homepage     ${m.homepage}`,
    `// @version      ${m.version}`,
    `// @encoding     ${m.encoding}`,
    `// @description  ${m.description}`,
    `// @icon         ${m.icon}`,
    `// @author       ${m.author}`,
    ...m.match.map((v) => `// @match        ${v}`),
    ...m.exclude.map((v) => `// @exclude      ${v}`),
    ...m.compatible.map((v) => `// @compatible   ${v}`),
    `// @downloadURL  ${m.downloadURL}`,
    `// @updateURL    ${m.updateURL}`,
    `// @grant        ${m.grants[0]}`,
    ...m.connect.map((v) => `// @connect      ${v}`),
    `// @grant        ${m.grants[1]}`,
    `// @run-at       ${m.runAt}`,
    "// ==/UserScript==",
    "",
  ];
  return lines.join("\n");
}

const extensionConfig = (env, argv) => ({
  name: "extension",
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
});

const userscriptConfig = (env, argv) => ({
  name: "userscript",
  entry: path.join(__dirname, "Extensions/UserScript/src/userscript-entry.js"),
  output: {
    filename: "Return Youtube Dislike.user.js",
    path: path.resolve(__dirname, "Extensions/UserScript"),
    clean: false,
  },
  cache: false,
  optimization: {
    minimize: false,
  },
  watchOptions: {
    ignored: "**/dist/**",
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /(?:^|\/)utils$/,
      redirectSharedModule("Extensions/common/utils.js", "Extensions/UserScript/src/utils.userscript.js"),
    ),
    new webpack.NormalModuleReplacementPlugin(
      /(?:^|\/)bar$/,
      redirectSharedModule("Extensions/common/bar.js", "Extensions/UserScript/src/bar.userscript.js"),
    ),
    new webpack.BannerPlugin({ banner: buildUserscriptBanner(), raw: true, entryOnly: true }),
    new NormalizeLineEndingsPlugin("Return Youtube Dislike.user.js"),
  ],
  experiments: {
    topLevelAwait: true,
  },
  devtool: argv.mode === "development" ? "inline-source-map" : false,
});

module.exports = (env, argv) => [extensionConfig(env, argv), userscriptConfig(env, argv)];
