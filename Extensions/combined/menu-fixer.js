(() => {
  const HIDE_CLUTTER_ATTRIBUTE = "data-ryd-hide-clutter-buttons";
  const SHORTS_HYDRATION_ATTRIBUTE = "data-ryd-shorts-action-bar-hydrated";
  const SHORTS_HYDRATION_REQUEST_EVENT = "ryd-shorts-action-bar-hydration-request";
  const MENU_UPDATE_WINDOW_MS = 100;
  const CONTROLLER_STATE_KEY = Symbol.for("return-youtube-dislike.menu-fixer.controller-state");
  const INSTALL_STATE_KEY = Symbol.for("return-youtube-dislike.menu-fixer.install-state");

  function hideClutterButtonsEnabled() {
    return document.documentElement.getAttribute(HIDE_CLUTTER_ATTRIBUTE) === "true";
  }

  function reportShortsActionBarHydration(event) {
    const actionBar = event.target;
    if (!(actionBar instanceof Element) || !actionBar.matches("reel-action-bar-view-model")) return;

    // Content scripts run in an isolated JavaScript world and cannot read the
    // page-owned `data` property directly. Reflect only the boolean readiness
    // result into the shared DOM for the synchronous requester.
    actionBar.setAttribute(SHORTS_HYDRATION_ATTRIBUTE, String(!("data" in actionBar) || Boolean(actionBar.data)));
  }

  function getMenuLayoutKey(ytdMenuRenderer) {
    const layoutTarget = ytdMenuRenderer?.closest?.("#actions") ?? ytdMenuRenderer;
    const rect = layoutTarget?.getBoundingClientRect?.();
    if (!rect) return null;
    return `${Math.round(rect.width * 10) / 10}:${Math.round(rect.height * 10) / 10}`;
  }

  function hasMeasurableBox(element) {
    if (!element?.isConnected || element.closest?.("[hidden], [aria-hidden='true'], [inert]")) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) === 0
      ) {
        return false;
      }
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function menuNeedsMoreOverflow(
    ytdMenuRenderer,
    { tolerance = 2, viewportWidth = window.innerWidth || document.documentElement.clientWidth } = {},
  ) {
    const actionSurface = ytdMenuRenderer?.querySelector?.("#top-level-buttons-computed");
    if (!hasMeasurableBox(actionSurface) || !Number.isFinite(viewportWidth) || viewportWidth <= 0) return false;

    const actionSurfaceRect = actionSurface.getBoundingClientRect();
    const flexibleActionHosts = [...ytdMenuRenderer.querySelectorAll("#flexible-item-buttons")].flatMap((container) =>
      [...container.children].filter(hasMeasurableBox),
    );
    const moreButtons = [...ytdMenuRenderer.querySelectorAll("button")].filter(
      (button) =>
        !actionSurface.contains(button) && !button.closest("#flexible-item-buttons") && hasMeasurableBox(button),
    );
    const actionRects = [actionSurface, ...flexibleActionHosts, ...moreButtons].map((element) =>
      element.getBoundingClientRect(),
    );

    if (actionRects.some((rect) => rect.left < -tolerance || rect.right > viewportWidth + tolerance)) return true;

    // YouTube can report that every flexible action fits while painting those
    // actions on a second row outside the menu's own box. That row intersects
    // the absolutely positioned ratio bar, so require every visible action to
    // share the reaction surface's row and overflow another item if it does not.
    return actionRects.slice(1).some((rect) => Math.abs(rect.top - actionSurfaceRect.top) > tolerance);
  }

  function getFlexibleButtonCount(controller) {
    return Array.isArray(controller?.flexAsTopLevelButtons) ? controller.flexAsTopLevelButtons.length : null;
  }

  function keepAtMostFlexibleButtons(controller, count) {
    if (!Number.isInteger(count) || !Array.isArray(controller?.flexAsTopLevelButtons)) return;
    if (controller.flexAsTopLevelButtons.length <= count) return;

    // Keep the controller's current items rather than a saved array. YouTube can
    // reuse a renderer across navigations while replacing the button models.
    controller.flexAsTopLevelButtons = controller.flexAsTopLevelButtons.slice(0, count);
  }

  function containsReactionButtonModel(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8) return false;

    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("likebutton") || normalizedKey.includes("dislikebutton")) return true;
      if ((key === "iconName" || key === "iconType") && typeof child === "string" && /^(DIS)?LIKE(?:_|$)/.test(child)) {
        return true;
      }
      if (key === "accessibilityId" && typeof child === "string" && /\.video\.(?:dis)?like\.button$/.test(child)) {
        return true;
      }
      if (containsReactionButtonModel(child, depth + 1)) return true;
    }
    return false;
  }

  function getMenuItemText(button) {
    if (button?.text && typeof button.text === "object") return button.text;
    const label = [button?.title, button?.accessibilityText, button?.tooltip].find(
      (value) => typeof value === "string" && value.trim(),
    );
    return label ? { runs: [{ text: label }] } : null;
  }

  function convertTopLevelButtonToFlexibleItem(topLevelButton) {
    const button = topLevelButton?.buttonViewModel ?? topLevelButton?.buttonRenderer;
    if (!button) return null;

    const text = getMenuItemText(button);
    const serviceEndpoint = button.onTap ?? button.serviceEndpoint ?? button.navigationEndpoint ?? button.command;
    const iconType = button.iconName ?? button.icon?.iconType;
    if (!text || !serviceEndpoint) return null;

    const menuServiceItemRenderer = {
      text,
      serviceEndpoint,
      ...(iconType ? { icon: { iconType } } : {}),
      ...(button.trackingParams ? { trackingParams: button.trackingParams } : {}),
    };
    return {
      menuFlexibleItemRenderer: {
        menuItem: { menuServiceItemRenderer },
        topLevelButton,
      },
    };
  }

  function createClutterMenuData(data) {
    if (!data || !Array.isArray(data.topLevelButtons)) return null;

    const reactionButtons = [];
    const movedButtons = [];
    for (const topLevelButton of data.topLevelButtons) {
      if (containsReactionButtonModel(topLevelButton)) {
        reactionButtons.push(topLevelButton);
        continue;
      }

      const flexibleItem = convertTopLevelButtonToFlexibleItem(topLevelButton);
      if (flexibleItem) movedButtons.push(flexibleItem);
      else reactionButtons.push(topLevelButton);
    }

    return {
      ...data,
      topLevelButtons: reactionButtons,
      flexibleItems: [...movedButtons, ...(Array.isArray(data.flexibleItems) ? data.flexibleItems : [])],
    };
  }

  function createClutterModelManager(controller) {
    let sourceData = null;
    let clutterData = null;

    return {
      disable() {
        // Restore only the exact transformed model we installed. If YouTube has
        // replaced data during SPA navigation, the old video's model is stale.
        if (sourceData && controller.data === clutterData) controller.data = sourceData;
        sourceData = null;
        clutterData = null;
      },
      isEnabled() {
        return clutterData !== null && controller.data === clutterData;
      },
      enable() {
        if (controller.data !== clutterData) {
          const nextClutterData = createClutterMenuData(controller.data);
          if (nextClutterData) {
            sourceData = controller.data;
            clutterData = nextClutterData;
            controller.data = clutterData;
          } else {
            sourceData = null;
            clutterData = null;
          }
        }
      },
    };
  }

  function createMenuUpdateGuard(
    originalMaybeUpdateFlexibleMenuImpl,
    controller,
    {
      getContextKey = () => null,
      getLayoutKey = () => null,
      isHideClutterEnabled = hideClutterButtonsEnabled,
      needsMoreOverflow = () => false,
      now = Date.now,
      updateWindowMs = MENU_UPDATE_WINDOW_MS,
    } = {},
  ) {
    let lastCallTime = Number.NEGATIVE_INFINITY;
    let observedButtonCounts = [];
    let stabilizedButtonCount = null;
    let latestArgs = [];
    let flexibleButtonCandidates = null;
    let flexibleButtonCandidatesContextKey;
    let hasFlexibleButtonCandidatesContextKey = false;
    let lastLayoutKey;
    let hasLayoutKey = false;
    let lastMenuData;
    let hasMenuData = false;
    const clutterModelManager = createClutterModelManager(controller);

    const resetBurst = () => {
      lastCallTime = Number.NEGATIVE_INFINITY;
      observedButtonCounts = [];
      stabilizedButtonCount = null;
    };

    // YouTube's fitter removes items from this array but does not add them back
    // before a later width change. Retain the widest prefix for the current
    // video so a new layout burst can start from all known candidates. YouTube
    // may replace the menu data object during a resize without changing videos,
    // so data-object identity is not a safe context boundary here.
    const rememberFlexibleButtonCandidates = () => {
      const currentButtons = Array.isArray(controller?.flexAsTopLevelButtons) ? controller.flexAsTopLevelButtons : null;
      if (!currentButtons) return;

      const contextKey = getContextKey();
      const contextChanged = hasFlexibleButtonCandidatesContextKey && contextKey !== flexibleButtonCandidatesContextKey;
      const currentIsCandidatePrefix =
        flexibleButtonCandidates !== null &&
        currentButtons.every((button, index) => flexibleButtonCandidates[index] === button);
      if (
        flexibleButtonCandidates === null ||
        contextChanged ||
        !currentIsCandidatePrefix ||
        currentButtons.length > flexibleButtonCandidates.length
      ) {
        flexibleButtonCandidates = [...currentButtons];
      }
      flexibleButtonCandidatesContextKey = contextKey;
      hasFlexibleButtonCandidatesContextKey = true;
    };

    const restoreFlexibleButtonCandidates = () => {
      if (!flexibleButtonCandidates || !Array.isArray(controller?.flexAsTopLevelButtons)) return;
      const currentButtons = controller.flexAsTopLevelButtons;
      const currentIsCandidatePrefix = currentButtons.every(
        (button, index) => flexibleButtonCandidates[index] === button,
      );
      if (!currentIsCandidatePrefix || currentButtons.length >= flexibleButtonCandidates.length) return;
      controller.flexAsTopLevelButtons = [...flexibleButtonCandidates];
    };

    const enforceCurrentLayout = () => {
      const currentButtonCount = getFlexibleButtonCount(controller);
      if (!currentButtonCount || !needsMoreOverflow()) return false;

      const nextButtonCount = currentButtonCount - 1;
      stabilizedButtonCount =
        stabilizedButtonCount === null ? nextButtonCount : Math.min(stabilizedButtonCount, nextButtonCount);
      keepAtMostFlexibleButtons(controller, nextButtonCount);
      return true;
    };

    function guardedMaybeUpdateFlexibleMenuImpl(...args) {
      latestArgs = args;

      // Treat every losslessly representable non-reaction button as flexible,
      // not only the buttons YouTube happened to classify that way before RYD
      // widened the reaction group. In the current Watch layout Share is a
      // fixed top-level model while Save is flexible; at narrow widths that
      // leaves Share impossible to move and makes the whole action row wrap
      // and overflow. Keeping Share first in flexibleItems preserves its
      // priority while allowing the native fitter to hide exactly what no
      // longer fits.
      if (!clutterModelManager.isEnabled()) {
        rememberFlexibleButtonCandidates();
        clutterModelManager.enable();
        rememberFlexibleButtonCandidates();
      }

      if (isHideClutterEnabled()) {
        keepAtMostFlexibleButtons(controller, 0);
        return undefined;
      }

      const callTime = now();
      const layoutKey = getLayoutKey();
      const layoutChanged = hasLayoutKey && layoutKey !== lastLayoutKey;
      const menuData = controller?.data;
      const menuDataChanged = hasMenuData && menuData !== lastMenuData;
      lastLayoutKey = layoutKey;
      hasLayoutKey = true;
      lastMenuData = menuData;
      hasMenuData = true;
      if (layoutChanged || menuDataChanged) {
        resetBurst();
        rememberFlexibleButtonCandidates();
        restoreFlexibleButtonCandidates();
      } else if (callTime - lastCallTime > updateWindowMs) {
        // Start a new observation burst, but retain the safe prefix selected
        // for this unchanged allocation. Restoring every candidate here lets a
        // delayed native pass reopen a layout that was already fitted.
        resetBurst();
        rememberFlexibleButtonCandidates();
      } else {
        rememberFlexibleButtonCandidates();
      }
      lastCallTime = callTime;

      if (stabilizedButtonCount !== null) {
        keepAtMostFlexibleButtons(controller, stabilizedButtonCount);
        return undefined;
      }

      const currentButtonCount = getFlexibleButtonCount(controller);
      const measurableButtonCount = currentButtonCount ?? "unavailable";
      const repeatedAt = observedButtonCounts.lastIndexOf(measurableButtonCount);
      if (repeatedAt !== -1) {
        const isFirstConsecutiveRepeat =
          repeatedAt === observedButtonCounts.length - 1 &&
          (repeatedAt === 0 || observedButtonCounts[repeatedAt - 1] !== measurableButtonCount);
        if (!isFirstConsecutiveRepeat) {
          const cycleCounts = observedButtonCounts.slice(repeatedAt).filter((count) => typeof count === "number");
          stabilizedButtonCount = cycleCounts.length ? Math.min(...cycleCounts) : 0;
          if (currentButtonCount !== null) keepAtMostFlexibleButtons(controller, stabilizedButtonCount);
          return undefined;
        }
      }
      observedButtonCounts.push(measurableButtonCount);

      // Native passes may legitimately remove several actions one at a time.
      // Continue while the visible flexible-action count changes monotonically;
      // stop on an oscillation or after one retry makes no visible progress.
      const buttonCountBeforeNativeUpdate = getFlexibleButtonCount(controller);
      const enforceIfNativeLayoutWasUnchanged = () => {
        if (getFlexibleButtonCount(controller) === buttonCountBeforeNativeUpdate) enforceCurrentLayout();
      };
      let result;
      try {
        result = originalMaybeUpdateFlexibleMenuImpl.apply(this, args);
      } catch (error) {
        throw error;
      }

      if (result && typeof result.then === "function") {
        return result.then((value) => {
          enforceIfNativeLayoutWasUnchanged();
          return value;
        });
      }

      // A native count change rerenders asynchronously. Let the child-list
      // observer validate that updated geometry instead of measuring the old
      // DOM and hiding an extra action preemptively.
      enforceIfNativeLayoutWasUnchanged();
      return result;
    }

    guardedMaybeUpdateFlexibleMenuImpl.applyPreference = ({ restoreCandidates = true } = {}) => {
      if (!clutterModelManager.isEnabled()) {
        rememberFlexibleButtonCandidates();
        clutterModelManager.enable();
        rememberFlexibleButtonCandidates();
      }

      if (isHideClutterEnabled()) {
        keepAtMostFlexibleButtons(controller, 0);
        return undefined;
      }

      resetBurst();
      if (restoreCandidates) restoreFlexibleButtonCandidates();
      return guardedMaybeUpdateFlexibleMenuImpl.apply(controller, latestArgs);
    };
    guardedMaybeUpdateFlexibleMenuImpl.enforceLayout = enforceCurrentLayout;
    guardedMaybeUpdateFlexibleMenuImpl.refreshLayout = () =>
      guardedMaybeUpdateFlexibleMenuImpl.apply(controller, latestArgs);

    return guardedMaybeUpdateFlexibleMenuImpl;
  }

  function fixYtdMenuRenderer(ytdMenuRenderer, { refresh = false, restoreCandidates = false } = {}) {
    const controller = ytdMenuRenderer?.polymerController;
    if (!controller?.maybeUpdateFlexibleMenuImpl) return false;

    const existingState = controller[CONTROLLER_STATE_KEY];
    if (existingState) {
      if (hideClutterButtonsEnabled() || restoreCandidates) {
        existingState.guardedMethod.applyPreference({ restoreCandidates });
      } else if (refresh) {
        existingState.guardedMethod.refreshLayout();
      } else {
        existingState.guardedMethod.enforceLayout();
      }
      return true;
    }

    const originalMethod = controller.maybeUpdateFlexibleMenuImpl;
    const guardedMethod = createMenuUpdateGuard(originalMethod, controller, {
      getContextKey: () => {
        const watchRoot = ytdMenuRenderer.closest("ytd-watch-flexy, ytd-watch-grid");
        const videoId = watchRoot?.getAttribute("video-id");
        return videoId ? `watch:${videoId}` : `${location.pathname}${location.search}`;
      },
      getLayoutKey: () => getMenuLayoutKey(ytdMenuRenderer),
      needsMoreOverflow: () => menuNeedsMoreOverflow(ytdMenuRenderer),
    });
    controller.maybeUpdateFlexibleMenuImpl = guardedMethod;
    Object.defineProperty(controller, CONTROLLER_STATE_KEY, {
      configurable: true,
      value: { guardedMethod, originalMethod },
    });

    // The initial native fit may have completed before the injected page-world
    // patch was installed. Refit immediately so the enlarged Dislike count is
    // accounted for even without a later resize.
    guardedMethod.applyPreference();
    return true;
  }

  function scanForMenuRenderers(options) {
    for (const renderer of document.querySelectorAll("ytd-menu-renderer")) {
      fixYtdMenuRenderer(renderer, options);
    }
  }

  function installMenuFixer() {
    const previousInstallation = window[INSTALL_STATE_KEY];
    previousInstallation?.observer?.disconnect();
    previousInstallation?.resizeObserver?.disconnect();

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            scanForMenuRenderers({ refresh: true });
          })
        : null;
    const observeMenuLayouts = () => {
      if (!resizeObserver) return;
      for (const renderer of document.querySelectorAll("ytd-menu-renderer")) {
        resizeObserver.observe(renderer.closest("#actions") ?? renderer);
      }
    };

    document.addEventListener(SHORTS_HYDRATION_REQUEST_EVENT, reportShortsActionBarHydration, true);
    scanForMenuRenderers();
    observeMenuLayouts();

    const observer = new MutationObserver((mutations) => {
      const preferenceChanged = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          mutation.target === document.documentElement &&
          mutation.attributeName === HIDE_CLUTTER_ATTRIBUTE,
      );
      scanForMenuRenderers({
        refresh: preferenceChanged,
        restoreCandidates: preferenceChanged && !hideClutterButtonsEnabled(),
      });
      observeMenuLayouts();
    });
    observer.observe(document.documentElement, {
      attributeFilter: [HIDE_CLUTTER_ATTRIBUTE],
      attributes: true,
      childList: true,
      subtree: true,
    });

    const installation = {
      observer,
      resizeObserver,
      stop() {
        observer.disconnect();
        resizeObserver?.disconnect();
        document.removeEventListener(SHORTS_HYDRATION_REQUEST_EVENT, reportShortsActionBarHydration, true);
        if (window[INSTALL_STATE_KEY] === installation) delete window[INSTALL_STATE_KEY];
      },
    };
    window[INSTALL_STATE_KEY] = installation;
    return installation;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      CONTROLLER_STATE_KEY,
      HIDE_CLUTTER_ATTRIBUTE,
      MENU_UPDATE_WINDOW_MS,
      SHORTS_HYDRATION_ATTRIBUTE,
      SHORTS_HYDRATION_REQUEST_EVENT,
      containsReactionButtonModel,
      convertTopLevelButtonToFlexibleItem,
      createClutterMenuData,
      createClutterModelManager,
      createMenuUpdateGuard,
      fixYtdMenuRenderer,
      getFlexibleButtonCount,
      getMenuLayoutKey,
      hideClutterButtonsEnabled,
      installMenuFixer,
      keepAtMostFlexibleButtons,
      menuNeedsMoreOverflow,
      reportShortsActionBarHydration,
    };
  } else {
    installMenuFixer();
  }
})();
