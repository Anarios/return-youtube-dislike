const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function waitFor(operation, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = await operation();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function packageDirectory(driver, directory, output) {
  return driver.script(
    `
    const folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    folder.initWithPath(arguments[0]);
    const output = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    output.initWithPath(arguments[1]);
    const writer = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
    writer.open(output, 0x04 | 0x08 | 0x20);
    function append(directory, prefix) {
      for (const item of directory.directoryEntries) {
        const file = item.QueryInterface(Ci.nsIFile);
        const name = prefix + file.leafName;
        if (file.isDirectory()) append(file, name + "/");
        else writer.addEntryFile(name, Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
      }
    }
    append(folder, "");
    writer.close();
    return true;
  `,
    [directory, output],
  );
}

async function beginInstall(driver, xpi, update = false) {
  await driver.script(
    `
    const done = arguments[arguments.length - 1];
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(arguments[0]);
    const update = arguments[1];
    AddonManager.getInstallForFile(file).then(install => {
      window.__rydPendingInstall = install;
      window.__rydInstallError = null;
      install.addListener({ onInstallFailed: () => {window.__rydInstallError = install.error; }});
      AddonManager.installAddonFromAOMWithOptions(gBrowser.selectedBrowser, Services.io.newFileURI(file), install, {preferUpdateOverInstall:update});
      done({state:install.state,error:install.error});
    }, error => done({error:String(error)}));
  `,
    [xpi, update],
    true,
  );
  if (update) {
    await waitFor(
      () =>
        driver.script(`
      const {ExtensionsUI} = ChromeUtils.importESModule("resource:///modules/ExtensionsUI.sys.mjs");
      const update = [...ExtensionsUI.updates][0];
      if (!update) return false;
      ExtensionsUI.showUpdate(gBrowser, update);
      return true;
    `),
      "native pending update notification",
    );
  }
  return waitFor(
    () =>
      driver.script(`
    const notification = document.getElementById("addon-webext-permissions-notification");
    if (document.getElementById("notification-popup")?.state !== "open" || !notification) return false;
    return {
      heading: notification.getAttribute("endlabel"),
      requiredData: document.getElementById("addon-webext-perm-list-data-collection")?.textContent,
      optionalData: document.getElementById("addon-webext-perm-list-optional")?.textContent,
      allow: notification.getAttribute("buttonlabel"),
      deny: notification.getAttribute("secondarybuttonlabel")
    };
  `),
    "native packaged permission prompt",
  );
}

async function choose(driver, allow) {
  await driver.script(`document.querySelector(arguments[0]).click();`, [
    `#addon-webext-permissions-notification .popup-notification-${allow ? "primary" : "secondary"}-button`,
  ]);
}

async function installedAddon(driver, id) {
  return driver.script(
    `
    const done = arguments[arguments.length - 1];
    const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    AddonManager.getAddonByID(arguments[0]).then(addon => done(addon ? {id:addon.id,version:addon.version,active:addon.isActive} : null));
  `,
    [id],
    true,
  );
}

async function dismissFinishedNotice(driver) {
  await driver.script(`
    for (const notification of [...PopupNotifications._currentNotifications]) {
      if (notification.id !== "addon-webext-permissions") PopupNotifications.remove(notification);
    }
  `);
}

async function validatePackagedConsent({ driver, derived, evidence, manifest, result, requests }) {
  const id = manifest.browser_specific_settings.gecko.id;
  const xpi = path.join(evidence, "current.xpi");
  await packageDirectory(driver, derived, xpi);
  result.packagedInstall = { unsignedDeveloperProfile: true, requiredPrompt: await beginInstall(driver, xpi) };
  assert.match(result.packagedInstall.requiredPrompt.requiredData, /browsing activity/);
  assert.match(result.packagedInstall.requiredPrompt.requiredData, /website activity/);
  assert.match(result.packagedInstall.requiredPrompt.requiredData, /website content/);
  assert.match(result.packagedInstall.requiredPrompt.requiredData, /personally identifying information/);
  await choose(driver, false);
  await waitFor(
    () =>
      driver.script(
        `return window.__rydPendingInstall.state === ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.STATE_CANCELLED;`,
      ),
    "cancelled fresh install",
  );
  assert.equal(await installedAddon(driver, id), null);
  assert.equal(requests.length, 0);
  result.scenarios.push("native required-consent denial prevents packaged extension installation and startup");
  console.log("REQUIRED INSTALL DENIAL PASSED");
  await beginInstall(driver, xpi);
  await choose(driver, true);
  await waitFor(async () => (await installedAddon(driver, id))?.active, "fresh packaged installation");
  result.scenarios.push("native required-consent acceptance installs and starts packaged extension");
  await dismissFinishedNotice(driver);

  await driver.script(
    `
    const done = arguments[arguments.length-1];
    const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    AddonManager.getAddonByID(arguments[0]).then(addon=>addon.uninstall()).then(()=>done(true));
  `,
    [id],
    true,
  );
  const baseline = path.join(evidence, "baseline");
  await fs.cp(derived, baseline, { recursive: true });
  const priorManifest = JSON.parse(JSON.stringify(manifest));
  priorManifest.version = "4.0.4";
  delete priorManifest.browser_specific_settings.gecko.data_collection_permissions;
  await fs.writeFile(path.join(baseline, "manifest.json"), JSON.stringify(priorManifest));
  const baselineXpi = path.join(evidence, "baseline.xpi");
  await packageDirectory(driver, baseline, baselineXpi);
  await beginInstall(driver, baselineXpi);
  await choose(driver, true);
  await waitFor(async () => (await installedAddon(driver, id))?.version === "4.0.4", "baseline packaged installation");
  await dismissFinishedNotice(driver);
  result.packagedInstall.updateBaseline =
    "Synthetic 4.0.4 package retaining current code and the prior release's absence of data_collection_permissions; fixed extension ID for unsigned update testing.";
  result.packagedInstall.updatePrompt = await beginInstall(driver, xpi, true);
  assert.match(result.packagedInstall.updatePrompt.requiredData, /browsing activity/);
  await choose(driver, false);
  await waitFor(
    () =>
      driver.script(
        `return window.__rydPendingInstall.state === ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs").AddonManager.STATE_CANCELLED;`,
      ),
    "cancelled update",
  );
  assert.equal((await installedAddon(driver, id)).version, "4.0.4");
  result.scenarios.push("native required-consent update denial preserves the installed previous version");
  console.log("REQUIRED UPDATE DENIAL PASSED");
  await beginInstall(driver, xpi, true);
  await choose(driver, true);
  await waitFor(
    async () => (await installedAddon(driver, id))?.version === manifest.version,
    "accepted packaged update",
  );
  await dismissFinishedNotice(driver);
  result.scenarios.push(`native required-consent update acceptance activates ${manifest.version}`);
  console.log("REQUIRED UPDATE ACCEPTANCE PASSED");
  result.validationDepth =
    "packaged Firefox Developer artifact with loopback API substitution, native required install/update and optional consent";
  result.limitations = result.limitations.filter((value) => !value.startsWith("Temporary installation"));
  return installedAddon(driver, id);
}

module.exports = { validatePackagedConsent };
