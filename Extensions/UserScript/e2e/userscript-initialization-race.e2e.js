const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  VIDEO_B,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openShortsFixture,
  readGmValue,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const SYNTHETIC_STATE_KEY = `rydSyntheticDislikedShort:${VIDEO_A}`;

function visibleVoteButton(page, role) {
  return page.locator(`[data-ryd-role="${role}"]:visible button`);
}

async function installDelayedSyntheticStateRead(page) {
  await page.evaluate((delayedKey) => {
    const originalGetValue = globalThis.GM.getValue;
    let releaseRead;
    let reportReadStarted;
    let delayed = false;
    const readGate = new Promise((resolve) => {
      releaseRead = resolve;
    });
    globalThis.__rydDelayedGmReadStarted = new Promise((resolve) => {
      reportReadStarted = resolve;
    });
    globalThis.__releaseRydDelayedGmRead = releaseRead;
    globalThis.GM.getValue = async (key, fallbackValue) => {
      if (key === delayedKey) {
        if (!delayed) {
          delayed = true;
          reportReadStarted();
          await readGate;
        }
      }
      return originalGetValue(key, fallbackValue);
    };
  }, SYNTHETIC_STATE_KEY);
}

async function launchDelayedShorts(
  { context, page },
  { backendOptions, configureBackend, nativeDislike = false } = {},
) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const backend = createFakeBackend(backendOptions);
  configureBackend?.(backend);
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openShortsFixture(page, VIDEO_A);
  await page.evaluate(() => {
    globalThis.__unhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      globalThis.__unhandledRejections.push(
        event.reason instanceof Error ? event.reason.message : String(event.reason),
      );
    });
  });
  if (nativeDislike) {
    await page.evaluate(() => window.__shortsFixture.installNativeDislike());
  }
  await installDelayedSyntheticStateRead(page);
  await injectGeneratedUserscript(page);
  await page.evaluate(() => globalThis.__rydDelayedGmReadStarted);

  return { backend, consoleErrors, pageErrors };
}

async function releaseDelayedRead(page) {
  await page.evaluate(() => globalThis.__releaseRydDelayedGmRead());
}

async function expectCompletedHandshakes(backend, expectedValues) {
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(expectedValues.length);
  await expect
    .poll(() => backend.requestsFor("POST", "/interact/confirmVote").every((request) => request.respondedAt))
    .toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 150));

  const votes = backend.requestsFor("POST", "/interact/vote");
  const confirmations = backend.requestsFor("POST", "/interact/confirmVote");
  expect(votes).toHaveLength(expectedValues.length);
  expect(confirmations).toHaveLength(expectedValues.length);
  expect(votes.map((request) => request.body.value)).toEqual(expectedValues);
  for (let index = 0; index < expectedValues.length; index += 1) {
    expect(votes[index].body).toEqual({
      userId: EXISTING_CREDENTIALS.userId,
      videoId: VIDEO_A,
      value: expectedValues[index],
    });
    expect(confirmations[index].body).toMatchObject({
      userId: EXISTING_CREDENTIALS.userId,
      videoId: VIDEO_A,
    });
  }
}

async function expectSingleCompletedHandshake(backend, { value, videoId }) {
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote")[0]?.respondedAt).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const votes = backend.requestsFor("POST", "/interact/vote");
  const confirmations = backend.requestsFor("POST", "/interact/confirmVote");
  expect(votes).toHaveLength(1);
  expect(confirmations).toHaveLength(1);
  expect(votes[0].body).toEqual({ userId: EXISTING_CREDENTIALS.userId, videoId, value });
  expect(confirmations[0].body).toMatchObject({ userId: EXISTING_CREDENTIALS.userId, videoId });
}

async function expectNoRuntimeFailures(page, harness) {
  expect(harness.backend.blockedRequests).toEqual([]);
  expect(harness.consoleErrors).toEqual([]);
  expect(harness.pageErrors).toEqual([]);
  expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
}

test("immediate native Like during synthetic Shorts initialization submits once and remains coherent", async ({
  context,
  page,
}) => {
  const harness = await launchDelayedShorts({ context, page });
  const likeButton = visibleVoteButton(page, "like");

  await likeButton.click();
  try {
    await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  } finally {
    await releaseDelayedRead(page);
  }

  await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible #text")).toHaveText("25");
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await likeButton.click();
  await expectCompletedHandshakes(harness.backend, [1, 0]);
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  await expectNoRuntimeFailures(page, harness);
});

