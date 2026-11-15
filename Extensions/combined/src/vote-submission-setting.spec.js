describe("vote submission setting", () => {
  let sync;
  let listeners;

  beforeEach(() => {
    jest.resetModules();
    sync = {};
    listeners = [];
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({ ...sync })),
          set: jest.fn((values) => Object.assign(sync, values)),
        },
        onChanged: {
          addListener: jest.fn((listener) => listeners.push(listener)),
          removeListener: jest.fn((listener) => listeners.splice(listeners.indexOf(listener), 1)),
        },
      },
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  const setting = () => require("./vote-submission-setting");

  test.each([
    [true, true],
    [false, false],
    [undefined, false],
    ["true", false],
  ])("a stored value of %p reads as disabled %p", async (stored, disabled) => {
    if (stored !== undefined) sync.disableVoteSubmission = stored;
    await expect(setting().readVoteSubmissionDisabled()).resolves.toBe(disabled);
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(["disableVoteSubmission"], expect.any(Function));
  });

  test("allowing submission turns the switch off", () => {
    sync.disableVoteSubmission = true;
    setting().allowVoteSubmission();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ disableVoteSubmission: false });
  });

  test("only synced switch changes reach the listener, until it unsubscribes", () => {
    const listener = jest.fn();
    const unsubscribe = setting().onVoteSubmissionSettingChanged(listener);
    listeners[0]({ disableVoteSubmission: { newValue: true } }, "local");
    listeners[0]({ hideRydComments: { newValue: true } }, "sync");
    expect(listener).not.toHaveBeenCalled();
    listeners[0]({ disableVoteSubmission: { newValue: true } }, "sync");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(listeners).toHaveLength(0);
  });

  test.each([
    [true, false, true],
    [true, true, false],
    [false, false, false],
    [false, true, false],
  ])("granted %p with the switch on %p counts votes: %p", (granted, submissionDisabled, counted) => {
    expect(setting().votesCounted({ granted, submissionDisabled })).toBe(counted);
  });
});
