const { expect } = require("@playwright/test");

const SHORTS_ACTION_ORDER = Object.freeze(["like", "dislike", "comments", "share", "remix", "sound"]);
const OWNED_DISLIKE_SELECTOR = "[data-ryd-synthetic-shorts-dislike]";

function expectClose(actual, expected, tolerance = 0.25) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectBox(box, width, height) {
  expectClose(box.width, width);
  expectClose(box.height, height);
}

function expectVisible(visibility) {
  expect(visibility).toMatchObject({
    intersectsViewport: true,
    opacity: 1,
    rendered: true,
    visibility: "visible",
  });
  expect(visibility.display).not.toBe("none");
}

function expectZeroBox(box) {
  expect(box).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });
}

async function readExtensionShortsVisualContract(page, videoId) {
  return page.evaluate(
    ({ expectedVideoId, ownedDislikeSelector }) => {
      const required = (root, selector) => {
        const element = root.querySelector(selector);
        if (!element) throw new Error(`Missing Shorts visual-contract element: ${selector}`);
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
          intersectsViewport:
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < innerHeight &&
            bounds.left < innerWidth,
          opacity: Number(style.opacity),
          rendered: bounds.width > 0 && bounds.height > 0,
          visibility: style.visibility,
        };
      };
      const actionName = (host) => {
        if (host.matches('[data-fixture-role="like"]')) return "like";
        if (host.matches(ownedDislikeSelector)) return "dislike";
        return host.getAttribute("data-fixture-control");
      };
      const readReaction = (actionBar, role) => {
        const hostSelector =
          role === "dislike" ? `:scope > ${ownedDislikeSelector}` : ':scope > [data-fixture-role="like"]';
        const host = required(actionBar, hostSelector);
        const slot = required(host, ":scope > label");
        const button = required(slot, ":scope > button");
        const icon = required(button, ".ytSpecButtonShapeNextIcon");
        const svg = required(icon, "svg");
        const label = required(slot, ".ytSpecButtonShapeWithLabelLabel");
        const text = required(label, "#text");
        const hostStyle = getComputedStyle(host);
        const slotStyle = getComputedStyle(slot);
        const labelStyle = getComputedStyle(label);
        const buttonBounds = button.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(
          buttonBounds.left + buttonBounds.width / 2,
          buttonBounds.top + buttonBounds.height / 2,
        );
        return {
          button: rect(button),
          buttonBox: box(button),
          buttonVisibility: visibility(button),
          host: rect(host),
          hostBox: box(host),
          hostContentSize: { height: hostStyle.height, width: hostStyle.width },
          hostVisibility: visibility(host),
          hitTargetOwnedByButton: hitTarget === button || button.contains(hitTarget),
          icon: rect(icon),
          iconBox: box(icon),
          iconVisibility: visibility(icon),
          label: rect(label),
          labelBox: box(label),
          labelStyle: {
            alignItems: labelStyle.alignItems,
            fontSize: labelStyle.fontSize,
            justifyContent: labelStyle.justifyContent,
            lineHeight: labelStyle.lineHeight,
          },
          labelVisibility: visibility(label),
          slot: rect(slot),
          slotBox: box(slot),
          slotStyle: {
            alignItems: slotStyle.alignItems,
            display: slotStyle.display,
            flexDirection: slotStyle.flexDirection,
          },
          slotVisibility: visibility(slot),
          svg: rect(svg),
          svgBox: box(svg),
          svgVisibility: visibility(svg),
          text: rect(text),
          textContent: text.textContent.replace(/\s+/g, " ").trim(),
          textOwnedByLabel: label.contains(text),
          textVisibility: visibility(text),
        };
      };

      const renderer = document.querySelector(
        `ytd-reel-video-renderer[video-id="${CSS.escape(expectedVideoId)}"][is-active]`,
      );
      if (!renderer) throw new Error(`Missing active Shorts renderer for ${expectedVideoId}.`);
      const actionBar = required(renderer, "reel-action-bar-view-model");
      const actionHosts = [...actionBar.children];
      const rendererLink = required(renderer, ":scope > a[href*='/shorts/']");
      const sequence = renderer.closest(".reel-video-in-sequence-new");
      const allRenderers = [...document.querySelectorAll("ytd-reel-video-renderer")];

      return {
        actionBar: rect(actionBar),
        actionBarBox: box(actionBar),
        actionBarVisibility: visibility(actionBar),
        actions: actionHosts.map((host) => {
          const slot = required(host, ":scope > label");
          const button = required(slot, ":scope > button");
          const icon = required(button, ".ytSpecButtonShapeNextIcon");
          const svg = required(icon, "svg");
          const graphic = required(svg, "path");
          const label = required(slot, ".ytSpecButtonShapeWithLabelLabel");
          const text = required(label, "[role='text']");
          const hostStyle = getComputedStyle(host);
          const slotStyle = getComputedStyle(slot);
          const labelStyle = getComputedStyle(label);
          return {
            button: rect(button),
            buttonBox: box(button),
            buttonVisibility: visibility(button),
            host: rect(host),
            hostBox: box(host),
            hostContentSize: { height: hostStyle.height, width: hostStyle.width },
            hostVisibility: visibility(host),
            hitTargetOwnedByButton: (() => {
              const bounds = button.getBoundingClientRect();
              const hitTarget = document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
              );
              return hitTarget === button || button.contains(hitTarget);
            })(),
            graphic: {
              bounds: { height: graphic.getBBox().height, width: graphic.getBBox().width },
              fill: getComputedStyle(graphic).fill,
            },
            icon: rect(icon),
            iconBox: box(icon),
            iconVisibility: visibility(icon),
            label: rect(label),
            labelBox: box(label),
            labelStyle: {
              alignItems: labelStyle.alignItems,
              fontSize: labelStyle.fontSize,
              justifyContent: labelStyle.justifyContent,
              lineHeight: labelStyle.lineHeight,
            },
            labelVisibility: visibility(label),
            name: actionName(host),
            slot: rect(slot),
            slotBox: box(slot),
            slotStyle: {
              alignItems: slotStyle.alignItems,
              display: slotStyle.display,
              flexDirection: slotStyle.flexDirection,
            },
            slotVisibility: visibility(slot),
            svg: rect(svg),
            svgBox: box(svg),
            svgVisibility: visibility(svg),
            text: rect(text),
            textContent: text.textContent.replace(/\s+/g, " ").trim(),
            textOwnedByLabel: label.contains(text),
            textVisibility: visibility(text),
          };
        }),
        dislike: readReaction(actionBar, "dislike"),
        documentScrollWidth: document.documentElement.scrollWidth,
        fixtureBaseline: {
          renderedDesktopShortsNativeDislikes:
            globalThis.__navigationFixtureBaseline?.renderedDesktopShortsNativeDislikes ?? null,
        },
        identity: {
          actionBarOwnedByRenderer: actionBar.parentElement === renderer,
          currentPathname: location.pathname,
          expectedVideoId,
          rendererLinkPathname: new URL(rendererLink.href, location.href).pathname,
          rendererVideoId: renderer.getAttribute("video-id"),
          sequenceVideoId: sequence?.getAttribute("data-fixture-sequence-video-id") ?? null,
          sequenceOwnedByShorts: sequence?.closest("ytd-shorts") !== null,
        },
        like: readReaction(actionBar, "like"),
        renderer: rect(renderer),
        renderers: allRenderers.map((candidate) => ({
          actionBars: candidate.querySelectorAll("reel-action-bar-view-model").length,
          active: candidate.hasAttribute("is-active"),
          nativeDislikes: candidate.querySelectorAll(
            `reel-action-bar-view-model > dislike-button-view-model:not(${ownedDislikeSelector})`,
          ).length,
          ownedDislikes: candidate.querySelectorAll(`reel-action-bar-view-model > ${ownedDislikeSelector}`).length,
          videoId: candidate.getAttribute("video-id"),
          visibility: visibility(candidate),
        })),
        rendererVisibility: visibility(renderer),
        unique: {
          activeRenderers: document.querySelectorAll("ytd-reel-video-renderer[is-active]").length,
          bars: document.querySelectorAll("#ryd-bar").length,
          containers: document.querySelectorAll("#ryd-bar-container").length,
          currentActionBars: renderer.querySelectorAll("reel-action-bar-view-model").length,
          currentNativeDislikes: renderer.querySelectorAll(
            `reel-action-bar-view-model > dislike-button-view-model:not(${ownedDislikeSelector})`,
          ).length,
          currentOwnedDislikes: renderer.querySelectorAll(`reel-action-bar-view-model > ${ownedDislikeSelector}`)
            .length,
          currentLikes: renderer.querySelectorAll('[data-fixture-role="like"]').length,
          renderers: allRenderers.length,
          tooltips: document.querySelectorAll("#ryd-dislike-tooltip").length,
          visibleActionBars: [...document.querySelectorAll("reel-action-bar-view-model")].filter(
            (candidate) => visibility(candidate).intersectsViewport && visibility(candidate).display !== "none",
          ).length,
          visibleOwnedDislikes: [...document.querySelectorAll(ownedDislikeSelector)].filter(
            (candidate) => visibility(candidate).intersectsViewport && visibility(candidate).display !== "none",
          ).length,
          wrappers: document.querySelectorAll(".ryd-tooltip").length,
        },
        viewport: { height: innerHeight, width: innerWidth },
      };
    },
    { expectedVideoId: videoId, ownedDislikeSelector: OWNED_DISLIKE_SELECTOR },
  );
}

