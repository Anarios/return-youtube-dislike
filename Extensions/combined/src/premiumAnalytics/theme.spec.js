/**
 * @jest-environment jsdom
 */

import { getTextColor, getMutedTextColor, getBorderColor, getSurfaceColor, getHoverFillColor, isDarkTheme } from "./theme";

describe("premiumAnalytics.theme", () => {
  const originalGetComputedStyle = window.getComputedStyle;

  beforeEach(() => {
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

  it("derives surface colors based on theme", () => {
    document.documentElement.setAttribute('dark', '');
    window.getComputedStyle.mockImplementation(() => ({
      getPropertyValue: (name) => {
        if (name === "--yt-spec-text-primary") return "#fefefe";
        if (name === "--yt-spec-text-secondary") return "#b0b0b0";
        return "";
      },
    }));
    expect(isDarkTheme()).toBe(true);
    expect(getSurfaceColor()).toBe('rgba(255,255,255,0.02)');
    expect(getHoverFillColor()).toBe('rgba(255,255,255,0.18)');

    document.documentElement.removeAttribute('dark');
    document.documentElement.setAttribute('light', '');
    window.getComputedStyle.mockImplementation(() => ({
      getPropertyValue: (name) => {
        if (name === "--yt-spec-text-primary") return "#111111";
        if (name === "--yt-spec-text-secondary") return "#333333";
        return "";
      },
    }));
    expect(isDarkTheme()).toBe(false);
    expect(getBorderColor(0.2)).toBe('rgba(15,23,42,0.2)');
    expect(getSurfaceColor()).toBe('rgba(15,23,42,0.06)');
    expect(getHoverFillColor()).toBe('rgba(15,23,42,0.18)');
    document.documentElement.removeAttribute('light');
  });
});
