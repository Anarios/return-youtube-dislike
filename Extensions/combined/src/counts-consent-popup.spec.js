/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const VOTE_OPT_IN = ["browsingActivity", "websiteActivity", "websiteContent"];

describe("combined Firefox data consent card in the popup", () => {
  let grants;
  let added;
  let removed;

  async function open({ categories = [], firefox = true, privateBrowsing = false, toolbar = false } = {}) {
    jest.resetModules();
    document.body.className = "";
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, "../popup.html"), "utf8");
    grants = new Set(categories);
    added = [];
    removed = [];
    global.browser = global.chrome = {
      extension: { inIncognitoContext: privateBrowsing, getViews: () => (toolbar ? [window] : []) },
      runtime: {
        getManifest: () => (firefox ? require("../manifest-firefox.json") : {}),
        sendMessage: jest.fn(async () => ({ success: true })),
      },
      i18n: { getMessage: (key) => key },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...grants] })),
        request: jest.fn(async ({ data_collection }) => {
          data_collection.forEach((value) => grants.add(value));
          added.forEach((listener) => listener({ data_collection }));
          return true;
        }),
        onAdded: { addListener: (listener) => added.push(listener), removeListener: jest.fn() },
        onRemoved: { addListener: (listener) => removed.push(listener), removeListener: jest.fn() },
      },
    };
    require("./counts-consent-popup").initCountsConsentPopup();
    await flush();
  }

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.browser;
    delete global.chrome;
  });

  test("explains missing counts consent without opening a native prompt", async () => {
    await open();
    const section = document.getElementById("ryd-counts-consent");
    expect(section.hidden).toBe(false);
    expect(section.querySelector("h2").textContent).toBe("__MSG_data_consent_title__");
    expect(document.getElementById("ryd-counts-consent-description").textContent).toBe("__MSG_data_consent_body__");
    expect(document.getElementById("ryd-counts-consent-allow").textContent.trim()).toBe("__MSG_consent_allow__");
    expect(document.getElementById("ryd-counts-consent-dismiss").textContent.trim()).toBe("__MSG_consent_not_now__");
    expect(document.body.classList.contains("ryd-counts-consent-open")).toBe(true);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test("requests counts and vote sharing together during the original click and activates on grant", async () => {
    await open();
    document.getElementById("ryd-counts-consent-allow").click();
    expect(browser.permissions.request).toHaveBeenCalledWith({ data_collection: VOTE_OPT_IN });
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
    expect([...grants]).toEqual(VOTE_OPT_IN);
  });

  test("closes the toolbar popup right after asking so it cannot cover Firefox's prompt", async () => {
    await open({ toolbar: true });
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    document.getElementById("ryd-counts-consent-allow").click();
    expect(browser.permissions.request).toHaveBeenCalledWith({ data_collection: VOTE_OPT_IN });
    expect(close).toHaveBeenCalledTimes(1);
    expect(browser.permissions.request.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  });

  test("keeps the popup page open while Firefox asks when it runs in a tab", async () => {
    await open();
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    document.getElementById("ryd-counts-consent-allow").click();
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(document.getElementById("ryd-counts-consent-status").textContent).toBe("counts_consent_enabled");
  });

  test("decline stays quiet and allows an explicit retry", async () => {
    await open();
    browser.permissions.request.mockResolvedValueOnce(false);
    const allow = document.getElementById("ryd-counts-consent-allow");
    allow.click();
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(false);
    expect(document.getElementById("ryd-counts-consent-status").textContent).toBe("counts_consent_declined");
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    expect(allow.disabled).toBe(false);
    allow.click();
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
  });

  test("Not now dismisses this popup visit without requesting or revoking anything", async () => {
    await open();
    document.getElementById("ryd-counts-consent-dismiss").click();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
    expect(document.body.classList.contains("ryd-counts-consent-open")).toBe(false);
    expect(browser.permissions.request).not.toHaveBeenCalled();
    expect([...grants]).toEqual([]);
  });

  test("the card never writes the like and dislike submission switch and withdraws a vote card intent", async () => {
    await open({ toolbar: true });
    jest.spyOn(window, "close").mockImplementation(() => {});
    browser.storage = { sync: { set: jest.fn() } };
    document.getElementById("ryd-counts-consent-allow").click();
    await flush();
    expect(browser.storage.sync.set).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage.mock.calls).toEqual([[{ message: "ryd_vote_switch_on_grant", withdraw: true }]]);
    const [request] = browser.permissions.request.mock.invocationCallOrder;
    expect(request).toBeLessThan(browser.runtime.sendMessage.mock.invocationCallOrder[0]);
  });

  test("stays hidden when counts are already on even if vote sharing is off", async () => {
    await open({ categories: ["browsingActivity"] });
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test.each([{ categories: ["browsingActivity"] }, { firefox: false }, { privateBrowsing: true }])(
    "leaves existing-grant, other-browser and private popups unchanged: %j",
    async (options) => {
      await open(options);
      expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
      expect(browser.permissions.request).not.toHaveBeenCalled();
    },
  );

  test("an external grant hides the explainer and revocation makes activation available again", async () => {
    await open();
    grants.add("browsingActivity");
    added.forEach((listener) => listener({ data_collection: ["browsingActivity"] }));
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
    grants.delete("browsingActivity");
    removed.forEach((listener) => listener({ data_collection: ["browsingActivity"] }));
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(false);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });
});
