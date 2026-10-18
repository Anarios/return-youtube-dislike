const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  VIDEO_B,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openNavigationFixture,
  openShortsFixture,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const COUNTS = {
  [VIDEO_A]: { dislikes: 11, likes: 100 },
  [VIDEO_B]: { dislikes: 22, likes: 200 },
};

async function launchNavigationHarness({ context, page }, initialPage = {}, { beforeInject } = {}) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await context.addInitScript(() => {
    globalThis.__unhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      globalThis.__unhandledRejections.push(reason instanceof Error ? reason.message : String(reason));
    });
  });

  const backend = createFakeBackend({ countsByVideo: COUNTS });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openNavigationFixture(page, initialPage);
  if (beforeInject) await beforeInject(page);
  await injectGeneratedUserscript(page);
  return { backend, consoleErrors, pageErrors };
}

async function expectWatchInitialized(page, videoId, expectedDislikes = COUNTS[videoId].dislikes) {
  const expectedCount = String(expectedDislikes);
  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === videoId);
  await expect(page.locator(`ytd-watch-flexy[video-id="${videoId}"]`)).toHaveCount(1);
  await expect(page.locator('[data-fixture-page-kind="watch"] [data-fixture-role="buttons"]')).toHaveCount(1);
  await expect(page.locator('[data-fixture-page-kind="watch"] [data-fixture-role="dislike"] #text')).toHaveText(
    expectedCount,
  );
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(1);
  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
}

async function expectShortInitialized(page, videoId, expectedDislikes = COUNTS[videoId].dislikes) {
  const expectedCount = String(expectedDislikes);
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${videoId}`);
  const activeRenderer = page.locator(`ytd-reel-video-renderer[video-id="${videoId}"][is-active]`);
  await expect(page.locator("ytd-shorts")).toHaveCount(1);
  await expect(activeRenderer).toHaveCount(1);
  await expect(
    page.locator('ytd-reel-video-renderer[is-active] reel-action-bar-view-model[data-fixture-role="buttons"]'),
  ).toHaveCount(1);
  const syntheticDislike = activeRenderer.locator("[data-ryd-synthetic-shorts-dislike]");
  await expect(syntheticDislike).toHaveCount(1);
  await expect(syntheticDislike).toBeVisible();
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await expect(syntheticDislike).toHaveAttribute("data-ryd-video-id", videoId);
  await expect(syntheticDislike.locator("button")).toBeEnabled();
  await expect(syntheticDislike.locator("#text")).toHaveText(expectedCount);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
  await expect(page.locator(".ryd-tooltip")).toHaveCount(0);
}

async function expectMobileShortInitialized(page, videoId, expectedDislikes = COUNTS[videoId].dislikes) {
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${videoId}`);
  const activeShort = page.locator(`[data-fixture-mobile-short="${videoId}"][is-active]`);
  await expect(activeShort).toHaveCount(1);
  await expect(activeShort).toBeVisible();
  await expect(page.locator("[data-fixture-mobile-short][is-active]:visible")).toHaveCount(1);
  await expect(activeShort.locator('ytm-like-button-renderer[data-fixture-role="buttons"]')).toHaveCount(1);
  await expect(activeShort.locator('[data-fixture-role="dislike"] #text')).toHaveText(String(expectedDislikes));
  await expect(activeShort.locator('[data-fixture-role="dislike"] button')).toBeEnabled();
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
}

async function expectOneActivation(page, backend, videoId) {
  const voteCount = backend.requestsFor("POST", "/interact/vote").length;
  const confirmationCount = backend.requestsFor("POST", "/interact/confirmVote").length;
  await page
    .locator('[data-fixture-role="dislike"]:visible button, [data-ryd-synthetic-shorts-dislike]:visible button')
    .click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(confirmationCount + 1);
  await page.waitForTimeout(600);

  const votes = backend.requestsFor("POST", "/interact/vote");
  const confirmations = backend.requestsFor("POST", "/interact/confirmVote");
  expect(votes).toHaveLength(voteCount + 1);
  expect(confirmations).toHaveLength(confirmationCount + 1);
  expect(votes.at(-1).body).toMatchObject({ videoId, value: -1 });
  expect(confirmations.at(-1).body).toMatchObject({ videoId });
}

async function expectHealthyRuntime(page, harness) {
  expect(harness.backend.blockedRequests).toEqual([]);
  expect(harness.consoleErrors).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
  expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
}

