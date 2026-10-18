const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const { assertInvariantContinuously } = require("../continuous-invariants");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

const EXTENSION_ARTIFACT = path.resolve(
  process.env.RYD_EXTENSION_ARTIFACT || path.join(__dirname, "../../combined/dist/chrome"),
);
const PROMPT = "#ryd-review-prompt";
const STATE_KEY = "reviewPromptState";
const VIDEO_IDS = [VIDEO_A, VIDEO_B, "mnopqrstuvw", "12345678901", "ABCDEFGHIJK", "LMNOPQRSTUV"];
const REACTION = (action) => `[data-fixture-role="${action}"] button`;
const DISLIKE_TEXT = '[data-fixture-role="dislike"] #text';
const DISLIKE_ANCHOR = '[data-fixture-role="dislike"]';
const YOUTUBE_ELEMENT_RESET = `
  canvas, caption, center, cite, code, dd, del, dfn, div, dl, dt, em, embed, fieldset, font, form,
  h1, h2, h3, h4, h5, h6, hr, i, iframe, img, ins, kbd, label, legend, li, menu, object, ol, p,
  pre, q, s, samp, small, span, strike, strong, sub, sup, table, tbody, td, tfoot, th, thead, tr,
  tt, u, ul, var { margin: 0px; padding: 0px; border: 0px; background: transparent; }
`;
const REVIEW_URL =
  "https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi/reviews";

async function readPromptLayout(page) {
  return page.locator(PROMPT).evaluate((host, anchorSelector) => {
    const bounds = (element) => {
      const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
      return { top, right, bottom, left, width, height };
    };
    const section = host.shadowRoot.querySelector("section");
    return {
      prompt: bounds(host),
      surface: bounds(section),
      anchor: bounds(document.querySelector(anchorSelector)),
      close: bounds(section.querySelector("button")),
      brand: bounds(section.querySelector(".brand")),
      logo: bounds(section.querySelector(".brand svg")),
      placement: host.dataset.placement,
      client: section.clientWidth,
      scroll: section.scrollWidth,
      modal: host.matches(":modal"),
    };
  }, DISLIKE_ANCHOR);
}

async function expectAnchoredPrompt(page, viewport, placement) {
  const prompt = page.locator(PROMPT);
  if (placement) await expect(prompt).toHaveAttribute("data-placement", placement);
  await expect
    .poll(async () => {
      const layout = await readPromptLayout(page);
      return layout.placement === "above"
        ? layout.anchor.top - layout.prompt.bottom
        : layout.prompt.top - layout.anchor.bottom;
    })
    .toBeCloseTo(12, 0);
  const layout = await readPromptLayout(page);
  expect(layout.anchor.left).toBeGreaterThanOrEqual(0);
  expect(layout.anchor.right).toBeLessThanOrEqual(viewport.width);
  expect(layout.anchor.top).toBeGreaterThanOrEqual(0);
  expect(layout.anchor.bottom).toBeLessThanOrEqual(viewport.height);
  expect(layout.prompt.left).toBeGreaterThanOrEqual(15.5);
  expect(layout.prompt.top).toBeGreaterThanOrEqual(15.5);
  expect(layout.prompt.right).toBeLessThanOrEqual(viewport.width - 15.5);
  expect(layout.prompt.bottom).toBeLessThanOrEqual(viewport.height - 15.5);
  expect(layout.prompt.width).toBeCloseTo(Math.min(320, viewport.width - 32), 0);
  expect(layout.prompt.right).toBeGreaterThan(layout.anchor.left);
  expect(layout.prompt.left).toBeLessThan(layout.anchor.right);
  for (const child of [layout.close, layout.brand, layout.logo]) {
    expect(child.left).toBeGreaterThanOrEqual(layout.surface.left);
    expect(child.right).toBeLessThanOrEqual(layout.surface.right);
    expect(child.top).toBeGreaterThanOrEqual(layout.surface.top);
    expect(child.bottom).toBeLessThanOrEqual(layout.surface.bottom);
  }
  expect(layout.brand.right).toBeLessThanOrEqual(layout.close.left + 0.5);
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  expect(layout.modal).toBe(false);
  return layout;
}

