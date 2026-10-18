/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./state", () => ({
  extConfig: {},
  refreshReactionPresentation: jest.fn(),
  storedData: { likes: 300, dislikes: 100, videoId: "abcdefghijk" },
}));
jest.mock("./bar", () => ({ createRateBar: jest.fn() }));

import { createRateBar } from "./bar";
import { observeColorTheme, storageChangeHandler } from "./events";
import { extConfig, refreshReactionPresentation, storedData } from "./state";
import { getColorFromTheme } from "./utils";
import { normalizeCustomColors } from "../../common/color-themes";

beforeEach(() => {
  Object.assign(extConfig, { colorTheme: "custom", customColors: normalizeCustomColors(), coloredBar: true });
  storedData.videoId = "abcdefghijk";
  document.documentElement.removeAttribute("dark");
});

test("changes custom colors in an open tab and refreshes the current video's presentation", () => {
  storageChangeHandler({ customColors: { newValue: { light: { like: "#123456" } } } }, "sync");
  expect(getColorFromTheme(true)).toBe("#123456");
  expect(getColorFromTheme(false)).toBe("#b300b3");
  expect(refreshReactionPresentation).toHaveBeenCalled();
  expect(createRateBar).toHaveBeenCalledWith(300, 100);
});

test("ignores custom color events from other storage areas", () => {
  storageChangeHandler({ customColors: { newValue: { light: { like: "#123456" } } } }, "local");
  expect(getColorFromTheme(true)).toBe("#007600");
  expect(createRateBar).not.toHaveBeenCalled();
});

test("removing stored custom colors restores defaults", () => {
  extConfig.customColors.light.like = "#123456";
  storageChangeHandler({ customColors: { newValue: undefined } }, "sync");
  expect(extConfig.customColors).toEqual(normalizeCustomColors());
});

test("preset switching keeps custom colors and repaints the ratio bar", () => {
  const colors = normalizeCustomColors({ light: { dislike: "#654321" } });
  extConfig.customColors = colors;
  storageChangeHandler({ colorTheme: { newValue: "neon" } }, "sync");
  expect(getColorFromTheme(false)).toBe("magenta");
  storageChangeHandler({ colorTheme: { newValue: "custom" } }, "sync");
  expect(getColorFromTheme(false)).toBe("#654321");
  expect(extConfig.customColors).toEqual(colors);
  expect(createRateBar).toHaveBeenCalledTimes(2);
});

test("does not repaint the new page's bar using the previous video's counts", () => {
  storedData.videoId = "zyxwvutsrqp";
  storageChangeHandler({ colorTheme: { newValue: "hibiscus" } }, "sync");
  expect(createRateBar).not.toHaveBeenCalled();
});

test("theme attribute changes repaint current controls without fetching counts", async () => {
  observeColorTheme();
  observeColorTheme();
  document.documentElement.setAttribute("dark", "");
  await Promise.resolve();
  expect(getColorFromTheme(true)).toBe("#00d000");
  expect(refreshReactionPresentation).toHaveBeenCalledTimes(1);
  expect(createRateBar).toHaveBeenCalledTimes(1);
  document.documentElement.removeAttribute("dark");
  await Promise.resolve();
  expect(getColorFromTheme(true)).toBe("#007600");
  expect(createRateBar).toHaveBeenCalledTimes(2);
});
