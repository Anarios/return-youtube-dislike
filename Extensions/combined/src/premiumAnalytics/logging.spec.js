/**
 * @jest-environment jsdom
 */

import {
  logTimeBounds,
  logRangeSelection,
  logFetchRequest,
  logZoomPreview,
} from "./logging";

describe("premiumAnalytics.logging", () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs time bounds when values are provided", () => {
    logTimeBounds("chart", { min: 0, max: 1 });

    expect(consoleSpy).toHaveBeenCalledWith("[PremiumAnalytics] chart bounds:", new Date(0).toISOString(), "->", new Date(1).toISOString());
  });

  it("skips logging time bounds when null", () => {
    logTimeBounds("chart", null);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs range selections", () => {
    logRangeSelection("selection", { from: 0, to: 1 });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[PremiumAnalytics] selection selection:",
      new Date(0).toISOString(),
      "->",
      new Date(1).toISOString(),
    );
  });

  it("logs fetch parameters", () => {
    const params = new URLSearchParams({ a: "1", b: "two" });
    logFetchRequest("video-id", params);

    expect(consoleSpy).toHaveBeenCalledWith("[PremiumAnalytics] fetch video=video-id params=", "a=1&b=two");
  });

  it("logs zoom preview bounds", () => {
    logZoomPreview("preview", { from: 3, to: 4 });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[PremiumAnalytics] preview preview:",
      new Date(3).toISOString(),
      "->",
      new Date(4).toISOString(),
    );
  });
});
