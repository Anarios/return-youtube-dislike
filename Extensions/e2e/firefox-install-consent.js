const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { inflateRawSync } = require("node:zlib");
const {
  chooseNativePermission,
  connectMarionette,
  readNativePermissionPrompt,
  spawnHeadlessFirefox,
} = require("./firefox-consent-smoke");
const { delay, until } = require("./feature-permissions-fixtures");

const ROOT = path.resolve(__dirname, "../..");
const ADDON_ID = "{762f9885-5a13-4abd-9c77-433dcd38b8fd}";
const DEFAULT_BASELINE_VERSIONS = Object.freeze(["3.0.0.16", "3.0.0.18", "4.0.6"]);
const OPTIONAL_DATA_COLLECTION = Object.freeze([
  "authenticationInfo",
  "browsingActivity",
  "personallyIdentifyingInfo",
  "websiteActivity",
  "websiteContent",
]);
const sorted = (values) => [...values].sort();

function baselineVersions(value = process.env.RYD_FIREFOX_BASELINE_VERSIONS) {
  const versions = (value || DEFAULT_BASELINE_VERSIONS.join(","))
    .split(",")
    .map((version) => version.trim())
    .filter(Boolean);
  assert(versions.length, "RYD_FIREFOX_BASELINE_VERSIONS lists no baseline versions");
  for (const version of versions) assert.match(version, /^\d+(?:\.\d+){1,3}$/, "Invalid baseline version " + version);
  return [...new Set(versions)];
}

function expectedGrantsAfterUpdate(baselineManifest) {
  const required = baselineManifest.browser_specific_settings?.gecko?.data_collection_permissions?.required || [];
  return sorted(
    required.filter(
      (category) => OPTIONAL_DATA_COLLECTION.includes(category) && category !== "personallyIdentifyingInfo",
    ),
  );
}

async function readBaselines(directory, versions) {
  const baselines = [];
  const skipped = [];
  for (const version of versions) {
    const filename = path.join(directory, version + ".xpi");
    let bytes;
    try {
      bytes = await fs.readFile(filename);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      skipped.push({ version, filename, reason: "Signed baseline package not found" });
      console.warn("Skipping baseline " + version + ": signed package not found at " + filename);
      continue;
    }
    const info = readXpi(bytes);
    assert.equal(info.manifest.version, version);
    assert.equal(info.manifest.browser_specific_settings.gecko.id, ADDON_ID);
    assert(info.signatureMetadataPresent, version + " has no signature metadata");
    baselines.push({
      filename,
      version,
      sha256: info.sha256,
      signatureMetadataPresent: true,
      expectedGrants: expectedGrantsAfterUpdate(info.manifest),
    });
  }
  return { baselines, skipped };
}

function readXpi(buffer) {
  let footer = buffer.length - 22;
  const minimum = Math.max(0, buffer.length - 65557);
  while (footer >= minimum && buffer.readUInt32LE(footer) !== 0x06054b50) footer--;
  assert(footer >= minimum, "XPI has no ZIP end-of-directory record");
  const entries = new Map();
  const count = buffer.readUInt16LE(footer + 10);
  let offset = buffer.readUInt32LE(footer + 16);
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, "Invalid XPI directory entry");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
    entries.set(name, { compressedSize, localOffset, method });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  const readEntry = (name) => {
    const entry = entries.get(name);
    assert(entry, "XPI has no " + name);
    assert.equal(buffer.readUInt32LE(entry.localOffset), 0x04034b50, "Invalid XPI local header");
    const start =
      entry.localOffset +
      30 +
      buffer.readUInt16LE(entry.localOffset + 26) +
      buffer.readUInt16LE(entry.localOffset + 28);
    const compressed = buffer.subarray(start, start + entry.compressedSize);
    assert([0, 8].includes(entry.method), "Unsupported XPI compression method");
    return entry.method === 8 ? inflateRawSync(compressed) : compressed;
  };
  return {
    manifest: JSON.parse(readEntry("manifest.json").toString()),
    signatureMetadataPresent: entries.has("META-INF/mozilla.rsa") || entries.has("META-INF/cose.sig"),
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    runtimeHashes: Object.fromEntries(
      ["ryd.background.js", "ryd.content-script.js", "popup.js", "consent.js"]
        .filter((name) => entries.has(name))
        .map((name) => [name, crypto.createHash("sha256").update(readEntry(name)).digest("hex")]),
    ),
  };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

