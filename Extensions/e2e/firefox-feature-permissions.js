const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
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
  delay,
  until,
  listen,
  startFixtures,
  prepareArtifact,
  configureDisabledComments,
  navigateFixture,
  assertNoIdentity,
  assertNoLinkedIdentity,
} = require("./feature-permissions-fixtures");
const { assertThemedPopoverSurfaces } = require("./popover-surface");
const { addToolbarButton, createToolbarPopup } = require("./firefox-toolbar-popup");
const ENGLISH = require("../combined/_locales/en/messages.json");

const PROMPT = "#ryd-data-consent-prompt";
const VOTE_OPT_IN = ["browsingActivity", "websiteActivity", "websiteContent"];

async function run() {
  const evidence = path.resolve(
    process.env.RYD_FIREFOX_FEATURE_EVIDENCE ||
      path.join(ROOT, ".private/validation", "firefox-features-" + new Date().toISOString().replace(/[:.]/g, "-")),
  );
  await fs.mkdir(evidence, { recursive: true });
  const fixture = await startFixtures(evidence);
  const profile = path.join(evidence, "profile");
  await fs.mkdir(profile, { recursive: true });
  const derived = path.join(evidence, "extension");
  const provenance = await prepareArtifact(
    path.join(ROOT, "Extensions/combined/dist/firefox"),
    derived,
    fixture.apiOrigin,
  );
  const result = {
    startedAt: new Date().toISOString(),
    ...provenance,
    scenarios: [],
    requests: fixture.records,
    blockedExternal: fixture.blocked,
    unexpectedApi: fixture.unknown,
    limitations: [
      "Temporary installation cannot prove native install or signed-update prompts. Native permission panel labels are captured from Firefox browser UI; headless screenshots do not include the separate native panel.",
    ],
  };
  assert.deepEqual(result.manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
  assert.deepEqual(result.manifest.browser_specific_settings.gecko.data_collection_permissions.optional, [
    "browsingActivity",
    "websiteContent",
    "websiteActivity",
    "personallyIdentifyingInfo",
    "authenticationInfo",
  ]);
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
    "network.proxy.http_port": fixture.proxyPort,
    "network.proxy.ssl": "127.0.0.1",
    "network.proxy.ssl_port": fixture.proxyPort,
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
  const log = await fs.open(path.join(evidence, "firefox.log"), "a");
  const child = spawnHeadlessFirefox(profile);
  result.process = { pid: child.pid };
  child.stdout.on("data", (chunk) => void log.write(chunk));
  child.stderr.on("data", (chunk) => void log.write(chunk));
  child.on("error", (error) => {
    result.process.error = String(error);
  });
  child.on("exit", (code, signal) => {
    result.process.exitCode = code;
    result.process.signal = signal;
  });
  let driver;
  try {
    driver = await connectMarionette(port, "Marionette startup");
    result.session = await driver.command("WebDriver:NewSession", {
      acceptInsecureCerts: true,
      unhandledPromptBehavior: "dismiss and notify",
    });
    await driver.context("content");
    await driver.command("WebDriver:Navigate", { url: "https://www.youtube.com/watch?v=" + VIDEO_A });
    result.inertNegativeControl = await driver.script(
      'return {barCount:document.querySelectorAll("#ryd-bar-container").length,count:document.querySelector("dislike-button-view-model #text")?.textContent||""};',
    );
    assert.equal(result.inertNegativeControl.barCount, 0, "Fixture rendered RYD without the runtime");
    await driver.context("chrome");
    await driver.script(
      `window.__rydConsole=[];window.__rydConsoleListener={observe(message){window.__rydConsole.push({at:Date.now(),message:message.message||String(message)});}};Services.console.registerListener(window.__rydConsoleListener);`,
    );
    await driver.script(
      `const {ExtensionsUI}=ChromeUtils.importESModule("resource:///modules/ExtensionsUI.sys.mjs");
      window.__rydNativePrompts=[];window.__rydPermissionNotifications=[];
      const originalPrompt=ExtensionsUI.showPermissionsPrompt;
      ExtensionsUI.showPermissionsPrompt=function(...args){window.__rydNativePrompts.push({at:Date.now(),header:args[1]?.header,dataCollection:args[1]?.dataCollectionPermissions});return originalPrompt.apply(this,args);};
      const originalNotification=PopupNotifications.show;
      PopupNotifications.show=function(...args){if(args[1]==="addon-webext-permissions")window.__rydPermissionNotifications.push({at:Date.now(),id:args[1]});return originalNotification.apply(this,args);};`,
    );
    result.installed = await driver.script(
      'const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);AddonManager.installTemporaryAddon(file).then(addon=>done({id:addon.id,version:addon.version}),error=>done({error:String(error)}));',
      [derived],
      true,
    );
    assert(!result.installed.error, JSON.stringify(result.installed));
    assert.equal(result.installed.version, result.manifest.version);
    const uuid = await driver.script("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;", [
      result.installed.id,
    ]);
    const base = "moz-extension://" + uuid;
    await driver.context("content");
    const handlesResponse = await driver.command("WebDriver:GetWindowHandles");
    const handles = handlesResponse.value || handlesResponse;
    const homeHandle = handles[0];
    await driver.command("WebDriver:SwitchToWindow", { handle: homeHandle, focus: true });
    const content = async (script, args = [], async = false) => {
      await driver.context("content");
      return driver.script(script, args, async);
    };
    const chrome = async (script, args = [], async = false) => {
      await driver.context("chrome");
      return driver.script(script, args, async);
    };
    const focusCurrent = async () => {
      await driver.context("content");
      const response = await driver.command("WebDriver:GetWindowHandle");
      await driver.command("WebDriver:SwitchToWindow", { handle: response.value || response, focus: true });
    };
    const go = async (url) => {
      (result.lifecycleCheckpoints ||= []).push({ at: Date.now(), event: "navigate", url });
      await focusCurrent();
      if (url === base + "/popup.html" && (await driver.script("return location.href.split('?')[0];")) === url) return;
      await driver.command("WebDriver:Navigate", { url });
    };
    const evaluate = async (fn, args = []) => content("return (" + fn.toString() + ")(...arguments);", args);
    const perms = () =>
      content("const done=arguments[arguments.length-1];browser.permissions.getAll().then(done);", [], true);
    const remove = async (categories) =>
      content(
        "const done=arguments[arguments.length-1];browser.permissions.remove({data_collection:arguments[0]}).then(done);",
        [categories],
        true,
      );
    const switchTab = async (handle) => {
      await driver.context("content");
      await driver.command("WebDriver:SwitchToWindow", { handle, focus: true });
    };
    const shot = async (name) => {
      await focusCurrent();
      await driver.script(
        "const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>done(true),150)));",
        [],
        true,
      );
      const image = await driver.command("WebDriver:TakeScreenshot", { full: true });
      await fs.writeFile(path.join(evidence, name + ".png"), Buffer.from(image.value, "base64"));
    };
    const choose = async (allow) => {
      await chooseNativePermission(driver, allow);
      await driver.context("content");
    };
    const prompt = async () => until(() => readNativePermissionPrompt(driver), "native optional permission prompt");
    const click = async (selector) => {
      await focusCurrent();
      await selectCurrentTab(driver);
      await driver.click(selector);
    };
    const dataGrants = () =>
      chrome(
        'const done=arguments[arguments.length-1];const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");ExtensionPermissions.get(arguments[0]).then(value=>done(value.data_collection||[]));',
        [result.installed.id],
        true,
      );
    const nativePromptCounts = () =>
      chrome(
        "return {calls:window.__rydNativePrompts.length,notifications:window.__rydPermissionNotifications.length};",
      );
    const toolbar = createToolbarPopup(chrome, base);
    const toolbarPopup = toolbar.find;
    const toolbarScript = async (script, args = [], async = false) => {
      const response = await toolbar.run(script, args, async);
      assert(!response.error, JSON.stringify(response));
      return response.value;
    };
    const toolbarClick = async (selector) => {
      const response = await toolbar.click(selector);
      (result.toolbarClicks ||= []).push({ selector, ...response });
      if (response.error) assert(await prompt(), JSON.stringify(response));
    };
    const toolbarClosedForPrompt = () =>
      until(async () => !(await toolbarPopup()), "toolbar popup closed so it cannot cover the native prompt");
    const setVoteSubmissionDisabled = async (disabled) => {
      await go(base + "/popup.html");
      await until(
        () =>
          content('return document.getElementById("disable_vote_submission")?.checked===arguments[0];', [!disabled]),
        "vote submission switch before change",
      );
      await content('document.getElementById("disable_vote_submission").click();');
      await until(
        () =>
          content(
            'const done=arguments[arguments.length-1];browser.storage.sync.get("disableVoteSubmission").then(value=>done(value.disableVoteSubmission===arguments[0]));',
            [disabled],
            true,
          ),
        "vote submission switch saved",
      );
    };
    result.toolbarWidgetId = await addToolbarButton(chrome, result.installed.id);
    const promptVisible = () =>
      content(
        'const host=document.querySelector(arguments[0]);return !!host&&!host.hidden&&host.shadowRoot.querySelector("button.primary")?.getBoundingClientRect().height>0;',
        [PROMPT],
      );
    const promptPresent = () => content("return !!document.querySelector(arguments[0]);", [PROMPT]);
    const singleConsentHost = async (label) => {
      const hosts = await content(
        'return {prompts:document.querySelectorAll(arguments[0]).length,legacy:document.querySelectorAll("#ryd-counts-consent-hint,#ryd-vote-consent-hint").length};',
        [PROMPT],
      );
      assert(hosts.prompts <= 1 && hosts.legacy === 0, label + ": RYD consent hosts coexist " + JSON.stringify(hosts));
      (result.singleConsentHostChecks ||= []).push({ label, ...hosts });
      return hosts;
    };
    const assertCombinedPrompt = (nativePrompt) => {
      assert.match(nativePrompt.text, /browsing activity/i);
      assert.match(nativePrompt.text, /website activity/i);
      assert.match(nativePrompt.text, /website content/i);
      assert.doesNotMatch(nativePrompt.text, /personally identifying|authentication|communications/i);
    };
    const assertMissingVotePrompt = (nativePrompt) => {
      assert.match(nativePrompt.text, /website activity/i);
      assert.match(nativePrompt.text, /website content/i);
      assert.doesNotMatch(nativePrompt.text, /browsing activity|personally identifying|authentication|communications/i);
    };
    const storedVoteSwitch = () =>
      content(
        'const done=arguments[arguments.length-1];browser.storage.sync.get("disableVoteSubmission").then(value=>done(value.disableVoteSubmission));',
        [],
        true,
      );
    const openToolbarButton = async (label) => {
      await driver.context("chrome");
      await driver.click('[id="' + result.toolbarWidgetId + '"] .unified-extensions-item-action-button');
      return until(toolbarPopup, label);
    };
    const openToolbarFromPrompt = async (sectionId) => {
      const promptsBefore = await nativePromptCounts();
      await focusCurrent();
      const button = await driver.script(
        'return document.querySelector(arguments[0])?.shadowRoot.querySelector("button.primary");',
        [PROMPT],
      );
      assert(button, "In-page Allow button is missing");
      await driver.command("WebDriver:ElementClick", { id: button["element-6066-11e4-a52e-4f735466cecf"] });
      const outcome = await until(async () => {
        const popup = await toolbarPopup();
        if (popup) return { popup };
        const guidance = await content(
          'return document.querySelector(arguments[0])?.shadowRoot.querySelector(".status")?.textContent;',
          [PROMPT],
        );
        return guidance ? { guidance } : false;
      }, "toolbar popup or older-browser toolbar instruction");
      if (outcome.popup) {
        outcome.inPageCardGone = await until(
          async () => !(await promptPresent()),
          "in-page card gone while the toolbar popup is open",
        );
      } else {
        outcome.popup = await openToolbarButton("toolbar popup opened directly by its native button");
      }
      assert.equal(outcome.popup.type, "popup");
      await until(
        () => toolbarScript("return !document.getElementById(arguments[0]).hidden;", [sectionId]),
        sectionId + " in the actual toolbar popup",
      );
      assert.deepEqual(
        await nativePromptCounts(),
        promptsBefore,
        "Opening the toolbar popup requested consent automatically",
      );
      return outcome;
    };
    await go(base + "/popup.html");
    result.initialPermissions = await perms();
    assert.deepEqual(result.initialPermissions.data_collection, [], "Fresh install pregranted optional categories");
    result.loadedContentScriptSha256 = await content(
      'const done=arguments[arguments.length-1];fetch(browser.runtime.getURL("ryd.content-script.js")).then(r=>r.text()).then(done);',
      [],
      true,
    ).then((value) => crypto.createHash("sha256").update(value).digest("hex"));
    assert.equal(
      result.loadedContentScriptSha256,
      crypto
        .createHash("sha256")
        .update(await fs.readFile(path.join(derived, "ryd.content-script.js")))
        .digest("hex"),
    );
    result.loadedConsentSha256 = await content(
      'const done=arguments[arguments.length-1];fetch(browser.runtime.getURL("consent.js")).then(r=>r.text()).then(done);',
      [],
      true,
    ).then((value) => crypto.createHash("sha256").update(value).digest("hex"));
    assert.equal(result.loadedConsentSha256, result.sourceHashes["consent.js"]);
    const noCountsStart = fixture.records.length;
    const noCountsPromptStart = await nativePromptCounts();
    result.noCountsViews = [];
    await go("https://www.youtube.com/");
    for (const stage of [
      { kind: "channel", videoId: "search", label: "search" },
      { kind: "watch", videoId: VIDEO_A, label: "watch" },
      { kind: "shorts", videoId: VIDEO_A, label: "shorts" },
    ]) {
      await evaluate(navigateFixture, [stage.kind, stage.videoId]);
      if (stage.kind !== "channel") await until(promptVisible, "visible page-load card on " + stage.label);
      await delay(700);
      const view = await content(
        'return {barCount:document.querySelectorAll("#ryd-bar-container").length,renderedCount:[...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25"),hint:!!document.querySelector(arguments[0]),discussion:!!document.getElementById("ryd-discussion-panel")};',
        [PROMPT],
      );
      assert.equal(view.barCount, 0);
      assert.equal(view.renderedCount, false);
      assert.equal(view.discussion, false);
      assert.equal(view.hint, stage.kind !== "channel");
      assert.equal(fixture.records.length, noCountsStart, "Traffic started before counts consent on " + stage.label);
      assert.deepEqual(await nativePromptCounts(), noCountsPromptStart, "Passive navigation requested native consent");
      await singleConsentHost("page-load " + stage.label);
      if (stage.kind !== "channel")
        view.surfaces = await assertThemedPopoverSurfaces(evaluate, PROMPT, "page-load card on " + stage.label);
      result.noCountsViews.push({ ...stage, ...view, noTraffic: true, noAutomaticPrompt: true });
      await shot("counts-ungranted-" + stage.label);
    }
    await evaluate(navigateFixture, ["watch", VIDEO_A]);
    await until(promptVisible, "watch page-load card before explicit opt-in");
    const countsDocument = await content(
      "window.__rydCountsDocument=crypto.randomUUID();return window.__rydCountsDocument;",
    );
    result.countsToolbarDenied = await openToolbarFromPrompt("ryd-counts-consent");
    await toolbarClick("#ryd-counts-consent-allow");
    result.countsDenyPrompt = await prompt();
    await toolbarClosedForPrompt();
    assertCombinedPrompt(result.countsDenyPrompt);
    await choose(false);
    await switchTab(homeHandle);
    await delay(700);
    assert.deepEqual(await dataGrants(), []);
    assert.equal(fixture.records.length, noCountsStart, "Declining consent sent a request");
    assert.equal(await content("return window.__rydCountsDocument;"), countsDocument);
    result.cardStaysAwayOnHandedOffPage = !(await promptPresent());
    assert(result.cardStaysAwayOnHandedOffPage, "The page-load card returned on the page that opened the popup");
    await evaluate(navigateFixture, ["watch", VIDEO_B]);
    await until(promptVisible, "page-load card on the next video after a declined prompt");
    await singleConsentHost("page-load card after a declined prompt");
    result.countsToolbarGranted = await openToolbarFromPrompt("ryd-counts-consent");
    await toolbarClick("#ryd-counts-consent-allow");
    result.countsGrantPrompt = await prompt();
    await toolbarClosedForPrompt();
    assertCombinedPrompt(result.countsGrantPrompt);
    await choose(true);
    await switchTab(homeHandle);
    await until(
      () =>
        content(
          'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25");',
        ),
      "same-document counts after toolbar grant and popup unload",
    );
    assert.deepEqual([...(await dataGrants())].sort(), VOTE_OPT_IN);
    assert.equal(
      await content("return window.__rydCountsDocument;"),
      countsDocument,
      "Grant reloaded the YouTube document",
    );
    assert.equal(await promptPresent(), false, "The page-load card stayed after counts were allowed");
    await delay(700);
    assertNoIdentity(fixture.records);
    await shot("counts-granted-without-reload");
    result.scenarios.push(
      "counts remain quiet without browsing activity; watch and Shorts show one themed page-load card; its Allow hides the card and opens the real toolbar popup on the combined card, which closes for the native prompt; Deny and Allow both list browsing activity, website activity and website content; the grant recovers counts without reloading and creates no voter identity",
    );
    await go(base + "/popup.html");
    await remove(["websiteActivity", "websiteContent"]);
    await until(async () => (await dataGrants()).join() === "browsingActivity", "counts-only grant for passive views");
    const passiveStart = fixture.records.length;
    await go("https://www.youtube.com/");
    await delay(700);
    assertNoIdentity(fixture.records);
    for (const stage of [
      { kind: "channel", videoId: "search", label: "search" },
      { kind: "watch", videoId: VIDEO_A, label: "watch" },
      { kind: "watch", videoId: VIDEO_B, label: "comments-disabled watch", disabled: true },
      { kind: "shorts", videoId: VIDEO_A, label: "Short" },
    ]) {
      await evaluate(navigateFixture, [stage.kind, stage.videoId]);
      if (stage.disabled) await evaluate(configureDisabledComments);
      if (stage.kind === "watch")
        await until(
          () =>
            content(
              'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25");',
            ),
          "count before optional consent",
        );
      await delay(700);
      assertNoIdentity(fixture.records);
      assert.equal(await promptPresent(), false, "Counts-only views showed a consent card on " + stage.label);
      if (stage.disabled)
        await until(
          () => content('return !!document.querySelector("#ryd-discussion-panel");'),
          "discussion after home SPA navigation",
        );
      await shot("passive-" + stage.label.replaceAll(" ", "-"));
      result.scenarios.push({ stage: stage.label, noIdentity: true });
    }
    assert(fixture.records.slice(passiveStart).some((record) => record.path === "/votes"));
    assert(
      fixture.records
        .slice(passiveStart)
        .filter((record) => record.path === "/votes")
        .every((record) => !Object.hasOwn(record.query, "likeCount")),
      "Counts sent likeCount without the website content grant",
    );
    result.passiveRequestCount = fixture.records.length;

    await go(base + "/changelog/4/changelog_4.1.html");
    await remove(["browsingActivity"]);
    await until(async () => (await dataGrants()).length === 0, "no optional grants before the welcome opt-in");
    await until(
      () =>
        content(
          'return document.getElementById("ryd-firefox-consent-allow")?.getBoundingClientRect().height>0&&!document.getElementById("ryd-firefox-consent-actions").hidden;',
        ),
      "welcome combined opt-in",
    );
    assert.equal(
      await content('return document.querySelectorAll("#ryd-firefox-optin button").length;'),
      1,
      "Welcome offers more than one consent action",
    );
    const welcomeSwitch = await storedVoteSwitch();
    await click("#ryd-firefox-consent-allow");
    result.welcomeDenyPrompt = await prompt();
    assertCombinedPrompt(result.welcomeDenyPrompt);
    await choose(false);
    await until(
      () =>
        content(
          'return !document.getElementById("ryd-firefox-consent-allow").disabled&&document.getElementById("ryd-firefox-consent-status").textContent===browser.i18n.getMessage("consent_declined_status");',
        ),
      "welcome denial completion",
    );
    assert.deepEqual(await dataGrants(), []);
    await click("#ryd-firefox-consent-allow");
    result.welcomeGrantPrompt = await prompt();
    assertCombinedPrompt(result.welcomeGrantPrompt);
    await choose(true);
    await until(
      () =>
        content(
          'return document.getElementById("ryd-firefox-consent-actions").hidden&&document.getElementById("ryd-firefox-consent-status").textContent===browser.i18n.getMessage("changelog_firefox_vote_granted");',
        ),
      "welcome reports that votes count",
    );
    assert.deepEqual([...(await dataGrants())].sort(), VOTE_OPT_IN);
    assert.equal(await storedVoteSwitch(), welcomeSwitch, "Welcome changed the like and dislike submission switch");
    result.scenarios.push(
      "welcome offers one action; its native Deny and Allow list browsing activity, website activity and website content, Allow reports that votes count and the switch is untouched",
    );
    await shot("welcome-granted");
    await remove(["websiteActivity", "websiteContent"]);

    await go(base + "/popup.html");
    await until(
      () =>
        content(
          'return document.readyState==="complete"&&!!document.getElementById("disable_logging")&&document.getElementById("disable_vote_submission")?.checked===false;',
        ),
      "Firefox popup with the vote submission switch off",
    );
    result.scenarios.push("Firefox popup keeps the like and dislike submission switch");
    await setVoteSubmissionDisabled(true);
    await until(
      () => content('return !document.getElementById("ryd-vote-status").hidden;'),
      "vote status notice with the switch on and no vote sharing",
    );
    const declinedStatus = await content('return browser.i18n.getMessage("consent_declined_status");');
    result.voteStatusToolbar = await openToolbarButton("toolbar popup opened by its native button");
    await until(
      () =>
        toolbarScript(
          'return !document.getElementById("ryd-vote-status").hidden&&document.getElementById("ryd-counts-consent").hidden;',
        ),
      "vote status notice in the actual toolbar popup",
    );
    await toolbarClick("#ryd-vote-status-action");
    result.voteStatusDenyPrompt = await prompt();
    await toolbarClosedForPrompt();
    assertMissingVotePrompt(result.voteStatusDenyPrompt);
    await choose(false);
    await delay(700);
    assert.equal(await storedVoteSwitch(), true, "Declining vote sharing turned the switch off");
    assert.deepEqual(await dataGrants(), ["browsingActivity"]);
    await openToolbarButton("toolbar popup opened again by its native button");
    await until(
      () => toolbarScript('return !document.getElementById("ryd-vote-status").hidden;'),
      "vote status notice in the reopened toolbar popup",
    );
    await toolbarClick("#ryd-vote-status-action");
    result.voteStatusGrantPrompt = await prompt();
    await toolbarClosedForPrompt();
    assertMissingVotePrompt(result.voteStatusGrantPrompt);
    await choose(true);
    await until(
      async () => !(await toolbarPopup()) && (await storedVoteSwitch()) === false,
      "switch turned off through the remembered intent while the toolbar popup is closed",
    );
    assert.deepEqual([...(await dataGrants())].sort(), VOTE_OPT_IN);
    await until(
      () => content('return document.getElementById("ryd-vote-status").hidden;'),
      "vote status notice hidden in the popup tab after the toolbar grant",
    );
    await remove(["websiteActivity", "websiteContent"]);
    await setVoteSubmissionDisabled(true);
    await until(
      () => content('return !document.getElementById("ryd-vote-status").hidden;'),
      "vote status notice in the popup tab with the switch on",
    );
    await click("#ryd-vote-status-action");
    result.voteStatusTabDenyPrompt = await prompt();
    assertMissingVotePrompt(result.voteStatusTabDenyPrompt);
    await choose(false);
    await until(
      () =>
        content(
          'return !document.getElementById("ryd-vote-status").hidden&&!document.getElementById("ryd-vote-status-action").disabled&&document.getElementById("ryd-vote-status-result").textContent===arguments[0];',
          [declinedStatus],
        ),
      "declined vote status in the popup tab",
    );
    assert.equal(await storedVoteSwitch(), true, "Declining vote sharing in the tab turned the switch off");
    await click("#ryd-vote-status-action");
    result.voteStatusTabGrantPrompt = await prompt();
    await choose(true);
    await until(
      async () =>
        (await storedVoteSwitch()) === false &&
        (await content('return document.getElementById("ryd-vote-status").hidden;')),
      "switch turned off through the remembered intent in the popup tab",
    );
    await remove(["websiteActivity", "websiteContent"]);
    result.scenarios.push(
      "popup vote card with the switch on: in the real toolbar popup and in a popup tab, the click asks for the missing website activity and website content and records the switch intent; Deny keeps the switch on, Allow turns it off through the background while the toolbar popup is closed",
    );
    await switchTab(homeHandle);
    await go("https://www.youtube.com/watch?v=" + VIDEO_B);
    await evaluate(configureDisabledComments);
    await until(() => content('return !!document.querySelector("dislike-button-view-model button");'), "watch buttons");
    await until(
      () =>
        content(
          'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25");',
        ),
      "authoritative counts before fixture vote activation",
    );
    const voteStart = fixture.records.length;
    await click("dislike-button-view-model button");
    await until(promptVisible, "vote-click card");
    result.voteClickBody = await until(
      () =>
        content('return document.querySelector(arguments[0]).shadowRoot.querySelector(".body").textContent;', [PROMPT]),
      "announced vote-click message",
    );
    assert.equal(result.voteClickBody, ENGLISH.vote_consent_hint.message);
    await singleConsentHost("vote-click card");
    result.voteHintSurfaces = await assertThemedPopoverSurfaces(evaluate, PROMPT, "vote-click card");
    assert(
      !fixture.records.slice(voteStart).some((record) => record.path === "/puzzle/registration"),
      "Vote-click card registered voter before grant",
    );
    result.voteClickToolbar = await openToolbarFromPrompt("ryd-vote-status");
    assert.equal(
      await toolbarScript('return document.getElementById("ryd-counts-consent").hidden;'),
      true,
      "Toolbar popup showed the combined card while counts were on",
    );
    await toolbarClick("#ryd-vote-status-action");
    result.hintPrompt = await prompt();
    await toolbarClosedForPrompt();
    assertMissingVotePrompt(result.hintPrompt);
    await choose(true);
    await switchTab(homeHandle);
    await until(
      () => fixture.records.slice(voteStart).some((record) => record.path === "/interact/confirmVote"),
      "same-page pending vote after native grant",
    );
    await delay(1500);
    result.pendingVoteReplay = {
      votes: fixture.records.slice(voteStart).filter((record) => record.path === "/interact/vote").length,
      confirmations: fixture.records.slice(voteStart).filter((record) => record.path === "/interact/confirmVote")
        .length,
    };
    assert.deepEqual(
      result.pendingVoteReplay,
      { votes: 1, confirmations: 1 },
      "Pending vote was not sent exactly once",
    );
    assert.equal(await promptPresent(), false, "Vote-click card stayed after the grant");
    result.scenarios.push(
      "watch vote-click card sends nothing before the grant; its Allow opens the toolbar popup on the vote card, which asks for website activity and website content and closes; the pending click is sent exactly once after the grant",
    );
    await switchTab(homeHandle);
    await until(
      () => content('return !!document.querySelector("[data-reaction=\\"1\\"]");'),
      "reaction controls after grant",
    );
    await shot("watch-voting-granted");
    await go(base + "/consent.html?feature=account");
    await click("#consent-continue");
    result.accountPrompt = await prompt();
    assert.match(result.accountPrompt.text, /authentication information/i);
    assert.match(result.accountPrompt.text, /personally identifying information/i);
    await choose(true);
    await until(async () => (await perms()).data_collection.includes("authenticationInfo"), "account grant");
    await content(
      'const done=arguments[arguments.length-1];browser.storage.sync.set({patreonAuthenticated:true,patreonSessionToken:"fixture-account-session",patreonUser:{membershipTier:"commenter",hasActiveMembership:true}}).then(done);',
      [],
      true,
    );
    const session = await content(
      'const done=arguments[arguments.length-1];browser.runtime.sendMessage({message:"ryd_discussion",operation:"session",payload:{}}).then(done);',
      [],
      true,
    );
    assert.equal(session.ok, true, JSON.stringify(session));
    await setVoteSubmissionDisabled(true);
    await go("https://www.youtube.com/watch?v=" + VIDEO_B);
    await evaluate(configureDisabledComments);
    await until(() => content('return !!document.querySelector("[data-reaction=\\"1\\"]");'), "signed-in reaction");
    const switchedOffVotesStart = fixture.records.length;
    await click("dislike-button-view-model button");
    const reactionStart = fixture.records.length;
    await click('[data-reaction="1"]');
    await until(
      () => fixture.records.slice(reactionStart).some((record) => record.path.endsWith("/reaction/confirm")),
      "fixture reaction",
    );
    assert(
      !fixture.records
        .slice(switchedOffVotesStart)
        .some((record) => record.path.startsWith("/interact/") || record.path === "/puzzle/registration"),
      "Vote sent while the vote submission switch was on",
    );
    assert.equal(await promptPresent(), false);
    result.scenarios.push(
      "with the like and dislike submission switch on, a dislike click sends nothing and a comment reaction still goes through",
    );
    assert(
      fixture.records
        .slice(reactionStart)
        .filter((record) => /\/reaction\/(challenge|confirm)$/.test(record.path))
        .every((record) => !record.hasAuthorization),
      "Signed-in reaction sent bearer",
    );
    await driver.command("WebDriver:Refresh");
    await evaluate(configureDisabledComments);
    await until(
      () => content('return !!document.querySelector("[data-reaction=\\"1\\"][aria-pressed=\\"true\\"]");'),
      "local reaction after reload",
    );
    result.scenarios.push("signed-in reaction carries no bearer and reload preserves only local highlight");
    await until(
      () => content('return !!document.querySelector(".ryd-discussion-composer textarea");'),
      "signed-in composer",
    );
    await content(
      'const e=document.querySelector(".ryd-discussion-composer textarea");e.value="Fixture draft posted with the account grant";e.dispatchEvent(new Event("input",{bubbles:true}));',
    );
    const postingStart = fixture.records.length;
    await click('.ryd-discussion-composer [data-action="post"]');
    await until(
      () =>
        fixture.records
          .slice(postingStart)
          .some((record) => record.method === "POST" && /\/videos\/.+\/comments/.test(record.path)),
      "signed-in post without another permission",
    );
    const posts = fixture.records
      .slice(postingStart)
      .filter((record) => record.method === "POST" && /\/videos\/.+\/comments/.test(record.path));
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body.text, "Fixture draft posted with the account grant");
    result.scenarios.push("a signed-in comment posts with the account grant alone and submits exactly once");

    console.log("Native main permission and identity scenarios passed; starting private-window setup.");
    await fs.writeFile(
      path.join(evidence, "result.json"),
      JSON.stringify({ ...result, status: "running", checkpoint: "main scenarios passed" }, null, 2),
    );
    result.privateGrant = await chrome(
      'const done=arguments[arguments.length-1];const {ExtensionPermissions}=ChromeUtils.importESModule("resource://gre/modules/ExtensionPermissions.sys.mjs");ExtensionPermissions.add(arguments[0],{permissions:["internal:privateBrowsingAllowed"],origins:[]},WebExtensionPolicy.getByID(arguments[0]).extension).then(()=>done({allowed:WebExtensionPolicy.getByID(arguments[0]).privateBrowsingAllowed})).catch(error=>done({error:String(error)}));',
      [result.installed.id],
      true,
    );
    assert.equal(result.privateGrant.allowed, true, JSON.stringify(result.privateGrant));
    await setVoteSubmissionDisabled(false);
    const storageSnapshot = () =>
      content(
        "const done=arguments[arguments.length-1];Promise.all([browser.storage.local.get(null),browser.storage.sync.get(null)]).then(([local,sync])=>done({local,sync}));",
        [],
        true,
      );
    await remove(["browsingActivity"]);
    await delay(1000);
    const storageBeforePrivate = await storageSnapshot();
    const beforePrivateHandles = await driver.command("WebDriver:GetWindowHandles");
    const existingHandles = beforePrivateHandles.value || beforePrivateHandles;
    const privateStart = fixture.records.length;
    result.privateWindow = await content(
      "const done=arguments[arguments.length-1];browser.windows.create({incognito:true,url:arguments[0]}).then(window=>done({id:window.id,incognito:window.incognito}),error=>done({error:String(error)}));",
      ["https://www.youtube.com/watch?v=" + VIDEO_A],
      true,
    );
    assert.equal(result.privateWindow.incognito, true);
    const privateHandle = await until(async () => {
      const response = await driver.command("WebDriver:GetWindowHandles");
      return (response.value || response).find((handle) => !existingHandles.includes(handle));
    }, "native private window");
    await switchTab(privateHandle);
    await until(
      () => content('return !!document.querySelector("dislike-button-view-model button");'),
      "private fixture controls",
    );
    await click("dislike-button-view-model button");
    await delay(800);
    result.privateBeforeCountsGrant = await content(
      'return {count:[...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25"),ui:!!document.querySelector("#ryd-data-consent-prompt,#ryd-discussion-panel,.ryd-premium-analytics")};',
    );
    assert.equal(result.privateBeforeCountsGrant.count, false);
    assert.equal(result.privateBeforeCountsGrant.ui, false);
    assert.deepEqual(fixture.records.slice(privateStart), [], "Private window sent traffic without browsing activity");
    await shot("private-without-counts-consent");
    await switchTab(homeHandle);
    assert.deepEqual(
      await storageSnapshot(),
      storageBeforePrivate,
      "Private page without consent wrote extension storage",
    );
    await click("#ryd-counts-consent-allow");
    result.privateNormalWindowGrantPrompt = await prompt();
    assert.match(result.privateNormalWindowGrantPrompt.text, /browsing activity/i);
    assert.doesNotMatch(
      result.privateNormalWindowGrantPrompt.text,
      /website activity|website content|personally identifying|authentication|communications/i,
    );
    await choose(true);
    await until(async () => (await dataGrants()).includes("browsingActivity"), "normal-window counts grant");
    await switchTab(privateHandle);
    await until(
      () =>
        content(
          'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25");',
        ),
      "private window counts",
    );
    await click("dislike-button-view-model button");
    await delay(800);
    result.privateRequests = fixture.records.slice(privateStart);
    assert(result.privateRequests.some((record) => record.path === "/votes"));
    for (const record of result.privateRequests) {
      assert.equal(record.method, "GET");
      assert(["/votes", "/configs/selectors"].includes(record.path), JSON.stringify(record));
      assert.deepEqual(Object.keys(record.query), record.path === "/votes" ? ["videoId"] : []);
      assert.equal(record.hasAuthorization, false);
    }
    assert.equal(
      await content(
        'return !!document.getElementById("ryd-data-consent-prompt")||!!document.querySelector("#ryd-discussion-panel");',
      ),
      false,
    );
    await shot("private-counts-only");
    await switchTab(homeHandle);
    console.log("Native private-window count isolation passed; starting about:addons toggles.");
    await go(base + "/popup.html");
    assert.deepEqual(await storageSnapshot(), storageBeforePrivate, "Private page wrote extension storage");
    result.scenarios.push(
      "private window without browsing activity stays quiet with no consent UI/storage writes; normal-window grant enables private counts without reload, with videoId only and no voting",
    );

    const beforeManager = await driver.command("WebDriver:GetWindowHandles");
    await driver.command("WebDriver:NewWindow", { type: "tab" });
    const managerHandle = await until(async () => {
      const response = await driver.command("WebDriver:GetWindowHandles");
      return (response.value || response).find((handle) => !(beforeManager.value || beforeManager).includes(handle));
    }, "owned addon manager tab");
    await switchTab(managerHandle);
    await go("about:addons");
    await until(
      () => content('return typeof window.gViewController?.loadView === "function";'),
      "addon manager controller",
    );
    await content(
      'window.gViewController.loadView("addons://detail/"+encodeURIComponent(arguments[0])+"/permissions");',
      [result.installed.id],
    );
    await until(
      () => content('return !!document.querySelector("moz-toggle[permission-key=websiteContent]");'),
      "native data-category toggles",
    );
    await click('button[is="named-deck-button"][name="permissions"]');
    await until(
      () =>
        content(
          'const toggle=document.querySelector("moz-toggle[permission-key=websiteContent]");return toggle.getBoundingClientRect().height>0;',
        ),
      "visible native category toggles",
    );
    result.aboutAddonsControls = await content(
      'return [...document.querySelectorAll("moz-toggle[permission-key]")].map(e=>({category:e.getAttribute("permission-key"),pressed:e.pressed}));',
    );
    await shot("about-addons");
    result.revocations = [];
    const toggle = async (category, granted) => {
      console.log("Native toggle", category, granted);
      (result.lifecycleCheckpoints ||= []).push({ at: Date.now(), event: "native-toggle", category, granted });
      await fs.writeFile(
        path.join(evidence, "result.json"),
        JSON.stringify(
          { ...result, status: "running", checkpoint: "native toggle " + category + " " + granted },
          null,
          2,
        ),
      );
      await switchTab(managerHandle);
      const selector = 'moz-toggle[permission-key="' + category + '"]';
      if ((await content("return document.querySelector(arguments[0]).pressed;", [selector])) !== granted)
        await click(selector);
      await until(
        () => content("return document.querySelector(arguments[0])?.pressed===arguments[1];", [selector, granted]),
        "native " + category + " toggle " + granted,
      );
      await shot("toggle-" + category + "-" + (granted ? "on" : "off"));
      await switchTab(homeHandle);
    };
    const ensureAnalyticsHost = () =>
      content(
        'if(!document.getElementById("secondary-inner")){const secondary=document.createElement("div");secondary.id="secondary";const inner=document.createElement("div");inner.id="secondary-inner";secondary.append(inner);(document.querySelector("ytd-watch-flexy,ytd-watch-grid")||document.body).append(secondary);}return true;',
      );
    const freshWatch = async (videoId) => {
      await go("https://www.youtube.com/watch?v=" + videoId);
      await evaluate(configureDisabledComments);
      await ensureAnalyticsHost();
      await until(
        () =>
          content(
            'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25");',
          ),
        "counts after native category revoke",
      );
      await until(
        () =>
          content('return document.querySelector("#ryd-discussion-panel")?.textContent.includes("Fixture comment");'),
        "rendered anonymous fixture comment for " + videoId,
      );
    };
    await switchTab(homeHandle);
    fixture.setMembershipTier("premium");
    await go(base + "/popup.html");
    await content(
      'const done=arguments[arguments.length-1];browser.storage.sync.set({patreonAuthenticated:true,patreonSessionToken:"fixture-account-session",patreonUser:{membershipTier:"premium",hasActiveMembership:true}}).then(done);',
      [],
      true,
    );
    await freshWatch(VIDEO_B);
    await until(
      () =>
        fixture.records.some(
          (record) => record.path === "/api/patreon/analytics/video/" + VIDEO_B && record.hasAuthorization,
        ),
      "premium fixture request before counts revocation",
    );
    await until(
      () => content('return !!document.querySelector(".ryd-premium-analytics");'),
      "rendered premium fixture before counts revocation",
    );
    const staleVideo = "plmoknijbuh";
    fixture.holdVotes(staleVideo);
    await evaluate(navigateFixture, ["watch", staleVideo]);
    await evaluate(configureDisabledComments);
    await ensureAnalyticsHost();
    await until(() => fixture.heldVoteCount(staleVideo) > 0, "held current-video count response");
    const retainedDocument = await content(
      "window.__rydCountsRevokeDocument=crypto.randomUUID();return window.__rydCountsRevokeDocument;",
    );
    await toggle("browsingActivity", false);
    await until(
      () =>
        content(
          'return !document.querySelector("#ryd-bar-container,#ryd-discussion-panel,.ryd-premium-analytics")&&!!document.getElementById("ryd-data-consent-prompt");',
        ),
      "counts revocation removes count, discussion and premium renders",
    );
    const revokedStart = fixture.records.length;
    fixture.releaseVotes(staleVideo, { dislikes: 999 });
    await click("dislike-button-view-model button");
    await delay(800);
    assert(
      !fixture.records
        .slice(revokedStart)
        .some((record) =>
          /\/votes|\/api\/patreon\/analytics\/video\/|\/api\/discussion\/(?:videos|comments)|\/puzzle\/registration|\/interact\//.test(
            record.path,
          ),
        ),
      "Current-video traffic continued while browsing activity was revoked",
    );
    assert.equal(
      await content('return document.body.textContent.includes("999");'),
      false,
      "Revoked pending counts rendered",
    );
    result.countsRegrantToolbar = await openToolbarFromPrompt("ryd-counts-consent");
    const keptSession = await toolbarScript(
      'const done=arguments[arguments.length-1];Promise.all([browser.permissions.getAll(),browser.storage.sync.get("patreonSessionToken")]).then(([permissions,storage])=>done({permissions,sessionKept:storage.patreonSessionToken==="fixture-account-session"}));',
      [],
      true,
    );
    assert.equal(keptSession.sessionKept, true);
    assert.deepEqual(
      [...keptSession.permissions.data_collection].sort(),
      ["authenticationInfo", "personallyIdentifyingInfo", "websiteActivity", "websiteContent"].sort(),
      "Revoking counts changed another optional grant",
    );
    await toolbarClick("#ryd-counts-consent-allow");
    result.countsRegrantPrompt = await prompt();
    await toolbarClosedForPrompt();
    assert.match(result.countsRegrantPrompt.text, /browsing activity/i);
    assert.doesNotMatch(
      result.countsRegrantPrompt.text,
      /website activity|website content|personally identifying|authentication|communications/i,
    );
    const resumedStart = fixture.records.length;
    await choose(true);
    await switchTab(homeHandle);
    await until(
      () =>
        content(
          'return [...document.querySelectorAll("dislike-button-view-model #text,dislike-button-view-model [role=text]")].some(e=>e.textContent.trim()==="25")&&document.querySelector("#ryd-discussion-panel")?.textContent.includes("Fixture comment")&&!!document.querySelector(".ryd-premium-analytics");',
        ),
      "counts, discussion and premium recover after browsing activity regrant",
    );
    await until(
      () =>
        fixture.records
          .slice(resumedStart)
          .some((record) => record.path === "/api/patreon/analytics/video/" + staleVideo && record.hasAuthorization),
      "premium current-video request resumes after counts regrant",
    );
    assert.equal(await content("return window.__rydCountsRevokeDocument;"), retainedDocument);
    assert.equal(await content('return document.body.textContent.includes("999");'), false);
    result.revocations.push({
      category: "browsingActivity",
      pendingResponseDiscarded: true,
      otherGrantsPreserved: true,
      sessionPreserved: true,
      currentVideoTrafficStopped: true,
      countsDiscussionPremiumRecoveredWithoutReload: true,
    });
    await shot("counts-revoked-and-regranted");
    await toggle("websiteContent", false);
    const noLikeStart = fixture.records.length;
    await freshWatch("qwertyuiopa");
    await delay(400);
    const noLikeRequests = fixture.records.slice(noLikeStart).filter((record) => record.path === "/votes");
    assert(noLikeRequests.length);
    assert(noLikeRequests.every((record) => !Object.hasOwn(record.query, "likeCount")));
    result.revocations.push({ category: "websiteContent", countsContinue: true, likeCountAbsent: true });
    await toggle("websiteContent", true);
    await toggle("websiteActivity", false);
    await go(base + "/popup.html");
    const reactionStore = await content(
      'const done=arguments[arguments.length-1];browser.storage.local.get("rydDiscussionReactions").then(done);',
      [],
      true,
    );
    assert(!reactionStore.rydDiscussionReactions?.length);
    await freshWatch("asdfghjklzx");
    const noVoteStart = fixture.records.length;
    await click("dislike-button-view-model button");
    await until(() => content('return !!document.querySelector("[data-reaction=\\"1\\"]");'), "reaction controls");
    await click('[data-reaction="1"]');
    await until(
      () => content('return !!document.querySelector("[data-action=\\"voteOptIn-consent\\"]");'),
      "in-context reaction consent prompt",
    );
    await delay(400);
    assert(
      !fixture.records
        .slice(noVoteStart)
        .some((record) => /\/puzzle\/registration|\/interact\/|\/reaction\//.test(record.path)),
      "Vote or reaction traffic before website activity grant",
    );
    await shot("reaction-consent-without-website-activity");
    await toggle("websiteActivity", true);
    await until(
      () => fixture.records.slice(noVoteStart).some((record) => record.path.endsWith("/reaction/confirm")),
      "pending reaction after website activity regrant",
    );
    result.revocations.push({
      category: "websiteActivity",
      countsContinue: true,
      votesAndReactionsStopped: true,
      localReactionsCleared: true,
      reactionPromptedInContext: true,
      pendingReactionSentAfterGrant: true,
    });
    for (const category of ["personallyIdentifyingInfo", "authenticationInfo"]) {
      await go(base + "/popup.html");
      await content(
        'const done=arguments[arguments.length-1];browser.storage.sync.set({patreonAuthenticated:true,patreonSessionToken:"fixture-account-session",patreonUser:{membershipTier:"commenter",hasActiveMembership:true}}).then(done);',
        [],
        true,
      );
      await toggle(category, false);
      const accountDeniedStart = fixture.records.length;
      await go(base + "/popup.html");
      await until(
        () =>
          content(
            'const done=arguments[arguments.length-1];browser.storage.sync.get(["patreonAuthenticated","patreonUser","patreonSessionToken"]).then(value=>done(arguments[0]==="authenticationInfo"?Object.keys(value).length===0:!!value.patreonSessionToken));',
            [category],
            true,
          ),
        "category-specific account storage after " + category + " revoke",
      );
      const anonymousStart = fixture.records.length;
      await freshWatch(category === "authenticationInfo" ? "zxcvbnmasdf" : "poiuytrewqa");
      await until(
        () =>
          fixture.records
            .slice(anonymousStart)
            .some((record) => record.path.includes("/videos/") && record.path.endsWith("/comments")),
        "anonymous comments after account revoke",
      );
      assert(
        fixture.records
          .slice(anonymousStart)
          .filter((record) => record.path.includes("/comments"))
          .every((record) => !record.hasAuthorization),
      );
      assert(
        !fixture.records
          .slice(accountDeniedStart)
          .some((record) => record.hasAuthorization || record.path.startsWith("/api/auth/")),
        "Account traffic continued without " + category,
      );
      result.revocations.push({
        category,
        accountCleared: category === "authenticationInfo",
        sessionPreserved: category === "personallyIdentifyingInfo",
        countsAndAnonymousCommentsContinue: true,
      });
      await toggle(category, true);
      if (category === "personallyIdentifyingInfo") {
        await go(base + "/popup.html");
        const resumed = await content(
          'const done=arguments[arguments.length-1];browser.runtime.sendMessage({message:"ryd_discussion",operation:"session",payload:{}}).then(done);',
          [],
          true,
        );
        assert.equal(resumed.ok, true, JSON.stringify(resumed));
        assert.equal(resumed.data.authenticated, true);
        result.revocations.at(-1).sessionResumedOnRegrant = true;
      }
      await freshWatch(category === "authenticationInfo" ? "zxcvbnmasdf" : "poiuytrewqa");
      result.revocations.at(-1).commentRenderedAfterRegrant = true;
    }
    result.scenarios.push(
      "all six native about:addons optional toggles revoke their mapped features; browsing activity blocks current-video work, while other revocations preserve counts and anonymous discussion",
    );
    result.diagnostics = await chrome(
      "Services.console.unregisterListener(window.__rydConsoleListener);return window.__rydConsole;",
    );
    result.diagnosticSummary = {
      contextLifecycle: result.diagnostics.filter(({ message }) =>
        /Promise (?:resolved|rejected) (?:after context unloaded|while context is inactive)|Ignored listener for inactive context|WebExtension context not found/.test(
          message,
        ),
      ),
      unclassified: result.diagnostics.filter(({ message }) =>
        /uncaught exception|Script terminated by timeout/.test(message),
      ),
      environment: result.diagnostics.filter(({ message }) =>
        /app.normandy|addons.xpi|aboutaddons-utils.mjs/.test(message),
      ),
    };
    for (const [file, expectedHash] of Object.entries(result.sourceHashes))
      assert.equal(
        crypto
          .createHash("sha256")
          .update(await fs.readFile(path.join(ROOT, "Extensions/combined/dist/firefox", file)))
          .digest("hex"),
        expectedHash,
        "Production artifact changed during native validation: " + file,
      );
    assertNoLinkedIdentity(fixture.records);
    assert.equal(fixture.unknown.length, 0, "Unexpected fixture API: " + JSON.stringify(fixture.unknown));
    assert(
      !fixture.blocked.some((record) => record.host.includes("returnyoutubedislikeapi.com")),
      "Production API traffic escaped substitution",
    );
    result.functionalStatus = "passed";
    result.status = result.diagnostics.length ? "passed-with-diagnostics" : "passed";
    result.limitations.push(
      "Native functional assertions passed. Firefox emitted context-unload/inactive-context diagnostics during document replacement; raw timestamped messages and lifecycle checkpoints are retained. Unclassified uncaught-object and script-termination signals are reported separately; this is not a zero-error browser pass.",
    );
  } catch (error) {
    result.status = "failed";
    result.error = String(error.stack || error);
    process.exitCode = 1;
    if (driver) {
      await driver.context("chrome").catch(() => {});
      result.failureConsole = await driver
        .script("Services.console.unregisterListener(window.__rydConsoleListener); return window.__rydConsole;")
        .catch(() => []);
      result.failureChrome = await driver
        .script(
          'return {selected:gBrowser.selectedBrowser.currentURI.spec,panel:document.getElementById("notification-popup")?.state,tabs:[...gBrowser.tabs].map(t=>t.linkedBrowser.currentURI.spec)};',
        )
        .catch(() => null);
      await driver.context("content").catch(() => {});
      result.failureContent = await driver
        .script("return {url:location.href,body:document.body?.innerText.slice(0,2500)};")
        .catch(() => null);
    }
  } finally {
    if (driver) {
      await driver.command("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
      driver.socket.destroy();
    }
    result.process.gracefulExit = await until(
      () => child.exitCode !== null || child.signalCode !== null,
      "graceful owned Firefox exit",
    ).catch(() => false);
    if (!result.process.gracefulExit && child.exitCode === null) child.kill();
    await until(() => child.exitCode !== null || child.signalCode !== null, "owned Firefox exit").catch(() => {});
    await log.close();
    await fixture.close();
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.log("Firefox: " + result.status + "; evidence " + evidence);
    if (result.error) console.error(result.error);
  }
  return result;
}
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = { run };
