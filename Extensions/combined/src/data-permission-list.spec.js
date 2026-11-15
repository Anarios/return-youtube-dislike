/** @jest-environment jsdom */
import { FEATURE_DATA_PERMISSIONS } from "./core-data-consent";
import { DATA_PERMISSION_COPY, renderDataPermissionList } from "./data-permission-list";

const messages = require("../_locales/en/messages.json");

describe("Firefox data permission list", () => {
  const entries = (list) => [...list.children].map((node) => [node.tagName, node.textContent]);

  test.each(Object.keys(FEATURE_DATA_PERMISSIONS))("explains every category the %s feature requests", (feature) => {
    const list = document.createElement("dl");
    renderDataPermissionList(list, feature, (key) => key);
    expect(entries(list)).toEqual(
      FEATURE_DATA_PERMISSIONS[feature].flatMap((category) => [
        ["DT", DATA_PERMISSION_COPY[category].label],
        ["DD", DATA_PERMISSION_COPY[category].body],
      ]),
    );
  });

  test("every explained category has English copy", () => {
    for (const { label, body } of Object.values(DATA_PERMISSION_COPY)) {
      expect(messages[label]?.message).toBeTruthy();
      expect(messages[body]?.message).toBeTruthy();
    }
  });

  test("replaces earlier entries instead of appending", () => {
    const list = document.createElement("dl");
    renderDataPermissionList(list, "voteOptIn", (key) => key);
    renderDataPermissionList(list, "account", (key) => key);
    expect(list.querySelectorAll("dt")).toHaveLength(FEATURE_DATA_PERMISSIONS.account.length);
  });

  test("renders message text as text, not markup", () => {
    const list = document.createElement("dl");
    renderDataPermissionList(list, "counts", () => "<img src=x onerror=alert(1)>");
    expect(list.querySelector("img")).toBeNull();
    expect(list.querySelector("dt").textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
