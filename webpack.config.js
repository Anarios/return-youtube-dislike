const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");

const extensionVersion = process.env.npm_package_version.replace('-', '.');
const entries = ["ryd.content-script", "ryd.background", "popup"];

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
    .split('\n')
    .filter(str => !str.trimStart().startsWith("//"))
    .join('\n');

  const manifestData = JSON.parse(filteredContent);
  manifestData.version = extensionVersion;
  return JSON.stringify(manifestData, null, 2);
};

const i18nTransform = (content, filename) => {
  if (!filename.endsWith('messages.json'))
    return content;

  return content.toString().replace(/__RYD_VERSION__/g, extensionVersion);
};

module.exports = {
  entry: Object.fromEntries(
    entries.map((entry) => [
      entry,
      path.join(__dirname, "./Extensions/combined/", `${entry}.js`),
    ]),
  ),
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "Extensions/combined/dist"),
    clean: true,
  },
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
          transform: i18nTransform
        },
        {
          from: "./Extensions/combined/manifest-chrome.json",
          to: "./chrome/manifest.json",
          transform: manifestTransform
        },
        {
          from: "./Extensions/combined",
          to: "./firefox",
          globOptions: {
            ignore: ignorePatterns,
          },
          transform: i18nTransform
        },
        {
          from: "./Extensions/combined/manifest-firefox.json",
          to: "./firefox/manifest.json",
          transform: manifestTransform
        },
        {
          from: "./Extensions/combined",
          to: "./safari",
          globOptions: {
            ignore: ignorePatterns,
          },
          transform: i18nTransform
        },
        {
          from: "./Extensions/combined/manifest-safari.json",
          to: "./safari/manifest.json",
          transform: manifestTransform
        },
      ],
    }),
    new FileManagerPlugin({
      events: {
        onEnd: {
          copy: [
            {
              source: "./Extensions/combined/dist/**.js",
              destination: "./Extensions/combined/dist/firefox/",
            },
            {
              source: "./Extensions/combined/dist/**.js",
              destination: "./Extensions/combined/dist/chrome/",
            },
            {
              source: "./Extensions/combined/dist/**.js",
              destination: "./Extensions/combined/dist/safari/",
            },
          ],
        },
      },
    }),
  ],
  experiments: {
    topLevelAwait: true,
  },
  // devtool: 'inline-source-map',
};
