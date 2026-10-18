/**
 * @jest-environment node
 */

const {
  annotateVisualEvidence,
  assertVisualEvidenceCaptured,
  captureOptionalVisualEvidence,
} = require("./visual-evidence");

test("capture-off results cannot be presented as inspected screenshot evidence", async () => {
  const capture = jest.fn();
  const testInfo = { annotations: [] };

  const evidence = await captureOptionalVisualEvidence({
    capture,
    environment: {},
    outputPath: "would-have-been.png",
  });
  annotateVisualEvidence(testInfo, evidence);

  expect(capture).not.toHaveBeenCalled();
  expect(evidence).toEqual({ captured: false, outputPath: null, reason: "capture-disabled" });
  expect(testInfo.annotations).toEqual([{ description: "not-captured:capture-disabled", type: "visual-evidence" }]);
  expect(() => assertVisualEvidenceCaptured(evidence, "Extension UI screenshot")).toThrow(
    "Structural browser assertions alone are not inspected screenshot evidence.",
  );
});

test("capture-on results carry the exact screenshot path", async () => {
  const capture = jest.fn();
  const evidence = await captureOptionalVisualEvidence({
    capture,
    environment: { RYD_CAPTURE_VISUALS: "1" },
    outputPath: "captured.png",
  });

  expect(capture).toHaveBeenCalledWith("captured.png");
  expect(assertVisualEvidenceCaptured(evidence)).toEqual({
    captured: true,
    outputPath: "captured.png",
    reason: null,
  });
});
