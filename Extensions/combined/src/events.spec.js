/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.youtube.com/watch?v=abcdefghijk"}
 */

const mockSendMessage = jest.fn();
const mockHint = {
  capturePageContext: jest.fn((videoId) => ({ videoId })),
  clearPendingVote: jest.fn(),
  isCurrent: jest.fn(() => true),
  offerVote: jest.fn(),
};

jest.mock("./core-data-consent", () => ({
  hasFeaturePermission: jest.fn(async () => false),
  usesFirefoxDataCollectionConsent: jest.fn(() => false),
}));
jest.mock("./data-consent-prompt", () => ({ getDataConsentPrompt: jest.fn() }));

jest.mock("./review-prompt", () => ({ recordReviewAction: jest.fn() }));

jest.mock("./private-browsing", () => ({
  ...jest.requireActual("./private-browsing"),
  isPrivateBrowsingContext: jest.fn(),
}));

jest.mock("./utils", () => ({
  createObserver: () => ({ disconnect: jest.fn(), observe: jest.fn() }),
  getBrowser: jest.fn(),
  getVideoId: (url) => jest.requireActual("./utils").getVideoId(url),
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
  getState: jest.fn(),
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
import {
  extConfig,
  getState,
  persistSyntheticShortsDislikeState,
  setDislikes,
  storedData,
  updateDisableLogging,
} from "./state";
import { hasFeaturePermission, usesFirefoxDataCollectionConsent } from "./core-data-consent";
import { getDataConsentPrompt } from "./data-consent-prompt";
import {
  addLikeDislikeEventListener,
  dislikeClicked,
  likeClicked,
  sendVote,
  storageChangeHandler,
  updateDOMDislikes,
  setCountPermissionAvailable,
} from "./events";
import { isPrivateBrowsingContext } from "./private-browsing";
import { getBrowser } from "./utils";
import { recordReviewAction } from "./review-prompt";

beforeEach(() => {
  setCountPermissionAvailable(true);
  usesFirefoxDataCollectionConsent.mockReturnValue(false);
  hasFeaturePermission.mockClear();
  hasFeaturePermission.mockResolvedValue(false);
  getDataConsentPrompt.mockReturnValue(mockHint);
  mockHint.capturePageContext.mockImplementation((videoId) => ({ videoId }));
  mockHint.isCurrent.mockReturnValue(true);
  mockHint.offerVote.mockClear();
  mockHint.clearPendingVote.mockClear();
  getState.mockReturnValue({ current: "NEUTRAL_STATE" });
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

test("Firefox does not submit a denied vote and offers permission only after the click", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  expect(hasFeaturePermission).toHaveBeenCalledWith("voting");
  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(mockHint.offerVote).toHaveBeenCalledWith({ videoId: "abcdefghijk" }, expect.any(Function));
});

test("missing Firefox count permission leaves native reactions untouched and sends no vote", () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  setCountPermissionAvailable(false);
  const before = { ...storedData };
  sendVote(-1);
  dislikeClicked();
  likeClicked();
  expect(storedData).toEqual(before);
  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(hasFeaturePermission).not.toHaveBeenCalled();
  expect(mockHint.offerVote).not.toHaveBeenCalled();
  expect(recordReviewAction).not.toHaveBeenCalled();
});

test("count revocation invalidates a pending vote lookup even after counts are granted again", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  let resolvePermission;
  hasFeaturePermission.mockImplementationOnce(() => new Promise((resolve) => (resolvePermission = resolve)));
  sendVote(-1);
  setCountPermissionAvailable(false);
  setCountPermissionAvailable(true);
  resolvePermission(true);
  await Promise.resolve();
  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(mockHint.offerVote).not.toHaveBeenCalled();
});

test("count revocation invalidates an earlier vote hint callback", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  const submit = mockHint.offerVote.mock.calls[0][1];
  setCountPermissionAvailable(false);
  setCountPermissionAvailable(true);
  submit();
  expect(mockSendMessage).not.toHaveBeenCalled();
  expect(mockHint.clearPendingVote).toHaveBeenCalled();
});

test.each([
  ["LIKED_STATE", 1],
  ["DISLIKED_STATE", -1],
  ["NEUTRAL_STATE", 0],
])("Firefox submits the current button state after a grant (%s)", async (current, vote) => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  const granted = mockHint.offerVote.mock.calls[0][1];
  getLikeButton.mockReturnValue(document.createElement("div"));
  getDislikeButton.mockReturnValue(document.createElement("div"));
  storedData.videoId = null;
  getState.mockReturnValue({ current });
  granted();
  expect(mockSendMessage).toHaveBeenCalledWith({ message: "send_vote", videoId: "abcdefghijk", vote });
});

