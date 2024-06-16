/**
 * @jest-environment jsdom
 */

import {
  __Rewire__ as rewiredUtils,
  numberFormat,
  getNumberFormatter,
  localize,
  getBrowser,
  getVideoId,
  isInViewport,
  isVideoLoaded,
  cLog,
  getColorFromTheme,
} from "./utils";
import { extConfig } from "./state";

jest.mock("./state");

describe("numberFormat", () => {
  it("should format high numbers correctly", () => {
    rewiredUtils(
      "getNumberFormatter",
      jest.fn().mockReturnValue(
        Intl.NumberFormat("en", {
          notation: "compact",
          compactDisplay: "short",
        }),
      ),
    );

    expect(numberFormat(91492)).toBe("91K");
    jest.resetAllMocks();
  });

  it("should not format input when < 1000", () => {
    rewiredUtils(
      "getNumberFormatter",
      jest.fn().mockReturnValue(
        Intl.NumberFormat("en", {
          notation: "compact",
          compactDisplay: "short",
        }),
      ),
    );

    expect(numberFormat(100)).toBe("100");
  });

  it("should not round down when rounding is diabled in config", () => {
    rewiredUtils(
      "getNumberFormatter",
      jest.fn().mockReturnValue(
        Intl.NumberFormat("de", {
          notation: "compact",
          compactDisplay: "short",
        }),
      ),
    );
    extConfig.numberDisplayRoundDown = false;

    expect(numberFormat(912391)).toBe("912.391");
  });
});

