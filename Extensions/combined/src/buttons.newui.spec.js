/**
 * @jest-environment jsdom
 *
 * Regression test reproducing YouTube's June 2026 "new UI" watch-page markup
 * (segmented-like-dislike-button-view-model / dislike-button-view-model with
 * camelCase ytSpecButtonShapeNext* classes and an animated rolling number for
 * the like count). See issue #1274.
 */

// Mock state.js with the bundled DEFAULT_SELECTORS plus the production
// `/configs/selectors` override (dislikeTextContainer gains the icon-button
// fallback that the maintainer shipped as a "dirty fix"). Defined inline
// because jest.mock factories cannot reference out-of-scope variables.
jest.mock("./state", () => ({
  extConfig: {
    selectors: {
      dislikeTextContainer: [
        ".yt-spec-button-shape-next__button-text-content",
        ".ytSpecButtonShapeNextButtonTextContent",
        "#text",
        "yt-formatted-string",
        "span[role='text']",
        "button.ytSpecButtonShapeNextIconButton",
      ],
      likeTextContainer: [
        ".yt-spec-button-shape-next__button-text-content",
        ".ytSpecButtonShapeNextButtonTextContent",
        "#text",
        "yt-formatted-string",
        "span[role='text']",
      ],
      likeTextContainerTemplate: [
        ".yt-spec-button-shape-next__button-text-content",
        ".ytSpecButtonShapeNextButtonTextContent",
        "button > div[class*='cbox']",
      ],
      likeTextContainerTemplateParent: [
        'div > span[role="text"]',
        'button > div.yt-spec-button-shape-next__button-text-content > span[role="text"]',
      ],
      textContainerInner: ["span[role='text']"],
      buttons: {
        shorts: {
          mobile: ["ytm-like-button-renderer"],
          desktop: ["reel-action-bar-view-model", "#like-button > ytd-like-button-renderer"],
        },
        regular: {
          mobile: [".slim-video-action-bar-actions"],
          desktopMenu: ["ytd-menu-renderer.ytd-watch-metadata > div"],
          desktopNoMenu: ["#top-level-buttons-computed"],
        },
        segmentedContainer: ["ytd-segmented-like-dislike-button-renderer"],
        nativeButton: ["button"],
        likeButton: {
          segmented: ["#segmented-like-button"],
          segmentedGetButtons: [":first-child > :first-child"],
          notSegmented: ["like-button-view-model", ":first-child"],
        },
        dislikeButton: {
          segmented: ["#segmented-dislike-button"],
          segmentedGetButtons: [":first-child > :nth-child(2)"],
          notSegmented: ["dislike-button-view-model", ":nth-child(2)", "#dislike-button"],
          shortsFallback: ["#dislike-button"],
        },
      },
      buttonClasses: {
        iconButton: ["yt-spec-button-shape-next--icon-button", "ytSpecButtonShapeNextIconButton"],
        iconLeading: ["yt-spec-button-shape-next--icon-leading", "ytSpecButtonShapeNextIconLeading"],
      },
      menuContainer: ["#menu-container"],
      signInButton: ["a[href^='https://accounts.google.com/ServiceLogin']"],
      roundedDesign: ["#segmented-like-button", "like-button-view-model"],
    },
  },
  isMobile: jest.fn(() => false),
  isShorts: jest.fn(() => false),
}));

import { getLikeButton, getDislikeButton, getLikeTextContainer, getDislikeTextContainer } from "./buttons";

