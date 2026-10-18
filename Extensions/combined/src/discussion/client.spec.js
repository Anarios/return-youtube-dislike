/** @jest-environment jsdom */
import { createDiscussionRequestScope, requestDiscussion, subscribeDiscussionEvents } from "./client";

afterEach(() => {
  delete global.chrome;
});

test("uses a typed worker envelope and returns only the response data", async () => {
  const sendMessage = jest.fn((message, done) => done({ ok: true, data: { items: [] } }));
  global.chrome = { runtime: { sendMessage } };
  await expect(requestDiscussion("comments", { videoId: "abcdefghijk", sort: "top" })).resolves.toEqual({ items: [] });
  expect(sendMessage.mock.calls[0][0]).toEqual({
    message: "ryd_discussion",
    operation: "comments",
    payload: { videoId: "abcdefghijk", sort: "top" },
  });
});

test("preserves safe server error codes and status for translated feedback", async () => {
  global.chrome = {
    runtime: {
      sendMessage: (_, done) => done({ ok: false, error: { code: "nickname_taken", message: "Taken", status: 409 } }),
    },
  };
  await expect(requestDiscussion("profile", { nickname: "Writer" })).rejects.toMatchObject({
    code: "nickname_taken",
    status: 409,
  });
});

test("subscribes to discussion-only events and removes its listener", () => {
  let receive;
  const removeListener = jest.fn();
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: (listener) => {
          receive = listener;
        },
        removeListener,
      },
    },
  };
  const callback = jest.fn();
  const unsubscribe = subscribeDiscussionEvents(callback);
  receive({ message: "patreon_status_changed" });
  expect(callback).not.toHaveBeenCalled();
  const event = { message: "ryd_discussion_event", type: "inbox", data: { items: [] } };
  receive(event);
  expect(callback).toHaveBeenCalledWith(event);
  unsubscribe();
  expect(removeListener).toHaveBeenCalledWith(receive);
});

test("a navigation scope sends cancellation and rejects a response that arrives afterwards", async () => {
  let complete;
  const sendMessage = jest.fn((message, done) => {
    if (message.operation === "comments") complete = done;
    else done({ ok: true, data: { cancelled: true } });
  });
  global.chrome = { runtime: { sendMessage } };
  const scoped = createDiscussionRequestScope("abcdefghijk");
  const response = scoped.request("comments", { videoId: "abcdefghijk" });
  const scope = sendMessage.mock.calls[0][0].scope;
  scoped.cancel();
  expect(sendMessage.mock.calls[1][0]).toEqual({
    message: "ryd_discussion",
    operation: "cancelScope",
    payload: {},
    scope,
  });
  complete({ ok: true, data: { items: [] } });
  await expect(response).rejects.toMatchObject({ code: "navigation_changed" });
  await expect(scoped.request("comments")).rejects.toMatchObject({ code: "navigation_changed" });
  expect(sendMessage).toHaveBeenCalledTimes(2);
});
