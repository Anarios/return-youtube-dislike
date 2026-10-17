const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const { annotateVisualEvidence, captureOptionalVisualEvidence } = require("../visual-evidence");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(REPOSITORY_ROOT, "Extensions", "combined", "dist", "chrome"),
);
const POPUP_VISUAL_REVIEW_PATH = path.join(
  REPOSITORY_ROOT,
  "test-results",
  "visual-review",
  "extension",
  "hide-clutter-popup.png",
);

async function readStoredPreference(worker) {
  return worker.evaluate(async () => (await chrome.storage.sync.get(["hideClutterButtons"])).hideClutterButtons);
}

async function openPopup(adapter) {
  const page = adapter.page;
  await page.setViewportSize({ height: 720, width: 360 });
  await page.goto(`chrome-extension://${adapter.extensionId}/popup.html`, { waitUntil: "load" });
  await page.locator("#advancedToggle").click();
  await expect(page.locator("#advancedSettings")).toHaveCSS("opacity", "1");
  return page;
}

test("built popup defaults hide-clutter off, persists it, and presents an accessible visual explanation", async ({}, testInfo) => {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({ apiServer, artifactDirectory: EXTENSION_ARTIFACT });
  let caughtError = null;

  try {
    await adapter.start();
    await adapter.worker.evaluate(() => chrome.storage.sync.remove(["hideClutterButtons"]));
    await adapter.context.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ body: "", contentType: "text/css; charset=utf-8", status: 200 }),
    );
    await adapter.context.route("https://fonts.gstatic.com/**", (route) =>
      route.fulfill({ body: "", contentType: "font/woff2", status: 200 }),
    );
    await adapter.context.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({
        body: JSON.stringify({ version: "4.0.5" }),
        contentType: "application/json; charset=utf-8",
        status: 200,
      }),
    );

    const page = await openPopup(adapter);
    const checkbox = page.locator("#hide_clutter_buttons");
    const settingLabel = page.locator('label[for="hide_clutter_buttons"].setting-row-label');
    const help = page.locator("#hide_clutter_buttons_help");
    const tooltip = page.locator("#hide_clutter_buttons_tooltip");
    const before = tooltip.locator('[data-hide-clutter-example="before"]');
    const after = tooltip.locator('[data-hide-clutter-example="after"]');

    await expect(checkbox).not.toBeChecked();
    await expect.poll(() => readStoredPreference(adapter.worker)).toBe(false);
    await expect(help).toHaveAttribute("aria-describedby", "hide_clutter_buttons_tooltip");
    expect(await help.evaluate((element) => element.tabIndex)).toBe(0);

    await help.hover();
    await expect(tooltip).toBeVisible();
    await expect(before).toBeVisible();
    await expect(after).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll("[data-hide-clutter-example]")].map((image) => ({
            complete: image.complete,
            naturalHeight: image.naturalHeight,
            naturalWidth: image.naturalWidth,
          })),
        ),
      )
      .toEqual([
        { complete: true, naturalHeight: 128, naturalWidth: 294 },
        { complete: true, naturalHeight: 108, naturalWidth: 294 },
      ]);

    const renderedExamples = await page.evaluate(() =>
      [...document.querySelectorAll("[data-hide-clutter-example]")].map((image) => {
        const box = image.getBoundingClientRect();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(10, 38, 155, 46).data;
        let reactionInkPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) >= 30 && pixels[index + 3] > 0) {
            reactionInkPixels += 1;
          }
        }
        return {
          naturalWidth: image.naturalWidth,
          reactionInkPixels,
          renderedWidth: box.width,
          scale: box.width / image.naturalWidth,
        };
      }),
    );
    for (const example of renderedExamples) {
      expect(example.renderedWidth).toBeGreaterThanOrEqual(220);
      expect(example.scale).toBeGreaterThanOrEqual(0.75);
      expect(example.reactionInkPixels).toBeGreaterThan(2_500);
    }

    const visualEvidence = await captureOptionalVisualEvidence({
      capture: async (screenshotPath) => {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ animations: "disabled", path: screenshotPath });
      },
      outputPath: POPUP_VISUAL_REVIEW_PATH,
    });
    annotateVisualEvidence(testInfo, visualEvidence);

    const popoverBox = await tooltip.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(popoverBox.x).toBeGreaterThanOrEqual(0);
    expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(360);

    await page.mouse.move(1, 1);
    await help.focus();
    await expect(help).toBeFocused();
    await expect(tooltip).toBeVisible();

    await settingLabel.click();
    await expect(checkbox).toBeChecked();
    await expect.poll(() => readStoredPreference(adapter.worker)).toBe(true);

    await page.reload({ waitUntil: "load" });
    await page.locator("#advancedToggle").click();
    await expect(page.locator("#hide_clutter_buttons")).toBeChecked();
    await page.locator('label[for="hide_clutter_buttons"].setting-row-label').click();
    await expect(page.locator("#hide_clutter_buttons")).not.toBeChecked();
    await expect.poll(() => readStoredPreference(adapter.worker)).toBe(false);
    await adapter.pageSignals.assertClean(testInfo.title);
  } catch (error) {
    caughtError = error;
    throw error;
  } finally {
    if (caughtError && adapter.context) {
      const screenshotPath = testInfo.outputPath("hide-clutter-popup-failure.png");
      await adapter.page.screenshot({ fullPage: true, path: screenshotPath }).catch(() => {});
      await testInfo.attach("hide-clutter-popup", { contentType: "image/png", path: screenshotPath }).catch(() => {});
    }
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
});
