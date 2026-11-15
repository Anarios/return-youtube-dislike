/**
 * @jest-environment jsdom
 */

import {
  getTextColor,
  getMutedTextColor,
  getBorderColor,
  getSurfaceColor,
  getHoverFillColor,
  isDarkTheme,
  observeTheme,
} from "./theme";

describe("premiumAnalytics.theme", () => {
  const originalGetComputedStyle = window.getComputedStyle;

  beforeEach(() => {
    document.documentElement.setAttribute("dark", "");
    document.documentElement.removeAttribute("light");
    window.getComputedStyle = jest.fn().mockImplementation(() => ({
      getPropertyValue: (name) => {
        if (name === "--yt-spec-text-primary") return " #fefefe  ";
        if (name === "--yt-spec-text-secondary") return " #0b0b0b  ";
        return "";
      },
    }));
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
    document.documentElement.removeAttribute("dark");
    document.documentElement.removeAttribute("light");
    document.documentElement.removeAttribute("style");
  });

  it("returns trimmed primary text color", () => {
    expect(getTextColor()).toBe("#fefefe");
  });

  it("returns trimmed secondary text color", () => {
    expect(getMutedTextColor()).toBe("#0b0b0b");
  });

  it("builds rgba border color with provided alpha", () => {
    expect(getBorderColor(0.33)).toBe("rgba(255,255,255,0.33)");
    expect(getBorderColor()).toBe("rgba(255,255,255,0.15)");
  });

  it.each([null, "false"])("uses light fallbacks without an enabled dark marker (%s)", (dark) => {
    if (dark === null) document.documentElement.removeAttribute("dark");
    else document.documentElement.setAttribute("dark", dark);
    window.getComputedStyle.mockReturnValue({ getPropertyValue: () => "" });
    expect(isDarkTheme()).toBe(false);
    expect(getTextColor()).toBe("#0f0f0f");
    expect(getMutedTextColor()).toBe("#606060");
    expect(getBorderColor()).toBe("rgba(15,23,42,0.15)");
  });

  it("uses dark fallbacks only while the host dark marker is enabled", () => {
    window.getComputedStyle.mockReturnValue({ getPropertyValue: () => "" });
    expect(isDarkTheme()).toBe(true);
    expect(getTextColor()).toBe("#ffffff");
    expect(getMutedTextColor()).toBe("#b3b3b3");
    document.documentElement.setAttribute("light", "");
    expect(isDarkTheme()).toBe(false);
    expect(getTextColor()).toBe("#0f0f0f");
  });

  it("notifies for effective theme colors and stops observing after disconnect", async () => {
    window.getComputedStyle.mockReturnValue({ getPropertyValue: () => "" });
    const changed = jest.fn();
    const observer = observeTheme(changed);
    document.documentElement.style.setProperty("--unrelated", "1");
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    document.documentElement.removeAttribute("dark");
    await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(1);
    document.documentElement.setAttribute("dark", "");
    await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(2);
    observer.disconnect();
    document.documentElement.removeAttribute("dark");
    await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("derives surface colors based on theme", () => {
    document.documentElement.setAttribute("dark", "");
    window.getComputedStyle.mockImplementation(() => ({
      getPropertyValue: (name) => {
        if (name === "--yt-spec-text-primary") return "#fefefe";
        if (name === "--yt-spec-text-secondary") return "#b0b0b0";
        return "";
      },
    }));
    expect(isDarkTheme()).toBe(true);
    expect(getSurfaceColor()).toBe("rgba(255,255,255,0.02)");
    expect(getHoverFillColor()).toBe("rgba(255,255,255,0.18)");

    document.documentElement.removeAttribute("dark");
    document.documentElement.setAttribute("light", "");
    window.getComputedStyle.mockImplementation(() => ({
      getPropertyValue: (name) => {
        if (name === "--yt-spec-text-primary") return "#111111";
        if (name === "--yt-spec-text-secondary") return "#333333";
        return "";
      },
    }));
    expect(isDarkTheme()).toBe(false);
    expect(getBorderColor(0.2)).toBe("rgba(15,23,42,0.2)");
    expect(getSurfaceColor()).toBe("rgba(15,23,42,0.06)");
    expect(getHoverFillColor()).toBe("rgba(15,23,42,0.18)");
    document.documentElement.removeAttribute("light");
  });
});
