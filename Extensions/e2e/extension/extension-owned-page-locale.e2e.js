const path = require("node:path");
const { chromium, test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);

async function assertSettingsLayout(page, direction, testInfo) {
  await page.locator("#advancedToggle").click();
  await expect(page.locator("#advancedSettings")).toHaveCSS("opacity", "1");
  const layout = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    const panel = document.getElementById("advancedSettings");
    const panelLeft = panel.getBoundingClientRect().left + panel.clientLeft;
    return {
      clipLeft: panelLeft,
      clipRight: panelLeft + panel.clientWidth,
      toggle: rect(document.getElementById("advancedToggle")),
      switches: [...panel.querySelectorAll(".switchLabel")].map((label) => ({
        label: rect(label),
        slider: rect(label.closest(".switch").querySelector(".slider")),
      })),
    };
  });
  expect(layout.switches.length).toBeGreaterThan(0);
  for (const { label, slider } of layout.switches) {
    if (direction === "rtl") expect(label.right).toBeLessThanOrEqual(slider.left + 0.5);
    else expect(label.left).toBeGreaterThanOrEqual(slider.right - 0.5);
    expect(label.left).toBeGreaterThanOrEqual(layout.clipLeft - 0.5);
    expect(label.right).toBeLessThanOrEqual(layout.clipRight + 0.5);
    const toggleOverlapsSlider =
      layout.toggle.left < slider.right &&
      layout.toggle.right > slider.left &&
      layout.toggle.top < slider.bottom &&
      layout.toggle.bottom > slider.top;
    expect(toggleOverlapsSlider).toBe(false);
  }
  await page.screenshot({ path: testInfo.outputPath("settings-375.png"), fullPage: true });

  const hoverTips = page.locator(".switch[data-hover], .label-with-hover-tip[data-hover]");
  expect(await hoverTips.count()).toBeGreaterThan(0);
  for (const host of await hoverTips.all()) {
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        hoverTips.evaluateAll((elements) =>
          elements.every((element) => getComputedStyle(element, "::before").visibility === "hidden"),
        ),
      )
      .toBe(true);
    await host.hover();
    await expect
      .poll(() => host.evaluate((element) => getComputedStyle(element, "::before").visibility))
      .toBe("visible");
    const bounds = await host.evaluate((element) => {
      const host = element.getBoundingClientRect();
      const tip = getComputedStyle(element, "::before");
      const width =
        parseFloat(tip.width) +
        (tip.boxSizing === "border-box"
          ? 0
          : parseFloat(tip.paddingLeft) +
            parseFloat(tip.paddingRight) +
            parseFloat(tip.borderLeftWidth) +
            parseFloat(tip.borderRightWidth));
      const left = tip.left === "auto" ? host.right - parseFloat(tip.right) - width : host.left + parseFloat(tip.left);
      return { left, right: left + width };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(layout.clipLeft - 0.5);
    expect(bounds.right).toBeLessThanOrEqual(layout.clipRight + 0.5);
  }

  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      hoverTips.evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element, "::before").visibility === "hidden"),
      ),
    )
    .toBe(true);
  await page.locator("#hide_clutter_buttons_help").hover();
  const help = page.locator("#hide_clutter_buttons_tooltip");
  await expect(help).toBeVisible();
  const helpBounds = await help.boundingBox();
  expect(helpBounds.x).toBeGreaterThanOrEqual(layout.clipLeft - 0.5);
  expect(helpBounds.x + helpBounds.width).toBeLessThanOrEqual(layout.clipRight + 0.5);
  await page.screenshot({ path: testInfo.outputPath("settings-help-375.png"), fullPage: true });
}

for (const { locale, language, direction } of [
  { locale: "fa-IR", language: "fa", direction: "rtl" },
  { locale: "en-US", language: "en", direction: "ltr" },
]) {
  test(`built popup and release page follow ${direction} locale metadata for ${locale}`, async ({}, testInfo) => {
    const apiServer = await startHermeticApiServer();
    const browserType = {
      launchPersistentContext: (profile, options) =>
        chromium.launchPersistentContext(profile, {
          ...options,
          args: [...options.args, `--lang=${language}`],
          ...(process.platform === "linux" ? { env: { ...process.env, ...options.env, LANGUAGE: language } } : {}),
        }),
    };
    const adapter = new HermeticExtensionArtifactAdapter({
      apiServer,
      artifactDirectory: EXTENSION_ARTIFACT,
      browserType,
      contextOptions: { locale },
    });
    try {
      await adapter.start();
      await adapter.context.route("https://fonts.googleapis.com/**", (route) =>
        route.fulfill({ body: "", contentType: "text/css", status: 200 }),
      );
      await adapter.context.route("https://fonts.gstatic.com/**", (route) =>
        route.fulfill({ body: "", contentType: "font/woff2", status: 200 }),
      );
      await adapter.context.route("https://raw.githubusercontent.com/**", (route) =>
        route.fulfill({ body: JSON.stringify({ version: "4.0.5" }), contentType: "application/json", status: 200 }),
      );
      expect(await adapter.worker.evaluate(() => chrome.i18n.getMessage("@@bidi_dir"))).toBe(direction);
      await adapter.openWatch(VIDEO_A);
      await adapter.waitForWatchResult(VIDEO_A);
      const hostDirection = await adapter.page.evaluate(() => ({
        attribute: document.documentElement.dir,
        computed: getComputedStyle(document.documentElement).direction,
      }));
      const page = await adapter.context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") pageErrors.push(message.text());
      });
      for (const [name, url, widths] of [
        ["popup", "popup.html", [375]],
        ["release", "changelog/4/changelog_4.1.html", [375, 1280]],
      ]) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(`chrome-extension://${adapter.extensionId}/${url}`, { waitUntil: "load" });
          await expect(page.locator("html")).toHaveAttribute("dir", direction);
          await expect(page.locator("html")).toHaveCSS("direction", direction);
          expect(await page.evaluate(() => document.documentElement.innerHTML.includes("__MSG_"))).toBe(false);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
          if (name === "popup") await assertSettingsLayout(page, direction, testInfo);
        }
      }
      expect(
        await adapter.page.evaluate(() => ({
          attribute: document.documentElement.dir,
          computed: getComputedStyle(document.documentElement).direction,
        })),
      ).toEqual(hostDirection);
      await adapter.assertNoPageSignals(testInfo.title);
      expect(pageErrors).toEqual([]);
      expect(adapter.backend.blockedRequests).toEqual([]);
      expect(apiServer.unexpectedRequests).toEqual([]);
    } finally {
      await adapter.close().catch(() => {});
      await apiServer.close().catch(() => {});
    }
  });
}
