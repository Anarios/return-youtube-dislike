chrome.runtime.sendMessage({}, (securityToken) => {
  let script = document.createElement("script");
  script.setAttribute("security-token", securityToken);
  script.setAttribute("extension-id", chrome.runtime.id);
  script.src = chrome.runtime.getURL("return-youtube-dislike.script.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
});
