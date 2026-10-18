/**
 * @jest-environment jsdom
 */

jest.mock("../../config", () => ({
  getApiEndpoint: jest.fn((path) => `https://api.test${path}`),
  getChangelogUrl: jest.fn(() => "moz-extension://unit-test/changelog/4/changelog_4.0.html"),
}));

jest.mock("../../utils", () => {
  const actual = jest.requireActual("../../utils");
  return {
    ...actual,
    getVideoId: jest.fn(),
  };
});

const enMessages = require("../../../_locales/en/messages.json");

function getMessage(key, substitutions) {
  const entry = enMessages[key];
  if (!entry) {
    return key;
  }
  let message = entry.message ?? "";
  if (substitutions == null) {
    return message;
  }
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  values.forEach((value, index) => {
    const replacement = value != null ? `${value}` : "";
    message = message.replace(new RegExp(`\\$${index + 1}`, "g"), replacement);
  });
  return message;
}

describe("premiumAnalytics.teaser", () => {
  let initPremiumTeaser;
  let setTeaserSuppressed;
  let getVideoId;
  let TEASER_SUPPRESSION_REASON_SETTINGS;
  let TEASER_SUPPRESSION_REASON_PREMIUM;
  let requestVoteData;
  let storageGetMock;
  let storageSetMock;
  let storageOnChangedAddListener;

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
    storageGetMock = jest.fn((keys, callback) => {
      callback({ hidePremiumTeaser: false });
    });
    storageSetMock = jest.fn((values, callback) => {
      if (typeof callback === "function") {
        callback();
      }
    });
    storageOnChangedAddListener = jest.fn();
    global.chrome = {
      i18n: {
        getMessage,
      },
      runtime: {},
      storage: {
        sync: {
          get: storageGetMock,
          set: storageSetMock,
        },
        onChanged: {
          addListener: storageOnChangedAddListener,
        },
      },
    };

    ({ getVideoId } = require("../../utils"));
    ({ requestVoteData } = require("../../vote-data-request"));
    ({
      initPremiumTeaser,
      setTeaserSuppressed,
      TEASER_SUPPRESSION_REASON_SETTINGS,
      TEASER_SUPPRESSION_REASON_PREMIUM,
    } = require("./index"));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          dislikes: 123,
          rawDislikes: 456,
          likes: 789,
          rawLikes: 654,
        }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.fetch;
    delete global.chrome;
  });

  async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("renders the teaser panel with fetched dislike data", async () => {
    getVideoId.mockReturnValue("abcdefghijk");

    await initPremiumTeaser();
    await flushPromises();

    const panel = document.querySelector(".ryd-premium-teaser");
    expect(panel).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith("https://api.test/votes?videoId=abcdefghijk", expect.any(Object));

    const likes = panel.querySelector("#ryd-premium-teaser-likes")?.textContent;
    const dislikes = panel.querySelector("#ryd-premium-teaser-dislikes")?.textContent;
    const details = panel.querySelector("#ryd-premium-teaser-details");

    expect(likes).toBe("654");
    expect(dislikes).toBe("456");
    expect(panel?.classList.contains("is-collapsed")).toBe(true);
    expect(details?.hasAttribute("hidden")).toBe(true);
  });

  it("shares aggregate vote data with the main renderer but still refreshes for a real Like count", async () => {
    getVideoId.mockReturnValue("abcdefghijk");

    await initPremiumTeaser();
    await flushPromises();

    await requestVoteData("abcdefghijk", { likeCount: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("https://api.test/votes?videoId=abcdefghijk", expect.any(Object));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dislikes: 124, likes: 790 }),
    });
    await requestVoteData("abcdefghijk", { likeCount: 790 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      "https://api.test/votes?videoId=abcdefghijk&likeCount=790",
      expect.any(Object),
    );
  });

  it.each([true, false])(
    "does not restart an outgoing request when the panel mounts late (navigation event: %s)",
    async (navigationEventDelivered) => {
      jest.useFakeTimers();
      const navigationListenerSpy = jest.spyOn(document, "addEventListener");
      let resolveResponse;
      const destinationResponse = {
        ok: true,
        json: async () => ({ dislikes: 35, likes: 65 }),
      };

      try {
        document.body.innerHTML = "";
        getVideoId.mockReturnValue("abcdefghijk");
        await initPremiumTeaser();
        expect(global.fetch).not.toHaveBeenCalled();

        getVideoId.mockReturnValue("zyxwvutsrqp");
        if (navigationEventDelivered) {
          const navigationListener = navigationListenerSpy.mock.calls.find(
            ([name]) => name === "yt-navigate-finish",
          )[1];
          navigationListener();
        }

        global.fetch.mockReturnValueOnce(
          new Promise((resolve) => {
            resolveResponse = resolve;
          }),
        );
        const destinationRequest = requestVoteData("zyxwvutsrqp", { likeCount: 65 });
        destinationRequest.catch(() => {});

        mountSecondary();
        jest.advanceTimersByTime(500);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.test/votes?videoId=zyxwvutsrqp&likeCount=65",
          expect.any(Object),
        );
        expect(requestVoteData("zyxwvutsrqp", { likeCount: 65 })).toBe(destinationRequest);

        resolveResponse(destinationResponse);
        await expect(destinationRequest).resolves.toEqual({ dislikes: 35, likes: 65 });
      } finally {
        resolveResponse?.(destinationResponse);
        navigationListenerSpy.mockRestore();
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    },
  );

  it("toggles the expanded state when the toggle is clicked", async () => {
    getVideoId.mockReturnValue("togglevideo");

    await initPremiumTeaser();
    await flushPromises();

    const panel = document.querySelector(".ryd-premium-teaser");
    expect(panel).not.toBeNull();

    const toggle = panel.querySelector("#ryd-premium-teaser-toggle");
    const details = panel.querySelector("#ryd-premium-teaser-details");

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(details?.hasAttribute("hidden")).toBe(true);

    toggle?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flushPromises();

    expect(panel?.classList.contains("is-expanded")).toBe(true);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(details?.hasAttribute("hidden")).toBe(false);
  });

  it("removes the panel when suppressed and restores it when unsuppressed", async () => {
    getVideoId.mockReturnValue("LMNOPQRSTUV");

    await initPremiumTeaser();
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

    await initPremiumTeaser();
    await flushPromises();

    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();
  });

  it("cleans up stray teaser panels even when already suppressed", async () => {
    getVideoId.mockReturnValue("ZXCVBNMASDF");

    await initPremiumTeaser();
    await flushPromises();

    setTeaserSuppressed(true);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();

    const stray = document.createElement("section");
    stray.className = "ryd-premium-teaser";
    document.querySelector("#secondary-inner").appendChild(stray);

    setTeaserSuppressed(true);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();
  });

  it("keeps the teaser hidden while the settings suppression is active", async () => {
    getVideoId.mockReturnValue("SETTI123456");

    await initPremiumTeaser();
    await flushPromises();
    expect(document.querySelector(".ryd-premium-teaser")).not.toBeNull();

    setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_SETTINGS);
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();

    setTeaserSuppressed(true, TEASER_SUPPRESSION_REASON_PREMIUM);
    setTeaserSuppressed(false, TEASER_SUPPRESSION_REASON_PREMIUM);
    await flushPromises();
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();

    setTeaserSuppressed(false, TEASER_SUPPRESSION_REASON_SETTINGS);
    await flushPromises();
    expect(document.querySelector(".ryd-premium-teaser")).not.toBeNull();
  });

  it("displays an error message when the vote request fails", async () => {
    getVideoId.mockReturnValue("QWERTYUIOP1");
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    await initPremiumTeaser();
    await flushPromises();

    const status = document.querySelector("#ryd-premium-teaser-status");
    expect(status?.textContent).toBe(getMessage("premiumTeaser_statusError"));
  });

  it("persists the hide setting when the close button is clicked", async () => {
    getVideoId.mockReturnValue("DISMISSME01");

    await initPremiumTeaser();
    await flushPromises();

    const closeButton = document.querySelector("#ryd-premium-teaser-close");
    expect(closeButton).not.toBeNull();

    storageSetMock.mockClear();

    closeButton.click();
    await flushPromises();

    expect(storageSetMock).toHaveBeenCalledWith({ hidePremiumTeaser: true });
    expect(document.querySelector(".ryd-premium-teaser")).toBeNull();
  });
});
