/**
 * @jest-environment jsdom
 */

jest.mock("./state", () => {
  const extConfig = {
    disableVoteSubmission: false,
    disableLogging: false,
    coloredThumbs: false,
    coloredBar: false,
    colorTheme: "classic",
    numberDisplayFormat: "compactShort",
    selectors: {
      dislikeTextContainer: [],
      likeTextContainer: [],
      buttons: {
        shorts: { mobile: [], desktop: [] },
        regular: {
          mobile: [],
          desktopMenu: [],
          desktopNoMenu: [],
        },
        likeButton: {
          segmented: [],
          segmentedGetButtons: [],
          notSegmented: [],
        },
        dislikeButton: {
          segmented: [],
          segmentedGetButtons: [],
          notSegmented: [],
        },
      },
      menuContainer: [],
      roundedDesign: [],
    },
  };

  const isShorts = jest.fn(() => false);

  return {
    extConfig,
    isShorts,
  };
});

import { extConfig, isShorts } from "./state";
import {
  numberFormat,
  getNumberFormatter,
  localize,
  getBrowser,
  getVideoId,
  isInViewport,
  isVideoLoaded,
  initializeLogging,
  getColorFromTheme,
  querySelector,
  querySelectorAll,
  createObserver,
} from "./utils";

const originalChrome = global.chrome;
const originalBrowser = global.browser;
const originalConsole = { ...console };
const originalNavigatorLanguage = navigator.language;
const originalDocumentQuerySelector = document.querySelector;
const originalDocumentQuerySelectorAll = document.querySelectorAll;
const originalLocationHref = window.location.href;

function resetGlobals() {
  global.chrome = originalChrome;
  global.browser = originalBrowser;
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  document.querySelector = originalDocumentQuerySelector;
  document.querySelectorAll = originalDocumentQuerySelectorAll;
  window.history.replaceState(null, "", originalLocationHref);
  Object.defineProperty(navigator, "language", {
    value: originalNavigatorLanguage,
    configurable: true,
  });
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.lang = "";
  jest.restoreAllMocks();
  jest.clearAllMocks();
  extConfig.disableLogging = false;
  extConfig.colorTheme = "classic";
  extConfig.numberDisplayFormat = "compactShort";
  isShorts.mockReturnValue(false);
}

