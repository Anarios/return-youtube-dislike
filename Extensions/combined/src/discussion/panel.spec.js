/** @jest-environment jsdom */

import { readFileSync } from "fs";
import { join } from "path";
import { createDiscussionPanel } from "./panel";
import { discussionText } from "./localize";
import english from "../../_locales/en/messages.json";

const otherSession = {
  authenticated: true,
  canPost: true,
  isModerator: false,
  profile: { id: "55555555-5555-4555-8555-555555555555", nickname: "Other writer" },
};

function identityForm(root, kind) {
  if (kind === "root") return root.querySelector(".ryd-discussion-composer form");
  root.querySelector(`[data-action='${kind === "edit" ? "edit" : "reply"}']`).click();
  return root.querySelector(".ryd-discussion-inline-editor form");
}

function typeIdentityDraft(form, text) {
  const input = form.querySelector("textarea");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

test.each(["root", "reply", "edit"])("identity change discards the previous account's %s draft", async (kind) => {
  const root = await mount({ session });
  typeIdentityDraft(identityForm(root, kind), "Private draft for first account");
  panel.setSession(otherSession);
  await flush();
  expect(root.querySelector(".ryd-discussion-composer textarea").value).toBe("");
  expect(root.querySelector("[data-action='edit']")).toBeNull();
  panel.setSession(session);
  await flush();
  expect(identityForm(root, kind).querySelector("textarea").value).toBe(kind === "edit" ? "First comment" : "");
});

test("logout prevents a root draft returning after signing in again", async () => {
  const root = await mount({ session });
  typeIdentityDraft(identityForm(root, "root"), "First account draft");
  panel.setSession({ authenticated: false, canPost: false, profile: null });
  await flush();
  panel.setSession(session);
  await flush();
  expect(identityForm(root, "root").querySelector("textarea").value).toBe("");
});

test("same-account refresh preserves a failed submission's retry ID", async () => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest
      .fn()
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444")
      .mockReturnValue("66666666-6666-4666-8666-666666666666"),
  });
  const root = await mount({ session });
  request.mockRejectedValueOnce({ code: "unavailable" });
  submit(identityForm(root, "root"), "Retry my own draft");
  await flush();
  panel.setSession({ ...session });
  await flush();
  request.mockResolvedValueOnce(comment({ text: "Retry my own draft" }));
  identityForm(root, "root").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  const creates = request.mock.calls.filter(([operation]) => operation === "createComment");
  expect(creates).toHaveLength(2);
  expect(creates[1][1].requestId).toBe(creates[0][1].requestId);
});

test.each(["root", "reply", "edit"])("same-account refresh preserves its %s draft", async (kind) => {
  const root = await mount({ session });
  typeIdentityDraft(identityForm(root, kind), "Keep my own draft");
  panel.setSession({ ...session, profile: { ...session.profile } });
  await flush();
  expect(identityForm(root, kind).querySelector("textarea").value).toBe("Keep my own draft");
});

test.each(["root", "reply", "edit"])("old %s completion cannot clear a draft after A to B to A", async (kind) => {
  const root = await mount({ session });
  let finish;
  const operation = kind === "edit" ? "editComment" : "createComment";
  request.mockImplementation((name) => {
    if (name === operation)
      return new Promise((resolve) => {
        finish = resolve;
      });
    return Promise.resolve({ items: [comment()], nextCursor: null });
  });
  submit(identityForm(root, kind), "Old pending submission");
  panel.setSession(otherSession);
  await flush();
  panel.setSession(session);
  await flush();
  typeIdentityDraft(identityForm(root, kind), "New draft after returning");
  finish(comment({ ...(kind === "reply" ? { id: REPLY, parentId: ROOT } : {}), text: "Old pending submission" }));
  await flush();
  panel.setSession({ ...session });
  await flush();
  expect(identityForm(root, kind).querySelector("textarea").value).toBe("New draft after returning");
});

const VIDEO = "abcdefghijk";
const ROOT = "11111111-1111-1111-1111-111111111111";
const REPLY = "22222222-2222-2222-2222-222222222222";
const PROFILE = "33333333-3333-3333-3333-333333333333";
const session = {
  authenticated: true,
  canPost: true,
  isModerator: false,
  profile: { id: PROFILE, nickname: "Writer" },
};
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
let panel;
let request;

