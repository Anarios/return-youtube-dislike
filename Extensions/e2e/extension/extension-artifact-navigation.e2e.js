const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const {
  EXTENSION_MATRIX_RUNTIME,
  NAVIGATION_MATRIX,
  installNavigationMatrixFixture,
} = require("../../UserScript/e2e/navigation-matrix");
const {
  createNavigationRuntimeContractAdapter,
  registerNavigationRuntimeContractScenarios,
  runNavigationRuntimeContract,
} = require("../navigation-runtime-contract");
const { DEFAULT_VIDEO_IDS, createExtensionNavigationFixture } = require("./extension-navigation-fixture");
const { expectExtensionShortsVisualContract, readExtensionShortsVisualContract } = require("../shorts-visual-contract");
const { annotateVisualEvidence, captureOptionalVisualEvidence } = require("../visual-evidence");
const {
  SHORTS_PLACEHOLDER_POOL_COUNTS,
  installShortsPlaceholderPoolRoute,
  runShortsPlaceholderPoolContract,
  shortsPlaceholderPoolUrl,
} = require("../shorts-placeholder-pool-contract");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const COUNTS = Object.freeze({
  [DEFAULT_VIDEO_IDS.A]: Object.freeze({ dislikes: 11, likes: 89 }),
  [DEFAULT_VIDEO_IDS.B]: Object.freeze({ dislikes: 35, likes: 65 }),
  [DEFAULT_VIDEO_IDS.C]: Object.freeze({ dislikes: 70, likes: 30 }),
});
const INITIALIZATION_WARNING = "Initialization failed; retrying when the current controls are ready.";
const SHORTS_VISUAL_REVIEW_DIRECTORY = path.join(REPOSITORY_ROOT, "test-results", "visual-review", "extension");
const SYNTHETIC_SHORTS_STORAGE_PREFIX = "rydSyntheticDislikedShort:";
const SHORTS_TRANSITION_CASES = Object.freeze([
  Object.freeze({
    action: "like",
    dislikesDelta: 0,
    initialState: "neutral",
    likesDelta: 1,
    nextState: "liked",
    value: 1,
  }),
  Object.freeze({
    action: "like",
    dislikesDelta: 0,
    initialState: "liked",
    likesDelta: -1,
    nextState: "neutral",
    value: 0,
  }),
  Object.freeze({
    action: "like",
    dislikesDelta: -1,
    initialState: "disliked",
    likesDelta: 1,
    nextState: "liked",
    value: 1,
  }),
  Object.freeze({
    action: "dislike",
    dislikesDelta: 1,
    initialState: "neutral",
    likesDelta: 0,
    nextState: "disliked",
    value: -1,
  }),
  Object.freeze({
    action: "dislike",
    dislikesDelta: -1,
    initialState: "disliked",
    likesDelta: 0,
    nextState: "neutral",
    value: 0,
  }),
  Object.freeze({
    action: "dislike",
    dislikesDelta: 1,
    initialState: "liked",
    likesDelta: -1,
    nextState: "disliked",
    value: -1,
  }),
]);

async function captureShortsVisualReview(page, scenario) {
  const outputPath = path.join(SHORTS_VISUAL_REVIEW_DIRECTORY, `${scenario.id}.png`);
  return captureOptionalVisualEvidence({
    capture: async (screenshotPath) => {
      fs.mkdirSync(SHORTS_VISUAL_REVIEW_DIRECTORY, { recursive: true });
      const renderer = page.locator(`ytd-reel-video-renderer[video-id="${scenario.destination.videoId}"][is-active]`);
      await renderer.screenshot({ animations: "disabled", path: screenshotPath });
    },
    outputPath,
  });
}

function videoCountsForScenario(scenario) {
  return {
    [scenario.origin.videoId]: scenario.origin.counts,
    [scenario.destination.videoId]: scenario.destination.counts,
  };
}

function testFailed(testInfo, caughtError) {
  return Boolean(caughtError) || (testInfo.status && testInfo.status !== testInfo.expectedStatus);
}

async function attachFailureEvidence(runtime, testInfo) {
  const screenshotPath = testInfo.outputPath("extension-navigation-failure.png");
  try {
    await runtime.page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach("extension-navigation-page", { contentType: "image/png", path: screenshotPath });
  } catch {
    // Preserve the original test failure if the page or context already closed.
  }
}

