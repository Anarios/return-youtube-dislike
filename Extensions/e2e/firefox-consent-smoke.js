const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

// Run after the production build: node Extensions/e2e/firefox-consent-smoke.js
// RYD_FIREFOX_BINARY selects a portable browser. RYD_FIREFOX_PACKAGED=1 requires
// Developer Edition or Nightly and enables unsigned packages only in the owned profile.
// RYD_FIREFOX_DATA_CONSENT_DISABLED=1 verifies fail-closed behavior when the native consent API is disabled.
// RYD_FIREFOX_CHANGELOG_LIFECYCLE=1 observes temporary install/reload events.
// RYD_FIREFOX_CHANGELOG_EXPECT_IMMEDIATE=1 also asserts immediate reload display and pending-state recovery.
const ROOT = path.resolve(__dirname, "../..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(operation, description, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await operation();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

class Marionette {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.sequence = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve) => (this.connected = resolve));
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.includes(58)) {
        const colon = this.buffer.indexOf(58);
        const length = Number(this.buffer.subarray(0, colon).toString());
        if (this.buffer.length < colon + 1 + length) return;
        const message = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length));
        this.buffer = this.buffer.subarray(colon + 1 + length);
        if (!Array.isArray(message)) this.connected(message);
        else {
          const [, id, error, result] = message;
          const pending = this.pending.get(id);
          if (!pending) continue;
          this.pending.delete(id);
          clearTimeout(pending.timer);
          error ? pending.reject(new Error(JSON.stringify(error))) : pending.resolve(result);
        }
      }
    });
    socket.on("error", () => {});
  }

  command(name, parameters = {}) {
    const id = ++this.sequence;
    const message = JSON.stringify([0, id, name, parameters]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(`${Buffer.byteLength(message)}:${message}`);
    });
  }

  async script(script, args = [], async = false) {
    const response = await this.command(async ? "WebDriver:ExecuteAsyncScript" : "WebDriver:ExecuteScript", {
      script,
      args,
      newSandbox: false,
      sandbox: null,
      line: 1,
      filename: "firefox-consent-smoke.js",
      scriptTimeout: 25000,
    });
    return response.value;
  }

  async context(value) {
    await this.command("Marionette:SetContext", { value });
  }

  async click(selector) {
    const element = await this.command("WebDriver:FindElement", { using: "css selector", value: selector });
    await this.command("WebDriver:ElementClick", { id: element.value["element-6066-11e4-a52e-4f735466cecf"] });
  }
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function connect(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const socket = await new Promise((resolve, reject) => {
        const client = net.connect(port, "127.0.0.1", () => resolve(client));
        client.once("error", reject);
      });
      const driver = new Marionette(socket);
      await driver.ready;
      return driver;
    } catch (_) {
      await delay(200);
    }
  }
  throw new Error("Firefox Marionette did not start");
}

