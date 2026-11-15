import { createDiscussionRequestScope, requestDiscussion, subscribeDiscussionEvents } from "./client";
import { SHORTS_LAUNCHER_ID, discussionRoute, findDiscussionSurface } from "./detector";
import { discussionLanguage, discussionText as t } from "./localize";
import { createDiscussionPanel } from "./panel";
import { showDiscussionToast } from "./inbox";
import { button, element, discussionLinkTarget, isDiscussionCommentId } from "./dom";
import { isPrivateBrowsingContext } from "../private-browsing";
import { hasFeaturePermission, usesFirefoxDataCollectionConsent } from "../core-data-consent";

const HIDE_COMMENTS_KEY = "hideRydComments";
let installed = null;

export function initDiscussion({ request = requestDiscussion } = {}) {
  if (isPrivateBrowsingContext()) return null;
  if (installed) return installed;
  let panel = null;
  let panelScope = null;
  let surface = null;
  let launcher = null;
  let backdrop = null;
  let drawerOpenVideoId = null;
  let focusedCommentKey = null;
  let session = { authenticated: false, profile: null, canPost: false, isModerator: false };
  let capabilities = {};
  let inbox = null;
  let disposed = false;
  let navigationPending = false;
  let navigationOrigin = null;
  let language = discussionLanguage();
  let scheduled = null;
  let sessionGeneration = 0;
  let reactionsAllowed = !usesFirefoxDataCollectionConsent();
  let permissionGeneration = 0;
  let sessionRequest = null;
  let browsingAllowed = false;
  let browsingGeneration = 0;
  let commentsHidden = true;

  async function loadCapabilities() {
    const expected = ++browsingGeneration;
    if (commentsHidden) return;
    try {
      if (!(await hasFeaturePermission("counts")) || disposed || expected !== browsingGeneration) return;
      const value = await request("capabilities");
      if (disposed || expected !== browsingGeneration) return;
      browsingAllowed = true;
      capabilities = value || {};
      refresh();
    } catch (_) {}
  }

  function applyCommentsSetting(hidden) {
    if (disposed || hidden === commentsHidden) return;
    commentsHidden = hidden;
    if (hidden) refresh();
    else void loadCapabilities();
  }

  function commentsSettingChanged(changes, area) {
    if (area === "sync" && changes[HIDE_COMMENTS_KEY])
      applyCommentsSetting(changes[HIDE_COMMENTS_KEY].newValue === true);
  }

  function updateSession(value) {
    const changed =
      ["authenticated", "canPost", "isModerator", "membershipTier"].some((key) => session?.[key] !== value?.[key]) ||
      ["id", "nickname", "suspended"].some((key) => session?.profile?.[key] !== value?.profile?.[key]);
    session = value;
    if (changed) panel?.setSession(session);
    if (changed && session?.authenticated && inbox) panel?.setInbox(inbox);
    if (!session?.authenticated) {
      inbox = null;
      document.querySelector(".ryd-discussion-toast")?.remove();
    }
  }

  function recoverSession() {
    if (disposed || document.visibilityState !== "visible") return;
    if (sessionRequest) return sessionRequest;
    const expected = sessionGeneration;
    sessionRequest = (async () => {
      try {
        if (
          !(await hasFeaturePermission("account")) ||
          disposed ||
          document.visibilityState !== "visible" ||
          expected !== sessionGeneration
        )
          return;
        const value = await request("session");
        if (!disposed && expected === sessionGeneration) updateSession(value);
      } catch (_) {
      } finally {
        sessionRequest = null;
      }
    })();
    return sessionRequest;
  }

  function visibilityChange() {
    if (document.visibilityState === "visible") recoverSession();
  }

  function pageActivity() {
    refresh();
    recoverSession();
  }

  async function refreshPermissions() {
    const expected = ++permissionGeneration;
    const allowed = await hasFeaturePermission("voting");
    if (disposed || expected !== permissionGeneration) return;
    reactionsAllowed = allowed;
    panel?.setPermissions({ reactions: allowed });
  }

  const bridge = document.createElement("script");
  bridge.src = chrome.runtime.getURL("comments-bridge.js");
  bridge.onload = () => {
    bridge.remove();
    refresh();
  };
  bridge.onerror = () => {
    bridge.remove();
    refresh();
  };
  (document.head || document.documentElement).append(bridge);

  function clear() {
    focusedCommentKey = null;
    panelScope?.cancel();
    panelScope = null;
    panel?.destroy();
    panel = null;
    launcher?.remove();
    launcher = null;
    backdrop?.remove();
    backdrop = null;
    surface = null;
  }

  function closeDrawer() {
    drawerOpenVideoId = null;
    if (!panel || surface?.surface !== "shorts") return;
    panel.root.hidden = true;
    if (backdrop) backdrop.hidden = true;
    launcher?.setAttribute("aria-expanded", "false");
    launcher?.focus();
  }

  function openDrawer() {
    if (!panel || surface?.surface !== "shorts") return;
    drawerOpenVideoId = surface.videoId;
    panel.root.hidden = false;
    backdrop.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    panel.root.focus();
  }

  async function focusLinkedComment(target, force = false) {
    if (!target || !panel || surface?.videoId !== target.videoId || discussionRoute()?.videoId !== target.videoId)
      return;
    const key = `${target.videoId}:${target.commentId}`;
    if (!force && focusedCommentKey === key) return;
    focusedCommentKey = key;
    if (surface.surface === "shorts") openDrawer();
    await panel.focusComment(target.commentId);
  }

  function notificationLinkClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = event.target?.closest?.(".ryd-discussion-notification-link, .ryd-discussion-toast a[href]");
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const target = discussionLinkTarget(anchor.href);
    if (!target || !panel || surface?.videoId !== target.videoId || discussionRoute()?.videoId !== target.videoId)
      return;
    event.preventDefault();
    event.stopPropagation();
    const url = new URL(location.href);
    url.searchParams.delete("rydComment");
    url.hash = new URLSearchParams({ rydComment: target.commentId }).toString();
    history.replaceState(history.state, "", url.href);
    const notificationId = anchor.closest("[data-notification-id]")?.dataset.notificationId;
    if (isDiscussionCommentId(notificationId)) request("readNotifications", { ids: [notificationId] }).catch(() => {});
    focusLinkedComment(target, true);
  }

  async function refresh() {
    if (disposed) return;
    const route = discussionRoute();
    const linkedTarget = discussionLinkTarget();
    if (route?.surface !== "shorts" || route.videoId !== drawerOpenVideoId) drawerOpenVideoId = null;
    if (navigationPending && route?.videoId === navigationOrigin) return;
    if (navigationPending && route?.videoId !== navigationOrigin) navigationPending = false;
    const nextLanguage = discussionLanguage();
    if (nextLanguage !== language) {
      language = nextLanguage;
      clear();
    }
    const next =
      browsingAllowed && !commentsHidden && capabilities.enabled === true ? findDiscussionSurface(route) : null;
    if (!next) {
      clear();
      return;
    }
    if (
      surface?.videoId === next.videoId &&
      surface?.root === next.root &&
      surface?.host === next.host &&
      panel?.root.isConnected &&
      (!launcher || launcher.isConnected)
    ) {
      await focusLinkedComment(linkedTarget);
      return;
    }
    clear();
    surface = next;
    panelScope = createDiscussionRequestScope(next.videoId, request);
    panel = createDiscussionPanel({
      videoId: next.videoId,
      surface: next.surface,
      session,
      capabilities,
      reactionsAllowed,
      request: panelScope.request,
      ...(next.surface === "shorts" ? { onClose: closeDrawer } : {}),
    });
    if (inbox) panel.setInbox(inbox);
    if (next.surface === "watch") {
      next.host.insertAdjacentElement("afterend", panel.root);
    } else {
      launcher = button("RYD", openDrawer, "ryd-discussion-launcher");
      launcher.id = SHORTS_LAUNCHER_ID;
      launcher.dataset.videoId = next.videoId;
      launcher.setAttribute("aria-label", t("open"));
      launcher.setAttribute("title", t("open"));
      launcher.setAttribute("aria-haspopup", "dialog");
      launcher.setAttribute("aria-expanded", "false");
      next.host.insertBefore(launcher, next.host.querySelector(":scope > pivot-button-view-model"));
      backdrop = element("div", "ryd-discussion-backdrop");
      backdrop.hidden = true;
      backdrop.addEventListener("click", closeDrawer);
      panel.root.hidden = true;
      document.body.append(backdrop, panel.root);
      if (drawerOpenVideoId === next.videoId) openDrawer();
    }
    const currentPanel = panel;
    await currentPanel.load();
    if (currentPanel !== panel || disposed) return;
    await focusLinkedComment(discussionLinkTarget() || linkedTarget);
  }

  function schedule() {
    if (disposed || scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      refresh();
    }, 150);
  }
  function navigationStart() {
    drawerOpenVideoId = null;
    navigationPending = true;
    navigationOrigin = discussionRoute()?.videoId;
    clear();
  }
  function navigationFinish() {
    navigationPending = false;
    pageActivity();
  }
  function keyboard(event) {
    if (!panel || surface?.surface !== "shorts" || panel.root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
    }
    if (event.key === "Tab") {
      const focusable = [...panel.root.querySelectorAll("button, input, textarea, select, a[href]")].filter(
        (node) => !node.disabled && !node.closest("[hidden]"),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.root)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["lang", "video-id", "is-active", "hidden"],
  });
  document.addEventListener("yt-navigate-start", navigationStart);
  document.addEventListener("yt-navigate-finish", navigationFinish);
  window.addEventListener("pagehide", navigationStart);
  window.addEventListener("pageshow", navigationFinish);
  window.addEventListener("hashchange", refresh);
  window.addEventListener("popstate", pageActivity);
  window.addEventListener("online", recoverSession);
  document.addEventListener("visibilitychange", visibilityChange);
  document.addEventListener("click", notificationLinkClick, true);
  document.addEventListener("keydown", keyboard, true);
  const timer = setInterval(refresh, 1000);
  const unsubscribe = subscribeDiscussionEvents((event) => {
    if (disposed) return;
    if (event.type === "session") {
      sessionGeneration++;
      updateSession(event.data);
    }
    if (event.type === "inbox") {
      inbox = event.data;
      panel?.setInbox(inbox);
    }
    if (event.type === "toast" && session.authenticated) showDiscussionToast(event.data);
    if (event.type === "permissions") {
      const removed = event.data?.removed || [];
      const added = event.data?.added || [];
      if (
        [...added, ...removed].some((category) =>
          ["authenticationInfo", "personallyIdentifyingInfo"].includes(category),
        )
      )
        sessionGeneration++;
      if ([...added, ...removed].every((category) => category === "websiteActivity")) {
        refreshPermissions();
        return;
      }
      if (removed.some((category) => ["authenticationInfo", "personallyIdentifyingInfo"].includes(category))) {
        updateSession({ authenticated: false, profile: null, canPost: false, isModerator: false });
      }
      if (removed.includes("browsingActivity")) {
        browsingGeneration++;
        browsingAllowed = false;
        capabilities = {};
        clear();
      }
      if (added.includes("browsingActivity")) void loadCapabilities();
      if (!browsingAllowed) {
        refreshPermissions();
        return;
      }
      panel?.setSession(session);
      panel?.load();
      refreshPermissions();
      refresh();
    }
  });
  refreshPermissions();
  recoverSession();
  chrome.storage.onChanged.addListener(commentsSettingChanged);
  chrome.storage.sync.get([HIDE_COMMENTS_KEY], (values) => applyCommentsSetting(values?.[HIDE_COMMENTS_KEY] === true));
  refresh();
  installed = {
    refresh,
    destroy() {
      disposed = true;
      drawerOpenVideoId = null;
      clear();
      clearInterval(timer);
      clearTimeout(scheduled);
      observer.disconnect();
      unsubscribe();
      chrome.storage.onChanged.removeListener(commentsSettingChanged);
      bridge.remove();
      document.removeEventListener("yt-navigate-start", navigationStart);
      document.removeEventListener("yt-navigate-finish", navigationFinish);
      window.removeEventListener("pagehide", navigationStart);
      window.removeEventListener("pageshow", navigationFinish);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener("popstate", pageActivity);
      window.removeEventListener("online", recoverSession);
      document.removeEventListener("visibilitychange", visibilityChange);
      document.removeEventListener("click", notificationLinkClick, true);
      document.removeEventListener("keydown", keyboard, true);
      installed = null;
    },
  };
  return installed;
}
