export type ColorTheme = "classic" | "accessible" | "neon";
export type NumberDisplayFormat = "compactShort" | "compactLong" | "standard";
export type TooltipPercentageMode =
  | "dash_like"
  | "dash_dislike"
  | "both"
  | "only_like"
  | "only_dislike"
  | undefined;

export type ExtConfig = {
  disableVoteSubmission: boolean;
  coloredThumbs: boolean;
  coloredBar: boolean;
  colorTheme: ColorTheme;
  numberDisplayFormat: NumberDisplayFormat;
  numberDisplayReformatLikes: boolean;
  showTooltipPercentage: boolean | undefined;
  tooltipPercentageMode: TooltipPercentageMode;
};
