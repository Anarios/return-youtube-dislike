import { requestDiscussion, subscribeDiscussionEvents } from "./client";
import { createDiscussionInbox } from "./inbox";
import { discussionText as t } from "./localize";
import { button, element } from "./dom";
import { isPrivateBrowsingContext } from "../private-browsing";

export function initDiscussionPopup() {
  if (isPrivateBrowsingContext()) return;
  const root = document.getElementById("ryd-discussion-popup");
  if (!root) return;
  if (!document.documentElement.lang && chrome.i18n?.getUILanguage)
    document.documentElement.lang = chrome.i18n.getUILanguage();
  const toggle = document.getElementById("ryd-discussion-inbox-toggle");
  const inbox = createDiscussionInbox({ authenticated: false });
  const back = button("←", () => setInboxOpen(false), "ryd-discussion-inbox-back");
  back.setAttribute("aria-label", t("close"));
  const brand = element("div", "ryd-discussion-inbox-brand");
  brand.append(back, element("span", "", document.querySelector("h1")?.textContent));
  root.append(brand, inbox.node);
  root.hidden = true;
  root.inert = true;
  let open = false;
  let background = [];
  let homeScroll = [0, 0];

  function setInboxOpen(next) {
    if (next === open) return;
    if (next) homeScroll = [window.scrollX, window.scrollY];
    open = next;
    root.hidden = !open;
    root.inert = !open;
    toggle.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("ryd-discussion-inbox-open", open);
    if (open) {
      background = Array.from(document.body.children)
        .filter(
          (node) =>
            node !== root && node.id !== "ryd-consent-prompt" && !["SCRIPT", "STYLE", "LINK"].includes(node.tagName),
        )
        .map((node) => ({ node, hidden: node.hidden, inert: node.inert }));
      for (const { node } of background) {
        node.hidden = true;
        node.inert = true;
      }
      back.focus({ preventScroll: true });
      void inbox.load();
    } else {
      for (const { node, hidden, inert } of background) {
        node.hidden = hidden;
        node.inert = inert;
      }
      background = [];
      toggle.focus({ preventScroll: true });
      window.scrollTo(...homeScroll);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setInboxOpen(false);
    }
  }

  toggle.textContent = t("notifications");
  toggle.addEventListener("click", () => setInboxOpen(!open));
  document.addEventListener("keydown", onKeyDown);
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
      document.removeEventListener("keydown", onKeyDown);
      inbox.destroy();
      unsubscribe();
    },
    { once: true },
  );
}
