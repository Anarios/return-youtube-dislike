/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

const source = require("fs").readFileSync(require("path").join(__dirname, "../../comments-bridge.js"), "utf8");
const VIDEO = "abcdefghijk";
let handler;

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, "", `/watch?v=${VIDEO}`);
  delete window[Symbol.for("return-youtube-dislike.discussion-bridge")];
  const spy = jest.spyOn(document, "addEventListener");
  window.eval(source);
  handler = spy.mock.calls.find(([name]) => name === "ryd-discussion-state-request")[1];
  spy.mockRestore();
});
afterEach(() => {
  document.removeEventListener("ryd-discussion-state-request", handler, true);
  delete window.ytInitialPlayerResponse;
  delete window.ytcfg;
});

function state(root) {
  root.dispatchEvent(new Event("ryd-discussion-state-request"));
  return JSON.parse(root.getAttribute("data-ryd-discussion-native-state"));
}
function watch() {
  document.body.innerHTML = `<ytd-watch-flexy video-id="${VIDEO}"><ytd-comments></ytd-comments></ytd-watch-flexy>`;
  const root = document.querySelector("ytd-watch-flexy");
  root.querySelector("ytd-comments").polymerController = {
    data: {
      contents: [
        {
          messageRenderer: {
            text: {
              runs: [
                { text: "Комментарии отключены." },
                {
                  navigationEndpoint: {
                    urlEndpoint: { url: "https://support.google.com/youtube/answer/9706180?hl=ru" },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  };
  return root;
}

test("reads disabled watch evidence from the page-owned controller without text matching", () => {
  expect(state(watch())).toEqual({ videoId: VIDEO, disabled: true });
});

test("reports the same native state whatever the video's audience setting", () => {
  const root = watch();
  root.setAttribute("made-for-kids", "");
  window.ytInitialPlayerResponse = { videoDetails: { videoId: VIDEO, isMadeForKids: true } };
  expect(state(root)).toEqual({ videoId: VIDEO, disabled: true });
});

const OTHER_VIDEO = "zyxwvutsrqp";
const PLAIN_NOTICE = { messageRenderer: { text: { runs: [{ text: "Comments are turned off" }] } } };
const NOTICE_SECTION = { sectionIdentifier: "comment-item-section", contents: [PLAIN_NOTICE] };

function watchWithResponse({ section = NOTICE_SECTION, videoId = VIDEO, panels = [] } = {}) {
  document.body.innerHTML = `<ytd-watch-flexy video-id="${VIDEO}"><ytd-comments></ytd-comments></ytd-watch-flexy>`;
  const root = document.querySelector("ytd-watch-flexy");
  root.polymerController = {
    data: {
      currentVideoEndpoint: { watchEndpoint: { videoId } },
      contents: {
        twoColumnWatchNextResults: { results: { results: { contents: [{ itemSectionRenderer: section }] } } },
      },
      engagementPanels: panels.map((targetId) => ({ engagementPanelSectionListRenderer: { targetId } })),
    },
  };
  root.querySelector("ytd-comments").polymerController = { data: section };
  return root;
}

function restrictedMode() {
  window.ytcfg = { get: (key) => (key === "INNERTUBE_CONTEXT" ? { user: { enableSafetyMode: true } } : undefined) };
}

test("recognizes a current response whose comments section holds only a notice without a help link", () => {
  expect(state(watchWithResponse())).toEqual({ videoId: VIDEO, disabled: true });
});

test.each([
  ["a comments header", { section: { ...NOTICE_SECTION, header: { commentsHeaderRenderer: {} } } }],
  [
    "a notice beside a comments continuation",
    { section: { ...NOTICE_SECTION, contents: [PLAIN_NOTICE, { continuationItemRenderer: {} }] } },
  ],
  ["an empty comments section", { section: { ...NOTICE_SECTION, contents: [] } }],
  ["a comments section without contents", { section: { sectionIdentifier: "comment-item-section" } }],
  ["no comments section", { section: { ...NOTICE_SECTION, sectionIdentifier: "related-items" } }],
  ["a comments engagement panel", { panels: ["engagement-panel-comments-section"] }],
  ["a response that still belongs to the previous video", { videoId: OTHER_VIDEO }],
])("keeps native comments when the page has %s", (_, response) => {
  expect(state(watchWithResponse(response)).disabled).toBe(false);
});

test("Restricted Mode notices never count as comments being unavailable", () => {
  restrictedMode();
  expect(state(watchWithResponse()).disabled).toBe(false);
});

test("Restricted Mode keeps the comments-off help link behavior", () => {
  restrictedMode();
  expect(state(watch())).toEqual({ videoId: VIDEO, disabled: true });
});

function shortsWithActions(buttonViewModels) {
  window.history.replaceState({}, "", `/shorts/${VIDEO}`);
  document.body.innerHTML = `<ytd-reel-video-renderer video-id="${VIDEO}"><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer>`;
  const root = document.querySelector("ytd-reel-video-renderer");
  root.querySelector("reel-action-bar-view-model").polymerController = { data: { buttonViewModels } };
  return root;
}

function likeButton(videoId, innertubeCommand = { likeEndpoint: { target: { videoId } } }) {
  const buttonViewModel = { onTap: { innertubeCommand } };
  return {
    likeButtonViewModel: {
      toggleButtonViewModel: { toggleButtonViewModel: { defaultButtonViewModel: { buttonViewModel } } },
    },
  };
}

const SHARE_BUTTON = { buttonViewModel: { iconName: "SHORTS_SHARE", state: "BUTTON_VIEW_MODEL_STATE_ACTIVE" } };

function commentButton(state) {
  return { buttonViewModel: { iconName: "SHORTS_COMMENT", state: `BUTTON_VIEW_MODEL_STATE_${state}` } };
}

test("finds a disabled Shorts comment button through its controller model", () => {
  expect(state(shortsWithActions([commentButton("DISABLED")]))).toEqual({ videoId: VIDEO, disabled: true });
  expect(state(shortsWithActions([commentButton("ACTIVE")])).disabled).toBe(false);
});

test("treats a loaded Short without a comment button as having comments turned off", () => {
  expect(state(shortsWithActions([likeButton(VIDEO), SHARE_BUTTON]))).toEqual({ videoId: VIDEO, disabled: true });
});

test("finds the current Short's like target behind a sign-in prompt", () => {
  const signIn = {
    modalEndpoint: {
      modal: {
        modalWithTitleAndButtonRenderer: {
          button: {
            buttonRenderer: {
              navigationEndpoint: {
                signInEndpoint: { nextEndpoint: { likeEndpoint: { target: { videoId: VIDEO } } } },
              },
            },
          },
        },
      },
    },
  };
  expect(state(shortsWithActions([likeButton(VIDEO, signIn), SHARE_BUTTON])).disabled).toBe(true);
});

test.each([
  ["an active comment button", [likeButton(VIDEO), commentButton("ACTIVE"), SHARE_BUTTON]],
  [
    "a renamed comment button",
    [likeButton(VIDEO), { buttonViewModel: { iconName: "COMMENT", accessibilityId: "id.reel_comment_button" } }],
  ],
  [
    "a wrapped button that opens the comments panel",
    [
      likeButton(VIDEO),
      {
        wrapperViewModel: {
          buttonViewModel: {
            onTap: {
              innertubeCommand: { showEngagementPanelEndpoint: { identifier: { tag: "shorts-comments-panel" } } },
            },
          },
        },
      },
    ],
  ],
  ["an action bar still showing another video", [likeButton(OTHER_VIDEO), SHARE_BUTTON]],
  ["an action bar that has not loaded its buttons", []],
])("keeps native comments on a Short with %s", (_, buttons) => {
  expect(state(shortsWithActions(buttons)).disabled).toBe(false);
});

test("trusts the current Short's buttons over a stale action bar", () => {
  const root = shortsWithActions([likeButton(OTHER_VIDEO), commentButton("DISABLED")]);
  root.polymerController = {
    data: {
      overlay: {
        reelPlayerOverlayRenderer: {
          buttonBar: { reelActionBarViewModel: { buttonViewModels: [likeButton(VIDEO), commentButton("ACTIVE")] } },
        },
      },
    },
  };
  expect(state(root).disabled).toBe(false);
});

test("does not expose a result for an outgoing Shorts renderer", () => {
  window.history.replaceState({}, "", `/shorts/${VIDEO}`);
  document.body.innerHTML = '<ytd-reel-video-renderer video-id="zyxwvutsrqp"></ytd-reel-video-renderer>';
  expect(state(document.querySelector("ytd-reel-video-renderer"))).toBeNull();
});

test("recognizes an unmarked current reel by contained player identity while rejecting retained reels", () => {
  window.history.replaceState({}, "", `/shorts/${VIDEO}`);
  document.body.innerHTML =
    "<ytd-reel-video-renderer id='retained'><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer><ytd-reel-video-renderer id='current'><div id='shorts-player'></div><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer>";
  document.getElementById("shorts-player").getVideoData = () => ({ video_id: VIDEO });
  for (const action of document.querySelectorAll("reel-action-bar-view-model"))
    action.data = {
      buttonViewModels: [
        { buttonViewModel: { iconName: "SHORTS_COMMENT", state: "BUTTON_VIEW_MODEL_STATE_DISABLED" } },
      ],
    };
  expect(state(document.getElementById("retained"))).toBeNull();
  expect(state(document.getElementById("current"))).toEqual({ videoId: VIDEO, disabled: true });
});
