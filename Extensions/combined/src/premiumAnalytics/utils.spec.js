/**
 * @jest-environment jsdom
 */

import {
  sanitizeCount,
  toEpoch,
  capitalize,
  debounce,
  safeJson,
} from "./utils";

describe("premiumAnalytics.utils", () => {
  describe("sanitizeCount", () => {
    it.each([
      ["1234", 1234],
      [1234.8, 1234],
      ["0", 0],
      [-10, 0],
      ["not-a-number", 0],
    ])("normalizes %p to %p", (input, expected) => {
      expect(sanitizeCount(input)).toBe(expected);
    });
  });

  describe("toEpoch", () => {
    it("converts ISO strings to epoch milliseconds", () => {
      const date = "2025-01-02T03:04:05.000Z";
      expect(toEpoch(date)).toBe(new Date(date).getTime());
    });

    it("accepts Date instances", () => {
      const value = new Date("2025-01-02T06:07:08.000Z");
      expect(toEpoch(value)).toBe(value.getTime());
    });

    it("returns null for invalid inputs", () => {
      expect(toEpoch(null)).toBeNull();
      expect(toEpoch(undefined)).toBeNull();
      expect(toEpoch("invalid")).toBeNull();
    });
  });

  describe("capitalize", () => {
    it("capitalizes the first character", () => {
      expect(capitalize("likes")).toBe("Likes");
    });

    it("returns empty string for falsy values", () => {
      expect(capitalize("")).toBe("");
      expect(capitalize()).toBe("");
      expect(capitalize(null)).toBe("");
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("delays execution until the wait period passes", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 200);

      debounced("first");
      debounced("second");

      expect(fn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("second");
    });
  });

  describe("safeJson", () => {
    it("returns parsed JSON when response is valid", async () => {
      const response = {
        clone: () => ({
          json: () => Promise.resolve({ ok: true }),
        }),
      };

      await expect(safeJson(response)).resolves.toEqual({ ok: true });
    });

    it("returns null when parsing fails", async () => {
      const response = {
        clone: () => ({
          json: () => Promise.reject(new Error("boom")),
        }),
      };

      await expect(safeJson(response)).resolves.toBeNull();
    });
  });
});
