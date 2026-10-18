const fs = require("node:fs");
const path = require("node:path");
const { devices, test, expect } = require("@playwright/test");
const {
  HermeticExtensionArtifactAdapter,
  isArtifactVoteHandshakeValid,
  readArtifactVoteHandshake,
  startHermeticApiServer,
} = require("../hermetic-artifact-smoke");
const { VIDEO_A, VIDEO_B, openNavigationFixture, openWatchFixture } = require("../../UserScript/e2e/harness");
const { LIVE_RUNTIME_PROFILES } = require("../live-runtime-adapter");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const MOBILE_VIEWPORT = Object.freeze({ height: 844, width: 390 });
const MOBILE_CONTEXT_OPTIONS = Object.freeze({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  screen: MOBILE_VIEWPORT,
  userAgent: devices["Pixel 5"].userAgent,
  viewport: MOBILE_VIEWPORT,
});
const COUNTS = Object.freeze({
  [VIDEO_A]: Object.freeze({ dislikes: 11, likes: 89 }),
  [VIDEO_B]: Object.freeze({ dislikes: 35, likes: 65 }),
});
const CONSOLE_FAILURE_TYPES = new Set(["assert", "error", "warning"]);

function testFailed(testInfo, caughtError) {
  return Boolean(caughtError) || (testInfo.status && testInfo.status !== testInfo.expectedStatus);
}

async function attachFailureEvidence(runtime, testInfo) {
  const diagnostics = {
    backgroundRequests: runtime.apiServer.records.map(({ body, method, pathname, query, responseStatus }) => ({
      body,
      method,
      pathname,
      query,
      responseStatus,
    })),
    blockedRequests: runtime.adapter.backend?.blockedRequests ?? [],
    pageSignals: runtime.adapter.pageSignals?.snapshot() ?? null,
    routedRequests:
      runtime.adapter.backend?.requests?.map(({ body, method, pathname, query, responseStatus }) => ({
        body,
        method,
        pathname,
        query,
        responseStatus,
      })) ?? [],
    unexpectedBackgroundRequests: runtime.apiServer.unexpectedRequests,
    workerConsoleFailures: runtime.workerConsoleFailures,
  };
  await testInfo.attach("mobile-extension-diagnostics", {
    body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
    contentType: "application/json",
  });

  if (!runtime.page || runtime.page.isClosed()) return;
  const screenshotPath = testInfo.outputPath("mobile-extension-failure.png");
  await runtime.page.screenshot({ fullPage: true, path: screenshotPath }).catch(() => {});
  if (fs.existsSync(screenshotPath)) {
    await testInfo.attach("mobile-extension-page", { contentType: "image/png", path: screenshotPath });
  }
}

