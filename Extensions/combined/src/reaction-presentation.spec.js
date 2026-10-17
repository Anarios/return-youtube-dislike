/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./bar", () => ({ createRateBar: jest.fn() }));

import { getButtonControls, getLikeTextContainer } from "./buttons";
import { addLikeDislikeEventListener, storageChangeHandler } from "./events";
import { extConfig, refreshReactionPresentation, setLikes, storedData, NEUTRAL_STATE } from "./state";

const innerTextDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(value) {
      this.textContent = value;
    },
  });
});

afterAll(() => {
  if (innerTextDescriptor) Object.defineProperty(HTMLElement.prototype, "innerText", innerTextDescriptor);
  else delete HTMLElement.prototype.innerText;
});

function mount({ nested = false, shorts = false, likes = 730 } = {}) {
  const count = nested ? `<span role="text">${likes}</span>` : String(likes);
  const pair = `
    <like-button-view-model><button aria-pressed="false" aria-label="like this video along with ${likes} other people">
      <div class="ytSpecButtonShapeNextIcon"><yt-icon><svg><path fill="currentColor"></path></svg></yt-icon></div>
      <div class="ytSpecButtonShapeNextButtonTextContent">${count}</div>
    </button></like-button-view-model>
    <dislike-button-view-model><button aria-pressed="false" aria-label="Dislike this video">
      <div class="ytSpecButtonShapeNextIcon"><svg><path fill="currentColor"></path></svg></div>
      <div class="ytSpecButtonShapeNextButtonTextContent"><span role="text">12</span></div>
    </button></dislike-button-view-model>`;
  document.body.innerHTML = shorts
    ? `<ytd-reel-video-renderer is-active video-id="abcdefghijk"><reel-action-bar-view-model>${pair}</reel-action-bar-view-model></ytd-reel-video-renderer>`
    : `<div id="top-level-buttons-computed"><segmented-like-dislike-button-view-model><yt-smartimation>${pair}</yt-smartimation></segmented-like-dislike-button-view-model></div>`;
  for (const element of document.body.querySelectorAll("*")) {
    element.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 40,
      right: 100,
      width: 100,
      height: 40,
    });
  }
  history.replaceState({}, "", shorts ? "/shorts/abcdefghijk" : "/watch?v=abcdefghijk");
  Object.assign(storedData, { videoId: "abcdefghijk", likes, dislikes: 12, previousState: NEUTRAL_STATE });
  const controls = getButtonControls();
  expect(controls.ready).toBe(true);
  addLikeDislikeEventListener(controls.likeButton, controls.dislikeButton);
  return controls;
}

const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Object.assign(extConfig, {
    numberDisplayReformatLikes: false,
    numberDisplayFormat: "standard",
    coloredThumbs: false,
    colorTheme: "classic",
    disableVoteSubmission: true,
  });
});

afterEach(async () => {
  document.body.replaceChildren();
  await flushMutations();
});

test.each([false, true])("reformatting preserves YouTube's original text node (nested: %s)", (nested) => {
  mount({ nested });
  const container = getLikeTextContainer();
  const textNode = nested ? container.firstChild.firstChild : container.firstChild;
  expect(setLikes("731")).toBe(true);
  expect(textNode.isConnected).toBe(true);
  expect(textNode.data).toBe("731");
  textNode.data = "732";
  expect(container.textContent).toBe("732");
});

test("formats the updated native count after a click and later asynchronous native updates", async () => {
  const controls = mount({ likes: 1730 });
  const textNode = getLikeTextContainer().firstChild;
  extConfig.numberDisplayReformatLikes = true;
  refreshReactionPresentation();
  expect(textNode.data).toBe("1,730");
  controls.nativeLikeButton.addEventListener("click", () => {
    textNode.data = "1731";
    controls.nativeLikeButton.setAttribute("aria-label", "like this video along with 1731 other people");
    controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  });
  controls.nativeLikeButton.click();
  await flushMutations();
  expect(textNode.isConnected).toBe(true);
  expect(textNode.data).toBe("1,731");
  controls.nativeLikeButton.setAttribute("aria-label", "like this video along with 1732 other people");
  await flushMutations();
  expect(textNode.data).toBe("1,732");
  textNode.data = "1732";
  await flushMutations();
  expect(textNode.data).toBe("1,732");
});

