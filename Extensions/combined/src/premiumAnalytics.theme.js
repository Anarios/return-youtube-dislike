export function getTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary").trim() || "#ffffff";
}

export function getMutedTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-secondary").trim() || "#b3b3b3";
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
  if (root.hasAttribute("dark") && !root.hasAttribute("light")) {
    return true;
  }
  if (root.getAttribute("dark") === "false") {
    return false;
  }
  const colorValue = getComputedStyle(root).getPropertyValue("--yt-spec-text-primary").trim();
  const color = parseColor(colorValue);
  if (color) {
    const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    return luminance > 0.5;
  }
  return true;
}

function parseColor(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  }
  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => parseFloat(part.trim()));
    if (parts.length >= 3) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return null;
}
