import { createServer } from "node:http";
import { createDiscussionBackground } from "./discussion-background";

test("navigation cancels a real HTTP fetch while another tab and the inbox finish normally", async () => {
  const videoId = "abcdefghijk";
  const otherVideoId = "zyxwvutsrqp";
  const held = [];
  let allRequested;
  let outgoingClosed;
  const requested = new Promise((resolve) => {
    allRequested = resolve;
  });
  const closed = new Promise((resolve) => {
    outgoingClosed = resolve;
  });
  const server = createServer((request, response) => {
    held.push({ url: request.url, response });
    if (request.url.includes(videoId)) response.once("close", outgoingClosed);
    if (held.length === 3) allRequested();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const area = {
    get: (keys, callback) => callback({}),
    set: (values, callback) => callback?.(),
    remove: (keys, callback) => callback?.(),
  };
  const api = {
    runtime: { id: "extension-id", getURL: (path) => `chrome-extension://extension-id/${path}` },
    storage: { sync: area, local: area },
  };
  const signals = new Map();
  const client = createDiscussionBackground({
    api,
    voteClient: { ensureRegistered: async () => ({ userId: "unused" }) },
    settings: { apiOrigin: `http://127.0.0.1:${server.address().port}`, testMode: false, stateStorageKey: "state" },
    fetchImpl: (url, options) => {
      signals.set(new URL(url).pathname, options.signal);
      return fetch(url, options);
    },
  });
  const sender = (id, video) => ({
    id: "extension-id",
    frameId: 0,
    documentId: `document-${id}`,
    url: `https://www.youtube.com/watch?v=${video}`,
    tab: { id, url: `https://www.youtube.com/watch?v=${video}` },
  });
  const scope = { id: "44444444-4444-4444-8444-444444444444", videoId };
  const send = (operation, payload, source, value) =>
    client.handleMessage(
      {
        message: "ryd_discussion",
        operation,
        payload,
        ...(value ? { scope: value } : {}),
      },
      source,
    );
  try {
    const outgoing = send("comments", { videoId }, sender(1, videoId), scope);
    const other = send("comments", { videoId: otherVideoId }, sender(2, otherVideoId), {
      ...scope,
      videoId: otherVideoId,
    });
    const inbox = send("notifications", { cursor: "pending" }, sender(1, videoId));
    await requested;
    const cancellation = await send(
      "cancelScope",
      {},
      {
        ...sender(1, videoId),
        tab: { id: 1, url: "https://www.youtube.com/" },
      },
      scope,
    );
    expect(cancellation.ok).toBe(true);
    expect((await outgoing).error.code).toBe("navigation_changed");
    await closed;
    expect(signals.get(`/api/discussion/videos/${videoId}/comments`).aborted).toBe(true);
    expect(signals.get(`/api/discussion/videos/${otherVideoId}/comments`).aborted).toBe(false);
    expect(signals.get("/api/discussion/notifications").aborted).toBe(false);
    for (const { url, response } of held)
      if (!url.includes(videoId)) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ items: [], nextCursor: null }));
      }
    expect((await other).ok).toBe(true);
    expect((await inbox).ok).toBe(true);
  } finally {
    client.stop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
