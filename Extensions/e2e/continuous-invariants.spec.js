const { assertInvariantContinuously, waitForStableInvariant } = require("./continuous-invariants");

function createClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (milliseconds) => {
      time += milliseconds;
    },
  };
}

describe("continuous browser invariants", () => {
  test("reports readiness latency and requires an uninterrupted stable window", async () => {
    const clock = createClock();
    const values = [false, false, true, true, false, true, true, true];
    let index = 0;

    const result = await waitForStableInvariant({
      intervalMs: 100,
      isValid: Boolean,
      label: "ratio bar",
      now: clock.now,
      read: async () => values[Math.min(index++, values.length - 1)],
      sleep: clock.sleep,
      stableForMs: 200,
      timeoutMs: 1_000,
    });

    expect(result).toMatchObject({
      elapsedMs: 700,
      firstValidMs: 200,
      invalidSamples: 3,
      sampleCount: 8,
      stableForMs: 200,
      value: true,
    });
  });

  test("includes sampled phase evidence when stability never arrives", async () => {
    const clock = createClock();
    let phase = "missing";

    await expect(
      waitForStableInvariant({
        intervalMs: 100,
        isValid: (sample) => sample.phase === "ready",
        label: "destination ownership",
        now: clock.now,
        read: async () => ({ phase: (phase = phase === "missing" ? "ready" : "missing") }),
        sleep: clock.sleep,
        stableForMs: 200,
        timeoutMs: 400,
      }),
    ).rejects.toThrow(/destination ownership.*Samples:.*phase/);
  });

  test("continuous assertion rejects an invalid first sample", async () => {
    const clock = createClock();
    let calls = 0;

    await expect(
      assertInvariantContinuously({
        durationMs: 200,
        intervalMs: 100,
        isValid: Boolean,
        label: "settled watch UI",
        now: clock.now,
        read: async () => calls++ > 0,
        sleep: clock.sleep,
      }),
    ).rejects.toThrow(/settled watch UI became invalid after 0ms/);
  });

  test.each([
    ["negative timeout", { timeoutMs: -1 }],
    ["zero interval", { intervalMs: 0 }],
    ["stable duration beyond timeout", { stableForMs: 101, timeoutMs: 100 }],
  ])("rejects %s", async (_name, timing) => {
    await expect(
      waitForStableInvariant({
        intervalMs: 10,
        isValid: Boolean,
        label: "invalid timing",
        read: async () => true,
        stableForMs: 10,
        timeoutMs: 100,
        ...timing,
      }),
    ).rejects.toThrow();
  });
});
