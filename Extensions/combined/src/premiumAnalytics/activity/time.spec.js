/**
 * @jest-environment jsdom
 */

import { analyticsState, resetStateForVideo } from "../state";
import {
  computeChartBounds,
  updateGlobalBounds,
  clampRangeToBounds,
  combineBounds,
} from "./time";

function initializeState() {
  resetStateForVideo();
  analyticsState.globalTimeBounds = { min: null, max: null };
}

describe("premiumAnalytics.time", () => {
  beforeEach(() => {
    initializeState();
  });

  describe("computeChartBounds", () => {
    it("returns fallback when timeline empty", () => {
      const bounds = computeChartBounds([], [], 60 * 1000);
      expect(bounds.max - bounds.min).toBeGreaterThan(0);
    });

    it("derives bounds from non-zero series", () => {
      const now = Date.now();
      const points = [
        { timestampUtc: new Date(now - 10_000).toISOString(), likes: 0, dislikes: 0 },
        { timestampUtc: new Date(now - 5_000).toISOString(), likes: 3, dislikes: 1 },
        { timestampUtc: new Date(now).toISOString(), likes: 4, dislikes: 0 },
      ];
      const timeline = [now - 10_000, now - 5_000, now];

      const bounds = computeChartBounds(points, timeline, 1000);

      expect(bounds.min).toBe(timeline[1]);
      expect(bounds.max).toBe(timeline[2]);
    });

    it("expands identical bounds by bucket size", () => {
      const now = Date.now();
      const points = [{ timestampUtc: new Date(now).toISOString(), likes: 5, dislikes: 0 }];
      const bounds = computeChartBounds(points, [now], 2000);

      expect(bounds.max - bounds.min).toBe(60 * 1000);
    });
  });

  describe("updateGlobalBounds", () => {
    it("captures minimum and maximum values", () => {
      updateGlobalBounds({ min: 100, max: 200 });
      expect(analyticsState.globalTimeBounds).toEqual({ min: 100, max: 200 });

      updateGlobalBounds({ min: 50, max: 250 });
      expect(analyticsState.globalTimeBounds).toEqual({ min: 50, max: 250 });
    });
  });

  describe("clampRangeToBounds", () => {
    it("returns null when bounds incomplete", () => {
      expect(clampRangeToBounds({ from: 0, to: 1 }, { min: null, max: 10 })).toBeNull();
    });

    it("clamps values inside bounds", () => {
      const result = clampRangeToBounds({ from: -5, to: 15 }, { min: 0, max: 10 });
      expect(result).toEqual({ from: 0, to: 10 });
    });

    it("rejects invalid ranges", () => {
      expect(clampRangeToBounds({ from: 5, to: 1 }, { min: 0, max: 10 })).toBeNull();
    });
  });

  describe("combineBounds", () => {
    it("prefers primary values when finite", () => {
      expect(combineBounds({ min: 1, max: 5 }, { min: 2, max: 6 })).toEqual({ min: 1, max: 5 });
    });

    it("falls back to secondary when primary missing", () => {
      expect(combineBounds({ min: null, max: null }, { min: 4, max: 8 })).toEqual({ min: 4, max: 8 });
    });
  });
});
