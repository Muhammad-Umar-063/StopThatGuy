import {
  advanceFixedStepClock, createFixedStepClock, createSimulation, getFixedDeltaMs,
  type SimulationState,
} from "@stopthatguy/simulation";
import type { SimulationSetup } from "@stopthatguy/shared";

/** Only the room measures wall time. Both normal and practice use this same simulation. */
export class MatchSimulation {
  private readonly simulation = createSimulation();
  private readonly clock = createFixedStepClock();
  private readonly state: SimulationState;
  private readonly deltaMs: number;

  constructor(setup: SimulationSetup) {
    this.state = this.simulation.createInitialState(setup);
    this.deltaMs = getFixedDeltaMs(setup.tuning);
  }

  advance(elapsedMs: number): number {
    const { steps, droppedMs } = advanceFixedStepClock(this.clock, elapsedMs, this.deltaMs);
    for (let i = 0; i < steps; i++) this.simulation.step(this.state, [], this.deltaMs);
    return droppedMs;
  }

  snapshot() { return this.simulation.readSerializableState(this.state); }
  events() { return this.simulation.collectEvents(this.state); }
}
