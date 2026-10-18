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

function harness(privateContext) {
  const page = document.implementation.createHTMLDocument();
  const pageWindow = new EventTarget();
  pageWindow.location = new URL("https://www.youtube.com/watch?v=abcdefghijk");
  const buttons = page.createElement("div");
  const likeButton = page.createElement("div");
  const dislikeButton = page.createElement("div");
  const nativeLikeButton = page.createElement("button");
  const nativeDislikeButton = page.createElement("button");
  likeButton.append(nativeLikeButton);
  dislikeButton.append(nativeDislikeButton);
  buttons.append(likeButton, dislikeButton);
  page.body.append(buttons);
  const controls = {
    buttons,
    dislikeButton,
    dislikeTextContainer: page.createElement("span"),
    likeButton,
    nativeDislikeButton,
    nativeLikeButton,
    ready: true,
  };
  const storedData = { likes: 0, dislikes: 0, videoId: null, previousState: "NEUTRAL_STATE" };
  const storage = { onChanged: { addListener: jest.fn() } };
  const state = {
    NEUTRAL_STATE: "NEUTRAL_STATE",
    storedData,
    clearRenderedVoteState: jest.fn(),
    hasLoadedStateForVideo: (videoId) => storedData.videoId === videoId,
    initExtConfig: jest.fn(async () => undefined),
    isLikesDisabled: () => false,
    isShorts: () => false,
    restoreCurrentState: jest.fn(() => true),
    setInitialState: jest.fn(async () => {
      Object.assign(storedData, { likes: 100, dislikes: 10, videoId: "abcdefghijk" });
      return true;
    }),
  };
  let permissionChanged;
  const buttonFunctions = {
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
    },
    "./src/bar": { hasUsableRateBar: () => true },
    "./src/initialization-cycle": initializationCycle,
    "./src/patreon": { initPatreonFeatures: jest.fn() },
    "./src/discussion": { initDiscussion: jest.fn() },
    "./src/consent-prompt": { waitForCoreDataConsent: jest.fn(async () => true) },
    "./src/core-data-consent": {
      onCoreDataPermissionChanged: (listener) => {
        permissionChanged = listener;
      },
    },
    "./src/vote-data-request": {
      cancelObsoleteVoteDataRequests: jest.fn(),
      clearVoteDataRequestCache: jest.fn(),
    },
    "./src/private-browsing": { isPrivateBrowsingContext: () => privateContext },
    "../common/shorts-control-readiness": {},
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
    permissionChanged: (granted) => permissionChanged(granted),
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

test.each(["pagehide", "yt-navigate-start", "consent-loss"])(
  "clears private document count state on %s",
  async (eventName) => {
    const context = harness(true);
    await context.run();
    const requests = context.dependencies["./src/vote-data-request"];
    requests.clearVoteDataRequestCache.mockClear();
    if (eventName === "consent-loss") context.permissionChanged(false);
    else (eventName === "pagehide" ? context.pageWindow : context.page).dispatchEvent(new Event(eventName));
    expect(requests.clearVoteDataRequestCache).toHaveBeenCalled();
    expect(context.state.storedData).toEqual({ likes: 0, dislikes: 0, previousState: "NEUTRAL_STATE", videoId: null });
    expect(context.state.clearRenderedVoteState).toHaveBeenCalled();
  },
);

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
