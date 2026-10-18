const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  DEFAULT_LIVE_NAV_CHANNEL_URL,
  DEFAULT_LIVE_NAV_SHORT,
  DEFAULT_LIVE_SIDEBAR_HOPS,
  DEFAULT_LIVE_SHORTS_NEXT_HOPS,
  DEFAULT_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
  LIVE_VOTE_APPROVALS_DIRECTORY,
  LIVE_VOTE_APPROVAL_WINDOW_SECONDS,
  consumeLiveVoteApproval,
  hasFreshVoteApproval,
  liveVoteApproval,
  readExpectedBuildId,
  readLiveOptions: readLiveOptionsFromEnvironment,
} = require("./live-options");

const NOW = Date.parse("2026-08-08T12:00:00.000Z");
const EXPECTED_BUILD_ID = "0123456789abcdef0123456789abcdef";

const VALID_ENVIRONMENT = {
  RYD_LIVE_YOUTUBE: "1",
  RYD_LIVE_PRODUCTION_API: "1",
  RYD_LIVE_RUNTIME: "userscript",
  RYD_LIVE_WATCH_A: "abcdefghijk",
  RYD_LIVE_WATCH_B: "zyxwvutsrqp",
  RYD_LIVE_SHORT: "shortsabcde",
  RYD_LIVE_NAV_WATCH: "navwatch001",
  RYD_LIVE_PLAYLIST_URL: "https://www.youtube.com/watch?v=abcdefghijk&list=PL-test",
  RYD_LIVE_EXPECTED_CHANNEL: "@ryd-test",
};

function readLiveOptions(environment, nowMilliseconds = NOW) {
  return readLiveOptionsFromEnvironment(environment, nowMilliseconds, {
    readBuildId: () => EXPECTED_BUILD_ID,
    resolveEndpoint: (value) => value,
  });
}

