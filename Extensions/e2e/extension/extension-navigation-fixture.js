const DEFAULT_VIDEO_IDS = Object.freeze({
  A: "abcdefghijk",
  B: "zyxwvutsrqp",
  C: "mnopqrstuvw",
});

function createExtensionNavigationFixture({ initialVideoId = DEFAULT_VIDEO_IDS.A, likesByVideo = {} } = {}) {
  const configuration = JSON.stringify({ initialVideoId, likesByVideo, videoIds: DEFAULT_VIDEO_IDS });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Extension navigation lifecycle fixture</title>
    <style>
      :root {
        --yt-spec-base-background: #0f0f0f;
        --yt-spec-text-primary: #f1f1f1;
      }

      * {
        box-sizing: border-box;
      }

      body {
        background: var(--yt-spec-base-background);
        color: var(--yt-spec-text-primary);
        font: 14px Arial, sans-serif;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }

      [hidden] {
        display: none !important;
      }

      ytd-watch-flexy {
        display: block;
        min-height: 420px;
        width: min(920px, calc(100vw - 48px));
      }

      #player {
        background: #000;
        display: block;
        height: 180px;
        margin-bottom: 18px;
        width: 320px;
      }

      ytd-menu-renderer.ytd-watch-metadata {
        align-items: flex-start;
        display: flex;
        gap: 20px;
        min-height: 82px;
        width: 760px;
      }

      .fixture-action-host,
      #flexible-item-buttons {
        align-items: flex-start;
        display: flex;
        min-height: 54px;
        position: relative;
      }

      .fixture-action-host {
        width: 240px;
      }

      #flexible-item-buttons {
        gap: 8px;
        width: 220px;
      }

      segmented-like-dislike-button-view-model,
      yt-smartimation,
      [data-fixture-smartimation-content-shell] {
        display: block;
        min-height: 48px;
        width: 184px;
      }

      [data-fixture-smartimation-content] {
        align-items: flex-start;
        display: flex;
        min-height: 48px;
        width: 184px;
      }

      like-button-view-model,
      dislike-button-view-model,
      button-view-model {
        display: block;
        min-height: 40px;
        width: 88px;
      }

      button-view-model {
        width: 100px;
      }

      button {
        align-items: center;
        background: #272727;
        border: 0;
        border-radius: 18px;
        color: #f1f1f1;
        display: flex;
        height: 36px;
        justify-content: center;
        min-width: 80px;
        padding: 0 12px;
      }

      .ytSpecButtonShapeNextButtonTextContent {
        align-items: center;
        display: flex;
        min-height: 18px;
      }

      [data-fixture-icon] {
        height: 20px;
        width: 20px;
      }

      [data-fixture-touch-feedback] {
        display: none;
      }

      .fixture-navigation {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }

      .fixture-navigation a {
        color: #3ea6ff;
      }
    </style>
  </head>
  <body>
    <main id="fixture-root"></main>
    <script>
      (() => {
        const configuration = ${configuration};
        const fixtureRoot = document.querySelector("#fixture-root");
        const transitionLog = [];
        let currentVideoId = configuration.initialVideoId;
        let hostSequence = 0;
        let pendingHydration = null;
        let phase = "booting";

        const escapeAttribute = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");

        function nativeButtonMarkup(role, videoId) {
          if (role === "like") {
            const likeCount = configuration.likesByVideo[videoId] ?? 100;
            return \`
              <toggle-button-view-model>
                <button-view-model>
                  <button type="button" data-fixture-native-role="like" aria-label="\${likeCount} likes for \${escapeAttribute(videoId)}" aria-pressed="false">
                    <svg data-fixture-icon="like" aria-hidden="true" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M8 21H5V9h3v12Zm2 0V9l4-7 2 1v5h5v5l-3 8h-8Z"></path>
                    </svg>
                    <div class="ytSpecButtonShapeNextButtonTextContent" data-fixture-provided-native-text><span id="text" role="text">\${likeCount}</span></div>
                    <span data-fixture-touch-feedback aria-hidden="true"></span>
                  </button>
                </button-view-model>
              </toggle-button-view-model>\`;
          }
          return \`
            <toggle-button-view-model>
              <button-view-model>
                <button type="button" data-fixture-native-role="dislike" aria-label="Dislike \${escapeAttribute(videoId)}" aria-pressed="false">
                  <svg data-fixture-icon="dislike" aria-hidden="true" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M16 3h3v12h-3V3Zm-2 0v12l-4 7-2-1v-5H3v-5l3-8h8Z"></path>
                  </svg>
                  <span data-fixture-touch-feedback aria-hidden="true"></span>
                </button>
              </button-view-model>
            </toggle-button-view-model>\`;
        }

        function reactionGroupMarkup(videoId, hydrated) {
          return \`
            <segmented-like-dislike-button-view-model data-fixture-reaction-group data-fixture-control-video-id="\${escapeAttribute(videoId)}">
              <yt-smartimation>
                <div id="content" data-fixture-smartimation-content-shell>
                  <div id="wrapper" data-fixture-smartimation-content>
                    <like-button-view-model class="style-text" data-fixture-role="like">
                      \${hydrated ? nativeButtonMarkup("like", videoId) : ""}
                    </like-button-view-model>
                    <dislike-button-view-model class="style-text" data-fixture-role="dislike">
                      \${hydrated ? nativeButtonMarkup("dislike", videoId) : ""}
                    </dislike-button-view-model>
                  </div>
                </div>
              </yt-smartimation>
            </segmented-like-dislike-button-view-model>\`;
        }

        function createActionHost(videoId, { hydrated = true } = {}) {
          const host = document.createElement("div");
          host.id = "top-level-buttons-computed";
          host.className = "fixture-action-host";
          host.dataset.fixtureCurrentActions = "true";
          host.dataset.fixtureHostIdentity = String(++hostSequence);
          host.innerHTML = reactionGroupMarkup(videoId, hydrated);
          host.dataset.fixtureNativeDislikeTextCount = String(
            host.querySelectorAll(
              'dislike-button-view-model [data-fixture-native-role="dislike"] .ytSpecButtonShapeNextButtonTextContent',
            ).length,
          );
          return host;
        }

        function createUnrelatedGroup() {
          const group = document.createElement("div");
          group.id = "flexible-item-buttons";
          group.dataset.fixtureUnrelatedActions = "true";
          group.innerHTML = \`
            <button-view-model data-fixture-unrelated-control="share">
              <button type="button" aria-label="Share"><div><span role="text">Share</span></div></button>
            </button-view-model>
            <button-view-model data-fixture-unrelated-control="download">
              <button type="button" aria-label="Download"><div><span role="text">Download</span></div></button>
            </button-view-model>\`;
          return group;
        }

        function createHiddenDuplicate(videoId) {
          const duplicate = createActionHost(videoId, { hydrated: true });
          duplicate.hidden = true;
          duplicate.dataset.fixtureHiddenDuplicate = "true";
          delete duplicate.dataset.fixtureCurrentActions;
          return duplicate;
        }

        function currentRoot() {
          return fixtureRoot.querySelector("ytd-watch-flexy");
        }

        function currentMenu() {
          return currentRoot()?.querySelector("ytd-menu-renderer.ytd-watch-metadata");
        }

        function currentHost() {
          return currentMenu()?.querySelector('[data-fixture-current-actions="true"]');
        }

        function installDecoys(videoId) {
          const menu = currentMenu();
          if (!menu) throw new Error("Cannot install decoys without a watch menu");
          menu.querySelector('[data-fixture-unrelated-actions="true"]')?.remove();
          menu.querySelector('[data-fixture-hidden-duplicate="true"]')?.remove();
          menu.append(createUnrelatedGroup(), createHiddenDuplicate(videoId));
        }

        function renderShell(videoId, { delayed = false } = {}) {
          fixtureRoot.innerHTML = \`
            <ytd-watch-flexy video-id="\${escapeAttribute(videoId)}">
              <div id="player" loading="false"></div>
              <div id="top-row">
                <ytd-menu-renderer class="ytd-watch-metadata"></ytd-menu-renderer>
              </div>
              <div id="retained-action-hosts" hidden></div>
              <nav class="fixture-navigation" aria-label="Fixture navigation">
                <a id="fixture-recommendation" href="/watch?v=\${configuration.videoIds.B}&rydExtensionLifecycle=1">Recommendation</a>
                <a id="fixture-playlist" href="/watch?v=\${configuration.videoIds.B}&list=fixture&rydExtensionLifecycle=1">Playlist next</a>
                <a id="fixture-history-next" href="/watch?v=\${configuration.videoIds.B}&rydExtensionLifecycle=1">History next</a>
              </nav>
            </ytd-watch-flexy>\`;
          currentMenu().append(createActionHost(videoId, { hydrated: !delayed }));
          installDecoys(videoId);
          phase = delayed ? "skeleton" : "ready";
          if (delayed) {
            pendingHydration = () => hydrateHostInPlace(currentHost(), videoId);
          }
        }

        function stripHostForHydration(host, videoId) {
          host.querySelectorAll(".ryd-tooltip").forEach((element) => element.remove());
          const group = host.querySelector("[data-fixture-reaction-group]");
          group.dataset.fixtureControlVideoId = videoId;
          for (const role of ["like", "dislike"]) {
            const control = group.querySelector(\`[data-fixture-role="\${role}"]\`);
            control.classList.remove("style-default-active");
            control.classList.add("style-text");
            control.replaceChildren();
          }
          host.dataset.fixtureHydrationState = "skeleton";
        }

        function hydrateHostInPlace(host, videoId) {
          if (!host?.isConnected) throw new Error("Cannot hydrate a disconnected action host");
          const group = host.querySelector("[data-fixture-reaction-group]");
          group.dataset.fixtureControlVideoId = videoId;
          for (const role of ["like", "dislike"]) {
            const control = group.querySelector(\`[data-fixture-role="\${role}"]\`);
            control.innerHTML = nativeButtonMarkup(role, videoId);
          }
          host.dataset.fixtureNativeDislikeTextCount = String(
            host.querySelectorAll(
              'dislike-button-view-model [data-fixture-native-role="dislike"] .ytSpecButtonShapeNextButtonTextContent',
            ).length,
          );
          host.dataset.fixtureHydrationState = "ready";
        }

        function updateNativeLikeCount(host, videoId) {
          const likeCount = configuration.likesByVideo[videoId] ?? 100;
          const likeButton = host.querySelector('[data-fixture-native-role="like"]');
          likeButton?.setAttribute("aria-label", \`\${likeCount} likes for \${escapeAttribute(videoId)}\`);
          const likeText = likeButton?.querySelector("#text, [role='text']");
          if (likeText) likeText.textContent = String(likeCount);
        }

        function beginNavigation(videoId, { mode, pushState, trigger }) {
          if (pendingHydration) throw new Error("A fixture hydration is already pending");
          const root = currentRoot();
          const menu = currentMenu();
          const outgoingHost = currentHost();
          if (!root || !menu || !outgoingHost) throw new Error("The outgoing watch controls are not ready");

          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
          if (pushState) {
            const list = trigger === "playlist" ? "&list=fixture" : "";
            history.pushState(
              { videoId },
              "",
              \`/watch?v=\${videoId}\${list}&rydExtensionLifecycle=1\`,
            );
          }
          currentVideoId = videoId;
          root.setAttribute("video-id", videoId);

          let destinationHost;
          if (mode === "reuse-visible") {
            destinationHost = outgoingHost;
            updateNativeLikeCount(destinationHost, videoId);
          } else if (mode === "reuse-in-place") {
            destinationHost = outgoingHost;
            stripHostForHydration(destinationHost, videoId);
            pendingHydration = () => hydrateHostInPlace(destinationHost, videoId);
          } else if (mode === "replace-host") {
            outgoingHost.removeAttribute("id");
            delete outgoingHost.dataset.fixtureCurrentActions;
            outgoingHost.dataset.fixtureRetainedOutgoing = "true";
            root.querySelector("#retained-action-hosts").append(outgoingHost);
            destinationHost = createActionHost(videoId, { hydrated: false });
            menu.prepend(destinationHost);
            pendingHydration = () => {
              const replacement = createActionHost(videoId, { hydrated: true });
              destinationHost.replaceWith(replacement);
            };
          } else {
            throw new Error(\`Unknown fixture hydration mode: \${mode}\`);
          }

          installDecoys(videoId);
          phase = mode === "reuse-visible" ? "visible-outgoing" : "skeleton";
          transitionLog.push({ mode, phase, trigger, videoId });
          document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
        }

        function hydratePending() {
          if (!pendingHydration) throw new Error("No fixture hydration is pending");
          const hydrate = pendingHydration;
          pendingHydration = null;
          hydrate();
          phase = "hydrated";
          transitionLog.push({ phase, videoId: currentVideoId });
        }

        function replaceReadyHost() {
          if (pendingHydration) throw new Error("Cannot replace controls while hydration is pending");
          const host = currentHost();
          if (!host) throw new Error("The current fixture action host is missing");
          const replacement = createActionHost(currentVideoId, { hydrated: true });
          host.replaceWith(replacement);
          transitionLog.push({ phase: "ready-host-replaced", videoId: currentVideoId });
          return replacement.dataset.fixtureHostIdentity;
        }

        function snapshot() {
          const root = currentRoot();
          const host = currentHost();
          const unrelated = root?.querySelector('[data-fixture-unrelated-actions="true"]');
          const hiddenDuplicate = root?.querySelector('[data-fixture-hidden-duplicate="true"]');
          const normalize = (element) => (element?.textContent ?? "").replace(/\\s+/g, " ").trim();
          const currentCountContainer = host?.querySelector(
            'dislike-button-view-model [data-fixture-native-role="dislike"] .ytSpecButtonShapeNextButtonTextContent',
          );
          return {
            currentBarCount: host?.querySelectorAll("#ryd-bar").length ?? -1,
            currentButtonCount: host?.querySelectorAll('[data-fixture-native-role="like"], [data-fixture-native-role="dislike"]').length ?? -1,
            currentCount: normalize(currentCountContainer),
            currentCountContainerCount:
              host?.querySelectorAll(
                'dislike-button-view-model [data-fixture-native-role="dislike"] .ytSpecButtonShapeNextButtonTextContent',
              ).length ?? -1,
            currentCountCreatedByRuntime:
              Boolean(currentCountContainer) && Number(host?.dataset.fixtureNativeDislikeTextCount ?? -1) === 0,
            currentFixtureControlVideoId:
              host?.querySelector("[data-fixture-reaction-group]")?.dataset.fixtureControlVideoId ?? null,
            currentHostIdentity: host?.dataset.fixtureHostIdentity ?? null,
            currentNativeDislikeTextCount: Number(host?.dataset.fixtureNativeDislikeTextCount ?? -1),
            currentVideoId,
            globalBarCount: document.querySelectorAll("#ryd-bar").length,
            globalContainerCount: document.querySelectorAll("#ryd-bar-container").length,
            globalWrapperCount: document.querySelectorAll(".ryd-tooltip").length,
            hiddenDuplicateBarCount: hiddenDuplicate?.querySelectorAll("#ryd-bar").length ?? -1,
            phase,
            retainedBarCount: root?.querySelectorAll('[data-fixture-retained-outgoing="true"] #ryd-bar').length ?? 0,
            transitionLog: transitionLog.map((entry) => ({ ...entry })),
            unrelatedBarCount: unrelated?.querySelectorAll("#ryd-bar").length ?? -1,
            unrelatedLabels: [...(unrelated?.querySelectorAll("span[role='text']") ?? [])].map(normalize),
            urlVideoId: new URL(location.href).searchParams.get("v"),
          };
        }

        fixtureRoot.addEventListener("click", (event) => {
          const navigation = event.target.closest("a");
          if (navigation) {
            if (navigation.id === "fixture-recommendation") {
              event.preventDefault();
              beginNavigation(configuration.videoIds.B, {
                mode: "reuse-visible",
                pushState: true,
                trigger: "recommendation",
              });
            } else if (navigation.id === "fixture-playlist") {
              event.preventDefault();
              beginNavigation(configuration.videoIds.B, {
                mode: "replace-host",
                pushState: true,
                trigger: "playlist",
              });
            } else if (navigation.id === "fixture-history-next") {
              event.preventDefault();
              beginNavigation(configuration.videoIds.B, {
                mode: "replace-host",
                pushState: true,
                trigger: "history-push",
              });
            }
            return;
          }

          const reactionButton = event.target.closest("button[data-fixture-native-role]");
          if (!reactionButton) return;
          const role = reactionButton.dataset.fixtureNativeRole;
          const group = reactionButton.closest("[data-fixture-reaction-group]");
          const otherRole = role === "like" ? "dislike" : "like";
          const pressed = reactionButton.getAttribute("aria-pressed") === "true";
          reactionButton.setAttribute("aria-pressed", String(!pressed));
          group
            ?.querySelector(\`button[data-fixture-native-role="\${otherRole}"]\`)
            ?.setAttribute("aria-pressed", "false");
        });

        addEventListener("popstate", (event) => {
          const targetVideoId = event.state?.videoId ?? new URL(location.href).searchParams.get("v");
          beginNavigation(targetVideoId, {
            mode: "replace-host",
            pushState: false,
            trigger: "history-pop",
          });
        });

        const initialUrl = new URL(location.href);
        history.replaceState({ videoId: currentVideoId }, "", initialUrl);
        renderShell(currentVideoId, { delayed: initialUrl.searchParams.get("initial") === "delayed" });
        globalThis.__extensionLifecycleFixture = {
          beginNavigation,
          hydratePending,
          replaceReadyHost,
          snapshot,
          videoIds: { ...configuration.videoIds },
        };
      })();
    </script>
  </body>
</html>`;
}

module.exports = {
  DEFAULT_VIDEO_IDS,
  createExtensionNavigationFixture,
};
