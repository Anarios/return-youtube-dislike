const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: path.join(__dirname, './Extensions/combined/ryd.content-script.js'),
  output: {
    filename: 'bundled-content-script.js',
    path: path.resolve(__dirname, 'Extensions/combined')
  },
  optimization: {
    minimize: false
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-object-rest-spread']
          }
        }
      }
    ]
  },
  plugins: [
    // exclude locale files in moment
    new CopyPlugin({
      patterns: [
        {
          from: './Extensions/combined',
          to: './dist/chrome',
          globOptions: {
            ignore: ['**/manifest-**', '**/dist/**', '**/src/**','**/ryd.content-script.js']
          }
        },
        {
          from: './Extensions/combined/manifest-chrome.json',
          to: './dist/chrome/manifest.json'
        },
        {
          from: './Extensions/combined',
          to: './dist/firefox',
          globOptions: {
            ignore: ['**/manifest-**', '**/dist/**', '**/src/**','**/ryd.content-script.js']
          }
        },
        {
          from: './Extensions/combined/manifest-firefox.json',
          to: './dist/firefox/manifest.json'
        }
      ]
    })
  ]
};
