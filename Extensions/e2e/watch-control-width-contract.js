const { expect } = require("@playwright/test");

const WATCH_CONTROL_LAYOUTS = [
  { name: "inline", inline: true, padded: false },
  { name: "block", inline: false, padded: false },
  { name: "padded block", inline: false, padded: true },
];

async function installWatchControlLayout(context, { inline, padded = false }) {
  await context.addInitScript(
    ({ inlineControls, paddedControls }) => {
      if (location.hostname !== "www.youtube.com") return;
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          const style = document.createElement("style");
          style.textContent = `
          :root {
            --fixture-like-width: ${inlineControls || paddedControls ? "103.5px" : "96px"};
            --fixture-dislike-width: ${inlineControls || paddedControls ? "91.25px" : "96px"};
          }
          #top-level-buttons-computed,
          [data-fixture-smartimation-content] { width: 320px; }
          [data-fixture-smartimation-content] {
            display: ${inlineControls ? "block" : "flex"};
            font-size: 0;
            white-space: nowrap;
          }
          #top-level-buttons-computed like-button-view-model,
          #top-level-buttons-computed dislike-button-view-model {
            display: ${inlineControls ? "inline" : "block"};
            flex: 0 0 auto;
            font-size: 14px;
            height: auto;
            ${paddedControls ? "box-sizing: content-box; padding: 0 7px; border: 3px solid transparent;" : ""}
          }
          #top-level-buttons-computed like-button-view-model { width: ${inlineControls ? "auto" : "var(--fixture-like-width)"}; }
          #top-level-buttons-computed dislike-button-view-model { width: ${inlineControls ? "auto" : "var(--fixture-dislike-width)"}; }
          #top-level-buttons-computed like-button-view-model toggle-button-view-model,
          #top-level-buttons-computed dislike-button-view-model toggle-button-view-model,
          #top-level-buttons-computed like-button-view-model button-view-model,
          #top-level-buttons-computed dislike-button-view-model button-view-model { display: inline; }
          #top-level-buttons-computed like-button-view-model button {
            min-width: var(--fixture-like-width);
            width: var(--fixture-like-width);
          }
          #top-level-buttons-computed dislike-button-view-model button {
            min-width: var(--fixture-dislike-width);
            width: var(--fixture-dislike-width);
          }
        `;
          document.head.append(style);
          const marker = document.createElement("div");
          marker.id = "comment-teaser";
          marker.hidden = true;
          document.body.append(marker);
        },
        { once: true },
      );
    },
    { inlineControls: inline, paddedControls: padded },
  );
}

async function readWatchControlWidths(page, { container, bar }) {
  return page.evaluate(
    ({ containerSelector, barSelector }) => {
      const required = (selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing width-contract element: ${selector}`);
        return element;
      };
      const control = (selector) => {
        const element = required(`[data-fixture-smartimation-content] ${selector}`);
        return {
          clientWidth: element.clientWidth,
          computedWidth: getComputedStyle(element).width,
          display: getComputedStyle(element).display,
          width: element.getBoundingClientRect().width,
        };
      };
      const wrapper = required(".ryd-tooltip");
      const track = required(containerSelector);
      const fill = required(barSelector);
      return {
        dislike: control("dislike-button-view-model"),
        fillWidth: fill.getBoundingClientRect().width,
        fillWidthStyle: fill.style.width,
        like: control("like-button-view-model"),
        trackHeight: track.getBoundingClientRect().height,
        trackWidth: track.getBoundingClientRect().width,
        wrapperWidth: wrapper.getBoundingClientRect().width,
        wrapperWidthStyle: wrapper.style.width,
      };
    },
    { containerSelector: container, barSelector: bar },
  );
}

async function expectWatchControlWidths(page, profile, { inline, padded = false, likes, dislikes }) {
  let geometry = await readWatchControlWidths(page, profile);
  for (const control of [geometry.like, geometry.dislike]) {
    expect(control.width).toBeGreaterThan(0);
    if (inline) {
      expect(control).toMatchObject({ clientWidth: 0, computedWidth: "auto", display: "inline" });
    } else {
      expect(control.display).toBe("block");
      expect(Number.parseFloat(control.computedWidth)).toBeGreaterThan(0);
      expect(control.clientWidth).toBeGreaterThan(0);
      if (padded) {
        expect(control.clientWidth).toBeGreaterThan(Number.parseFloat(control.computedWidth));
        expect(control.width).toBeGreaterThan(control.clientWidth);
      }
    }
  }
  const controlWidth = (control) => {
    if (inline) return control.width;
    return profile.controlWidth === "clientWidth" ? control.clientWidth : Number.parseFloat(control.computedWidth);
  };
  const expectedControlWidth = (snapshot) => controlWidth(snapshot.like) + controlWidth(snapshot.dislike);
  await expect
    .poll(async () => {
      const snapshot = await readWatchControlWidths(page, profile);
      return Math.abs(snapshot.wrapperWidth - expectedControlWidth(snapshot));
    })
    .toBeLessThan(0.1);

  geometry = await readWatchControlWidths(page, profile);
  const expectedWidth = expectedControlWidth(geometry);
  expect(Number.parseFloat(geometry.wrapperWidthStyle)).toBeCloseTo(expectedWidth, 1);
  expect(geometry.wrapperWidth).toBeCloseTo(expectedWidth, 1);
  expect(geometry.trackWidth).toBeCloseTo(expectedWidth, 1);
  expect(geometry.trackHeight).toBeGreaterThan(0);
  expect(Number.isFinite(Number.parseFloat(geometry.fillWidthStyle))).toBe(true);
  expect(geometry.fillWidth).toBeGreaterThan(0);
  expect(geometry.fillWidth / geometry.trackWidth).toBeCloseTo(likes / (likes + dislikes), 2);
  return geometry;
}

async function widenWatchControls(page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--fixture-like-width", "124px");
    document.documentElement.style.setProperty("--fixture-dislike-width", "108px");
  });
}

module.exports = {
  WATCH_CONTROL_LAYOUTS,
  expectWatchControlWidths,
  installWatchControlLayout,
  widenWatchControls,
};