// Native new-UI markup (before the extension touches it). The dislike button is
// icon-only with a real icon child + touch-feedback overlay.
function renderNewUiDom() {
  document.body.innerHTML = `
  <div id="actions" class="item style-scope ytd-watch-metadata">
    <div id="actions-inner">
      <div id="menu">
        <ytd-menu-renderer class="style-scope ytd-watch-metadata">
          <div id="top-level-buttons-computed" class="top-level-buttons style-scope ytd-menu-renderer">
            <segmented-like-dislike-button-view-model class="ytSegmentedLikeDislikeButtonViewModelHost">
              <yt-smartimation>
                <div class="ytSmartImationsContent">
                  <div class="ytSegmentedLikeDislikeButtonViewModelSegmentedButtonsWrapper">
                    <like-button-view-model class="ytLikeButtonViewModelHost">
                      <toggle-button-view-model>
                        <button-view-model class="ytSpecButtonViewModelHost">
                          <button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextIconLeading ytSpecButtonShapeNextSegmentedStart ytSpecButtonShapeNextEnableBackdropFilterExperiment" aria-pressed="true" aria-label="like this video along with 250 other people">
                            <div aria-hidden="true" class="ytSpecButtonShapeNextIcon"><yt-icon><yt-animated-icon animated-icon-type="LIKE"></yt-animated-icon></yt-icon></div>
                            <div class="ytSpecButtonShapeNextButtonTextContent">
                              <yt-animated-rolling-number aria-hidden="true"><animated-rolling-character><div>2</div><div>5</div><div>0</div></animated-rolling-character></yt-animated-rolling-number>
                            </div>
                            <yt-touch-feedback-shape aria-hidden="true"></yt-touch-feedback-shape>
                          </button>
                        </button-view-model>
                      </toggle-button-view-model>
                    </like-button-view-model>
                    <dislike-button-view-model class="ytDislikeButtonViewModelHost">
                      <toggle-button-view-model>
                        <button-view-model class="ytSpecButtonViewModelHost">
                          <button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextIconButton ytSpecButtonShapeNextSegmentedEnd ytSpecButtonShapeNextEnableBackdropFilterExperiment" aria-pressed="false" aria-label="Dislike this video">
                            <div aria-hidden="true" class="ytSpecButtonShapeNextIcon"><span class="ytIconWrapperHost"><span class="yt-icon-shape ytSpecIconShapeHost"></span></span></div>
                            <yt-touch-feedback-shape aria-hidden="true"></yt-touch-feedback-shape>
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
      </div>
    </div>
  </div>`;
}

describe("new YouTube UI (issue #1274)", () => {
  beforeEach(() => {
    renderNewUiDom();
  });

  it("locates the like and dislike buttons", () => {
    expect(getLikeButton()?.tagName.toLowerCase()).toBe("like-button-view-model");
    expect(getDislikeButton()?.tagName.toLowerCase()).toBe("dislike-button-view-model");
  });

  it("finds the like count text container", () => {
    expect(getLikeTextContainer()?.classList.contains("ytSpecButtonShapeNextButtonTextContent")).toBe(true);
  });

  it("creates a dislike count container WITHOUT destroying the icon", () => {
    const container = getDislikeTextContainer();
    const dislikeButton = getDislikeButton();
    const nativeButton = dislikeButton.querySelector("button");

    // The container we write the count into must not be the bare <button>
    // (that's the dirty fix that wipes the icon).
    expect(container).not.toBe(nativeButton);

    // It must live inside the native button, next to the icon.
    expect(nativeButton.contains(container)).toBe(true);

    // The icon must still be present.
    expect(nativeButton.querySelector(".ytSpecButtonShapeNextIcon")).not.toBeNull();

    // The button should have been converted from icon-only to icon-leading so
    // the count is laid out next to the icon.
    expect(nativeButton.classList.contains("ytSpecButtonShapeNextIconButton")).toBe(false);
    expect(nativeButton.classList.contains("ytSpecButtonShapeNextIconLeading")).toBe(true);
  });

  it("writing the dislike count keeps the icon intact", () => {
    const container = getDislikeTextContainer();
    const nativeButton = getDislikeButton().querySelector("button");

    // setDislikes writes the count into the container (via innerText in the
    // browser); textContent is the jsdom-friendly equivalent.
    container.textContent = "1.2K";

    expect(nativeButton.querySelector(".ytSpecButtonShapeNextIcon")).not.toBeNull();
    expect(nativeButton.textContent).toContain("1.2K");
  });

  it("removes a count written straight into the button (dirty-fix cleanup)", () => {
    const nativeButton = getDislikeButton().querySelector("button");

    // Reproduce YouTube's server-side dirty fix / a competing build: the count
    // written as a bare text node directly inside the <button>. Left alone this
    // renders as a duplicate ("00") next to our container.
    nativeButton.insertBefore(document.createTextNode("0"), nativeButton.firstChild);

    const container = getDislikeTextContainer();
    container.textContent = "0";

    const strayText = Array.from(nativeButton.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join("");

    expect(strayText).toBe("");
    expect(container).not.toBe(nativeButton);
    expect(nativeButton.querySelector(".ytSpecButtonShapeNextButtonTextContent").textContent).toBe("0");
    expect(nativeButton.querySelector(".ytSpecButtonShapeNextIcon")).not.toBeNull();
  });
});
