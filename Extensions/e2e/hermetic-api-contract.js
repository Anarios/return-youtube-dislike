const assert = require("node:assert/strict");

const API_METHODS_BY_PATH = Object.freeze({
  "/configs/selectors": Object.freeze(["GET"]),
  "/interact/confirmVote": Object.freeze(["POST"]),
  "/interact/vote": Object.freeze(["POST"]),
  "/puzzle/registration": Object.freeze(["GET", "POST"]),
  "/votes": Object.freeze(["GET"]),
});

const WORKER_SIGNAL_PATH = "/__ryd_e2e/worker-signal";

function allowedMethodsForPath(pathname) {
  if (pathname === WORKER_SIGNAL_PATH) return ["POST"];
  return API_METHODS_BY_PATH[pathname] ?? [];
}

function isAllowedApiPreflight(pathname, requestedMethod) {
  if (typeof requestedMethod !== "string" || requestedMethod.trim() === "") return false;
  return allowedMethodsForPath(pathname).includes(requestedMethod.toUpperCase());
}

function assertExactSuccessfulVotesTraffic(records, expectedVideoIds, label = "The hermetic runtime") {
  assert.ok(Array.isArray(records), `${label} has no recorded API traffic.`);
  assert.ok(Array.isArray(expectedVideoIds), `${label} has no expected /votes request sequence.`);
  const votes = records.filter((record) => record.method === "GET" && record.pathname === "/votes");
  assert.deepEqual(
    votes.map((record) => record.query?.videoId),
    expectedVideoIds,
    `${label} emitted a missing, duplicate, or stale /votes request.`,
  );
  for (const [index, record] of votes.entries()) {
    const videoId = expectedVideoIds[index];
    assert.equal(record.responseStatus, 200, `${label} /votes request for ${videoId} did not receive HTTP 200.`);
    assert.ok(
      Number.isFinite(record.respondedAt),
      `${label} /votes request for ${videoId} did not finish before the contract completed.`,
    );
  }
  return votes;
}

module.exports = {
  API_METHODS_BY_PATH,
  WORKER_SIGNAL_PATH,
  allowedMethodsForPath,
  assertExactSuccessfulVotesTraffic,
  isAllowedApiPreflight,
};
