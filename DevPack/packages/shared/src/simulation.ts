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

/** Trusted server data for one match. The simulation never mutates it; invalid setups throw. */
export interface SimulationSetup {
  tuning: GameTuning;
  world: WorldData;
  /** uint32; identical setup + inputs must give identical outcomes. */
  seed: number;
  mode: MatchMode;
  /** Public room code, echoed in MatchRecord.roomCode. */
  roomCode: string;
  /** Any order; the simulation orders players by joinOrder. */
  participants: readonly SimulationParticipant[];
}

/**
 * Input for one player for one step, after server-boundary validation, sequencing and deduplication.
 * The adapter supplies the player's current held controls every step until the input timeout;
 * a player omitted from a step is treated as neutral (no held controls, no actions).
 */
export interface ValidatedPlayerInput extends HeldControls {
  playerId: PlayerId;
  /** Sequence of the input frame these controls came from; echoed as lastProcessedInputSequence. */
  sequence: number;
  /** New actions, ascending by ID. IDs at or below lastProcessedActionId are ignored (applied once). */
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

/** Implemented by packages/simulation (createSimulation). The state type is opaque to callers. */
export interface Simulation<TState> {
  /** Starts a match in the "countdown" phase at tick 0. Lobby and room closing belong to the room. */
  createInitialState(setup: SimulationSetup): TState;
  /**
   * Advances exactly one fixed step. `fixedDeltaMs` must equal 1000 / tuning.timing.simulationHz;
   * any other value (non-finite, ≤ 0 or inconsistent) throws RangeError and leaves the state unchanged.
   */
  step(state: TState, inputs: readonly ValidatedPlayerInput[], fixedDeltaMs: number): void;
  queryLegalActions(state: TState, playerId: PlayerId): LegalActions;
  /** Returns and clears events produced since the previous call, in emission order (fresh copies). */
  collectEvents(state: TState): GameEvent[];
  /** A fresh deep copy; mutating it never affects the simulation. */
  readSerializableState(state: TState): AuthoritativeSnapshot;
}
