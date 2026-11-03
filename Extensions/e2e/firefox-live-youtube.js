const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const {
  chooseNativePermission,
  connectMarionette,
  readNativePermissionPrompt,
  spawnHeadlessFirefox,
} = require("./firefox-consent-smoke");
const { ROOT, until, listen } = require("./feature-permissions-fixtures");
const { assertPopoverSurface, readPopoverSurface } = require("./popover-surface");
const { addToolbarButton, createToolbarPopup } = require("./firefox-toolbar-popup");

const LIVE_VIDEO = process.env.RYD_LIVE_VIDEO || "jNQXAC9IVRw";
const LIVE_PROFILE = process.env.RYD_FIREFOX_LIVE_PROFILE;
const API_HOST = "returnyoutubedislikeapi.com";
const COLOR_SCHEME_PREF = "layout.css.prefers-color-scheme.content-override";
const THEMES = [
  { name: "light", override: 1, dark: false },
  { name: "dark", override: 0, dark: true },
];
const PROMPT = "#ryd-data-consent-prompt";
const ENGLISH = require("../combined/_locales/en/messages.json");
const VOTING = ["websiteActivity", "websiteContent"];
const LIKE_BUTTON = "ytd-watch-metadata like-button-view-model button[aria-pressed]";
const DISLIKE_BUTTON = "ytd-watch-metadata dislike-button-view-model button";

function cookieConsentButtons() {
  const buttons = [...document.querySelectorAll("ytd-consent-bump-v2-lightbox button")].filter((button) =>
    button.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
  );
  return buttons.length
    ? buttons.map((button) => button.getAttribute("aria-label") || button.textContent.trim())
    : null;
}

function rejectCookieConsent() {
  const page = [...document.querySelectorAll('form input[name="set_eom"]')].find((input) => input.value === "true");
  const dialog = [...document.querySelectorAll("ytd-consent-bump-v2-lightbox button")].find((button) =>
    /reject/i.test(button.getAttribute("aria-label") || button.textContent),
  );
  const button = page?.form.querySelector("button") || dialog;
  button?.click();
  return Boolean(button);
}

function readStacking(selector) {
  const masthead = document.querySelector("#masthead-container");
  return {
    hosts: document.querySelectorAll(selector).length,
    prompt: getComputedStyle(document.querySelector(selector)).zIndex,
    masthead: masthead ? getComputedStyle(masthead).zIndex : null,
  };
}

function readTopmostOverPrompt(selector) {
  const panel = document.querySelector(selector)?.shadowRoot.querySelector(".panel");
  if (!panel) return null;
  const box = panel.getBoundingClientRect();
  const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return {
    promptOnTop: Boolean(top?.closest(selector)),
    topmost: top ? top.tagName.toLowerCase() + (top.id ? "#" + top.id : "") : null,
  };
}

function findVisible(selector) {
  return [...document.querySelectorAll(selector)].find((element) => element.checkVisibility()) || null;
}