async function withExtensionArtifact(testInfo, { countsByVideo, installRoute } = {}, run) {
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
    backendOptions: { countsByVideo },
  });
  const runtime = {
    adapter,
    apiServer,
    caughtError: null,
    initializationWarnings: [],
    unexpectedFixtureRequests: [],
    workerErrors: [],
  };

  try {
    await adapter.start();
    runtime.page = adapter.page;
    runtime.page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes(INITIALIZATION_WARNING)) {
        runtime.initializationWarnings.push(message.text());
      }
    });
    adapter.worker.on("console", (message) => {
      if (["warning", "error", "assert"].includes(message.type())) runtime.workerErrors.push(message.text());
    });
    if (installRoute) await installRoute(runtime);
    await run(runtime);
  } catch (error) {
    runtime.caughtError = error;
    throw error;
  } finally {
    const failed = testFailed(testInfo, runtime.caughtError);
    if (adapter.context && failed) await attachFailureEvidence(runtime, testInfo);
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

async function assertHermeticRuntime(runtime, scenarioId) {
  await runtime.adapter.pageSignals.assertClean(scenarioId);
  expect(runtime.initializationWarnings, "initialization must wait for usable controls instead of throwing").toEqual(
    [],
  );
  expect(runtime.workerErrors, "the MV3 background worker emitted a warning or error").toEqual([]);
  expect(runtime.unexpectedFixtureRequests, "the owned fixture attempted unexpected YouTube requests").toEqual([]);
  expect(runtime.adapter.backend.blockedRequests, "the content script escaped the hermetic route set").toEqual([]);
  expect(runtime.apiServer.unexpectedRequests, "the MV3 background escaped the fake protocol").toEqual([]);
}

async function installOwnedLifecycleRoute(runtime) {
  await runtime.adapter.context.route("https://www.youtube.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === "document" && url.pathname === "/watch") {
      await route.fulfill({
        body: createExtensionNavigationFixture({
          initialVideoId: url.searchParams.get("v") || DEFAULT_VIDEO_IDS.A,
          likesByVideo: Object.fromEntries(Object.entries(COUNTS).map(([videoId, counts]) => [videoId, counts.likes])),
        }),
        contentType: "text/html; charset=utf-8",
        status: 200,
      });
      return;
    }

    runtime.unexpectedFixtureRequests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    });
    await route.abort("blockedbyclient");
  });
}

async function installHrefIdentifiedShortsTopology(context) {
  await context.addInitScript(
    ({ videoA, videoB }) => {
      if (location.hostname !== "www.youtube.com") return;

      document.addEventListener(
        "DOMContentLoaded",
        () => {
          const params = new URL(location.href).searchParams;
          if (params.get("rydHrefIdentifiedShorts") !== "1") return;

          const rendererFor = (videoId) =>
            Array.from(document.querySelectorAll("ytd-reel-video-renderer")).find((renderer) => {
              const href = renderer.querySelector("a[href*='/shorts/']")?.getAttribute("href");
              return href && new URL(href, location.href).pathname === `/shorts/${videoId}`;
            });

          for (const renderer of document.querySelectorAll("ytd-reel-video-renderer")) {
            renderer.removeAttribute("is-active");
            renderer.removeAttribute("video-id");
            renderer.querySelector("#experiment-overlay")?.remove();
            const sequence = renderer.parentElement;
            sequence?.classList.remove("reel-video-in-sequence-new");
            sequence?.querySelector(".reel-video-in-sequence-thumbnail")?.remove();
          }

          const next = document.querySelector("#short-next");
          if (!next) throw new Error("The href-identified Shorts fixture has no next control.");
          next.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();

              const outgoing = rendererFor(videoA);
              const destination = rendererFor(videoB);
              if (!outgoing || !destination) {
                throw new Error("The href-identified Shorts fixture is missing a renderer.");
              }

              document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
              history.pushState(
                {},
                "",
                `/shorts/${videoB}?rydNavigationFixture=1&rydRuntime=extension&rydHrefIdentifiedShorts=1`,
              );
              outgoing.hidden = true;
              destination.hidden = false;
              const like = destination.querySelector('[data-fixture-role="like"]');
              like?.classList.remove("style-default-active");
              like?.classList.add("style-text");
              like?.querySelector("button")?.setAttribute("aria-pressed", "false");
              document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
            },
            true,
          );
        },
        { once: true },
      );
    },
    { videoA: DEFAULT_VIDEO_IDS.A, videoB: DEFAULT_VIDEO_IDS.B },
  );
}

async function installShortsNativeLikeBehavior(context, initialState) {
  await context.addInitScript((state) => {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const like = document.querySelector(
          "ytd-reel-video-renderer[is-active] reel-action-bar-view-model like-button-view-model",
        );
        const button = like?.querySelector("button");
        const count = like?.querySelector("#text, [role='text']");
        if (!like || !button || !count) throw new Error("The Shorts transition fixture has no native Like action.");

        const setLiked = (liked) => {
          like.classList.toggle("style-default-active", liked);
          like.classList.toggle("style-text", !liked);
          button.setAttribute("aria-pressed", String(liked));
        };
        setLiked(state === "liked");
      },
      { once: true },
    );
  }, initialState);
}

async function installShortsPremiumTeaserContainer(context) {
  await context.addInitScript(() => {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const secondary = document.createElement("aside");
        secondary.id = "secondary";
        const inner = document.createElement("div");
        inner.id = "secondary-inner";
        secondary.append(inner);
        document.body.append(secondary);
      },
      { once: true },
    );
  });
}

