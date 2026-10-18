/**
 * @jest-environment jsdom
 */

import {
  HIDE_CLUTTER_BUTTONS_ATTRIBUTE,
  HIDE_CLUTTER_BUTTONS_STORAGE_KEY,
  normalizeHideClutterButtons,
  publishHideClutterButtons,
} from "./clutter-button-setting";

describe("clutter button setting", () => {
  test("uses the stable storage and page-world attribute contract", () => {
    expect(HIDE_CLUTTER_BUTTONS_STORAGE_KEY).toBe("hideClutterButtons");
    expect(HIDE_CLUTTER_BUTTONS_ATTRIBUTE).toBe("data-ryd-hide-clutter-buttons");
  });

  test.each([
    [true, true],
    [false, false],
    [undefined, false],
    [null, false],
    ["true", false],
    [1, false],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeHideClutterButtons(input)).toBe(expected);
  });

  test("publishes both enabled and disabled states for the injected menu fixer", () => {
    expect(publishHideClutterButtons(true)).toBe(true);
    expect(document.documentElement.getAttribute(HIDE_CLUTTER_BUTTONS_ATTRIBUTE)).toBe("true");

    expect(publishHideClutterButtons(false)).toBe(false);
    expect(document.documentElement.getAttribute(HIDE_CLUTTER_BUTTONS_ATTRIBUTE)).toBe("false");
  });

  test("still normalizes the value when no document root is available", () => {
    expect(publishHideClutterButtons(true, null)).toBe(true);
  });
});
