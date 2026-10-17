const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const {
  assertReusableConnectionOptions,
  closeLiveAttemptPage,
  createInputLineReader,
  createInteractiveLiveDriver,
  createInteractiveVoteRecorderFactory,
  createReactionTargetDetails,
  formatReactionApprovalReadiness,
  main,
  normalizeLiveSessionCommand,
  preserveLiveAttemptEvidence,
  readPersistentSessionMode,
  resetLiveAttemptEvidenceWorkspace,
  resolveSafeLiveEvidenceDirectory,
} = require("../e2e/live/live-interactive-runner");

const SELECTED_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const EXPECTED_BUILD_ID = "0123456789abcdef0123456789abcdef";

function createOutput() {
  return { error: jest.fn(), log: jest.fn() };
}

function createLiveOptions(overrides = {}) {
  return {
    cdpConnectTimeoutMilliseconds: 120_000,
    cdpEndpoint: "ws://127.0.0.1:60011/devtools/browser/session",
    expectedBuildId: EXPECTED_BUILD_ID,
    expectedChannel: "@anarios-ryd",
    runtime: "extension",
    ...overrides,
  };
}

function createContext() {
  return {
    off: jest.fn(),
    on: jest.fn(),
    pages: jest.fn(() => []),
  };
}

function createPage() {
  return {
    setDefaultNavigationTimeout: jest.fn(),
    setDefaultTimeout: jest.fn(),
  };
}

describe("interactive live runtime binding", () => {
  test("reports the dedicated reaction targets without conflating the read-only Short", () => {
    const options = {
      reactionShort: "reactshort1",
      runtime: "extension",
      short: "readonly001",
      watchB: "reaction001",
    };

    expect(createReactionTargetDetails(options)).toEqual({
      reactionShort: "reactshort1",
      reactionWatch: "reaction001",
    });
    expect(formatReactionApprovalReadiness(options)).toBe(
      "READY_FOR_REACTION_APPROVAL runtime=extension watch=reaction001 reactionShort=reactshort1 readOnlyShort=readonly001",
    );
  });

  test("passes the selected account and exact extension ID into the live driver", () => {
    const context = createContext();
    const diagnostics = { checkpoint: jest.fn() };
    const page = createPage();
    const driver = createInteractiveLiveDriver({
      context,
      diagnostics,
      options: { expectedBuildId: EXPECTED_BUILD_ID, expectedChannel: "@Expected.Handle", runtime: "extension" },
      page,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });

    expect(driver.authenticatedHandle).toBe("@expected.handle");
    expect(driver.expectedBuildId).toBe(EXPECTED_BUILD_ID);
    expect(driver.selectedExtensionId).toBe(SELECTED_EXTENSION_ID);
    expect(() => driver.configureRequestAttributionRuntime("extension")).not.toThrow();
  });

  test("passes the same exact extension ID and selected page into every vote recorder", () => {
    const context = createContext();
    const page = createPage();
    const createRecorder = createInteractiveVoteRecorderFactory({
      context,
      driver: { trafficLedger: null },
      options: { runtime: "extension" },
      page,
      selectedExtensionId: SELECTED_EXTENSION_ID,
    });

    const recorder = createRecorder("abcdefghijk");

    expect(recorder.page).toBe(page);
    expect(recorder.runtime).toBe("extension");
    expect(recorder.selectedExtensionId).toBe(SELECTED_EXTENSION_ID);
    expect(recorder.videoId).toBe("abcdefghijk");
    recorder.stop();
  });

  test("cannot create an extension vote recorder without the selected extension ID", () => {
    const createRecorder = createInteractiveVoteRecorderFactory({
      context: createContext(),
      driver: { trafficLedger: null },
      options: { runtime: "extension" },
      page: createPage(),
      selectedExtensionId: null,
    });

    expect(() => createRecorder("abcdefghijk")).toThrow(/requires the exact selected extension ID/);
  });

  test("keeps userscript recorders page-bound without inventing an extension identity", () => {
    const context = createContext();
    const page = createPage();
    const createRecorder = createInteractiveVoteRecorderFactory({
      context,
      driver: { trafficLedger: null },
      options: { runtime: "userscript" },
      page,
      selectedExtensionId: null,
    });

    const recorder = createRecorder("abcdefghijk");

    expect(recorder.page).toBe(page);
    expect(recorder.runtime).toBe("userscript");
    expect(recorder.selectedExtensionId).toBeNull();
    recorder.stop();
  });
});

