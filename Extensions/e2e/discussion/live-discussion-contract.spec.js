const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const {
  bounded,
  localClient,
  poll,
  solve,
  runLiveDiscussionMatrix,
  assertLocalRuntime,
  createFixtureCleanup,
} = require("./live-discussion-contract");

test("the mutation client rejects non-loopback origins before doing any work", () => {
  expect(() => localClient("https://returnyoutubedislikeapi.com", {})).toThrow(/loopback/);
  expect(() => localClient("http://name:password@127.0.0.1:5099", {})).toThrow(/Invalid loopback/);
});

test("a hanging probe cannot exceed the finite poll budget", async () => {
  const started = Date.now();
  await expect(poll(() => new Promise(() => {}), Boolean, "Probe stuck", 30)).rejects.toThrow(/exceeded/);
  expect(Date.now() - started).toBeLessThan(1000);
});

test("bounded propagates real failures and clears its timeout after success", async () => {
  await expect(bounded(() => 7, "Immediate", 30)).resolves.toBe(7);
  await expect(
    bounded(
      () => {
        throw new Error("Actual failure");
      },
      "Fail",
      30,
    ),
  ).rejects.toThrow("Actual failure");
});

test("the local solver returns the four-byte SHA-512 proof format", () => {
  const challenge = Buffer.alloc(16, 1).toString("base64");
  const solution = Buffer.from(solve(challenge, 4), "base64");
  expect(solution.length).toBe(4);
  const digest = crypto
    .createHash("sha512")
    .update(Buffer.concat([solution, Buffer.from(challenge, "base64")]))
    .digest();
  expect(digest[0] >>> 4).toBe(0);
  expect(() => solve(challenge, 99)).toThrow(/difficulty/);
});

test("staged runs reject invalid surfaces before touching a browser", async () => {
  await expect(runLiveDiscussionMatrix({ language: "en", surfaces: ["mobile"], page: {}, popup: {} })).rejects.toThrow(
    /Invalid surfaces/,
  );
  await expect(
    runLiveDiscussionMatrix({ language: "en", surfaces: ["watch"], stages: ["unknown"], page: {}, popup: {} }),
  ).rejects.toThrow(/Invalid stages/);
});

