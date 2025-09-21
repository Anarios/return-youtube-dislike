export function getTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary").trim() || "#ffffff";
}

export function getMutedTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-secondary").trim() || "#b3b3b3";
}

export function getBorderColor(alpha = 0.15) {
  return `rgba(255,255,255,${alpha})`;
}
