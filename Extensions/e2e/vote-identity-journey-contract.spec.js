const {
  VIDEO_C,
  VOTE_IDENTITY_JOURNEYS,
  VOTE_IDENTITY_JOURNEY_COUNTS,
  expectedJourneyVotes,
  registerVoteIdentityJourneys,
} = require("./vote-identity-journey-contract");
const { VIDEO_A, VIDEO_B } = require("../UserScript/e2e/harness");

function journeyVisits(journey) {
  const visits = [{ ...journey.origin, votes: 0 }];
  for (const step of journey.steps) {
    if (step.navigation) visits.push({ ...step.navigation, votes: 0 });
    else visits.at(-1).votes += 1;
  }
  return visits;
}

test.each(["userscript", "extension"])("registers every vote identity journey for %s", (runtimeName) => {
  const registrations = [];
  registerVoteIdentityJourneys({ register: (registration) => registrations.push(registration), runtimeName });

  expect(registrations.map(({ journey }) => journey)).toEqual(VOTE_IDENTITY_JOURNEYS);
  expect(registrations.map(({ title }) => title)).toEqual(
    VOTE_IDENTITY_JOURNEYS.map(({ id }) => `${runtimeName} vote identity journey: ${id}`),
  );
});

test("rejects an unsupported runtime or a missing register callback", () => {
  expect(() => registerVoteIdentityJourneys({ register: () => {}, runtimeName: "safari" })).toThrow(TypeError);
  expect(() => registerVoteIdentityJourneys({ runtimeName: "extension" })).toThrow(TypeError);
});

test("derives the exact expected vote sequence from the journey steps", () => {
  const shortsJourney = VOTE_IDENTITY_JOURNEYS.find(({ id }) => id === "shorts-next-and-previous-recycled-renderers");

  expect(expectedJourneyVotes(shortsJourney)).toEqual([
    { value: 1, videoId: VIDEO_A },
    { value: 1, videoId: VIDEO_B },
    { value: -1, videoId: VIDEO_B },
    { value: 0, videoId: VIDEO_B },
    { value: 0, videoId: VIDEO_A },
    { value: -1, videoId: VIDEO_A },
  ]);
});

test("votes on every visit after a real video change with distinct, fully described identities", () => {
  expect(new Set(VOTE_IDENTITY_JOURNEYS.map(({ id }) => id)).size).toBe(VOTE_IDENTITY_JOURNEYS.length);
  expect(VIDEO_C).toMatch(/^(?=.*-)(?=.*_)[A-Za-z0-9_-]{11}$/);

  for (const journey of VOTE_IDENTITY_JOURNEYS) {
    const visits = journeyVisits(journey);
    expect(visits.length).toBeGreaterThan(1);
    for (const [index, visit] of visits.entries()) {
      expect(visit.votes).toBeGreaterThan(0);
      expect(VOTE_IDENTITY_JOURNEY_COUNTS[visit.videoId]).toEqual({
        dislikes: expect.any(Number),
        likes: expect.any(Number),
      });
      if (index > 0) expect(visit.videoId).not.toBe(visits[index - 1].videoId);
    }
  }
});

test("covers every vote value, recycled Shorts revisits, and both cross-surface directions", () => {
  const votes = VOTE_IDENTITY_JOURNEYS.flatMap(expectedJourneyVotes);
  expect([...new Set(votes.map(({ value }) => value))].sort()).toEqual([-1, 0, 1]);

  const transitions = VOTE_IDENTITY_JOURNEYS.flatMap((journey) => {
    const visits = journeyVisits(journey);
    return visits.slice(1).map((visit, index) => ({
      direction: `${visits[index].kind}->${visit.kind}`,
      revisit: visits.slice(0, index + 1).some(({ videoId }) => videoId === visit.videoId),
      via: visit.via,
    }));
  });
  expect(transitions).toEqual(
    expect.arrayContaining([
      { direction: "watch->watch", revisit: true, via: "in-page-link" },
      { direction: "shorts->shorts", revisit: false, via: "recycled-short" },
      { direction: "shorts->shorts", revisit: true, via: "recycled-short" },
      { direction: "watch->shorts", revisit: false, via: "in-page-link" },
      { direction: "shorts->watch", revisit: false, via: "in-page-link" },
    ]),
  );
});
