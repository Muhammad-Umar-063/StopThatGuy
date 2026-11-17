import type { GameTuning, HeldControls, LocomotionState, Pose, RouteProgress } from "@stopthatguy/shared";
import { poseOnRoute } from "./geometry.js";
import type { WorldIndex } from "./world-index.js";

/**
 * Pure movement interface shared by the authoritative simulation and client prediction (T022).
 * Units: meters, meters/second, milliseconds, stamina points. Rules (road traversal, lane shifts,
 * junction selection, stamina, collision) are implemented by T009 behind this interface.
 */

/** Movement-relevant state of a grounded player (never a passenger). */
export interface MovementState {
  route: RouteProgress;
  /** ≥ 0, along the direction of travel. */
  speedMps: number;
  /** 0..tuning.movement.staminaMax. */
  stamina: number;
  locomotion: Exclude<LocomotionState, "passenger">;
}

/** Control intent for one step. left/rightPressed are new edge presses in this step (each applied once). */
export interface MovementInput extends HeldControls {
  leftPressed: boolean;
  rightPressed: boolean;
}

export interface MovementContext {
  world: WorldIndex;
  tuning: GameTuning;
  /** Duration of the fixed step in milliseconds. */
  dtMs: number;
}

export interface MovementResult {
  /** Next state: a new object. */
  state: MovementState;
  /** World pose of the next state. */
  pose: Pose;
}

/**
 * Must be deterministic and side-effect free: no clocks, randomness or I/O; must not mutate its
 * arguments; returns new objects. The simulation rejects results with non-finite or out-of-range values.
 */
export type MovementKernel = (
  current: Readonly<MovementState>,
  input: Readonly<MovementInput>,
  context: Readonly<MovementContext>,
) => MovementResult;

/** T003 placeholder used until T009: the player stays where they are, at speed 0. */
export const holdPositionKernel: MovementKernel = (current, _input, context) => ({
  state: { route: { ...current.route }, speedMps: 0, stamina: current.stamina, locomotion: current.locomotion },
  pose: poseOnRoute(context.world, current.route),
});
