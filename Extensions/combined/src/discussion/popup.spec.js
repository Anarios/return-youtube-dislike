/** @jest-environment jsdom */

import { readFileSync } from "fs";
import { join } from "path";
import { initDiscussionPopup } from "./popup";
import { requestDiscussion, subscribeDiscussionEvents } from "./client";

jest.mock("./client", () => ({
  requestDiscussion: jest.fn(),
  subscribeDiscussionEvents: jest.fn(),
}));

const popupHtml = readFileSync(join(__dirname, "../../popup.html"), "utf8");
const session = { authenticated: true, profile: { id: "reader" } };
const unsubscribe = jest.fn();
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
let toggle;
let root;
let receive;
let scrollTo;

beforeEach(() => {
  document.documentElement.className = "";
  document.documentElement.lang = "en";
  document.body.innerHTML = new DOMParser().parseFromString(popupHtml, "text/html").body.innerHTML;
  global.chrome = { i18n: { getUILanguage: () => "en" } };
  requestDiscussion.mockImplementation(async (operation) =>
    operation === "session" ? session : { items: [], nextCursor: null, unreadCount: 0 },
  );
  subscribeDiscussionEvents.mockImplementation((listener) => {
    receive = listener;
    return unsubscribe;
  });
  Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  initDiscussionPopup();
  toggle = document.getElementById("ryd-discussion-inbox-toggle");
  root = document.getElementById("ryd-discussion-popup");
});

afterEach(() => {
  window.dispatchEvent(new Event("unload"));
  scrollTo.mockRestore();
  delete global.chrome;
});

test("opens an independent inbox view with focused back navigation and an inactive home screen", async () => {
  await flush();
  expect(root.parentElement).toBe(document.body);
  expect(root.hidden).toBe(true);
  expect(root.inert).toBe(true);
  const consent = document.createElement("div");
  consent.id = "ryd-consent-prompt";
  consent.inert = false;
  document.body.append(consent);

  toggle.click();

  expect(root.hidden).toBe(false);
  expect(root.inert).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(root.querySelector(".ryd-discussion-inbox-back"));
  for (const node of document.body.children) {
    if (node === root || node === consent || ["SCRIPT", "STYLE", "LINK"].includes(node.tagName)) continue;
    expect(node.hidden).toBe(true);
    expect(node.inert).toBe(true);
  }
  expect(consent.hidden).toBe(false);
  expect(consent.inert).toBe(false);
  expect(requestDiscussion).toHaveBeenLastCalledWith("notifications", {});
});

test.each(["back", "Escape"])("%s returns to the original home state, focus, and scroll", async (action) => {
  await flush();
  const home = document.querySelector("center");
  home.inert = false;
  const settings = document.getElementById("advancedSettings");
  settings.hidden = true;
  settings.inert = true;
  Object.defineProperty(window, "scrollY", { configurable: true, value: 180 });

  toggle.click();
  if (action === "back") root.querySelector(".ryd-discussion-inbox-back").click();
  else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));

  expect(root.hidden).toBe(true);
  expect(root.inert).toBe(true);
  expect(document.documentElement.classList.contains("ryd-discussion-inbox-open")).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  expect(home.hidden).toBe(false);
  expect(home.inert).toBe(false);
  expect(settings.hidden).toBe(true);
  expect(settings.inert).toBe(true);
  expect(scrollTo).toHaveBeenLastCalledWith(0, 180);
});

test("a shared inbox update preserves the current screen and its navigation", async () => {
  await flush();
  toggle.click();
  const back = root.querySelector(".ryd-discussion-inbox-back");
  receive({ type: "inbox", data: { items: [], unreadCount: 3 } });

  expect(root.hidden).toBe(false);
  expect(toggle.textContent).toBe("Notifications (3)");
  expect(document.activeElement).toBe(back);
  back.click();
  expect(document.activeElement).toBe(toggle);
});

test("private Firefox popup initialization does not request or subscribe to account data", async () => {
  await flush();
  window.dispatchEvent(new Event("unload"));
  document.body.innerHTML = new DOMParser().parseFromString(popupHtml, "text/html").body.innerHTML;
  requestDiscussion.mockClear();
  subscribeDiscussionEvents.mockClear();
  global.browser = {
    runtime: { getManifest: () => ({ browser_specific_settings: { gecko: {} } }) },
    extension: { inIncognitoContext: true },
  };
  try {
    initDiscussionPopup();
    const privateRoot = document.getElementById("ryd-discussion-popup");
    document.getElementById("ryd-discussion-inbox-toggle").click();
    expect(privateRoot.hidden).toBe(true);
    expect(privateRoot.childElementCount).toBe(0);
    expect(requestDiscussion).not.toHaveBeenCalled();
    expect(subscribeDiscussionEvents).not.toHaveBeenCalled();
  } finally {
    delete global.browser;
  }
});

test("Escape on the home screen leaves the popup unchanged", () => {
  const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(root.hidden).toBe(true);
  expect(scrollTo).not.toHaveBeenCalled();
});
