declare var browser: any;
declare var chrome: any;

const RYDTools = {
  getBrowser: () => {
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
  },
};

export {
  RYDTools,
}