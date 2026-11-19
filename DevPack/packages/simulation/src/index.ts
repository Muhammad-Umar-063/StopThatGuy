// @stopthatguy/simulation: authoritative fixed-step rules. Pure TypeScript with no clocks, timers,
// I/O, Babylon.js, browser or Colyseus dependencies. The server room adapter (T006) owns sessions,
// serialization and timing; client prediction imports only "@stopthatguy/simulation/movement".
export { createSimulation, type SimulationOptions } from "./simulation.js";
export type { SimulationState } from "./state.js";
export {
  DEFAULT_MAX_CATCH_UP_STEPS,
  FIXED_DELTA_TOLERANCE_MS,
  advanceFixedStepClock,
  createFixedStepClock,
  getFixedDeltaMs,
  isConfiguredFixedDelta,
  msToTicks,
  type ClockAdvance,
  type FixedStepClock,
} from "./clock.js";
export { cloneRng, createRng, nextFloat, nextInt, nextUint32, type RngState } from "./rng.js";
export * from "./movement/index.js";

export { collectRobberDiagnostics, type RobberDiagnostic } from "./robber/robber.js";

export { forfeitPlayer } from "./results/departure.js";
