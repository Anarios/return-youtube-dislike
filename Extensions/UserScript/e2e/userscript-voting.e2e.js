const { test, expect, devices } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  VIDEO_B,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openShortsFixture,
  openWatchFixture,
  readGmValue,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const SYNTHETIC_STATE_KEY_PREFIX = "rydSyntheticDislikedShort:";
const PIXEL_5 = Object.fromEntries(Object.entries(devices["Pixel 5"]).filter(([key]) => key !== "defaultBrowserType"));

function monitorPage(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { page, consoleErrors, pageErrors };
}

async function installUnhandledRejectionCapture(context) {
  await context.addInitScript(() => {
    globalThis.__unhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      globalThis.__unhandledRejections.push(reason instanceof Error ? reason.message : String(reason));
    });
  });
}

async function launchHarness(
  { context, page },
  {
    backendOptions,
    beforeInject,
    coloredThumbs,
    disableVoteSubmission = false,
    gmValues,
    hostname = "www.youtube.com",
    pageKind = "watch",
    videoId = VIDEO_A,
  } = {},
) {
  const backend = createFakeBackend(backendOptions);
  const monitoredPages = [monitorPage(page)];

  await installUnhandledRejectionCapture(context);
  await installGmEnvironment(context, gmValues);
  await installHermeticRoutes(context, backend);
  if (pageKind === "shorts") await openShortsFixture(page, videoId, { hostname });
  else await openWatchFixture(page, videoId, { hostname });
  if (beforeInject) await beforeInject(page);
  await injectGeneratedUserscript(page, { coloredThumbs, disableVoteSubmission });

  return { backend, monitoredPages };
}

async function expectNoRuntimeFailures({ backend, monitoredPages }, { allowedConsoleErrors = [] } = {}) {
  expect(backend.blockedRequests, "all network traffic must be served by the hermetic harness").toEqual([]);

  for (const monitored of monitoredPages) {
    const unexpectedConsoleErrors = monitored.consoleErrors.filter(
      (message) => !allowedConsoleErrors.some((pattern) => pattern.test(message)),
    );
    expect(unexpectedConsoleErrors, "unexpected browser console errors").toEqual([]);
    expect(monitored.pageErrors, "uncaught page errors").toEqual([]);
    expect(
      await monitored.page.evaluate(() => globalThis.__unhandledRejections || []),
      "unhandled promise rejections",
    ).toEqual([]);
  }
}

async function waitForCredentials(page) {
  let credentials = null;
  await expect
    .poll(async () => {
      credentials = await readGmValue(page, CREDENTIAL_KEY);
      return credentials;
    })
    .toMatchObject({ registrationConfirmed: true });
  return credentials;
}

function visibleVoteButton(page, role) {
  return page.locator(`[data-ryd-role="${role}"]:visible button`);
}

async function waitForDislikeCount(page, value) {
  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText(String(value));
}

async function clickVoteAndWait(page, backend, role, expectedConfirmations) {
  await visibleVoteButton(page, role).click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(expectedConfirmations);
}

test("fresh startup eagerly registers and submits a complete dislike handshake", async ({ context, page }) => {
  const harness = await launchHarness({ context, page });
  const { backend } = harness;
  await waitForDislikeCount(page, 25);

  const credentials = await waitForCredentials(page);
  expect(credentials.userId).toHaveLength(36);

  const registrationGet = backend.requestsFor("GET", "/puzzle/registration");
  const registrationPost = backend.requestsFor("POST", "/puzzle/registration");
  expect(registrationGet).toHaveLength(1);
  expect(registrationPost).toHaveLength(1);
  expect(registrationGet[0].query.userId).toBe(credentials.userId);
  expect(Buffer.from(registrationPost[0].body.solution, "base64")).toHaveLength(4);
  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);

  await clickVoteAndWait(page, backend, "dislike", 1);

  const vote = backend.requestsFor("POST", "/interact/vote")[0];
  const confirmation = backend.requestsFor("POST", "/interact/confirmVote")[0];
  expect(vote.body).toEqual({ userId: credentials.userId, videoId: VIDEO_A, value: -1 });
  expect(confirmation.body.userId).toBe(credentials.userId);
  expect(confirmation.body.videoId).toBe(VIDEO_A);
  expect(Buffer.from(confirmation.body.solution, "base64")).toHaveLength(4);
  await expectNoRuntimeFailures(harness);
});

