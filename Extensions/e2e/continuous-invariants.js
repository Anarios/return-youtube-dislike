function defaultNow() {
  return Date.now();
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function validateTiming({ intervalMs, stableForMs, timeoutMs }) {
  for (const [name, value] of Object.entries({ intervalMs, stableForMs, timeoutMs })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`${name} must be a non-negative finite number.`);
    }
  }
  if (intervalMs === 0) throw new TypeError("intervalMs must be greater than zero.");
  if (stableForMs > timeoutMs) throw new TypeError("stableForMs cannot exceed timeoutMs.");
}

function compactSamples(samples, limit = 12) {
  const selected = samples.length <= limit ? samples : [...samples.slice(0, 3), ...samples.slice(-(limit - 3))];
  return selected.map(({ elapsedMs, ok, value }) => ({ elapsedMs, ok, value }));
}

async function waitForStableInvariant({
  intervalMs = 50,
  isValid,
  label,
  now = defaultNow,
  read,
  sleep = defaultSleep,
  stableForMs = 500,
  timeoutMs = 5_000,
}) {
  if (typeof read !== "function") throw new TypeError("read must be a function.");
  if (typeof isValid !== "function") throw new TypeError("isValid must be a function.");
  if (typeof now !== "function") throw new TypeError("now must be a function.");
  if (typeof sleep !== "function") throw new TypeError("sleep must be a function.");
  if (typeof label !== "string" || label.trim() === "") throw new TypeError("label must be a non-empty string.");
  validateTiming({ intervalMs, stableForMs, timeoutMs });

  const startedAt = now();
  let firstValidMs = null;
  let stableSince = null;
  let invalidSamples = 0;
  const samples = [];

  while (true) {
    const value = await read();
    const sampledAt = now();
    const elapsedMs = sampledAt - startedAt;
    const ok = Boolean(await isValid(value));
    samples.push({ elapsedMs, ok, value });

    if (ok) {
      if (firstValidMs === null) firstValidMs = elapsedMs;
      if (stableSince === null) stableSince = sampledAt;
      if (sampledAt - stableSince >= stableForMs) {
        return {
          elapsedMs,
          firstValidMs,
          invalidSamples,
          sampleCount: samples.length,
          stableForMs: sampledAt - stableSince,
          value,
        };
      }
    } else {
      invalidSamples += 1;
      stableSince = null;
    }

    if (elapsedMs >= timeoutMs) {
      const error = new Error(
        `${label} did not remain valid for ${stableForMs}ms within ${timeoutMs}ms. ` +
          `Samples: ${JSON.stringify(compactSamples(samples))}`,
      );
      error.samples = samples;
      throw error;
    }
    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}

async function assertInvariantContinuously({
  durationMs = 1_000,
  intervalMs = 50,
  isValid,
  label,
  now = defaultNow,
  read,
  sleep = defaultSleep,
}) {
  if (typeof read !== "function") throw new TypeError("read must be a function.");
  if (typeof isValid !== "function") throw new TypeError("isValid must be a function.");
  if (typeof label !== "string" || label.trim() === "") throw new TypeError("label must be a non-empty string.");
  validateTiming({ intervalMs, stableForMs: durationMs, timeoutMs: durationMs });

  const startedAt = now();
  const samples = [];
  while (true) {
    const value = await read();
    const elapsedMs = now() - startedAt;
    const ok = Boolean(await isValid(value));
    samples.push({ elapsedMs, ok, value });
    if (!ok) {
      const error = new Error(
        `${label} became invalid after ${elapsedMs}ms. Samples: ${JSON.stringify(compactSamples(samples))}`,
      );
      error.samples = samples;
      throw error;
    }
    if (elapsedMs >= durationMs) {
      return { elapsedMs, sampleCount: samples.length, value };
    }
    await sleep(Math.min(intervalMs, durationMs - elapsedMs));
  }
}

module.exports = {
  assertInvariantContinuously,
  waitForStableInvariant,
};