async function addonState(driver) {
  return driver.script(
    `
    const done=arguments[arguments.length-1];
    ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.getAddonByID(arguments[0])
      .then(addon=>done(addon?{id:addon.id,version:addon.version,active:addon.isActive,signedState:addon.signedState}:null));
  `,
    [ADDON_ID],
    true,
  );
}

async function settledTabsWithoutExtensionPages(driver, quietPeriod = 1500) {
  let previous = null;
  let quietSince = Date.now();
  return until(async () => {
    const tabs = await driver.script(
      'for(const tab of [...gBrowser.tabs])if(tab.linkedBrowser.currentURI.spec.startsWith("moz-extension://"))gBrowser.removeTab(tab);return {busy:[...gBrowser.tabs].some(tab=>tab.hasAttribute("busy")),urls:[...gBrowser.tabs].map(tab=>tab.linkedBrowser.currentURI.spec)};',
    );
    const current = JSON.stringify(tabs.urls);
    if (tabs.busy || current !== previous) {
      previous = current;
      quietSince = Date.now();
      return null;
    }
    return Date.now() - quietSince >= quietPeriod ? tabs.urls : null;
  }, "baseline install tabs to settle");
}

async function run() {
  const evidence = path.resolve(
    process.env.RYD_FIREFOX_UPDATE_EVIDENCE ||
      path.join(ROOT, ".private/validation", "signed-update-" + new Date().toISOString().replace(/[:.]/g, "-")),
  );
  await fs.mkdir(evidence, { recursive: true });
  const target = process.env.RYD_FIREFOX_SIGNED_TARGET ? path.resolve(process.env.RYD_FIREFOX_SIGNED_TARGET) : null;
  const baselines = path.resolve(
    process.env.RYD_FIREFOX_SIGNED_BASELINES || path.join(ROOT, ".private/validation/firefox-3-to-4-permissions"),
  );
  const result = {
    startedAt: new Date().toISOString(),
    depth: "immutable signed packages, native Firefox self-hosted update checks",
    target,
    baselines: [],
    skippedBaselines: [],
    scenarios: [],
  };
  const available = await readBaselines(baselines, baselineVersions());
  result.baselines = available.baselines;
  result.skippedBaselines = available.skipped;
  if (!result.baselines.length) {
    result.status = "blocked";
    result.blocker =
      "No signed baseline packages were found in " +
      baselines +
      ". Place <version>.xpi files there or set RYD_FIREFOX_SIGNED_BASELINES and RYD_FIREFOX_BASELINE_VERSIONS.";
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.error(result.blocker + "\nEvidence: " + evidence);
    process.exitCode = 2;
    return result;
  }
  if (!target) {
    result.status = "blocked";
    result.blocker =
      "RYD_FIREFOX_SIGNED_TARGET is absent. A signed package containing the intended new manifest and runtime is required; signing and publishing are not authorized. Temporary or unsigned packages do not prove signed update prompts.";
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.error(result.blocker + "\nEvidence: " + evidence);
    process.exitCode = 2;
    return result;
  }
  const bytes = await fs.readFile(target);
  const info = readXpi(bytes);
  assert(info.signatureMetadataPresent, "Target is unsigned; signed-update validation cannot proceed");
  assert.equal(info.manifest.browser_specific_settings.gecko.id, ADDON_ID);
  assert.deepEqual(info.manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
  assert.deepEqual(
    sorted(info.manifest.browser_specific_settings.gecko.data_collection_permissions.optional),
    OPTIONAL_DATA_COLLECTION,
  );
  const expectedArtifact = path.resolve(
    process.env.RYD_FIREFOX_ARTIFACT || path.join(ROOT, "Extensions/combined/dist/firefox"),
  );
  for (const file of ["ryd.background.js", "ryd.content-script.js", "popup.js", "consent.js"]) {
    const expectedHash = crypto
      .createHash("sha256")
      .update(await fs.readFile(path.join(expectedArtifact, file)))
      .digest("hex");
    assert.equal(
      info.runtimeHashes[file],
      expectedHash,
      "Signed target differs from intended generated runtime: " + file,
    );
  }
  result.target = {
    filename: target,
    version: info.manifest.version,
    sha256: info.sha256,
    runtimeHashes: info.runtimeHashes,
  };
  const requests = [];
  const blocked = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, path: new URL(request.url, "http://localhost").pathname });
    if (request.url === "/updates.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          addons: {
            [ADDON_ID]: {
              updates: [
                {
                  version: info.manifest.version,
                  update_link: origin + "/target.xpi",
                  update_hash: "sha256:" + info.sha256,
                  applications: { gecko: { strict_min_version: "140.0" } },
                },
              ],
            },
          },
        }),
      );
    } else if (request.url === "/target.xpi") {
      response.setHeader("Content-Type", "application/x-xpinstall");
      response.end(bytes);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  const origin = "http://127.0.0.1:" + (await listen(server));
  const proxy = http.createServer((request, response) => {
    blocked.push({ method: request.method, host: new URL(request.url).hostname });
    response.writeHead(502);
    response.end();
  });
  proxy.on("connect", (request, socket) => {
    blocked.push({ method: "CONNECT", host: request.url });
    socket.end("HTTP/1.1 502 Isolated fixture\r\n\r\n");
  });
  const proxyPort = await listen(proxy);
  result.updateUrl = origin + "/updates.json";
  result.updateUrlMechanism =
    "Owned profile extensions.update.url directs the signed baselines' absent update_url to the self-hosted JSON manifest; signed XPIs remain byte-for-byte intact.";
  try {
    for (const baseline of result.baselines) {
      const profile = path.join(evidence, "profile-" + baseline.version);
      await fs.mkdir(profile, { recursive: true });
      const portServer = net.createServer();
      const port = await listen(portServer);
      await new Promise((resolve) => portServer.close(resolve));
      const prefs = {
        "marionette.port": port,
        "browser.shell.checkDefaultBrowser": false,
        "browser.startup.homepage_override.mstone": "ignore",
        "browser.startup.page": 0,
        "startup.homepage_welcome_url": "about:blank",
        "startup.homepage_welcome_url.additional": "",
        "browser.newtabpage.enabled": false,
        "app.update.disabledForTesting": true,
        "extensions.update.enabled": false,
        "extensions.update.url": result.updateUrl,
        "extensions.checkUpdateSecurity": false,
        "xpinstall.signatures.required": true,
        "network.proxy.type": 1,
        "network.proxy.http": "127.0.0.1",
        "network.proxy.http_port": proxyPort,
        "network.proxy.ssl": "127.0.0.1",
        "network.proxy.ssl_port": proxyPort,
        "network.proxy.no_proxies_on": "127.0.0.1,localhost",
        "network.proxy.failover_direct": false,
        "network.trr.mode": 5,
      };
      await fs.writeFile(
        path.join(profile, "user.js"),
        Object.entries(prefs)
          .map(([key, value]) => "user_pref(" + JSON.stringify(key) + "," + JSON.stringify(value) + ");")
          .join("\n"),
      );
      const log = await fs.open(path.join(evidence, "firefox-" + baseline.version + ".log"), "a");
      const child = spawnHeadlessFirefox(profile);
      child.stdout.on("data", (chunk) => void log.write(chunk));
      child.stderr.on("data", (chunk) => void log.write(chunk));
      const scenario = { from: baseline.version, process: { pid: child.pid } };
      result.scenarios.push(scenario);
      child.on("error", (error) => {
        scenario.process.error = String(error);
      });
      child.on("exit", (code, signal) => {
        scenario.process.exitCode = code;
        scenario.process.signal = signal;
      });
      let driver;
      try {
        driver = await connectMarionette(port, "Firefox Marionette startup");
        const session = await driver.command("WebDriver:NewSession", { acceptInsecureCerts: true });
        scenario.browserVersion = session.capabilities.browserVersion;
        await driver.context("chrome");
        const install = await driver.script(
          `const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);AddonManager.getInstallForFile(file).then(install=>{window.__rydInstall=install;AddonManager.installAddonFromAOMWithOptions(gBrowser.selectedBrowser,Services.io.newFileURI(file),install,{});done({error:install.error});},error=>done({error:String(error)}));`,
          [baseline.filename],
          true,
        );
        assert(!install.error, JSON.stringify(install));
        await until(() => readNativePermissionPrompt(driver), "signed baseline install prompt");
        await chooseNativePermission(driver, true);
        scenario.baseline = await until(async () => {
          const state = await addonState(driver);
          return state?.active && state;
        }, "signed baseline activation");
        assert(scenario.baseline.signedState > 0, "Firefox did not validate baseline signature");
        await driver.script(
          "for(const notice of [...PopupNotifications._currentNotifications])PopupNotifications.remove(notice);",
        );
        const tabsBefore = await settledTabsWithoutExtensionPages(driver);
        await driver.script(
          'const {ExtensionsUI}=ChromeUtils.importESModule("resource:///modules/ExtensionsUI.sys.mjs");window.__updatePrompts=[];window.__updateNotifications=[];const originalPrompt=ExtensionsUI.showPermissionsPrompt;ExtensionsUI.showPermissionsPrompt=function(...args){window.__updatePrompts.push({at:Date.now(),header:args[1]?.header});return originalPrompt.apply(this,args);};const originalShow=PopupNotifications.show;PopupNotifications.show=function(...args){if(args[1]==="addon-webext-permissions")window.__updateNotifications.push({at:Date.now(),id:args[1]});return originalShow.apply(this,args);};',
        );
        const update = await driver.script(
          `const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");AddonManager.getAddonByID(arguments[0]).then(addon=>addon.findUpdates({onUpdateAvailable(addon,install){window.__rydUpdateInstall=install;AddonManager.installAddonFromAOMWithOptions(gBrowser.selectedBrowser,install.sourceURI,install,{preferUpdateOverInstall:true});done({version:install.version});},onNoUpdateAvailable(){done({error:"No update available"});},onUpdateFinished(addon,error){if(error)done({error});}},AddonManager.UPDATE_WHEN_USER_REQUESTED));`,
          [ADDON_ID],
          true,
        );
        assert(!update.error, JSON.stringify(update));
        assert.equal(update.version, info.manifest.version);
        scenario.updated = await until(
          async () => {
            const state = await addonState(driver);
            return state?.version === info.manifest.version && state.active && state;
          },
          "updated signed target activation",
          25000,
        );
        assert(scenario.updated.signedState > 0, "Firefox did not validate target signature");
        scenario.prompt = await readNativePermissionPrompt(driver);
        assert.equal(scenario.prompt, null, baseline.version + " update unexpectedly prompted");
        await delay(1500);
        scenario.tabsAfter = await driver.script(
          "return [...gBrowser.tabs].map(tab=>tab.linkedBrowser.currentURI.spec);",
        );
        assert.deepEqual(scenario.tabsAfter, tabsBefore, "Update opened a tab");
        scenario.nativeUpdateEvidence = await driver.script(
          'const {ExtensionsUI}=ChromeUtils.importESModule("resource:///modules/ExtensionsUI.sys.mjs");return {prompts:window.__updatePrompts,notifications:window.__updateNotifications,pendingUpdates:ExtensionsUI.updates.size};',
        );
        assert.deepEqual(scenario.nativeUpdateEvidence.prompts, []);
        assert.deepEqual(scenario.nativeUpdateEvidence.notifications, []);
        assert.equal(scenario.nativeUpdateEvidence.pendingUpdates, 0);
        const uuid = await driver.script("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;", [
          ADDON_ID,
        ]);
        await driver.context("content");
        await driver.command("WebDriver:Navigate", { url: "moz-extension://" + uuid + "/popup.html" });
        scenario.permissions = await driver.script(
          "const done=arguments[arguments.length-1];browser.permissions.getAll().then(done);",
          [],
          true,
        );
        assert.deepEqual(
          sorted(scenario.permissions.data_collection),
          baseline.expectedGrants,
          baseline.version + " update did not keep exactly its previously required categories",
        );
        scenario.migration = await driver.script(
          "const done=arguments[arguments.length-1];browser.storage.local.get(arguments[0]).then(done);",
          ["featureDataPermissionsMigrated"],
          true,
        );
        assert.equal(scenario.migration.featureDataPermissionsMigrated, true, "One-time migration was not recorded");
        scenario.passed = true;
      } finally {
        if (driver) {
          await driver.command("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
          driver.socket.destroy();
        }
        scenario.process.gracefulExit = await until(
          () => child.exitCode !== null || child.signalCode !== null,
          "graceful owned Firefox exit",
        ).catch(() => false);
        if (!scenario.process.gracefulExit && child.exitCode === null) child.kill();
        await until(() => child.exitCode !== null || child.signalCode !== null, "owned Firefox exit").catch(() => {});
        await log.close();
      }
    }
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    result.requests = requests;
    result.blockedExternal = blocked;
    result.finishedAt = new Date().toISOString();
    server.closeAllConnections();
    proxy.closeAllConnections();
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => proxy.close(resolve)),
    ]);
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.log("Evidence: " + evidence);
  }
  return result;
}

if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { baselineVersions, expectedGrantsAfterUpdate, readBaselines, readXpi, run };