async function readReviewState(adapter) {
  return adapter.worker.evaluate(async (key) => (await chrome.storage.local.get(key))[key], STATE_KEY);
}

async function seedEligibility(adapter) {
  await adapter.worker.evaluate(async (key) => chrome.storage.local.set({ [key]: { eligible: true } }), STATE_KEY);
}

async function openReadyWatch(adapter, videoId) {
  await adapter.openWatch(videoId);
  await expect(adapter.page.locator(DISLIKE_TEXT)).toHaveText("25");
  await expect(adapter.page.locator(REACTION("dislike"))).toHaveCount(1);
}

async function withArtifact(testInfo, contextOptions, run) {
  const apiServer = await startHermeticApiServer();
  const adapter = new HermeticExtensionArtifactAdapter({
    apiServer,
    artifactDirectory: EXTENSION_ARTIFACT,
    contextOptions,
  });
  try {
    await adapter.start();
    await run(adapter);
    await adapter.assertNoPageSignals(testInfo.title);
    expect(adapter.backend.blockedRequests).toEqual([]);
    expect(apiServer.unexpectedRequests).toEqual([]);
  } finally {
    await adapter.close().catch(() => {});
    await apiServer.close().catch(() => {});
  }
}

test("review request counts distinct reacted videos, waits for a later dislike, and stays dismissed after reload", async ({}, testInfo) => {
  await withArtifact(testInfo, {}, async (adapter) => {
    const page = adapter.page;
    await openReadyWatch(adapter, VIDEO_IDS[0]);
    for (const action of ["like", "like", "like", "dislike", "dislike", "dislike"]) {
      await page.locator(REACTION(action)).click();
      await expect.poll(() => readReviewState(adapter)).toEqual({ videoIds: [VIDEO_IDS[0]] });
      await expect(page.locator(PROMPT)).toHaveCount(0);
    }

    for (let index = 1; index < 5; index += 1) {
      await openReadyWatch(adapter, VIDEO_IDS[index]);
      await page.locator(REACTION(index % 2 ? "like" : "dislike")).click();
      await expect
        .poll(() => readReviewState(adapter))
        .toEqual(index === 4 ? { eligible: true } : { videoIds: VIDEO_IDS.slice(0, index + 1) });
      await expect(page.locator(PROMPT)).toHaveCount(0);
    }

    await openReadyWatch(adapter, VIDEO_IDS[5]);
    await page.locator(REACTION("like")).click();
    await expect(page.locator(REACTION("like"))).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => readReviewState(adapter)).toEqual({ eligible: true });
    await expect(page.locator(PROMPT)).toHaveCount(0);
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(PROMPT)).toBeVisible();
    await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await expect(page.locator(REACTION("dislike"))).toBeFocused();
    await page.locator(`${PROMPT} button`).click();
    await expect(page.locator(PROMPT)).toHaveCount(0);

    await page.reload();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("25");
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await expect(page.locator(PROMPT)).toHaveCount(0);
    await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
  });
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 640 },
]) {
  test(`review request is unobtrusive and keyboard accessible at ${viewport.width}px in both themes`, async ({}, testInfo) => {
    await withArtifact(testInfo, { viewport }, async (adapter) => {
      const page = adapter.page;
      await seedEligibility(adapter);
      await openReadyWatch(adapter, VIDEO_A);
      await page.addStyleTag({
        content: `${YOUTUBE_ELEMENT_RESET}
          body { min-height: 1400px; }
          #player { height: 180px; }
        `,
      });
      await page.locator(DISLIKE_ANCHOR).scrollIntoViewIfNeeded();
      await page.locator(REACTION("dislike")).click();
      const prompt = page.locator(PROMPT);
      const surface = prompt.locator("section");
      await expect(prompt).toBeVisible();
      await expect(prompt).toHaveCount(1);
      await expect(page.locator(REACTION("dislike"))).toBeFocused();
      await expect(prompt.locator('[role="status"]')).toContainText("Enjoying RYD?");
      const review = prompt.locator("a");
      await expect(review).toHaveAttribute("href", REVIEW_URL);
      await expect(review).toHaveAttribute("target", "_blank");
      await expect(review).toHaveAttribute("rel", "noopener noreferrer");
      await expect(prompt.locator("button")).toHaveAccessibleName(/close/i);
      await expect(prompt.locator(".brand")).toHaveText("Return YouTube Dislike");
      await expect(prompt.locator(".brand svg")).toBeVisible();
      await expect(prompt.locator(".brand svg")).toHaveCSS("width", "24px");
      await expect(prompt.locator(".brand svg")).toHaveCSS("height", "24px");
      await expect(prompt).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(prompt).toHaveCSS("padding", "0px");
      await expect(surface).toHaveCSS("padding", "16px");
      await expect(surface).toHaveCSS("font-size", "14px");

      for (const dark of [false, true]) {
        const palette = dark
          ? { background: "rgb(15, 15, 15)", foreground: "rgb(241, 241, 241)", border: "rgba(255, 255, 255, 0.1)" }
          : { background: "rgb(255, 255, 255)", foreground: "rgb(15, 15, 15)", border: "rgba(0, 0, 0, 0.1)" };
        await page.evaluate(
          ({ dark, palette }) => {
            const root = document.documentElement;
            root.toggleAttribute("dark", dark);
            root.style.setProperty("--yt-spec-base-background", palette.background);
            root.style.setProperty("--yt-spec-text-primary", palette.foreground);
            root.style.setProperty("--yt-spec-10-percent-layer", palette.border);
            document.body.style.background = palette.background;
            root.style.background = palette.background;
          },
          { dark, palette },
        );
        await expect(surface).toHaveCSS("background-color", dark ? "rgb(39, 39, 39)" : palette.background);
        await expect(surface).toHaveCSS("color", palette.foreground);
        await expect(surface).toHaveCSS("border-top-color", palette.border);
        await expectAnchoredPrompt(page, viewport, "below");
        await page.screenshot({ path: testInfo.outputPath(`${dark ? "dark" : "light"}-${viewport.width}.png`) });
        await prompt.screenshot({ path: testInfo.outputPath(`${dark ? "dark" : "light"}-${viewport.width}-card.png`) });
      }

      const beforeScroll = await readPromptLayout(page);
      await page.evaluate(() => window.scrollTo(0, 64));
      await expect
        .poll(async () => (await readPromptLayout(page)).anchor.top)
        .toBeCloseTo(beforeScroll.anchor.top - 64, 0);
      const afterScroll = await expectAnchoredPrompt(page, viewport, "below");
      expect(afterScroll.prompt.top).toBeCloseTo(beforeScroll.prompt.top - 64, 0);

      await page.setViewportSize({ width: viewport.width, height: 900 });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.getElementById("player").style.height = "390px";
      });
      await expectAnchoredPrompt(page, { width: viewport.width, height: 900 }, "below");
      await page.setViewportSize({ width: viewport.width, height: 520 });
      await expectAnchoredPrompt(page, { width: viewport.width, height: 520 }, "above");

      await review.focus();
      await page.keyboard.press("Tab");
      await expect(prompt.locator("button")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(prompt).toHaveCount(0);
      await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
    });
  });
}

