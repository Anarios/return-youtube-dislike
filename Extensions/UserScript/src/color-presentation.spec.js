/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/"}
 */

import { DEFAULT_CUSTOM_COLORS } from "../../common/color-themes";

jest.mock("../../common/vote-client", () => ({
  createVoteClient: () => ({ ensureRegistered: async () => undefined }),
}));

let userscript;
let extConfig;
let defaultOptions;
const originalFetch = globalThis.fetch;

const flushMutations = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function setRenderedBounds() {
  for (const element of document.body.querySelectorAll("*")) {
    element.getBoundingClientRect = () => ({
      top: 10,
      left: 10,
      bottom: 50,
      right: 110,
      width: 100,
      height: 40,
    });
  }
}

function mountWatch({ mobile = false } = {}) {
  userscript.__set__("isMobile", mobile);
  history.replaceState({}, "", "/watch?v=abcdefghijk");
  const pair = `
    <like-button-view-model><button aria-pressed="false">730</button></like-button-view-model>
    <dislike-button-view-model><button aria-pressed="false">12</button></dislike-button-view-model>`;
  const bar = `
    <div id="return-youtube-dislike-bar-container">
      <div id="return-youtube-dislike-bar" style="width:75%"></div>
    </div>`;
  document.body.innerHTML = mobile
    ? `<div class="slim-video-action-bar-actions"><div class="segmented-buttons">${pair}</div></div>`
    : `<div id="menu-container"><div id="top-level-buttons-computed">
        <segmented-like-dislike-button-view-model>${pair}</segmented-like-dislike-button-view-model>${bar}
      </div></div>`;
  setRenderedBounds();
  return {
    like: document.querySelector("like-button-view-model button"),
    dislike: document.querySelector("dislike-button-view-model button"),
    rateBar: document.querySelector("#return-youtube-dislike-bar-container"),
    rateBarFill: document.querySelector("#return-youtube-dislike-bar"),
  };
}

function mountShorts({ mobile = false, synthetic = false } = {}) {
  userscript.__set__("isMobile", mobile);
  history.replaceState({}, "", "/shorts/abcdefghijk");
  const dislikeHost = synthetic ? "div data-ryd-synthetic-shorts-dislike" : "dislike-button-view-model";
  const dislikeClosingTag = synthetic ? "div" : "dislike-button-view-model";
  const pair = `
    <like-button-view-model><button aria-pressed="true">730</button></like-button-view-model>
    <${dislikeHost}><button aria-pressed="false">12</button></${dislikeClosingTag}>`;
  document.body.innerHTML = mobile
    ? `<ytm-reel-video-renderer video-id="abcdefghijk"><ytm-like-button-renderer>${pair}</ytm-like-button-renderer></ytm-reel-video-renderer>`
    : `<ytd-reel-video-renderer video-id="abcdefghijk"><reel-action-bar-view-model>${pair}</reel-action-bar-view-model></ytd-reel-video-renderer>`;
  setRenderedBounds();
  return {
    like: document.querySelector("like-button-view-model button"),
    dislike: document.querySelector("dislike-button-view-model button, [data-ryd-synthetic-shorts-dislike] button"),
  };
}

beforeAll(() => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn();
  globalThis.__RYD_LIVE_TEST_BUILD__ = false;
  userscript = require("./userscript-entry").__RewireAPI__;
  extConfig = userscript.__get__("extConfig");
  defaultOptions = { ...extConfig };
  jest.clearAllTimers();
  jest.useRealTimers();
});

beforeEach(() => {
  Object.assign(extConfig, {
    colorTheme: "hibiscus",
    customColors: { light: { ...DEFAULT_CUSTOM_COLORS.light }, dark: { ...DEFAULT_CUSTOM_COLORS.dark } },
    coloredThumbs: true,
    coloredBar: true,
    rateBarEnabled: true,
  });
});

afterEach(async () => {
  userscript.__get__("thumbColorObserver")?.disconnect();
  userscript.__set__("thumbColorObserverHosts", []);
  userscript.__get__("shortsObserver")?.disconnect();
  userscript.__set__("shortsObserver", null);
  document.body.replaceChildren();
  document.documentElement.removeAttribute("dark");
  history.replaceState({}, "", "/");
  await flushMutations();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__RYD_LIVE_TEST_BUILD__;
});

test("retains the existing editable defaults and exposes separate custom palettes", () => {
  expect(defaultOptions.colorTheme).toBe("classic");
  expect(defaultOptions.coloredThumbs).toBe(false);
  expect(defaultOptions.coloredBar).toBe(false);
  expect(defaultOptions.customColors).toEqual(DEFAULT_CUSTOM_COLORS);
  expect(userscript.__get__("getColorFromTheme")(true)).toBe(DEFAULT_CUSTOM_COLORS.light.like);
  expect(extConfig.customColors).toEqual(DEFAULT_CUSTOM_COLORS);
  for (const [theme, like, dislike] of [
    ["classic", "lime", "red"],
    ["accessible", "dodgerblue", "gold"],
    ["neon", "aqua", "magenta"],
  ]) {
    extConfig.colorTheme = theme;
    expect(userscript.__get__("getColorFromTheme")(true)).toBe(like);
    expect(userscript.__get__("getColorFromTheme")(false)).toBe(dislike);
  }
});

