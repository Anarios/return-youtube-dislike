const path = require("node:path");
const { devices, expect, test } = require("@playwright/test");
const { VIDEO_A, openShortsFixture, openWatchFixture } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const {
  CUSTOM_COLORS,
  HIBISCUS,
  captureColorEvidence,
  expectPalette,
  rgb,
  setFixtureTheme,
} = require("./color-theme-fixture");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const WATCH_SELECTORS = {
  like: '[data-fixture-shell]:not([hidden]) [data-fixture-role="like"] button',
  dislike: '[data-fixture-shell]:not([hidden]) [data-fixture-role="dislike"] button',
};
const BAR_IDS = { like: "#ryd-bar", dislike: "#ryd-bar-container" };

async function withColorFixture(testInfo, run, contextOptions = {}) {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    contextOptions,
  });
  try {
    await adapter.start();
    const auxiliaryErrors = [];
    adapter.context.on("page", (page) => {
      page.on("pageerror", (error) => auxiliaryErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") auxiliaryErrors.push(message.text());
      });
    });
    await expect
      .poll(() =>
        adapter.worker.evaluate(async () => {
          return (await chrome.storage.sync.get(["colorTheme"])).colorTheme;
        }),
      )
      .not.toBeUndefined();
    await adapter.worker.evaluate(() =>
      chrome.storage.sync.set({
        coloredThumbs: true,
        coloredBar: true,
        colorTheme: "hibiscus",
      }),
    );
    await run(adapter);
    await adapter.assertNoPageSignals(testInfo.title);
    expect(auxiliaryErrors).toEqual([]);
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
  } catch (error) {
    if (adapter.page && !adapter.page.isClosed()) {
      await captureColorEvidence(adapter.page, testInfo, "color-theme-failure").catch(() => {});
    }
    throw error;
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

async function openPopup(adapter) {
  await adapter.context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: "", contentType: "text/css", status: 200 }),
  );
  await adapter.context.route("https://fonts.gstatic.com/**", (route) =>
    route.fulfill({ body: "", contentType: "font/woff2", status: 200 }),
  );
  await adapter.context.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({
      body: JSON.stringify({ version: "4.0.5" }),
      contentType: "application/json",
      status: 200,
    }),
  );
  const popup = await adapter.context.newPage();
  await popup.setViewportSize({ height: 900, width: 360 });
  await popup.goto(`chrome-extension://${adapter.extensionId}/popup.html`, { waitUntil: "load" });
  await popup.locator("#advancedToggle").click();
  await expect(popup.locator("#advancedSettings")).toHaveCSS("opacity", "1");
  return popup;
}

test("Hibiscus repaints desktop Watch thumbs and ratio bar when an empty dark attribute changes", async ({}, testInfo) => {
  await withColorFixture(testInfo, async (adapter) => {
    await adapter.openWatch(VIDEO_A);
    await adapter.waitForWatchResult(VIDEO_A);
    for (const theme of ["light", "dark", "light"]) {
      await setFixtureTheme(adapter.page, theme);
      await expectPalette(adapter.page, HIBISCUS[theme], {
        selectors: WATCH_SELECTORS,
        barIds: BAR_IDS,
        checkIconContrast: true,
      });
      await captureColorEvidence(
        adapter.page,
        testInfo,
        `hibiscus-desktop-${theme}`,
        adapter.page.locator("#top-row"),
        20,
      );
    }
    await setFixtureTheme(adapter.page, "dark");
    await adapter.page.evaluate(() => window.__youtubeFixture.insertButtons());
    await expect(adapter.page.locator(WATCH_SELECTORS.dislike).locator("#text")).toHaveText("25");
    await expectPalette(adapter.page, HIBISCUS.dark, {
      selectors: WATCH_SELECTORS,
      barIds: BAR_IDS,
      checkIconContrast: true,
    });
    await expect(adapter.page.locator(BAR_IDS.like)).toHaveCount(1);
    expect(adapter.backend.requestsFor("GET", "/votes")).toHaveLength(1);
  });
});

