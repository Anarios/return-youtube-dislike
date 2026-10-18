const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const {
  HermeticExtensionArtifactAdapter,
  SPA_COUNTS,
  isArtifactVoteHandshakeValid,
  readArtifactVoteHandshake,
  startHermeticApiServer,
} = require("../hermetic-artifact-smoke");
const { assertInvariantContinuously } = require("../continuous-invariants");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);

async function readCurrentWatch(adapter) {
  return adapter.page.evaluate(() => {
    const rendered = (element) => {
      if (!element?.isConnected || element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const watch = [...document.querySelectorAll("ytd-watch-flexy, ytd-watch-grid")].find(rendered);
    const actions = watch && [...watch.querySelectorAll("#top-level-buttons-computed")].find(rendered);
    const dislike = actions?.querySelector("dislike-button-view-model");
    const nativeButton = dislike?.querySelector("button");
    const count = dislike?.querySelector(
      "#text, [role='text'], .ytSpecButtonShapeNextButtonTextContent, .yt-spec-button-shape-next__button-text-content",
    );
    return {
      count: count?.textContent?.trim() ?? "",
      currentVideoId: watch?.getAttribute("video-id") ?? null,
      nativeDislikePressed: nativeButton?.getAttribute("aria-pressed") ?? null,
      nativeDislikeVisible: rendered(nativeButton),
      ownedVisibleBarCount: [...(actions?.querySelectorAll("#ryd-bar") ?? [])].filter(rendered).length,
      urlVideoId: new URL(location.href).searchParams.get("v"),
    };
  });
}

function voteDataRequests(adapter) {
  return adapter.backend.requestsFor("GET", "/votes");
}

async function withExtension(testInfo, run, backendOptions = {}) {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions,
  });
  const heldRequests = [];
  const deferVotes = () => {
    const held = adapter.deferNextStatsRequest();
    const pending = { held, seen: false };
    void held.seen.then(() => {
      pending.seen = true;
    });
    heldRequests.push(pending);
    return held;
  };
  try {
    await adapter.start();
    adapter.page.setDefaultTimeout(5_000);
    await run({ adapter, apiServer, deferVotes });
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
  } catch (error) {
    if (adapter.page && !adapter.page.isClosed()) {
      await testInfo.attach("initialization-race", {
        body: await adapter.page.screenshot(),
        contentType: "image/png",
      });
      await testInfo.attach("initialization-race-diagnostics", {
        body: JSON.stringify({
          watch: await readCurrentWatch(adapter),
          requests: voteDataRequests(adapter).map(({ at, query, respondedAt, responseStatus }) => ({
            at,
            query,
            respondedAt,
            responseStatus,
          })),
          interactions: apiServer.records
            .filter(({ pathname }) => pathname.startsWith("/interact/"))
            .map(({ pathname, body, respondedAt, responseStatus }) => ({
              pathname,
              videoId: body?.videoId,
              value: body?.value,
              respondedAt,
              responseStatus,
            })),
          signals: adapter.pageSignals.snapshot(),
        }),
        contentType: "application/json",
      });
    }
    throw error;
  } finally {
    // A navigation may cancel the browser request while its fake response is held.
    // Unblock the route during teardown without requiring that cancelled response to finish.
    for (const { held, seen } of heldRequests) {
      if (!held.released && seen) {
        held.release({ body: { dislikes: 999, likes: 1 } });
      }
    }
    await adapter.close();
    await apiServer.close();
  }
}

async function expectWatchRemains(adapter, videoId, count) {
  return assertInvariantContinuously({
    durationMs: 1_000,
    label: `Watch ${videoId} retains its current response`,
    read: () => readCurrentWatch(adapter),
    isValid: (snapshot) =>
      snapshot.urlVideoId === videoId &&
      snapshot.currentVideoId === videoId &&
      snapshot.count === String(count) &&
      snapshot.nativeDislikeVisible &&
      snapshot.ownedVisibleBarCount === 1,
  });
}