test("credentials survive a page reload and prevent duplicate registration", async ({ context, page }) => {
  const harness = await launchHarness({ context, page });
  const { backend } = harness;
  const firstCredentials = await waitForCredentials(page);
  await waitForDislikeCount(page, 25);
  const registrationCount = backend.requestsFor("GET", "/puzzle/registration").length;

  await page.reload({ waitUntil: "domcontentloaded" });
  await injectGeneratedUserscript(page);
  await waitForDislikeCount(page, 25);

  expect(await readGmValue(page, CREDENTIAL_KEY)).toEqual(firstCredentials);
  expect(backend.requestsFor("GET", "/puzzle/registration")).toHaveLength(registrationCount);

  await clickVoteAndWait(page, backend, "like", 1);
  expect(backend.requestsFor("POST", "/interact/vote")[0].body).toEqual({
    userId: firstCredentials.userId,
    videoId: VIDEO_A,
    value: 1,
  });
  await expectNoRuntimeFailures(harness);
});

test("a second page reuses the registered identity", async ({ context, page }) => {
  const harness = await launchHarness({ context, page });
  const { backend, monitoredPages } = harness;
  const credentials = await waitForCredentials(page);

  const secondPage = await context.newPage();
  monitoredPages.push(monitorPage(secondPage));
  await openWatchFixture(secondPage, VIDEO_B);
  await injectGeneratedUserscript(secondPage);
  await waitForDislikeCount(secondPage, 25);

  expect(backend.requestsFor("GET", "/puzzle/registration")).toHaveLength(1);
  await clickVoteAndWait(secondPage, backend, "like", 1);
  expect(backend.requestsFor("POST", "/interact/vote")[0].body).toEqual({
    userId: credentials.userId,
    videoId: VIDEO_B,
    value: 1,
  });
  await expectNoRuntimeFailures(harness);
});

const initialStateTransitions = [
  { initialState: "neutral", action: "like", expectedValue: 1, expectedDislikes: 25 },
  { initialState: "neutral", action: "dislike", expectedValue: -1, expectedDislikes: 26 },
  { initialState: "liked", action: "like", expectedValue: 0, expectedDislikes: 25 },
  { initialState: "liked", action: "dislike", expectedValue: -1, expectedDislikes: 26 },
  { initialState: "disliked", action: "like", expectedValue: 1, expectedDislikes: 24 },
  { initialState: "disliked", action: "dislike", expectedValue: 0, expectedDislikes: 24 },
];

for (const scenario of initialStateTransitions) {
  test(`${scenario.initialState} plus ${scenario.action} submits ${scenario.expectedValue}`, async ({
    context,
    page,
  }) => {
    const harness = await launchHarness(
      { context, page },
      {
        backendOptions: { fixture: { initialState: scenario.initialState } },
        gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      },
    );
    const { backend } = harness;
    await waitForDislikeCount(page, 25);

    await clickVoteAndWait(page, backend, scenario.action, 1);

    expect(backend.requestsFor("GET", "/puzzle/registration")).toHaveLength(0);
    expect(backend.requestsFor("POST", "/interact/vote")[0].body.value).toBe(scenario.expectedValue);
    await waitForDislikeCount(page, scenario.expectedDislikes);
    await expectNoRuntimeFailures(harness);
  });
}

test("disabled vote submission keeps local UI transitions without API interaction", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      disableVoteSubmission: true,
    },
  );
  const { backend } = harness;
  await waitForDislikeCount(page, 25);
  await waitForCredentials(page);

  await visibleVoteButton(page, "dislike").click();
  await waitForDislikeCount(page, 26);
  await page.waitForTimeout(100);

  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
  expect(backend.requestsFor("GET", "/puzzle/registration")).toHaveLength(1);
  await expectNoRuntimeFailures(harness);
});

test("signed-out controls never submit a vote", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: { fixture: { signedIn: false } },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  const { backend } = harness;
  await waitForDislikeCount(page, 25);

  await visibleVoteButton(page, "dislike").click();
  await page.waitForTimeout(100);

  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
  await expectNoRuntimeFailures(harness);
});

test("late button insertion still initializes rendering and voting", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: { fixture: { initialButtons: false } },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  const { backend } = harness;

  await page.waitForTimeout(150);
  await page.evaluate(() => window.__youtubeFixture.insertButtons("neutral"));
  await waitForDislikeCount(page, 25);
  await clickVoteAndWait(page, backend, "dislike", 1);

  expect(backend.requestsFor("POST", "/interact/vote")[0].body.videoId).toBe(VIDEO_A);
  await expectNoRuntimeFailures(harness);
});

