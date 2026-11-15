import {
  consentApi,
  coreConsentError,
  fetchWithFeatureConsent,
  usesFirefoxDataCollectionConsent,
} from "./core-data-consent";

function fetchWithAccountConsent(input, options = {}, fetchImpl = globalThis.fetch) {
  if (!usesFirefoxDataCollectionConsent()) return fetchImpl(input, options);
  return (async () => {
    const controller = new AbortController();
    const abortForCaller = () => controller.abort(options.signal.reason);
    const messages = consentApi()?.runtime?.onMessage;
    const onMessage = (message) => {
      if (message?.message === "patreon_status_changed" && message.authenticated === false)
        controller.abort(coreConsentError());
    };
    messages?.addListener?.(onMessage);
    options.signal?.addEventListener("abort", abortForCaller, { once: true });
    if (options.signal?.aborted) abortForCaller();
    try {
      return await fetchWithFeatureConsent("account", input, { ...options, signal: controller.signal }, fetchImpl);
    } finally {
      messages?.removeListener?.(onMessage);
      options.signal?.removeEventListener("abort", abortForCaller);
    }
  })();
}

export { fetchWithAccountConsent };
