const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const {
  chooseNativePermission,
  connectMarionette,
  readNativePermissionPrompt,
  selectCurrentTab,
  spawnHeadlessFirefox,
} = require("./firefox-consent-smoke");
const {
  ROOT,
  VIDEO_A,
  VIDEO_B,
  COMMENT_ID,
  until,
  delay,
  listen,
  startFixtures,
  prepareArtifact,
  configureDisabledComments,
  assertNoLinkedIdentity,
} = require("./feature-permissions-fixtures");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const accountSeed = {
  patreonAuthenticated: true,
  patreonSessionToken: "fixture-recovery-session",
  patreonUser: { membershipTier: "commenter", hasActiveMembership: true },
};
const notificationIds = [
  "44444444-4444-4444-8444-444444444441",
  "44444444-4444-4444-8444-444444444442",
  "44444444-4444-4444-8444-444444444443",
  "44444444-4444-4444-8444-444444444444",
];
function snapshot(revision) {
  return {
    revision: String(revision),
    unreadCount: revision,
    nextCursor: null,
    items: Array.from({ length: revision }, (_, index) => ({
      id: notificationIds[index],
      type: "reply",
      commentId: COMMENT_ID,
      rootId: COMMENT_ID,
      videoId: VIDEO_B,
      actorNickname: "Fixture recovery " + (index + 1),
      likeCount: 0,
      read: false,
      createdAt: "2026-10-25T12:00:0" + index + "Z",
      updatedAt: "2026-10-25T12:00:0" + index + "Z",
      revision: String(index + 1),
    })),
  };
}
class ChromeAdapter {
  constructor(fixture, evidence, result) {
    Object.assign(this, { fixture, evidence, result });
  }
  async start() {
    this.derived = path.join(this.evidence, "extension");
    Object.assign(
      this.result,
      await prepareArtifact(path.join(ROOT, "Extensions/combined/dist/chrome"), this.derived, this.fixture.apiOrigin),
    );
    this.context = await chromium.launchPersistentContext(path.join(this.evidence, "profile"), {
      channel: "chromium",
      headless: true,
      chromiumSandbox: true,
      ignoreHTTPSErrors: true,
      proxy: { server: this.fixture.proxyOrigin, bypass: "127.0.0.1,localhost" },
      args: ["--disable-extensions-except=" + this.derived, "--load-extension=" + this.derived, "--no-first-run"],
    });
    this.worker =
      this.context.serviceWorkers()[0] || (await this.context.waitForEvent("serviceworker", { timeout: 15000 }));
    this.id = new URL(this.worker.url()).hostname;
    this.base = "chrome-extension://" + this.id;
    this.control = await this.context.newPage();
    this.video = await this.context.newPage();
    this.control.on("pageerror", (error) =>
      this.result.diagnostics.push({ at: Date.now(), source: "popup", message: String(error), stack: error.stack }),
    );
    this.video.on("pageerror", (error) =>
      this.result.diagnostics.push({ at: Date.now(), source: "video", message: String(error) }),
    );
    await this.identity("initial");
    await this.openPopup();
  }
  async identity(label) {
    const loaded = await this.worker.evaluate(async () => ({
      version: chrome.runtime.getManifest().version,
      background: await (await fetch(chrome.runtime.getURL("ryd.background.js"))).text(),
      content: await (await fetch(chrome.runtime.getURL("ryd.content-script.js"))).text(),
    }));
    assert.equal(sha256(loaded.background), sha256(await fs.readFile(path.join(this.derived, "ryd.background.js"))));
    assert.equal(sha256(loaded.content), sha256(await fs.readFile(path.join(this.derived, "ryd.content-script.js"))));
    (this.result.loadedIdentities ||= []).push({
      label,
      id: this.id,
      version: loaded.version,
      background: sha256(loaded.background),
      content: sha256(loaded.content),
    });
  }
  async evaluate(fn, value) {
    return this.control.evaluate(fn, value);
  }
  async openPopup() {
    await this.control.goto(this.base + "/popup.html", { waitUntil: "domcontentloaded", timeout: 20000 });
    await this.control.bringToFront();
  }
  async showInbox() {
    if ((await this.control.locator("#ryd-discussion-inbox-toggle").getAttribute("aria-expanded")) !== "true")
      await this.control.locator("#ryd-discussion-inbox-toggle").click();
  }
  async rendered(id) {
    return this.control.locator('[data-notification-id="' + id + '"]').count();
  }
  async activity(videoId = VIDEO_B) {
    await this.video.bringToFront();
    if (!this.video.url().startsWith("https://www.youtube.com/"))
      await this.video.goto("https://www.youtube.com/watch?v=" + VIDEO_A, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    await this.video.evaluate((value) => window.__navigationFixture.navigate("watch", value), videoId);
    await this.video.evaluate(configureDisabledComments);
    await this.video.waitForSelector("#ryd-discussion-panel", { timeout: 15000 });
  }
  async capture(name) {
    await this.control.bringToFront();
    await this.control.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await this.control.screenshot({ path: path.join(this.evidence, name + ".png"), fullPage: true });
  }
  async stopWorker() {
    const cdp = await this.context.newCDPSession(this.video);
    const versions = new Map();
    this.workerVersions = versions;
    this.workerCDPSession = cdp;
    this.result.workerVersionEvents = [];
    cdp.on("ServiceWorker.workerVersionUpdated", ({ versions: items }) => {
      for (const item of items) {
        versions.set(item.versionId, item);
        this.result.workerVersionEvents.push({
          at: Date.now(),
          versionId: item.versionId,
          runningStatus: item.runningStatus,
          targetId: item.targetId,
        });
      }
    });
    await cdp.send("ServiceWorker.enable");
    const version = await until(
      () =>
        [...versions.values()].find((item) => item.scriptURL === this.worker.url() && item.runningStatus === "running"),
      "real MV3 worker version",
    );
    this.result.stoppedWorker = {
      versionId: version.versionId,
      scriptURL: version.scriptURL,
      runningStatus: version.runningStatus,
    };
    await cdp.send("ServiceWorker.stopWorker", { versionId: version.versionId });
    await until(
      () =>
        [...versions.values()].some((item) => item.versionId === version.versionId && item.runningStatus === "stopped"),
      "MV3 worker stopped",
    );
    this.result.stoppedWorker.confirmedRunningStatus = versions.get(version.versionId).runningStatus;
    this.stoppedWorkerObject = this.worker;
    if (this.fixture.hubConnections) {
      this.result.stoppedWorker.fixtureTransportCleanup = true;
      this.fixture.dropHubConnections();
    }
    await until(() => this.fixture.hubConnections === 0, "old fixture transport closed after confirmed worker stop");
  }
  async reattachWorker() {
    await until(
      () => this.workerVersions.get(this.result.stoppedWorker.versionId)?.runningStatus === "running",
      "real stopped MV3 worker restarted after popup activity",
    );
    this.result.restartedWorker = { ...this.workerVersions.get(this.result.stoppedWorker.versionId) };
    this.worker =
      this.context.serviceWorkers().find((item) => item.url().startsWith(this.base)) ||
      (await this.context.waitForEvent("serviceworker", {
        predicate: (item) => item.url().startsWith(this.base),
        timeout: 15000,
      }));
    await this.identity("after-real-worker-stop");
    await this.workerCDPSession.detach();
    this.workerCDPSession = null;
  }
  async revokeAccount() {
    await this.evaluate(async () => {
      await chrome.storage.sync.remove(["patreonAuthenticated", "patreonUser", "patreonSessionToken"]);
    });
  }
  async close() {
    await this.workerCDPSession?.detach().catch(() => {});
    await this.context?.close();
  }
}
class FirefoxAdapter {
  constructor(fixture, evidence, result) {
    Object.assign(this, { fixture, evidence, result });
  }
  async start() {
    this.derived = path.join(this.evidence, "extension");
    Object.assign(
      this.result,
      await prepareArtifact(path.join(ROOT, "Extensions/combined/dist/firefox"), this.derived, this.fixture.apiOrigin),
    );
    const profile = path.join(this.evidence, "profile");
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
      "network.proxy.type": 1,
      "network.proxy.http": "127.0.0.1",
      "network.proxy.http_port": this.fixture.proxyPort,
      "network.proxy.ssl": "127.0.0.1",
      "network.proxy.ssl_port": this.fixture.proxyPort,
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
    this.log = await fs.open(path.join(this.evidence, "firefox.log"), "a");
    this.child = spawnHeadlessFirefox(profile);
    this.result.process = { pid: this.child.pid };
    this.child.stdout.on("data", (chunk) => void this.log.write(chunk).catch(() => {}));
    this.child.stderr.on("data", (chunk) => void this.log.write(chunk).catch(() => {}));
    this.child.on("error", (error) => {
      this.result.process.error = String(error);
    });
    this.child.on("exit", (code, signal) => {
      this.result.process.exitCode = code;
      this.result.process.signal = signal;
    });
    this.driver = await connectMarionette(port, "native Firefox Marionette");
    this.result.session = await this.driver.command("WebDriver:NewSession", { acceptInsecureCerts: true });
    await this.driver.command("WebDriver:SetTimeouts", { pageLoad: 20000, script: 25000, implicit: 0 });
    await this.driver.context("chrome");
    await this.driver.script(
      "window.__recoveryDiagnostics=[];window.__recoveryListener={observe(value){window.__recoveryDiagnostics.push({at:Date.now(),message:value.message||String(value)});}};Services.console.registerListener(window.__recoveryListener);",
    );
    const installed = await this.driver.script(
      'const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);AddonManager.installTemporaryAddon(file).then(addon=>done({id:addon.id,version:addon.version}),error=>done({error:String(error)}));',
      [this.derived],
      true,
    );
    assert(!installed.error, JSON.stringify(installed));
    this.id = installed.id;
    this.result.installed = installed;
    const uuid = await this.driver.script("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;", [
      this.id,
    ]);
    this.base = "moz-extension://" + uuid;
    await this.driver.context("content");
    const handles = await this.driver.command("WebDriver:GetWindowHandles");
    this.control = (handles.value || handles)[0];
    await this.closeInstallWelcome();
    await this.activate(this.control);
    await this.navigate(this.base + "/consent.html?feature=account");
    await selectCurrentTab(this.driver);
    await this.driver.click("#consent-continue");
    this.result.accountPrompt = await this.acceptNativePrompt("native account permission prompt");
    await this.waitForDataCollection(["authenticationInfo", "personallyIdentifyingInfo"], "native account grant");
    await this.navigate(this.base + "/popup.html");
    await until(
      () => this.driver.script('return !document.getElementById("ryd-counts-consent").hidden;'),
      "popup counts offer",
    );
    await selectCurrentTab(this.driver);
    await this.driver.click("#ryd-counts-consent-allow");
    this.result.countsPrompt = await this.acceptNativePrompt("native counts permission prompt");
    await this.waitForDataCollection(["browsingActivity"], "native counts grant");
    await this.openPopup();
    const loaded = await this.evaluate(async () => ({
      version: browser.runtime.getManifest().version,
      background: await (await fetch(browser.runtime.getURL("ryd.background.js"))).text(),
      content: await (await fetch(browser.runtime.getURL("ryd.content-script.js"))).text(),
      consent: await (await fetch(browser.runtime.getURL("consent.js"))).text(),
    }));
    for (const [key, file] of [
      ["background", "ryd.background.js"],
      ["content", "ryd.content-script.js"],
      ["consent", "consent.js"],
    ])
      assert.equal(sha256(loaded[key]), sha256(await fs.readFile(path.join(this.derived, file))));
    this.result.loadedIdentities = [
      {
        id: this.id,
        version: loaded.version,
        background: sha256(loaded.background),
        content: sha256(loaded.content),
        consent: sha256(loaded.consent),
      },
    ];
  }
  async acceptNativePrompt(description) {
    const prompt = await until(() => readNativePermissionPrompt(this.driver), description);
    await chooseNativePermission(this.driver, true);
    await this.driver.context("content");
    return prompt.text;
  }
  async waitForDataCollection(categories, description) {
    await until(
      () =>
        this.driver.script(
          "const done=arguments[arguments.length-1];browser.permissions.contains({data_collection:arguments[0]}).then(done);",
          [categories],
          true,
        ),
      description,
    );
  }
  async closeInstallWelcome() {
    const welcome = await until(async () => {
      const handles = await this.driver.command("WebDriver:GetWindowHandles");
      return (handles.value || handles).find((handle) => handle !== this.control) || false;
    }, "install welcome tab");
    await this.activate(welcome);
    await this.driver.command("WebDriver:CloseWindow");
  }
  async activate(handle) {
    await this.driver.context("content");
    await this.driver.command("WebDriver:SwitchToWindow", { handle, focus: true });
  }
  async navigate(url) {
    await this.driver.context("content");
    await this.driver.command("WebDriver:Navigate", { url });
  }
  async evaluate(fn, value) {
    await this.activate(this.control);
    const result = await this.driver.script(
      "const done=arguments[arguments.length-1];Promise.resolve((" +
        fn.toString() +
        ")(arguments[0])).then(done,error=>done({__error:String(error)}));",
      [value ?? null],
      true,
    );
    assert(!result?.__error, result?.__error);
    return result;
  }
  async openPopup() {
    await this.activate(this.control);
    await this.navigate(this.base + "/popup.html");
  }
  async showInbox() {
    await this.activate(this.control);
    if (
      (await this.driver.script(
        'return document.getElementById("ryd-discussion-inbox-toggle").getAttribute("aria-expanded");',
      )) !== "true"
    )
      await this.driver.click("#ryd-discussion-inbox-toggle");
  }
  async rendered(id) {
    return this.evaluate((value) => document.querySelectorAll('[data-notification-id="' + value + '"]').length, id);
  }
  async activity(videoId = VIDEO_B) {
    if (!this.video) {
      const before = await this.driver.command("WebDriver:GetWindowHandles");
      await this.driver.command("WebDriver:NewWindow", { type: "tab" });
      this.video = await until(async () => {
        const response = await this.driver.command("WebDriver:GetWindowHandles");
        return (response.value || response).find((handle) => !(before.value || before).includes(handle));
      }, "owned native video tab");
      await this.activate(this.video);
      await this.navigate("https://www.youtube.com/watch?v=" + VIDEO_A);
    }
    await this.activate(this.video);
    await this.driver.script(
      '(window.__navigationFixture||window.wrappedJSObject?.__navigationFixture).navigate("watch",arguments[0]);',
      [videoId],
    );
    await this.driver.script("return (" + configureDisabledComments.toString() + ")();");
    await until(
      () => this.driver.script('return !!document.getElementById("ryd-discussion-panel");'),
      "native discussion after page activity",
    );
  }
  async capture(name) {
    await this.activate(this.control);
    await this.driver.script(
      "const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>done(true),150)));",
      [],
      true,
    );
    const image = await this.driver.command("WebDriver:TakeScreenshot", { full: true });
    await fs.writeFile(path.join(this.evidence, name + ".png"), Buffer.from(image.value, "base64"));
  }
  async revokeAccount() {
    await this.evaluate(async () => {
      await browser.permissions.remove({ data_collection: ["authenticationInfo"] });
    });
  }
  async close() {
    if (this.driver) {
      await this.driver.context("chrome").catch(() => {});
      this.result.diagnostics.push(
        ...(await this.driver
          .script("Services.console.unregisterListener(window.__recoveryListener);return window.__recoveryDiagnostics;")
          .catch(() => [])),
      );
      await this.driver.command("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
      this.driver.socket.destroy();
    }
    if (this.child?.exitCode === null) this.child.kill();
    if (this.log) await this.log.close();
  }
}
async function runRuntime(runtime, rootEvidence) {
  const evidence = path.join(rootEvidence, runtime);
  await fs.mkdir(evidence, { recursive: true });
  const fixture = await startFixtures(evidence, { notifications: snapshot(1) });
  const result = {
    runtime,
    startedAt: new Date().toISOString(),
    scenarios: [],
    requests: fixture.records,
    blockedExternal: fixture.blocked,
    unexpectedApi: fixture.unknown,
    hubLifecycle: fixture.hubLifecycle,
    diagnostics: [],
  };
  const adapter =
    runtime === "chrome" ? new ChromeAdapter(fixture, evidence, result) : new FirefoxAdapter(fixture, evidence, result);
  const checkpoint = async (label) => {
    result.checkpoint = label;
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.log(runtime + ": " + label);
  };
  try {
    for (const browser of ["chrome", "firefox", "safari"]) {
      const manifest = JSON.parse(
        await fs.readFile(path.join(ROOT, "Extensions/combined/dist", browser, "manifest.json"), "utf8"),
      );
      assert(!manifest.permissions.includes("alarms"), browser + " generated manifest still requests alarms");
    }
    await adapter.start();
    await adapter.evaluate(async (seed) => {
      const api = typeof browser !== "undefined" ? browser : chrome;
      await api.storage.sync.set(seed);
    }, accountSeed);
    const session = await adapter.evaluate(() => {
      const api = typeof browser !== "undefined" ? browser : chrome;
      return api.runtime.sendMessage({ message: "ryd_discussion", operation: "session", payload: {} });
    });
    assert.equal(session.ok, true, JSON.stringify(session));
    assert.equal(session.data.authenticated, true);
    await until(
      () =>
        fixture.hubConnections === 1 &&
        fixture.records.some((record) => record.path === "/api/discussion/notifications"),
      "initial signed-in hub and inbox",
    );
    await adapter.openPopup();
    await adapter.showInbox();
    await until(() => adapter.rendered(notificationIds[0]), "initial notification rendered");
    await adapter.capture("initial-inbox");
    result.scenarios.push("signed-in generated runtime connects hub and renders initial inbox");
    await checkpoint("initial inbox");

    fixture.setHubAvailable(false);
    fixture.dropHubConnections();
    await until(() => fixture.hubConnections === 0, "terminal hub closure");
    const idleStart = fixture.records.length;
    await delay(600);
    assert(
      !fixture.records
        .slice(idleStart)
        .some((record) => record.path.endsWith("/notifications/ticket") || record.method === "WEBSOCKET"),
      "Disconnected runtime retried without activity or timer contract",
    );
    fixture.setNotifications(snapshot(2));
    fixture.setHubAvailable(true);
    const activityStart = fixture.records.length;
    await adapter.activity(VIDEO_B);
    await until(
      () =>
        fixture.hubConnections === 1 &&
        fixture.records
          .slice(activityStart)
          .some((record) => record.path === "/api/discussion/notifications" && record.query.afterRevision === "1"),
      "page activity reconnect and delta catchup",
    );
    await until(() => adapter.rendered(notificationIds[1]), "missed notification broadcast into open popup");
    await adapter.capture("page-activity-catchup");
    result.scenarios.push(
      "ordinary video activation/SPA reconnects a terminally closed hub and renders missed notification via afterRevision=1 catchup",
    );
    await checkpoint("page activity catchup");

    fixture.setHubAvailable(false);
    fixture.dropHubConnections();
    await until(() => fixture.hubConnections === 0, "second terminal hub closure");
    fixture.setNotifications(snapshot(3));
    const popupStart = fixture.records.length;
    await adapter.openPopup();
    await adapter.showInbox();
    await until(
      () => fixture.records.slice(popupStart).some((record) => record.method === "WEBSOCKET" && record.status === 503),
      "popup reconnect attempt while fixture hub unavailable",
    );
    fixture.setHubAvailable(true);
    await until(() => fixture.hubConnections === 1, "bounded transient reconnect", 17000);
    await until(() => adapter.rendered(notificationIds[2]), "popup missed notification rendered");
    await adapter.capture("popup-retry-catchup");
    result.scenarios.push(
      "popup activity starts recovery; generated bounded retry reconnects after temporary hub failure and renders missed notification",
    );
    await checkpoint("popup recovery");

    if (runtime === "chrome") {
      await adapter.activity(VIDEO_A);
      const stopStart = fixture.records.length;
      await adapter.stopWorker();
      fixture.setNotifications(snapshot(4));
      await adapter.openPopup();
      await adapter.reattachWorker();
      await adapter.showInbox();
      await until(() => fixture.hubConnections === 1, "hub recovered after real MV3 termination");
      await until(() => adapter.rendered(notificationIds[3]), "missed notification after real MV3 termination");
      await adapter.capture("worker-restart-catchup");
      assert(
        fixture.records.slice(stopStart).some((record) => record.path === "/api/discussion/me"),
        "Recreated worker did not restore account session",
      );
      result.scenarios.push(
        "real Chrome MV3 worker stop followed by popup opening restores stored session, hub and missed inbox; reloaded worker hashes match",
      );
      await checkpoint("real worker recovery");
    }
    await adapter.revokeAccount();
    await until(() => fixture.hubConnections === 0, "account revocation closes hub");
    await delay(250);
    const revokedStart = fixture.records.length;
    await adapter.activity(VIDEO_B);
    await adapter.openPopup();
    await delay(1400);
    const revokedTraffic = fixture.records.slice(revokedStart);
    assert(
      !revokedTraffic.some(
        (record) =>
          record.hasAuthorization ||
          record.method === "WEBSOCKET" ||
          record.path.startsWith("/api/auth/") ||
          record.path.startsWith("/api/discussion/notifications") ||
          record.path === "/api/discussion/me",
      ),
      "Account traffic escaped revocation/logout gate: " + JSON.stringify(revokedTraffic),
    );
    result.revokedTraffic = revokedTraffic;
    result.scenarios.push(
      runtime === "firefox"
        ? "native authentication consent removal blocks all account/recovery traffic while normal page activity continues"
        : "logout blocks account/recovery traffic after page/popup activity",
    );
    assertNoLinkedIdentity(fixture.records);
    assert.equal(fixture.unknown.length, 0, JSON.stringify(fixture.unknown));
    assert(
      !fixture.blocked.some((record) => record.host.includes("returnyoutubedislikeapi.com")),
      "Production API request escaped local substitution",
    );
    for (const [file, expected] of Object.entries(result.sourceHashes))
      assert.equal(
        sha256(await fs.readFile(path.join(ROOT, "Extensions/combined/dist", runtime, file))),
        expected,
        "Production artifact changed during recovery test: " + file,
      );
    result.popupLocale = await adapter.evaluate(() => document.documentElement.lang);
    assert(!result.popupLocale.includes("_"), "Popup language must be valid for Intl formatting");
    assert(
      !result.diagnostics.some(({ message }) => message.includes("Invalid language tag")),
      "Popup number-format initialization failed",
    );
    result.functionalStatus = "passed";
    result.status = "passed";
    await checkpoint("functional assertions passed");
  } catch (error) {
    result.status = "failed";
    result.error = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    await adapter.close().catch((error) => {
      result.cleanupError = String(error);
      process.exitCode = 1;
    });
    await fixture.close();
    result.finishedAt = new Date().toISOString();
    if (result.status === "passed" && result.diagnostics.length) result.status = "passed-with-diagnostics";
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.log(runtime + ": " + result.status + "; evidence " + evidence);
    if (result.error) console.error(result.error);
  }
  return result;
}
async function run() {
  assert(process.env.RYD_RECOVERY_EVIDENCE, "Set RYD_RECOVERY_EVIDENCE to an authorized private evidence directory.");
  const evidence = path.resolve(process.env.RYD_RECOVERY_EVIDENCE);
  const results = [];
  for (const runtime of process.env.RYD_RECOVERY_RUNTIMES?.split(",") || ["chrome", "firefox"]) {
    assert(["chrome", "firefox"].includes(runtime));
    results.push(await runRuntime(runtime, evidence));
  }
  return results;
}
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run, runRuntime };
