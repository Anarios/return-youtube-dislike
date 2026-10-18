const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);

test("built popup decodes the inbox back arrow as UTF-8 and returns to settings", async ({}, testInfo) => {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({ apiServer, artifactDirectory: EXTENSION_ARTIFACT });
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
    const page = adapter.page;
    await page.setViewportSize({ width: 360, height: 541 });
    await page.goto(`chrome-extension://${adapter.extensionId}/popup.html`, { waitUntil: "load" });
    const toggle = page.locator("#ryd-discussion-inbox-toggle");
    const inbox = page.locator("#ryd-discussion-popup");
    const back = page.locator(".ryd-discussion-inbox-back");
    await toggle.click();

    expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
    await expect(inbox).toBeVisible();
    await expect(back).toHaveText("\u2190");
    await expect(back).toHaveAccessibleName("Close");
    await expect(back).toBeFocused();
    await page.locator(".ryd-discussion-inbox-brand").screenshot({ path: testInfo.outputPath("inbox-header.png") });

    await back.click();
    await expect(inbox).toBeHidden();
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeFocused();
    await adapter.assertNoPageSignals(testInfo.title);
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
});