function comment(overrides = {}) {
  return {
    id: ROOT,
    videoId: VIDEO,
    parentId: null,
    replyToId: null,
    author: { id: PROFILE, nickname: "Writer" },
    text: "First comment",
    createdAt: "2026-09-01T12:00:00Z",
    editedAt: null,
    deleted: false,
    hidden: false,
    likes: 2,
    dislikes: 1,
    myReaction: 0,
    replyCount: 0,
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

async function mount(options = {}, comments = [comment()]) {
  request = jest.fn(async (operation) =>
    operation === "comments" ? { items: comments, nextCursor: null } : { items: [], nextCursor: null },
  );
  panel = createDiscussionPanel({ videoId: VIDEO, request, ...options });
  document.body.append(panel.root);
  await panel.load();
  return panel.root;
}

function submit(form, text) {
  const input = form.querySelector("textarea");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = "en";
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "44444444-4444-4444-4444-444444444444",
  });
});
afterEach(() => panel?.destroy());

test("an older comment deep-link response cannot replace the user's newer focused target", async () => {
  const root = await mount({ session });
  let resolveReply;
  request.mockImplementation((operation, payload) => {
    if (operation === "comment" && payload.id === REPLY)
      return new Promise((resolve) => {
        resolveReply = resolve;
      });
    if (operation === "comment") return Promise.resolve(comment());
    return Promise.resolve({ items: [], nextCursor: null });
  });
  const oldFocus = panel.focusComment(REPLY);
  await panel.focusComment(ROOT);
  resolveReply(comment({ id: REPLY, parentId: ROOT, text: "Older linked reply" }));
  await oldFocus;
  expect(document.activeElement.dataset.commentId).toBe(ROOT);
  expect(root.querySelector(`[data-comment-id="${REPLY}"]`)).toBeNull();
});

test("signed-out users can react without seeing author or moderator controls", async () => {
  const root = await mount();
  expect(root.querySelector("textarea")).toBeNull();
  expect(root.querySelector("[data-action='edit']")).toBeNull();
  expect(root.querySelector("[data-action='moderation']").hidden).toBe(true);
  request.mockResolvedValueOnce({ commentId: ROOT, likes: 3, dislikes: 1, myReaction: 1 });
  root.querySelector("[data-reaction='1']").click();
  await flush();
  expect(request).toHaveBeenLastCalledWith("react", { id: ROOT, value: 1 });
  expect(root.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
  expect(root.querySelector("[data-reaction='1']").textContent).toBe("3");
  request.mockResolvedValueOnce({ commentId: ROOT, likes: 2, dislikes: 1, myReaction: 0 });
  root.querySelector("[data-reaction='1']").click();
  await flush();
  expect(request).toHaveBeenLastCalledWith("react", { id: ROOT, value: 0 });
});

test("explains why posting is paid between the membership gate and the join link", async () => {
  const root = await mount();
  const gate = root.querySelector(".ryd-discussion-composer > .ryd-discussion-gate");
  const why = gate.nextElementSibling;
  expect(why.className).toBe("ryd-discussion-why");
  expect(why.textContent).toBe(english.paidFeaturesWhy.message);
  expect(why.nextElementSibling.className).toBe("ryd-discussion-link");
});

test("renders comment bodies and nicknames as literal text", async () => {
  const root = await mount({}, [
    comment({
      text: '<img src=x onerror="bad()">\nSecond line',
      author: { id: PROFILE, nickname: "<script>bad()</script>" },
    }),
  ]);
  expect(root.querySelector(".ryd-discussion-comment-text").textContent).toContain("<img");
  expect(root.querySelector("img, script")).toBeNull();
});

test("keeps a failed submission draft and reuses its idempotency ID on retry", async () => {
  const root = await mount({ session });
  const form = root.querySelector(".ryd-discussion-composer form");
  request.mockRejectedValueOnce({ code: "unavailable" });
  submit(form, "A new comment");
  await flush();
  const first = request.mock.calls.find(([operation]) => operation === "createComment")[1];
  expect(form.querySelector("textarea").value).toBe("A new comment");
  request.mockResolvedValueOnce(comment({ text: "A new comment" }));
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  const creates = request.mock.calls.filter(([operation]) => operation === "createComment");
  expect(creates).toHaveLength(2);
  expect(creates[1][1].requestId).toBe(first.requestId);
  expect(first).toMatchObject({ videoId: VIDEO, text: "A new comment" });
});

test("guards blank posts and duplicate clicks while saving", async () => {
  const root = await mount({ session });
  const form = root.querySelector(".ryd-discussion-composer form");
  submit(form, "    ");
  expect(request.mock.calls.filter(([operation]) => operation === "createComment")).toHaveLength(0);
  let resolve;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  submit(form, "Hello");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(request.mock.calls.filter(([operation]) => operation === "createComment")).toHaveLength(1);
  resolve(comment());
  await flush();
});

test("nickname onboarding persists a chosen nickname without deriving one from account details", async () => {
  const root = await mount({
    session: { ...session, profile: null, fullName: "Private Name", email: "private@example.test" },
  });
  const input = root.querySelector("input[name='nickname']");
  expect(input.value).toBe("");
  expect(root.textContent).not.toContain("private@example.test");
  input.value = "New Writer";
  request.mockResolvedValueOnce({ ...session, profile: { id: PROFILE, nickname: "New Writer" } });
  input.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(request).toHaveBeenLastCalledWith("profile", { nickname: "New Writer" });
  expect(root.querySelector("textarea[name='comment']")).not.toBeNull();
});

test("inactive members retain their own edit/delete controls while another account does not", async () => {
  const root = await mount({ session: { ...session, canPost: false } });
  expect(root.querySelector("[data-action='edit']")).not.toBeNull();
  expect(root.querySelector("[data-action='delete']")).not.toBeNull();
  panel.setSession({ ...session, profile: { id: REPLY, nickname: "Other" } });
  expect(root.querySelector("[data-action='edit']")).toBeNull();
  panel.setSession({ authenticated: false, profile: null });
  expect(root.querySelector("[data-action='report']")).toBeNull();
});

test("a nickname request finishing after logout cannot restore the previous account composer", async () => {
  const root = await mount({ session: { ...session, profile: null } });
  let resolve;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const input = root.querySelector("input[name='nickname']");
  input.value = "Writer";
  input.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  panel.setSession({ authenticated: false, canPost: false, profile: null });
  resolve(session);
  await flush();
  expect(root.querySelector("textarea[name='comment']")).toBeNull();
  expect(root.querySelector("[data-action='inbox']").hidden).toBe(true);
});

test("signing in refreshes ownership flags previously fetched while signed out", async () => {
  const root = await mount({}, [comment({ canEdit: false, canDelete: false })]);
  request.mockResolvedValueOnce({ items: [comment()], nextCursor: null });
  panel.setSession(session);
  await flush();
  expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "top" });
  expect(root.querySelector("[data-action='edit']")).not.toBeNull();
});