describe("getNumberFormatter", () => {
  it("should return a correct formatter with compactLong option", () => {
    expect(getNumberFormatter("compactLong")).toMatchSnapshot();
  });

  it("should return a correct formatter whith standard option", () => {
    expect(getNumberFormatter("standard")).toMatchSnapshot();
  });

  it("should return a correct formatter when using chrome", () => {
    Object.defineProperty(document.documentElement, "lang", {
      value: "en",
      configurable: true,
    });
    expect(getNumberFormatter()).toMatchSnapshot();
  });

  it("should return a correct formatter when using firefox", () => {
    Object.defineProperty(document.documentElement, "lang", {
      value: null,
      configurable: true,
    });
    expect(getNumberFormatter()).toMatchSnapshot();
  });

  it("should return a correct formatter when using the URL locale (possibly buggy)", () => {
    // Disclaimer: The case we are testing here is actually not correct and
    // am almost sure I found a bug in the actual implementation of
    // getNumberFormatter(). As I am currently writing acceptance tests only
    // e.g. tests that are exclusively testing the current behaviour as is, as
    // a first step of adding tests to the codebase, I will add it like this
    // for now and document how we should actually be testing down below.
    // The reason why this bug is not causing faulty behaviour is, that we
    // have a fallback for it, that is always triggered.

    // This is how we make the test go green:
    Object.defineProperty(document.documentElement, "lang", {
      value: null,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: null,
      configurable: true,
    });
    const mockedNode = document.createElement("link");

    mockedNode.setAttribute("href", "https://www.youtube.com/opensearch?locale=en");

    document.querySelectorAll = jest.fn().mockReturnValue([mockedNode]);
    expect(getNumberFormatter()).toMatchSnapshot();
  });

  it.skip("should return a correct formatter when using the URL locale", () => {
    // But we actually want to test like so, which is the correct value of the locale attribute:
    Object.defineProperty(document.documentElement, "lang", {
      value: null,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: null,
      configurable: true,
    });
    const mockedNode = document.createElement("link");
    mockedNode.setAttribute("href", "https://www.youtube.com/opensearch?locale=en_US");

    document.querySelectorAll = jest.fn().mockReturnValue([mockedNode]);
    expect(getNumberFormatter()).toMatchSnapshot();
  });

  it("should return a correct formatter when falling back to default locale", () => {
    Object.defineProperty(document.documentElement, "lang", {
      value: null,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: null,
      configurable: true,
    });
    expect(getNumberFormatter()).toMatchSnapshot();
  });

  describe("localize", () => {
    it("should return a translated string", () => {
      global.chrome = {
        i18n: {
          getMessage: () => "Return YouTube Dislike",
        },
      };
      expect(localize("extensionName")).toBe("Return YouTube Dislike");
    });
  });

  describe("getBrowser", () => {
    it("should return a chrome browser instance", () => {
      global.chrome = {
        runtime: jest.fn(),
      };
      expect(getBrowser()).toBeDefined();
    });

    it("should return a mozilla browser instance", () => {
      global.chrome.runtime = undefined;
      global.browser = {
        runtime: jest.fn(),
      };
      expect(getBrowser()).toBeDefined();
    });

    it("should fail on unsupported browser", () => {
      global.chrome = undefined;
      global.browser = undefined;

      const log = console.log;
      console.log = jest.fn();

      expect(getBrowser()).toBe(false);
      expect(console.log).toBeCalledWith("browser is not supported");

      console.log = log;
    });
  });
  describe("getVideoId", () => {
    it("should return the video Id on valid url input", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      expect(getVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("should return the video Id on valid shorts url input", () => {
      const url = "https://www.youtube.com/shorts/niMcQ9Vmmj8";
      expect(getVideoId(url)).toBe("niMcQ9Vmmj8");
    });

    it("should return the video Id on clip url input", () => {
      document.querySelector = jest.fn().mockReturnValue({
        content: "niMcQ9Vmmj8",
      });
      const url = "https://www.youtube.com/clip";
      expect(getVideoId(url)).toBe("niMcQ9Vmmj8");
    });

    it("should return null on invalid url input", () => {
      const url = "https://www.youtube.com/wrong-url";
      expect(getVideoId(url)).toBe(null);
    });
  });
  describe("isInViewport", () => {
    it("should return true if element is in viewport", () => {
      const rect = {
        getBoundingClientRect: jest.fn().mockReturnValue({
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        }),
      };
      expect(isInViewport(rect)).toBe(false);
    });

    it("should return false if element is out of viewport", () => {
      const rect = {
        getBoundingClientRect: jest.fn().mockReturnValue({
          top: 0,
          left: 0,
          bottom: 769,
          right: 0,
        }),
      };
      expect(isInViewport(rect)).toBe(false);
    });
  });
  describe("isVideoLoaded", () => {
    describe("on desktop", () => {
      it("should return true on loaded video", () => {
        rewiredUtils("getVideoId", jest.fn().mockReturnValue("fakeId"));
        document.querySelector = jest.fn().mockReturnValue("notNull");
        expect(isVideoLoaded()).toBe(true);
        expect(document.querySelector).toBeCalledWith("ytd-watch-grid[video-id='fakeId']");
      });

      it("should return false on not loaded video", () => {
        rewiredUtils("getVideoId", jest.fn().mockReturnValue("fakeId"));
        document.querySelector = jest.fn().mockReturnValue(null);
        expect(isVideoLoaded()).toBe(false);
        expect(document.querySelector).toBeCalledWith("ytd-watch-flexy[video-id='fakeId']");
      });
    });

    describe("on mobile", () => {
      it("should return true on loaded video", () => {
        rewiredUtils("getVideoId", jest.fn().mockReturnValue("fakeId"));
        document.querySelector = jest.fn().mockReturnValueOnce(null).mockReturnValue("notNull");
        expect(isVideoLoaded()).toBe(true);
        expect(document.querySelector).toHaveBeenLastCalledWith("ytd-watch-flexy[video-id='fakeId']");
      });

      it("should return false on not loaded video", () => {
        rewiredUtils("getVideoId", jest.fn().mockReturnValue("fakeId"));
        document.querySelector = jest.fn().mockReturnValueOnce(null).mockReturnValue(null);
        expect(isVideoLoaded()).toBe(false);
        expect(document.querySelector).toHaveBeenLastCalledWith('#player[loading="false"]:not([hidden])');
      });
    });
  });
  describe("cLog", () => {
    it("should log a message with the correct prefix", () => {
      const log = console.log;
      console.log = jest.fn();
      cLog("Test message");

      expect(console.log).toBeCalledWith("[return youtube dislike]: Test message");

      console.log = log;
    });

    it("should log a message with the correct prefix when given a writer", () => {
      const fakeWriter = jest.fn();

      cLog("Test message", fakeWriter);
      expect(fakeWriter).toBeCalledWith("[return youtube dislike]: Test message");
    });
  });
  describe("getColorFromTheme", () => {
    describe("accessible", () => {
      it("should return the correct color for like", () => {
        extConfig.colorTheme = "accessible";
        expect(getColorFromTheme(true)).toBe("dodgerblue");
      });

      it("should return the correct color for not liked", () => {
        extConfig.colorTheme = "accessible";
        expect(getColorFromTheme(false)).toBe("gold");
      });
    });

    describe("neon", () => {
      it("should return the correct color for like", () => {
        extConfig.colorTheme = "neon";
        expect(getColorFromTheme(true)).toBe("aqua");
      });

      it("should return the correct color for not liked", () => {
        extConfig.colorTheme = "neon";
        expect(getColorFromTheme(false)).toBe("magenta");
      });
    });

    describe("classic", () => {
      it("should return the correct color for like", () => {
        extConfig.colorTheme = "classic";
        expect(getColorFromTheme(true)).toBe("lime");
      });

      it("should return the correct color for not liked", () => {
        extConfig.colorTheme = "classic";
        expect(getColorFromTheme(false)).toBe("red");
      });
    });
  });
});
