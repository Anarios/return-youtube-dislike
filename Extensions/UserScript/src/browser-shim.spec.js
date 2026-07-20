import { browserShim, userConfig } from "./browser-shim";

describe("browser-shim", () => {
  describe("storage.sync.get", () => {
    it("returns only the requested keys that are actually defined", () => {
      const result = {};
      browserShim.storage.sync.get(["colorTheme", "doesNotExist"], (res) => {
        Object.assign(result, res);
      });

      expect(result).toEqual({ colorTheme: userConfig.colorTheme });
      expect(result).not.toHaveProperty("doesNotExist");
    });

    it("accepts a single key as well as an array", () => {
      const result = {};
      browserShim.storage.sync.get("disableLogging", (res) => {
        Object.assign(result, res);
      });

      expect(result).toEqual({ disableLogging: userConfig.disableLogging });
    });
  });

  describe("storage.sync.set", () => {
    it("mutates userConfig in place, reflected by a subsequent get()", () => {
      browserShim.storage.sync.set({ colorTheme: "neon" });

      const result = {};
      browserShim.storage.sync.get(["colorTheme"], (res) => Object.assign(result, res));

      expect(result).toEqual({ colorTheme: "neon" });

      // restore, since userConfig is shared module state
      browserShim.storage.sync.set({ colorTheme: "classic" });
    });
  });

  describe("inert members", () => {
    it("never throws when called, since nothing in the userscript build submits votes or listens for storage changes", () => {
      expect(() => browserShim.storage.onChanged.addListener(() => {})).not.toThrow();
      expect(() => browserShim.runtime.sendMessage({ message: "send_vote" })).not.toThrow();
      expect(browserShim.runtime.getURL("anything")).toBeUndefined();
      expect(browserShim.runtime.getManifest()).toBeNull();
    });
  });
});
