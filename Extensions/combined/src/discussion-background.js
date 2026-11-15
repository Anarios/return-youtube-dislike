import { HubConnectionBuilder, HttpTransportType, LogLevel } from "@microsoft/signalr";
import { createVoteClient, solvePuzzle } from "../../common/vote-client";
import { discussionConfig } from "./discussion-config";
import { isFirefoxExtension, isNormalMessageSender } from "./private-browsing";

const MEMBERSHIP_TIERS = Object.freeze(["none", "supporter", "commenter", "premium"]);
const ANONYMOUS_SESSION = Object.freeze({
  authenticated: false,
  profile: null,
  canPost: false,
  isModerator: false,
  membershipTier: "none",
});
const RECOVERY_DELAYS = [1000, 3000, 10000];
const REACTION_STORAGE_KEY = "rydDiscussionReactions";
const MAX_REACTION_VIDEOS = 100;
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

function isYouTubeOrigin(url) {
  try {
    return new URL(url).origin === "https://www.youtube.com";
  } catch (_) {
    return false;
  }
}

function validateRequest(api, request, sender) {
  if (sender?.id !== api.runtime.id) throw new DiscussionError("invalid_sender");
  const extensionUrl = api.runtime.getURL?.("");
  const ownPage = extensionUrl && typeof sender.url === "string" && sender.url.startsWith(extensionUrl);
  const videoPage = sender.frameId === 0 && isYouTubeOrigin(sender.url) && isYouTubePage(sender.tab?.url);
  const operation = request?.operation;
  const topPage =
    ["capabilities", "session"].includes(operation) &&
    sender.frameId === 0 &&
    isYouTubeOrigin(sender.url) &&
    isYouTubeOrigin(sender.tab?.url);
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
  if (!ownPage && !videoPage && !cancellationPage && !topPage) throw new DiscussionError("invalid_sender");
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
    membershipTier: MEMBERSHIP_TIERS.includes(data.membershipTier) ? data.membershipTier : "none",
  };
}

function discussionEvent(type, data) {
  return { message: "ryd_discussion_event", type, data };
}

function canReceiveLiveNotifications(session) {
  return (
    session.authenticated === true &&
    MEMBERSHIP_TIERS.indexOf(session.membershipTier) >= MEMBERSHIP_TIERS.indexOf("commenter") &&
    Boolean(session.profile?.nickname)
  );
}

