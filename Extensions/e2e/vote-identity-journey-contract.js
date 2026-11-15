const { expect } = require("@playwright/test");
const { VIDEO_A, VIDEO_B } = require("../UserScript/e2e/harness");
const {
  SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
  getDestinationDislikePostconditionTarget,
} = require("../UserScript/e2e/navigation-matrix");
const {
  assertRuntimeRegistration,
  expectExactVoteSequence,
  expectSuccessfulVoteActivation,
} = require("./navigation-runtime-contract");

const VIDEO_C = "Ab-_9xYz0Q1";
const VOTE_IDENTITY_JOURNEY_COUNTS = Object.freeze({
  [VIDEO_A]: Object.freeze({ dislikes: 100, likes: 300 }),
  [VIDEO_B]: Object.freeze({ dislikes: 300, likes: 100 }),
  [VIDEO_C]: Object.freeze({ dislikes: 50, likes: 100 }),
});
const VOTE_IDENTITY_JOURNEY_VIEWPORT = Object.freeze({ height: 720, width: 1280 });
const NAVIGATIONS = Object.freeze({
  IN_PAGE_LINK: "in-page-link",
  RECYCLED_SHORT: "recycled-short",
});

const vote = (action, value) => Object.freeze({ action, value });
const navigate = (via, kind, videoId) => Object.freeze({ navigation: Object.freeze({ kind, via, videoId }) });

const VOTE_IDENTITY_JOURNEYS = Object.freeze([
  Object.freeze({
    id: "watch-in-page-hops-and-return",
    origin: Object.freeze({ kind: "watch", videoId: VIDEO_A }),
    steps: Object.freeze([
      vote("like", 1),
      navigate(NAVIGATIONS.IN_PAGE_LINK, "watch", VIDEO_B),
      vote("like", 1),
      vote("dislike", -1),
      navigate(NAVIGATIONS.IN_PAGE_LINK, "watch", VIDEO_C),
      vote("dislike", -1),
      vote("dislike", 0),
      navigate(NAVIGATIONS.IN_PAGE_LINK, "watch", VIDEO_A),
      vote("dislike", -1),
    ]),
  }),
  Object.freeze({
    id: "shorts-next-and-previous-recycled-renderers",
    origin: Object.freeze({ kind: "shorts", videoId: VIDEO_A }),
    steps: Object.freeze([
      vote("like", 1),
      navigate(NAVIGATIONS.RECYCLED_SHORT, "shorts", VIDEO_B),
      vote("like", 1),
      vote("dislike", -1),
      vote("dislike", 0),
      navigate(NAVIGATIONS.RECYCLED_SHORT, "shorts", VIDEO_A),
      vote("like", 0),
      vote("dislike", -1),
    ]),
  }),
  Object.freeze({
    id: "watch-shorts-watch-cross-surface",
    origin: Object.freeze({ kind: "watch", videoId: VIDEO_A }),
    steps: Object.freeze([
      vote("like", 1),
      navigate(NAVIGATIONS.IN_PAGE_LINK, "shorts", VIDEO_B),
      vote("like", 1),
      vote("dislike", -1),
      navigate(NAVIGATIONS.IN_PAGE_LINK, "watch", VIDEO_C),
      vote("dislike", -1),
      vote("like", 1),
    ]),
  }),
]);

function registerVoteIdentityJourneys({ register, runtimeName }) {
  assertRuntimeRegistration({ register, runtimeName }, "vote identity journey");
  for (const journey of VOTE_IDENTITY_JOURNEYS) {
    register({ journey, title: `${runtimeName} vote identity journey: ${journey.id}` });
  }
}

function expectedJourneyVotes(journey) {
  let videoId = journey.origin.videoId;
  const votes = [];
  for (const step of journey.steps) {
    if (step.navigation) videoId = step.navigation.videoId;
    else votes.push({ value: step.value, videoId });
  }
  return votes;
}

function destinationTarget(adapter, { kind, videoId }) {
  return getDestinationDislikePostconditionTarget(adapter.page, adapter.matrixRuntime, {
    destination: { counts: VOTE_IDENTITY_JOURNEY_COUNTS[videoId], kind, videoId },
    id: `vote-identity-${kind}-${videoId}`,
    postcondition: SINGLE_DESTINATION_DISLIKE_POSTCONDITION,
  });
}

async function expectCurrentVoteSurface(adapter, destination, statsRequestStartIndex) {
  await expect(adapter.page).toHaveURL((url) =>
    destination.kind === "shorts"
      ? url.pathname === `/shorts/${destination.videoId}`
      : url.pathname === "/watch" && url.searchParams.get("v") === destination.videoId,
  );
  await expect
    .poll(
      () =>
        adapter.backend
          .requestsFor("GET", "/votes")
          .slice(statsRequestStartIndex)
          .some((request) => request.query.videoId === destination.videoId && Number.isFinite(request.respondedAt)),
      { message: `${adapter.runtimeName} must load ${destination.videoId} counts for this visit before voting` },
    )
    .toBe(true);
  const target = destinationTarget(adapter, destination);
  await expect(target.control).toBeVisible();
  await expect(target.button).toBeEnabled();
  await expect(target.likeButton).toBeEnabled();
  await expect(target.count).toHaveText(target.expectedInitialDislikeCount);
  return target;
}

async function navigateInPage(page, { kind, via, videoId }) {
  await page.evaluate(
    ({ destinationKind, destinationVideoId, navigation, recycledShort }) => {
      document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
      if (navigation === recycledShort) {
        window.__navigationFixture.recycleShort(destinationVideoId);
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
        return;
      }
      window.__navigationFixture.navigate(destinationKind, destinationVideoId);
    },
    { destinationKind: kind, destinationVideoId: videoId, navigation: via, recycledShort: NAVIGATIONS.RECYCLED_SHORT },
  );
}

async function runVoteIdentityJourney({ adapter, journey }) {
  let destination = journey.origin;
  let target = await expectCurrentVoteSurface(adapter, destination, 0);
  for (const step of journey.steps) {
    if (step.navigation) {
      destination = step.navigation;
      const statsRequestStartIndex = adapter.backend.requestsFor("GET", "/votes").length;
      await navigateInPage(adapter.page, destination);
      target = await expectCurrentVoteSurface(adapter, destination, statsRequestStartIndex);
      continue;
    }
    await expectSuccessfulVoteActivation(
      adapter,
      destination.videoId,
      step.value,
      step.action === "like" ? target.likeButton : target.button,
    );
  }

  const expectedVotes = expectedJourneyVotes(journey);
  expectExactVoteSequence(
    adapter.readInteractionRecords(),
    expectedVotes,
    `${adapter.runtimeName} must submit exactly one current-video vote per activation across ${journey.id}`,
  );
  return expectedVotes;
}

module.exports = {
  VIDEO_C,
  VOTE_IDENTITY_JOURNEYS,
  VOTE_IDENTITY_JOURNEY_COUNTS,
  VOTE_IDENTITY_JOURNEY_VIEWPORT,
  expectedJourneyVotes,
  registerVoteIdentityJourneys,
  runVoteIdentityJourney,
};
