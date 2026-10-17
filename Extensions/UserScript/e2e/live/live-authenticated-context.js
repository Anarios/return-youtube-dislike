const DEFAULT_ACCOUNT_PROBE_TIMEOUT_MS = 8_000;
const DEFAULT_ACCOUNT_SELECTION_ATTEMPTS = 2;
const DEFAULT_ACCOUNT_SELECTION_RETRY_DELAY_MS = 250;
const YOUTUBE_HOSTNAMES = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

function normalizeChannelHandle(value) {
  if (typeof value !== "string" || !/^@[A-Za-z0-9._-]{3,100}$/.test(value.trim())) {
    throw new Error("An exact public YouTube @handle is required to select the live browser profile.");
  }
  return value.trim().toLowerCase();
}

function isCommittedYoutubePage(page) {
  if (!page || typeof page.url !== "function" || page.isClosed?.()) return false;
  try {
    const url = new URL(page.url());
    return (
      url.protocol === "https:" &&
      YOUTUBE_HOSTNAMES.has(url.hostname.toLowerCase()) &&
      !url.port &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function inspectYoutubeSessionDocument() {
  const allowedHostnames = ["youtube.com", "www.youtube.com", "m.youtube.com"];
  const configuredLoggedIn = (() => {
    try {
      const value = globalThis.ytcfg?.get?.("LOGGED_IN") ?? globalThis.ytcfg?.data_?.LOGGED_IN;
      return typeof value === "boolean" ? value : null;
    } catch {
      return null;
    }
  })();

  return {
    committed:
      Boolean(document.documentElement) &&
      location.protocol === "https:" &&
      allowedHostnames.includes(location.hostname.toLowerCase()) &&
      !location.port &&
      !location.username &&
      !location.password,
    configuredLoggedIn,
  };
}

function inspectVisibleAccountMenu(expectedHandle) {
  const allowedHostnames = ["youtube.com", "www.youtube.com", "m.youtube.com"];
  const normalizedExpectedHandle = expectedHandle.toLowerCase();
  const isVisible = (element) => {
    const rectangle = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rectangle.width > 0 && rectangle.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const menuSelectors = [
    "ytd-multi-page-menu-renderer",
    "ytm-multi-page-menu-renderer",
    "tp-yt-iron-dropdown ytd-active-account-header-renderer",
  ];
  const menus = [...document.querySelectorAll(menuSelectors.join(","))].filter(isVisible);
  let foundHandle = false;
  let matchedExpectedHandle = false;

  for (const menu of menus) {
    for (const link of menu.querySelectorAll("a[href]")) {
      if (!isVisible(link)) continue;
      try {
        const url = new URL(link.getAttribute("href"), location.origin);
        if (url.protocol !== "https:" || !allowedHostnames.includes(url.hostname.toLowerCase())) continue;
        const path = decodeURIComponent(url.pathname).replace(/\/$/, "").toLowerCase();
        if (!/^\/@[a-z0-9._-]{3,100}$/.test(path)) continue;
        foundHandle = true;
        if (path === `/${normalizedExpectedHandle}`) matchedExpectedHandle = true;
      } catch {}
    }
  }

  if (!matchedExpectedHandle) {
    for (const menu of menus) {
      for (const header of menu.querySelectorAll(
        "ytd-active-account-header-renderer, ytm-active-account-header-renderer",
      )) {
        if (!isVisible(header)) continue;
        const identityElements = [header, ...header.querySelectorAll("#channel-handle, yt-formatted-string, span")];
        const tokens = identityElements
          .flatMap((element) => (element.textContent ?? "").split(/\s+/))
          .map((token) => token.trim().replace(/\/$/, "").toLowerCase())
          .filter((token) => /^@[a-z0-9._-]{3,100}$/.test(token));
        if (tokens.length > 0) foundHandle = true;
        if (tokens.includes(normalizedExpectedHandle)) matchedExpectedHandle = true;
      }
    }
  }

  if (matchedExpectedHandle || foundHandle) {
    return { matchedExpectedHandle, ready: true };
  }
  return null;
}

async function firstVisibleAvatar(page) {
  const avatars = page.locator("#avatar-btn");
  const count = await avatars.count();
  for (let index = 0; index < count; index += 1) {
    const avatar = avatars.nth(index);
    if (await avatar.isVisible()) return avatar;
  }
  return null;
}

async function readVisibleAccountMenu(page, expectedHandle) {
  return page.evaluate(inspectVisibleAccountMenu, expectedHandle);
}

async function waitForVisibleAccountMenu(page, expectedHandle, timeoutMilliseconds) {
  const handle = await page.waitForFunction(inspectVisibleAccountMenu, expectedHandle, {
    polling: 100,
    timeout: timeoutMilliseconds,
  });
  try {
    return await handle.jsonValue();
  } finally {
    // The result has already been serialized. A concurrent navigation can make
    // disposal fail, but must not erase a conclusive account-menu result.
    await handle.dispose?.().catch(() => {});
  }
}

async function verifyAuthenticatedYoutubePage(
  page,
  expectedHandle,
  { accountProbeTimeoutMilliseconds = DEFAULT_ACCOUNT_PROBE_TIMEOUT_MS } = {},
) {
  const normalizedExpectedHandle = normalizeChannelHandle(expectedHandle);
  if (!isCommittedYoutubePage(page)) return false;

  // Attached background tabs can be heavily throttled. Bringing only the page
  // currently being verified forward makes the account-menu hydration behave
  // like an ordinary user interaction without navigating or changing profile
  // state.
  await page.bringToFront?.();
  if (!isCommittedYoutubePage(page)) return false;

  const documentState = await page.evaluate(inspectYoutubeSessionDocument);
  if (documentState?.committed !== true || documentState.configuredLoggedIn === false) return false;

  const existingMenu = await readVisibleAccountMenu(page, normalizedExpectedHandle);
  if (existingMenu?.ready) return existingMenu.matchedExpectedHandle === true;

  const avatar = await firstVisibleAvatar(page);
  if (!avatar) return false;

  let openedMenu = false;
  try {
    await avatar.click({ timeout: accountProbeTimeoutMilliseconds });
    openedMenu = true;
    const menu = await waitForVisibleAccountMenu(page, normalizedExpectedHandle, accountProbeTimeoutMilliseconds);
    return menu?.matchedExpectedHandle === true;
  } finally {
    if (openedMenu) await page.keyboard.press("Escape").catch(() => {});
  }
}

function classifyAccountProbeFailure(error) {
  if (error?.name === "TimeoutError") return "timeout";
  if (/target (?:page|context|browser).*closed|page has been closed/i.test(error?.message ?? "")) {
    return "page-closed";
  }
  if (
    /execution context was destroyed|cannot find context|most likely because of a navigation/i.test(
      error?.message ?? "",
    )
  ) {
    return "navigation-race";
  }
  return "probe-error";
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyCandidateYoutubePage(
  page,
  expectedHandle,
  verifyPage,
  { accountProbeTimeoutMilliseconds = DEFAULT_ACCOUNT_PROBE_TIMEOUT_MS } = {},
) {
  try {
    return {
      matched: Boolean(
        await verifyPage(page, expectedHandle, {
          accountProbeTimeoutMilliseconds,
        }),
      ),
      resolved: true,
    };
  } catch (error) {
    // A page which closed or left YouTube while it was being inspected no
    // longer represents a candidate profile. Do not let that stale tab poison
    // the result, but keep every still-committed candidate fail-closed.
    if (!isCommittedYoutubePage(page)) return { matched: false, resolved: true };
    return {
      failureKind: classifyAccountProbeFailure(error),
      matched: false,
      resolved: false,
    };
  }
}

async function scanAuthenticatedYoutubeContexts(browser, normalizedExpectedHandle, options) {
  const contexts = browser.contexts();
  if (!Array.isArray(contexts) || contexts.length === 0) {
    throw new Error("The attached Chromium browser has no browser contexts.");
  }

  const matches = [];
  const unresolvedContextIndexes = new Set();
  const unresolvedCandidates = [];
  let youtubePageCount = 0;

  for (let contextIndex = 0; contextIndex < contexts.length; contextIndex += 1) {
    const context = contexts[contextIndex];
    const pages = typeof context?.pages === "function" ? context.pages() : null;
    if (!Array.isArray(pages)) {
      throw new Error(`Attached Chromium context ${contextIndex + 1} returned a malformed page inventory.`);
    }

    const contextMatches = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const sessionPage = pages[pageIndex];
      if (!isCommittedYoutubePage(sessionPage)) continue;
      youtubePageCount += 1;
      const verification = await verifyCandidateYoutubePage(sessionPage, normalizedExpectedHandle, options.verifyPage, {
        accountProbeTimeoutMilliseconds: options.accountProbeTimeoutMilliseconds,
      });
      if (verification.matched) {
        contextMatches.push({ context, contextIndex, pageIndex, sessionPage });
        // Authentication belongs to the BrowserContext/profile, not to an
        // individual tab. One exact match resolves this profile; probing more
        // tabs would only add UI churn and transient failure opportunities.
        break;
      }
      if (!verification.resolved) {
        unresolvedContextIndexes.add(contextIndex);
        unresolvedCandidates.push({ contextIndex, failureKind: verification.failureKind, pageIndex });
      }
    }

    if (contextMatches.length > 0) {
      unresolvedContextIndexes.delete(contextIndex);
      matches.push(contextMatches[0]);
    }
  }

  return { matches, unresolvedCandidates, unresolvedContextIndexes, youtubePageCount };
}

function isSelectedSessionPageCurrent(selection) {
  if (!isCommittedYoutubePage(selection.sessionPage)) return false;
  try {
    const pages = selection.context.pages();
    return Array.isArray(pages) && pages.includes(selection.sessionPage);
  } catch {
    return false;
  }
}

async function selectAuthenticatedYoutubeContext(
  browser,
  expectedHandle,
  {
    accountSelectionAttempts = DEFAULT_ACCOUNT_SELECTION_ATTEMPTS,
    accountSelectionRetryDelayMilliseconds = DEFAULT_ACCOUNT_SELECTION_RETRY_DELAY_MS,
    accountProbeTimeoutMilliseconds = DEFAULT_ACCOUNT_PROBE_TIMEOUT_MS,
    verifyPage = verifyAuthenticatedYoutubePage,
    waitForRetry = wait,
  } = {},
) {
  const normalizedExpectedHandle = normalizeChannelHandle(expectedHandle);
  if (!browser || typeof browser.contexts !== "function") {
    throw new TypeError("An attached Chromium browser is required to select the authenticated profile.");
  }

  if (!Number.isSafeInteger(accountSelectionAttempts) || accountSelectionAttempts < 1) {
    throw new TypeError("The authenticated Chromium selection attempt count must be a positive integer.");
  }

  let scan;
  for (let attempt = 1; attempt <= accountSelectionAttempts; attempt += 1) {
    scan = await scanAuthenticatedYoutubeContexts(browser, normalizedExpectedHandle, {
      accountProbeTimeoutMilliseconds,
      verifyPage,
    });
    if (scan.matches.length > 1) {
      throw new Error(
        `More than one attached Chromium context has a signed-in YouTube page for ${normalizedExpectedHandle}; refusing to choose a profile.`,
      );
    }
    if (scan.matches.length === 1 && scan.unresolvedContextIndexes.size === 0) {
      const selection = scan.matches[0];
      if (isSelectedSessionPageCurrent(selection)) return selection;
      scan.unresolvedContextIndexes.add(selection.contextIndex);
      scan.unresolvedCandidates.push({
        contextIndex: selection.contextIndex,
        failureKind: "selected-page-stale",
        pageIndex: selection.pageIndex,
      });
    }
    if (attempt < accountSelectionAttempts) await waitForRetry(accountSelectionRetryDelayMilliseconds);
  }

  if (scan.unresolvedContextIndexes.size > 0) {
    const diagnostic = scan.unresolvedCandidates
      .filter(({ contextIndex }) => scan.unresolvedContextIndexes.has(contextIndex))
      .map(
        ({ contextIndex, failureKind, pageIndex }) =>
          `context ${contextIndex + 1} page ${pageIndex + 1} (${failureKind})`,
      )
      .join(", ");
    throw new Error(
      `Could not safely verify every candidate Chromium profile for ${normalizedExpectedHandle}; no extension was changed. Unresolved probes: ${diagnostic}.`,
    );
  }
  if (scan.matches.length === 0) {
    if (scan.youtubePageCount === 0) {
      throw new Error(
        `No pre-existing committed HTTPS YouTube page was found for ${normalizedExpectedHandle}; no extension was changed.`,
      );
    }
    throw new Error(
      `No attached Chromium context has a pre-existing signed-in YouTube page for ${normalizedExpectedHandle}; no extension was changed.`,
    );
  }

  throw new Error(`The authenticated Chromium profile for ${normalizedExpectedHandle} became unavailable.`);
}

module.exports = {
  DEFAULT_ACCOUNT_SELECTION_ATTEMPTS,
  DEFAULT_ACCOUNT_SELECTION_RETRY_DELAY_MS,
  DEFAULT_ACCOUNT_PROBE_TIMEOUT_MS,
  classifyAccountProbeFailure,
  inspectVisibleAccountMenu,
  inspectYoutubeSessionDocument,
  isCommittedYoutubePage,
  normalizeChannelHandle,
  scanAuthenticatedYoutubeContexts,
  selectAuthenticatedYoutubeContext,
  verifyCandidateYoutubePage,
  verifyAuthenticatedYoutubePage,
};