test("deletion waits for explicit inline confirmation and shows a tombstone", async () => {
  const root = await mount({ session });
  root.querySelector("[data-action='delete']").click();
  expect(request.mock.calls.some(([operation]) => operation === "deleteComment")).toBe(false);
  request.mockResolvedValueOnce(comment({ deleted: true, text: "", author: null }));
  root.querySelector("[data-action='confirm-delete']").click();
  await flush();
  expect(request).toHaveBeenLastCalledWith("deleteComment", { id: ROOT });
  expect(root.querySelector(".ryd-discussion-comment-text").textContent).toBe(discussionText("deleted"));
});

test("replies preserve the root and immediate target IDs", async () => {
  const root = await mount({ session }, [comment({ replyCount: 1 })]);
  request.mockResolvedValueOnce({
    items: [comment({ id: REPLY, parentId: ROOT, replyToId: ROOT, text: "First reply" })],
    nextCursor: null,
  });
  root.querySelector("[data-action='load-replies']").click();
  await flush();
  const reply = root.querySelector(`[data-comment-id='${REPLY}']`);
  reply.querySelector("[data-action='reply']").click();
  request.mockResolvedValueOnce(
    comment({ id: "55555555-5555-5555-5555-555555555555", parentId: ROOT, replyToId: REPLY }),
  );
  submit(reply.querySelector("form"), "Nested response");
  await flush();
  expect(request.mock.calls.find(([operation]) => operation === "createComment")[1]).toMatchObject({
    parentId: ROOT,
    replyToId: REPLY,
    text: "Nested response",
  });
  expect(root.querySelectorAll(".ryd-discussion-reply")).toHaveLength(2);
});

