const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");

const entries = ["ryd.content-script", "ryd.background", "popup"];

const ignorePatterns = [
  "**/manifest-**",
  "**/dist/**",
  "**/src/**",
  "**/readme.md",
  ...entries.map((entry) => `**/${entry}.ts`),
];

module.exports = {
  entry: Object.fromEntries(
    entries.map((entry) => [
      entry,
      path.join(__dirname, "./Extensions/combined/", `${entry}.ts`),
    ])
  ),
  resolve: {
    extensions: [".ts", ".js"],
  },
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
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules|Website/,
      },
    ],
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
        },
        {
          from: "./Extensions/combined/manifest-chrome.json",
          to: "./chrome/manifest.json",
        },
        {
          from: "./Extensions/combined",
          to: "./firefox",
          globOptions: {
            ignore: ignorePatterns,
          },
        },
        {
          from: "./Extensions/combined/manifest-firefox.json",
          to: "./firefox/manifest.json",
        },
        {
          from: "./Extensions/combined",
          to: "./safari",
          globOptions: {
            ignore: ignorePatterns,
          },
        },
        {
          from: "./Extensions/combined/manifest-safari.json",
          to: "./safari/manifest.json",
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
};
