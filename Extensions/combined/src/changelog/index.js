import { config } from "../config";
import { getBrowser, localize } from "../utils";

const PATREON_JOIN_URL = "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649";
const SUPPORT_DOC_URL = config.links?.help ?? "https://returnyoutubedislike.com/help";
const COMMUNITY_URL = config.links?.discord ?? "https://discord.gg/mYnESY4Md5";

export function initChangelogPage() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
}

function setup() {
  applyLocaleMetadata();
  localizeHtmlPage();
  decorateScreenshotPlaceholders();
  bindActions();
}

function applyLocaleMetadata() {
  try {
    const browserLocale = chrome?.i18n?.getMessage?.("@@ui_locale");
    if (browserLocale) {
      document.documentElement.lang = browserLocale;
    }
  } catch (error) {
    console.debug("Unable to resolve UI locale", error);
  }
}

function localizeHtmlPage() {
  const elements = document.getElementsByTagName("html");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    const original = element.innerHTML.toString();
    const localized = original.replace(/__MSG_(\w+)__/g, (match, key) => {
      return key ? localize(key) : "";
    });

    if (localized !== original) {
      element.innerHTML = localized;
    }
  }
}

function decorateScreenshotPlaceholders() {
  document.querySelectorAll("[data-screenshot]").forEach((wrapper) => {
    const type = wrapper.getAttribute("data-screenshot");
    const labelKey = getPlaceholderLabelKey(type);
    if (!labelKey) return;

    const placeholder = wrapper.querySelector(".ryd-feature-card__placeholder");
    if (!placeholder) return;

    const label = localize(labelKey);
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", label);
    placeholder.title = label;
  });
}

function getPlaceholderLabelKey(type) {
  switch (type) {
    case "timeline":
      return "changelog_screenshot_label_timeline";
    case "map":
      return "changelog_screenshot_label_map";
    case "teaser":
      return "changelog_screenshot_label_teaser";
    default:
      return null;
  }
}

function bindActions() {
  const browser = getBrowser();

  const upgradeButton = document.getElementById("ryd-changelog-upgrade");
  if (upgradeButton) {
    upgradeButton.addEventListener("click", (event) => {
      event.preventDefault();
      openExternal(PATREON_JOIN_URL, browser);
    });
  }

  const supportButton = document.getElementById("ryd-changelog-support");
  if (supportButton) {
    supportButton.addEventListener("click", (event) => {
      event.preventDefault();
      openExternal(SUPPORT_DOC_URL, browser);
    });
  }

  const contactButton = document.getElementById("ryd-changelog-contact");
  if (contactButton) {
    contactButton.addEventListener("click", (event) => {
      event.preventDefault();
      openExternal(COMMUNITY_URL, browser);
    });
  }
}

function openExternal(url, browser) {
  if (!url) return;

  try {
    if (browser && browser.tabs && typeof browser.tabs.create === "function") {
      browser.tabs.create({ url });
      return;
    }
  } catch (error) {
    console.debug("tabs.create unavailable, falling back", error);
  }

  try {
    window.open(url, "_blank", "noopener");
  } catch (error) {
    console.warn("Failed to open external url", url, error);
  }
}