test("immediate native Dislike during native Shorts initialization submits once and remains coherent", async ({
  context,
  page,
}) => {
  const harness = await launchDelayedShorts({ context, page }, { nativeDislike: true });
  const dislikeButton = visibleVoteButton(page, "dislike");

  await dislikeButton.click();
  try {
    await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  } finally {
    await releaseDelayedRead(page);
  }

  await expect(dislikeButton.locator("#text")).toHaveText(/\d/);
  await expect(dislikeButton).toHaveAttribute("aria-pressed", "true");
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");
  await dislikeButton.click();
  await expectCompletedHandshakes(harness.backend, [-1, 0]);
  await expect(dislikeButton).toHaveAttribute("aria-pressed", "false");
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");
  await expectNoRuntimeFailures(page, harness);
});

test("stale native Shorts hydration preserves video A's captured dislike across a recycled video B", async ({
  context,
  page,
}) => {
  const harness = await launchDelayedShorts(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
      nativeDislike: true,
    },
  );

  await visibleVoteButton(page, "dislike").click();
  try {
    await expect.poll(() => harness.backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
    expect(harness.backend.requestsFor("POST", "/interact/vote")[0].body).toEqual({
      userId: EXISTING_CREDENTIALS.userId,
      videoId: VIDEO_A,
      value: -1,
    });
    await page.evaluate((videoId) => window.__shortsFixture.recycleActiveRenderer(videoId), VIDEO_B);
  } finally {
    await releaseDelayedRead(page);
  }

  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("22");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(true);

  await page.evaluate((videoId) => {
    window.__shortsFixture.recycleActiveRenderer(videoId);
    window.__shortsFixture.removeNativeDislike();
  }, VIDEO_A);
  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("11");
  const restoredSyntheticDislike = page.locator("[data-ryd-synthetic-shorts-dislike]:visible button");
  await expect(restoredSyntheticDislike).toHaveAttribute("aria-pressed", "true");
  await restoredSyntheticDislike.click();

  await expectCompletedHandshakes(harness.backend, [-1, 0]);
  await expect(restoredSyntheticDislike).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(null);
  expect(
    harness.backend.requestsFor("POST", "/interact/vote").filter((request) => request.body.videoId === VIDEO_B),
  ).toHaveLength(0);
  await expectNoRuntimeFailures(page, harness);
});

test("video B Like remains bound while video A hydration is delayed", async ({ context, page }) => {
  const harness = await launchDelayedShorts(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 11, likes: 100 },
          [VIDEO_B]: { dislikes: 22, likes: 200 },
        },
      },
    },
  );

  await page.evaluate((videoId) => window.__shortsFixture.recycleActiveRenderer(videoId), VIDEO_B);
  const videoBLike = visibleVoteButton(page, "like");
  await videoBLike.click();
  try {
    await expectSingleCompletedHandshake(harness.backend, { videoId: VIDEO_B, value: 1 });
  } finally {
    await releaseDelayedRead(page);
  }

  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("22");
  await expect(videoBLike).toHaveAttribute("aria-pressed", "true");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "false");
  expect(
    harness.backend.requestsFor("POST", "/interact/vote").filter((request) => request.body.videoId === VIDEO_A),
  ).toHaveLength(0);
  await expectNoRuntimeFailures(page, harness);
});

for (const replacement of ["inner Like button", "action bar"]) {
  test(`a replacement ${replacement} receives the pending same-video hydration listener`, async ({ context, page }) => {
    const harness = await launchDelayedShorts({ context, page });

    await page.evaluate((replacementKind) => {
      if (replacementKind === "inner Like button") {
        window.__shortsFixture.replaceInnerButton("like");
      } else {
        window.__shortsFixture.replaceActionBar();
      }
    }, replacement);
    const replacementLike = visibleVoteButton(page, "like");
    await replacementLike.click();
    try {
      await expectSingleCompletedHandshake(harness.backend, { videoId: VIDEO_A, value: 1 });
    } finally {
      await releaseDelayedRead(page);
    }

    await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("25");
    await expect(replacementLike).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
    await expectNoRuntimeFailures(page, harness);
  });
}

