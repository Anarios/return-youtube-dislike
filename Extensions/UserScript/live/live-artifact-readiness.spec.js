const { assertCurrentLiveArtifact } = require("../e2e/live/live-artifact-readiness");

const BUILD_ID = "0123456789abcdef0123456789abcdef";

function verifiers() {
  return {
    verifyExtensionBuildReceipt: jest.fn(() => ({ inputHash: "extension-inputs" })),
    verifyExtensionJavaScript: jest.fn(() => ({ version: "4.0.5" })),
    verifyUserscript: jest.fn(() => ({ inputHash: "userscript-inputs" })),
  };
}

test("an extension live run verifies current source inputs and the generated browser bundles", () => {
  const checks = verifiers();

  expect(assertCurrentLiveArtifact("extension", BUILD_ID, checks)).toEqual({
    artifact: { version: "4.0.5" },
    buildId: BUILD_ID,
    receipt: { inputHash: "extension-inputs" },
    runtime: "extension",
  });
  expect(checks.verifyExtensionBuildReceipt).toHaveBeenCalledTimes(1);
  expect(checks.verifyExtensionJavaScript).toHaveBeenCalledTimes(1);
  expect(checks.verifyUserscript).not.toHaveBeenCalled();
});

test("a userscript live run verifies the exact live receipt and build ID", () => {
  const checks = verifiers();

  expect(assertCurrentLiveArtifact("userscript", BUILD_ID, checks)).toEqual({
    buildId: BUILD_ID,
    receipt: { inputHash: "userscript-inputs" },
    runtime: "userscript",
  });
  expect(checks.verifyUserscript).toHaveBeenCalledWith({ expectedBuildId: BUILD_ID, liveTestBuild: true });
  expect(checks.verifyExtensionBuildReceipt).not.toHaveBeenCalled();
  expect(checks.verifyExtensionJavaScript).not.toHaveBeenCalled();
});

test.each([
  [
    "extension receipt",
    {
      verifyExtensionBuildReceipt: () => {
        throw new Error("stale extension source");
      },
    },
  ],
  [
    "extension bundles",
    {
      verifyExtensionJavaScript: () => {
        throw new Error("stale extension bundle");
      },
    },
  ],
  [
    "userscript receipt",
    {
      verifyUserscript: () => {
        throw new Error("stale userscript source");
      },
    },
  ],
])("propagates a failed %s check before browser attachment", (_label, override) => {
  const runtime = _label.startsWith("userscript") ? "userscript" : "extension";
  expect(() => assertCurrentLiveArtifact(runtime, BUILD_ID, { ...verifiers(), ...override })).toThrow(/stale/);
});

test("rejects an unsupported live runtime without verifying another artifact", () => {
  const checks = verifiers();
  expect(() => assertCurrentLiveArtifact("browser", BUILD_ID, checks)).toThrow("Unsupported live artifact runtime");
  expect(checks.verifyExtensionBuildReceipt).not.toHaveBeenCalled();
  expect(checks.verifyExtensionJavaScript).not.toHaveBeenCalled();
  expect(checks.verifyUserscript).not.toHaveBeenCalled();
});
