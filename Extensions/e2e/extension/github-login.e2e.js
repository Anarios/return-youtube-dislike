const { test, expect } = require("@playwright/test");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const messages = require("../../combined/_locales/en/messages.json");

for (const scenario of ["success", "unavailable", "not_contributor", "wrong-state"]) {
  test(`built popup GitHub login: ${scenario}`, async ({}, testInfo) => {
    const apiServer = await startHermeticApiServer();
    const adapter = new HermeticExtensionArtifactAdapter({ apiServer });
    const diagnostics = [];
    try {
      await adapter.start();
      adapter.page.on("pageerror", (error) => diagnostics.push(error.message));
      adapter.page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push(message.text());
      });
      await adapter.worker.evaluate((scenario) => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
        const ledger = (globalThis.githubLoginFixture = { opens: 0, exchanges: 0, pkceVerified: false });
        let challenge;
        chrome.identity = {
          getRedirectURL: () => redirectUri,
          launchWebAuthFlow: ({ url }, callback) => {
            ledger.opens++;
            const authUrl = new URL(url);
            const state = scenario === "wrong-state" ? "another-attempt" : authUrl.searchParams.get("state");
            const responseUrl = `${redirectUri}?code=fixture-code&state=${state}`;
            callback?.(responseUrl);
            return Promise.resolve(responseUrl);
          },
        };
        if (typeof browser !== "undefined") browser.identity = chrome.identity;
        globalThis.fetch = async (url, options) => {
          const parsed = new URL(url);
          if (parsed.pathname === "/api/auth/github/login") {
            if (scenario === "unavailable") return Response.json({ error: "github_not_configured" }, { status: 503 });
            challenge = parsed.searchParams.get("codeChallenge");
            const params = new URLSearchParams({
              state: "fixture-state",
              redirect_uri: redirectUri,
              code_challenge: challenge,
              code_challenge_method: "S256",
            });
            return Response.json({
              authUrl: `https://github.com/login/oauth/authorize?${params}`,
              state: "fixture-state",
              redirectUri,
            });
          }
          if (parsed.pathname === "/api/auth/github/exchange") {
            ledger.exchanges++;
            const body = JSON.parse(options.body);
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.codeVerifier));
            const actual = btoa(String.fromCharCode(...new Uint8Array(digest)))
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");
            ledger.pkceVerified =
              actual === challenge && body.state === "fixture-state" && body.redirectUri === redirectUri;
            if (!ledger.pkceVerified) return Response.json({ error: "github_invalid_state" }, { status: 400 });
            if (scenario === "not_contributor") return Response.json({ error: "not_contributor" }, { status: 403 });
            return Response.json({
              success: true,
              sessionToken: "fixture-session",
              user: {
                id: "gh_42",
                fullName: "Test Contributor",
                imageUrl: "",
                hasActiveMembership: true,
                membershipTier: "premium",
                authProvider: "github",
                githubLogin: "fixture-contributor",
              },
            });
          }
          return originalFetch(url, options);
        };
      }, scenario);
      await adapter.page.goto(`chrome-extension://${adapter.extensionId}/popup.html`);
      await adapter.page.evaluate(() => {
        // Keep the browser/provider boundary deterministic; the bundled click handler still runs.
        chrome.permissions.contains = (permissions, callback) => callback(true);
        chrome.identity = { getRedirectURL: () => `https://${chrome.runtime.id}.chromiumapp.org/` };
      });
      const expectedMessage = {
        unavailable: "githubLoginUnavailable",
        not_contributor: "githubLoginNotContributor",
        "wrong-state": "githubLoginExpired",
      }[scenario];
      const dialogs = [];
      adapter.page.on("dialog", async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
      await adapter.page.locator("#github-login-btn").click();
      if (expectedMessage) {
        await expect.poll(() => dialogs).toEqual([messages[expectedMessage].message]);
        await expect(adapter.page.locator("#patreon-logged-out")).toBeVisible();
      } else {
        await expect(adapter.page.locator("#patreon-logged-in")).toBeVisible();
        await expect(adapter.page.locator("#patreon-user-name")).toHaveText("Test Contributor");
        await adapter.page.screenshot({
          path: testInfo.outputPath("github-contributor-signed-in.png"),
          fullPage: true,
        });
      }
      const evidence = await adapter.worker.evaluate(async () => ({
        ...globalThis.githubLoginFixture,
        authenticated: (await chrome.storage.sync.get("patreonAuthenticated")).patreonAuthenticated === true,
      }));
      expect(evidence.opens).toBe(scenario === "unavailable" ? 0 : 1);
      expect(evidence.exchanges).toBe(["success", "not_contributor"].includes(scenario) ? 1 : 0);
      expect(evidence.authenticated).toBe(scenario === "success");
      if (evidence.exchanges) expect(evidence.pkceVerified).toBe(true);
    } catch (error) {
      console.error(
        JSON.stringify({
          diagnostics,
          ledger: await adapter.worker?.evaluate(() => globalThis.githubLoginFixture).catch(() => null),
        }),
      );
      throw error;
    } finally {
      await adapter.close();
      await apiServer.close();
    }
  });
}
