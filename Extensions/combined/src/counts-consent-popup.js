import {
  consentApi,
  hasFeaturePermission,
  onDataPermissionsChanged,
  requestFeaturePermission,
  usesFirefoxDataCollectionConsent,
} from "./core-data-consent";
import { isPrivateBrowsingContext } from "./private-browsing";

function initCountsConsentPopup({ beforeShow = () => {} } = {}) {
  if (!usesFirefoxDataCollectionConsent() || isPrivateBrowsingContext()) return;
  const section = document.getElementById("ryd-counts-consent");
  if (!section) return;
  const allow = document.getElementById("ryd-counts-consent-allow");
  const dismiss = document.getElementById("ryd-counts-consent-dismiss");
  const status = document.getElementById("ryd-counts-consent-status");
  const message = (key) => consentApi().i18n.getMessage(key);
  let revision = 0;
  let dismissed = false;
  let pending = false;

  function show(visible) {
    if (visible) beforeShow();
    section.hidden = !visible;
    document.body.classList.toggle("ryd-counts-consent-open", visible);
  }

  async function refresh() {
    const current = ++revision;
    const granted = await hasFeaturePermission("counts");
    if (current !== revision || pending || dismissed) return;
    show(!granted);
  }

  allow.addEventListener("click", () => {
    if (pending) return;
    pending = true;
    revision++;
    const request = requestFeaturePermission("counts");
    allow.disabled = true;
    dismiss.disabled = true;
    status.textContent = message("consent_prompt_status");
    void (async () => {
      try {
        const granted = await request;
        status.textContent = message(granted ? "counts_consent_enabled" : "counts_consent_declined");
      } catch (_) {
        status.textContent = message("consent_error_status");
      } finally {
        pending = false;
        allow.disabled = false;
        dismiss.disabled = false;
        await refresh();
      }
    })();
  });
  dismiss.addEventListener("click", () => {
    dismissed = true;
    revision++;
    show(false);
  });
  const unsubscribe = onDataPermissionsChanged(({ added, removed }) => {
    if (![...added, ...removed].includes("browsingActivity")) return;
    if (removed.includes("browsingActivity")) dismissed = false;
    void refresh();
  });
  window.addEventListener("unload", unsubscribe, { once: true });
  void refresh();
}

export { initCountsConsentPopup };
