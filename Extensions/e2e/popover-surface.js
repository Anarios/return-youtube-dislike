const assert = require("node:assert/strict");

function readPopoverSurface(selector) {
  const host = document.querySelector(selector);
  const panel = host?.shadowRoot?.querySelector(".panel");
  if (!panel) return null;
  const probe = document.createElement("ryd-surface-probe");
  probe.style.cssText =
    "position:fixed;color:var(--yt-sys-color-baseline--text-primary);background-color:var(--yt-sys-color-baseline--menu-background)";
  document.documentElement.append(probe);
  const theme = getComputedStyle(probe);
  const hostStyle = getComputedStyle(host);
  const panelStyle = getComputedStyle(panel);
  const surface = {
    dark: document.documentElement.hasAttribute("dark"),
    themeBackground: theme.backgroundColor,
    themeText: theme.color,
    hostBackground: hostStyle.backgroundColor,
    hostPadding: hostStyle.padding,
    hostBorder: hostStyle.borderTopWidth,
    hostZIndex: hostStyle.zIndex,
    panelBackground: panelStyle.backgroundColor,
    panelText: panelStyle.color,
  };
  probe.remove();
  return surface;
}

function isDarkTheme() {
  return document.documentElement.hasAttribute("dark");
}

function setDarkTheme(dark) {
  document.documentElement.toggleAttribute("dark", dark);
}

function assertPopoverSurface(surface, label) {
  assert(surface, `${label}: no panel inside the shadow root`);
  assert.match(surface.themeBackground, /^rgb\(/, `${label}: the page defines no opaque theme background`);
  assert.equal(surface.hostBackground, "rgba(0, 0, 0, 0)", `${label}: host background`);
  assert.equal(surface.hostPadding, "0px", `${label}: host padding`);
  assert.equal(surface.hostBorder, "0px", `${label}: host border`);
  assert.equal(surface.hostZIndex, "2019", `${label}: host stacks below YouTube's masthead`);
  assert.equal(surface.panelBackground, surface.themeBackground, `${label}: panel background`);
  assert.equal(surface.panelText, surface.themeText, `${label}: panel text`);
}

async function assertThemedPopoverSurfaces(evaluate, selector, label) {
  const initiallyDark = await evaluate(isDarkTheme);
  const surfaces = [];
  for (const dark of [false, true]) {
    await evaluate(setDarkTheme, [dark]);
    const surface = await evaluate(readPopoverSurface, [selector]);
    assertPopoverSurface(surface, `${label} (${dark ? "dark" : "light"})`);
    surfaces.push(surface);
  }
  await evaluate(setDarkTheme, [initiallyDark]);
  assert.notEqual(
    surfaces[0].panelBackground,
    surfaces[1].panelBackground,
    `${label}: both themes share one background`,
  );
  return surfaces;
}

module.exports = { assertPopoverSurface, assertThemedPopoverSurfaces, readPopoverSurface };