describe("utils", () => {
  beforeEach(() => {
    resetGlobals();
  });

  afterAll(() => {
    resetGlobals();
  });

  describe("numberFormat", () => {
    it("formats values using the configured formatter", () => {
      document.documentElement.lang = "en";
      const value = 15320;
      const expected = Intl.NumberFormat("en", { notation: "compact", compactDisplay: "short" }).format(value);

      expect(numberFormat(value)).toBe(expected);
    });

    it("uses the requested notation when configuration changes", () => {
      document.documentElement.lang = "en";
      extConfig.numberDisplayFormat = "standard";
      const value = 987654;
      const expected = Intl.NumberFormat("en", { notation: "standard", compactDisplay: "short" }).format(value);

      expect(numberFormat(value)).toBe(expected);
    });
  });

  describe("getNumberFormatter", () => {
    it("prefers the document language when available", () => {
      document.documentElement.lang = "fr";

      const formatter = getNumberFormatter("compactLong");
      const options = formatter.resolvedOptions();

      expect(options.locale.toLowerCase()).toContain("fr");
      expect(options.notation).toBe("compact");
      expect(options.compactDisplay).toBe("long");
    });

    it("falls back to navigator language", () => {
      document.documentElement.lang = "";
      Object.defineProperty(navigator, "language", {
        value: "de-DE",
        configurable: true,
      });

      const formatter = getNumberFormatter("standard");
      const options = formatter.resolvedOptions();

      expect(options.locale.toLowerCase()).toContain("de");
      expect(options.notation).toBe("standard");
    });

    it("uses link locale when document and navigator languages are missing", () => {
      document.documentElement.lang = "";
      Object.defineProperty(navigator, "language", {
        value: undefined,
        configurable: true,
      });

      const link = document.createElement("link");
      link.setAttribute("rel", "search");
      link.setAttribute("href", "https://www.youtube.com/opensearch?locale=it-IT");
      document.head.appendChild(link);

      const formatter = getNumberFormatter();
      const options = formatter.resolvedOptions();

      expect(options.locale.toLowerCase()).toContain("it");
    });

    it("falls back to english when locale detection fails", () => {
      document.documentElement.lang = "";
      Object.defineProperty(navigator, "language", {
        value: undefined,
        configurable: true,
      });

      const querySpy = jest.spyOn(document, "querySelectorAll").mockImplementation(() => {
        throw new Error("boom");
      });
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const formatter = getNumberFormatter();
      const options = formatter.resolvedOptions();

      expect(options.locale.toLowerCase()).toContain("en");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Cannot find browser locale. Use en as default for number formatting.",
      );
      querySpy.mockRestore();
    });
  });

  describe("localize", () => {
    it("returns the localized string from chrome", () => {
      global.chrome = {
        i18n: {
          getMessage: jest.fn().mockReturnValue("Return YouTube Dislike"),
        },
      };

      expect(localize("extensionName")).toBe("Return YouTube Dislike");
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith("extensionName");
    });
  });

  describe("getBrowser", () => {
    it("returns the chrome runtime when available", () => {
      global.chrome = { runtime: {} };

      expect(getBrowser()).toBe(global.chrome);
    });

    it("falls back to the firefox browser object", () => {
      global.chrome = { runtime: undefined };
      global.browser = { runtime: {} };

      expect(getBrowser()).toBe(global.browser);
    });

    it("logs and returns false when unsupported", () => {
      global.chrome = undefined;
      global.browser = undefined;
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});

      expect(getBrowser()).toBe(false);
      expect(spy).toHaveBeenCalledWith("browser is not supported");
    });
  });

  describe("getVideoId", () => {
    it("extracts the id from a standard watch URL", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      expect(getVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("handles shorts URLs", () => {
      const url = "https://www.youtube.com/shorts/xyz987";

      expect(getVideoId(url)).toBe("xyz987");
    });

    it("uses the meta tag for clip URLs", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("itemprop", "videoId");
      meta.content = "clip123";
      document.head.appendChild(meta);

      expect(getVideoId("https://www.youtube.com/clip/foobar")).toBe("clip123");
    });
  });

  describe("isInViewport", () => {
    it("returns false for zero-sized rectangles", () => {
      const element = {
        getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0 }),
      };

      expect(isInViewport(element)).toBe(false);
    });

    it("returns true for elements fully inside the viewport", () => {
      const element = {
        getBoundingClientRect: () => ({ top: 10, left: 20, bottom: 200, right: 300 }),
      };

      expect(isInViewport(element)).toBe(true);
    });

    it("returns false when element extends beyond the viewport", () => {
      const element = {
        getBoundingClientRect: () => ({ top: -10, left: 0, bottom: 50, right: 50 }),
      };

      expect(isInViewport(element)).toBe(false);
    });
  });

  describe("isVideoLoaded", () => {
    beforeEach(() => {
      const origin = window.location.origin;
      window.history.replaceState(null, "", `${origin}/watch?v=testid`);
    });

    it("returns true when desktop grid element is present", () => {
      document.querySelector = jest.fn().mockReturnValueOnce({});

      expect(isVideoLoaded()).toBe(true);
      expect(document.querySelector).toHaveBeenCalledWith("ytd-watch-grid[video-id='testid']");
    });

    it("checks secondary selectors when the grid is absent", () => {
      document.querySelector = jest
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({})
        .mockReturnValue(null);

      expect(isVideoLoaded()).toBe(true);
      expect(document.querySelector).toHaveBeenNthCalledWith(2, "ytd-watch-flexy[video-id='testid']");
    });

    it("falls back to player detection when previous lookups fail", () => {
      document.querySelector = jest
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({});

      expect(isVideoLoaded()).toBe(true);
      expect(document.querySelector).toHaveBeenNthCalledWith(3, '#player[loading="false"]:not([hidden])');
    });

    it("defers to shorts lookup when on a shorts URL", () => {
      isShorts.mockReturnValue(true);
      const origin = window.location.origin;
      window.history.replaceState(null, "", `${origin}/shorts/abc123`);

      const container = document.createElement("div");
      container.className = "reel-video-in-sequence-new";

      const thumbnail = document.createElement("div");
      thumbnail.className = "reel-video-in-sequence-thumbnail";
      thumbnail.style.backgroundImage = "url(https://i.ytimg.com/vi/abc123/default.jpg)";
      container.appendChild(thumbnail);

      const renderer = document.createElement("ytd-reel-video-renderer");
      const overlay = document.createElement("div");
      overlay.id = "experiment-overlay";
      overlay.appendChild(document.createElement("span"));
      renderer.appendChild(overlay);
      container.appendChild(renderer);

      document.body.appendChild(container);

      expect(isVideoLoaded()).toBe(true);
    });
  });

  describe("initializeLogging", () => {
    it("disables console output when configured", () => {
      extConfig.disableLogging = true;
      const originalLog = console.log;
      const originalDebug = console.debug;

      initializeLogging();

      expect(console.log).not.toBe(originalLog);
      expect(console.debug).not.toBe(originalDebug);
    });

    it("restores console output when logging is enabled", () => {
      const stubLog = jest.fn();
      const stubDebug = jest.fn();
      console.log = stubLog;
      console.debug = stubDebug;

      extConfig.disableLogging = false;
      initializeLogging();

      expect(console.log).not.toBe(stubLog);
      expect(console.debug).not.toBe(stubDebug);
    });
  });

  describe("getColorFromTheme", () => {
    it("returns accessible colors when configured", () => {
      extConfig.colorTheme = "accessible";

      expect(getColorFromTheme(true)).toBe("dodgerblue");
      expect(getColorFromTheme(false)).toBe("gold");
    });

    it("returns neon colors when configured", () => {
      extConfig.colorTheme = "neon";

      expect(getColorFromTheme(true)).toBe("aqua");
      expect(getColorFromTheme(false)).toBe("magenta");
    });

    it("defaults to classic palette", () => {
      extConfig.colorTheme = "classic";

      expect(getColorFromTheme(true)).toBe("lime");
      expect(getColorFromTheme(false)).toBe("red");
    });
  });

  describe("querySelector", () => {
    it("returns the first matching element", () => {
      document.body.innerHTML = `
        <div class="first"></div>
        <div class="second"></div>
      `;

      const result = querySelector([".missing", ".second", ".first"]);

      expect(result).toBeInstanceOf(Element);
      expect(result?.className).toBe("second");
    });

    it("scopes the search to the provided element", () => {
      const host = document.createElement("div");
      host.innerHTML = '<span class="inner"></span>';

      const result = querySelector([".inner"], host);
      expect(result).not.toBeNull();
      expect(result?.className).toBe("inner");
    });

    it("returns undefined when no selector matches", () => {
      expect(querySelector([".unmatched"])).toBeUndefined();
    });
  });

  describe("querySelectorAll", () => {
    it("returns the first selector with results", () => {
      document.body.innerHTML = `
        <div class="candidate"></div>
        <div class="candidate"></div>
      `;

      const result = querySelectorAll([".missing", ".candidate"]);

      expect(result).toHaveLength(2);
    });

    it("returns an empty NodeList when no matches are found", () => {
      const result = querySelectorAll([".still-missing"]);

      expect(result).toBeInstanceOf(NodeList);
      expect(result).toHaveLength(0);
    });
  });

  describe("createObserver", () => {
    it("wraps MutationObserver with helper methods", () => {
      const observeMock = jest.fn();
      const disconnectMock = jest.fn();
      const callback = jest.fn();

      const originalMutationObserver = global.MutationObserver;
      global.MutationObserver = jest.fn().mockImplementation(() => ({
        observe: observeMock,
        disconnect: disconnectMock,
      }));

      const wrapper = createObserver({ attributes: true }, callback);
      const element = document.createElement("div");

      wrapper.observe(element);
      wrapper.disconnect();

      expect(global.MutationObserver).toHaveBeenCalledWith(callback);
      expect(observeMock).toHaveBeenCalledWith(element, { attributes: true });
      expect(disconnectMock).toHaveBeenCalled();

      global.MutationObserver = originalMutationObserver;
    });
  });
});