test("posting a reply preserves loaded pages and merges the next page without duplicating the new reply", async () => {
  const previous = Array.from({ length: 21 }, (_, index) =>
    comment({
      id: `${String(index + 10).padStart(8, "0")}-1111-4111-8111-111111111111`,
      parentId: ROOT,
      replyToId: ROOT,
      text: `Reply ${index + 1}`,
      createdAt: `2026-09-01T12:00:${String(index).padStart(2, "0")}Z`,
    }),
  );
  const created = comment({
    id: REPLY,
    parentId: ROOT,
    replyToId: ROOT,
    text: "Newest reply",
    createdAt: "2026-09-01T12:01:00Z",
  });
  const root = await mount({ session }, [comment({ replyCount: 21 })]);
  request.mockImplementation(async (operation, payload) => {
    if (operation === "createComment") return created;
    if (operation === "replies")
      return payload.cursor
        ? { items: [previous[20], created], nextCursor: null }
        : { items: previous.slice(0, 20), nextCursor: "remaining-replies" };
    return { items: [], nextCursor: null };
  });
  root.querySelector("[data-action='load-replies']").click();
  await flush();
  root.querySelector("[data-action='reply']").click();
  submit(root.querySelector(".ryd-discussion-inline-editor form"), created.text);
  await flush();
  expect(root.querySelectorAll(".ryd-discussion-reply")).toHaveLength(21);
  expect(root.querySelector(`[data-comment-id='${REPLY}']`).textContent).toContain(created.text);
  expect(request.mock.calls.filter(([operation]) => operation === "replies")).toHaveLength(1);
  root.querySelector(".ryd-discussion-replies > button").click();
  await flush();
  expect(request).toHaveBeenLastCalledWith("replies", { rootId: ROOT, cursor: "remaining-replies" });
  expect([...root.querySelectorAll(".ryd-discussion-reply")].map((row) => row.dataset.commentId)).toEqual([
    ...previous.map((item) => item.id),
    REPLY,
  ]);
});

test("posting while the first reply page is loading keeps the new reply when that page arrives", async () => {
  const thread = comment({ replyCount: 1 });
  const root = await mount({ session }, [thread]);
  const previous = comment({ id: REPLY, parentId: ROOT, replyToId: ROOT, text: "Previous reply" });
  const created = comment({
    id: "55555555-5555-4555-8555-555555555555",
    parentId: ROOT,
    replyToId: ROOT,
    text: "New reply",
    createdAt: "2026-09-01T12:00:00.001Z",
  });
  let resolveReplies;
  request.mockImplementation((operation) => {
    if (operation === "replies")
      return new Promise((resolve) => {
        resolveReplies = resolve;
      });
    return Promise.resolve(created);
  });
  root.querySelector("[data-action='load-replies']").click();
  root.querySelector("[data-action='reply']").click();
  submit(root.querySelector(".ryd-discussion-inline-editor form"), created.text);
  await flush();
  expect(root.querySelector(`[data-comment-id='${created.id}']`)).not.toBeNull();
  resolveReplies({ items: [previous], nextCursor: null });
  await flush();
  expect([...root.querySelectorAll(".ryd-discussion-reply")].map((row) => row.dataset.commentId)).toEqual([
    REPLY,
    created.id,
  ]);
  expect(thread.replyCount).toBe(2);
});

test("a reply to an unopened thread remains visible and lets a failed history fetch be retried", async () => {
  const root = await mount({ session }, [comment({ replyCount: 0 })]);
  const previous = comment({ id: REPLY, parentId: ROOT, replyToId: ROOT, text: "Earlier reply" });
  const created = comment({
    id: "55555555-5555-4555-8555-555555555555",
    parentId: ROOT,
    replyToId: ROOT,
    text: "New reply",
    createdAt: "2026-09-01T12:01:00Z",
  });
  request.mockResolvedValueOnce(created).mockRejectedValueOnce({ code: "unavailable" });
  root.querySelector("[data-action='reply']").click();
  submit(root.querySelector(".ryd-discussion-inline-editor form"), created.text);
  await flush();
  expect(root.querySelector(`[data-comment-id='${created.id}']`)).not.toBeNull();
  const showReplies = root.querySelector("[data-action='load-replies']");
  expect(showReplies.hidden).toBe(false);
  expect(showReplies.disabled).toBe(false);
  request.mockResolvedValueOnce({ items: [previous, created], nextCursor: null });
  showReplies.click();
  await flush();
  expect([...root.querySelectorAll(".ryd-discussion-reply")].map((row) => row.dataset.commentId)).toEqual([
    REPLY,
    created.id,
  ]);
  expect(showReplies.hidden).toBe(true);
});