test("cold channel reload then immediate Short link initializes delayed Shorts controls once", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page });

  await page.reload({ waitUntil: "domcontentloaded" });
  await injectGeneratedUserscript(page);
  await page.locator("#channel-short").click();

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_A}`);
  const decoyDislikeCount = page.locator('[data-fixture-decoy-controls] [data-fixture-role="dislike"] #text');
  await page.waitForTimeout(250);
  await expect(decoyDislikeCount).toHaveText("");
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(0);

  await expectShortInitialized(page, VIDEO_A);
  await expectOneActivation(page, harness.backend, VIDEO_A);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("the live read-only prelude leaves one native Shorts Like activation", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page });

  await page.reload({ waitUntil: "domcontentloaded" });
  await injectGeneratedUserscript(page);
  await page.locator("#channel-short").click();
  await expectShortInitialized(page, VIDEO_A);
  await page.locator("#short-next").click();
  await expectShortInitialized(page, VIDEO_B);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
  await expectHealthyRuntime(page, harness);

  const responsiveViewports = [
    { height: 720, width: 1280 },
    { height: 720, width: 768 },
    { height: 844, width: 390 },
  ];
  for (const [index, viewport] of responsiveViewports.entries()) {
    await page.setViewportSize(viewport);
    await openNavigationFixture(page, { pageKind: "watch", videoId: VIDEO_A });
    await injectGeneratedUserscript(page);
    await expectWatchInitialized(page, VIDEO_A);
    if (index === 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await injectGeneratedUserscript(page);
      await expectWatchInitialized(page, VIDEO_A);
    }

    await openNavigationFixture(page, { pageKind: "shorts", videoId: VIDEO_A });
    await injectGeneratedUserscript(page);
    await expectShortInitialized(page, VIDEO_A);
    expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
    expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
    await expectHealthyRuntime(page, harness);
  }

  await page.setViewportSize({ height: 720, width: 1280 });
  await openNavigationFixture(page, { pageKind: "watch", videoId: VIDEO_A });
  await injectGeneratedUserscript(page);
  await expectWatchInitialized(page, VIDEO_A);
  await page.locator("#watch-next").click();
  await expectWatchInitialized(page, VIDEO_B);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
  await expectHealthyRuntime(page, harness);

  await openShortsFixture(page, VIDEO_A);
  await injectGeneratedUserscript(page);
  const finalShort = page.locator(`[data-short-video="${VIDEO_A}"]:not([hidden])`);
  const nativeLike = finalShort.locator('[data-ryd-role="like"] button');
  await expect(finalShort.locator("[data-ryd-synthetic-shorts-dislike] #text")).toHaveText(
    String(COUNTS[VIDEO_A].dislikes),
  );
  await expect(nativeLike).toHaveAttribute("aria-pressed", "false");
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

  await nativeLike.click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await page.waitForTimeout(600);

  const votes = harness.backend.requestsFor("POST", "/interact/vote");
  const confirmations = harness.backend.requestsFor("POST", "/interact/confirmVote");
  expect(votes).toHaveLength(1);
  expect(confirmations).toHaveLength(1);
  expect(votes[0].body).toEqual({ userId: EXISTING_CREDENTIALS.userId, videoId: VIDEO_A, value: 1 });
  expect(confirmations[0].body).toMatchObject({ userId: EXISTING_CREDENTIALS.userId, videoId: VIDEO_A });
  await expect(nativeLike).toHaveAttribute("aria-pressed", "true");
  await expect(finalShort.locator("[data-ryd-synthetic-shorts-dislike] button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expectHealthyRuntime(page, harness);
});

test("inactive sibling identity churn cannot restart cold channel-to-Short hydration", async ({ context, page }) => {
  const harness = await launchNavigationHarness(
    { context, page },
    {},
    {
      beforeInject: (fixturePage) =>
        fixturePage.evaluate((syntheticStateKey) => {
          const originalGetValue = globalThis.GM.getValue;
          let releaseRead;
          const readGate = new Promise((resolve) => {
            releaseRead = resolve;
          });
          const state = {
            count: 0,
            release() {
              releaseRead();
            },
          };
          const delayedGetValue = async (key, fallbackValue) => {
            if (key === syntheticStateKey) {
              state.count += 1;
              await readGate;
            }
            return originalGetValue(key, fallbackValue);
          };
          globalThis.__fixtureSyntheticReadGate = state;
          globalThis.GM.getValue = delayedGetValue;
          globalThis.GM_getValue = delayedGetValue;
        }, `rydSyntheticDislikedShort:${VIDEO_A}`),
    },
  );

  await page.locator("#channel-short").click();
  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_A}`);
  await expect.poll(() => page.evaluate(() => globalThis.__fixtureSyntheticReadGate.count)).toBe(1);

  for (let sequence = 0; sequence < 20; sequence += 1) {
    await page.evaluate((value) => window.__navigationFixture.churnInactiveDesktopShortIdentity(value), sequence);
    await page.waitForTimeout(10);
  }
  await expect(page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_A}"][is-active]`)).toBeVisible();
  await expect(page.locator("ytd-reel-video-renderer:not([is-active])")).toBeHidden();
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A),
  ).toHaveLength(1);

  await page.evaluate(() => globalThis.__fixtureSyntheticReadGate.release());
  await expectShortInitialized(page, VIDEO_A);
  await page.waitForTimeout(600);

  expect(await page.evaluate(() => globalThis.__fixtureSyntheticReadGate.count)).toBe(1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A),
  ).toHaveLength(1);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await expectHealthyRuntime(page, harness);
});