async function withMobileExtension(testInfo, run) {
  if (!fs.existsSync(path.join(EXTENSION_ARTIFACT, "manifest.json"))) {
    throw new Error(
      `The generated Chrome extension artifact is missing at ${EXTENSION_ARTIFACT}. ` +
        "Run the extension production build first or set RYD_EXTENSION_ARTIFACT.",
    );
  }

  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions: { countsByVideo: COUNTS },
    contextOptions: MOBILE_CONTEXT_OPTIONS,
  });
  const runtime = { adapter, apiServer, caughtError: null, page: null, workerConsoleFailures: [] };

  try {
    await adapter.start();
    runtime.page = adapter.page;
    adapter.worker.on("console", (message) => {
      if (CONSOLE_FAILURE_TYPES.has(message.type())) {
        runtime.workerConsoleFailures.push({ text: message.text(), type: message.type() });
      }
    });
    await adapter.context.addInitScript(() => {
      globalThis.__rydMobileActivationSignals = { click: 0, touchend: 0, touchstart: 0 };
      for (const eventName of ["click", "touchend", "touchstart"]) {
        document.addEventListener(
          eventName,
          (event) => {
            if (event.target instanceof Element && event.target.closest("dislike-button-view-model")) {
              globalThis.__rydMobileActivationSignals[eventName] += 1;
            }
          },
          true,
        );
      }
    });
    const mobileRuntime = await runtime.page.evaluate(() => ({
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgent: navigator.userAgent,
    }));
    expect(mobileRuntime.userAgent).toMatch(/Android/i);
    expect(mobileRuntime.maxTouchPoints).toBeGreaterThan(0);
    expect(mobileRuntime.coarsePointer).toBe(true);
    await run(runtime);
    await assertHermeticRuntime(runtime, testInfo.title);
  } catch (error) {
    runtime.caughtError = error;
    throw error;
  } finally {
    if (adapter.context && testFailed(testInfo, runtime.caughtError)) {
      await attachFailureEvidence(runtime, testInfo).catch(() => {});
    }
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

async function assertHermeticRuntime(runtime, scenarioId) {
  await runtime.adapter.pageSignals.assertClean(scenarioId);
  expect(runtime.workerConsoleFailures, "the MV3 background worker emitted a console failure").toEqual([]);
  expect(runtime.adapter.backend.blockedRequests, "the page escaped the hermetic route set").toEqual([]);
  expect(runtime.apiServer.unexpectedRequests, "the background worker escaped the fake protocol").toEqual([]);
}

async function expectVisibleReactionPair(root, { dislikes, likes }) {
  const like = root.locator(":scope > like-button-view-model");
  const dislike = root.locator(":scope > dislike-button-view-model");
  const controls = root.locator(":scope > like-button-view-model, :scope > dislike-button-view-model");
  const buttons = controls.locator("button");

  await expect(root).toHaveCount(1);
  await expect(root).toBeVisible();
  await expect(controls, "the mobile reaction surface must contain exactly Like and Dislike").toHaveCount(2);
  await expect(buttons, "each mobile reaction control must expose one activation button").toHaveCount(2);
  await expect(like).toBeVisible();
  await expect(dislike).toBeVisible();
  await expect(like.locator("button")).toBeVisible();
  await expect(dislike.locator("button")).toBeVisible();
  await expect(like.locator("#text, [role='text']").first()).toHaveText(String(likes));
  await expect(dislike.locator("#text, [role='text']").first()).toHaveText(String(dislikes));
  await expect(like.locator("button")).toHaveAttribute("aria-label", /like/i);
  await expect(dislike.locator("button")).toHaveAttribute("aria-label", /dislike/i);

  const boxes = await buttons.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, width: box.width };
    }),
  );
  expect(boxes).toHaveLength(2);
  for (const box of boxes) {
    expect(box.height).toBeGreaterThan(0);
    expect(box.width).toBeGreaterThan(0);
  }
}

function statsRequests(runtime, videoId) {
  return runtime.adapter.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === videoId);
}

function interactionRecords(runtime, startIndex) {
  return runtime.apiServer.records
    .slice(startIndex)
    .filter(
      (record) => record.method === "POST" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
    );
}