async function setStoredSyntheticShortsState(runtime, videoId, disliked) {
  const key = `${SYNTHETIC_SHORTS_STORAGE_PREFIX}${videoId}`;
  await runtime.adapter.worker.evaluate(
    async ({ disliked: nextDisliked, key: storageKey }) => {
      if (nextDisliked) await chrome.storage.local.set({ [storageKey]: true });
      else await chrome.storage.local.remove([storageKey]);
    },
    { disliked, key },
  );
}

async function readStoredSyntheticShortsState(runtime, videoId) {
  const key = `${SYNTHETIC_SHORTS_STORAGE_PREFIX}${videoId}`;
  return runtime.adapter.worker.evaluate(
    async (storageKey) => (await chrome.storage.local.get([storageKey]))[storageKey] === true,
    key,
  );
}

async function openLifecycleFixture(runtime, { delayed = false } = {}) {
  const initial = delayed ? "&initial=delayed" : "";
  await runtime.page.goto(`https://www.youtube.com/watch?v=${DEFAULT_VIDEO_IDS.A}&rydExtensionLifecycle=1${initial}`, {
    waitUntil: "domcontentloaded",
  });
  await runtime.page.waitForFunction(() => Boolean(globalThis.__extensionLifecycleFixture));
}

function statsRequests(runtime, videoId) {
  return runtime.adapter.backend.requestsFor("GET", "/votes").filter((request) => request.query.videoId === videoId);
}

