import {
  advanceFixedStepClock, collectRobberDiagnostics, createFixedStepClock, createSimulation, getFixedDeltaMs,
  type RobberDiagnostic, type SimulationState,
} from "@stopthatguy/simulation";
import type { SimulationSetup, ValidatedPlayerInput } from "@stopthatguy/shared";

/** Only the room measures wall time. Both normal and practice use this same simulation. */
export class MatchSimulation {
  private readonly simulation = createSimulation();
  private readonly clock = createFixedStepClock();
  private readonly state: SimulationState;
  private readonly deltaMs: number;

  constructor(setup: SimulationSetup,
    private readonly reportDiagnostic: (diagnostic: RobberDiagnostic) => void = diagnostic => console.warn("[robber]", diagnostic)) {
    this.state = this.simulation.createInitialState(setup);
    this.deltaMs = getFixedDeltaMs(setup.tuning);
    this.drainDiagnostics();
  }

  advance(elapsedMs: number, readInputs: () => readonly ValidatedPlayerInput[] = () => []): number {
    const { steps, droppedMs } = advanceFixedStepClock(this.clock, elapsedMs, this.deltaMs);
    for (let i = 0; i < steps; i++) {
      this.simulation.step(this.state, readInputs(), this.deltaMs);
      this.drainDiagnostics();
    }
    return droppedMs;
  }

  snapshot() { return this.simulation.readSerializableState(this.state); }
  events() { return this.simulation.collectEvents(this.state); }

  private drainDiagnostics(): void {
    for (const diagnostic of collectRobberDiagnostics(this.state)) this.reportDiagnostic(diagnostic);
  }
}