test.describe("generated extension artifact on the mobile YouTube hostname", () => {
  test("direct mobile Watch renders the complete reaction surface at compact width", async ({}, testInfo) => {
    await withMobileExtension(testInfo, async (runtime) => {
      await openWatchFixture(runtime.page, VIDEO_A, { hostname: "m.youtube.com" });

      await expect(runtime.page).toHaveURL(
        (url) => url.hostname === "m.youtube.com" && url.searchParams.get("v") === VIDEO_A,
      );
      const mobileActionBar = runtime.page.locator('.slim-video-action-bar-actions[data-fixture-shell="mobile"]');
      await expect(mobileActionBar).toBeVisible();
      await expectVisibleReactionPair(mobileActionBar.locator(":scope > .segmented-buttons"), COUNTS[VIDEO_A]);
      expect(statsRequests(runtime, VIDEO_A)).toHaveLength(1);
      await expect(runtime.page.locator(".ryd-tooltip, #ryd-bar-container, #ryd-bar")).toHaveCount(0);
      expect(interactionRecords(runtime, 0)).toHaveLength(0);
    });
  });

  test("native-dependent mobile Shorts compatibility binds B and submits one dislike handshake", async ({}, testInfo) => {
    await withMobileExtension(testInfo, async (runtime) => {
      await openNavigationFixture(runtime.page, {
        hostname: "m.youtube.com",
        pageKind: "shorts",
        videoId: VIDEO_A,
      });

      await expect(runtime.page).toHaveURL(
        (url) => url.hostname === "m.youtube.com" && url.pathname === `/shorts/${VIDEO_A}`,
      );
      expect(LIVE_RUNTIME_PROFILES.extension.capabilities.shortsControlModelBySurface).toEqual({
        desktop: "synthetic-owned",
        mobile: "native-youtube-required",
      });
      expect(
        await runtime.page.evaluate(() => globalThis.__navigationFixtureBaseline.renderedMobileShortsNativeDislikes),
        "this scenario is native-host compatibility, not absent-native mobile coverage",
      ).toBe(1);
      const rendererA = runtime.page.locator(`ytm-reel-video-renderer[video-id="${VIDEO_A}"]`);
      await expect(rendererA).toHaveAttribute("is-active", "");
      await expect(rendererA).toBeVisible();
      await expectVisibleReactionPair(rendererA.locator("ytm-like-button-renderer"), COUNTS[VIDEO_A]);
      await expect(rendererA.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
      expect(statsRequests(runtime, VIDEO_A)).toHaveLength(1);

      await runtime.page.locator("#short-next").click();

      await expect(runtime.page).toHaveURL(
        (url) => url.hostname === "m.youtube.com" && url.pathname === `/shorts/${VIDEO_B}`,
      );
      const activeB = runtime.page.locator(`ytm-reel-video-renderer[video-id="${VIDEO_B}"][is-active]`);
      await expect(runtime.page.locator("ytm-reel-video-renderer[is-active]")).toHaveCount(1);
      await expect(runtime.page.locator("ytm-reel-video-renderer:visible")).toHaveCount(1);
      await expect(rendererA).not.toHaveAttribute("is-active", "");
      await expect(rendererA).toBeHidden();
      await expect(activeB).toBeVisible();
      const controlsB = activeB.locator("ytm-like-button-renderer");
      await expectVisibleReactionPair(controlsB, COUNTS[VIDEO_B]);
      await expect(activeB.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
      expect(statsRequests(runtime, VIDEO_A)).toHaveLength(1);
      expect(statsRequests(runtime, VIDEO_B)).toHaveLength(1);

      const interactionStartIndex = runtime.apiServer.records.length;
      expect(interactionRecords(runtime, 0)).toHaveLength(0);
      const dislikeButton = controlsB.locator(":scope > dislike-button-view-model button");
      const dislikeBox = await dislikeButton.boundingBox();
      expect(dislikeBox, "the active mobile Shorts Dislike button must have a tappable box").not.toBeNull();
      await runtime.page.touchscreen.tap(dislikeBox.x + dislikeBox.width / 2, dislikeBox.y + dislikeBox.height / 2);
      await expect
        .poll(() =>
          isArtifactVoteHandshakeValid(
            readArtifactVoteHandshake(runtime.apiServer.records, interactionStartIndex, VIDEO_B, -1),
          ),
        )
        .toBe(true);
      await runtime.page.waitForTimeout(400);

      const handshake = readArtifactVoteHandshake(runtime.apiServer.records, interactionStartIndex, VIDEO_B, -1);
      expect(handshake).toMatchObject({
        confirmationCount: 1,
        expectedValue: -1,
        expectedVideoId: VIDEO_B,
        interactionCount: 2,
        interactionPaths: ["/interact/vote", "/interact/confirmVote"],
        voteCount: 1,
      });
      expect(handshake.vote.body).toEqual({
        userId: expect.stringMatching(/^[A-Za-z0-9]{36}$/),
        value: -1,
        videoId: VIDEO_B,
      });
      expect(handshake.vote).toMatchObject({ responded: true, responseStatus: 200 });
      expect(handshake.confirmation.body).toEqual({
        solution: expect.any(String),
        userId: handshake.vote.body.userId,
        videoId: VIDEO_B,
      });
      expect(Buffer.from(handshake.confirmation.body.solution, "base64")).toHaveLength(4);
      expect(handshake.confirmation).toMatchObject({ responded: true, responseBody: true, responseStatus: 200 });
      expect(interactionRecords(runtime, interactionStartIndex)).toHaveLength(2);
      expect(interactionRecords(runtime, 0)).toHaveLength(2);
      await expect
        .poll(() => runtime.page.evaluate(() => ({ ...globalThis.__rydMobileActivationSignals })))
        .toEqual({ click: 1, touchend: 1, touchstart: 1 });
      expect(runtime.adapter.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
      expect(runtime.adapter.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

      await expectVisibleReactionPair(controlsB, {
        dislikes: COUNTS[VIDEO_B].dislikes + 1,
        likes: COUNTS[VIDEO_B].likes,
      });
      await expect(rendererA.locator('[data-fixture-role="dislike"] #text')).toHaveText(
        String(COUNTS[VIDEO_A].dislikes),
      );
      expect(statsRequests(runtime, VIDEO_A)).toHaveLength(1);
      expect(statsRequests(runtime, VIDEO_B)).toHaveLength(1);
    });
  });
});
