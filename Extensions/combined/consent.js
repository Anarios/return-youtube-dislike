import {
  FEATURE_DATA_PERMISSIONS,
  hasFeaturePermission,
  onDataPermissionsChanged,
  requestFeaturePermission,
} from "./src/core-data-consent";
import { renderDataPermissionList } from "./src/data-permission-list";
import { isPrivateBrowsingContext } from "./src/private-browsing";

function localizeHtmlPage() {
  const locale = chrome.i18n.getMessage("@@ui_locale");
  if (locale) document.documentElement.lang = locale.replaceAll("_", "-");
  const direction = chrome.i18n.getMessage("@@bidi_dir");
  if (direction === "rtl" || direction === "ltr") document.documentElement.dir = direction;
  document.documentElement.innerHTML = document.documentElement.innerHTML.replace(/__MSG_(\w+)__/g, (_, key) =>
    chrome.i18n.getMessage(key),
  );
}

localizeHtmlPage();
const privateBrowsing = isPrivateBrowsingContext();
const CONSENT_PAGES = Object.freeze({
  voteOptIn: Object.freeze({ permission: "voteOptIn", grantedBy: "voting", copy: "vote" }),
  account: Object.freeze({ permission: "account", copy: "account" }),
});
const requestedFeature = new URLSearchParams(window.location.search).get("feature");
const page = Object.hasOwn(CONSENT_PAGES, requestedFeature) ? CONSENT_PAGES[requestedFeature] : CONSENT_PAGES.voteOptIn;
const feature = page.permission;
const grantedFeature = page.grantedBy ?? feature;
const continueButton = document.getElementById("consent-continue");
const declineButton = document.getElementById("consent-decline");
const actions = document.getElementById("consent-actions");
const status = document.getElementById("consent-status");
const message = (key) => chrome.i18n.getMessage(key);
let permissionRevision = 0;
let promptPending = false;

document.getElementById("consent-title").textContent = message(`consent_${page.copy}_title`);
document.getElementById("consent-body").textContent = message(`consent_${page.copy}_body`);
renderDataPermissionList(document.getElementById("permission-list"), feature, message);

if (privateBrowsing) {
  document.getElementById("consent-title").textContent = message("extensionName");
  document.getElementById("consent-body").textContent = message("consent_private_counts");
  document.getElementById("consent-next-step").hidden = true;
  actions.hidden = true;
  document.getElementById("permission-details").hidden = true;
} else {
  void refreshPermissionState();
  const unsubscribe = onDataPermissionsChanged(({ added, removed }) => {
    const required = FEATURE_DATA_PERMISSIONS[grantedFeature];
    if (![...added, ...removed].some((category) => required.includes(category))) return;
    permissionRevision++;
    if (promptPending) return;
    if (removed.some((category) => required.includes(category))) {
      actions.hidden = false;
      status.textContent = message("consent_declined_status");
    }
    void refreshPermissionState("consent_declined_status");
  });
  window.addEventListener("unload", unsubscribe, { once: true });

  continueButton.addEventListener("click", () => {
    promptPending = true;
    permissionRevision++;
    const request = requestFeaturePermission(feature);
    notifyPromptState(true);
    continueButton.disabled = true;
    declineButton.disabled = true;
    status.textContent = message("consent_prompt_status");
    void finishRequest(request);
  });
  declineButton.addEventListener("click", () => {
    permissionRevision++;
    status.textContent = message("consent_declined_status");
  });
}

async function finishRequest(request) {
  let deniedMessage = "consent_declined_status";
  try {
    await request;
  } catch (_) {
    deniedMessage = "consent_error_status";
  } finally {
    promptPending = false;
    notifyPromptState(false);
    await refreshPermissionState(deniedMessage);
    continueButton.disabled = false;
    declineButton.disabled = false;
  }
}

async function refreshPermissionState(deniedMessage = "") {
  const revision = ++permissionRevision;
  const granted = await hasFeaturePermission(grantedFeature);
  if (promptPending || revision !== permissionRevision) return;
  actions.hidden = granted;
  status.textContent = granted ? message("consent_granted_status") : deniedMessage ? message(deniedMessage) : "";
}

function notifyPromptState(pending) {
  try {
    const result = browser.runtime.sendMessage({ message: "ryd_consent_prompt_state", pending });
    result?.catch?.(() => {});
  } catch (_) {}
}
