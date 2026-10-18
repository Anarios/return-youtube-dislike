const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const extensionPackage = require("../../../package.json");
const userscriptVersion = require("../userscript-version.json");
const { assertCurrentLiveArtifact } = require("../e2e/live/live-artifact-readiness");
const { resolveCdpEndpoint } = require("./live-cdp-endpoint");
const {
  DEFAULT_LIVE_SHORTS_NEXT_HOPS,
  MAX_LIVE_SHORTS_NEXT_HOPS,
  MIN_LIVE_SHORTS_NEXT_HOPS,
} = require("./live-navigation-constants");

const LIVE_VOTE_APPROVAL_WINDOW_SECONDS = 120;
const LIVE_VOTE_APPROVALS_DIRECTORY = path.resolve(__dirname, "../../../test-results/live-youtube-vote-approvals");
const DEFAULT_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS = 120_000;
const MIN_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS = 15_000;
const MAX_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS = 300_000;
const DEFAULT_LIVE_NAV_CHANNEL_URL = "https://www.youtube.com/@MrBeast";
const DEFAULT_LIVE_NAV_SHORT = "5mU6SRS2Bxo";
const DEFAULT_LIVE_SIDEBAR_HOPS = 3;
const MAX_LIVE_SIDEBAR_HOPS = 10;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const LIVE_BUILD_ID_PATTERN = /^[a-f0-9]{32}$/;
const SUPPORTED_RUNTIMES = new Set(["userscript", "extension"]);
const LIVE_BUILD_MARKER_PATHS = {
  extension: path.resolve(__dirname, "../../combined/dist/chrome/live-build.json"),
  userscript: path.resolve(__dirname, "../../../test-results/live-build/userscript/live-build.json"),
};

function requireValue(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for the live YouTube smoke suite.`);
  return value;
}

function requireVideoId(environment, name) {
  const value = requireValue(environment, name);
  if (!VIDEO_ID_PATTERN.test(value)) {
    throw new Error(`${name} must be an 11-character YouTube video ID.`);
  }
  return value;
}

function optionalBoundedInteger(environment, name, defaultValue, maximum, minimum = 1) {
  const rawValue = environment[name]?.trim();
  if (!rawValue) return defaultValue;
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function requireChannelHandle(environment) {
  const value = requireValue(environment, "RYD_LIVE_EXPECTED_CHANNEL");
  if (!/^@[A-Za-z0-9._-]{3,100}$/.test(value)) {
    throw new Error("RYD_LIVE_EXPECTED_CHANNEL must be the public @handle of the signed-in YouTube test channel.");
  }
  return value;
}

function liveVoteApproval(runtime, videoId, unixSeconds) {
  return `${runtime}:${videoId}:${unixSeconds}`;
}

function hasFreshVoteApproval(value, runtime, videoId, nowMilliseconds) {
  if (!value) return false;
  const [approvedRuntime, approvedVideoId, approvedAt, ...rest] = value.split(":");
  if (rest.length || approvedRuntime !== runtime || approvedVideoId !== videoId) return false;

  const approvedAtSeconds = Number(approvedAt);
  if (!Number.isSafeInteger(approvedAtSeconds)) return false;
  const ageSeconds = Math.floor(nowMilliseconds / 1000) - approvedAtSeconds;
  return ageSeconds >= 0 && ageSeconds <= LIVE_VOTE_APPROVAL_WINDOW_SECONDS;
}

function consumeLiveVoteApproval(
  value,
  runtime,
  videoId,
  { nowMilliseconds = Date.now(), usedApprovalsDirectory } = {},
) {
  if (!hasFreshVoteApproval(value, runtime, videoId, nowMilliseconds)) return false;

  const directory = usedApprovalsDirectory || LIVE_VOTE_APPROVALS_DIRECTORY;
  fs.mkdirSync(directory, { recursive: true });
  const approvalHash = crypto.createHash("sha256").update(value).digest("hex");
  try {
    fs.writeFileSync(path.join(directory, approvalHash), `${runtime}:${videoId}\n`, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

function parsePlaylistUrl(value, watchVideoId) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RYD_LIVE_PLAYLIST_URL must be a valid HTTPS YouTube watch URL.");
  }

  if (
    url.protocol !== "https:" ||
    !["www.youtube.com", "youtube.com"].includes(url.hostname) ||
    url.pathname !== "/watch" ||
    url.searchParams.get("v") !== watchVideoId ||
    !url.searchParams.get("list")
  ) {
    throw new Error(
      "RYD_LIVE_PLAYLIST_URL must be an HTTPS YouTube watch URL for RYD_LIVE_WATCH_A with a playlist ID.",
    );
  }

  return url.toString();
}

function parseChannelUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RYD_LIVE_NAV_CHANNEL_URL must be a valid HTTPS YouTube channel URL.");
  }

  const isSafeChannelPath = /^\/@[A-Za-z0-9._-]{3,100}(?:\/(?:featured|shorts|videos))?\/?$/.test(url.pathname);
  if (
    url.protocol !== "https:" ||
    !["www.youtube.com", "youtube.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !isSafeChannelPath
  ) {
    throw new Error(
      "RYD_LIVE_NAV_CHANNEL_URL must be a plain HTTPS youtube.com /@handle channel, featured, Shorts, or videos URL.",
    );
  }

  url.hostname = "www.youtube.com";
  return url.toString();
}

function readExpectedBuildId(
  runtime,
  {
    assertArtifactCurrent = assertCurrentLiveArtifact,
    markerPaths = LIVE_BUILD_MARKER_PATHS,
    readFileSync = fs.readFileSync,
  } = {},
) {
  const markerPath = markerPaths[runtime];
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read the ${runtime} live-build marker at ${markerPath}. Build that live artifact before running the smoke.`,
      { cause: error },
    );
  }
  if (!LIVE_BUILD_ID_PATTERN.test(marker?.buildId)) {
    throw new Error(`The ${runtime} live-build marker at ${markerPath} is malformed.`);
  }
  assertArtifactCurrent(runtime, marker.buildId);
  return marker.buildId;
}

