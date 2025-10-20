/**
 * @jest-environment jsdom
 */

jest.mock("../../config", () => ({
  getApiEndpoint: jest.fn((path) => `https://api.test${path}`),
}));

jest.mock("../../utils", () => ({
  getVideoId: jest.fn(),
}));

describe("premiumAnalytics.teaser", () => {
  let initPremiumTeaser;
  let setTeaserSuppressed;
  let getVideoId;

  function mountSecondary() {
    document.body.innerHTML = `
      <div id="columns">
        <div id="primary"></div>
        <div id="secondary">
          <div id="secondary-inner"></div>
        </div>
      </div>
    `;
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mountSecondary();

    ({ getVideoId } = require("../../utils"));
    ({ initPremiumTeaser, setTeaserSuppressed } = require("./index"));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          dislikes: 123,
          rawDislikes: 456,
          likes: 789,
        }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.fetch;
  });

  async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("renders the teaser panel with fetched dislike data", async () => {
    getVideoId.mockReturnValue("abcdefghijk");

    initPremiumTeaser();
    await flushPromises();

    const panel = document.querySelector(".ryd-premium-teaser");
    expect(panel).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith("https://api.test/votes?videoId=abcdefghijk", expect.any(Object));

    const raw = panel.querySelector("#ryd-premium-teaser-raw")?.textContent;
    const dislikes = panel.querySelector("#ryd-premium-teaser-dislikes")?.textContent;
    const likes = panel.querySelector("#ryd-premium-teaser-likes")?.textContent;

    expect(raw).toBe("456");
    expect(dislikes).toBe("123");
    expect(likes).toBe("789");
  });

  it("removes the panel when suppressed and restores it when unsuppressed", async () => {
    getVideoId.mockReturnValue("LMNOPQRSTUV");

    initPremiumTeaser();
    await flushPromises();
    expect(document.querySelector(".ryd-premium-teaser")).not.toBeNull();

    setTeaserSuppressed(true);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();

    setTeaserSuppressed(false);
    await flushPromises();
    expect(document.querySelector(".ryd-premium-teaser")).not.toBeNull();
  });

  it("skips rendering when a premium analytics panel is present", async () => {
    getVideoId.mockReturnValue("PREMIUM12345");
    const container = document.querySelector("#secondary-inner");
    const premium = document.createElement("section");
    premium.className = "ryd-premium-analytics";
    container.appendChild(premium);

    initPremiumTeaser();
    await flushPromises();

    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();
  });

  it("cleans up stray teaser panels even when already suppressed", async () => {
    getVideoId.mockReturnValue("ZXCVBNMASDF");

    initPremiumTeaser();
    await flushPromises();

    setTeaserSuppressed(true);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();

    const stray = document.createElement("section");
    stray.className = "ryd-premium-teaser";
    document.querySelector("#secondary-inner").appendChild(stray);

    setTeaserSuppressed(true);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();
  });

  it("displays an error message when the vote request fails", async () => {
    getVideoId.mockReturnValue("QWERTYUIOP1");
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    initPremiumTeaser();
    await flushPromises();

    const status = document.querySelector("#ryd-premium-teaser-status");
    expect(status?.textContent).toContain("could not load dislike data");
  });
});
