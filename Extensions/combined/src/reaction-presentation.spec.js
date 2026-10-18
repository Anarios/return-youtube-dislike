/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

jest.mock("./bar", () => ({ createRateBar: jest.fn() }));

import { createRateBar } from "./bar";
import {
  ensureSyntheticShortsDislikeButton,
  getButtonControls,
  getLikeTextContainer,
  setSyntheticShortsDislikeEnabled,
  __RewireAPI__ as buttonsRewire,
} from "./buttons";
import { addLikeDislikeEventListener, storageChangeHandler } from "./events";
import {
  extConfig,
  isVideoDisliked,
  isVideoLiked,
  refreshReactionPresentation,
  restoreCurrentState,
  setLikes,
  storedData,
  NEUTRAL_STATE,
  LIKED_STATE,
  DISLIKED_STATE,
  __RewireAPI__ as stateRewire,
} from "./state";

const { createRateBar: renderRateBar } = jest.requireActual("./bar");
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

test("an initially liked video exposes its native state as soon as the bar is created", () => {
  const controls = mount();
  controls.nativeLikeButton.setAttribute("aria-pressed", "true");

  renderRateBar(storedData.likes, storedData.dislikes);

  expect(document.querySelector("#ryd-bar-container").getAttribute("data-ryd-liked")).toBe("true");
});

test("native like, unlike, and dislike transitions update the CSS hook without changing bar styling", async () => {
  const controls = mount();
  renderRateBar(storedData.likes, storedData.dislikes);
  const bar = document.querySelector("#ryd-bar-container");
  const barStyle = bar.getAttribute("style");
  const fillStyle = bar.querySelector("#ryd-bar").getAttribute("style");
  expect(bar.getAttribute("data-ryd-liked")).toBe("false");
  refreshReactionPresentation();
  createRateBar.mockClear();

  for (const [liked, disliked] of [
    [true, false],
    [false, false],
    [true, false],
    [false, true],
  ]) {
    controls.nativeLikeButton.setAttribute("aria-pressed", String(liked));
    controls.nativeDislikeButton.setAttribute("aria-pressed", String(disliked));
    await flushMutations();

    expect(bar.getAttribute("data-ryd-liked")).toBe(String(liked));
    expect(bar.getAttribute("style")).toBe(barStyle);
    expect(bar.querySelector("#ryd-bar").getAttribute("style")).toBe(fillStyle);
  }
  expect(storedData.likes).toBe(730);
  expect(createRateBar).not.toHaveBeenCalled();
});

test("a replaced native like button refreshes the bar's liked hook", async () => {
  const controls = mount();
  renderRateBar(storedData.likes, storedData.dislikes);
  const replacement = controls.nativeLikeButton.cloneNode(true);
  replacement.setAttribute("aria-pressed", "true");

  controls.nativeLikeButton.replaceWith(replacement);
  await flushMutations();

  expect(document.querySelector("#ryd-bar-container").getAttribute("data-ryd-liked")).toBe("true");
});

test("native active-class transitions refresh the bar's liked hook", async () => {
  const controls = mount();
  renderRateBar(storedData.likes, storedData.dislikes);
  const bar = document.querySelector("#ryd-bar-container");

  controls.likeButton.classList.add("style-default-active");
  await flushMutations();
  expect(bar.getAttribute("data-ryd-liked")).toBe("true");

  controls.likeButton.classList.remove("style-default-active");
  await flushMutations();
  expect(bar.getAttribute("data-ryd-liked")).toBe("false");
});

test("navigation on reused controls replaces the outgoing bar's liked state", async () => {
  const controls = mount();
  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  renderRateBar(storedData.likes, storedData.dislikes);
  const outgoingBar = document.querySelector("#ryd-bar-container");
  expect(outgoingBar.getAttribute("data-ryd-liked")).toBe("true");

  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  Object.assign(storedData, { videoId: "zyxwvutsrqp", likes: 3591, dislikes: 1409 });
  controls.nativeLikeButton.setAttribute("aria-pressed", "false");
  renderRateBar(storedData.likes, storedData.dislikes);
  const destinationBar = document.querySelector("#ryd-bar-container");
  expect(destinationBar).not.toBe(outgoingBar);
  expect(destinationBar.getAttribute("data-ryd-liked")).toBe("false");

  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();
  expect(destinationBar.getAttribute("data-ryd-liked")).toBe("true");
});

test("later native labels refresh stored likes and the rate bar when reformatting is off", async () => {
  const controls = mount();
  refreshReactionPresentation();
  createRateBar.mockClear();

  controls.nativeLikeButton.setAttribute("aria-label", "731 likes");
  await flushMutations();

  expect(storedData.likes).toBe(731);
  expect(createRateBar).toHaveBeenLastCalledWith(731, 12);
});

test("pressed-state mutations do not replace optimistic likes with an unchanged native label", async () => {
  const controls = mount();
  refreshReactionPresentation();
  storedData.likes = 731;
  createRateBar.mockClear();

  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();

  expect(storedData.likes).toBe(731);
  expect(createRateBar).not.toHaveBeenCalled();
});

test("restored controls preserve optimistic likes through a pressed-state mutation", async () => {
  const controls = mount();
  expect(restoreCurrentState()).toBe(true);
  storedData.likes = 731;
  createRateBar.mockClear();

  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();

  expect(storedData.likes).toBe(731);
  expect(createRateBar).not.toHaveBeenCalled();
});

