import { isFirefoxExtension, isPrivateBrowsingContext } from "../private-browsing";

function runtimeApi() {
  return typeof chrome !== "undefined" ? chrome.runtime : globalThis.browser?.runtime;
}

export function requestDiscussion(operation, payload = {}, scope) {
  return new Promise((resolve, reject) => {
    if (isPrivateBrowsingContext()) {
      reject(Object.assign(new Error("Discussion service unavailable"), { code: "private_browsing" }));
      return;
    }
    const runtime = runtimeApi();
    if (!runtime?.sendMessage) {
      reject(Object.assign(new Error("Discussion service unavailable"), { code: "unavailable" }));
      return;
    }
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      if (runtime.lastError) {
        reject(Object.assign(new Error(runtime.lastError.message), { code: "unavailable" }));
      } else if (response?.ok) {
        resolve(response.data);
      } else {
        reject(Object.assign(new Error(response?.error?.message || "Discussion request failed"), response?.error));
      }
    };
    try {
      const result = runtime.sendMessage(
        { message: "ryd_discussion", operation, payload, ...(scope ? { scope } : {}) },
        finish,
      );
      if (result?.then)
        result.then(finish, (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
    } catch (error) {
      reject(error);
    }
  });
}

const VIDEO_OPERATIONS = new Set([
  "comments",
  "replies",
  "comment",
  "createComment",
  "editComment",
  "deleteComment",
  "react",
  "report",
]);

export function createDiscussionRequestScope(videoId, request = requestDiscussion) {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const scope = {
    id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    videoId,
  };
  let cancelled = false;
  const cancelledError = () => Object.assign(new Error("The video changed"), { code: "navigation_changed" });
  return {
    request(operation, payload = {}) {
      if (cancelled) return Promise.reject(cancelledError());
      return request(operation, payload, VIDEO_OPERATIONS.has(operation) ? scope : undefined).then((data) => {
        if (cancelled) throw cancelledError();
        return data;
      });
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      request("cancelScope", {}, scope).catch(() => {});
    },
  };
}

export function subscribeDiscussionEvents(listener) {
  if (isPrivateBrowsingContext()) return () => {};
  const api = typeof browser !== "undefined" ? browser : globalThis.chrome;
  const extensionUrl = api?.runtime?.getURL?.("");
  if (
    isFirefoxExtension(api) &&
    typeof window !== "undefined" &&
    window.location.protocol === "moz-extension:" &&
    extensionUrl &&
    window.location.href.startsWith(extensionUrl)
  ) {
    const receive = (event) => {
      if (event.detail?.message === "ryd_discussion_event") listener(event.detail);
    };
    window.addEventListener("ryd-discussion-event", receive);
    return () => window.removeEventListener("ryd-discussion-event", receive);
  }
  const event = runtimeApi()?.onMessage;
  const receive = (message) => {
    if (message?.message === "ryd_discussion_event") listener(message);
  };
  event?.addListener(receive);
  return () => event?.removeListener(receive);
}
