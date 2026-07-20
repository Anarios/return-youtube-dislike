// Alias target for Extensions/common/bar.js when bundling the userscript
// (see the webpack "userscript" config's resolve.alias). Applies the
// userscript-only rateBarEnabled option (see browser-shim.js): when disabled,
// skip rendering the bar entirely instead of delegating to the shared
// createRateBar. The userscript has no live options UI, so this is a static,
// build-time choice - there is never an existing bar to tear down.
import { createRateBar as sharedCreateRateBar } from "../../common/bar";
import { userConfig } from "./browser-shim";

function createRateBar(likes, dislikes) {
  if (!userConfig.rateBarEnabled) {
    return;
  }
  return sharedCreateRateBar(likes, dislikes);
}

export { createRateBar };