test("an early vote is reconciled onto a delayed same-video count", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countDelayByVideo: { [VIDEO_A]: 350 },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  await expect.poll(() => harness.backend.requestsFor("GET", "/votes").length).toBe(1);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await waitForDislikeCount(page, 26);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await waitForDislikeCount(page, 25);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("SPA navigation ignores a stale count and submits only the current video id", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countDelayByVideo: { [VIDEO_A]: 300 },
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  const { backend } = harness;

  await expect
    .poll(() => backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A).length)
    .toBe(1);
  await page.evaluate((videoId) => window.__youtubeFixture.navigate(videoId), VIDEO_B);

  await expect
    .poll(() => backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B).length)
    .toBe(1);
  await waitForDislikeCount(page, 22);
  await page.evaluate(() => {
    document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
    document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
  });
  await page.waitForTimeout(350);
  await waitForDislikeCount(page, 22);

  await clickVoteAndWait(page, backend, "dislike", 1);
  const votes = backend.requestsFor("POST", "/interact/vote");
  expect(votes).toHaveLength(1);
  expect(votes[0].body.videoId).toBe(VIDEO_B);
  await expectNoRuntimeFailures(harness);
});

test("navigation during an in-flight vote does not block the next video", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  const { backend } = harness;
  backend.enqueue("POST", "/interact/confirmVote", { body: true, delayMs: 1_000 });
  await waitForDislikeCount(page, 11);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);

  await page.evaluate((videoId) => window.__youtubeFixture.navigate(videoId), VIDEO_B);
  await waitForDislikeCount(page, 22);
  await visibleVoteButton(page, "like").click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await expect
    .poll(() => backend.requestsFor("POST", "/interact/confirmVote").every((request) => request.respondedAt))
    .toBe(true);

  const votes = backend.requestsFor("POST", "/interact/vote");
  const confirmations = backend.requestsFor("POST", "/interact/confirmVote");
  expect(votes.map((request) => request.body.videoId)).toEqual([VIDEO_A, VIDEO_B]);
  expect(confirmations.map((request) => request.body.videoId)).toEqual([VIDEO_A, VIDEO_B]);
  expect(votes[1].at).toBeLessThan(confirmations[0].respondedAt);
  await expectNoRuntimeFailures(harness);
});

test("active Shorts controls switch video identity", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  const { backend } = harness;
  await waitForDislikeCount(page, 11);

  await page.evaluate((videoId) => window.__shortsFixture.activate(videoId), VIDEO_B);
  await waitForDislikeCount(page, 22);
  await expect(page.locator("[data-short-video]:not([hidden])")).toHaveCount(1);

  await clickVoteAndWait(page, backend, "dislike", 1);
  expect(backend.requestsFor("POST", "/interact/vote")[0].body.videoId).toBe(VIDEO_B);
  expect(backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A)).toHaveLength(1);
  expect(backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B)).toHaveLength(1);
  await expectNoRuntimeFailures(harness);
});

test("a recycled Shorts renderer is retagged and initialized for its new video", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 11);

  await page.evaluate((videoId) => window.__shortsFixture.recycleActiveRenderer(videoId), VIDEO_B);
  await waitForDislikeCount(page, 22);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveAttribute(
    "data-ryd-video-id",
    VIDEO_B,
  );
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-disabled", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote")[0].body.videoId).toBe(VIDEO_B);
  await expectNoRuntimeFailures(harness);
});

test("current desktop Shorts UI gets one owned dislike control and covers all six transitions", async ({
  context,
  page,
}) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  const { backend } = harness;
  await waitForDislikeCount(page, 25);

  const synthetic = page.locator("[data-ryd-synthetic-shorts-dislike]:visible");
  await expect(synthetic).toHaveCount(1);
  await expect(synthetic.locator("button")).toHaveAttribute("aria-label", "Dislike this video");
  await expect(page.locator("dislike-button-view-model, #dislike-button")).toHaveCount(0);
  await expect(page.locator('[data-fixture-control="comments"]:visible')).toContainText("12");
  await expect(page.locator('[data-fixture-control="share"]:visible')).toContainText("Share");
  await expect(page.locator('[data-fixture-control="remix"]:visible')).toContainText("Remix");

  const actions = ["like", "like", "dislike", "like", "dislike", "dislike"];
  const expectedStates = ["liked", "neutral", "disliked", "liked", "disliked", "neutral"];
  const expectedValues = [1, 0, -1, 1, -1, 0];
  for (let index = 0; index < actions.length; index += 1) {
    await visibleVoteButton(page, actions[index]).click();
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(index + 1);
    await expect
      .poll(async () => {
        const likePressed = await visibleVoteButton(page, "like").getAttribute("aria-pressed");
        const dislikePressed = await visibleVoteButton(page, "dislike").getAttribute("aria-pressed");
        if (likePressed === "true") return "liked";
        if (dislikePressed === "true") return "disliked";
        return "neutral";
      })
      .toBe(expectedStates[index]);
  }

  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual(expectedValues);
  await expect(synthetic).toHaveCount(1);
  await expect(page.locator('[data-fixture-control="comments"]:visible')).toContainText("12");
  await expectNoRuntimeFailures(harness);
});

