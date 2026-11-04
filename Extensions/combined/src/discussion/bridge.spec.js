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

test("reads disabled watch evidence from the page-owned controller without text matching", () => {
  expect(state(watch())).toEqual({ videoId: VIDEO, disabled: true });
});

test("reports the same native state whatever the video's audience setting", () => {
  const root = watch();
  root.setAttribute("made-for-kids", "");
  window.ytInitialPlayerResponse = { videoDetails: { videoId: VIDEO, isMadeForKids: true } };
  expect(state(root)).toEqual({ videoId: VIDEO, disabled: true });
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
  expect(state(root)).toEqual({ videoId: VIDEO, disabled: true });
  root.querySelector("reel-action-bar-view-model").polymerController.data.buttonViewModels[0].buttonViewModel.state =
    "BUTTON_VIEW_MODEL_STATE_ACTIVE";
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
