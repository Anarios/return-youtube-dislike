import { config } from "../config";
import { getBrowser, localize } from "../utils";
import { localizePage } from "../localize-page";

const PATREON_JOIN_URL = "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008649";
const SUPPORT_DOC_URL = config.links?.help ?? "https://returnyoutubedislike.com/help";
const COMMUNITY_URL = config.links?.discord ?? "https://discord.gg/mYnESY4Md5";
const EXTERNAL_ACTIONS = {
  "ryd-changelog-appeal-join": PATREON_JOIN_URL,
  "ryd-changelog-upgrade": PATREON_JOIN_URL,
  "ryd-changelog-support": SUPPORT_DOC_URL,
  "ryd-changelog-contact": COMMUNITY_URL,
};

export function initChangelogPage() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
}

function setup() {
  applyLocaleMetadata();
  localizePage(localize);
  decorateScreenshotPlaceholders();
  bindActions();
}

function applyLocaleMetadata() {
  try {
    const browserLocale = chrome?.i18n?.getMessage?.("@@ui_locale");
    if (browserLocale) {
      document.documentElement.lang = browserLocale;
    }
    const direction = chrome?.i18n?.getMessage?.("@@bidi_dir");
    if (direction === "rtl" || direction === "ltr") document.documentElement.dir = direction;
  } catch (error) {
    console.debug("Unable to resolve UI locale", error);
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
  for (const [id, url] of Object.entries(EXTERNAL_ACTIONS)) {
    document.getElementById(id)?.addEventListener("click", (event) => {
      event.preventDefault();
      openExternal(url, browser);
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
