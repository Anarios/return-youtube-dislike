const {
  assertWatchRatioData,
  colorContrastRatio,
  formattedWatchTooltipCandidates,
  normalizeTooltipText,
  parseCssColor,
} = require("../e2e/live/watch-ratio-audit");

const VIDEO_ID = "abcdefghijk";
const COUNTS = Object.freeze({ dislikes: 250, likes: 750 });

function measurement(overrides = {}) {
  return {
    appearance: {
      inlineFillWidth: "75%",
      negativeTrackColor: "rgb(126, 126, 126)",
      pageBackgroundColor: "rgb(15, 15, 15)",
      tooltipText: "750 / 250",
      wrapperVideoId: VIDEO_ID,
      ...overrides.appearance,
    },
    geometry: {
      bar: { width: 150 },
      container: { width: 200 },
      ...overrides.geometry,
    },
  };
}

function assertMeasurement(value, options = {}) {
  return assertWatchRatioData(value, {
    expectedCounts: COUNTS,
    expectedTooltipCandidates: ["750 / 250"],
    runtime: "extension",
    videoId: VIDEO_ID,
    ...options,
  });
}

describe("live Watch ratio data audit", () => {
  test.each([
    ["dark", "rgb(126, 126, 126)", "rgb(15, 15, 15)"],
    ["light", "rgb(115, 115, 115)", "rgb(255, 255, 255)"],
  ])("accepts an owned exact-ratio bar with a visible negative track in the %s theme", (_theme, track, page) => {
    expect(
      assertMeasurement(measurement({ appearance: { negativeTrackColor: track, pageBackgroundColor: page } })),
    ).toMatchObject({
      expectedRatio: 0.75,
      inlineRatio: 0.75,
      renderedRatio: 0.75,
      tooltipText: "750 / 250",
      wrapperVideoId: VIDEO_ID,
    });
  });

  test.each([null, "zyxwvutsrqp"])("rejects a Watch ratio wrapper owned by %s", (wrapperVideoId) => {
    expect(() => assertMeasurement(measurement({ appearance: { wrapperVideoId } }))).toThrow(
      /Watch ratio bar is owned by/,
    );
  });

  test.each([
    ["inline width", { appearance: { inlineFillWidth: "25%" } }],
    ["rendered geometry", { geometry: { bar: { width: 50 } } }],
  ])("rejects a wrong %s even when the displayed count is unchanged", (_label, override) => {
    expect(() => assertMeasurement(measurement(override))).toThrow(
      /expected 75\.000% from exact API counts|expected 75\.00%/,
    );
  });

  test("rejects a stale tooltip even when ownership, count text, and ratio are valid", () => {
    expect(() => assertMeasurement(measurement({ appearance: { tooltipText: "900 / 100" } }))).toThrow(
      /tooltip.*does not exactly match the API counts/,
    );
  });

  test("accepts the exact configured percentage variants", () => {
    expect(
      assertMeasurement(measurement({ appearance: { tooltipText: "750 / 250 - 75%" } }), {
        expectedTooltipCandidates: ["750 / 250", "750 / 250 - 75%", "750 / 250 - 25%"],
      }).tooltipText,
    ).toBe("750 / 250 - 75%");
  });

  test("derives every configured tooltip form from the exact API counts and browser locale", () => {
    expect(formattedWatchTooltipCandidates(COUNTS, "en-US")).toEqual([
      { form: "counts", text: "750 / 250" },
      { form: "counts-with-like-percentage", text: "750 / 250 - 75%" },
      { form: "counts-with-dislike-percentage", text: "750 / 250 - 25%" },
      { form: "both-percentages", text: "75% / 25%" },
      { form: "like-percentage", text: "75%" },
      { form: "dislike-percentage", text: "25%" },
    ]);
  });

  test.each([
    ["transparent", "rgba(115, 115, 115, 0)"],
    ["ancestor opacity", "rgb(115, 115, 115)", "rgb(15, 15, 15)", 0.01],
    ["near-background dark", "rgb(18, 18, 18)"],
    ["near-background light", "rgb(248, 248, 248)", "rgb(255, 255, 255)"],
  ])("rejects an effectively invisible negative track: %s", (_label, track, page = "rgb(15, 15, 15)", opacity = 1) => {
    expect(() =>
      assertMeasurement(
        measurement({
          appearance: { negativeTrackColor: track, negativeTrackOpacity: opacity, pageBackgroundColor: page },
        }),
      ),
    ).toThrow(/negative track is effectively invisible/);
  });

  test("rejects a negative-track background image instead of guessing its contrast", () => {
    expect(() =>
      assertMeasurement(measurement({ appearance: { negativeTrackBackgroundImage: "linear-gradient(#000, #fff)" } })),
    ).toThrow(/background image whose effective contrast cannot be audited/);
  });

  test("normalizes non-breaking spaces and directional formatting in tooltip text", () => {
    expect(normalizeTooltipText("\u2066 750\u00a0/\u00a0250 \u2069")).toBe("750 / 250");
  });

  test.each([
    ["#737373", { a: 1, b: 115, g: 115, r: 115 }],
    ["rgba(115, 115, 115, 50%)", { a: 0.5, b: 115, g: 115, r: 115 }],
    ["color(srgb 0.5 0.25 0 / 0.75)", { a: 0.75, b: 0, g: 63.75, r: 127.5 }],
  ])("parses computed CSS color %s", (value, expected) => {
    expect(parseCssColor(value)).toEqual(expected);
  });

  test("computes the standard black-to-white contrast ratio", () => {
    expect(colorContrastRatio(parseCssColor("#000"), parseCssColor("#fff"))).toBeCloseTo(21, 5);
  });
});