describe("interactive live attempt cleanup", () => {
  test("closes a live-attempt page within the configured bound", async () => {
    const page = {
      close: jest.fn().mockResolvedValue(undefined),
      isClosed: jest.fn(() => false),
    };

    await expect(closeLiveAttemptPage(page, { timeoutMs: 50 })).resolves.toBe(true);
    expect(page.close).toHaveBeenCalledTimes(1);
  });

  test("does not try to close an already-closed live-attempt page", async () => {
    const page = {
      close: jest.fn(),
      isClosed: jest.fn(() => true),
    };

    await expect(closeLiveAttemptPage(page, { timeoutMs: 50 })).resolves.toBe(false);
    expect(page.close).not.toHaveBeenCalled();
  });

  test("rejects within the configured bound when page close never settles", async () => {
    const page = {
      close: jest.fn(() => new Promise(() => {})),
      isClosed: jest.fn(() => false),
    };

    await expect(closeLiveAttemptPage(page, { timeoutMs: 10 })).rejects.toThrow(
      "Timed out after 10ms while closing the live-attempt test page.",
    );
  });
});

describe("persistent interactive live session", () => {
  test("buffers multiple control lines on one stdin reader for the whole connected process", async () => {
    const input = new PassThrough();
    const reader = createInputLineReader(input);
    input.write("first\nRERUN\n");

    await expect(reader.readLine()).resolves.toBe("first");
    await expect(reader.readLine()).resolves.toBe("RERUN");
    input.end();
    await expect(reader.readLine()).resolves.toBeNull();
    reader.close();
  });

  test.each([
    [{ RYD_LIVE_RUNTIME: "extension" }, false],
    [{ RYD_LIVE_KEEP_CDP_SESSION: "", RYD_LIVE_RUNTIME: "extension" }, false],
    [{ RYD_LIVE_KEEP_CDP_SESSION: "1", RYD_LIVE_RUNTIME: "extension" }, true],
  ])("reads the opt-in without changing default behavior", (environment, expected) => {
    expect(readPersistentSessionMode(environment)).toBe(expected);
  });

  test.each(["true", "yes", "0", "2"])("rejects invalid persistent-session value %s", (configured) => {
    expect(() => readPersistentSessionMode({ RYD_LIVE_KEEP_CDP_SESSION: configured })).toThrow(/must be 1 or unset/);
  });

  test.each([
    ["RERUN", "RERUN"],
    [" rerun ", "RERUN"],
    ["exit", "EXIT"],
    [null, "EXIT"],
    ["", null],
    ["again", null],
  ])("normalizes persistent-session command %p", (value, expected) => {
    expect(normalizeLiveSessionCommand(value)).toBe(expected);
  });

  test("keeps one browser connection across a failed attempt and a complete rerun", async () => {
    const firstOptions = createLiveOptions();
    const secondOptions = createLiveOptions({ expectedBuildId: "fedcba9876543210fedcba9876543210" });
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    const selectedSession = { context: {}, contextIndex: 0, pageIndex: 1, sessionPage: {} };
    const buildArtifact = jest
      .fn()
      .mockReturnValueOnce({ runtime: "extension", script: "build:live:extension", attempt: 1 })
      .mockReturnValueOnce({ runtime: "extension", script: "build:live:extension", attempt: 2 });
    const connectBrowser = jest.fn().mockResolvedValue(browser);
    const executeAttempt = jest
      .fn()
      .mockRejectedValueOnce(new Error("first live attempt failed"))
      .mockResolvedValueOnce({ classification: "full", attempt: 2 });
    const output = createOutput();
    const preserveEvidence = jest
      .fn()
      .mockResolvedValueOnce("attempt-01-failed")
      .mockResolvedValueOnce("attempt-02-passed");
    const resetEvidenceWorkspace = jest
      .fn()
      .mockResolvedValueOnce({ removedEntries: ["stale-first"] })
      .mockResolvedValueOnce({ removedEntries: ["stale-second"] });
    const readLine = jest.fn().mockResolvedValueOnce("RERUN").mockResolvedValueOnce("EXIT");
    const readOptions = jest.fn().mockReturnValueOnce(firstOptions).mockReturnValueOnce(secondOptions);
    const selectContext = jest.fn().mockResolvedValue(selectedSession);

    await expect(
      main({
        buildArtifact,
        connectBrowser,
        environment: { RYD_LIVE_KEEP_CDP_SESSION: "1", RYD_LIVE_RUNTIME: "extension" },
        executeAttempt,
        output,
        preserveEvidence,
        readLine,
        readOptions,
        resetEvidenceWorkspace,
        selectContext,
      }),
    ).resolves.toEqual({ classification: "full", attempt: 2 });

    expect(buildArtifact).toHaveBeenCalledTimes(2);
    expect(readOptions).toHaveBeenCalledTimes(2);
    expect(connectBrowser).toHaveBeenCalledTimes(1);
    expect(selectContext).toHaveBeenCalledTimes(1);
    expect(executeAttempt).toHaveBeenCalledTimes(2);
    expect(resetEvidenceWorkspace).toHaveBeenNthCalledWith(1, { attemptNumber: 1 });
    expect(resetEvidenceWorkspace).toHaveBeenNthCalledWith(2, { attemptNumber: 2 });
    expect(resetEvidenceWorkspace.mock.invocationCallOrder[0]).toBeLessThan(executeAttempt.mock.invocationCallOrder[0]);
    expect(preserveEvidence.mock.invocationCallOrder[0]).toBeLessThan(
      resetEvidenceWorkspace.mock.invocationCallOrder[1],
    );
    expect(resetEvidenceWorkspace.mock.invocationCallOrder[1]).toBeLessThan(executeAttempt.mock.invocationCallOrder[1]);
    expect(executeAttempt.mock.calls[0][0]).toMatchObject({ browser, options: firstOptions, selectedSession });
    expect(executeAttempt.mock.calls[1][0]).toMatchObject({ browser, options: secondOptions, selectedSession });
    expect(preserveEvidence).toHaveBeenNthCalledWith(1, { attemptNumber: 1, outcome: "failed" });
    expect(preserveEvidence).toHaveBeenNthCalledWith(2, { attemptNumber: 2, outcome: "passed" });
    expect(output.log).toHaveBeenCalledWith("READY_FOR_LIVE_RERUN_OR_EXIT attempt=1 outcome=failed");
    expect(output.log).toHaveBeenCalledWith("READY_FOR_LIVE_RERUN_OR_EXIT attempt=2 outcome=passed");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("retains normal one-attempt exit and failure semantics when persistence is unset", async () => {
    const options = createLiveOptions();
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    const failure = new Error("strict live failure");
    const executeAttempt = jest.fn().mockRejectedValue(failure);
    const preserveEvidence = jest.fn();
    const readLine = jest.fn();

    await expect(
      main({
        buildArtifact: jest.fn(() => ({ runtime: "extension" })),
        connectBrowser: jest.fn().mockResolvedValue(browser),
        environment: { RYD_LIVE_RUNTIME: "extension" },
        executeAttempt,
        output: createOutput(),
        preserveEvidence,
        readLine,
        readOptions: jest.fn(() => options),
        resetEvidenceWorkspace: jest.fn().mockResolvedValue({ removedEntries: [] }),
        selectContext: jest.fn(async () => ({ context: {}, contextIndex: 0, pageIndex: 0, sessionPage: {} })),
      }),
    ).rejects.toBe(failure);

    expect(executeAttempt).toHaveBeenCalledTimes(1);
    expect(preserveEvidence).not.toHaveBeenCalled();
    expect(readLine).not.toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("returns the latest failed attempt as a failure when a persistent session exits", async () => {
    const options = createLiveOptions();
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    const failure = new Error("persistent live failure");

    await expect(
      main({
        buildArtifact: jest.fn(() => ({ runtime: "extension" })),
        connectBrowser: jest.fn().mockResolvedValue(browser),
        environment: { RYD_LIVE_KEEP_CDP_SESSION: "1", RYD_LIVE_RUNTIME: "extension" },
        executeAttempt: jest.fn().mockRejectedValue(failure),
        output: createOutput(),
        preserveEvidence: jest.fn().mockResolvedValue("attempt-01-failed"),
        readLine: jest.fn().mockResolvedValue("EXIT"),
        readOptions: jest.fn(() => options),
        resetEvidenceWorkspace: jest.fn().mockResolvedValue({ removedEntries: [] }),
        selectContext: jest.fn(async () => ({ context: {}, contextIndex: 0, pageIndex: 0, sessionPage: {} })),
      }),
    ).rejects.toBe(failure);

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("keeps the connection open while rejecting unknown rerun commands", async () => {
    const options = createLiveOptions();
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    const output = createOutput();
    const executeAttempt = jest.fn().mockResolvedValue({ classification: "full" });
    const readLine = jest
      .fn()
      .mockResolvedValueOnce("not-a-command")
      .mockResolvedValueOnce("RERUN")
      .mockResolvedValueOnce("EXIT");

    await main({
      buildArtifact: jest.fn(() => ({ runtime: "extension" })),
      connectBrowser: jest.fn().mockResolvedValue(browser),
      environment: { RYD_LIVE_KEEP_CDP_SESSION: "1", RYD_LIVE_RUNTIME: "extension" },
      executeAttempt,
      output,
      preserveEvidence: jest.fn().mockResolvedValue("evidence"),
      readLine,
      readOptions: jest.fn(() => options),
      resetEvidenceWorkspace: jest.fn().mockResolvedValue({ removedEntries: [] }),
      selectContext: jest.fn(async () => ({ context: {}, contextIndex: 0, pageIndex: 0, sessionPage: {} })),
    });

    expect(output.error).toHaveBeenCalledWith("LIVE_RERUN_COMMAND_REJECTED expected=RERUN_OR_EXIT");
    expect(executeAttempt).toHaveBeenCalledTimes(2);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test("fails closed if a rerun tries to switch endpoint, account, or runtime", () => {
    const initial = createLiveOptions();
    expect(() => assertReusableConnectionOptions(initial, { ...initial, cdpEndpoint: "ws://other" })).toThrow(
      /cdpEndpoint changed/,
    );
    expect(() => assertReusableConnectionOptions(initial, { ...initial, expectedChannel: "@other" })).toThrow(
      /expectedChannel changed/,
    );
    expect(() => assertReusableConnectionOptions(initial, { ...initial, runtime: "userscript" })).toThrow(
      /runtime changed/,
    );
    expect(assertReusableConnectionOptions(initial, { ...initial, expectedBuildId: "f".repeat(32) })).toMatchObject({
      expectedBuildId: "f".repeat(32),
    });
  });

  test("copies each persistent attempt's evidence without recursively copying prior attempt archives", () => {
    const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-live-attempt-"));
    try {
      fs.mkdirSync(path.join(evidenceDirectory, "responsive"), { recursive: true });
      fs.writeFileSync(path.join(evidenceDirectory, "responsive", "watch.png"), "image");
      fs.mkdirSync(path.join(evidenceDirectory, "attempts", "old"), { recursive: true });
      fs.writeFileSync(path.join(evidenceDirectory, "attempts", "old", "old.json"), "{}");
      const fixedDate = new Date("2026-09-04T12:00:00.000Z");

      const archived = preserveLiveAttemptEvidence(
        { attemptNumber: 3, outcome: "failed" },
        { evidenceDirectory, now: () => fixedDate },
      );

      expect(archived).toBe(path.join(evidenceDirectory, "attempts", "03-2026-09-04T12-00-00-000Z-failed"));
      expect(fs.readFileSync(path.join(archived, "responsive", "watch.png"), "utf8")).toBe("image");
      expect(fs.existsSync(path.join(archived, "attempts", "old", "old.json"))).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(archived, "attempt.json"), "utf8"))).toEqual({
        attemptNumber: 3,
        capturedAt: fixedDate.toISOString(),
        outcome: "failed",
      });
    } finally {
      fs.rmSync(evidenceDirectory, { force: true, recursive: true });
    }
  });

  test("removes only the active attempt workspace while preserving every prior attempt archive", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-live-reset-"));
    const evidenceDirectory = path.join(temporaryRoot, "live-youtube");
    try {
      fs.mkdirSync(path.join(evidenceDirectory, "responsive"), { recursive: true });
      fs.writeFileSync(path.join(evidenceDirectory, "responsive", "stale-watch.png"), "stale image");
      fs.writeFileSync(path.join(evidenceDirectory, "manual-persistent.png"), "stale manual image");
      fs.mkdirSync(path.join(evidenceDirectory, "Attempts", "01-passed"), { recursive: true });
      fs.writeFileSync(path.join(evidenceDirectory, "Attempts", "01-passed", "attempt.json"), "{}");

      const reset = resetLiveAttemptEvidenceWorkspace(
        { attemptNumber: 2 },
        { allowedParentDirectory: temporaryRoot, evidenceDirectory },
      );

      expect(reset).toEqual({
        attemptNumber: 2,
        evidenceDirectory: fs.realpathSync.native(evidenceDirectory),
        removedEntries: ["manual-persistent.png", "responsive"],
      });
      expect(fs.readdirSync(evidenceDirectory).map((entry) => entry.toLowerCase())).toEqual(["attempts"]);
      expect(fs.readFileSync(path.join(evidenceDirectory, "Attempts", "01-passed", "attempt.json"), "utf8")).toBe("{}");
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });

  test("fails closed for filesystem roots, the repository root, and broader evidence parents", () => {
    const repositoryDirectory = path.resolve(__dirname, "../../..");
    const filesystemRoot = path.parse(repositoryDirectory).root;

    expect(() => resolveSafeLiveEvidenceDirectory(filesystemRoot)).toThrow(/unsafe live evidence directory/);
    expect(() => resolveSafeLiveEvidenceDirectory(repositoryDirectory)).toThrow(/unsafe live evidence directory/);
    expect(() => resolveSafeLiveEvidenceDirectory(path.join(repositoryDirectory, "test-results"))).toThrow(
      /unsafe live evidence directory/,
    );
  });

  test("refuses an unrelated directory merely named live-youtube without deleting its contents", () => {
    const unrelatedParent = fs.mkdtempSync(path.join(os.tmpdir(), "unrelated-live-evidence-"));
    const unrelatedEvidence = path.join(unrelatedParent, "live-youtube");
    const protectedFile = path.join(unrelatedEvidence, "keep.txt");
    try {
      fs.mkdirSync(unrelatedEvidence, { recursive: true });
      fs.writeFileSync(protectedFile, "keep");

      expect(() =>
        resetLiveAttemptEvidenceWorkspace({ attemptNumber: 1 }, { evidenceDirectory: unrelatedEvidence }),
      ).toThrow(/unsafe live evidence directory/);
      expect(fs.readFileSync(protectedFile, "utf8")).toBe("keep");
    } finally {
      fs.rmSync(unrelatedParent, { force: true, recursive: true });
    }
  });
});
