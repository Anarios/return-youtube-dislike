function youtubeColor(token, fallback) {
  return `var(--yt-sys-color-baseline--${token}, ${fallback})`;
}

const POPOVER_HOST_RESET =
  "margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important;";
const POPOVER_TEXT_COLOR = youtubeColor("text-primary", "#0f0f0f");
const POPOVER_SECONDARY_TEXT_COLOR = youtubeColor("text-secondary", "#606060");
const POPOVER_BACKGROUND = youtubeColor("menu-background", "#fff");
const POPOVER_OUTLINE = youtubeColor("outline", "#0000001a");
const POPOVER_PRIMARY_BUTTON_BACKGROUND = youtubeColor("inverted-background", "#0f0f0f");
const POPOVER_PRIMARY_BUTTON_TEXT_COLOR = youtubeColor("text-primary-inverse", "#fff");
const POPOVER_SECONDARY_BUTTON_BACKGROUND = youtubeColor("additive-background", "#0000000d");

export {
  POPOVER_BACKGROUND,
  POPOVER_HOST_RESET,
  POPOVER_OUTLINE,
  POPOVER_PRIMARY_BUTTON_BACKGROUND,
  POPOVER_PRIMARY_BUTTON_TEXT_COLOR,
  POPOVER_SECONDARY_BUTTON_BACKGROUND,
  POPOVER_SECONDARY_TEXT_COLOR,
  POPOVER_TEXT_COLOR,
};
