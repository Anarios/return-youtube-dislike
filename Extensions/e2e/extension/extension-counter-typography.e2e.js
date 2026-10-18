const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const LIKE_TEXT = '[data-fixture-role="like"] .ytSpecButtonShapeNextButtonTextContent';
const DISLIKE_TEXT = '[data-fixture-role="dislike"] #text';

async function installCounterTypography(context, nestedSemanticSpan) {
  await context.addInitScript((nested) => {
    if (location.hostname !== "www.youtube.com") return;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const style = document.createElement("style");
        style.textContent = `
          body { color: #17212b; background: #fff; }
          body.fixture-dark { color: #f4f5f6; background: #15191d; }
          [data-fixture-role] button { color: inherit; background: #e6e9ed; font: 500 14px/40px Arial, sans-serif; }
          body.fixture-dark [data-fixture-role] button { background: #272727; }
          [data-fixture-role="like"] .fixture-digit { font: 600 21px/24px Georgia, serif; }
          [data-fixture-role="like"].fixture-compact .fixture-digit { font: 500 17px/22px Arial, sans-serif; }
          .fixture-accessible-count { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); font-size: 32px; }
        `;
        document.head.append(style);
        const template = document.querySelector('[data-fixture-role="like"] .ytSpecButtonShapeNextButtonTextContent');
        const digits = `<span hidden>999</span><span class="fixture-accessible-count">300 likes</span><span class="fixture-digit">300</span>`;
        template.innerHTML = nested ? `<span role="text">${digits}</span>` : digits;
        // Exercise the reaction observer without the separate smartimation observer.
        const smartimation = document.querySelector("yt-smartimation");
        smartimation.replaceWith(...smartimation.childNodes);
      },
      { once: true },
    );
  }, nestedSemanticSpan);
}

async function readTypography(page) {
  return page.evaluate(
    ({ likeSelector, dislikeSelector }) => {
      const like = document.querySelector(`${likeSelector} .fixture-digit`) || document.querySelector(likeSelector);
      const dislike = document.querySelector(dislikeSelector);
      const read = (element) => {
        const style = getComputedStyle(element);
        return {
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          color: style.color,
        };
      };
      return { like: read(like), dislike: read(dislike) };
    },
    { likeSelector: LIKE_TEXT, dislikeSelector: DISLIKE_TEXT },
  );
}

for (const nestedSemanticSpan of [false, true]) {
  test(`generated extension matches nested counter typography with semantic span ${nestedSemanticSpan}`, async ({}, testInfo) => {
    const apiServer = await startHermeticApiServer();
    const adapter = new HermeticExtensionArtifactAdapter({
      apiServer,
      artifactDirectory: EXTENSION_ARTIFACT,
      backendOptions: {
        countsByVideo: { [VIDEO_A]: { likes: 300, dislikes: 100 }, [VIDEO_B]: { likes: 400, dislikes: 80 } },
        fixture: { nativeDislikeText: false, roleAttribute: "data-fixture-role" },
      },
    });
    try {
      await adapter.start();
      await installCounterTypography(adapter.context, nestedSemanticSpan);
      await adapter.openWatch(VIDEO_A);
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveText("100");
      await expect
        .poll(async () => (await readTypography(adapter.page)).dislike)
        .toEqual((await readTypography(adapter.page)).like);
      expect((await readTypography(adapter.page)).like.fontSize).toBe("21px");
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveCount(1);

      for (const dark of [false, true]) {
        await adapter.page.evaluate((enabled) => document.body.classList.toggle("fixture-dark", enabled), dark);
        const typography = await readTypography(adapter.page);
        expect(typography.dislike).toEqual(typography.like);
        await adapter.page
          .locator("#top-row")
          .screenshot({ path: testInfo.outputPath(dark ? "dark.png" : "light.png") });
      }

      await adapter.page.locator("#top-row #top-level-buttons-computed").evaluate((element) => {
        element.replaceWith(element.cloneNode(true));
      });
      await adapter.page
        .locator('[data-fixture-role="like"]')
        .evaluate((element) => element.classList.add("fixture-compact"));
      await expect.poll(async () => (await readTypography(adapter.page)).dislike.fontSize).toBe("17px");

      await adapter.page.locator(LIKE_TEXT).evaluate((element) => {
        element.innerHTML = '<span class="fixture-digit">301</span>';
      });
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveText("100");
      await expect
        .poll(async () => (await readTypography(adapter.page)).dislike)
        .toEqual((await readTypography(adapter.page)).like);

      await adapter.page.locator(LIKE_TEXT).evaluate((element) => {
        element.textContent = "301";
      });
      await expect.poll(async () => (await readTypography(adapter.page)).dislike.fontSize).toBe("14px");
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveCount(1);

      // A hard navigation creates a fresh control with a different authoritative count.
      await adapter.openWatch(VIDEO_B);
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveText("80");
      await expect
        .poll(async () => (await readTypography(adapter.page)).dislike)
        .toEqual((await readTypography(adapter.page)).like);
      await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveCount(1);
      await adapter.assertNoPageSignals("counter-typography");
      expect(adapter.backend.blockedRequests).toEqual([]);
      expect(apiServer.unexpectedRequests).toEqual([]);
    } finally {
      await adapter.close();
      await apiServer.close();
    }
  });
}
