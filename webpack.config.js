const path = require("path");

module.exports = {
  entry: path.join(__dirname, "./Extensions/combined/ryd.content-script.js"),
  output: {
    filename: "bundled-content-script.js",
    path: path.resolve(__dirname, "Extensions/combined"),
  },
  externals: {
    ramda: "R",
  },
  module: {},
};
