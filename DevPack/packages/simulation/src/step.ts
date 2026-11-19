import {
  EDGE_ACTION_KINDS,
  PROTOCOL_LIMITS,
  type EdgeAction,
  type GameEvent,
  type LegalActions,
  type PlayerId,
  type ValidatedPlayerInput,
} from "@stopthatguy/shared";
import { advanceCaptures } from "./capture/capture.js";
import { capturePositions, clearCaptureMotion, recordCaptureMotion } from "./capture/motion.js";
import { captureFailure } from "./capture/eligibility.js";
import { advancePhaseClock, resolveEscapeAndTimeout } from "./match/progression.js";
import { advanceRobber } from "./robber/robber.js";
import { FIXED_DELTA_TOLERANCE_MS } from "./clock.js";
import { clonePlain } from "./copy.js";
import { copyMovementMemory, type MovementInput, type MovementKernel, type MovementResult, type MovementState } from "./movement/kernel.js";
import { validMovementMemory } from "./movement/memory.js";
import { queryRoadActions } from "./movement/road.js";
import { toInternal, type InternalState, type SimulationState } from "./state.js";

interface TickIntent extends MovementInput {
  sequence: number;
  /** Actions with IDs above the player's lastProcessedActionId, ascending. */
  newActions: readonly EdgeAction[];
}

const NEUTRAL_INPUT: MovementInput = Object.freeze({
  forwardHeld: false,
  brakeHeld: false,
  sprintHeld: false,
  interactHeld: false,
  leftPressed: false,
  rightPressed: false,
});

/**
 * Advances exactly one fixed tick. This function is the single place that orders a tick
 * (GAMEPLAY.md "Capture and simultaneous events"); later tasks add their stage at its marked slot.
 *
 *   0. phase clock — countdown → intro → chase (emits matchStarted)
 *   1. inputs — acknowledge sequences, consume new edge actions exactly once
 *   2. movement/collision — chase only, grounded active players and server-controlled robber
 *   3. action effects: mount, borrow, lift, shove — T021/T025, not implemented
 *   4. theft, police, arrest — T029/T033, not implemented
 *   5. eligible capture start/cancellation/completion
 *   6. escape / timeout → one immutable result
 *
 * The delta and inputs are validated before any mutation: on RangeError the state is unchanged.
 * An invalid MovementKernel result is a programming error: step throws Error after stages 0–1
 * (no player is moved) and the match state should be discarded.
 */
export function stepState(s: InternalState, inputs: readonly ValidatedPlayerInput[], fixedDeltaMs: number, movement: MovementKernel): void {
  if (!Number.isFinite(fixedDeltaMs) || fixedDeltaMs <= 0 || Math.abs(fixedDeltaMs - s.fixedDeltaMs) > FIXED_DELTA_TOLERANCE_MS) {
    throw new RangeError(`fixedDeltaMs must be ${s.fixedDeltaMs} (1000 / simulationHz)`);
  }
  const intents = prepareInputs(s, inputs);

  s.match.tick += 1;
  advancePhaseClock(s);
  applyInputs(s, intents);
  if (s.match.phase !== "chase") {
    clearCaptureMotion(s);
    advanceCaptures(s, new Set());
    return;
  }
  const beforeMotion = capturePositions(s);
  moveGroundedPlayers(s, intents, movement);
  advanceRobber(s, s.tuning.robber.transitionMs);
  recordCaptureMotion(s, beforeMotion);
  // Stages 3–4 remain reserved for action effects and police/arrest.
  advanceCaptures(s, new Set([...intents].filter(([, intent]) =>
    intent.newActions.some(action => action.kind === "capture")).map(([id]) => id)));
  resolveEscapeAndTimeout(s);
}

function isUint32(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= PROTOCOL_LIMITS.maxUint32;
}

/** Checks adapter-supplied inputs (programming errors throw) and derives this tick's intents without mutating. */
function prepareInputs(s: InternalState, inputs: readonly ValidatedPlayerInput[]): Map<PlayerId, TickIntent> {
  const intents = new Map<PlayerId, TickIntent>();
  for (const input of inputs) {
    const player = s.playersById.get(input.playerId);
    if (!player) throw new RangeError(`input for unknown player ${input.playerId}`);
    if (intents.has(input.playerId)) throw new RangeError(`more than one input for player ${input.playerId} in one step`);
    if (!isUint32(input.sequence)) throw new RangeError("input sequence must be a uint32");
    if (![input.forwardHeld, input.brakeHeld, input.sprintHeld, input.interactHeld].every(v => typeof v === "boolean")
      || !Array.isArray(input.actions) || input.actions.length > PROTOCOL_LIMITS.maxActionsPerInputFrame) {
      throw new RangeError("invalid held controls or action count");
    }
    let previousId = 0;
    for (const action of input.actions) {
      if (!action || !EDGE_ACTION_KINDS.includes(action.kind)) throw new RangeError("unknown action kind");
      if (!isUint32(action.id) || action.id <= previousId) throw new RangeError("action IDs must be ascending positive uint32 values");
      previousId = action.id;
    }
    // Arrested, forfeited and spectating players are neutralized but still acknowledged.
    const active = player.participation === "active" && player.connection === "connected";
    const newActions = input.actions.filter((a) => a.id > player.lastProcessedActionId);
    intents.set(input.playerId, {
      sequence: input.sequence,
      newActions,
      forwardHeld: active && input.forwardHeld,
      brakeHeld: active && input.brakeHeld,
      sprintHeld: active && input.sprintHeld,
      interactHeld: active && input.interactHeld,
      leftPressed: active && newActions.some((a) => a.kind === "left"),
      rightPressed: active && newActions.some((a) => a.kind === "right"),
    });
  }
  return intents;
}