test("posting fetches unopened history even when the root count predates another user's reply", async () => {
  const thread = comment();
  const root = await mount({ session }, [thread]);
  const previous = comment({
    id: "55555555-5555-4555-8555-555555555555",
    parentId: ROOT,
    replyToId: ROOT,
    text: "Another user's reply",
    createdAt: "2026-09-01T12:00:00Z",
  });
  const created = comment({ id: REPLY, parentId: ROOT, replyToId: ROOT, text: "First reply" });
  request.mockResolvedValueOnce(created).mockResolvedValueOnce({ items: [previous, created], nextCursor: null });
  root.querySelector("[data-action='reply']").click();
  submit(root.querySelector(".ryd-discussion-inline-editor form"), created.text);
  await flush();
  expect(root.querySelector(`[data-comment-id='${REPLY}']`)).not.toBeNull();
  expect(root.querySelector(`[data-comment-id='${previous.id}']`)).not.toBeNull();
  expect(request).toHaveBeenLastCalledWith("replies", { rootId: ROOT });
  expect(thread.replyCount).toBe(2);
});

test("top/new sorting discards the prior pagination cursor", async () => {
  const root = await mount();
  root.querySelector(".ryd-discussion-sort > [data-sort='new']").click();
  await flush();
  expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "new" });
});

test("sort order is a labelled toggle-button group that reloads only when the order changes", async () => {
  const root = await mount();
  const group = root.querySelector(".ryd-discussion-toolbar > .ryd-discussion-sort");
  expect(root.querySelector(".ryd-discussion-toolbar select")).toBeNull();
  expect(group.getAttribute("role")).toBe("group");
  expect(group.getAttribute("aria-label")).toBe(discussionText("sort"));
  const [top, newest] = group.querySelectorAll("button");
  expect([top.textContent, newest.textContent]).toEqual([discussionText("top"), discussionText("new")]);
  expect([top.type, newest.type]).toEqual(["button", "button"]);
  expect([top.getAttribute("aria-pressed"), newest.getAttribute("aria-pressed")]).toEqual(["true", "false"]);
  const requests = request.mock.calls.length;
  top.click();
  await flush();
  expect(request).toHaveBeenCalledTimes(requests);
  newest.click();
  await flush();
  expect([top.getAttribute("aria-pressed"), newest.getAttribute("aria-pressed")]).toEqual(["false", "true"]);
  expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "new" });
  top.click();
  await flush();
  expect([top.getAttribute("aria-pressed"), newest.getAttribute("aria-pressed")]).toEqual(["true", "false"]);
  expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "top" });
});

test("an obsolete response cannot render after panel destruction", async () => {
  const root = await mount();
  let resolve;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const loading = panel.load();
  panel.destroy();
  resolve({ items: [comment({ text: "Late response" })] });
  await loading;
  expect(root.textContent).not.toContain("Late response");
  expect(document.getElementById("ryd-discussion-panel")).toBeNull();
});

test("the notifications tab shows the on-demand unread count without a live inbox", async () => {
  const root = await mount({ session });
  request.mockImplementation(async (operation) => {
    if (operation === "notifications")
      return {
        items: [{ id: REPLY, type: "reply", actorNickname: "Reader", createdAt: "2026-09-01T12:00:00Z", read: false }],
        nextCursor: null,
        unreadCount: 1,
      };
    if (operation === "readNotifications") return { unreadCount: 0, revision: "2" };
    return { items: [], nextCursor: null };
  });
  const tab = root.querySelector("[data-action='inbox']");
  expect(tab.textContent).toBe("Notifications");
  tab.click();
  await flush();
  expect(tab.textContent).toBe("Notifications (1)");
  root.querySelector(".ryd-discussion-notification button").click();
  await flush();
  expect(tab.textContent).toBe("Notifications");
});

test("moderators can review reports and issue explicit scoped actions", async () => {
  const root = await mount({ session: { ...session, isModerator: true } });
  request.mockResolvedValueOnce({
    items: [{ id: REPLY, comment: comment(), reason: "spam", authorSuspended: false }],
    nextCursor: null,
  });
  root.querySelector("[data-action='moderation']").click();
  await flush();
  request.mockResolvedValueOnce(comment({ hidden: true }));
  root.querySelector("[data-action='hide']").click();
  await flush();
  expect(request.mock.calls).toContainEqual(["moderateComment", { id: ROOT, hidden: true }]);
});

test("Russian UI follows the YouTube document language", async () => {
  document.documentElement.lang = "ru-RU";
  const root = await mount({ session }, [comment({ author: otherSession.profile })]);
  expect(root.querySelector("h2").textContent).toBe("Комментарии RYD");
  expect(root.querySelector("[data-action='post']").textContent).toBe("Отправить");
  expect(root.querySelector("[data-reaction='1']").getAttribute("aria-label")).toContain("Нравится");
});

