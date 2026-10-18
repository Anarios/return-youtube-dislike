const { NAVIGATION_MATRIX, NAVIGATION_SCENARIO_RUNNER_IDS } = require("../UserScript/e2e/navigation-matrix");
const {
  NON_CURRENT_DUPLICATE_SCENARIO_IDS,
  createNavigationRuntimeContractAdapter,
  expectSuccessfulVoteActivation,
  registerNavigationRuntimeContractScenarios,
} = require("./navigation-runtime-contract");

const USER_ID = "A".repeat(36);
const VIDEO_ID = "abcdefghijk";

function successfulInteractionRecords(value = -1) {
  return [
    {
      body: { userId: USER_ID, value, videoId: VIDEO_ID },
      method: "POST",
      pathname: "/interact/vote",
      respondedAt: Date.now(),
      responseBody: { challenge: Buffer.alloc(16).toString("base64"), difficulty: 0 },
      responseStatus: 200,
    },
    {
      body: { solution: Buffer.alloc(4).toString("base64"), userId: USER_ID, videoId: VIDEO_ID },
      method: "POST",
      pathname: "/interact/confirmVote",
      respondedAt: Date.now(),
      responseBody: true,
      responseStatus: 200,
    },
  ];
}

function activationAdapter(records) {
  return createNavigationRuntimeContractAdapter({
    backend: {},
    expectedUserId: USER_ID,
    matrixRuntime: { name: "userscript" },
    page: { waitForTimeout: jest.fn(async () => {}) },
    postActivationQuietMs: 0,
    readInteractionRecords: () => records,
  });
}

function collectWrapperNavigationTitles(wrapperPath, runtimeName) {
  const mockSharedRegistrationCalls = [];
  const mockTitles = [];
  const mockTest = (title) => mockTitles.push(title);
  mockTest.describe = (_title, registerTests) => registerTests();

  jest.resetModules();
  jest.doMock("@playwright/test", () => ({ expect, test: mockTest }));
  jest.doMock("./navigation-runtime-contract", () => {
    const actualContract = jest.requireActual("./navigation-runtime-contract");
    return {
      ...actualContract,
      registerNavigationRuntimeContractScenarios(options) {
        mockSharedRegistrationCalls.push(options.runtimeName);
        return actualContract.registerNavigationRuntimeContractScenarios(options);
      },
    };
  });
  try {
    jest.isolateModules(() => require(wrapperPath));
  } finally {
    jest.dontMock("@playwright/test");
    jest.dontMock("./navigation-runtime-contract");
    jest.resetModules();
  }

  return {
    sharedRegistrationCalls: mockSharedRegistrationCalls,
    titles: mockTitles.filter((title) => title.startsWith(`${runtimeName} navigation matrix:`)),
  };
}

test.each(["userscript", "extension"])("registers every shared navigation scenario for %s", (runtimeName) => {
  const registrations = [];
  registerNavigationRuntimeContractScenarios({
    register: (registration) => registrations.push(registration),
    runtimeName,
  });

  expect(registrations.map(({ scenario }) => scenario.id)).toEqual(NAVIGATION_MATRIX.map(({ id }) => id));
  expect(registrations.map(({ title }) => title)).toEqual(
    NAVIGATION_MATRIX.map(({ id }) => `${runtimeName} navigation matrix: ${id}`),
  );
});

test.each([
  ["userscript", "../UserScript/e2e/userscript-navigation-matrix.e2e"],
  ["extension", "./extension/extension-artifact-navigation.e2e"],
])("the %s Playwright wrapper registers the complete shared catalog", (runtimeName, wrapperPath) => {
  const registration = collectWrapperNavigationTitles(wrapperPath, runtimeName);
  expect(registration.sharedRegistrationCalls).toEqual([runtimeName]);
  expect(registration.titles).toEqual(NAVIGATION_MATRIX.map(({ id }) => `${runtimeName} navigation matrix: ${id}`));
});

