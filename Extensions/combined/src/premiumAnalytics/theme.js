export function getTextColor() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary").trim() ||
    (isDarkTheme() ? "#ffffff" : "#0f0f0f")
  );
}

export function getMutedTextColor() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-secondary").trim() ||
    (isDarkTheme() ? "#b3b3b3" : "#606060")
  );
}

export function getBorderColor(alpha = 0.15) {
  const base = isDarkTheme() ? [255, 255, 255] : [15, 23, 42];
  return `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
}

export function getSurfaceColor(lightAlpha = 0.06, darkAlpha = 0.02) {
  const base = isDarkTheme() ? [255, 255, 255] : [15, 23, 42];
  const alpha = isDarkTheme() ? darkAlpha : lightAlpha;
  return `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
}

export function getHoverFillColor(lightAlpha = 0.18, darkAlpha = 0.18) {
  const base = isDarkTheme() ? [255, 255, 255] : [15, 23, 42];
  const alpha = isDarkTheme() ? darkAlpha : lightAlpha;
  return `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
}

export function isDarkTheme() {
  const root = document.documentElement;
  return root.hasAttribute("dark") && root.getAttribute("dark") !== "false" && !root.hasAttribute("light");
}

export function observeTheme(onChange) {
  const colors = () => `${isDarkTheme()}:${getTextColor()}:${getMutedTextColor()}`;
  let previous = colors();
  const observer = new MutationObserver(() => {
    const next = colors();
    if (next === previous) return;
    previous = next;
    onChange();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dark", "light", "style", "class"],
  });
  return observer;
}
