/**
 * @jest-environment jsdom
 */

import { getTextColor, getMutedTextColor, getBorderColor } from "./premiumAnalytics.theme";

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
});