async function run() {
  const artifact = path.resolve(
    process.env.RYD_FIREFOX_ARTIFACT || path.join(ROOT, "Extensions/combined/dist/firefox"),
  );
  const firefox = process.env.RYD_FIREFOX_BINARY || "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
  const packaged = process.env.RYD_FIREFOX_PACKAGED === "1";
  const consentDisabled = process.env.RYD_FIREFOX_DATA_CONSENT_DISABLED === "1";
  const changelogLifecycle = process.env.RYD_FIREFOX_CHANGELOG_LIFECYCLE === "1";
  assert(!(packaged && changelogLifecycle), "Changelog lifecycle reproduction requires a temporary addon");
  assert(
    !(consentDisabled && (packaged || changelogLifecycle)),
    "Disabled-consent validation requires an ordinary temporary addon",
  );
  const evidence = path.join(ROOT, "test-results", `firefox-consent-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const profile = path.join(evidence, "profile");
  const derived = path.join(evidence, "extension");
  await fs.mkdir(profile, { recursive: true });
  await fs.cp(artifact, derived, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(derived, "manifest.json"), "utf8"));
  const requests = [];
  const blocked = [];
  const unexpectedRequests = [];
  const result = {
    artifact,
    version: manifest.version,
    scenarios: [],
    permissionStates: [],
    consentDisabled,
    screenshots: [],
    requests,
    blocked,
    unexpectedRequests,
  };
  result.validationDepth =
    "generated Firefox artifact with loopback API substitution, native optional consent, isolated temporary install";
  result.limitations = [
    "Temporary installation grants required categories without showing the install/update consent prompt.",
    "Native arrow-panel text is captured from Firefox UI; headless screenshots do not capture the separate native panel.",
  ];
  let githubChallenge;
  let githubRedirectUri;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    requests.push({ method: request.method, path: url.pathname });
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Content-Type", "application/json");
    if (request.method === "OPTIONS") response.end();
    else if (url.pathname === "/puzzle/registration")
      response.end(
        request.method === "POST" ? "true" : JSON.stringify({ challenge: "AAAAAAAAAAAAAAAAAAAAAA==", difficulty: 0 }),
      );
    else if (url.pathname === "/puzzle/registration/confirm") response.end("true");
    else if (url.pathname === "/api/auth/github/login") {
      githubChallenge = url.searchParams.get("codeChallenge");
      githubRedirectUri = url.searchParams.get("redirectUri");
      const params = new URLSearchParams({
        state: "fixture-state",
        redirect_uri: githubRedirectUri,
        code_challenge: githubChallenge,
        code_challenge_method: "S256",
      });
      response.end(
        JSON.stringify({
          authUrl: `https://github.com/login/oauth/authorize?${params}`,
          state: "fixture-state",
          redirectUri: githubRedirectUri,
        }),
      );
    } else if (url.pathname.endsWith("/login")) {
      response.end(
        JSON.stringify({
          authUrl: `${origin}/oauth-authorize?redirectUri=${encodeURIComponent(url.searchParams.get("redirectUri"))}`,
          state: "fixture-state",
        }),
      );
    } else if (url.pathname === "/oauth-authorize") {
      response.writeHead(302, {
        Location: `${url.searchParams.get("redirectUri")}?code=fixture-code&state=fixture-state`,
      });
      response.end();
    } else if (url.pathname.endsWith("/exchange")) {
      if (url.pathname === "/api/auth/github/exchange") {
        let body = "";
        for await (const chunk of request) body += chunk;
        const data = JSON.parse(body);
        result.githubPkceVerified =
          typeof data.codeVerifier === "string" &&
          crypto.createHash("sha256").update(data.codeVerifier).digest("base64url") === githubChallenge &&
          data.state === "fixture-state" &&
          data.code === "fixture-code" &&
          data.redirectUri === githubRedirectUri;
        if (!result.githubPkceVerified) {
          response.writeHead(400);
          response.end(JSON.stringify({ error: "github_invalid_state" }));
          return;
        }
      }
      response.end(
        JSON.stringify({
          success: true,
          sessionToken: "fixture-session-token",
          user: { fullName: "Test member", membershipTier: "premium", hasActiveMembership: true },
        }),
      );
    } else if (url.pathname === "/api/auth/verify")
      response.end(JSON.stringify({ valid: true, membershipTier: "premium" }));
    else {
      unexpectedRequests.push({ method: request.method, path: url.pathname });
      response.writeHead(404);
      response.end("{}");
    }
  });
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  const proxy = http.createServer((request, response) => {
    blocked.push({ method: request.method, host: new URL(request.url).hostname });
    response.writeHead(502);
    response.end();
  });
  proxy.on("connect", (request, socket) => {
    blocked.push({ method: "CONNECT", host: request.url });
    socket.end("HTTP/1.1 502 Blocked by isolated test\r\n\r\n");
  });
  const proxyPort = await listen(proxy);
  const sourceHashes = {
    "manifest.json": crypto
      .createHash("sha256")
      .update(await fs.readFile(path.join(artifact, "manifest.json")))
      .digest("hex"),
  };
  for (const filename of ["ryd.background.js", "ryd.content-script.js", "popup.js"]) {
    const file = path.join(derived, filename);
    const source = await fs.readFile(file, "utf8");
    sourceHashes[filename] = crypto.createHash("sha256").update(source).digest("hex");
    assert(
      source.includes("https://returnyoutubedislikeapi.com"),
      `${filename} must contain its production API origin`,
    );
    let testSource = source.replaceAll("https://returnyoutubedislikeapi.com", origin);
    if (filename === "ryd.background.js") {
      // Keep the generated OAuth URL/PKCE validation and native identity flow.
      // Route only the external provider navigation to the owned loopback fixture.
      const providerBoundary = `(() => {
        const nativeLaunch = browser.identity.launchWebAuthFlow.bind(browser.identity);
        browser.identity.launchWebAuthFlow = (details) => {
          const url = new URL(details.url);
          if (url.origin === "https://github.com" && url.pathname === "/login/oauth/authorize") {
            const fixture = new URL(${JSON.stringify(origin)} + "/oauth-authorize");
            fixture.searchParams.set("redirectUri", url.searchParams.get("redirect_uri"));
            fixture.searchParams.set("state", url.searchParams.get("state"));
            return nativeLaunch({...details, url:fixture.href});
          }
          return nativeLaunch(details);
        };
      })();\n`;
      testSource = providerBoundary + testSource;
    }
    await fs.writeFile(file, testSource);
  }
  result.sourceHashes = sourceHashes;
  result.derivation = [
    "Replace the production API origin with the owned loopback origin in three generated bundles.",
    "Add the loopback host permission only to the owned test copy.",
    "Route native identity navigation for the validated GitHub authorize URL to a loopback provider; retain generated URL/state/PKCE checks and the native identity flow.",
  ];
  if (changelogLifecycle)
    await require("./firefox-changelog-lifecycle").instrumentChangelogLifecycle({ derived, manifest, result });
  manifest.permissions.push(`${origin}/*`);
  await fs.writeFile(path.join(derived, "manifest.json"), JSON.stringify(manifest, null, 2));
  const portServer = net.createServer();
  const marionettePort = await listen(portServer);
  await new Promise((resolve) => portServer.close(resolve));
  const prefs = {
    "marionette.port": marionettePort,
    "browser.shell.checkDefaultBrowser": false,
    "browser.startup.homepage_override.mstone": "ignore",
    "browser.startup.page": 0,
    "startup.homepage_welcome_url": "about:blank",
    "startup.homepage_welcome_url.additional": "",
    "browser.newtabpage.enabled": false,
    "browser.tabs.warnOnClose": false,
    "datareporting.policy.dataSubmissionEnabled": false,
    "toolkit.telemetry.enabled": false,
    "app.update.disabledForTesting": true,
    "network.proxy.type": 1,
    "network.proxy.http": "127.0.0.1",
    "network.proxy.http_port": proxyPort,
    "network.proxy.ssl": "127.0.0.1",
    "network.proxy.ssl_port": proxyPort,
    "network.proxy.no_proxies_on": "127.0.0.1,localhost",
    "network.proxy.failover_direct": false,
    "network.trr.mode": 5,
    "dom.security.https_only_mode": false,
    "remote.active-protocols": 1,
  };
  if (packaged) prefs["xpinstall.signatures.required"] = false;
  if (consentDisabled) prefs["extensions.dataCollectionPermissions.enabled"] = false;
  await fs.writeFile(
    path.join(profile, "user.js"),
    Object.entries(prefs)
      .map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
      .join("\n"),
  );
  const child = spawn(
    firefox,
    ["-headless", "-no-remote", "-profile", profile, "--marionette", "--remote-allow-system-access", "about:blank"],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let firefoxLog = "";
  child.stdout.on("data", (chunk) => (firefoxLog += chunk));
  child.stderr.on("data", (chunk) => (firefoxLog += chunk));
  let driver;
  try {
    driver = await connect(marionettePort);
    result.session = await driver.command("WebDriver:NewSession", {
      acceptInsecureCerts: true,
      unhandledPromptBehavior: "dismiss and notify",
    });
    console.log(`Firefox ${result.session.capabilities.browserVersion}, extension ${manifest.version}`);
    await driver.context("chrome");
    await driver.script(`
      window.__rydConsentDiagnostics = [];
      window.__rydConsentListener = { observe(message) {
        const text = message.message || "";
        if (text.includes("moz-extension://")) window.__rydConsentDiagnostics.push(text);
      }};
      Services.console.registerListener(window.__rydConsentListener);
    `);
    const installed = packaged
      ? await require("./firefox-install-consent").validatePackagedConsent({
          driver,
          derived,
          evidence,
          manifest,
          result,
          requests,
        })
      : await driver.script(
          `
      const done = arguments[arguments.length - 1];
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(arguments[0]);
      AddonManager.installTemporaryAddon(file).then(addon => done({id:addon.id,version:addon.version}), error=>done({error:String(error)}));
    `,
          [derived],
          true,
        );
    assert(!installed.error, installed.error);
    result.installed = installed;
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.id, manifest.browser_specific_settings.gecko.id);
    const uuid = await driver.script(`return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;`, [
      installed.id,
    ]);
    if (!packaged) {
      result.freshInstallChangelog = await until(
        () =>
          driver.script(
            `
          const url = "moz-extension://" + arguments[0] + "/changelog/4/changelog_4.0.html";
          const tabs = Array.from(gBrowser.tabs).filter(tab => tab.linkedBrowser.currentURI.spec === url);
          return tabs.length ? { url, tabCount: tabs.length } : false;
        `,
            [uuid],
          ),
        "automatic changelog tab on a fresh temporary installation",
      );
      assert.equal(result.freshInstallChangelog.tabCount, 1);
      result.scenarios.push("fresh temporary installation automatically opens one changelog tab");
    }
    await driver.context("content");
    await driver.command("WebDriver:SetWindowRect", { width: 380, height: 900 });
    await driver.command("WebDriver:Navigate", { url: `moz-extension://${uuid}/popup.html` });
    result.initialPermissions = await driver.script(
      `const done=arguments[arguments.length-1]; browser.permissions.getAll().then(done);`,
      [],
      true,
    );
    async function assertPermissionState(label, expected) {
      const state = await driver.script(
        `const done = arguments[arguments.length - 1]; Promise.all([
          browser.permissions.getAll(),
          browser.permissions.contains({data_collection:["authenticationInfo"]})
        ]).then(([all, contains]) => done({all, contains, events:window.__rydPermissionEvents || []}));`,
        [],
        true,
      );
      result.permissionStates.push({ label, ...state });
      assert.equal(state.all.data_collection?.includes("authenticationInfo") === true, expected, label);
      return state;
    }
    async function assertNoAuthenticationTraffic(label) {
      const baseline = requests.filter(
        (request) => request.path.startsWith("/api/auth/") || request.path === "/oauth-authorize",
      ).length;
      for (const message of ["patreon_oauth_login", "github_oauth_login"]) {
        const response = await driver.script(
          `const done = arguments[arguments.length - 1]; browser.runtime.sendMessage({message:arguments[0]}).then(done);`,
          [message],
          true,
        );
        assert.equal(response.success, false, label);
        assert.match(response.error, /consent removed|consent required/, label);
      }
      await delay(1000);
      assert.equal(
        requests.filter((request) => request.path.startsWith("/api/auth/") || request.path === "/oauth-authorize")
          .length,
        baseline,
        label,
      );
    }
    if (!packaged) {
      result.freshInstallChangelog.storage = await until(
        () =>
          driver.script(
            `const done=arguments[arguments.length-1]; browser.storage.local.get(["lastShownChangelogVersion", "pendingChangelogVersion"]).then(value=>done(value.lastShownChangelogVersion ? value : false));`,
            [],
            true,
          ),
        "successful changelog display recorded in local storage",
      );
      assert.equal(result.freshInstallChangelog.storage.lastShownChangelogVersion, manifest.version);
    }
    const optional = manifest.browser_specific_settings.gecko.data_collection_permissions.optional;
    assert.deepEqual(optional, ["authenticationInfo"]);
    assert(optional.every((permission) => !result.initialPermissions.data_collection?.includes(permission)));
    await assertPermissionState("fresh installation has no authentication consent", false);
    if (consentDisabled) assert.equal(result.initialPermissions.data_collection, undefined);
    for (const message of ["patreon_oauth_login", "github_oauth_login"]) {
      const deniedMessage = await driver.script(
        `const done=arguments[arguments.length-1]; browser.runtime.sendMessage({message:arguments[0]}).then(done);`,
        [message],
        true,
      );
      assert.equal(deniedMessage.success, false);
      assert.match(deniedMessage.error, /consent removed|consent required/);
    }
    assert.equal(requests.filter((request) => request.path.startsWith("/api/auth/")).length, 0);
    result.scenarios.push("background refuses authentication without optional consent");
    await driver.script(
      `const done=arguments[arguments.length-1]; browser.storage.sync.set({patreonAuthenticated:true,patreonUser:{fullName:"Cached test member",membershipTier:"premium",hasActiveMembership:true},patreonSessionToken:"fixture-cached-session-token"}).then(done);`,
      [],
      true,
    );
    await driver.command("WebDriver:Refresh");
    await until(
      () => driver.script(`return document.getElementById("patreon-logged-out").style.display === "block";`),
      "cached session kept inactive without consent",
    );
    assert.equal(requests.filter((request) => request.path.startsWith("/api/auth/")).length, 0);
    result.scenarios.push("cached account cannot verify or log in without consent");
    await driver.script(
      `window.__rydPermissionEvents = [];
      browser.permissions.onAdded.addListener(value => window.__rydPermissionEvents.push({type:"added", ...value}));
      browser.permissions.onRemoved.addListener(value => window.__rydPermissionEvents.push({type:"removed", ...value}));`,
    );
    await delay(1000);
    await driver.script(
      `const done=arguments[arguments.length-1]; browser.tabs.getCurrent().then(tab=>browser.tabs.update(tab.id,{active:true})).then(()=>done(true));`,
      [],
      true,
    );
    result.patreonPrivacyNote = await driver.script(`
      const note = document.getElementById("patreon-privacy-note");
      const login = document.getElementById("patreon-login-btn");
      const rect = note.getBoundingClientRect();
      return {
        text: note.textContent.trim(),
        describedBy: login.getAttribute("aria-describedby"),
        visible: note.checkVisibility(),
        withinViewport: rect.left >= 0 && rect.right <= innerWidth,
        belowLogin: rect.top >= login.getBoundingClientRect().bottom,
        fontSize: getComputedStyle(note).fontSize,
        viewportWidth: innerWidth
      };
    `);
    assert.equal(
      result.patreonPrivacyNote.text,
      "Patreon membership information is used to verify premium access. We do not receive your card or bank details.",
    );
    assert.equal(result.patreonPrivacyNote.describedBy, "patreon-privacy-note");
    assert.equal(result.patreonPrivacyNote.visible, true);
    assert.equal(result.patreonPrivacyNote.withinViewport, true);
    assert.equal(result.patreonPrivacyNote.belowLogin, true);
    const shot = await driver.command("WebDriver:TakeScreenshot", { full: true });
    await fs.writeFile(path.join(evidence, "popup.png"), Buffer.from(shot.value, "base64"));
    result.screenshots.push("popup.png");
    if (consentDisabled) {
      for (const selector of ["#patreon-login-btn", "#github-login-btn"]) {
        await driver.click(selector);
        await until(async () => {
          try {
            await driver.command("WebDriver:GetAlertText");
            return true;
          } catch (_) {
            return false;
          }
        }, "missing-consent notice with native data consent disabled");
        await driver.command("WebDriver:DismissAlert");
        await assertPermissionState(selector + " stays denied without native data consent", false);
      }
      await assertNoAuthenticationTraffic("disabled native consent cannot authorize either provider");
      assert.equal(requests.filter((request) => request.path.startsWith("/api/auth/")).length, 0);
      result.scenarios.push(
        "disabled native data-consent API rejects cached accounts and both login gestures without authentication traffic",
      );
      result.validationDepth =
        "generated Firefox artifact with loopback API substitution and native data-consent API disabled";
    } else {
      await driver.click("#patreon-login-btn");
      await driver.context("chrome");
      result.nativePermissionPrompt = await until(
        () =>
          driver.script(
            `const notification = document.getElementById("addon-webext-permissions-notification"); return document.getElementById("notification-popup")?.state === "open" && notification ? { heading:notification.getAttribute("endlabel"), data:document.getElementById("addon-webext-perm-list-data-collection").textContent, allow:notification.getAttribute("buttonlabel"), deny:notification.getAttribute("secondarybuttonlabel") } : false;`,
          ),
        "native consent prompt",
      );
      console.log("NATIVE PROMPT", JSON.stringify(result.nativePermissionPrompt));
      assert.match(result.nativePermissionPrompt.data, /authentication information/i);
      assert.doesNotMatch(result.nativePermissionPrompt.data, /financial|payment/i);
      // Native arrow panels live outside the headless compositor screenshot. Preserve their exact text instead.
      await driver.script(
        `document.querySelector("#addon-webext-permissions-notification .popup-notification-secondary-button").click();`,
      );
      await driver.context("content");
      await until(async () => {
        try {
          await driver.command("WebDriver:GetAlertText");
          return true;
        } catch (_) {
          return false;
        }
      }, "extension denial notice");
      await driver.command("WebDriver:DismissAlert");
      const denied = await driver.script(
        `const done=arguments[arguments.length-1]; browser.permissions.contains({data_collection:arguments[0]}).then(done);`,
        [optional],
        true,
      );
      assert.equal(denied, false);
      await assertPermissionState("native Deny leaves authentication consent absent", false);
      assert.equal(requests.filter((request) => request.path.startsWith("/api/auth/")).length, 0);
      result.scenarios.push("native Deny prevents OAuth requests");
      console.log("DENIAL PASSED");
      await driver.click("#patreon-login-btn");
      await driver.context("chrome");
      await until(
        () => driver.script(`return document.getElementById("notification-popup")?.state === "open";`),
        "second consent prompt",
      );
      await driver.script(
        `document.querySelector("#addon-webext-permissions-notification .popup-notification-primary-button").click();`,
      );
      await driver.context("content");
      await until(
        () => driver.script(`return document.getElementById("patreon-logged-in").style.display === "block";`),
        "mock OAuth completion",
      );
      const granted = await driver.script(
        `const done=arguments[arguments.length-1]; browser.permissions.contains({data_collection:arguments[0]}).then(done);`,
        [optional],
        true,
      );
      assert.equal(granted, true);
      const grantedState = await assertPermissionState("native Allow grants authentication consent", true);
      assert(
        grantedState.events.some(
          (event) => event.type === "added" && event.data_collection?.includes("authenticationInfo"),
        ),
      );
      assert.equal(requests.filter((request) => request.path === "/api/auth/oauth/login").length, 1);
      assert.equal(
        requests.filter((request) => request.path === "/api/auth/oauth/exchange" && request.method === "POST").length,
        1,
      );
      result.scenarios.push("native Allow completes generated Patreon OAuth against loopback");
      assert.equal(
        await driver.script(`return document.getElementById("patreon-privacy-note").checkVisibility();`),
        false,
      );
      console.log("GRANT PASSED");
      const grantShot = await driver.command("WebDriver:TakeScreenshot", { full: true });
      await fs.writeFile(path.join(evidence, "popup-granted.png"), Buffer.from(grantShot.value, "base64"));
      result.screenshots.push("popup-granted.png");
      await driver.script(
        `const done=arguments[arguments.length-1]; browser.permissions.remove({data_collection:arguments[0]}).then(done);`,
        [optional],
        true,
      );
      await until(
        () =>
          driver.script(
            `const done=arguments[arguments.length-1]; browser.storage.sync.get(["patreonAuthenticated","patreonUser","patreonSessionToken"]).then(value=>done(Object.keys(value).length===0));`,
            [],
            true,
          ),
        "stored authentication cleanup after revocation",
      );
      await until(
        () => driver.script(`return document.getElementById("patreon-logged-out").style.display === "block";`),
        "logged-out UI after revocation",
      );
      const revokedState = await assertPermissionState("native revocation removes authentication consent", false);
      assert(
        revokedState.events.some(
          (event) => event.type === "removed" && event.data_collection?.includes("authenticationInfo"),
        ),
      );
      await assertNoAuthenticationTraffic("Patreon revocation blocks subsequent account requests");
      result.scenarios.push(
        "native revocation removes stored authentication, logs out popup, and blocks subsequent account traffic",
      );
      console.log("REVOCATION PASSED");
      await driver.click("#github-login-btn");
      await driver.context("chrome");
      await until(
        () => driver.script(`return document.getElementById("notification-popup")?.state === "open";`),
        "GitHub consent prompt",
      );
      await driver.script(
        `document.querySelector("#addon-webext-permissions-notification .popup-notification-primary-button").click();`,
      );
      await driver.context("content");
      await until(
        () => driver.script(`return document.getElementById("patreon-logged-in").style.display === "block";`),
        "GitHub mock OAuth completion",
      );
      assert.equal(
        requests.filter((request) => request.path === "/api/auth/github/login" && request.method === "GET").length,
        1,
      );
      assert.equal(
        requests.filter((request) => request.path === "/api/auth/github/exchange" && request.method === "POST").length,
        1,
      );
      assert.equal(result.githubPkceVerified, true);
      await assertPermissionState("GitHub native Allow grants authentication consent", true);
      result.scenarios.push("native Allow completes generated GitHub OAuth against loopback");
      await driver.script(
        `const done=arguments[arguments.length-1]; browser.permissions.remove({data_collection:["authenticationInfo"]}).then(done);`,
        [],
        true,
      );
      await until(
        () =>
          driver.script(
            `const done=arguments[arguments.length-1]; browser.storage.sync.get(["patreonAuthenticated","patreonUser","patreonSessionToken"]).then(value=>done(Object.keys(value).length===0));`,
            [],
            true,
          ),
        "authentication permission revocation clears GitHub authentication",
      );
      await until(
        () => driver.script(`return document.getElementById("patreon-logged-out").style.display === "block";`),
        "GitHub logged-out UI after authentication permission revocation",
      );
      await assertPermissionState("GitHub revocation removes authentication consent", false);
      await assertNoAuthenticationTraffic("GitHub revocation blocks subsequent account requests");
      result.scenarios.push(
        "revoking authentication category clears GitHub account state and blocks subsequent account traffic",
      );
      const revokeShot = await driver.command("WebDriver:TakeScreenshot", { full: true });
      await fs.writeFile(path.join(evidence, "popup-revoked.png"), Buffer.from(revokeShot.value, "base64"));
      result.screenshots.push("popup-revoked.png");
    }
    if (changelogLifecycle)
      await require("./firefox-changelog-lifecycle").observeChangelogLifecycle({
        driver,
        derived,
        manifest,
        result,
        until,
      });
    await driver.context("chrome");
    result.diagnostics = await driver.script(
      `Services.console.unregisterListener(window.__rydConsentListener); return window.__rydConsentDiagnostics;`,
    );
    for (const [filename, hash] of Object.entries(sourceHashes))
      assert.equal(
        crypto
          .createHash("sha256")
          .update(await fs.readFile(path.join(artifact, filename)))
          .digest("hex"),
        hash,
        `Artifact changed during test: ${filename}`,
      );
    assert(
      !blocked.some((request) => request.host.includes("returnyoutubedislikeapi.com")),
      "Extension traffic escaped loopback substitution",
    );
    assert(
      !blocked.some((request) => /(^|\.)(github\.com|patreon\.com)(:|$)/i.test(request.host)),
      "Authentication traffic escaped loopback substitution",
    );
    assert.deepEqual(unexpectedRequests, [], "Unexpected extension request");
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack || error);
    throw error;
  } finally {
    if (driver) {
      await driver.command("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
      driver.socket.destroy();
    }
    if (child.exitCode === null) child.kill();
    await until(() => child.exitCode !== null || child.signalCode !== null, "owned Firefox process exit").catch(
      () => {},
    );
    server.closeAllConnections();
    proxy.closeAllConnections();
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => proxy.close(resolve)),
    ]);
    await fs.writeFile(path.join(evidence, "firefox.log"), firefoxLog);
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    for (const owned of [
      profile,
      derived,
      path.join(evidence, "baseline"),
      path.join(evidence, "current.xpi"),
      path.join(evidence, "baseline.xpi"),
    ]) {
      assert(path.resolve(owned).startsWith(`${path.resolve(evidence)}${path.sep}`));
      await fs.rm(owned, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
    }
    console.log(`Evidence: ${evidence}`);
  }
}

if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = { Marionette, run };
