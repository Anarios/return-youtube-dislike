// Single source of truth for the userscript's `// ==UserScript==` metadata
// block (consumed by webpack.config.js's BannerPlugin). Deliberately NOT
// derived from package.json's version: the userscript has always shipped on
// its own version/release cadence, independent of the extension.
module.exports = {
  name: "Return YouTube Dislike",
  namespace: "https://www.returnyoutubedislike.com/",
  homepage: "https://www.returnyoutubedislike.com/",
  version: "3.1.5",
  encoding: "utf-8",
  description: "Return of the YouTube Dislike, Based off https://www.returnyoutubedislike.com/",
  icon: "https://github.com/Anarios/return-youtube-dislike/raw/main/Icons/Return%20Youtube%20Dislike%20-%20Transparent.png",
  author: "Anarios & JRWR",
  match: ["*://*.youtube.com/*"],
  exclude: ["*://music.youtube.com/*", "*://*.music.youtube.com/*"],
  compatible: ["chrome", "firefox", "opera", "safari", "edge"],
  downloadURL:
    "https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js",
  updateURL:
    "https://github.com/Anarios/return-youtube-dislike/raw/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js",
  connect: ["youtube.com"],
  grants: ["GM.xmlHttpRequest", "GM_addStyle"],
  runAt: "document-end",
};