async function collectMatrixFailureDiagnostics(runtime) {
  return {
    countRequestVideoIds: runtime.adapter.backend.requestsFor("GET", "/votes").map((request) => request.query.videoId),
    initializationWarnings: [...runtime.initializationWarnings],
    pageSignals: runtime.adapter.pageSignals.snapshot(),
    probe: await runtime.page.evaluate(() => globalThis.__navigationMatrixProbe?.snapshot?.() ?? null),
    shortsReadiness: await runtime.page.evaluate(() => {
      const box = (element) => {
        const rect = element?.getBoundingClientRect();
        return rect
          ? {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          : null;
      };
      return [...document.querySelectorAll(".reel-video-in-sequence-new")].map((container) => {
        const renderer = container.querySelector("ytd-reel-video-renderer");
        const overlay = renderer?.querySelector("#experiment-overlay");
        return {
          container: box(container),
          overlayChildren: overlay?.childNodes.length ?? null,
          overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
          renderer: box(renderer),
          rendererActive: renderer?.hasAttribute("is-active") ?? false,
          rendererHidden: renderer?.hidden ?? null,
          videoId: renderer?.getAttribute("video-id") ?? null,
          viewport: { height: innerHeight, width: innerWidth },
        };
      });
    }),
  };
}

async function readLifecycleSnapshot(page) {
  return page.evaluate(() => globalThis.__extensionLifecycleFixture.snapshot());
}

async function expectNoSkeletonMisbind(runtime, videoId, { retainedBarCount = 0, statsRequestCount = 0 } = {}) {
  await runtime.page.waitForTimeout(650);
  const snapshot = await readLifecycleSnapshot(runtime.page);
  expect(snapshot).toMatchObject({
    currentBarCount: 0,
    currentButtonCount: 0,
    currentCount: "",
    currentCountContainerCount: 0,
    currentCountCreatedByRuntime: false,
    currentNativeDislikeTextCount: 0,
    currentVideoId: videoId,
    hiddenDuplicateBarCount: 0,
    phase: "skeleton",
    retainedBarCount,
    unrelatedBarCount: 0,
    unrelatedLabels: ["Share", "Download"],
    urlVideoId: videoId,
  });
  expect(snapshot.globalBarCount).toBe(retainedBarCount);
  expect(snapshot.globalContainerCount).toBe(retainedBarCount);
  expect(snapshot.globalWrapperCount).toBe(retainedBarCount);
  await expect(runtime.page.locator("#ryd-bar:visible")).toHaveCount(0);
  expect(statsRequests(runtime, videoId)).toHaveLength(statsRequestCount);
  expect(runtime.initializationWarnings).toEqual([]);
}

async function expectCurrentSurface(runtime, videoId, counts, { soakMs = 650 } = {}) {
  const page = runtime.page;
  const currentHost = page.locator('[data-fixture-current-actions="true"]');
  const likeButton = currentHost.locator('like-button-view-model [data-fixture-native-role="like"]');
  const dislikeButton = currentHost.locator('dislike-button-view-model [data-fixture-native-role="dislike"]');
  const currentCount = currentHost.locator(
    'dislike-button-view-model [data-fixture-native-role="dislike"] .ytSpecButtonShapeNextButtonTextContent',
  );
  const currentCountText = currentCount.locator("#text");
  const currentContainer = currentHost.locator("#ryd-bar-container");
  const currentBar = currentHost.locator("#ryd-bar");

  await expect(page).toHaveURL((url) => url.pathname === "/watch" && url.searchParams.get("v") === videoId);
  await expect(currentHost).toHaveCount(1);
  await expect(currentHost).toBeVisible();
  await expect(
    currentHost.locator(
      "segmented-like-dislike-button-view-model > yt-smartimation > [data-fixture-smartimation-content-shell] > [data-fixture-smartimation-content] > like-button-view-model",
    ),
  ).toHaveCount(1);
  await expect(
    currentHost.locator(
      "segmented-like-dislike-button-view-model > yt-smartimation > [data-fixture-smartimation-content-shell] > [data-fixture-smartimation-content] > dislike-button-view-model",
    ),
  ).toHaveCount(1);
  await expect(currentHost).toHaveAttribute("data-fixture-native-dislike-text-count", "0");
  await expect(currentCount).toHaveCount(1);
  await expect(currentCountText).toHaveCount(1);
  await expect(currentCountText).toHaveText(String(counts.dislikes));
  await expect(likeButton).toHaveCount(1);
  await expect(likeButton).toBeVisible();
  await expect(dislikeButton).toHaveCount(1);
  await expect(dislikeButton).toBeVisible();
  await expect(currentHost.locator("like-button-view-model [role='text']")).toHaveText(String(counts.likes));
  await expect(currentHost.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(currentContainer).toHaveCount(1);
  await expect(currentContainer).toBeVisible();
  await expect(currentBar).toHaveCount(1);
  await expect(currentBar).toBeVisible();
  await expect(currentHost.locator("#ryd-dislike-tooltip")).toContainText(`${counts.likes} / ${counts.dislikes}`);

  const geometry = await currentHost.evaluate((host) => {
    const container = host.querySelector("#ryd-bar-container");
    const containerBox = container.getBoundingClientRect();
    return {
      containerHeight: containerBox.height,
      containerWidth: containerBox.width,
    };
  });
  expect(geometry.containerHeight).toBeGreaterThanOrEqual(2);
  expect(geometry.containerWidth).toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        currentHost.evaluate((host) => {
          const containerBox = host.querySelector("#ryd-bar-container").getBoundingClientRect();
          const fillBox = host.querySelector("#ryd-bar").getBoundingClientRect();
          return containerBox.width > 0 ? fillBox.width / containerBox.width : null;
        }),
      { message: "the visible rate-bar fill must settle to the current video's counts" },
    )
    .toBeCloseTo(counts.likes / (counts.likes + counts.dislikes), 2);

  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#ryd-bar-container")).toHaveCount(1);
  await expect(page.locator("#ryd-bar")).toHaveCount(1);
  await expect(page.locator('[data-fixture-unrelated-actions="true"] #ryd-bar')).toHaveCount(0);
  await expect(page.locator('[data-fixture-hidden-duplicate="true"] #ryd-bar')).toHaveCount(0);
  await expect(page.locator('[data-fixture-retained-outgoing="true"] #ryd-bar')).toHaveCount(0);
  await expect(page.locator('[data-fixture-unrelated-control="share"] span[role="text"]')).toHaveText("Share");
  await expect(page.locator('[data-fixture-unrelated-control="download"] span[role="text"]')).toHaveText("Download");

  await page.waitForTimeout(soakMs);
  await expect(currentCount).toHaveText(String(counts.dislikes));
  await expect(page.locator(".ryd-tooltip")).toHaveCount(1);
  await expect(page.locator("#ryd-bar-container")).toHaveCount(1);
  await expect(page.locator("#ryd-bar")).toHaveCount(1);
}

async function hydrateAndExpect(runtime, videoId, counts) {
  await runtime.page.evaluate(() => globalThis.__extensionLifecycleFixture.hydratePending());
  await expectCurrentSurface(runtime, videoId, counts);
}

async function replaceCurrentHostAndExpect(runtime, videoId, counts) {
  const previousIdentity = (await readLifecycleSnapshot(runtime.page)).currentHostIdentity;
  const replacementIdentity = await runtime.page.evaluate(() =>
    globalThis.__extensionLifecycleFixture.replaceReadyHost(),
  );
  expect(replacementIdentity).not.toBe(previousIdentity);
  await expectCurrentSurface(runtime, videoId, counts);
}

async function expectOneVoteAndConfirmation(runtime, videoId, value, activationTarget) {
  const interactionStart = runtime.apiServer.records.length;
  const target =
    activationTarget ?? runtime.page.locator('[data-fixture-current-actions="true"] dislike-button-view-model button');
  await target.click();

  const readInteractions = () =>
    runtime.apiServer.records
      .slice(interactionStart)
      .filter(
        (record) =>
          record.method !== "OPTIONS" && ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
      );
  await expect.poll(() => readInteractions().length).toBe(2);
  await runtime.page.waitForTimeout(400);

  const interactions = readInteractions();
  expect(interactions.map((record) => record.pathname)).toEqual(["/interact/vote", "/interact/confirmVote"]);
  expect(interactions[0].body).toEqual({
    userId: expect.stringMatching(/^[A-Za-z0-9]{36}$/),
    value,
    videoId,
  });
  expect(interactions[1].body).toEqual({
    solution: expect.any(String),
    userId: interactions[0].body.userId,
    videoId,
  });
  expect(Buffer.from(interactions[1].body.solution, "base64")).toHaveLength(4);
  expect(interactions[1]).toMatchObject({ responseBody: true, responseStatus: 200 });
  expect(readInteractions()).toHaveLength(2);
  return interactions[0].body.userId;
}

test.describe("generated extension artifact Shorts placeholder pool", () => {
  test("preserves every action through ten pre-rendered and recycled Next transitions", async ({}, testInfo) => {
    test.setTimeout(45_000);
    await withExtensionArtifact(
      testInfo,
      {
        countsByVideo: SHORTS_PLACEHOLDER_POOL_COUNTS,
        installRoute: async (runtime) => {
          await installShortsPlaceholderPoolRoute(runtime.adapter.context, {
            onUnexpectedRequest: (request) => runtime.unexpectedFixtureRequests.push(request),
          });
        },
      },
      async (runtime) => {
        await runtime.page.setViewportSize({ height: 720, width: 1280 });
        await runtime.page.goto(shortsPlaceholderPoolUrl(), { waitUntil: "domcontentloaded" });
        const results = await runShortsPlaceholderPoolContract({
          page: runtime.page,
          readRequests: () => runtime.adapter.backend.requests,
          runtimeName: "extension",
        });

        expect(results).toHaveLength(11);
        expect(results.filter((result) => result.pixelOracle).map((result) => result.logicalIndex)).toEqual([0, 1, 10]);
        expect(
          runtime.apiServer.records.filter((record) =>
            ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
          ),
        ).toEqual([]);
        await assertHermeticRuntime(runtime, "shorts-placeholder-pool-ten-next");
      },
    );
  });
});

test.describe("generated extension artifact navigation matrix", () => {
  registerNavigationRuntimeContractScenarios({
    runtimeName: "extension",
    register: ({ scenario, title }) => {
      test(title, async ({}, testInfo) => {
        await withExtensionArtifact(testInfo, { countsByVideo: videoCountsForScenario(scenario) }, async (runtime) => {
          await runtime.page.setViewportSize(scenario.viewport);
          await installNavigationMatrixFixture(runtime.adapter.context, scenario);
          const pageKind = scenario.origin.kind;
          const marker = "rydNavigationFixture=1&rydRuntime=extension";
          const url =
            pageKind === "shorts"
              ? `https://www.youtube.com/shorts/${scenario.origin.videoId}?${marker}`
              : `https://www.youtube.com/watch?v=${scenario.origin.videoId}&${marker}`;
          await runtime.page.goto(url, { waitUntil: "domcontentloaded" });

          try {
            const adapter = createNavigationRuntimeContractAdapter({
              backend: runtime.adapter.backend,
              matrixRuntime: EXTENSION_MATRIX_RUNTIME,
              page: runtime.page,
              readInteractionRecords: () => runtime.apiServer.records,
              runtimeName: "extension",
            });
            await runNavigationRuntimeContract({
              adapter,
              afterNavigation: async () => {
                if (!scenario.id.startsWith("short-next-short-active-reel")) return;
                const shortsVisual = await readExtensionShortsVisualContract(
                  runtime.page,
                  scenario.destination.videoId,
                );
                expectExtensionShortsVisualContract(shortsVisual, scenario.destination.counts, scenario.viewport);
                annotateVisualEvidence(testInfo, await captureShortsVisualReview(runtime.page, scenario));
              },
              scenario,
            });
            if (scenario.destination.kind === "shorts") {
              await expect
                .poll(() => readStoredSyntheticShortsState(runtime, scenario.destination.videoId))
                .toBe(false);
            }
          } catch (error) {
            error.message += `\nExtension navigation diagnostics: ${JSON.stringify(
              await collectMatrixFailureDiagnostics(runtime),
            )}`;
            throw error;
          }
          await assertHermeticRuntime(runtime, scenario.id);
        });
      });
    },
  });
});

test.describe("generated extension artifact current Shorts topology", () => {
  test("premium teaser and the Shorts renderer share one aggregate request per navigation", async ({}, testInfo) => {
    const scenario = NAVIGATION_MATRIX.find(({ id }) => id === "short-next-short-active-reel");
    await withExtensionArtifact(testInfo, { countsByVideo: videoCountsForScenario(scenario) }, async (runtime) => {
      await runtime.page.setViewportSize(scenario.viewport);
      await installShortsPremiumTeaserContainer(runtime.adapter.context);
      await installNavigationMatrixFixture(runtime.adapter.context, scenario);
      await runtime.page.goto(
        `https://www.youtube.com/shorts/${scenario.origin.videoId}` +
          "?rydNavigationFixture=1&rydRuntime=extension&rydPremiumTeaser=1",
        { waitUntil: "domcontentloaded" },
      );

      await expect(runtime.page.locator(".ryd-premium-teaser")).toHaveCount(1);
      await expect(
        runtime.page.locator(
          `ytd-reel-video-renderer[video-id="${scenario.origin.videoId}"] [data-ryd-synthetic-shorts-dislike] #text`,
        ),
      ).toHaveText(String(scenario.origin.counts.dislikes));
      expect(statsRequests(runtime, scenario.origin.videoId)).toHaveLength(1);

      await runtime.page.locator("#short-next").click();

      await expect(runtime.page).toHaveURL((url) => url.pathname === `/shorts/${scenario.destination.videoId}`);
      await expect(
        runtime.page.locator(
          `ytd-reel-video-renderer[video-id="${scenario.destination.videoId}"] [data-ryd-synthetic-shorts-dislike] #text`,
        ),
      ).toHaveText(String(scenario.destination.counts.dislikes));
      await expect(runtime.page.locator("#ryd-premium-teaser-dislikes")).toHaveText(
        String(scenario.destination.counts.dislikes),
      );
      expect(statsRequests(runtime, scenario.origin.videoId)).toHaveLength(1);
      expect(statsRequests(runtime, scenario.destination.videoId)).toHaveLength(1);
      await runtime.page.waitForTimeout(650);
      expect(statsRequests(runtime, scenario.destination.videoId)).toHaveLength(1);
      await assertHermeticRuntime(runtime, "shorts-premium-teaser-request-coalescing");
    });
  });

  test("href-only renderer identity initializes directly and after next-Short navigation", async ({}, testInfo) => {
    await withExtensionArtifact(testInfo, { countsByVideo: COUNTS }, async (runtime) => {
      await runtime.page.setViewportSize({ height: 720, width: 1280 });
      await installHrefIdentifiedShortsTopology(runtime.adapter.context);
      await runtime.page.goto(
        `https://www.youtube.com/shorts/${DEFAULT_VIDEO_IDS.A}` +
          "?rydNavigationFixture=1&rydRuntime=extension&rydHrefIdentifiedShorts=1",
        { waitUntil: "domcontentloaded" },
      );

      const rendererFor = (videoId) =>
        runtime.page.locator("ytd-reel-video-renderer").filter({
          has: runtime.page.locator(`a[href='/shorts/${videoId}']`),
        });
      const dislikeFor = (videoId) => rendererFor(videoId).locator("[data-ryd-synthetic-shorts-dislike]");
      const rendererA = rendererFor(DEFAULT_VIDEO_IDS.A);
      const rendererB = rendererFor(DEFAULT_VIDEO_IDS.B);

      await expect(rendererA).toHaveCount(1);
      await expect(rendererA).toBeVisible();
      await expect(rendererA).not.toHaveAttribute("is-active", /.*/);
      await expect(rendererA).not.toHaveAttribute("video-id", /.*/);
      await expect(runtime.page.locator(".reel-video-in-sequence-new")).toHaveCount(0);
      await expect(runtime.page.locator(".reel-video-in-sequence-thumbnail")).toHaveCount(0);
      await expect(runtime.page.locator("#experiment-overlay")).toHaveCount(0);
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.A).locator("#text")).toHaveText(
        String(COUNTS[DEFAULT_VIDEO_IDS.A].dislikes),
      );
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.A)).toHaveAttribute("data-ryd-video-id", DEFAULT_VIDEO_IDS.A);
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.A).locator("button")).toBeEnabled();
      await expect(rendererA.locator("reel-action-bar-view-model button:visible")).toHaveCount(6);
      expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(1);
      expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(0);

      await runtime.page.locator("#short-next").click();

      await expect(runtime.page).toHaveURL((url) => url.pathname === `/shorts/${DEFAULT_VIDEO_IDS.B}`);
      await expect(rendererA).toBeHidden();
      await expect(rendererB).toBeVisible();
      await expect(rendererB).not.toHaveAttribute("is-active", /.*/);
      await expect(rendererB).not.toHaveAttribute("video-id", /.*/);
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B).locator("#text")).toHaveText(
        String(COUNTS[DEFAULT_VIDEO_IDS.B].dislikes),
      );
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B)).toHaveAttribute("data-ryd-video-id", DEFAULT_VIDEO_IDS.B);
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B).locator("button")).toBeEnabled();
      await expect(rendererB.locator("reel-action-bar-view-model button:visible")).toHaveCount(6);
      await expect(runtime.page.locator("[data-ryd-synthetic-shorts-dislike]:visible")).toHaveCount(1);
      await expect(runtime.page.locator("dislike-button-view-model, #dislike-button")).toHaveCount(0);
      expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(1);
      expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(1);
      expect(
        runtime.apiServer.records.filter((record) =>
          ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
        ),
      ).toEqual([]);

      await expectOneVoteAndConfirmation(
        runtime,
        DEFAULT_VIDEO_IDS.B,
        -1,
        dislikeFor(DEFAULT_VIDEO_IDS.B).locator("button"),
      );
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B).locator("#text")).toHaveText(
        String(COUNTS[DEFAULT_VIDEO_IDS.B].dislikes + 1),
      );
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B).locator("button")).toHaveAttribute("aria-pressed", "true");
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.B)).toHaveClass(/style-default-active/);
      await expect
        .poll(() =>
          runtime.adapter.worker.evaluate(async ({ key }) => (await chrome.storage.local.get([key]))[key], {
            key: `rydSyntheticDislikedShort:${DEFAULT_VIDEO_IDS.B}`,
          }),
        )
        .toBe(true);
      await expect(rendererA).toBeHidden();
      await expect(dislikeFor(DEFAULT_VIDEO_IDS.A).locator("#text")).not.toHaveText(
        String(COUNTS[DEFAULT_VIDEO_IDS.B].dislikes + 1),
      );
      await assertHermeticRuntime(runtime, "href-only-current-shorts-topology");
    });
  });
});

