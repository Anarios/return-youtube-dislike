const MAX_REPLY_RAIL_DEPTH = 4;

function timestamp(value) {
  return String(value).replace(/(?:\.(\d+))?Z$/, (_, fraction = "") => `.${fraction.padEnd(9, "0")}Z`);
}

export function orderReplies(replies, rootId, { rootContinuation = false } = {}) {
  const comments = [...new Map(replies.filter((item) => item.id !== rootId).map((item) => [item.id, item])).values()];
  comments.sort((a, b) => timestamp(a.createdAt).localeCompare(timestamp(b.createdAt)) || a.id.localeCompare(b.id));
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const children = new Map();
  const roots = [];
  for (const comment of comments) {
    if (comment.replyToId && comment.replyToId !== rootId && byId.has(comment.replyToId)) {
      if (!children.has(comment.replyToId)) children.set(comment.replyToId, []);
      children.get(comment.replyToId).push(comment);
    } else roots.push(comment);
  }
  const ordered = [];
  const visited = new Set();
  function visit(start, partial, hasNextSibling = false) {
    const stack = [{ comment: start, depth: 1, parent: null, partial, hasNextSibling, continuationPaths: [] }];
    while (stack.length) {
      const item = stack.pop();
      if (visited.has(item.comment.id)) continue;
      visited.add(item.comment.id);
      ordered.push(item);
      const descendants = children.get(item.comment.id) || [];
      item.hasChildren = descendants.some((descendant) => !visited.has(descendant.id));
      const continuationPaths =
        item.hasNextSibling && item.depth <= MAX_REPLY_RAIL_DEPTH
          ? [...item.continuationPaths, { depth: item.depth, ownerId: item.parent?.id || rootId }]
          : item.continuationPaths;
      for (let index = descendants.length - 1; index >= 0; index--)
        stack.push({
          comment: descendants[index],
          depth: item.depth + 1,
          parent: item.comment,
          partial: item.partial,
          hasNextSibling: index < descendants.length - 1,
          continuationPaths,
        });
    }
  }
  let lastRootChild = null;
  for (const comment of roots) if (!comment.replyToId || comment.replyToId === rootId) lastRootChild = comment;
  for (const comment of roots) {
    const partial = Boolean(comment.replyToId && comment.replyToId !== rootId);
    visit(comment, partial, !partial && (comment !== lastRootChild || rootContinuation));
  }
  for (const comment of comments) if (!visited.has(comment.id)) visit(comment, true);
  return ordered;
}