test("the author's own comments show read-only reaction counts instead of controls", async () => {
  const root = await mount({ session }, [comment({ canEdit: false, canDelete: false })]);
  expect(root.querySelector("[data-reaction]")).toBeNull();
  const counts = [...root.querySelectorAll("[data-reaction-count]")];
  expect(counts.map((count) => [count.tagName, count.dataset.reactionCount, count.textContent])).toEqual([
    ["SPAN", "1", "2"],
    ["SPAN", "-1", "1"],
  ]);
  expect(counts.map((count) => count.getAttribute("aria-label"))).toEqual(["Like (2)", "Dislike (1)"]);
  expect(counts.some((count) => count.hasAttribute("aria-pressed"))).toBe(false);
  expect(root.querySelector("[data-action='edit']")).not.toBeNull();
  expect(root.querySelector("[data-action='delete']")).not.toBeNull();
});

test("a suspended author can delete but cannot edit their own public comment", async () => {
  const root = await mount({ session: { ...session, profile: { ...session.profile, suspended: true } } });
  expect(root.querySelector("[data-action='edit']")).toBeNull();
  expect(root.querySelector("[data-action='delete']")).not.toBeNull();
});

test("own comments use client-side ownership, not server flags, for edit and delete", async () => {
  const root = await mount({ session }, [
    comment({ author: otherSession.profile, canEdit: true, canDelete: true }),
    comment({ id: REPLY, canEdit: false, canDelete: false }),
  ]);
  const other = root.querySelector(`[data-comment-id="${ROOT}"]`);
  const own = root.querySelector(`[data-comment-id="${REPLY}"]`);
  expect(other.querySelector("[data-action='edit'], [data-action='delete']")).toBeNull();
  expect(other.querySelector("[data-reaction]")).not.toBeNull();
  expect(own.querySelector("[data-action='edit']")).not.toBeNull();
  expect(own.querySelector("[data-action='delete']")).not.toBeNull();
  expect(own.querySelector("[data-reaction]")).toBeNull();
  expect(other.querySelector("[data-reaction-count]")).toBeNull();
  expect(own.querySelectorAll("[data-reaction-count]")).toHaveLength(2);
});

test("a signed-in account without a discussion profile owns no comments", async () => {
  const root = await mount({ session: { ...session, profile: null } }, [comment({ author: { nickname: "Other" } })]);
  expect(root.querySelector("[data-action='edit'], [data-action='delete']")).toBeNull();
  expect(root.querySelector("[data-reaction='1']")).not.toBeNull();
});

