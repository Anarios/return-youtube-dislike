/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");
jest.mock("./src/core-data-consent", () => ({
  FEATURE_DATA_PERMISSIONS: jest.requireActual("./src/core-data-consent").FEATURE_DATA_PERMISSIONS,
  hasFeaturePermission: jest.fn(),
  onDataPermissionsChanged: jest.fn(),
  requestFeaturePermission: jest.fn(),
}));
jest.mock("./src/private-browsing", () => ({ isPrivateBrowsingContext: jest.fn() }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Firefox feature permission page", () => {
  let permission;
  let permissionChanged;
  function openExplainer({
    privateBrowsing = false,
    feature = "voteOptIn",
    direction = "ltr",
    locale = "en",
    initialPermission = false,
  } = {}) {
    jest.resetModules();
    window.history.replaceState(null, "", `/?feature=${feature}${window.location.hash}`);
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "consent.html"), "utf8");
    const messages = require("./_locales/en/messages.json");
    global.chrome = {
      i18n: {
        getMessage: (key) => ({ "@@bidi_dir": direction, "@@ui_locale": locale })[key] || messages[key]?.message || key,
      },
      runtime: { sendMessage: jest.fn(async () => ({ success: true })) },
    };
    global.browser = global.chrome;
    permission = require("./src/core-data-consent");
    require("./src/private-browsing").isPrivateBrowsingContext.mockReturnValue(privateBrowsing);
    permission.hasFeaturePermission.mockResolvedValue(initialPermission);
    permission.onDataPermissionsChanged.mockImplementation((listener) => {
      permissionChanged = listener;
      return jest.fn();
    });
    permission.requestFeaturePermission.mockResolvedValue(false);
    require("./consent");
  }
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    openExplainer();
  });
  afterEach(() => {
    delete global.chrome;
    delete global.browser;
  });

  test("localizes the document, supports RTL and leaves explanations collapsed", () => {
    openExplainer({ direction: "rtl" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.innerHTML).not.toContain("__MSG_");
    expect(document.getElementById("permission-details").open).toBe(false);
  });

  test.each([
    ["pt_BR", "pt-BR"],
    ["zh_CN", "zh-CN"],
  ])("uses a valid language tag for the %s UI locale", (locale, tag) => {
    openExplainer({ locale });
    expect(document.documentElement.lang).toBe(tag);
  });

  test.each([
    ["voteOptIn", "consent_vote_title", "consent_vote_body"],
    ["reactions", "consent_vote_title", "consent_vote_body"],
    ["account", "consent_account_title", "consent_account_body"],
    ["posting", "consent_vote_title", "consent_vote_body"],
    ["constructor", "consent_vote_title", "consent_vote_body"],
  ])("the %s page shows its own explanation", (feature, title, body) => {
    openExplainer({ feature });
    expect(document.getElementById("consent-title").textContent).toBe(chrome.i18n.getMessage(title));
    expect(document.getElementById("consent-body").textContent).toBe(chrome.i18n.getMessage(body));
  });

  test("reading the five Firefox category explanations requests no permission", () => {
    expect(document.querySelectorAll("dt")).toHaveLength(5);
    document.querySelector("summary").click();
    expect(permission.requestFeaturePermission).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test("Read more links expand explanations without requesting permission", () => {
    window.history.replaceState(null, "", "/#permission-details");
    openExplainer();
    expect(document.getElementById("permission-details").open).toBe(true);
    expect(permission.requestFeaturePermission).not.toHaveBeenCalled();
  });

  test.each([
    ["voteOptIn", "voteOptIn"],
    ["reactions", "voteOptIn"],
    ["account", "account"],
  ])("the %s page requests only its %s categories directly from click", async (feature, requested) => {
    openExplainer({ feature });
    document.getElementById("consent-continue").click();
    expect(permission.requestFeaturePermission).toHaveBeenCalledTimes(1);
    expect(permission.requestFeaturePermission).toHaveBeenCalledWith(requested);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ message: "ryd_consent_prompt_state", pending: true });
    expect(permission.requestFeaturePermission.mock.invocationCallOrder[0]).toBeLessThan(
      browser.runtime.sendMessage.mock.invocationCallOrder[0],
    );
    await flush();
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith({
      message: "ryd_consent_prompt_state",
      pending: false,
    });
    expect(document.getElementById("consent-continue").disabled).toBe(false);
    expect(document.getElementById("consent-actions").hidden).toBe(false);
  });

  test("Not now requests nothing and leaves permission choices available", () => {
    document.getElementById("consent-decline").click();
    expect(permission.requestFeaturePermission).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById("consent-actions").hidden).toBe(false);
  });

  test("acceptance confirms the grant before completing", async () => {
    permission.requestFeaturePermission.mockResolvedValue(true);
    permission.hasFeaturePermission.mockResolvedValue(true);
    document.getElementById("consent-continue").click();
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(true);
  });

  test.each(["voteOptIn", "account"])(
    "refreshes reused %s permission pages after revocation and regrant",
    async (feature) => {
      openExplainer({ feature, initialPermission: true });
      await flush();
      expect(document.getElementById("consent-actions").hidden).toBe(true);
      permission.hasFeaturePermission.mockResolvedValue(false);
      const category = permission.FEATURE_DATA_PERMISSIONS[feature][0];
      permissionChanged({ added: [], removed: [category] });
      expect(document.getElementById("consent-actions").hidden).toBe(false);
      expect(document.getElementById("consent-status").textContent).not.toBe(
        chrome.i18n.getMessage("consent_granted_status"),
      );
      await flush();
      expect(document.getElementById("consent-continue").disabled).toBe(false);
      permission.hasFeaturePermission.mockResolvedValue(true);
      permissionChanged({ added: [category], removed: [] });
      await flush();
      expect(document.getElementById("consent-actions").hidden).toBe(true);
      expect(permission.requestFeaturePermission).not.toHaveBeenCalled();
    },
  );

  test("the vote page reports voting as on without the like count and ignores its revocation", async () => {
    openExplainer({ initialPermission: true });
    permission.hasFeaturePermission.mockImplementation(async (name) => name === "voting");
    await flush();
    permissionChanged({ added: [], removed: ["websiteContent"] });
    await flush();
    expect(permission.hasFeaturePermission).not.toHaveBeenCalledWith("voteOptIn");
    expect(document.getElementById("consent-actions").hidden).toBe(true);
    expect(document.getElementById("consent-status").textContent).toBe(
      chrome.i18n.getMessage("consent_granted_status"),
    );
  });

  test("a stale permission query cannot hide the actions after revocation", async () => {
    let finishInitial;
    openExplainer({ initialPermission: new Promise((resolve) => (finishInitial = resolve)) });
    permission.hasFeaturePermission.mockResolvedValue(false);
    permissionChanged({ added: [], removed: ["websiteActivity"] });
    finishInitial(true);
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(false);
    expect(document.getElementById("consent-status").textContent).not.toBe(
      chrome.i18n.getMessage("consent_granted_status"),
    );
  });

  test("revocation invalidates a delayed confirmation check after a native request", async () => {
    await flush();
    let finishConfirmation;
    permission.requestFeaturePermission.mockResolvedValue(true);
    permission.hasFeaturePermission.mockReturnValueOnce(new Promise((resolve) => (finishConfirmation = resolve)));
    document.getElementById("consent-continue").click();
    await flush();
    permission.hasFeaturePermission.mockResolvedValue(false);
    permissionChanged({ added: [], removed: ["websiteActivity"] });
    finishConfirmation(true);
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(false);
    expect(document.getElementById("consent-continue").disabled).toBe(false);
    expect(document.getElementById("consent-status").textContent).not.toBe(
      chrome.i18n.getMessage("consent_granted_status"),
    );
  });

  test("permission changes leave a pending native prompt undisturbed", async () => {
    await flush();
    let finishRequest;
    permission.requestFeaturePermission.mockReturnValue(new Promise((resolve) => (finishRequest = resolve)));
    document.getElementById("consent-continue").click();
    permission.hasFeaturePermission.mockResolvedValue(true);
    permissionChanged({ added: ["websiteActivity", "websiteContent"], removed: [] });
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(false);
    expect(document.getElementById("consent-continue").disabled).toBe(true);
    expect(document.getElementById("consent-status").textContent).toBe(chrome.i18n.getMessage("consent_prompt_status"));
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith({
      message: "ryd_consent_prompt_state",
      pending: true,
    });
    finishRequest(true);
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(true);
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith({
      message: "ryd_consent_prompt_state",
      pending: false,
    });
  });

  test("a private page offers no consent or persistence", async () => {
    openExplainer({ privateBrowsing: true });
    document.getElementById("consent-continue").click();
    document.getElementById("consent-decline").click();
    await flush();
    expect(document.getElementById("consent-actions").hidden).toBe(true);
    expect(document.getElementById("permission-details").hidden).toBe(true);
    expect(permission.hasFeaturePermission).not.toHaveBeenCalled();
    expect(permission.onDataPermissionsChanged).not.toHaveBeenCalled();
    expect(permission.requestFeaturePermission).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
