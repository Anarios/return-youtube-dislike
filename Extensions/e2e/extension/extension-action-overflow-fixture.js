const {
  ACTION_GAP_PX,
  MORE_BUTTON_WIDTH_PX,
  OPTIONAL_ACTIONS,
  REACTION_GROUP_WIDTH_PX,
  requiredActionRowWidth,
} = require("../action-overflow-contract");

const DEFAULT_VIDEO_ID = "overflow001";

function createExtensionActionOverflowFixture({ initialVideoId = DEFAULT_VIDEO_ID } = {}) {
  const configuration = JSON.stringify({
    actionGap: ACTION_GAP_PX,
    initialVideoId,
    moreWidth: MORE_BUTTON_WIDTH_PX,
    optionalActions: OPTIONAL_ACTIONS,
    reactionWidth: REACTION_GROUP_WIDTH_PX,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Owned watch action overflow fixture</title>
    <style>
      :root {
        --yt-spec-base-background: #0f0f0f;
        --yt-spec-text-primary: #f1f1f1;
      }

      * { box-sizing: border-box; }

      body {
        background: var(--yt-spec-base-background);
        color: var(--yt-spec-text-primary);
        font: 14px Arial, Helvetica, sans-serif;
        margin: 0;
        min-height: 100vh;
        padding: 28px;
      }

      ytd-watch-flexy { display: block; }
      #player { background: #000; display: block; height: 180px; width: 320px; }
      #top-row { margin-top: 20px; }

      ytd-menu-renderer.ytd-watch-metadata {
        align-items: flex-start;
        display: flex;
        gap: ${ACTION_GAP_PX}px;
        min-height: 58px;
        overflow: visible;
      }

      #top-level-buttons-computed {
        align-items: flex-start;
        display: flex;
        flex: 0 0 auto;
        gap: ${ACTION_GAP_PX}px;
        min-height: 54px;
      }

      segmented-like-dislike-button-view-model {
        display: block;
        flex: 0 0 ${REACTION_GROUP_WIDTH_PX}px;
        min-height: 48px;
        width: ${REACTION_GROUP_WIDTH_PX}px;
      }

      segmented-like-dislike-button-view-model > yt-smartimation,
      segmented-like-dislike-button-view-model #content,
      segmented-like-dislike-button-view-model #wrapper {
        display: flex;
        height: 48px;
        width: 100%;
      }

      like-button-view-model,
      dislike-button-view-model {
        display: block;
        flex: 1 1 50%;
        height: 48px;
        min-width: 0;
      }

      button {
        align-items: center;
        background: #272727;
        border: 0;
        color: #f1f1f1;
        display: flex;
        font: 600 14px Arial, Helvetica, sans-serif;
        gap: 7px;
        height: 40px;
        justify-content: center;
        white-space: nowrap;
      }

      like-button-view-model button {
        border-radius: 20px 0 0 20px;
        width: 100%;
      }

      dislike-button-view-model button {
        border-left: 1px solid #555;
        border-radius: 0 20px 20px 0;
        width: 100%;
      }

      [data-fixture-action] {
        display: block;
        flex: 0 0 auto;
        height: 48px;
      }

      [data-fixture-action] > button {
        border-radius: 20px;
        width: 100%;
      }

      [data-fixture-more] {
        border-radius: 50%;
        flex: 0 0 ${MORE_BUTTON_WIDTH_PX}px;
        font-size: 22px;
        padding: 0;
        width: ${MORE_BUTTON_WIDTH_PX}px;
      }

      [data-fixture-overflow-menu] {
        background: #282828;
        border-radius: 10px;
        display: none;
        padding: 8px;
        position: absolute;
        right: 0;
        top: 52px;
        z-index: 2;
      }

      [data-fixture-overflow-menu] [data-fixture-action] > button {
        background: transparent;
        border-radius: 0;
        justify-content: flex-start;
      }

      [data-fixture-overflow-open="true"] [data-fixture-overflow-menu] { display: block; }

      .fixture-icon {
        fill: none;
        height: 21px;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
        width: 21px;
      }

      .fixture-preview-card {
        background: #0f0f0f;
        border: 1px solid #303030;
        border-radius: 12px;
        display: inline-block;
        padding: 12px;
        width: 294px;
      }

      .fixture-preview-title {
        color: #aaa;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .08em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }

      .fixture-preview-card ytd-menu-renderer.ytd-watch-metadata {
        gap: 6px;
        width: 268px !important;
      }

      .fixture-preview-card #top-level-buttons-computed {
        flex: 0 0 228px;
        flex-wrap: wrap;
        gap: 6px;
        width: 228px;
      }

      .fixture-preview-card[data-fixture-preview-layout="after"] #top-level-buttons-computed {
        flex-basis: 150px;
        width: 150px;
      }

      .fixture-preview-card segmented-like-dislike-button-view-model {
        flex-basis: 150px;
        height: 36px;
        min-height: 36px;
        width: 150px;
      }

      .fixture-preview-card segmented-like-dislike-button-view-model > yt-smartimation,
      .fixture-preview-card segmented-like-dislike-button-view-model #content,
      .fixture-preview-card segmented-like-dislike-button-view-model #wrapper,
      .fixture-preview-card like-button-view-model,
      .fixture-preview-card dislike-button-view-model,
      .fixture-preview-card [data-fixture-action] {
        height: 36px;
        min-height: 36px;
      }

      .fixture-preview-card button {
        font-size: 12px;
        gap: 4px;
        height: 34px;
      }

      .fixture-preview-card .fixture-icon {
        height: 17px;
        width: 17px;
      }

      .fixture-preview-card [data-fixture-action="share"] { width: 62px !important; }
      .fixture-preview-card [data-fixture-action="save"] { width: 54px !important; }
      .fixture-preview-card [data-fixture-action="thanks"] { width: 62px !important; }
      .fixture-preview-card [data-fixture-action="download"] { width: 78px !important; }

      .fixture-preview-card [data-fixture-action] button {
        font-size: 11px;
      }

      .fixture-preview-card [data-fixture-more] {
        flex-basis: 34px;
        font-size: 17px;
        width: 34px;
      }
    </style>
  </head>
  <body>
    <main id="fixture-root"></main>
    <script>
      (() => {
        const configuration = ${configuration};
        const fixtureRoot = document.querySelector("#fixture-root");
        const activationLog = [];
        let current = null;
        let navigationCount = 0;

        const icon = (kind) => {
          const paths = {
            download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/>',
            save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
            share: '<path d="M9 7l3-3 3 3M12 4v10M6 11H4v9h16v-9h-2"/>',
            thanks: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5c.5-2 5.5-2 6 0 .5 2-1.5 2.5-3 3.5-1.5 1-3.5 1.5-3 3.5.5 2 5.5 2 6 0"/>',
          };
          return '<svg class="fixture-icon" aria-hidden="true" viewBox="0 0 24 24">' + paths[kind] + '</svg>';
        };

        function reactionMarkup(videoId) {
          return \`
            <segmented-like-dislike-button-view-model data-fixture-reaction-group data-video-id="\${videoId}">
              <yt-smartimation>
                <div id="content"><div id="wrapper">
                  <like-button-view-model class="style-text">
                    <button type="button" aria-label="501 thousand likes" aria-pressed="false">
                      <svg class="fixture-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 21H4V9h4m2 12V9l4-7 2 1v5h5v5l-3 8z"/></svg>
                      <div class="ytSpecButtonShapeNextButtonTextContent"><span id="text" role="text">501K</span></div>
                    </button>
                  </like-button-view-model>
                  <dislike-button-view-model class="style-text">
                    <button type="button" aria-label="Dislike" aria-pressed="false">
                      <svg class="fixture-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M16 3h4v12h-4M14 3v12l-4 7-2-1v-5H3v-5l3-8z"/></svg>
                      <div class="ytSpecButtonShapeNextButtonTextContent"><span id="text" role="text">6.6K</span></div>
                    </button>
                  </dislike-button-view-model>
                </div></div>
              </yt-smartimation>
            </segmented-like-dislike-button-view-model>\`;
        }

        function createOptionalAction(action) {
          const host = document.createElement("button-view-model");
          host.dataset.fixtureAction = action.id;
          host.style.width = action.width + "px";
          host.innerHTML = \`<button type="button" aria-label="\${action.label}">\${icon(action.id)}<span role="text">\${action.label}</span></button>\`;
          host.querySelector("button").addEventListener("click", () => activationLog.push(action.id));
          return host;
        }

        function topLevelActionId(model) {
          return model?.fixtureActionId ?? null;
        }

        function flexibleActionId(model) {
          return (
            model?.fixtureActionId ??
            model?.menuFlexibleItemRenderer?.topLevelButton?.fixtureActionId ??
            null
          );
        }

        function render(controller) {
          const visibleIds = new Set(
            (controller.data?.topLevelButtons ?? []).map(topLevelActionId).filter(Boolean),
          );
          for (const action of controller.flexAsTopLevelButtons) {
            visibleIds.add(action.dataset.fixtureAction);
          }
          for (const action of controller.allActionButtons) {
            (visibleIds.has(action.dataset.fixtureAction) ? current.topLevel : current.overflow).append(action);
          }
          current.menu.dataset.fixtureOverflowOpen = "false";
        }

        function makeController(actions, availableWidth, sourceData) {
          const flexibleActions = actions.filter((action) => action.dataset.fixtureAction !== "share");
          let data = sourceData;
          let flexAsTopLevelButtons = [...flexibleActions];
          const controller = {
            allActionButtons: [...actions],
            allFlexButtons: [...flexibleActions],
            availableWidth,
            nativeInvocationCount: 0,
            sourceData,
          };
          Object.defineProperty(controller, "data", {
            configurable: true,
            enumerable: true,
            get: () => data,
            set: (value) => {
              data = value;
              const representedFlexibleIds = new Set((value?.flexibleItems ?? []).map(flexibleActionId).filter(Boolean));
              flexAsTopLevelButtons = controller.allActionButtons.filter((action) =>
                representedFlexibleIds.has(action.dataset.fixtureAction),
              );
              if (current?.controller === controller) render(controller);
            },
          });
          Object.defineProperty(controller, "flexAsTopLevelButtons", {
            configurable: true,
            enumerable: true,
            get: () => flexAsTopLevelButtons,
            set: (value) => {
              flexAsTopLevelButtons = Array.from(value ?? []);
              if (current?.controller === controller) render(controller);
            },
          });
          controller.maybeUpdateFlexibleMenuImpl = function nativeMaybeUpdateFlexibleMenuImpl() {
            controller.nativeInvocationCount += 1;
            render(controller);
            const fixedIds = (controller.data?.topLevelButtons ?? []).map(topLevelActionId).filter(Boolean);
            const nextFlexibleButtons = [...controller.flexAsTopLevelButtons];
            while (
              nextFlexibleButtons.length > 0 &&
              globalThis.__actionOverflowRequiredWidth([
                ...fixedIds,
                ...nextFlexibleButtons.map((element) => element.dataset.fixtureAction),
              ]) > controller.availableWidth
            ) {
              nextFlexibleButtons.pop();
            }
            if (nextFlexibleButtons.length === controller.flexAsTopLevelButtons.length) return;
            controller.flexAsTopLevelButtons = nextFlexibleButtons;
            // YouTube immediately measures again after changing the flexible
            // suffix. The historical guard treated this normal second pass as
            // an oscillation and emptied the complete suffix.
            controller.maybeUpdateFlexibleMenuImpl();
          };
          return controller;
        }

        function mount(videoId = configuration.initialVideoId, availableWidth = 760) {
          const watch = document.createElement("ytd-watch-flexy");
          watch.setAttribute("video-id", videoId);
          watch.innerHTML = '<div id="player" loading="false"></div><div id="top-row"></div>';

          const menu = document.createElement("ytd-menu-renderer");
          menu.className = "ytd-watch-metadata";
          menu.style.width = availableWidth + "px";
          menu.innerHTML = \`
            <div id="top-level-buttons-computed">\${reactionMarkup(videoId)}</div>
            <button type="button" data-fixture-more aria-label="More actions">•••</button>
            <div data-fixture-overflow-menu aria-label="More actions menu"></div>\`;
          watch.querySelector("#top-row").append(menu);

          const actions = configuration.optionalActions.map(createOptionalAction);
          const sourceData = {
            topLevelButtons: [
              { segmentedLikeDislikeButtonViewModel: { likeButtonViewModel: {}, dislikeButtonViewModel: {} } },
              {
                fixtureActionId: "share",
                buttonViewModel: {
                  iconName: "SHARE",
                  onTap: { commandMetadata: { webCommandMetadata: { sendPost: true } } },
                  text: { runs: [{ text: "Share" }] },
                  trackingParams: "owned-share-tracking",
                },
              },
            ],
            flexibleItems: configuration.optionalActions
              .filter((action) => action.id !== "share")
              .map((action) => ({ fixtureActionId: action.id })),
          };
          const controller = makeController(actions, availableWidth, sourceData);
          menu.polymerController = controller;
          const originalMethod = controller.maybeUpdateFlexibleMenuImpl;
          current = {
            actions,
            controller,
            menu,
            originalMethod,
            overflow: menu.querySelector("[data-fixture-overflow-menu]"),
            topLevel: menu.querySelector("#top-level-buttons-computed"),
            videoId,
            watch,
          };
          menu.querySelector("[data-fixture-more]").addEventListener("click", () => {
            menu.dataset.fixtureOverflowOpen = String(menu.dataset.fixtureOverflowOpen !== "true");
          });
          render(controller);
          fixtureRoot.replaceChildren(watch);
          navigationCount += 1;
          return navigationCount;
        }

        function isPatched() {
          return Boolean(current && current.controller.maybeUpdateFlexibleMenuImpl !== current.originalMethod);
        }

        function settleLayout(availableWidth) {
          if (!current) throw new Error("The action menu is not mounted.");
          current.controller.availableWidth = availableWidth;
          current.menu.style.width = availableWidth + "px";
          current.controller.data = current.controller.sourceData;
          current.controller.flexAsTopLevelButtons = [...current.controller.allFlexButtons];
          current.controller.maybeUpdateFlexibleMenuImpl();
        }

        function resizeLayout(availableWidth) {
          if (!current) throw new Error("The action menu is not mounted.");
          current.controller.availableWidth = availableWidth;
          current.menu.style.width = availableWidth + "px";
          current.controller.maybeUpdateFlexibleMenuImpl();
        }

        function resizeLayoutAfterDataIdentityChurn(availableWidth) {
          if (!current) throw new Error("The action menu is not mounted.");
          current.controller.availableWidth = availableWidth;
          current.menu.style.width = availableWidth + "px";
          current.controller.data = { ...current.controller.data };
          current.controller.maybeUpdateFlexibleMenuImpl();
        }

        function resizeLayoutWithoutNativeNotification(availableWidth) {
          if (!current) throw new Error("The action menu is not mounted.");
          current.controller.availableWidth = availableWidth;
          current.menu.style.width = availableWidth + "px";
          current.controller.data = { ...current.controller.data };
        }

        function navigate(videoId, availableWidth) {
          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          history.pushState({}, "", "/watch?v=" + videoId + "&rydOverflowFixture=1");
          mount(videoId, availableWidth);
          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
        }

        function snapshot() {
          const topLevelActionIds = [...current.topLevel.querySelectorAll(":scope > [data-fixture-action]")].map(
            (element) => element.dataset.fixtureAction,
          );
          const overflowActionIds = [...current.overflow.querySelectorAll(":scope > [data-fixture-action]")].map(
            (element) => element.dataset.fixtureAction,
          );
          const duplicates = topLevelActionIds.filter((id) => overflowActionIds.includes(id));
          const movedShareModel = current.controller.data?.flexibleItems?.find(
            (item) => item?.menuFlexibleItemRenderer?.topLevelButton?.fixtureActionId === "share",
          );
          const sourceShareModel = current.controller.sourceData.topLevelButtons.find(
            (model) => model.fixtureActionId === "share",
          );
          return {
            activationLog: [...activationLog],
            availableWidth: current.controller.availableWidth,
            clutterShareCommandPreserved: Boolean(
              movedShareModel &&
              movedShareModel.menuFlexibleItemRenderer.menuItem.menuServiceItemRenderer.serviceEndpoint ===
                sourceShareModel.buttonViewModel.onTap,
            ),
            clutterShareModelPresent: Boolean(movedShareModel),
            duplicateActionIds: duplicates,
            globalActionCount: document.querySelectorAll("[data-fixture-action]").length,
            menuCount: document.querySelectorAll("ytd-menu-renderer.ytd-watch-metadata").length,
            moreButtonCount: current.menu.querySelectorAll(":scope > [data-fixture-more]").length,
            nativeInvocationCount: current.controller.nativeInvocationCount,
            navigationCount,
            overflowActionIds,
            patched: isPatched(),
            reactionGroupCount: current.topLevel.querySelectorAll(":scope > [data-fixture-reaction-group]").length,
            topLevelActionIds,
            videoId: current.videoId,
          };
        }

        function renderPreview(topLevelActionIds, title) {
          if (!current) mount(configuration.initialVideoId, 760);
          const desired = new Set(topLevelActionIds);
          current.controller.data = current.controller.sourceData;
          current.controller.flexAsTopLevelButtons = current.controller.allFlexButtons.filter((action) =>
            desired.has(action.dataset.fixtureAction),
          );
          if (!desired.has("share")) {
            current.controller.data = {
              ...current.controller.sourceData,
              topLevelButtons: current.controller.sourceData.topLevelButtons.filter(
                (model) => model.fixtureActionId !== "share",
              ),
            };
          }
          current.menu.style.width = "760px";
          const previewCard = current.menu.closest("#top-row");
          previewCard.className = "fixture-preview-card";
          previewCard.dataset.fixturePreviewLayout = topLevelActionIds.length === 0 ? "after" : "before";
          previewCard.querySelector(".fixture-preview-title")?.remove();
          const heading = document.createElement("p");
          heading.className = "fixture-preview-title";
          heading.textContent = title;
          previewCard.prepend(heading);
          return snapshot();
        }

        globalThis.__actionOverflowRequiredWidth = (topLevelActionIds) => {
          const widths = topLevelActionIds.map(
            (id) => configuration.optionalActions.find((action) => action.id === id).width,
          );
          const itemCount = 2 + topLevelActionIds.length;
          return (
            configuration.reactionWidth +
            configuration.moreWidth +
            widths.reduce((total, width) => total + width, 0) +
            configuration.actionGap * (itemCount - 1)
          );
        };
        globalThis.__actionOverflowFixture = {
          isPatched,
          mount,
          navigate,
          renderPreview,
          resizeLayout,
          resizeLayoutAfterDataIdentityChurn,
          resizeLayoutWithoutNativeNotification,
          settleLayout,
          snapshot,
        };
      })();
    </script>
  </body>
</html>`;
}

module.exports = {
  DEFAULT_VIDEO_ID,
  createExtensionActionOverflowFixture,
  requiredActionRowWidth,
};
