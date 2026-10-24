/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");

const {
  HIDE_CLUTTER_ATTRIBUTE,
  SHORTS_HYDRATION_ATTRIBUTE,
  SHORTS_HYDRATION_REQUEST_EVENT,
  containsReactionButtonModel,
  convertTopLevelButtonToFlexibleItem,
  createClutterMenuData,
  createMenuUpdateGuard,
  fixYtdMenuRenderer,
  getMenuLayoutKey,
  installMenuFixer,
  keepAtMostFlexibleButtons,
  menuNeedsMoreOverflow,
} = require("../menu-fixer");

function makeController(optionalButtons = ["share", "save", "thanks"]) {
  return {
    flexAsTopLevelButtons: [...optionalButtons],
    maybeUpdateFlexibleMenuImpl: jest.fn(),
  };
}

function attachRenderer(controller, id = "menu") {
  const renderer = document.createElement("ytd-menu-renderer");
  renderer.id = id;
  Object.defineProperty(renderer, "polymerController", { configurable: true, value: controller });
  document.body.append(renderer);
  return renderer;
}

function makeCurrentMenuData() {
  const shareCommand = { serialCommand: { commands: [{ innertubeCommand: { shareEntityServiceEndpoint: {} } }] } };
  const reaction = {
    segmentedLikeDislikeButtonViewModel: {
      likeButtonViewModel: { accessibilityId: "id.video.like.button" },
      dislikeButtonViewModel: { accessibilityId: "id.video.dislike.button" },
    },
  };
  const share = {
    buttonViewModel: {
      accessibilityId: "id.video.share.button",
      accessibilityText: "Share",
      iconName: "SHARE",
      onTap: shareCommand,
      title: "Share",
      trackingParams: "share-tracking",
    },
  };
  const save = { menuFlexibleItemRenderer: { menuItem: { menuServiceItemRenderer: { text: "Save" } } } };
  return {
    data: {
      items: [{ menuServiceItemRenderer: { text: "Report" } }],
      topLevelButtons: [reaction, share],
      flexibleItems: [save],
    },
    reaction,
    save,
    share,
    shareCommand,
  };
}

async function flushMenuUpdates() {
  await Promise.resolve();
  await new Promise(window.requestAnimationFrame);
}

