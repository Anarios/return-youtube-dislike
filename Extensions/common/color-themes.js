const DEFAULT_CUSTOM_COLORS = Object.freeze({
  light: Object.freeze({ like: "#007600", dislike: "#b300b3" }),
  dark: Object.freeze({ like: "#00d000", dislike: "#ff77ff" }),
});

function normalizeCustomColors(value) {
  const colors = {};
  for (const theme of ["light", "dark"]) {
    colors[theme] = {};
    for (const vote of ["like", "dislike"]) {
      const color = value?.[theme]?.[vote];
      colors[theme][vote] =
        typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
          ? color.toLowerCase()
          : DEFAULT_CUSTOM_COLORS[theme][vote];
    }
  }
  return colors;
}

function getThemeColor(themeName, voteIsLike, isDark = false, customColors) {
  const vote = voteIsLike ? "like" : "dislike";
  const theme = isDark ? "dark" : "light";
  switch (themeName) {
    case "custom":
      return normalizeCustomColors(customColors)[theme][vote];
    case "hibiscus":
      return DEFAULT_CUSTOM_COLORS[theme][vote];
    case "accessible":
      return voteIsLike ? "dodgerblue" : "gold";
    case "neon":
      return voteIsLike ? "aqua" : "magenta";
    case "classic":
    default:
      return voteIsLike ? "lime" : "red";
  }
}

function isYouTubeDarkTheme(ownerDocument = document) {
  return ownerDocument.documentElement.hasAttribute("dark");
}

function observeYouTubeTheme(onChange, ownerDocument = document) {
  let isDark = isYouTubeDarkTheme(ownerDocument);
  const observer = new MutationObserver(() => {
    const nextIsDark = isYouTubeDarkTheme(ownerDocument);
    if (nextIsDark === isDark) return;
    isDark = nextIsDark;
    onChange(isDark);
  });
  observer.observe(ownerDocument.documentElement, { attributes: true, attributeFilter: ["dark"] });
  return observer;
}

export { DEFAULT_CUSTOM_COLORS, normalizeCustomColors, getThemeColor, isYouTubeDarkTheme, observeYouTubeTheme };
