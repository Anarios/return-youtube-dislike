/** @jest-environment jsdom */

import { readFileSync } from "fs";
import { join } from "path";
import { transformSync } from "@babel/core";
import * as initializationCycle from "./initialization-cycle";

const source = readFileSync(join(__dirname, "../ryd.content-script.js"), "utf8");
const executable = transformSync(source, {
  babelrc: false,
  configFile: false,
  plugins: [
    ({ types }) => ({
      visitor: {
        ImportDeclaration(path) {
          const bindings = path.node.specifiers.map(({ imported, local }) =>
            types.objectProperty(imported, local, false, imported.name === local.name),
          );
          path.replaceWith(
            types.variableDeclaration("const", [
              types.variableDeclarator(
                types.objectPattern(bindings),
                types.memberExpression(types.identifier("dependencies"), path.node.source, true),
              ),
            ]),
          );
        },
      },
    }),
  ],
}).code;
const execute = new Function(
  "dependencies",
  "window",
  "document",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
  "__RYD_LIVE_TEST_BUILD__",
  `return (async () => { ${executable} })();`,
);

function harness(
  privateContext,
  { firefox = false, counts = true, shorts = false, shortsNoDislike = false, dismissed = false } = {},
) {
  const page = document.implementation.createHTMLDocument();
  const pageWindow = new EventTarget();
  pageWindow.location = new URL(`https://www.youtube.com/${shorts ? "shorts/abcdefghijk" : "watch?v=abcdefghijk"}`);
  const buttons = page.createElement(shortsNoDislike ? "reel-action-bar-view-model" : "div");
  buttons.addEventListener("ryd-shorts-action-bar-hydration-request", () => {
    buttons.setAttribute("data-ryd-shorts-action-bar-hydrated", "true");
  });
  const likeButton = page.createElement("div");
  const dislikeButton = page.createElement("div");
  const nativeLikeButton = page.createElement("button");
  const nativeDislikeButton = page.createElement("button");
  likeButton.append(nativeLikeButton);
  dislikeButton.append(nativeDislikeButton);
  buttons.append(likeButton);
  if (!shortsNoDislike) buttons.append(dislikeButton);
  page.body.append(buttons);
  const controls = {
    buttons,
    dislikeButton: shortsNoDislike ? null : dislikeButton,
    dislikeTextContainer: shortsNoDislike ? null : page.createElement("span"),
    likeButton,
    nativeDislikeButton: shortsNoDislike ? null : nativeDislikeButton,
    nativeLikeButton,
    ready: !shortsNoDislike,
  };
  const storedData = { likes: 0, dislikes: 0, videoId: null, previousState: "NEUTRAL_STATE" };
  const storage = { onChanged: { addListener: jest.fn() } };
  const state = {
    NEUTRAL_STATE: "NEUTRAL_STATE",
    storedData,
    clearRenderedVoteState: jest.fn(),
    ensureRemoteSelectors: jest.fn(async () => true),
    remoteSelectorsSettled: jest.fn(async () => undefined),
    hasLoadedStateForVideo: (videoId) => storedData.videoId === videoId,
    initExtConfig: jest.fn(async () => undefined),
    isLikesDisabled: () => false,
    isShorts: () => shorts,
    restoreCurrentState: jest.fn(() => true),
    setInitialState: jest.fn(async () => {
      Object.assign(storedData, { likes: 100, dislikes: 10, videoId: "abcdefghijk" });
      return true;
    }),
  };
  let permissionsChanged;
  const hintState = { dismissed };
  const pageOfferEndedListeners = [];
  const hint = {
    syncPageOffer: jest.fn(),
    hidePageOffer: jest.fn(),
    canOfferOnPage: jest.fn(() => !hintState.dismissed),
    loadPageOfferDismissal: jest.fn(async () => hintState.dismissed),
    onPageOfferEnded: jest.fn((listener) => pageOfferEndedListeners.push(listener)),
  };
  const buttonFunctions = {
    captureShortsNativeControlInventory: () => ({ nativeLikeButton }),
    getButtons: () => controls.buttons,
    ensureSyntheticShortsDislikeButton: jest.fn(),
    getShortsControlSurfaceSignature: () => "stable",
    shortsControlSurfaceIsReadyForMutation: () => true,
    shortsNativeControlInventoryIsReadyForFallback: () => true,
    getButtonControls: () => controls,
    getDislikeTextContainer: () => controls.dislikeTextContainer,
    hasRenderedBox: () => true,
    markButtonsForVideo: jest.fn(),
    setSyntheticShortsDislikeEnabled: jest.fn(),
  };
  const dependencies = {
    "./src/buttons": buttonFunctions,
    "./src/state": state,
    "./src/utils": {
      getBrowser: () => ({ storage, runtime: { getURL: (path) => path } }),
      getVideoId: () => "abcdefghijk",
      isVideoLoaded: () => true,
    },
    "./src/events": {
      addLikeDislikeEventListener: jest.fn(),
      createSmartimationObserver: jest.fn(),
      storageChangeHandler: jest.fn(),
      observeColorTheme: jest.fn(),
      setCountPermissionAvailable: jest.fn(),
    },
    "./src/bar": { hasUsableRateBar: () => true },
    "./src/initialization-cycle": initializationCycle,
    "./src/patreon": { initPatreonFeatures: jest.fn() },
    "./src/discussion": { initDiscussion: jest.fn() },
    "./src/core-data-consent": {
      hasFeaturePermission: jest.fn(async () => counts),
      usesFirefoxDataCollectionConsent: () => firefox,
      onDataPermissionsChanged: (listener) => {
        permissionsChanged = listener;
      },
    },
    "./src/data-consent-prompt": { getDataConsentPrompt: jest.fn(() => hint) },
    "./src/vote-data-request": {
      cancelObsoleteVoteDataRequests: jest.fn(),
      clearVoteDataRequestCache: jest.fn(),
    },
    "./src/private-browsing": { isPrivateBrowsingContext: () => privateContext },
    "../common/shorts-control-readiness": {
      actionBarHasHydratedData: () => true,
      getShortsControlSurfaceStabilityMs: () => 0,
      shortsNativeControlInventoryMatches: () => true,
    },
  };
  const append = page.head.appendChild.bind(page.head);
  page.head.appendChild = (script) => {
    append(script);
    script.onload.call(script);
    return script;
  };
  return {
    buttonFunctions,
    dependencies,
    page,
    pageWindow,
    hint,
    dismissHint: () => {
      hintState.dismissed = true;
      pageOfferEndedListeners.forEach((listener) => listener());
    },
    permissionsChanged: (change) => permissionsChanged?.(change),
    run: () => execute(dependencies, pageWindow, page, setInterval, clearInterval, setTimeout, clearTimeout, false),
    state,
    storage,
  };
}

