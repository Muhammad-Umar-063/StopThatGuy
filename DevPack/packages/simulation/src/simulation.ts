import type { Simulation } from "@stopthatguy/shared";
import { type MovementKernel } from "./movement/kernel.js";
import { roadMovementKernel } from "./movement/road.js";
import { createInitialState, readSerializableState, toInternal, type SimulationState } from "./state.js";
import { collectEvents, queryLegalActions, stepState } from "./step.js";

export interface SimulationOptions {
  /** Movement rules. Defaults to roadMovementKernel. Custom kernels have conservative movement cues; capture still uses authoritative poses. */
  movement?: MovementKernel;
}

/** Builds the Simulation contract implementation. Server and client prediction must use the same kernel. */
export function createSimulation(options: SimulationOptions = {}): Simulation<SimulationState> {
  const movement = options.movement ?? roadMovementKernel;
  return Object.freeze({
    createInitialState,
    step: (state: SimulationState, inputs: Parameters<Simulation<SimulationState>["step"]>[1], fixedDeltaMs: number) =>
      stepState(toInternal(state), inputs, fixedDeltaMs, movement),
    queryLegalActions: (state: SimulationState, playerId: Parameters<Simulation<SimulationState>["queryLegalActions"]>[1]) =>
      queryLegalActions(state, playerId, movement === roadMovementKernel),
    collectEvents,
    readSerializableState,
  });
}