test("enabled synthetic Dislike clears native Like during a pending same-wrapper rehydration", async ({
  context,
  page,
}) => {
  const harness = await launchDelayedShorts({ context, page });
  await releaseDelayedRead(page);
  const syntheticDislike = visibleVoteButton(page, "dislike");
  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("25");
  await expect(syntheticDislike).toHaveAttribute("aria-disabled", "false");

  await installDelayedSyntheticStateRead(page);
  await page.evaluate((videoId) => window.__shortsFixture.activate(videoId, { state: "liked" }), VIDEO_A);
  await page.evaluate(() => globalThis.__rydDelayedGmReadStarted);
  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "true");

  await syntheticDislike.click();
  try {
    await expectSingleCompletedHandshake(harness.backend, { videoId: VIDEO_A, value: -1 });
  } finally {
    await releaseDelayedRead(page);
  }

  await expect(visibleVoteButton(page, "like")).toHaveAttribute("aria-pressed", "false");
  await expect(syntheticDislike).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(true);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);
  await expectNoRuntimeFailures(page, harness);
});

test("new same-video hydration wins after two native Dislike transitions complete before the old read", async ({
  context,
  page,
}) => {
  const harness = await launchDelayedShorts(
    { context, page },
    {
      backendOptions: {
        countsByVideo: {
          [VIDEO_A]: { dislikes: 25, likes: 100 },
        },
      },
      nativeDislike: true,
    },
  );

  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("25");
  let readReleased = false;
  try {
    await visibleVoteButton(page, "dislike").click();
    await expectSingleCompletedHandshake(harness.backend, { videoId: VIDEO_A, value: -1 });
    await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("26");

    await page.evaluate(() => window.__shortsFixture.replaceActionBar());
    const replacementDislike = visibleVoteButton(page, "dislike");
    await replacementDislike.click();
    await expectCompletedHandshakes(harness.backend, [-1, 0]);
    await expect(replacementDislike).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("25");
    await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(null);
    expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);
  } finally {
    await releaseDelayedRead(page);
    readReleased = true;
  }

  expect(readReleased).toBe(true);
  const finalDislike = visibleVoteButton(page, "dislike");
  await expect(finalDislike).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("25");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(null);
  await page.waitForTimeout(200);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1, 0]);

  await finalDislike.click();
  await expectCompletedHandshakes(harness.backend, [-1, 0, -1]);
  await expect(finalDislike).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-ryd-role="dislike"]:visible #text')).toHaveText("26");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(true);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(1);
  await expectNoRuntimeFailures(page, harness);
});

test("fresh same-video count state supersedes stale hydration correction", async ({ context, page }) => {
  const harness = await launchDelayedShorts(
    { context, page },
    {
      configureBackend: (backend) => {
        backend.enqueue("GET", "/votes", { body: { dislikes: 25, likes: 100, rating: 4.5 } });
        backend.enqueue("GET", "/votes", { body: { dislikes: 22, likes: 200, rating: 4.5 } });
        backend.enqueue("GET", "/votes", { body: { dislikes: 26, likes: 100, rating: 4.5 } });
      },
      nativeDislike: true,
    },
  );

  const dislikeCount = page.locator('[data-ryd-role="dislike"]:visible #text');
  await expect(dislikeCount).toHaveText("25");
  try {
    await visibleVoteButton(page, "dislike").click();
    await expectSingleCompletedHandshake(harness.backend, { videoId: VIDEO_A, value: -1 });
    await expect(dislikeCount).toHaveText("26");

    await page.evaluate((videoId) => window.__shortsFixture.recycleActiveRenderer(videoId), VIDEO_B);
    await expect(dislikeCount).toHaveText("22");

    await page.evaluate(
      (videoId) => window.__shortsFixture.recycleActiveRenderer(videoId, { state: "disliked" }),
      VIDEO_A,
    );
    await expect(dislikeCount).toHaveText("26");
    expect(
      harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_A),
    ).toHaveLength(2);
  } finally {
    await releaseDelayedRead(page);
  }

  await page.waitForTimeout(250);
  await expect(dislikeCount).toHaveText("26");
  await expect(visibleVoteButton(page, "dislike")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => readGmValue(page, SYNTHETIC_STATE_KEY)).toBe(true);
  expect(harness.backend.requestsFor("POST", "/interact/vote").map((request) => request.body.value)).toEqual([-1]);
  expect(harness.backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(1);
  expect(harness.backend.requestsFor("GET", "/votes")).toHaveLength(3);
  expect(
    harness.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === VIDEO_B),
  ).toHaveLength(1);
  await expectNoRuntimeFailures(page, harness);
});