test("a native label from the outgoing video cannot refresh destination likes", async () => {
  const controls = mount();
  refreshReactionPresentation();
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  Object.assign(storedData, { videoId: "zyxwvutsrqp", likes: 3591, dislikes: 1409 });
  createRateBar.mockClear();

  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  await flushMutations();
  expect(storedData.likes).toBe(3591);
  expect(createRateBar).not.toHaveBeenCalled();

  controls.nativeLikeButton.setAttribute("aria-label", "3592 likes");
  await flushMutations();
  expect(storedData.likes).toBe(3592);
  expect(createRateBar).toHaveBeenLastCalledWith(3592, 1409);
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

function prependSpeedControl(host) {
  const speed = document.createElement("button");
  speed.textContent = "1x";
  host.prepend(speed);
  return speed;
}

test.each([false, true])("reaction state and thumb colors ignore prepended controls (Shorts: %s)", (shorts) => {
  const controls = mount({ shorts });
  const likeSpeed = prependSpeedControl(controls.likeButton);
  const dislikeSpeed = prependSpeedControl(controls.dislikeButton);
  extConfig.coloredThumbs = true;

  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  expect(isVideoLiked()).toBe(true);
  expect(isVideoDisliked()).toBe(false);
  refreshReactionPresentation();
  expect(controls.nativeLikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("lime");
  expect(likeSpeed.hasAttribute("data-ryd-thumb-color")).toBe(false);
  expect(dislikeSpeed.hasAttribute("data-ryd-thumb-color")).toBe(false);

  controls.nativeLikeButton.setAttribute("aria-pressed", "false");
  controls.nativeDislikeButton.setAttribute("aria-pressed", "true");
  expect(isVideoLiked()).toBe(false);
  expect(isVideoDisliked()).toBe(true);
  refreshReactionPresentation();
  expect(controls.nativeDislikeButton.style.getPropertyValue("--ryd-thumb-color")).toBe("red");
});

test.each([false, true])("delegated votes activate native reactions and ignore speed clicks (Shorts: %s)", (shorts) => {
  const controls = mount({ shorts });
  const speed = prependSpeedControl(controls.likeButton);
  speed.click();
  expect(storedData.previousState).toBe(NEUTRAL_STATE);
  expect(storedData.likes).toBe(730);

  controls.nativeLikeButton.click();
  expect(storedData.previousState).toBe(LIKED_STATE);
  expect(storedData.likes).toBe(731);
  speed.click();
  expect(storedData.previousState).toBe(LIKED_STATE);
  expect(storedData.likes).toBe(731);

  controls.nativeDislikeButton.click();
  expect(storedData.previousState).toBe(DISLIKED_STATE);
  expect(storedData.likes).toBe(730);
  expect(storedData.dislikes).toBe(13);
});

test("mobile boolean reaction labels still determine the current native vote", () => {
  const controls = mount();
  controls.buttons.classList.add("slim-video-action-bar-actions");
  controls.nativeLikeButton.removeAttribute("aria-pressed");
  controls.nativeDislikeButton.removeAttribute("aria-pressed");
  controls.nativeLikeButton.setAttribute("aria-label", "true");
  controls.nativeDislikeButton.setAttribute("aria-label", "false");
  buttonsRewire.__set__("isMobile", () => true);
  stateRewire.__set__("isMobile", () => true);
  try {
    expect(getButtonControls(controls.buttons).ready).toBe(true);
    expect(isVideoLiked()).toBe(true);
    expect(isVideoDisliked()).toBe(false);
    controls.nativeLikeButton.setAttribute("aria-label", "false");
    controls.nativeDislikeButton.setAttribute("aria-label", "true");
    expect(isVideoLiked()).toBe(false);
    expect(isVideoDisliked()).toBe(true);
  } finally {
    buttonsRewire.__ResetDependency__("isMobile");
    stateRewire.__ResetDependency__("isMobile");
  }
});

test("synthetic Shorts Dislike clears the native Like without activating a prepended speed control", () => {
  const controls = mount({ shorts: true });
  const speed = prependSpeedControl(controls.likeButton);
  const speedClicked = jest.fn();
  speed.addEventListener("click", speedClicked);
  const nativeLikeClicked = jest.fn();
  controls.nativeLikeButton.addEventListener("click", nativeLikeClicked);
  controls.dislikeButton.remove();
  const dislike = ensureSyntheticShortsDislikeButton(controls.buttons, { isHydrated: true, isStable: true });
  setSyntheticShortsDislikeEnabled(true, dislike);
  addLikeDislikeEventListener(controls.likeButton, dislike);
  controls.nativeLikeButton.setAttribute("aria-pressed", "true");
  storedData.previousState = LIKED_STATE;

  dislike.querySelector("button").click();

  expect(nativeLikeClicked).toHaveBeenCalledTimes(1);
  expect(speedClicked).not.toHaveBeenCalled();
  expect(speed.hasAttribute("aria-pressed")).toBe(false);
  expect(controls.nativeLikeButton.getAttribute("aria-pressed")).toBe("false");
  expect(dislike.querySelector("button").getAttribute("aria-pressed")).toBe("true");
  expect(storedData).toMatchObject({ previousState: DISLIKED_STATE, likes: 729, dislikes: 13 });
});