test("channel video link initializes delayed watch controls and one ratio bar", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page });

  await page.locator("#channel-watch").click();

  await expectWatchInitialized(page, VIDEO_A);
  await expectOneActivation(page, harness.backend, VIDEO_A);
  await expectWatchInitialized(page, VIDEO_A, COUNTS[VIDEO_A].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("rendered fixed watch controls initialize without an offset parent", async ({ context, page }) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { pageKind: "watch", videoId: VIDEO_A },
    {
      beforeInject: async (fixturePage) => {
        await fixturePage.evaluate(() => {
          const buttons = document.querySelector('[data-fixture-page-kind="watch"] #top-level-buttons-computed');
          if (!buttons) throw new Error("The fixed-controls fixture has no watch buttons.");
          buttons.style.left = "20px";
          buttons.style.setProperty("position", "fixed", "important");
          buttons.style.top = "120px";
          const rect = buttons.getBoundingClientRect();
          if (buttons.offsetParent !== null || rect.width <= 0 || rect.height <= 0) {
            throw new Error("The fixed-controls fixture did not reproduce positive geometry without offsetParent.");
          }
        });
      },
    },
  );

  await expectWatchInitialized(page, VIDEO_A);
  await expect(page.locator('[data-fixture-page-kind="watch"] #top-level-buttons-computed')).toHaveCSS(
    "position",
    "fixed",
  );
  await expectHealthyRuntime(page, harness);
});

