const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ACTIVE_PORT_FILE_NAME = "DevToolsActivePort";
const BROWSER_ALIASES = new Set(["brave", "chrome", "chromium", "edge"]);

function nonEmptyEnvironmentValue(environment, name) {
  const value = environment[name]?.trim();
  return value || null;
}

function platformPath(platform, pathImpl) {
  if (pathImpl) return pathImpl;
  return platform === "win32" ? path.win32 : path.posix;
}

function browserUserDataDirectories(browser, { environment, homedir, pathImpl, platform }) {
  const join = pathImpl.join.bind(pathImpl);
  const home = nonEmptyEnvironmentValue(environment, "HOME") || homedir();

  if (platform === "win32") {
    const localAppData = nonEmptyEnvironmentValue(environment, "LOCALAPPDATA");
    if (!localAppData) return [];
    const directories = {
      brave: [join(localAppData, "BraveSoftware", "Brave-Browser", "User Data")],
      chrome: [
        join(localAppData, "Google", "Chrome", "User Data"),
        join(localAppData, "Google", "Chrome Beta", "User Data"),
        join(localAppData, "Google", "Chrome Dev", "User Data"),
        join(localAppData, "Google", "Chrome SxS", "User Data"),
      ],
      chromium: [join(localAppData, "Chromium", "User Data")],
      edge: [join(localAppData, "Microsoft", "Edge", "User Data")],
    };
    return directories[browser] || [];
  }

  if (platform === "darwin") {
    const applicationSupport = join(home, "Library", "Application Support");
    const directories = {
      brave: [join(applicationSupport, "BraveSoftware", "Brave-Browser")],
      chrome: [
        join(applicationSupport, "Google", "Chrome"),
        join(applicationSupport, "Google", "Chrome Beta"),
        join(applicationSupport, "Google", "Chrome Dev"),
        join(applicationSupport, "Google", "Chrome Canary"),
      ],
      chromium: [join(applicationSupport, "Chromium")],
      edge: [join(applicationSupport, "Microsoft Edge")],
    };
    return directories[browser] || [];
  }

  const configRoot = nonEmptyEnvironmentValue(environment, "XDG_CONFIG_HOME") || join(home, ".config");
  const directories = {
    brave: [join(configRoot, "BraveSoftware", "Brave-Browser")],
    chrome: [
      join(configRoot, "google-chrome"),
      join(configRoot, "google-chrome-beta"),
      join(configRoot, "google-chrome-unstable"),
    ],
    chromium: [join(configRoot, "chromium")],
    edge: [join(configRoot, "microsoft-edge")],
  };
  return directories[browser] || [];
}

function knownActivePortFiles(browser, settings) {
  const browsers = browser ? [browser] : ["chrome", "brave", "edge", "chromium"];
  return browsers.flatMap((name) =>
    browserUserDataDirectories(name, settings).map((directory) =>
      settings.pathImpl.join(directory, ACTIVE_PORT_FILE_NAME),
    ),
  );
}

function parseBareHostAndPort(value) {
  let url;
  try {
    url = new URL(`http://${value}`);
  } catch {
    return null;
  }

  if (!url.hostname || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    return null;
  }

  const port = Number(url.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return null;
  return { authority: url.host, port };
}

function parseActivePortFile(contents, filePath) {
  const [rawPort, rawBrowserPath] = String(contents).split(/\r?\n/);
  const port = Number(rawPort?.trim());
  if (!/^\d+$/.test(rawPort?.trim() || "") || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`The CDP active-port file at ${filePath} has an invalid port.`);
  }

  let browserPath = rawBrowserPath?.trim();
  if (/^wss?:\/\//i.test(browserPath || "")) {
    let url;
    try {
      url = new URL(browserPath);
    } catch {
      throw new Error(`The CDP active-port file at ${filePath} has an invalid browser WebSocket URL.`);
    }
    browserPath = `${url.pathname}${url.search}`;
  }

  if (!/^\/devtools\/browser\/[A-Za-z0-9._-]+$/.test(browserPath || "")) {
    throw new Error(`The CDP active-port file at ${filePath} has an invalid browser WebSocket path.`);
  }

  return { browserPath, port };
}

