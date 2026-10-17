/** @jest-environment jsdom */

import { createDiscussionInbox, notificationText } from "./inbox";
import { threadUrl } from "./dom";

const ID = "11111111-1111-4111-8111-111111111111";
const notification = {
  id: ID,
  videoId: "abcdefghijk",
  commentId: ID,
  type: "reply",
  actorNickname: "Reader",
  createdAt: "2026-09-01T00:00:00Z",
  read: false,
};
let inbox;
beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = "en";
});
afterEach(() => inbox?.destroy());

test("builds a canonical discussion link rather than accepting an arbitrary destination", () => {
  expect(threadUrl(notification)).toBe(`https://www.youtube.com/watch?v=abcdefghijk#rydComment=${ID}`);
  expect(threadUrl({ ...notification, videoId: "javascript:alert(1)" })).toBeNull();
});

test("renders nicknames as text and identifies each notification for inbox actions", async () => {
  const request = jest
    .fn()
    .mockResolvedValue({ items: [{ ...notification, actorNickname: "<img src=x>" }], nextCursor: null });
  inbox = createDiscussionInbox({ request });
  document.body.append(inbox.node);
  await inbox.load();
  expect(inbox.node.querySelector("img")).toBeNull();
  expect(inbox.node.querySelector("[data-notification-id]").dataset.notificationId).toBe(ID);
  expect(inbox.node.textContent).toContain("<img src=x>");
});

test("logout prevents an older inbox response from exposing the previous account's rows", async () => {
  let resolve;
  const request = jest.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  inbox = createDiscussionInbox({ request });
  document.body.append(inbox.node);
  const pending = inbox.load();
  inbox.setSession({ authenticated: false });
  resolve({ items: [notification] });
  await pending;
  expect(inbox.node.querySelector("[data-notification-id]")).toBeNull();
});

test("a newer shared inbox broadcast cannot be overwritten by an older pending read", async () => {
  let resolve;
  const request = jest.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  inbox = createDiscussionInbox({ request });
  document.body.append(inbox.node);
  const pending = inbox.load();
  inbox.update({ items: [notification], unreadCount: 1 });
  resolve({ items: [], unreadCount: 0 });
  await pending;
  expect(inbox.node.querySelector("[data-notification-id]")).not.toBeNull();
});

test("anonymous likes notifications do not expose a reaction identity", () => {
  document.documentElement.lang = "ru";
  expect(notificationText({ type: "likes", actorNickname: null })).toBe("Кому-то понравился ваш комментарий");
});

test("a live update preserves loaded history and the remaining pagination cursor", async () => {
  const older = { ...notification, id: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-31T00:00:00Z" };
  const newest = { ...notification, id: "33333333-3333-4333-8333-333333333333", createdAt: "2026-09-02T00:00:00Z" };
  const request = jest.fn().mockResolvedValue({ items: [older], nextCursor: "oldest-page" });
  inbox = createDiscussionInbox({ request });
  inbox.update({ items: [notification], nextCursor: "older-page" });
  await inbox.load(true);
  inbox.update({ items: [newest, notification], nextCursor: "older-page" }, { live: true });
  expect([...inbox.node.querySelectorAll("[data-notification-id]")].map((node) => node.dataset.notificationId)).toEqual(
    [newest.id, notification.id, older.id],
  );
  await inbox.load(true);
  expect(request).toHaveBeenLastCalledWith("notifications", { cursor: "oldest-page" });
});

test("an account replacement clears old rows and pagination even without an intervening anonymous event", () => {
  inbox = createDiscussionInbox();
  inbox.setSession({ authenticated: true, profile: { id: "first-account" } });
  inbox.update({ items: [notification], nextCursor: "older-page" });
  inbox.setSession({ authenticated: true, profile: { id: "second-account" } });
  expect(inbox.node.querySelector("[data-notification-id]")).toBeNull();
  expect(inbox.node.lastChild.hidden).toBe(true);
});
