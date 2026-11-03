import { fetchWithAccountConsent } from "./account-data-consent";
import { FEATURE_DATA_PERMISSIONS } from "./core-data-consent";

const url = "https://api.example/api/discussion/me";
const options = { headers: { Authorization: "Bearer synthetic" } };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (value) => [...listeners].forEach((listener) => listener(value)),
    size: () => listeners.size,
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

describe("account feature request boundary", () => {
  let granted;
  let fetchImpl;
  beforeEach(() => {
    granted = [...FEATURE_DATA_PERMISSIONS.account];
    global.browser = {
      runtime: {
        getManifest: () => ({ browser_specific_settings: { gecko: { data_collection_permissions: {} } } }),
        onMessage: event(),
        sendMessage: jest.fn(),
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...granted] })),
        onAdded: event(),
        onRemoved: event(),
      },
    };
    fetchImpl = jest.fn(async () => new Response('{"valid":true}'));
  });
  afterEach(() => {
    expect(browser.runtime.onMessage.size()).toBe(0);
    expect(browser.permissions?.onRemoved.size() ?? 0).toBe(0);
    delete global.browser;
  });

  test("account calls require both account categories, without unrelated vote or content access", async () => {
    expect(await (await fetchWithAccountConsent(url, options, fetchImpl)).json()).toEqual({ valid: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each(FEATURE_DATA_PERMISSIONS.account)("missing %s blocks the account request", async (category) => {
    granted = granted.filter((value) => value !== category);
    await expect(fetchWithAccountConsent(url, options, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("posting through the account wrapper needs browsing access next to the account grant", async () => {
    const postingUrl = "https://api.example/api/discussion/comments/1";
    const postingOptions = { ...options, method: "PUT", body: '{"body":"draft"}' };
    await expect(fetchWithAccountConsent(postingUrl, postingOptions, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
    granted.push("browsingActivity");
    await fetchWithAccountConsent(postingUrl, postingOptions, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test.each(["authenticationInfo", "personallyIdentifyingInfo"])(
    "revoking %s aborts an in-flight account response even after a regrant",
    async (category) => {
      const body = deferred();
      let signal;
      fetchImpl.mockImplementationOnce(async (_, requestOptions) => {
        signal = requestOptions.signal;
        return { arrayBuffer: () => body.promise };
      });
      const pending = fetchWithAccountConsent(url, options, fetchImpl);
      await flush();
      browser.permissions.onRemoved.emit({ data_collection: [category] });
      expect(signal.aborted).toBe(true);
      body.resolve(new ArrayBuffer(0));
      await expect(pending).rejects.toThrow("consent");
    },
  );

  test("revoking a voting category does not interrupt account calls", async () => {
    fetchImpl.mockImplementationOnce(async (_, requestOptions) => {
      browser.permissions.onRemoved.emit({ data_collection: ["websiteActivity", "websiteContent"] });
      expect(requestOptions.signal.aborted).toBe(false);
      return new Response("{}");
    });
    await expect(fetchWithAccountConsent(url, options, fetchImpl)).resolves.toBeInstanceOf(Response);
  });

  test("permission checks fail closed when a delayed grant is revoked", async () => {
    const check = deferred();
    browser.permissions.getAll.mockReturnValueOnce(check.promise);
    const pending = fetchWithAccountConsent(url, options, fetchImpl);
    browser.permissions.onRemoved.emit({ data_collection: ["authenticationInfo"] });
    check.resolve({ data_collection: granted });
    await expect(pending).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("a grant revoked without an event after the pre-send check discards the response", async () => {
    browser.permissions.getAll.mockImplementationOnce(async () => {
      const result = { data_collection: [...granted] };
      granted = [];
      return result;
    });
    await expect(fetchWithAccountConsent(url, options, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(browser.permissions.getAll).toHaveBeenCalledTimes(2);
  });

  test.each(["logout", "category"])("content relay aborts a pending body on %s", async (kind) => {
    delete browser.permissions;
    browser.runtime.sendMessage.mockResolvedValue({ granted: true });
    const body = deferred();
    let signal;
    fetchImpl.mockImplementationOnce(async (_, requestOptions) => {
      signal = requestOptions.signal;
      return { arrayBuffer: () => body.promise };
    });
    const pending = fetchWithAccountConsent(url, options, fetchImpl);
    await flush();
    browser.runtime.onMessage.emit(
      kind === "logout"
        ? { message: "patreon_status_changed", authenticated: false }
        : { message: "ryd_data_permissions_changed", added: [], removed: ["personallyIdentifyingInfo"] },
    );
    expect(signal.aborted).toBe(true);
    body.resolve(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
  });

  test("private windows and caller cancellation prevent sending", async () => {
    browser.extension = { inIncognitoContext: true };
    await expect(fetchWithAccountConsent(url, options, fetchImpl)).rejects.toThrow("count display");
    delete browser.extension;
    const controller = new AbortController();
    const cancelled = new DOMException("Caller cancelled", "AbortError");
    controller.abort(cancelled);
    await expect(fetchWithAccountConsent(url, { ...options, signal: controller.signal }, fetchImpl)).rejects.toBe(
      cancelled,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("a caller cancellation during the request is reported as that cancellation", async () => {
    const controller = new AbortController();
    const cancelled = new DOMException("Caller cancelled", "AbortError");
    let signal;
    fetchImpl.mockImplementationOnce(async (_, requestOptions) => {
      signal = requestOptions.signal;
      controller.abort(cancelled);
      return new Response("{}");
    });
    await expect(fetchWithAccountConsent(url, { ...options, signal: controller.signal }, fetchImpl)).rejects.toBe(
      cancelled,
    );
    expect(signal.aborted).toBe(true);
  });

  test("other browsers retain their ordinary requests", async () => {
    browser.runtime.getManifest = () => ({});
    await fetchWithAccountConsent(url, options, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(url, options);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
  });
});
