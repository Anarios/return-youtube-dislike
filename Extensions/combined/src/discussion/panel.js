import { requestDiscussion } from "./client";
import { discussionText as t, discussionError, discussionLanguage } from "./localize";
import { element, button, statusNode, shortDate, thumbIcon, isDiscussionCommentId } from "./dom";
import { createDiscussionInbox } from "./inbox";

const SIGNED_OUT = { authenticated: false, canPost: false, isModerator: false, profile: null };

export function createDiscussionPanel({
  videoId,
  surface = "watch",
  session = SIGNED_OUT,
  capabilities = {},
  request = requestDiscussion,
  onClose,
} = {}) {
  const maxLength = capabilities.maxCommentLength || 2000;
  const root = element("section", `ryd-discussion ryd-discussion-${surface}`);
  root.id = surface === "shorts" ? "ryd-discussion-drawer" : "ryd-discussion-panel";
  root.dataset.videoId = videoId;
  root.setAttribute("aria-label", t("title"));
  if (surface === "shorts") {
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.tabIndex = -1;
  }
  const header = element("header", "ryd-discussion-header");
  const brand = element("div", "ryd-discussion-brand");
  brand.append(element("span", "ryd-discussion-logo", "RYD"), element("h2", "ryd-discussion-title", t("title")));
  const headerButtons = element("div", "ryd-discussion-header-actions");
  const inboxButton = button(t("notifications"), () => showTab("inbox"));
  const moderationButton = button(t("moderation"), () => showTab("moderation"));
  const discussionButton = button(t("discussionTab"), () => showTab("discussion"));
  inboxButton.dataset.action = "inbox";
  moderationButton.dataset.action = "moderation";
  discussionButton.dataset.action = "discussion";
  headerButtons.append(discussionButton, inboxButton, moderationButton);
  if (onClose) {
    const close = button("×", onClose, "ryd-discussion-close");
    close.setAttribute("aria-label", t("close"));
    headerButtons.append(close);
  }
  header.append(brand, headerButtons);
  const intro = element("p", "ryd-discussion-description", t("subtitle"));
  const independent = element("p", "ryd-discussion-independent", t("independent"));
  const body = element("div", "ryd-discussion-body");
  const discussion = element("div", "ryd-discussion-thread");
  const composer = element("div", "ryd-discussion-composer");
  const toolbar = element("div", "ryd-discussion-toolbar");
  const sort = element("select", "ryd-discussion-select");
  sort.setAttribute("aria-label", t("sort"));
  for (const value of ["top", "new"]) {
    const option = element("option", "", t(value));
    option.value = value;
    sort.append(option);
  }
  sort.addEventListener("change", () => load());
  const refresh = button(t("refresh"), () => load());
  toolbar.append(sort, refresh);
  const status = statusNode();
  const list = element("div", "ryd-discussion-comments");
  const more = button(t("more"), () => load(true), "ryd-discussion-button ryd-discussion-more");
  more.hidden = true;
  discussion.append(composer, toolbar, status, list, more);
  const inbox = createDiscussionInbox({ request, authenticated: session.authenticated });
  const moderation = element("div", "ryd-discussion-moderation");
  inbox.node.hidden = true;
  moderation.hidden = true;
  body.append(discussion, inbox.node, moderation);
  root.append(header, intro, independent, body);
  let disposed = false;
  let accountGeneration = 0;
  let sequence = 0;
  let items = [];
  let cursor = null;
  let activeTab = "discussion";
  const drafts = new Map();
  const postingIds = new Map();
  let draftGeneration = 0;
  const rootReplyHandlers = new Map();
  let moderationSequence = 0;
  let reportCursor = null;
  let reportStatus = "open";
  let reports = [];
  let highlightedId = null;
  let focusSequence = 0;

  function current() {
    return !disposed;
  }
  function setError(error) {
    if (current()) status.textContent = discussionError(error);
  }

  function showTab(tab, reload = true) {
    if (tab === "moderation" && !session.isModerator) return;
    if (tab === "inbox" && !session.authenticated) return;
    const previousTab = activeTab;
    activeTab = tab;
    discussion.hidden = tab !== "discussion";
    inbox.node.hidden = tab !== "inbox";
    moderation.hidden = tab !== "moderation";
    discussionButton.setAttribute("aria-pressed", String(tab === "discussion"));
    inboxButton.setAttribute("aria-pressed", String(tab === "inbox"));
    moderationButton.setAttribute("aria-pressed", String(tab === "moderation"));
    if (tab === "inbox") inbox.load();
    if (tab === "moderation") loadReports();
    if (reload && tab === "discussion" && previousTab === "moderation") load();
  }

  function renderSession() {
    inboxButton.hidden = !session.authenticated;
    moderationButton.hidden = !session.isModerator;
    discussionButton.hidden = !session.authenticated;
    if ((activeTab === "inbox" && !session.authenticated) || (activeTab === "moderation" && !session.isModerator))
      showTab("discussion");
    composer.replaceChildren();
    if (!session.canPost || session.profile?.suspended) {
      composer.append(element("p", "ryd-discussion-gate", t("gate")));
      const join = element("a", "ryd-discussion-link", t("join"));
      join.href = "https://www.patreon.com/returnyoutubedislike/membership";
      join.target = "_blank";
      join.rel = "noopener noreferrer";
      composer.append(join);
      if (!session.authenticated) composer.append(element("p", "ryd-discussion-meta", t("signInRequired")));
    } else if (!session.profile?.nickname) {
      composer.append(nicknameForm());
    } else {
      const account = element("div", "ryd-discussion-account");
      account.append(
        element("span", "ryd-discussion-meta", t("as", [session.profile.nickname])),
        button(t("nicknameChange"), () => {
          composer.replaceChildren(nicknameForm(true));
        }),
      );
      composer.append(account, commentForm());
    }
    renderComments();
  }

  function nicknameForm(allowCancel = false) {
    const form = element("form", "ryd-discussion-form");
    const label = element("label", "ryd-discussion-label", t("nicknameLabel"));
    const input = element("input", "ryd-discussion-input");
    input.name = "nickname";
    input.value = session.profile?.nickname || "";
    input.required = true;
    input.minLength = capabilities.minNicknameLength || 3;
    input.maxLength = capabilities.maxNicknameLength || 32;
    input.autocomplete = "nickname";
    label.append(input);
    const message = statusNode();
    const actions = element("div", "ryd-discussion-form-actions");
    const submit = button(t("nicknameSave"), null, "ryd-discussion-button ryd-discussion-primary");
    submit.type = "submit";
    actions.append(submit);
    if (allowCancel) actions.append(button(t("cancel"), renderSession));
    form.append(
      element("p", "ryd-discussion-description", t("nicknameRequired")),
      label,
      element("p", "ryd-discussion-meta", t("nicknameHint")),
      message,
      actions,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const nickname = input.value.trim().normalize("NFKC");
      if (
        nickname.length < input.minLength ||
        nickname.length > input.maxLength ||
        !/^[\p{L}\p{N} ._-]+$/u.test(nickname) ||
        !/[\p{L}\p{N}]/u.test(nickname)
      ) {
        message.textContent = t("nicknameInvalid");
        return;
      }
      submit.disabled = true;
      message.textContent = t("saving");
      const accountSnapshot = accountGeneration;
      try {
        const result = await request("profile", { nickname });
        if (!current() || accountSnapshot !== accountGeneration) return;
        session = result;
        renderSession();
      } catch (error) {
        if (current()) message.textContent = discussionError(error);
      } finally {
        submit.disabled = false;
      }
    });
    return form;
  }

  function commentForm({ parentId = null, replyToId = null, comment = null, onCancel, onSaved } = {}) {
    const key = comment ? `edit:${comment.id}` : `reply:${replyToId || "root"}`;
    const form = element("form", "ryd-discussion-form");
    const label = element("label", "ryd-discussion-label");
    label.append(element("span", "ryd-discussion-sr-only", t(comment ? "edit" : replyToId ? "reply" : "comment")));
    const input = element("textarea", "ryd-discussion-textarea");
    input.name = "comment";
    input.placeholder = t("placeholder");
    input.rows = 3;
    input.maxLength = maxLength;
    input.required = true;
    input.value = drafts.get(key) ?? comment?.text ?? "";
    label.append(input);
    const footer = element("div", "ryd-discussion-form-actions");
    const counter = element("span", "ryd-discussion-counter");
    const submit = button(
      t(comment ? "save" : replyToId ? "postReply" : "post"),
      null,
      "ryd-discussion-button ryd-discussion-primary",
    );
    submit.type = "submit";
    submit.dataset.action = comment ? "save" : "post";
    const update = () => {
      drafts.set(key, input.value);
      counter.textContent = t("characters", [input.value.length, maxLength]);
      submit.disabled = !input.value.trim() || input.value.length > maxLength;
      postingIds.delete(key);
    };
    input.addEventListener("input", update);
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    counter.textContent = t("characters", [input.value.length, maxLength]);
    submit.disabled = !input.value.trim();
    footer.append(counter);
    if (onCancel) footer.append(button(t("cancel"), onCancel));
    footer.append(submit);
    const message = statusNode();
    form.append(label, message, footer);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const text = input.value.trim();
      if (!text || text.length > maxLength) return;
      const accountSnapshot = draftGeneration;
      const stillCurrent = () => current() && accountSnapshot === draftGeneration;
      submit.disabled = true;
      input.disabled = true;
      message.textContent = t("saving");
      const requestId = postingIds.get(key) || globalThis.crypto.randomUUID();
      postingIds.set(key, requestId);
      try {
        const payload = comment
          ? { id: comment.id, text }
          : { videoId, text, requestId, ...(parentId ? { parentId, replyToId } : {}) };
        const result = await request(comment ? "editComment" : "createComment", payload);
        if (!stillCurrent()) return;
        drafts.delete(key);
        postingIds.delete(key);
        if (onSaved) onSaved(result);
        else {
          input.value = "";
          update();
          message.textContent = "";
          await load();
        }
      } catch (error) {
        if (stillCurrent()) message.textContent = discussionError(error);
      } finally {
        if (stillCurrent()) {
          input.disabled = false;
          submit.disabled = !input.value.trim();
        }
      }
    });
    return form;
  }

  function commentRow(comment, rootId = comment.parentId || comment.id) {
    const row = element("article", `ryd-discussion-comment${comment.parentId ? " ryd-discussion-reply" : ""}`);
    row.dataset.commentId = comment.id;
    if (comment.id === highlightedId) row.classList.add("is-highlighted");
    const heading = element("div", "ryd-discussion-comment-heading");
    const initial = (comment.author?.nickname || "RYD").slice(0, 1).toUpperCase();
    heading.append(
      element("span", "ryd-discussion-avatar", initial),
      element("strong", "ryd-discussion-author", comment.author?.nickname || t("deleted")),
    );
    const date = element("time", "ryd-discussion-meta", shortDate(comment.createdAt, discussionLanguage()));
    date.dateTime = comment.createdAt;
    heading.append(date);
    if (comment.editedAt) heading.append(element("span", "ryd-discussion-meta", t("edited")));
    const text = element(
      "p",
      "ryd-discussion-comment-text",
      comment.deleted || comment.hidden ? t("deleted") : comment.text,
    );
    const actions = element("div", "ryd-discussion-comment-actions");
    const controls = element("div", "ryd-discussion-inline-editor");
    const replies = element("div", "ryd-discussion-replies");
    row.append(heading, text, actions, controls, replies);
    const alive = () => current() && row.isConnected;
    if (!comment.deleted && !comment.hidden) {
      for (const value of [1, -1]) {
        const reaction = button(
          "",
          async () => {
            if (reaction.disabled) return;
            const buttons = [...actions.querySelectorAll("[data-reaction]")];
            buttons.forEach((item) => {
              item.disabled = true;
            });
            try {
              const result = await request("react", {
                id: comment.id,
                value: comment.myReaction === value ? 0 : value,
              });
              if (!alive()) return;
              Object.assign(comment, result);
              updateReactions();
            } catch (error) {
              setError(error);
            } finally {
              buttons.forEach((item) => {
                item.disabled = false;
              });
            }
          },
          "ryd-discussion-button ryd-discussion-reaction",
        );
        reaction.dataset.reaction = String(value);
        actions.append(reaction);
      }
      function updateReactions() {
        for (const reaction of actions.querySelectorAll("[data-reaction]")) {
          const liked = reaction.dataset.reaction === "1";
          const count = liked ? comment.likes || 0 : comment.dislikes || 0;
          reaction.replaceChildren(thumbIcon(!liked), element("span", "", count.toLocaleString(discussionLanguage())));
          reaction.setAttribute("aria-label", `${t(liked ? "like" : "dislike")} (${count})`);
          reaction.setAttribute("aria-pressed", String(comment.myReaction === (liked ? 1 : -1)));
        }
      }
      updateReactions();
      const reply = button(t("reply"), () => {
        controls.replaceChildren();
        if (!session.canPost) {
          controls.append(element("p", "ryd-discussion-gate", t("tierRequired")));
          return;
        }
        if (!session.profile?.nickname) {
          controls.append(nicknameForm());
          return;
        }
        controls.append(
          commentForm({
            parentId: rootId,
            replyToId: comment.id,
            onCancel: () => controls.replaceChildren(),
            onSaved: (created) => {
              controls.replaceChildren();
              rootReplyHandlers.get(rootId)?.(created);
            },
          }),
        );
        controls.querySelector("textarea")?.focus();
      });
      reply.dataset.action = "reply";
      actions.append(reply);
      if (session.authenticated && comment.author?.id === session.profile?.id) {
        if (comment.canEdit) {
          const edit = button(t("edit"), () => {
            controls.replaceChildren(
              commentForm({
                comment,
                onCancel: () => controls.replaceChildren(),
                onSaved: (updated) => {
                  Object.assign(comment, updated);
                  row.replaceWith(commentRow(comment, rootId));
                },
              }),
            );
            controls.querySelector("textarea")?.focus();
          });
          edit.dataset.action = "edit";
          actions.append(edit);
        }
        if (comment.canDelete) {
          const remove = button(t("delete"), () => {
            const prompt = element("div", "ryd-discussion-confirm");
            prompt.append(
              element("span", "", t("deleteConfirm")),
              button(t("cancel"), () => controls.replaceChildren()),
            );
            const confirm = button(
              t("delete"),
              async () => {
                confirm.disabled = true;
                try {
                  const updated = await request("deleteComment", { id: comment.id });
                  if (alive()) {
                    Object.assign(comment, updated);
                    row.replaceWith(commentRow(comment, rootId));
                  }
                } catch (error) {
                  setError(error);
                  confirm.disabled = false;
                }
              },
              "ryd-discussion-button ryd-discussion-danger",
            );
            confirm.dataset.action = "confirm-delete";
            prompt.append(confirm);
            controls.replaceChildren(prompt);
          });
          remove.dataset.action = "delete";
          actions.append(remove);
        }
      }
      if (session.authenticated) {
        const report = button(t("report"), () => showReport(comment, controls));
        report.dataset.action = "report";
        actions.append(report);
      }
    }
    let repliesCursor = null;
    let replyItems = [];
    let replySequence = 0;
    let replyLoading = false;
    let repliesLoaded = false;
    const moreReplies = button(t("more"), () => loadReplies(true));
    const showReplies = button(t("loadReplies", [comment.replyCount || 0]), () => loadReplies());
    showReplies.dataset.action = "load-replies";
    showReplies.hidden = Boolean(comment.parentId) || !comment.replyCount;
    actions.append(showReplies);
    function renderReplies() {
      const timestamp = (value) =>
        String(value).replace(/(?:\.(\d+))?Z$/, (_, fraction = "") => `.${fraction.padEnd(9, "0")}Z`);
      replyItems = [...new Map(replyItems.map((item) => [item.id, item])).values()].sort(
        (a, b) => timestamp(a.createdAt).localeCompare(timestamp(b.createdAt)) || a.id.localeCompare(b.id),
      );
      comment.replyCount = Math.max(comment.replyCount || 0, replyItems.length);
      replies.replaceChildren(...replyItems.map((item) => commentRow(item, rootId)));
      if (repliesCursor) replies.append(moreReplies);
    }
    function addReply(created) {
      if (!alive()) return;
      if (!replyItems.some((item) => item.id === created.id)) comment.replyCount = (comment.replyCount || 0) + 1;
      replyItems.push(created);
      renderReplies();
      showReplies.textContent = t("loadReplies", [comment.replyCount]);
      showReplies.hidden = repliesLoaded;
      if (!repliesLoaded) loadReplies();
    }
    async function loadReplies(append = false) {
      if (replyLoading) return;
      replyLoading = true;
      showReplies.disabled = true;
      const currentReply = ++replySequence;
      try {
        const result = await request("replies", {
          rootId,
          ...(append && repliesCursor ? { cursor: repliesCursor } : {}),
        });
        if (!alive() || currentReply !== replySequence) return;
        replyItems = [...replyItems, ...(result.items || [])];
        repliesCursor = result.nextCursor;
        repliesLoaded = true;
        renderReplies();
        showReplies.hidden = true;
      } catch (error) {
        setError(error);
      } finally {
        showReplies.disabled = false;
        replyLoading = false;
      }
    }
    if (!comment.parentId) rootReplyHandlers.set(comment.id, addReply);
    return row;
  }

  function showReport(comment, host) {
    const form = element("form", "ryd-discussion-form");
    const label = element("label", "ryd-discussion-label", t("reportReason"));
    const reason = element("select", "ryd-discussion-select");
    for (const [value, key] of [
      ["spam", "reportSpam"],
      ["abuse", "reportAbuse"],
      ["other", "reportOther"],
    ]) {
      const option = element("option", "", t(key));
      option.value = value;
      reason.append(option);
    }
    label.append(reason);
    const detailsLabel = element("label", "ryd-discussion-label", t("reportDetails"));
    const details = element("textarea", "ryd-discussion-textarea");
    details.maxLength = 400;
    details.rows = 2;
    detailsLabel.append(details);
    const message = statusNode();
    const submit = button(t("reportSend"), null, "ryd-discussion-button ryd-discussion-primary");
    submit.type = "submit";
    submit.dataset.action = "send-report";
    const actions = element("div", "ryd-discussion-form-actions");
    actions.append(
      button(t("cancel"), () => host.replaceChildren()),
      submit,
    );
    form.append(element("h4", "ryd-discussion-subtitle", t("reportTitle")), label, detailsLabel, message, actions);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        await request("report", {
          id: comment.id,
          reason: `${reason.value}${details.value.trim() ? `: ${details.value.trim()}` : ""}`,
        });
        if (current()) host.replaceChildren(element("p", "ryd-discussion-status", t("reportDone")));
      } catch (error) {
        message.textContent = discussionError(error);
        submit.disabled = false;
      }
    });
    host.replaceChildren(form);
  }

  function renderComments() {
    rootReplyHandlers.clear();
    list.replaceChildren(...items.map((item) => commentRow(item)));
  }

  async function load(append = false) {
    if (!current()) return;
    const currentSequence = ++sequence;
    status.textContent = t("loading");
    refresh.disabled = true;
    more.disabled = true;
    try {
      const result = await request("comments", { videoId, sort: sort.value, ...(append && cursor ? { cursor } : {}) });
      if (!current() || currentSequence !== sequence) return;
      items = append ? [...items, ...(result.items || [])] : result.items || [];
      items = [...new Map(items.map((item) => [item.id, item])).values()];
      cursor = result.nextCursor;
      renderComments();
      status.textContent = items.length ? "" : t("empty");
      more.hidden = !cursor;
    } catch (error) {
      if (current() && currentSequence === sequence) setError(error);
    } finally {
      if (current() && currentSequence === sequence) {
        refresh.disabled = false;
        more.disabled = false;
      }
    }
  }

  async function loadReports(append = false) {
    if (!current() || !session.isModerator) return;
    const currentSequence = ++moderationSequence;
    moderation.replaceChildren(element("p", "ryd-discussion-status", t("loading")));
    try {
      const result = await request("reports", {
        status: reportStatus,
        ...(append && reportCursor ? { cursor: reportCursor } : {}),
      });
      if (!current() || currentSequence !== moderationSequence || !session.isModerator) return;
      reports = append ? [...reports, ...(result.items || [])] : result.items || [];
      reportCursor = result.nextCursor;
      const reportToolbar = element("div", "ryd-discussion-toolbar");
      const reportFilter = element("select", "ryd-discussion-select");
      reportFilter.dataset.action = "report-status";
      reportFilter.setAttribute("aria-label", t("reportStatus"));
      for (const [value, label] of [
        ["open", "openReports"],
        ["resolved", "resolvedReports"],
      ]) {
        const option = element("option", "", t(label));
        option.value = value;
        reportFilter.append(option);
      }
      reportFilter.value = reportStatus;
      reportFilter.addEventListener("change", () => {
        reportStatus = reportFilter.value;
        reportCursor = null;
        loadReports();
      });
      reportToolbar.append(element("h3", "ryd-discussion-subtitle", t("moderation")), reportFilter);
      moderation.replaceChildren(reportToolbar);
      if (!reports.length) moderation.append(element("p", "ryd-discussion-status", t("queueEmpty")));
      for (const report of reports) {
        const row = element("article", "ryd-discussion-report");
        row.dataset.reportId = report.id;
        row.append(
          element("strong", "ryd-discussion-author", report.comment?.author?.nickname || t("deleted")),
          element("p", "ryd-discussion-comment-text", report.comment?.text || t("deleted")),
          element("p", "ryd-discussion-report-reason", report.reason),
        );
        const reasonLabel = element("label", "ryd-discussion-label", t("moderationReason"));
        const reason = element("input", "ryd-discussion-input");
        reason.maxLength = 300;
        reasonLabel.append(reason);
        row.append(reasonLabel);
        const actions = element("div", "ryd-discussion-comment-actions");
        const feedback = statusNode();
        const addAction = (key, operation, payload) => {
          const action = button(t(key), async () => {
            const buttons = [...actions.querySelectorAll("button")];
            buttons.forEach((item) => {
              item.disabled = true;
            });
            try {
              await request(operation, { ...payload, ...(reason.value.trim() ? { reason: reason.value.trim() } : {}) });
              if (current()) await loadReports();
            } catch (error) {
              feedback.textContent = discussionError(error);
              buttons.forEach((item) => {
                item.disabled = false;
              });
            }
          });
          action.dataset.action = key;
          actions.append(action);
        };
        if (reportStatus === "open") addAction("dismiss", "dismissReport", { id: report.id });
        addAction(report.comment?.hidden ? "restore" : "hide", "moderateComment", {
          id: report.comment.id,
          hidden: !report.comment.hidden,
        });
        if (report.comment.author)
          addAction(report.authorSuspended ? "unban" : "ban", "suspendProfile", {
            id: report.comment.author.id,
            suspended: !report.authorSuspended,
          });
        row.append(actions, feedback);
        moderation.append(row);
      }
      if (reportCursor) moderation.append(button(t("more"), () => loadReports(true)));
    } catch (error) {
      if (current() && currentSequence === moderationSequence)
        moderation.replaceChildren(
          element("p", "ryd-discussion-status", discussionError(error)),
          button(t("retry"), () => loadReports()),
        );
    }
  }

  async function focusComment(id) {
    if (!isDiscussionCommentId(id)) return;
    const focus = ++focusSequence;
    const account = accountGeneration;
    const stillCurrent = () => current() && focus === focusSequence && account === accountGeneration;
    try {
      const target = await request("comment", { id });
      if (!stillCurrent() || target.videoId !== videoId) return;
      highlightedId = id;
      const threadRoot = target.parentId ? await request("comment", { id: target.parentId }) : target;
      if (!stillCurrent() || threadRoot.videoId !== videoId) return;
      showTab("discussion", false);
      if (!items.some((item) => item.id === threadRoot.id)) items.unshift(threadRoot);
      renderComments();
      const row = [...list.querySelectorAll("[data-comment-id]")].find(
        (item) => item.dataset.commentId === threadRoot.id,
      );
      if (target.parentId) row.querySelector(".ryd-discussion-replies").append(commentRow(target, threadRoot.id));
      const focused = [...list.querySelectorAll("[data-comment-id]")].find((item) => item.dataset.commentId === id);
      focused?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      if (focused) {
        focused.tabIndex = -1;
        focused.focus({ preventScroll: true });
      }
    } catch (error) {
      if (stillCurrent()) setError(error);
    }
  }

  renderSession();
  showTab("discussion");
  return {
    root,
    load,
    focusComment,
    setSession(next) {
      const previousIdentity = session.authenticated ? session.profile?.id || "authenticated" : "anonymous";
      const nextIdentity = next?.authenticated ? next.profile?.id || "authenticated" : "anonymous";
      if (previousIdentity !== nextIdentity) {
        draftGeneration++;
        drafts.clear();
        postingIds.clear();
      }
      accountGeneration++;
      moderationSequence++;
      session = next || SIGNED_OUT;
      inbox.setSession(session);
      renderSession();
      if (previousIdentity !== nextIdentity) load();
    },
    setInbox(value) {
      inbox.update(value, { live: true });
      inboxButton.textContent = `${t("notifications")}${value?.unreadCount ? ` (${value.unreadCount})` : ""}`;
    },
    destroy() {
      disposed = true;
      sequence++;
      moderationSequence++;
      drafts.clear();
      postingIds.clear();
      inbox.destroy();
      root.remove();
    },
  };
}
