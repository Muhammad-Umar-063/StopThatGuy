import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_TUNING } from "@stopthatguy/shared";
import {
  DEFAULT_MAX_CATCH_UP_STEPS,
  advanceFixedStepClock,
  cloneRng,
  createFixedStepClock,
  createRng,
  getFixedDeltaMs,
  msToTicks,
  nextFloat,
  nextInt,
  nextUint32,
} from "../src/index.js";

describe("seeded RNG", () => {
  // Reference values from an independent Python implementation of sfc32 with the same seeding.
  const REFERENCE: [number, number[]][] = [
    [0, [548183886, 1097162541, 2219297441, 1664216021, 3479288465]],
    [1, [1130556604, 2591592147, 3014952990, 960850752, 2734082507]],
    [20261116, [3362048263, 2435495363, 4191659859, 2911207449, 2375635841]],
    [0xffffffff, [2246433216, 2156899173, 2040853526, 3823104220, 1358629326]],
  ];

  for (const [seed, expected] of REFERENCE) {
    test(`seed ${seed} matches the reference sequence`, () => {
      const rng = createRng(seed);
      assert.deepEqual(Array.from({ length: expected.length }, () => nextUint32(rng)), expected);
    });
  }

  test("a cloned state continues identically and independently", () => {
    const rng = createRng(7);
    nextUint32(rng);
    const copy = cloneRng(rng);
    const fromOriginal = Array.from({ length: 10 }, () => nextUint32(rng));
    assert.deepEqual(Array.from({ length: 10 }, () => nextUint32(copy)), fromOriginal);
  });

  test("nextInt is in range and roughly uniform; nextFloat is in [0, 1)", () => {
    const rng = createRng(99);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[nextInt(rng, 6)]! += 1;
    for (const count of counts) assert.ok(Math.abs(count - 10_000) < 500, `bucket count ${count}`);
    for (let i = 0; i < 10_000; i++) {
      const f = nextFloat(rng);
      assert.ok(f >= 0 && f < 1);
    }
    assert.equal(nextInt(rng, 1), 0);
  });

  test("rejects invalid seeds and ranges", () => {
    for (const seed of [-1, 1.5, 2 ** 32, Number.NaN]) assert.throws(() => createRng(seed), RangeError);
    for (const max of [0, -3, 2.5, 2 ** 32 + 1]) assert.throws(() => nextInt(createRng(1), max), RangeError);
  });
});

describe("tick conversion", () => {
  test("30 Hz defaults give the documented tick counts", () => {
    assert.equal(getFixedDeltaMs(DEFAULT_TUNING), 1000 / 30);
    assert.equal(msToTicks(DEFAULT_TUNING.timing.countdownMs, DEFAULT_TUNING), 90);
    assert.equal(msToTicks(DEFAULT_TUNING.timing.introMs, DEFAULT_TUNING), 240);
    assert.equal(msToTicks(DEFAULT_TUNING.timing.chaseTimeLimitMs, DEFAULT_TUNING), 10_800);
  });
});

describe("fixed-step clock", () => {
  const dt = 1000 / 30;

  test("one second of 60 Hz frames yields exactly 30 steps", () => {
    const clock = createFixedStepClock();
    let steps = 0;
    for (let frame = 0; frame < 60; frame++) steps += advanceFixedStepClock(clock, 1000 / 60, dt).steps;
    assert.equal(steps, 30);
    assert.ok(clock.accumulatorMs < 1e-6);
  });

  test("carries the sub-step remainder", () => {
    const clock = createFixedStepClock();
    assert.deepEqual(advanceFixedStepClock(clock, 50, dt), { steps: 1, droppedMs: 0 });
    assert.ok(Math.abs(clock.accumulatorMs - (50 - dt)) < 1e-9);
    assert.equal(advanceFixedStepClock(clock, 20, dt).steps, 1);
    assert.ok(Math.abs(clock.accumulatorMs - (70 - 2 * dt)) < 1e-9);
    assert.equal(advanceFixedStepClock(clock, 0, dt).steps, 0);
  });

  test("bounds catch-up after a stall and reports dropped time", () => {
    const clock = createFixedStepClock();
    const result = advanceFixedStepClock(clock, 1010, dt);
    assert.equal(result.steps, DEFAULT_MAX_CATCH_UP_STEPS);
    assert.ok(Math.abs(result.droppedMs - (30 - DEFAULT_MAX_CATCH_UP_STEPS) * dt) < 1e-9);
    assert.ok(Math.abs(clock.accumulatorMs - 10) < 1e-9, `remainder ${clock.accumulatorMs}`);
    assert.equal(advanceFixedStepClock(clock, 10 * 60_000, dt, 3).steps, 3);
  });

  test("rejects invalid elapsed time without changing the clock", () => {
    const clock = createFixedStepClock();
    advanceFixedStepClock(clock, 10, dt);
    for (const elapsed of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      assert.throws(() => advanceFixedStepClock(clock, elapsed, dt), RangeError);
      assert.equal(clock.accumulatorMs, 10);
    }
    assert.throws(() => advanceFixedStepClock(clock, 10, 0), RangeError);
    assert.throws(() => advanceFixedStepClock(clock, 10, dt, 0), RangeError);
  });
});
