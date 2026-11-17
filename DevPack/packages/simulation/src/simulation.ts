import type { Simulation } from "@stopthatguy/shared";
import { holdPositionKernel, type MovementKernel } from "./movement/kernel.js";
import { createInitialState, readSerializableState, toInternal, type SimulationState } from "./state.js";
import { collectEvents, queryLegalActions, stepState } from "./step.js";

export interface SimulationOptions {
  /** Movement rules. Defaults to holdPositionKernel until T009 provides road movement. */
  movement?: MovementKernel;
}

/** Builds the Simulation contract implementation. Server and client prediction must use the same kernel. */
export function createSimulation(options: SimulationOptions = {}): Simulation<SimulationState> {
  const movement = options.movement ?? holdPositionKernel;
  return Object.freeze({
    createInitialState,
    step: (state: SimulationState, inputs: Parameters<Simulation<SimulationState>["step"]>[1], fixedDeltaMs: number) =>
      stepState(toInternal(state), inputs, fixedDeltaMs, movement),
    queryLegalActions,
    collectEvents,
    readSerializableState,
  });
}