test("review request clears during SPA navigation and is shown only once across tabs", async ({}, testInfo) => {
  await withArtifact(testInfo, {}, async (adapter) => {
    const page = adapter.page;
    await seedEligibility(adapter);
    await adapter.openSpaWatch(VIDEO_A);
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("25");
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(PROMPT)).toBeVisible();
    await page.evaluate((videoId) => window.__navigationFixture.navigateWatchAfterStartWithoutFinish(videoId), VIDEO_B);
    await expect(page.locator(PROMPT)).toHaveCount(0);
    await page.evaluate(() => window.__navigationFixture.finishWatchAfterStartWithoutFinish());
    await expect(page).toHaveURL(new RegExp(`v=${VIDEO_B}`));
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("25");
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await expect(page.locator(PROMPT)).toHaveCount(0);

    const otherPage = await adapter.context.newPage();
    try {
      await otherPage.bringToFront();
      await otherPage.goto(`https://www.youtube.com/watch?v=${VIDEO_IDS[2]}`);
      await expect(otherPage.locator(DISLIKE_TEXT)).toHaveText("25");
      await otherPage.locator(REACTION("dislike")).click();
      await expect(otherPage.locator(DISLIKE_TEXT)).toHaveText("26");
      await expect(otherPage.locator(PROMPT)).toHaveCount(0);
      await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
    } finally {
      await otherPage.close();
    }
  });
});