test("watch to Short link switches page kind, identity, and controls", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);

  await page.locator("#watch-to-short").click();

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_B}`);
  await expect(page.locator('[data-fixture-page-kind="watch"] [data-fixture-role="dislike"] #text')).toHaveText("11");
  await page.waitForTimeout(50);
  await expect(page.locator('[data-fixture-page-kind="watch"] [data-fixture-role="dislike"] #text')).toHaveText("11");
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);

  await expectShortInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectShortInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("Short to watch link removes Shorts control and initializes the target bar", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "shorts", videoId: VIDEO_A });
  await expectShortInitialized(page, VIDEO_A);

  await page.locator("#short-to-watch").click();

  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("Short next navigation activates one preloaded sibling control", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "shorts", videoId: VIDEO_A });
  await expectShortInitialized(page, VIDEO_A);
  const preloadedNextRenderer = page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_B}"]`);
  await expect(preloadedNextRenderer).toBeHidden();
  await preloadedNextRenderer.evaluate((renderer) => renderer.setAttribute("data-fixture-preloaded-marker", "true"));

  await page.locator("#short-next").click();

  await expectShortInitialized(page, VIDEO_B);
  await expect(page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_B}"][is-active]`)).toHaveAttribute(
    "data-fixture-preloaded-marker",
    "true",
  );
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectShortInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("delayed Short navigation never retags or submits the outgoing reel as the target video", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "shorts", videoId: VIDEO_A });
  await expectShortInitialized(page, VIDEO_A);
  const outgoingRenderer = page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_A}"][is-active]`);

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedShort(videoId), VIDEO_B);

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_B}`);
  await expect(outgoingRenderer).toBeVisible();
  await expect(outgoingRenderer).toHaveAttribute("video-id", VIDEO_A);
  await expect(outgoingRenderer.locator(`a[href="/shorts/${VIDEO_B}"]`)).toHaveCount(1);
  await expect(page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_B}"]`)).toHaveCount(0);
  await page.waitForTimeout(600);
  await expect(outgoingRenderer).toBeVisible();
  await expect(outgoingRenderer.locator(`[data-ryd-video-id="${VIDEO_B}"]`)).toHaveCount(0);
  await expect(outgoingRenderer.locator("[data-ryd-synthetic-shorts-dislike] #text")).toHaveText("11");
  await outgoingRenderer.locator("[data-ryd-synthetic-shorts-dislike] button").click();
  await page.waitForTimeout(100);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.finishDelayedNavigation());
  await expectShortInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("delayed mobile Short navigation never binds the outgoing renderer to the target video", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { hostname: "m.youtube.com", pageKind: "shorts", videoId: VIDEO_A },
  );
  await expectMobileShortInitialized(page, VIDEO_A);
  const outgoingRenderer = page.locator(`ytm-reel-video-renderer[video-id="${VIDEO_A}"][is-active]`);

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedShort(videoId), VIDEO_B);

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_B}`);
  await expect(outgoingRenderer).toBeVisible();
  await expect(outgoingRenderer).toHaveAttribute("video-id", VIDEO_A);
  await expect(outgoingRenderer.locator("ytm-reel-player-overlay-renderer:not([video-id])")).toHaveCount(1);
  await expect(outgoingRenderer.locator(`a[href="/shorts/${VIDEO_B}"]`)).toHaveCount(1);
  await expect(page.locator(`ytm-reel-video-renderer[video-id="${VIDEO_B}"]`)).toHaveCount(0);
  await page.waitForTimeout(600);
  await expect(outgoingRenderer.locator('[data-fixture-role="dislike"] #text')).toHaveText("11");
  await outgoingRenderer.locator('[data-fixture-role="dislike"] button').click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.finishDelayedNavigation());
  await expectMobileShortInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectMobileShortInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("a metadata-free Short action bar keeps its original fallback ownership across a delayed route", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { pageKind: "shorts", videoId: VIDEO_A },
    {
      beforeInject: (fixturePage) =>
        fixturePage.evaluate(() => window.__navigationFixture.anonymizeActiveDesktopShort()),
    },
  );
  const outgoingRenderer = page.locator("ytd-reel-video-renderer[is-active]:not([video-id])");
  const outgoingDislike = outgoingRenderer.locator("[data-ryd-synthetic-shorts-dislike]");
  await expect(outgoingRenderer).toBeVisible();
  await expect(outgoingRenderer.locator('a[href*="/shorts/"]')).toHaveCount(0);
  await expect(outgoingDislike).toHaveAttribute("data-ryd-video-id", VIDEO_A);
  await expect(outgoingDislike.locator("#text")).toHaveText("11");
  await expect(outgoingDislike.locator("button")).toBeEnabled();

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedAnonymousShort(videoId), VIDEO_B);

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_B}`);
  await page.waitForTimeout(600);
  await expect(outgoingRenderer).toBeVisible();
  await expect(outgoingRenderer.locator(`[data-ryd-video-id="${VIDEO_B}"]`)).toHaveCount(0);
  await expect(outgoingDislike).toHaveAttribute("data-ryd-video-id", VIDEO_A);
  await outgoingDislike.locator("button").click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.finishDelayedNavigation());
  await expectShortInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("a descendant Shorts path is not accepted as the current video identity", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "shorts", videoId: VIDEO_A });
  await expectShortInitialized(page, VIDEO_A);
  const activeRenderer = page.locator(`ytd-reel-video-renderer[video-id="${VIDEO_A}"][is-active]`);

  await page.evaluate((videoId) => window.__navigationFixture.navigateToShortsDescendant(videoId), VIDEO_A);

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_A}/extra`);
  await page.waitForTimeout(600);
  await expect(activeRenderer.locator(`[data-ryd-video-id="${VIDEO_A}/extra"]`)).toHaveCount(0);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === `${VIDEO_A}/extra`),
  ).toHaveLength(0);
  await expectHealthyRuntime(page, harness);
});

test("Short autoplay activates a preloaded sibling reel without a navigation event", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "shorts", videoId: VIDEO_A });
  await expectShortInitialized(page, VIDEO_A);

  await page.evaluate(() => window.__navigationFixture.dispatchEnded());

  await expectShortInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectShortInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("watch next navigation replaces controls and leaves one target bar", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);

  await page.locator("#watch-next").click();

  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("watch SPA navigation refreshes one aligned ratio bar with the target video's data", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  await expect(page.locator("#ryd-dislike-tooltip")).toContainText("100 / 11");

  await page.evaluate(
    ({ fromVideoId, toVideoId }) => {
      const outgoingTopRow = document.querySelector('[data-fixture-page-kind="watch"] #top-row');
      if (!outgoingTopRow?.querySelector("#return-youtube-dislike-bar-container")) {
        throw new Error("The outgoing watch reaction tree has no initialized ratio bar to retain.");
      }
      const retainedOutgoingTree = document.createElement("div");
      retainedOutgoingTree.hidden = true;
      retainedOutgoingTree.setAttribute("data-fixture-retained-watch-video-id", fromVideoId);
      retainedOutgoingTree.appendChild(outgoingTopRow);
      document.body.appendChild(retainedOutgoingTree);
      window.__navigationFixture.navigate("watch", toVideoId);
    },
    { fromVideoId: VIDEO_A, toVideoId: VIDEO_B },
  );

  await expectWatchInitialized(page, VIDEO_B);
  const retainedOutgoingTree = page.locator(`[data-fixture-retained-watch-video-id="${VIDEO_A}"]`);
  const currentControls = page.locator(`[data-fixture-control-video-id="${VIDEO_B}"]`);
  const currentReactionRegion = currentControls.locator("xpath=..");
  const wrapper = currentReactionRegion.locator(":scope > .ryd-tooltip");
  const container = wrapper.locator("#return-youtube-dislike-bar-container");
  const bar = container.locator("#return-youtube-dislike-bar");
  const tooltip = wrapper.locator("#ryd-dislike-tooltip");

  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(1);
  await expect(page.locator("#ryd-dislike-tooltip")).toHaveCount(1);
  await expect(retainedOutgoingTree).toHaveCount(1);
  await expect(retainedOutgoingTree).toBeHidden();
  await expect(retainedOutgoingTree.locator(".ryd-tooltip")).toHaveCount(0);
  await expect(retainedOutgoingTree.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
  await expect(wrapper).toBeVisible();
  await expect(container).toBeVisible();
  await expect(bar).toBeVisible();
  await expect(currentControls.locator('[data-fixture-role="dislike"] #text')).toHaveText("22");
  await expect(tooltip).toContainText("200 / 22");
  await expect(tooltip).toBeHidden();

  const geometry = await currentReactionRegion.evaluate((reactionRegion) => {
    const readBox = (element) => {
      const box = element.getBoundingClientRect();
      return {
        bottom: box.bottom,
        height: box.height,
        left: box.left,
        right: box.right,
        top: box.top,
        width: box.width,
      };
    };
    const controls = reactionRegion.querySelector("[data-fixture-control-video-id]");
    const like = controls.querySelector('[data-fixture-role="like"] button');
    const dislike = controls.querySelector('[data-fixture-role="dislike"] button');
    const ratioWrapper = reactionRegion.querySelector(":scope > .ryd-tooltip");
    const ratioContainer = ratioWrapper.querySelector("#return-youtube-dislike-bar-container");
    const ratioFill = ratioContainer.querySelector("#return-youtube-dislike-bar");
    return {
      bar: readBox(ratioFill),
      container: readBox(ratioContainer),
      dislike: readBox(dislike),
      like: readBox(like),
      wrapper: readBox(ratioWrapper),
    };
  });

  expect(geometry.wrapper.width).toBeCloseTo(geometry.like.width + geometry.dislike.width, 0);
  expect(geometry.container.width).toBeCloseTo(geometry.wrapper.width, 0);
  expect(geometry.container.top).toBeGreaterThanOrEqual(Math.max(geometry.like.bottom, geometry.dislike.bottom) - 1);
  expect(geometry.bar.left).toBeGreaterThanOrEqual(geometry.container.left - 1);
  expect(geometry.bar.right).toBeLessThanOrEqual(geometry.container.right + 1);
  expect(geometry.bar.width / geometry.container.width).toBeCloseTo(200 / (200 + 22), 2);

  await wrapper.hover({ position: { x: 1, y: 1 } });
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("200 / 22");
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("a pruned current watch ratio bar is restored once with the current video's data", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);

  await page.locator("#watch-next").click();

  await expectWatchInitialized(page, VIDEO_B);
  const currentControls = page.locator(`[data-fixture-control-video-id="${VIDEO_B}"]`);
  const currentReactionRegion = currentControls.locator("xpath=..");
  const wrapper = currentReactionRegion.locator(":scope > .ryd-tooltip");
  const container = wrapper.locator("#return-youtube-dislike-bar-container");
  const bar = container.locator("#return-youtube-dislike-bar");
  const tooltip = wrapper.locator("#ryd-dislike-tooltip");
  const countRequestsBeforePrune = harness.backend.requestsFor("GET", "/votes").length;

  await expect(wrapper).toHaveCount(1);
  await expect(tooltip).toContainText("200 / 22");
  await currentReactionRegion.evaluate((reactionRegion) => {
    const mutationStats = { addedWrappers: 0, removedWrappers: 0 };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.matches(".ryd-tooltip")) mutationStats.addedWrappers += 1;
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof Element && node.matches(".ryd-tooltip")) mutationStats.removedWrappers += 1;
        }
      }
    });
    observer.observe(reactionRegion, { childList: true });
    globalThis.__fixtureWatchBarMutationObserver = observer;
    globalThis.__fixtureWatchBarMutationStats = mutationStats;

    const currentWrapper = reactionRegion.querySelector(":scope > .ryd-tooltip");
    if (!currentWrapper) throw new Error("The current watch reaction tree has no ratio bar to prune.");
    globalThis.__fixturePrunedWatchBar = currentWrapper;
    currentWrapper.remove();
  });

  await expect(wrapper).toHaveCount(1);
  await expect(wrapper).toBeVisible();
  await expect(container).toBeVisible();
  await expect(bar).toBeVisible();
  await expect(currentControls.locator('[data-fixture-role="dislike"] #text')).toHaveText("22");
  await expect(tooltip).toContainText("200 / 22");
  await expect(tooltip).toBeHidden();
  expect(await wrapper.evaluate((restoredWrapper) => restoredWrapper !== globalThis.__fixturePrunedWatchBar)).toBe(
    true,
  );
  expect(
    await bar.evaluate((fill) => fill.getBoundingClientRect().width / fill.parentElement.getBoundingClientRect().width),
  ).toBeCloseTo(200 / (200 + 22), 2);

  await page.waitForTimeout(600);
  const mutationStats = await page.evaluate(() => {
    globalThis.__fixtureWatchBarMutationObserver.disconnect();
    return globalThis.__fixtureWatchBarMutationStats;
  });
  expect(mutationStats).toEqual({ addedWrappers: 1, removedWrappers: 1 });
  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(1);
  await expect(page.locator("#ryd-dislike-tooltip")).toHaveCount(1);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(countRequestsBeforePrune);
  await expectHealthyRuntime(page, harness);
});

test("same-video whole watch action replacement rehydrates without navigation or refetch", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_B });
  await expectWatchInitialized(page, VIDEO_B);
  const countRequestsBeforeReplacement = harness.backend
    .requestsFor("GET", "/votes")
    .filter((request) => request.query.videoId === VIDEO_B).length;

  expect(await page.evaluate(() => window.__navigationFixture.replaceCurrentWatchActions())).toBe(true);

  const replacement = page.locator(`#top-level-buttons-computed[data-fixture-watch-actions-replacement="${VIDEO_B}"]`);
  await expect(replacement).toHaveCount(1);
  await expectWatchInitialized(page, VIDEO_B);
  await expect(replacement.locator(":scope > .ryd-tooltip")).toHaveCount(1);
  await expect(replacement.locator("#ryd-dislike-tooltip")).toContainText("200 / 22");
  expect(await page.evaluate(() => !globalThis.__fixtureReplacedWatchActions.isConnected)).toBe(true);

  await page.waitForTimeout(600);
  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(1);
  await expect(page.locator("#ryd-dislike-tooltip")).toHaveCount(1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(countRequestsBeforeReplacement);

  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(countRequestsBeforeReplacement);
  await expectHealthyRuntime(page, harness);
});

