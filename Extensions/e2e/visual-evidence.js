const assert = require("node:assert/strict");

const VISUAL_CAPTURE_ENVIRONMENT_VARIABLE = "RYD_CAPTURE_VISUALS";

function visualCaptureIsEnabled(environment = process.env) {
  return environment?.[VISUAL_CAPTURE_ENVIRONMENT_VARIABLE] === "1";
}

async function captureOptionalVisualEvidence({ capture, environment = process.env, outputPath }) {
  if (!visualCaptureIsEnabled(environment)) {
    return Object.freeze({ captured: false, outputPath: null, reason: "capture-disabled" });
  }
  if (typeof capture !== "function") throw new TypeError("Visual evidence capture must be a function.");
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throw new TypeError("Visual evidence outputPath must be a non-empty string.");
  }

  await capture(outputPath);
  return Object.freeze({ captured: true, outputPath, reason: null });
}

function annotateVisualEvidence(testInfo, evidence) {
  testInfo.annotations.push({
    description: evidence.captured ? `captured:${evidence.outputPath}` : `not-captured:${evidence.reason}`,
    type: "visual-evidence",
  });
  return evidence;
}

function assertVisualEvidenceCaptured(evidence, label = "Visual evidence") {
  assert.equal(
    evidence?.captured,
    true,
    `${label} was not captured. Structural browser assertions alone are not inspected screenshot evidence.`,
  );
  assert.equal(typeof evidence.outputPath, "string", `${label} has no screenshot path.`);
  return evidence;
}

module.exports = {
  VISUAL_CAPTURE_ENVIRONMENT_VARIABLE,
  annotateVisualEvidence,
  assertVisualEvidenceCaptured,
  captureOptionalVisualEvidence,
  visualCaptureIsEnabled,
};