test("clearing a native Dislike clicked before initial counts settle submits a neutral vote", async ({}, testInfo) => {
  await withExtension(testInfo, async ({ adapter, apiServer, deferVotes }) => {
    const held = deferVotes();
    await adapter.openWatch(VIDEO_A);
    await expect.poll(() => voteDataRequests(adapter).length).toBe(1);
    const dislike = adapter.page.locator("ytd-watch-flexy #top-row dislike-button-view-model button");
    await dislike.click();
    expect(await readCurrentWatch(adapter)).toMatchObject({ nativeDislikePressed: "true", ownedVisibleBarCount: 0 });
    expect(apiServer.records.filter(({ pathname }) => pathname.startsWith("/interact/"))).toEqual([]);

    held.release({ body: { dislikes: 25, likes: 100, rating: 4.5 } });
    await adapter.waitForWatchResult(VIDEO_A);
    expect(await readCurrentWatch(adapter)).toMatchObject({ nativeDislikePressed: "true" });

    const interactionStart = apiServer.records.length;
    await dislike.click();
    expect(await readCurrentWatch(adapter)).toMatchObject({ nativeDislikePressed: "false" });
    const readHandshake = () => readArtifactVoteHandshake(apiServer.records, interactionStart, VIDEO_A, 0);
    await expect.poll(() => isArtifactVoteHandshakeValid(readHandshake())).toBe(true);
    await assertInvariantContinuously({
      durationMs: 1_000,
      label: "Clearing the pending native Dislike submits exactly one neutral vote and confirmation",
      read: readHandshake,
      isValid: isArtifactVoteHandshakeValid,
    });
    expect(voteDataRequests(adapter)).toHaveLength(1);
    await adapter.assertNoPageSignals("native-reaction-during-initial-votes");
  });
});

test("destination initializes while the initial outgoing votes request remains pending", async ({}, testInfo) => {
  await withExtension(
    testInfo,
    async ({ adapter, deferVotes }) => {
      const held = deferVotes();
      await adapter.openSpaWatch(VIDEO_A);
      await expect.poll(() => voteDataRequests(adapter).length).toBe(1);
      await adapter.navigateSpaWatchWhilePending(VIDEO_A, VIDEO_B);

      const result = await adapter.waitForWatchResult(VIDEO_B);
      expect(result.count).toBe(String(SPA_COUNTS[VIDEO_B].dislikes));
      expect(held.released).toBe(false);
      expect(voteDataRequests(adapter).map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B]);
      await expectWatchRemains(adapter, VIDEO_B, SPA_COUNTS[VIDEO_B].dislikes);

      held.release({ body: { dislikes: 999, likes: 1, rating: 1 } });
      await expectWatchRemains(adapter, VIDEO_B, SPA_COUNTS[VIDEO_B].dislikes);
      expect(voteDataRequests(adapter)).toHaveLength(2);
      await adapter.assertNoPageSignals("pending-initial-votes-do-not-block-destination");
    },
    { countsByVideo: SPA_COUNTS },
  );
});

test("the watchdog initializes B with A pending when navigation emits no events", async ({}, testInfo) => {
  await withExtension(
    testInfo,
    async ({ adapter, deferVotes }) => {
      const held = deferVotes();
      await adapter.openSpaWatch(VIDEO_A);
      await expect.poll(() => voteDataRequests(adapter).length).toBe(1);
      await adapter.page.evaluate((videoId) => {
        globalThis.__navigationFixture.navigate("watch", videoId, { dispatchEvent: false });
      }, VIDEO_B);

      const result = await adapter.waitForWatchResult(VIDEO_B);
      expect(result.count).toBe(String(SPA_COUNTS[VIDEO_B].dislikes));
      expect(held.released).toBe(false);
      expect(voteDataRequests(adapter).map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B]);
      await expectWatchRemains(adapter, VIDEO_B, SPA_COUNTS[VIDEO_B].dislikes);

      held.release({ body: { dislikes: 999, likes: 1, rating: 1 } });
      await expectWatchRemains(adapter, VIDEO_B, SPA_COUNTS[VIDEO_B].dislikes);
      expect(voteDataRequests(adapter)).toHaveLength(2);
      await adapter.assertNoPageSignals("watchdog-recovers-pending-initial-votes-without-navigation-events");
    },
    { countsByVideo: SPA_COUNTS },
  );
});

