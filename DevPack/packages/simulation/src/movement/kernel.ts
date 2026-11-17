import type { GameTuning, HeldControls, JunctionId, LocomotionState, Pose, RouteProgress } from "@stopthatguy/shared";
import { poseOnRoute } from "./geometry.js";
import type { Polyline } from "./path.js";
import type { WorldIndex } from "./world-index.js";

/**
 * Pure movement interface shared by the authoritative simulation and client prediction (T022).
 * Units: meters, meters/second, milliseconds, stamina points. Rules (road traversal, lane shifts,
 * junction selection, stamina, collision) are implemented by roadMovementKernel.
 */

/** Movement-relevant state of a grounded player (never a passenger). */
export interface MovementState {
  route: RouteProgress;
  /** ≥ 0, along the direction of travel. */
  speedMps: number;
  /** 0..tuning.movement.staminaMax. */
  stamina: number;
  locomotion: Exclude<LocomotionState, "passenger">;
  /** Explicit deterministic state, retained per player by simulation and by a prediction caller. */
  motion?: MovementMemory;
}

/** Transient movement state, not a duplicate of any shared entity or wire record. */
export interface MovementMemory {
  staminaRecoveryMs: number;
  /** Prevents a depleted held sprint from alternating recovery/sprint every tick. Release to reset. */
  sprintExhausted: boolean;
  laneShift: { fromOffsetM: number; elapsedMs: number } | null;
  bufferedTurn: { junctionId: JunctionId; toEdgeId: RouteProgress["edgeId"]; remainingMs: number } | null;
  turn: { junctionId: JunctionId; path: Polyline; distanceM: number; target: RouteProgress } | null;
}

export function copyMovementMemory(memory?: MovementMemory): MovementMemory {
  return {
    staminaRecoveryMs: memory?.staminaRecoveryMs ?? 0,
    sprintExhausted: memory?.sprintExhausted ?? false,
    laneShift: memory?.laneShift ? { ...memory.laneShift } : null,
    bufferedTurn: memory?.bufferedTurn ? { ...memory.bufferedTurn } : null,
    turn: memory?.turn ? {
      ...memory.turn,
      target: { ...memory.turn.target },
      path: { ...memory.turn.path, points: memory.turn.path.points.map((p) => ({ ...p })), cumulativeM: [...memory.turn.path.cumulativeM] },
    } : null,
  };
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
  /** Opt-in only after the UI presents queryRoadActions earlyBuffer cues. Default gameplay leaves this off. */
  allowEarlyTurnBuffer?: boolean;
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

/** Explicit stationary override for fixtures/tests; the default simulation uses roadMovementKernel. */
export const holdPositionKernel: MovementKernel = (current, _input, context) => ({
  state: { route: { ...current.route }, speedMps: 0, stamina: current.stamina, locomotion: current.locomotion },
  pose: poseOnRoute(context.world, current.route),
});
