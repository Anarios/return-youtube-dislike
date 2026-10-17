const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  createFakeBackend,
  forbidUnsafeHtmlSinks,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openShortsFixture,
  openWatchFixture,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};

async function prepareGuardedFixture({ context, page }, openFixture) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const backend = createFakeBackend();
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openFixture(page, VIDEO_A);
  await forbidUnsafeHtmlSinks(page);
  await injectGeneratedUserscript(page);

  return { backend, pageErrors };
}

async function expectNoUnsafeHtmlUsage(page, backend, pageErrors) {
  expect(await page.evaluate(() => globalThis.__rydUnsafeHtmlSinkCalls)).toEqual([]);
  expect(backend.blockedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
}

test("watch ratio bar initializes when unsafe HTML sinks are forbidden", async ({ context, page }) => {
  const { backend, pageErrors } = await prepareGuardedFixture({ context, page }, openWatchFixture);

  await expect(page.locator('[data-ryd-role="dislike"] #text')).toHaveText("25");
  expect(await page.evaluate(() => globalThis.__rydUnsafeHtmlSinkCalls)).toEqual([]);
  await expect(page.locator("#return-youtube-dislike-bar-container")).toBeVisible();
  await expect(page.locator("#return-youtube-dislike-bar")).toBeVisible();
  await expect(page.locator("#ryd-dislike-tooltip")).toContainText("100 / 25");
  await expectNoUnsafeHtmlUsage(page, backend, pageErrors);
});

test("modern Shorts synthetic dislike initializes when unsafe HTML sinks are forbidden", async ({ context, page }) => {
  const { backend, pageErrors } = await prepareGuardedFixture({ context, page }, openShortsFixture);

  const syntheticDislike = page.locator("[data-ryd-synthetic-shorts-dislike]");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        initialized: Boolean(document.querySelector("[data-ryd-synthetic-shorts-dislike]")),
        unsafeHtmlSinkCalls: globalThis.__rydUnsafeHtmlSinkCalls,
      })),
    )
    .toEqual({ initialized: true, unsafeHtmlSinkCalls: [] });
  await expect(syntheticDislike).toBeVisible();
  await expect(syntheticDislike.locator("button")).toHaveAttribute("aria-pressed", "false");
  await expect(syntheticDislike.locator("#text")).toHaveText("25");
  await expect(syntheticDislike.locator("svg path")).toHaveCount(1);
  await expectNoUnsafeHtmlUsage(page, backend, pageErrors);
});