test.describe("generated extension artifact synthetic Shorts vote transitions", () => {
  for (const transition of SHORTS_TRANSITION_CASES) {
    test(`${transition.initialState} + ${transition.action} -> ${transition.nextState}`, async ({}, testInfo) => {
      await withExtensionArtifact(testInfo, { countsByVideo: COUNTS }, async (runtime) => {
        const videoId = DEFAULT_VIDEO_IDS.A;
        const initialCounts = COUNTS[videoId];
        await runtime.page.setViewportSize({ height: 720, width: 1280 });
        await installShortsNativeLikeBehavior(runtime.adapter.context, transition.initialState);
        await setStoredSyntheticShortsState(runtime, videoId, transition.initialState === "disliked");
        await runtime.page.goto(
          `https://www.youtube.com/shorts/${videoId}?rydNavigationFixture=1&rydRuntime=extension`,
          { waitUntil: "domcontentloaded" },
        );

        const renderer = runtime.page.locator(`ytd-reel-video-renderer[video-id="${videoId}"][is-active]`);
        const like = renderer.locator("like-button-view-model");
        const likeButton = like.locator("button");
        const likeCount = like.locator("#text, [role='text']");
        const dislike = renderer.locator("[data-ryd-synthetic-shorts-dislike]");
        const dislikeButton = dislike.locator("button");
        const dislikeCount = dislike.locator("#text, [role='text']");

        await expect(dislike).toHaveCount(1);
        await expect(dislikeButton).toBeEnabled();
        await expect(dislikeCount).toHaveText(String(initialCounts.dislikes));
        await expect(likeCount).toHaveText(String(initialCounts.likes));
        await expect(likeButton).toHaveAttribute("aria-pressed", String(transition.initialState === "liked"));
        await expect(dislikeButton).toHaveAttribute("aria-pressed", String(transition.initialState === "disliked"));
        await expect(renderer.locator("reel-action-bar-view-model button:visible")).toHaveCount(6);

        const nativeReactionStatsBefore = await runtime.page.evaluate(() =>
          globalThis.__navigationFixture.nativeReactionSnapshot(),
        );
        const activationTarget = transition.action === "like" ? likeButton : dislikeButton;
        await expectOneVoteAndConfirmation(runtime, videoId, transition.value, activationTarget);

        const expectedLikes = initialCounts.likes + transition.likesDelta;
        const expectedDislikes = initialCounts.dislikes + transition.dislikesDelta;
        await expect(likeCount).toHaveText(String(expectedLikes));
        await expect(dislikeCount).toHaveText(String(expectedDislikes));
        await expect(likeButton).toHaveAttribute("aria-pressed", String(transition.nextState === "liked"));
        await expect(dislikeButton).toHaveAttribute("aria-pressed", String(transition.nextState === "disliked"));
        await expect(dislike).toHaveClass(transition.nextState === "disliked" ? /style-default-active/ : /style-text/);
        await expect
          .poll(() => readStoredSyntheticShortsState(runtime, videoId))
          .toBe(transition.nextState === "disliked");
        await expect(renderer.locator("[data-ryd-synthetic-shorts-dislike]")).toHaveCount(1);
        const nativeReactionStatsAfter = await runtime.page.evaluate(() =>
          globalThis.__navigationFixture.nativeReactionSnapshot(),
        );
        const expectedNativeLikeActivations =
          transition.action === "like" || (transition.action === "dislike" && transition.initialState === "liked")
            ? 1
            : 0;
        expect(nativeReactionStatsAfter.activations - nativeReactionStatsBefore.activations).toBe(
          expectedNativeLikeActivations,
        );
        expect(nativeReactionStatsAfter.likeActivations - nativeReactionStatsBefore.likeActivations).toBe(
          expectedNativeLikeActivations,
        );
        expect(nativeReactionStatsAfter.dislikeActivations - nativeReactionStatsBefore.dislikeActivations).toBe(0);
        await assertHermeticRuntime(runtime, `synthetic-shorts-${transition.initialState}-${transition.action}`);
      });
    });
  }
});

