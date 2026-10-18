const { test } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, SPA_COUNTS, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const {
  registerRuntimeResilienceContractScenarios,
  runRuntimeResilienceContract,
} = require("../runtime-resilience-contract");

registerRuntimeResilienceContractScenarios({
  runtimeName: "extension",
  register: ({ scenario, title }) => {
    test(title, async () => {
      const apiServer = await startHermeticApiServer();
      try {
        await runRuntimeResilienceContract({
          scenario,
          createAdapter: ({ gateMode }) =>
            new HermeticExtensionArtifactAdapter({
              apiServer,
              backendOptions: {
                countsByVideo: SPA_COUNTS,
                fixture: { signedIn: gateMode !== "signed-out" },
              },
            }),
        });
      } finally {
        await apiServer.close();
      }
    });
  },
});