test("recolors existing desktop thumbs and ratio when YouTube toggles an empty dark attribute", async () => {
  const { like, dislike, rateBar, rateBarFill } = mountWatch();
  userscript.__get__("refreshColorPresentation")();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#007600");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#b300b3");
  expect(rateBarFill.style.backgroundColor).toBe("rgb(0, 118, 0)");

  document.documentElement.setAttribute("dark", "");
  await flushMutations();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#00d000");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#ff77ff");
  expect(rateBar.style.backgroundColor).toBe("rgb(255, 119, 255)");
  expect(rateBarFill.style.backgroundColor).toBe("rgb(0, 208, 0)");
  expect(rateBarFill.style.width).toBe("75%");
  expect(like.textContent).toBe("730");
  expect(dislike.textContent).toBe("12");
  expect(globalThis.fetch).not.toHaveBeenCalled();

  document.documentElement.removeAttribute("dark");
  await flushMutations();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#007600");
  expect(rateBar.style.backgroundColor).toBe("rgb(179, 0, 179)");
});

test("uses each custom light/dark color on mobile controls", async () => {
  const { like, dislike } = mountWatch({ mobile: true });
  extConfig.colorTheme = "custom";
  extConfig.customColors = {
    light: { like: "#123456", dislike: "#654321" },
    dark: { like: "#abcdef", dislike: "#fedcba" },
  };
  userscript.__get__("refreshColorPresentation")();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#123456");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#654321");

  document.documentElement.setAttribute("dark", "");
  await flushMutations();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#abcdef");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#fedcba");
});

test("reapplies the selected custom palette to same-video replacement controls with cached counts", () => {
  mountWatch();
  extConfig.colorTheme = "custom";
  extConfig.customColors.light = { like: "#123456", dislike: "#654321" };
  extConfig.rateBarEnabled = false;
  userscript.__set__("countStateVideoId", "abcdefghijk");
  userscript.__set__("countStateLoaded", true);
  userscript.__set__("likesvalue", 730);
  userscript.__set__("dislikesvalue", 12);
  userscript.__get__("setState")();

  const { like, dislike } = mountWatch();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("");
  userscript.__get__("setState")();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#123456");
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#654321");
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([
  { mobile: false, synthetic: false },
  { mobile: false, synthetic: true },
  { mobile: true, synthetic: false },
])("recolors only the selected Shorts thumb and follows later selection changes (%j)", async (options) => {
  const { like, dislike } = mountShorts(options);
  userscript.__get__("refreshColorPresentation")();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#007600");
  expect(dislike.hasAttribute("data-ryd-thumb-color")).toBe(false);

  document.documentElement.setAttribute("dark", "");
  await flushMutations();
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#00d000");
  expect(dislike.hasAttribute("data-ryd-thumb-color")).toBe(false);

  like.setAttribute("aria-pressed", "false");
  dislike.setAttribute("aria-pressed", "true");
  await flushMutations();
  expect(like.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(dislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#ff77ff");
});

test.each([
  { mobile: false, shorts: false },
  { mobile: true, shorts: false },
  { mobile: false, shorts: true },
  { mobile: true, shorts: true },
  { mobile: false, shorts: true, synthetic: true },
])("restores native thumb colors when children change inside stable reaction hosts (%j)", async (options) => {
  const { like, dislike } = options.shorts ? mountShorts(options) : mountWatch(options);
  const likeHost = like.parentElement;
  const dislikeHost = dislike.parentElement;
  userscript.__get__("refreshColoredThumbs")();

  const nextLike = document.createElement("button");
  nextLike.setAttribute("aria-pressed", String(Boolean(options.shorts)));
  const nextDislike = document.createElement("button");
  nextDislike.setAttribute("aria-pressed", "false");
  like.replaceWith(nextLike);
  dislike.replaceWith(nextDislike);
  await flushMutations();

  expect(userscript.__get__("getLikeButton")()).toBe(likeHost);
  expect(userscript.__get__("getDislikeButton")()).toBe(dislikeHost);
  expect(nextLike.style.getPropertyValue("--ryd-thumb-color")).toBe("#007600");
  expect(nextDislike.style.getPropertyValue("--ryd-thumb-color")).toBe(options.shorts ? "" : "#b300b3");
  if (options.shorts) {
    nextLike.setAttribute("aria-pressed", "false");
    nextDislike.setAttribute("aria-pressed", "true");
    await flushMutations();
    expect(nextLike.hasAttribute("data-ryd-thumb-color")).toBe(false);
    expect(nextDislike.style.getPropertyValue("--ryd-thumb-color")).toBe("#b300b3");
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("leaves uncolored thumbs and ratio untouched on a live theme change", async () => {
  const { like, dislike, rateBar, rateBarFill } = mountWatch();
  extConfig.coloredThumbs = false;
  extConfig.coloredBar = false;
  document.documentElement.setAttribute("dark", "");
  await flushMutations();
  expect(like.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(dislike.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(rateBar.style.backgroundColor).toBe("");
  expect(rateBarFill.style.backgroundColor).toBe("");
});

test("targets native thumbs and removes only its own overrides when coloring is disabled", () => {
  const { like, dislike } = mountWatch();
  like.style.color = "purple";
  userscript.__get__("refreshColorPresentation")();
  expect(like.hasAttribute("data-ryd-thumb-color")).toBe(true);
  expect(dislike.hasAttribute("data-ryd-thumb-color")).toBe(true);
  expect(like.parentElement.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("#007600");

  extConfig.coloredThumbs = false;
  userscript.__get__("refreshColorPresentation")();
  expect(like.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(dislike.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(like.style.getPropertyValue("--ryd-thumb-color")).toBe("");
  expect(like.style.color).toBe("purple");
});