function unique(values, platform) {
  const keys = new Set();
  return values.filter((value) => {
    const key = platform === "win32" ? value.toLowerCase() : value;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function activePortFileCandidates(browser, settings) {
  const activePortFile = nonEmptyEnvironmentValue(settings.environment, "RYD_CDP_ACTIVE_PORT_FILE");
  const userDataDirectory = nonEmptyEnvironmentValue(settings.environment, "RYD_CDP_USER_DATA_DIR");
  if (activePortFile && userDataDirectory) {
    throw new Error("Set only one of RYD_CDP_ACTIVE_PORT_FILE and RYD_CDP_USER_DATA_DIR.");
  }
  if (activePortFile) return { explicit: true, paths: [settings.pathImpl.resolve(activePortFile)] };
  if (userDataDirectory) {
    return {
      explicit: true,
      paths: [settings.pathImpl.join(settings.pathImpl.resolve(userDataDirectory), ACTIVE_PORT_FILE_NAME)],
    };
  }
  return { explicit: false, paths: unique(knownActivePortFiles(browser, settings), settings.platform) };
}

function readCandidate(filePath, settings, explicit) {
  try {
    return parseActivePortFile(settings.readFileSync(filePath, "utf8"), filePath);
  } catch (error) {
    if (!explicit && ["ENOENT", "ENOTDIR"].includes(error.code)) return null;
    throw error;
  }
}

function protocolEndpoint(value) {
  if (!/^(?:https?|wss?):\/\//i.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RYD_CDP_ENDPOINT must be a valid HTTP(S), WebSocket, host:port, or browser-alias endpoint.");
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol) || !url.hostname) {
    throw new Error("RYD_CDP_ENDPOINT must be a valid HTTP(S), WebSocket, host:port, or browser-alias endpoint.");
  }
  return value;
}

function resolveCdpEndpoint(
  configuredEndpoint,
  {
    environment = process.env,
    homedir = os.homedir,
    pathImpl,
    platform = process.platform,
    readFileSync = fs.readFileSync,
  } = {},
) {
  const value = configuredEndpoint?.trim() || "chrome";
  const explicitProtocolEndpoint = protocolEndpoint(value);
  if (explicitProtocolEndpoint) return explicitProtocolEndpoint;

  const browser = BROWSER_ALIASES.has(value.toLowerCase()) ? value.toLowerCase() : null;
  const bareEndpoint = browser ? null : parseBareHostAndPort(value);
  if (!browser && !bareEndpoint) {
    throw new Error(
      "RYD_CDP_ENDPOINT must be an HTTP(S) URL, WebSocket URL, host:port shown by Chromium, or one of chrome, brave, edge, and chromium.",
    );
  }

  const settings = {
    environment,
    homedir,
    pathImpl: platformPath(platform, pathImpl),
    platform,
    readFileSync,
  };
  const candidates = activePortFileCandidates(browser, settings);
  const matches = [];
  for (const filePath of candidates.paths) {
    const activePort = readCandidate(filePath, settings, candidates.explicit);
    if (!activePort || (bareEndpoint && activePort.port !== bareEndpoint.port)) continue;
    const authority = bareEndpoint?.authority || `127.0.0.1:${activePort.port}`;
    matches.push({ endpoint: `ws://${authority}${activePort.browserPath}`, filePath });
  }

  const endpoints = [...new Set(matches.map(({ endpoint }) => endpoint))];
  if (endpoints.length === 1) return endpoints[0];
  if (endpoints.length > 1) {
    throw new Error(
      `More than one DevToolsActivePort file matches RYD_CDP_ENDPOINT=${value}. Set RYD_CDP_ACTIVE_PORT_FILE or RYD_CDP_USER_DATA_DIR to select the intended browser profile.`,
    );
  }

  const fileDescription = candidates.explicit
    ? candidates.paths[0]
    : candidates.paths.length
      ? candidates.paths.join(", ")
      : "the platform's standard browser user-data directories";
  const portDescription = bareEndpoint ? ` matching port ${bareEndpoint.port}` : "";
  throw new Error(
    `Could not find a valid DevToolsActivePort file${portDescription} in ${fileDescription}. ` +
      "Set RYD_CDP_ACTIVE_PORT_FILE to that file, RYD_CDP_USER_DATA_DIR to its directory, or use an explicit ws:// or legacy http:// endpoint.",
  );
}

module.exports = {
  ACTIVE_PORT_FILE_NAME,
  browserUserDataDirectories,
  parseActivePortFile,
  parseBareHostAndPort,
  resolveCdpEndpoint,
};
