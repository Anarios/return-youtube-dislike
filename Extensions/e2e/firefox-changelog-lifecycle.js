const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const EVENT_KEY = "__rydTestInstalledEvents";
const RUNTIME_KEY = "__rydTestLifecycleRuntime";
const CHANGELOG_PATH = "/changelog/4/changelog_4.0.html";
const STORAGE_KEYS = ["lastShownChangelogVersion", "pendingChangelogVersion", EVENT_KEY, RUNTIME_KEY];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function instrumentChangelogLifecycle({ derived, manifest, result }) {
  const buildId = crypto.randomUUID();
  const filename = "ryd.lifecycle-probe.js";
  const probe = `(() => {
    const buildId = ${JSON.stringify(buildId)};
    const backgroundStartId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    browser.storage.local.set({ [${JSON.stringify(RUNTIME_KEY)}]: {
      buildId, backgroundStartId, startedAt, version: browser.runtime.getManifest().version,
      runtimeUrl: browser.runtime.getURL("")
    }});
    browser.runtime.onInstalled.addListener(details => {
      browser.storage.local.get([${JSON.stringify(EVENT_KEY)}, "lastShownChangelogVersion"]).then(stored => {
        const events = stored[${JSON.stringify(EVENT_KEY)}] || [];
        events.push({
          buildId, backgroundStartId, recordedAt: new Date().toISOString(),
          reason: details.reason, temporary: details.temporary ?? null,
          previousVersion: details.previousVersion ?? null,
          shownAtInstall: stored.lastShownChangelogVersion ?? null,
          version: browser.runtime.getManifest().version
        });
        return browser.storage.local.set({ [${JSON.stringify(EVENT_KEY)}]: events });
      });
    });
  })();
`;
  await fs.writeFile(path.join(derived, filename), probe);
  manifest.background.scripts.unshift(filename);
  result.changelogLifecycle = {
    buildId,
    instrumentation: {
      filename,
      sha256: crypto.createHash("sha256").update(probe).digest("hex"),
      eventKey: EVENT_KEY,
      runtimeKey: RUNTIME_KEY,
      description:
        "Test-only first background script records real onInstalled reason, temporary flag, previous version, and a background-start ID in owned local storage. Product handlers are unchanged.",
    },
    observations: [],
  };
}

