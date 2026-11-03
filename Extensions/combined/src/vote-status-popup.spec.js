/** @jest-environment jsdom */
const fs = require("node:fs");
const path = require("node:path");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("popup notice when likes and dislikes are not counted", () => {
  let grants;
  let sync;
  let storageListeners;
  let added;
  let removed;
  let decline;
  let failRequest;

  const card = () => document.getElementById("ryd-vote-status");
  const action = () => document.getElementById("ryd-vote-status-action");
  const result = () => document.getElementById("ryd-vote-status-result");

  async function open({
    categories = [],
    firefox = true,
    switchOn = false,
    privateBrowsing = false,
    toolbar = false,
  } = {}) {
    jest.resetModules();
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, "../popup.html"), "utf8");
    grants = new Set(categories);
    sync = { disableVoteSubmission: switchOn };
    storageListeners = [];
    added = [];
    removed = [];
    decline = false;
    failRequest = false;
    global.browser = global.chrome = {
      extension: { inIncognitoContext: privateBrowsing, getViews: () => (toolbar ? [window] : []) },
      runtime: {
        getManifest: () => (firefox ? require("../manifest-firefox.json") : {}),
        getURL: (file) => `moz-extension://fixture/${file}`,
        sendMessage: jest.fn(async () => ({ success: true })),
      },
      tabs: { create: jest.fn(async () => ({ id: 9 })) },
      i18n: { getMessage: (key) => key },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({ ...sync })),
          set: jest.fn((values) => {
            const changes = Object.fromEntries(
              Object.entries(values).map(([key, newValue]) => [key, { oldValue: sync[key], newValue }]),
            );
            Object.assign(sync, values);
            storageListeners.forEach((listener) => listener(changes, "sync"));
          }),
        },
        onChanged: {
          addListener: (listener) => storageListeners.push(listener),
          removeListener: jest.fn(),
        },
      },
      permissions: {
        getAll: jest.fn(async () => ({ data_collection: [...grants] })),
        request: jest.fn(async ({ data_collection }) => {
          if (failRequest) throw new Error("prompt failed");
          if (decline) return false;
          data_collection.forEach((value) => grants.add(value));
          added.forEach((listener) => listener({ data_collection }));
          return true;
        }),
        onAdded: { addListener: (listener) => added.push(listener), removeListener: jest.fn() },
        onRemoved: { addListener: (listener) => removed.push(listener), removeListener: jest.fn() },
      },
    };
    require("./vote-status-popup").initVoteStatusPopup();
    await flush();
  }

  afterEach(() => {
    jest.restoreAllMocks();
    history.replaceState({}, "", "/");
    delete global.browser;
    delete global.chrome;
  });

  test.each([
    ["Chrome with the switch off", true, { firefox: false }],
    ["Chrome with the switch on", false, { firefox: false, switchOn: true }],
    ["Firefox with vote sharing allowed", true, { categories: ["browsingActivity", "websiteActivity"] }],
    ["Firefox without vote sharing", false, { categories: ["browsingActivity"] }],
    [
      "Firefox with sharing allowed and the switch on",
      false,
      { categories: ["browsingActivity", "websiteActivity"], switchOn: true },
    ],
  ])("%s: notice hidden is %s", async (_, hidden, options) => {
    await open(options);
    expect(card().hidden).toBe(hidden);
    expect(browser.permissions.request).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test("on Chrome the button turns the switch off and the notice goes away", async () => {
    await open({ firefox: false, switchOn: true });
    action().click();
    await flush();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: false });
    expect(browser.permissions.request).not.toHaveBeenCalled();
    expect(card().hidden).toBe(true);
  });

  test("on Firefox the button asks for vote sharing during the click and hides the notice once allowed", async () => {
    await open({ categories: ["browsingActivity"] });
    action().click();
    expect(browser.permissions.request).toHaveBeenCalledWith({
      data_collection: ["browsingActivity", "websiteActivity", "websiteContent"],
    });
    expect(result().textContent).toBe("consent_prompt_status");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    await flush();
    expect(card().hidden).toBe(true);
    expect(result().textContent).toBe("");
  });

  test("in the toolbar popup the button asks during the click, then closes so Firefox's prompt is visible", async () => {
    await open({ categories: ["browsingActivity"], toolbar: true });
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    action().click();
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(browser.permissions.request.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test("a declined Firefox prompt keeps the notice and allows another try", async () => {
    await open({ categories: ["browsingActivity"] });
    decline = true;
    action().click();
    await flush();
    expect(card().hidden).toBe(false);
    expect(result().textContent).toBe("consent_declined_status");
    expect(action().disabled).toBe(false);
  });

  test("in the toolbar popup with the switch on, the button asks, records the switch intent, then closes", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true, toolbar: true });
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    action().click();
    expect(browser.permissions.request).toHaveBeenCalledWith({
      data_collection: ["browsingActivity", "websiteActivity", "websiteContent"],
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_vote_switch_on_grant" });
    expect(close).toHaveBeenCalledTimes(1);
    const [request] = browser.permissions.request.mock.invocationCallOrder;
    const [intent] = chrome.runtime.sendMessage.mock.invocationCallOrder;
    expect(request).toBeLessThan(intent);
    expect(intent).toBeLessThan(close.mock.invocationCallOrder[0]);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    await flush();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test("with the switch on in a tab, the popup records the intent and leaves the switch to the background", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    action().click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_vote_switch_on_grant" });
    expect(result().textContent).toBe("consent_prompt_status");
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(card().hidden).toBe(false);
    expect(result().textContent).toBe("");
    chrome.storage.sync.set({ disableVoteSubmission: false });
    await flush();
    expect(card().hidden).toBe(true);
  });

  test("with the switch off the button records no switch intent", async () => {
    await open({ categories: ["browsingActivity"], toolbar: true });
    jest.spyOn(window, "close").mockImplementation(() => {});
    action().click();
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test("with vote sharing already allowed the button turns the switch off directly", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity"], switchOn: true, toolbar: true });
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    action().click();
    await flush();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: false });
    expect(browser.permissions.request).not.toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(card().hidden).toBe(true);
  });

  test("a rejected intent message does not block the prompt", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    chrome.runtime.sendMessage.mockRejectedValueOnce(new Error("Background unavailable"));
    action().click();
    await flush();
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    expect(action().disabled).toBe(false);
  });

  test("declining the prompt keeps the switch on when both block counting", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    decline = true;
    action().click();
    await flush();
    expect(chrome.runtime.sendMessage.mock.calls).toEqual([
      [{ message: "ryd_vote_switch_on_grant" }],
      [{ message: "ryd_vote_switch_on_grant", withdraw: true }],
    ]);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(sync.disableVoteSubmission).toBe(true);
    expect(card().hidden).toBe(false);
    expect(result().textContent).toBe("consent_declined_status");
  });

  test("a second click while the prompt is open is ignored", async () => {
    await open({ categories: ["browsingActivity"] });
    action().click();
    expect(action().disabled).toBe(true);
    action().click();
    expect(browser.permissions.request).toHaveBeenCalledTimes(1);
    await flush();
    expect(action().disabled).toBe(false);
  });

  test("a failed prompt counts as declined and allows another try", async () => {
    await open({ categories: ["browsingActivity"], switchOn: true });
    failRequest = true;
    action().click();
    await flush();
    expect(result().textContent).toBe("consent_declined_status");
    expect(action().disabled).toBe(false);
    expect(card().hidden).toBe(false);
    expect(sync.disableVoteSubmission).toBe(true);
  });

  test("removing vote sharing while the popup is open shows the notice again", async () => {
    await open({ categories: ["browsingActivity", "websiteActivity"] });
    expect(card().hidden).toBe(true);
    grants.delete("websiteActivity");
    removed.forEach((listener) => listener({ data_collection: ["websiteActivity"] }));
    await flush();
    expect(card().hidden).toBe(false);
  });

  test("turning the switch on elsewhere shows the notice while the popup is open", async () => {
    await open({ firefox: false });
    chrome.storage.sync.set({ disableVoteSubmission: true });
    await flush();
    expect(card().hidden).toBe(false);
  });

  test("closing the popup removes its listeners", async () => {
    await open({ categories: ["browsingActivity"] });
    window.dispatchEvent(new Event("unload"));
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(storageListeners[0]);
    expect(browser.permissions.onAdded.removeListener).toHaveBeenCalledWith(added[0]);
    expect(browser.permissions.onRemoved.removeListener).toHaveBeenCalledWith(removed[0]);
  });

  test("private windows show no notice and read nothing", async () => {
    await open({ privateBrowsing: true });
    expect(card().hidden).toBe(true);
    expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    expect(browser.permissions.getAll).not.toHaveBeenCalled();
  });
});
