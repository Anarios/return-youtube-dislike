const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const DISLIKE_TEXT = '[data-fixture-role="dislike"] #text';

async function installFeedbackGuard(context) {
  await context.addInitScript(() => {
    if (location.hostname !== "www.youtube.com") return;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const style = document.createElement("style");
        style.textContent = '[data-fixture-role="dislike"] #text { text-transform: lowercase; }';
        document.head.append(style);
        const state = { batches: 0, capped: false };
        window.__dislikeFeedbackFixture = state;
        const guard = new MutationObserver((records) => {
          if (
            !records.some((record) => {
              const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
              return target?.closest('[data-fixture-role="dislike"]');
            })
          )
            return;
          state.batches++;
          if (state.batches >= 100) {
            state.capped = true;
            guard.disconnect();
            // Remove the test-owned controls so a regression cannot starve the test runner indefinitely.
            document.querySelector("yt-smartimation")?.remove();
          }
        });
        guard.observe(document.documentElement, { characterData: true, childList: true, subtree: true });
      },
      { once: true },
    );
  });
}

async function expectObserverSettled(page) {
  const result = await page.evaluate(async () => {
    const fixture = window.__dislikeFeedbackFixture;
    const before = fixture.batches;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { before, after: fixture.batches, capped: fixture.capped };
  });
  expect(result.capped).toBe(false);
  expect(result.after).toBe(result.before);
}

async function expectDislikeCount(page, text) {
  await page.waitForFunction(
    ({ selector, expected }) =>
      window.__dislikeFeedbackFixture?.capped || document.querySelector(selector)?.textContent === expected,
    { selector: DISLIKE_TEXT, expected: text },
  );
  expect(await page.evaluate(() => window.__dislikeFeedbackFixture.capped)).toBe(false);
  await expect(page.locator(DISLIKE_TEXT)).toHaveText(text);
}

test("generated extension settles dislike observers across CSS changes and native replacements", async () => {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    backendOptions: {
      countsByVideo: { [VIDEO_A]: { likes: 300, dislikes: 6100 }, [VIDEO_B]: { likes: 300, dislikes: 7200 } },
      fixture: { roleAttribute: "data-fixture-role" },
    },
  });
  try {
    await adapter.start();
    await installFeedbackGuard(adapter.context);
    await adapter.openWatch(VIDEO_A);
    await expectDislikeCount(adapter.page, "6.1K");
    expect(await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => element.innerText)).toBe("6.1k");
    await expectObserverSettled(adapter.page);

    await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => {
      element.style.visibility = "hidden";
    });
    await expectObserverSettled(adapter.page);
    expect(await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => element.innerText)).toBe("");

    await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => {
      const replacement = element.cloneNode(true);
      replacement.textContent = "native replacement";
      element.replaceWith(replacement);
    });
    await expectDislikeCount(adapter.page, "6.1K");
    await expectObserverSettled(adapter.page);

    await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => {
      element.style.removeProperty("visibility");
    });
    await expectObserverSettled(adapter.page);
    expect(await adapter.page.locator(DISLIKE_TEXT).evaluate((element) => element.innerText)).toBe("6.1k");

    await adapter.page.evaluate((videoId) => window.__youtubeFixture.navigate(videoId), VIDEO_B);
    await expectDislikeCount(adapter.page, "7.2K");
    await expectObserverSettled(adapter.page);
    await adapter.assertNoPageSignals("dislike-observer");
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
  } finally {
    await adapter.close();
    await apiServer.close();
  }
});