function expectReactionGeometry(reaction, count) {
  expectBox(reaction.host, 48, 78);
  expect(reaction.hostContentSize).toEqual({ height: "70px", width: "48px" });
  expect(reaction.hostBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "8px", "0px"],
  });
  expectBox(reaction.slot, 48, 70);
  expectZeroBox(reaction.slotBox);
  expect(reaction.slotStyle).toEqual({ alignItems: "center", display: "flex", flexDirection: "column" });
  expectBox(reaction.button, 48, 48);
  expect(reaction.buttonBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["12px", "12px", "12px", "12px"],
  });
  expectBox(reaction.icon, 24, 24);
  expectBox(reaction.svg, 24, 24);
  expectZeroBox(reaction.iconBox);
  expectZeroBox(reaction.svgBox);
  expectBox(reaction.label, 48, 22);
  expectZeroBox(reaction.labelBox);
  expect(reaction.labelStyle).toEqual({
    alignItems: "center",
    fontSize: "12px",
    justifyContent: "center",
    lineHeight: "18px",
  });
  expect(reaction.textContent).toBe(String(count));
  expect(reaction.hitTargetOwnedByButton).toBe(true);
  expect(reaction.textOwnedByLabel).toBe(true);

  for (const item of [
    reaction.hostVisibility,
    reaction.slotVisibility,
    reaction.buttonVisibility,
    reaction.iconVisibility,
    reaction.svgVisibility,
    reaction.labelVisibility,
    reaction.textVisibility,
  ]) {
    expectVisible(item);
  }

  const centerX = reaction.host.left + reaction.host.width / 2;
  for (const item of [reaction.slot, reaction.button, reaction.icon, reaction.svg, reaction.label, reaction.text]) {
    expectClose(item.left + item.width / 2, centerX);
  }
  expectClose(reaction.icon.top + reaction.icon.height / 2, reaction.button.top + reaction.button.height / 2);
  expectClose(reaction.svg.top + reaction.svg.height / 2, reaction.button.top + reaction.button.height / 2);
  expectClose(reaction.label.top, reaction.button.bottom);
}