async function observeChangelogLifecycle({ driver, derived, manifest, result, until }) {
  const lifecycle = result.changelogLifecycle;
  const addonId = manifest.browser_specific_settings.gecko.id;
  const expectImmediate = process.env.RYD_FIREFOX_CHANGELOG_EXPECT_IMMEDIATE === "1";
  lifecycle.expectImmediateTemporaryReload = expectImmediate;

  async function openPopup() {
    await driver.context("chrome");
    const uuid = await until(
      () => driver.script(`return WebExtensionPolicy.getByID(arguments[0])?.mozExtensionHostname || false;`, [addonId]),
      "temporary extension policy after lifecycle change",
    );
    await driver.context("content");
    const previousHandlesResponse = await driver.command("WebDriver:GetWindowHandles");
    const previousHandles = previousHandlesResponse.value || previousHandlesResponse;
    await driver.context("chrome");
    await driver.script(`
      gBrowser.selectedTab = gBrowser.addTab("about:blank", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
      });
    `);
    await driver.context("content");
    const handlesResponse = await driver.command("WebDriver:GetWindowHandles");
    const handles = handlesResponse.value || handlesResponse;
    const handle = handles.find((candidate) => !previousHandles.includes(candidate));
    assert(handle, "Lifecycle probe must own a fresh browser tab");
    await driver.command("WebDriver:SwitchToWindow", { handle });
    await driver.command("WebDriver:Navigate", { url: `moz-extension://${uuid}/popup.html` });
    await until(
      () => driver.script(`return typeof browser !== "undefined" && Boolean(browser.storage?.local);`),
      "extension storage API in owned lifecycle popup",
    );
  }

  async function storage() {
    return driver.script(
      `const done = arguments[arguments.length - 1]; browser.storage.local.get(arguments[0]).then(done);`,
      [STORAGE_KEYS],
      true,
    );
  }

  async function snapshot(label, previousStartId) {
    await openPopup();
    const state = await until(async () => {
      const value = await storage();
      const runtime = value[RUNTIME_KEY];
      const events = value[EVENT_KEY] || [];
      return runtime?.buildId === lifecycle.buildId &&
        runtime.backgroundStartId !== previousStartId &&
        events.some((event) => event.backgroundStartId === runtime.backgroundStartId)
        ? value
        : false;
    }, `${label} instrumented onInstalled event`);
    assert.equal(state[RUNTIME_KEY].version, manifest.version);
    // Observe asynchronous product storage/tab work over a bounded interval; the
    // baseline records its outcome without assuming that reload opens a tab.
    await delay(500);
    const settledState = await storage();
    await driver.context("chrome");
    const native = await driver.script(
      `
      const done = arguments[arguments.length - 1];
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      AddonManager.getAddonByID(arguments[0]).then(addon => {
        const uuid = WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;
        const changelogUrl = "moz-extension://" + uuid + arguments[1];
        done({
          id: addon.id, version: addon.version, temporarilyInstalled: addon.temporarilyInstalled,
          sourceUri: addon.sourceURI?.spec || null,
          changelogUrl,
          changelogTabCount: Array.from(gBrowser.tabs).filter(tab => tab.linkedBrowser.currentURI.spec === changelogUrl).length
        });
      });
    `,
      [addonId, CHANGELOG_PATH],
      true,
    );
    assert.equal(native.id, addonId);
    assert.equal(native.version, manifest.version);
    assert.equal(native.temporarilyInstalled, true);
    const observation = { label, state: settledState, native };
    lifecycle.observations.push(observation);
    console.log("CHANGELOG LIFECYCLE", JSON.stringify(observation));
    return observation;
  }

  async function clearShownAndCloseChangelog(label, { clearShown = true, seedPending = false } = {}) {
    await openPopup();
    if (clearShown)
      await driver.script(
        `const done = arguments[arguments.length - 1]; browser.storage.local.remove("lastShownChangelogVersion").then(() => browser.storage.local.get(arguments[0])).then(done);`,
        [STORAGE_KEYS],
        true,
      );
    if (seedPending)
      await driver.script(
        `const done = arguments[arguments.length - 1]; browser.storage.local.set({ pendingChangelogVersion: arguments[0] }).then(done);`,
        [manifest.version],
        true,
      );
    const clearedState = await storage();
    if (clearShown) assert.equal(clearedState.lastShownChangelogVersion, undefined);
    else assert.equal(clearedState.lastShownChangelogVersion, manifest.version);
    if (seedPending) assert.equal(clearedState.pendingChangelogVersion, manifest.version);
    await driver.context("chrome");
    const closed = await driver.script(
      `
      const uuid = WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;
      const url = "moz-extension://" + uuid + arguments[1];
      const tabs = Array.from(gBrowser.tabs).filter(tab => tab.linkedBrowser.currentURI.spec === url);
      for (const tab of tabs) gBrowser.removeTab(tab, { animate: false });
      return tabs.length;
    `,
      [addonId, CHANGELOG_PATH],
    );
    lifecycle.observations.push({ label, clearedState, closedChangelogTabs: closed });
    // Keep Marionette's selected document outside the extension before its
    // pages are destroyed by uninstall/reload.
    await driver.context("content");
    await driver.command("WebDriver:Navigate", { url: "about:blank" });
    await driver.context("chrome");
  }

  async function reloadAddon() {
    const reloaded = await driver.script(
      `
      const done = arguments[arguments.length - 1];
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      AddonManager.getAddonByID(arguments[0]).then(addon => addon.reload()).then(() => done(true), error => done({error:String(error)}));
    `,
      [addonId],
      true,
    );
    assert.equal(reloaded, true);
  }

  const fresh = await snapshot("fresh-install");
  await clearShownAndCloseChangelog("before-remove-and-reinstall-with-shown-marker", { clearShown: false });
  await driver.script(
    `
    const done = arguments[arguments.length - 1];
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    AddonManager.getAddonByID(arguments[0]).then(addon => addon.uninstall()).then(() => done(true), error => done({error:String(error)}));
  `,
    [addonId],
    true,
  );
  await until(
    () => driver.script(`return !WebExtensionPolicy.getByID(arguments[0]);`, [addonId]),
    "temporary extension removal",
  );
  const reinstalled = await driver.script(
    `
    const done = arguments[arguments.length - 1];
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(arguments[0]);
    AddonManager.installTemporaryAddon(file).then(addon => done({id:addon.id,version:addon.version}), error => done({error:String(error)}));
  `,
    [derived],
    true,
  );
  assert(!reinstalled.error, reinstalled.error);
  const afterReinstall = await snapshot("remove-and-reinstall", fresh.state[RUNTIME_KEY].backgroundStartId);

  await clearShownAndCloseChangelog("before-reload-unseen");
  await reloadAddon();
  const afterUnseenReload = await snapshot("reload-unseen", afterReinstall.state[RUNTIME_KEY].backgroundStartId);
  if (expectImmediate) {
    const event = afterUnseenReload.state[EVENT_KEY].at(-1);
    assert.equal(event.reason, "update");
    assert.equal(event.temporary, true);
    assert.equal(event.previousVersion, manifest.version);
    assert.equal(afterUnseenReload.native.changelogTabCount, 1);
    assert.equal(afterUnseenReload.state.lastShownChangelogVersion, manifest.version);
    assert.equal(afterUnseenReload.state.pendingChangelogVersion, undefined);
    await clearShownAndCloseChangelog("before-reload-already-seen", { clearShown: false });
    await reloadAddon();
    const afterSeenReload = await snapshot(
      "reload-already-seen",
      afterUnseenReload.state[RUNTIME_KEY].backgroundStartId,
    );
    assert.equal(afterSeenReload.native.changelogTabCount, 0);
    assert.equal(afterSeenReload.state.lastShownChangelogVersion, manifest.version);
    assert.equal(afterSeenReload.state.pendingChangelogVersion, undefined);
    await clearShownAndCloseChangelog("before-reload-pending-only", { seedPending: true });
    await reloadAddon();
    const afterPendingReload = await snapshot(
      "reload-pending-only",
      afterSeenReload.state[RUNTIME_KEY].backgroundStartId,
    );
    assert.equal(afterPendingReload.native.changelogTabCount, 1);
    assert.equal(afterPendingReload.state.lastShownChangelogVersion, manifest.version);
    assert.equal(afterPendingReload.state.pendingChangelogVersion, undefined);
    result.scenarios.push("unseen temporary reload opens exactly one changelog and consumes pending state");
    result.scenarios.push("already-seen temporary reload opens no duplicate changelog");
    result.scenarios.push("temporary reload recovers pending-only changelog state and records successful display");
  }
  result.scenarios.push("observed native temporary-addon changelog lifecycle after removal/reinstall and reload");
}

module.exports = { instrumentChangelogLifecycle, observeChangelogLifecycle };
