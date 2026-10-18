/**
 * @jest-environment node
 */

const path = require("node:path");
const extensionPlaywrightConfig = require("../../playwright.extension.config");
const {
  ALLOW_CUSTOM_ARTIFACT_ENV,
  REPOSITORY_EXTENSION_ARTIFACT,
  selectedArtifact,
  verifyPlaywrightExtensionArtifact,
} = require("./playwright-extension-global-setup");

test("the extension Playwright config always runs the artifact freshness gate", () => {
  expect(extensionPlaywrightConfig.globalSetup).toBe(require.resolve("./playwright-extension-global-setup"));
});

test("the default Playwright target receives full repository artifact verification", () => {
  const verifyArtifact = jest.fn(() => ({ kind: "repository" }));

  expect(verifyPlaywrightExtensionArtifact({ env: {}, verifyArtifact })).toEqual({ kind: "repository" });
  expect(selectedArtifact({})).toBe(REPOSITORY_EXTENSION_ARTIFACT);
  expect(verifyArtifact).toHaveBeenCalledWith(undefined);
});

test("a custom artifact cannot silently bypass the repository build receipt", () => {
  const customArtifact = path.resolve("test-results", "intentional-broken-extension");
  const verifyArtifact = jest.fn();

  expect(() =>
    verifyPlaywrightExtensionArtifact({
      env: { RYD_EXTENSION_ARTIFACT: customArtifact },
      verifyArtifact,
    }),
  ).toThrow(new RegExp(`${ALLOW_CUSTOM_ARTIFACT_ENV}=1`));
  expect(verifyArtifact).not.toHaveBeenCalled();
});

test("an explicit custom-fixture opt-in still runs standalone artifact validation", () => {
  const customArtifact = path.resolve("test-results", "intentional-broken-extension");
  const verifyArtifact = jest.fn(() => ({ kind: "custom" }));

  expect(
    verifyPlaywrightExtensionArtifact({
      env: {
        [ALLOW_CUSTOM_ARTIFACT_ENV]: "1",
        RYD_EXTENSION_ARTIFACT: customArtifact,
      },
      verifyArtifact,
    }),
  ).toEqual({ kind: "custom" });
  expect(verifyArtifact).toHaveBeenCalledWith(customArtifact);
});

test("truthy-looking custom-fixture values do not weaken the explicit gate", () => {
  const customArtifact = path.resolve("test-results", "intentional-broken-extension");

  for (const value of ["true", "yes", "0"]) {
    expect(() =>
      verifyPlaywrightExtensionArtifact({
        env: {
          [ALLOW_CUSTOM_ARTIFACT_ENV]: value,
          RYD_EXTENSION_ARTIFACT: customArtifact,
        },
        verifyArtifact: jest.fn(),
      }),
    ).toThrow(new RegExp(`${ALLOW_CUSTOM_ARTIFACT_ENV}=1`));
  }
});
