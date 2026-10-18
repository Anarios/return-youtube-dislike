const version = require("./userscript-version.json");

module.exports = {
  name: "Return YouTube Dislike",
  namespace: "https://www.returnyoutubedislike.com/",
  homepage: "https://www.returnyoutubedislike.com/",
  version,
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
  grants: [
    "GM.getValue",
    "GM.setValue",
    "GM.deleteValue",
    "GM_getValue",
    "GM_setValue",
    "GM_deleteValue",
    "GM_addStyle",
  ],
  runAt: "document-end",
};