test("format changes apply immediately and disabling restores the latest native formatting", async () => {
  const controls = mount({ likes: 1730 });
  const node = getLikeTextContainer().firstChild;
  node.data = "1.7K";
  storageChangeHandler({ numberDisplayReformatLikes: { newValue: true } }, "sync");
  expect(node.data).toBe("1,730");
  controls.nativeLikeButton.setAttribute("aria-label", "1731 likes");
  node.data = "1.7K";
  await flushMutations();
  expect(node.data).toBe("1,731");
  storageChangeHandler({ numberDisplayFormat: { newValue: "compactLong" } }, "sync");
  expect(node.data).toBe("1.7 thousand");
  storageChangeHandler({ numberDisplayReformatLikes: { newValue: false } }, "sync");
  await flushMutations();
  expect(node.data).toBe("1.7K");
});

test("native count markup is untouched when reformatting is off", async () => {
  const controls = mount();
  const node = getLikeTextContainer().firstChild;
  controls.nativeLikeButton.setAttribute("aria-label", "731 likes");
  node.data = "731";
  await flushMutations();
  expect(getLikeTextContainer().firstChild).toBe(node);
  expect(node.data).toBe("731");
});

test("does not flatten native counters made of multiple text nodes", () => {
  mount();
  const container = getLikeTextContainer();
  container.innerHTML = "<span>7</span><span>3</span><span>0</span>";
  const original = container.innerHTML;
  expect(setLikes("731")).toBe(false);
  expect(container.innerHTML).toBe(original);
});

test("colors the native buttons, updates the theme, and removes only its own styling when disabled", async () => {
  const controls = mount();
  controls.nativeLikeButton.style.color = "purple";
  storageChangeHandler({ coloredThumbs: { newValue: true } }, "sync");
  expect(controls.nativeLikeButton.hasAttribute("data-ryd-thumb-color")).toBe(true);
  expect(controls.nativeLikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("lime");
  expect(controls.nativeDislikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("red");
  storageChangeHandler({ colorTheme: { newValue: "accessible" } }, "sync");
  expect(controls.nativeLikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("dodgerblue");
  expect(controls.nativeDislikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("gold");
  storageChangeHandler({ coloredThumbs: { newValue: false } }, "sync");
  await flushMutations();
  expect(controls.nativeLikeButton.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(controls.nativeDislikeButton.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(controls.nativeLikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("");
  expect(controls.nativeLikeButton.style.color).toBe("purple");
});

test("reapplies formatting and coloring when YouTube replaces native button children", async () => {
  const controls = mount();
  extConfig.numberDisplayReformatLikes = true;
  extConfig.coloredThumbs = true;
  const replacement = controls.nativeLikeButton.cloneNode(true);
  replacement.setAttribute("aria-label", "1731 likes");
  replacement.querySelector(".ytSpecButtonShapeNextButtonTextContent").textContent = "1.7K";
  controls.nativeLikeButton.replaceWith(replacement);
  await flushMutations();
  expect(replacement.hasAttribute("data-ryd-thumb-color")).toBe(true);
  expect(replacement.textContent.trim()).toBe("1,731");
});

test("Shorts only color pressed thumbs and restore native colors after toggling off", async () => {
  const controls = mount({ shorts: true });
  storageChangeHandler({ coloredThumbs: { newValue: true } }, "sync");
  expect(controls.nativeLikeButton.hasAttribute("data-ryd-thumb-color")).toBe(false);
  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();
  expect(controls.nativeLikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("lime");
  controls.nativeLikeButton.setAttribute("aria-pressed", "false");
  controls.nativeDislikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();
  expect(controls.nativeLikeButton.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(controls.nativeDislikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("red");
});
