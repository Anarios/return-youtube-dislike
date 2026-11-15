const { test, expect } = require("@playwright/test");
const { VIDEO_A } = require("../../UserScript/e2e/harness");
const { HermeticExtensionArtifactAdapter, startHermeticApiServer } = require("../hermetic-artifact-smoke");

async function applyTheme(page, dark, nativeTokens) {
  await page.evaluate(
    ({ dark, nativeTokens }) => {
      const root = document.documentElement;
      root.toggleAttribute("dark", dark);
      for (const [name, value] of Object.entries({
        "--yt-spec-base-background": dark ? "#151923" : "#fff8f0",
        "--yt-spec-text-primary": dark ? "#e4eaff" : "#302010",
        "--yt-spec-text-secondary": dark ? "#abbbd2" : "#705030",
      })) {
        root.style.setProperty(name, nativeTokens ? value : "initial");
      }
      document.body.style.backgroundColor = dark ? "#0f0f0f" : "#fff";
    },
    { dark, nativeTokens },
  );
}

for (const nativeTokens of [false, true]) {
  test(`premium analytics follows the host theme with native color tokens ${nativeTokens}`, async () => {
    const apiServer = await startHermeticApiServer();
    const adapter = new HermeticExtensionArtifactAdapter({
      apiServer,
      contextOptions: { colorScheme: "dark" },
    });
    let analyticsRequests = 0;
    const analyticsQueries = [];
    try {
      await adapter.start();
      await adapter.context.addInitScript(() => {
        if (location.hostname !== "www.youtube.com") return;
        document.addEventListener("DOMContentLoaded", () => {
          const secondary = document.createElement("aside");
          secondary.id = "secondary";
          secondary.style.cssText = "width: 520px; margin: 24px;";
          const inner = document.createElement("div");
          inner.id = "secondary-inner";
          secondary.append(inner);
          document.body.append(secondary);
        });
      });
      await adapter.context.route(
        (url) => url.pathname.startsWith("/api/patreon/analytics/video/"),
        async (route) => {
          analyticsRequests++;
          const query = new URL(route.request().url()).searchParams;
          analyticsQueries.push(Object.fromEntries(query));
          const selectedStart = query.get("selectedRangeStartUtc") || "2026-01-01T00:00:00Z";
          const selectedEnd =
            query.get("selectedRangeEndUtc") ||
            new Date(Date.parse(selectedStart) + Number(query.get("rangeDays") || 30) * 86400000).toISOString();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({
              timeSeries: {
                bucket: "day",
                totalRangeStartUtc: "2026-01-01T00:00:00Z",
                totalRangeEndUtc: "2026-04-01T00:00:00Z",
                selectedRangeStartUtc: selectedStart,
                selectedRangeEndUtc: selectedEnd,
                points: [
                  { timestampUtc: selectedStart, likes: 10, dislikes: 2 },
                  { timestampUtc: selectedEnd, likes: 20, dislikes: 3 },
                ],
              },
              geo: { countries: [], subdivisions: [], topLikes: [], topDislikes: [] },
              summary: { totalLikes: 30, totalDislikes: 5, uniqueIps: 20, countriesRepresented: 0 },
            }),
          });
        },
      );
      await adapter.context.route(
        (url) => url.pathname === "/api/discussion/me",
        (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"invalid_session"}' }),
      );
      await adapter.worker.evaluate(async () => {
        await chrome.storage.sync.set({
          patreonAuthenticated: true,
          patreonSessionToken: "synthetic-theme-session",
          patreonUser: { fullName: "Synthetic member", hasActiveMembership: true, membershipTier: "premium" },
        });
      });
      await adapter.openWatch(VIDEO_A);
      const panel = adapter.page.locator(".ryd-premium-analytics");
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(panel.locator("canvas").first()).toBeVisible();
      const controlLayout = () =>
        panel.evaluate((element) => ({
          panel: element.getBoundingClientRect().toJSON(),
          buttons: [...element.querySelectorAll(".ryd-range, .ryd-range-anchor")].map((button) =>
            button.getBoundingClientRect().toJSON(),
          ),
        }));
      const normalLayout = await controlLayout();
      await adapter.page.locator("#secondary").evaluate((element) => (element.style.width = "332px"));
      const narrowLayout = await controlLayout();
      expect(narrowLayout.panel.width).toBe(332);
      expect(narrowLayout.buttons).toHaveLength(6);
      for (const button of narrowLayout.buttons) {
        expect(button.left).toBeGreaterThanOrEqual(narrowLayout.panel.left);
        expect(button.right).toBeLessThanOrEqual(narrowLayout.panel.right);
      }
      await adapter.page.locator("#secondary").evaluate((element) => (element.style.width = "520px"));
      const restoredLayout = await controlLayout();
      restoredLayout.buttons.forEach((button, index) => {
        expect(button.left).toBeCloseTo(normalLayout.buttons[index].left, 1);
        expect(button.top).toBeCloseTo(normalLayout.buttons[index].top, 1);
        expect(button.width).toBeCloseTo(normalLayout.buttons[index].width, 1);
        expect(button.height).toBeCloseTo(normalLayout.buttons[index].height, 1);
      });
      for (const dark of [false, true, false]) {
        const requestsBefore = analyticsRequests;
        await applyTheme(adapter.page, dark, nativeTokens);
        const background = nativeTokens
          ? dark
            ? "rgb(21, 25, 35)"
            : "rgb(255, 248, 240)"
          : dark
            ? "rgb(32, 32, 32)"
            : "rgb(255, 255, 255)";
        const foreground = nativeTokens
          ? dark
            ? "rgb(228, 234, 255)"
            : "rgb(48, 32, 16)"
          : dark
            ? "rgb(255, 255, 255)"
            : "rgb(15, 15, 15)";
        await expect(panel).toHaveCSS("background-color", background);
        await expect(panel).toHaveCSS("color", foreground);
        await expect(panel.locator(".ryd-analytics__totals-value").first()).toHaveCSS("color", foreground);
        await expect(panel.locator(".ryd-range").first()).toHaveCSS(
          "color",
          dark ? (nativeTokens ? "rgb(171, 187, 210)" : "rgb(187, 187, 187)") : "rgb(31, 41, 55)",
        );
        await adapter.page.waitForTimeout(500);
        expect(analyticsRequests).toBe(requestsBefore);
        for (const chart of ["activity", "lists", "map"]) {
          const expand = panel.locator(`.ryd-analytics__section-expand[data-chart="${chart}"]`);
          await expand.click();
          await expect(panel.locator(`.ryd-analytics__section[data-chart="${chart}"]`)).toHaveCSS(
            "background-color",
            background,
          );
          await expand.click();
        }
      }
      await adapter.page.locator('.ryd-range[data-range="7"]').click();
      await expect(adapter.page.locator('.ryd-range[data-range="7"]')).toHaveClass(/is-active/);
      await expect.poll(() => analyticsRequests).toBeGreaterThan(1);
      await adapter.page.locator('.ryd-range[data-range="30"]').click();
      await expect(panel).toHaveAttribute("aria-busy", "false");
      const chart = await panel.locator("#ryd-analytics-activity").boundingBox();
      const plotWidth = chart.width - 60;
      const sliderX = chart.x + 40 + plotWidth / 6;
      const sliderY = chart.y + chart.height - 29;
      await adapter.page.mouse.move(sliderX, sliderY);
      await adapter.page.mouse.down();
      await adapter.page.mouse.move(sliderX + plotWidth / 6, sliderY, { steps: 10 });
      await adapter.page.mouse.up();
      await expect(panel.locator(".ryd-analytics__window-hint")).toHaveText("Custom selection");
      await expect.poll(() => analyticsQueries.at(-1)).toHaveProperty("selectedRangeStartUtc");
      await adapter.page.locator('.ryd-range[data-range="30"]').click();
      await expect(panel.locator('.ryd-range[data-range="30"]')).toHaveClass(/is-active/);
      await expect(panel.locator(".ryd-analytics__window-hint")).toHaveText("First 30 days");
      await expect.poll(() => analyticsQueries.at(-1)).toMatchObject({ rangeDays: "30", rangeAnchor: "first" });
      expect(analyticsQueries.at(-1)).not.toHaveProperty("selectedRangeStartUtc");
      expect(adapter.backend.blockedRequests).toEqual([]);
      expect(apiServer.unexpectedRequests).toEqual([]);
    } finally {
      await adapter.close();
      await apiServer.close();
    }
  });
}