function readVoteControls(likeSelector, dislikeSelector) {
  const visible = (selector) =>
    [...document.querySelectorAll(selector)].find((element) => element.checkVisibility()) || null;
  const like = visible(likeSelector);
  const dislike = visible(dislikeSelector);
  return {
    signedIn: Boolean(document.querySelector("#avatar-btn")),
    liked: like?.getAttribute("aria-pressed") === "true",
    disliked: dislike?.getAttribute("aria-pressed") === "true",
    dislikeText: dislike?.textContent.trim() || "",
  };
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function prepareProfile(profile, source, colorScheme) {
  if (source)
    await fs.cp(source, profile, { recursive: true, filter: (file) => !/(^|[\\/])(parent\.)?lock$/.test(file) });
  else await fs.mkdir(profile, { recursive: true });
  const port = await freePort();
  const prefs = {
    "marionette.port": port,
    "browser.shell.checkDefaultBrowser": false,
    "browser.startup.homepage_override.mstone": "ignore",
    "browser.startup.page": 0,
    "startup.homepage_welcome_url": "about:blank",
    "startup.homepage_welcome_url.additional": "",
    "browser.newtabpage.enabled": false,
    "app.update.disabledForTesting": true,
    "datareporting.policy.dataSubmissionEnabled": false,
    "toolkit.telemetry.enabled": false,
    [COLOR_SCHEME_PREF]: colorScheme,
  };
  await fs.appendFile(
    path.join(profile, "user.js"),
    "\n" +
      Object.entries(prefs)
        .map(([key, value]) => "user_pref(" + JSON.stringify(key) + "," + JSON.stringify(value) + ");")
        .join("\n") +
      "\n",
  );
  return port;
}

async function launch(evidence, name, source, colorScheme) {
  const profile = path.join(evidence, name + "-profile");
  const port = await prepareProfile(profile, source, colorScheme);
  const log = await fs.open(path.join(evidence, name + "-firefox.log"), "a");
  const child = spawnHeadlessFirefox(profile);
  child.stdout.on("data", (chunk) => void log.write(chunk));
  child.stderr.on("data", (chunk) => void log.write(chunk));
  const session = { child, log, profile, temporaryProfile: Boolean(source) };
  try {
    session.driver = await connectMarionette(port, name + " Marionette startup");
    await session.driver.command("WebDriver:NewSession", { unhandledPromptBehavior: "dismiss and notify" });
    await session.driver.command("WebDriver:SetWindowRect", { width: 1600, height: 1300 });
  } catch (error) {
    await close(session);
    throw error;
  }
  const { driver } = session;
  session.content = async (script, args = [], async = false) => {
    await driver.context("content");
    return driver.script(script, args, async);
  };
  session.chrome = async (script, args = [], async = false) => {
    await driver.context("chrome");
    return driver.script(script, args, async);
  };
  session.evaluate = (fn, args = []) => session.content("return (" + fn.toString() + ")(...arguments);", args);
  session.screenshot = async (file) => {
    await driver.context("content");
    const image = await driver.command("WebDriver:TakeScreenshot", { full: false });
    await fs.writeFile(path.join(evidence, file), Buffer.from(image.value, "base64"));
  };
  return session;
}

async function close(session) {
  const { child, driver, log, profile, temporaryProfile } = session;
  if (driver) {
    await driver.command("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
    driver.socket.destroy();
  }
  await until(() => child.exitCode !== null || child.signalCode !== null, "owned Firefox exit").catch(() =>
    child.kill(),
  );
  await log.close();
  if (temporaryProfile) await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function windowHandles(driver) {
  await driver.context("content");
  const handles = await driver.command("WebDriver:GetWindowHandles");
  return handles.value || handles;
}

async function closeWelcomeTab(session) {
  const opened = await until(
    async () => (await windowHandles(session.driver)).find((handle) => handle !== session.home),
    "welcome tab opened by the install",
    15000,
  );
  await session.driver.command("WebDriver:SwitchToWindow", { handle: opened, focus: true });
  const welcome = await until(
    () => session.content("return location.href==='about:blank'?false:location.href;"),
    "welcome tab address",
  );
  await session.driver.command("WebDriver:CloseWindow");
  await session.driver.command("WebDriver:SwitchToWindow", { handle: session.home, focus: true });
  return welcome;
}

async function installExtension(session) {
  [session.home] = await windowHandles(session.driver);
  const installed = await session.chrome(
    'const done=arguments[arguments.length-1];const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");const file=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);file.initWithPath(arguments[0]);AddonManager.installTemporaryAddon(file).then(addon=>done({id:addon.id,version:addon.version}),error=>done({error:String(error)}));',
    [path.join(ROOT, "Extensions/combined/dist/firefox")],
    true,
  );
  assert(!installed.error, JSON.stringify(installed));
  const host = await session.chrome("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;", [
    installed.id,
  ]);
  session.base = "moz-extension://" + host;
  return { ...installed, welcomePage: await closeWelcomeTab(session) };
}

async function openWatchPage(session, result) {
  await session.driver.context("content");
  await session.driver.command("WebDriver:SwitchToWindow", { handle: session.home, focus: true });
  await session.driver.command("WebDriver:Navigate", { url: "https://www.youtube.com/watch?v=" + LIVE_VIDEO });
  if ((await session.content("return location.hostname;")) === "consent.youtube.com") {
    result.cookieConsentRejected = await session.evaluate(rejectCookieConsent);
    assert(result.cookieConsentRejected, "YouTube cookie consent page has no reject choice");
    await until(
      async () => (await session.content("return location.hostname;")) === "www.youtube.com",
      "YouTube after rejecting cookies",
      30000,
    );
  }
  await until(
    () => session.content('return document.visibilityState==="visible";'),
    "YouTube tab in the foreground",
    10000,
  );
}

async function rejectCookieDialog(session, result) {
  const buttons = await session.evaluate(cookieConsentButtons);
  if (!buttons) return;
  result.cookieConsentButtons = buttons;
  result.cookieConsentRejected = await session.evaluate(rejectCookieConsent);
  assert(result.cookieConsentRejected, "YouTube cookie dialog has no reject choice: " + buttons.join(", "));
  await until(async () => !(await session.evaluate(cookieConsentButtons)), "YouTube cookie dialog closed", 15000);
  await until(
    () =>
      session.content(
        'return ![...document.querySelectorAll("tp-yt-iron-overlay-backdrop")].some(backdrop=>backdrop.checkVisibility({opacityProperty:true}));',
      ),
    "YouTube cookie backdrop gone",
    15000,
  );
}

function promptShown(session) {
  return session.content("const host=document.querySelector(arguments[0]);return !!host&&!host.hidden;", [PROMPT]);
}

async function checkThemes(evidence, result) {
  const session = await launch(evidence, "fresh", null, THEMES[0].override);
  try {
    result.installed = await installExtension(session);
    for (const theme of THEMES) {
      await session.chrome("Services.prefs.setIntPref(arguments[0], arguments[1]);", [
        COLOR_SCHEME_PREF,
        theme.override,
      ]);
      await openWatchPage(session, result);
      await until(
        () => session.content("return document.documentElement.hasAttribute('dark')===arguments[0];", [theme.dark]),
        "YouTube " + theme.name + " theme",
        30000,
      );
      await until(() => promptShown(session), PROMPT + " on live YouTube in the " + theme.name + " theme", 45000);
      if (await session.evaluate(cookieConsentButtons)) {
        const stackingUnderDialog = await session.evaluate(readTopmostOverPrompt, [PROMPT]);
        await session.screenshot("live-" + theme.name + "-cookie-dialog.png");
        assert(
          stackingUnderDialog && !stackingUnderDialog.promptOnTop,
          "YouTube's cookie dialog paints over the consent card: " + JSON.stringify(stackingUnderDialog),
        );
        result.stackingUnderCookieDialog = stackingUnderDialog;
      }
      await rejectCookieDialog(session, result);
      await until(() => session.content('return document.readyState==="complete";'), "page load", 30000);
      await until(() => promptShown(session), PROMPT + " after the page settled (" + theme.name + ")", 15000);
      const surface = await session.content("return (" + readPopoverSurface.toString() + ")(arguments[0]);", [PROMPT]);
      assertPopoverSurface(surface, PROMPT + " on live YouTube (" + theme.name + ")");
      const stacking = await session.evaluate(readStacking, [PROMPT]);
      assert.equal(stacking.hosts, 1, "Exactly one RYD consent host on live YouTube (" + theme.name + ")");
      assert(
        Number(stacking.masthead) > Number(stacking.prompt),
        "Consent card stacks below the YouTube masthead: " + JSON.stringify(stacking),
      );
      await session.screenshot("live-" + theme.name + ".png");
      result.themes.push({ ...theme, surface, stacking });
    }
    assert.notEqual(
      result.themes[0].surface.panelBackground,
      result.themes[1].surface.panelBackground,
      "Light and dark cards share one background",
    );
  } catch (error) {
    await recordFailure(session, evidence, "fresh", result);
    throw error;
  } finally {
    await close(session);
  }
}

async function startApiRecorder(session) {
  await session.chrome(
    'const host=arguments[0];window.__rydApiRequests=[];window.__rydApiObserver={observe(subject){const channel=subject.QueryInterface(Ci.nsIHttpChannel);if(channel.URI.host!==host)return;window.__rydApiRequests.push({at:Date.now(),method:channel.requestMethod,path:channel.URI.filePath});}};Services.obs.addObserver(window.__rydApiObserver,"http-on-modify-request");',
    [API_HOST],
  );
}

function apiRequests(session) {
  return session.chrome("return window.__rydApiRequests.filter(request=>request.method!=='OPTIONS');");
}

function countPath(requests, suffix) {
  return requests.filter((request) => request.path.endsWith(suffix)).length;
}

async function inExtensionPage(session, script, args = []) {
  await session.driver.context("content");
  const opened = await session.driver.command("WebDriver:NewWindow", { type: "tab", focus: false });
  const handle = opened.value?.handle || opened.handle;
  try {
    await session.driver.command("WebDriver:SwitchToWindow", { handle, focus: false });
    await session.driver.command("WebDriver:Navigate", { url: session.base + "/popup.html" });
    return await session.driver.script(script, args, true);
  } finally {
    await session.driver.command("WebDriver:CloseWindow");
    await session.driver.command("WebDriver:SwitchToWindow", { handle: session.home, focus: true });
  }
}

function grantedCategories(session) {
  return inExtensionPage(
    session,
    "const done=arguments[arguments.length-1];browser.permissions.getAll().then(value=>done(value.data_collection||[]));",
  );
}

function removeCategories(session, categories) {
  return inExtensionPage(
    session,
    "const done=arguments[arguments.length-1];browser.permissions.remove({data_collection:arguments[0]}).then(done);",
    [categories],
  );
}

function readVoteSwitch(session) {
  return inExtensionPage(
    session,
    'const done=arguments[arguments.length-1];browser.storage.sync.get("disableVoteSubmission").then(value=>done(value.disableVoteSubmission===true));',
  );
}

function writeVoteSwitch(session, disabled) {
  return inExtensionPage(
    session,
    "const done=arguments[arguments.length-1];browser.storage.sync.set({disableVoteSubmission:arguments[0]}).then(()=>done(true));",
    [disabled],
  );
}

async function clickPromptAllow(session) {
  await session.driver.context("content");
  const button = await session.driver.script(
    'return document.querySelector(arguments[0])?.shadowRoot.querySelector("button.primary");',
    [PROMPT],
  );
  assert(button, "In-page Allow button is missing");
  await session.driver.command("WebDriver:ElementClick", { id: button["element-6066-11e4-a52e-4f735466cecf"] });
}

async function grantThroughToolbar(session, toolbar, sectionId, button, assertPrompt) {
  await until(
    async () => (await toolbar.run("return !document.getElementById(arguments[0]).hidden;", [sectionId])).value,
    sectionId + " in the toolbar popup",
  );
  await toolbar.click(button);
  await until(async () => !(await toolbar.find()), "toolbar popup closed so it cannot cover Firefox's prompt");
  const nativePrompt = await until(() => readNativePermissionPrompt(session.driver), "Firefox permission prompt");
  assertPrompt(nativePrompt.text);
  await chooseNativePermission(session.driver, true);
  return nativePrompt.text;
}

function assertCombinedPrompt(text) {
  assert.match(text, /browsing activity/i);
  assert.match(text, /website activity/i);
  assert.match(text, /website content/i);
  assert.doesNotMatch(text, /personally identifying|authentication|communications/i);
}

function assertVotePrompt(text) {
  assert.match(text, /website activity/i);
  assert.match(text, /website content/i);
  assert.doesNotMatch(text, /browsing activity|personally identifying|authentication|communications/i);
}

async function clickLike(session) {
  const button = await until(() => session.evaluate(findVisible, [LIKE_BUTTON]), "visible Like button");
  await session.driver.command("WebDriver:ElementClick", { id: button["element-6066-11e4-a52e-4f735466cecf"] });
}

async function runSignedInFlow(evidence, result) {
  const flow = (result.signedInFlow = { steps: [] });
  const step = (name, details = {}) => flow.steps.push({ name, at: new Date().toISOString(), ...details });
  const session = await launch(evidence, "signed-in", LIVE_PROFILE, THEMES[1].override);
  let liked = false;
  try {
    flow.installed = await installExtension(session);
    await startApiRecorder(session);
    const toolbar = createToolbarPopup(session.chrome, session.base);
    const controls = () => session.evaluate(readVoteControls, [LIKE_BUTTON, DISLIKE_BUTTON]);

    await openWatchPage(session, flow);
    await until(async () => (await controls()).signedIn, "signed-in YouTube masthead", 30000);
    await rejectCookieDialog(session, flow);
    const before = await controls();
    assert(!before.liked && !before.disliked, "The account already rates the test video: " + JSON.stringify(before));
    await until(() => promptShown(session), "page-load consent card", 45000);
    assert.deepEqual(await apiRequests(session), [], "RYD contacted its API before any grant");
    await session.screenshot("signed-in-card.png");
    step("page card shown with no RYD traffic");

    await clickPromptAllow(session);
    await until(toolbar.find, "toolbar popup opened from the in-page card");
    await until(
      async () => !(await session.content("return !!document.querySelector(arguments[0]);", [PROMPT])),
      "in-page card gone while the toolbar popup is open",
    );
    flow.combinedPrompt = await grantThroughToolbar(
      session,
      toolbar,
      "ryd-counts-consent",
      "#ryd-counts-consent-allow",
      assertCombinedPrompt,
    );
    flow.grants = await until(async () => {
      const grants = await grantedCategories(session);
      return ["browsingActivity", ...VOTING].every((category) => grants.includes(category)) ? grants : false;
    }, "combined grant");
    flow.counts = await until(
      async () => {
        const current = await controls();
        return /\d/.test(current.dislikeText) ? current.dislikeText : false;
      },
      "real dislike count on the watch page",
      30000,
    );
    const afterGrant = await apiRequests(session);
    assert(countPath(afterGrant, "/votes") >= 1, "No vote-data request after the grant: " + JSON.stringify(afterGrant));
    assert.equal(countPath(afterGrant, "/puzzle/registration"), 0, "Voter ID registered at grant time");
    assert.equal(countPath(afterGrant, "/interact/vote"), 0, "A vote was sent at grant time");
    await session.screenshot("signed-in-counts.png");
    step("combined grant shows real counts without registration", { dislikeText: flow.counts });

    await removeCategories(session, VOTING);
    await openWatchPage(session, flow);
    await until(async () => /\d/.test((await controls()).dislikeText), "counts after removing vote sharing", 30000);
    await clickLike(session);
    liked = true;
    await until(() => promptShown(session), "vote-click consent card", 15000);
    flow.voteCardBody = await until(
      () =>
        session.content(
          'return document.querySelector(arguments[0])?.shadowRoot.querySelector(".body").textContent||false;',
          [PROMPT],
        ),
      "vote card text announced",
    );
    assert.equal(flow.voteCardBody, ENGLISH.vote_consent_hint.message, "Vote card shows the page-load text");
    assert.equal(
      await session.content("return document.querySelectorAll(arguments[0]).length;", [PROMPT]),
      1,
      "More than one RYD consent card",
    );
    const beforeVote = await apiRequests(session);
    assert.equal(countPath(beforeVote, "/interact/vote"), 0, "The like was sent before vote sharing was granted");
    await session.screenshot("signed-in-vote-card.png");
    step("vote-click card shown, vote held");

    await clickPromptAllow(session);
    await until(toolbar.find, "toolbar popup opened from the vote card");
    flow.votePrompt = await grantThroughToolbar(
      session,
      toolbar,
      "ryd-vote-status",
      "#ryd-vote-status-action",
      assertVotePrompt,
    );
    await until(
      async () => countPath(await apiRequests(session), "/interact/confirmVote") >= 1,
      "pending like sent and confirmed after the grant",
      30000,
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const afterVote = await apiRequests(session);
    flow.pendingVote = {
      registrations: countPath(afterVote, "/puzzle/registration"),
      votes: countPath(afterVote, "/interact/vote"),
      confirmations: countPath(afterVote, "/interact/confirmVote"),
    };
    assert.equal(flow.pendingVote.votes, 1, "Pending like not sent exactly once: " + JSON.stringify(flow.pendingVote));
    assert.equal(flow.pendingVote.confirmations, 1, "Pending like not confirmed exactly once");
    step("pending like sent once after the grant", flow.pendingVote);

    await clickLike(session);
    await until(async () => !(await controls()).liked, "like removed on YouTube", 15000);
    liked = false;
    await until(async () => countPath(await apiRequests(session), "/interact/vote") >= 2, "removal sent to RYD", 30000);
    step("like undone on YouTube and in RYD");

    await writeVoteSwitch(session, true);
    await removeCategories(session, VOTING);
    flow.toolbarWidgetId = await addToolbarButton(session.chrome, flow.installed.id);
    await session.driver.context("chrome");
    await session.driver.click('[id="' + flow.toolbarWidgetId + '"] .unified-extensions-item-action-button');
    await until(toolbar.find, "toolbar popup opened from its button");
    flow.switchPrompt = await grantThroughToolbar(
      session,
      toolbar,
      "ryd-vote-status",
      "#ryd-vote-status-action",
      assertVotePrompt,
    );
    await until(async () => !(await readVoteSwitch(session)), "vote switch turned off by the grant", 15000);
    flow.finalGrants = await grantedCategories(session);
    step("vote card grant turned the switch off");

    await openWatchPage(session, flow);
    flow.finalControls = await until(async () => {
      const current = await controls();
      return /\d/.test(current.dislikeText) ? current : false;
    }, "final watch page");
    assert(!flow.finalControls.liked && !flow.finalControls.disliked, "The account still rates the test video");
    await session.screenshot("signed-in-final.png");
  } catch (error) {
    await recordFailure(session, evidence, "signed-in", flow);
    if (liked) await clickLike(session).catch(() => {});
    throw error;
  } finally {
    flow.apiRequests = await apiRequests(session).catch(() => null);
    await close(session);
  }
}

async function recordFailure(session, evidence, name, target) {
  if (!session.driver) return;
  await session.driver.context("content").catch(() => {});
  target.failureContent = await session.driver
    .script("return {url:location.href,title:document.title,body:document.body?.innerText.slice(0,1500)};")
    .catch(() => null);
  const image = await session.driver.command("WebDriver:TakeScreenshot", { full: false }).catch(() => null);
  if (image) await fs.writeFile(path.join(evidence, name + "-failure.png"), Buffer.from(image.value, "base64"));
}

async function run() {
  const evidence = path.resolve(
    process.env.RYD_FIREFOX_LIVE_EVIDENCE ||
      path.join(ROOT, ".private/validation", "firefox-live-youtube-" + new Date().toISOString().replace(/[:.]/g, "-")),
  );
  await fs.mkdir(evidence, { recursive: true });
  const result = { startedAt: new Date().toISOString(), video: LIVE_VIDEO, themes: [] };
  try {
    await checkThemes(evidence, result);
    if (LIVE_PROFILE) await runSignedInFlow(evidence, result);
    else result.signedInFlow = { skipped: "Set RYD_FIREFOX_LIVE_PROFILE to a signed-in Firefox profile" };
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
    console.log("Firefox live YouTube: " + result.status + "; evidence " + evidence);
    if (result.error) console.error(result.error);
  }
}

module.exports = { run };

if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
