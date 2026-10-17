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
const {
  WATCH_CONTROL_LAYOUTS,
  expectWatchControlWidths,
  installWatchControlLayout,
  widenWatchControls,
} = require("../../e2e/watch-control-width-contract");
const { createPageSignalCollector } = require("../../e2e/hermetic-artifact-smoke");

const COUNTS = { likes: 300, dislikes: 100 };
const PROFILE = {
  container: "#return-youtube-dislike-bar-container",
  bar: "#return-youtube-dislike-bar",
  controlWidth: "clientWidth",
};

for (const layout of WATCH_CONTROL_LAYOUTS) {
  test(`generated userscript measures ${layout.name} controls before and after a vote`, async ({ context, page }) => {
    const pageSignals = await createPageSignalCollector(page, "userscript");
    const backend = createFakeBackend({ countsByVideo: { [VIDEO_A]: COUNTS } });
    await installGmEnvironment(context, {
      [CREDENTIAL_KEY]: {
        userId: "ExistingUserscriptCredential000000000001",
        registrationConfirmed: true,
      },
    });
    await installHermeticRoutes(context, backend);
    await installWatchControlLayout(context, layout);
    await openWatchFixture(page, VIDEO_A);
    await injectGeneratedUserscript(page);

    const dislikeText = page.locator('[data-ryd-role="dislike"] #text');
    await expect(dislikeText).toHaveText(String(COUNTS.dislikes));
    const before = await expectWatchControlWidths(page, PROFILE, { ...layout, ...COUNTS });
    await widenWatchControls(page);
    await page.locator('[data-ryd-role="dislike"] button').click();
    await expect(dislikeText).toHaveText(String(COUNTS.dislikes + 1));
    const after = await expectWatchControlWidths(page, PROFILE, {
      ...layout,
      likes: COUNTS.likes,
      dislikes: COUNTS.dislikes + 1,
    });
    expect(after.wrapperWidth).toBeGreaterThan(before.wrapperWidth);
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
    expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(1);
    expect(backend.requestsFor("POST", "/interact/vote")[0].body).toMatchObject({ videoId: VIDEO_A, value: -1 });
    await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote")[0]?.responseBody).toBe(true);
    expect(backend.blockedRequests).toEqual([]);
    await pageSignals.assertClean("watch-control-width");
  });
}
