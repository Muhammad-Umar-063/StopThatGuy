import type { DirectionalOption, LegalActions } from "@stopthatguy/shared";
import { sweepBody } from "../collision/index.js";
import { poseOnRoute } from "./geometry.js";
import { copyMovementMemory, type MovementContext, type MovementKernel, type MovementState } from "./kernel.js";
import { integrateSpeed } from "./kinematics.js";
import { planBranch, traverse, travelMode } from "./traversal.js";

const NONE: DirectionalOption = { kind: "none" };
export const movementBody = (context: MovementContext) => ({
  radiusM: context.tuning.movement.bodyRadiusM,
  heightM: context.tuning.movement.bodyHeightM,
  skinM: context.tuning.movement.collisionSkinM,
});

/** The same eligibility function drives both cues and authoritative steering. */
function direction(current: MovementState, side: "left" | "right", context: MovementContext): DirectionalOption {
  if (current.motion?.turn) return NONE;
  const { world, tuning } = context;
  const edge = world.edges.get(current.route.edgeId)!.edge;
  if (!edge.allowedModes.includes(travelMode(current))) return NONE;
  const junction = world.junctionsByFromEdge.get(edge.id);
  if (junction) {
    const distance = current.route.distanceM;
    const lookahead = Math.min(tuning.junction.approachWindowMaxM,
      Math.max(tuning.junction.approachWindowMinM, current.speedMps * tuning.junction.approachTimeMs / 1000));
    const start = Math.max(junction.window.startM, junction.window.endM - lookahead);
    const early = distance < start && context.allowEarlyTurnBuffer === true && current.speedMps > 0
      && start - distance <= current.speedMps * Math.min(250, tuning.junction.turnInputBufferMs) / 1000;
    if ((distance >= start || early) && distance <= junction.window.endM) {
      const branch = junction.branches.find((b) => b.side === side && planBranch(world, current, b, movementBody(context)) !== null);
      if (branch) return { kind: "turn", junctionId: junction.id, toEdgeId: branch.toEdgeId,
        label: world.edges.get(branch.toEdgeId)!.edge.label, ...(early ? { earlyBuffer: true } : {}) };
    }
  }
  // A second press cannot stack a lane transition or replace a buffered press.
  if (current.motion?.laneShift || current.motion?.bufferedTurn) return NONE;
  const laneIndex = current.route.laneIndex + (side === "left" ? -1 : 1);
  const offset = edge.laneOffsetsM[laneIndex];
  if (offset === undefined) return NONE;
  const from = poseOnRoute(world, current.route).position;
  const to = poseOnRoute(world, { ...current.route, laneIndex, lateralOffsetM: offset }).position;
  return sweepBody(from, to, world.world.colliders, movementBody(context)).fraction === 1
    ? { kind: "laneChange", toLaneIndex: laneIndex } : NONE;
}

export function queryRoadActions(current: MovementState, context: MovementContext): LegalActions {
  return {
    left: direction(current, "left", context), right: direction(current, "right", context),
    canSprint: current.locomotion === "onFoot" && current.stamina > 0 && !current.motion?.sprintExhausted,
    interact: null, canCapture: false, canSabotage: false,
  };
}

