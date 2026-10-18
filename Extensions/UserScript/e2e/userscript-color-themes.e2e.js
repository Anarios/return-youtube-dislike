const { expect, test } = require("@playwright/test");
const {
  VIDEO_A,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openShortsFixture,
  openWatchFixture,
} = require("./harness");
const {
  CUSTOM_COLORS,
  HIBISCUS,
  captureColorEvidence,
  expectPalette,
  rgb,
  setFixtureTheme,
} = require("../../e2e/extension/color-theme-fixture");

const WATCH_SELECTORS = {
  like: '[data-fixture-shell]:not([hidden]) [data-ryd-role="like"] button',
  dislike: '[data-fixture-shell]:not([hidden]) [data-ryd-role="dislike"] button',
};
const BAR_IDS = { like: "#return-youtube-dislike-bar", dislike: "#return-youtube-dislike-bar-container" };

async function withColorFixture({ context, page }, options, run) {
  const backend = createFakeBackend();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await installGmEnvironment(context);
  await installHermeticRoutes(context, backend);
  await (options.shorts ? openShortsFixture : openWatchFixture)(page, VIDEO_A);
  await setFixtureTheme(page, "light");
  await injectGeneratedUserscript(page, { coloredBar: true, coloredThumbs: true, ...options });
  await run();
  expect(backend.blockedRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
}

for (const [themeName, palette] of [
  ["hibiscus", HIBISCUS],
  ["custom", CUSTOM_COLORS],
]) {
  test(`${themeName} userscript Watch colors repaint for empty dark attribute and back to light`, async ({
    context,
    page,
  }, testInfo) => {
    await withColorFixture({ context, page }, { colorTheme: themeName, customColors: CUSTOM_COLORS }, async () => {
      await expect(page.locator(WATCH_SELECTORS.dislike).locator("#text")).toHaveText("25");
      for (const theme of ["light", "dark", "light"]) {
        await setFixtureTheme(page, theme);
        await expectPalette(page, palette[theme], {
          selectors: WATCH_SELECTORS,
          barIds: BAR_IDS,
          checkIconContrast: themeName === "hibiscus",
        });
        await captureColorEvidence(page, testInfo, `${themeName}-watch-${theme}`, page.locator("#top-row"));
      }
      await setFixtureTheme(page, "dark");
      await page.evaluate(() => window.__youtubeFixture.insertButtons());
      await expect(page.locator(WATCH_SELECTORS.dislike).locator("#text")).toHaveText("25");
      await expectPalette(page, palette.dark, {
        selectors: WATCH_SELECTORS,
        barIds: BAR_IDS,
        checkIconContrast: themeName === "hibiscus",
      });
      await expect(page.locator(BAR_IDS.like)).toHaveCount(1);
      await page.evaluate(() => {
        for (const role of ["like", "dislike"]) {
          const host = document.querySelector(`[data-fixture-shell]:not([hidden]) [data-ryd-role="${role}"]`);
          const nativeButton = host.querySelector("button");
          const replacement = nativeButton.cloneNode(true);
          replacement.removeAttribute("style");
          replacement.removeAttribute("data-ryd-thumb-color");
          replacement.setAttribute("data-fixture-native-replacement", role);
          nativeButton.replaceWith(replacement);
        }
      });
      await expect(page.locator("[data-fixture-native-replacement]")).toHaveCount(2);
      await expectPalette(page, palette.dark, {
        selectors: WATCH_SELECTORS,
        barIds: BAR_IDS,
        checkIconContrast: themeName === "hibiscus",
      });
    });
  });
}

test("Hibiscus userscript keeps selected Shorts controls colored after a theme change", async ({
  context,
  page,
}, testInfo) => {
  await withColorFixture({ context, page }, { colorTheme: "hibiscus", shorts: true }, async () => {
    const like = page.locator('[data-short-video]:not([hidden]) [data-ryd-role="like"] button');
    const dislike = page.locator("[data-short-video]:not([hidden]) [data-ryd-synthetic-shorts-dislike] button");
    await expect(dislike).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await setFixtureTheme(page, theme);
      for (const [role, button] of [
        ["like", like],
        ["dislike", dislike],
      ]) {
        await like.evaluate((element) => element.setAttribute("aria-pressed", "false"));
        await dislike.evaluate((element) => element.setAttribute("aria-pressed", "false"));
        await button.evaluate((element) => element.setAttribute("aria-pressed", "true"));
        await expect(button).toHaveCSS("color", rgb(HIBISCUS[theme][role]));
      }
      await captureColorEvidence(
        page,
        testInfo,
        `hibiscus-shorts-${theme}`,
        page.locator("reel-action-bar-view-model:visible"),
      );
    }
  });
});
