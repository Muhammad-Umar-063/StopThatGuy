import type { GameTuning } from "./config.js";
import type { AuthoritativeSnapshot } from "./entities.js";
import type { GameEvent } from "./events.js";
import type { EdgeId, InteractableId, JunctionId, PlayerId, VehicleId } from "./ids.js";
import type { EdgeAction, HeldControls } from "./input.js";
import type { MatchMode } from "./states.js";
import type { WorldData } from "./world.js";

/**
 * Boundary between the server room adapter and packages/simulation (T003).
 * The simulation is pure TypeScript: no Babylon.js, browser globals, Colyseus or I/O.
 * Method names may be refined once by T003 through the coordinator.
 */

export interface SimulationParticipant {
  playerId: PlayerId;
  nickname: string;
  joinOrder: number;
}

export interface SimulationSetup {
  tuning: GameTuning;
  world: WorldData;
  /** uint32; identical setup + inputs must give identical outcomes. */
  seed: number;
  mode: MatchMode;
  /** Ordered by joinOrder. */
  participants: readonly SimulationParticipant[];
}

/**
 * Input after server-boundary validation, sequencing and deduplication. Players without fresh input
 * receive NEUTRAL_HELD_CONTROLS and no actions.
 */
export interface ValidatedPlayerInput extends HeldControls {
  playerId: PlayerId;
  /** Only actions not applied before, ascending by ID. */
  actions: readonly EdgeAction[];
}

/** What one left/right press would do now; distinguishes a turn from a lane shift for cues. */
export type DirectionalOption =
  | { kind: "turn"; junctionId: JunctionId; toEdgeId: EdgeId; label: string | null }
  | { kind: "laneChange"; toLaneIndex: number }
  | { kind: "none" };

export type InteractOption =
  | { kind: "mount" | "dismount" | "boardLift" | "exitLift"; vehicleId: VehicleId }
  | { kind: "borrow" | "theft"; interactableId: InteractableId };

/** Result of queryLegalActions: drives HUD cues and must match server-side validation. */
export interface LegalActions {
  left: DirectionalOption;
  right: DirectionalOption;
  canSprint: boolean;
  interact: InteractOption | null;
  canCapture: boolean;
  canSabotage: boolean;
}

export interface Simulation<TState> {
  createInitialState(setup: SimulationSetup): TState;
  /** Advances exactly one fixed step (1000 / tuning.timing.simulationHz ms). Mutates `state`. */
  step(state: TState, inputs: readonly ValidatedPlayerInput[], fixedDeltaMs: number): void;
  queryLegalActions(state: TState, playerId: PlayerId): LegalActions;
  /** Returns and clears events produced since the previous call, in emission order. */
  collectEvents(state: TState): GameEvent[];
  readSerializableState(state: TState): AuthoritativeSnapshot;
}