const flush = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test.each([false, true])(
  "initializes count display with context-specific account and storage setup (private=%s)",
  async (privateContext) => {
    const context = harness(privateContext);
    await context.run();
    expect(context.state.initExtConfig).toHaveBeenCalledTimes(1);
    expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
    expect(context.buttonFunctions.markButtonsForVideo).toHaveBeenCalledTimes(1);
    expect(context.storage.onChanged.addListener).toHaveBeenCalledTimes(privateContext ? 0 : 1);
    expect(context.dependencies["./src/patreon"].initPatreonFeatures).toHaveBeenCalledTimes(privateContext ? 0 : 1);
    expect(context.dependencies["./src/discussion"].initDiscussion).toHaveBeenCalledTimes(privateContext ? 0 : 1);
  },
);

test("missing Firefox count permission shows the control beside hydrated Shorts reactions", async () => {
  const context = harness(false, { firefox: true, counts: false, shorts: true });
  await context.run();
  expect(context.hint.syncPageOffer).toHaveBeenCalledWith(expect.objectContaining({ ready: true }), "abcdefghijk");
  expect(context.state.setInitialState).not.toHaveBeenCalled();
  expect(context.buttonFunctions.setSyntheticShortsDislikeEnabled).not.toHaveBeenCalled();
  expect(context.dependencies["./src/events"].addLikeDislikeEventListener).not.toHaveBeenCalled();
});

test("Shorts without a native Dislike show activation beside the stable Like without creating a vote button", async () => {
  const context = harness(false, { firefox: true, counts: false, shorts: true, shortsNoDislike: true });
  await context.run();
  expect(context.hint.syncPageOffer).not.toHaveBeenCalled();
  jest.advanceTimersByTime(500);
  await flush();
  expect(context.hint.syncPageOffer).toHaveBeenCalledWith(
    expect.objectContaining({ ready: true, nativeLikeButton: expect.any(HTMLElement), nativeDislikeButton: null }),
    "abcdefghijk",
  );
  expect(context.buttonFunctions.ensureSyntheticShortsDislikeButton).not.toHaveBeenCalled();
  expect(context.state.setInitialState).not.toHaveBeenCalled();
  expect(context.dependencies["./src/events"].addLikeDislikeEventListener).not.toHaveBeenCalled();
});

