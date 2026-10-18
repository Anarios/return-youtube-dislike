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

function miniplayerNotice(
  text,
  helpUrl = "//support.google.com/youtube/bin/answer.py?answer=9632097&nohelpkit=1&hl=en",
) {
  return {
    miniplayer: {
      miniplayerRenderer: {
        playbackMode: "PLAYBACK_MODE_PAUSED_ONLY",
        minimizedEndpoint: {
          openPopupAction: {
            popup: {
              notificationActionRenderer: {
                responseText: { simpleText: text },
                actionButton: {
                  buttonRenderer: {
                    command: {
                      urlEndpoint: { url: helpUrl },
                      commandMetadata: { webCommandMetadata: { url: helpUrl } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

const ENGLISH_KIDS_NOTICE = "Miniplayer is off for videos made for kids. Tap play to resume";

test("reads disabled watch evidence from the page-owned controller without text matching", () => {
  expect(state(watch())).toEqual({ videoId: VIDEO, disabled: true, madeForKids: false });
});

test("only an explicit kids flag for the current video excludes the discussion", () => {
  const root = watch();
  window.ytInitialPlayerResponse = { videoDetails: { videoId: "zyxwvutsrqp", isMadeForKids: true } };
  expect(state(root).madeForKids).toBe(false);
  window.ytInitialPlayerResponse = {
    videoDetails: { videoId: VIDEO },
    microformat: { playerMicroformatRenderer: { isFamilySafe: true } },
  };
  expect(state(root).madeForKids).toBe(false);
  window.ytInitialPlayerResponse.videoDetails.isMadeForKids = true;
  expect(state(root).madeForKids).toBe(true);
});

test("recognizes the current video's explicit miniplayer kids notice", () => {
  const root = watch();
  window.ytInitialPlayerResponse = {
    videoDetails: { videoId: VIDEO },
    playabilityStatus: miniplayerNotice(ENGLISH_KIDS_NOTICE),
  };
  expect(state(root).madeForKids).toBe(true);
  window.ytInitialPlayerResponse.videoDetails.videoId = "zyxwvutsrqp";
  expect(state(root).madeForKids).toBe(false);
});

test.each([
  ["en", "//support.google.com/youtube/bin/answer.py?answer=9632097&nohelpkit=1&hl=en"],
  ["ru", "//support.google.com/youtube/bin/answer.py?answer=9632097&nohelpkit=1&hl=ru"],
  ["ru", "https://support.google.com/youtube/answer/9632097?hl=ru"],
])("uses the current miniplayer's made-for-kids help link independently of %s wording", (language, helpUrl) => {
  const root = watch();
  document.documentElement.lang = language;
  window.ytInitialPlayerResponse = {
    videoDetails: { videoId: VIDEO },
    playabilityStatus: miniplayerNotice("Localized miniplayer notice", helpUrl),
  };
  expect(state(root).madeForKids).toBe(true);
  delete window.ytInitialPlayerResponse.playabilityStatus.miniplayer.miniplayerRenderer.minimizedEndpoint
    .openPopupAction.popup.notificationActionRenderer.actionButton.buttonRenderer.command.urlEndpoint;
  expect(state(root).madeForKids).toBe(true);
  window.ytInitialPlayerResponse.playabilityStatus.miniplayer.miniplayerRenderer.playbackMode = "PLAYBACK_MODE_ALLOW";
  expect(state(root).madeForKids).toBe(false);
});

test.each([
  "https://support.google.com/youtube/answer/9706180",
  "https://support.google.com.example.test/youtube/answer/9632097",
  "https://support.google.com/youtube/bin/answer.py?answer=9706180",
  "",
])("does not infer a kids restriction from miniplayer text with an unrelated or absent help link: %s", (helpUrl) => {
  const root = watch();
  window.ytInitialPlayerResponse = {
    videoDetails: { videoId: VIDEO },
    playabilityStatus: miniplayerNotice(ENGLISH_KIDS_NOTICE, helpUrl),
  };
  expect(state(root).madeForKids).toBe(false);
});

test("ignores matching miniplayer text in descriptions, recommendations and advertisements", () => {
  const root = watch();
  const kids = { videoDetails: { videoId: "zyxwvutsrqp" }, playabilityStatus: miniplayerNotice(ENGLISH_KIDS_NOTICE) };
  window.ytInitialPlayerResponse = {
    videoDetails: { videoId: VIDEO, shortDescription: ENGLISH_KIDS_NOTICE },
    playabilityStatus: miniplayerNotice(
      "Miniplayer is unavailable. Please try again.",
      "https://support.google.com/youtube/answer/9706180",
    ),
    endscreen: { videos: [kids] },
    adPlacements: [kids],
  };
  expect(state(root).madeForKids).toBe(false);
});

test("finds a disabled Shorts comment button through its controller model", () => {
  window.history.replaceState({}, "", `/shorts/${VIDEO}`);
  document.body.innerHTML = `<ytd-reel-video-renderer video-id="${VIDEO}"><reel-action-bar-view-model></reel-action-bar-view-model></ytd-reel-video-renderer>`;
  const root = document.querySelector("ytd-reel-video-renderer");
  root.querySelector("reel-action-bar-view-model").polymerController = {
    data: {
      buttonViewModels: [
        { buttonViewModel: { iconName: "SHORTS_COMMENT", state: "BUTTON_VIEW_MODEL_STATE_DISABLED" } },
      ],
    },
  };
  expect(state(root)).toEqual({ videoId: VIDEO, disabled: true, madeForKids: false });
  root.querySelector("reel-action-bar-view-model").polymerController.data.buttonViewModels[0].buttonViewModel.state =
    "BUTTON_VIEW_MODEL_STATE_ACTIVE";
  expect(state(root).disabled).toBe(false);
});

test.each(["isMadeForKids", "madeForKids", "is_made_for_kids"])(
  "accepts current response and microformat %s flags but ignores unrelated nested videos",
  (flag) => {
    const root = watch();
    window.ytInitialPlayerResponse = {
      videoDetails: { videoId: VIDEO },
      endscreen: { videos: [{ videoId: "zyxwvutsrqp", [flag]: true }] },
      adPlacements: [{ videoDetails: { videoId: "zyxwvutsrqp", [flag]: true } }],
      microformat: { playerMicroformatRenderer: { recommendations: [{ [flag]: true }] } },
    };
    expect(state(root).madeForKids).toBe(false);
    window.ytInitialPlayerResponse.microformat.playerMicroformatRenderer[flag] = true;
    expect(state(root).madeForKids).toBe(true);
    window.ytInitialPlayerResponse.microformat.playerMicroformatRenderer.videoId = "zyxwvutsrqp";
    expect(state(root).madeForKids).toBe(false);
    window.ytInitialPlayerResponse[flag] = true;
    expect(state(root).madeForKids).toBe(true);
  },
);

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
  expect(state(document.getElementById("current"))).toEqual({ videoId: VIDEO, disabled: true, madeForKids: false });
});
