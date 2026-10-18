/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

const mockSendMessage = jest.fn();

jest.mock("./review-prompt", () => ({ recordReviewAction: jest.fn() }));

jest.mock("./private-browsing", () => ({
  ...jest.requireActual("./private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));

jest.mock("./utils", () => ({
  createObserver: () => ({ disconnect: jest.fn(), observe: jest.fn() }),
  getBrowser: jest.fn(),
  getVideoId: (url) => new URL(url).searchParams.get("v"),
  numberFormat: (value) => String(value),
  querySelector: () => undefined,
}));

jest.mock("./buttons", () => ({
  checkForSignInButton: () => false,
  getButtons: jest.fn(),
  getDislikeButton: jest.fn(),
  getLikeButton: jest.fn(),
  getNativeButton: (control) => control?.querySelector("button[aria-pressed]"),
  isSyntheticShortsDislike: jest.fn(() => false),
  setSyntheticShortsDislikePressed: jest.fn(),
}));

jest.mock("./state", () => ({
  extConfig: {
    activeButtonClasses: ["style-default-active"],
    disableVoteSubmission: false,
    selectors: { buttons: { smartimation: ["yt-smartimation"] } },
  },
  getLikeCountFromButton: jest.fn(),
  persistSyntheticShortsDislikeState: jest.fn(async () => undefined),
  setDislikes: jest.fn(),
  updateDisableLogging: jest.fn(),
  setLikes: jest.fn(),
  refreshReactionPresentation: jest.fn(),
  storedData: { dislikes: 100, likes: 300, previousState: "neutral", videoId: "abcdefghijk" },
}));

jest.mock("./bar", () => ({
  createRateBar: jest.fn(),
}));

import { createRateBar } from "./bar";
import { getButtons, getDislikeButton, getLikeButton, isSyntheticShortsDislike } from "./buttons";
import { extConfig, persistSyntheticShortsDislikeState, setDislikes, storedData, updateDisableLogging } from "./state";
import {
  addLikeDislikeEventListener,
  dislikeClicked,
  likeClicked,
  sendVote,
  storageChangeHandler,
  updateDOMDislikes,
} from "./events";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getBrowser } from "./utils";
import { recordReviewAction } from "./review-prompt";

beforeEach(() => {
  recordReviewAction.mockClear();
  isPrivateBrowsingContext.mockReturnValue(false);
  isSyntheticShortsDislike.mockReturnValue(false);
  extConfig.disableVoteSubmission = false;
  createRateBar.mockClear();
  setDislikes.mockClear();
  mockSendMessage.mockReset();
  getBrowser.mockReturnValue({ runtime: { sendMessage: mockSendMessage } });
  getButtons.mockReset();
  getDislikeButton.mockReset();
  getLikeButton.mockReset();
  storedData.dislikes = 100;
  storedData.likes = 300;
  storedData.previousState = "NEUTRAL_STATE";
  storedData.videoId = "abcdefghijk";
  history.replaceState({}, "", "/watch?v=abcdefghijk");
});

test.each([false, true])("private direct reactions do not alter counts or submit (disabled=%s)", (disabled) => {
  isPrivateBrowsingContext.mockReturnValue(true);
  extConfig.disableVoteSubmission = disabled;
  storedData.previousState = "LIKED_STATE";
  const before = { ...storedData };
  const likeButton = document.createElement("div");
  const nativeLike = document.createElement("button");
  const nativeLikeClick = jest.fn();
  nativeLike.addEventListener("click", nativeLikeClick);
  likeButton.append(nativeLike);
  getLikeButton.mockReturnValue(likeButton);
  isSyntheticShortsDislike.mockReturnValue(true);

  sendVote(-1);
  dislikeClicked();
  likeClicked();

  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(nativeLikeClick).not.toHaveBeenCalled();
  expect(persistSyntheticShortsDislikeState).not.toHaveBeenCalled();
  expect(storedData).toEqual(before);
  expect(setDislikes).not.toHaveBeenCalled();
  expect(recordReviewAction).not.toHaveBeenCalled();
});

test("review progress uses local reactions even when vote submission is disabled", () => {
  extConfig.disableVoteSubmission = true;
  likeClicked();
  expect(recordReviewAction).toHaveBeenLastCalledWith("abcdefghijk", 1);
  dislikeClicked();
  expect(recordReviewAction).toHaveBeenLastCalledWith("abcdefghijk", -1);
  dislikeClicked();
  expect(recordReviewAction).toHaveBeenLastCalledWith("abcdefghijk", 0);
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("stale video controls cannot advance review progress", () => {
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  likeClicked();
  dislikeClicked();
  expect(recordReviewAction).not.toHaveBeenCalled();
});

test("private native reactions keep their YouTube click behavior without local reaction changes", () => {
  isPrivateBrowsingContext.mockReturnValue(true);
  const controls = createReactionControls("private");
  document.body.replaceChildren(controls.buttons);
  getButtons.mockReturnValue(controls.buttons);
  getLikeButton.mockReturnValue(controls.likeButton);
  getDislikeButton.mockReturnValue(controls.dislikeButton);
  const nativeAction = jest.fn();
  controls.nativeDislikeButton.addEventListener("click", nativeAction);
  const before = { ...storedData };
  addLikeDislikeEventListener(controls.likeButton, controls.dislikeButton);
  controls.nativeDislikeButton.click();
  expect(nativeAction).toHaveBeenCalledTimes(1);
  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(storedData).toEqual(before);
});

test("renders cached counts only while they belong to the current video", () => {
  expect(updateDOMDislikes()).toBe(true);
  expect(setDislikes).toHaveBeenCalledWith("100");
  expect(createRateBar).toHaveBeenCalledWith(300, 100);
});

test("a smartimation callback cannot restore outgoing counts after navigation", () => {
  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");

  expect(updateDOMDislikes()).toBe(false);
  expect(setDislikes).not.toHaveBeenCalled();
  expect(createRateBar).not.toHaveBeenCalled();
});

test("does not render cached counts when the current URL has no video identity", () => {
  history.replaceState({}, "", "/feed/subscriptions");

  expect(updateDOMDislikes()).toBe(false);
  expect(setDislikes).not.toHaveBeenCalled();
  expect(createRateBar).not.toHaveBeenCalled();
});

test.each([true, false, undefined])("applies live sync logging preference changes (%s)", (newValue) => {
  storageChangeHandler({ disableLogging: { oldValue: !newValue, newValue } }, "sync");
  expect(updateDisableLogging).toHaveBeenCalledWith(newValue);
});

test.each(["local", "session", "managed", undefined])("ignores logging preference events outside sync (%s)", (area) => {
  storageChangeHandler({ disableLogging: { newValue: false } }, area);
  expect(updateDisableLogging).not.toHaveBeenCalled();
});

test("private tabs ignore normal logging preference changes", () => {
  isPrivateBrowsingContext.mockReturnValue(true);
  storageChangeHandler({ disableLogging: { newValue: false } }, "sync");
  expect(updateDisableLogging).not.toHaveBeenCalled();
});

test("publishes hide-clutter setting changes to the page-world menu fixer", () => {
  storageChangeHandler({ hideClutterButtons: { newValue: true } }, "sync");

  expect(extConfig.hideClutterButtons).toBe(true);
  expect(document.documentElement.getAttribute("data-ryd-hide-clutter-buttons")).toBe("true");

  storageChangeHandler({ hideClutterButtons: { newValue: false } }, "sync");

  expect(extConfig.hideClutterButtons).toBe(false);
  expect(document.documentElement.getAttribute("data-ryd-hide-clutter-buttons")).toBe("false");
});

function createReactionControls(name) {
  const buttons = document.createElement("div");
  buttons.dataset.controls = name;
  const likeButton = document.createElement("like-button-view-model");
  const nativeLikeButton = document.createElement("button");
  nativeLikeButton.setAttribute("aria-pressed", "false");
  likeButton.appendChild(nativeLikeButton);
  const dislikeButton = document.createElement("dislike-button-view-model");
  const nativeDislikeButton = document.createElement("button");
  nativeDislikeButton.setAttribute("aria-pressed", "false");
  dislikeButton.appendChild(nativeDislikeButton);
  buttons.append(likeButton, dislikeButton);
  return { buttons, dislikeButton, likeButton, nativeDislikeButton };
}

test("delegated reaction activation survives hydrated host replacement and ignores retained outgoing controls", () => {
  const outgoing = createReactionControls("outgoing");
  const destination = createReactionControls("destination");
  document.body.replaceChildren(outgoing.buttons, destination.buttons);

  let current = outgoing;
  getButtons.mockImplementation(() => current.buttons);
  getLikeButton.mockImplementation(() => current.likeButton);
  getDislikeButton.mockImplementation(() => current.dislikeButton);
  addLikeDislikeEventListener(outgoing.likeButton, outgoing.dislikeButton);

  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  storedData.videoId = "zyxwvutsrqp";
  current = destination;

  outgoing.nativeDislikeButton.click();
  expect(mockSendMessage).not.toHaveBeenCalled();

  destination.nativeDislikeButton.click();

  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  expect(mockSendMessage).toHaveBeenCalledWith({
    message: "send_vote",
    videoId: "zyxwvutsrqp",
    vote: -1,
  });
  expect(storedData).toMatchObject({ dislikes: 101, likes: 300, previousState: "DISLIKED_STATE" });
  expect(setDislikes).toHaveBeenLastCalledWith("101");
  expect(createRateBar).toHaveBeenLastCalledWith(300, 101);

  addLikeDislikeEventListener(destination.likeButton, destination.dislikeButton);
  addLikeDislikeEventListener(destination.likeButton, destination.dislikeButton);
  destination.nativeDislikeButton.click();

  expect(mockSendMessage).toHaveBeenCalledTimes(2);
  expect(mockSendMessage).toHaveBeenLastCalledWith({
    message: "send_vote",
    videoId: "zyxwvutsrqp",
    vote: 0,
  });
});

test("delegated reaction activation does not vote before state belongs to the current video", () => {
  const destination = createReactionControls("destination");
  document.body.replaceChildren(destination.buttons);
  getButtons.mockReturnValue(destination.buttons);
  getLikeButton.mockReturnValue(destination.likeButton);
  getDislikeButton.mockReturnValue(destination.dislikeButton);
  addLikeDislikeEventListener(destination.likeButton, destination.dislikeButton);

  history.replaceState({}, "", "/watch?v=zyxwvutsrqp");
  storedData.videoId = "abcdefghijk";
  destination.nativeDislikeButton.click();

  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(storedData).toMatchObject({ dislikes: 100, likes: 300, previousState: "NEUTRAL_STATE" });
});
