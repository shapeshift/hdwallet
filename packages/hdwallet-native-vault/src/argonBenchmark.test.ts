import { argonBenchmark, customNow } from "./argonBenchmark"
import { performance } from "./util"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe("customNow", () => {
  it("should work", async () => {
    const now = customNow(performance.now.bind(performance), 10, 0.05)
    const start = now()
    await delay(100)
    const duration = now() - start
    expect(duration).toBeGreaterThan(50)
    // This is performance-dependent
    // expect(duration).toBeLessThan(200)
  })
})

describe("argonBenchmark", () => {
  it("should run correctly", async () => {
    const results = await argonBenchmark(32 * 1024, 1000, {
      measureError: true,
      // jitter: 0.10,
      // roundMs: 100,
    })
    console.log(results)
    expect(results).toBeTruthy()
    expect(Number.isSafeInteger(results.iterations)).toBeTruthy()
    expect(results.iterations).toBeGreaterThanOrEqual(1)
    expect(results.error).toBeGreaterThanOrEqual(0)
    expect(results.bits).toBeGreaterThanOrEqual(0)
    // These are performance-dependent
    // expect(results.bits).toBeGreaterThan(5)
    // expect(results.bits).toBeLessThan(15)
    expect(results.durations.overall).toBeGreaterThanOrEqual(0)
    expect(results.durations.setup).toBeGreaterThanOrEqual(0)
    expect(results.durations.warmup).toBeGreaterThanOrEqual(0)
    expect(results.durations.msPerIteration).toBeGreaterThan(0)
  })
})
