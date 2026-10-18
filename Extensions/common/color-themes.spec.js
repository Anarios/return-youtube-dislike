/** @jest-environment jsdom */

import {
  DEFAULT_CUSTOM_COLORS,
  getThemeColor,
  isYouTubeDarkTheme,
  normalizeCustomColors,
  observeYouTubeTheme,
} from "./color-themes";

afterEach(() => document.documentElement.removeAttribute("dark"));

test.each([
  ["classic", "lime", "red"],
  ["accessible", "dodgerblue", "gold"],
  ["neon", "aqua", "magenta"],
  [undefined, "lime", "red"],
])("preserves the %s palette on both backgrounds", (name, like, dislike) => {
  for (const dark of [false, true]) {
    expect(getThemeColor(name, true, dark)).toBe(like);
    expect(getThemeColor(name, false, dark)).toBe(dislike);
  }
});

test("Hibiscus uses distinct light and dark palettes without reading custom settings", () => {
  const custom = { light: { like: "#123456", dislike: "#654321" } };
  expect(getThemeColor("hibiscus", true, false, custom)).toBe("#007600");
  expect(getThemeColor("hibiscus", false, false, custom)).toBe("#b300b3");
  expect(getThemeColor("hibiscus", true, true, custom)).toBe("#00d000");
  expect(getThemeColor("hibiscus", false, true, custom)).toBe("#ff77ff");
});

test("custom colors use the matching theme and recover each malformed field independently", () => {
  const custom = {
    light: { like: "#123ABC", dislike: "red; color:transparent" },
    dark: { like: null, dislike: "#FEDCBA" },
  };
  expect(getThemeColor("custom", true, false, custom)).toBe("#123abc");
  expect(getThemeColor("custom", false, true, custom)).toBe("#fedcba");
  expect(normalizeCustomColors(custom)).toEqual({
    light: { like: "#123abc", dislike: DEFAULT_CUSTOM_COLORS.light.dislike },
    dark: { like: DEFAULT_CUSTOM_COLORS.dark.like, dislike: "#fedcba" },
  });
  const colors = normalizeCustomColors();
  colors.light.like = "#ffffff";
  expect(normalizeCustomColors().light.like).toBe("#007600");
});

test.each(["", "true", "false"])("recognizes dark attribute by its presence (%s)", (value) => {
  document.documentElement.setAttribute("dark", value);
  expect(isYouTubeDarkTheme()).toBe(true);
  document.documentElement.removeAttribute("dark");
  expect(isYouTubeDarkTheme()).toBe(false);
});

test("observes theme transitions without responding to unrelated attributes or value changes", async () => {
  const onChange = jest.fn();
  const observer = observeYouTubeTheme(onChange);
  try {
    document.documentElement.setAttribute("dark", "");
    await Promise.resolve();
    expect(onChange).toHaveBeenLastCalledWith(true);
    document.documentElement.setAttribute("dark", "true");
    document.documentElement.setAttribute("lang", "en");
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledTimes(1);
    document.documentElement.removeAttribute("dark");
    await Promise.resolve();
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  } finally {
    observer.disconnect();
  }
});

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test.each([
  [false, "#ffffff"],
  [false, "#f2f2f2"],
  [true, "#0f0f0f"],
  [true, "#272727"],
])("Hibiscus icons have at least 3:1 contrast with the theme surface (dark=%s, %s)", (dark, surface) => {
  for (const isLike of [true, false]) {
    const levels = [luminance(getThemeColor("hibiscus", isLike, dark)), luminance(surface)].sort((a, b) => b - a);
    expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(3);
  }
});

test.each([
  [false, "#f2f2f2"],
  [false, "#e5e5e5"],
  [true, "#272727"],
  [true, "#3f3f3f"],
])("Hibiscus text has at least 4.5:1 contrast with idle and hovered buttons (dark=%s, %s)", (dark, surface) => {
  for (const isLike of [true, false]) {
    const levels = [luminance(getThemeColor("hibiscus", isLike, dark)), luminance(surface)].sort((a, b) => b - a);
    expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
