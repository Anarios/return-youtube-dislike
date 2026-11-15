const { test, expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../../UserScript/e2e/harness");
const { requestWorkerReload } = require("../../UserScript/e2e/live/live-extension-reloader");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");
const { assertInvariantContinuously } = require("../continuous-invariants");

const PANELS = ".ryd-premium-teaser, .ryd-premium-analytics";

async function installSidebar(context) {
  await context.addInitScript(() => {
    if (location.hostname !== "www.youtube.com") return;
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const sidebar = document.createElement("aside");
        sidebar.id = "secondary";
        sidebar.style.cssText = "width: 520px; margin: 24px;";
        sidebar.innerHTML = '<div id="secondary-inner"></div>';
        document.body.append(sidebar);
      },
      { once: true },
    );
  });
}

for (const premium of [false, true]) {
  test(`${premium ? "premium analytics" : "guest teaser"} stops rendering in an open tab after an extension reload`, async () => {
    const apiServer = await startHermeticApiServer();
    const adapter = new HermeticExtensionArtifactAdapter({ apiServer });
    const panelSelector = premium ? ".ryd-premium-analytics" : ".ryd-premium-teaser";
    try {
      await adapter.start();
      await adapter.setPremiumTeaserHidden(false);
      await installSidebar(adapter.context);
      await adapter.context.route(
        (url) => url.pathname === "/api/discussion/me",
        (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"invalid_session"}' }),
      );
      await adapter.context.route(
        (url) => url.pathname.startsWith("/api/patreon/analytics/video/"),
        (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({
              timeSeries: {
                bucket: "day",
                totalRangeStartUtc: "2026-01-01T00:00:00Z",
                totalRangeEndUtc: "2026-01-31T00:00:00Z",
                selectedRangeStartUtc: "2026-01-01T00:00:00Z",
                selectedRangeEndUtc: "2026-01-31T00:00:00Z",
                points: [
                  { timestampUtc: "2026-01-01T00:00:00Z", likes: 10, dislikes: 2 },
                  { timestampUtc: "2026-01-31T00:00:00Z", likes: 20, dislikes: 3 },
                ],
              },
              geo: { countries: [], subdivisions: [], topLikes: [], topDislikes: [] },
              summary: { totalLikes: 30, totalDislikes: 5, uniqueIps: 20, countriesRepresented: 0 },
            }),
          }),
      );
      if (premium) {
        await adapter.worker.evaluate(async () => {
          await chrome.storage.sync.set({
            patreonAuthenticated: true,
            patreonSessionToken: "synthetic-reload-session",
            patreonUser: { fullName: "Synthetic member", hasActiveMembership: true, membershipTier: "premium" },
          });
        });
      }

      const expectHealthyPanel = async () => {
        const panel = adapter.page.locator(panelSelector);
        await expect(panel).toBeVisible();
        if (premium) {
          await expect(panel).toHaveAttribute("aria-busy", "false");
          await expect(panel.locator("canvas").first()).toBeVisible();
        } else {
          await expect(panel.locator("#ryd-premium-teaser-likes")).toHaveText("100");
          await expect(panel.locator("#ryd-premium-teaser-dislikes")).toHaveText("25");
        }
      };
      await adapter.openWatch(VIDEO_A);
      await expectHealthyPanel();
      const originalDocument = await adapter.page.locator("html").elementHandle();
      const sidebar = await adapter.page.locator("#secondary").elementHandle();
      // Navigate while the sidebar is absent to queue the panel's container retry.
      await sidebar.evaluate((element, videoId) => {
        const panel = element.querySelector(".ryd-premium-analytics");
        if (panel) {
          const observer = new MutationObserver((records) => {
            if (records.some((record) => record.oldValue === "true") && panel.getAttribute("aria-busy") === "false") {
              element.dataset.analyticsCompleted = "true";
              observer.disconnect();
            }
          });
          observer.observe(panel, { attributes: true, attributeFilter: ["aria-busy"], attributeOldValue: true });
        }
        element.remove();
        window.__youtubeFixture.navigate(videoId);
      }, VIDEO_B);
      if (premium) {
        // Loading ends after renderAnalytics has tried to render without its container.
        await expect.poll(() => sidebar.getAttribute("data-analytics-completed")).toBe("true");
      }

      await requestWorkerReload(adapter.worker);
      // Reloading the extension must leave this document and its existing script alive.
      expect(await originalDocument.evaluate((element) => element === document.documentElement)).toBe(true);
      const { beforeNavigation, remaining } = await sidebar.evaluate(
        (element, { videoId, panels, panelSelector }) => {
          document.body.append(element);
          const beforeNavigation = document.querySelectorAll(panelSelector).length;
          window.__youtubeFixture.navigate(videoId);
          return { beforeNavigation, remaining: document.querySelectorAll(panels).length };
        },
        { videoId: VIDEO_A, panels: PANELS, panelSelector },
      );
      expect(beforeNavigation, "The original panel must still exist before the first orphaned navigation").toBe(1);
      expect(remaining, "The first same-document watch navigation must remove orphaned panels").toBe(0);

      // The queued retry and later sidebar replacement must not revive either panel.
      await adapter.page.evaluate((videoId) => {
        const sidebar = document.querySelector("#secondary");
        sidebar.remove();
        window.__youtubeFixture.navigate(videoId);
        setTimeout(() => document.body.append(sidebar), 500);
      }, VIDEO_B);
      await assertInvariantContinuously({
        durationMs: 1_250,
        read: () => adapter.page.locator(PANELS).count(),
        isValid: (count) => count === 0,
        label: "Orphaned panels stay absent while the sidebar returns and retry timers run",
      });
      await expect(adapter.page.locator("#secondary-inner")).toBeAttached();
      expect(await originalDocument.evaluate((element) => element === document.documentElement)).toBe(true);
      expect(adapter.backend.blockedRequests).toEqual([]);
      expect(apiServer.unexpectedRequests).toEqual([]);
    } finally {
      await adapter.close();
      await apiServer.close();
    }
  });
}
