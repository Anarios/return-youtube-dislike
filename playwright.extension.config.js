const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./Extensions/e2e/extension",
  testMatch: "**/*.e2e.js",
  globalSetup: require.resolve("./Extensions/e2e/playwright-extension-global-setup"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report/extension" }]]
    : "list",
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  outputDir: "test-results/extension",
});