function expectExtensionShortsVisualContract(snapshot, counts, viewport) {
  expect(snapshot.viewport).toEqual({ height: viewport.height, width: viewport.width });
  expect(snapshot.documentScrollWidth).toBeLessThanOrEqual(snapshot.viewport.width);
  expect(snapshot.fixtureBaseline.renderedDesktopShortsNativeDislikes).toBe(0);
  expect(snapshot.identity).toEqual({
    actionBarOwnedByRenderer: true,
    currentPathname: `/shorts/${snapshot.identity.expectedVideoId}`,
    expectedVideoId: snapshot.identity.expectedVideoId,
    rendererLinkPathname: `/shorts/${snapshot.identity.expectedVideoId}`,
    rendererVideoId: snapshot.identity.expectedVideoId,
    sequenceOwnedByShorts: true,
    sequenceVideoId: snapshot.identity.expectedVideoId,
  });
  expect(snapshot.unique).toEqual({
    activeRenderers: 1,
    bars: 0,
    containers: 0,
    currentActionBars: 1,
    currentNativeDislikes: 0,
    currentLikes: 1,
    currentOwnedDislikes: 1,
    renderers: 2,
    tooltips: 0,
    visibleActionBars: 1,
    visibleOwnedDislikes: 1,
    wrappers: 0,
  });
  expect(snapshot.renderers).toHaveLength(2);
  expect(snapshot.renderers.filter(({ active }) => active)).toHaveLength(1);
  expect(snapshot.renderers.filter(({ visibility }) => visibility.intersectsViewport)).toHaveLength(1);
  expect(snapshot.renderers.every(({ actionBars, nativeDislikes }) => actionBars === 1 && nativeDislikes === 0)).toBe(
    true,
  );
  expect(snapshot.renderers.find(({ active }) => active)).toMatchObject({
    ownedDislikes: 1,
    videoId: snapshot.identity.expectedVideoId,
  });
  expectVisible(snapshot.rendererVisibility);
  expectVisible(snapshot.actionBarVisibility);
  expect(snapshot.renderer.left).toBeGreaterThanOrEqual(0);
  expect(snapshot.renderer.right).toBeLessThanOrEqual(snapshot.viewport.width);
  expect(snapshot.actionBar.left).toBeGreaterThanOrEqual(snapshot.renderer.left);
  expect(snapshot.actionBar.right).toBeLessThanOrEqual(snapshot.renderer.right);
  expect(snapshot.actionBarBox).toEqual({
    margin: ["0px", "0px", "0px", "0px"],
    padding: ["0px", "0px", "0px", "0px"],
  });

  expect(snapshot.actions.map(({ name }) => name)).toEqual(SHORTS_ACTION_ORDER);
  expect(snapshot.actions.map(({ textContent }) => textContent)).toEqual([
    String(counts.likes),
    String(counts.dislikes),
    "12",
    "Share",
    "Remix",
    "Sound",
  ]);
  expect(snapshot.actions).toHaveLength(6);
  for (const [index, action] of snapshot.actions.entries()) {
    for (const item of [
      action.hostVisibility,
      action.slotVisibility,
      action.buttonVisibility,
      action.iconVisibility,
      action.svgVisibility,
      action.labelVisibility,
      action.textVisibility,
    ]) {
      expectVisible(item);
    }
    expectBox(action.host, 48, 78);
    expect(action.hostContentSize).toEqual({ height: "70px", width: "48px" });
    expect(action.hostBox).toEqual({
      margin: ["0px", "0px", "0px", "0px"],
      padding: ["0px", "0px", "8px", "0px"],
    });
    expectBox(action.slot, 48, 70);
    expectZeroBox(action.slotBox);
    expect(action.slotStyle).toEqual({ alignItems: "center", display: "flex", flexDirection: "column" });
    expectBox(action.button, 48, 48);
    expect(action.buttonBox).toEqual({
      margin: ["0px", "0px", "0px", "0px"],
      padding: ["12px", "12px", "12px", "12px"],
    });
    expectBox(action.icon, 24, 24);
    expectBox(action.svg, 24, 24);
    expect(action.graphic.bounds.width).toBeGreaterThan(8);
    expect(action.graphic.bounds.height).toBeGreaterThan(8);
    expect(action.graphic.fill).not.toBe("none");
    expect(action.graphic.fill).not.toBe("rgba(0, 0, 0, 0)");
    expect(action.hitTargetOwnedByButton).toBe(true);
    expectZeroBox(action.iconBox);
    expectZeroBox(action.svgBox);
    expectBox(action.label, 48, 22);
    expectZeroBox(action.labelBox);
    expect(action.labelStyle).toEqual({
      alignItems: "center",
      fontSize: "12px",
      justifyContent: "center",
      lineHeight: "18px",
    });
    expect(action.textOwnedByLabel).toBe(true);
    expectClose(action.host.left + action.host.width / 2, snapshot.actionBar.left + snapshot.actionBar.width / 2);
    const actionCenterX = action.host.left + action.host.width / 2;
    for (const item of [action.slot, action.button, action.icon, action.svg, action.label, action.text]) {
      expectClose(item.left + item.width / 2, actionCenterX);
    }
    expectClose(action.icon.top + action.icon.height / 2, action.button.top + action.button.height / 2);
    expectClose(action.svg.top + action.svg.height / 2, action.button.top + action.button.height / 2);
    expectClose(action.label.top, action.button.bottom);
    expect(action.host.left).toBeGreaterThanOrEqual(0);
    expect(action.host.right).toBeLessThanOrEqual(snapshot.viewport.width);
    if (index > 0) expectClose(action.host.top, snapshot.actions[index - 1].host.bottom);
  }

  expectReactionGeometry(snapshot.like, counts.likes);
  expectReactionGeometry(snapshot.dislike, counts.dislikes);
  expectClose(snapshot.dislike.host.top, snapshot.like.host.bottom);
}

module.exports = {
  SHORTS_ACTION_ORDER,
  expectExtensionShortsVisualContract,
  readExtensionShortsVisualContract,
};
