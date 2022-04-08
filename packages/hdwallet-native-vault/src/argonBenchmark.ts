import { argon2id } from "hash-wasm";

import { crypto, performance } from "./util";

async function argonBenchInner(memorySize: number, iterations: number, now: () => number) {
  const password = await (await crypto).getRandomValues(new Uint8Array(32));
  const salt = await (await crypto).getRandomValues(new Uint8Array(32));
  const start = now();
  await argon2id({
    password,
    salt,
    parallelism: 1,
    memorySize,
    iterations,
    hashLength: 32,
    outputType: "binary",
  });
  return now() - start;
}

export function customNow(now: () => number, roundMs: number, jitter: number): () => number {
  if (jitter) {
    let lastRealNow = 0;
    now = ((thisNow) => () => {
      const realNow = thisNow();
      const nextNow =
        lastRealNow === 0
          ? realNow
          : (() => {
              const elapsed = (realNow - lastRealNow) * (1 + (Math.random() - 0.5) * jitter);
              return lastRealNow + elapsed;
            })();
      lastRealNow = realNow;
      return nextNow;
    })(now);
  }
  if (roundMs) {
    now = (
      (thisNow) => () =>
        Math.round(thisNow() / roundMs) * roundMs
    )(now);
  }
  return now;
}

/**
 * This function benchmarks the current machine to determine how many iterations of single-theaded argon2id can be afforded in a given time budget.
 * The time budget is considered to include only the time spent actually iterating; setup time is proportional to the memory allocation and excluded,
 * though it usually only is a few tens of milliseconds extra.
 *
 *  Benchmarks in Node and the browser show that the error in the final value is typically less than 5%, with
 * @param memorySizeKib The amount of memory used by argon2id; must be at least 8. A higher value provides more defense against ASIC and GPU attacks
 * @param targetTimeMs Desired duration of the key derivation operation
 * @param options Optional parameters primarily useful for testing the benchmark implementation
 * @param options.fineTuning Number of fine-tuning rounds permitted; defaults to 0. Allowing more fine-tuning rounds reduces error.
 * @param options.measureError Calculate the error of the final result by measuring the precise time the recommended number of iterations takes.
 * @param options.now Overrides the timestamp function used to measure durations. Must return a monotonically-increasing number of milliseconds.
 * @param options.roundMs Rounds timestamps to simulate results when a browser rounds performance.now() to prevent fingerprinting.
 * @param options.jitter Introduces random timestamp errors of the specified magnitude. Range 0-1, default 0.
 * @returns
 */
export async function argonBenchmark(
  memorySizeKib: number,
  targetTimeMs: number,
  options: Partial<{
    fineTuning: number;
    measureError: boolean;
    now: () => number;
    roundMs: number;
    jitter: number;
  }> = {}
) {
  const preciseNow = options.now ?? (await performance).now.bind(await performance);
  const overallStart = preciseNow();

  let fineTuning = options.fineTuning ?? 0;
  const measureError = options.measureError ?? false;
  const roundedNow = customNow(preciseNow, options.roundMs ?? 0, options.jitter ?? 0);

  // warm-up wasm module with the minimum-possible parameter values to ensure the module is actually loaded; should take
  // no more than 100ms in the absolute worst case
  const warmupDuration = await argonBenchInner(8, 1, roundedNow);

  // Calculate the minimum time a single iteration of the shortest kind takes; this is later used to calculate the bits
  // of added security. The low memory use ensures that the setup time is negligible.
  const minMsPerIter = await (async () => {
    let minDuration = 0;
    let out = 0;
    for (let i = 1; minDuration === 0; i *= 2) {
      minDuration = await argonBenchInner(8, 1, roundedNow);
      out = minDuration / i;
    }
    return out;
  })();

  let firstDuration = 0;
  let firstI = 0;
  let duration = 0;
  let msPerIteration = 0;
  let setupDuration = 0;
  let i = 0.5; // after the initial i *= 2, this will always be an integer
  while (duration < targetTimeMs + setupDuration) {
    if (msPerIteration === 0) {
      // This ensures that a non-increasing performance.now() implementation won't loop infinitely
      if (i * memorySizeKib > 2 ** 20) break;
      // This happen on the first loop, but also can happen with rounded timestamps
      i *= 2;
    } else {
      const iStep = Math.round((targetTimeMs + setupDuration - duration) / msPerIteration);
      // We don't need fine-tuning if we're dead on
      if (iStep == 0) break;
      // Ensuring each step is at least i large sacrifices accuracy, but limits the benchmark time to no more than 4
      // times the target duration. Additional fine-tuning steps can increase accuracy, but each one adds a possible
      // 2 * targetTimeMs to the worst-case.
      if (Math.abs(iStep) < 0) {
        if (fineTuning <= 0) break;
        fineTuning--;
      }
      i = i + iStep;
    }

    duration = await argonBenchInner(memorySizeKib, i, roundedNow);
    msPerIteration = (duration - setupDuration) / i;
    // We want the the duration of the first *measurable* run (i.e. duration > 0). (Duration can be 0 if timestamps are
    // rounded.)
    if (!firstDuration) {
      firstDuration = duration;
      firstI = i;
    }
    // As we test higher iteration counts, we get a more accurate msPerIteration calculation, leading to
    setupDuration = Math.max(0, firstDuration - msPerIteration * firstI);
  }
  if (msPerIteration === 0) throw new Error("benchmark runs look instantaneous -- is performance.now() working?");

  // Allow no more than i/2 to be shaved off the final time; this limits the damage a significantly outlying final
  // benchmark run can do
  i -= Math.min((duration - (targetTimeMs + setupDuration)) / msPerIteration, i / 2);
  i = Math.ceil(i);

  let error: number | undefined = undefined;
  if (measureError) {
    // bench with recommended iterations to determine precise error; this will obviously take extra time
    const finalDuration = await argonBenchInner(memorySizeKib, i, preciseNow);
    error = Math.abs(finalDuration - (targetTimeMs + setupDuration)) / (targetTimeMs + setupDuration);
  }

  const bits = Math.log2((i * msPerIteration - setupDuration) / minMsPerIter);
  const overallDuration = preciseNow() - overallStart;
  return {
    iterations: i,
    bits,
    error,
    durations: {
      warmup: warmupDuration,
      setup: setupDuration,
      overall: overallDuration,
      msPerIteration,
    },
    options: {
      ...{
        ...options,
        now: undefined,
      },
      memorySizeKib,
      targetTimeMs,
    },
  };
}
