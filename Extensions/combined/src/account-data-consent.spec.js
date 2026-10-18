import { fetchWithAccountConsent } from "./account-data-consent";
import { CORE_DATA_PERMISSIONS } from "./core-data-consent";

const URL = "https://api.example/account";
const OPTIONS = { headers: { Authorization: "Bearer synthetic-token" } };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

function event() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (value) => [...listeners].forEach((listener) => listener(value)),
    size: () => listeners.size,
  };
}

describe("account request consent boundary", () => {
  let granted;
  let fetchImpl;

  beforeEach(() => {
    granted = [...CORE_DATA_PERMISSIONS, "authenticationInfo"];
    global.browser = {
      runtime: {
        getManifest: () => ({ browser_specific_settings: { gecko: { data_collection_permissions: {} } } }),
        onMessage: event(),
        sendMessage: jest.fn(),
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...granted] })),
        request: jest.fn(),
        onAdded: event(),
        onRemoved: event(),
      },
    };
    fetchImpl = jest.fn(async () => new Response('{"valid":true}'));
  });

  afterEach(() => {
    expect(browser.runtime.onMessage.size()).toBe(0);
    if (browser.permissions) {
      expect(browser.permissions.onAdded.size()).toBe(0);
      expect(browser.permissions.onRemoved.size()).toBe(0);
    }
    delete global.browser;
  });

  function revokeAuthentication() {
    granted = [...CORE_DATA_PERMISSIONS];
    browser.permissions.onRemoved.emit({ data_collection: ["authenticationInfo"] });
  }

  test("granted account requests return their response without requesting permissions", async () => {
    const response = await fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    expect(await response.json()).toEqual({ valid: true });
    expect(fetchImpl).toHaveBeenCalledWith(URL, expect.objectContaining(OPTIONS));
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test.each(["missing", "unavailable"])("%s authentication consent blocks account traffic", async (state) => {
    granted = [...CORE_DATA_PERMISSIONS];
    if (state === "unavailable") {
      browser.permissions.getAll
        .mockResolvedValueOnce({ data_collection: [...CORE_DATA_PERMISSIONS] })
        .mockRejectedValueOnce(new Error("Unavailable"));
    }
    await expect(fetchWithAccountConsent(URL, OPTIONS, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("rechecks authentication after a delayed core query even without a removal event", async () => {
    const coreCheck = deferred();
    browser.permissions.getAll.mockReturnValueOnce(coreCheck.promise);
    const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    granted = [...CORE_DATA_PERMISSIONS];
    coreCheck.resolve({ data_collection: [...CORE_DATA_PERMISSIONS, "authenticationInfo"] });
    await expect(pending).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([false, true])("revocation during a core query blocks traffic after regrant=%s", async (regrant) => {
    const coreCheck = deferred();
    browser.permissions.getAll.mockReturnValueOnce(coreCheck.promise);
    const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    revokeAuthentication();
    if (regrant) granted.push("authenticationInfo");
    coreCheck.resolve({ data_collection: [...granted] });
    await expect(pending).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each(["authenticationInfo", CORE_DATA_PERMISSIONS[0]])(
    "revoking %s during the final account query blocks a stale granting result",
    async (permission) => {
      const accountCheck = deferred();
      browser.permissions.getAll
        .mockResolvedValueOnce({ data_collection: [...granted] })
        .mockReturnValueOnce(accountCheck.promise);
      const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
      await flush();
      browser.permissions.onRemoved.emit({ data_collection: [permission] });
      accountCheck.resolve({ data_collection: [...granted] });
      await expect(pending).rejects.toThrow("consent");
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  test("revocation aborts in-flight work and discards a body that finishes after regrant", async () => {
    const body = deferred();
    let signal;
    fetchImpl.mockImplementationOnce(async (_, options) => {
      signal = options.signal;
      return { arrayBuffer: () => body.promise };
    });
    const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    await flush();
    revokeAuthentication();
    granted.push("authenticationInfo");
    expect(signal.aborted).toBe(true);
    body.resolve(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
  });

  test("a final permission check discards a completed response if removal events are unavailable", async () => {
    fetchImpl.mockImplementationOnce(async () => {
      granted = [...CORE_DATA_PERMISSIONS];
      return new Response('{"valid":true}');
    });
    await expect(fetchWithAccountConsent(URL, OPTIONS, fetchImpl)).rejects.toThrow("consent");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("content requests observe account revocation while their background permission query is pending", async () => {
    delete browser.permissions;
    const accountCheck = deferred();
    browser.runtime.sendMessage.mockImplementation(({ message }) =>
      message === "ryd_has_core_consent" ? Promise.resolve({ granted: true }) : accountCheck.promise,
    );
    const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    await flush();
    browser.runtime.onMessage.emit({ message: "patreon_status_changed", authenticated: false });
    accountCheck.resolve({ granted: true });
    await expect(pending).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("content revocation aborts a pending body and rejects its result", async () => {
    delete browser.permissions;
    browser.runtime.sendMessage.mockResolvedValue({ granted: true });
    const body = deferred();
    let signal;
    fetchImpl.mockImplementationOnce(async (_, options) => {
      signal = options.signal;
      return { arrayBuffer: () => body.promise };
    });
    const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    await flush();
    browser.runtime.onMessage.emit({ message: "patreon_status_changed", authenticated: false });
    expect(signal.aborted).toBe(true);
    body.resolve(new ArrayBuffer(0));
    await expect(pending).rejects.toThrow("consent");
  });

  test.each(["native", "content"])(
    "core revocation during the final %s account query discards a buffered response",
    async (context) => {
      const accountCheck = deferred();
      if (context === "native") {
        browser.permissions.getAll
          .mockResolvedValueOnce({ data_collection: [...granted] })
          .mockResolvedValueOnce({ data_collection: [...granted] })
          .mockResolvedValueOnce({ data_collection: [...granted] })
          .mockReturnValueOnce(accountCheck.promise);
      } else {
        delete browser.permissions;
        let accountQueries = 0;
        browser.runtime.sendMessage.mockImplementation(({ message }) => {
          if (message === "ryd_has_core_consent" || ++accountQueries === 1) return Promise.resolve({ granted: true });
          return accountCheck.promise;
        });
      }
      const pending = fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
      await flush();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      if (context === "native") {
        browser.permissions.onRemoved.emit({ data_collection: [CORE_DATA_PERMISSIONS[0]] });
        accountCheck.resolve({ data_collection: [...granted] });
      } else {
        browser.runtime.onMessage.emit({ message: "ryd_core_consent_changed", granted: false });
        accountCheck.resolve({ granted: true });
      }
      await expect(pending).rejects.toThrow("consent");
    },
  );

  test("caller cancellation prevents a pending account request from starting", async () => {
    const accountCheck = deferred();
    browser.permissions.getAll
      .mockResolvedValueOnce({ data_collection: [...granted] })
      .mockReturnValueOnce(accountCheck.promise);
    const controller = new AbortController();
    const pending = fetchWithAccountConsent(URL, { ...OPTIONS, signal: controller.signal }, fetchImpl);
    await flush();
    controller.abort();
    accountCheck.resolve({ data_collection: [...granted] });
    await expect(pending).rejects.toThrow("consent");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("other browsers keep their ordinary request behavior", async () => {
    browser.runtime.getManifest = () => ({});
    await fetchWithAccountConsent(URL, OPTIONS, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(URL, OPTIONS);
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
  });
});
