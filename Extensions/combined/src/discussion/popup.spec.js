/** @jest-environment jsdom */

import { readFileSync } from "fs";
import { join } from "path";
import { initDiscussionPopup } from "./popup";
import { initCountsConsentPopup } from "../counts-consent-popup";
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
let popupController;

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
  popupController = initDiscussionPopup();
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
  toggle.click();

  expect(root.hidden).toBe(false);
  expect(root.inert).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(root.querySelector(".ryd-discussion-inbox-back"));
  for (const node of document.body.children) {
    if (node === root || ["SCRIPT", "STYLE", "LINK"].includes(node.tagName)) continue;
    expect(node.hidden).toBe(true);
    expect(node.inert).toBe(true);
  }
  expect(requestDiscussion).toHaveBeenLastCalledWith("notifications", {});
});

test.each(["back", "Escape"])("%s returns to the original home state, focus, and scroll", async (action) => {
  await flush();
  const home = document.querySelector("main");
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

test("on-demand reads keep the notifications count current without a live inbox event", async () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const read = new Set();
  const unreadCount = () => ids.length - read.size;
  requestDiscussion.mockImplementation(async (operation, payload) => {
    if (operation === "session") return session;
    if (operation === "readNotifications") {
      for (const id of payload.all ? ids : payload.ids) read.add(id);
      return { unreadCount: unreadCount(), revision: String(read.size + 2) };
    }
    return {
      items: ids.map((id) => ({
        id,
        type: "likes",
        likeCount: 1,
        createdAt: "2026-09-01T00:00:00Z",
        read: read.has(id),
      })),
      nextCursor: null,
      unreadCount: unreadCount(),
    };
  });
  await flush();
  window.dispatchEvent(new Event("unload"));
  document.body.innerHTML = new DOMParser().parseFromString(popupHtml, "text/html").body.innerHTML;
  requestDiscussion.mockClear();
  initDiscussionPopup();
  toggle = document.getElementById("ryd-discussion-inbox-toggle");
  root = document.getElementById("ryd-discussion-popup");
  await flush();
  expect(toggle.textContent).toBe("Notifications (2)");
  toggle.click();
  await flush();
  root.querySelector(".ryd-discussion-notification button").click();
  await flush();
  expect(toggle.textContent).toBe("Notifications (1)");
  root.querySelector(".ryd-discussion-inbox > .ryd-discussion-toolbar button").click();
  await flush();
  root.querySelector(".ryd-discussion-inbox-back").click();
  expect(toggle.textContent).toBe("Notifications");
  expect(requestDiscussion.mock.calls.map(([operation]) => operation)).toEqual([
    "session",
    "notifications",
    "notifications",
    "readNotifications",
    "readNotifications",
    "notifications",
  ]);
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

test("opening the inbox makes an explicit notification request after popup session recovery", async () => {
  await flush();
  expect(requestDiscussion).toHaveBeenCalledWith("session");
  requestDiscussion.mockClear();
  toggle.click();
  await flush();
  expect(requestDiscussion).toHaveBeenCalledTimes(1);
  expect(requestDiscussion).toHaveBeenCalledWith("notifications", {});
});

test("revoking count access restores the inbox background before presenting usable count controls", async () => {
  await flush();
  let granted = true;
  let revoke;
  Object.assign(chrome, {
    runtime: { getManifest: () => require("../../manifest-firefox.json") },
    permissions: {
      getAll: async () => ({ data_collection: granted ? ["browsingActivity"] : [] }),
      onAdded: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: (listener) => (revoke = listener), removeListener: jest.fn() },
    },
  });
  chrome.i18n.getMessage = (key) => key;
  initCountsConsentPopup({ beforeShow: () => popupController.close() });
  await flush();
  toggle.click();
  const section = document.getElementById("ryd-counts-consent");
  expect(section.inert).toBe(true);
  granted = false;
  revoke({ data_collection: ["browsingActivity"] });
  await flush();
  expect(root.hidden).toBe(true);
  expect(section.hidden).toBe(false);
  expect(section.inert).not.toBe(true);
  expect(document.documentElement.classList.contains("ryd-discussion-inbox-open")).toBe(false);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
  expect(section.hidden).toBe(false);
  document.getElementById("ryd-counts-consent-dismiss").click();
  expect(section.hidden).toBe(true);
  expect(document.body.classList.contains("ryd-counts-consent-open")).toBe(false);
  expect(document.querySelector("main").hidden).toBe(false);
});
