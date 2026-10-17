import { usesFirefoxDataCollectionConsent } from "./data-collection-permissions";

const CORE_DATA_PERMISSIONS = Object.freeze([
  "personallyIdentifyingInfo",
  "browsingActivity",
  "websiteContent",
  "websiteActivity",
]);
const CORE_DATA_DESCRIPTOR = Object.freeze({ data_collection: CORE_DATA_PERMISSIONS });

function consentApi() {
  return typeof browser !== "undefined" ? browser : globalThis.chrome;
}

function coreConsentError() {
  return new Error("Data consent required to use Return YouTube Dislike.");
}

async function hasCoreDataPermission({ queryBackground = true } = {}) {
  if (!usesFirefoxDataCollectionConsent()) return true;
  const api = consentApi();
  try {
    if (typeof api?.permissions?.getAll === "function") {
      const granted = (await api.permissions.getAll())?.data_collection;
      return Array.isArray(granted) && CORE_DATA_PERMISSIONS.every((permission) => granted.includes(permission));
    }
    if (queryBackground) {
      return (await api.runtime.sendMessage({ message: "ryd_has_core_consent" }))?.granted === true;
    }
  } catch (_) {}
  return false;
}

function requestCoreDataPermission() {
  if (!usesFirefoxDataCollectionConsent()) return Promise.resolve(true);
  try {
    // Request directly in the explainer's click handler to preserve Firefox's user gesture.
    return Promise.resolve(consentApi().permissions.request(CORE_DATA_DESCRIPTOR)).then(Boolean, () => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

function onCoreDataPermissionChanged(listener) {
  if (!usesFirefoxDataCollectionConsent()) return () => {};
  const api = consentApi();
  const relevant = (value) => CORE_DATA_PERMISSIONS.some((permission) => value?.data_collection?.includes(permission));
  const added = (value) => {
    if (relevant(value)) void hasCoreDataPermission().then(listener);
  };
  const removed = (value) => {
    if (relevant(value)) listener(false);
  };
  const message = (value) => {
    if (value?.message === "ryd_core_consent_changed") {
      if (value.granted === false) listener(false);
      else void hasCoreDataPermission().then(listener);
    }
  };
  if (api?.permissions?.onAdded && api?.permissions?.onRemoved) {
    api.permissions.onAdded.addListener(added);
    api.permissions.onRemoved.addListener(removed);
    return () => {
      api.permissions.onAdded.removeListener(added);
      api.permissions.onRemoved.removeListener(removed);
    };
  }
  api?.runtime?.onMessage?.addListener(message);
  return () => api?.runtime?.onMessage?.removeListener(message);
}

function fetchWithCoreConsent(input, options = {}, fetchImpl = globalThis.fetch) {
  if (!usesFirefoxDataCollectionConsent()) return fetchImpl(input, options);
  return (async () => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const unsubscribe = onCoreDataPermissionChanged((granted) => {
      if (!granted) abort();
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      if (!(await hasCoreDataPermission()) || controller.signal.aborted || options.signal?.aborted) {
        throw coreConsentError();
      }
      const response = await fetchImpl(input, { ...options, signal: controller.signal });
      // Include body consumption in the guarded operation, so revoked responses cannot reach consumers.
      const payload = await response.arrayBuffer();
      if (controller.signal.aborted || !(await hasCoreDataPermission())) throw coreConsentError();
      return new Response([204, 205, 304].includes(response.status) ? null : payload, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      unsubscribe();
      options.signal?.removeEventListener("abort", abort);
    }
  })();
}

export {
  CORE_DATA_PERMISSIONS,
  consentApi,
  coreConsentError,
  fetchWithCoreConsent,
  hasCoreDataPermission,
  onCoreDataPermissionChanged,
  requestCoreDataPermission,
};
