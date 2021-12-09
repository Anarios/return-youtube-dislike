const browser = require("webextension-polyfill");
browser.runtime.sendMessage({}, (securityToken) => {
	const script = document.createElement("script");
	script.setAttribute("security-token", securityToken);
	script.setAttribute("extension-id", browser.runtime.id);
	script.src = browser.runtime.getURL("return-youtube-dislike.script.js");
	script.onload = () => {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
});
  