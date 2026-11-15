const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const {
  HermeticExtensionArtifactAdapter,
  isArtifactVoteHandshakeValid,
  readArtifactVoteHandshake,
  startHermeticApiServer,
} = require("../hermetic-artifact-smoke");
const { assertInvariantContinuously } = require("../continuous-invariants");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const SHORTS_FIXTURE = fs.readFileSync(path.join(__dirname, "../../UserScript/e2e/fixtures/shorts-page.html"), "utf8");
const COUNTS = Object.freeze({
  [VIDEO_A]: Object.freeze({ dislikes: 25, likes: 100 }),
  [VIDEO_B]: Object.freeze({ dislikes: 65, likes: 35 }),
});
const OWNED_DISLIKE = "[data-ryd-synthetic-shorts-dislike]";
const NATIVE_LIKE = "like-button-view-model toggle-button-view-model > button-view-model > button[aria-pressed]";
const INJECTED_SPEED = ".vidiq-scope > button[data-fixture-speed-control]";

function createShortsFixture(videoId, preinstalled) {
  assert.ok(Object.hasOwn(COUNTS, videoId), "The injected-control fixture requires a synthetic video ID.");
  let html = SHORTS_FIXTURE.replaceAll("__VIDEO_ID__", videoId)
    .replaceAll("__SECOND_VIDEO_ID__", VIDEO_B)
    .replaceAll("__SHORTS_RENDERER_TAG__", "ytd-like-button-renderer")
    .replaceAll("__SIGNED_IN__", "true")
    .replaceAll("__INITIAL_STATE__", "neutral");
  const nativeLikeMarkup = /<label class="ytSpecButtonShapeWithLabelHost">[\s\S]*?<\/label>/;
  assert.equal(html.match(new RegExp(nativeLikeMarkup, "g"))?.length, 1);
  html = html.replace(
    nativeLikeMarkup,
    `<toggle-button-view-model>
      <button-view-model class="ytSpecButtonShapeWithLabelHost">
        <button class="ytSpecButtonShapeNextHost fixtureNativeReaction" data-fixture-native-like type="button"
          aria-label="100 likes" aria-pressed="false">
          <span class="ytSpecButtonShapeNextIcon" aria-hidden="true"><svg viewBox="0 0 24 24">
            <path d="M8 21H5V9h3v12Zm2 0V9l4-7 2 1v5h5v5l-3 8h-8Z"></path>
          </svg></span>
        </button>
        <div class="ytSpecButtonShapeWithLabelLabel">
          <span id="text" class="ytAttributedStringHost ytAttributedStringTextAlignmentCenter" role="text">100</span>
        </div>
      </button-view-model>
    </toggle-button-view-model>`,
  );
  // The host fixture models its native action explicitly; injected controls must not change native state.
  const nativeStateTarget = 'like.querySelector("button").setAttribute';
  const nativeActivationTarget = `if (actionButton.closest('[data-ryd-role="like"]'))`;
  assert.ok(html.includes(nativeStateTarget));
  assert.ok(html.includes(nativeActivationTarget));
  html = html
    .replace(nativeStateTarget, 'like.querySelector("button[data-fixture-native-like]").setAttribute')
    .replace(nativeActivationTarget, "if (actionButton.matches('[data-fixture-native-like]'))")
    .replace(
      "</style>",
      `like-button-view-model { position: relative; }
       .fixtureNativeReaction { background: rgb(39, 39, 39); border-radius: 50%; }
       .vidiq-scope { position: absolute; left: 56px; top: 0; }
       .vidiq-scope .fixtureInjectedSpeed {
         background: rgb(10, 70, 120); border-radius: 4px; color: white;
         height: 24px; padding: 0; width: 28px;
       }
       </style>`,
    )
    .replace(
      "</body>",
      `<script>
        (() => {
          let speedActivations = 0;
          function injectSpeedControl() {
            for (const like of document.querySelectorAll('like-button-view-model')) {
              if (like.querySelector('.vidiq-scope')) continue;
              const scope = document.createElement('div');
              scope.className = 'vidiq-scope';
              const speed = document.createElement('button');
              speed.type = 'button';
              speed.className = 'fixtureInjectedSpeed';
              speed.setAttribute('data-fixture-speed-control', '');
              speed.textContent = '1x';
              speed.addEventListener('click', () => { speedActivations += 1; });
              scope.append(speed);
              like.prepend(scope);
            }
          }
          globalThis.__injectedReactionFixture = {
            injectSpeedControl,
            speedActivations: () => speedActivations,
          };
          if (${preinstalled}) injectSpeedControl();
        })();
      </script>
      </body>`,
    );
  return html;
}

function activeRenderer(page, videoId) {
  return page.locator(`[data-short-video="${videoId}"]:not([hidden]) ytd-reel-video-renderer`);
}

