const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const {
  WATCH_CONTROL_LAYOUTS,
  expectWatchControlWidths,
  installWatchControlLayout,
  widenWatchControls,
} = require("../watch-control-width-contract");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const COUNTS = { likes: 300, dislikes: 100 };
const PROFILE = { container: "#ryd-bar-container", bar: "#ryd-bar", controlWidth: "computedWidth" };

for (const layout of WATCH_CONTROL_LAYOUTS) {
  test(`generated extension measures ${layout.name} controls before and after a vote`, async () => {
    const apiServer = await startHermeticApiServer(COUNTS);
    const adapter = new HermeticExtensionArtifactAdapter({
      apiServer,
      artifactDirectory: EXTENSION_ARTIFACT,
      backendOptions: {
        countsByVideo: { [VIDEO_A]: COUNTS },
        fixture: { nativeDislikeText: false, roleAttribute: "data-fixture-role" },
      },
    });
    try {
      await adapter.start();
      await installWatchControlLayout(adapter.context, layout);
      await adapter.openWatch(VIDEO_A);

      const dislikeText = adapter.page.locator('[data-fixture-role="dislike"] .ytSpecButtonShapeNextButtonTextContent');
      await expect(dislikeText).toHaveText(String(COUNTS.dislikes));
      const before = await expectWatchControlWidths(adapter.page, PROFILE, { ...layout, ...COUNTS });
      await widenWatchControls(adapter.page);
      await adapter.page.locator('[data-fixture-role="dislike"] button').click();
      await expect(dislikeText).toHaveText(String(COUNTS.dislikes + 1));
      const after = await expectWatchControlWidths(adapter.page, PROFILE, {
        ...layout,
        likes: COUNTS.likes,
        dislikes: COUNTS.dislikes + 1,
      });
      expect(after.wrapperWidth).toBeGreaterThan(before.wrapperWidth);
      await expect
        .poll(() => apiServer.records.filter((record) => record.pathname === "/interact/confirmVote").length)
        .toBe(1);
      const interactions = apiServer.records.filter((record) =>
        ["/interact/vote", "/interact/confirmVote"].includes(record.pathname),
      );
      expect(interactions.map(({ pathname }) => pathname)).toEqual(["/interact/vote", "/interact/confirmVote"]);
      expect(interactions[0].body).toMatchObject({ videoId: VIDEO_A, value: -1 });
      await expect.poll(() => interactions[1].responseBody).toBe(true);
      await adapter.assertNoPageSignals("watch-control-width");
      expect(adapter.backend.blockedRequests).toEqual([]);
      expect(apiServer.unexpectedRequests).toEqual([]);
    } finally {
      await adapter.close();
      await apiServer.close();
    }
  });
}
