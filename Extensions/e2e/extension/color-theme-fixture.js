const { expect } = require("@playwright/test");

const HIBISCUS = Object.freeze({
  light: { like: "#007600", dislike: "#b300b3" },
  dark: { like: "#00d000", dislike: "#ff77ff" },
});
const CUSTOM_COLORS = Object.freeze({
  light: { like: "#006633", dislike: "#990099" },
  dark: { like: "#66ff99", dislike: "#ff99dd" },
});

function rgb(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => parseInt(channel, 16));
  return `rgb(${channels.join(", ")})`;
}

function contrast(first, second) {
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    const linear = channels.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function setFixtureTheme(page, theme) {
  await page.evaluate((mode) => {
    const dark = mode === "dark";
    if (dark) document.documentElement.setAttribute("dark", "");
    else document.documentElement.removeAttribute("dark");
    document.documentElement.style.background = dark ? "rgb(15, 15, 15)" : "rgb(255, 255, 255)";
    document.body.style.background = dark ? "rgb(15, 15, 15)" : "rgb(255, 255, 255)";
    let style = document.getElementById("fixture-theme-colors");
    if (!style) {
      style = document.createElement("style");
      style.id = "fixture-theme-colors";
      document.head.append(style);
    }
    style.textContent = `
      [data-fixture-shell] button, reel-action-bar-view-model button {
        background-color: ${dark ? "rgb(39, 39, 39)" : "rgb(255, 255, 255)"};
      }
    `;
  }, theme);
}

async function readThumbColors(page, selectors) {
  return page.evaluate((roles) => {
    const result = {};
    for (const role of ["like", "dislike"]) {
      const button = document.querySelector(roles[role]);
      if (!button) return null;
      const icon = button.querySelector("svg path");
      result[role] = {
        background: getComputedStyle(button).backgroundColor,
        color: getComputedStyle(button).color,
        fill: icon ? getComputedStyle(icon).fill : null,
      };
    }
    return result;
  }, selectors);
}

async function expectPalette(page, palette, { selectors, barIds, checkIconContrast = false } = {}) {
  await expect
    .poll(async () => {
      const colors = await readThumbColors(page, selectors);
      return colors && { like: colors.like.color, dislike: colors.dislike.color };
    })
    .toEqual({ like: rgb(palette.like), dislike: rgb(palette.dislike) });

  if (barIds) {
    await expect(page.locator(barIds.like)).toBeVisible();
    await expect(page.locator(barIds.dislike)).toBeVisible();
    await expect(page.locator(barIds.like)).toHaveCSS("background-color", rgb(palette.like));
    await expect(page.locator(barIds.dislike)).toHaveCSS("background-color", rgb(palette.dislike));
  }
  if (checkIconContrast) {
    const colors = await readThumbColors(page, selectors);
    for (const role of ["like", "dislike"]) {
      expect(colors[role].fill).toBe(rgb(palette[role]));
      expect(contrast(colors[role].fill, colors[role].background)).toBeGreaterThanOrEqual(3);
    }
  }
}

async function captureColorEvidence(page, testInfo, name, locator, paddingBelow = 0) {
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  if (locator && paddingBelow > 0) {
    const box = await locator.boundingBox();
    if (!box) throw new Error(`The ${name} screenshot anchor is not visible.`);
    await page.screenshot({
      animations: "disabled",
      clip: { ...box, height: box.height + paddingBelow },
      path: screenshotPath,
    });
  } else {
    await (locator || page).screenshot({ animations: "disabled", path: screenshotPath });
  }
  await testInfo.attach(name, { contentType: "image/png", path: screenshotPath });
}

module.exports = {
  CUSTOM_COLORS,
  HIBISCUS,
  captureColorEvidence,
  expectPalette,
  readThumbColors,
  rgb,
  setFixtureTheme,
};
