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
const {
  VOTE_IDENTITY_JOURNEY_COUNTS,
  VOTE_IDENTITY_JOURNEY_VIEWPORT,
  registerVoteIdentityJourneys,
  runVoteIdentityJourney,
} = require("../../e2e/vote-identity-journey-contract");

const EXISTING_CREDENTIALS = {
  registrationConfirmed: true,
  userId: "ExistingUserscriptCredential00000001",
};

async function launchNavigationContractRuntime({ context, page }, { beforeOpen, countsByVideo, origin, viewport }) {
  await page.setViewportSize(viewport);
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

  const backend = createFakeBackend({ countsByVideo });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  if (beforeOpen) await beforeOpen(context);
  await installHermeticRoutes(context, backend);
  await openNavigationFixture(page, { pageKind: origin.kind, videoId: origin.videoId });
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
  return { adapter, backend, consoleErrors, pageErrors };
}

async function expectHealthyNavigationContractRuntime(page, runtime) {
  expect(runtime.backend.blockedRequests).toEqual([]);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
}

registerNavigationRuntimeContractScenarios({
  runtimeName: "userscript",
  register: ({ scenario, title }) => {
    test(title, async ({ context, page }) => {
      const runtime = await launchNavigationContractRuntime(
        { context, page },
        {
          beforeOpen: (browserContext) => installNavigationMatrixFixture(browserContext, scenario),
          countsByVideo: {
            [scenario.destination.videoId]: scenario.destination.counts,
            [scenario.origin.videoId]: scenario.origin.counts,
          },
          origin: scenario.origin,
          viewport: scenario.viewport,
        },
      );
      await runNavigationRuntimeContract({
        adapter: runtime.adapter,
        scenario,
      });
      await expectHealthyNavigationContractRuntime(page, runtime);
    });
  },
});

registerVoteIdentityJourneys({
  runtimeName: "userscript",
  register: ({ journey, title }) => {
    test(title, async ({ context, page }) => {
      test.setTimeout(45_000);
      const runtime = await launchNavigationContractRuntime(
        { context, page },
        {
          countsByVideo: VOTE_IDENTITY_JOURNEY_COUNTS,
          origin: journey.origin,
          viewport: VOTE_IDENTITY_JOURNEY_VIEWPORT,
        },
      );
      await runVoteIdentityJourney({ adapter: runtime.adapter, journey });
      expect(await readGmValue(page, CREDENTIAL_KEY)).toEqual(EXISTING_CREDENTIALS);
      await expectHealthyNavigationContractRuntime(page, runtime);
    });
  },
});
