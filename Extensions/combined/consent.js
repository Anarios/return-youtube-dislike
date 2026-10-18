import { consentApi, hasCoreDataPermission, requestCoreDataPermission } from "./src/core-data-consent";
import { isPrivateBrowsingContext } from "./src/private-browsing";

const continueButton = document.getElementById("consent-continue");
const declineButton = document.getElementById("consent-decline");
const status = document.getElementById("consent-status");
const privateBrowsing = isPrivateBrowsingContext();
const privateSetupInstruction = "Enable RYD in a normal Firefox window to load counts here.";
const canRequestPermissions = !privateBrowsing && typeof consentApi()?.permissions?.request === "function";

if (privateBrowsing) {
  const main = document.querySelector("main");
  const message = document.createElement("p");
  message.textContent =
    "Counts only in private windows. Voting, sign-in, premium analytics and discussions are unavailable here.";
  const instruction = document.getElementById("consent-next-step");
  instruction.textContent = privateSetupInstruction;
  const actions = document.getElementById("consent-actions");
  actions.replaceChildren(declineButton);
  main.replaceChildren(main.querySelector("img"), main.querySelector("h1"), message, instruction, actions, status);
} else if (!canRequestPermissions) {
  document.getElementById("consent-next-step").textContent =
    "Continue opens RYD's permission page. Firefox will only ask after you select Allow in Firefox there. " +
    "If you decline, RYD will not load counts or submit votes. YouTube's own buttons will still work.";
} else if (window.parent === window) {
  continueButton.textContent = "Allow in Firefox";
  document.getElementById("consent-next-step").textContent =
    "Firefox will ask you to approve these data permissions. If you decline, RYD stays paused; " +
    "YouTube's own buttons still work.";
  void hasCoreDataPermission().then((granted) => {
    if (granted) {
      document.getElementById("consent-actions").hidden = true;
      status.textContent = "RYD is enabled. You can return to YouTube.";
    }
  });
}

function showRequestedDetails() {
  const details = document.getElementById("permission-details");
  if (details && window.location.hash === "#permission-details") details.open = true;
}
showRequestedDetails();
window.addEventListener("hashchange", showRequestedDetails);

function notifyParent(type) {
  if (window.parent !== window) window.parent.postMessage({ type }, "*");
}

async function dismiss() {
  if (!privateBrowsing) {
    try {
      await consentApi().storage.local.set({ rydConsentDismissed: true });
    } catch (_) {}
  }
  status.textContent = privateBrowsing
    ? privateSetupInstruction
    : "RYD is paused. You can enable it here whenever you're ready.";
  notifyParent("ryd-consent-dismissed");
}

if (!privateBrowsing) {
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
}
declineButton.addEventListener("click", dismiss);