test.describe("generated extension artifact real watch topology", () => {
  test("direct load waits through a native-button skeleton and initializes once after in-place hydration", async ({}, testInfo) => {
    await withExtensionArtifact(
      testInfo,
      { countsByVideo: COUNTS, installRoute: installOwnedLifecycleRoute },
      async (runtime) => {
        await openLifecycleFixture(runtime, { delayed: true });
        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.A);
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(1);
        await assertHermeticRuntime(runtime, "direct-delayed-hydration");
      },
    );
  });

  test("recommendation navigation reuses A-owned controls instead of Share/Download or a hidden duplicate", async ({}, testInfo) => {
    await withExtensionArtifact(
      testInfo,
      { countsByVideo: COUNTS, installRoute: installOwnedLifecycleRoute },
      async (runtime) => {
        await openLifecycleFixture(runtime);
        await expectCurrentSurface(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);
        const outgoing = await readLifecycleSnapshot(runtime.page);

        await runtime.page.locator("#fixture-recommendation").click();

        const skeleton = await readLifecycleSnapshot(runtime.page);
        expect(skeleton.currentHostIdentity).toBe(outgoing.currentHostIdentity);
        expect(skeleton.currentFixtureControlVideoId).toBe(DEFAULT_VIDEO_IDS.A);
        expect(skeleton.phase).toBe("visible-outgoing");
        await expectCurrentSurface(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(1);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(1);

        await expectOneVoteAndConfirmation(runtime, DEFAULT_VIDEO_IDS.B, -1);
        await expect(
          runtime.page.locator(
            '[data-fixture-current-actions="true"] dislike-button-view-model .ytSpecButtonShapeNextButtonTextContent',
          ),
        ).toHaveText(String(COUNTS[DEFAULT_VIDEO_IDS.B].dislikes + 1));
        await expect(
          runtime.page.locator('[data-fixture-current-actions="true"] like-button-view-model [role="text"]'),
        ).toHaveText(String(COUNTS[DEFAULT_VIDEO_IDS.B].likes));
        await assertHermeticRuntime(runtime, "recommendation-reused-controls");
      },
    );
  });

  test("SPA navigation waits for in-place native-button hydration without a second navigation event", async ({}, testInfo) => {
    await withExtensionArtifact(
      testInfo,
      { countsByVideo: COUNTS, installRoute: installOwnedLifecycleRoute },
      async (runtime) => {
        await openLifecycleFixture(runtime);
        await expectCurrentSurface(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);
        const outgoing = await readLifecycleSnapshot(runtime.page);

        await runtime.page.evaluate((videoId) => {
          globalThis.__extensionLifecycleFixture.beginNavigation(videoId, {
            mode: "reuse-in-place",
            pushState: true,
            trigger: "delayed-in-place",
          });
        }, DEFAULT_VIDEO_IDS.B);

        const skeleton = await readLifecycleSnapshot(runtime.page);
        expect(skeleton.currentHostIdentity).toBe(outgoing.currentHostIdentity);
        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.B);
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(1);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(1);
        await assertHermeticRuntime(runtime, "spa-delayed-in-place-hydration");
      },
    );
  });

  test("playlist host replacement recovers without a second navigation event and deduplicates listeners", async ({}, testInfo) => {
    await withExtensionArtifact(
      testInfo,
      { countsByVideo: COUNTS, installRoute: installOwnedLifecycleRoute },
      async (runtime) => {
        await openLifecycleFixture(runtime);
        await expectCurrentSurface(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);

        await runtime.page.locator("#fixture-playlist").click();

        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.B);
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(1);

        await replaceCurrentHostAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);
        await replaceCurrentHostAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(1);

        await expectOneVoteAndConfirmation(runtime, DEFAULT_VIDEO_IDS.B, -1);
        await expect(
          runtime.page.locator(
            '[data-fixture-current-actions="true"] dislike-button-view-model .ytSpecButtonShapeNextButtonTextContent',
          ),
        ).toHaveText(String(COUNTS[DEFAULT_VIDEO_IDS.B].dislikes + 1));
        await expect(runtime.page.locator("#ryd-bar")).toHaveCount(1);
        await assertHermeticRuntime(runtime, "playlist-replacement-and-vote");
      },
    );
  });

  test("history back and forward repeatedly replace controls without losing or duplicating the current surface", async ({}, testInfo) => {
    await withExtensionArtifact(
      testInfo,
      { countsByVideo: COUNTS, installRoute: installOwnedLifecycleRoute },
      async (runtime) => {
        await openLifecycleFixture(runtime);
        await expectCurrentSurface(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);
        await runtime.page.locator("#fixture-history-next").click();
        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.B);
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);

        await runtime.page.goBack();
        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.A, { statsRequestCount: 1 });
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.A, COUNTS[DEFAULT_VIDEO_IDS.A]);

        await runtime.page.goForward();
        await expectNoSkeletonMisbind(runtime, DEFAULT_VIDEO_IDS.B, { statsRequestCount: 1 });
        await hydrateAndExpect(runtime, DEFAULT_VIDEO_IDS.B, COUNTS[DEFAULT_VIDEO_IDS.B]);

        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.A)).toHaveLength(2);
        expect(statsRequests(runtime, DEFAULT_VIDEO_IDS.B)).toHaveLength(2);
        await expect(runtime.page.locator(".ryd-tooltip")).toHaveCount(1);
        await expect(runtime.page.locator("#ryd-bar-container")).toHaveCount(1);
        await expect(runtime.page.locator("#ryd-bar")).toHaveCount(1);
        await assertHermeticRuntime(runtime, "history-back-forward-replacements");
      },
    );
  });
});
