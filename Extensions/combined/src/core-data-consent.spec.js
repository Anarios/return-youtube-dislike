import {
  CORE_DATA_PERMISSIONS,
  fetchWithCoreConsent,
  hasCoreDataPermission,
  onCoreDataPermissionChanged,
  requestCoreDataPermission,
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

describe("optional Firefox core data consent", () => {
  let granted;
  beforeEach(() => {
    granted = [];
    global.browser = {
      runtime: {
        getManifest: () => ({ browser_specific_settings: { gecko: { data_collection_permissions: {} } } }),
        sendMessage: jest.fn(),
        onMessage: event(),
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: granted })),
        contains: jest.fn(async () => true),
        request: jest.fn(async () => false),
        onAdded: event(),
        onRemoved: event(),
      },
    };
  });
  afterEach(() => {
    delete global.browser;
  });

  test("fails closed for absent, partial, or unavailable grants even if contains reports true", async () => {
    expect(await hasCoreDataPermission()).toBe(false);
    granted = CORE_DATA_PERMISSIONS.slice(1);
    expect(await hasCoreDataPermission()).toBe(false);
    browser.permissions.getAll.mockResolvedValueOnce({});
    expect(await hasCoreDataPermission()).toBe(false);
    browser.permissions.getAll.mockRejectedValueOnce(new Error("Unavailable"));
    expect(await hasCoreDataPermission()).toBe(false);
    expect(browser.permissions.contains).not.toHaveBeenCalled();
    granted = [...CORE_DATA_PERMISSIONS];
    expect(await hasCoreDataPermission()).toBe(true);
  });

  test("content scripts obtain grants through the background", async () => {
    delete browser.permissions;
    browser.runtime.sendMessage.mockResolvedValueOnce({ granted: true }).mockResolvedValueOnce({});
    expect(await hasCoreDataPermission()).toBe(true);
    expect(await hasCoreDataPermission()).toBe(false);
    expect(await hasCoreDataPermission({ queryBackground: false })).toBe(false);
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  test("requests all four core categories immediately in the caller's gesture", async () => {
    const request = requestCoreDataPermission();
    expect(browser.permissions.request).toHaveBeenCalledWith({ data_collection: CORE_DATA_PERMISSIONS });
    expect(await request).toBe(false);
    browser.permissions.request.mockResolvedValueOnce(true);
    expect(await requestCoreDataPermission()).toBe(true);
  });

  test("denied reads and writes never invoke fetch", async () => {
    const fetchImpl = jest.fn();
    await expect(fetchWithCoreConsent("https://api.example/votes", {}, fetchImpl)).rejects.toThrow("consent");
    await expect(fetchWithCoreConsent("https://api.example/send", { method: "POST" }, fetchImpl)).rejects.toThrow(
      "consent",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(browser.permissions.onRemoved.size()).toBe(0);
  });

  test("allowed counts load without requesting more permissions", async () => {
    granted = [...CORE_DATA_PERMISSIONS];
    const response = await fetchWithCoreConsent(
      "https://api.example/votes",
      {},
      async () => new Response(JSON.stringify({ dislikes: 42 }), { headers: { "Content-Type": "application/json" } }),
    );
    expect(await response.json()).toEqual({ dislikes: 42 });
    expect(browser.permissions.request).not.toHaveBeenCalled();
    expect(browser.permissions.onRemoved.size()).toBe(0);
  });

  test("revocation aborts requests and discards bodies that finish late", async () => {
    granted = [...CORE_DATA_PERMISSIONS];
    let completeBody;
    let signal;
    const pending = fetchWithCoreConsent("https://api.example/votes", {}, async (_, options) => {
      signal = options.signal;
      return {
        arrayBuffer: () =>
          new Promise((resolve) => {
            completeBody = resolve;
          }),
      };
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    granted = [];
    browser.permissions.onRemoved.emit({ data_collection: [CORE_DATA_PERMISSIONS[0]] });
    expect(signal.aborted).toBe(true);
    completeBody(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
    expect(browser.permissions.onRemoved.size()).toBe(0);
  });

  test("handles empty HTTP responses and caller cancellation", async () => {
    granted = [...CORE_DATA_PERMISSIONS];
    const fetchImpl = jest.fn(async () => new Response(null, { status: 204 }));
    expect((await fetchWithCoreConsent("https://api.example/send", {}, fetchImpl)).status).toBe(204);
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchWithCoreConsent("https://api.example/votes", { signal: controller.signal }, fetchImpl),
    ).rejects.toThrow("consent");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("revocation messages reach content listeners and can be unsubscribed", () => {
    delete browser.permissions;
    const listener = jest.fn();
    const unsubscribe = onCoreDataPermissionChanged(listener);
    browser.runtime.onMessage.emit({ message: "ryd_core_consent_changed", granted: false });
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
    expect(browser.runtime.onMessage.size()).toBe(0);
  });

  test("private counts strip credentials and headers and disable caching and redirects", async () => {
    granted = [...CORE_DATA_PERMISSIONS];
    browser.extension = { inIncognitoContext: true };
    const fetchImpl = jest.fn(async () => new Response('{"dislikes":42}'));
    for (const path of ["/votes?videoId=abcdefghijk&likeCount=100", "/configs/selectors"]) {
      const result = await fetchWithCoreConsent(
        `https://returnyoutubedislikeapi.com${path}`,
        { credentials: "include", cache: "force-cache", headers: { Authorization: "synthetic-account-token" } },
        fetchImpl,
      );
      expect(await result.json()).toEqual({ dislikes: 42 });
      expect(fetchImpl.mock.calls.at(-1)[1]).toEqual(
        expect.objectContaining({
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          headers: { Accept: "application/json" },
        }),
      );
    }
    expect(await requestCoreDataPermission()).toBe(false);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test("private count checks work when Firefox blocks URLSearchParams iterators", async () => {
    granted = [...CORE_DATA_PERMISSIONS];
    browser.extension = { inIncognitoContext: true };
    const keys = jest.spyOn(URLSearchParams.prototype, "keys").mockReturnValue({
      [Symbol.iterator]() {
        throw new TypeError("Iterator access denied");
      },
    });
    try {
      const fetchImpl = jest.fn(async () => new Response('{"dislikes":42}'));
      const response = await fetchWithCoreConsent(
        "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&likeCount=100",
        {},
        fetchImpl,
      );
      expect(await response.json()).toEqual({ dislikes: 42 });
      await expect(
        fetchWithCoreConsent(
          "https://returnyoutubedislikeapi.com/votes?videoId=abcdefghijk&sessionToken=synthetic",
          {},
          fetchImpl,
        ),
      ).rejects.toThrow("count display");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      keys.mockRestore();
    }
  });

  test.each([
    ["https://returnyoutubedislikeapi.com/send", {}],
    ["https://returnyoutubedislikeapi.com/votes", { method: "POST" }],
    ["https://returnyoutubedislikeapi.com/votes?sessionToken=synthetic", {}],
    ["https://returnyoutubedislikeapi.com/configs/selectors?videoId=abcdefghijk", {}],
    ["https://api.example/votes", {}],
  ])("private requests reject non-display operations: %s", async (url, options) => {
    granted = [...CORE_DATA_PERMISSIONS];
    browser.extension = { inIncognitoContext: true };
    const fetchImpl = jest.fn();
    await expect(fetchWithCoreConsent(url, options, fetchImpl)).rejects.toThrow("count display");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("other browsers keep their normal fetch and do not request Firefox permissions", async () => {
    browser.runtime.getManifest = () => ({ manifest_version: 3 });
    const response = {};
    const fetchImpl = jest.fn(() => response);
    expect(fetchWithCoreConsent("https://api.example/votes", {}, fetchImpl)).toBe(response);
    expect(await hasCoreDataPermission()).toBe(true);
    expect(await requestCoreDataPermission()).toBe(true);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });
});
