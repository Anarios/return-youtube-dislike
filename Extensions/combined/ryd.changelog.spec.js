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
const VOTE_OPT_IN = ["browsingActivity", "websiteActivity", "websiteContent"];

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

  test("without counts the hero says counts are off and one combined opt-in waits for a click", async () => {
    await open();
    expect(byId("ryd-firefox-optin").hidden).toBe(false);
    expect(byId("ryd-firefox-intro-title").textContent.trim()).toBe(text("changelog_firefox_intro_title"));
    expect(byId("ryd-firefox-intro-title").nextElementSibling.textContent).toBe(text("changelog_firefox_intro_body"));
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow_counts_off"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body_counts_off"));
    expect(byId("ryd-firefox-consent-title").textContent).toBe(text("data_consent_title"));
    const scope = byId("ryd-firefox-consent-title").nextElementSibling;
    expect(scope.textContent).toBe(text("data_consent_scope"));
    expect(scope.nextElementSibling.textContent).toBe(text("data_consent_body"));
    expect(
      [...document.querySelectorAll("#ryd-firefox-consent-permissions dt")].map((term) => term.textContent),
    ).toEqual(["consent_browsing_label", "consent_activity_label", "consent_content_label"].map(text));
    expect(byId("ryd-firefox-consent-permissions").nextElementSibling.textContent).toBe(text("consent_settings"));
    expect(byId("ryd-firefox-consent-allow").textContent.trim()).toBe(text("consent_allow"));
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-consent-status").textContent).toBe("");
    expect(document.querySelectorAll("#ryd-firefox-optin button")).toHaveLength(1);
    expect(permissions.requestFeaturePermission).not.toHaveBeenCalled();
  });

  test("allowing requests counts and vote sharing in the click and reports that votes count", async () => {
    await open();
    grantOnRequest(VOTE_OPT_IN);
    byId("ryd-firefox-consent-allow").click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledTimes(1);
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith("voteOptIn");
    expect(byId("ryd-firefox-consent-allow").disabled).toBe(true);
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body"));
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("changelog_firefox_vote_granted"));
    expect(byId("ryd-firefox-consent-allow").disabled).toBe(false);
  });

  test("with the switch on, allowing reports counts as enabled and never touches the switch", async () => {
    await open({ switchOn: true });
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    grantOnRequest(VOTE_OPT_IN);
    byId("ryd-firefox-consent-allow").click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith("voteOptIn");
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("counts_consent_enabled"));
    expect(sync.disableVoteSubmission).toBe(true);
    expect(chrome.storage.sync.set).toBeUndefined();
  });

  test("declining keeps the offer and claims nothing", async () => {
    await open();
    byId("ryd-firefox-consent-allow").click();
    expect(permissions.requestFeaturePermission).toHaveBeenCalledWith("voteOptIn");
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("consent_declined_status"));
    expect(byId("ryd-hero-body").textContent).toBe(text("changelog_hero_body_counts_off"));
    expect(byId("ryd-firefox-consent-allow").disabled).toBe(false);
  });

  test("a failed request reports the error and allows another try", async () => {
    await open();
    permissions.requestFeaturePermission.mockRejectedValue(new Error("prompt failed"));
    byId("ryd-firefox-consent-allow").click();
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("consent_error_status"));
    expect(byId("ryd-firefox-consent-allow").disabled).toBe(false);
  });

  test("counts without vote sharing keep the offer while the switch is off", async () => {
    await open({ categories: ["browsingActivity"] });
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-consent-status").textContent).toBe("");
  });

  test("counts without vote sharing are enough while the switch is on", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("counts_consent_enabled"));
  });

  test("voting without the like count is reported as counting", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity"] });
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("changelog_firefox_vote_granted"));
  });

  test("revoking only the like count keeps votes reported as counting", async () => {
    await open({ categories: VOTE_OPT_IN });
    granted.delete("websiteContent");
    permissionListener({ added: [], removed: ["websiteContent"] });
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("changelog_firefox_vote_granted"));
  });

  test("grants and revocations made elsewhere refresh the page and clear an earlier decline", async () => {
    await open();
    byId("ryd-firefox-consent-allow").click();
    await flush();
    expect(byId("ryd-firefox-consent-status").textContent).toBe(text("consent_declined_status"));
    granted.add("browsingActivity");
    granted.add("websiteActivity");
    permissionListener({ added: ["browsingActivity", "websiteActivity"], removed: [] });
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow"));
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    granted.clear();
    permissionListener({ added: [], removed: ["browsingActivity", "websiteActivity"] });
    await flush();
    expect(byId("ryd-hero-eyebrow").textContent).toBe(text("changelog_hero_eyebrow_counts_off"));
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    expect(byId("ryd-firefox-consent-status").textContent).toBe("");
  });

  test("switching like/dislike submission elsewhere updates the offer", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
    sync.disableVoteSubmission = false;
    storageListener({ disableVoteSubmission: { oldValue: true, newValue: false } }, "sync");
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
    sync.disableVoteSubmission = true;
    storageListener({ disableVoteSubmission: { oldValue: false, newValue: true } }, "local");
    await flush();
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(false);
  });

  test("existing grants need no further request", async () => {
    await open({ categories: VOTE_OPT_IN });
    expect(byId("ryd-firefox-consent-actions").hidden).toBe(true);
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
