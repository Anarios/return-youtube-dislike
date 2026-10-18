import { WebSocketServer } from "ws";
import { createDiscussionBackground, createConnection } from "./discussion-background";

test("real SignalR events and reconnects fetch durable notifications with fresh hub tickets", async () => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((resolve) => server.once("listening", resolve));
  const profileId = "22222222-2222-4222-8222-222222222222";
  let peer;
  const receivedTickets = [];
  let ticketRequests = 0;
  let connected;
  const ready = new Promise((resolve) => {
    connected = resolve;
  });
  server.on("connection", (socket, request) => {
    peer = socket;
    receivedTickets.push(request.headers.authorization);
    expect(request.headers.authorization).toBe(`Bearer hub-ticket-${ticketRequests}`);
    expect(request.url).toBe("/api/discussion/notifications/hub");
    socket.on("message", (bytes) => {
      const message = JSON.parse(bytes.toString().split("\u001e")[0]);
      if (message.protocol) {
        socket.send("{}\u001e");
        connected();
      }
    });
  });
  let resolveToast;
  let resolveReconnectedInbox;
  const reconnectedInbox = new Promise((resolve) => {
    resolveReconnectedInbox = resolve;
  });
  let toasts = 0;
  const toast = new Promise((resolve) => {
    resolveToast = resolve;
  });
  const area = {
    get: (keys, callback) => callback({ patreonAuthenticated: true, patreonSessionToken: "account-token" }),
    set: (values, callback) => callback?.(),
    remove: (keys, callback) => callback?.(),
  };
  const api = {
    runtime: {
      id: "extension-id",
      getURL: (path) => `chrome-extension://extension-id/${path}`,
      sendMessage: (message, callback) => callback?.(),
    },
    storage: { sync: area, local: area },
    tabs: {
      query: (query, callback) => callback([{ id: 1, url: "https://www.youtube.com/watch?v=video123456" }]),
      sendMessage: (id, message, callback) => {
        if (message.type === "toast") {
          toasts++;
          resolveToast(message.data);
        }
        if (message.type === "inbox" && message.data.revision === "2") resolveReconnectedInbox(message.data);
        callback?.();
      },
    },
  };
  let revision = "0";
  const notification = {
    id: "33333333-3333-4333-8333-333333333333",
    commentId: "11111111-1111-4111-8111-111111111111",
    type: "reply",
    read: false,
    revision: "1",
    updatedAt: "2026-09-06T10:05:00Z",
  };
  const notificationReads = [];
  const client = createDiscussionBackground({
    api,
    voteClient: { ensureRegistered: async () => ({ userId: "unused" }) },
    settings: { apiOrigin: "https://returnyoutubedislikeapi.com", testMode: false, stateStorageKey: "state" },
    connectionFactory: (url, tokenFactory) =>
      createConnection(`http://127.0.0.1:${server.address().port}/api/discussion/notifications/hub`, tokenFactory),
    fetchImpl: async (url) => {
      let data;
      if (url.endsWith("/me"))
        data = { authenticated: true, profile: { id: profileId, nickname: "Tester" }, canPost: true };
      else if (url.endsWith("/ticket")) data = { token: `hub-ticket-${++ticketRequests}` };
      else {
        notificationReads.push(url);
        data = {
          items: revision === "0" ? [] : [notification],
          unreadCount: revision === "0" ? 0 : 1,
          revision,
          nextCursor: null,
        };
      }
      return { ok: true, status: 200, json: async () => data };
    },
  });
  try {
    await client.refreshSession();
    await ready;
    // Let the socket's initial durable catchup complete before sending a new event.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const before = notificationReads.length;
    revision = "1";
    peer.send(`${JSON.stringify({ type: 1, target: "NotificationsChanged", arguments: [{ revision }] })}\u001e`);
    expect(await toast).toEqual(notification);
    expect(notificationReads.length).toBeGreaterThan(before);
    expect(notificationReads.at(-1)).toContain("afterRevision=0");
    revision = "2";
    notification.revision = revision;
    peer.terminate();
    const recovered = await reconnectedInbox;
    expect(recovered.revision).toBe("2");
    expect(receivedTickets).toEqual(["Bearer hub-ticket-1", "Bearer hub-ticket-2"]);
    expect(notificationReads.at(-1)).toContain("afterRevision=1");
    expect(toasts).toBe(1);
  } finally {
    client.stop();
    for (const socket of server.clients) socket.terminate();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the configured SignalR retry policy stops after four reconnect attempts", async () => {
  const connection = createConnection(
    "https://returnyoutubedislikeapi.com/api/discussion/notifications/hub",
    async () => "ticket",
  );
  const policy = connection._reconnectPolicy;
  expect(
    [0, 1, 2, 3, 4].map((previousRetryCount) =>
      policy.nextRetryDelayInMilliseconds({
        previousRetryCount,
        elapsedMilliseconds: 0,
        retryReason: new Error("disconnected"),
      }),
    ),
  ).toEqual([0, 2000, 10000, 30000, null]);
  await connection.stop();
});
