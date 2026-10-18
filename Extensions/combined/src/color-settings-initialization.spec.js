/** @jest-environment jsdom */

import { extConfig, __RewireAPI__ as stateRewire } from "./state";
import { normalizeCustomColors } from "../../common/color-themes";

let listeners;
let returnStoredPreferences;
let browserApi;

beforeEach(() => {
  listeners = new Set();
  browserApi = {
    storage: {
      onChanged: {
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
      },
      sync: {
        get: jest.fn((keys, callback) => {
          returnStoredPreferences = callback;
        }),
      },
    },
  };
  stateRewire.__set__("getBrowser", () => browserApi);
});

afterEach(() => stateRewire.__reset__("getBrowser"));

test("restores the saved theme and all four custom colors before initialization completes", async () => {
  const customColors = {
    light: { like: "#123456", dislike: "#654321" },
    dark: { like: "#abcdef", dislike: "#fedcba" },
  };
  const initialized = stateRewire.__get__("initializeColorTheme")();
  expect(browserApi.storage.sync.get).toHaveBeenCalledWith(["colorTheme", "customColors"], expect.any(Function));
  returnStoredPreferences({ colorTheme: "custom", customColors });
  await initialized;
  expect(extConfig.colorTheme).toBe("custom");
  expect(extConfig.customColors).toEqual(customColors);
  expect(listeners.size).toBe(0);
});

test("changes made while storage is loading override only their stale snapshot fields", async () => {
  const initialized = stateRewire.__get__("initializeColorTheme")();
  const customColors = { light: { like: "#123456" } };
  for (const listener of listeners) listener({ customColors: { newValue: customColors } }, "sync");
  returnStoredPreferences({ colorTheme: "custom", customColors: normalizeCustomColors() });
  await initialized;
  expect(extConfig.colorTheme).toBe("custom");
  expect(extConfig.customColors).toEqual(normalizeCustomColors(customColors));
  expect(listeners.size).toBe(0);
});

test("removals during storage loading restore defaults and other storage areas are ignored", async () => {
  const initialized = stateRewire.__get__("initializeColorTheme")();
  for (const listener of listeners) {
    listener({ colorTheme: {}, customColors: {} }, "sync");
    listener({ colorTheme: { newValue: "neon" } }, "local");
  }
  returnStoredPreferences({ colorTheme: "custom", customColors: { light: { like: "#123456" } } });
  await initialized;
  expect(extConfig.colorTheme).toBe("classic");
  expect(extConfig.customColors).toEqual(normalizeCustomColors());
});
