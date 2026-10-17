/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

const mockSendMessage = jest.fn();

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
  isSyntheticShortsDislike: () => false,
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
  setLikes: jest.fn(),
  storedData: { dislikes: 100, likes: 300, previousState: "neutral", videoId: "abcdefghijk" },
}));

jest.mock("./bar", () => ({
  createRateBar: jest.fn(),
}));

import { createRateBar } from "./bar";
import { getButtons, getDislikeButton, getLikeButton } from "./buttons";
import { extConfig, setDislikes, storedData } from "./state";
import { addLikeDislikeEventListener, storageChangeHandler, updateDOMDislikes } from "./events";
import { getBrowser } from "./utils";

beforeEach(() => {
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
