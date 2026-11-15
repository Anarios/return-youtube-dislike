const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { installGmEnvironment, injectGeneratedUserscript } = require("../UserScript/e2e/harness");
const {
  ROOT,
  VIDEO_A,
  VIDEO_B,
  COMMENT_ID,
  delay,
  until,
  startFixtures,
  prepareArtifact,
  configureDisabledComments,
  navigateFixture,
  assertNoIdentity,
  assertNoLinkedIdentity,
} = require("./feature-permissions-fixtures");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const COUNT = 'dislike-button-view-model #text,dislike-button-view-model [role="text"]';

async function runRuntime(runtime, evidence) {
  const owned = path.join(evidence, runtime);
  await fs.mkdir(owned, { recursive: true });
  const fixture = await startFixtures(owned);
  const result = {
    runtime,
    startedAt: new Date().toISOString(),
    scenarios: [],
    requests: fixture.records,
    blockedExternal: fixture.blocked,
    unexpectedApi: fixture.unknown,
    derivation: [],
    limitations: [],
    consoleErrors: [],
  };
  let browser, context, page, worker;
  try {
    if (runtime === "chrome") {
      const inertBrowser = await chromium.launch({
        channel: "chromium",
        headless: true,
        chromiumSandbox: true,
        proxy: { server: fixture.proxyOrigin, bypass: "127.0.0.1,localhost" },
      });
      try {
        const inertContext = await inertBrowser.newContext({ ignoreHTTPSErrors: true });
        const inertPage = await inertContext.newPage();
        await inertPage.goto("https://www.youtube.com/watch?v=" + VIDEO_A, { waitUntil: "domcontentloaded" });
        await delay(700);
        assert.equal(await inertPage.locator("#ryd-bar-container").count(), 0, "Inert fixture rendered RYD bar");
        assert.equal(await inertPage.locator(COUNT).count(), 0, "Inert fixture rendered dislike count");
        assert.equal(fixture.records.length, 0, "Inert fixture generated extension API traffic");
        await inertPage.screenshot({ path: path.join(owned, "negative-control.png") });
        result.scenarios.push("separate browser without extension cannot render RYD or make extension API requests");
      } finally {
        await inertBrowser.close();
      }
    }
    let derived;
    if (runtime === "chrome") {
      derived = path.join(owned, "extension");
      Object.assign(
        result,
        await prepareArtifact(path.join(ROOT, "Extensions/combined/dist/chrome"), derived, fixture.apiOrigin),
      );
      context = await chromium.launchPersistentContext(path.join(owned, "profile"), {
        channel: "chromium",
        headless: true,
        chromiumSandbox: true,
        ignoreHTTPSErrors: true,
        proxy: { server: fixture.proxyOrigin, bypass: "127.0.0.1,localhost" },
        args: ["--disable-extensions-except=" + derived, "--load-extension=" + derived, "--no-first-run"],
      });
      worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker", { timeout: 15000 }));
      worker.on("console", (message) => {
        if (message.type() === "error") result.consoleErrors.push({ source: "worker", text: message.text() });
      });
      await worker.evaluate(() => {
        globalThis.__fixtureMessages = [];
        chrome.runtime.onMessage.addListener((message, sender) => {
          if (message?.message === "ryd_discussion")
            globalThis.__fixtureMessages.push({
              operation: message.operation,
              scope: message.scope,
              url: sender.url,
              tabUrl: sender.tab?.url,
              frameId: sender.frameId,
            });
        });
      });
      result.extensionId = new URL(worker.url()).hostname;
      const installed = await worker.evaluate(async () => ({
        manifest: chrome.runtime.getManifest(),
        background: await (await fetch(chrome.runtime.getURL("ryd.background.js"))).text(),
        content: await (await fetch(chrome.runtime.getURL("ryd.content-script.js"))).text(),
      }));
      assert.equal(installed.manifest.version, result.manifest.version);
      assert.equal(hash(installed.background), hash(await fs.readFile(path.join(derived, "ryd.background.js"))));
      result.loadedBackgroundSha256 = hash(installed.background);
      assert.equal(hash(installed.content), hash(await fs.readFile(path.join(derived, "ryd.content-script.js"))));
      result.loadedContentSha256 = hash(installed.content);
      result.workerUrl = worker.url();
      assert.equal(
        context.serviceWorkers().filter((w) => w.url().startsWith("chrome-extension://")).length,
        1,
        "Competing extension worker",
      );
    } else {
      browser = await chromium.launch({
        channel: "chromium",
        headless: true,
        chromiumSandbox: true,
        proxy: { server: fixture.proxyOrigin, bypass: "127.0.0.1,localhost" },
      });
      context = await browser.newContext({ ignoreHTTPSErrors: true });
      await installGmEnvironment(context);
      const source = await fs.readFile(path.join(ROOT, "Extensions/UserScript/Return Youtube Dislike.user.js"), "utf8");
      result.sourceHashes = { userscript: hash(source) };
      derived = path.join(owned, "userscript.user.js");
      await fs.writeFile(derived, source.replaceAll("https://returnyoutubedislikeapi.com", fixture.apiOrigin));
      result.derivedSha256 = hash(await fs.readFile(derived));
      result.derivation =
        "Replace production API origin in generated userscript only; original generated file remains unchanged.";
    }
    page = await context.newPage();
    result.pageErrors = [];
    page.on("pageerror", (error) => result.pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") result.consoleErrors.push({ source: "page", text: message.text() });
    });
    await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
    if (runtime === "userscript") {
      await page.evaluate(() => window.__navigationFixture.navigate("watch", "abcdefghijk"));
      assert.equal(await page.locator("#ryd-bar-container").count(), 0, "Inert negative control rendered RYD");
      await page.evaluate(() => window.__navigationFixture.navigate("channel", ""));
      await injectGeneratedUserscript(page, { artifactPath: derived, disableVoteSubmission: false });
      const injectedSource = await page
        .locator("script")
        .evaluateAll((scripts) =>
          scripts.map((script) => script.textContent).find((source) => source.startsWith("// ==UserScript==")),
        );
      const sourceURL = "\n//# sourceURL=" + derived.replace(/\n/g, "");
      assert(injectedSource.endsWith(sourceURL), "Missing Playwright source path annotation");
      const loadedScriptHash = hash(injectedSource.slice(0, -sourceURL.length));
      assert.equal(loadedScriptHash, result.derivedSha256, "Executed userscript differs from the owned artifact");
      result.loadedUserscriptSha256 = loadedScriptHash;
      result.scenarios.push("inert fixture cannot render the RYD bar");
    }
    await delay(700);
    assertNoIdentity(fixture.records);
    for (const stage of [
      { kind: "channel", videoId: "search", label: "search" },
      { kind: "watch", videoId: VIDEO_A, label: "watch" },
      { kind: "watch", videoId: VIDEO_B, label: "comments-disabled watch", disabled: true },
      { kind: "shorts", videoId: VIDEO_A, label: "Short" },
    ]) {
      const baseline = fixture.records.length;
      await page.evaluate(({ kind, videoId, source }) => (0, eval)("(" + source + ")")(kind, videoId), {
        ...stage,
        source: navigateFixture.toString(),
      });
      if (stage.disabled) await page.evaluate(configureDisabledComments);
      if (stage.kind === "watch") {
        await until(() => page.locator(COUNT).filter({ hasText: "25" }).count(), "generated count on " + stage.label);
      }
      await delay(700);
      assertNoIdentity(fixture.records);
      if (stage.disabled && runtime === "chrome") {
        await page.waitForSelector("#ryd-discussion-panel", { timeout: 15000 });
        await page.waitForSelector('[data-reaction="1"]', { timeout: 15000 });
      }
      result.scenarios.push({
        stage: stage.label,
        requestsSinceBaseline: fixture.records.length - baseline,
        noIdentity: true,
      });
      await page.screenshot({ path: path.join(owned, stage.label.replaceAll(" ", "-") + ".png") });
    }
    assert(
      fixture.records.some((record) => record.path === "/votes"),
      "No authoritative count request",
    );
    if (runtime === "chrome")
      assert(
        fixture.records.some((record) => record.path.includes("/videos/") && record.path.endsWith("/comments")),
        "Comments-disabled SPA read did not start",
      );
    const passiveEnd = fixture.records.length;
    result.passiveRequestCount = passiveEnd;
    await page.evaluate(({ source, videoId }) => (0, eval)("(" + source + ")")("watch", videoId), {
      source: navigateFixture.toString(),
      videoId: VIDEO_B,
    });
    await page.evaluate(configureDisabledComments);
    await until(() => page.locator(COUNT).filter({ hasText: "25" }).count(), "count before fixture vote");
    const voteStart = fixture.records.length;
    await page.locator("ytd-watch-flexy:not([hidden]) dislike-button-view-model button").click();
    await until(
      () => fixture.records.some((record, index) => index >= voteStart && record.path === "/interact/confirmVote"),
      "fixture vote confirmation",
    );
    assert(
      fixture.records.slice(voteStart).some((record) => record.path === "/puzzle/registration"),
      "Registration did not begin at the first vote",
    );
    assert(
      !fixture.records.slice(0, voteStart).some((record) => record.path === "/puzzle/registration"),
      "Registration preceded the first vote",
    );
    result.scenarios.push("registration begins only after the fixture vote click");
    await page.screenshot({ path: path.join(owned, "vote-confirmed.png"), fullPage: true });
    if (runtime === "chrome") {
      const account = await context.newPage();
      await account.goto("chrome-extension://" + result.extensionId + "/popup.html");
      await account.evaluate(async () => {
        await chrome.storage.sync.set({
          patreonAuthenticated: true,
          patreonSessionToken: "fixture-account-session",
          patreonUser: { membershipTier: "commenter", hasActiveMembership: true },
        });
      });
      const session = await account.evaluate(() =>
        chrome.runtime.sendMessage({ message: "ryd_discussion", operation: "session", payload: {} }),
      );
      assert.equal(session.ok, true, JSON.stringify(session));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.evaluate(configureDisabledComments);
      await page.waitForSelector('[data-reaction="1"]', { timeout: 15000 });
      const reactionStart = fixture.records.length;
      await page.locator('[data-reaction="1"]').first().click();
      await until(
        () =>
          fixture.records.some((record, index) => index >= reactionStart && record.path.endsWith("/reaction/confirm")),
        "fixture reaction confirmation",
      );
      assert(
        fixture.records
          .slice(reactionStart)
          .filter((record) => /\/reaction\/(challenge|confirm)$/.test(record.path))
          .every((record) => !record.hasAuthorization),
        "Reaction carried account session",
      );
      const stored = await account.evaluate(() => chrome.storage.local.get("rydDiscussionReactions"));
      result.localReactionState = stored;
      assert.equal(stored.rydDiscussionReactions.find((item) => item.videoId === VIDEO_B)?.reactions[COMMENT_ID], 1);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.evaluate(configureDisabledComments);
      await until(
        () => page.locator('[data-reaction="1"][aria-pressed="true"]').count(),
        "locally restored reaction highlight",
      );
      assertNoLinkedIdentity(fixture.records);
      result.scenarios.push(
        "signed-in reaction omits bearer; reload highlights local reaction without reactions/state",
      );
      await page.screenshot({ path: path.join(owned, "reaction-reloaded.png"), fullPage: true });
      await account.close();
    } else
      result.limitations.push(
        "Userscript has no discussion/reaction feature; reaction and account scenarios do not apply.",
      );
    assertNoLinkedIdentity(fixture.records);
    assert.equal(fixture.unknown.length, 0, "Unexpected fixture API requests: " + JSON.stringify(fixture.unknown));
    assert(
      !fixture.blocked.some((record) => record.host.includes("returnyoutubedislikeapi.com")),
      "Production API origin escaped substitution",
    );
    assert.deepEqual(result.pageErrors, []);
    result.networkIsolation = {
      proxyInstalledBeforeRuntimeStartup: true,
      productionApiAttempts: fixture.blocked.filter((record) => record.host.includes("returnyoutubedislikeapi.com")),
      nonFixtureNetworkPolicy: "All nonfixture destinations are denied by the startup proxy; attempts are archived.",
    };
    for (const [filename, expectedHash] of Object.entries(result.sourceHashes)) {
      const sourcePath =
        runtime === "chrome"
          ? path.join(ROOT, "Extensions/combined/dist/chrome", filename)
          : path.join(ROOT, "Extensions/UserScript/Return Youtube Dislike.user.js");
      assert.equal(hash(await fs.readFile(sourcePath)), expectedHash, "Production artifact changed during validation");
    }
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = String(error.stack || error);
    if (worker) result.discussionMessages = await worker.evaluate(() => globalThis.__fixtureMessages).catch(() => []);
    if (runtime === "chrome" && page && !page.isClosed()) {
      const session = await context.newCDPSession(page);
      const worlds = [];
      session.on("Runtime.executionContextCreated", ({ context }) => worlds.push(context));
      await session.send("Runtime.enable");
      const world = worlds.find((world) => world.origin === "chrome-extension://" + result.extensionId);
      result.contentWorlds = worlds.map(({ id, origin, name, auxData }) => ({ id, origin, name, auxData }));
      if (world)
        result.directDiscussionResponse = await session.send("Runtime.evaluate", {
          contextId: world.id,
          expression: `chrome.runtime.sendMessage({message:"ryd_discussion",operation:"comments",payload:{videoId:"${VIDEO_B}",sort:"top"}})`,
          awaitPromise: true,
          returnByValue: true,
        });
      await session.detach();
    }
    if (page && !page.isClosed()) {
      result.failureProbe = await page
        .evaluate(() => ({
          url: location.href,
          panel: document.querySelector("#ryd-discussion-panel")?.outerHTML,
          count: document.querySelector("dislike-button-view-model")?.outerHTML,
        }))
        .catch(() => null);
      await page.screenshot({ path: path.join(owned, "failure.png"), fullPage: true }).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await fixture.close();
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(owned, "result.json"), JSON.stringify(result, null, 2));
    console.log(runtime + ": " + result.status + "; evidence " + owned);
    if (result.error) console.error(result.error);
  }
  return result;
}
async function run() {
  const evidence = path.resolve(
    process.env.RYD_IDENTITY_EVIDENCE ||
      path.join(ROOT, ".private/validation", "feature-identity-" + new Date().toISOString().replace(/[:.]/g, "-")),
  );
  const runtimes = process.env.RYD_IDENTITY_RUNTIMES?.split(",") || ["chrome", "userscript"];
  const results = [];
  for (const runtime of runtimes) {
    assert(["chrome", "userscript"].includes(runtime));
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
