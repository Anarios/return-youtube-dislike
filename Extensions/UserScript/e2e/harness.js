const fs = require("fs");
const path = require("path");
const { isAllowedApiPreflight } = require("../../e2e/hermetic-api-contract");
const { resolveRequestedUserscriptArtifact } = require("../../e2e/verify-userscript-artifact");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const GENERATED_USERSCRIPT = resolveRequestedUserscriptArtifact();
const WATCH_FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "watch-page.html"), "utf8");
const SHORTS_FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "shorts-page.html"), "utf8");
const NAVIGATION_FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "navigation-page.html"), "utf8");

const API_ORIGIN = "https://returnyoutubedislikeapi.com";
const CREDENTIAL_KEY = "rydVoteCredentials";
const VIDEO_A = "abcdefghijk";
const VIDEO_B = "zyxwvutsrqp";
const ZERO_DIFFICULTY_PUZZLE = {
  challenge: Buffer.alloc(16).toString("base64"),
  difficulty: 0,
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function requestKey(method, pathname) {
  return `${method.toUpperCase()} ${pathname}`;
}

function parseRequestBody(request) {
  const text = request.postData();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function jsonHeaders() {
  return {
    "access-control-allow-headers": "Accept, Content-Type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8",
  };
}

function createFakeBackend({ countsByVideo = {}, countDelayByVideo = {}, fixture = {} } = {}) {
  const blockedRequests = [];
  const preflightRequests = [];
  const requests = [];
  const responsePlans = new Map();
  const fixtureOptions = {
    initialButtons: fixture.initialButtons !== false,
    initialState: fixture.initialState || "neutral",
    nativeDislikeText: fixture.nativeDislikeText !== false,
    roleAttribute: fixture.roleAttribute || "data-ryd-role",
    signedIn: fixture.signedIn !== false,
  };

  function enqueue(method, pathname, response) {
    const key = requestKey(method, pathname);
    const queue = responsePlans.get(key) || [];
    queue.push(response);
    responsePlans.set(key, queue);
  }

  function defer(method, pathname) {
    let releaseResponse;
    let resolveSeen;
    let released = false;
    const seen = new Promise((resolve) => {
      resolveSeen = resolve;
    });

    enqueue(method, pathname, (record) => {
      resolveSeen(record);
      return new Promise((resolve) => {
        releaseResponse = resolve;
      });
    });

    return {
      get released() {
        return released;
      },
      release(response) {
        if (released) return;
        if (!releaseResponse) {
          throw new Error(`Cannot release ${requestKey(method, pathname)} before its request is seen`);
        }
        released = true;
        releaseResponse(response);
      },
      seen,
    };
  }

  function requestsFor(method, pathname) {
    return requests.filter((entry) => entry.method === method.toUpperCase() && entry.pathname === pathname);
  }

  function takePlannedResponse(record) {
    const queue = responsePlans.get(requestKey(record.method, record.pathname));
    if (!queue?.length) return null;
    const planned = queue.shift();
    return typeof planned === "function" ? planned(record) : planned;
  }

  function defaultApiResponse(record) {
    if (record.method === "GET" && record.pathname === "/configs/selectors") {
      return { body: {} };
    }

    if (record.method === "GET" && record.pathname === "/votes") {
      const videoId = record.query.videoId;
      const counts = countsByVideo[videoId] || { dislikes: 25, likes: 100 };
      return {
        body: { ...counts, rating: 4.5 },
        delayMs: countDelayByVideo[videoId] || 0,
      };
    }

    if (record.method === "GET" && record.pathname === "/puzzle/registration") {
      return { body: ZERO_DIFFICULTY_PUZZLE };
    }

    if (record.method === "POST" && record.pathname === "/puzzle/registration") {
      return { body: true };
    }

    if (record.method === "POST" && record.pathname === "/interact/vote") {
      return { body: ZERO_DIFFICULTY_PUZZLE };
    }

    if (record.method === "POST" && record.pathname === "/interact/confirmVote") {
      return { body: true };
    }

    return null;
  }

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());

    if (["www.youtube.com", "m.youtube.com"].includes(url.hostname) && request.resourceType() === "document") {
      const isShorts = url.pathname.startsWith("/shorts/");
      const videoId = isShorts ? url.pathname.slice(8) || VIDEO_A : url.searchParams.get("v") || VIDEO_A;
      const isNavigationFixture = url.searchParams.get("rydNavigationFixture") === "1";
      const fixtureTemplate = isNavigationFixture ? NAVIGATION_FIXTURE : isShorts ? SHORTS_FIXTURE : WATCH_FIXTURE;
      const html = fixtureTemplate
        .replaceAll("__VIDEO_ID__", videoId)
        .replaceAll("__SECOND_VIDEO_ID__", VIDEO_B)
        .replaceAll("__VIDEO_LIKES__", String(countsByVideo[videoId]?.likes ?? 100))
        .replaceAll("__SECOND_VIDEO_LIKES__", String(countsByVideo[VIDEO_B]?.likes ?? 100))
        .replaceAll(
          "__DISLIKE_TEXT_MARKUP__",
          fixtureOptions.nativeDislikeText ? '<span id="text" role="text"></span>' : "",
        )
        .replaceAll("__FIXTURE_ROLE_ATTRIBUTE__", fixtureOptions.roleAttribute)
        .replaceAll("__INITIAL_PAGE_KIND__", isShorts ? "shorts" : url.pathname === "/watch" ? "watch" : "channel")
        .replaceAll(
          "__SHORTS_RENDERER_TAG__",
          url.hostname === "m.youtube.com" ? "ytm-like-button-renderer" : "ytd-like-button-renderer",
        )
        .replaceAll("__SIGNED_IN__", String(fixtureOptions.signedIn))
        .replaceAll("__INITIAL_BUTTONS__", String(fixtureOptions.initialButtons))
        .replaceAll("__INITIAL_STATE__", fixtureOptions.initialState);
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
      });
      return;
    }

    if (url.origin !== API_ORIGIN) {
      blockedRequests.push({
        method: request.method(),
        resourceType: request.resourceType(),
        url: request.url(),
      });
      await route.abort("blockedbyclient");
      return;
    }

    if (request.method() === "OPTIONS") {
      const requestedMethod = request.headers()["access-control-request-method"];
      const preflight = {
        method: request.method(),
        pathname: url.pathname,
        requestedMethod: requestedMethod ?? null,
        url: url.toString(),
      };
      if (!isAllowedApiPreflight(url.pathname, requestedMethod)) {
        blockedRequests.push({
          ...preflight,
          resourceType: request.resourceType(),
        });
        await route.abort("blockedbyclient");
        return;
      }
      preflightRequests.push(preflight);
      await route.fulfill({ status: 204, headers: jsonHeaders(), body: "" });
      return;
    }

    const record = {
      at: Date.now(),
      body: parseRequestBody(request),
      method: request.method(),
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      url: url.toString(),
    };
    requests.push(record);

    const plannedResponse = takePlannedResponse(record);
    const response = (plannedResponse ? await plannedResponse : plannedResponse) || defaultApiResponse(record);
    if (!response) {
      blockedRequests.push({
        method: request.method(),
        resourceType: request.resourceType(),
        url: request.url(),
      });
      await route.abort("blockedbyclient");
      return;
    }
    if (response.delayMs) await delay(response.delayMs);

    const body = response.body === undefined ? null : response.body;
    const responseStatus = response.status || 200;
    await route.fulfill({
      status: responseStatus,
      headers: { ...jsonHeaders(), ...(response.headers || {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    record.responseBody = body;
    record.responseStatus = responseStatus;
    record.respondedAt = Date.now();
  }

  return {
    blockedRequests,
    defer,
    enqueue,
    handle,
    preflightRequests,
    requests,
    requestsFor,
  };
}

async function installGmEnvironment(context, initialValues = {}) {
  await context.addInitScript(
    ({ initialValues: seededValues, storagePrefix }) => {
      if (!location.hostname.endsWith("youtube.com")) return;

      const storageKey = (key) => `${storagePrefix}${key}`;
      const read = (key, fallbackValue) => {
        const stored = localStorage.getItem(storageKey(key));
        if (stored === null) return fallbackValue;
        try {
          return JSON.parse(stored);
        } catch {
          return fallbackValue;
        }
      };
      const write = (key, value) => {
        if (value === undefined) localStorage.removeItem(storageKey(key));
        else localStorage.setItem(storageKey(key), JSON.stringify(value));
      };

      for (const [key, value] of Object.entries(seededValues)) {
        if (localStorage.getItem(storageKey(key)) === null) write(key, value);
      }

      globalThis.__gmCalls = [];
      const getValue = async (key, fallbackValue) => {
        globalThis.__gmCalls.push({ operation: "get", key });
        return read(key, fallbackValue);
      };
      const setValue = async (key, value) => {
        globalThis.__gmCalls.push({ operation: "set", key, value });
        write(key, value);
      };
      const deleteValue = async (key) => {
        globalThis.__gmCalls.push({ operation: "delete", key });
        localStorage.removeItem(storageKey(key));
      };
      const addStyle = (css) => {
        const style = document.createElement("style");
        style.dataset.rydGmStyle = "true";
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
      };

      globalThis.GM = { getValue, setValue, deleteValue, addStyle };
      globalThis.GM_getValue = getValue;
      globalThis.GM_setValue = setValue;
      globalThis.GM_deleteValue = deleteValue;
      globalThis.GM_addStyle = addStyle;
    },
    {
      initialValues,
      storagePrefix: "ryd-e2e-gm:",
    },
  );
}

async function installHermeticRoutes(context, backend) {
  await context.route("**/*", (route) => backend.handle(route));
}

async function openWatchFixture(page, videoId = VIDEO_A, { hostname = "www.youtube.com" } = {}) {
  await page.goto(`https://${hostname}/watch?v=${videoId}`, { waitUntil: "domcontentloaded" });
}

async function openShortsFixture(page, videoId = VIDEO_A, { hostname = "www.youtube.com" } = {}) {
  await page.goto(`https://${hostname}/shorts/${videoId}`, { waitUntil: "domcontentloaded" });
}

async function openNavigationFixture(
  page,
  { hostname = "www.youtube.com", pageKind = "channel", videoId = VIDEO_A } = {},
) {
  const marker = "rydNavigationFixture=1";
  const path =
    pageKind === "shorts"
      ? `/shorts/${videoId}?${marker}`
      : pageKind === "watch"
        ? `/watch?v=${videoId}&${marker}`
        : `/@FixtureChannel?${marker}`;
  await page.goto(`https://${hostname}${path}`, { waitUntil: "domcontentloaded" });
}

async function forbidUnsafeHtmlSinks(page) {
  await page.evaluate(() => {
    const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if (!innerHtmlDescriptor?.get || !innerHtmlDescriptor?.set) {
      throw new Error("Element.innerHTML descriptor is unavailable");
    }

    globalThis.__rydUnsafeHtmlSinkCalls = [];
    const reject = (sink) => {
      globalThis.__rydUnsafeHtmlSinkCalls.push(sink);
      throw new TypeError(`${sink} is forbidden by the Trusted Types fixture`);
    };

    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: innerHtmlDescriptor.configurable,
      enumerable: innerHtmlDescriptor.enumerable,
      get: innerHtmlDescriptor.get,
      set() {
        reject("Element.innerHTML");
      },
    });
    Element.prototype.insertAdjacentHTML = function () {
      reject("Element.insertAdjacentHTML");
    };
  });
}

function overrideBooleanOption(source, optionName, value) {
  const optionPattern = new RegExp(`${optionName}:\\s*(?:true|false)`, "g");
  const matches = source.match(optionPattern) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected one ${optionName} option in generated userscript, found ${matches.length}`);
  }
  return source.replace(optionPattern, `${optionName}: ${value}`);
}

function overrideColorOption(source, optionName, value) {
  const optionPattern =
    optionName === "colorTheme"
      ? /\bcolorTheme:\s*"[^"]*"/g
      : /\bcustomColors:\s*\{\s*light:\s*\{[^{}]*\},\s*dark:\s*\{[^{}]*\},?\s*\}/g;
  const matches = source.match(optionPattern) || [];
  if (matches.length !== 1) {
    throw new Error(`Expected one ${optionName} option in generated userscript, found ${matches.length}`);
  }
  return source.replace(optionPattern, `${optionName}: ${JSON.stringify(value)}`);
}

async function injectGeneratedUserscript(
  page,
  {
    artifactPath = GENERATED_USERSCRIPT,
    coloredBar,
    coloredThumbs,
    colorTheme,
    customColors,
    disableVoteSubmission = false,
    numberDisplayReformatLikes,
    rateBarEnabled,
  } = {},
) {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Generated userscript is missing: ${artifactPath}`);
  }

  if (
    !disableVoteSubmission &&
    rateBarEnabled === undefined &&
    coloredBar === undefined &&
    coloredThumbs === undefined &&
    colorTheme === undefined &&
    customColors === undefined &&
    numberDisplayReformatLikes === undefined
  ) {
    await page.addScriptTag({ path: artifactPath });
    return;
  }

  let source = fs.readFileSync(artifactPath, "utf8");
  if (disableVoteSubmission) {
    source = overrideBooleanOption(source, "disableVoteSubmission", true);
  }
  if (rateBarEnabled !== undefined) {
    source = overrideBooleanOption(source, "rateBarEnabled", rateBarEnabled);
  }
  if (coloredThumbs !== undefined) {
    source = overrideBooleanOption(source, "coloredThumbs", coloredThumbs);
  }
  if (coloredBar !== undefined) {
    source = overrideBooleanOption(source, "coloredBar", coloredBar);
  }
  if (colorTheme !== undefined) {
    source = overrideColorOption(source, "colorTheme", colorTheme);
  }
  if (customColors !== undefined) {
    source = overrideColorOption(source, "customColors", customColors);
  }
  if (numberDisplayReformatLikes !== undefined) {
    source = overrideBooleanOption(source, "numberDisplayReformatLikes", numberDisplayReformatLikes);
  }
  await page.addScriptTag({ content: source });
}

async function readGmValue(page, key) {
  return page.evaluate((storageKey) => globalThis.GM.getValue(storageKey, null), key);
}

module.exports = {
  API_ORIGIN,
  CREDENTIAL_KEY,
  GENERATED_USERSCRIPT,
  VIDEO_A,
  VIDEO_B,
  ZERO_DIFFICULTY_PUZZLE,
  createFakeBackend,
  forbidUnsafeHtmlSinks,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openNavigationFixture,
  openShortsFixture,
  openWatchFixture,
  readGmValue,
};
