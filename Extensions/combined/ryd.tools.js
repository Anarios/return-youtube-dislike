RYDTools = {};

RYDTools.getBrowser = function () {
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
    return chrome;
  } else if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined"
  ) {
    return browser;
  } else {
    console.log("browser is not supported");
    return false;
  }
};


