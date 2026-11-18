/** @jest-environment jsdom */
import { normalizePlaybackPosition, readPlaybackPosition } from "./playback-position";

const VIDEO_ID = "abcdefghijk";

function addPlayer({ id, className = "html5-video-player", rendered = true, currentTime = 0, parent = document.body }) {
  const player = document.createElement("div");
  if (id) player.id = id;
  player.className = className;
  player.getClientRects = () => (rendered ? [{ width: 640, height: 360 }] : []);
  const video = document.createElement("video");
  video.className = "html5-main-video";
  Object.defineProperty(video, "currentTime", { configurable: true, get: () => currentTime });
  player.append(video);
  parent.append(player);
  return player;
}

afterEach(() => {
  document.body.replaceChildren();
  history.replaceState(null, "", "/");
});

describe("normalizePlaybackPosition", () => {
  it.each([0, 1, 125, 2_147_483_646])("keeps the whole second %p", (value) => {
    expect(normalizePlaybackPosition(value)).toBe(value);
  });

  it.each([undefined, null, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "12", 2_147_483_647])(
    "drops %p",
    (value) => {
      expect(normalizePlaybackPosition(value)).toBeUndefined();
    },
  );
});

describe("readPlaybackPosition", () => {
  it("returns whole seconds from the watch player", () => {
    addPlayer({ id: "movie_player", currentTime: 83.97 });

    expect(readPlaybackPosition(VIDEO_ID)).toBe(83);
  });

  it("prefers the rendered Shorts player over the hidden watch player", () => {
    history.replaceState(null, "", `/shorts/${VIDEO_ID}`);
    addPlayer({ id: "movie_player", rendered: false, currentTime: 400 });
    addPlayer({ id: "shorts-player", currentTime: 7.2 });

    expect(readPlaybackPosition(VIDEO_ID)).toBe(7);
  });

  it("uses the watch player when a Shorts player is retained on the watch page", () => {
    history.replaceState(null, "", `/watch?v=${VIDEO_ID}`);
    addPlayer({ id: "shorts-player", currentTime: 3 });
    addPlayer({ id: "movie_player", currentTime: 61 });

    expect(readPlaybackPosition(VIDEO_ID)).toBe(61);
  });

  it("uses the requested Short when YouTube keeps the previous renderer mounted", () => {
    history.replaceState(null, "", `/shorts/${VIDEO_ID}`);
    document.body.innerHTML = `<ytd-reel-video-renderer video-id="zyxwvutsrqp" is-active></ytd-reel-video-renderer>
      <ytd-reel-video-renderer video-id="${VIDEO_ID}"></ytd-reel-video-renderer>`;
    const [previous, current] = document.querySelectorAll("ytd-reel-video-renderer");
    addPlayer({ id: "shorts-player", currentTime: 3, parent: previous });
    addPlayer({ id: "shorts-player", currentTime: 7.2, parent: current });

    expect(readPlaybackPosition(VIDEO_ID)).toBe(7);
  });

  it.each(["data attribute", "player link"])("identifies the current mobile Short by its %s", (identity) => {
    history.replaceState(null, "", `/shorts/${VIDEO_ID}`);
    document.body.innerHTML = `<ytm-reel-video-renderer is-active></ytm-reel-video-renderer>
      <ytm-reel-video-renderer></ytm-reel-video-renderer>`;
    const [previous, current] = document.querySelectorAll("ytm-reel-video-renderer");
    if (identity === "data attribute") {
      previous.dataset.videoId = "zyxwvutsrqp";
      current.dataset.videoId = VIDEO_ID;
    } else {
      previous.innerHTML = '<a class="ytp-title-link" href="/shorts/zyxwvutsrqp"></a>';
      current.innerHTML = `<a class="ytp-title-link" href="/shorts/${VIDEO_ID}"></a>`;
    }
    addPlayer({ id: "shorts-player", currentTime: 9, parent: previous });
    addPlayer({ id: "shorts-player", currentTime: 17.4, parent: current });

    expect(readPlaybackPosition(VIDEO_ID)).toBe(17);
  });

  it("omits the position while only the previous video remains mounted", () => {
    history.replaceState(null, "", `/watch?v=${VIDEO_ID}`);
    document.body.innerHTML = '<ytd-watch-flexy video-id="zyxwvutsrqp"></ytd-watch-flexy>';
    addPlayer({ id: "movie_player", currentTime: 49.8, parent: document.querySelector("ytd-watch-flexy") });

    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();
  });

  it("falls back to another rendered player but never to the inline preview", () => {
    addPlayer({ id: "inline-preview-player", currentTime: 12 });
    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();

    addPlayer({ currentTime: 30 });
    expect(readPlaybackPosition(VIDEO_ID)).toBe(30);
  });

  it("returns nothing while an ad plays", () => {
    addPlayer({ id: "movie_player", className: "html5-video-player ad-showing", currentTime: 4 });

    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -2])("returns nothing for a current time of %p", (currentTime) => {
    addPlayer({ id: "movie_player", currentTime });

    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();
  });

  it("returns nothing without a rendered player or video", () => {
    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();

    const player = addPlayer({ id: "movie_player" });
    player.replaceChildren();
    expect(readPlaybackPosition(VIDEO_ID)).toBeUndefined();
  });

  it("searches only the given root", () => {
    const root = document.createElement("section");
    document.body.append(root);
    addPlayer({ id: "movie_player", currentTime: 90 });
    addPlayer({ className: "html5-video-player", currentTime: 15, parent: root });

    expect(readPlaybackPosition(VIDEO_ID, root)).toBe(15);
  });
});
