import { consentApi, hasCoreDataPermission, onCoreDataPermissionChanged } from "./core-data-consent";
import { usesFirefoxDataCollectionConsent } from "./data-collection-permissions";
import { isPrivateBrowsingContext } from "./private-browsing";
import { createConsentCard } from "./consent-card";

let pendingConsent = null;

function waitForCoreDataConsent({ alwaysExplain = false, openConsentPage } = {}) {
  if (!usesFirefoxDataCollectionConsent()) return Promise.resolve();
  if (pendingConsent) return pendingConsent;
  pendingConsent = (async () => {
    if (await hasCoreDataPermission()) return;
    const api = consentApi();
    const privateBrowsing = isPrivateBrowsingContext();
    const useLauncher = !alwaysExplain && !privateBrowsing;
    let dismissed = false;
    if (!privateBrowsing) {
      try {
        dismissed = (await api.storage.local.get("rydConsentDismissed"))?.rydConsentDismissed === true;
      } catch (_) {}
    }
    if (useLauncher && !openConsentPage) {
      await new Promise((resolve) => {
        const card = createConsentCard({ api, dismissed });
        let finished = false;
        let unsubscribe = () => {};
        function finish() {
          if (finished) return;
          finished = true;
          unsubscribe();
          card.destroy();
          resolve();
        }
        unsubscribe = onCoreDataPermissionChanged((granted) => {
          if (granted) finish();
        });
        if (finished) unsubscribe();
        // Another tab may grant permission while the card is mounting.
        void (async () => {
          if (await hasCoreDataPermission()) finish();
        })();
      });
      return;
    }
    await new Promise((resolve) => {
      const host = document.createElement("div");
      host.id = "ryd-consent-prompt";
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
          background: #0008; color-scheme: light dark; }
        :host([collapsed]) { inset: auto 16px 16px auto; background: transparent; }
        iframe { width: min(560px, calc(100vw - 32px)); height: min(600px, calc(100vh - 32px));
          border: 0; border-radius: 18px; background: light-dark(#fff, #202020); box-shadow: 0 12px 48px #0006; }
        button { border: 1px solid #aaa; border-radius: 24px; padding: 12px 18px; cursor: pointer;
          font: 600 14px system-ui; background: light-dark(#fff, #202020); color: light-dark(#151515, #fff); }
        [hidden] { display: none; }
      `;
      const frame = useLauncher ? null : document.createElement("iframe");
      const url = api.runtime.getURL("consent.html");
      if (frame) {
        frame.src = url;
        frame.title = "Enable Return YouTube Dislike";
      }
      const reopen = document.createElement("button");
      reopen.type = "button";
      reopen.textContent = "Enable Return YouTube Dislike";
      function expand() {
        host.removeAttribute("collapsed");
        frame.hidden = false;
        reopen.hidden = true;
        frame.focus();
      }
      function collapse() {
        host.setAttribute("collapsed", "");
        if (frame) frame.hidden = true;
        reopen.hidden = false;
      }
      reopen.addEventListener(
        "click",
        useLauncher
          ? async () => {
              reopen.disabled = true;
              try {
                if (openConsentPage) await openConsentPage();
                else await api.runtime.sendMessage({ message: "ryd_open_consent" });
              } catch (_) {
              } finally {
                reopen.disabled = false;
              }
            }
          : expand,
      );
      if (useLauncher || (dismissed && !alwaysExplain)) collapse();
      else expand();
      shadow.append(style);
      if (frame) shadow.append(frame);
      shadow.append(reopen);
      (document.body || document.documentElement).append(host);
      let requestPending = false;
      const unsubscribe = onCoreDataPermissionChanged((granted) => {
        if (granted && !requestPending) finish();
      });
      function finish() {
        unsubscribe();
        window.removeEventListener("message", onMessage);
        host.remove();
        resolve();
      }
      function onMessage(event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== new URL(url).origin) return;
        if (event.data?.type === "ryd-consent-requested") requestPending = true;
        if (event.data?.type === "ryd-consent-dismissed") {
          requestPending = false;
          collapse();
        }
        if (event.data?.type === "ryd-consent-granted") {
          void hasCoreDataPermission().then((granted) => {
            if (granted) finish();
          });
        }
      }
      window.addEventListener("message", onMessage);
      // Consent may have been granted in another tab while this prompt was being mounted.
      void hasCoreDataPermission().then((granted) => {
        if (granted) finish();
      });
    });
  })().finally(() => {
    pendingConsent = null;
  });
  return pendingConsent;
}

export { waitForCoreDataConsent };
