/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"moz-extension://extension-id/popup.html"}
 */
import { createDiscussionRequestScope, requestDiscussion, subscribeDiscussionEvents } from "./client";

function firefoxApi(incognito = false) {
  return {
    extension: { inIncognitoContext: incognito },
    runtime: {
      getManifest: () => ({ browser_specific_settings: { gecko: {} } }),
      getURL: (path) => `moz-extension://extension-id/${path}`,
      sendMessage: jest.fn((message, done) => done({ ok: true, data: { authenticated: true } })),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  };
}

afterEach(() => {
  delete global.chrome;
  delete global.browser;
});

test("private Firefox requests fail before reaching the shared runtime", async () => {
  global.browser = firefoxApi(true);
  await expect(requestDiscussion("session")).rejects.toMatchObject({ code: "private_browsing" });
  await expect(requestDiscussion("comments", { videoId: "abcdefghijk" })).rejects.toMatchObject({
    code: "private_browsing",
  });
  expect(global.browser.runtime.sendMessage).not.toHaveBeenCalled();
});

test("private Firefox clients do not subscribe to either account event channel", () => {
  global.browser = firefoxApi(true);
  const addEventListener = jest.spyOn(window, "addEventListener");
  const callback = jest.fn();
  const unsubscribe = subscribeDiscussionEvents(callback);
  window.dispatchEvent(
    new CustomEvent("ryd-discussion-event", { detail: { message: "ryd_discussion_event", type: "inbox" } }),
  );
  expect(callback).not.toHaveBeenCalled();
  expect(global.browser.runtime.onMessage.addListener).not.toHaveBeenCalled();
  expect(addEventListener).not.toHaveBeenCalled();
  unsubscribe();
  addEventListener.mockRestore();
});

test("normal Firefox requests retain the runtime request channel", async () => {
  global.browser = firefoxApi();
  await expect(requestDiscussion("session")).resolves.toEqual({ authenticated: true });
  expect(global.browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
});

test("normal Firefox extension pages receive account events from their own view and unsubscribe", () => {
  global.browser = firefoxApi();
  const callback = jest.fn();
  const unsubscribe = subscribeDiscussionEvents(callback);
  window.dispatchEvent(new CustomEvent("ryd-discussion-event", { detail: { message: "unrelated" } }));
  expect(callback).not.toHaveBeenCalled();
  const data = { message: "ryd_discussion_event", type: "inbox", data: { unreadCount: 3 } };
  window.dispatchEvent(new CustomEvent("ryd-discussion-event", { detail: data }));
  expect(callback).toHaveBeenCalledWith(data);
  expect(global.browser.runtime.onMessage.addListener).not.toHaveBeenCalled();
  unsubscribe();
  window.dispatchEvent(new CustomEvent("ryd-discussion-event", { detail: data }));
  expect(callback).toHaveBeenCalledTimes(1);
});

test("does not accept view events on a different extension's page", () => {
  global.browser = firefoxApi();
  global.browser.runtime.getURL = (path) => `moz-extension://different-extension/${path}`;
  const callback = jest.fn();
  const unsubscribe = subscribeDiscussionEvents(callback);
  window.dispatchEvent(new CustomEvent("ryd-discussion-event", { detail: { message: "ryd_discussion_event" } }));
  expect(callback).not.toHaveBeenCalled();
  const receive = global.browser.runtime.onMessage.addListener.mock.calls[0][0];
  const message = { message: "ryd_discussion_event", type: "session", data: { authenticated: false } };
  receive(message);
  expect(callback).toHaveBeenCalledWith(message);
  unsubscribe();
  expect(global.browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(receive);
});

test("preserves non-Firefox private request behavior", async () => {
  global.chrome = {
    extension: { inIncognitoContext: true },
    runtime: { getManifest: () => ({}), sendMessage: jest.fn((message, done) => done({ ok: true, data: {} })) },
  };
  await expect(requestDiscussion("session")).resolves.toEqual({});
  expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
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
