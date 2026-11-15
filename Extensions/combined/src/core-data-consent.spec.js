import {
  FEATURE_DATA_PERMISSIONS,
  fetchWithCoreConsent,
  fetchWithFeatureConsent,
  hasFeaturePermission,
  onDataPermissionsChanged,
  requestFeaturePermission,
} from "./core-data-consent";

function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (value) => [...listeners].forEach((listener) => listener(value)),
    size: () => listeners.size,
  };
}
const allCategories = [...new Set(Object.values(FEATURE_DATA_PERMISSIONS).flat())];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Firefox feature data permissions", () => {
  let granted;
  let fetchImpl;
  beforeEach(() => {
    granted = ["browsingActivity"];
    global.browser = {
      runtime: {
        getManifest: () => ({
          browser_specific_settings: { gecko: { data_collection_permissions: { required: ["none"] } } },
        }),
        sendMessage: jest.fn(),
        onMessage: event(),
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...granted] })),
        request: jest.fn(async () => false),
        onAdded: event(),
        onRemoved: event(),
      },
    };
    fetchImpl = jest.fn(async () => new Response('{"dislikes":42}'));
  });
  afterEach(() => delete global.browser);

  test("the declarative feature map contains exactly the approved categories", () => {
    expect(FEATURE_DATA_PERMISSIONS).toEqual({
      counts: ["browsingActivity"],
      likeCount: ["websiteContent"],
      voting: ["browsingActivity", "websiteActivity"],
      voteOptIn: ["browsingActivity", "websiteActivity", "websiteContent"],
      account: ["authenticationInfo", "personallyIdentifyingInfo"],
    });
    expect(Object.isFrozen(FEATURE_DATA_PERMISSIONS.account)).toBe(true);
  });

  test("required count access needs no optional grant or permission query", async () => {
    browser.runtime.getManifest = () => ({
      browser_specific_settings: { gecko: { data_collection_permissions: { required: ["browsingActivity"] } } },
    });
    expect(await hasFeaturePermission("counts")).toBe(true);
    expect(await hasFeaturePermission("voting")).toBe(false);
    expect(await hasFeaturePermission("unknown")).toBe(false);
    browser.permissions.getAll.mockClear();
    await fetchWithCoreConsent("https://api.example/votes?videoId=abcdefghijk", {}, fetchImpl);
    await fetchWithCoreConsent("https://api.example/configs/selectors", {}, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test.each(["counts", "likeCount", "voting", "account", "voteOptIn"])(
    "%s requires every declared category and fails closed when unavailable",
    async (feature) => {
      granted = FEATURE_DATA_PERMISSIONS[feature].slice(1);
      expect(await hasFeaturePermission(feature)).toBe(false);
      granted = [...FEATURE_DATA_PERMISSIONS[feature]];
      expect(await hasFeaturePermission(feature)).toBe(true);
      browser.permissions.getAll.mockRejectedValueOnce(new Error("unavailable"));
      expect(await hasFeaturePermission(feature)).toBe(false);
    },
  );

  test("content scripts use the feature query and observe category relays", async () => {
    delete browser.permissions;
    browser.runtime.sendMessage.mockResolvedValue({ granted: true });
    expect(await hasFeaturePermission("account")).toBe(true);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      message: "ryd_has_feature_consent",
      feature: "account",
    });
    expect(await hasFeaturePermission("account", { queryBackground: false })).toBe(false);
    const listener = jest.fn();
    const unsubscribe = onDataPermissionsChanged(listener);
    browser.runtime.onMessage.emit({
      message: "ryd_data_permissions_changed",
      added: ["websiteContent"],
      removed: ["websiteActivity"],
    });
    expect(listener).toHaveBeenCalledWith({ added: ["websiteContent"], removed: ["websiteActivity"] });
    unsubscribe();
    expect(browser.runtime.onMessage.size()).toBe(0);
  });

  test.each(["counts", "voteOptIn", "account"])(
    "%s requests its categories directly before any asynchronous operation",
    async (feature) => {
      browser.permissions.request.mockImplementationOnce(() => {
        expect(browser.permissions.getAll).not.toHaveBeenCalled();
        granted = [...FEATURE_DATA_PERMISSIONS[feature]];
        return Promise.resolve(true);
      });
      const pending = requestFeaturePermission(feature);
      expect(browser.permissions.request).toHaveBeenCalledWith({ data_collection: FEATURE_DATA_PERMISSIONS[feature] });
      expect(await pending).toBe(true);
    },
  );

  test("like count is omitted until its own grant, independent of voting", async () => {
    const input = "https://api.example/votes?videoId=abcdefghijk&likeCount=100";
    granted = ["browsingActivity", "websiteActivity"];
    await fetchWithCoreConsent(input, {}, fetchImpl);
    expect(fetchImpl.mock.calls.at(-1)[0]).toBe("https://api.example/votes?videoId=abcdefghijk");
    granted = ["browsingActivity", "websiteContent"];
    await fetchWithCoreConsent(input, {}, fetchImpl);
    expect(fetchImpl.mock.calls.at(-1)[0]).toBe(input);
    expect(await hasFeaturePermission("voting")).toBe(false);
  });

  test.each([
    ["https://api.example/interact/vote", "POST", "voting"],
    ["https://api.example/interact/confirmVote", "POST", "voting"],
    ["https://api.example/puzzle/registration?userId=synthetic", "GET", "voting"],
    ["https://api.example/puzzle/registration?userId=synthetic", "POST", "voting"],
    ["https://api.example/api/discussion/comments/1/reaction/challenge", "POST", "voting"],
    ["https://api.example/api/discussion/comments/1/reaction/confirm", "POST", "voting"],
    ["https://api.example/api/auth/oauth/login", "GET", "account"],
    ["https://api.example/api/auth/github/exchange", "POST", "account"],
    ["https://api.example/api/auth/verify", "POST", "account"],
    ["https://api.example/api/patreon/analytics/video/abcdefghijk", "GET", "account"],
    ["https://api.example/api/discussion/me", "GET", "account"],
    ["https://api.example/api/discussion/me/profile", "PUT", "account"],
    ["https://api.example/api/discussion/notifications", "GET", "account"],
    ["https://api.example/api/discussion/notifications/read", "POST", "account"],
    ["https://api.example/api/discussion/notifications/ticket", "POST", "account"],
    ["https://api.example/api/discussion/moderation/reports", "GET", "account"],
    ["https://api.example/api/discussion/moderation/reports/1/dismiss", "POST", "account"],
    ["https://api.example/api/discussion/moderation/comments/1", "DELETE", "account"],
    ["https://api.example/api/discussion/moderation/profiles/1/suspension", "PUT", "account"],
    ["https://api.example/api/discussion/comments/1", "DELETE", "account"],
    ["https://api.example/api/discussion/videos/abcdefghijk/comments", "POST", "account"],
    ["https://api.example/api/discussion/comments/1", "PUT", "account"],
    ["https://api.example/api/discussion/comments/1/replies", "POST", "account"],
    ["https://api.example/api/discussion/comments/1/reports", "POST", "account"],
  ])("route %s (%s) enforces %s even through a count wrapper", async (input, method, feature) => {
    await expect(fetchWithFeatureConsent("counts", input, { method }, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
    granted = ["browsingActivity", ...FEATURE_DATA_PERMISSIONS[feature]];
    await fetchWithCoreConsent(input, { method }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    "/api/discussion/capabilities",
    "/api/discussion/videos/abcdefghijk/comments",
    "/api/discussion/comments/1/replies",
    "/api/discussion/comments/1",
  ])("anonymous read %s works with only browsing access", async (path) => {
    await fetchWithCoreConsent("https://api.example" + path, {}, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    if (path !== "/api/discussion/capabilities") {
      await expect(
        fetchWithCoreConsent(
          "https://api.example" + path,
          { headers: { Authorization: "Bearer synthetic" } },
          fetchImpl,
        ),
      ).rejects.toThrow("consent");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  test("revocation aborts only requests needing that category and discards late bodies", async () => {
    granted = [...allCategories];
    let completeBody;
    let signal;
    const pending = fetchWithFeatureConsent(
      "voting",
      "https://api.example/interact/vote",
      { method: "POST" },
      async (_, options) => {
        signal = options.signal;
        return {
          arrayBuffer: () =>
            new Promise((resolve) => {
              completeBody = resolve;
            }),
        };
      },
    );
    await flush();
    browser.permissions.onRemoved.emit({ data_collection: ["personallyIdentifyingInfo"] });
    expect(signal.aborted).toBe(false);
    browser.permissions.onRemoved.emit({ data_collection: ["websiteActivity"] });
    expect(signal.aborted).toBe(true);
    completeBody(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
    expect(browser.permissions.onRemoved.size()).toBe(0);
  });

  test.each([
    ["/votes?videoId=abcdefghijk&likeCount=100", "GET"],
    ["/interact/vote", "POST"],
    ["/interact/confirmVote", "POST"],
    ["/api/patreon/analytics/video/abcdefghijk", "GET"],
    ["/api/discussion/videos/abcdefghijk/comments", "GET"],
    ["/api/discussion/videos/abcdefghijk/comments", "POST"],
    ["/api/discussion/comments/1", "GET"],
    ["/api/discussion/comments/1", "PATCH"],
    ["/api/discussion/comments/1", "DELETE"],
    ["/api/discussion/comments/1/replies", "GET"],
    ["/api/discussion/comments/1/reports", "POST"],
    ["/api/discussion/comments/1/reaction/challenge", "POST"],
    ["/api/discussion/comments/1/reaction/confirm", "POST"],
  ])("video request %s (%s) requires browsing access in addition to every other grant", async (path, method) => {
    granted = allCategories.filter((category) => category !== "browsingActivity");
    await expect(fetchWithCoreConsent("https://api.example" + path, { method }, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(browser.permissions.request).not.toHaveBeenCalled();
    granted.push("browsingActivity");
    await fetchWithCoreConsent("https://api.example" + path, { method }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["/api/auth/oauth/login", "GET"],
    ["/api/auth/verify", "POST"],
    ["/api/discussion/me", "GET"],
    ["/api/discussion/me/profile", "PUT"],
    ["/api/discussion/notifications", "GET"],
    ["/api/discussion/notifications/read", "POST"],
    ["/api/discussion/notifications/ticket", "POST"],
  ])("account request %s works without browsing access", async (path, method) => {
    granted = [...FEATURE_DATA_PERMISSIONS.account];
    await fetchWithCoreConsent("https://api.example" + path, { method }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await hasFeaturePermission("counts")).toBe(false);
  });

  test("browsing removal aborts a video request permanently while an account request can complete", async () => {
    granted = [...allCategories];
    let completeVideo;
    let videoSignal;
    const pending = fetchWithFeatureConsent(
      "account",
      "https://api.example/api/patreon/analytics/video/abcdefghijk",
      {},
      async (_, options) => {
        videoSignal = options.signal;
        return {
          arrayBuffer: () => new Promise((resolve) => (completeVideo = resolve)),
        };
      },
    );
    await flush();
    granted = granted.filter((category) => category !== "browsingActivity");
    browser.permissions.onRemoved.emit({ data_collection: ["browsingActivity"] });
    expect(videoSignal.aborted).toBe(true);
    await fetchWithCoreConsent("https://api.example/api/auth/verify", { method: "POST" }, fetchImpl);
    granted.push("browsingActivity");
    browser.permissions.onAdded.emit({ data_collection: ["browsingActivity"] });
    completeVideo(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
  });

  test("voting and registration count as enabled only with counts access", async () => {
    granted = ["websiteActivity", "websiteContent"];
    expect(await hasFeaturePermission("voting")).toBe(false);
    expect(await hasFeaturePermission("voteOptIn")).toBe(false);
    await expect(
      fetchWithCoreConsent("https://api.example/puzzle/registration?userId=synthetic", {}, fetchImpl),
    ).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
    granted = [...FEATURE_DATA_PERMISSIONS.voteOptIn];
    expect(await hasFeaturePermission("voting")).toBe(true);
    expect(await hasFeaturePermission("voteOptIn")).toBe(true);
    expect(await hasFeaturePermission("counts")).toBe(true);
    await fetchWithCoreConsent("https://api.example/puzzle/registration?userId=synthetic", {}, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("checks every grant once before and once after the request", async () => {
    await fetchWithCoreConsent("https://api.example/votes?videoId=abcdefghijk", {}, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(browser.permissions.getAll).toHaveBeenCalledTimes(2);
  });

  test("the caller's own cancellation is reported as its abort, not as a consent error", async () => {
    granted = ["browsingActivity", "websiteActivity"];
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      fetchWithFeatureConsent("voting", "https://api.example/interact/vote", { signal: aborted.signal }, fetchImpl),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).not.toHaveBeenCalled();
    const inFlight = new AbortController();
    const pending = fetchWithFeatureConsent(
      "voting",
      "https://api.example/interact/vote",
      { method: "POST", signal: inFlight.signal },
      async (_, options) => ({
        arrayBuffer: () =>
          new Promise((resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(options.signal.reason));
          }),
      }),
    );
    await flush();
    inFlight.abort();
    await expect(pending).rejects.toBe(inFlight.signal.reason);
    expect(inFlight.signal.reason.name).toBe("AbortError");
    expect(browser.permissions.onRemoved.size()).toBe(0);
  });

  test("a permission change without an event blocks the result", async () => {
    granted = ["browsingActivity", "websiteActivity"];
    await expect(
      fetchWithFeatureConsent("voting", "https://api.example/interact/vote", {}, async () => {
        granted = [];
        return new Response("{}");
      }),
    ).rejects.toThrow("consent");
  });

  test("private display sends only videoId and strips headers, credentials and caching", async () => {
    granted = [...allCategories];
    browser.extension = { inIncognitoContext: true };
    await fetchWithCoreConsent(
      "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&likeCount=100",
      { credentials: "include", headers: { Authorization: "Bearer synthetic" }, cache: "force-cache" },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
      }),
    );
    expect(await hasFeaturePermission("voting")).toBe(false);
    expect(await requestFeaturePermission("voteOptIn")).toBe(false);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test.each([
    ["https://returnyoutubedislikeapi.com/interact/vote", {}],
    ["https://returnyoutubedislikeapi.com/api/discussion/capabilities", {}],
    ["https://returnyoutubedislikeapi.com/votes", { method: "POST" }],
    ["https://returnyoutubedislikeapi.com/votes?userId=synthetic", {}],
    ["https://returnyoutubedislikeapi.com/configs/selectors?videoId=abcdefghijk", {}],
    ["https://api.example/votes", {}],
  ])("private context rejects non-display request %s", async (input, options) => {
    browser.extension = { inIncognitoContext: true };
    await expect(fetchWithCoreConsent(input, options, fetchImpl)).rejects.toThrow("count display");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("other browsers preserve normal requests and do not query Firefox permissions", async () => {
    browser.runtime.getManifest = () => ({ manifest_version: 3 });
    const response = {};
    fetchImpl.mockReturnValue(response);
    expect(fetchWithCoreConsent("https://api.example/votes?likeCount=100", {}, fetchImpl)).toBe(response);
    expect(await hasFeaturePermission("account")).toBe(true);
    expect(await hasFeaturePermission("voting")).toBe(true);
    expect(await requestFeaturePermission("voteOptIn")).toBe(true);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });
});
