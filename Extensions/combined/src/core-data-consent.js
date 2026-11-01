import { getApiUrl } from "./config";
import { isPrivateBrowsingContext } from "./private-browsing";

const FEATURE_DATA_PERMISSIONS = Object.freeze({
  counts: Object.freeze(["browsingActivity"]),
  likeCount: Object.freeze(["websiteContent"]),
  voting: Object.freeze(["browsingActivity", "websiteActivity"]),
  voteOptIn: Object.freeze(["browsingActivity", "websiteActivity", "websiteContent"]),
  account: Object.freeze(["authenticationInfo", "personallyIdentifyingInfo"]),
});

function consentApi() {
  return typeof browser !== "undefined" ? browser : globalThis.chrome;
}

function usesFirefoxDataCollectionConsent() {
  return Boolean(consentApi()?.runtime?.getManifest?.()?.browser_specific_settings?.gecko?.data_collection_permissions);
}

function coreConsentError() {
  return new Error("Data consent required for this feature.");
}

async function hasFeaturePermission(feature, { queryBackground = true } = {}) {
  const required = FEATURE_DATA_PERMISSIONS[feature];
  if (!required) return false;
  if (isPrivateBrowsingContext() && feature !== "counts") return false;
  if (!usesFirefoxDataCollectionConsent()) return true;
  const api = consentApi();
  try {
    const requiredByManifest =
      api.runtime.getManifest().browser_specific_settings.gecko.data_collection_permissions.required;
    if (required.every((category) => requiredByManifest?.includes(category))) return true;
    if (api?.permissions) {
      if (typeof api.permissions.getAll !== "function") return false;
      const granted = (await api.permissions.getAll())?.data_collection;
      return Array.isArray(granted) && required.every((category) => granted.includes(category));
    }
    if (queryBackground) {
      return (await api.runtime.sendMessage({ message: "ryd_has_feature_consent", feature }))?.granted === true;
    }
  } catch (_) {}
  return false;
}

function requestFeaturePermission(feature) {
  const required = FEATURE_DATA_PERMISSIONS[feature];
  if (!required || isPrivateBrowsingContext()) return Promise.resolve(false);
  if (!usesFirefoxDataCollectionConsent()) return Promise.resolve(true);
  try {
    const pending = consentApi().permissions.request({ data_collection: required });
    return Promise.resolve(pending).then(
      (granted) => granted === true && hasFeaturePermission(feature, { queryBackground: false }),
      () => false,
    );
  } catch (_) {
    return Promise.resolve(false);
  }
}

function onDataPermissionsChanged(listener) {
  if (!usesFirefoxDataCollectionConsent()) return () => {};
  const api = consentApi();
  const known = new Set(Object.values(FEATURE_DATA_PERMISSIONS).flat());
  const categories = (value) =>
    Array.isArray(value?.data_collection) ? value.data_collection.filter((category) => known.has(category)) : [];
  const added = (value) => {
    const values = categories(value);
    if (values.length) listener({ added: values, removed: [] });
  };
  const removed = (value) => {
    const values = categories(value);
    if (values.length) listener({ added: [], removed: values });
  };
  const message = (value) => {
    if (value?.message !== "ryd_data_permissions_changed") return;
    const values = {
      added: categories({ data_collection: value.added }),
      removed: categories({ data_collection: value.removed }),
    };
    if (values.added.length || values.removed.length) listener(values);
  };
  if (typeof api?.permissions?.onRemoved?.addListener === "function") {
    api.permissions.onAdded?.addListener?.(added);
    api.permissions.onRemoved.addListener(removed);
    return () => {
      api.permissions.onAdded?.removeListener?.(added);
      api.permissions.onRemoved.removeListener?.(removed);
    };
  }
  api?.runtime?.onMessage?.addListener(message);
  return () => api?.runtime?.onMessage?.removeListener(message);
}

function requestFeature(input, options = {}) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = (options.method ?? input?.method ?? "GET").toUpperCase();
  const path = url.pathname;
  if (/\/(?:interact\/(?:vote|confirmVote)|puzzle\/registration)(?:\/|$)/i.test(path)) return "voting";
  if (/\/comments\/[^/]+\/reaction\/(?:challenge|confirm)$/.test(path)) return "voting";
  if (/\/api\/auth\//.test(path) || /\/api\/patreon\/analytics\//.test(path)) return "account";
  if (/\/api\/discussion\//.test(path)) {
    const resource = path.replace(/^.*\/api\/discussion/, "");
    if (method === "GET" && resource === "/capabilities") return "counts";
    if (
      method === "GET" &&
      (/^\/videos\/[^/]+\/comments$/.test(resource) || /^\/comments\/[^/]+(?:\/replies)?$/.test(resource))
    ) {
      const headers = new Headers(options.headers ?? input?.headers);
      return headers.has("Authorization") ? "account" : "counts";
    }
    return "account";
  }
  if (method === "GET" && ["/votes", "/configs/selectors"].includes(path)) return "counts";
  return null;
}