function createConnection(url, accessTokenFactory, random = Math.random) {
  return new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets, skipNegotiation: true, accessTokenFactory })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds({ previousRetryCount }) {
        const delays = [500, 2000, 10000, 30000];
        const delay = delays[previousRetryCount];
        return delay == null ? null : Math.round(delay * (0.75 + random() * 0.5));
      },
    })
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
  hasFeatureConsent = (feature) => (feature === "account" ? hasConsent() : true),
  settings = discussionConfig,
  connectionFactory = createConnection,
  solve = solvePuzzle,
  random = Math.random,
} = {}) {
  const local = api.storage.local;
  const origin = settings.apiOrigin.replace(/\/$/, "");
  const pendingRequests = new Map();
  const reactionQueues = new Map();
  const navigationScopes = new Map();
  const cancelledScopes = new Set();
  let generation = 0;
  let accountEpoch = 0;
  let token = "";
  let session = { ...ANONYMOUS_SESSION };
  let connection = null;
  let connecting = null;
  let activityCatchup = null;
  let refreshing = null;
  let recoveryTimer = null;
  let recoveryRevision = 0;
  let recoveryAttempt = 0;
  let recoveryActive = false;
  let accountQueue = Promise.resolve();
  let catchupQueue = Promise.resolve();
  let stateQueue = Promise.resolve();
  let reactionStateQueue = Promise.resolve();
  let voterEpoch = 0;
  const permissionEpochs = { account: 0, voting: 0, counts: 0 };
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
    if (cancelledScopes.has(key)) throw new DiscussionError("navigation_changed");
    if (!navigationScopes.has(key))
      for (const [oldKey, oldScope] of navigationScopes)
        if (oldScope.tabId === sender.tab.id && oldKey !== key) {
          cancelScope(oldScope);
          navigationScopes.delete(oldKey);
        }
    if (!navigationScopes.has(key))
      navigationScopes.set(key, {
        tabId: sender.tab.id,
        key,
        documentId,
        videoId: value.videoId,
        cancelled: false,
        controllers: new Set(),
        authors: new Map(),
      });
    const scope = navigationScopes.get(key);
    if (scope.videoId !== value.videoId) throw new DiscussionError("invalid_scope");
    return scope;
  }

  function cancelScope(scope) {
    scope.cancelled = true;
    for (const controller of scope.controllers) controller.abort();
    navigationScopes.delete(scope.key);
    cancelledScopes.add(scope.key);
    while (cancelledScopes.size > 100) cancelledScopes.delete(cancelledScopes.values().next().value);
  }

  async function request(
    path,
    { method = "GET", body, auth = token, expected = generation, scope, accountBound = true, feature = "account" } = {},
  ) {
    const features = new Set([feature]);
    if (scope || /^\/(?:videos\/[^/]+\/comments(?:\/|$)|comments\/[^/]+(?:\/|$))/.test(path)) features.add("counts");
    const epochs = [...features].map((value) => [value, permissionEpochs[value]]);
    const assertRequest = () => {
      assertCurrent(accountBound ? expected : generation);
      for (const [value, epoch] of epochs)
        if (epoch !== permissionEpochs[value]) throw new DiscussionError(`${value}_consent_required`);
    };
    for (const value of features)
      if (!(await hasFeatureConsent(value))) throw new DiscussionError(`${value}_consent_required`);
    assertRequest();
    assertScope(scope);
    const controller = new AbortController();
    pendingRequests.set(controller, { accountBound, features });
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
    const message = discussionEvent(type, data);
    if (expected !== generation || stopped) return;
    const tabs = await callBrowser(
      api,
      api.tabs,
      "query",
      type === "toast" ? { active: true, lastFocusedWindow: true } : {},
    );
    if (expected !== generation || stopped) return;
    const firefox = isFirefoxExtension(api);
    const targets = (tabs || []).filter(
      (tab) =>
        (type === "toast" ? isYouTubePage(tab.url) : isYouTubeOrigin(tab.url)) && (!firefox || tab.incognito === false),
    );
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
        if (!canReceiveLiveNotifications(session) || !token || !(await hasFeatureConsent("account"))) return;
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
        if (!canReceiveLiveNotifications(session)) return;
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

  function catchupOnActivity(expected = generation) {
    if (activityCatchup) return activityCatchup;
    const work = catchup(false, expected);
    activityCatchup = work;
    work
      .finally(() => {
        if (activityCatchup === work) activityCatchup = null;
      })
      .catch(() => {});
    return work;
  }

  function shareInbox(tabId) {
    if (!hasInboxSnapshot || !canReceiveLiveNotifications(session)) return;
    callBrowser(api, api.tabs, "sendMessage", tabId, discussionEvent("inbox", inbox)).catch(() => {});
  }

  function assertLiveNotifications(expected) {
    assertCurrent(expected);
    if (!canReceiveLiveNotifications(session)) throw new DiscussionError("notifications_unavailable");
  }

  async function connect(expected = generation) {
    if (connecting || connection || !canReceiveLiveNotifications(session) || !token || stopped) return connecting;
    if (!(await hasFeatureConsent("account"))) return;
    assertCurrent(expected);
    if (connecting || connection) return connecting;
    const work = (async () => {
      assertCurrent(expected);
      const activeToken = token;
      const socket = connectionFactory(`${origin}/api/discussion/notifications/hub`, async () => {
        assertLiveNotifications(expected);
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
        finishRecovery(recoveryRevision);
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

  function resetLiveNotifications() {
    const previousConnection = connection;
    connection = null;
    connecting = null;
    activityCatchup = null;
    previousConnection?.stop().catch(() => {});
    hintedRevision = "0";
    hasInboxSnapshot = false;
    inbox = { items: [], unreadCount: 0, revision: "0", nextCursor: null };
  }

  function stopLiveNotifications() {
    if (!connection && !connecting && !hasInboxSnapshot) return;
    resetLiveNotifications();
    updateBadge().catch(() => {});
    broadcast("inbox", inbox).catch(() => {});
  }

  function clearSession(blockAccount = false, preserveQueuedRequests = false, preserveRecovery = false) {
    if (!preserveRecovery) {
      recoveryRevision++;
      finishRecovery(recoveryRevision);
      refreshing = null;
    }
    if (blockAccount) accountBlocked = true;
    if (!preserveQueuedRequests) accountEpoch++;
    generation++;
    for (const [controller, state] of pendingRequests) if (state.accountBound) controller.abort();
    resetLiveNotifications();
    token = "";
    session = { ...ANONYMOUS_SESSION };
    writeState(generation, "remove", [settings.stateStorageKey]).catch(() => {});
    updateBadge().catch(() => {});
    broadcast("session", session).catch(() => {});
    broadcast("inbox", inbox).catch(() => {});
  }

  function loadSession() {
    const work = accountQueue
      .catch(() => {})
      .then(async () => {
        const beforeRead = generation;
        if (stopped || accountBlocked) return session;
        const consent = await hasFeatureConsent("account");
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
        if (token && token !== nextToken) clearSession(false, true, true);
        const expected = generation;
        token = nextToken;
        if (!token) return session;
        try {
          session = safeSession(await request("/me", { expected }));
        } catch (error) {
          assertCurrent(expected);
          if (error.status !== 401) throw error;
          rejectedToken = token;
          clearSession(false, true, true);
          return session;
        }
        assertCurrent(expected);
        await broadcast("session", session, expected);
        return session;
      });
    accountQueue = work;
    return work;
  }

  function finishRecovery(revision) {
    if (revision !== recoveryRevision) return;
    if (recoveryTimer !== null) clearTimeout(recoveryTimer);
    recoveryTimer = null;
    recoveryActive = false;
    recoveryAttempt = 0;
  }

  function scheduleRecovery(revision, error) {
    if (revision !== recoveryRevision || stopped || accountBlocked || !recoveryActive || recoveryTimer !== null) return;
    const permanent =
      ["session_changed", "account_consent_required", "notifications_unavailable"].includes(error?.code) ||
      (error?.status > 0 && error.status < 500 && error.status !== 408);
    const delay = RECOVERY_DELAYS[recoveryAttempt];
    if (permanent || delay == null) {
      finishRecovery(revision);
      return;
    }
    recoveryAttempt++;
    recoveryTimer = setTimeout(
      () => {
        recoveryTimer = null;
        if (revision === recoveryRevision && !stopped && !accountBlocked) refreshSession(true).catch(() => {});
      },
      Math.round(delay * (0.75 + random() * 0.5)),
    );
  }

  function refreshSession(retrying = false) {
    if (refreshing) return refreshing;
    if (stopped || accountBlocked || (!retrying && recoveryTimer !== null)) return Promise.resolve(session);
    if (!recoveryActive) {
      recoveryActive = true;
      recoveryAttempt = 0;
    }
    const revision = recoveryRevision;
    const work = loadSession().then(
      (value) => {
        if (revision !== recoveryRevision) throw new DiscussionError("session_changed");
        if (!canReceiveLiveNotifications(value)) {
          stopLiveNotifications();
          finishRecovery(revision);
        } else if (connection?.state === "Connected") {
          if (!hasInboxSnapshot && !connecting) catchupOnActivity().catch(() => {});
          finishRecovery(revision);
        } else {
          if (!connecting && (!retrying || !hasInboxSnapshot)) catchupOnActivity().catch(() => {});
          connect().catch((error) => scheduleRecovery(revision, error));
        }
        return value;
      },
      (error) => {
        scheduleRecovery(revision, error);
        throw error;
      },
    );
    refreshing = work;
    work
      .finally(() => {
        if (refreshing === work) refreshing = null;
      })
      .catch(() => {});
    return work;
  }

  async function withLocalReactions(result, single = false, scope) {
    assertScope(scope);
    const items = single ? [result] : result.items || [];
    if (!items.length) return result;
    for (const item of items) if (scope && item.author?.id) scope.authors.set(item.id, item.author.id);
    const epoch = voterEpoch;
    await reactionStateQueue.catch(() => {});
    try {
      const allowed = await hasFeatureConsent("voting");
      const data = allowed ? await store("get", [REACTION_STORAGE_KEY]) : {};
      assertScope(scope);
      const videos =
        epoch === voterEpoch && Array.isArray(data?.[REACTION_STORAGE_KEY]) ? data[REACTION_STORAGE_KEY] : [];
      for (const item of items) {
        const reactions = videos.find((entry) => entry.videoId === (scope?.videoId || item.videoId))?.reactions;
        item.myReaction = [-1, 1].includes(reactions?.[item.id]) ? reactions[item.id] : 0;
      }
    } catch (error) {
      assertScope(scope);
      for (const item of items) item.myReaction = 0;
    }
    return result;
  }

  function rememberReaction(videoId, commentId, value, epoch) {
    const work = reactionStateQueue
      .catch(() => {})
      .then(async () => {
        if (epoch !== voterEpoch || !VIDEO_ID.test(videoId || "") || ![-1, 0, 1].includes(value)) return;
        const data = await store("get", [REACTION_STORAGE_KEY]);
        if (epoch !== voterEpoch || !(await hasFeatureConsent("voting"))) return;
        const previous = Array.isArray(data?.[REACTION_STORAGE_KEY]) ? data[REACTION_STORAGE_KEY] : [];
        const reactions = { ...previous.find((item) => item.videoId === videoId)?.reactions };
        if (value === 0) delete reactions[commentId];
        else reactions[commentId] = value;
        const videos = previous.filter((item) => item.videoId !== videoId);
        if (Object.keys(reactions).length) videos.push({ videoId, reactions });
        await store("set", { [REACTION_STORAGE_KEY]: videos.slice(-MAX_REACTION_VIDEOS) });
      });
    reactionStateQueue = work;
    return work;
  }

  function clearReactions(invalidate = true) {
    if (invalidate) voterEpoch++;
    const work = reactionStateQueue.catch(() => {}).then(() => store("remove", [REACTION_STORAGE_KEY]));
    reactionStateQueue = work;
    return work;
  }

  function react(payload, expected, scope) {
    const epoch = voterEpoch;
    const browsingEpoch = permissionEpochs.counts;
    const assertReaction = () => {
      assertScope(scope);
      if (browsingEpoch !== permissionEpochs.counts) throw new DiscussionError("counts_consent_required");
      if (epoch !== voterEpoch) throw new DiscussionError("voting_consent_required");
      if (session.authenticated && scope?.authors.get(payload.id) === session.profile?.id)
        throw new DiscussionError("own_comment");
    };
    const previous = reactionQueues.get(payload.id) || Promise.resolve();
    const work = previous
      .catch(() => {})
      .then(async () => {
        assertReaction();
        if (!(await hasFeatureConsent("voting"))) throw new DiscussionError("voting_consent_required");
        assertReaction();
        const { userId } = await credentials.ensureRegistered();
        assertReaction();
        for (let attempt = 0; attempt < 3; attempt++) {
          const puzzle = await request(`/comments/${payload.id}/reaction/challenge`, {
            method: "POST",
            body: { userId, value: payload.value },
            expected,
            scope,
            auth: "",
            accountBound: false,
            feature: "voting",
          });
          const solved = await solve(puzzle);
          assertReaction();
          if (!solved) continue;
          const result = await request(`/comments/${payload.id}/reaction/confirm`, {
            method: "POST",
            body: { userId, challengeId: puzzle.challengeId, solution: solved.solution },
            expected,
            scope,
            auth: "",
            accountBound: false,
            feature: "voting",
          });
          assertReaction();
          await rememberReaction(scope?.videoId, payload.id, result.myReaction, epoch);
          return result;
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
    const queuedEpoch = accountEpoch;
    const browsingEpoch = permissionEpochs.counts;
    const assertBrowsing = () => {
      if (VIDEO_OPERATIONS.has(operation) && browsingEpoch !== permissionEpochs.counts)
        throw new DiscussionError("counts_consent_required");
    };
    assertScope(scope);
    if (VIDEO_OPERATIONS.has(operation)) {
      if (!(await hasFeatureConsent("counts"))) throw new DiscussionError("counts_consent_required");
      assertBrowsing();
    }
    const { id, cursor } = payload;
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const publicRead = (path) => request(path, { auth: "", accountBound: false, feature: "counts", scope });
    if (operation === "capabilities") return publicRead("/capabilities");
    if (operation === "comments")
      return withLocalReactions(
        await publicRead(
          `/videos/${payload.videoId}/comments?sort=${payload.sort || "top"}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        ),
        false,
        scope,
      );
    if (operation === "replies")
      return withLocalReactions(await publicRead(`/comments/${payload.rootId}/replies${query}`), false, scope);
    if (operation === "comment") return withLocalReactions(await publicRead(`/comments/${id}`), true, scope);
    if (operation === "react") return react(payload, generation, scope);
    if (operation !== "session" && !(await hasFeatureConsent("account")))
      throw new DiscussionError("account_consent_required");
    await refreshSession();
    assertBrowsing();
    if (queuedEpoch !== accountEpoch) throw new DiscussionError("session_changed");
    assertScope(scope);
    const expected = generation;
    const send = (path, options = {}) => request(path, { ...options, scope });
    switch (operation) {
      case "session":
        if (token && !session.authenticated) throw new DiscussionError("session_unavailable");
        return session;
      case "profile": {
        const data = safeSession(
          await send("/me/profile", { method: "PUT", body: { nickname: payload.nickname }, expected }),
        );
        session = data;
        await broadcast("session", session, expected);
        refreshSession().catch(() => {});
        return data;
      }
      case "createComment": {
        const { videoId, ...body } = payload;
        return send(`/videos/${videoId}/comments`, { method: "POST", body, expected });
      }
      case "editComment":
        return send(`/comments/${id}`, { method: "PATCH", body: { text: payload.text }, expected });
      case "deleteComment":
        return send(`/comments/${id}`, { method: "DELETE", expected });
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
      const browsingEpoch = permissionEpochs.counts;
      if (operation === "cancelScope") {
        cancelScope(scope);
        return { ok: true, data: { cancelled: true } };
      }
      const data = await execute(operation, payload, scope);
      if (operation === "session" && sender.tab) shareInbox(sender.tab.id);
      if (VIDEO_OPERATIONS.has(operation) && browsingEpoch !== permissionEpochs.counts)
        throw new DiscussionError("counts_consent_required");
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
    if (
      (area === "sync" && changes.userId?.oldValue !== changes.userId?.newValue && changes.userId) ||
      (settings.testMode &&
        area === "local" &&
        changes[settings.credentialStorageKey] &&
        changes[settings.credentialStorageKey].oldValue?.userId !==
          changes[settings.credentialStorageKey].newValue?.userId)
    )
      clearReactions(
        Boolean(changes.userId?.oldValue || changes[settings.credentialStorageKey]?.oldValue?.userId),
      ).catch(() => {});
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
    store("remove", [settings.stateStorageKey]).catch(() => {});
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
      for (const key of cancelledScopes) if (key.startsWith(`${tabId}:`)) cancelledScopes.delete(key);
    });
    api.runtime.onStartup?.addListener(() => refreshSession().catch(() => {}));
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
    async onDataPermissionsChanged({ added = [], removed = [] } = {}) {
      const features = new Set();
      if (removed.includes("browsingActivity")) features.add("counts");
      if (removed.includes("websiteActivity")) features.add("voting");
      if (removed.some((category) => ["authenticationInfo", "personallyIdentifyingInfo"].includes(category)))
        features.add("account");
      for (const feature of features) permissionEpochs[feature]++;
      for (const [controller, state] of pendingRequests)
        if ([...state.features].some((feature) => features.has(feature))) controller.abort();
      const reactionsCleared = features.has("voting") || features.has("counts") ? clearReactions() : null;
      if (features.has("account")) clearSession();
      await broadcast("permissions", { added, removed });
      await reactionsCleared;
      if (added.some((category) => ["authenticationInfo", "personallyIdentifyingInfo"].includes(category)))
        await refreshSession().catch(() => {});
    },
    initialize,
    stop() {
      clearSession();
      stopped = true;
      for (const controller of pendingRequests.keys()) controller.abort();
    },
  };
}

export { ANONYMOUS_SESSION, canReceiveLiveNotifications, createConnection, validateRequest };
