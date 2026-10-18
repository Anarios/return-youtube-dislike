import { isFirefoxExtension, isPrivateBrowsingContext, isNormalMessageSender } from "./private-browsing";

afterEach(() => {
  delete global.browser;
  delete global.chrome;
});

test("background routing uses browser tab privacy metadata", () => {
  const api = { runtime: { id: "fixture", getManifest: () => ({ browser_specific_settings: { gecko: {} } }) } };
  expect(isNormalMessageSender(api, { id: "fixture", tab: { incognito: false } })).toBe(true);
  expect(isNormalMessageSender(api, { id: "fixture", tab: { incognito: true } })).toBe(false);
  expect(isNormalMessageSender(api, { id: "fixture", tab: {} })).toBe(false);
  expect(isNormalMessageSender(api, { id: "foreign", tab: { incognito: false } })).toBe(false);
});

test("Firefox popup routing requires a distinct live normal view", () => {
  const url = "moz-extension://fixture/popup.html?rydContext=synthetic-view";
  const view = { location: { href: url }, browser: { extension: { inIncognitoContext: false } } };
  const api = {
    runtime: { id: "fixture", getManifest: () => ({ browser_specific_settings: { gecko: {} } }) },
    extension: { getViews: jest.fn(() => [view]) },
  };
  const sender = { id: "fixture", url };
  expect(isNormalMessageSender(api, sender)).toBe(true);
  expect(isNormalMessageSender(api, { ...sender, url: "moz-extension://fixture/popup.html" })).toBe(false);
  view.browser.extension.inIncognitoContext = true;
  expect(isNormalMessageSender(api, sender)).toBe(false);
  api.extension.getViews.mockReturnValue([]);
  expect(isNormalMessageSender(api, sender)).toBe(false);
});

test("private display mode is limited to Firefox private contexts", () => {
  global.browser = {
    runtime: { getManifest: () => ({ browser_specific_settings: { gecko: {} } }) },
    extension: { inIncognitoContext: true },
  };
  expect(isFirefoxExtension()).toBe(true);
  expect(isPrivateBrowsingContext()).toBe(true);
  browser.extension.inIncognitoContext = false;
  expect(isPrivateBrowsingContext()).toBe(false);
  browser.extension.inIncognitoContext = true;
  browser.runtime.getManifest = () => ({ manifest_version: 3 });
  expect(isPrivateBrowsingContext()).toBe(false);
});