test("modern Shorts supports the colored-thumbs option", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      coloredThumbs: true,
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect.poll(() => visibleVoteButton(page, "dislike").evaluate((button) => button.style.color)).toBe("red");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await expect.poll(() => visibleVoteButton(page, "dislike").evaluate((button) => button.style.color)).toBe("unset");
  await expectNoRuntimeFailures(harness);
});

test("a recreated synthetic Shorts control is restored and rebound exactly once", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await page.evaluate(() => window.__shortsFixture.removeSyntheticDislike());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await waitForDislikeCount(page, 25);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await expectNoRuntimeFailures(harness);
});

test("a replaced Shorts action bar gets a fresh initialized control", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await page.evaluate(() => window.__shortsFixture.replaceActionBar());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await waitForDislikeCount(page, 25);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-disabled", "false");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  await expectNoRuntimeFailures(harness);
});

test("a pending count keeps its optimistic delta across same-video action-bar replacement", async ({
  context,
  page,
}) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countDelayByVideo: { [VIDEO_A]: 350 },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await expect.poll(() => harness.backend.requestsFor("GET", "/votes").length).toBe(1);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await page.evaluate(() => window.__shortsFixture.replaceActionBar());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await waitForDislikeCount(page, 26);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await waitForDislikeCount(page, 25);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("a replaced synthetic inner button is rebound", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await page.evaluate(() => window.__shortsFixture.replaceInnerButton("dislike"));
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-disabled", "false");
  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  await expectNoRuntimeFailures(harness);
});

test("Like and synthetic Dislike label-count clicks each submit once", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await page.locator('[data-ryd-role="like"]:visible #text').click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "true");

  await page.locator("[data-ryd-synthetic-shorts-dislike]:visible #text").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await page.waitForTimeout(200);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([1, -1]);
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");
  await expectNoRuntimeFailures(harness);
});

test("a native Shorts dislike arriving later replaces the owned control", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await page.evaluate(() => window.__shortsFixture.installNativeDislike());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
  await expect(page.locator("dislike-button-view-model:visible")).toHaveCount(1);
  await waitForDislikeCount(page, 25);
  await expect(page.locator('[data-fixture-control="comments"]:visible')).toContainText("12");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  await expectNoRuntimeFailures(harness);
});

test("native Shorts takeover and return preserve the final per-video state", async ({ context, page }) => {
  const stateKey = `${SYNTHETIC_STATE_KEY_PREFIX}${VIDEO_A}`;
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect.poll(() => readGmValue(page, stateKey)).toBe(true);

  await page.evaluate(() => window.__shortsFixture.installNativeDislike());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
  await page.evaluate(() => window.__shortsFixture.removeNativeDislike());
  await waitForDislikeCount(page, 26);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => window.__shortsFixture.installNativeDislike());
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(0);
  await waitForDislikeCount(page, 26);
  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await expect.poll(() => readGmValue(page, stateKey)).toBe(true);
  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(3);
  await expect.poll(() => readGmValue(page, stateKey)).toBe(null);

  await page.evaluate(() => window.__shortsFixture.removeNativeDislike());
  await waitForDislikeCount(page, 25);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([
    -1, -1, 0,
  ]);
  await expectNoRuntimeFailures(harness);
});