export const roadMovementKernel: MovementKernel = (current, input, context) => {
  const state: MovementState = { ...current, route: { ...current.route }, motion: copyMovementMemory(current.motion) };
  const motion = state.motion!;
  const { tuning, world, dtMs } = context;
  const config = tuning.movement;
  if (!input.sprintHeld) motion.sprintExhausted = false;

  const startTurn = (option: Extract<DirectionalOption, { kind: "turn" }>) => {
    const junction = world.junctionsByFromEdge.get(state.route.edgeId)!;
    const branch = junction.branches.find((b) => b.toEdgeId === option.toEdgeId)!;
    const plan = planBranch(world, state, branch, movementBody(context));
    if (plan) {
      motion.turn = { ...plan, junctionId: junction.id, distanceM: 0 };
      motion.laneShift = null;
      motion.bufferedTurn = null;
    }
  };
  // Expiration is measured in simulation time, separate from the cue lookahead.
  if (!context.allowEarlyTurnBuffer) motion.bufferedTurn = null;
  if (motion.bufferedTurn) {
    const buffered = motion.bufferedTurn;
    const options = queryRoadActions(state, { ...context, allowEarlyTurnBuffer: false });
    const eligible = [options.left, options.right].find((o) => o.kind === "turn"
      && o.junctionId === buffered.junctionId && o.toEdgeId === buffered.toEdgeId);
    if (eligible?.kind === "turn" && buffered.remainingMs >= -1e-8) startTurn(eligible);
    else {
      buffered.remainingMs -= dtMs;
      if (buffered.remainingMs < -1e-8 || !context.allowEarlyTurnBuffer) motion.bufferedTurn = null;
    }
  }
  if (!motion.turn && !motion.bufferedTurn && input.leftPressed !== input.rightPressed) {
    const option = direction(state, input.leftPressed ? "left" : "right", context);
    if (option.kind === "turn") {
      if (option.earlyBuffer) motion.bufferedTurn = { junctionId: option.junctionId, toEdgeId: option.toEdgeId,
        remainingMs: Math.min(250, tuning.junction.turnInputBufferMs) - dtMs };
      else startTurn(option);
    } else if (option.kind === "laneChange") {
      motion.laneShift = { fromOffsetM: state.route.lateralOffsetM, elapsedMs: 0 };
      state.route.laneIndex = option.toLaneIndex;
    }
  }

  const wantsSprint = state.locomotion === "onFoot" && input.forwardHeld && !input.brakeHeld
    && input.sprintHeld && !motion.sprintExhausted && state.stamina > 0;
  const sprintMs = wantsSprint ? Math.min(dtMs, state.stamina / config.sprintStaminaPerSecond * 1000) : 0;
  const speedLimit = world.edges.get(state.route.edgeId)!.edge.speedLimitMps ?? Infinity;
  let distanceM = 0;
  const accelerate = (ms: number, sprint: boolean) => {
    if (ms <= 0) return;
    const modeSpeed = state.locomotion === "onFoot" ? (sprint ? config.sprintSpeedMps : config.runSpeedMps)
      : state.locomotion === "bicycle" ? tuning.vehicles.bicycleSpeedMps : tuning.vehicles.scooterSpeedMps;
    const target = input.brakeHeld || !input.forwardHeld ? 0 : Math.min(modeSpeed, speedLimit);
    const rate = input.brakeHeld ? config.brakeMps2 : target > state.speedMps ? config.accelerationMps2 : config.coastMps2;
    const next = integrateSpeed(state.speedMps, target, rate, ms / 1000);
    state.speedMps = next.speedMps;
    distanceM += next.distanceM;
  };
  accelerate(sprintMs, true);
  if (sprintMs > 0) {
    state.stamina = Math.max(0, state.stamina - sprintMs * config.sprintStaminaPerSecond / 1000);
    motion.staminaRecoveryMs = 0;
    if (state.stamina < 1e-8) { state.stamina = 0; motion.sprintExhausted = true; }
  }
  const restingMs = dtMs - sprintMs;
  accelerate(restingMs, false);
  const beforeRecovery = Math.max(0, motion.staminaRecoveryMs - config.staminaRecoveryDelayMs);
  motion.staminaRecoveryMs += restingMs;
  const recoveryMs = Math.max(0, motion.staminaRecoveryMs - config.staminaRecoveryDelayMs) - beforeRecovery;
  state.stamina = Math.min(config.staminaMax, state.stamina + recoveryMs * config.staminaRecoveryPerSecond / 1000);
  // Saturating this timer keeps long-running matches numerically bounded.
  motion.staminaRecoveryMs = Math.min(config.staminaRecoveryDelayMs, motion.staminaRecoveryMs);

  let offset = state.route.lateralOffsetM;
  if (motion.laneShift) {
    motion.laneShift.elapsedMs = Math.min(config.laneShiftMs, motion.laneShift.elapsedMs + dtMs);
    const target = world.edges.get(state.route.edgeId)!.edge.laneOffsetsM[state.route.laneIndex]!;
    offset = motion.laneShift.fromOffsetM + (target - motion.laneShift.fromOffsetM) * motion.laneShift.elapsedMs / config.laneShiftMs;
    if (motion.laneShift.elapsedMs >= config.laneShiftMs) motion.laneShift = null;
  }
  const result = traverse(state, distanceM, offset, context, movementBody(context));
  if (result.blocked) result.state.speedMps = 0;
  return { state: result.state, pose: result.pose };
};
