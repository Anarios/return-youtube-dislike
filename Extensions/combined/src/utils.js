import { extConfig } from "./state";

function roundDown(num) {
  if (num < 1000) return num;
  const int = Math.floor(Math.log10(num) - 2);
  const decimal = int + (int % 3 ? 1 : 0);
  const value = Math.floor(num / 10 ** decimal);
  return value * 10 ** decimal;
}

function numberFormat(numberState) {
  let userLocales;
  try {
    userLocales = new URL(
      Array.from(document.querySelectorAll("head > link[rel='search']"))
        ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
        ?.getAttribute("href")
    )?.searchParams?.get("locale");
  } catch {}

  let numberDisplay;
  if (extConfig.numberDisplayRoundDown === false) {
    numberDisplay = numberState;
  } else {
    numberDisplay = roundDown(numberState);
  }
  return getNumberFormatter(extConfig.numberDisplayFormat).format(
    numberDisplay
  );
}

function localize(localeString) {
  return chrome.i18n.getMessage(localeString);
}

function getNumberFormatter(optionSelect) {
  let formatterNotation;
  let formatterCompactDisplay;
  let userLocales;
  try {
    userLocales = new URL(
      Array.from(document.querySelectorAll("head > link[rel='search']"))
      ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
      ?.getAttribute("href")
    )?.searchParams?.get("locale");
  } catch {}

  switch (optionSelect) {
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

  const formatter = Intl.NumberFormat(
    document.documentElement.lang || userLocales || navigator.language,
    {
      notation: formatterNotation,
      compactDisplay: formatterCompactDisplay,
    }
  );
  return formatter;
}

function getBrowser() {
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

function getVideoId(url) {
  const urlObject = new URL(url);
  const pathname = urlObject.pathname;
  if (pathname.startsWith("/clip")) {
    return document.querySelector("meta[itemprop='videoId']").content;
  } else {
    if (pathname.startsWith("/shorts")) {
      return pathname.slice(8);
    }
    return urlObject.searchParams.get("v");
  }
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  const height = innerHeight || document.documentElement.clientHeight;
  const width = innerWidth || document.documentElement.clientWidth;
  return (
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

function cLog(message, writer) {
  message = `[return youtube dislike]: ${message}`;
  if (writer) {
    writer(message);
  } else {
    console.log(message);
  }
}

function getColorFromTheme(voteIsLike) {
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