test("popup native pickers preserve custom palettes across reopen and repaint two open Watch tabs", async ({}, testInfo) => {
  await withColorFixture(testInfo, async (adapter) => {
    await adapter.openWatch(VIDEO_A);
    await adapter.waitForWatchResult(VIDEO_A);
    await setFixtureTheme(adapter.page, "light");
    const darkPage = await adapter.context.newPage();
    await openWatchFixture(darkPage, VIDEO_A);
    await expect(darkPage.locator("#ryd-bar")).toBeVisible();
    await setFixtureTheme(darkPage, "dark");
    let popup = await openPopup(adapter);
    const themeSelect = popup.locator("#color_theme");
    expect(await themeSelect.locator("option").evaluateAll((options) => options.map((option) => option.value))).toEqual(
      ["classic", "accessible", "neon", "hibiscus", "custom"],
    );
    for (const theme of ["light", "dark"]) {
      await expect(popup.locator(`#custom_colors_${theme}`)).toBeHidden();
      for (const role of ["like", "dislike"]) {
        await expect(popup.locator(`#color_theme_example_${theme}_${role}`)).toHaveCSS(
          "background-color",
          rgb(HIBISCUS[theme][role]),
        );
      }
    }
    await themeSelect.selectOption("custom");
    for (const theme of ["light", "dark"]) {
      const panel = popup.locator(`#custom_colors_${theme}`);
      await expect(panel).toBeVisible();
      for (const role of ["like", "dislike"]) {
        const id = `custom_color_${theme}_${role}`;
        const picker = popup.locator(`#${id}`);
        await expect(picker).toHaveValue(HIBISCUS[theme][role]);
        await expect(picker).toHaveAttribute("type", "color");
        await expect(picker).toBeEnabled();
        await expect(picker).toHaveAccessibleName(new RegExp(role, "i"));
        expect(await picker.evaluate((input) => input.labels.length)).toBeGreaterThan(0);
        expect(await picker.evaluate((input) => input.tabIndex)).toBe(0);
        await picker.focus();
        await expect(picker).toBeFocused();
        await picker.fill(CUSTOM_COLORS[theme][role]);
        await picker.dispatchEvent("change");
        await expect(popup.locator(`#color_theme_example_${theme}_${role}`)).toHaveCSS(
          "background-color",
          rgb(CUSTOM_COLORS[theme][role]),
        );
      }
    }
    await popup.locator("#custom_color_light_like").focus();
    for (const id of ["custom_color_light_dislike", "custom_color_dark_like", "custom_color_dark_dislike"]) {
      await popup.keyboard.press("Tab");
      await expect(popup.locator(`#${id}`)).toBeFocused();
    }
    await expect
      .poll(() => adapter.worker.evaluate(async () => (await chrome.storage.sync.get(["customColors"])).customColors))
      .toEqual(CUSTOM_COLORS);
    await expectPalette(adapter.page, CUSTOM_COLORS.light, { selectors: WATCH_SELECTORS, barIds: BAR_IDS });
    await expectPalette(darkPage, CUSTOM_COLORS.dark, { selectors: WATCH_SELECTORS, barIds: BAR_IDS });
    await captureColorEvidence(popup, testInfo, "custom-popup", popup.locator("#advancedSettings"));

    for (const [theme, palette] of [
      ["classic", { like: "#00ff00", dislike: "#ff0000" }],
      ["accessible", { like: "#1e90ff", dislike: "#ffd700" }],
      ["neon", { like: "#00ffff", dislike: "#ff00ff" }],
      ["hibiscus", HIBISCUS.light],
    ]) {
      await themeSelect.selectOption(theme);
      await expectPalette(adapter.page, palette, { selectors: WATCH_SELECTORS, barIds: BAR_IDS });
    }
    await expect
      .poll(() => adapter.worker.evaluate(async () => (await chrome.storage.sync.get(["customColors"])).customColors))
      .toEqual(CUSTOM_COLORS);
    await themeSelect.selectOption("custom");
    await popup.close();
    popup = await openPopup(adapter);
    await expect(popup.locator("#color_theme")).toHaveValue("custom");
    for (const theme of ["light", "dark"]) {
      for (const role of ["like", "dislike"]) {
        await expect(popup.locator(`#custom_color_${theme}_${role}`)).toHaveValue(CUSTOM_COLORS[theme][role]);
      }
    }
    await expectPalette(adapter.page, CUSTOM_COLORS.light, { selectors: WATCH_SELECTORS, barIds: BAR_IDS });
    await expectPalette(darkPage, CUSTOM_COLORS.dark, { selectors: WATCH_SELECTORS, barIds: BAR_IDS });
    await popup.close();
    await darkPage.close();
  });
});

test("Hibiscus repaints native mobile Watch icons in light and dark themes", async ({}, testInfo) => {
  const viewport = { width: 390, height: 844 };
  await withColorFixture(
    testInfo,
    async (adapter) => {
      await openWatchFixture(adapter.page, VIDEO_A, { hostname: "m.youtube.com" });
      await expect(adapter.page.locator(WATCH_SELECTORS.dislike).locator("#text")).toHaveText("25");
      for (const theme of ["light", "dark"]) {
        await setFixtureTheme(adapter.page, theme);
        await expectPalette(adapter.page, HIBISCUS[theme], { selectors: WATCH_SELECTORS, checkIconContrast: true });
        await captureColorEvidence(
          adapter.page,
          testInfo,
          `hibiscus-mobile-${theme}`,
          adapter.page.locator(".slim-video-action-bar-actions"),
        );
      }
      await expect(adapter.page.locator("#ryd-bar-container")).toHaveCount(0);
    },
    {
      viewport,
      screen: viewport,
      isMobile: true,
      hasTouch: true,
      userAgent: devices["Pixel 5"].userAgent,
    },
  );
});

test("Hibiscus repaints selected synthetic desktop Shorts controls when the theme changes", async ({}, testInfo) => {
  await withColorFixture(testInfo, async (adapter) => {
    await openShortsFixture(adapter.page, VIDEO_A);
    const like = adapter.page.locator('[data-short-video]:not([hidden]) [data-ryd-role="like"] button');
    const dislike = adapter.page.locator("[data-short-video]:not([hidden]) [data-ryd-synthetic-shorts-dislike] button");
    await expect(dislike).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await setFixtureTheme(adapter.page, theme);
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
        adapter.page,
        testInfo,
        `hibiscus-shorts-${theme}`,
        adapter.page.locator("reel-action-bar-view-model:visible"),
      );
    }
  });
});
