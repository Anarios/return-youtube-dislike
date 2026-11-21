import { requestDiscussion } from "./client";
import { discussionText as t, discussionError, discussionLanguage, extensionText } from "./localize";
import { element, button, statusNode, shortDate, thumbIcon, isDiscussionCommentId } from "./dom";
import { createDiscussionInbox, notificationsLabel } from "./inbox";
import { orderReplies } from "./reply-tree";
import { consentApi } from "../core-data-consent";
import { readPlaybackPosition } from "../../../common/playback-position";

const SIGNED_OUT = { authenticated: false, canPost: false, isModerator: false, profile: null };
const REACTION_CONSENT_FEATURE = "voteOptIn";
const MAX_FOCUS_ANCESTORS = 32;

export function createDiscussionPanel({
  videoId,
  surface = "watch",
  session = SIGNED_OUT,
  capabilities = {},
  reactionsAllowed = true,
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
  let sortOrder = "top";
  const sort = element("div", "ryd-discussion-sort");
  sort.setAttribute("role", "group");
  sort.setAttribute("aria-label", t("sort"));
  const sortButtons = ["top", "new"].map((value) => {
    const option = button(t(value), () => selectSort(value));
    option.dataset.sort = value;
    return option;
  });
  sort.append(...sortButtons);
  renderSort();
  const refresh = button(t("refresh"), () => load());
  toolbar.append(sort, refresh);
  const status = statusNode();
  const list = element("div", "ryd-discussion-comments");
  const more = button(t("more"), () => load(true), "ryd-discussion-button ryd-discussion-more");
  more.hidden = true;
  discussion.append(composer, toolbar, status, list, more);
  const inbox = createDiscussionInbox({
    request,
    authenticated: session.authenticated,
    onUnreadCount: (count) => {
      inboxButton.textContent = notificationsLabel(count);
    },
  });
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
  const reactionRows = new Map();
  const commentPresentations = new WeakMap();
  const localCommentVersions = new Map();
  const localReactionVersions = new Map();
  let commentMutationSequence = 0;
  let pendingReaction = null;
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

  function showConsentPrompt(message, { text, feature }) {
    const continued = button(t("consentContinue"), () => {
      try {
        const pending = consentApi()?.runtime?.sendMessage({ message: "ryd_open_consent", feature });
        pending?.catch?.(() => {});
      } catch (_) {}
    });
    continued.dataset.action = `${feature}-consent`;
    message.replaceChildren(element("span", "", t(text)), continued);
  }

  function isOwnComment(comment) {
    return Boolean(session.authenticated && session.profile?.id && comment.author?.id === session.profile.id);
  }

  function requestReactionConsent(target, value, playbackPosition) {
    clearReactionConsentPrompts();
    pendingReaction = { comment: target.comment, value, playbackPosition };
    showConsentPrompt(target.notice, { text: "reactionConsentRequired", feature: REACTION_CONSENT_FEATURE });
  }

  function clearReactionConsentPrompts() {
    for (const row of reactionRows.values()) {
      if (row.alive() && row.notice.querySelector(`[data-action='${REACTION_CONSENT_FEATURE}-consent']`))
        row.notice.replaceChildren();
    }
  }

  function setReactionsBusy(target, busy) {
    for (const item of target.actions.querySelectorAll("[data-reaction]")) item.disabled = busy;
  }

  function renderedReaction(id) {
    const row = reactionRows.get(id);
    return row?.alive() ? row : null;
  }

  async function sendReaction(comment, value, playbackPosition) {
    if (isOwnComment(comment)) return;
    const target = renderedReaction(comment.id);
    target?.notice.replaceChildren();
    if (target) setReactionsBusy(target, true);
    try {
      const result = await request("react", {
        id: comment.id,
        value: comment.myReaction === value ? 0 : value,
        playbackPosition,
      });
      const latest = renderedReaction(comment.id);
      Object.assign(latest?.comment || comment, result);
      localReactionVersions.set(comment.id, ++commentMutationSequence);
      latest?.update();
    } catch (error) {
      setError(error);
    } finally {
      if (target) setReactionsBusy(target, false);
    }
  }

  async function react(id, value) {
    const target = renderedReaction(id);
    if (!target || isOwnComment(target.comment)) return;
    const playbackPosition = readPlaybackPosition(videoId);
    if (!reactionsAllowed) {
      requestReactionConsent(target, value, playbackPosition);
      return;
    }
    await sendReaction(target.comment, value, playbackPosition);
  }

  function performPendingReaction() {
    const pending = pendingReaction;
    pendingReaction = null;
    if (pending && current()) void sendReaction(pending.comment, pending.value, pending.playbackPosition);
  }

  function clearOwnReactions() {
    for (const item of items) item.myReaction = 0;
    for (const row of reactionRows.values()) {
      row.comment.myReaction = 0;
      if (row.alive()) row.update();
    }
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
      composer.append(
        element("p", "ryd-discussion-gate", t("gate")),
        element("p", "ryd-discussion-why", extensionText("paidFeaturesWhy")),
      );
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

  function retainFocus() {
    const active = document.activeElement;
    if (!root.contains(active)) return () => {};
    const selection =
      typeof active.selectionStart === "number"
        ? [active.selectionStart, active.selectionEnd, active.selectionDirection]
        : null;
    return () => {
      if (!active.isConnected || document.activeElement === active) return;
      active.focus({ preventScroll: true });
      if (selection) active.setSelectionRange(...selection);
    };
  }

  function orderNodes(host, nodes) {
    const restoreFocus = retainFocus();
    const retained = new Set(nodes);
    for (const child of [...host.children]) if (!retained.has(child)) child.remove();
    let next = host.firstElementChild;
    for (const node of nodes) {
      if (node === next) next = next.nextElementSibling;
      else host.insertBefore(node, next);
    }
    restoreFocus();
  }

  function mergeComment(comment, incoming, mutationSnapshot) {
    const reaction = { likes: comment.likes, dislikes: comment.dislikes, myReaction: comment.myReaction };
    Object.assign(comment, incoming);
    if ((localReactionVersions.get(comment.id) || 0) > mutationSnapshot) Object.assign(comment, reaction);
  }

  function createReplyThread(comment) {
    const rootId = comment.id;
    const node = element("div", "ryd-discussion-replies");
    const views = new Map();
    let rootRow;
    let showReplies;
    let repliesCursor = null;
    let replyLoading = false;
    let repliesLoaded = false;
    const collapsedOwners = new Set();
    let orderedReplies = [];
    let singleReplyOwners = new Set();
    let pathGroups = new Map();
    let pointerPath = null;
    let focusedPath = null;
    let activePath = null;
    let detachPathEvents = () => {};
    const moreReplies = button(
      t("moreReplies"),
      () => loadReplies(true),
      "ryd-discussion-button ryd-discussion-reply-more",
    );
    moreReplies.dataset.replyPathOwner = rootId;
    const hideReplies = button(
      t("collapseReplies"),
      () => thread.toggle(rootId),
      "ryd-discussion-button ryd-discussion-reply-hide",
    );
    hideReplies.dataset.action = "collapse-replies";
    hideReplies.dataset.replyOwnerId = rootId;
    hideReplies.dataset.replyPathOwner = rootId;
    hideReplies.setAttribute("aria-expanded", "true");
    const alive = () => current() && rootRow?.isConnected && rootReplyHandlers.get(rootId) === thread;
    function pathAt(target) {
      const segment = target?.closest?.("[data-reply-path-owner]");
      return segment && rootRow.contains(segment) ? segment : null;
    }
    function highlightPath() {
      const next = pointerPath || focusedPath;
      if (next === activePath) return;
      for (const segment of pathGroups.get(activePath) || []) segment.classList.remove("is-path-highlighted");
      activePath = next;
      for (const segment of pathGroups.get(activePath) || []) segment.classList.add("is-path-highlighted");
    }
    function bindPathEvents(row) {
      detachPathEvents();
      const handlers = {
        pointerover(event) {
          pointerPath = pathAt(event.target)?.dataset.replyPathOwner || null;
          highlightPath();
        },
        pointerout(event) {
          if (!pathAt(event.target)) return;
          pointerPath = pathAt(event.relatedTarget)?.dataset.replyPathOwner || null;
          highlightPath();
        },
        pointerleave() {
          pointerPath = null;
          highlightPath();
        },
        focusin(event) {
          focusedPath = pathAt(event.target)?.dataset.replyPathOwner || null;
          highlightPath();
        },
        focusout(event) {
          focusedPath = pathAt(event.relatedTarget)?.dataset.replyPathOwner || null;
          highlightPath();
        },
        click(event) {
          const segment = pathAt(event.target);
          if (!segment || segment.tagName === "BUTTON") return;
          event.preventDefault();
          thread.toggle(segment.dataset.replyPathOwner);
        },
      };
      for (const [type, handler] of Object.entries(handlers)) row.addEventListener(type, handler);
      detachPathEvents = () => {
        for (const [type, handler] of Object.entries(handlers)) row.removeEventListener(type, handler);
      };
    }
    function refreshPathGroups() {
      for (const segment of pathGroups.get(activePath) || []) segment.classList.remove("is-path-highlighted");
      pathGroups = new Map();
      for (const segment of rootRow.querySelectorAll("[data-reply-path-owner]")) {
        const hidden = segment.closest("[hidden]");
        if (hidden && rootRow.contains(hidden)) continue;
        const owner = segment.dataset.replyPathOwner;
        if (!pathGroups.has(owner)) pathGroups.set(owner, []);
        pathGroups.get(owner).push(segment);
      }
      if (!pathGroups.has(pointerPath)) pointerPath = null;
      focusedPath = pathAt(document.activeElement)?.dataset.replyPathOwner || null;
      activePath = null;
      highlightPath();
    }
    function pathSegment(row, className, enabled, owner) {
      let segment = [...row.children].find((child) => child.classList.contains(className));
      if (!enabled) {
        segment?.remove();
        return;
      }
      if (!segment) {
        segment = element("span", className);
        segment.setAttribute("aria-hidden", "true");
        row.append(segment);
      }
      segment.dataset.replyPathOwner = owner;
    }
    function refreshParentContext(row, reply) {
      const context = row.querySelector(".ryd-discussion-reply-context");
      const targetId = reply.replyToId || rootId;
      const target = targetId === rootId ? comment : views.get(targetId)?.comment;
      context.dataset.replyToId = targetId;
      context.dataset.replyPathOwner = targetId;
      context.classList.toggle("ryd-discussion-parent-missing", !target);
      context.textContent = target ? "" : t("replyContext");
      context.title = t(target ? "collapseReplies" : "replyContext");
      context.setAttribute("aria-label", context.title);
      if (target) context.setAttribute("aria-expanded", String(!collapsedOwners.has(targetId)));
      else context.removeAttribute("aria-expanded");
    }
    function refreshDisclosure(row, owner, hasChildren) {
      const collapsed = collapsedOwners.has(owner);
      row.dataset.replyCollapsed = String(collapsed);
      if (owner === rootId) return;
      let reopen = [...row.children].find((child) => child.classList.contains("ryd-discussion-reply-reopen"));
      if (!reopen && collapsed && hasChildren) {
        reopen = button("", () => thread.toggle(owner), "ryd-discussion-button ryd-discussion-reply-reopen");
        reopen.dataset.action = "toggle-replies";
        reopen.dataset.replyOwnerId = owner;
        reopen.dataset.replyPathOwner = owner;
        row.append(reopen);
      }
      if (!reopen) return;
      reopen.hidden = !collapsed || !hasChildren;
      reopen.textContent = t(singleReplyOwners.has(owner) ? "viewReply" : "viewReplies");
      reopen.setAttribute("aria-label", reopen.textContent);
      reopen.setAttribute("aria-expanded", "false");
    }
    function revealCollapsedOwner(ownerRow, disclosure) {
      if (!disclosure) return;
      const ownerBounds = ownerRow.getBoundingClientRect();
      const disclosureBounds = disclosure.getBoundingClientRect();
      const drawerBounds = surface === "shorts" ? root.getBoundingClientRect() : null;
      const top = drawerBounds
        ? drawerBounds.top
        : Math.max(0, document.querySelector("ytd-masthead")?.getBoundingClientRect().bottom || 0);
      const bottom = drawerBounds ? drawerBounds.bottom : window.innerHeight;
      if (ownerBounds.top >= top && disclosureBounds.bottom <= bottom) return;
      if (drawerBounds)
        root.scrollTop += ownerBounds.top < top ? ownerBounds.top - top : disclosureBounds.bottom - bottom;
      else ownerRow.scrollIntoView?.({ block: "nearest" });
    }
    function retainVisibleFocus(active) {
      const hidden = active?.closest?.("[hidden]");
      if (!hidden || !rootRow.contains(hidden)) return;
      let owner = active.closest(".ryd-discussion-comment")?.dataset.commentId;
      const visited = new Set();
      while (owner && !visited.has(owner)) {
        visited.add(owner);
        const ownerRow = owner === rootId ? rootRow : views.get(owner)?.node;
        if (collapsedOwners.has(owner) && ownerRow && !ownerRow.hidden) {
          const disclosure = [...ownerRow.children].find((child) =>
            child.classList.contains("ryd-discussion-reply-reopen"),
          );
          if (disclosure && !disclosure.hidden) {
            disclosure.focus({ preventScroll: true });
            revealCollapsedOwner(ownerRow, disclosure);
            return;
          }
        }
        if (owner === rootId) break;
        owner = views.get(owner)?.comment.replyToId || rootId;
      }
    }
    const thread = {
      node,
      get row() {
        return rootRow;
      },
      get(id) {
        return views.get(id)?.comment;
      },
      toggle(owner) {
        const ownerRow = owner === rootId ? rootRow : views.get(owner)?.node;
        if (owner === rootId && !views.size && !repliesLoaded && comment.replyCount) {
          void loadReplies();
          return;
        }
        if (!ownerRow || (owner === rootId ? !views.size : ownerRow.dataset.replyHasChildren !== "true")) return;
        focusSequence++;
        const active = document.activeElement;
        const collapsed = !collapsedOwners.has(owner);
        if (collapsed) collapsedOwners.add(owner);
        else collapsedOwners.delete(owner);
        thread.clearPaths();
        thread.render(false);
        const reopen = [...ownerRow.children].find((child) => child.classList.contains("ryd-discussion-reply-reopen"));
        if (active && rootRow.contains(active) && (active.closest("[hidden]") || !collapsed)) {
          const destination = collapsed ? reopen : ownerRow;
          if (destination) {
            destination.tabIndex = -1;
            if (collapsed) destination.removeAttribute("tabindex");
            destination.focus({ preventScroll: true });
          }
        }
        if (collapsed) revealCollapsedOwner(ownerRow, reopen);
      },
      activateParent(reply) {
        const owner = reply.replyToId || rootId;
        if (owner === rootId || views.has(owner)) thread.toggle(owner);
        else void focusComment(owner);
      },
      reveal(id) {
        if (id === rootId || !views.has(id)) return;
        let owner = views.get(id).comment.replyToId || rootId;
        let changed = collapsedOwners.delete(rootId);
        const visited = new Set([id, rootId]);
        while (owner && !visited.has(owner)) {
          visited.add(owner);
          changed = collapsedOwners.delete(owner) || changed;
          const parent = views.get(owner)?.comment;
          if (!parent) break;
          owner = parent.replyToId || rootId;
        }
        if (changed) thread.render(false);
      },
      attach(row) {
        rootRow = row;
        bindPathEvents(row);
        showReplies = button(
          t("replies", [comment.replyCount || 0]),
          () => (collapsedOwners.has(rootId) ? thread.toggle(rootId) : loadReplies()),
          "ryd-discussion-button ryd-discussion-reply-reopen",
        );
        showReplies.dataset.action = "load-replies";
        showReplies.dataset.replyOwnerId = rootId;
        showReplies.dataset.replyPathOwner = rootId;
        showReplies.setAttribute("aria-label", t("loadReplies", [comment.replyCount || 0]));
        showReplies.setAttribute("aria-expanded", "false");
        showReplies.hidden = repliesLoaded || !comment.replyCount;
        showReplies.disabled = replyLoading;
        row.append(showReplies);
        thread.refreshCount();
      },
      clearPaths() {
        pointerPath = null;
        focusedPath = null;
        highlightPath();
      },
      refreshCount() {
        comment.replyCount = Math.max(comment.replyCount || 0, views.size);
        if (!showReplies) return;
        showReplies.textContent = t("replies", [comment.replyCount]);
        showReplies.setAttribute("aria-label", t("loadReplies", [comment.replyCount]));
        showReplies.dataset.action = collapsedOwners.has(rootId) ? "toggle-replies" : "load-replies";
        showReplies.hidden = (repliesLoaded && !collapsedOwners.has(rootId)) || !comment.replyCount;
        showReplies.disabled = replyLoading && !collapsedOwners.has(rootId);
        if (!repliesLoaded && !views.size) {
          const initialReplies = Boolean(comment.replyCount);
          rootRow.dataset.replyHasChildren = String(initialReplies);
          pathSegment(rootRow, "ryd-discussion-reply-stem", initialReplies, rootId);
          refreshPathGroups();
        }
      },
      refreshRootContexts() {
        for (const view of views.values())
          if (!view.comment.replyToId || view.comment.replyToId === rootId)
            refreshParentContext(view.node, view.comment);
      },
      merge(comments, mutationSnapshot = commentMutationSequence) {
        for (const incoming of comments) {
          if (incoming.id === rootId || incoming.parentId !== rootId) continue;
          const view = views.get(incoming.id);
          if (view) {
            if ((localCommentVersions.get(incoming.id) || 0) > mutationSnapshot) continue;
            mergeComment(view.comment, incoming, mutationSnapshot);
            view.node = commentPresentations.get(view.node)?.() || view.node;
          } else views.set(incoming.id, { comment: incoming, node: commentRow(incoming, rootId, thread) });
        }
        thread.render();
      },
      replace(updated, row) {
        views.set(updated.id, { comment: updated, node: row });
        thread.render();
      },
      render(reorder = true) {
        const activeBeforeRender = document.activeElement;
        if (reorder) {
          orderedReplies = orderReplies(
            [...views.values()].map((view) => view.comment),
            rootId,
            { rootContinuation: repliesLoaded },
          );
          singleReplyOwners = new Set();
          for (let index = 0; index < orderedReplies.length; index++) {
            const item = orderedReplies[index];
            if (
              orderedReplies[index + 1]?.depth > item.depth &&
              (!orderedReplies[index + 2] || orderedReplies[index + 2].depth <= item.depth)
            )
              singleReplyOwners.add(item.comment.id);
          }
        }
        const ordered = orderedReplies;
        thread.refreshCount();
        const rootCollapsed = collapsedOwners.has(rootId);
        node.hidden = rootCollapsed;
        rootRow.dataset.replyHasChildren = String(
          ordered.some(({ comment: reply }) => !reply.replyToId || reply.replyToId === rootId),
        );
        pathSegment(rootRow, "ryd-discussion-reply-stem", rootRow.dataset.replyHasChildren === "true", rootId);
        refreshDisclosure(rootRow, rootId, views.size > 0);
        let hiddenBelowDepth = rootCollapsed ? 0 : null;
        const rows = ordered.map(
          ({ comment: reply, depth, partial, hasNextSibling, hasChildren, continuationPaths }) => {
            const row = views.get(reply.id).node;
            if (hiddenBelowDepth !== null && depth <= hiddenBelowDepth) hiddenBelowDepth = null;
            row.hidden = hiddenBelowDepth !== null;
            if (!row.hidden && collapsedOwners.has(reply.id)) hiddenBelowDepth = depth;
            row.dataset.replyDepth = String(depth);
            row.style.setProperty("--ryd-reply-depth", String(depth));
            row.dataset.replyContext = partial ? "partial" : "complete";
            row.dataset.replyHasSibling = String(hasNextSibling);
            row.dataset.replyHasChildren = String(hasChildren);
            pathSegment(row, "ryd-discussion-reply-stem", hasChildren, reply.id);
            refreshDisclosure(row, reply.id, hasChildren);
            pathSegment(row, "ryd-discussion-reply-continuation", hasNextSibling, reply.replyToId || rootId);
            const rails = new Map(
              [...row.querySelectorAll(":scope > .ryd-discussion-reply-rail")].map((rail) => [
                Number(rail.dataset.replyRailDepth),
                rail,
              ]),
            );
            for (const { depth: railDepth, ownerId } of continuationPaths) {
              if (rails.has(railDepth)) {
                rails.get(railDepth).dataset.replyPathOwner = ownerId;
                rails.delete(railDepth);
                continue;
              }
              const rail = element("span", "ryd-discussion-reply-rail");
              rail.dataset.replyRailDepth = String(railDepth);
              rail.dataset.replyPathOwner = ownerId;
              rail.style.setProperty("--ryd-rail-depth", String(railDepth));
              rail.setAttribute("aria-hidden", "true");
              row.append(rail);
            }
            for (const rail of rails.values()) rail.remove();
            refreshParentContext(row, reply);
            return row;
          },
        );
        if (repliesCursor) rows.push(moreReplies);
        else if (repliesLoaded && views.size) rows.push(hideReplies);
        moreReplies.hidden = rootCollapsed;
        hideReplies.hidden = rootCollapsed;
        orderNodes(node, rows);
        refreshPathGroups();
        retainVisibleFocus(activeBeforeRender);
        thread.refreshCount();
      },
      add(created) {
        if (!alive()) return;
        if (!views.has(created.id)) comment.replyCount = (comment.replyCount || 0) + 1;
        thread.merge([created]);
        if (!repliesLoaded) void loadReplies();
      },
    };
    async function loadReplies(append = false) {
      if (replyLoading || !alive()) return;
      replyLoading = true;
      const mutationSnapshot = commentMutationSequence;
      showReplies.disabled = true;
      moreReplies.disabled = true;
      try {
        const result = await request("replies", {
          rootId,
          ...(append && repliesCursor ? { cursor: repliesCursor } : {}),
        });
        if (!alive()) return;
        repliesCursor = result.nextCursor;
        repliesLoaded = true;
        thread.merge(result.items || [], mutationSnapshot);
      } catch (error) {
        if (alive()) setError(error);
      } finally {
        showReplies.disabled = false;
        moreReplies.disabled = false;
        replyLoading = false;
      }
    }
    return thread;
  }

  function commentRow(comment, rootId = comment.parentId || comment.id, existingThread = null) {
    const thread = existingThread || (comment.parentId ? rootReplyHandlers.get(rootId) : createReplyThread(comment));
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
    const edited = element("span", "ryd-discussion-meta", t("edited"));
    edited.hidden = !comment.editedAt;
    heading.append(edited);
    const text = element(
      "p",
      "ryd-discussion-comment-text",
      comment.deleted || comment.hidden ? t("deleted") : comment.text,
    );
    const actions = element("div", "ryd-discussion-comment-actions");
    const notice = statusNode();
    const controls = element("div", "ryd-discussion-inline-editor");
    if (comment.parentId) {
      const context = button("", () => thread.activateParent(comment), "ryd-discussion-reply-context");
      context.dataset.action = "reply-context";
      row.append(context);
    }
    row.append(heading, text, actions, notice, controls);
    if (!comment.parentId) row.append(thread.node);
    const alive = () => current() && row.isConnected;
    let updateReactions = () => {};
    const visibility = () => `${Boolean(comment.deleted)}:${Boolean(comment.hidden)}:${comment.author?.id || ""}`;
    const renderedVisibility = visibility();
    function replaceComment(updated, local = true) {
      if (local) localCommentVersions.set(comment.id, ++commentMutationSequence);
      Object.assign(comment, updated);
      const restoreFocus = retainFocus();
      const replacement = commentRow(comment, rootId, thread);
      row.replaceWith(replacement);
      if (comment.parentId) thread.replace(comment, replacement);
      else thread.render();
      restoreFocus();
      return replacement;
    }
    commentPresentations.set(row, () => {
      if (renderedVisibility !== visibility()) return replaceComment(comment, false);
      heading.querySelector(".ryd-discussion-avatar").textContent = (comment.author?.nickname || "RYD")
        .slice(0, 1)
        .toUpperCase();
      heading.querySelector(".ryd-discussion-author").textContent = comment.author?.nickname || t("deleted");
      date.textContent = shortDate(comment.createdAt, discussionLanguage());
      date.dateTime = comment.createdAt;
      edited.hidden = !comment.editedAt;
      text.textContent = comment.deleted || comment.hidden ? t("deleted") : comment.text;
      updateReactions();
      if (!comment.parentId) {
        thread.refreshCount();
        thread.refreshRootContexts();
      }
      return row;
    });
    if (!comment.deleted && !comment.hidden) {
      const ownComment = isOwnComment(comment);
      function reactionNode(value) {
        if (ownComment) {
          const count = element("span", "ryd-discussion-reaction-count");
          count.dataset.reactionCount = String(value);
          count.setAttribute("role", "img");
          return count;
        }
        const reaction = button("", () => react(comment.id, value), "ryd-discussion-button ryd-discussion-reaction");
        reaction.dataset.reaction = String(value);
        return reaction;
      }
      const reactions = new Map([1, -1].map((value) => [value, reactionNode(value)]));
      actions.append(...reactions.values());
      updateReactions = () => {
        for (const [value, reaction] of reactions) {
          const liked = value === 1;
          const count = liked ? comment.likes || 0 : comment.dislikes || 0;
          reaction.replaceChildren(thumbIcon(!liked), element("span", "", count.toLocaleString(discussionLanguage())));
          reaction.setAttribute("aria-label", `${t(liked ? "like" : "dislike")} (${count})`);
          if (!ownComment) reaction.setAttribute("aria-pressed", String(comment.myReaction === value));
        }
      };
      if (!ownComment) reactionRows.set(comment.id, { comment, actions, notice, alive, update: updateReactions });
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
              rootReplyHandlers.get(rootId)?.add(created);
            },
          }),
        );
        controls.querySelector("textarea")?.focus();
      });
      reply.dataset.action = "reply";
      actions.append(reply);
      const canEdit = ownComment && !session.profile?.suspended;
      const canDelete = ownComment;
      if (canEdit) {
        const edit = button(t("edit"), () => {
          controls.replaceChildren(
            commentForm({
              comment,
              onCancel: () => controls.replaceChildren(),
              onSaved: (updated) => {
                replaceComment(updated);
              },
            }),
          );
          controls.querySelector("textarea")?.focus();
        });
        edit.dataset.action = "edit";
        actions.append(edit);
      }
      if (canDelete) {
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
                  replaceComment(updated);
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
      if (session.authenticated) {
        const report = button(t("report"), () => showReport(comment, controls));
        report.dataset.action = "report";
        actions.append(report);
      }
    }
    if (!comment.parentId) {
      rootReplyHandlers.set(comment.id, thread);
      thread.attach(row);
    }
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

  function renderComments(preserve = false) {
    if (!preserve) {
      for (const thread of rootReplyHandlers.values()) thread.clearPaths();
      rootReplyHandlers.clear();
      reactionRows.clear();
      list.replaceChildren(...items.map((item) => commentRow(item)));
      return;
    }
    const ids = new Set(items.map((item) => item.id));
    for (const id of rootReplyHandlers.keys()) if (!ids.has(id)) rootReplyHandlers.delete(id);
    orderNodes(
      list,
      items.map((item) => {
        const row = rootReplyHandlers.get(item.id)?.row;
        return row ? commentPresentations.get(row)?.() || row : commentRow(item);
      }),
    );
  }

  function renderSort() {
    for (const option of sortButtons) option.setAttribute("aria-pressed", String(option.dataset.sort === sortOrder));
  }

  function selectSort(value) {
    if (value === sortOrder) return;
    sortOrder = value;
    renderSort();
    load();
  }

  async function load(append = false) {
    if (!current()) return;
    const currentSequence = ++sequence;
    const focusSnapshot = append ? focusSequence : ++focusSequence;
    const mutationSnapshot = commentMutationSequence;
    if (!append) {
      highlightedId = null;
      for (const thread of rootReplyHandlers.values()) thread.clearPaths();
    }
    status.textContent = t("loading");
    refresh.disabled = true;
    more.disabled = true;
    try {
      const result = await request("comments", { videoId, sort: sortOrder, ...(append && cursor ? { cursor } : {}) });
      if (!current() || currentSequence !== sequence) return;
      const preserve = append || focusSequence !== focusSnapshot;
      const existing = new Map(items.map((item) => [item.id, item]));
      const received = (result.items || []).map((incoming) => {
        const previous = existing.get(incoming.id);
        if (!previous) return incoming;
        if ((localCommentVersions.get(incoming.id) || 0) <= mutationSnapshot)
          mergeComment(previous, incoming, mutationSnapshot);
        return previous;
      });
      const focusedRoot = preserve
        ? items.find((item) => item.id === highlightedId || rootReplyHandlers.get(item.id)?.get(highlightedId))
        : null;
      const nextItems = append ? [...items, ...received] : received;
      if (focusedRoot && !nextItems.some((item) => item.id === focusedRoot.id)) nextItems.push(focusedRoot);
      items = [...new Map(nextItems.map((item) => [item.id, item])).values()];
      cursor = result.nextCursor;
      renderComments(preserve);
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

  function focusRenderedComment(id) {
    const focused = [...list.querySelectorAll("[data-comment-id]")].find((item) => item.dataset.commentId === id);
    if (!focused) return false;
    for (const thread of rootReplyHandlers.values())
      if (thread.get(id)) {
        thread.reveal(id);
        break;
      }
    highlightedId = id;
    for (const row of list.querySelectorAll("[data-comment-id]"))
      row.classList.toggle("is-highlighted", row === focused);
    showTab("discussion", false);
    focused.scrollIntoView?.({ block: "center", behavior: "smooth" });
    focused.tabIndex = -1;
    focused.focus({ preventScroll: true });
    return true;
  }

  async function focusComment(id) {
    if (!isDiscussionCommentId(id)) return;
    const focus = ++focusSequence;
    const account = accountGeneration;
    const mutationSnapshot = commentMutationSequence;
    const stillCurrent = () => current() && focus === focusSequence && account === accountGeneration;
    if (focusRenderedComment(id)) return;
    try {
      const target = await request("comment", { id });
      if (!stillCurrent() || target.id !== id || target.videoId !== videoId) return;
      const threadRoot = target.parentId
        ? items.find((item) => item.id === target.parentId) || (await request("comment", { id: target.parentId }))
        : target;
      if (
        !stillCurrent() ||
        threadRoot.videoId !== videoId ||
        threadRoot.parentId ||
        threadRoot.id !== (target.parentId || target.id)
      )
        return;
      const ancestors = target.parentId ? [target] : [];
      const visited = new Set([target.id, threadRoot.id]);
      let ancestorId = target.replyToId;
      for (let count = 0; ancestorId && !visited.has(ancestorId) && count < MAX_FOCUS_ANCESTORS; count++) {
        if (!isDiscussionCommentId(ancestorId)) break;
        visited.add(ancestorId);
        let ancestor;
        try {
          ancestor =
            rootReplyHandlers.get(threadRoot.id)?.get(ancestorId) || (await request("comment", { id: ancestorId }));
        } catch (_) {
          break;
        }
        if (!stillCurrent()) return;
        if (ancestor.id !== ancestorId || ancestor.videoId !== videoId || ancestor.parentId !== threadRoot.id) break;
        ancestors.push(ancestor);
        ancestorId = ancestor.replyToId;
      }
      if (!stillCurrent()) return;
      showTab("discussion", false);
      if (!items.some((item) => item.id === threadRoot.id)) {
        items.unshift(threadRoot);
        list.prepend(commentRow(threadRoot));
      }
      rootReplyHandlers.get(threadRoot.id)?.merge(ancestors, mutationSnapshot);
      focusRenderedComment(id);
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
    },
    setPermissions({ reactions }) {
      const allowed = reactions === true;
      if (reactionsAllowed === allowed) return;
      reactionsAllowed = allowed;
      if (reactionsAllowed) {
        clearReactionConsentPrompts();
        performPendingReaction();
      } else clearOwnReactions();
    },
    destroy() {
      disposed = true;
      sequence++;
      moderationSequence++;
      pendingReaction = null;
      reactionRows.clear();
      localCommentVersions.clear();
      localReactionVersions.clear();
      drafts.clear();
      postingIds.clear();
      inbox.destroy();
      root.remove();
    },
  };
}