describe("live YouTube options", () => {
  test("reads the exact generated build ID from the selected runtime marker", () => {
    const readFileSync = jest.fn(() => JSON.stringify({ buildId: EXPECTED_BUILD_ID }));
    const assertArtifactCurrent = jest.fn();

    expect(
      readExpectedBuildId("userscript", {
        assertArtifactCurrent,
        markerPaths: { userscript: "owned-live-build.json" },
        readFileSync,
      }),
    ).toBe(EXPECTED_BUILD_ID);
    expect(readFileSync).toHaveBeenCalledWith("owned-live-build.json", "utf8");
    expect(assertArtifactCurrent).toHaveBeenCalledWith("userscript", EXPECTED_BUILD_ID);
  });

  test.each([
    [
      "missing",
      () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
      /Cannot read/,
    ],
    ["invalid JSON", () => "not JSON", /Cannot read/],
    ["malformed ID", () => JSON.stringify({ buildId: "stale" }), /is malformed/],
  ])("rejects a %s generated live-build marker", (_label, readFileSync, expectedMessage) => {
    expect(() =>
      readExpectedBuildId("extension", {
        assertArtifactCurrent: jest.fn(),
        markerPaths: { extension: "owned-live-build.json" },
        readFileSync,
      }),
    ).toThrow(expectedMessage);
  });

  test("rejects a live marker when the corresponding artifact receipt is stale", () => {
    const staleArtifact = new Error("Userscript build inputs changed after the artifact was generated.");
    const assertArtifactCurrent = jest.fn(() => {
      throw staleArtifact;
    });

    expect(() =>
      readExpectedBuildId("userscript", {
        assertArtifactCurrent,
        markerPaths: { userscript: "owned-live-build.json" },
        readFileSync: () => JSON.stringify({ buildId: EXPECTED_BUILD_ID }),
      }),
    ).toThrow(staleArtifact);
    expect(assertArtifactCurrent).toHaveBeenCalledWith("userscript", EXPECTED_BUILD_ID);
  });

  test("stores consumed vote approvals outside Playwright's cleaned output directory", () => {
    const playwrightOutputDirectory = path.resolve(__dirname, "../../../test-results/live-youtube");
    expect(LIVE_VOTE_APPROVALS_DIRECTORY).not.toBe(playwrightOutputDirectory);
    expect(LIVE_VOTE_APPROVALS_DIRECTORY.startsWith(`${playwrightOutputDirectory}${path.sep}`)).toBe(false);
  });

  test("stays disabled unless explicitly opted in", () => {
    expect(readLiveOptions({})).toBeNull();
  });

  test("defaults to the currently verified high-volume channel navigation fixture", () => {
    expect(DEFAULT_LIVE_NAV_CHANNEL_URL).toBe("https://www.youtube.com/@MrBeast");
    expect(DEFAULT_LIVE_NAV_SHORT).toBe("5mU6SRS2Bxo");
  });

  test("requires production API acknowledgement", () => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_PRODUCTION_API: undefined })).toThrow(
      "RYD_LIVE_PRODUCTION_API=1",
    );
  });

  test.each(["", "tampermonkey", "chrome"])("rejects unsupported runtime %p", (runtime) => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_RUNTIME: runtime })).toThrow(/RYD_LIVE_RUNTIME/);
  });

  test("requires distinct valid video IDs", () => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_SHORT: "too-short" })).toThrow(
      "11-character YouTube video ID",
    );
    expect(() =>
      readLiveOptions({
        ...VALID_ENVIRONMENT,
        RYD_LIVE_WATCH_B: VALID_ENVIRONMENT.RYD_LIVE_WATCH_A,
      }),
    ).toThrow("must be different videos");
  });

  test("requires a playlist URL anchored at watch A", () => {
    expect(() =>
      readLiveOptions({
        ...VALID_ENVIRONMENT,
        RYD_LIVE_PLAYLIST_URL: "https://www.youtube.com/watch?v=zyxwvutsrqp&list=PL-test",
      }),
    ).toThrow("for RYD_LIVE_WATCH_A");
  });

  test("requires the expected signed-in channel handle", () => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_EXPECTED_CHANNEL: "not-a-handle" })).toThrow(
      "public @handle",
    );
  });

  test.each(["userscript", "extension"])("accepts the %s runtime", (runtime) => {
    expect(readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_RUNTIME: runtime })).toMatchObject({
      cdpEndpoint: "chrome",
      cdpConnectTimeoutMilliseconds: DEFAULT_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
      expectedBuildId: EXPECTED_BUILD_ID,
      navigation: {
        channelUrl: DEFAULT_LIVE_NAV_CHANNEL_URL,
        short: DEFAULT_LIVE_NAV_SHORT,
        shortsNextHops: DEFAULT_LIVE_SHORTS_NEXT_HOPS,
        watch: "navwatch001",
      },
      reactionShort: "shortsabcde",
      runtime,
      sidebar: { hopCount: DEFAULT_LIVE_SIDEBAR_HOPS },
      short: "shortsabcde",
      watchA: "abcdefghijk",
      watchB: "zyxwvutsrqp",
    });
  });

  test("takes the exact build ID from the generated marker and ignores environment attempts to bless a stale build", () => {
    const readBuildId = jest.fn(() => EXPECTED_BUILD_ID);
    const result = readLiveOptionsFromEnvironment(
      { ...VALID_ENVIRONMENT, RYD_LIVE_EXPECTED_BUILD_ID: "f".repeat(32) },
      NOW,
      { readBuildId, resolveEndpoint: (value) => value },
    );

    expect(readBuildId).toHaveBeenCalledWith("userscript");
    expect(result.expectedBuildId).toBe(EXPECTED_BUILD_ID);
  });

  test("resolves the configured browser endpoint with the same environment used for live options", () => {
    const resolveEndpoint = jest.fn(() => "ws://127.0.0.1:60011/devtools/browser/session");
    const environment = { ...VALID_ENVIRONMENT, RYD_CDP_ENDPOINT: " 127.0.0.1:60011 " };

    const result = readLiveOptionsFromEnvironment(environment, NOW, {
      readBuildId: () => EXPECTED_BUILD_ID,
      resolveEndpoint,
    });

    expect(resolveEndpoint).toHaveBeenCalledWith("127.0.0.1:60011", { environment });
    expect(result.cdpEndpoint).toBe("ws://127.0.0.1:60011/devtools/browser/session");
  });

  test("accepts a bounded remote-debugging approval timeout", () => {
    expect(readLiveOptions({ ...VALID_ENVIRONMENT, RYD_CDP_CONNECT_TIMEOUT_MS: "180000" })).toMatchObject({
      cdpConnectTimeoutMilliseconds: 180_000,
    });
  });

  test.each(["0", "14999", "300001", "1.5", "two minutes", "-1"])(
    "rejects invalid remote-debugging approval timeout %p",
    (timeout) => {
      expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_CDP_CONNECT_TIMEOUT_MS: timeout })).toThrow(
        /RYD_CDP_CONNECT_TIMEOUT_MS.*whole number from 15000 to 300000/,
      );
    },
  );

  test("accepts a bounded sidebar stress hop count", () => {
    expect(readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_SIDEBAR_HOPS: "5" })).toMatchObject({
      sidebar: { hopCount: 5 },
    });
  });

  test("defaults the live Shorts stress to ten successful Next samples", () => {
    expect(readLiveOptions(VALID_ENVIRONMENT)).toMatchObject({
      navigation: { shortsNextHops: 10 },
    });
  });

  test("accepts a larger bounded successful live Shorts Next count", () => {
    expect(readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_SHORTS_NEXT_HOPS: "15" })).toMatchObject({
      navigation: { shortsNextHops: 15 },
    });
  });

  test.each(["0", "1", "9", "26", "10.5", "three", "-1"])(
    "rejects live Shorts Next count below ten or outside the bound: %p",
    (hopCount) => {
      expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_SHORTS_NEXT_HOPS: hopCount })).toThrow(
        /RYD_LIVE_SHORTS_NEXT_HOPS.*whole number from 10 to 25/,
      );
    },
  );

  test.each(["0", "11", "1.5", "three", "-1"])("rejects invalid sidebar stress hop count %p", (hopCount) => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_SIDEBAR_HOPS: hopCount })).toThrow(
      /RYD_LIVE_SIDEBAR_HOPS.*whole number from 1 to 10/,
    );
  });

  test("accepts an exact, safely scoped channel-navigation dataset", () => {
    expect(
      readLiveOptions({
        ...VALID_ENVIRONMENT,
        RYD_LIVE_NAV_CHANNEL_URL: "https://youtube.com/@ryd-test/shorts",
        RYD_LIVE_NAV_SHORT: "navshort001",
        RYD_LIVE_NAV_WATCH: "navwatch001",
      }),
    ).toMatchObject({
      navigation: {
        channelUrl: "https://www.youtube.com/@ryd-test/shorts",
        short: "navshort001",
        watch: "navwatch001",
      },
    });
  });

  test("accepts a dedicated reaction Short without changing the read-only Short", () => {
    expect(readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_REACTION_SHORT: "reactshort1" })).toMatchObject({
      reactionShort: "reactshort1",
      short: "shortsabcde",
    });
  });

  test.each(["invalid", "abcdefghij!", "abcdefghijkl"])("rejects malformed reaction Short ID %p", (videoId) => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_REACTION_SHORT: videoId })).toThrow(
      "RYD_LIVE_REACTION_SHORT must be an 11-character YouTube video ID",
    );
  });

  test.each([
    "http://www.youtube.com/@SmashTrash",
    "https://example.com/@SmashTrash",
    "https://www.youtube.com.evil.example/@SmashTrash",
    "https://www.youtube.com/channel/UC-not-a-handle",
    "https://www.youtube.com/@SmashTrash/playlists",
    "https://www.youtube.com/@SmashTrash?app=desktop",
  ])("rejects unsafe or non-deterministic navigation channel URL %p", (channelUrl) => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_NAV_CHANNEL_URL: channelUrl })).toThrow(
      /RYD_LIVE_NAV_CHANNEL_URL/,
    );
  });

  test("requires an exact channel Watch target", () => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, RYD_LIVE_NAV_WATCH: undefined })).toThrow(
      "RYD_LIVE_NAV_WATCH is required",
    );
  });

  test.each(["RYD_LIVE_NAV_SHORT", "RYD_LIVE_NAV_WATCH"])("validates navigation ID %s", (name) => {
    expect(() => readLiveOptions({ ...VALID_ENVIRONMENT, [name]: "invalid" })).toThrow("11-character YouTube video ID");
  });

  test("accepts only a fresh runtime-and-video-specific vote approval", () => {
    const nowSeconds = Math.floor(NOW / 1000);
    const validApproval = liveVoteApproval("userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, nowSeconds);
    expect(hasFreshVoteApproval(validApproval, "userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, NOW)).toBe(true);

    for (const approval of [
      liveVoteApproval("extension", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, nowSeconds),
      liveVoteApproval("userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_A, nowSeconds),
      liveVoteApproval(
        "userscript",
        VALID_ENVIRONMENT.RYD_LIVE_WATCH_B,
        nowSeconds - LIVE_VOTE_APPROVAL_WINDOW_SECONDS - 1,
      ),
    ]) {
      expect(hasFreshVoteApproval(approval, "userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, NOW)).toBe(false);
    }

    const futureApproval = liveVoteApproval("userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, nowSeconds + 1);
    expect(hasFreshVoteApproval(futureApproval, "userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, NOW)).toBe(false);
  });

  test("consumes a fresh vote approval only once", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ryd-live-approval-"));
    const approval = liveVoteApproval("userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, Math.floor(NOW / 1000));
    try {
      const settings = { nowMilliseconds: NOW, usedApprovalsDirectory: directory };
      expect(consumeLiveVoteApproval(approval, "userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, settings)).toBe(true);
      expect(consumeLiveVoteApproval(approval, "userscript", VALID_ENVIRONMENT.RYD_LIVE_WATCH_B, settings)).toBe(false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
