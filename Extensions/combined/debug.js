//---   Get Extension Information   ---//
const extension = chrome.runtime.getManifest();

//---   Get Debug Elements   ---//
const ver = document.getElementById("extension-version");

//---   Set Debug Elements   ---//
ver.innerHTML = extension.version;
