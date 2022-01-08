const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");

module.exports = {
  entry: path.join(__dirname, "./Extensions/combined/ryd.content-script.js"),
  output: {
    filename: "bundled-content-script.js",
    path: path.resolve(__dirname, "Extensions/combined/dist"),
    clean: true,
  },
  optimization: {
    minimize: false,
  },
  watchOptions: {
    ignored: "./Extensions/combined/dist/*"
  },
  plugins: [
    // exclude locale files in moment
    new CopyPlugin({
      patterns: [
        {
          from: "./Extensions/combined",
          to: "./chrome",
          globOptions: {
            ignore: [
              "**/manifest-**",
              "**/dist/**",
              "**/src/**",
              "**/ryd.content-script.js",
            ],
          },
        },
        {
          from: "./Extensions/combined/manifest-chrome.json",
          to: "./chrome/manifest.json",
        },
        {
          from: "./Extensions/combined",
          to: "./firefox",
          globOptions: {
            ignore: [
              "**/manifest-**",
              "**/dist/**",
              "**/src/**",
              "**/ryd.content-script.js",
            ],
          },
        },
        {
          from: "./Extensions/combined/manifest-firefox.json",
          to: "./firefox/manifest.json",
        }
      ],
    }),
    new FileManagerPlugin({
      events: {
        onEnd: {
          copy: [
            { source: "./Extensions/combined/dist/bundled-content-script.js", destination: "./Extensions/combined/dist/firefox/bundled-content-script.js" },
            { source: "./Extensions/combined/dist/bundled-content-script.js", destination: "./Extensions/combined/dist/chrome/bundled-content-script.js" },
          ],
        },
      },
    }),
  ],
};
