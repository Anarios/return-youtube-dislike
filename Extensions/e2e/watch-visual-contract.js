const { expect } = require("@playwright/test");
const { WATCH_REACTION_TRANSITIONS, WATCH_VISUAL_VIEWPORTS } = require("./watch-visual-scenarios");

const EXTENSION_WATCH_VISUAL_PROFILE = Object.freeze({
  bar: "#ryd-bar",
  container: "#ryd-bar-container",
  dislikeText: ".ytSpecButtonShapeNextButtonTextContent",
  initialNativeDislikeTextContainers: 0,
  likeText: "#text",
  roleAttribute: "data-fixture-role",
  tooltip: "#ryd-dislike-tooltip",
  tooltipDescription: null,
  wrapper: ".ryd-tooltip",
});

const USERSCRIPT_WATCH_VISUAL_PROFILE = Object.freeze({
  bar: "#return-youtube-dislike-bar",
  container: "#return-youtube-dislike-bar-container",
  dislikeText: "#text",
  initialNativeDislikeTextContainers: 1,
  likeText: "#text",
  roleAttribute: "data-ryd-role",
  tooltip: "#ryd-dislike-tooltip",
  tooltipAppearance: Object.freeze({
    fontSize: "12px",
    lineHeight: "16px",
    opacity: "0",
    padding: Object.freeze(["6px", "8px", "6px", "8px"]),
    position: "absolute",
    visibility: "hidden",
  }),
  tooltipDescription: "ryd-dislike-tooltip",
  wrapper: ".ryd-tooltip",
});