test("navigation start does not restart outgoing A while the URL change is delayed", async ({}, testInfo) => {
  await withExtension(
    testInfo,
    async ({ adapter, deferVotes }) => {
      const held = deferVotes();
      await adapter.openSpaWatch(VIDEO_A);
      await expect.poll(() => voteDataRequests(adapter).length).toBe(1);
      await adapter.page.evaluate(() => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
      });

      await assertInvariantContinuously({
        durationMs: 750,
        label: "Navigation start suppresses outgoing requests before the URL changes",
        read: async () => ({ watch: await readCurrentWatch(adapter), requestCount: voteDataRequests(adapter).length }),
        isValid: ({ watch, requestCount }) =>
          requestCount === 1 &&
          watch.urlVideoId === VIDEO_A &&
          watch.currentVideoId === VIDEO_A &&
          watch.ownedVisibleBarCount === 0,
      });
      await adapter.page.evaluate((videoId) => {
        globalThis.__navigationFixture.navigate("watch", videoId);
      }, VIDEO_B);

      const result = await adapter.waitForWatchResult(VIDEO_B);
      expect(result.count).toBe(String(SPA_COUNTS[VIDEO_B].dislikes));
      expect(held.released).toBe(false);
      expect(voteDataRequests(adapter).map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B]);
      held.release({ body: { dislikes: 999, likes: 1, rating: 1 } });
      await expectWatchRemains(adapter, VIDEO_B, SPA_COUNTS[VIDEO_B].dislikes);
      expect(voteDataRequests(adapter)).toHaveLength(2);
      await adapter.assertNoPageSignals("navigation-start-does-not-restart-outgoing-initial-votes");
    },
    { countsByVideo: SPA_COUNTS },
  );
});

test("returning to A ignores the first A response still pending from before B", async ({}, testInfo) => {
  await withExtension(
    testInfo,
    async ({ adapter, deferVotes }) => {
      const firstA = deferVotes();
      await adapter.openSpaWatch(VIDEO_A);
      await expect.poll(() => voteDataRequests(adapter).length).toBe(1);
      await adapter.navigateSpaWatchWhilePending(VIDEO_A, VIDEO_B);
      await adapter.waitForWatchResult(VIDEO_B);

      await adapter.page.evaluate((videoId) => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        globalThis.__navigationFixture.navigate("watch", videoId);
      }, VIDEO_A);
      const result = await adapter.waitForWatchResult(VIDEO_A);
      expect(result.count).toBe(String(SPA_COUNTS[VIDEO_A].dislikes));
      expect(firstA.released).toBe(false);
      expect(voteDataRequests(adapter).map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B, VIDEO_A]);

      firstA.release({ body: { dislikes: 999, likes: 1, rating: 1 } });
      await expectWatchRemains(adapter, VIDEO_A, SPA_COUNTS[VIDEO_A].dislikes);
      expect(voteDataRequests(adapter)).toHaveLength(3);
      await adapter.assertNoPageSignals("first-A-response-cannot-overwrite-returned-A");
    },
    { countsByVideo: SPA_COUNTS },
  );
});

test("HTTP 503 remains unavailable without automatic retries until a manual reload", async ({}, testInfo) => {
  await withExtension(testInfo, async ({ adapter }) => {
    adapter.backend.enqueue("GET", "/votes", { status: 503, body: { error: "test unavailable" } });
    await adapter.openWatch(VIDEO_A);
    await expect.poll(async () => (await readCurrentWatch(adapter)).count).toBe("Temporarily Unavailable");
    expect(voteDataRequests(adapter)[0].responseStatus).toBe(503);

    await assertInvariantContinuously({
      durationMs: 2_500,
      label: "HTTP 503 does not automatically retry across initialization watchdog cycles",
      read: async () => ({ watch: await readCurrentWatch(adapter), requestCount: voteDataRequests(adapter).length }),
      isValid: ({ watch, requestCount }) =>
        requestCount === 1 &&
        watch.count === "Temporarily Unavailable" &&
        watch.nativeDislikeVisible &&
        watch.ownedVisibleBarCount === 0,
    });

    await adapter.page.reload();
    const result = await adapter.waitForWatchResult(VIDEO_A);
    expect(result.count).toBe("25");
    expect(voteDataRequests(adapter).map(({ responseStatus }) => responseStatus)).toEqual([503, 200]);

    const { page } = adapter.pageSignals.snapshot();
    expect(page.pageErrors).toEqual([]);
    expect(page.unhandledRejections).toEqual([]);
    expect(page.consoleErrors).toHaveLength(1);
    expect(page.consoleErrors[0]).toMatchObject({
      location: { url: voteDataRequests(adapter)[0].url },
      text: "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
      type: "error",
    });
    await adapter.workerSignals.assertClean("expected-503-without-retries");
  });
});
