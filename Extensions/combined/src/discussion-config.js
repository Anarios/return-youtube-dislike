import { getApiUrl } from "./config";

const testOrigin = typeof __RYD_DISCUSSION_TEST_ORIGIN__ === "string" ? __RYD_DISCUSSION_TEST_ORIGIN__ : "";

export const discussionConfig = Object.freeze({
  apiOrigin: testOrigin || getApiUrl(),
  testMode: Boolean(testOrigin),
  authStorageKey: testOrigin ? "rydDiscussionTestAuth" : null,
  credentialStorageKey: "rydDiscussionTestCredentials",
  stateStorageKey: testOrigin ? "rydDiscussionTestState" : "rydDiscussionState",
});
