import { HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { createVoteClient, solvePuzzle } from "../../common/vote-client";
import { discussionConfig } from "./discussion-config";
import { isFirefoxExtension, isNormalMessageSender } from "./private-browsing";

const ANONYMOUS_SESSION = Object.freeze({
  authenticated: false,
  profile: null,
  canPost: false,
  isModerator: false,
  membershipTier: "none",
});
const RECONNECT_ALARM = "ryd-discussion-reconnect";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
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
const OPERATIONS = {
  cancelScope: [],
  capabilities: [],
  session: [],
  profile: ["nickname"],
  comments: ["videoId", "sort", "cursor"],
  replies: ["rootId", "cursor"],
  comment: ["id"],
  createComment: ["videoId", "text", "parentId", "replyToId", "requestId"],
  editComment: ["id", "text"],
  deleteComment: ["id"],
  react: ["id", "value"],
  report: ["id", "reason"],
  reports: ["cursor", "status"],
  dismissReport: ["id", "reason"],
  moderateComment: ["id", "hidden", "reason"],
  suspendProfile: ["id", "suspended", "reason"],
  notifications: ["cursor"],
  readNotifications: ["ids", "all"],
};

class DiscussionError extends Error {
  constructor(code, message = code, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function callBrowser(api, target, method, ...args) {
  return new Promise((resolve, reject) => {
    if (typeof target?.[method] !== "function") return resolve(undefined);
    const callback = (value) =>
      api.runtime?.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve(value);
    try {
      const result = target[method](...args, callback);
      if (result?.then) result.then(resolve, reject);
    } catch (error) {
      try {
        Promise.resolve(target[method](...args)).then(resolve, reject);
      } catch (_) {
        reject(error);
      }
    }
  });
}

function isYouTubePage(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "www.youtube.com" &&
      (parsed.pathname === "/watch" || /^\/shorts\/[a-zA-Z0-9_-]{11}\/?$/.test(parsed.pathname))
    );
  } catch (_) {
    return false;
  }
}

function validateRequest(api, request, sender) {
  if (sender?.id !== api.runtime.id) throw new DiscussionError("invalid_sender");
  const extensionUrl = api.runtime.getURL?.("");
  const ownPage = extensionUrl && typeof sender.url === "string" && sender.url.startsWith(extensionUrl);
  const videoPage = sender.frameId === 0 && isYouTubePage(sender.url) && isYouTubePage(sender.tab?.url);
  const operation = request?.operation;
  const cancellationPage =
    operation === "cancelScope" &&
    sender.frameId === 0 &&
    [sender.url, sender.tab?.url].every((value) => {
      try {
        return new URL(value).origin === "https://www.youtube.com";
      } catch (_) {
        return false;
      }
    });
  if (!ownPage && !videoPage && !cancellationPage) throw new DiscussionError("invalid_sender");
  const fields = Object.hasOwn(OPERATIONS, operation) ? OPERATIONS[operation] : null;
  const payload = request.payload ?? {};
  if (
    !fields ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).some((key) => !fields.includes(key))
  )
    throw new DiscussionError("invalid_request");
  for (const key of ["id", "rootId", "parentId", "replyToId", "requestId"]) {
    if (payload[key] != null && (typeof payload[key] !== "string" || !UUID.test(payload[key])))
      throw new DiscussionError("invalid_request");
  }
  if (fields.includes("id") && !UUID.test(payload.id || "")) throw new DiscussionError("invalid_request");
  if (fields.includes("rootId") && !UUID.test(payload.rootId || "")) throw new DiscussionError("invalid_request");
  if (fields.includes("videoId") && !VIDEO_ID.test(payload.videoId || "")) throw new DiscussionError("invalid_request");
  if (operation === "createComment" && !UUID.test(payload.requestId || ""))
    throw new DiscussionError("invalid_request");
  for (const [key, max] of [
    ["text", 2000],
    ["nickname", 32],
    ["reason", 1000],
    ["cursor", 2048],
  ]) {
    if (payload[key] != null && (typeof payload[key] !== "string" || payload[key].length > max))
      throw new DiscussionError("invalid_request");
  }
  if (fields.includes("text") && !payload.text?.trim()) throw new DiscussionError("invalid_request");
  if (operation === "profile" && (typeof payload.nickname !== "string" || payload.nickname.trim().length < 3))
    throw new DiscussionError("invalid_request");
  if (operation === "report" && !payload.reason?.trim()) throw new DiscussionError("invalid_request");
  if (payload.sort != null && !["top", "new"].includes(payload.sort)) throw new DiscussionError("invalid_request");
  if (payload.status != null && !["open", "resolved"].includes(payload.status))
    throw new DiscussionError("invalid_request");
  if (operation === "react" && ![-1, 0, 1].includes(payload.value)) throw new DiscussionError("invalid_request");
  for (const key of ["hidden", "suspended"]) {
    if (fields.includes(key) && typeof payload[key] !== "boolean") throw new DiscussionError("invalid_request");
  }
  if (
    operation === "readNotifications" &&
    !(payload.all === true && payload.ids == null) &&
    !(
      payload.all == null &&
      Array.isArray(payload.ids) &&
      payload.ids.length > 0 &&
      payload.ids.length <= 100 &&
      payload.ids.every((id) => typeof id === "string" && UUID.test(id))
    )
  )
    throw new DiscussionError("invalid_request");
  const scope = request.scope;
  if (scope != null) {
    if (
      !scope ||
      typeof scope !== "object" ||
      Array.isArray(scope) ||
      Object.keys(scope).some((key) => !["id", "videoId"].includes(key)) ||
      typeof scope.id !== "string" ||
      !UUID.test(scope.id) ||
      typeof scope.videoId !== "string" ||
      !VIDEO_ID.test(scope.videoId) ||
      !Number.isInteger(sender.tab?.id) ||
      (!videoPage && !cancellationPage) ||
      (!VIDEO_OPERATIONS.has(operation) && operation !== "cancelScope")
    )
      throw new DiscussionError("invalid_scope");
    if (operation !== "cancelScope") {
      const current = new URL(sender.tab.url);
      const videoId = current.pathname === "/watch" ? current.searchParams.get("v") : current.pathname.split("/")[2];
      if (scope.videoId !== videoId || (payload.videoId && payload.videoId !== scope.videoId))
        throw new DiscussionError("navigation_changed");
    }
  } else if (operation === "cancelScope" || (videoPage && VIDEO_OPERATIONS.has(operation))) {
    throw new DiscussionError("scope_required");
  }
  return { operation, payload, scope };
}

