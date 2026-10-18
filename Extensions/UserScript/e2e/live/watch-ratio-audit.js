const assert = require("node:assert/strict");

const WATCH_NEGATIVE_TRACK_MINIMUM_CONTRAST = 3;
const WATCH_RATIO_GEOMETRY_TOLERANCE = 0.015;
const WATCH_RATIO_INLINE_TOLERANCE = 0.000_1;

function normalizeTooltipText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function formattedWatchTooltipCandidates(expectedCounts, locale) {
  assertExpectedWatchCounts(expectedCounts);
  const formatter = new Intl.NumberFormat(locale || undefined);
  const total = expectedCounts.likes + expectedCounts.dislikes;
  const widthPercent = total > 0 ? (expectedCounts.likes / total) * 100 : 50;
  const likePercentageValue = Number.parseFloat(widthPercent.toFixed(1));
  const dislikePercentageValue = 100 - likePercentageValue;
  const likes = formatter.format(expectedCounts.likes);
  const dislikes = formatter.format(expectedCounts.dislikes);
  const likePercentage = formatter.format(likePercentageValue);
  const dislikePercentage = formatter.format(dislikePercentageValue);
  const countPair = `${likes} / ${dislikes}`;

  return [
    { form: "counts", text: countPair },
    { form: "counts-with-like-percentage", text: `${countPair} - ${likePercentage}%` },
    { form: "counts-with-dislike-percentage", text: `${countPair} - ${dislikePercentage}%` },
    { form: "both-percentages", text: `${likePercentage}% / ${dislikePercentage}%` },
    { form: "like-percentage", text: `${likePercentage}%` },
    { form: "dislike-percentage", text: `${dislikePercentage}%` },
  ];
}

function clampColorChannel(value) {
  return Math.min(255, Math.max(0, value));
}

function parseAlpha(value) {
  if (value === undefined) return 1;
  const parsed = value.endsWith("%") ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null;
}

function parseRgbChannel(value) {
  const parsed = value.endsWith("%") ? (Number.parseFloat(value) / 100) * 255 : Number.parseFloat(value);
  return Number.isFinite(parsed) ? clampColorChannel(parsed) : null;
}

function parseCssColor(value) {
  const color = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!color || color === "transparent") return color === "transparent" ? { a: 0, b: 0, g: 0, r: 0 } : null;

  const hex = color.match(/^#([a-f0-9]{3,8})$/iu)?.[1];
  if (hex) {
    const expanded = hex.length === 3 || hex.length === 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
    if (expanded.length !== 6 && expanded.length !== 8) return null;
    return {
      a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      b: Number.parseInt(expanded.slice(4, 6), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      r: Number.parseInt(expanded.slice(0, 2), 16),
    };
  }

  const rgb = color.match(/^rgba?\((.*)\)$/iu)?.[1];
  if (rgb) {
    const commaParts = rgb.includes(",") ? rgb.split(",").map((part) => part.trim()) : null;
    const legacyAlpha = commaParts?.length === 4 ? commaParts.pop() : undefined;
    const normalized = (commaParts ?? [rgb]).join(" ").replace(/\s*\/\s*/gu, " / ");
    const [channelsPart, modernAlpha] = normalized.split(/\s+\/\s+/u);
    const channels = channelsPart.trim().split(/\s+/u);
    if (channels.length !== 3) return null;
    const [r, g, b] = channels.map(parseRgbChannel);
    const a = parseAlpha(modernAlpha ?? legacyAlpha);
    return [r, g, b, a].every((channel) => channel !== null) ? { a, b, g, r } : null;
  }

  const srgb = color.match(/^color\(srgb\s+(.+)\)$/iu)?.[1];
  if (srgb) {
    const [channelsPart, alphaPart] = srgb.split(/\s+\/\s+/u);
    const channels = channelsPart.trim().split(/\s+/u).map(Number.parseFloat);
    const a = parseAlpha(alphaPart);
    if (channels.length !== 3 || !channels.every(Number.isFinite) || a === null) return null;
    return {
      a,
      b: clampColorChannel(channels[2] * 255),
      g: clampColorChannel(channels[1] * 255),
      r: clampColorChannel(channels[0] * 255),
    };
  }

  return null;
}

function compositeColor(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { a: 0, b: 0, g: 0, r: 0 };
  const channel = (key) =>
    (foreground[key] * foreground.a + background[key] * background.a * (1 - foreground.a)) / alpha;
  return { a: alpha, b: channel("b"), g: channel("g"), r: channel("r") };
}

function relativeLuminance(color) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(color.r) * 0.2126 + linear(color.g) * 0.7152 + linear(color.b) * 0.0722;
}

function colorContrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertExpectedWatchCounts(expectedCounts) {
  assert.ok(expectedCounts && typeof expectedCounts === "object", "Exact Watch API counts are required.");
  for (const key of ["likes", "dislikes"]) {
    assert.ok(
      Number.isSafeInteger(expectedCounts[key]) && expectedCounts[key] >= 0,
      `The Watch API ${key} count must be a non-negative integer.`,
    );
  }
  return expectedCounts;
}

