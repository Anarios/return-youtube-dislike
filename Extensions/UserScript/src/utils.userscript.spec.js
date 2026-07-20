/**
 * @jest-environment jsdom
 */

jest.mock("../../common/state", () => ({
  extConfig: { numberDisplayFormat: "compactShort" },
}));

import * as common from "../../common/utils";
import * as userscriptUtils from "./utils.userscript";
import { browserShim, userConfig } from "./browser-shim";

// "default" is a Babel CJS-interop artifact on the namespace object (this
// module has no real default export), not a named export to compare.
const OVERRIDDEN_KEYS = new Set(["getBrowser", "numberFormat", "default"]);

describe("utils.userscript", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
  });

  it("re-exports every non-overridden utils.js export unchanged", () => {
    const passthroughKeys = Object.keys(common).filter((key) => !OVERRIDDEN_KEYS.has(key));

    // Drift guard: if utils.js gains or loses an export and utils.userscript.js's
    // explicit re-export list isn't updated to match, this fails immediately
    // instead of silently shipping stale behavior in the userscript build.
    expect(new Set(Object.keys(userscriptUtils).filter((key) => !OVERRIDDEN_KEYS.has(key)))).toEqual(
      new Set(passthroughKeys),
    );

    for (const key of passthroughKeys) {
      expect(userscriptUtils[key]).toBe(common[key]);
    }
  });

  describe("getBrowser", () => {
    it("is overridden to return the userscript storage shim", () => {
      expect(userscriptUtils.getBrowser).not.toBe(common.getBrowser);
      expect(userscriptUtils.getBrowser()).toBe(browserShim);
    });
  });

  describe("numberFormat", () => {
    it("rounds down before formatting when numberDisplayRoundDown is enabled", () => {
      userConfig.numberDisplayRoundDown = true;

      expect(userscriptUtils.numberFormat(15320)).toBe(common.numberFormat(15000));
    });

    it("matches the shared formatter exactly when numberDisplayRoundDown is disabled", () => {
      userConfig.numberDisplayRoundDown = false;

      expect(userscriptUtils.numberFormat(15320)).toBe(common.numberFormat(15320));
    });
  });
});
