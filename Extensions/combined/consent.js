import { consentApi, hasCoreDataPermission, requestCoreDataPermission } from "./src/core-data-consent";

const continueButton = document.getElementById("consent-continue");
const declineButton = document.getElementById("consent-decline");
const status = document.getElementById("consent-status");
const canRequestPermissions = typeof consentApi()?.permissions?.request === "function";

if (!canRequestPermissions) {
  document.getElementById("consent-next-step").textContent =
    "Continue opens RYD's permission page. Firefox will only ask after you select Allow in Firefox there. " +
    "If you decline, RYD will not load counts or submit votes. YouTube's own buttons will still work.";
} else if (window.parent === window) {
  continueButton.textContent = "Allow in Firefox";
  document.getElementById("consent-next-step").textContent =
    "Select Allow in Firefox to review Firefox's request. If you decline, RYD will not load counts or submit votes. " +
    "YouTube's own buttons will still work.";
  void hasCoreDataPermission().then((granted) => {
    if (granted) {
      document.getElementById("consent-actions").hidden = true;
      status.textContent = "RYD is enabled. You can return to YouTube.";
    }
  });
}

function notifyParent(type) {
  if (window.parent !== window) window.parent.postMessage({ type }, "*");
}

async function dismiss() {
  try {
    await consentApi().storage.local.set({ rydConsentDismissed: true });
  } catch (_) {}
  status.textContent = "RYD is paused. You can enable it here whenever you're ready.";
  notifyParent("ryd-consent-dismissed");
}

continueButton.addEventListener("click", () => {
  if (!canRequestPermissions) {
    continueButton.disabled = true;
    void consentApi()
      .runtime.sendMessage({ message: "ryd_open_consent" })
      .then(
        (response) => {
          continueButton.disabled = false;
          status.textContent = response?.success
            ? "Finish enabling RYD in the permission page."
            : "Open the RYD extension menu to review permissions.";
        },
        () => {
          continueButton.disabled = false;
          status.textContent = "Open the RYD extension menu to review permissions.";
        },
      );
    return;
  }
  notifyParent("ryd-consent-requested");
  const request = requestCoreDataPermission();
  continueButton.disabled = true;
  declineButton.disabled = true;
  status.textContent = "Choose whether to allow the permissions in Firefox.";
  void request.then(async (granted) => {
    if (granted && (await hasCoreDataPermission())) {
      try {
        await consentApi().storage.local.remove("rydConsentDismissed");
      } catch (_) {}
      document.getElementById("consent-actions").hidden = true;
      status.textContent = "RYD is enabled. You can return to YouTube.";
      notifyParent("ryd-consent-granted");
    } else {
      await dismiss();
      continueButton.disabled = false;
      declineButton.disabled = false;
    }
  });
});
declineButton.addEventListener("click", dismiss);