// Stage 1. Edge-action effects (interact, capture, sabotage, turns) are applied by later stages/tasks;
// here every new action is consumed exactly once, in every phase.
function applyInputs(s: InternalState, intents: ReadonlyMap<PlayerId, TickIntent>): void {
  for (const [playerId, intent] of intents) {
    const player = s.playersById.get(playerId)!;
    player.lastProcessedInputSequence = intent.sequence;
    const last = intent.newActions[intent.newActions.length - 1];
    if (last) player.lastProcessedActionId = last.id;
  }
}

// Stage 2. All results are computed and checked before any player is updated.
function moveGroundedPlayers(s: InternalState, intents: ReadonlyMap<PlayerId, TickIntent>, movement: MovementKernel): void {
  const context = { world: s.world, tuning: s.tuning, dtMs: s.fixedDeltaMs };
  const updates: [(typeof s.players)[number], MovementResult][] = [];
  for (const player of s.players) {
    if (player.participation !== "active" || player.locomotion === "passenger" || player.route === null) continue;
    const intent = intents.get(player.id);
    const current: MovementState = {
      route: { ...player.route },
      speedMps: player.speedMps,
      stamina: player.stamina,
      locomotion: player.locomotion,
      motion: copyMovementMemory(s.movementByPlayer.get(player.id)),
    };
    const input: MovementInput = intent
      ? {
          forwardHeld: intent.forwardHeld,
          brakeHeld: intent.brakeHeld,
          sprintHeld: intent.sprintHeld,
          interactHeld: intent.interactHeld,
          leftPressed: intent.leftPressed,
          rightPressed: intent.rightPressed,
        }
      : { ...NEUTRAL_INPUT };
    const result = movement(current, input, context);
    checkMovementResult(s, current, result);
    updates.push([player, clonePlain(result)]);
  }
  for (const [player, result] of updates) {
    player.route = clonePlain(result.state.route);
    player.speedMps = result.state.speedMps;
    player.stamina = result.state.stamina;
    player.pose = clonePlain(result.pose);
    s.movementByPlayer.set(player.id, copyMovementMemory(result.state.motion));
  }
}

function checkMovementResult(s: InternalState, current: MovementState, result: MovementResult): void {
  const { route, speedMps, stamina, locomotion } = result.state;
  const edge = s.world.edges.get(route.edgeId)?.edge;
  const { position, yaw } = result.pose;
  const valid =
    edge !== undefined &&
    Number.isFinite(route.distanceM) &&
    route.distanceM >= 0 &&
    route.distanceM <= edge.lengthM + 1e-6 &&
    Number.isInteger(route.laneIndex) &&
    route.laneIndex >= 0 &&
    route.laneIndex < edge.laneOffsetsM.length &&
    Number.isFinite(route.lateralOffsetM) &&
    Number.isFinite(speedMps) &&
    speedMps >= 0 &&
    Number.isFinite(stamina) &&
    stamina >= 0 &&
    stamina <= s.tuning.movement.staminaMax &&
    locomotion === current.locomotion &&
    [position.x, position.y, position.z, yaw].every(Number.isFinite);
  if (!valid || !validMovementMemory(result.state.motion, { world: s.world, tuning: s.tuning, dtMs: s.fixedDeltaMs })) throw new Error("movement kernel returned an invalid or out-of-range result");
}

/** Rules arrive with T009 (turns/lanes, sprint), T017 (capture), T021 (vehicles) and T025 (sabotage). */
const NOTHING_AVAILABLE: Readonly<LegalActions> = Object.freeze<LegalActions>({
  left: { kind: "none" },
  right: { kind: "none" },
  canSprint: false,
  interact: null,
  canCapture: false,
  canSabotage: false,
});

export function queryLegalActions(state: SimulationState, playerId: PlayerId, roadRules = true): LegalActions {
  const s = toInternal(state);
  const player = s.playersById.get(playerId);
  if (!player) throw new RangeError(`unknown player ${playerId}`);
  if (s.match.phase !== "chase" || player.connection !== "connected" || player.participation !== "active"
    || player.locomotion === "passenger" || !player.route) return clonePlain(NOTHING_AVAILABLE);
  const legal = roadRules ? queryRoadActions({ route: player.route, speedMps: player.speedMps, stamina: player.stamina,
    locomotion: player.locomotion, motion: s.movementByPlayer.get(playerId)! },
    { world: s.world, tuning: s.tuning, dtMs: s.fixedDeltaMs }) : clonePlain(NOTHING_AVAILABLE);
  return clonePlain({ ...legal, canCapture: !s.captureAttempts.has(playerId) && captureFailure(s, player) === null });
}

export function collectEvents(state: SimulationState): GameEvent[] {
  const s = toInternal(state);
  const drained = s.pendingEvents.map((event) => clonePlain(event));
  s.pendingEvents.length = 0;
  return drained;
}
