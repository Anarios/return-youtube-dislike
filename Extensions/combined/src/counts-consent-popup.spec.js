/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("optional Firefox counts activation", () => {
  let grants;
  let added;
  let removed;

  async function open({ categories = [], firefox = true, privateBrowsing = false } = {}) {
    jest.resetModules();
    document.body.className = "";
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, "../popup.html"), "utf8");
    grants = new Set(categories);
    added = [];
    removed = [];
    global.browser = global.chrome = {
      extension: { inIncognitoContext: privateBrowsing },
      runtime: { getManifest: () => (firefox ? require("../manifest-firefox.json") : {}) },
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
    delete global.browser;
    delete global.chrome;
  });

  test("explains missing counts consent without opening a native prompt", async () => {
    await open();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(false);
    expect(document.body.classList.contains("ryd-counts-consent-open")).toBe(true);
    expect(browser.permissions.request).not.toHaveBeenCalled();
  });

  test("requests only browsingActivity directly during the original click and activates on grant", async () => {
    await open();
    document.getElementById("ryd-counts-consent-allow").click();
    expect(browser.permissions.request).toHaveBeenCalledWith({ data_collection: ["browsingActivity"] });
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    await flush();
    expect(document.getElementById("ryd-counts-consent").hidden).toBe(true);
    expect([...grants]).toEqual(["browsingActivity"]);
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
