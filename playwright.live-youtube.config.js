const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./Extensions/UserScript/e2e/live",
  testMatch: "**/*.live.e2e.js",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  reporter: "list",
  outputDir: "test-results/live-youtube",
});
