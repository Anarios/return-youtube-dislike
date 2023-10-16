import { extConfig } from "./state";
import { NumberDisplayFormat } from "./types";

declare const browser: any;

function numberFormat(numberState: number) {
  return getNumberFormatter(extConfig.numberDisplayFormat).format(numberState);
}

function getNumberFormatter(numberDisplayFormat: NumberDisplayFormat) {
  let userLocales: string;
  if (document.documentElement.lang) {
    userLocales = document.documentElement.lang;
  } else if (navigator.language) {
    userLocales = navigator.language;
  } else {
    try {
      const headLinks = document.querySelectorAll("head > link[rel='search']");
      if (!headLinks || headLinks.length === 0) {
        throw new Error("No head links found");
      }

      const localeLink = Array.from(headLinks).find((n) =>
        n?.getAttribute("href")?.includes("?locale=")
      );
      if (!localeLink) {
        throw new Error("No locale link found");
      }

      const localeLinkHref = localeLink.getAttribute("href");
      if (!localeLinkHref) {
        throw new Error("No locale link href found");
      }

      const url = new URL(localeLinkHref);
      const searchParams = url.searchParams;
      const locale = searchParams.get("locale");
      if (!searchParams || typeof locale !== "string") {
        throw new Error("No locale found");
      }

      userLocales = locale;
    } catch {
      cLog(
        "Cannot find browser locale. Use en as default for number formatting."
      );
      userLocales = "en";
    }
  }

  let formatterNotation: Intl.NumberFormatOptions["notation"];
  let formatterCompactDisplay: Intl.NumberFormatOptions["compactDisplay"];
  switch (numberDisplayFormat) {
    case "compactLong":
      formatterNotation = "compact";
      formatterCompactDisplay = "long";
      break;
    case "standard":
      formatterNotation = "standard";
      formatterCompactDisplay = "short";
      break;
    case "compactShort":
    default:
      formatterNotation = "compact";
      formatterCompactDisplay = "short";
  }

  const formatter = Intl.NumberFormat(userLocales, {
    notation: formatterNotation,
    compactDisplay: formatterCompactDisplay,
  });
  return formatter;
}

function localize(localeString: string) {
  return chrome.i18n.getMessage(localeString);
}

function getBrowser(): typeof chrome | typeof browser | false {
  if (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined") {
    return chrome;
  } else if (
    typeof browser !== "undefined" &&
    typeof browser.runtime !== "undefined"
  ) {
    return browser;
  } else {
    console.log("browser is not supported");
    return false;
  }
}

function getVideoId(url: string) {
  const urlObject = new URL(url);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return (
      document?.querySelector("meta[itemprop='videoId']") as HTMLMetaElement
    )?.content;
  } else {
    if (pathname.startsWith("/shorts")) {
      return pathname.slice(8);
    }
    return urlObject.searchParams.get("v");
  }
}

function isInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
    // When short (channel) is ignored, the element (like/dislike AND short itself) is
    // hidden with a 0 DOMRect. In this case, consider it outside of Viewport
    !(rect.top == 0 && rect.left == 0 && rect.bottom == 0 && rect.right == 0) &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= height &&
    rect.right <= width
  );
}

function isVideoLoaded() {
  const videoId = getVideoId(window.location.href);
  return (
    document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null ||
    // mobile: no video-id attribute
    document.querySelector('#player[loading="false"]:not([hidden])') !== null
  );
}

function cLog(message: string) {
  message = `[return youtube dislike]: ${message}`;
  console.log(message);
}

function getColorFromTheme(voteIsLike: boolean) {
  let colorString;
  switch (extConfig.colorTheme) {
    case "accessible":
      if (voteIsLike === true) {
        colorString = "dodgerblue";
      } else {
        colorString = "gold";
      }
      break;
    case "neon":
      if (voteIsLike === true) {
        colorString = "aqua";
      } else {
        colorString = "magenta";
      }
      break;
    case "classic":
    default:
      if (voteIsLike === true) {
        colorString = "lime";
      } else {
        colorString = "red";
      }
  }
  return colorString;
}

export {
  numberFormat,
  getBrowser,
  getVideoId,
  isInViewport,
  isVideoLoaded,
  cLog,
  getColorFromTheme,
  localize,
};
