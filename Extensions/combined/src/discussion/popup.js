import { requestDiscussion, subscribeDiscussionEvents } from "./client";
import { createDiscussionInbox } from "./inbox";
import { discussionText as t } from "./localize";

export function initDiscussionPopup() {
  const root = document.getElementById("ryd-discussion-popup");
  if (!root) return;
  if (!document.documentElement.lang && chrome.i18n?.getUILanguage)
    document.documentElement.lang = chrome.i18n.getUILanguage();
  const toggle = document.getElementById("ryd-discussion-inbox-toggle");
  const inbox = createDiscussionInbox({ authenticated: false });
  root.append(inbox.node);
  inbox.node.hidden = true;
  toggle.textContent = t("notifications");
  toggle.addEventListener("click", () => {
    inbox.node.hidden = !inbox.node.hidden;
    toggle.setAttribute("aria-expanded", String(!inbox.node.hidden));
    if (!inbox.node.hidden) inbox.load();
  });
  let generation = 0;
  const unsubscribe = subscribeDiscussionEvents((event) => {
    if (event.type === "session") {
      generation++;
      inbox.setSession(event.data);
    }
    if (event.type === "inbox") {
      inbox.update(event.data, { live: true });
      toggle.textContent = `${t("notifications")}${event.data?.unreadCount ? ` (${event.data.unreadCount})` : ""}`;
    }
  });
  const initial = generation;
  requestDiscussion("session")
    .then((session) => {
      if (initial !== generation) return;
      inbox.setSession(session);
      if (session.authenticated)
        requestDiscussion("notifications")
          .then((value) => {
            if (initial !== generation) return;
            inbox.update(value);
            toggle.textContent = `${t("notifications")}${value?.unreadCount ? ` (${value.unreadCount})` : ""}`;
          })
          .catch(() => {});
    })
    .catch(() => {});
  window.addEventListener(
    "unload",
    () => {
      inbox.destroy();
      unsubscribe();
    },
    { once: true },
  );
}
