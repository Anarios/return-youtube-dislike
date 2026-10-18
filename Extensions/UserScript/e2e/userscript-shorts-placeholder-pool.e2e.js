const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
} = require("./harness");
const {
  SHORTS_PLACEHOLDER_POOL_COUNTS,
  installShortsPlaceholderPoolRoute,
  runShortsPlaceholderPoolContract,
  shortsPlaceholderPoolUrl,
} = require("../../e2e/shorts-placeholder-pool-contract");

const EXISTING_CREDENTIALS = Object.freeze({
  registrationConfirmed: true,
  userId: "ExistingUserscriptCredential00000001",
});

test("userscript preserves every Shorts action through ten pre-rendered and recycled Next transitions", async ({
  context,
  page,
}) => {
  test.setTimeout(30_000);
  const consoleErrors = [];
  const pageErrors = [];
  const unexpectedFixtureRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.addInitScript(() => {
    globalThis.__unhandledRejections = [];
    addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      globalThis.__unhandledRejections.push(reason instanceof Error ? reason.message : String(reason));
    });
  });

  const backend = createFakeBackend({ countsByVideo: SHORTS_PLACEHOLDER_POOL_COUNTS });
  await installGmEnvironment(context, { [CREDENTIAL_KEY]: EXISTING_CREDENTIALS });
  await installHermeticRoutes(context, backend);
  await installShortsPlaceholderPoolRoute(context, {
    onUnexpectedRequest: (request) => unexpectedFixtureRequests.push(request),
  });

  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(shortsPlaceholderPoolUrl(), { waitUntil: "domcontentloaded" });
  await injectGeneratedUserscript(page);
  const results = await runShortsPlaceholderPoolContract({
    page,
    readRequests: () => backend.requests,
    runtimeName: "userscript",
  });

  expect(results).toHaveLength(11);
  expect(results.filter((result) => result.pixelOracle).map((result) => result.logicalIndex)).toEqual([0, 1, 10]);
  expect(unexpectedFixtureRequests).toEqual([]);
  expect(backend.blockedRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => globalThis.__unhandledRejections)).toEqual([]);
});
