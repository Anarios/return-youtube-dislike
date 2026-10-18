/** @jest-environment jsdom */

import { createDiscussionPanel } from "./panel";
import { discussionText } from "./localize";

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
  const sort = root.querySelector("select");
  sort.value = "new";
  sort.dispatchEvent(new Event("change"));
  await flush();
  expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "new" });
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
  const root = await mount({ session });
  expect(root.querySelector("h2").textContent).toBe("Комментарии RYD");
  expect(root.querySelector("[data-action='post']").textContent).toBe("Отправить");
  expect(root.querySelector("[data-reaction='1']").getAttribute("aria-label")).toContain("Нравится");
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