function readLiveOptions(
  environment = process.env,
  nowMilliseconds = Date.now(),
  { readBuildId = readExpectedBuildId, resolveEndpoint = resolveCdpEndpoint } = {},
) {
  if (environment.RYD_LIVE_YOUTUBE !== "1") return null;

  if (environment.RYD_LIVE_PRODUCTION_API !== "1") {
    throw new Error(
      "RYD_LIVE_PRODUCTION_API=1 is required because the installed runtime will contact the production RYD API.",
    );
  }

  const runtime = requireValue(environment, "RYD_LIVE_RUNTIME");
  if (!SUPPORTED_RUNTIMES.has(runtime)) {
    throw new Error('RYD_LIVE_RUNTIME must be either "userscript" or "extension".');
  }

  const watchA = requireVideoId(environment, "RYD_LIVE_WATCH_A");
  const watchB = requireVideoId(environment, "RYD_LIVE_WATCH_B");
  const short = requireVideoId(environment, "RYD_LIVE_SHORT");
  const reactionShort = environment.RYD_LIVE_REACTION_SHORT?.trim()
    ? requireVideoId(environment, "RYD_LIVE_REACTION_SHORT")
    : short;
  if (watchA === watchB) throw new Error("RYD_LIVE_WATCH_A and RYD_LIVE_WATCH_B must be different videos.");

  const expectedVersion =
    environment.RYD_LIVE_EXPECTED_VERSION?.trim() ||
    (runtime === "userscript" ? userscriptVersion : extensionPackage.version);

  return {
    cdpEndpoint: resolveEndpoint(environment.RYD_CDP_ENDPOINT?.trim() || "chrome", { environment }),
    cdpConnectTimeoutMilliseconds: optionalBoundedInteger(
      environment,
      "RYD_CDP_CONNECT_TIMEOUT_MS",
      DEFAULT_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
      MAX_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
      MIN_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
    ),
    expectedBuildId: readBuildId(runtime),
    expectedChannel: requireChannelHandle(environment),
    expectedVersion,
    navigation: {
      channelUrl: parseChannelUrl(environment.RYD_LIVE_NAV_CHANNEL_URL?.trim() || DEFAULT_LIVE_NAV_CHANNEL_URL),
      short: requireVideoId(
        { RYD_LIVE_NAV_SHORT: environment.RYD_LIVE_NAV_SHORT?.trim() || DEFAULT_LIVE_NAV_SHORT },
        "RYD_LIVE_NAV_SHORT",
      ),
      shortsNextHops: optionalBoundedInteger(
        environment,
        "RYD_LIVE_SHORTS_NEXT_HOPS",
        DEFAULT_LIVE_SHORTS_NEXT_HOPS,
        MAX_LIVE_SHORTS_NEXT_HOPS,
        MIN_LIVE_SHORTS_NEXT_HOPS,
      ),
      watch: requireVideoId(environment, "RYD_LIVE_NAV_WATCH"),
    },
    playlistUrl: parsePlaylistUrl(requireValue(environment, "RYD_LIVE_PLAYLIST_URL"), watchA),
    productionApiApproved: true,
    reactionShort,
    runtime,
    sidebar: {
      hopCount: optionalBoundedInteger(
        environment,
        "RYD_LIVE_SIDEBAR_HOPS",
        DEFAULT_LIVE_SIDEBAR_HOPS,
        MAX_LIVE_SIDEBAR_HOPS,
      ),
    },
    short,
    watchA,
    watchB,
  };
}

module.exports = {
  DEFAULT_LIVE_NAV_CHANNEL_URL,
  DEFAULT_LIVE_NAV_SHORT,
  DEFAULT_LIVE_SIDEBAR_HOPS,
  DEFAULT_LIVE_SHORTS_NEXT_HOPS,
  DEFAULT_LIVE_CDP_CONNECT_TIMEOUT_MILLISECONDS,
  LIVE_VOTE_APPROVALS_DIRECTORY,
  LIVE_VOTE_APPROVAL_WINDOW_SECONDS,
  MAX_LIVE_SHORTS_NEXT_HOPS,
  MIN_LIVE_SHORTS_NEXT_HOPS,
  consumeLiveVoteApproval,
  hasFreshVoteApproval,
  liveVoteApproval,
  readExpectedBuildId,
  readLiveOptions,
};