test("sidebar watch navigation survives a retained settling action-container replacement", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);

  await page.locator("#watch-related").click();
  await expectWatchInitialized(page, VIDEO_B);
  const countRequestsBeforeReplacement = harness.backend
    .requestsFor("GET", "/votes")
    .filter((request) => request.query.videoId === VIDEO_B).length;

  expect(
    await page.evaluate(() => window.__navigationFixture.replaceCurrentWatchActions({ retainOutgoing: true })),
  ).toBe(true);

  const replacement = page.locator(`#top-level-buttons-computed[data-fixture-watch-actions-replacement="${VIDEO_B}"]`);
  const retained = page.locator(`[data-fixture-retained-settling-watch-actions="${VIDEO_B}"]`);
  await expect(replacement).toHaveCount(1);
  await expect(retained).toHaveCount(1);
  await expect(retained).toBeHidden();
  await expectWatchInitialized(page, VIDEO_B);
  await expect(replacement.locator(":scope > .ryd-tooltip")).toHaveCount(1);
  await expect(replacement.locator("#ryd-dislike-tooltip")).toContainText("200 / 22");
  await expect(retained.locator(".ryd-tooltip")).toHaveCount(0);
  await expect(retained.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
  await expect(retained.locator("#return-youtube-dislike-bar")).toHaveCount(0);
  await expect(retained.locator("#ryd-dislike-tooltip")).toHaveCount(0);

  await page.waitForTimeout(600);
  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(1);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(1);
  await expect(page.locator("#ryd-dislike-tooltip")).toHaveCount(1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(countRequestsBeforeReplacement);

  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(countRequestsBeforeReplacement);
  await expectHealthyRuntime(page, harness);
});

