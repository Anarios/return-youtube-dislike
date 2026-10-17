const { test } = require("@playwright/test");
const { HermeticUserscriptArtifactAdapter, SPA_COUNTS } = require("../../e2e/hermetic-artifact-smoke");
const {
  registerRuntimeResilienceContractScenarios,
  runRuntimeResilienceContract,
} = require("../../e2e/runtime-resilience-contract");

registerRuntimeResilienceContractScenarios({
  runtimeName: "userscript",
  register: ({ scenario, title }) => {
    test(title, async () => {
      await runRuntimeResilienceContract({
        scenario,
        createAdapter: ({ gateMode }) =>
          new HermeticUserscriptArtifactAdapter({
            backendOptions: {
              countsByVideo: SPA_COUNTS,
              fixture: { signedIn: gateMode !== "signed-out" },
            },
            disableVoteSubmission: gateMode === "disabled",
          }),
      });
    });
  },
});
