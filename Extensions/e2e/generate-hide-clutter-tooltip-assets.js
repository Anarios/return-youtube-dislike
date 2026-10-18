const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");
const { OPTIONAL_ACTIONS } = require("./action-overflow-contract");
const { createExtensionActionOverflowFixture } = require("./extension/extension-action-overflow-fixture");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, "Extensions", "combined", "images");
const OUTPUTS = Object.freeze({
  after: path.join(OUTPUT_DIRECTORY, "hide-clutter-after.png"),
  before: path.join(OUTPUT_DIRECTORY, "hide-clutter-before.png"),
});

async function assertReactionPreview(page, label) {
  const preview = await page.evaluate(() => {
    const reaction = document.querySelector("[data-fixture-reaction-group]");
    const box = reaction?.getBoundingClientRect();
    return {
      box: box ? { height: box.height, width: box.width } : null,
      count: document.querySelectorAll("[data-fixture-reaction-group]").length,
      texts: [...(reaction?.querySelectorAll("button [role='text']") ?? [])].map((element) =>
        element.textContent.trim(),
      ),
      visible: Boolean(box && box.width > 0 && box.height > 0 && getComputedStyle(reaction).display !== "none"),
    };
  });
  assert.equal(preview.count, 1, `${label} preview must contain exactly one reaction group.`);
  assert.equal(preview.visible, true, `${label} preview reaction group must be visible.`);
  assert.deepEqual(preview.texts, ["501K", "6.6K"], `${label} preview lost its Like or Dislike count.`);
  assert.ok(preview.box.width >= 140 && preview.box.height >= 32, `${label} preview reaction group is too small.`);
}

async function generateHideClutterTooltipAssets() {
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      colorScheme: "dark",
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      viewport: { height: 180, width: 840 },
    });
    await page.setContent(createExtensionActionOverflowFixture(), { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ ids, title }) => {
        globalThis.__actionOverflowFixture.mount();
        globalThis.__actionOverflowFixture.renderPreview(ids, title);
      },
      { ids: OPTIONAL_ACTIONS.map(({ id }) => id), title: "Standard controls" },
    );
    await assertReactionPreview(page, "Before");
    await page.locator(".fixture-preview-card").screenshot({
      animations: "disabled",
      path: OUTPUTS.before,
    });

    await page.evaluate(() => globalThis.__actionOverflowFixture.renderPreview([], "Hide clutter buttons"));
    await assertReactionPreview(page, "After");
    await page.locator(".fixture-preview-card").screenshot({
      animations: "disabled",
      path: OUTPUTS.after,
    });
  } finally {
    await browser.close();
  }
  return { ...OUTPUTS };
}

if (require.main === module) {
  generateHideClutterTooltipAssets()
    .then((outputs) => process.stdout.write(`${JSON.stringify(outputs, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  OUTPUTS,
  generateHideClutterTooltipAssets,
};