test("class-only active Like switches to synthetic Dislike with one backend vote", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 25, likes: 100 },
          [VIDEO_B]: { dislikes: 30, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);
  await page.evaluate((videoId) => window.__shortsFixture.activate(videoId), VIDEO_B);
  await waitForDislikeCount(page, 30);
  await page.evaluate((videoId) => {
    window.__shortsFixture.activate(videoId, { state: "liked" });
    window.__shortsFixture.setClassOnlyLiked();
  }, VIDEO_A);
  await waitForDislikeCount(page, 25);
  await expect(page.locator('[data-ryd-role="like"]:visible')).toHaveClass(/style-default-active/);
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  await expectNoRuntimeFailures(harness);
});

test("a delayed state read cannot restore video A onto video B", async ({ context, page }) => {
  const videoAStateKey = `${SYNTHETIC_STATE_KEY_PREFIX}${VIDEO_A}`;
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      beforeInject: async (fixturePage) => {
        await fixturePage.evaluate((delayedKey) => {
          const originalGetValue = globalThis.GM.getValue;
          let releaseRead;
          const readGate = new Promise((resolve) => {
            releaseRead = resolve;
          });
          globalThis.__releaseSyntheticStateRead = releaseRead;
          globalThis.GM.getValue = async (key, fallbackValue) => {
            if (key === delayedKey) await readGate;
            return originalGetValue(key, fallbackValue);
          };
        }, videoAStateKey);
      },
      gmValues: {
        [CREDENTIAL_KEY]: EXISTING_CREDENTIALS,
        [videoAStateKey]: true,
      },
      pageKind: "shorts",
    },
  );

  const initialSyntheticButton = visibleVoteButton(page, "dislike");
  await expect(initialSyntheticButton).toHaveAttribute("aria-disabled", "true");
  await page.evaluate((videoId) => window.__shortsFixture.activate(videoId), VIDEO_B);
  await page.evaluate(() => globalThis.__releaseSyntheticStateRead());

  await waitForDislikeCount(page, 22);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveAttribute(
    "data-ryd-video-id",
    VIDEO_B,
  );
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-disabled", "false");
  await expectNoRuntimeFailures(harness);
});

test("synthetic state storage failure falls back to an enabled neutral control", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      beforeInject: async (fixturePage) => {
        await fixturePage.evaluate((keyPrefix) => {
          const originalGetValue = globalThis.GM.getValue;
          globalThis.GM.getValue = (key, fallbackValue) => {
            if (key.startsWith(keyPrefix)) throw new Error("synthetic state read failed");
            return originalGetValue(key, fallbackValue);
          };
        }, SYNTHETIC_STATE_KEY_PREFIX);
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );

  await waitForDislikeCount(page, 25);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-disabled", "false");
  await expectNoRuntimeFailures(harness);
});

test("synthetic Shorts dislike state survives reload and toggles back to neutral", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  const { backend } = harness;
  await waitForDislikeCount(page, 25);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");

  await page.reload({ waitUntil: "domcontentloaded" });
  await injectGeneratedUserscript(page);
  await waitForDislikeCount(page, 25);
  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("corrupt synthetic Shorts state falls back to neutral without runtime errors", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: {
        [CREDENTIAL_KEY]: EXISTING_CREDENTIALS,
        rydSyntheticDislikedShorts: { invalid: true },
      },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);

  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await expectNoRuntimeFailures(harness);
});

test("synthetic Shorts control honors the disabled vote gate", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      disableVoteSubmission: true,
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);
  await visibleVoteButton(page, "dislike").click();
  await waitForDislikeCount(page, 26);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  await expectNoRuntimeFailures(harness);
});

test("synthetic Shorts control honors the signed-out vote gate", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: { fixture: { signedIn: false } },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  await waitForDislikeCount(page, 25);
  await visibleVoteButton(page, "dislike").click();
  await page.waitForTimeout(150);
  expect(harness.backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await expectNoRuntimeFailures(harness);
});

test("rapid synthetic Shorts toggles remain serialized", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
      pageKind: "shorts",
    },
  );
  const { backend } = harness;
  backend.enqueue("POST", "/interact/confirmVote", { body: true, delayMs: 200 });
  await waitForDislikeCount(page, 25);

  const syntheticButton = visibleVoteButton(page, "dislike");
  await syntheticButton.click();
  await syntheticButton.click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/vote").length).toBe(1);
  await page.waitForTimeout(75);
  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);

  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);
  await expect(syntheticButton).toHaveAttribute("aria-pressed", "false");
  await expectNoRuntimeFailures(harness);
});

