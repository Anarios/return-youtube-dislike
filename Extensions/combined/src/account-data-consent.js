import { fetchWithCoreConsent, onCoreDataPermissionChanged } from "./core-data-consent";
import {
  hasAuthenticationDataPermission,
  onAuthenticationDataPermissionRemoved,
  usesFirefoxDataCollectionConsent,
} from "./data-collection-permissions";

function accountConsentError() {
  return new Error("Authentication data consent required.");
}

function fetchWithAccountConsent(input, options = {}, fetchImpl = globalThis.fetch) {
  if (!usesFirefoxDataCollectionConsent()) return fetchWithCoreConsent(input, options, fetchImpl);

  return (async () => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const unsubscribe = onAuthenticationDataPermissionRemoved(abort);
    const unsubscribeCore = onCoreDataPermissionChanged((granted) => {
      if (!granted) abort();
    });
    const api = typeof browser !== "undefined" ? browser : globalThis.chrome;
    const messages = typeof api?.permissions?.onRemoved?.addListener === "function" ? null : api?.runtime?.onMessage;
    const onMessage = (message) => {
      if (message?.message === "patreon_status_changed" && message.authenticated === false) abort();
    };
    messages?.addListener?.(onMessage);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();

    try {
      const response = await fetchWithCoreConsent(
        input,
        { ...options, signal: controller.signal },
        async (requestInput, requestOptions) => {
          // Check after the core-consent query, immediately before sending account data.
          const granted = await hasAuthenticationDataPermission();
          if (!granted || controller.signal.aborted || requestOptions.signal.aborted) throw accountConsentError();
          return fetchImpl(requestInput, requestOptions);
        },
      );
      if (!(await hasAuthenticationDataPermission()) || controller.signal.aborted) throw accountConsentError();
      return response;
    } finally {
      unsubscribe();
      unsubscribeCore();
      messages?.removeListener?.(onMessage);
      options.signal?.removeEventListener("abort", abort);
    }
  })();
}

export { fetchWithAccountConsent };