test("watch autoplay initializes replaced controls without a navigation event", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);

  await page.evaluate(() => window.__navigationFixture.dispatchEnded());

  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("delayed watch navigation never binds outgoing controls to the target video", async ({ context, page }) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  const outgoingControls = page.locator(`[data-fixture-control-video-id="${VIDEO_A}"]`);

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedWatch(videoId), VIDEO_B);

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === VIDEO_B);
  await expect(page.locator(`ytd-watch-flexy[video-id="${VIDEO_B}"]`)).toHaveCount(1);
  await expect(outgoingControls).toBeVisible();
  await page.evaluate(() => window.__navigationFixture.mutateOutgoingWatchDescendant());
  await expect(outgoingControls.locator('[data-fixture-irrelevant-watch-count-mutation="true"]')).toHaveCount(1);
  await expect(page.locator('[data-fixture-irrelevant-watch-tooltip-mutation="true"]')).toHaveCount(1);
  await page.waitForTimeout(600);
  await expect(outgoingControls.locator('[data-fixture-role="dislike"] #text')).toHaveText("11");
  await outgoingControls.locator('[data-fixture-role="dislike"] button').click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

  const outgoingDislike = outgoingControls.locator('[data-fixture-role="dislike"]');
  await page.evaluate(() => window.__navigationFixture.replaceDelayedWatchControl("like"));
  await expect(outgoingControls.locator('[data-fixture-watch-replacement="like"]')).toHaveCount(1);
  await expect(outgoingDislike).toBeVisible();
  await page.waitForTimeout(600);
  await outgoingDislike.locator("button").click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.replaceDelayedWatchControl("dislike"));
  await expect(outgoingControls.locator('[data-fixture-watch-replacement="dislike"]')).toHaveCount(1);
  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("same-node watch reuse requires independent native refresh on both activation paths", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  const reusedControls = page.locator(`[data-fixture-control-video-id="${VIDEO_A}"]`);
  const reusedLikeButton = reusedControls.locator('[data-fixture-role="like"] button');
  const reusedDislikeButton = reusedControls.locator('[data-fixture-role="dislike"] button');
  await reusedLikeButton.evaluate((button) => button.setAttribute("data-fixture-same-node", "like"));
  await reusedDislikeButton.evaluate((button) => button.setAttribute("data-fixture-same-node", "dislike"));

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedWatch(videoId), VIDEO_B);
  await page.evaluate(() => window.__navigationFixture.mutateOutgoingWatchDescendant());

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === VIDEO_B);
  await page.waitForTimeout(600);
  await expect(reusedControls.locator('[data-fixture-role="dislike"] #text')).toHaveText("11");
  await reusedDislikeButton.click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);

  await page.evaluate((videoId) => window.__navigationFixture.refreshReusedWatchControl("like", videoId), VIDEO_B);
  await expect(reusedLikeButton).toHaveAttribute("aria-label", `like refreshed for ${VIDEO_B}`);
  await expect(reusedLikeButton).toHaveAttribute("data-fixture-same-node", "like");
  await page.waitForTimeout(600);
  await reusedDislikeButton.click();
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);

  await page.evaluate((videoId) => window.__navigationFixture.refreshReusedWatchControl("dislike", videoId), VIDEO_B);
  await expect(reusedDislikeButton).toHaveAttribute("aria-label", `dislike refreshed for ${VIDEO_B}`);
  await expect(reusedDislikeButton).toHaveAttribute("data-fixture-same-node", "dislike");
  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("pre-navigation native drift cannot satisfy same-node watch refresh for the next video", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  const reusedControls = page.locator(`[data-fixture-control-video-id="${VIDEO_A}"]`);
  const reusedLikeButton = reusedControls.locator('[data-fixture-role="like"] button');
  const reusedDislikeButton = reusedControls.locator('[data-fixture-role="dislike"] button');
  await reusedLikeButton.evaluate((button) => button.setAttribute("data-fixture-pre-navigation-node", "like"));
  await reusedDislikeButton.evaluate((button) => button.setAttribute("data-fixture-pre-navigation-node", "dislike"));

  await page.evaluate(
    ({ videoId }) => {
      window.__navigationFixture.driftWatchControlBeforeNavigation("like", videoId);
      window.__navigationFixture.driftWatchControlBeforeNavigation("dislike", videoId);
    },
    { videoId: VIDEO_A },
  );
  await expect(reusedLikeButton).toHaveAttribute("aria-label", `like drift while ${VIDEO_A}`);
  await expect(reusedDislikeButton).toHaveAttribute("aria-label", `dislike drift while ${VIDEO_A}`);
  await page.waitForTimeout(600);

  await page.evaluate((videoId) => window.__navigationFixture.navigateDelayedWatch(videoId), VIDEO_B);
  await page.evaluate(() => window.__navigationFixture.mutateOutgoingWatchDescendant());

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === VIDEO_B);
  await page.waitForTimeout(600);
  await expect(reusedControls.locator('[data-fixture-role="dislike"] #text')).toHaveText("11");
  await expect(page.locator("#ryd-dislike-tooltip")).toContainText("100 / 11");
  await reusedDislikeButton.click();
  await expect(reusedDislikeButton).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(100);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);

  await page.evaluate((videoId) => window.__navigationFixture.refreshReusedWatchControl("like", videoId), VIDEO_B);
  await expect(reusedLikeButton).toHaveAttribute("aria-label", `like refreshed for ${VIDEO_B}`);
  await expect(reusedLikeButton).toHaveAttribute("data-fixture-pre-navigation-node", "like");
  await page.waitForTimeout(600);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);

  await page.evaluate((videoId) => window.__navigationFixture.refreshReusedWatchControl("dislike", videoId), VIDEO_B);
  await expect(reusedDislikeButton).toHaveAttribute("aria-label", `dislike refreshed for ${VIDEO_B}`);
  await expect(reusedDislikeButton).toHaveAttribute("aria-pressed", "false");
  await expect(reusedDislikeButton).toHaveAttribute("data-fixture-pre-navigation-node", "dislike");
  await expectWatchInitialized(page, VIDEO_B);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("navigation-start snapshots same-node watch refreshes that occur before navigation finish", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  const reusedControls = page.locator(`[data-fixture-control-video-id="${VIDEO_A}"]`);
  const reusedLikeButton = reusedControls.locator('[data-fixture-role="like"] button');
  const reusedDislikeButton = reusedControls.locator('[data-fixture-role="dislike"] button');
  await reusedLikeButton.evaluate((button) => button.setAttribute("data-fixture-pre-finish-node", "like"));
  await reusedDislikeButton.evaluate((button) => button.setAttribute("data-fixture-pre-finish-node", "dislike"));

  await page.evaluate(
    ({ videoId }) => {
      window.__navigationFixture.driftWatchControlBeforeNavigation("like", videoId);
      window.__navigationFixture.driftWatchControlBeforeNavigation("dislike", videoId);
    },
    { videoId: VIDEO_A },
  );
  await page.waitForTimeout(600);

  await page.evaluate((videoId) => window.__navigationFixture.beginSameNodeWatchNavigation(videoId), VIDEO_B);
  await page.evaluate((videoId) => {
    window.__navigationFixture.refreshReusedWatchControl("like", videoId);
    window.__navigationFixture.refreshReusedWatchControl("dislike", videoId);
  }, VIDEO_B);

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === VIDEO_B);
  await expect(page.locator(`ytd-watch-flexy[video-id="${VIDEO_B}"]`)).toHaveCount(1);
  await expect(reusedLikeButton).toHaveAttribute("aria-label", `like refreshed for ${VIDEO_B}`);
  await expect(reusedDislikeButton).toHaveAttribute("aria-label", `dislike refreshed for ${VIDEO_B}`);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.finishSameNodeWatchNavigation());

  await expectWatchInitialized(page, VIDEO_B);
  await expect(reusedLikeButton).toHaveAttribute("data-fixture-pre-finish-node", "like");
  await expect(reusedDislikeButton).toHaveAttribute("data-fixture-pre-finish-node", "dislike");
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("navigation-start combines a replaced Like target with a reused Dislike refresh before finish", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness({ context, page }, { pageKind: "watch", videoId: VIDEO_A });
  await expectWatchInitialized(page, VIDEO_A);
  const controls = page.locator(`[data-fixture-control-video-id="${VIDEO_A}"]`);
  const originalLikeButton = controls.locator('[data-fixture-role="like"] button');
  const reusedDislikeButton = controls.locator('[data-fixture-role="dislike"] button');
  await originalLikeButton.evaluate((button) => {
    window.__fixtureOriginalMixedLikeTarget = button;
  });
  await reusedDislikeButton.evaluate((button) => button.setAttribute("data-fixture-mixed-reused-node", "dislike"));

  await page.evaluate((videoId) => window.__navigationFixture.beginSameNodeWatchNavigation(videoId), VIDEO_B);
  await page.evaluate((videoId) => {
    window.__navigationFixture.replaceDelayedWatchControl("like");
    window.__navigationFixture.refreshReusedWatchControl("dislike", videoId);
  }, VIDEO_B);

  const replacementLike = controls.locator('[data-fixture-watch-replacement="like"]');
  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === VIDEO_B);
  await expect(page.locator(`ytd-watch-flexy[video-id="${VIDEO_B}"]`)).toHaveCount(1);
  await expect(replacementLike).toHaveCount(1);
  expect(
    await replacementLike
      .locator("button")
      .evaluate(
        (button) =>
          !window.__fixtureOriginalMixedLikeTarget.isConnected && button !== window.__fixtureOriginalMixedLikeTarget,
      ),
  ).toBe(true);
  await expect(reusedDislikeButton).toHaveAttribute("aria-label", `dislike refreshed for ${VIDEO_B}`);
  await expect(reusedDislikeButton).toHaveAttribute("data-fixture-mixed-reused-node", "dislike");
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(0);

  await page.evaluate(() => window.__navigationFixture.finishSameNodeWatchNavigation());

  await expectWatchInitialized(page, VIDEO_B);
  await expect(replacementLike).toHaveCount(1);
  await expect(reusedDislikeButton).toHaveAttribute("data-fixture-mixed-reused-node", "dislike");
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectWatchInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});

