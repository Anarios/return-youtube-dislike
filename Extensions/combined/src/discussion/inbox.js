import { requestDiscussion } from "./client";
import { discussionText as t, discussionError, discussionLanguage } from "./localize";
import { element, button, statusNode, threadUrl, shortDate } from "./dom";

export function notificationText(notification) {
  return notification.type === "reply"
    ? t("notificationReply", [notification.actorNickname || t("someone")])
    : notification.likeCount > 1
      ? t("notificationLikes", [notification.likeCount])
      : t("notificationLike");
}

export function createDiscussionInbox({ request = requestDiscussion, authenticated = true } = {}) {
  const node = element("section", "ryd-discussion-inbox");
  const heading = element("div", "ryd-discussion-toolbar");
  heading.append(element("h3", "ryd-discussion-subtitle", t("notifications")));
  const readAll = button(t("markAllRead"), async () => {
    readAll.disabled = true;
    try {
      await request("readNotifications", { all: true });
      await load();
    } catch (error) {
      status.textContent = discussionError(error);
    } finally {
      readAll.disabled = false;
    }
  });
  heading.append(readAll);
  const list = element("div", "ryd-discussion-inbox-list");
  const status = statusNode();
  const more = button(t("more"), () => load(true));
  more.hidden = true;
  node.append(heading, status, list, more);
  let items = [];
  let cursor = null;
  let disposed = false;
  let generation = 0;
  let hasPage = false;
  let accountId = null;

  function render() {
    list.replaceChildren();
    readAll.hidden = !authenticated || !items.some((item) => !item.read);
    if (!authenticated) {
      status.textContent = t("signedOutInbox");
      more.hidden = true;
      return;
    }
    status.textContent = items.length ? "" : t("notificationEmpty");
    for (const item of items) {
      const row = element("article", `ryd-discussion-notification${item.read ? "" : " is-unread"}`);
      row.dataset.notificationId = item.id;
      const link = element("a", "ryd-discussion-notification-link", notificationText(item));
      const url = threadUrl(item);
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.addEventListener("click", () => {
          request("readNotifications", { ids: [item.id] })
            .then(() => {
              item.read = true;
              render();
            })
            .catch(() => {});
        });
      }
      const date = element("time", "ryd-discussion-meta", shortDate(item.createdAt, discussionLanguage()));
      date.dateTime = item.createdAt;
      row.append(link, date);
      if (!item.read)
        row.append(
          button(t("markRead"), async (event) => {
            event.currentTarget.disabled = true;
            try {
              await request("readNotifications", { ids: [item.id] });
              item.read = true;
              render();
            } catch (error) {
              status.textContent = discussionError(error);
              event.target.disabled = false;
            }
          }),
        );
      list.append(row);
    }
    more.hidden = !cursor;
  }

  async function load(append = false) {
    if (disposed || !authenticated) {
      render();
      return;
    }
    const current = ++generation;
    status.textContent = t("loading");
    more.disabled = true;
    try {
      const result = await request("notifications", append && cursor ? { cursor } : {});
      if (disposed || current !== generation) return;
      const combined = append ? [...items, ...(result.items || [])] : result.items || [];
      items = [...new Map(combined.map((item) => [item.id, item])).values()];
      cursor = result.nextCursor;
      hasPage = true;
      render();
    } catch (error) {
      if (!disposed && current === generation) status.textContent = discussionError(error);
    } finally {
      more.disabled = false;
    }
  }

  return {
    node,
    load,
    setSession(session) {
      authenticated = session?.authenticated === true;
      const nextId = authenticated ? session.profile?.id || null : null;
      generation++;
      if (!authenticated || nextId !== accountId) {
        items = [];
        cursor = null;
        hasPage = false;
      }
      accountId = nextId;
      render();
    },
    update(inbox, { live = false } = {}) {
      if (disposed || !authenticated) return;
      generation++;
      if (live) {
        items = [...new Map([...items, ...(inbox?.items || [])].map((item) => [item.id, item])).values()].sort((a, b) =>
          String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)),
        );
      } else {
        items = inbox?.items || [];
      }
      if (!live || !hasPage) cursor = inbox?.nextCursor;
      hasPage = true;
      render();
    },
    destroy() {
      disposed = true;
      generation++;
      node.remove();
    },
  };
}

export function showDiscussionToast(notification) {
  document.querySelector(".ryd-discussion-toast")?.remove();
  const toast = element("aside", "ryd-discussion-toast");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  const copy = element("div");
  copy.append(element("strong", "", t("title")), element("p", "", notificationText(notification)));
  const url = threadUrl(notification);
  if (url) {
    const link = element("a", "ryd-discussion-button", t("view"));
    link.href = url;
    link.dataset.notificationId = notification.id;
    link.addEventListener("click", () =>
      requestDiscussion("readNotifications", { ids: [notification.id] }).catch(() => {}),
    );
    copy.append(link);
  }
  toast.append(
    copy,
    button("×", () => toast.remove(), "ryd-discussion-close"),
  );
  toast.lastChild.setAttribute("aria-label", t("close"));
  document.body.append(toast);
  setTimeout(() => toast.remove(), 10000);
}
