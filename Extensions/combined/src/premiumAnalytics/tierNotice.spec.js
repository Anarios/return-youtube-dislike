/** @jest-environment jsdom */

const messages = require("../../_locales/en/messages.json");

describe("premiumAnalytics.tierNotice", () => {
  let showTierNotice;
  let hideTierNotice;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="secondary"><div id="secondary-inner"></div></div>';
    global.chrome = { i18n: { getMessage: (key) => messages[key]?.message || "" } };
    ({ showTierNotice, hideTierNotice } = require("./tierNotice"));
  });

  afterEach(() => {
    hideTierNotice();
    document.body.innerHTML = "";
    delete global.chrome;
  });

  test("explains why paid features exist between the upgrade message and the call to action", () => {
    showTierNotice();

    const message = document.querySelector(".ryd-premium-tier-notice__message");
    const why = message.nextElementSibling;
    expect(why.className).toBe("ryd-premium-tier-notice__why");
    expect(why.textContent).toBe(messages.paidFeaturesWhy.message);
    expect(why.nextElementSibling.className).toBe("ryd-premium-tier-notice__actions");
  });

  test("removes the notice when hidden", () => {
    showTierNotice();
    hideTierNotice();

    expect(document.querySelector(".ryd-premium-tier-notice")).toBeNull();
  });
});