test("mobile channel to Short ignores stale channel controls until the target mounts", async ({ context, page }) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { hostname: "m.youtube.com", pageKind: "channel", videoId: VIDEO_A },
  );

  await page.locator("#channel-short").click();

  await expect(page).toHaveURL((url) => url.pathname === `/shorts/${VIDEO_A}`);
  const decoyDislikeCount = page.locator('[data-fixture-decoy-controls] [data-fixture-role="dislike"] #text');
  await page.waitForTimeout(250);
  await expect(decoyDislikeCount).toHaveText("");
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(0);
  await expectMobileShortInitialized(page, VIDEO_A);
  await expectOneActivation(page, harness.backend, VIDEO_A);
  await expectMobileShortInitialized(page, VIDEO_A, COUNTS[VIDEO_A].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("mobile Short autoplay activates its preloaded sibling without a navigation event", async ({ context, page }) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { hostname: "m.youtube.com", pageKind: "shorts", videoId: VIDEO_A },
  );
  await expectMobileShortInitialized(page, VIDEO_A);
  const preloadedNextShort = page.locator(`[data-fixture-mobile-short="${VIDEO_B}"]`);
  await expect(preloadedNextShort).toBeHidden();
  await preloadedNextShort.evaluate((renderer) => renderer.setAttribute("data-fixture-preloaded-marker", "true"));

  await page.evaluate(() => window.__navigationFixture.dispatchEnded());

  await expectMobileShortInitialized(page, VIDEO_B);
  await expect(page.locator(`[data-fixture-mobile-short="${VIDEO_B}"][is-active]`)).toHaveAttribute(
    "data-fixture-preloaded-marker",
    "true",
  );
  await expectOneActivation(page, harness.backend, VIDEO_B);
  await expectMobileShortInitialized(page, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
  await expectHealthyRuntime(page, harness);
});

test("same-video mobile overlay replacement reinitializes one control without a navigation event", async ({
  context,
  page,
}) => {
  const harness = await launchNavigationHarness(
    { context, page },
    { hostname: "m.youtube.com", pageKind: "shorts", videoId: VIDEO_A },
  );
  await expectMobileShortInitialized(page, VIDEO_A);

  await page.evaluate(() => window.__navigationFixture.replaceActiveMobileOverlay());

  const replacement = page.locator(
    `ytm-reel-video-renderer[video-id="${VIDEO_A}"][is-active] ytm-reel-player-overlay-renderer[data-fixture-replacement="true"]`,
  );
  await expect(replacement).toBeVisible();
  await expectMobileShortInitialized(page, VIDEO_A);
  await expectOneActivation(page, harness.backend, VIDEO_A);
  await expectMobileShortInitialized(page, VIDEO_A, COUNTS[VIDEO_A].dislikes + 1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  await expectHealthyRuntime(page, harness);
});
