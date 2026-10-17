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
  userId: "ExistingUserscriptCredential000000000001",
  registrationConfirmed: true,
};
const COUNTS = { likes: 300, dislikes: 100 };
const VIEWPORTS = [
  { name: "wide desktop", width: 1280, height: 720 },
  { name: "narrow desktop", width: 768, height: 720 },
  { name: "mobile-sized", width: 390, height: 844 },
];

function colorChannels(color) {
  const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) return srgb.slice(1).map((channel) => Number(channel) * 255);
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`);
  return channels;
}

function relativeLuminance(color) {
  const channels = colorChannels(color);
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

async function readBarColors(page) {
  return page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    negative: getComputedStyle(document.querySelector("#return-youtube-dislike-bar-container")).backgroundColor,
    positive: getComputedStyle(document.querySelector("#return-youtube-dislike-bar")).backgroundColor,
  }));
}

function expectVisibleBarColors(colors, expected) {
  expect(colors.background).toBe(expected.background);
  expect(colors.positive).toBe(expected.positive);
  colorChannels(colors.negative).forEach((channel) => expect(channel).toBeCloseTo(expected.negative, 0));
  expect(contrastRatio(colors.negative, colors.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(colors.positive, colors.negative)).toBeGreaterThanOrEqual(3);
}

async function launchRateBarFixture({ context, page }, { rateBarEnabled, theme = "dark" } = {}) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const backend = createFakeBackend({ countsByVideo: { [VIDEO_A]: COUNTS } });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await openWatchFixture(page, VIDEO_A);
  if (theme === "light") {
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--yt-spec-base-background", "rgb(255, 255, 255)");
      document.documentElement.style.setProperty("--yt-spec-text-primary", "rgb(15, 15, 15)");
      document.documentElement.style.setProperty("--yt-spec-text-secondary", "rgb(96, 96, 96)");
      document.body.style.background = "rgb(255, 255, 255)";
    });
  }
  await injectGeneratedUserscript(page, { rateBarEnabled });

  await expect(page.locator('[data-ryd-role="dislike"] #text')).toHaveText(String(COUNTS.dislikes));
  return { backend, pageErrors };
}

for (const viewport of VIEWPORTS) {
  test(`default ratio bar renders cleanly at ${viewport.name} width`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const { backend, pageErrors } = await launchRateBarFixture({ context, page });

    const wrapper = page.locator(".ryd-tooltip");
    const container = page.locator("#return-youtube-dislike-bar-container");
    const bar = page.locator("#return-youtube-dislike-bar");
    const tooltip = page.locator("#ryd-dislike-tooltip");
    const dislikeCount = page.locator('[data-ryd-role="dislike"] #text');

    await expect(dislikeCount).toBeVisible();
    await expect(dislikeCount).toHaveText(String(COUNTS.dislikes));
    await expect(wrapper).toBeVisible();
    await expect(container).toBeVisible();
    await expect(bar).toBeVisible();
    await expect(tooltip).toContainText("300 / 100");
    await expect(tooltip).toHaveAttribute("role", "tooltip");
    await expect(tooltip).toBeHidden();
    await expect(page.locator("tp-yt-paper-tooltip#ryd-dislike-tooltip")).toHaveCount(0);

    const idleTooltipStyle = await tooltip.evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, visibility: style.visibility };
    });
    expect(idleTooltipStyle).toEqual({ opacity: "0", visibility: "hidden" });

    await wrapper.hover({ position: { x: 1, y: 1 } });
    await expect(tooltip).toBeVisible();
    await expect.poll(() => tooltip.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    const hoveredTooltip = await tooltip.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        bottom: bounds.bottom,
        color: style.color,
        left: bounds.left,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        right: bounds.right,
        visibility: style.visibility,
        viewportWidth: innerWidth,
      };
    });
    expect(hoveredTooltip).toMatchObject({
      backgroundColor: "rgba(28, 28, 28, 0.96)",
      color: "rgb(255, 255, 255)",
      opacity: "1",
      pointerEvents: "none",
      position: "absolute",
      visibility: "visible",
    });
    expect(hoveredTooltip.left).toBeGreaterThanOrEqual(0);
    expect(hoveredTooltip.right).toBeLessThanOrEqual(hoveredTooltip.viewportWidth);
    expect(hoveredTooltip.bottom).toBeGreaterThan(0);

    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await expect(tooltip).toBeHidden();
    await wrapper.focus();
    await expect(tooltip).toBeVisible();
    await wrapper.evaluate((element) => element.blur());
    await expect(tooltip).toBeHidden();

    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
        };
      };
      return {
        bar: rect("#return-youtube-dislike-bar"),
        container: rect("#return-youtube-dislike-bar-container"),
        dislike: rect('[data-ryd-role="dislike"] button'),
        like: rect('[data-ryd-role="like"] button'),
        viewport: { height: innerHeight, width: innerWidth },
        wrapper: rect(".ryd-tooltip"),
      };
    });

    expect(geometry.container.width).toBeGreaterThan(0);
    expect(geometry.container.height).toBeGreaterThan(0);
    expect(geometry.bar.width).toBeGreaterThan(0);
    expect(geometry.bar.height).toBeGreaterThan(0);
    expect(geometry.bar.width / geometry.container.width).toBeCloseTo(0.75, 2);
    expect(geometry.wrapper.width).toBeCloseTo(geometry.like.width + geometry.dislike.width, 0);
    expect(geometry.container.left).toBeGreaterThanOrEqual(0);
    expect(geometry.container.top).toBeGreaterThanOrEqual(0);
    expect(geometry.container.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(geometry.container.bottom).toBeLessThanOrEqual(geometry.viewport.height);
    expect(geometry.container.top).toBeGreaterThanOrEqual(Math.max(geometry.like.bottom, geometry.dislike.bottom));

    expectVisibleBarColors(await readBarColors(page), {
      background: "rgb(15, 15, 15)",
      negative: 139,
      positive: "rgb(241, 241, 241)",
    });

    expect(backend.blockedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

test("default ratio bar keeps both sides distinct in the light theme", async ({ context, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { backend, pageErrors } = await launchRateBarFixture({ context, page }, { theme: "light" });

  expectVisibleBarColors(await readBarColors(page), {
    background: "rgb(255, 255, 255)",
    negative: 123,
    positive: "rgb(15, 15, 15)",
  });
  expect(backend.blockedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("in-memory disabled option omits the ratio bar", async ({ context, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { backend, pageErrors } = await launchRateBarFixture({ context, page }, { rateBarEnabled: false });

  await expect(page.locator("#return-youtube-dislike-bar-container")).toHaveCount(0);
  await expect(page.locator("#return-youtube-dislike-bar")).toHaveCount(0);
  await expect(page.locator("#ryd-dislike-tooltip")).toHaveCount(0);
  expect(backend.blockedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
