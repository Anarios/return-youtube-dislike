const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openWatchFixture,
} = require("./harness");

const EXISTING_CREDENTIALS = {
  registrationConfirmed: true,
  userId: "ExistingUserscriptCredential00000001",
};

test("the first synchronous click on a replaced current control votes once while a hidden stale control is ignored", async ({
  context,
  page,
}) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.addInitScript(() => {
    globalThis.__unhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      globalThis.__unhandledRejections.push(String(event.reason));
    });
  });

  const backend = createFakeBackend();
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openWatchFixture(page, VIDEO_A);
  await injectGeneratedUserscript(page);

  const currentDislike = page.locator('[data-ryd-role="buttons"] [data-ryd-role="dislike"]');
  await expect(currentDislike.locator("#text")).toHaveText("25");
  await expect(page.locator("#return-youtube-dislike-bar-container")).toBeVisible();

  await page.evaluate(() => {
    const current = document.querySelector('[data-ryd-role="buttons"] [data-ryd-role="dislike"]');
    const stale = current.cloneNode(true);
    stale.hidden = true;
    stale.setAttribute("data-fixture-stale-dislike", "true");
    document.body.append(stale);
    stale.querySelector("button").click();
  });
  await page.waitForTimeout(100);
  expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(0);
  await expect(currentDislike.locator("#text")).toHaveText("25");

  await page.evaluate(() => {
    const current = document.querySelector('[data-ryd-role="buttons"] [data-ryd-role="dislike"]');
    const replacement = current.cloneNode(true);
    replacement.setAttribute("data-fixture-replaced-current-dislike", "true");
    current.replaceWith(replacement);
    replacement.querySelector("button").click();
  });

  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect(page.locator('[data-fixture-replaced-current-dislike="true"] #text')).toHaveText("26");
  await page.waitForTimeout(650);

  expect(backend.requestsFor("POST", "/interact/vote").map(({ body }) => body)).toEqual([
    { userId: EXISTING_CREDENTIALS.userId, value: -1, videoId: VIDEO_A },
  ]);
  expect(backend.requestsFor("POST", "/interact/confirmVote")).toHaveLength(1);
  expect(backend.blockedRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
});
