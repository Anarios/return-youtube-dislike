// Alias target for Extensions/common/utils.js when bundling the userscript
// (see the webpack "userscript" config's resolve.alias). Everything except
// getBrowser and numberFormat is re-exported unchanged.
//
// getBrowser is overridden to return the userscript's storage shim instead of
// probing for a real chrome/browser global.
//
// numberFormat is wrapped to apply the userscript-only numberDisplayRoundDown
// option (see browser-shim.js) before delegating to the real numberFormat.
// This is the only reason a userscript-specific numberFormat needs to exist:
// Extensions/common/bar.js and events.js call numberFormat via their own
// `from "./utils"` import, which this alias transparently redirects here, so
// the pre-rounding step applies without touching any shared module.
export {
  getNumberFormatter,
  getVideoId,
  isInViewport,
  isVideoLoaded,
  initializeLogging,
  getColorFromTheme,
  localize,
  querySelector,
  querySelectorAll,
  createObserver,
} from "../../common/utils";

import { numberFormat as sharedNumberFormat } from "../../common/utils";
import { browserShim, userConfig } from "./browser-shim";

function roundDown(num) {
  if (num < 1000) return num;
  const magnitude = Math.floor(Math.log10(num) - 2);
  const decimalPlaces = magnitude + (magnitude % 3 ? 1 : 0);
  return Math.floor(num / 10 ** decimalPlaces) * 10 ** decimalPlaces;
}

function numberFormat(numberState) {
  const input = userConfig.numberDisplayRoundDown ? roundDown(numberState) : numberState;
  return sharedNumberFormat(input);
}

function getBrowser() {
  return browserShim;
}

export { numberFormat, getBrowser };
