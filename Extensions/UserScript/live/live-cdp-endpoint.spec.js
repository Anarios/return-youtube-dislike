const path = require("node:path");
const {
  browserUserDataDirectories,
  parseActivePortFile,
  parseBareHostAndPort,
  resolveCdpEndpoint,
} = require("./live-cdp-endpoint");

function missingFile(filePath) {
  throw Object.assign(new Error(`missing ${filePath}`), { code: "ENOENT" });
}

function mappedReader(files) {
  return jest.fn((filePath) => {
    if (Object.prototype.hasOwnProperty.call(files, filePath)) return files[filePath];
    return missingFile(filePath);
  });
}

describe("live CDP endpoint resolver", () => {
  test.each([
    "ws://127.0.0.1:60011/devtools/browser/session-id",
    "wss://debug.example.test/devtools/browser/session-id",
    "http://127.0.0.1:9222",
    "https://debug.example.test:9222",
  ])("preserves an explicit protocol endpoint without reading the filesystem: %s", (endpoint) => {
    const readFileSync = jest.fn();

    expect(resolveCdpEndpoint(endpoint, { readFileSync })).toBe(endpoint);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  test("resolves Chrome's host:port-only UI value through the matching Windows active-port file", () => {
    const chromeFile = "C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\User Data\\DevToolsActivePort";
    const braveFile = "C:\\Users\\tester\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data\\DevToolsActivePort";
    const readFileSync = mappedReader({
      [braveFile]: "50000\n/devtools/browser/brave-session\n",
      [chromeFile]: "60011\r\n/devtools/browser/chrome-session\r\n",
    });

    expect(
      resolveCdpEndpoint("127.0.0.1:60011", {
        environment: { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" },
        homedir: () => "C:\\Users\\tester",
        pathImpl: path.win32,
        platform: "win32",
        readFileSync,
      }),
    ).toBe("ws://127.0.0.1:60011/devtools/browser/chrome-session");
    expect(readFileSync).toHaveBeenCalledWith(chromeFile, "utf8");
  });

  test("uses the configured bare hostname while taking the browser path from the file", () => {
    const activePortFile = "C:\\portable\\profile\\DevToolsActivePort";

    expect(
      resolveCdpEndpoint("localhost:60011", {
        environment: { RYD_CDP_USER_DATA_DIR: "C:\\portable\\profile" },
        pathImpl: path.win32,
        platform: "win32",
        readFileSync: mappedReader({ [activePortFile]: "60011\n/devtools/browser/portable-session\n" }),
      }),
    ).toBe("ws://localhost:60011/devtools/browser/portable-session");
  });

  test("supports a bracketed IPv6 loopback host", () => {
    expect(
      resolveCdpEndpoint("[::1]:60011", {
        environment: { RYD_CDP_ACTIVE_PORT_FILE: "/profile/DevToolsActivePort" },
        pathImpl: path.posix,
        platform: "linux",
        readFileSync: mappedReader({
          "/profile/DevToolsActivePort": "60011\n/devtools/browser/ipv6-session\n",
        }),
      }),
    ).toBe("ws://[::1]:60011/devtools/browser/ipv6-session");
  });

  test.each([
    [
      "win32",
      path.win32,
      { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" },
      () => "C:\\Users\\tester",
      "chrome",
      "C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\User Data",
    ],
    [
      "darwin",
      path.posix,
      { HOME: "/Users/tester" },
      () => "/fallback",
      "brave",
      "/Users/tester/Library/Application Support/BraveSoftware/Brave-Browser",
    ],
    [
      "linux",
      path.posix,
      { HOME: "/home/tester", XDG_CONFIG_HOME: "/custom/config" },
      () => "/fallback",
      "edge",
      "/custom/config/microsoft-edge",
    ],
  ])("discovers standard %s browser user-data roots", (platform, pathImpl, environment, homedir, browser, expected) => {
    expect(browserUserDataDirectories(browser, { environment, homedir, pathImpl, platform })).toContain(expected);
  });

  test.each(["chrome", "CHROME", "brave", "edge", "chromium", undefined])(
    "resolves browser alias %p from its active-port file",
    (alias) => {
      const activePortFile = "/custom/profile/DevToolsActivePort";
      expect(
        resolveCdpEndpoint(alias, {
          environment: { RYD_CDP_ACTIVE_PORT_FILE: activePortFile },
          pathImpl: path.posix,
          platform: "linux",
          readFileSync: mappedReader({
            [activePortFile]: "60123\n/devtools/browser/alias-session\n",
          }),
        }),
      ).toBe("ws://127.0.0.1:60123/devtools/browser/alias-session");
    },
  );

  test("accepts an absolute WebSocket URL in an active-port file but uses the configured authority", () => {
    expect(
      resolveCdpEndpoint("localhost:60011", {
        environment: { RYD_CDP_ACTIVE_PORT_FILE: "/profile/DevToolsActivePort" },
        pathImpl: path.posix,
        platform: "linux",
        readFileSync: mappedReader({
          "/profile/DevToolsActivePort": "60011\nws://127.0.0.1:60011/devtools/browser/full-url-session\n",
        }),
      }),
    ).toBe("ws://localhost:60011/devtools/browser/full-url-session");
  });

  test("uses an exact active-port-file override", () => {
    const readFileSync = mappedReader({
      "/custom/ChromeActivePort": "61234\n/devtools/browser/custom-session\n",
    });

    expect(
      resolveCdpEndpoint("chrome", {
        environment: { RYD_CDP_ACTIVE_PORT_FILE: "/custom/ChromeActivePort" },
        pathImpl: path.posix,
        platform: "linux",
        readFileSync,
      }),
    ).toBe("ws://127.0.0.1:61234/devtools/browser/custom-session");
    expect(readFileSync).toHaveBeenCalledTimes(1);
  });

  test("rejects a port mismatch instead of attaching to a different browser", () => {
    expect(() =>
      resolveCdpEndpoint("127.0.0.1:60011", {
        environment: { RYD_CDP_ACTIVE_PORT_FILE: "/profile/DevToolsActivePort" },
        pathImpl: path.posix,
        platform: "linux",
        readFileSync: mappedReader({
          "/profile/DevToolsActivePort": "60012\n/devtools/browser/wrong-browser\n",
        }),
      }),
    ).toThrow(/matching port 60011/);
  });

  test("rejects ambiguous standard profiles with the same port and different browser paths", () => {
    const localAppData = "C:\\Users\\tester\\AppData\\Local";
    const chromeFile = `${localAppData}\\Google\\Chrome\\User Data\\DevToolsActivePort`;
    const braveFile = `${localAppData}\\BraveSoftware\\Brave-Browser\\User Data\\DevToolsActivePort`;

    expect(() =>
      resolveCdpEndpoint("127.0.0.1:60011", {
        environment: { LOCALAPPDATA: localAppData },
        pathImpl: path.win32,
        platform: "win32",
        readFileSync: mappedReader({
          [chromeFile]: "60011\n/devtools/browser/chrome-session\n",
          [braveFile]: "60011\n/devtools/browser/brave-session\n",
        }),
      }),
    ).toThrow(/More than one DevToolsActivePort file matches/);
  });

  test("rejects conflicting file and user-data-directory overrides", () => {
    expect(() =>
      resolveCdpEndpoint("chrome", {
        environment: {
          RYD_CDP_ACTIVE_PORT_FILE: "/profile/DevToolsActivePort",
          RYD_CDP_USER_DATA_DIR: "/profile",
        },
        pathImpl: path.posix,
        platform: "linux",
      }),
    ).toThrow(/Set only one/);
  });

  test.each([
    ["not-a-port\n/devtools/browser/session\n", /invalid port/],
    ["70000\n/devtools/browser/session\n", /invalid port/],
    ["60011\n/devtools/page/not-a-browser\n", /invalid browser WebSocket path/],
    ["60011\n", /invalid browser WebSocket path/],
    ["60011\nws://bad host/devtools/browser/session\n", /invalid browser WebSocket URL/],
  ])("rejects a malformed active-port file", (contents, expectedError) => {
    expect(() => parseActivePortFile(contents, "DevToolsActivePort")).toThrow(expectedError);
  });

  test.each([
    ["127.0.0.1:60011", { authority: "127.0.0.1:60011", port: 60011 }],
    ["localhost:9222", { authority: "localhost:9222", port: 9222 }],
    ["[::1]:1234", { authority: "[::1]:1234", port: 1234 }],
    ["localhost", null],
    ["localhost:0", null],
    ["localhost:70000", null],
    ["localhost:9222/json/version", null],
  ])("parses bare host/port endpoint %p", (endpoint, expected) => {
    expect(parseBareHostAndPort(endpoint)).toEqual(expected);
  });

  test.each(["not-an-endpoint", "ftp://127.0.0.1:9222", "127.0.0.1", "127.0.0.1:70000/path"])(
    "rejects unsupported endpoint %p",
    (endpoint) => {
      expect(() => resolveCdpEndpoint(endpoint)).toThrow(/RYD_CDP_ENDPOINT/);
    },
  );
});
