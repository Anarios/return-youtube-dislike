/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */
import { subscribeDiscussionEvents } from "./client";

afterEach(() => {
  delete global.browser;
});

test("Firefox content clients ignore page-level account events and retain tab messages", () => {
  const onMessage = { addListener: jest.fn(), removeListener: jest.fn() };
  global.browser = {
    extension: { inIncognitoContext: false },
    runtime: {
      getManifest: () => ({ browser_specific_settings: { gecko: {} } }),
      getURL: (path) => `moz-extension://extension-id/${path}`,
      onMessage,
    },
  };
  const callback = jest.fn();
  const unsubscribe = subscribeDiscussionEvents(callback);
  const message = { message: "ryd_discussion_event", type: "session", data: { authenticated: true } };
  window.dispatchEvent(new CustomEvent("ryd-discussion-event", { detail: message }));
  expect(callback).not.toHaveBeenCalled();
  const receive = onMessage.addListener.mock.calls[0][0];
  receive(message);
  expect(callback).toHaveBeenCalledWith(message);
  unsubscribe();
  expect(onMessage.removeListener).toHaveBeenCalledWith(receive);
});
