const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./Extensions/UserScript/e2e",
  testMatch: "**/*.e2e.js",
  testIgnore: "**/live/**",
  globalSetup: require.resolve("./Extensions/e2e/playwright-userscript-global-setup"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 15_000,
  expect: {
    timeout: 5_000,
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report/userscript" }]]
    : "list",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  outputDir: "test-results/userscript",
});
