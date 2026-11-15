const os = require("node:os");
const path = require("node:path");
const { baselineVersions, expectedGrantsAfterUpdate, readBaselines } = require("./firefox-install-consent");

const manifest = (dataCollection) => ({
  browser_specific_settings: { gecko: dataCollection ? { data_collection_permissions: dataCollection } : {} },
});

describe("signed Firefox update harness configuration", () => {
  afterEach(() => jest.restoreAllMocks());

  test("defaults to the 3.0.0.16, 3.0.0.18 and 4.0.6 baselines", () => {
    expect(baselineVersions(undefined)).toEqual(["3.0.0.16", "3.0.0.18", "4.0.6"]);
  });

  test("accepts a trimmed, de-duplicated comma-separated version list", () => {
    expect(baselineVersions(" 4.0.6 , 3.0.0.18,4.0.6")).toEqual(["4.0.6", "3.0.0.18"]);
  });

  test.each(["4.0.6;rm", "../4.0.6", ", ,"])("rejects an unusable version list %j", (value) => {
    expect(() => baselineVersions(value)).toThrow();
  });

  test("4.0.6 users keep their previously required categories except the logged-out identity grant", () => {
    expect(
      expectedGrantsAfterUpdate(
        manifest({
          required: ["personallyIdentifyingInfo", "browsingActivity", "websiteContent", "websiteActivity"],
          optional: ["authenticationInfo"],
        }),
      ),
    ).toEqual(["browsingActivity", "websiteActivity", "websiteContent"]);
  });

  test("3.x users declared no categories and receive no grants, so counts stay off", () => {
    expect(expectedGrantsAfterUpdate(manifest())).toEqual([]);
  });

  test("missing baseline packages are skipped with a clear message", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const directory = path.join(os.tmpdir(), "ryd-missing-signed-baselines-" + process.pid);
    const result = await readBaselines(directory, ["3.0.0.16", "4.0.6"]);
    expect(result.baselines).toEqual([]);
    expect(result.skipped.map((entry) => entry.version)).toEqual(["3.0.0.16", "4.0.6"]);
    expect(result.skipped[0]).toEqual({
      version: "3.0.0.16",
      filename: path.join(directory, "3.0.0.16.xpi"),
      reason: "Signed baseline package not found",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping baseline 3.0.0.16"));
  });
});