test("revoking voting access resets reactions but keeps their controls", async () => {
  const root = await mount({}, [comment({ author: otherSession.profile, myReaction: 1 })]);
  panel.setPermissions({ reactions: false });
  expect(root.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("false");
  panel.setPermissions({ reactions: true });
  expect(root.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("false");
});

describe("reactions without Firefox website activity", () => {
  beforeEach(() => {
    global.chrome = { runtime: { sendMessage: jest.fn(async () => ({ success: true })) } };
  });
  afterEach(() => delete global.chrome);

  test("a click asks for permission in context and reacts only after the grant", async () => {
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile })]);
    root.querySelector("[data-reaction='1']").click();
    await flush();
    expect(request.mock.calls.some(([operation]) => operation === "react")).toBe(false);
    const continued = root.querySelector("[data-action='voteOptIn-consent']");
    expect(continued).not.toBeNull();
    expect(continued.closest("[data-comment-id]").dataset.commentId).toBe(ROOT);
    expect(root.textContent).toContain(discussionText("reactionConsentRequired"));
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    continued.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_open_consent", feature: "voteOptIn" });
    expect(request.mock.calls.some(([operation]) => operation === "react")).toBe(false);
    request.mockResolvedValueOnce({ commentId: ROOT, likes: 3, dislikes: 1, myReaction: 1 });
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toEqual([
      ["react", { id: ROOT, value: 1 }],
    ]);
    expect(root.querySelector("[data-action='voteOptIn-consent']")).toBeNull();
    expect(root.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
    panel.setPermissions({ reactions: false });
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toHaveLength(1);
  });

  test("only the latest pending reaction is sent after the grant", async () => {
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile })]);
    root.querySelector("[data-reaction='1']").click();
    root.querySelector("[data-reaction='-1']").click();
    request.mockResolvedValueOnce({ commentId: ROOT, likes: 2, dislikes: 2, myReaction: -1 });
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toEqual([
      ["react", { id: ROOT, value: -1 }],
    ]);
  });

  test("a newer pending reaction moves the prompt and a grant clears every prompt", async () => {
    const other = comment({ id: REPLY, author: otherSession.profile, text: "Second comment" });
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile }), other]);
    const prompt = (id) => root.querySelector(`[data-comment-id="${id}"] [data-action='voteOptIn-consent']`);
    root.querySelector(`[data-comment-id="${ROOT}"] [data-reaction='1']`).click();
    root.querySelector(`[data-comment-id="${REPLY}"] [data-reaction='-1']`).click();
    expect(prompt(ROOT)).toBeNull();
    expect(prompt(REPLY)).not.toBeNull();
    request.mockResolvedValueOnce({ commentId: REPLY, likes: 0, dislikes: 1, myReaction: -1 });
    panel.setPermissions({ reactions: true });
    await flush();
    expect(root.querySelector("[data-action='voteOptIn-consent']")).toBeNull();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toEqual([
      ["react", { id: REPLY, value: -1 }],
    ]);
  });

  test("closing the panel before a grant drops the pending reaction", async () => {
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile })]);
    root.querySelector("[data-reaction='1']").click();
    panel.destroy();
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.some(([operation]) => operation === "react")).toBe(false);
  });

  test("a reaction finishing after a reload updates the reloaded comment", async () => {
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile })]);
    root.querySelector("[data-reaction='1']").click();
    let finish;
    request.mockImplementation(async (operation) => {
      if (operation === "react") return new Promise((resolve) => (finish = resolve));
      return { items: [comment({ author: otherSession.profile })], nextCursor: null };
    });
    panel.setPermissions({ reactions: true });
    await panel.load();
    finish({ commentId: ROOT, likes: 3, dislikes: 1, myReaction: 1 });
    await flush();
    expect(root.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector("[data-reaction='1']").textContent).toBe("3");
  });

  async function mountExpandedReply() {
    const reply = comment({ id: REPLY, parentId: ROOT, author: otherSession.profile, text: "A reply" });
    const root = await mount({ reactionsAllowed: false }, [comment({ author: otherSession.profile, replyCount: 1 })]);
    request.mockImplementation(async (operation) => {
      if (operation === "replies") return { items: [reply], nextCursor: null };
      if (operation === "react") return { commentId: REPLY, likes: 3, dislikes: 1, myReaction: 1 };
      return { items: [comment({ author: otherSession.profile, replyCount: 1 })], nextCursor: null };
    });
    root.querySelector("[data-action='load-replies']").click();
    await flush();
    return root;
  }

  const replyReaction = (root) => root.querySelector(`[data-comment-id="${REPLY}"] [data-reaction='1']`);

  test("a pending reaction on a reply is sent after the grant and the reply stays expanded", async () => {
    const root = await mountExpandedReply();
    replyReaction(root).click();
    await flush();
    expect(root.querySelector(`[data-comment-id="${REPLY}"] [data-action='voteOptIn-consent']`)).not.toBeNull();
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toEqual([
      ["react", { id: REPLY, value: 1 }],
    ]);
    expect(replyReaction(root).getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector("[data-action='voteOptIn-consent']")).toBeNull();
  });

  test("a pending reaction is sent even when its row was rebuilt before the grant", async () => {
    const root = await mountExpandedReply();
    replyReaction(root).click();
    await panel.load();
    expect(replyReaction(root)).toBeNull();
    panel.setPermissions({ reactions: true });
    await flush();
    expect(request.mock.calls.filter(([operation]) => operation === "react")).toEqual([
      ["react", { id: REPLY, value: 1 }],
    ]);
  });

  test("revoking access resets reply reactions in place", async () => {
    const root = await mountExpandedReply();
    panel.setPermissions({ reactions: true });
    replyReaction(root).click();
    await flush();
    expect(replyReaction(root).getAttribute("aria-pressed")).toBe("true");
    panel.setPermissions({ reactions: false });
    expect(replyReaction(root).getAttribute("aria-pressed")).toBe("false");
  });
});

test("moderators can restore comments and authoring from dismissed report history", async () => {
  const root = await mount({ session: { ...session, isModerator: true } });
  request.mockImplementation(async (operation, payload) => {
    if (operation === "reports" && payload.status === "resolved")
      return { items: [{ id: REPLY, comment: comment({ hidden: true }), reason: "spam", authorSuspended: true }] };
    return { items: [] };
  });
  root.querySelector("[data-action='moderation']").click();
  await flush();
  const filter = root.querySelector("[data-action='report-status']");
  filter.value = "resolved";
  filter.dispatchEvent(new Event("change"));
  await flush();
  expect(root.querySelector("[data-action='dismiss']")).toBeNull();
  expect(root.querySelector("[data-action='unban']")).not.toBeNull();
  root.querySelector("[data-action='restore']").click();
  await flush();
  expect(request.mock.calls).toContainEqual(["moderateComment", { id: ROOT, hidden: false }]);
  expect(root.querySelector("[data-action='report-status']").value).toBe("resolved");
});

