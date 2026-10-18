import { createReviewPromptTracker } from "./review-prompt-tracker";

const STORAGE_KEY = "reviewPromptState";
const VIDEO_IDS = ["video000001", "video000002", "video000003", "video000004", "video000005", "video000006"];
const NO_PROMPT = { showPrompt: false };
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function makeSender(videoId = VIDEO_IDS[0], url = `https://www.youtube.com/watch?v=${videoId}`) {
  return {
    id: "extension-id",
    frameId: 0,
    url,
    tab: { id: 1, incognito: false, url },
  };
}

function harness(initialState) {
  const data = initialState === undefined ? {} : { [STORAGE_KEY]: clone(initialState) };
  const local = {
    get: jest.fn(async (key) => ({ [key]: clone(data[key]) })),
    set: jest.fn(async (values) => {
      Object.assign(data, clone(values));
    }),
  };
  const api = {
    runtime: {
      id: "extension-id",
      getManifest: jest.fn(() => ({ manifest_version: 3, background: { service_worker: "ryd.background.js" } })),
    },
    storage: { local },
  };
  const tracker = createReviewPromptTracker(api);
  const record = (videoId, vote = -1, canShow = true, sender = makeSender(videoId)) =>
    tracker.recordAction({ videoId, vote, canShow }, sender);
  return { api, data, local, record, tracker };
}