test("keeps one navigation runner for every shared scenario and no unused runners", () => {
  expect([...NAVIGATION_SCENARIO_RUNNER_IDS].sort()).toEqual(NAVIGATION_MATRIX.map(({ id }) => id).sort());
});

test("keeps every hidden-first Watch duplicate in the shared runtime registrations", () => {
  expect(NON_CURRENT_DUPLICATE_SCENARIO_IDS).toEqual([
    "watch-sidebar-watch-same-root-hidden-first",
    "watch-sidebar-watch-same-root-offscreen-first",
    "watch-sidebar-watch-legacy-segmented-duplicate-ids",
  ]);

  for (const scenarioId of NON_CURRENT_DUPLICATE_SCENARIO_IDS) {
    const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);
    expect(scenario).toMatchObject({ destination: { kind: "watch" }, origin: { kind: "watch" } });
    expect(scenario.coverage.dom).toContain("rendered-destination-second");
  }
});

test("keeps the reused Shorts renderer without a finish event in both runtime registrations", () => {
  const scenarioId = "short-next-short-reuse-renderer-start-no-finish";
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "reuse-exact-renderer",
        "reuse-exact-action-root",
        "exact-href-identity",
        "no-is-active",
      ]),
      timing: expect.arrayContaining(["navigate-start-without-finish"]),
    },
    destination: {
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
    },
    origin: { kind: "shorts" },
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });

    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test("keeps the exact current Shorts link authoritative over an unrelated description cross-link", () => {
  const scenarioId = "short-next-short-exact-href-with-description-crosslink";
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "reuse-exact-renderer",
        "reuse-exact-action-root",
        "exact-href-identity",
        "unrelated-description-short-link",
        "no-is-active",
        "no-video-id",
      ]),
      timing: expect.arrayContaining(["navigate-start-without-finish"]),
    },
    destination: {
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      unrelatedDescriptionShortVideoId: "FupY92jTfho",
    },
    origin: { kind: "shorts" },
    postcondition: "single-destination-dislike",
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });

    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test("keeps the persistent data-null exact-href Shorts recovery in both runtime registrations", () => {
  const scenarioId = "short-next-short-reuse-renderer-replace-action-root-exact-href-persistent-data-null";
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "complete-native-inventory",
        "persistent-data-null-action-root",
      ]),
      timing: expect.arrayContaining([
        "navigate-start-without-finish",
        "data-null-past-watchdog",
        "stable-native-inventory",
      ]),
    },
    destination: {
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
    },
    origin: { kind: "shorts" },
    timing: { maxFirstValidMs: 2_500, unsafeWindowMs: 520 },
    transition: {
      actionRoot: "replace-complete-native-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });

    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test("keeps the incomplete rendered-inventory persistent data-null surface inert in both runtimes", () => {
  const scenarioId = "short-next-short-persistent-data-null-nonrendered-native-stays-inert";
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "incomplete-rendered-native-inventory",
        "non-rendered-native-action",
        "persistent-data-null-action-root",
        "stable-action-root-geometry",
      ]),
      timing: expect.arrayContaining([
        "navigate-start-without-finish",
        "data-null-past-watchdog",
        "inert-beyond-fallback-window",
      ]),
    },
    destination: {
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
    },
    origin: { kind: "shorts" },
    postcondition: "no-destination-dislike",
    timing: { inertForMs: 1_700 },
    transition: {
      actionRoot: "replace-incomplete-rendered-native-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });
    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test("keeps the native-Dislike persistent data-null surface interactive in both runtimes", () => {
  const scenarioId = "short-next-short-persistent-data-null-native-dislike";
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "reuse-exact-renderer",
        "replace-action-root",
        "exact-href-identity",
        "no-is-active",
        "no-video-id",
        "native-dislike-present",
        "no-synthetic-mutation",
        "persistent-data-null-action-root",
      ]),
      timing: expect.arrayContaining([
        "navigate-start-without-finish",
        "native-dislike-after-stability",
        "native-dislike-without-synthetic-mutation",
      ]),
    },
    destination: {
      kind: "shorts",
      shortIdentity: "exact-href-without-active-or-video-id",
      shortsDislikeControl: "native",
    },
    origin: { kind: "shorts" },
    postcondition: "single-destination-dislike",
    timing: { maxFirstValidMs: 2_500, unsafeWindowMs: 520 },
    transition: {
      actionRoot: "replace-native-dislike-persistent-data-null",
      navigateFinish: "none",
      renderer: "reuse-exact-node",
    },
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });
    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test.each([
  "short-next-short-replace-root-start-no-finish-staged-hydration",
  "short-next-short-replace-root-repeated-start-no-finish-staged-hydration",
])("keeps the staged replacement-root deadlock regression in both runtime registrations: %s", (scenarioId) => {
  const scenario = NAVIGATION_MATRIX.find(({ id }) => id === scenarioId);

  expect(scenario).toMatchObject({
    coverage: {
      dom: expect.arrayContaining([
        "replace-shorts-root",
        "destination-action-root-absent",
        "staged-data-null-action-root",
        "complete-native-inventory-before-hydration",
      ]),
      timing: expect.arrayContaining([
        "navigate-start-without-finish",
        "no-controls-over-500ms",
        "data-null-over-stability-window",
      ]),
    },
    destination: { kind: "shorts" },
    origin: { kind: "shorts" },
    transition: {
      actionRoot: "absent-then-empty-then-native-then-hydrated",
      navigateFinish: "none",
      root: "replace",
    },
  });

  for (const runtimeName of ["userscript", "extension"]) {
    const registrations = [];
    registerNavigationRuntimeContractScenarios({
      register: (registration) => registrations.push(registration),
      runtimeName,
    });
    expect(
      registrations.filter(({ scenario: registeredScenario }) => registeredScenario.id === scenarioId),
    ).toHaveLength(1);
  }
});