async function readControls(adapter) {
  return adapter.page.evaluate(() => {
    const section = document.querySelector("[data-short-video]:not([hidden])");
    const renderer = section?.querySelector("ytd-reel-video-renderer");
    const nativeLike = renderer?.querySelector("button[data-fixture-native-like]");
    const dislike = renderer?.querySelector("[data-ryd-synthetic-shorts-dislike]");
    const dislikeButton = dislike?.querySelector("button");
    const speed = renderer?.querySelector(".vidiq-scope > button[data-fixture-speed-control]");
    const geometry = (button) => {
      if (!button) return null;
      const { width, height } = button.getBoundingClientRect();
      const icon = button.querySelector("svg")?.getBoundingClientRect();
      return {
        width,
        height,
        borderRadius: getComputedStyle(button).borderRadius,
        iconWidth: icon?.width ?? null,
        iconHeight: icon?.height ?? null,
      };
    };
    return {
      videoId: renderer?.getAttribute("video-id") ?? null,
      pathname: location.pathname,
      count: dislike?.querySelector("#text, [role='text']")?.textContent.trim() ?? null,
      ownedCount: renderer?.querySelectorAll("[data-ryd-synthetic-shorts-dislike]").length ?? 0,
      ownedVideoId: dislike?.getAttribute("data-ryd-video-id") ?? null,
      nativeLikePressed: nativeLike?.getAttribute("aria-pressed") ?? null,
      dislikePressed: dislikeButton?.getAttribute("aria-pressed") ?? null,
      dislikeDisabled: dislikeButton?.disabled ?? null,
      nativeGeometry: geometry(nativeLike),
      dislikeGeometry: geometry(dislikeButton),
      speedGeometry: geometry(speed),
      speedAriaPressed: speed?.getAttribute("aria-pressed") ?? null,
      speedActivations: globalThis.__injectedReactionFixture.speedActivations(),
      nativeLikeIsFirstButton: renderer?.querySelector("like-button-view-model button") === nativeLike,
      syntheticContainsSpeedControl: Boolean(dislike?.querySelector(".vidiq-scope, [data-fixture-speed-control]")),
    };
  });
}

async function expectReady(adapter, videoId, count = COUNTS[videoId].dislikes) {
  const renderer = activeRenderer(adapter.page, videoId);
  await expect(renderer.locator(OWNED_DISLIKE)).toHaveCount(1);
  await expect(renderer.locator(`${OWNED_DISLIKE} #text`)).toHaveText(String(count));
  await expect(renderer.locator(`${OWNED_DISLIKE} button`)).toBeEnabled();
  expect(await readControls(adapter)).toMatchObject({
    videoId,
    pathname: `/shorts/${videoId}`,
    ownedCount: 1,
    ownedVideoId: videoId,
    syntheticContainsSpeedControl: false,
    nativeGeometry: { width: 48, height: 48, borderRadius: "50%", iconWidth: 24, iconHeight: 24 },
    dislikeGeometry: { width: 48, height: 48, borderRadius: "50%", iconWidth: 24, iconHeight: 24 },
  });
}

async function expectSpeedDoesNotVote(adapter, apiServer, videoId) {
  const before = await readControls(adapter);
  const interactionStart = apiServer.records.length;
  expect(before.nativeLikeIsFirstButton).toBe(false);
  expect(before.speedAriaPressed).toBe(null);
  await activeRenderer(adapter.page, videoId).locator(INJECTED_SPEED).click();
  await assertInvariantContinuously({
    durationMs: 750,
    label: "The injected speed action leaves native and synthetic reactions unchanged and submits no vote",
    read: async () => ({
      controls: await readControls(adapter),
      interactionCount: apiServer.records
        .slice(interactionStart)
        .filter(({ pathname }) => pathname.startsWith("/interact/")).length,
      registrationCount: apiServer.records
        .slice(interactionStart)
        .filter(({ pathname }) => pathname === "/puzzle/registration").length,
    }),
    isValid: ({ controls, interactionCount, registrationCount }) =>
      interactionCount === 0 &&
      registrationCount === 0 &&
      controls.speedActivations === before.speedActivations + 1 &&
      controls.speedAriaPressed === null &&
      controls.nativeLikePressed === before.nativeLikePressed &&
      controls.dislikePressed === before.dislikePressed &&
      controls.count === before.count,
  });
}

async function activateReaction(adapter, apiServer, videoId, selector, value) {
  const interactionStart = apiServer.records.length;
  await activeRenderer(adapter.page, videoId).locator(selector).click();
  const read = () => readArtifactVoteHandshake(apiServer.records, interactionStart, videoId, value);
  await expect.poll(() => isArtifactVoteHandshakeValid(read())).toBe(true);
  await assertInvariantContinuously({
    durationMs: 500,
    label: "One reaction activation completes exactly one vote and confirmation handshake",
    read,
    isValid: isArtifactVoteHandshakeValid,
  });
}

