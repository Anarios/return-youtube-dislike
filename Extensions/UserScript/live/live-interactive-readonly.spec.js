const {
  INTERACTIVE_READ_ONLY_SCENARIOS,
  createInteractiveReadOnlyStages,
  runInteractiveReadOnlyAfterRuntimeReload,
} = require("../e2e/live/live-interactive-readonly");
const {
  REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS,
  assertInteractiveReadOnlyScenarioCompletions,
  assertInteractiveReadOnlyScenarioDefinitions,
} = require("../e2e/live/live-interactive-scenario-contract");

const OPTIONS = Object.freeze({
  navigation: Object.freeze({ watch: "watch-target" }),
  runtime: "extension",
  short: "9LjMX9xeeok",
});

describe("interactive live read-only ordering", () => {
  test("declares the exact independent required scenario set with the cold Short first", () => {
    expect(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS).toEqual([
      "shorts-render",
      "channel-shorts-navigation",
      "channel-watch-navigation",
      "reload",
      "responsive-visual",
      "spa-navigation",
      "watch-action-topology",
      "sidebar-navigation-stress",
      "watch-render",
    ]);
    expect(new Set(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS)).toHaveProperty(
      "size",
      REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS.length,
    );
    expect(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS[0]).toBe("shorts-render");
  });

  test("keeps the implementation aligned with the independent required order", () => {
    const stages = createInteractiveReadOnlyStages({
      diagnostics: { checkpoint: jest.fn() },
      options: OPTIONS,
      readOnly: {},
      runtimeAdapter: {},
      scenarioRunner: { run: jest.fn() },
    });

    expect(stages.map(({ scenarioId }) => scenarioId)).toEqual(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS);
    expect(() => assertInteractiveReadOnlyScenarioDefinitions(INTERACTIVE_READ_ONLY_SCENARIOS)).not.toThrow();
    expect(stages[0]).toMatchObject({ name: "read-only.short-render", scenarioId: "shorts-render" });
    expect(stages.findIndex(({ scenarioId }) => scenarioId === "shorts-render")).toBeLessThan(
      stages.findIndex(({ scenarioId }) => scenarioId === "channel-shorts-navigation"),
    );
    expect(stages.findIndex(({ scenarioId }) => scenarioId === "shorts-render")).toBeLessThan(
      stages.findIndex(({ scenarioId }) => scenarioId === "channel-watch-navigation"),
    );
  });

  test.each(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS)(
    "fails the independent contract when %s is deleted from the implementation",
    (deletedScenarioId) => {
      const incompleteDefinitions = INTERACTIVE_READ_ONLY_SCENARIOS.filter(
        ({ scenarioId }) => scenarioId !== deletedScenarioId,
      );

      expect(() => assertInteractiveReadOnlyScenarioDefinitions(incompleteDefinitions)).toThrow(
        new RegExp(`Missing: .*${deletedScenarioId}`),
      );
    },
  );

  test("rejects duplicate, unexpected, and reordered implementation scenarios", () => {
    const duplicate = [
      ...INTERACTIVE_READ_ONLY_SCENARIOS,
      { key: "duplicate", name: "read-only.duplicate", scenarioId: "shorts-render" },
    ];
    const unexpected = [
      ...INTERACTIVE_READ_ONLY_SCENARIOS.slice(0, -1),
      { key: "unexpected", name: "read-only.unexpected", scenarioId: "unexpected" },
    ];
    const reordered = [...INTERACTIVE_READ_ONLY_SCENARIOS];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];

    expect(() => assertInteractiveReadOnlyScenarioDefinitions(duplicate)).toThrow(/duplicate scenario IDs/);
    expect(() => assertInteractiveReadOnlyScenarioDefinitions(unexpected)).toThrow(
      /Missing: watch-render; unexpected: unexpected/,
    );
    expect(() => assertInteractiveReadOnlyScenarioDefinitions(reordered)).toThrow(
      /required interactive read-only order/,
    );
  });

  test("waits for the exact extension reload, then runs the configured Short cold before other scenarios", async () => {
    const events = [];
    let finishReload;
    const reloadPending = new Promise((resolve) => {
      finishReload = resolve;
    });
    const scenarioRunner = {
      run: jest.fn(async (_adapter, scenarioId, receivedOptions) => {
        events.push(`scenario:${scenarioId}:${receivedOptions.short}`);
        return scenarioId;
      }),
    };
    const execution = runInteractiveReadOnlyAfterRuntimeReload({
      initializeRuntime: async (reloadResult) => {
        events.push(`initialize:${reloadResult.extensionId}`);
        return { diagnostics: {}, runtimeAdapter: { runtime: "extension" } };
      },
      options: OPTIONS,
      reloadExtension: async () => {
        events.push("reload:start");
        const result = await reloadPending;
        events.push(`reload:complete:${result.extensionId}`);
        return result;
      },
      runStages: async (_diagnostics, stages) => {
        for (const stage of stages) await stage.action();
      },
      scenarioRunner,
    });

    await Promise.resolve();
    expect(events).toEqual(["reload:start"]);

    finishReload({ extensionId: "installed-extension" });
    await expect(execution).resolves.toMatchObject({
      readOnly: { short: "shorts-render" },
      reloadResult: { extensionId: "installed-extension" },
    });
    expect(events.slice(0, 4)).toEqual([
      "reload:start",
      "reload:complete:installed-extension",
      "initialize:installed-extension",
      `scenario:shorts-render:${OPTIONS.short}`,
    ]);
    expect(scenarioRunner.run).toHaveBeenNthCalledWith(1, { runtime: "extension" }, "shorts-render", OPTIONS);
  });

  test("refuses to classify an unconfigured channel-to-Watch scenario as completed", () => {
    expect(() =>
      createInteractiveReadOnlyStages({
        diagnostics: { checkpoint: jest.fn() },
        options: { ...OPTIONS, navigation: { watch: null } },
        readOnly: {},
        runtimeAdapter: {},
        scenarioRunner: { run: jest.fn() },
      }),
    ).toThrow(/requires a configured channel Watch target/);
  });

  test("refuses reaction readiness when the stage executor silently omits any scenario", async () => {
    const scenarioRunner = { run: jest.fn(async (_adapter, scenarioId) => scenarioId) };

    await expect(
      runInteractiveReadOnlyAfterRuntimeReload({
        initializeRuntime: async () => ({ diagnostics: {}, runtimeAdapter: {} }),
        options: OPTIONS,
        reloadExtension: async () => ({ extensionId: "installed-extension" }),
        runStages: async (_diagnostics, stages) => {
          for (const stage of stages.slice(0, -1)) await stage.action();
        },
        scenarioRunner,
      }),
    ).rejects.toThrow(/Missing: watch-render/);
    expect(scenarioRunner.run).toHaveBeenCalledTimes(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS.length - 1);
  });

  test("refuses reaction readiness when a scenario resolves without a result", async () => {
    await expect(
      runInteractiveReadOnlyAfterRuntimeReload({
        initializeRuntime: async () => ({ diagnostics: {}, runtimeAdapter: {} }),
        options: OPTIONS,
        reloadExtension: async () => ({ extensionId: "installed-extension" }),
        runStages: async (_diagnostics, stages) => {
          await stages[0].action();
        },
        scenarioRunner: { run: jest.fn().mockResolvedValue(undefined) },
      }),
    ).rejects.toThrow(/shorts-render completed without a result/);
  });

  test("refuses reaction readiness when stages complete out of order or more than once", async () => {
    const execute = (runStages) =>
      runInteractiveReadOnlyAfterRuntimeReload({
        initializeRuntime: async () => ({ diagnostics: {}, runtimeAdapter: {} }),
        options: OPTIONS,
        reloadExtension: async () => ({ extensionId: "installed-extension" }),
        runStages,
        scenarioRunner: { run: async (_adapter, scenarioId) => scenarioId },
      });

    await expect(
      execute(async (_diagnostics, stages) => {
        for (const stage of [...stages].reverse()) await stage.action();
      }),
    ).rejects.toThrow(/required interactive read-only order/);

    await expect(
      execute(async (_diagnostics, stages) => {
        for (const stage of stages) await stage.action();
        await stages[0].action();
      }),
    ).rejects.toThrow(/duplicate scenario IDs/);
  });

  test("completion validation independently rejects an empty or incomplete result set", () => {
    expect(() => assertInteractiveReadOnlyScenarioCompletions([])).toThrow(/Missing:/);
    expect(() =>
      assertInteractiveReadOnlyScenarioCompletions(REQUIRED_INTERACTIVE_READ_ONLY_SCENARIO_IDS.slice(0, -1)),
    ).toThrow(/Missing: watch-render/);
  });
});
