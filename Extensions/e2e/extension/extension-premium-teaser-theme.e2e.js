const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const PANEL = ".ryd-premium-teaser";
const PALETTES = {
  light: { background: "rgb(255, 255, 255)", primary: "rgb(15, 15, 15)", secondary: "rgb(96, 96, 96)" },
  dark: { background: "rgb(32, 32, 32)", primary: "rgb(255, 255, 255)", secondary: "rgb(156, 163, 175)" },
};
const LEGACY_PALETTES = {
  light: { background: "rgb(255, 248, 240)", primary: "rgb(48, 32, 16)", secondary: "rgb(112, 80, 48)" },
  dark: { background: "rgb(21, 25, 35)", primary: "rgb(228, 234, 255)", secondary: "rgb(171, 184, 210)" },
};

async function installTeaserContainer(context) {
  await context.addInitScript(() => {
    if (location.hostname !== "www.youtube.com") return;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const secondary = document.createElement("aside");
        secondary.id = "secondary";
        secondary.style.cssText = "width: 400px; margin: 24px;";
        const inner = document.createElement("div");
        inner.id = "secondary-inner";
        secondary.append(inner);
        document.body.append(secondary);
      },
      { once: true },
    );
  });
}

async function setPageTheme(page, theme, legacyTokens) {
  await page.evaluate(
    ({ dark, palette }) => {
      const root = document.documentElement;
      root.toggleAttribute("dark", dark);
      root.style.setProperty("--yt-spec-base-background", palette?.background || "initial");
      root.style.setProperty("--yt-spec-text-primary", palette?.primary || "initial");
      root.style.setProperty("--yt-spec-text-secondary", palette?.secondary || "initial");
      root.style.backgroundColor = dark ? "#0f0f0f" : "#fff";
      document.body.style.backgroundColor = dark ? "#0f0f0f" : "#fff";
    },
    { dark: theme === "dark", palette: legacyTokens ? LEGACY_PALETTES[theme] : null },
  );
}

async function expectTeaserPalette(page, theme, legacyTokens) {
  const palette = (legacyTokens ? LEGACY_PALETTES : PALETTES)[theme];
  await expect(page.locator(PANEL)).toHaveCSS("background-color", palette.background);
  await expect(page.locator(PANEL)).toHaveCSS("color", palette.primary);
  await expect(page.locator("#ryd-premium-teaser-likes")).toHaveCSS("color", palette.primary);
  await expect(page.locator("#ryd-premium-teaser-dislikes")).toHaveCSS("color", palette.primary);
  await expect(page.locator(".ryd-premium-teaser__count-label").first()).toHaveCSS("color", palette.secondary);

  const secondaryRoles = {
    ".ryd-premium-teaser__subtitle": "rgb(188, 204, 220)",
    ".ryd-premium-teaser__highlights-title": "rgb(156, 163, 175)",
    ".ryd-premium-teaser__highlights-list": "rgb(147, 173, 200)",
    ".ryd-premium-teaser__secondary": "rgb(142, 164, 200)",
    ".ryd-premium-teaser__status": "rgb(156, 163, 175)",
    ".ryd-premium-teaser__close": "rgb(148, 163, 184)",
    ".ryd-premium-teaser__toggle": "rgb(148, 163, 184)",
  };
  await page.mouse.move(0, 0);
  await page.locator(PANEL).evaluate(() => document.activeElement?.blur());
  for (const [selector, darkFallback] of Object.entries(secondaryRoles)) {
    const color = legacyTokens || theme === "light" ? palette.secondary : darkFallback;
    await expect(page.locator(selector)).toHaveCSS("color", color);
  }

  for (const selector of ["#ryd-premium-teaser-close", "#ryd-premium-teaser-toggle"]) {
    const control = page.locator(selector);
    await control.hover();
    const hoverColor = legacyTokens || theme === "light" ? palette.primary : "rgb(248, 250, 252)";
    await expect(control).toHaveCSS("color", hoverColor);
    await page.mouse.move(0, 0);
    await control.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS("color", hoverColor);
    await control.blur();
  }
}

for (const legacyTokens of [false, true]) {
  for (const colorScheme of ["light", "dark"]) {
    test(`raw-count panel follows YouTube theme with ${colorScheme} system theme and legacy tokens ${legacyTokens}`, async ({}, testInfo) => {
      const apiServer = await startHermeticApiServer();
      const adapter = new HermeticExtensionArtifactAdapter({
        apiServer,
        artifactDirectory: EXTENSION_ARTIFACT,
        contextOptions: { colorScheme },
      });
      try {
        await adapter.start();
        await adapter.setPremiumTeaserHidden(false);
        await installTeaserContainer(adapter.context);
        await adapter.openWatch(VIDEO_A);
        await expect(adapter.page.locator("#ryd-premium-teaser-likes")).toHaveText("100");
        await expect(adapter.page.locator("#ryd-premium-teaser-dislikes")).toHaveText("25");
        const panel = await adapter.page.locator(PANEL).elementHandle();
        const themes = colorScheme === "dark" ? ["light", "dark", "light"] : ["dark", "light", "dark"];
        const details = adapter.page.locator("#ryd-premium-teaser-details");
        const toggle = adapter.page.locator("#ryd-premium-teaser-toggle");

        for (const expanded of [false, true]) {
          if (expanded) await toggle.click();
          for (const theme of themes) {
            await setPageTheme(adapter.page, theme, legacyTokens);
            await expectTeaserPalette(adapter.page, theme, legacyTokens);
            await expect(toggle).toHaveAttribute("aria-expanded", String(expanded));
            if (expanded) {
              await expect(details).toBeVisible();
              await expect(adapter.page.locator(".ryd-premium-teaser__title")).toHaveCSS(
                "color",
                (legacyTokens ? LEGACY_PALETTES : PALETTES)[theme].primary,
              );
              await adapter.page.locator(PANEL).screenshot({ path: testInfo.outputPath(`${theme}-expanded.png`) });
            } else {
              await expect(details).toBeHidden();
            }
            expect(await panel.evaluate((element) => element === document.querySelector(".ryd-premium-teaser"))).toBe(
              true,
            );
          }
        }
        await toggle.click();
        await expect(details).toBeHidden();

        expect(adapter.backend.requestsFor("GET", "/votes")).toHaveLength(1);
        await adapter.assertNoPageSignals(testInfo.title);
        expect(adapter.backend.blockedRequests).toEqual([]);
        expect(apiServer.unexpectedRequests).toEqual([]);
      } finally {
        await adapter.close().catch(() => {});
        await apiServer.close().catch(() => {});
      }
    });
  }
}