test("budgets the deliberately delayed Shorts hydration without loosening the default navigation gate", () => {
  const delayedShorts = NAVIGATION_MATRIX.find(({ id }) => id === "watch-direct-short-delayed");
  const delayedWatch = NAVIGATION_MATRIX.find(({ id }) => id === "short-direct-watch-delayed");

  expect(delayedShorts.timing).toEqual({ controlDelayMs: 600, maxFirstValidMs: 1_250 });
  expect(delayedWatch.timing).toEqual({ controlDelayMs: 600 });
});

test("accepts one exact successful activation handshake", async () => {
  const records = [];
  const target = {
    click: jest.fn(async () => records.push(...successfulInteractionRecords())),
  };

  await expect(expectSuccessfulVoteActivation(activationAdapter(records), VIDEO_ID, -1, target)).resolves.toMatchObject(
    {
      confirmationCount: 1,
      interactionCount: 2,
      sharedUserId: USER_ID,
      voteCount: 1,
    },
  );
});

test.each([
  ["a duplicate chain", (records) => records.push(...successfulInteractionRecords())],
  ["a false confirmation", (records) => (records[1].responseBody = false)],
  ["the wrong video", (records) => (records[0].body.videoId = "zyxwvutsrqp")],
])("rejects %s", async (_label, corrupt) => {
  const records = [];
  const target = {
    click: jest.fn(async () => {
      records.push(...successfulInteractionRecords());
      corrupt(records);
    }),
  };

  await expect(expectSuccessfulVoteActivation(activationAdapter(records), VIDEO_ID, -1, target)).rejects.toThrow(
    /duplicate, malformed, or failed vote chain/,
  );
});

test("rejects an adapter that could not prove expected credential persistence", () => {
  expect(() =>
    createNavigationRuntimeContractAdapter({
      backend: {},
      expectedCredentials: { registrationConfirmed: true, userId: USER_ID },
      matrixRuntime: { name: "userscript" },
      page: {},
      readInteractionRecords: () => [],
    }),
  ).toThrow("Expected credentials require a readCredentials() adapter.");
});