function requestNeedsBrowsingActivity(input) {
  const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname;
  return (
    /\/interact\/(?:vote|confirmVote)(?:\/|$)/i.test(path) ||
    /\/api\/patreon\/analytics\/video\/[^/]+(?:\/|$)/.test(path) ||
    /\/api\/discussion\/(?:videos\/[^/]+\/comments(?:\/|$)|comments\/[^/]+(?:\/|$))/.test(path)
  );
}

function privateCountRequest(input, options) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = options.method ?? input?.method ?? "GET";
  if (url.pathname === "/votes") url.searchParams.delete("likeCount");
  let allowedQuery = true;
  url.searchParams.forEach((value, key) => {
    if (url.pathname !== "/votes" || key !== "videoId") allowedQuery = false;
  });
  if (
    url.origin !== new URL(getApiUrl()).origin ||
    !["/votes", "/configs/selectors"].includes(url.pathname) ||
    method.toUpperCase() !== "GET" ||
    url.username ||
    url.password ||
    !allowedQuery ||
    options.body != null ||
    input?.body != null
  )
    throw new Error("Only count display is available in private windows.");
  return [
    url.href,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: options.signal,
    },
  ];
}

function fetchWithFeatureConsent(feature, input, options = {}, fetchImpl = globalThis.fetch) {
  if (!usesFirefoxDataCollectionConsent()) return fetchImpl(input, options);
  return (async () => {
    if (!FEATURE_DATA_PERMISSIONS[feature]) throw coreConsentError();
    options.signal?.throwIfAborted();
    if (isPrivateBrowsingContext()) {
      if (feature !== "counts") throw new Error("Only count display is available in private windows.");
      [input, options] = privateCountRequest(input, options);
    }
    const inferred = requestFeature(input, options);
    const features = new Set([feature, ...(inferred ? [inferred] : [])]);
    if (requestNeedsBrowsingActivity(input)) features.add("counts");
    if (new Headers(options.headers ?? input?.headers).has("Authorization")) features.add("account");
    const controller = new AbortController();
    const abortForCaller = () => controller.abort(options.signal.reason);
    let required = [...features].flatMap((value) => FEATURE_DATA_PERMISSIONS[value]);
    const unsubscribe = onDataPermissionsChanged(({ removed }) => {
      if (removed.some((category) => required.includes(category))) controller.abort(coreConsentError());
    });
    options.signal?.addEventListener("abort", abortForCaller, { once: true });
    const assertPermitted = async () => {
      for (const value of features) if (!(await hasFeaturePermission(value))) throw coreConsentError();
      controller.signal.throwIfAborted();
    };
    try {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.pathname === "/votes" && url.searchParams.has("likeCount")) {
        if (await hasFeaturePermission("likeCount")) {
          features.add("likeCount");
          required = [...features].flatMap((value) => FEATURE_DATA_PERMISSIONS[value]);
        } else {
          url.searchParams.delete("likeCount");
          input = url.href;
        }
      }
      await assertPermitted();
      const response = await fetchImpl(input, { ...options, signal: controller.signal });
      const payload = await response.arrayBuffer();
      await assertPermitted();
      return new Response([204, 205, 304].includes(response.status) ? null : payload, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      unsubscribe();
      options.signal?.removeEventListener("abort", abortForCaller);
    }
  })();
}

function fetchWithCoreConsent(input, options = {}, fetchImpl = globalThis.fetch) {
  if (!usesFirefoxDataCollectionConsent()) return fetchImpl(input, options);
  if (isPrivateBrowsingContext()) return fetchWithFeatureConsent("counts", input, options, fetchImpl);
  const feature = requestFeature(input, options);
  if (!feature) return Promise.reject(coreConsentError());
  return fetchWithFeatureConsent(feature, input, options, fetchImpl);
}

export {
  FEATURE_DATA_PERMISSIONS,
  consentApi,
  coreConsentError,
  fetchWithCoreConsent,
  fetchWithFeatureConsent,
  hasFeaturePermission,
  onDataPermissionsChanged,
  requestFeaturePermission,
  usesFirefoxDataCollectionConsent,
};