test.each(["pagehide", "yt-navigate-start"])("clears private document count state on %s", async (eventName) => {
  const context = harness(true);
  await context.run();
  const requests = context.dependencies["./src/vote-data-request"];
  requests.clearVoteDataRequestCache.mockClear();
  (eventName === "pagehide" ? context.pageWindow : context.page).dispatchEvent(new Event(eventName));
  expect(requests.clearVoteDataRequestCache).toHaveBeenCalled();
  expect(context.state.storedData).toEqual({ likes: 0, dislikes: 0, previousState: "NEUTRAL_STATE", videoId: null });
  expect(context.state.clearRenderedVoteState).toHaveBeenCalled();
});

test("optional vote permission changes do not pause count display", async () => {
  const context = harness(false);
  await context.run();
  context.permissionsChanged({ added: [], removed: ["websiteActivity"] });
  expect(context.state.storedData.videoId).toBe("abcdefghijk");
  expect(context.state.clearRenderedVoteState).not.toHaveBeenCalled();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
});

test.each(["added", "removed"])("refreshes counts when like-count permission is %s", async (change) => {
  const context = harness(false);
  await context.run();
  context.permissionsChanged({ added: [], removed: [], [change]: ["websiteContent"] });
  await flush();
  expect(context.dependencies["./src/vote-data-request"].clearVoteDataRequestCache).toHaveBeenCalled();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(2);
  expect(context.state.clearRenderedVoteState).not.toHaveBeenCalled();
});

test("private page exit suppresses late initialization and requests a fresh state on return", async () => {
  const context = harness(true);
  let resolveInitialState;
  context.state.setInitialState.mockImplementationOnce(() => new Promise((resolve) => (resolveInitialState = resolve)));
  const initialized = context.run();
  await flush();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
  context.pageWindow.dispatchEvent(new Event("pagehide"));
  resolveInitialState(true);
  await initialized;
  jest.advanceTimersByTime(1000);
  await flush();
  expect(context.buttonFunctions.markButtonsForVideo).not.toHaveBeenCalled();
  expect(context.buttonFunctions.setSyntheticShortsDislikeEnabled).not.toHaveBeenCalled();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(1);

  context.pageWindow.dispatchEvent(new Event("pageshow"));
  jest.advanceTimersByTime(500);
  await flush();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(2);
  expect(context.buttonFunctions.markButtonsForVideo).toHaveBeenCalledTimes(1);
});

test.each([false, true])(
  "missing Firefox counts permission stays quiet without retry polling (private=%s)",
  async (privateContext) => {
    const context = harness(privateContext, { firefox: true, counts: false });
    await context.run();
    jest.advanceTimersByTime(6000);
    await flush();
    expect(context.state.setInitialState).not.toHaveBeenCalled();
    expect(context.dependencies["./src/core-data-consent"].hasFeaturePermission).toHaveBeenCalledTimes(1);
    expect(context.dependencies["./src/events"].addLikeDislikeEventListener).not.toHaveBeenCalled();
    if (privateContext) expect(context.hint.syncPageOffer).not.toHaveBeenCalled();
    else expect(context.hint.syncPageOffer).toHaveBeenCalled();
    expect(context.dependencies["./src/data-consent-prompt"].getDataConsentPrompt).toHaveBeenCalledTimes(
      privateContext ? 0 : 1,
    );
    expect(jest.getTimerCount()).toBe(privateContext ? 0 : 1);
  },
);

test("a stored hint dismissal stops all polling while counts are off", async () => {
  const context = harness(false, { firefox: true, counts: false, dismissed: true });
  await context.run();
  expect(context.hint.loadPageOfferDismissal).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  context.hint.syncPageOffer.mockClear();
  jest.advanceTimersByTime(6000);
  await flush();
  expect(context.hint.syncPageOffer).not.toHaveBeenCalled();
  expect(context.state.setInitialState).not.toHaveBeenCalled();
});

test("dismissing the hint stops the polling and a later grant restarts count display", async () => {
  const context = harness(false, { firefox: true, counts: false });
  await context.run();
  expect(jest.getTimerCount()).toBe(1);
  context.dismissHint();
  expect(jest.getTimerCount()).toBe(0);
  context.hint.syncPageOffer.mockClear();
  jest.advanceTimersByTime(2000);
  await flush();
  expect(context.hint.syncPageOffer).not.toHaveBeenCalled();
  context.permissionsChanged({ added: ["browsingActivity"], removed: [] });
  await flush();
  expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(1);
});