async function readWatchVisualContract(page, profile) {
  return page.evaluate((selectors) => {
    const required = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing visual-contract element: ${selector}`);
      return element;
    };
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      };
    };
    const box = (element) => {
      const style = getComputedStyle(element);
      return {
        margin: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft],
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      };
    };
    const visibility = (element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        display: style.display,
        opacity: Number(style.opacity),
        rendered: bounds.width > 0 && bounds.height > 0,
        visibility: style.visibility,
      };
    };
    const control = (role) => {
      const roleSelector = `[${selectors.roleAttribute}="${role}"]`;
      const outer = required(roleSelector);
      const button = required(`${roleSelector} button`);
      const icon = required(`${roleSelector} [data-fixture-icon]`);
      const text = required(`${roleSelector} ${selectors[`${role}Text`]}`);
      const buttonStyle = getComputedStyle(button);
      const center = {
        x: button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2,
        y: button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2,
      };
      const hitTarget = document.elementFromPoint(center.x, center.y);
      return {
        ariaPressed: button.getAttribute("aria-pressed"),
        backgroundColor: buttonStyle.backgroundColor,
        button: rect(button),
        buttonBox: box(button),
        buttonVisibility: visibility(button),
        classes: [...outer.classList].sort(),
        color: buttonStyle.color,
        icon: rect(icon),
        iconBox: box(icon),
        iconVisibility: visibility(icon),
        hitTargetOwnedByButton: hitTarget === button || button.contains(hitTarget),
        outer: rect(outer),
        outerBox: box(outer),
        text: rect(text),
        textBox: box(text),
        textContent: text.textContent.replace(/\s+/g, " ").trim(),
        textOwnedByButton: button.contains(text),
        textVisibility: visibility(text),
      };
    };

    const surface = required("#top-level-buttons-computed");
    const reactionGroup = required(`[${selectors.roleAttribute}="buttons"]`);
    const likeOuter = required(`[${selectors.roleAttribute}="like"]`);
    const dislikeOuter = required(`[${selectors.roleAttribute}="dislike"]`);
    const smartimation = required(`[${selectors.roleAttribute}="buttons"] > yt-smartimation`);
    const smartimationContentShell = required("[data-fixture-smartimation-content-shell]");
    const smartimationContent = required("[data-fixture-smartimation-content]");
    const topRow = required("#top-row");
    const unrelatedActions = required("#flexible-item-buttons");
    const currentVideoId = new URL(location.href).searchParams.get("v");
    const watchRoot = surface.closest("ytd-watch-flexy, ytd-watch-grid");
    const wrapper = required(selectors.wrapper);
    const barContainer = required(selectors.container);
    const bar = required(selectors.bar);
    const tooltip = required(selectors.tooltip);
    const reactionGroupStyle = getComputedStyle(reactionGroup);
    const surfaceStyle = getComputedStyle(surface);
    const topRowStyle = getComputedStyle(topRow);
    const barStyle = getComputedStyle(bar);
    const barContainerStyle = getComputedStyle(barContainer);
    const tooltipStyle = getComputedStyle(tooltip);
    const wrapperStyle = getComputedStyle(wrapper);
    const actionSurfaces = [...document.querySelectorAll("#top-level-buttons-computed")];
    const visibleActionSurfaces = actionSurfaces.filter((candidate) => visibility(candidate).rendered);
    const zeroWidthActionSurfaces = actionSurfaces.filter((candidate) => candidate.getBoundingClientRect().width === 0);
    const commentActionSurfaces = [...document.querySelectorAll("[data-fixture-comment-action-surface]")];

    return {
      bar: rect(bar),
      barAppearance: {
        backgroundColor: barStyle.backgroundColor,
        borderRadius: barStyle.borderRadius,
      },
      barContainer: rect(barContainer),
      barContainerAppearance: {
        backgroundColor: barContainerStyle.backgroundColor,
        borderRadius: barContainerStyle.borderRadius,
      },
      barVisibility: visibility(bar),
      bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      buttons: rect(surface),
      buttonsBox: box(surface),
      buttonsGap: reactionGroupStyle.gap,
      buttonsPosition: surfaceStyle.position,
      commentActionSurfaces: {
        bars: commentActionSurfaces.reduce(
          (total, candidate) => total + candidate.querySelectorAll(selectors.bar).length,
          0,
        ),
        dislikeTextContainers: commentActionSurfaces.reduce(
          (total, candidate) =>
            total +
            candidate.querySelectorAll(
              "[data-fixture-comment-dislike] #text, " +
                "[data-fixture-comment-dislike] [role='text'], " +
                "[data-fixture-comment-dislike] .yt-spec-button-shape-next__button-text-content, " +
                "[data-fixture-comment-dislike] .ytSpecButtonShapeNextButtonTextContent",
            ).length,
          0,
        ),
        reactionPairs: commentActionSurfaces.filter(
          (candidate) =>
            candidate.querySelector("[data-fixture-comment-like] button") &&
            candidate.querySelector("[data-fixture-comment-dislike] button"),
        ).length,
        surfaces: commentActionSurfaces.length,
        wrappers: commentActionSurfaces.reduce(
          (total, candidate) => total + candidate.querySelectorAll(selectors.wrapper).length,
          0,
        ),
        zeroWidth: commentActionSurfaces.filter((candidate) => candidate.getBoundingClientRect().width === 0).length,
      },
      documentScrollWidth: document.documentElement.scrollWidth,
      dislike: control("dislike"),
      fixtureBaseline: {
        initialDislikeTextContainers: globalThis.__youtubeFixture?.initialDislikeTextContainers ?? null,
      },
      like: control("like"),
      ownership: {
        actionSurfaceOwnedByCurrentWatch: watchRoot?.getAttribute("video-id") === currentVideoId,
        barOwnedByButtons: surface.contains(barContainer),
        nativeControlsOwnedByReactionGroup:
          reactionGroup.contains(likeOuter.querySelector("button")) &&
          reactionGroup.contains(dislikeOuter.querySelector("button")),
        reactionControlsOwnedByGroup:
          smartimationContent.contains(likeOuter) &&
          smartimationContent.contains(dislikeOuter) &&
          likeOuter.closest("yt-smartimation") === smartimation &&
          dislikeOuter.closest("yt-smartimation") === smartimation,
        reactionGroupOwnedByButtons: reactionGroup.parentElement === surface,
        topRowOwnedByCurrentWatch: topRow.closest("ytd-watch-flexy, ytd-watch-grid") === watchRoot,
        tooltipDescribedBy: wrapper.getAttribute("aria-describedby"),
        tooltipOwnedByButtons: surface.contains(tooltip),
        tooltipRole: tooltip.getAttribute("role"),
        wrapperOwnedByButtons: wrapper.parentElement === surface,
      },
      reactionGroup: rect(reactionGroup),
      reactionGroupBox: box(reactionGroup),
      smartimationTopology: {
        dislikeNestedButton:
          dislikeOuter.querySelector("toggle-button-view-model > button-view-model > button") !== null,
        likeBeforeDislike:
          likeOuter.parentElement === dislikeOuter.parentElement && likeOuter.nextElementSibling === dislikeOuter,
        likeNestedButton: likeOuter.querySelector("toggle-button-view-model > button-view-model > button") !== null,
        smartimationContentOwnedByShell: smartimationContent.parentElement === smartimationContentShell,
        smartimationDirectChild: smartimation.parentElement === reactionGroup,
        smartimationShellOwnedBySmartimation: smartimationContentShell.parentElement === smartimation,
      },
      topRow: rect(topRow),
      topRowBox: box(topRow),
      topRowStyle: {
        borderBottomWidth: topRowStyle.borderBottomWidth,
        paddingBottom: topRowStyle.paddingBottom,
      },
      tooltipText: tooltip.textContent.replace(/\s+/g, " ").trim(),
      tooltipAppearance: {
        fontSize: tooltipStyle.fontSize,
        lineHeight: tooltipStyle.lineHeight,
        opacity: tooltipStyle.opacity,
        padding: box(tooltip).padding,
        position: tooltipStyle.position,
        visibility: tooltipStyle.visibility,
      },
      unique: {
        actionSurfaces: document.querySelectorAll("#top-level-buttons-computed").length,
        bars: document.querySelectorAll(selectors.bar).length,
        containers: document.querySelectorAll(selectors.container).length,
        dislikeControls: document.querySelectorAll(`[${selectors.roleAttribute}="dislike"]`).length,
        likeControls: document.querySelectorAll(`[${selectors.roleAttribute}="like"]`).length,
        tooltips: document.querySelectorAll(selectors.tooltip).length,
        visibleActionSurfaces: visibleActionSurfaces.length,
        watchRoots: document.querySelectorAll("ytd-watch-flexy, ytd-watch-grid").length,
        wrappers: document.querySelectorAll(selectors.wrapper).length,
        zeroWidthActionSurfaces: zeroWidthActionSurfaces.length,
      },
      unrelatedActions: {
        labels: [...unrelatedActions.querySelectorAll("span[role='text']")].map((element) =>
          element.textContent.trim(),
        ),
        ownedBars: unrelatedActions.querySelectorAll(selectors.bar).length,
        visibility: visibility(unrelatedActions),
      },
      viewport: { height: innerHeight, width: innerWidth },
      wrapper: rect(wrapper),
      wrapperAppearance: {
        box: box(wrapper),
        position: wrapperStyle.position,
      },
      wrapperVisibility: visibility(wrapper),
    };
  }, profile);
}

function expectClose(actual, expected, precision = 5) {
  expect(actual).toBeCloseTo(expected, precision);
}

function parseComputedColor(value) {
  const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgb) return srgb.slice(1).map((channel) => Number(channel) * 255);
  const rgb = value.match(/^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
  if (rgb) return rgb.slice(1).map(Number);
  throw new Error(`Unsupported computed color: ${value}`);
}

function relativeLuminance(color) {
  const channels = parseComputedColor(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
}

function expectComputedColor(actual, expectedChannel) {
  const channels = parseComputedColor(actual);
  expect(channels).toHaveLength(3);
  channels.forEach((channel) => expect(channel).toBeCloseTo(expectedChannel, 0));
}

function expectControlGeometry(control) {
  expectClose(control.outer.width, 96);
  expectClose(control.outer.height, 36);
  expectClose(control.button.width, 96);
  expectClose(control.button.height, 36);
  expect(control.outerBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });
  expect(control.buttonBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "12px", "0px", "12px"],
  });
  expect(control.iconBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });
  expect(control.textBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });
  expectClose(control.icon.width, 20);
  expectClose(control.icon.height, 20);
  expectClose(control.icon.top + control.icon.height / 2, control.button.top + control.button.height / 2);
  expectClose(control.text.top + control.text.height / 2, control.button.top + control.button.height / 2);
  expectClose(control.text.left - control.icon.right, 6);
  expect(control.buttonVisibility).toEqual({
    display: "inline-flex",
    opacity: 1,
    rendered: true,
    visibility: "visible",
  });
  expect(control.iconVisibility).toMatchObject({ opacity: 1, rendered: true, visibility: "visible" });
  expect(control.textVisibility).toMatchObject({ opacity: 1, rendered: true, visibility: "visible" });
}

function expectPressedState(control, pressed) {
  expect(control.ariaPressed).toBe(String(pressed));
  expect(control.classes).toEqual([pressed ? "style-default-active" : "style-text"]);
  expect(control.backgroundColor).toBe(pressed ? "rgb(241, 241, 241)" : "rgb(39, 39, 39)");
  expect(control.color).toBe(pressed ? "rgb(15, 15, 15)" : "rgb(241, 241, 241)");
}

function expectWatchVisualState(snapshot, state, counts, viewport, profile, { assertTooltipText = true } = {}) {
  expect(snapshot.viewport).toEqual({ height: viewport.height, width: viewport.width });
  expect(snapshot.documentScrollWidth).toBeLessThanOrEqual(snapshot.viewport.width);
  expect(snapshot.fixtureBaseline.initialDislikeTextContainers).toBe(profile.initialNativeDislikeTextContainers);
  expect(snapshot.commentActionSurfaces).toEqual({
    bars: 0,
    dislikeTextContainers: 0,
    reactionPairs: 20,
    surfaces: 20,
    wrappers: 0,
    zeroWidth: 20,
  });
  expect(snapshot.unique).toEqual({
    actionSurfaces: 21,
    bars: 1,
    containers: 1,
    dislikeControls: 1,
    likeControls: 1,
    tooltips: 1,
    visibleActionSurfaces: 1,
    watchRoots: 1,
    wrappers: 1,
    zeroWidthActionSurfaces: 20,
  });
  expect(snapshot.ownership).toEqual({
    actionSurfaceOwnedByCurrentWatch: true,
    barOwnedByButtons: true,
    nativeControlsOwnedByReactionGroup: true,
    reactionControlsOwnedByGroup: true,
    reactionGroupOwnedByButtons: true,
    topRowOwnedByCurrentWatch: true,
    tooltipDescribedBy: profile.tooltipDescription,
    tooltipOwnedByButtons: true,
    tooltipRole: "tooltip",
    wrapperOwnedByButtons: true,
  });
  expect(snapshot.smartimationTopology).toEqual({
    dislikeNestedButton: true,
    likeBeforeDislike: true,
    likeNestedButton: true,
    smartimationContentOwnedByShell: true,
    smartimationDirectChild: true,
    smartimationShellOwnedBySmartimation: true,
  });
  expect(snapshot.unrelatedActions).toMatchObject({ labels: ["Save", "Download"], ownedBars: 0 });
  expect(snapshot.unrelatedActions.visibility).toMatchObject({ opacity: 1, rendered: true, visibility: "visible" });
  if (assertTooltipText) expect(snapshot.tooltipText).toBe(`${counts.likes} / ${counts.dislikes}`);
  if (profile.tooltipAppearance) expect(snapshot.tooltipAppearance).toEqual(profile.tooltipAppearance);
  expect(snapshot.like.textContent).toBe(String(counts.likes));
  expect(snapshot.dislike.textContent).toBe(String(counts.dislikes));
  expect(snapshot.buttonsGap).toBe("0px");
  expect(snapshot.buttonsPosition).toBe("relative");
  expect(snapshot.buttonsBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });
  expect(snapshot.reactionGroupBox).toEqual(snapshot.buttonsBox);
  expect(snapshot.topRowBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "10px", "0px"],
  });
  expect(snapshot.topRowStyle).toEqual({ borderBottomWidth: "1px", paddingBottom: "10px" });
  expect(snapshot.wrapperAppearance).toEqual({
    box: {
      margin: ["0px", "0px", "0px", "0px"],
      padding: ["0px", "0px", "0px", "0px"],
    },
    position: "absolute",
  });
  expect(snapshot.wrapperVisibility).toEqual({ display: "block", opacity: 1, rendered: true, visibility: "visible" });
  expect(snapshot.barVisibility).toEqual({ display: "block", opacity: 1, rendered: true, visibility: "visible" });
  expect(snapshot.barContainerAppearance.borderRadius).toBe("2px");
  expectComputedColor(snapshot.barContainerAppearance.backgroundColor, 139);
  expect(snapshot.barAppearance).toEqual({
    backgroundColor: "rgb(241, 241, 241)",
    borderRadius: "2px",
  });
  expect(contrastRatio(snapshot.barContainerAppearance.backgroundColor, snapshot.bodyBackgroundColor)).toBeGreaterThan(
    4.5,
  );
  expect(
    contrastRatio(snapshot.barAppearance.backgroundColor, snapshot.barContainerAppearance.backgroundColor),
  ).toBeGreaterThan(2.5);

  expectControlGeometry(snapshot.like);
  expectControlGeometry(snapshot.dislike);
  expect(snapshot.like.hitTargetOwnedByButton).toBe(true);
  expect(snapshot.dislike.hitTargetOwnedByButton).toBe(true);
  expect(snapshot.like.textOwnedByButton).toBe(true);
  expect(snapshot.dislike.textOwnedByButton).toBe(true);
  expectPressedState(snapshot.like, state === "liked");
  expectPressedState(snapshot.dislike, state === "disliked");

  expectClose(snapshot.like.outer.right, snapshot.dislike.outer.left);
  expectClose(snapshot.wrapper.left, snapshot.like.outer.left);
  expectClose(snapshot.wrapper.right, snapshot.dislike.outer.right);
  expectClose(snapshot.wrapper.width, snapshot.like.outer.width + snapshot.dislike.outer.width);
  expectClose(snapshot.wrapper.height, 2);
  expectClose(snapshot.wrapper.top - Math.max(snapshot.like.outer.bottom, snapshot.dislike.outer.bottom), 8);
  expectClose(snapshot.barContainer.width, snapshot.wrapper.width);
  expectClose(snapshot.barContainer.height, 2);
  expectClose(snapshot.bar.height, 2);
  expectClose(snapshot.bar.width / snapshot.barContainer.width, counts.likes / (counts.likes + counts.dislikes), 3);
  expect(snapshot.barContainer.width - snapshot.bar.width).toBeGreaterThan(24);
  expect(snapshot.topRow.left).toBeGreaterThanOrEqual(0);
  expect(snapshot.topRow.right).toBeLessThanOrEqual(snapshot.viewport.width);
  expect(snapshot.wrapper.left).toBeGreaterThanOrEqual(snapshot.topRow.left);
  expect(snapshot.wrapper.right).toBeLessThanOrEqual(snapshot.topRow.right);
}

function expectNoStructuralLayoutShift(before, after) {
  const paths = [
    ["topRow"],
    ["buttons"],
    ["reactionGroup"],
    ["wrapper"],
    ["barContainer"],
    ["like", "outer"],
    ["like", "button"],
    ["dislike", "outer"],
    ["dislike", "button"],
  ];
  const dimensions = ["top", "right", "bottom", "left", "width", "height"];
  for (const path of paths) {
    const beforeRect = path.reduce((value, key) => value[key], before);
    const afterRect = path.reduce((value, key) => value[key], after);
    for (const dimension of dimensions) {
      expect(
        Math.abs(afterRect[dimension] - beforeRect[dimension]),
        `${path.join(".")}.${dimension}`,
      ).toBeLessThanOrEqual(0.25);
    }
  }
}

async function waitForBarRatio(page, counts, profile) {
  const expectedRatio = counts.likes / (counts.likes + counts.dislikes);
  await expect
    .poll(() =>
      page.locator(profile.bar).evaluate((bar) => {
        const container = bar.parentElement;
        return bar.getBoundingClientRect().width / container.getBoundingClientRect().width;
      }),
    )
    .toBeCloseTo(expectedRatio, 3);
}

async function attachVisualFailureScreenshot(testInfo, page, name) {
  let body;
  try {
    const scope = page.locator("#top-row");
    body = (await scope.count()) > 0 ? await scope.screenshot({ animations: "disabled" }) : await page.screenshot();
  } catch {
    body = await page.screenshot().catch(() => null);
  }
  if (body) await testInfo.attach(`${name}-visual-contract-failure`, { body, contentType: "image/png" });
}

module.exports = {
  EXTENSION_WATCH_VISUAL_PROFILE,
  USERSCRIPT_WATCH_VISUAL_PROFILE,
  WATCH_REACTION_TRANSITIONS,
  WATCH_VISUAL_VIEWPORTS,
  attachVisualFailureScreenshot,
  contrastRatio,
  expectNoStructuralLayoutShift,
  expectWatchVisualState,
  readWatchVisualContract,
  waitForBarRatio,
};