async function withExtension(testInfo, run, { preinstalled = true } = {}) {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions: { countsByVideo: COUNTS },
  });
  try {
    await adapter.start();
    adapter.page.setDefaultTimeout(5_000);
    await adapter.page.route("https://www.youtube.com/shorts/**", async (route) => {
      const videoId = new URL(route.request().url()).pathname.slice("/shorts/".length);
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: createShortsFixture(videoId, preinstalled),
      });
    });
    await adapter.page.goto(`https://www.youtube.com/shorts/${VIDEO_A}`, { waitUntil: "domcontentloaded" });
    await run({ adapter, apiServer });
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
    expect(adapter.backend.requests.filter(({ method }) => method === "POST")).toEqual([]);
    await adapter.assertNoPageSignals("injected-reaction-control");
  } catch (error) {
    if (adapter.page && !adapter.page.isClosed()) {
      await testInfo.attach("injected-reaction-control", {
        body: await adapter.page.screenshot(),
        contentType: "image/png",
      });
    }
    throw error;
  } finally {
    await adapter.close();
    await apiServer.close();
  }
}

test("a prepended injected speed control preserves Shorts rendering and both reaction routes", async ({}, testInfo) => {
  await withExtension(testInfo, async ({ adapter, apiServer }) => {
    await expectReady(adapter, VIDEO_A);
    await expectSpeedDoesNotVote(adapter, apiServer, VIDEO_A);
    await activateReaction(adapter, apiServer, VIDEO_A, `${OWNED_DISLIKE} button`, -1);
    await expectReady(adapter, VIDEO_A, COUNTS[VIDEO_A].dislikes + 1);
    expect(await readControls(adapter)).toMatchObject({ nativeLikePressed: "false", dislikePressed: "true" });

    await activateReaction(adapter, apiServer, VIDEO_A, NATIVE_LIKE, 1);
    await expectReady(adapter, VIDEO_A);
    expect(await readControls(adapter)).toMatchObject({
      nativeLikePressed: "true",
      dislikePressed: "false",
      speedActivations: 1,
    });
  });
});

test("late injection leaves speed inert and clears the actual native Like when Dislike is activated", async ({}, testInfo) => {
  await withExtension(
    testInfo,
    async ({ adapter, apiServer }) => {
      await expectReady(adapter, VIDEO_A);
      await activateReaction(adapter, apiServer, VIDEO_A, NATIVE_LIKE, 1);
      expect(await readControls(adapter)).toMatchObject({ nativeLikePressed: "true", dislikePressed: "false" });

      await adapter.page.evaluate(() => globalThis.__injectedReactionFixture.injectSpeedControl());
      await expectSpeedDoesNotVote(adapter, apiServer, VIDEO_A);
      await activateReaction(adapter, apiServer, VIDEO_A, `${OWNED_DISLIKE} button`, -1);
      await expectReady(adapter, VIDEO_A, COUNTS[VIDEO_A].dislikes + 1);
      expect(await readControls(adapter)).toMatchObject({
        nativeLikePressed: "false",
        dislikePressed: "true",
        speedActivations: 1,
        speedAriaPressed: null,
      });
    },
    { preinstalled: false },
  );
});

test("injected controls survive recycled Shorts identity and a hard reload", async ({}, testInfo) => {
  await withExtension(testInfo, async ({ adapter, apiServer }) => {
    await expectReady(adapter, VIDEO_A);
    await adapter.page.evaluate((videoId) => globalThis.__shortsFixture.recycleActiveRenderer(videoId), VIDEO_B);
    await expectReady(adapter, VIDEO_B);
    await expectSpeedDoesNotVote(adapter, apiServer, VIDEO_B);
    await activateReaction(adapter, apiServer, VIDEO_B, NATIVE_LIKE, 1);
    expect(await readControls(adapter)).toMatchObject({ nativeLikePressed: "true", dislikePressed: "false" });
    expect(adapter.backend.requestsFor("GET", "/votes").map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B]);

    await adapter.page.reload({ waitUntil: "domcontentloaded" });
    await expectReady(adapter, VIDEO_B);
    await expectSpeedDoesNotVote(adapter, apiServer, VIDEO_B);
    await activateReaction(adapter, apiServer, VIDEO_B, `${OWNED_DISLIKE} button`, -1);
    await expectReady(adapter, VIDEO_B, COUNTS[VIDEO_B].dislikes + 1);
    expect(await readControls(adapter)).toMatchObject({ nativeLikePressed: "false", dislikePressed: "true" });
    expect(adapter.backend.requestsFor("GET", "/votes").map(({ query }) => query.videoId)).toEqual([
      VIDEO_A,
      VIDEO_B,
      VIDEO_B,
    ]);
  });
});