describe("menu fixer", () => {
  afterEach(() => {
    window[Symbol.for("return-youtube-dislike.menu-fixer.install-state")]?.stop();
    jest.restoreAllMocks();
    document.documentElement.removeAttribute(HIDE_CLUTTER_ATTRIBUTE);
    document.body.replaceChildren();
  });

  test("keeps all optional actions when they already fit", () => {
    const controller = makeController();
    const guarded = createMenuUpdateGuard(controller.maybeUpdateFlexibleMenuImpl, controller, {
      now: () => 10,
    });

    guarded();
    guarded();
    guarded();

    expect(controller.maybeUpdateFlexibleMenuImpl).toHaveBeenCalledTimes(2);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
  });

  test("reflects page-world Shorts action-bar hydration synchronously", () => {
    const actionBar = document.createElement("reel-action-bar-view-model");
    document.body.append(actionBar);
    const installation = installMenuFixer();

    actionBar.dispatchEvent(new Event(SHORTS_HYDRATION_REQUEST_EVENT));
    expect(actionBar.getAttribute(SHORTS_HYDRATION_ATTRIBUTE)).toBe("true");

    actionBar.data = null;
    actionBar.dispatchEvent(new Event(SHORTS_HYDRATION_REQUEST_EVENT));
    expect(actionBar.getAttribute(SHORTS_HYDRATION_ATTRIBUTE)).toBe("false");

    actionBar.data = { videoId: "PoolVid0001" };
    actionBar.dispatchEvent(new Event(SHORTS_HYDRATION_REQUEST_EVENT));
    expect(actionBar.getAttribute(SHORTS_HYDRATION_ATTRIBUTE)).toBe("true");

    installation.stop();
    actionBar.removeAttribute(SHORTS_HYDRATION_ATTRIBUTE);
    actionBar.data = null;
    actionBar.dispatchEvent(new Event(SHORTS_HYDRATION_REQUEST_EVENT));
    expect(actionBar.hasAttribute(SHORTS_HYDRATION_ATTRIBUTE)).toBe(false);
  });

  test("does not mistake YouTube's empty pre-initialization array for a fitted layout", () => {
    const controller = makeController([]);
    const original = jest.fn(() => {
      controller.flexAsTopLevelButtons = ["share", "save", "thanks"];
    });
    const guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    guarded();
    guarded();

    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
  });

  test("excludes the initial empty state when stabilizing a later layout cycle", () => {
    const controller = makeController([]);
    const original = jest
      .fn()
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = ["share", "save", "thanks", "download"];
      })
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = ["share", "save", "thanks"];
      })
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = ["share", "save", "thanks", "download"];
      });
    const guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    guarded();
    guarded();
    guarded();
    guarded();

    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
  });

  test("stabilizes an oscillation at the narrowest layout selected by YouTube", () => {
    const controller = makeController();
    const nativeLayouts = [
      ["share", "save"],
      ["share", "save", "thanks"],
    ];
    const original = jest.fn(() => {
      controller.flexAsTopLevelButtons = nativeLayouts.shift();
    });
    const guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    guarded();
    guarded();
    guarded();

    expect(original).toHaveBeenCalledTimes(2);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save"]);
  });

  test("uses current button models when a renderer is reused", () => {
    const oldSave = { id: "old-save" };
    const newSave = { id: "new-save" };
    const newThanks = { id: "new-thanks" };
    const controller = makeController([{ id: "old-share" }, oldSave]);
    const original = jest
      .fn()
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = [oldSave];
      })
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = [newSave, newThanks];
      });
    const guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    guarded();
    guarded();
    guarded();

    expect(controller.flexAsTopLevelButtons).toEqual([newSave]);
    expect(controller.flexAsTopLevelButtons).not.toContain(oldSave);
  });

  test("allows YouTube to measure again after the rapid-update window", () => {
    const controller = makeController();
    let currentTime = 10;
    const guarded = createMenuUpdateGuard(controller.maybeUpdateFlexibleMenuImpl, controller, {
      now: () => currentTime,
    });

    guarded();
    guarded();
    guarded();
    currentTime = 111;
    guarded();

    expect(controller.maybeUpdateFlexibleMenuImpl).toHaveBeenCalledTimes(3);
  });

  test("allows every monotonic native reduction needed to fit a narrow action row", () => {
    const controller = makeController(["share", "save", "thanks", "download"]);
    let guarded;
    const original = jest.fn(() => {
      if (controller.flexAsTopLevelButtons.length > 1) {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        return guarded();
      }
      return "fits";
    });
    guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    expect(guarded()).toBe("fits");

    expect(original).toHaveBeenCalledTimes(4);
    expect(controller.flexAsTopLevelButtons).toEqual(["share"]);
  });

  test("restores flexible actions before recalculating a wider layout in a later burst", () => {
    const allButtons = ["share", "save", "thanks", "download"];
    const controller = makeController(allButtons);
    let fittingButtonCount = 1;
    let currentTime = 10;
    let layoutKey = "490:42";
    let guarded;
    const original = jest.fn(() => {
      if (controller.flexAsTopLevelButtons.length > fittingButtonCount) {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        return guarded();
      }
      return "fits";
    });
    guarded = createMenuUpdateGuard(original, controller, {
      getLayoutKey: () => layoutKey,
      now: () => currentTime,
    });

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual(["share"]);

    fittingButtonCount = 3;
    currentTime = 200;
    layoutKey = "888:42";
    expect(guarded()).toBe("fits");

    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
  });

  test("restores flexible actions after same-video menu data identity churn", () => {
    const allButtons = ["save", "thanks", "download"];
    const controller = { ...makeController(allButtons), data: { revision: 1 } };
    let fittingButtonCount = 0;
    let currentTime = 10;
    let guarded;
    const original = jest.fn(() => {
      if (controller.flexAsTopLevelButtons.length > fittingButtonCount) {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        return guarded();
      }
      return "fits";
    });
    guarded = createMenuUpdateGuard(original, controller, {
      getContextKey: () => "watch:video-a",
      now: () => currentTime,
    });

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual([]);

    controller.data = { revision: 2 };
    fittingButtonCount = 2;
    currentTime = 200;
    expect(guarded()).toBe("fits");

    expect(controller.flexAsTopLevelButtons).toEqual(["save", "thanks"]);
  });

  test("starts a fresh fit immediately when the rendered action width changes during a continuous update burst", () => {
    const allButtons = ["save", "thanks", "download"];
    const controller = makeController(allButtons);
    let fittingButtonCount = 0;
    let layoutKey = "490:42";
    let guarded;
    const original = jest.fn(() => {
      if (controller.flexAsTopLevelButtons.length > fittingButtonCount) {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        return guarded();
      }
      return "fits";
    });
    guarded = createMenuUpdateGuard(original, controller, {
      getContextKey: () => "watch:video-a",
      getLayoutKey: () => layoutKey,
      now: () => 10,
    });

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual([]);

    fittingButtonCount = 2;
    layoutKey = "888:40";
    expect(guarded()).toBe("fits");

    expect(controller.flexAsTopLevelButtons).toEqual(["save", "thanks"]);
  });

  test("does not restore flexible actions retained for a different video", () => {
    const controller = { ...makeController(["old-save", "old-thanks"]), data: { revision: 1 } };
    let contextKey = "watch:video-a";
    let currentTime = 10;
    const original = jest.fn();
    const guarded = createMenuUpdateGuard(original, controller, {
      getContextKey: () => contextKey,
      now: () => currentTime,
    });

    guarded();
    controller.flexAsTopLevelButtons = [];
    controller.data = { revision: 2 };
    contextKey = "watch:video-b";
    currentTime = 200;
    guarded();

    expect(controller.flexAsTopLevelButtons).toEqual([]);
  });

  test("does not restore stale flexible actions after YouTube replaces the menu model", () => {
    const firstData = { videoId: "first" };
    const secondData = { videoId: "second" };
    const controller = { ...makeController(["old-save", "old-thanks"]), data: firstData };
    let currentTime = 10;
    const original = jest.fn();
    const guarded = createMenuUpdateGuard(original, controller, { now: () => currentTime });

    guarded();
    controller.flexAsTopLevelButtons = ["old-save"];

    controller.data = secondData;
    controller.flexAsTopLevelButtons = ["new-save"];
    currentTime = 200;
    guarded();

    expect(controller.flexAsTopLevelButtons).toEqual(["new-save"]);
    expect(controller.flexAsTopLevelButtons).not.toContain("old-thanks");
  });

  test("allows one same-state retry to react to a new width measurement", () => {
    const controller = makeController(["share", "save", "thanks", "download"]);
    let guarded;
    const original = jest
      .fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        controller.flexAsTopLevelButtons = ["share", "save", "thanks"];
        return guarded();
      })
      .mockImplementationOnce(() => "fits");
    guarded = createMenuUpdateGuard(original, controller, { now: () => 10 });

    guarded();
    expect(guarded()).toBe("fits");

    expect(original).toHaveBeenCalledTimes(3);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
  });

  test("does not restore a safe prefix for a delayed same-layout refresh but restores it after expansion", () => {
    const controller = makeController(["share", "save"]);
    let currentTime = 10;
    let layoutKey = "388.3:42.4";
    let nativeFitEnabled = true;
    let guarded;
    const original = jest.fn(() => {
      if (nativeFitEnabled && controller.flexAsTopLevelButtons.length > 0) {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        return guarded();
      }
      return "fits";
    });
    guarded = createMenuUpdateGuard(original, controller, {
      getLayoutKey: () => layoutKey,
      now: () => currentTime,
    });

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual([]);

    nativeFitEnabled = false;
    currentTime = 250;
    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual([]);

    layoutKey = "600:42.4";
    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save"]);
  });

  test("overflows one additional flexible action per unsafe rendered layout", () => {
    const controller = makeController(["share", "save"]);
    let needsMoreOverflow = true;
    const guarded = createMenuUpdateGuard(
      jest.fn(() => "fits"),
      controller,
      {
        needsMoreOverflow: () => needsMoreOverflow,
        now: () => 10,
      },
    );

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual(["share"]);
    expect(guarded.enforceLayout()).toBe(true);
    expect(controller.flexAsTopLevelButtons).toEqual([]);
    expect(guarded.enforceLayout()).toBe(false);

    needsMoreOverflow = false;
    expect(guarded.enforceLayout()).toBe(false);
    expect(controller.flexAsTopLevelButtons).toEqual([]);
  });

  test("waits for updated geometry when the native fitter already removed an action", () => {
    const controller = makeController(["share", "save"]);
    let renderedLayoutNeedsMoreOverflow = true;
    const guarded = createMenuUpdateGuard(
      jest.fn(() => {
        controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, -1);
        renderedLayoutNeedsMoreOverflow = false;
        return "fits";
      }),
      controller,
      {
        needsMoreOverflow: () => renderedLayoutNeedsMoreOverflow,
        now: () => 10,
      },
    );

    expect(guarded()).toBe("fits");
    expect(controller.flexAsTopLevelButtons).toEqual(["share"]);
    expect(guarded.enforceLayout()).toBe(false);
  });

  test("preserves return values and rejections from native updates", async () => {
    const controller = makeController();
    const expectedError = new Error("layout failed");
    const resolved = createMenuUpdateGuard(jest.fn().mockResolvedValue("done"), controller, { now: () => 10 });
    const rejected = createMenuUpdateGuard(jest.fn().mockRejectedValue(expectedError), controller, {
      now: () => 200,
    });

    await expect(resolved()).resolves.toBe("done");
    await expect(rejected()).rejects.toBe(expectedError);
  });

  test("hide-clutter mode moves every optional action into overflow without calling native layout", () => {
    const { data, reaction, save, share, shareCommand } = makeCurrentMenuData();
    const controller = { ...makeController(), data };
    const original = jest.fn();
    const guarded = createMenuUpdateGuard(original, controller, {
      isHideClutterEnabled: () => true,
      now: () => 10,
    });

    guarded();

    expect(original).not.toHaveBeenCalled();
    expect(controller.flexAsTopLevelButtons).toEqual([]);
    expect(controller.data).not.toBe(data);
    expect(controller.data.topLevelButtons).toEqual([reaction]);
    expect(controller.data.flexibleItems).toHaveLength(2);
    expect(controller.data.flexibleItems[0]).toEqual({
      menuFlexibleItemRenderer: {
        menuItem: {
          menuServiceItemRenderer: {
            icon: { iconType: "SHARE" },
            serviceEndpoint: shareCommand,
            text: { runs: [{ text: "Share" }] },
            trackingParams: "share-tracking",
          },
        },
        topLevelButton: share,
      },
    });
    expect(controller.data.flexibleItems[1]).toBe(save);
  });

  test("recognizes current and legacy reaction models without treating Share as a reaction", () => {
    expect(containsReactionButtonModel({ segmentedLikeDislikeButtonViewModel: {} })).toBe(true);
    expect(containsReactionButtonModel({ toggleButtonRenderer: { defaultIcon: { iconType: "DISLIKE" } } })).toBe(true);
    expect(containsReactionButtonModel({ buttonViewModel: { accessibilityId: "id.video.like.button" } })).toBe(true);
    expect(containsReactionButtonModel({ buttonViewModel: { iconName: "SHARE" } })).toBe(false);
  });

  test("does not hide a fixed button when it cannot be represented losslessly in overflow", () => {
    const reaction = { segmentedLikeDislikeButtonViewModel: {} };
    const unknown = { buttonViewModel: { title: "Unknown", iconName: "UNKNOWN" } };
    const data = { topLevelButtons: [reaction, unknown], flexibleItems: [] };

    expect(createClutterMenuData(data)).toMatchObject({
      topLevelButtons: [reaction, unknown],
      flexibleItems: [],
    });
    expect(convertTopLevelButtonToFlexibleItem(unknown)).toBeNull();
  });

  test("keeps fixed optional actions flexible when hide-clutter is disabled", () => {
    const { data, reaction, share } = makeCurrentMenuData();
    const controller = { ...makeController(), data };
    let hideClutter = true;
    const original = jest.fn();
    const guarded = createMenuUpdateGuard(original, controller, {
      isHideClutterEnabled: () => hideClutter,
      now: () => 10,
    });

    guarded();
    expect(controller.data).not.toBe(data);
    hideClutter = false;
    guarded.applyPreference();

    expect(controller.data).not.toBe(data);
    expect(controller.data.topLevelButtons).toEqual([reaction]);
    expect(controller.data.flexibleItems[0].menuFlexibleItemRenderer.topLevelButton).toBe(share);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
    expect(original).toHaveBeenCalledTimes(1);
  });

  test("lets native fitting overflow a Share button that YouTube supplied as fixed", () => {
    const { data, reaction, save, share } = makeCurrentMenuData();
    const shareElement = { id: "share" };
    const saveElement = { id: "save" };
    let currentData = data;
    let flexibleButtons = [saveElement];
    const controller = { maybeUpdateFlexibleMenuImpl: jest.fn() };
    Object.defineProperty(controller, "data", {
      configurable: true,
      get: () => currentData,
      set: (value) => {
        currentData = value;
        flexibleButtons = value.flexibleItems.map((item) =>
          item?.menuFlexibleItemRenderer?.topLevelButton === share ? shareElement : saveElement,
        );
      },
    });
    Object.defineProperty(controller, "flexAsTopLevelButtons", {
      configurable: true,
      get: () => flexibleButtons,
      set: (value) => {
        flexibleButtons = [...value];
      },
    });
    const nativeFit = jest.fn(() => {
      controller.flexAsTopLevelButtons = [];
    });
    const guarded = createMenuUpdateGuard(nativeFit, controller, {
      isHideClutterEnabled: () => false,
      now: () => 10,
    });

    guarded();

    expect(controller.data.topLevelButtons).toEqual([reaction]);
    expect(controller.data.flexibleItems).toHaveLength(2);
    expect(controller.data.flexibleItems[0].menuFlexibleItemRenderer.topLevelButton).toBe(share);
    expect(controller.data.flexibleItems[1]).toBe(save);
    expect(nativeFit).toHaveBeenCalledTimes(1);
    expect(controller.flexAsTopLevelButtons).toEqual([]);
  });

  test("does not restore a stale video model while normalizing replacement data", () => {
    const first = makeCurrentMenuData().data;
    const secondFixture = makeCurrentMenuData();
    const second = secondFixture.data;
    second.videoId = "second-video";
    const controller = { ...makeController(), data: first };
    let hideClutter = true;
    const guarded = createMenuUpdateGuard(jest.fn(), controller, {
      isHideClutterEnabled: () => hideClutter,
      now: () => 10,
    });

    guarded();
    controller.data = second;
    hideClutter = false;
    guarded.applyPreference();

    expect(controller.data).not.toBe(first);
    expect(controller.data).not.toBe(second);
    expect(controller.data.videoId).toBe("second-video");
    expect(controller.data.topLevelButtons).toEqual([secondFixture.reaction]);
    expect(controller.data.flexibleItems[0].menuFlexibleItemRenderer.topLevelButton).toBe(secondFixture.share);
  });

  test("reapplies hide-clutter to replacement menu data during SPA navigation", async () => {
    document.documentElement.setAttribute(HIDE_CLUTTER_ATTRIBUTE, "true");
    const first = makeCurrentMenuData().data;
    const secondFixture = makeCurrentMenuData();
    secondFixture.data.videoId = "second-video";
    const controller = { ...makeController(), data: first };
    const renderer = attachRenderer(controller);
    const installation = installMenuFixer();

    controller.data = secondFixture.data;
    renderer.append(document.createElement("span"));
    await flushMenuUpdates();

    expect(controller.data).not.toBe(secondFixture.data);
    expect(controller.data.videoId).toBe("second-video");
    expect(controller.data.topLevelButtons).toEqual([secondFixture.reaction]);
    expect(controller.data.flexibleItems[0].menuFlexibleItemRenderer.topLevelButton).toBe(secondFixture.share);

    installation.stop();
  });

  test("only truncates flexible actions when the requested limit is smaller", () => {
    const controller = makeController();
    const originalArray = controller.flexAsTopLevelButtons;

    keepAtMostFlexibleButtons(controller, 4);
    expect(controller.flexAsTopLevelButtons).toBe(originalArray);

    keepAtMostFlexibleButtons(controller, 2);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save"]);
  });

  test("patches each initialized renderer once and retries renderers whose controller is not ready", () => {
    const controller = makeController();
    const renderer = attachRenderer(controller);
    const original = controller.maybeUpdateFlexibleMenuImpl;

    expect(fixYtdMenuRenderer(renderer)).toBe(true);
    const firstGuard = controller.maybeUpdateFlexibleMenuImpl;
    expect(firstGuard).not.toBe(original);
    expect(fixYtdMenuRenderer(renderer)).toBe(true);
    expect(controller.maybeUpdateFlexibleMenuImpl).toBe(firstGuard);

    const pendingRenderer = attachRenderer(undefined, "pending-menu");
    expect(fixYtdMenuRenderer(pendingRenderer)).toBe(false);
    Object.defineProperty(pendingRenderer, "polymerController", { configurable: true, value: makeController() });
    expect(fixYtdMenuRenderer(pendingRenderer)).toBe(true);
  });

  test("uses the outer action allocation as the layout key", () => {
    const actions = document.createElement("div");
    actions.id = "actions";
    actions.getBoundingClientRect = () => ({ height: 42, width: 490 });
    const renderer = document.createElement("ytd-menu-renderer");
    actions.append(renderer);
    document.body.append(actions);

    expect(getMenuLayoutKey(renderer)).toBe("490:42");
  });

  test("detects clipped and wrapped action layouts without treating the menu shell as an action", () => {
    const renderer = document.createElement("ytd-menu-renderer");
    renderer.innerHTML = `
      <div id="top-level-buttons-computed"><button type="button">Like and Dislike</button></div>
      <div id="flexible-item-buttons"><yt-button-view-model><button type="button">Share</button></yt-button-view-model></div>
      <yt-button-shape><button type="button">More</button></yt-button-shape>`;
    document.body.append(renderer);
    const surface = renderer.querySelector("#top-level-buttons-computed");
    const flexibleHost = renderer.querySelector("#flexible-item-buttons > *");
    const flexibleButton = flexibleHost.querySelector("button");
    const moreButton = renderer.querySelector("yt-button-shape button");
    const setBox = (element, { height = 40, width, x, y }) => {
      element.getBoundingClientRect = () => ({
        bottom: y + height,
        height,
        left: x,
        right: x + width,
        top: y,
        width,
        x,
        y,
      });
    };
    setBox(renderer, { height: 44, width: 404, x: 0, y: 100 });
    setBox(surface, { width: 220, x: 100, y: 100 });
    setBox(surface.querySelector("button"), { width: 220, x: 100, y: 100 });
    setBox(flexibleHost, { width: 120, x: 328, y: 144 });
    setBox(flexibleButton, { width: 120, x: 328, y: 144 });
    setBox(moreButton, { width: 40, x: 456, y: 144 });

    expect(menuNeedsMoreOverflow(renderer, { viewportWidth: 800 })).toBe(true);

    setBox(flexibleHost, { width: 120, x: 328, y: 100 });
    setBox(flexibleButton, { width: 120, x: 328, y: 100 });
    setBox(moreButton, { width: 40, x: 456, y: 100 });
    expect(menuNeedsMoreOverflow(renderer, { viewportWidth: 800 })).toBe(false);

    setBox(surface, { width: 220, x: -25, y: 100 });
    expect(menuNeedsMoreOverflow(renderer, { viewportWidth: 390 })).toBe(true);
  });

  test("recenters the narrow Watch action allocation inside the observed oversized mobile row", () => {
    const stylesheet = fs.readFileSync(path.join(__dirname, "../content-style.css"), "utf8");
    const narrowRule = stylesheet.match(/@media \(max-width: 480px\) \{\s*([^{}]+)\{([^{}]+)\}\s*\}/);
    expect(narrowRule).not.toBeNull();

    const [, selectors, declarations] = narrowRule;
    expect(selectors).toContain(
      ":is(ytd-watch-flexy, ytd-watch-grid)[video-id] #top-row ytd-menu-renderer.ytd-watch-metadata",
    );
    expect(selectors).toContain(":is(ytd-watch-flexy, ytd-watch-grid)[video-id] #top-row #actions");
    expect(selectors).toContain(":is(ytd-watch-flexy, ytd-watch-grid)[video-id] #top-row #actions-inner");
    expect(declarations).toContain("box-sizing: border-box");
    expect(declarations).toContain("margin-inline: auto !important");
    expect(declarations).toContain("min-width: 0 !important");
    expect(declarations).toContain("width: 100% !important");

    const horizontalGutter = Number(declarations.match(/max-width: calc\(100vw - (\d+)px\) !important/)?.[1]);
    expect(horizontalGutter).toBe(24);

    // Exact geometry from the authenticated 390px failure. Auto inline margins
    // center the capped allocation within YouTube's oversized native row.
    const viewportWidth = 390;
    const nativeTopRow = { width: 426.663, x: -25.725 };
    const constrainedWidth = viewportWidth - horizontalGutter;
    const constrainedX = nativeTopRow.x + (nativeTopRow.width - constrainedWidth) / 2;
    expect(constrainedX).toBeGreaterThanOrEqual(0);
    expect(constrainedX + constrainedWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test("observes hide-clutter preference changes and restores native fitting when disabled", async () => {
    const controller = makeController();
    const original = controller.maybeUpdateFlexibleMenuImpl;
    attachRenderer(controller);
    const installation = installMenuFixer();
    expect(original).toHaveBeenCalledTimes(1);

    document.documentElement.setAttribute(HIDE_CLUTTER_ATTRIBUTE, "true");
    await flushMenuUpdates();
    expect(controller.flexAsTopLevelButtons).toEqual([]);

    document.documentElement.setAttribute(HIDE_CLUTTER_ATTRIBUTE, "false");
    await flushMenuUpdates();
    expect(original).toHaveBeenCalledTimes(2);
    expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);

    installation.stop();
  });

  test("reuses ancestor styles and element rectangles only within an overflow measurement", () => {
    const renderer = document.createElement("ytd-menu-renderer");
    renderer.innerHTML = `
      <div id="top-level-buttons-computed"></div>
      <div id="flexible-item-buttons"><span></span></div>
      <button type="button">More</button>`;
    document.body.append(renderer);
    const surface = renderer.querySelector("#top-level-buttons-computed");
    const flexibleHost = renderer.querySelector("#flexible-item-buttons > *");
    const moreButton = renderer.querySelector("button");
    for (const element of [surface, flexibleHost, moreButton]) {
      element.getBoundingClientRect = jest.fn(() => ({ height: 40, left: 0, right: 40, top: 0, width: 40 }));
    }
    const styles = jest.spyOn(window, "getComputedStyle");

    expect(menuNeedsMoreOverflow(renderer, { viewportWidth: 800 })).toBe(false);
    expect(styles.mock.calls.filter(([element]) => element === renderer)).toHaveLength(1);
    for (const element of [surface, flexibleHost, moreButton]) {
      expect(element.getBoundingClientRect).toHaveBeenCalledTimes(1);
    }

    flexibleHost.getBoundingClientRect.mockReturnValue({ height: 40, left: 0, right: 40, top: 40, width: 40 });
    expect(menuNeedsMoreOverflow(renderer, { viewportWidth: 800 })).toBe(true);
    expect(styles.mock.calls.filter(([element]) => element === renderer)).toHaveLength(2);
    for (const element of [surface, flexibleHost, moreButton]) {
      expect(element.getBoundingClientRect).toHaveBeenCalledTimes(2);
    }
  });

  test.each(["display: none", "visibility: hidden", "visibility: collapse", "opacity: 0"])(
    "does not measure actions below an ancestor with %s",
    (style) => {
      const renderer = document.createElement("ytd-menu-renderer");
      renderer.style.cssText = style;
      renderer.innerHTML = '<div id="top-level-buttons-computed"></div>';
      document.body.append(renderer);
      const surface = renderer.firstElementChild;
      surface.getBoundingClientRect = jest.fn();

      expect(menuNeedsMoreOverflow(renderer)).toBe(false);
      expect(surface.getBoundingClientRect).not.toHaveBeenCalled();
    },
  );

  describe("targeted observer updates", () => {
    let frames;
    let resizeObservers;
    let originalResizeObserver;

    beforeEach(() => {
      frames = new Map();
      resizeObservers = [];
      let nextFrameId = 0;
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
      });
      jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => frames.delete(id));
      originalResizeObserver = global.ResizeObserver;
      global.ResizeObserver = jest.fn().mockImplementation((callback) => {
        const observer = {
          callback,
          disconnect: jest.fn(),
          observe: jest.fn(),
          unobserve: jest.fn(),
        };
        resizeObservers.push(observer);
        return observer;
      });
    });

    afterEach(() => {
      window[Symbol.for("return-youtube-dislike.menu-fixer.install-state")]?.stop();
      global.ResizeObserver = originalResizeObserver;
    });

    async function flushObserverUpdates() {
      await Promise.resolve();
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
      await Promise.resolve();
    }

    test("does no menu or document-wide work for unrelated DOM mutations", async () => {
      const controllers = Array.from({ length: 20 }, () => makeController());
      controllers.forEach((controller) => attachRenderer(controller));
      const comments = document.createElement("section");
      document.body.append(comments);
      installMenuFixer();
      const layoutChecks = controllers.map((controller) =>
        jest.spyOn(controller.maybeUpdateFlexibleMenuImpl, "enforceLayout"),
      );
      const documentQuery = jest.spyOn(document, "querySelectorAll");
      const rootQuery = jest.spyOn(document.documentElement, "querySelectorAll");
      resizeObservers[0].observe.mockClear();

      for (let i = 0; i < 100; i++) {
        const comment = document.createElement("div");
        comment.innerHTML = "<span>Unrelated comment</span>";
        comments.append(comment);
        await Promise.resolve();
      }
      await flushObserverUpdates();

      expect(documentQuery).not.toHaveBeenCalled();
      expect(rootQuery).not.toHaveBeenCalled();
      layoutChecks.forEach((check) => expect(check).not.toHaveBeenCalled());
      expect(resizeObservers[0].observe).not.toHaveBeenCalled();
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });

    test("coalesces repeated mutations into one check of the affected renderer", async () => {
      const first = makeController();
      const second = makeController();
      const renderer = attachRenderer(first);
      attachRenderer(second);
      installMenuFixer();
      const firstCheck = jest.spyOn(first.maybeUpdateFlexibleMenuImpl, "enforceLayout");
      const secondCheck = jest.spyOn(second.maybeUpdateFlexibleMenuImpl, "enforceLayout");

      for (let i = 0; i < 3; i++) {
        renderer.append(document.createElement("span"));
        await Promise.resolve();
      }
      expect(firstCheck).not.toHaveBeenCalled();
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
      await flushObserverUpdates();

      expect(firstCheck).toHaveBeenCalledTimes(1);
      expect(secondCheck).not.toHaveBeenCalled();
      expect(resizeObservers[0].observe).toHaveBeenCalledTimes(2);
    });

    test("discovers menus in added subtrees and retries delayed controller initialization", async () => {
      installMenuFixer();
      const container = document.createElement("section");
      container.innerHTML = "<div><ytd-menu-renderer></ytd-menu-renderer></div>";
      const renderer = container.querySelector("ytd-menu-renderer");
      document.body.append(container);
      await flushObserverUpdates();
      const controller = makeController();
      const nativeFit = controller.maybeUpdateFlexibleMenuImpl;
      renderer.polymerController = controller;

      document.body.append(document.createElement("span"));
      await flushObserverUpdates();

      expect(controller.maybeUpdateFlexibleMenuImpl).not.toBe(nativeFit);
      expect(nativeFit).toHaveBeenCalledTimes(1);
      expect(resizeObservers[0].observe).toHaveBeenCalledTimes(1);
    });

    test("refreshes only resized allocations and merges resize with pending mutations", async () => {
      const first = makeController();
      const second = makeController();
      const renderer = attachRenderer(first);
      attachRenderer(second);
      installMenuFixer();
      const firstRefresh = jest.spyOn(first.maybeUpdateFlexibleMenuImpl, "refreshLayout");
      const secondRefresh = jest.spyOn(second.maybeUpdateFlexibleMenuImpl, "refreshLayout");
      const firstCheck = jest.spyOn(first.maybeUpdateFlexibleMenuImpl, "enforceLayout");

      renderer.append(document.createElement("span"));
      await Promise.resolve();
      resizeObservers[0].callback([{ target: renderer }]);
      resizeObservers[0].callback([{ target: renderer }]);
      await flushObserverUpdates();

      expect(firstRefresh).toHaveBeenCalledTimes(1);
      expect(firstCheck).not.toHaveBeenCalled();
      expect(secondRefresh).not.toHaveBeenCalled();
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    test("forgets removed subtrees and does not update a disconnected renderer", async () => {
      const controller = makeController();
      const renderer = attachRenderer(controller);
      const container = document.createElement("section");
      container.append(renderer);
      document.body.append(container);
      installMenuFixer();
      const check = jest.spyOn(controller.maybeUpdateFlexibleMenuImpl, "enforceLayout");

      renderer.append(document.createElement("span"));
      await Promise.resolve();
      container.remove();
      await flushObserverUpdates();
      resizeObservers[0].callback([{ target: renderer }]);
      await flushObserverUpdates();

      expect(resizeObservers[0].unobserve).toHaveBeenCalledWith(renderer);
      expect(check).not.toHaveBeenCalled();
      expect(frames.size).toBe(0);
    });

    test("observes shared allocations once and releases them after the last renderer leaves", async () => {
      const actions = document.createElement("div");
      actions.id = "actions";
      const first = makeController();
      const second = makeController();
      const firstRenderer = attachRenderer(first);
      const secondRenderer = attachRenderer(second);
      actions.append(firstRenderer, secondRenderer);
      document.body.append(actions);
      installMenuFixer();
      const firstRefresh = jest.spyOn(first.maybeUpdateFlexibleMenuImpl, "refreshLayout");
      const secondRefresh = jest.spyOn(second.maybeUpdateFlexibleMenuImpl, "refreshLayout");

      resizeObservers[0].callback([{ target: actions }]);
      await flushObserverUpdates();
      expect(firstRefresh).toHaveBeenCalledTimes(1);
      expect(secondRefresh).toHaveBeenCalledTimes(1);
      expect(resizeObservers[0].observe).toHaveBeenCalledTimes(1);

      firstRenderer.remove();
      await flushObserverUpdates();
      expect(resizeObservers[0].unobserve).not.toHaveBeenCalled();
      secondRenderer.remove();
      await flushObserverUpdates();
      expect(resizeObservers[0].unobserve).toHaveBeenCalledTimes(1);
      expect(resizeObservers[0].unobserve).toHaveBeenCalledWith(actions);
    });

    test("updates observation targets when an existing renderer moves", async () => {
      const controller = makeController();
      const renderer = attachRenderer(controller);
      installMenuFixer();
      const guarded = controller.maybeUpdateFlexibleMenuImpl;
      const actions = document.createElement("div");
      actions.id = "actions";
      document.body.append(actions);
      actions.append(renderer);
      await flushObserverUpdates();

      expect(controller.maybeUpdateFlexibleMenuImpl).toBe(guarded);
      expect(resizeObservers[0].unobserve).toHaveBeenCalledWith(renderer);
      expect(resizeObservers[0].observe).toHaveBeenLastCalledWith(actions);
    });

    test("preference restoration survives coalescing with mutations and resize", async () => {
      const controller = makeController();
      const renderer = attachRenderer(controller);
      document.documentElement.setAttribute(HIDE_CLUTTER_ATTRIBUTE, "true");
      installMenuFixer();
      expect(controller.flexAsTopLevelButtons).toEqual([]);

      document.documentElement.setAttribute(HIDE_CLUTTER_ATTRIBUTE, "false");
      renderer.append(document.createElement("span"));
      await Promise.resolve();
      resizeObservers[0].callback([{ target: renderer }]);
      await flushObserverUpdates();

      expect(controller.flexAsTopLevelButtons).toEqual(["share", "save", "thanks"]);
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    test("stopping or replacing an installation cancels its queued work", async () => {
      const controller = makeController();
      const renderer = attachRenderer(controller);
      installMenuFixer();
      renderer.append(document.createElement("span"));
      await Promise.resolve();
      const firstFrame = [...frames.keys()][0];

      const replacement = installMenuFixer();
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(firstFrame);
      expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1);
      const check = jest.spyOn(controller.maybeUpdateFlexibleMenuImpl, "enforceLayout");
      await flushObserverUpdates();
      expect(check).not.toHaveBeenCalled();

      renderer.append(document.createElement("span"));
      await Promise.resolve();
      replacement.stop();
      await flushObserverUpdates();
      resizeObservers[1].callback([{ target: renderer }]);
      expect(check).not.toHaveBeenCalled();
      expect(frames.size).toBe(0);
    });
  });
});