test("rapid votes for one video remain serialized and ordered", async ({ context, page }) => {
  const harness = await launchHarness({ context, page }, { gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS } });
  const { backend } = harness;
  backend.enqueue("POST", "/interact/confirmVote", { body: true, delayMs: 200 });
  await waitForDislikeCount(page, 25);

  const likeButton = visibleVoteButton(page, "like");
  await likeButton.click();
  await likeButton.click();

  await expect.poll(() => backend.requestsFor("POST", "/interact/vote").length).toBe(1);
  await page.waitForTimeout(75);
  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);

  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);
  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("a rejected vote does not poison the per-video queue", async ({ context, page }) => {
  const harness = await launchHarness({ context, page }, { gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS } });
  const { backend } = harness;
  backend.enqueue("POST", "/interact/vote", { body: { invalidPuzzle: true } });
  await waitForDislikeCount(page, 25);

  const likeButton = visibleVoteButton(page, "like");
  await likeButton.click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/vote").length).toBe(1);
  await likeButton.click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);

  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("a rejected confirmation does not poison the per-video queue", async ({ context, page }) => {
  const harness = await launchHarness({ context, page }, { gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS } });
  const { backend } = harness;
  backend.enqueue("POST", "/interact/confirmVote", { body: false });
  await waitForDislikeCount(page, 25);

  const dislikeButton = visibleVoteButton(page, "dislike");
  await dislikeButton.click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await dislikeButton.click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(2);

  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);
  await expectNoRuntimeFailures(harness);
});

test("a failed vote still allows later SPA navigation and voting", async ({ context, page }) => {
  const harness = await launchHarness(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
    },
  );
  const { backend } = harness;
  backend.enqueue("POST", "/interact/vote", { status: 500, body: { error: "temporary failure" } });
  await waitForDislikeCount(page, 11);

  await visibleVoteButton(page, "dislike").click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/vote").length).toBe(1);
  await page.evaluate((videoId) => window.__youtubeFixture.navigate(videoId), VIDEO_B);
  await waitForDislikeCount(page, 22);
  await clickVoteAndWait(page, backend, "like", 1);

  expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.videoId)).toEqual([
    VIDEO_A,
    VIDEO_B,
  ]);
  await expectNoRuntimeFailures(harness, { allowedConsoleErrors: [/status of 500/] });
});

test("a 401 clears stale credentials, registers once, and retries the vote", async ({ context, page }) => {
  const harness = await launchHarness({ context, page }, { gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS } });
  const { backend } = harness;
  backend.enqueue("POST", "/interact/vote", { status: 401, body: { error: "expired" } });
  await waitForDislikeCount(page, 25);

  await clickVoteAndWait(page, backend, "dislike", 1);

  const votes = backend.requestsFor("POST", "/interact/vote");
  expect(votes).toHaveLength(2);
  expect(votes[0].body.userId).toBe(EXISTING_CREDENTIALS.userId);
  expect(votes[1].body.userId).not.toBe(EXISTING_CREDENTIALS.userId);
  expect(backend.requestsFor("GET", "/puzzle/registration")).toHaveLength(1);
  expect(backend.requestsFor("POST", "/puzzle/registration")).toHaveLength(1);

  const replacementCredentials = await readGmValue(page, CREDENTIAL_KEY);
  expect(replacementCredentials).toMatchObject({
    userId: votes[1].body.userId,
    registrationConfirmed: true,
  });
  await expectNoRuntimeFailures(harness, { allowedConsoleErrors: [/status of 401/] });
});

test.describe("touch-enabled mobile fixture", () => {
  test.use(PIXEL_5);

  test("a real tap submits exactly one vote", async ({ context, page }) => {
    const harness = await launchHarness(
      { context, page },
      {
        gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
        hostname: "m.youtube.com",
      },
    );
    const { backend } = harness;
    await waitForDislikeCount(page, 25);

    await visibleVoteButton(page, "dislike").tap();
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
    await page.waitForTimeout(150);

    expect(backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
    await expectNoRuntimeFailures(harness);
  });

  test("mobile Shorts boot and vote through the active mobile controls", async ({ context, page }) => {
    const harness = await launchHarness(
      { context, page },
      {
        gmValues: { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS },
        hostname: "m.youtube.com",
        pageKind: "shorts",
      },
    );
    const { backend } = harness;
    await waitForDislikeCount(page, 25);

    await visibleVoteButton(page, "dislike").tap();
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);

    expect(backend.requestsFor("POST", "/interact/vote")[0].body).toMatchObject({
      videoId: VIDEO_A,
      value: -1,
    });
    await expectNoRuntimeFailures(harness);
  });
});