test("discussion create requests default to the implemented 200 response and ledger omits credentials", async () => {
  const previousFetch = global.fetch;
  const ledger = [];
  global.fetch = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ id: "created" }) });
  try {
    const request = localClient("http://127.0.0.1:5099", { writer: { sessionToken: "test-session" } }, (entry) =>
      ledger.push(entry),
    );
    await expect(
      request("/videos/abcdefghijk/comments", { account: "writer", method: "POST", body: { text: "Local text" } }),
    ).resolves.toEqual({ id: "created" });
    expect(global.fetch.mock.calls[0][0]).toBe("http://127.0.0.1:5099/api/discussion/videos/abcdefghijk/comments");
    expect(JSON.stringify(ledger)).not.toContain("test-session");
    expect(ledger).toEqual([
      { source: "loopback-client", method: "POST", path: "/api/discussion/videos/abcdefghijk/comments", status: 200 },
    ]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("the runtime guard requires both generated local artifact evidence and the local host marker", () => {
  const runtime = {
    buildId: "a".repeat(32),
    extensionId: "fixture-extension",
    localOriginMatched: true,
    localHostPermission: true,
  };
  expect(assertLocalRuntime("http://127.0.0.1:5099", runtime, { localTestMode: true })).toEqual({
    buildId: "a".repeat(32),
    extensionId: "fixture-extension",
    origin: "http://127.0.0.1:5099",
  });
  expect(() => assertLocalRuntime("https://example.com", runtime, { localTestMode: true })).toThrow(/loopback/);
  expect(() => assertLocalRuntime("http://127.0.0.1:5099", runtime, {})).toThrow(/host marker/);
  for (const override of [{ buildId: null }, { localOriginMatched: false }, { localHostPermission: false }])
    expect(() =>
      assertLocalRuntime("http://127.0.0.1:5099", { ...runtime, ...override }, { localTestMode: true }),
    ).toThrow();
});

test("fixture cleanup restores moderation state and deletes replies before roots with their own authors", async () => {
  const comments = new Map([
    ["root", { id: "root", text: "Root", parentId: null, deleted: false }],
    ["reply", { id: "reply", text: "Reply", parentId: "root", deleted: false }],
  ]);
  const request = jest.fn(async (route, options = {}) => {
    const id = route.split("/").at(-1);
    if (route.startsWith("/comments/")) {
      if (options.method === "DELETE") comments.set(id, { ...comments.get(id), text: "", deleted: true });
      return comments.get(id);
    }
    return {};
  });
  const cleanup = createFixtureCleanup(request);
  cleanup.remember(comments.get("root"), "commenter");
  cleanup.remember(comments.get("reply"), "other");
  cleanup.hidden.add("root");
  cleanup.suspended.add("author");
  const results = await cleanup.run();
  expect(results.every((value) => value.passed)).toBe(true);
  expect(request.mock.calls.slice(0, 2).map(([route]) => route)).toEqual([
    "/moderation/comments/root",
    "/moderation/profiles/author/suspension",
  ]);
  expect(
    request.mock.calls
      .filter(([, options]) => options.method === "DELETE")
      .map(([route, options]) => [route, options.account]),
  ).toEqual([
    ["/comments/reply", "other"],
    ["/comments/root", "commenter"],
  ]);
});

test("fixture cleanup discovers a committed UI post whose response was lost, without deleting unrelated rows", async () => {
  const created = { id: "lost-response", text: "Unique attempt marker", deleted: false };
  const request = jest.fn(async (route, options = {}) => {
    if (route.startsWith("/videos/")) return { items: [created, { id: "unrelated", text: "Someone else" }] };
    if (options.method === "DELETE") Object.assign(created, { deleted: true, text: "" });
    return created;
  });
  const cleanup = createFixtureCleanup(request);
  cleanup.pending.push({ label: "pending-root", videoId: "abcdefghijk", text: created.text, account: "commenter" });
  expect((await cleanup.run()).every((value) => value.passed)).toBe(true);
  expect(request.mock.calls.filter(([, options]) => options.method === "DELETE").map(([route]) => route)).toEqual([
    "/comments/lost-response",
  ]);
});

test("fixture cleanup reports a failed deletion and still attempts the remaining comments", async () => {
  const deleted = new Set();
  const request = jest.fn(async (route, options = {}) => {
    const id = route.split("/").at(-1);
    if (id === "bad") throw new Error("Local failure");
    if (options.method === "DELETE") deleted.add(id);
    return { id, deleted: deleted.has(id), text: deleted.has(id) ? "" : "Body" };
  });
  const cleanup = createFixtureCleanup(request);
  cleanup.remember({ id: "bad" }, "commenter");
  cleanup.remember({ id: "good" }, "commenter");
  const results = await cleanup.run();
  expect(results.find((item) => item.name === "delete-created:bad").passed).toBe(false);
  expect(results.find((item) => item.name === "delete-created:good").passed).toBe(true);
});

test("a rejected runtime guard cannot switch accounts or make a mutation request", async () => {
  const previousFetch = global.fetch;
  const mkdir = jest.spyOn(fs, "mkdir").mockResolvedValue(undefined);
  const writeFile = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined);
  global.fetch = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ localTestMode: true }) });
  const context = { on: jest.fn(), off: jest.fn() };
  const page = {
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    context: () => context,
    on: jest.fn(),
    off: jest.fn(),
  };
  const popup = {
    setDefaultTimeout: jest.fn(),
    evaluate: jest
      .fn()
      .mockResolvedValue({ buildId: "a".repeat(32), localOriginMatched: false, localHostPermission: true }),
  };
  const setAccount = jest.fn();
  try {
    await expect(
      runLiveDiscussionMatrix({
        page,
        popup,
        setAccount,
        accounts: {},
        origin: "http://127.0.0.1:5099",
        language: "en",
        outputDirectory: "unused",
        stages: ["authoring"],
      }),
    ).rejects.toThrow(/requested local discussion origin/);
    expect(setAccount).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].method).toBe("GET");
    const receipt = JSON.parse(writeFile.mock.calls[0][1]);
    expect(receipt.cleanupResults).toEqual([]);
    expect(receipt.stageResults.find((value) => value.surface === "watch" && value.stage === "authoring").status).toBe(
      "not-completed",
    );
  } finally {
    global.fetch = previousFetch;
    mkdir.mockRestore();
    writeFile.mockRestore();
  }
});
