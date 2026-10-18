import { createDiscussionRequestScope, requestDiscussion, subscribeDiscussionEvents } from "./client";
import { discussionRoute, findDiscussionSurface } from "./detector";
import { discussionLanguage, discussionText as t } from "./localize";
import { createDiscussionPanel } from "./panel";
import { showDiscussionToast } from "./inbox";
import { button, element, discussionLinkTarget, isDiscussionCommentId } from "./dom";
import { isPrivateBrowsingContext } from "../private-browsing";

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
    const next = capabilities.enabled === true ? findDiscussionSurface(route) : null;
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
      request: panelScope.request,
      ...(next.surface === "shorts" ? { onClose: closeDrawer } : {}),
    });
    if (inbox) panel.setInbox(inbox);
    if (next.surface === "watch") {
      next.host.insertAdjacentElement("afterend", panel.root);
    } else {
      launcher = button("RYD", openDrawer, "ryd-discussion-launcher");
      launcher.id = "ryd-discussion-launcher";
      launcher.dataset.videoId = next.videoId;
      launcher.setAttribute("aria-label", t("open"));
      launcher.setAttribute("title", t("open"));
      launcher.setAttribute("aria-haspopup", "dialog");
      launcher.setAttribute("aria-expanded", "false");
      next.host.insertAdjacentElement("afterend", launcher);
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
    refresh();
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
  window.addEventListener("popstate", refresh);
  document.addEventListener("click", notificationLinkClick, true);
  document.addEventListener("keydown", keyboard, true);
  const timer = setInterval(refresh, 1000);
  const unsubscribe = subscribeDiscussionEvents((event) => {
    if (disposed) return;
    if (event.type === "session") {
      sessionGeneration++;
      session = event.data;
      panel?.setSession(session);
      if (!session?.authenticated) {
        inbox = null;
        document.querySelector(".ryd-discussion-toast")?.remove();
      }
    }
    if (event.type === "inbox") {
      inbox = event.data;
      panel?.setInbox(inbox);
    }
    if (event.type === "toast" && session.authenticated) showDiscussionToast(event.data);
  });
  const initialSession = sessionGeneration;
  request("session")
    .then((value) => {
      if (!disposed && initialSession === sessionGeneration) {
        session = value;
        panel?.setSession(session);
      }
    })
    .catch(() => {});
  request("capabilities")
    .then((value) => {
      if (!disposed) {
        capabilities = value || {};
        refresh();
      }
    })
    .catch(() => {});
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
      bridge.remove();
      document.removeEventListener("yt-navigate-start", navigationStart);
      document.removeEventListener("yt-navigate-finish", navigationFinish);
      window.removeEventListener("pagehide", navigationStart);
      window.removeEventListener("pageshow", navigationFinish);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener("popstate", refresh);
      document.removeEventListener("click", notificationLinkClick, true);
      document.removeEventListener("keydown", keyboard, true);
      installed = null;
    },
  };
  return installed;
}
