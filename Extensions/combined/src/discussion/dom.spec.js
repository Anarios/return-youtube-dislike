/** @jest-environment jsdom */

import { discussionLinkTarget, isDiscussionCommentId, threadUrl } from "./dom";

const videoId = "abcdefghijk";
const commentId = "11111111-1111-4111-8111-111111111111";

test("notification links carry a validated fragment through a native video URL", () => {
  const url = threadUrl({ videoId, commentId });
  expect(new URL(url).searchParams.has("rydComment")).toBe(false);
  expect(discussionLinkTarget(url)).toEqual({ videoId, commentId });
  expect(discussionLinkTarget(`https://www.youtube.com/shorts/${videoId}#rydComment=${commentId}`)).toEqual({
    videoId,
    commentId,
  });
  expect(discussionLinkTarget(`https://www.youtube.com/watch?v=${videoId}&rydComment=${commentId}`)).toEqual({
    videoId,
    commentId,
  });
});

test.each([
  `https://example.com/watch?v=${videoId}#rydComment=${commentId}`,
  `http://www.youtube.com/watch?v=${videoId}#rydComment=${commentId}`,
  `https://www.youtube.com/feed?v=${videoId}#rydComment=${commentId}`,
  `https://www.youtube.com/watch?v=short#rydComment=${commentId}`,
  `https://www.youtube.com/watch?v=${videoId}#rydComment=${"-".repeat(36)}`,
  "javascript:alert(1)",
])("rejects an invalid discussion destination: %s", (url) => {
  expect(discussionLinkTarget(url)).toBeNull();
});

test("UUID validation rejects same-length malformed identifiers", () => {
  expect(isDiscussionCommentId(commentId)).toBe(true);
  expect(isDiscussionCommentId("1".repeat(36))).toBe(false);
  expect(threadUrl({ videoId, commentId: "-".repeat(36) })).toBeNull();
});
