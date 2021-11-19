chrome.runtime.sendMessage({}, (securityToken) => {
	var script = document.createElement('script');
	script.setAttribute("security-token", securityToken);
	script.setAttribute("extension-id", chrome.runtime.id);
	script.src = chrome.runtime.getURL('script.js');
	script.onload = function() {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
});