function assertWatchRatioData(
  measurement,
  {
    expectedCounts = null,
    expectedTooltipCandidates = [],
    minimumNegativeTrackContrast = WATCH_NEGATIVE_TRACK_MINIMUM_CONTRAST,
    runtime,
    videoId,
  },
) {
  assert.ok(measurement?.appearance, "The Watch ratio-bar appearance audit is missing.");
  assert.equal(
    measurement.appearance.wrapperVideoId,
    videoId,
    `The ${runtime} Watch ratio bar is owned by ${measurement.appearance.wrapperVideoId ?? "no video"}, not ${videoId}.`,
  );

  const pageBackground = parseCssColor(measurement.appearance.pageBackgroundColor);
  const negativeTrack = parseCssColor(measurement.appearance.negativeTrackColor);
  assert.ok(
    pageBackground,
    `Cannot resolve the Watch page background color: ${measurement.appearance.pageBackgroundColor}.`,
  );
  assert.ok(
    negativeTrack,
    `Cannot resolve the Watch negative-track color: ${measurement.appearance.negativeTrackColor}.`,
  );
  assert.equal(
    measurement.appearance.negativeTrackBackgroundImage ?? "none",
    "none",
    "The Watch negative track uses a background image whose effective contrast cannot be audited.",
  );
  assert.ok(pageBackground.a >= 0.99, "The resolved Watch page background is not opaque enough for a contrast audit.");
  const negativeTrackOpacity = Number(measurement.appearance.negativeTrackOpacity ?? 1);
  assert.ok(
    Number.isFinite(negativeTrackOpacity) && negativeTrackOpacity >= 0 && negativeTrackOpacity <= 1,
    `The Watch negative-track effective opacity is invalid: ${measurement.appearance.negativeTrackOpacity}.`,
  );
  negativeTrack.a *= negativeTrackOpacity;
  const effectiveNegativeTrack = compositeColor(negativeTrack, pageBackground);
  const negativeTrackContrast = colorContrastRatio(effectiveNegativeTrack, pageBackground);
  assert.ok(
    negativeTrack.a > 0 && negativeTrackContrast >= minimumNegativeTrackContrast,
    `The Watch negative track is effectively invisible against the page background: contrast ${negativeTrackContrast.toFixed(2)}:1 is below ${minimumNegativeTrackContrast}:1.`,
  );

  const result = { negativeTrackContrast, wrapperVideoId: measurement.appearance.wrapperVideoId };
  if (expectedCounts === null) return result;

  assertExpectedWatchCounts(expectedCounts);
  const total = expectedCounts.likes + expectedCounts.dislikes;
  const expectedRatio = total > 0 ? expectedCounts.likes / total : 0.5;
  const inlineRatio = Number.parseFloat(measurement.appearance.inlineFillWidth) / 100;
  assert.ok(Number.isFinite(inlineRatio), "The Watch ratio fill has no numeric inline percentage width.");
  assert.ok(
    Math.abs(inlineRatio - expectedRatio) <= WATCH_RATIO_INLINE_TOLERANCE,
    `The Watch ratio fill inline width represents ${(inlineRatio * 100).toFixed(3)}%, expected ${(expectedRatio * 100).toFixed(3)}% from exact API counts.`,
  );

  const { bar, container } = measurement.geometry ?? {};
  assert.ok(container?.width > 0 && bar?.width >= 0, "The Watch ratio geometry cannot represent an exact ratio.");
  const renderedRatio = bar.width / container.width;
  const pixelTolerance = 1 / container.width;
  assert.ok(
    Math.abs(renderedRatio - expectedRatio) <= Math.max(WATCH_RATIO_GEOMETRY_TOLERANCE, pixelTolerance),
    `The rendered Watch ratio is ${(renderedRatio * 100).toFixed(2)}%, expected ${(expectedRatio * 100).toFixed(2)}% from exact API counts.`,
  );

  const normalizedTooltip = normalizeTooltipText(measurement.appearance.tooltipText);
  const normalizedCandidates = expectedTooltipCandidates.map((candidate) => ({
    form: typeof candidate === "string" ? "unspecified" : candidate.form,
    text: normalizeTooltipText(typeof candidate === "string" ? candidate : candidate.text),
  }));
  assert.ok(normalizedCandidates.length > 0, "Exact Watch tooltip expectations are required with API counts.");
  const tooltipMatch = normalizedCandidates.find((candidate) => candidate.text === normalizedTooltip);
  assert.ok(
    tooltipMatch,
    `The Watch ratio tooltip ${JSON.stringify(normalizedTooltip)} does not exactly match the API counts and configured percentage form.`,
  );

  return {
    ...result,
    expectedRatio,
    inlineRatio,
    renderedRatio,
    tooltipForm: tooltipMatch.form,
    tooltipText: normalizedTooltip,
  };
}

module.exports = {
  WATCH_NEGATIVE_TRACK_MINIMUM_CONTRAST,
  WATCH_RATIO_GEOMETRY_TOLERANCE,
  WATCH_RATIO_INLINE_TOLERANCE,
  assertExpectedWatchCounts,
  assertWatchRatioData,
  colorContrastRatio,
  formattedWatchTooltipCandidates,
  normalizeTooltipText,
  parseCssColor,
};