describe("YouTube-native control styling", () => {
  const stylesheet = readFileSync(join(__dirname, "../../content-style.css"), "utf8");
  const chipSelectors = [
    ".ryd-discussion .ryd-discussion-header-actions > .ryd-discussion-button",
    ".ryd-discussion .ryd-discussion-sort > .ryd-discussion-button",
    ".ryd-discussion .ryd-discussion-toolbar > .ryd-discussion-button",
  ];

  function stylesheetRule(selectors) {
    const selectorText = selectors.join(", ");
    for (const [, selector, body] of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selector.replace(/\s+/g, " ").trim() === selectorText) return body;
    }
    return "";
  }

  test("renders the tabs, sort orders and refresh action as YouTube chips", async () => {
    const root = await mount({ session });
    expect(root.querySelector(".ryd-discussion-header-actions > [data-action='discussion']")).not.toBeNull();
    expect(root.querySelector(".ryd-discussion-toolbar > .ryd-discussion-sort > [data-sort='top']")).not.toBeNull();
    expect(root.querySelector(".ryd-discussion-toolbar > button.ryd-discussion-button")).not.toBeNull();
    const chip = stylesheetRule(chipSelectors);
    expect(chip).toContain("min-block-size: 32px");
    expect(chip).toContain("border-radius: 8px");
    expect(chip).toContain("background: var(--ryd-discussion-surface)");
    expect(chip).toContain("font-weight: 500");
    expect(stylesheetRule(chipSelectors.map((selector) => `${selector}:hover`))).toContain(
      "background: var(--ryd-discussion-hover)",
    );
    const focus = stylesheetRule(chipSelectors.map((selector) => `${selector}:focus-visible`));
    expect(focus).toContain("outline: 2px solid var(--ryd-discussion-fg)");
    expect(focus).toContain("outline-offset: 2px");
  });

  test("inverts the selected tab and sort order like a selected YouTube chip", () => {
    const selected = stylesheetRule(chipSelectors.slice(0, 2).map((selector) => `${selector}[aria-pressed="true"]`));
    expect(selected).toContain("background: var(--ryd-discussion-fg)");
    expect(selected).toContain("color: var(--ryd-discussion-bg)");
    expect(stylesheet).not.toContain("inset 0 -2px var(--ryd-discussion-accent)");
  });

  test("keeps the Shorts close button beside the title while no tab is visible", () => {
    const tabRow = stylesheetRule([".ryd-discussion-shorts .ryd-discussion-header-actions"]);
    const closeOnly = stylesheetRule([
      ".ryd-discussion-shorts .ryd-discussion-header-actions:not(:has(> [data-action]:not([hidden])))",
    ]);
    expect(tabRow).toContain("width: 100%");
    expect(closeOnly).toContain("width: auto");
  });

  test("renders the nickname save action as a YouTube pill button", async () => {
    const root = await mount({ session: { ...session, profile: { ...session.profile, nickname: null } } });
    expect(root.querySelector(".ryd-discussion-form-actions > .ryd-discussion-primary").textContent).toBe(
      discussionText("nicknameSave"),
    );
    const pill = stylesheetRule([".ryd-discussion .ryd-discussion-form-actions > .ryd-discussion-button"]);
    expect(pill).toContain("min-block-size: 36px");
    expect(pill).toContain("border-radius: 18px");
  });

  test.each([
    ["light", [".ryd-discussion", ".ryd-discussion-popup", ".ryd-discussion-toast"]],
    ["dark", ["html[dark] .ryd-discussion", "html[dark] .ryd-discussion-popup", "html[dark] .ryd-discussion-toast"]],
  ])("prefers YouTube's current %s theme variables before the legacy names", (_, selectors) => {
    const tokens = stylesheetRule(selectors).replace(/\s+/g, "");
    for (const [token, variable, legacy] of [
      ["bg", "base-background", "base-background"],
      ["fg", "text-primary", "text-primary"],
      ["surface", "additive-background", "badge-chip-background"],
      ["hover", "button-chip-background-hover", "button-chip-background-hover"],
      ["accent", "call-to-action", "call-to-action"],
    ]) {
      expect(tokens).toContain(
        `--ryd-discussion-${token}:var(--yt-sys-color-baseline--${variable},var(--yt-spec-${legacy},`,
      );
    }
  });
});
