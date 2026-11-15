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
        data = {
          authenticated: true,
          profile: { id: profileId, nickname: "Tester" },
          canPost: true,
          membershipTier: "commenter",
        };
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

test("a real hub stays closed without a nickname, opens once one is saved and closes on sign-out", async () => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((resolve) => server.once("listening", resolve));
  const profileId = "22222222-2222-4222-8222-222222222222";
  const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup.html" };
  const peers = [];
  let connected;
  const ready = new Promise((resolve) => {
    connected = resolve;
  });
  let disconnected;
  const closed = new Promise((resolve) => {
    disconnected = resolve;
  });
  server.on("connection", (socket) => {
    peers.push(socket);
    socket.on("close", disconnected);
    socket.on("message", (bytes) => {
      const message = JSON.parse(bytes.toString().split("\u001e")[0]);
      if (message.protocol) {
        socket.send("{}\u001e");
        connected();
      }
    });
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
      query: (query, callback) => callback([]),
      sendMessage: (id, message, callback) => callback?.(),
    },
  };
  let profile = null;
  const paths = [];
  const connectionFactory = jest.fn((url, tokenFactory) =>
    createConnection(`http://127.0.0.1:${server.address().port}/api/discussion/notifications/hub`, tokenFactory),
  );
  const client = createDiscussionBackground({
    api,
    voteClient: { ensureRegistered: async () => ({ userId: "unused" }) },
    settings: { apiOrigin: "https://returnyoutubedislikeapi.com", testMode: false, stateStorageKey: "state" },
    connectionFactory,
    fetchImpl: async (url, options) => {
      const path = new URL(url).pathname.replace("/api/discussion", "");
      paths.push(path);
      if (path === "/me/profile") profile = { id: profileId, nickname: JSON.parse(options.body).nickname };
      const data = path.startsWith("/me")
        ? { authenticated: true, profile, canPost: true, membershipTier: "premium" }
        : path === "/notifications/ticket"
          ? { token: "hub-ticket" }
          : { items: [], unreadCount: 0, revision: "0", nextCursor: null };
      return { ok: true, status: 200, json: async () => data };
    },
  });
  const send = (operation, payload) => client.handleMessage({ message: "ryd_discussion", operation, payload }, popup);
  try {
    await client.refreshSession();
    expect((await send("session")).data).toMatchObject({ authenticated: true, profile: null });
    expect((await send("notifications")).ok).toBe(true);
    expect(connectionFactory).not.toHaveBeenCalled();
    expect(paths).toEqual(["/me", "/notifications"]);
    expect((await send("profile", { nickname: "Tester" })).data.profile.nickname).toBe("Tester");
    await ready;
    expect(connectionFactory).toHaveBeenCalledTimes(1);
    expect(paths.filter((path) => path === "/notifications/ticket")).toHaveLength(1);
    client.clearSession(true);
    await closed;
    expect(peers).toHaveLength(1);
    expect(paths.filter((path) => path === "/notifications/ticket")).toHaveLength(1);
  } finally {
    client.stop();
    for (const socket of server.clients) socket.terminate();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the configured SignalR retry policy jitters four reconnect attempts then stops", async () => {
  const connection = createConnection(
    "https://returnyoutubedislikeapi.com/api/discussion/notifications/hub",
    async () => "ticket",
    () => 0.5,
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
  ).toEqual([500, 2000, 10000, 30000, null]);
  const low = createConnection(
    "https://example.com/hub",
    async () => "ticket",
    () => 0,
  );
  const high = createConnection(
    "https://example.com/hub",
    async () => "ticket",
    () => 1,
  );
  expect(low._reconnectPolicy.nextRetryDelayInMilliseconds({ previousRetryCount: 1 })).toBe(1500);
  expect(high._reconnectPolicy.nextRetryDelayInMilliseconds({ previousRetryCount: 1 })).toBe(2500);
  await low.stop();
  await high.stop();
  await connection.stop();
});