test("a pending Firefox click cannot submit after its navigation context changes", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  const granted = mockHint.offerVote.mock.calls[0][1];
  mockHint.isCurrent.mockReturnValue(false);
  granted();
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test.each([false, true])(
  "the disable switch stops Firefox votes and offers no hint (voting granted: %s)",
  async (granted) => {
    usesFirefoxDataCollectionConsent.mockReturnValue(true);
    hasFeaturePermission.mockResolvedValue(granted);
    extConfig.disableVoteSubmission = true;
    sendVote(-1);
    await Promise.resolve();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(hasFeaturePermission).not.toHaveBeenCalled();
    expect(mockHint.offerVote).not.toHaveBeenCalled();
  },
);

test("turning the switch on cancels a pending Firefox vote hint", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  const granted = mockHint.offerVote.mock.calls[0][1];
  storageChangeHandler({ disableVoteSubmission: { oldValue: false, newValue: true } }, "sync");
  expect(mockHint.clearPendingVote).toHaveBeenCalled();
  storageChangeHandler({ disableVoteSubmission: { oldValue: true, newValue: false } }, "sync");
  granted();
  expect(mockSendMessage).not.toHaveBeenCalled();
});

test("reversed Firefox permission completions submit only the latest click", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  const resolutions = [];
  hasFeaturePermission.mockImplementation(() => new Promise((resolve) => resolutions.push(resolve)));
  sendVote(-1);
  sendVote(0);
  resolutions[1](true);
  await Promise.resolve();
  resolutions[0](true);
  await Promise.resolve();
  expect(mockSendMessage).toHaveBeenCalledTimes(1);
  expect(mockSendMessage).toHaveBeenCalledWith({ message: "send_vote", videoId: "abcdefghijk", vote: 0 });
  expect(mockHint.offerVote).not.toHaveBeenCalled();
});

test("an earlier denied Firefox result cannot show a hint after a newer granted click", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  const resolutions = [];
  hasFeaturePermission.mockImplementation(() => new Promise((resolve) => resolutions.push(resolve)));
  sendVote(-1);
  sendVote(1);
  resolutions[1](true);
  await Promise.resolve();
  resolutions[0](false);
  await Promise.resolve();
  expect(mockSendMessage).toHaveBeenCalledWith({ message: "send_vote", videoId: "abcdefghijk", vote: 1 });
  expect(mockHint.offerVote).not.toHaveBeenCalled();
  expect(mockHint.clearPendingVote).toHaveBeenCalledTimes(2);
});

test("a newer Firefox activation invalidates the earlier hint's grant callback", async () => {
  usesFirefoxDataCollectionConsent.mockReturnValue(true);
  sendVote(-1);
  await Promise.resolve();
  const earlierGrant = mockHint.offerVote.mock.calls[0][1];
  getLikeButton.mockReturnValue(document.createElement("div"));
  getDislikeButton.mockReturnValue(document.createElement("div"));
  getState.mockReturnValue({ current: "LIKED_STATE" });
  sendVote(1);
  earlierGrant();
  expect(mockSendMessage).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(mockHint.offerVote).toHaveBeenCalledTimes(2);
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

test("each activation submits the video identity of the route shown at click time", () => {
  const routes = [
    ["/watch?v=a-B_c1D2e3F&list=PLx&t=42s", "a-B_c1D2e3F"],
    ["/shorts/zyxwvutsrqp?feature=share", "zyxwvutsrqp"],
    ["/live/0sfDth4lMLc?si=share", "0sfDth4lMLc"],
    ["/watch?v=abcdefghijk", "abcdefghijk"],
  ];

  for (const [route, videoId] of routes) {
    history.pushState({}, "", route);
    storedData.videoId = videoId;
    storedData.previousState = "NEUTRAL_STATE";
    likeClicked();
    dislikeClicked();
  }

  expect(mockSendMessage.mock.calls.map(([message]) => message)).toEqual(
    routes.flatMap(([, videoId]) => [
      { message: "send_vote", videoId, vote: 1 },
      { message: "send_vote", videoId, vote: -1 },
    ]),
  );
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
