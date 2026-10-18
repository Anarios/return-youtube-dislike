const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openNavigationFixture,
  readGmValue,
} = require("./harness");
const { USERSCRIPT_MATRIX_RUNTIME, installNavigationMatrixFixture } = require("./navigation-matrix");
const {
  createNavigationRuntimeContractAdapter,
  registerNavigationRuntimeContractScenarios,
  runNavigationRuntimeContract,
} = require("../../e2e/navigation-runtime-contract");

const EXISTING_CREDENTIALS = {
  registrationConfirmed: true,
  userId: "ExistingUserscriptCredential00000001",
};
registerNavigationRuntimeContractScenarios({
  runtimeName: "userscript",
  register: ({ scenario, title }) => {
    test(title, async ({ context, page }) => {
      await page.setViewportSize(scenario.viewport);
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await context.addInitScript(() => {
        globalThis.__unhandledRejections = [];
        addEventListener("unhandledrejection", (event) => {
          const reason = event.reason;
          globalThis.__unhandledRejections.push(reason instanceof Error ? reason.message : String(reason));
        });
      });

      const backend = createFakeBackend({
        countsByVideo: {
          [scenario.destination.videoId]: scenario.destination.counts,
          [scenario.origin.videoId]: scenario.origin.counts,
        },
      });
      await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
      await installNavigationMatrixFixture(context, scenario);
      await installHermeticRoutes(context, backend);
      await openNavigationFixture(page, {
        pageKind: scenario.origin.kind,
        videoId: scenario.origin.videoId,
      });
      await injectGeneratedUserscript(page);

      const adapter = createNavigationRuntimeContractAdapter({
        backend,
        expectedCredentials: EXISTING_CREDENTIALS,
        matrixRuntime: USERSCRIPT_MATRIX_RUNTIME,
        page,
        readCredentials: () => readGmValue(page, CREDENTIAL_KEY),
        readInteractionRecords: () => backend.requests,
        runtimeName: "userscript",
      });
      await runNavigationRuntimeContract({
        adapter,
        scenario,
      });

      expect(backend.blockedRequests).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
    });
  },
});
