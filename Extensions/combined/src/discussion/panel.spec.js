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

describe("multilevel reply threads", () => {
  const CHILD = "55555555-5555-4555-8555-555555555555";
  const GRANDCHILD = "66666666-6666-4666-8666-666666666666";
  const SIBLING = "77777777-7777-4777-8777-777777777777";
  const SECOND_CHILD = "88888888-8888-4888-8888-888888888888";
  const CREATED = "99999999-9999-4999-8999-999999999999";

  const reply = (id, replyToId, second, overrides = {}) =>
    comment({
      id,
      parentId: ROOT,
      replyToId,
      text: `Reply ${second}`,
      createdAt: `2026-09-01T12:00:${String(second).padStart(2, "0")}Z`,
      ...overrides,
    });
  const row = (root, id) => root.querySelector(`[data-comment-id='${id}']`);
  const hierarchy = (root) =>
    [...root.querySelectorAll(".ryd-discussion-reply")].map((item) => [
      item.dataset.commentId,
      Number(item.dataset.replyDepth),
    ]);
  const parentButtons = (root, id) =>
    [...row(root, id).children].filter((item) => item.matches("[data-action='reply-context']"));
  const parentButton = (root, id) => parentButtons(root, id)[0];
  function expectResolvedParent(button, nickname = "Writer") {
    expect(button.tagName).toBe("BUTTON");
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe("");
    expect(button.getAttribute("aria-label")).toBe(discussionText("replyContext"));
    expect(button.title).toBe(nickname ? discussionText("replyTo", [nickname]) : discussionText("replyContext"));
    expect(button.classList.contains("ryd-discussion-parent-missing")).toBe(false);
  }
  const expand = async (root) => {
    root.querySelector("[data-action='load-replies']").click();
    await flush();
  };

  test("groups each branch under its immediate target and orders siblings chronologically", async () => {
    const root = await mount({ session }, [comment({ replyCount: 6 })]);
    request.mockResolvedValueOnce({
      items: [
        reply(SECOND_CHILD, REPLY, 5),
        reply(GRANDCHILD, CHILD, 4),
        reply(SIBLING, ROOT, 2),
        reply(CHILD, REPLY, 3),
        reply(REPLY, ROOT, 1),
        reply(CREATED, null, 6),
      ],
      nextCursor: null,
    });
    await expand(root);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SECOND_CHILD, 2],
      [SIBLING, 1],
      [CREATED, 1],
    ]);
    const replyContainer = row(root, ROOT).querySelector(".ryd-discussion-replies");
    expect(
      [...root.querySelectorAll(".ryd-discussion-reply")].every((item) => item.parentElement === replyContainer),
    ).toBe(true);
    expect(replyContainer.querySelector("[data-action='load-replies']:not([hidden])")).toBeNull();
    expect(parentButtons(root, ROOT)).toHaveLength(0);
    for (const [id, target] of [
      [REPLY, ROOT],
      [CHILD, REPLY],
      [GRANDCHILD, CHILD],
      [SECOND_CHILD, REPLY],
      [SIBLING, ROOT],
      [CREATED, ROOT],
    ]) {
      expect(parentButtons(root, id)).toHaveLength(1);
      expect(parentButton(root, id).dataset.replyToId).toBe(target);
      expectResolvedParent(parentButton(root, id));
    }
  });

  const rails = (root, id) =>
    [...row(root, id).children].filter((item) => item.classList.contains("ryd-discussion-reply-rail"));
  const railDepths = (root, id) => rails(root, id).map((rail) => Number(rail.dataset.replyRailDepth));
  const pathSegments = (root, owner) => [...root.querySelectorAll(`[data-reply-path-owner='${owner}']`)];
  function expectActivePath(root, owner = null) {
    const segments = [...root.querySelectorAll("[data-reply-path-owner]")];
    expect(segments.length).toBeGreaterThan(0);
    if (owner) expect(pathSegments(root, owner).length).toBeGreaterThan(0);
    for (const segment of segments)
      expect(segment.classList.contains("is-path-highlighted")).toBe(segment.dataset.replyPathOwner === owner);
  }
  const pointer = (target, type, relatedTarget = null) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }));

  test("hovering a trunk, ancestor continuation or elbow highlights only their complete shared connection", async () => {
    const root = await mount({ session }, [comment({ replyCount: 5 })]);
    request.mockResolvedValueOnce({
      items: [
        reply(REPLY, ROOT, 1),
        reply(CHILD, REPLY, 2),
        reply(GRANDCHILD, CHILD, 3),
        reply(SECOND_CHILD, REPLY, 4),
        reply(SIBLING, ROOT, 5),
      ],
      nextCursor: null,
    });
    await expand(root);
    const trunk = [...row(root, ROOT).children].find((item) => item.classList.contains("ryd-discussion-reply-stem"));
    const siblingContinuation = [...row(root, REPLY).children].find((item) =>
      item.classList.contains("ryd-discussion-reply-continuation"),
    );
    const continuation = rails(root, GRANDCHILD).find((item) => item.dataset.replyRailDepth === "1");
    const elbow = parentButton(root, SIBLING);
    const unrelated = parentButton(root, SECOND_CHILD);
    const sharedConnection = [trunk, siblingContinuation, continuation, elbow];
    for (const segment of sharedConnection) expect(segment.dataset.replyPathOwner).toBe(ROOT);
    expect(unrelated.dataset.replyPathOwner).toBe(REPLY);
    expectActivePath(root);
    pointer(trunk, "pointerover");
    expectActivePath(root, ROOT);
    for (let index = 1; index < sharedConnection.length; index++) {
      const previous = sharedConnection[index - 1];
      const next = sharedConnection[index];
      pointer(previous, "pointerout", next);
      expectActivePath(root, ROOT);
      pointer(next, "pointerover", previous);
      expectActivePath(root, ROOT);
    }
    pointer(elbow, "pointerout", unrelated);
    pointer(unrelated, "pointerover", elbow);
    expectActivePath(root, REPLY);
    pointer(unrelated, "pointerout");
    expectActivePath(root);
  });

  test("connector keyboard focus and straight-segment activation navigate to the correct parent", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2), reply(SIBLING, ROOT, 3)],
      nextCursor: null,
    });
    await expand(root);
    const elbow = parentButton(root, CHILD);
    elbow.focus();
    expectActivePath(root, REPLY);
    elbow.blur();
    expectActivePath(root);
    elbow.focus();
    elbow.click();
    await flush();
    expect(document.activeElement).toBe(row(root, REPLY));
    expectActivePath(root);
    const continuation = rails(root, CHILD).find((item) => item.dataset.replyRailDepth === "1");
    expect(continuation.tabIndex).toBe(-1);
    expect(continuation.getAttribute("aria-hidden")).toBe("true");
    continuation.click();
    await flush();
    expect(document.activeElement).toBe(row(root, ROOT));
    expect(root.querySelectorAll(".is-highlighted")).toHaveLength(1);
    expect(request.mock.calls.filter(([operation]) => operation === "comment")).toHaveLength(0);
  });

  test("pagination joins new segments to the hovered connection and refresh clears the highlight", async () => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    request
      .mockResolvedValueOnce({
        items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2)],
        nextCursor: "more-paths",
      })
      .mockResolvedValueOnce({
        items: [reply(GRANDCHILD, CHILD, 3), reply(SIBLING, ROOT, 4)],
        nextCursor: null,
      });
    await expand(root);
    const elbow = parentButton(root, REPLY);
    pointer(elbow, "pointerover");
    expectActivePath(root, ROOT);
    row(root, ROOT).querySelector(".ryd-discussion-replies > button").click();
    await flush();
    expect(request).toHaveBeenLastCalledWith("replies", { rootId: ROOT, cursor: "more-paths" });
    expectActivePath(root, ROOT);
    expect(parentButton(root, SIBLING).classList.contains("is-path-highlighted")).toBe(true);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SIBLING, 1],
    ]);
    let finishRefresh;
    request.mockImplementationOnce(() => new Promise((resolve) => (finishRefresh = resolve)));
    const refreshing = panel.load();
    expectActivePath(root);
    finishRefresh({ items: [comment({ replyCount: 4 })], nextCursor: null });
    await refreshing;
    expect(root.querySelector(".is-path-highlighted")).toBeNull();
  });

  test("renders ancestor continuations only while later siblings remain in each branch", async () => {
    const root = await mount({ session }, [comment({ replyCount: 5 })]);
    request.mockResolvedValueOnce({
      items: [
        reply(REPLY, ROOT, 1),
        reply(CHILD, REPLY, 2),
        reply(GRANDCHILD, CHILD, 3),
        reply(SECOND_CHILD, REPLY, 4),
        reply(SIBLING, ROOT, 5),
      ],
      nextCursor: null,
    });
    await expand(root);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SECOND_CHILD, 2],
      [SIBLING, 1],
    ]);
    expect(row(root, ROOT).dataset.replyHasChildren).toBe("true");
    for (const [id, hasSibling, hasChildren, ancestorDepths] of [
      [REPLY, true, true, []],
      [CHILD, true, true, [1]],
      [GRANDCHILD, false, false, [1, 2]],
      [SECOND_CHILD, false, false, [1]],
      [SIBLING, false, false, []],
    ]) {
      expect(row(root, id).dataset.replyHasSibling).toBe(String(hasSibling));
      expect(row(root, id).dataset.replyHasChildren).toBe(String(hasChildren));
      expect(railDepths(root, id)).toEqual(ancestorDepths);
      for (const rail of rails(root, id)) {
        expect(rail.tagName).toBe("SPAN");
        expect(rail.getAttribute("aria-hidden")).toBe("true");
        expect(rail.textContent).toBe("");
        expect(rail.tabIndex).toBe(-1);
        expect(rail.querySelector("button, a, input")).toBeNull();
      }
    }
  });

  test("reattaching an orphan branch replaces its outdated ancestor rails", async () => {
    const root = await mount({ session }, [comment({ replyCount: 5 })]);
    request
      .mockResolvedValueOnce({
        items: [
          reply(CHILD, REPLY, 2),
          reply(GRANDCHILD, CHILD, 3),
          reply(CREATED, GRANDCHILD, 4),
          reply(SIBLING, CHILD, 5),
        ],
        nextCursor: "missing-parent",
      })
      .mockResolvedValueOnce({ items: [reply(REPLY, ROOT, 1)], nextCursor: null });
    await expand(root);
    expect(row(root, ROOT).dataset.replyHasChildren).toBe("false");
    expect(hierarchy(root)).toEqual([
      [CHILD, 1],
      [GRANDCHILD, 2],
      [CREATED, 3],
      [SIBLING, 2],
    ]);
    expect(railDepths(root, CREATED)).toEqual([2]);
    row(root, ROOT).querySelector(".ryd-discussion-replies > button").click();
    await flush();
    expect(row(root, ROOT).dataset.replyHasChildren).toBe("true");
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [CREATED, 4],
      [SIBLING, 3],
    ]);
    expect(railDepths(root, CREATED)).toEqual([3]);
    expect(railDepths(root, SIBLING)).toEqual([]);
    expect(rails(root, CREATED)[0].getAttribute("aria-hidden")).toBe("true");
  });

  test("keeps an unloaded target's reply visible and reattaches its entire branch when the next page arrives", async () => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    request
      .mockResolvedValueOnce({
        items: [reply(CHILD, REPLY, 3), reply(GRANDCHILD, CHILD, 4), reply(SIBLING, ROOT, 2)],
        nextCursor: "earlier-target",
      })
      .mockResolvedValueOnce({ items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 3)], nextCursor: null });
    await expand(root);
    expect(hierarchy(root)).toEqual([
      [SIBLING, 1],
      [CHILD, 1],
      [GRANDCHILD, 2],
    ]);
    const missing = parentButton(root, CHILD);
    expect(missing.textContent).toBe(discussionText("replyContext"));
    expect(missing.getAttribute("aria-label")).toBe(discussionText("replyContext"));
    expect(missing.title).toBe(discussionText("replyContext"));
    expect(missing.classList.contains("ryd-discussion-parent-missing")).toBe(true);
    row(root, GRANDCHILD).querySelector("[data-action='reply']").click();
    const form = row(root, GRANDCHILD).querySelector("form");
    typeIdentityDraft(form, "Keep drafting while history loads");
    const input = form.querySelector("textarea");
    input.setSelectionRange(5, 13);
    row(root, ROOT).querySelector(".ryd-discussion-replies > button").click();
    await flush();
    expect(request).toHaveBeenLastCalledWith("replies", { rootId: ROOT, cursor: "earlier-target" });
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SIBLING, 1],
    ]);
    expect(row(root, GRANDCHILD).querySelector("textarea")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Keep drafting while history loads");
    expect([input.selectionStart, input.selectionEnd]).toEqual([5, 13]);
    expectResolvedParent(parentButton(root, CHILD));
  });

  test("posting to a deep reply inserts into that branch without moving its siblings", async () => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), reply(SIBLING, ROOT, 2), reply(CHILD, REPLY, 3), reply(GRANDCHILD, CHILD, 4)],
      nextCursor: null,
    });
    await expand(root);
    row(root, GRANDCHILD).querySelector("[data-action='reply']").click();
    request.mockResolvedValueOnce(reply(CREATED, GRANDCHILD, 5, { text: "Fourth-level response" }));
    submit(row(root, GRANDCHILD).querySelector("form"), "Fourth-level response");
    await flush();
    expect(request).toHaveBeenLastCalledWith(
      "createComment",
      expect.objectContaining({ videoId: VIDEO, parentId: ROOT, replyToId: GRANDCHILD, text: "Fourth-level response" }),
    );
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [CREATED, 4],
      [SIBLING, 1],
    ]);
    expect(row(root, CREATED).querySelector(".ryd-discussion-comment-text").textContent).toBe("Fourth-level response");
    expect(request.mock.calls.filter(([operation]) => operation === "replies")).toHaveLength(1);
  });

  test("a named parent button moves focus to the immediate reply target", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2), reply(GRANDCHILD, CHILD, 3)],
      nextCursor: null,
    });
    await expand(root);
    const context = row(root, GRANDCHILD).querySelector("[data-action='reply-context']");
    expectResolvedParent(context);
    expect(context.title).not.toContain("Reply 2");
    context.focus();
    expect(document.activeElement).toBe(context);
    context.click();
    await flush();
    expect(document.activeElement).toBe(row(root, CHILD));
    expect(root.querySelectorAll(".is-highlighted")).toHaveLength(1);
    expect(row(root, CHILD).classList.contains("is-highlighted")).toBe(true);
  });

  test.each([ROOT, null])("a direct reply with target %s can jump to its root", async (target) => {
    const root = await mount({ session }, [comment({ replyCount: 1 })]);
    request.mockResolvedValueOnce({ items: [reply(REPLY, target, 1)], nextCursor: null });
    await expand(root);
    const context = parentButton(root, REPLY);
    expectResolvedParent(context);
    expect(context.type).toBe("button");
    expect(context.tabIndex).toBe(0);
    expect(context.dataset.replyToId).toBe(ROOT);
    context.focus();
    expect(document.activeElement).toBe(context);
    context.click();
    await flush();
    expect(document.activeElement).toBe(row(root, ROOT));
    expect(row(root, ROOT).classList.contains("is-highlighted")).toBe(true);
    expect(hierarchy(root)).toEqual([[REPLY, 1]]);
    expect(request.mock.calls.filter(([operation]) => operation === "comment")).toHaveLength(0);
  });

  test("a missing parent connector loads its exact target and becomes an empty parent jump", async () => {
    const root = await mount({ session }, [comment({ replyCount: 2 })]);
    request.mockResolvedValueOnce({ items: [reply(CHILD, REPLY, 2)], nextCursor: null });
    await expand(root);
    const context = parentButton(root, CHILD);
    expect(context.textContent).toBe(discussionText("replyContext"));
    expect(context.dataset.replyToId).toBe(REPLY);
    request.mockImplementation(async (operation, payload) =>
      operation === "comment" && payload.id === REPLY ? reply(REPLY, ROOT, 1) : comment({ replyCount: 2 }),
    );
    context.click();
    await flush();
    expect(request.mock.calls).toContainEqual(["comment", { id: REPLY }]);
    expect(document.activeElement).toBe(row(root, REPLY));
    expectResolvedParent(parentButton(root, CHILD));
    expect(parentButton(root, CHILD).dataset.replyToId).toBe(REPLY);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
    ]);
  });

  test("parent navigation supersedes an in-flight deep link without replacing the visible thread", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2), reply(GRANDCHILD, CHILD, 3)],
      nextCursor: null,
    });
    await expand(root);
    let finish;
    request.mockImplementation((operation) => {
      if (operation === "comment") return new Promise((resolve) => (finish = resolve));
      return Promise.resolve({ items: [], nextCursor: null });
    });
    const pending = panel.focusComment(SIBLING);
    row(root, GRANDCHILD).querySelector("[data-action='reply-context']").click();
    await flush();
    expect(document.activeElement).toBe(row(root, CHILD));
    finish(reply(SIBLING, ROOT, 4));
    await pending;
    expect(document.activeElement).toBe(row(root, CHILD));
    expect(row(root, SIBLING)).toBeNull();
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
    ]);
  });

  test("editing and deleting an ancestor preserves its visible descendants and their depths", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    const ancestor = reply(REPLY, ROOT, 1);
    request.mockResolvedValueOnce({
      items: [ancestor, reply(CHILD, REPLY, 2), reply(GRANDCHILD, CHILD, 3)],
      nextCursor: null,
    });
    await expand(root);
    row(root, REPLY).querySelector("[data-action='edit']").click();
    request.mockResolvedValueOnce({ ...ancestor, text: "Edited ancestor", editedAt: "2026-09-01T12:01:00Z" });
    submit(row(root, REPLY).querySelector("form"), "Edited ancestor");
    await flush();
    expect(request).toHaveBeenLastCalledWith("editComment", { id: REPLY, text: "Edited ancestor" });
    expect(row(root, REPLY).querySelector(".ryd-discussion-comment-text").textContent).toBe("Edited ancestor");
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
    ]);
    row(root, REPLY).querySelector("[data-action='delete']").click();
    request.mockResolvedValueOnce({ ...ancestor, deleted: true, text: "", author: null });
    row(root, REPLY).querySelector("[data-action='confirm-delete']").click();
    await flush();
    expect(request).toHaveBeenLastCalledWith("deleteComment", { id: REPLY });
    expect(row(root, REPLY).querySelector(".ryd-discussion-comment-text").textContent).toBe(discussionText("deleted"));
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
    ]);
    row(root, GRANDCHILD).querySelector("[data-action='reply']").click();
    expect(row(root, GRANDCHILD).querySelector("textarea")).not.toBeNull();
  });

  test("a focused deep link shows its ancestry and merges loaded history without duplicate rows", async () => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    const replies = [
      reply(REPLY, ROOT, 1),
      reply(SIBLING, ROOT, 2),
      reply(CHILD, REPLY, 3),
      reply(GRANDCHILD, CHILD, 4),
    ];
    request.mockImplementation(async (operation, payload) => {
      if (operation === "comment")
        return payload.id === ROOT ? comment({ replyCount: 4 }) : replies.find((item) => item.id === payload.id);
      if (operation === "replies") return { items: replies, nextCursor: null };
      return { items: [], nextCursor: null };
    });
    await panel.focusComment(GRANDCHILD);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
    ]);
    expect(document.activeElement).toBe(row(root, GRANDCHILD));
    expect(row(root, GRANDCHILD).classList.contains("is-highlighted")).toBe(true);
    await expand(root);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SIBLING, 1],
    ]);
    expect(root.querySelectorAll(".is-highlighted")).toHaveLength(1);
  });

  test("a focused link survives unavailable ancestry and reattaches when ordinary history supplies it", async () => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    const replies = [
      reply(REPLY, ROOT, 1),
      reply(SIBLING, ROOT, 2),
      reply(CHILD, REPLY, 3),
      reply(GRANDCHILD, CHILD, 4),
    ];
    request.mockImplementation(async (operation, payload) => {
      if (operation === "comment") {
        if (payload.id === ROOT) return comment({ replyCount: 4 });
        if (payload.id === REPLY) throw { code: "not_found" };
        return replies.find((item) => item.id === payload.id);
      }
      if (operation === "replies") return { items: replies, nextCursor: null };
      return { items: [], nextCursor: null };
    });
    await panel.focusComment(GRANDCHILD);
    expect(hierarchy(root)).toEqual([
      [CHILD, 1],
      [GRANDCHILD, 2],
    ]);
    expect(document.activeElement).toBe(row(root, GRANDCHILD));
    await expand(root);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SIBLING, 1],
    ]);
    expect(root.querySelectorAll(`[data-comment-id='${GRANDCHILD}']`)).toHaveLength(1);
  });

  test("overlapping history replaces a focused ancestor's deleted text and its descendant's context", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    const replies = [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2), reply(GRANDCHILD, CHILD, 3)];
    request.mockImplementation(async (operation, payload) => {
      if (operation === "comment")
        return payload.id === ROOT ? comment({ replyCount: 3 }) : replies.find((item) => item.id === payload.id);
      if (operation === "replies")
        return {
          items: [replies[0], { ...replies[1], deleted: true, text: "", author: null }, replies[2]],
          nextCursor: null,
        };
      return { items: [], nextCursor: null };
    });
    await panel.focusComment(GRANDCHILD);
    expect(row(root, CHILD).querySelector(".ryd-discussion-comment-text").textContent).toBe("Reply 2");
    expectResolvedParent(parentButton(root, GRANDCHILD));
    expect(parentButton(root, GRANDCHILD).title).not.toContain("Reply 2");
    await expand(root);
    expect(row(root, CHILD).querySelector(".ryd-discussion-comment-text").textContent).toBe(discussionText("deleted"));
    expect(row(root, CHILD).querySelector(".ryd-discussion-author").textContent).toBe(discussionText("deleted"));
    expect(row(root, CHILD).querySelector("[data-action='edit']")).toBeNull();
    const context = row(root, GRANDCHILD).querySelector("[data-action='reply-context']");
    expectResolvedParent(context, null);
    expect(context.getAttribute("aria-label")).not.toContain("Writer");
    expect(context.title).not.toContain("Writer");
    expect(context.title).not.toContain("Reply 2");
    expect(root.querySelectorAll(`[data-comment-id='${CHILD}']`)).toHaveLength(1);
  });

  test.each(["edit", "delete"])("an older reply page cannot undo a completed local %s", async (action) => {
    const root = await mount({ session }, [comment({ replyCount: 4 })]);
    const ancestor = reply(CHILD, REPLY, 2);
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), ancestor, reply(GRANDCHILD, CHILD, 3)],
      nextCursor: "remaining",
    });
    await expand(root);
    let finishPage;
    request.mockImplementation((operation) => {
      if (operation === "replies") return new Promise((resolve) => (finishPage = resolve));
      return Promise.resolve(
        action === "edit"
          ? { ...ancestor, text: "Updated while loading", editedAt: "2026-09-01T12:01:00Z" }
          : { ...ancestor, deleted: true, text: "", author: null },
      );
    });
    row(root, ROOT).querySelector(".ryd-discussion-replies > button").click();
    row(root, CHILD).querySelector(`[data-action='${action}']`).click();
    if (action === "edit") submit(row(root, CHILD).querySelector("form"), "Updated while loading");
    else row(root, CHILD).querySelector("[data-action='confirm-delete']").click();
    await flush();
    finishPage({ items: [reply(CHILD, REPLY, 2), reply(SIBLING, ROOT, 4)], nextCursor: null });
    await flush();
    const expected = action === "edit" ? "Updated while loading" : discussionText("deleted");
    expect(row(root, CHILD).querySelector(".ryd-discussion-comment-text").textContent).toBe(expected);
    expectResolvedParent(parentButton(root, GRANDCHILD), action === "edit" ? "Writer" : null);
    expect(parentButton(root, GRANDCHILD).title).not.toContain("Reply 2");
    expect(parentButton(root, GRANDCHILD).title).not.toContain("Updated while loading");
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
      [SIBLING, 1],
    ]);
  });

  test("loading another root page preserves an expanded branch and its active reply draft", async () => {
    const root = await mount({ session }, [comment({ replyCount: 3 })]);
    request.mockResolvedValueOnce({ items: [comment({ replyCount: 3 })], nextCursor: "more-roots" });
    await panel.load();
    request.mockResolvedValueOnce({
      items: [reply(REPLY, ROOT, 1), reply(CHILD, REPLY, 2), reply(GRANDCHILD, CHILD, 3)],
      nextCursor: null,
    });
    await expand(root);
    row(root, GRANDCHILD).querySelector("[data-action='reply']").click();
    const form = row(root, GRANDCHILD).querySelector("form");
    typeIdentityDraft(form, "Draft while loading more threads");
    const input = form.querySelector("textarea");
    input.setSelectionRange(6, 11);
    request.mockResolvedValueOnce({ items: [comment({ id: SIBLING, text: "Another thread" })], nextCursor: null });
    root.querySelector(".ryd-discussion-more").click();
    await flush();
    expect(request).toHaveBeenLastCalledWith("comments", { videoId: VIDEO, sort: "top", cursor: "more-roots" });
    expect(row(root, GRANDCHILD).querySelector("textarea")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Draft while loading more threads");
    expect([input.selectionStart, input.selectionEnd]).toEqual([6, 11]);
    expect(hierarchy(root)).toEqual([
      [REPLY, 1],
      [CHILD, 2],
      [GRANDCHILD, 3],
    ]);
    expect(row(root, SIBLING).querySelector(".ryd-discussion-comment-text").textContent).toBe("Another thread");
  });

  test("an in-flight sorted list updates a focused root's reply count and applies the returned root order", async () => {
    const root = await mount({ session }, []);
    let finishList;
    request.mockImplementation((operation) => {
      if (operation === "comments") return new Promise((resolve) => (finishList = resolve));
      if (operation === "comment") return Promise.resolve(comment({ replyCount: 0 }));
      return Promise.resolve({ items: [reply(REPLY, ROOT, 1)], nextCursor: null });
    });
    root.querySelector("[data-sort='new']").click();
    await panel.focusComment(ROOT);
    const focused = row(root, ROOT);
    expect(focused.querySelector("[data-action='load-replies']").hidden).toBe(true);
    finishList({
      items: [
        comment({ id: SIBLING, text: "Newer root", createdAt: "2026-09-01T12:02:00Z" }),
        comment({ replyCount: 4 }),
      ],
      nextCursor: null,
    });
    await flush();
    expect(request.mock.calls).toContainEqual(["comments", { videoId: VIDEO, sort: "new" }]);
    expect([...root.querySelector(".ryd-discussion-comments").children].map((item) => item.dataset.commentId)).toEqual([
      SIBLING,
      ROOT,
    ]);
    expect(row(root, ROOT)).toBe(focused);
    expect(document.activeElement).toBe(focused);
    const loadReplies = focused.querySelector("[data-action='load-replies']");
    expect(loadReplies.hidden).toBe(false);
    expect(loadReplies.textContent).toBe(discussionText("loadReplies", [4]));
    loadReplies.click();
    await flush();
    expect(request).toHaveBeenLastCalledWith("replies", { rootId: ROOT });
    expect(hierarchy(root)).toEqual([[REPLY, 1]]);
  });

  test.each(["edited", "hidden"])(
    "stale history cannot undo a completed reaction while retaining a remotely %s reply",
    async (remoteChange) => {
      const root = await mount({ session }, [comment({ replyCount: 1 })]);
      const target = reply(REPLY, ROOT, 1, { author: otherSession.profile, likes: 0, dislikes: 0 });
      let finishHistory;
      request.mockImplementation((operation, payload) => {
        if (operation === "comment") return Promise.resolve(payload.id === ROOT ? comment({ replyCount: 1 }) : target);
        if (operation === "replies") return new Promise((resolve) => (finishHistory = resolve));
        if (operation === "react") return Promise.resolve({ commentId: REPLY, likes: 1, dislikes: 0, myReaction: 1 });
        return Promise.resolve({ items: [], nextCursor: null });
      });
      await panel.focusComment(REPLY);
      root.querySelector("[data-action='load-replies']").click();
      row(root, REPLY).querySelector("[data-reaction='1']").click();
      await flush();
      expect(row(root, REPLY).querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
      finishHistory({
        items: [
          {
            ...target,
            likes: 0,
            myReaction: 0,
            ...(remoteChange === "edited"
              ? { text: "Updated by the author", editedAt: "2026-09-01T12:01:00Z" }
              : { hidden: true, text: "" }),
          },
        ],
        nextCursor: null,
      });
      await flush();
      const refreshed = row(root, REPLY);
      expect(root.querySelectorAll(`[data-comment-id='${REPLY}']`)).toHaveLength(1);
      if (remoteChange === "edited") {
        expect(refreshed.querySelector(".ryd-discussion-comment-text").textContent).toBe("Updated by the author");
        expect(refreshed.querySelector("[data-reaction='1']").textContent).toBe("1");
        expect(refreshed.querySelector("[data-reaction='1']").getAttribute("aria-pressed")).toBe("true");
      } else {
        expect(refreshed.querySelector(".ryd-discussion-comment-text").textContent).toBe(discussionText("deleted"));
        expect(refreshed.querySelector("[data-reaction]")).toBeNull();
      }
    },
  );
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