test("a lost review request remains consumed after another reaction, reload, and another tab", async ({}, testInfo) => {
  await withArtifact(testInfo, {}, async (adapter) => {
    const page = adapter.page;
    await adapter.context.addInitScript(() => {
      if (location.hostname !== "www.youtube.com") return;
      window.__removedReviewPrompts = 0;
      new MutationObserver(() => {
        const prompt = document.getElementById("ryd-review-prompt");
        if (!prompt) return;
        window.__removedReviewPrompts += 1;
        prompt.remove();
      }).observe(document, { childList: true, subtree: true });
    });
    await seedEligibility(adapter);
    await openReadyWatch(adapter, VIDEO_A);
    await adapter.worker.evaluate(() => {
      const write = chrome.storage.local.set.bind(chrome.storage.local);
      globalThis.__restoreReviewPromptWrite = () => {
        chrome.storage.local.set = write;
      };
      globalThis.__reviewPromptWritePending = false;
      chrome.storage.local.set = async (items) => {
        if (items.reviewPromptState?.shown === true) {
          globalThis.__reviewPromptWritePending = true;
          await new Promise((resolve) => {
            globalThis.__releaseReviewPromptWrite = resolve;
          });
        }
        return write(items);
      };
    });
    await page.locator(REACTION("dislike")).click();
    await expect.poll(() => adapter.worker.evaluate(() => globalThis.__reviewPromptWritePending)).toBe(true);
    expect(await readReviewState(adapter)).toEqual({ eligible: true });
    expect(await page.evaluate(() => window.__removedReviewPrompts)).toBe(0);
    await expect(page.locator(PROMPT)).toHaveCount(0);
    await adapter.worker.evaluate(() => globalThis.__releaseReviewPromptWrite());
    await expect.poll(() => page.evaluate(() => window.__removedReviewPrompts)).toBe(1);
    await expect(page.locator(PROMPT)).toHaveCount(0);
    await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await adapter.worker.evaluate(() => globalThis.__restoreReviewPromptWrite());

    const expectNoFurtherAttempt = (target, removedCount) =>
      assertInvariantContinuously({
        label: "a consumed review request must never be inserted again",
        durationMs: 500,
        read: () =>
          target.evaluate(() => ({
            removed: window.__removedReviewPrompts,
            present: Boolean(document.getElementById("ryd-review-prompt")),
          })),
        isValid: ({ removed, present }) => removed === removedCount && !present,
      });

    await page.locator(REACTION("like")).click();
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await expectNoFurtherAttempt(page, 1);
    await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });

    await page.reload();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("25");
    await page.locator(REACTION("dislike")).click();
    await expect(page.locator(DISLIKE_TEXT)).toHaveText("26");
    await expectNoFurtherAttempt(page, 0);

    const otherPage = await adapter.context.newPage();
    try {
      await otherPage.bringToFront();
      await otherPage.goto(`https://www.youtube.com/watch?v=${VIDEO_B}`);
      await expect(otherPage.locator(DISLIKE_TEXT)).toHaveText("25");
      await otherPage.locator(REACTION("dislike")).click();
      await expect(otherPage.locator(DISLIKE_TEXT)).toHaveText("26");
      await expectNoFurtherAttempt(otherPage, 0);
      await expect.poll(() => readReviewState(adapter)).toEqual({ shown: true });
    } finally {
      await otherPage.close();
    }
  });
});