describe("review prompt engagement tracker", () => {
  test("counts five distinct liked or disliked videos and waits for a later dislike", async () => {
    const { data, local, record } = harness();
    for (const [index, videoId] of VIDEO_IDS.slice(0, 5).entries()) {
      expect(await record(videoId, index % 2 === 0 ? -1 : 1)).toEqual(NO_PROMPT);
      expect(data[STORAGE_KEY]).toEqual(index === 4 ? { eligible: true } : { videoIds: VIDEO_IDS.slice(0, index + 1) });
    }
    expect(await record(VIDEO_IDS[5], 1)).toEqual(NO_PROMPT);
    expect(local.set).toHaveBeenCalledTimes(5);
    expect(await record(VIDEO_IDS[0], -1)).toEqual({ showPrompt: true });
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(await record(VIDEO_IDS[5], -1)).toEqual(NO_PROMPT);
    expect(local.set).toHaveBeenCalledTimes(6);
  });

  test("repeated likes and dislikes on one video count only once", async () => {
    const { data, local, record } = harness();
    for (const vote of [1, -1, 1, -1, -1, 1]) {
      expect(await record(VIDEO_IDS[0], vote)).toEqual(NO_PROMPT);
    }
    expect(data[STORAGE_KEY]).toEqual({ videoIds: [VIDEO_IDS[0]] });
    expect(local.set).toHaveBeenCalledTimes(1);
    for (const videoId of VIDEO_IDS.slice(1, 5)) await record(videoId);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
  });

  test("deduplicates clips and watch pages by their underlying video and prompts on a later clip dislike", async () => {
    const { data, local, record } = harness();
    const clipSender = makeSender(VIDEO_IDS[0], "https://www.youtube.com/clip/first_clip-id");
    expect(await record(VIDEO_IDS[0], 1, true, clipSender)).toEqual(NO_PROMPT);
    expect(await record(VIDEO_IDS[0], -1)).toEqual(NO_PROMPT);
    const secondClip = makeSender(VIDEO_IDS[0], "https://www.youtube.com/clip/second_clip-id/");
    expect(await record(VIDEO_IDS[0], -1, true, secondClip)).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ videoIds: [VIDEO_IDS[0]] });
    expect(local.set).toHaveBeenCalledTimes(1);
    for (const videoId of VIDEO_IDS.slice(1, 4)) await record(videoId, 1);
    const fifthClip = makeSender(VIDEO_IDS[4], "https://www.youtube.com/clip/fifth_clip");
    expect(await record(VIDEO_IDS[4], -1, true, fifthClip)).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    expect(await record(VIDEO_IDS[4], -1, true, fifthClip)).toEqual({ showPrompt: true });
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
  });

  test("a hidden content prompt still records engagement without consuming eligibility", async () => {
    const { data, record, tracker } = harness();
    for (const videoId of VIDEO_IDS.slice(0, 5)) expect(await record(videoId, -1, false)).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    for (const canShow of [false, undefined, null, 1, "true"]) {
      const sender = makeSender(VIDEO_IDS[5]);
      expect(await tracker.recordAction({ videoId: VIDEO_IDS[5], vote: -1, canShow }, sender)).toEqual(NO_PROMPT);
    }
    expect(await record(VIDEO_IDS[5], -1, false)).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    expect(await record(VIDEO_IDS[5], -1, true)).toEqual({ showPrompt: true });
  });

  test("persists progress and the one-time claim across worker restarts", async () => {
    const { api, data, record } = harness();
    for (const videoId of VIDEO_IDS.slice(0, 3)) await record(videoId, 1);
    let restarted = createReviewPromptTracker(api);
    for (const videoId of VIDEO_IDS.slice(3, 5)) {
      expect(await restarted.recordAction({ videoId, vote: -1, canShow: true }, makeSender(videoId))).toEqual(
        NO_PROMPT,
      );
    }
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    restarted = createReviewPromptTracker(api);
    const action = { videoId: VIDEO_IDS[0], vote: -1, canShow: true };
    expect(await restarted.recordAction(action, makeSender())).toEqual({ showPrompt: true });
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(await createReviewPromptTracker(api).recordAction(action, makeSender())).toEqual(NO_PROMPT);
  });

  test("serializes concurrent cross-tab engagements without losing distinct videos", async () => {
    const { data, local, record } = harness();
    const firstRead = deferred();
    local.get.mockImplementationOnce(async () => {
      await firstRead.promise;
      return {};
    });
    const pending = VIDEO_IDS.slice(0, 5).map((videoId, index) => {
      const sender = makeSender(videoId);
      sender.tab.id = index + 1;
      return record(videoId, index % 2 === 0 ? -1 : 1, true, sender);
    });
    await flush();
    expect(local.get).toHaveBeenCalledTimes(1);
    expect(local.set).not.toHaveBeenCalled();
    firstRead.resolve();
    expect(await Promise.all(pending)).toEqual(Array(5).fill(NO_PROMPT));
    expect(local.set.mock.calls.map(([values]) => values[STORAGE_KEY])).toEqual([
      { videoIds: VIDEO_IDS.slice(0, 1) },
      { videoIds: VIDEO_IDS.slice(0, 2) },
      { videoIds: VIDEO_IDS.slice(0, 3) },
      { videoIds: VIDEO_IDS.slice(0, 4) },
      { eligible: true },
    ]);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
  });

  test("commits the claim before resolving and gives concurrent tabs only one prompt", async () => {
    const { data, local, record } = harness({ eligible: true });
    const claimWrite = deferred();
    local.set.mockImplementationOnce(async (values) => {
      await claimWrite.promise;
      Object.assign(data, clone(values));
    });
    const first = record(VIDEO_IDS[0]);
    const secondSender = makeSender(VIDEO_IDS[1]);
    secondSender.tab.id = 2;
    const second = record(VIDEO_IDS[1], -1, true, secondSender);
    let completed = false;
    void (async () => {
      await first;
      completed = true;
    })();
    await flush();
    expect(completed).toBe(false);
    expect(local.get).toHaveBeenCalledTimes(1);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    claimWrite.resolve();
    expect(await Promise.all([first, second])).toEqual([{ showPrompt: true }, NO_PROMPT]);
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(local.get).toHaveBeenCalledTimes(2);
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  test.each([
    null,
    false,
    true,
    1,
    "eligible",
    [],
    {},
    { shown: false },
    { shown: 1 },
    { eligible: false },
    { eligible: "true" },
    { videoIds: "video000001" },
    { videoIds: [] },
    { videoIds: VIDEO_IDS.slice(0, 5) },
    { videoIds: [VIDEO_IDS[0], "invalid"] },
    { videoIds: [VIDEO_IDS[0], VIDEO_IDS[0]] },
    { shown: true, videoIds: [VIDEO_IDS[0]] },
    { eligible: true, videoIds: [VIDEO_IDS[0]] },
    { eligible: true, unknown: true },
    { unknown: true },
  ])("leaves malformed state %p untouched without granting a prompt", async (state) => {
    const { data, local, record } = harness(state);
    for (const videoId of VIDEO_IDS) expect(await record(videoId)).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual(state);
    expect(local.set).not.toHaveBeenCalled();
  });

  test.each([undefined, { eligible: true }, { videoIds: [VIDEO_IDS[0]] }])(
    "an observed shown marker remains consumed after stored state rolls back to %p",
    async (rollback) => {
      const { data, local, record } = harness({ shown: true });
      expect(await record(VIDEO_IDS[0])).toEqual(NO_PROMPT);
      data[STORAGE_KEY] = clone(rollback);
      for (const videoId of VIDEO_IDS) expect(await record(videoId)).toEqual(NO_PROMPT);
      expect(data[STORAGE_KEY]).toEqual(rollback);
      expect(local.get).toHaveBeenCalledTimes(1);
      expect(local.set).not.toHaveBeenCalled();
    },
  );

  test.each([0, undefined, null, "-1", "1", false, 2, -2, NaN])(
    "ignores neutral, removal, or invalid vote %p without reading storage",
    async (vote) => {
      const { data, local, tracker } = harness({ eligible: true });
      expect(await tracker.recordAction({ videoId: VIDEO_IDS[0], vote, canShow: true }, makeSender())).toEqual(
        NO_PROMPT,
      );
      expect(data[STORAGE_KEY]).toEqual({ eligible: true });
      expect(local.get).not.toHaveBeenCalled();
      expect(local.set).not.toHaveBeenCalled();
    },
  );

  test.each([undefined, null, "", "short", "video0000001", "invalid!001", [VIDEO_IDS[0]], 12345678901])(
    "rejects invalid video ID %p",
    async (videoId) => {
      const { local, tracker } = harness();
      expect(await tracker.recordAction({ videoId, vote: -1, canShow: true }, makeSender(videoId))).toEqual(NO_PROMPT);
      expect(local.get).not.toHaveBeenCalled();
    },
  );

  test.each(["youtube.com", "www.youtube.com", "m.youtube.com"])(
    "accepts watch, Shorts, and clip pages on %s with HTTP or HTTPS",
    async (host) => {
      for (const protocol of ["https", "http"]) {
        for (const path of [
          `/watch?v=${VIDEO_IDS[0]}&list=example`,
          `/shorts/${VIDEO_IDS[0]}`,
          `/shorts/${VIDEO_IDS[0]}/`,
          "/clip/clip_123-ABC",
          "/clip/clip_123-ABC/",
        ]) {
          const { record } = harness({ eligible: true });
          const sender = makeSender(VIDEO_IDS[0], `${protocol}://${host}${path}`);
          expect(await record(VIDEO_IDS[0], -1, true, sender)).toEqual({ showPrompt: true });
        }
      }
    },
  );

  test("does not require the optional tab URL to validate a trusted content sender", async () => {
    const { record } = harness({ eligible: true });
    const sender = makeSender();
    delete sender.tab.url;
    expect(await record(VIDEO_IDS[0], -1, true, sender)).toEqual({ showPrompt: true });
  });

  test("accepts a clip without a tab URL but still rejects an invalid underlying video ID", async () => {
    const { local, tracker } = harness({ eligible: true });
    const sender = makeSender(VIDEO_IDS[0], "https://www.youtube.com/clip/clip_123-ABC");
    delete sender.tab.url;
    expect(await tracker.recordAction({ videoId: "invalid", vote: -1, canShow: true }, sender)).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
    expect(await tracker.recordAction({ videoId: VIDEO_IDS[0], vote: -1, canShow: true }, sender)).toEqual({
      showPrompt: true,
    });
  });

  test.each([
    "https://www.youtube.com/clip/different_clip",
    `https://www.youtube.com/watch?v=${VIDEO_IDS[0]}`,
    "https://www.youtube.com/clip/",
  ])("rejects a clip sender when the tab URL is stale or invalid: %s", async (tabUrl) => {
    const { local, record } = harness({ eligible: true });
    const sender = makeSender(VIDEO_IDS[0], "https://www.youtube.com/clip/current_clip");
    sender.tab.url = tabUrl;
    expect(await record(VIDEO_IDS[0], -1, true, sender)).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
  });

  test.each([
    ["external sender", (sender) => ({ ...sender, id: "another-extension" })],
    ["missing sender", () => undefined],
    ["nested frame", (sender) => ({ ...sender, frameId: 1 })],
    ["missing frame", (sender) => ({ ...sender, frameId: undefined })],
    ["private tab", (sender) => ({ ...sender, tab: { ...sender.tab, incognito: true } })],
    ["unknown privacy", (sender) => ({ ...sender, tab: { ...sender.tab, incognito: undefined } })],
    ["missing tab", (sender) => ({ ...sender, tab: undefined })],
    ["missing tab ID", (sender) => ({ ...sender, tab: { ...sender.tab, id: undefined } })],
    ["stale sender video", (sender) => ({ ...sender, url: `https://www.youtube.com/watch?v=${VIDEO_IDS[1]}` })],
    [
      "stale tab video",
      (sender) => ({ ...sender, tab: { ...sender.tab, url: `https://www.youtube.com/shorts/${VIDEO_IDS[1]}` } }),
    ],
    ["untrusted tab URL", (sender) => ({ ...sender, tab: { ...sender.tab, url: "https://example.com/" } })],
  ])("rejects %s before reading storage", async (_, makeInvalidSender) => {
    const { local, tracker } = harness({ eligible: true });
    expect(
      await tracker.recordAction({ videoId: VIDEO_IDS[0], vote: -1, canShow: true }, makeInvalidSender(makeSender())),
    ).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
    expect(local.set).not.toHaveBeenCalled();
  });

  test.each([
    "https://www.youtube.com/",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=video000002",
    "https://www.youtube.com/embed/video000001",
    "https://www.youtube.com/shorts/video000001/extra",
    "https://www.youtube.com/clip",
    "https://www.youtube.com/clip/",
    "https://www.youtube.com/clip//",
    "https://www.youtube.com/clip/valid_clip/extra",
    "https://www.youtube.com/clip/invalid!clip",
    "https://www.youtube.com/clip/invalid%2Fclip",
    "https://music.youtube.com/watch?v=video000001",
    "https://www.youtube.com.example.com/watch?v=video000001",
    "https://example.com/watch?v=video000001",
    "file://www.youtube.com/watch?v=video000001",
    "javascript:alert(1)",
    "invalid URL",
  ])("rejects unsupported or stale page %s", async (url) => {
    const { local, record } = harness({ eligible: true });
    expect(await record(VIDEO_IDS[0], -1, true, makeSender(VIDEO_IDS[0], url))).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
  });

  test.each([
    undefined,
    {},
    { manifest_version: 2, background: { scripts: ["ryd.background.js"] } },
    { manifest_version: 3, background: { scripts: ["ryd.background.js"] } },
    { manifest_version: 3, background: { service_worker: "" } },
    {
      manifest_version: 3,
      background: { service_worker: "ryd.background.js" },
      browser_specific_settings: { gecko: {} },
    },
  ])("does not track non-Chrome manifest %p", async (manifest) => {
    const { api, local, record } = harness({ eligible: true });
    api.runtime.getManifest.mockReturnValue(manifest);
    expect(await record(VIDEO_IDS[0])).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
  });

  test("does not track in a private extension context", async () => {
    const { api, local, record } = harness();
    api.extension = { inIncognitoContext: true };
    expect(await record(VIDEO_IDS[0])).toEqual(NO_PROMPT);
    expect(local.get).not.toHaveBeenCalled();
  });

  test("a failed read does not show a prompt or block a queued later action", async () => {
    const { data, local, record } = harness({ eligible: true });
    const read = deferred();
    local.get.mockImplementationOnce(async () => await read.promise);
    const first = record(VIDEO_IDS[0]);
    const second = record(VIDEO_IDS[1]);
    await flush();
    expect(local.get).toHaveBeenCalledTimes(1);
    read.reject(new Error("Storage unavailable"));
    expect(await first).toEqual(NO_PROMPT);
    expect(await second).toEqual({ showPrompt: true });
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
  });

  test("a failed progress write does not advance persisted eligibility", async () => {
    const { data, local, record } = harness({ videoIds: VIDEO_IDS.slice(0, 4) });
    local.set.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await record(VIDEO_IDS[4])).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ videoIds: VIDEO_IDS.slice(0, 4) });
    expect(await record(VIDEO_IDS[4])).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    expect(await record(VIDEO_IDS[4])).toEqual({ showPrompt: true });
  });

  test("a failed claim write suppresses queued and later attempts for this worker", async () => {
    const { data, local, record } = harness({ eligible: true });
    local.set.mockRejectedValueOnce(new Error("Storage unavailable"));
    const first = record(VIDEO_IDS[0]);
    const queued = record(VIDEO_IDS[1]);
    expect(await Promise.all([first, queued])).toEqual([NO_PROMPT, NO_PROMPT]);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    expect(await record(VIDEO_IDS[2])).toEqual(NO_PROMPT);
    expect(local.get).toHaveBeenCalledTimes(1);
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  test("a claim write that does not persist is suppressed by readback and stays consumed for this worker", async () => {
    const { data, local, record } = harness({ eligible: true });
    local.set.mockResolvedValueOnce(undefined);
    const first = record(VIDEO_IDS[0]);
    const queued = record(VIDEO_IDS[1]);
    expect(await Promise.all([first, queued])).toEqual([NO_PROMPT, NO_PROMPT]);
    expect(data[STORAGE_KEY]).toEqual({ eligible: true });
    expect(await record(VIDEO_IDS[2])).toEqual(NO_PROMPT);
    expect(local.get).toHaveBeenCalledTimes(2);
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  test("a failed claim readback suppresses queued attempts and the persisted marker survives restart", async () => {
    const { api, data, local, record } = harness({ eligible: true });
    local.get.mockResolvedValueOnce({ [STORAGE_KEY]: { eligible: true } });
    local.get.mockRejectedValueOnce(new Error("Storage unavailable"));
    const first = record(VIDEO_IDS[0]);
    const queued = record(VIDEO_IDS[1]);
    expect(await Promise.all([first, queued])).toEqual([NO_PROMPT, NO_PROMPT]);
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(await record(VIDEO_IDS[2])).toEqual(NO_PROMPT);
    expect(local.get).toHaveBeenCalledTimes(2);
    expect(local.set).toHaveBeenCalledTimes(1);
    expect(
      await createReviewPromptTracker(api).recordAction(
        { videoId: VIDEO_IDS[3], vote: -1, canShow: true },
        makeSender(VIDEO_IDS[3]),
      ),
    ).toEqual(NO_PROMPT);
  });

  test("malformed claim readback cannot grant display or allow a later retry", async () => {
    const { local, record } = harness({ eligible: true });
    local.get.mockResolvedValueOnce({ [STORAGE_KEY]: { eligible: true } });
    local.get.mockResolvedValueOnce({ [STORAGE_KEY]: { shown: true, eligible: true } });
    expect(await record(VIDEO_IDS[0])).toEqual(NO_PROMPT);
    expect(await record(VIDEO_IDS[1])).toEqual(NO_PROMPT);
    expect(local.get).toHaveBeenCalledTimes(2);
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  test("a confirmed claim remains consumed after the UI response is lost and the worker restarts", async () => {
    const { api, data, record } = harness({ eligible: true });
    await record(VIDEO_IDS[0]);
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(
      await createReviewPromptTracker(api).recordAction(
        { videoId: VIDEO_IDS[1], vote: -1, canShow: true },
        makeSender(VIDEO_IDS[1]),
      ),
    ).toEqual(NO_PROMPT);
  });

  test("an ambiguous write that persisted before failing is never displayed after restart", async () => {
    const { api, data, local, record } = harness({ eligible: true });
    local.set.mockImplementationOnce(async (values) => {
      Object.assign(data, clone(values));
      throw new Error("Response unavailable");
    });
    expect(await record(VIDEO_IDS[0])).toEqual(NO_PROMPT);
    expect(data[STORAGE_KEY]).toEqual({ shown: true });
    expect(
      await createReviewPromptTracker(api).recordAction(
        { videoId: VIDEO_IDS[1], vote: -1, canShow: true },
        makeSender(VIDEO_IDS[1]),
      ),
    ).toEqual(NO_PROMPT);
  });

  test("unavailable APIs fail closed without throwing", async () => {
    for (const api of [
      undefined,
      {},
      {
        runtime: {
          getManifest: () => {
            throw new Error("Unavailable");
          },
        },
      },
    ]) {
      expect(
        await createReviewPromptTracker(api).recordAction(
          { videoId: VIDEO_IDS[0], vote: -1, canShow: true },
          makeSender(),
        ),
      ).toEqual(NO_PROMPT);
    }
    const { api } = harness({ eligible: true });
    delete api.storage;
    expect(
      await createReviewPromptTracker(api).recordAction(
        { videoId: VIDEO_IDS[0], vote: -1, canShow: true },
        makeSender(),
      ),
    ).toEqual(NO_PROMPT);
  });
});
