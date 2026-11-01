/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");
jest.mock("./src/core-data-consent", () => ({
  FEATURE_DATA_PERMISSIONS: jest.requireActual("./src/core-data-consent").FEATURE_DATA_PERMISSIONS,
  hasFeaturePermission: jest.fn(),
  onDataPermissionsChanged: jest.fn(),
  requestFeaturePermission: jest.fn(),
}));
jest.mock("./src/data-collection-permissions", () => ({ usesFirefoxDataCollectionConsent: jest.fn() }));
jest.mock("./src/private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const messages = require("./_locales/en/messages.json");
const text = (key) => messages[key].message;

describe("Firefox welcome opt-ins", () => {
  let permissions;
  let granted;
  let permissionListener;
  let storageListener;
  let sync;
  const byId = (id) => document.getElementById(id);

  async function open({ firefox = true, privateBrowsing = false, categories = [], switchOn = false } = {}) {
    jest.resetModules();
    jest.spyOn(document, "readyState", "get").mockReturnValue("complete");
    document.documentElement.innerHTML = fs.readFileSync(
      path.join(__dirname, "changelog/4/changelog_4.1.html"),
      "utf8",
    );
    sync = { disableVoteSubmission: switchOn };
    global.chrome = {
      i18n: { getMessage: (key) => messages[key]?.message || key },
      storage: {
        sync: { get: jest.fn((keys, callback) => callback({ ...sync })) },
        onChanged: { addListener: jest.fn((listener) => (storageListener = listener)) },
      },
    };
    granted = new Set(categories);
    permissions = require("./src/core-data-consent");
    permissions.hasFeaturePermission.mockImplementation(async (feature) =>
      permissions.FEATURE_DATA_PERMISSIONS[feature].every((category) => granted.has(category)),
    );
    permissions.requestFeaturePermission.mockResolvedValue(false);
    permissions.onDataPermissionsChanged.mockImplementation((listener) => {
      permissionListener = listener;
      return () => {};
    });
    require("./src/data-collection-permissions").usesFirefoxDataCollectionConsent.mockReturnValue(firefox);
    require("./src/private-browsing").isPrivateBrowsingContext.mockReturnValue(privateBrowsing);
    require("./ryd.changelog");
    await flush();
  }

  function grantOnRequest(categories) {
    permissions.requestFeaturePermission.mockImplementation(async () => {
      categories.forEach((category) => granted.add(category));
      return true;
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
  });

  test("without counts the hero says counts are off and both opt-ins wait for a click", async () => {
    await open();
    expect(byId("ryd-firefox-optin").hidden).toBe(false);
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow_counts_off"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body_counts_off"));
    expect(byId("ryd-firefox-counts-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-counts-status").textContent).toBe("");
    expect(byId("ryd-firefox-vote-status").textContent).toBe("");
    expect(permissions.requestFeaturePermission).not.toHaveBeenCalled();
  });

  test("enabling counts requests browsing activity in the click and updates the hero", async () => {
    await open();
    grantOnRequest(["browsingActivity"]);
    byId("ryd-firefox-counts-allow").click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledTimes(1);
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith("counts");
    expect(byId("ryd-firefox-counts-allow").disabled).toBe(true);
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body"));
    expect(byId("ryd-firefox-counts-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-counts-status").textContent).toBe(text("counts_consent_enabled"));
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-vote-status").textContent).toBe("");
    expect(byId("ryd-firefox-counts-allow").disabled).toBe(false);
  });

  test("enabling votes also requests counts and reports both only after the grant", async () => {
    await open();
    grantOnRequest(["browsingActivity", "websiteActivity", "websiteContent"]);
    byId("ryd-firefox-vote-allow").click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith("voteOptIn");
    expect(permissions.FEATURE_DATA_PERMISSIONS.voteOptIn).toContain("browsingActivity");
    await flush();
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-vote-status").textContent).toBe(text("changelog_firefox_vote_granted"));
    expect(byId("ryd-firefox-counts-status").textContent).toBe(text("counts_consent_enabled"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body"));
  });

  test.each([
    ["counts", "ryd-firefox-counts", "counts_consent_declined"],
    ["voteOptIn", "ryd-firefox-vote", "changelog_firefox_vote_declined"],
  ])("declining %s keeps the offer and claims nothing", async (feature, id, declined) => {
    await open();
    byId(`${id}-allow`).click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith(feature);
    await flush();
    expect(byId(`${id}-actions`).hidden).toBe(false);
    expect(byId(`${id}-status`).textContent).toBe(text(declined));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body_counts_off"));
    expect(byId(`${id}-allow`).disabled).toBe(false);
  });

  test("voting without the like count is reported as on", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity"] });
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-vote-status").textContent).toBe(text("changelog_firefox_vote_granted"));
    expect(byId("ryd-firefox-counts-status").textContent).toBe(text("counts_consent_enabled"));
  });

  test("revoking only the like count keeps voting reported as on", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity", "websiteContent"] });
    granted.delete("websiteContent");
    permissionListener({ added: [], removed: ["websiteContent"] });
    await flush();
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-vote-status").textContent).toBe(text("changelog_firefox_vote_granted"));
  });

  test("grants and revocations made elsewhere refresh the page", async () => {
    await open();
    granted.add("browsingActivity");
    permissionListener({ added: ["browsingActivity"], removed: [] });
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
    granted.delete("browsingActivity");
    permissionListener({ added: [], removed: ["browsingActivity"] });
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow_counts_off"));
    expect(byId("ryd-firefox-counts-actions").hidden).toBe(false);
  });

  test.each([[[]], [["browsingActivity", "websiteActivity", "websiteContent"]]])(
    "the vote offer stays hidden while like/dislike submission is disabled: %j",
    async (categories) => {
      await open({ categories, switchOn: true });
      expect(byId("ryd-firefox-optin").hidden).toBe(false);
      expect(byId("ryd-firefox-vote").hidden).toBe(true);
      expect(byId("ryd-firefox-counts-title").closest("section").hidden).toBe(false);
      expect(permissions.requestFeaturePermission).not.toHaveBeenCalled();
    },
  );

  test("switching like/dislike submission elsewhere updates the vote offer", async () => {
    await open({ switchOn: true });
    sync.disableVoteSubmission = false;
    storageListener({ disableVoteSubmission: { oldValue: true, newValue: false } }, "sync");
    await flush();
    expect(byId("ryd-firefox-vote").hidden).toBe(false);
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(false);
    sync.disableVoteSubmission = true;
    storageListener({ disableVoteSubmission: { oldValue: false, newValue: true } }, "sync");
    await flush();
    expect(byId("ryd-firefox-vote").hidden).toBe(true);
    sync.disableVoteSubmission = false;
    storageListener({ disableVoteSubmission: { oldValue: true, newValue: false } }, "local");
    await flush();
    expect(byId("ryd-firefox-vote").hidden).toBe(true);
  });

  test("existing grants need no further request", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity", "websiteContent"] });
    expect(byId("ryd-firefox-counts-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-vote-actions").hidden).toBe(true);
    expect(permissions.requestFeaturePermission).not.toHaveBeenCalled();
  });

  test.each([{ firefox: false }, { privateBrowsing: true }])(
    "keeps the standard page outside normal Firefox: %j",
    async (options) => {
      await open(options);
      expect(byId("ryd-firefox-optin").hidden).toBe(true);
      expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
      expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body"));
      expect(permissions.hasFeaturePermission).not.toHaveBeenCalled();
      expect(permissions.requestFeaturePermission).not.toHaveBeenCalled();
    },
  );
});
