/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

const extensionRoot = path.resolve(__dirname, "..");

beforeEach(() => {
  document.documentElement.innerHTML = fs.readFileSync(path.join(extensionRoot, "popup.html"), "utf8");
});

test("popup exposes an off-by-default hide-clutter checkbox", () => {
  const checkbox = document.getElementById("hide_clutter_buttons");

  expect(checkbox).toBeInstanceOf(HTMLInputElement);
  expect(checkbox.type).toBe("checkbox");
  expect(checkbox.checked).toBe(false);
  expect(document.querySelector('label[for="hide_clutter_buttons"]')).not.toBeNull();
});

test("question-mark help is keyboard focusable and describes the rich tooltip", () => {
  const help = document.getElementById("hide_clutter_buttons_help");
  const tooltip = document.getElementById("hide_clutter_buttons_tooltip");

  expect(help.tagName).toBe("BUTTON");
  expect(help.type).toBe("button");
  expect(help.textContent.trim()).toBe("?");
  expect(help.getAttribute("aria-describedby")).toBe(tooltip.id);
  expect(tooltip.getAttribute("role")).toBe("tooltip");
});

test("tooltip contains stable before and after image hooks", () => {
  const before = document.querySelector('[data-hide-clutter-example="before"]');
  const after = document.querySelector('[data-hide-clutter-example="after"]');

  expect(before.getAttribute("src")).toBe("images/hide-clutter-before.png");
  expect(after.getAttribute("src")).toBe("images/hide-clutter-after.png");
  expect(before.getAttribute("alt")).toBe("__MSG_hideClutterButtonsBefore__");
  expect(after.getAttribute("alt")).toBe("__MSG_hideClutterButtonsAfter__");
});

test("every shipped locale provides non-empty hide-clutter copy", () => {
  const messageKeys = [
    "hideClutterButtons",
    "hideClutterButtonsHelpLabel",
    "hideClutterButtonsDescription",
    "hideClutterButtonsBefore",
    "hideClutterButtonsAfter",
  ];
  const localeRoot = path.join(extensionRoot, "_locales");
  const localeDirectories = fs.readdirSync(localeRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  expect(localeDirectories).toHaveLength(22);
  for (const locale of localeDirectories) {
    const messages = JSON.parse(fs.readFileSync(path.join(localeRoot, locale.name, "messages.json"), "utf8"));
    for (const key of messageKeys) {
      expect(messages[key]?.message).toEqual(expect.any(String));
      expect(messages[key].message.trim()).not.toBe("");
    }
  }
});