function safeSession(data) {
  const profile = data.profile;
  return {
    authenticated: data.authenticated === true,
    profile: profile ? { id: profile.id, nickname: profile.nickname, suspended: profile.suspended === true } : null,
    canPost: data.canPost === true,
    isModerator: data.isModerator === true,
    membershipTier: ["none", "supporter", "commenter", "premium"].includes(data.membershipTier)
      ? data.membershipTier
      : "none",
  };
}

function createConnection(url, accessTokenFactory) {
  return new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets, skipNegotiation: true, accessTokenFactory })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .withKeepAliveInterval(15000)
    .withServerTimeout(45000)
    .configureLogging(LogLevel.None)
    .build();
}

export function createDiscussionBackground({
  api,
  voteClient,
  fetchImpl = (...args) => fetch(...args),
  accountFetchImpl = fetchImpl,
  hasConsent = async () => true,
  settings = discussionConfig,
  connectionFactory = createConnection,
  solve = solvePuzzle,
} = {}) {
  const local = api.storage.local;
  const origin = settings.apiOrigin.replace(/\/$/, "");
  const pendingRequests = new Map();
  const reactionQueues = new Map();
  const navigationScopes = new Map();
  let generation = 0;
  let accountEpoch = 0;
  let token = "";
  let session = { ...ANONYMOUS_SESSION };
  let connection = null;
  let connecting = null;
  let accountQueue = Promise.resolve();
  let catchupQueue = Promise.resolve();
  let stateQueue = Promise.resolve();
  let rejectedToken = "";
  let accountBlocked = false;
  let hintedRevision = "0";
  let hasInboxSnapshot = false;
  let inbox = { items: [], unreadCount: 0, revision: "0", nextCursor: null };
  let stopped = false;

  const store = (method, ...args) => callBrowser(api, local, method, ...args);
  const writeState = (expected, method, ...args) => {
    const work = stateQueue
      .catch(() => {})
      .then(() => {
        if (expected !== generation) return;
        return store(method, ...args);
      });
    stateQueue = work;
    return work;
  };
  const credentials = settings.testMode
    ? createVoteClient({
        apiBaseUrl: origin,
        fetchImpl,
        credentialStore: {
          async load() {
            return (await store("get", [settings.credentialStorageKey]))?.[settings.credentialStorageKey] ?? null;
          },
          async save(value) {
            await store("set", { [settings.credentialStorageKey]: value });
          },
          async clear() {
            await store("remove", [settings.credentialStorageKey]);
          },
        },
        cryptoImpl: globalThis.crypto,
      })
    : voteClient;

  function assertCurrent(expected) {
    if (stopped || expected !== generation) throw new DiscussionError("session_changed");
  }

  function assertScope(scope) {
    if (scope?.cancelled) throw new DiscussionError("navigation_changed", "The video changed");
  }

  function scopeFor(value, sender) {
    if (!value) return null;
    const documentId = sender.documentId || "top-frame";
    const key = `${sender.tab.id}:${documentId}:${value.id}`;
    if (!navigationScopes.has(key))
      navigationScopes.set(key, {
        tabId: sender.tab.id,
        documentId,
        videoId: value.videoId,
        cancelled: false,
        controllers: new Set(),
      });
    const scope = navigationScopes.get(key);
    if (scope.videoId !== value.videoId) throw new DiscussionError("invalid_scope");
    return scope;
  }

  function cancelScope(scope) {
    scope.cancelled = true;
    for (const controller of scope.controllers) controller.abort();
  }

  async function request(
    path,
    { method = "GET", body, auth = token, expected = generation, scope, accountBound = true } = {},
  ) {
    const assertRequest = () => assertCurrent(accountBound ? expected : generation);
    assertRequest();
    assertScope(scope);
    const controller = new AbortController();
    pendingRequests.set(controller, accountBound);
    scope?.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await (auth ? accountFetchImpl : fetchImpl)(`${origin}/api/discussion${path}`, {
        method,
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body == null ? {} : { "Content-Type": "application/json" }),
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        ...(body == null ? {} : { body: JSON.stringify(body) }),
      });
      assertRequest();
      assertScope(scope);
      const data = response.status === 204 ? null : await response.json().catch(() => null);
      assertRequest();
      assertScope(scope);
      if (!response.ok) {
        if (
          response.status === 401 &&
          data?.code === "authentication_required" &&
          accountBound &&
          auth &&
          auth === token &&
          path !== "/me"
        ) {
          rejectedToken = token;
          clearSession();
        }
        throw new DiscussionError(data?.code || "request_failed", data?.message || "Request failed", response.status);
      }
      return data;
    } catch (error) {
      assertScope(scope);
      if (error instanceof DiscussionError) throw error;
      throw new DiscussionError(
        controller.signal.aborted ? "request_cancelled" : "network_error",
        "Discussion is unavailable",
      );
    } finally {
      clearTimeout(timeout);
      pendingRequests.delete(controller);
      scope?.controllers.delete(controller);
    }
  }

  async function broadcast(type, data, expected = generation) {
    const message = { message: "ryd_discussion_event", type, data };
    if (expected !== generation || stopped) return;
    const tabs = await callBrowser(
      api,
      api.tabs,
      "query",
      type === "toast" ? { active: true, lastFocusedWindow: true } : {},
    );
    if (expected !== generation || stopped) return;
    const firefox = isFirefoxExtension(api);
    const targets = (tabs || []).filter((tab) => isYouTubePage(tab.url) && (!firefox || tab.incognito === false));
    await Promise.allSettled(
      (type === "toast" ? targets.slice(0, 1) : targets).map((tab) =>
        callBrowser(api, api.tabs, "sendMessage", tab.id, message),
      ),
    );
    if (type !== "toast" && expected === generation) {
      if (firefox) {
        try {
          const extensionUrl = api.runtime.getURL("");
          for (const view of api.extension?.getViews?.() || []) {
            try {
              if (
                view.browser?.extension?.inIncognitoContext === false &&
                view.location?.href?.startsWith(extensionUrl)
              )
                view.dispatchEvent(new view.CustomEvent("ryd-discussion-event", { detail: structuredClone(message) }));
            } catch (_) {}
          }
        } catch (_) {}
      } else {
        await callBrowser(api, api.runtime, "sendMessage", message).catch(() => {});
      }
    }
  }

  function badgeText() {
    return inbox.unreadCount ? String(Math.min(inbox.unreadCount, 99)) + (inbox.unreadCount > 99 ? "+" : "") : "";
  }

  async function updateTabBadge(tab, expected = generation) {
    if (expected !== generation || stopped || tab?.incognito !== false || !Number.isInteger(tab.id)) return;
    const action = api.action || api.browserAction;
    await callBrowser(api, action, "setBadgeText", { tabId: tab.id, text: badgeText() }).catch(() => {});
    if (expected === generation && !stopped)
      await callBrowser(api, action, "setBadgeBackgroundColor", { tabId: tab.id, color: "#cc0000" }).catch(() => {});
  }

  async function updateBadge(expected = generation) {
    if (expected !== generation || stopped) return;
    const action = api.action || api.browserAction;
    if (isFirefoxExtension(api)) {
      await callBrowser(api, action, "setBadgeText", { text: "" }).catch(() => {});
      if (expected !== generation || stopped) return;
      const tabs = await callBrowser(api, api.tabs, "query", {});
      if (expected !== generation || stopped) return;
      await Promise.allSettled((tabs || []).map((tab) => updateTabBadge(tab, expected)));
      return;
    }
    await callBrowser(api, action, "setBadgeText", {
      text: badgeText(),
    }).catch(() => {});
    if (expected === generation)
      await callBrowser(api, action, "setBadgeBackgroundColor", { color: "#cc0000" }).catch(() => {});
  }

  async function publishInbox(expected, changed = [], showToast = false) {
    assertCurrent(expected);
    await writeState(expected, "set", {
      [settings.stateStorageKey]: { profileId: session.profile?.id ?? null, ...inbox },
    });
    assertCurrent(expected);
    await updateBadge(expected);
    await broadcast("inbox", inbox, expected);
    if (showToast) {
      const notification = changed.find((item) => !item.read && ["reply", "likes"].includes(item.type));
      if (notification) await broadcast("toast", notification, expected);
    }
  }

  function catchup(showToast = false, expected = generation) {
    const work = catchupQueue
      .catch(() => {})
      .then(async () => {
        assertCurrent(expected);
        if (!session.authenticated || !token) return;
        const since = inbox.revision;
        const isChanges = hasInboxSnapshot;
        const changed = [];
        let cursor = null;
        let page;
        do {
          const params = new URLSearchParams();
          if (isChanges) params.set("afterRevision", since);
          if (cursor) params.set("cursor", cursor);
          page = await request(`/notifications${params.size ? `?${params}` : ""}`, { expected });
          changed.push(...(page.items || []));
          cursor = page.nextCursor;
        } while (cursor && isChanges);
        assertCurrent(expected);
        const previous = new Map(inbox.items.map((item) => [item.id, item]));
        const novel = changed.filter((item) => previous.get(item.id)?.revision !== item.revision);
        for (const item of changed) previous.set(item.id, item);
        inbox = {
          items: [...previous.values()]
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
            .slice(0, 100),
          nextCursor: isChanges ? inbox.nextCursor : page.nextCursor,
          unreadCount: page.unreadCount,
          revision: page.revision,
        };
        hasInboxSnapshot = true;
        await publishInbox(expected, novel, showToast && isChanges);
      });
    catchupQueue = work;
    return work;
  }

  async function connect(expected = generation) {
    if (connecting || connection || !session.authenticated || !token || stopped) return connecting;
    const work = (async () => {
      assertCurrent(expected);
      const activeToken = token;
      const socket = connectionFactory(`${origin}/api/discussion/notifications/hub`, async () => {
        assertCurrent(expected);
        const ticket = await request("/notifications/ticket", { method: "POST", auth: activeToken, expected });
        return ticket.token;
      });
      connection = socket;
      socket.on("NotificationsChanged", (event) => {
        const revision = event?.revision;
        if (expected !== generation || typeof revision !== "string" || !/^(0|[1-9][0-9]*)$/.test(revision)) return;
        if (BigInt(revision) <= BigInt(inbox.revision) || BigInt(revision) <= BigInt(hintedRevision)) return;
        hintedRevision = revision;
        catchup(true, expected).catch(() => {
          if (expected === generation) hintedRevision = inbox.revision;
        });
      });
      socket.onclose(() => {
        if (connection === socket) connection = null;
      });
      socket.onreconnected(() => {
        if (expected !== generation || connection !== socket || stopped) return;
        catchup(false, expected).catch(() => {});
      });
      try {
        await socket.start();
        assertCurrent(expected);
        await catchup(false, expected).catch(() => {});
      } catch (error) {
        if (connection === socket) connection = null;
        await socket.stop().catch(() => {});
        throw error;
      }
    })();
    connecting = work;
    try {
      await work;
    } finally {
      if (connecting === work) connecting = null;
    }
  }

  function clearSession(blockAccount = false, preserveQueuedRequests = false) {
    if (blockAccount) accountBlocked = true;
    if (!preserveQueuedRequests) accountEpoch++;
    generation++;
    for (const [controller, accountBound] of pendingRequests) if (accountBound) controller.abort();
    const previousConnection = connection;
    connection = null;
    connecting = null;
    previousConnection?.stop().catch(() => {});
    token = "";
    hintedRevision = "0";
    hasInboxSnapshot = false;
    session = { ...ANONYMOUS_SESSION };
    inbox = { items: [], unreadCount: 0, revision: "0", nextCursor: null };
    writeState(generation, "remove", [settings.stateStorageKey]).catch(() => {});
    updateBadge().catch(() => {});
    broadcast("session", session).catch(() => {});
    broadcast("inbox", inbox).catch(() => {});
  }

  function refreshSession() {
    const work = accountQueue
      .catch(() => {})
      .then(async () => {
        const beforeRead = generation;
        if (stopped || accountBlocked) return session;
        const consent = await hasConsent();
        assertCurrent(beforeRead);
        let nextToken = "";
        if (consent) {
          if (settings.testMode) {
            const data = await store("get", [settings.authStorageKey]);
            nextToken = data?.[settings.authStorageKey]?.sessionToken || "";
          } else {
            const data = await callBrowser(api, api.storage.sync, "get", [
              "patreonAuthenticated",
              "patreonSessionToken",
            ]);
            nextToken = data?.patreonAuthenticated ? data.patreonSessionToken || "" : "";
          }
        }
        assertCurrent(beforeRead);
        if (
          (nextToken && nextToken === rejectedToken) ||
          (nextToken === token && (!nextToken || session.authenticated))
        )
          return session;
        clearSession(false, true);
        const expected = generation;
        token = nextToken;
        if (!token) return session;
        try {
          session = safeSession(await request("/me", { expected }));
        } catch (error) {
          assertCurrent(expected);
          if (error.status !== 401) throw error;
          rejectedToken = token;
          token = "";
          session = { ...ANONYMOUS_SESSION };
          return session;
        }
        assertCurrent(expected);
        await broadcast("session", session, expected);
        await catchup(false, expected).catch(() => {});
        connect(expected).catch(() => {});
        return session;
      });
    accountQueue = work;
    return work;
  }

  async function withReactions(result, expected, single = false, scope) {
    assertScope(scope);
    const items = single ? [result] : result.items || [];
    if (!items.length) return result;
    try {
      const registered = await credentials.getRegisteredUser();
      assertCurrent(expected);
      assertScope(scope);
      if (!registered) {
        for (const item of items) item.myReaction = 0;
        return result;
      }
      const { userId } = registered;
      const values = await request("/reactions/state", {
        method: "POST",
        body: { userId, commentIds: items.map((item) => item.id) },
        expected,
        scope,
      });
      const ownValues = new Map((values.items || []).map((item) => [item.commentId, item.value]));
      for (const item of items) item.myReaction = ownValues.get(item.id) ?? 0;
    } catch (error) {
      assertCurrent(expected);
      assertScope(scope);
      // Public reading remains available when stored vote credentials are unavailable.
    }
    return result;
  }

  function react(payload, expected, scope) {
    const previous = reactionQueues.get(payload.id) || Promise.resolve();
    const work = previous
      .catch(() => {})
      .then(async () => {
        assertCurrent(expected);
        assertScope(scope);
        const { userId } = await credentials.ensureRegistered();
        assertCurrent(expected);
        assertScope(scope);
        for (let attempt = 0; attempt < 3; attempt++) {
          const puzzle = await request(`/comments/${payload.id}/reaction/challenge`, {
            method: "POST",
            body: { userId, value: payload.value },
            expected,
            scope,
          });
          const solved = await solve(puzzle);
          assertCurrent(expected);
          assertScope(scope);
          if (!solved) continue;
          return request(`/comments/${payload.id}/reaction/confirm`, {
            method: "POST",
            body: { userId, challengeId: puzzle.challengeId, solution: solved.solution },
            expected,
            scope,
          });
        }
        throw new DiscussionError("puzzle_failed", "Please try the reaction again");
      });
    reactionQueues.set(payload.id, work);
    work
      .finally(() => {
        if (reactionQueues.get(payload.id) === work) reactionQueues.delete(payload.id);
      })
      .catch(() => {});
    return work;
  }

  async function execute(operation, payload, scope) {
    assertScope(scope);
    if (operation === "capabilities") return request("/capabilities", { auth: "", accountBound: false });
    const queuedEpoch = accountEpoch;
    await refreshSession();
    if (queuedEpoch !== accountEpoch) throw new DiscussionError("session_changed");
    assertScope(scope);
    const expected = generation;
    const { id, cursor } = payload;
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const send = (path, options = {}) => request(path, { ...options, scope });
    switch (operation) {
      case "session":
        return session;
      case "profile": {
        const data = safeSession(
          await send("/me/profile", { method: "PUT", body: { nickname: payload.nickname }, expected }),
        );
        session = data;
        await broadcast("session", session, expected);
        return data;
      }
      case "comments":
        return withReactions(
          await send(
            `/videos/${payload.videoId}/comments?sort=${payload.sort || "top"}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
            { expected },
          ),
          expected,
          false,
          scope,
        );
      case "replies":
        return withReactions(
          await send(`/comments/${payload.rootId}/replies${query}`, { expected }),
          expected,
          false,
          scope,
        );
      case "comment":
        return withReactions(await send(`/comments/${id}`, { expected }), expected, true, scope);
      case "createComment": {
        const { videoId, ...body } = payload;
        return send(`/videos/${videoId}/comments`, { method: "POST", body, expected });
      }
      case "editComment":
        return send(`/comments/${id}`, { method: "PATCH", body: { text: payload.text }, expected });
      case "deleteComment":
        return send(`/comments/${id}`, { method: "DELETE", expected });
      case "react":
        return react(payload, expected, scope);
      case "report":
        return send(`/comments/${id}/reports`, { method: "POST", body: { reason: payload.reason }, expected });
      case "reports":
        return request(
          `/moderation/reports?status=${payload.status || "open"}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          { expected },
        );
      case "dismissReport":
        return request(`/moderation/reports/${id}/dismiss`, {
          method: "POST",
          body: { reason: payload.reason },
          expected,
        });
      case "moderateComment":
        return request(`/moderation/comments/${id}`, {
          method: "POST",
          body: { hidden: payload.hidden, reason: payload.reason },
          expected,
        });
      case "suspendProfile":
        return request(`/moderation/profiles/${id}/suspension`, {
          method: "POST",
          body: { suspended: payload.suspended, reason: payload.reason },
          expected,
        });
      case "notifications":
        return request(`/notifications${query}`, { expected });
      case "readNotifications": {
        const data = await request("/notifications/read", { method: "POST", body: payload, expected });
        await catchup(false, expected);
        return data;
      }
      default:
        throw new DiscussionError("invalid_request");
    }
  }

  async function handleMessage(requestMessage, sender) {
    try {
      if (!isNormalMessageSender(api, sender)) throw new DiscussionError("private_browsing");
      const { operation, payload, scope: scopeValue } = validateRequest(api, requestMessage, sender);
      const scope = scopeFor(scopeValue, sender);
      if (operation === "cancelScope") {
        cancelScope(scope);
        return { ok: true, data: { cancelled: true } };
      }
      const data = await execute(operation, payload, scope);
      assertScope(scope);
      if (
        scope &&
        ((data?.videoId && data.videoId !== scope.videoId) ||
          data?.items?.some((item) => item.videoId && item.videoId !== scope.videoId))
      )
        throw new DiscussionError("navigation_changed");
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error.code || "request_failed",
          message: error.message || "Request failed",
          status: error.status || 0,
        },
      };
    }
  }

  function onStorageChanged(changes, area) {
    const changed = settings.testMode
      ? area === "local" && changes[settings.authStorageKey]
      : area === "sync" && (changes.patreonAuthenticated || changes.patreonSessionToken || changes.patreonUser);
    if (changed) {
      rejectedToken = "";
      clearSession();
      refreshSession().catch(() => {});
    }
  }

  function initialize() {
    if (isFirefoxExtension(api)) {
      api.tabs?.onCreated?.addListener((tab) => updateTabBadge(tab).catch(() => {}));
      api.tabs?.onUpdated?.addListener((tabId, change, tab) => updateTabBadge(tab).catch(() => {}));
      updateBadge().catch(() => {});
    }
    api.tabs?.onRemoved?.addListener((tabId) => {
      for (const [key, scope] of navigationScopes)
        if (scope.tabId === tabId) {
          cancelScope(scope);
          navigationScopes.delete(key);
        }
    });
    api.alarms?.onAlarm?.addListener((alarm) => {
      if (alarm.name !== RECONNECT_ALARM || stopped) return;
      refreshSession()
        .then(() => Promise.allSettled([catchup(false), connect()]))
        .catch(() => {});
    });
    // Alarm recovery also covers service-worker termination and offline browser startup.
    api.alarms?.create(RECONNECT_ALARM, { periodInMinutes: 1 });
    refreshSession().catch(() => {});
  }

  return {
    handleMessage,
    refreshSession,
    clearSession,
    resumeSession() {
      accountBlocked = false;
      return refreshSession();
    },
    onStorageChanged,
    initialize,
    stop() {
      clearSession();
      stopped = true;
      for (const controller of pendingRequests.keys()) controller.abort();
      api.alarms?.clear(RECONNECT_ALARM);
    },
  };
}

export { ANONYMOUS_SESSION, createConnection, validateRequest };
