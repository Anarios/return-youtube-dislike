const { test, expect } = require("@playwright/test");
const {
  VIDEO_A,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openWatchFixture,
} = require("./harness");

test("like formatting tolerates a missing count label during rendering and voting", async ({ context, page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const backend = createFakeBackend({ countsByVideo: { [VIDEO_A]: { likes: 300, dislikes: 100 } } });
  await installGmEnvironment(context);
  await installHermeticRoutes(context, backend);
  await openWatchFixture(page, VIDEO_A);
  await page.locator('[data-ryd-role="like"]').evaluate((button) => {
    button.querySelector("#text").remove();
    button.querySelector("button").setAttribute("aria-label", "300 likes");
  });
  await injectGeneratedUserscript(page, { numberDisplayReformatLikes: true });

  await expect(page.locator('[data-ryd-role="dislike"] #text')).toHaveText("100");
  await expect(page.locator("#return-youtube-dislike-bar-container")).toBeVisible();
  await page.locator('[data-ryd-role="dislike"] button').click();
  await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
  await expect(page.locator('[data-ryd-role="dislike"] #text')).toHaveText("101");
  expect(pageErrors).toEqual([]);
});
