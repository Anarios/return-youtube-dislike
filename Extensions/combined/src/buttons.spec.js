/** @jest-environment jsdom */

jest.mock("./private-browsing", () => ({
  ...jest.requireActual("./private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));

const { isPrivateBrowsingContext } = require("./private-browsing");
const { extConfig, refreshReactionPresentation } = require("./state");
const {
  ensureSyntheticShortsDislikeButton,
  getButtonControls,
  getButtons,
  getDislikeButton,
  getDislikeTextContainer,
  getLikeButton,
  getNativeButton,
  getShortsCandidateVideoId,
  getShortsCandidateVideoIds,
  hasRenderedBox,
  isSyntheticShortsDislike,
  markButtonsForVideo,
  refreshDislikeTextTypography,
  setSyntheticShortsDislikeEnabled,
  setSyntheticShortsDislikePressed,
  __RewireAPI__: buttonsRewire,
} = require("./buttons");
const { captureShortsNativeControlInventory } = require("../../common/shorts-control-readiness");

function controls(id, videoId, attributes = "") {
  return `
    <ytd-menu-renderer class="ytd-watch-metadata" ${attributes}>
      <div id="${id}" data-video-id="${videoId}">
        <segmented-like-dislike-button-view-model>
          <like-button-view-model id="segmented-like-button"><button aria-pressed="false"><span class="yt-spec-button-shape-next__button-text-content" role="text">100</span></button></like-button-view-model>
          <dislike-button-view-model id="segmented-dislike-button"><button aria-pressed="false"><span class="yt-spec-button-shape-next__button-text-content" role="text"></span></button></dislike-button-view-model>
        </segmented-like-dislike-button-view-model>
      </div>
    </ytd-menu-renderer>`;
}

function setBox(element, { height = 48, width = 320, x = 20, y = 20 } = {}) {
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
}

function typographyControls(nativeText) {
  document.body.innerHTML = `
    <style>
      .ytSpecButtonShapeNextButtonTextContent,
      .ytSpecButtonShapeNextButtonTextContent > span[role='text'] {
        font-size: 14px;
        font-weight: 500;
        font-family: Roboto, Arial, sans-serif;
        line-height: 40px;
      }
      like-button-view-model .fixture-digit {
        font-size: 21px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        line-height: 21px;
      }
      like-button-view-model .fixture-large { font-size: 25px; line-height: 27px; }
      like-button-view-model .fixture-static { font-size: 18px; line-height: 24px; }
      .fixture-screen-reader { position: absolute; clip: rect(0px, 0px, 0px, 0px); }
    </style>
    <ytd-watch-flexy video-id="BBBBBBBBBBB">
      <ytd-menu-renderer class="ytd-watch-metadata">
        <div id="current">
          <like-button-view-model>
            <button aria-pressed="false">
              <div class="ytSpecButtonShapeNextButtonTextContent ytSpecButtonShapeNextElevatedContent">${nativeText}</div>
            </button>
          </like-button-view-model>
          <dislike-button-view-model>
            <button class="ytSpecButtonShapeNextIconButton" aria-pressed="false">
              <span class="ytSpecButtonShapeNextIcon"><svg width="24" height="24"><path d="M0 0"></path></svg></span>
            </button>
          </dislike-button-view-model>
        </div>
      </ytd-menu-renderer>
    </ytd-watch-flexy>`;
  const current = document.querySelector("#current");
  setBox(current);
  setNativeTextBoxes();
  return current;
}

function setNativeTextBoxes() {
  document.querySelectorAll("like-button-view-model *").forEach((element) => setBox(element));
}

describe("desktop watch button ownership", () => {
  beforeEach(() => {
    isPrivateBrowsingContext.mockReturnValue(false);
    history.replaceState({}, "", "/watch?v=BBBBBBBBBBB");
    extConfig.selectors.buttons.regular.desktopMenu = ["ytd-menu-renderer.ytd-watch-metadata > div"];
    extConfig.selectors.buttons.regular.desktopNoMenu = ["#top-level-buttons-computed"];
    document.body.innerHTML = "";
  });

  test("prefers viewport-intersecting destination controls over a positive-size offscreen sibling in the same root", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("stale", "AAAAAAAAAAA")}
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    setBox(document.querySelector("#stale"), { x: -10_000 });
    setBox(document.querySelector("#current"), { x: 40 });

    expect(getButtons()).toBe(document.querySelector("#current"));
  });

  test("prefers unowned destination controls over initialized outgoing controls when both overlap in the current root", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("stale", "AAAAAAAAAAA")}
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    const stale = document.querySelector("#stale");
    const current = document.querySelector("#current");
    setBox(stale, { x: 40 });
    setBox(current, { x: 40 });
    markButtonsForVideo(stale, "AAAAAAAAAAA");

    expect(getButtons()).toBe(current);
  });

  test("falls back to a reused marked control when it is the only current-root candidate", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("reused", "AAAAAAAAAAA")}
      </ytd-watch-flexy>`;
    const reused = document.querySelector("#reused");
    setBox(reused, { x: 40 });
    markButtonsForVideo(reused, "AAAAAAAAAAA");

    expect(getButtons()).toBe(reused);
  });

  test("ignores hidden, transparent, and inert stale candidates before current controls", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        <div hidden>${controls("hidden-stale", "AAAAAAAAAAA")}</div>
        <div style="opacity: 0">${controls("transparent-stale", "AAAAAAAAAAA")}</div>
        <div inert>${controls("inert-stale", "AAAAAAAAAAA")}</div>
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    ["#hidden-stale", "#transparent-stale", "#inert-stale", "#current"].forEach((selector) =>
      setBox(document.querySelector(selector)),
    );

    expect(getButtons()).toBe(document.querySelector("#current"));
    expect(hasRenderedBox(document.querySelector("#hidden-stale"))).toBe(false);
    expect(hasRenderedBox(document.querySelector("#transparent-stale"))).toBe(false);
    expect(hasRenderedBox(document.querySelector("#inert-stale"))).toBe(false);
  });

  test("does not bind rendered controls owned by an explicit outgoing video root", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="AAAAAAAAAAA">
        ${controls("outgoing", "AAAAAAAAAAA")}
      </ytd-watch-flexy>`;
    setBox(document.querySelector("#outgoing"));

    expect(getButtons()).toBeUndefined();
  });

  test("accepts fixed-position current controls even though they have no offset parent", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("current", "BBBBBBBBBBB", 'style="position: fixed"')}
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    setBox(current);

    expect(current.offsetParent).toBeNull();
    expect(hasRenderedBox(current)).toBe(true);
    expect(getButtons()).toBe(current);
  });

  test("uses an offscreen current-root candidate as a fallback when no viewport candidate exists", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    setBox(current, { x: -10_000 });

    expect(hasRenderedBox(current)).toBe(true);
    expect(getButtons()).toBe(current);
  });

  test("scopes segmented reaction controls to the selected destination container", () => {
    const originalSegmentedContainer = extConfig.selectors.buttons.segmentedContainer;
    extConfig.selectors.buttons.segmentedContainer = ["segmented-like-dislike-button-view-model"];
    try {
      document.body.innerHTML = `
        <ytd-watch-flexy video-id="BBBBBBBBBBB">
          ${controls("stale", "AAAAAAAAAAA")}
          ${controls("current", "BBBBBBBBBBB")}
        </ytd-watch-flexy>`;
      setBox(document.querySelector("#stale"), { x: -10_000 });
      setBox(document.querySelector("#current"), { x: 40 });

      const current = document.querySelector("#current");
      expect(getButtons()).toBe(current);
      expect(getLikeButton()).toBe(current.querySelector("like-button-view-model"));
      expect(getDislikeButton()).toBe(current.querySelector("dislike-button-view-model"));
    } finally {
      extConfig.selectors.buttons.segmentedContainer = originalSegmentedContainer;
    }
  });

  test("keeps visible reused reactions ahead of an unrelated unowned menu group and hidden duplicate", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("reused", "AAAAAAAAAAA")}
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="flexible-item-buttons">
            <button-view-model>
              <button type="button" aria-label="Share"><span role="text">Share</span></button>
            </button-view-model>
            <button-view-model>
              <button type="button" aria-label="Download"><span role="text">Download</span></button>
            </button-view-model>
          </div>
        </ytd-menu-renderer>
        ${controls("hidden-duplicate", "BBBBBBBBBBB", "hidden")}
      </ytd-watch-flexy>`;
    const reused = document.querySelector("#reused");
    const unrelated = document.querySelector("#flexible-item-buttons");
    const hiddenDuplicate = document.querySelector("#hidden-duplicate");
    [reused, unrelated, hiddenDuplicate].forEach((candidate) => setBox(candidate, { x: 40 }));
    markButtonsForVideo(reused, "AAAAAAAAAAA");

    expect(getButtonControls(unrelated).ready).toBe(false);
    expect(hasRenderedBox(hiddenDuplicate)).toBe(false);
    expect(getButtons()).toBe(reused);
  });

  test("accepts configured legacy segmented reaction controls", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="legacy">
            <ytd-segmented-like-dislike-button-renderer>
              <ytd-toggle-button-renderer id="segmented-like-button">
                <button aria-pressed="false"><span role="text">100</span></button>
              </ytd-toggle-button-renderer>
              <ytd-toggle-button-renderer id="segmented-dislike-button">
                <button aria-pressed="false"><span role="text"></span></button>
              </ytd-toggle-button-renderer>
            </ytd-segmented-like-dislike-button-renderer>
          </div>
        </ytd-menu-renderer>
      </ytd-watch-flexy>`;
    const legacy = document.querySelector("#legacy");
    setBox(legacy);

    expect(getButtonControls(legacy).ready).toBe(true);
    expect(getButtons()).toBe(legacy);
  });

  test("accepts positional legacy toggles only inside the configured reaction root", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="top-level-buttons-computed">
            <ytd-toggle-button-renderer>
              <button aria-pressed="false"><span role="text">100</span></button>
            </ytd-toggle-button-renderer>
            <ytd-toggle-button-renderer>
              <button aria-pressed="false"><span role="text"></span></button>
            </ytd-toggle-button-renderer>
          </div>
        </ytd-menu-renderer>
      </ytd-watch-flexy>`;
    const legacy = document.querySelector("#top-level-buttons-computed");
    setBox(legacy);

    expect(getButtonControls(legacy).ready).toBe(true);
    expect(getButtons()).toBe(legacy);
  });

  test("waits for native button hydration in place", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    const dislikeHost = current.querySelector("dislike-button-view-model");
    dislikeHost.querySelector("button").remove();
    setBox(current);

    expect(getButtonControls(current).ready).toBe(false);
    expect(getButtons()).toBeUndefined();

    dislikeHost.innerHTML = '<button aria-pressed="false"><span role="text"></span></button>';

    expect(getButtonControls(current).ready).toBe(true);
    expect(getButtons()).toBe(current);
  });

  test("prefers the native toggle subtree even before its pressed state hydrates", () => {
    document.body.innerHTML = `
      <like-button-view-model>
        <div><button id="speed" aria-pressed="true">1x</button></div>
        <toggle-button-view-model><button-view-model><label><button id="native"></button></label></button-view-model></toggle-button-view-model>
      </like-button-view-model>`;
    const host = document.querySelector("like-button-view-model");
    const nativeButton = host.querySelector("#native");
    expect(getNativeButton(host)).toBe(nativeButton);

    nativeButton.remove();
    expect(getNativeButton(host)).toBeUndefined();
    host.querySelector("button-view-model").appendChild(nativeButton);
    nativeButton.setAttribute("aria-pressed", "false");
    expect(getNativeButton(host)).toBe(nativeButton);
  });

  test("waits for modern native reactions when only an unrelated button is present", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">${controls("current", "BBBBBBBBBBB")}</ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    const host = current.querySelector("like-button-view-model");
    const nativeButton = host.querySelector("button");
    const speed = document.createElement("button");
    speed.textContent = "1x";
    host.prepend(speed);
    nativeButton.remove();
    setBox(current);
    expect(getNativeButton(host)).toBeUndefined();
    expect(getButtonControls(current).ready).toBe(false);
    expect(getButtons()).toBeUndefined();

    host.appendChild(nativeButton);
    expect(getNativeButton(host)).toBe(nativeButton);
    expect(getButtonControls(current).ready).toBe(true);
  });

  test("retains configured native selectors for legacy controls and legacy Shorts paper toggles", () => {
    const host = document.createElement("ytd-toggle-button-renderer");
    host.innerHTML = '<button id="legacy"></button><tp-yt-paper-button id="button"></tp-yt-paper-button>';
    expect(getNativeButton(host)).toBe(host.querySelector("button"));
    const selectors = extConfig.selectors.buttons.nativeButton;
    try {
      extConfig.selectors.buttons.nativeButton = ["#legacy"];
      expect(getNativeButton(host)).toBe(host.querySelector("#legacy"));
      history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
      host.querySelector("button").setAttribute("aria-pressed", "true");
      expect(getNativeButton(host)).toBe(host.querySelector("tp-yt-paper-button"));
    } finally {
      extConfig.selectors.buttons.nativeButton = selectors;
    }
  });

  test.each(["button", "tp-yt-paper-button"])("accepts a direct legacy %s activation target", (tagName) => {
    const control = document.createElement(tagName);
    control.id = "button";
    expect(getNativeButton(control)).toBe(control);
  });

  test("accepts mobile native reactions with boolean labels before pressed-state attributes exist", () => {
    document.body.innerHTML = `
      <div id="mobile">
        <like-button-view-model><button aria-label="true"><span role="text">100</span></button></like-button-view-model>
        <dislike-button-view-model><button aria-label="false"><span role="text"></span></button></dislike-button-view-model>
      </div>`;
    buttonsRewire.__set__("isMobile", () => true);
    try {
      const mobile = document.querySelector("#mobile");
      const snapshot = getButtonControls(mobile);
      expect(snapshot.ready).toBe(true);
      expect(snapshot.nativeLikeButton).toBe(mobile.querySelector("button[aria-label='true']"));
      expect(snapshot.nativeDislikeButton).toBe(mobile.querySelector("button[aria-label='false']"));
    } finally {
      buttonsRewire.__ResetDependency__("isMobile");
    }
  });

  test("uses the native Like for Shorts inventory and synthetic styling when another control is prepended", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
        <reel-action-bar-view-model>
          <like-button-view-model>
            <div><button class="fixture-speed">1x</button></div>
            <toggle-button-view-model><button-view-model><label class="fixture-native-label">
              <button class="ytSpecButtonShapeNextHost" aria-pressed="false"><svg><path d="M3 12h18"></path></svg></button>
              <div class="fixture-native-count"><span role="text">100</span></div>
            </label></button-view-model></toggle-button-view-model>
          </like-button-view-model>
          <button-view-model><button>Comments</button></button-view-model>
          <button-view-model><button>Share</button></button-view-model>
          <button-view-model><button>More</button></button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    const nativeLikeButton = document.querySelector("button[aria-pressed]");
    setBox(actionBar);
    setBox(nativeLikeButton.querySelector("svg"));
    const options = { getNativeLikeButton: getNativeButton };
    const inventory = captureShortsNativeControlInventory(actionBar, options);
    expect(inventory.nativeLikeButton).toBe(nativeLikeButton);
    expect(inventory.activationTargets[0]).toBe(nativeLikeButton);

    const dislike = ensureSyntheticShortsDislikeButton(actionBar, { isHydrated: true, isStable: true });
    expect(dislike.querySelector("button").className).toBe(nativeLikeButton.className);
    expect(dislike.querySelector("label").classList.contains("fixture-native-label")).toBe(true);
    expect(getButtonControls(actionBar)).toMatchObject({ nativeLikeButton, ready: true });
    expect(captureShortsNativeControlInventory(actionBar, options).activationTargets).toEqual(
      inventory.activationTargets,
    );

    nativeLikeButton.removeAttribute("aria-pressed");
    expect(getButtonControls(actionBar).ready).toBe(false);
    nativeLikeButton.setAttribute("aria-pressed", "false");
    expect(getButtonControls(actionBar).ready).toBe(true);
  });

  test("does not clone a text template from outside the selected reaction tree", () => {
    document.body.innerHTML = `
      <div id="stale-template"><div><span role="text">999</span></div></div>
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="current">
            <like-button-view-model><button aria-pressed="false"></button></like-button-view-model>
            <dislike-button-view-model><button aria-pressed="false"></button></dislike-button-view-model>
          </div>
        </ytd-menu-renderer>
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    setBox(current);
    const snapshot = getButtonControls(current);

    expect(snapshot.ready).toBe(false);
    expect(snapshot.textContainerTemplate).toBeUndefined();
    expect(getDislikeTextContainer(snapshot)).toBeUndefined();
    expect(current.querySelector("dislike-button-view-model").textContent).toBe("");
  });

  test("creates at most one dislike text container when initialization repeats", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        ${controls("current", "BBBBBBBBBBB")}
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    current.querySelector("dislike-button-view-model span[role='text']").remove();
    setBox(current);

    const first = getDislikeTextContainer(getButtonControls(current));
    const second = getDislikeTextContainer();

    expect(second).toBe(first);
    expect(current.querySelectorAll("dislike-button-view-model > button > span[role='text']")).toHaveLength(1);
  });

  test("preserves the semantic count node when hydrating an icon-only smartimation dislike", () => {
    document.body.innerHTML = `
      <ytd-watch-flexy video-id="BBBBBBBBBBB">
        <ytd-menu-renderer class="ytd-watch-metadata">
          <div id="current">
            <segmented-like-dislike-button-view-model>
              <yt-smartimation>
                <div id="content">
                  <div id="wrapper">
                    <like-button-view-model class="style-text">
                      <toggle-button-view-model>
                        <button-view-model>
                          <button aria-label="100 likes" aria-pressed="false">
                            <svg></svg>
                            <div class="ytSpecButtonShapeNextButtonTextContent">
                              <span id="text" role="text">100</span>
                            </div>
                            <span data-touch-feedback></span>
                          </button>
                        </button-view-model>
                      </toggle-button-view-model>
                    </like-button-view-model>
                    <dislike-button-view-model class="style-text">
                      <toggle-button-view-model>
                        <button-view-model>
                          <button aria-label="Dislike this video" aria-pressed="false">
                            <svg></svg>
                            <span data-touch-feedback></span>
                          </button>
                        </button-view-model>
                      </toggle-button-view-model>
                    </dislike-button-view-model>
                  </div>
                </div>
              </yt-smartimation>
            </segmented-like-dislike-button-view-model>
          </div>
        </ytd-menu-renderer>
      </ytd-watch-flexy>`;
    const current = document.querySelector("#current");
    const dislike = current.querySelector("dislike-button-view-model");
    setBox(current);

    const snapshot = getButtonControls(current);
    expect(snapshot.ready).toBe(true);
    expect(snapshot.dislikeTextContainer).toBeUndefined();

    const first = getDislikeTextContainer(snapshot);
    first.innerText = "42";
    const second = getDislikeTextContainer();

    expect(first).toBe(dislike.querySelector("#text[role='text']"));
    expect(second).toBe(first);
    expect(first.innerText).toBe("42");
    expect(dislike.querySelectorAll(".ytSpecButtonShapeNextButtonTextContent")).toHaveLength(1);
    expect(dislike.querySelectorAll("#text[role='text']")).toHaveLength(1);
  });

  test("matches nested native digit typography without changing the native count or dislike icon", () => {
    const current = typographyControls(`
      <span hidden>999</span>
      <span class="fixture-screen-reader">999</span>
      <animated-rolling-number><animated-rolling-character class="fixture-digit" aria-hidden="true">2</animated-rolling-character></animated-rolling-number>`);
    const like = current.querySelector("like-button-view-model");
    const dislike = current.querySelector("dislike-button-view-model");
    const nativeContent = like.innerHTML;
    const nativeIcon = dislike.querySelector("svg").outerHTML;

    const count = getDislikeTextContainer(getButtonControls(current));

    expect(count.style.fontSize).toBe("21px");
    expect(count.style.fontWeight).toBe("600");
    expect(count.style.fontFamily).toBe("Arial, sans-serif");
    expect(count.style.lineHeight).toBe("21px");
    expect(like.innerHTML).toBe(nativeContent);
    expect(dislike.querySelector("svg").outerHTML).toBe(nativeIcon);
    expect(dislike.querySelectorAll("animated-rolling-number")).toHaveLength(0);
    expect(dislike.querySelector("button").classList.contains("ytSpecButtonShapeNextIconLeading")).toBe(true);

    const observer = new MutationObserver(() => {});
    observer.observe(count, { attributes: true });
    expect(getDislikeTextContainer(getButtonControls(current))).toBe(count);
    refreshDislikeTextTypography(like, dislike);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    expect(dislike.querySelectorAll("#text[role='text']")).toHaveLength(1);
  });

  test("refreshes delayed native digits and restores ordinary typography on reused controls", () => {
    const current = typographyControls("254");
    const nativeText = current.querySelector("like-button-view-model .ytSpecButtonShapeNextButtonTextContent");
    const count = getDislikeTextContainer(getButtonControls(current));
    count.innerText = "42";
    expect(count.style.cssText).toBe("");

    nativeText.innerHTML = '<animated-rolling-character class="fixture-digit">2</animated-rolling-character>';
    setNativeTextBoxes();
    refreshReactionPresentation();
    expect(count.style.fontSize).toBe("21px");

    nativeText.firstElementChild.classList.add("fixture-large");
    refreshReactionPresentation();
    expect(count.style.fontSize).toBe("25px");
    expect(count.style.lineHeight).toBe("27px");

    nativeText.textContent = "254";
    refreshReactionPresentation();
    expect(count.style.cssText).toBe("");
    expect(getDislikeTextContainer(getButtonControls(current))).toBe(count);
    expect(count.innerText).toBe("42");
  });

  test.each(["ordinary", "missing"])(
    "restores original inline values and priorities after cloned controls receive %s native text",
    (nativeState) => {
      const originalInlineStyle = "font-size: 14px !important; line-height: 40px !important;";
      const current = typographyControls(
        `<span role="text" style="${originalInlineStyle}"><animated-rolling-character class="fixture-digit">2</animated-rolling-character></span>`,
      );
      const count = getDislikeTextContainer(getButtonControls(current));
      count.textContent = "42";
      expect(count.style.fontSize).toBe("21px");

      const clonedControls = current.cloneNode(true);
      current.replaceWith(clonedControls);
      setBox(clonedControls);
      const nativeText = clonedControls.querySelector("like-button-view-model .ytSpecButtonShapeNextButtonTextContent");
      nativeText.querySelector(".fixture-digit").classList.add("fixture-large");
      setNativeTextBoxes();
      const clonedCount = getDislikeTextContainer(getButtonControls(clonedControls));
      expect(clonedCount).not.toBe(count);
      expect(clonedCount.style.fontSize).toBe("25px");
      expect(clonedCount.style.lineHeight).toBe("27px");

      nativeText.textContent = nativeState === "ordinary" ? "254" : "";
      refreshReactionPresentation();
      expect(clonedCount.style.cssText).toBe(originalInlineStyle);
      expect(clonedCount.style.getPropertyPriority("font-size")).toBe("important");
      expect(clonedCount.style.getPropertyPriority("line-height")).toBe("important");
      expect(clonedCount.textContent).toBe("42");

      const observer = new MutationObserver(() => {});
      observer.observe(clonedCount, { attributes: true });
      expect(getDislikeTextContainer(getButtonControls(clonedControls))).toBe(clonedCount);
      refreshReactionPresentation();
      expect(observer.takeRecords()).toHaveLength(0);
      observer.disconnect();
      expect(clonedControls.querySelectorAll("dislike-button-view-model #text[role='text']")).toHaveLength(1);
    },
  );

  test("matches native typography scoped to the Like ancestor for ordinary text too", () => {
    const current = typographyControls('<span class="fixture-static" role="text">254</span>');
    const count = getDislikeTextContainer(getButtonControls(current));

    expect(count.style.fontSize).toBe("18px");
    expect(count.style.lineHeight).toBe("24px");
    expect(count.style.fontWeight).toBe("");
    expect(count.style.fontFamily).toBe("");
  });

  test("preserves matching cloned inline styles and existing native dislike text", () => {
    const current = typographyControls('<span role="text" style="font-size: 18px; line-height: 24px">254</span>');
    const nativeCount = current.querySelector("like-button-view-model span[role='text']");
    const count = getDislikeTextContainer(getButtonControls(current));
    expect(count.style.cssText).toBe(nativeCount.style.cssText);

    const dislike = current.querySelector("dislike-button-view-model");
    dislike.querySelector(".ytSpecButtonShapeNextButtonTextContent").remove();
    const existing = document.createElement("span");
    existing.setAttribute("role", "text");
    existing.style.fontSize = "16px";
    dislike.querySelector("button").appendChild(existing);
    expect(getDislikeTextContainer(getButtonControls(current))).toBe(existing);
    refreshReactionPresentation();
    expect(existing.style.cssText).toBe("font-size: 16px;");
  });

  test("inserts one owned Shorts Dislike after Like instead of treating Comments as Dislike", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
        <reel-action-bar-view-model>
          <like-button-view-model class="ytLikeButtonViewModelHost">
            <label class="ytSpecButtonShapeWithLabelHost">
              <button class="ytSpecButtonShapeNextHost" aria-pressed="false">
                <span class="ytSpecButtonShapeNextIcon"></span>
              </button>
              <div class="ytSpecButtonShapeWithLabelLabel"><span role="text">100</span></div>
            </label>
          </like-button-view-model>
          <button-view-model><button type="button">Comments</button></button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar);

    expect(getDislikeButton(actionBar)).toBeUndefined();
    expect(getButtonControls(actionBar).ready).toBe(false);
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();

    const dislike = ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });

    expect(isSyntheticShortsDislike(dislike)).toBe(true);
    expect(dislike.previousElementSibling).toBe(actionBar.querySelector("like-button-view-model"));
    expect(dislike.nextElementSibling).toBe(actionBar.querySelector("button-view-model"));
    expect(dislike.getAttribute("data-ryd-video-id")).toBe("BBBBBBBBBBB");
    expect(dislike.querySelector("button").disabled).toBe(true);
    expect(dislike.querySelector("button").getAttribute("aria-disabled")).toBe("true");
    expect(dislike.querySelector("button").getAttribute("aria-pressed")).toBe("false");
    expect(dislike.querySelector("svg path").getAttribute("d")).toMatch(/^m8\.482/);
    expect(dislike.querySelector("#text").textContent).toBe("");
    expect(getButtonControls(actionBar).ready).toBe(true);

    expect(getDislikeButton(actionBar)).toBe(dislike);
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(1);

    expect(setSyntheticShortsDislikeEnabled(true, dislike)).toBe(true);
    expect(setSyntheticShortsDislikePressed(true, dislike)).toBe(true);
    expect(dislike.querySelector("button").disabled).toBe(false);
    expect(dislike.querySelector("button").getAttribute("aria-disabled")).toBe("false");
    expect(dislike.querySelector("button").getAttribute("aria-pressed")).toBe("true");
    expect(dislike.classList.contains("style-default-active")).toBe(true);
  });

  test("keeps a private synthetic Shorts count disabled and unpressed through direct setters", () => {
    isPrivateBrowsingContext.mockReturnValue(true);
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
        <reel-action-bar-view-model>
          <like-button-view-model><button aria-pressed="true"><span role="text">100</span></button></like-button-view-model>
          <button-view-model><button type="button">Comments</button></button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar);
    const dislike = ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    const nativeLike = actionBar.querySelector("like-button-view-model button");
    const nativeClick = jest.fn();
    nativeLike.addEventListener("click", nativeClick);
    const syntheticClick = jest.fn();
    dislike.querySelector("button").addEventListener("click", syntheticClick);

    setSyntheticShortsDislikeEnabled(true, dislike);
    setSyntheticShortsDislikePressed(true, dislike);
    dislike.querySelector("button").click();

    expect(dislike.querySelector("button").disabled).toBe(true);
    expect(dislike.querySelector("button").getAttribute("aria-disabled")).toBe("true");
    expect(dislike.querySelector("button").getAttribute("aria-pressed")).toBe("false");
    expect(dislike.classList.contains("style-default-active")).toBe(false);
    expect(getButtonControls(actionBar).ready).toBe(true);
    expect(syntheticClick).not.toHaveBeenCalled();
    expect(nativeClick).not.toHaveBeenCalled();
    expect(nativeLike.getAttribute("aria-pressed")).toBe("true");
  });

  test("does not mutate an offscreen URL-matching Shorts placeholder before activation", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB">
          <a href="/shorts/BBBBBBBBBBB"></a>
          <reel-action-bar-view-model>
            <like-button-view-model>
              <button aria-pressed="false"><span role="text">100</span></button>
            </like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 320, width: 48, x: 20, y: window.innerHeight + 80 });

    expect(getButtons()).toBe(actionBar);
    expect(getButtonControls().ready).toBe(false);
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();

    setBox(actionBar, { height: 320, width: 48, x: 20, y: window.innerHeight - 1 });

    expect(
      ensureSyntheticShortsDislikeButton(actionBar, {
        currentVideoId: "BBBBBBBBBBB",
        isHydrated: true,
        isStable: true,
      }),
    ).toBeUndefined();
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();

    // Exactly half visible is a meaningful activation boundary; a one-pixel
    // intersection above is not.
    setBox(actionBar, { height: 320, width: 48, x: 20, y: window.innerHeight - 160 });

    expect(getButtonControls().ready).toBe(false);
    ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    expect(getButtonControls().ready).toBe(true);
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(1);
  });

  test("recognizes destination ownership when Shorts reuses one visible renderer and changes only its canonical link", () => {
    history.replaceState({}, "", "/shorts/AAAAAAAAAAA");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer>
          <a id="canonical-short" class="ytp-title-link" href="/shorts/AAAAAAAAAAA"></a>
          <reel-action-bar-view-model>
            <like-button-view-model>
              <button aria-pressed="false"><span role="text">100</span></button>
            </like-button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 320, width: 48, x: 20, y: 20 });
    ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "AAAAAAAAAAA",
      isHydrated: true,
      isStable: true,
    });
    const outgoing = getButtonControls();

    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.querySelector("#canonical-short").setAttribute("href", "/shorts/BBBBBBBBBBB");
    const destination = getButtonControls();

    expect(destination.ready).toBe(true);
    expect(destination.buttons).toBe(outgoing.buttons);
    expect(destination.likeButton).toBe(outgoing.likeButton);
    expect(destination.dislikeButton).toBe(outgoing.dislikeButton);
    expect(getShortsCandidateVideoId(destination.buttons)).toBe("BBBBBBBBBBB");
    expect(destination.dislikeButton.getAttribute("data-ryd-video-id")).toBe("AAAAAAAAAAA");

    ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    expect(destination.dislikeButton.getAttribute("data-ryd-video-id")).toBe("BBBBBBBBBBB");
  });

  test("removes an existing synthetic Shorts control only after a native Dislike arrives on a stable surface", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
          <reel-action-bar-view-model>
            <like-button-view-model>
              <button aria-pressed="false"><span role="text">100</span></button>
            </like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    const like = actionBar.querySelector("like-button-view-model");
    setBox(actionBar, { height: 420, width: 48, x: 20, y: 20 });
    const synthetic = ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    actionBar.append(synthetic.cloneNode(true), synthetic.cloneNode(true));
    const nativeDislike = document.createElement("dislike-button-view-model");
    nativeDislike.innerHTML = '<button aria-pressed="false"><span role="text"></span></button>';
    like.insertAdjacentElement("afterend", nativeDislike);

    expect(getDislikeButton(actionBar)).toBe(nativeDislike);
    expect(synthetic.isConnected).toBe(true);
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(3);

    expect(
      ensureSyntheticShortsDislikeButton(actionBar, {
        currentVideoId: "BBBBBBBBBBB",
        isHydrated: true,
        isStable: true,
      }),
    ).toBe(nativeDislike);
    expect(synthetic.isConnected).toBe(false);
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(0);
  });

  test("waits for YouTube to restore action-bar data before explicit synthetic mutation", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
          <reel-action-bar-view-model>
            <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 420, width: 48, x: 20, y: 20 });
    actionBar.data = null;

    expect(
      ensureSyntheticShortsDislikeButton(actionBar, {
        currentVideoId: "BBBBBBBBBBB",
        isHydrated: true,
        isStable: true,
      }),
    ).toBeUndefined();
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();

    expect(
      isSyntheticShortsDislike(
        ensureSyntheticShortsDislikeButton(actionBar, {
          allowUnhydratedFallback: true,
          currentVideoId: "BBBBBBBBBBB",
          isHydrated: false,
          isStable: true,
        }),
      ),
    ).toBe(true);
    actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]").remove();

    actionBar.data = { likeButtonViewModel: {} };
    expect(
      isSyntheticShortsDislike(
        ensureSyntheticShortsDislikeButton(actionBar, {
          currentVideoId: "BBBBBBBBBBB",
          isHydrated: true,
          isStable: true,
        }),
      ),
    ).toBe(true);
  });

  test("normalizes duplicate synthetic Shorts controls only through the explicit stable mutation path", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
          <reel-action-bar-view-model>
            <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 420, width: 48, x: 20, y: 20 });
    const synthetic = ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    actionBar.append(synthetic.cloneNode(true), synthetic.cloneNode(true));

    expect(getDislikeButton(actionBar)).toBe(synthetic);
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(3);

    ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    expect(actionBar.querySelectorAll("[data-ryd-synthetic-shorts-dislike]")).toHaveLength(1);
  });

  test("keeps discovery pure while a Shorts href changes before activation", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer>
          <a id="canonical-short" class="ytp-title-link" href="/shorts/AAAAAAAAAAA"></a>
          <reel-action-bar-view-model>
            <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 320, width: 48, x: 20, y: 20 });

    document.querySelector("#canonical-short").setAttribute("href", "/shorts/BBBBBBBBBBB");
    expect(getButtons()).toBe(actionBar);
    expect(getDislikeButton(actionBar)).toBeUndefined();
    expect(getButtonControls(actionBar).ready).toBe(false);
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();
  });

  test("rejects a Shorts renderer with conflicting attribute and link identities", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
          <a class="ytp-title-link" href="/shorts/AAAAAAAAAAA"></a>
          <reel-action-bar-view-model>
            <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 320, width: 48, x: 20, y: 20 });

    expect(Array.from(getShortsCandidateVideoIds(actionBar)).sort()).toEqual(["AAAAAAAAAAA", "BBBBBBBBBBB"]);
    expect(getShortsCandidateVideoId(actionBar)).toBeNull();
    expect(getButtons()).toBeUndefined();
    expect(
      ensureSyntheticShortsDislikeButton(actionBar, {
        currentVideoId: "BBBBBBBBBBB",
        isHydrated: true,
        isStable: true,
      }),
    ).toBeUndefined();
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();
  });

  test("uses the canonical player permalink when the current Short description links to another Short", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer>
          <div id="shorts-player">
            <a class="ytp-title-link yt-uix-sessionlink" href="/shorts/BBBBBBBBBBB"></a>
          </div>
          <yt-reel-player-overlay-view-model>
            <yt-reel-metapanel-view-model>
              <button-view-model><a href="/shorts/AAAAAAAAAAA">Another Short</a></button-view-model>
            </yt-reel-metapanel-view-model>
          </yt-reel-player-overlay-view-model>
          <reel-action-bar-view-model>
            <like-button-view-model>
              <button aria-pressed="false"><span role="text">100</span></button>
            </like-button-view-model>
            <button-view-model><button type="button">Comments</button></button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar, { height: 320, width: 48, x: 20, y: 20 });

    expect(Array.from(getShortsCandidateVideoIds(actionBar))).toEqual(["BBBBBBBBBBB"]);
    expect(getShortsCandidateVideoId(actionBar)).toBe("BBBBBBBBBBB");
    expect(getButtons()).toBe(actionBar);

    const dislike = ensureSyntheticShortsDislikeButton(actionBar, {
      currentVideoId: "BBBBBBBBBBB",
      isHydrated: true,
      isStable: true,
    });
    expect(isSyntheticShortsDislike(dislike)).toBe(true);
    expect(dislike.getAttribute("data-ryd-video-id")).toBe("BBBBBBBBBBB");
  });

  test("accepts native modern Shorts reaction controls", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-reel-video-renderer video-id="BBBBBBBBBBB" is-active>
        <reel-action-bar-view-model>
          <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
          <dislike-button-view-model><button aria-pressed="false"><span role="text"></span></button></dislike-button-view-model>
          <button-view-model><button type="button">Comments</button></button-view-model>
        </reel-action-bar-view-model>
      </ytd-reel-video-renderer>`;
    const actionBar = document.querySelector("reel-action-bar-view-model");
    setBox(actionBar);

    expect(getButtons()).toBe(actionBar);
    expect(getButtonControls(actionBar).ready).toBe(true);
    expect(actionBar.querySelector("[data-ryd-synthetic-shorts-dislike]")).toBeNull();
  });

  test("follows the active Shorts reel without falling back to the hidden first reel", () => {
    history.replaceState({}, "", "/shorts/BBBBBBBBBBB");
    document.body.innerHTML = `
      <ytd-shorts>
        <ytd-reel-video-renderer video-id="AAAAAAAAAAA" is-active>
          <reel-action-bar-view-model id="short-a">
            <like-button-view-model><button aria-pressed="false"><span role="text">100</span></button></like-button-view-model>
            <dislike-button-view-model><button aria-pressed="false"><span role="text"></span></button></dislike-button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
        <ytd-reel-video-renderer video-id="BBBBBBBBBBB" hidden>
          <reel-action-bar-view-model id="short-b">
            <like-button-view-model><button aria-pressed="false"><span role="text">200</span></button></like-button-view-model>
            <dislike-button-view-model><button aria-pressed="false"><span role="text"></span></button></dislike-button-view-model>
          </reel-action-bar-view-model>
        </ytd-reel-video-renderer>
      </ytd-shorts>`;
    const rendererA = document.querySelector('ytd-reel-video-renderer[video-id="AAAAAAAAAAA"]');
    const rendererB = document.querySelector('ytd-reel-video-renderer[video-id="BBBBBBBBBBB"]');
    const actionBarA = document.querySelector("#short-a");
    const actionBarB = document.querySelector("#short-b");
    setBox(actionBarA, { height: 320, width: 48, x: 20, y: 20 });
    setBox(actionBarB, { height: 0, width: 0, x: 0, y: 0 });

    // The route advances before the active reel does. Do not initialize B's
    // state into the still-rendered A controls during this transition gap.
    expect(getButtons()).toBeUndefined();

    rendererA.removeAttribute("is-active");
    rendererA.hidden = true;
    rendererB.hidden = false;
    rendererB.setAttribute("is-active", "");
    setBox(actionBarA, { height: 0, width: 0, x: 0, y: 0 });
    // The active action bar can be partially clipped by the viewport. The old
    // full-containment check rejected it and fell back to hidden Short A.
    setBox(actionBarB, { height: 320, width: 48, x: 20, y: window.innerHeight - 160 });

    expect(getButtons()).toBe(actionBarB);
    expect(getButtonControls(actionBarB).ready).toBe(true);
  });
});