test("a mid-page counts grant shows counts only after a slow selector load settles", async () => {
  const context = harness(false, { firefox: true, counts: false });
  await context.run();
  const order = [];
  let finishSelectors;
  const selectors = new Promise((resolve) => (finishSelectors = resolve));
  context.state.ensureRemoteSelectors.mockImplementation(() => selectors);
  context.state.remoteSelectorsSettled.mockImplementation(() => selectors);
  context.state.setInitialState.mockImplementation(async () => {
    order.push("counts");
    return true;
  });
  context.permissionsChanged({ added: ["browsingActivity"], removed: [] });
  await flush();
  jest.advanceTimersByTime(1500);
  await flush();
  expect(order).toEqual([]);
  order.push("selectors");
  finishSelectors(true);
  await flush();
  expect(order).toEqual(["selectors", "counts"]);
  expect(context.state.ensureRemoteSelectors).toHaveBeenCalledTimes(1);
});

test("a counts revocation does not fetch selectors", async () => {
  const context = harness(false, { firefox: true, counts: true });
  await context.run();
  context.permissionsChanged({ added: [], removed: ["browsingActivity"] });
  await flush();
  expect(context.state.ensureRemoteSelectors).not.toHaveBeenCalled();
});

test("a failed startup lookup is retried on navigation", async () => {
  const context = harness(false, { firefox: true, counts: false });
  await context.run();
  const permission = context.dependencies["./src/core-data-consent"].hasFeaturePermission;
  permission.mockResolvedValue(true);
  context.page.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(permission).toHaveBeenCalledTimes(2);
  expect(permission).toHaveBeenLastCalledWith("counts");
  expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
  expect(context.dependencies["./src/events"].setCountPermissionAvailable).toHaveBeenLastCalledWith(true);
  context.page.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(permission).toHaveBeenCalledTimes(2);
});

test("a navigation lookup that still finds no grant keeps counts off", async () => {
  const context = harness(false, { firefox: true, counts: false });
  await context.run();
  context.page.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(context.dependencies["./src/core-data-consent"].hasFeaturePermission).toHaveBeenCalledTimes(2);
  expect(context.state.setInitialState).not.toHaveBeenCalled();
});

test("Chrome and Safari never query counts permission on navigation", async () => {
  const context = harness(false);
  await context.run();
  context.page.dispatchEvent(new Event("yt-navigate-finish"));
  await flush();
  expect(context.dependencies["./src/core-data-consent"].hasFeaturePermission).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBeGreaterThan(0);
});

test.each([false, true])(
  "a Firefox count grant initializes the same page and revocation clears it (private=%s)",
  async (privateContext) => {
    const context = harness(privateContext, { firefox: true, counts: false });
    await context.run();
    context.permissionsChanged({ added: ["browsingActivity"], removed: [] });
    await flush();
    expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
    expect(context.state.storedData.videoId).toBe("abcdefghijk");
    context.permissionsChanged({ added: [], removed: ["browsingActivity"] });
    await flush();
    expect(context.state.clearRenderedVoteState).toHaveBeenCalled();
    expect(context.state.storedData).toEqual({ likes: 0, dislikes: 0, previousState: "NEUTRAL_STATE", videoId: null });
    expect(context.dependencies["./src/events"].setCountPermissionAvailable).toHaveBeenLastCalledWith(false);
    jest.advanceTimersByTime(5000);
    await flush();
    expect(context.state.setInitialState).toHaveBeenCalledTimes(1);
    expect(context.dependencies["./src/core-data-consent"].hasFeaturePermission).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(privateContext ? 0 : 1);
  },
);

test("a late count response after revocation cannot restore cached counts", async () => {
  const context = harness(false, { firefox: true });
  let finish;
  context.state.setInitialState.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  const running = context.run();
  await flush();
  context.permissionsChanged({ added: [], removed: ["browsingActivity"] });
  Object.assign(context.state.storedData, { likes: 200, dislikes: 50, videoId: "abcdefghijk" });
  finish(true);
  await running;
  expect(context.state.storedData.videoId).toBeNull();
  expect(context.state.storedData.likes).toBe(0);
  expect(context.buttonFunctions.markButtonsForVideo).not.toHaveBeenCalled();
});
