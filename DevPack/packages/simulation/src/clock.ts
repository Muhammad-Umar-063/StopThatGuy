import type { GameTuning } from "@stopthatguy/shared";

/**
 * Fixed-step timing helpers. The simulation never reads a clock: callers measure elapsed time
 * (server: a monotonic clock; client: requestAnimationFrame timestamps) and decide how many steps to run.
 */

/** Tolerance when comparing a caller-supplied step duration with the configured one. */
export const FIXED_DELTA_TOLERANCE_MS = 1e-6;

/** Default bound on steps run for one elapsed-time sample (≈167 ms at 30 Hz). */
export const DEFAULT_MAX_CATCH_UP_STEPS = 5;

/** Milliseconds per tick: 1000 / tuning.timing.simulationHz. */
export function getFixedDeltaMs(tuning: GameTuning): number {
  const hz = tuning.timing.simulationHz;
  if (!Number.isFinite(hz) || hz <= 0) throw new RangeError("tuning.timing.simulationHz must be a positive number");
  return 1000 / hz;
}

/** Converts a duration to whole ticks, rounded to the nearest tick. */
export function msToTicks(ms: number, tuning: GameTuning): number {
  return Math.round((ms * tuning.timing.simulationHz) / 1000);
}

export function isConfiguredFixedDelta(deltaMs: number, tuning: GameTuning): boolean {
  return Number.isFinite(deltaMs) && deltaMs > 0 && Math.abs(deltaMs - getFixedDeltaMs(tuning)) <= FIXED_DELTA_TOLERANCE_MS;
}

/** Explicit accumulator state owned by the caller (one per running match). */
export interface FixedStepClock {
  /** Elapsed time not yet consumed by a step; always 0 ≤ accumulatorMs < fixedDeltaMs after an advance. */
  accumulatorMs: number;
}

export interface ClockAdvance {
  /** Steps the caller should run now (0..maxSteps). */
  steps: number;
  /** Whole steps of elapsed time discarded because they exceeded maxSteps; log as tick overrun. */
  droppedMs: number;
}

export function createFixedStepClock(): FixedStepClock {
  return { accumulatorMs: 0 };
}

/**
 * Adds measured elapsed time and returns how many fixed steps to run. At most `maxSteps` are returned;
 * whole steps beyond that are dropped (reported in droppedMs), so after a pause or stall simulated time
 * falls behind wall time instead of spiraling into ever larger catch-up work. The sub-step remainder
 * carries over to the next call. Non-finite or negative elapsed time throws RangeError without changes.
 */
export function advanceFixedStepClock(
  clock: FixedStepClock,
  elapsedMs: number,
  fixedDeltaMs: number,
  maxSteps: number = DEFAULT_MAX_CATCH_UP_STEPS,
): ClockAdvance {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError("elapsedMs must be finite and ≥ 0");
  if (!Number.isFinite(fixedDeltaMs) || fixedDeltaMs <= 0) throw new RangeError("fixedDeltaMs must be finite and > 0");
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError("maxSteps must be an integer ≥ 1");

  let pending = clock.accumulatorMs + elapsedMs;
  // The small epsilon absorbs binary rounding (e.g. 1000 ms at 30 Hz must be exactly 30 steps).
  const available = Math.floor(pending / fixedDeltaMs + 1e-9);
  const steps = Math.min(available, maxSteps);
  pending -= steps * fixedDeltaMs;

  let droppedMs = 0;
  if (available > steps) {
    droppedMs = (available - steps) * fixedDeltaMs;
    pending -= droppedMs;
  }
  clock.accumulatorMs = pending > 1e-9 ? pending : 0;
  return { steps, droppedMs };
}
