import type { JunctionBranch, Pose, RouteProgress, TravelMode } from "@stopthatguy/shared";
import { isPathClear, sweepBody, type CollisionBody } from "../collision/index.js";
import { poseOnRoute } from "./geometry.js";
import { copyMovementMemory, type MovementContext, type MovementState } from "./kernel.js";
import { branchPath, nearestLane, projectDistance, samplePath } from "./path.js";
import type { WorldIndex } from "./world-index.js";

export const travelMode = (state: MovementState): TravelMode => state.locomotion === "onFoot" ? "foot" : state.locomotion;

export function planBranch(world: WorldIndex, state: MovementState, branch: JunctionBranch, body: CollisionBody) {
  const mode = travelMode(state);
  const source = world.edges.get(state.route.edgeId)?.edge;
  const target = world.edges.get(branch.toEdgeId)?.edge;
  if (!source?.allowedModes.includes(mode) || !target?.allowedModes.includes(mode) || !branch.allowedModes.includes(mode)) return null;
  const plan = branchPath(world, state.route, branch);
  return isPathClear(plan.path.points, world.world.colliders, body) ? plan : null;
}

/** Advances only geometry; acceleration, stamina and one-press arbitration are the kernel's jobs. */
export function traverse(
  current: MovementState,
  distanceM: number,
  targetOffsetM: number,
  context: MovementContext,
  body: CollisionBody,
): { state: MovementState; pose: Pose; blocked: boolean } {
  const state: MovementState = { ...current, route: { ...current.route }, motion: copyMovementMemory(current.motion) };
  const motion = state.motion!;
  const { world } = context;
  let remaining = distanceM;
  let pose = motion.turn ? samplePath(motion.turn.path, motion.turn.distanceM) : poseOnRoute(world, state.route);
  // A malformed zero-distance route cycle must not hang a fixed simulation tick.
  for (let crossings = 0; crossings <= world.edges.size; crossings++) {
    if (motion.turn) {
      const turn = motion.turn;
      const end = Math.min(turn.path.lengthM, turn.distanceM + remaining);
      const checkpoints = [...turn.path.cumulativeM.filter((d) => d > turn.distanceM && d < end), end];
      for (const checkpoint of checkpoints) {
        const next = samplePath(turn.path, checkpoint);
        const hit = sweepBody(pose.position, next.position, world.world.colliders, body);
        const travelled = (checkpoint - turn.distanceM) * hit.fraction;
        remaining -= travelled;
        turn.distanceM += travelled;
        pose = samplePath(turn.path, turn.distanceM);
        if (hit.fraction < 1) return { state, pose, blocked: true };
      }
      if (turn.distanceM < turn.path.lengthM - 1e-9) return { state, pose, blocked: false };
      state.route = { ...turn.target };
      motion.turn = null;
      targetOffsetM = state.route.lateralOffsetM;
      pose = poseOnRoute(world, state.route);
      if (remaining <= 1e-9) return { state, pose, blocked: false };
      continue;
    }

    const indexed = world.edges.get(state.route.edgeId)!;
    const edge = indexed.edge;
    if (!edge.allowedModes.includes(travelMode(state))) return { state, pose, blocked: true };
    const junction = world.junctionsByFromEdge.get(edge.id);
    const forward = junction?.branches.find((branch) => branch.side === "forward"
      && branch.allowedModes.includes(travelMode(state)) && world.edges.get(branch.toEdgeId)?.edge.allowedModes.includes(travelMode(state)));
    // Begin a marked end-of-road turnaround at its incoming anchor, rather than
    // running past the curve and then walking backward to its start.
    const anchor = forward?.turnPath[0];
    const endOfTravel = anchor && junction
      ? Math.max(junction.window.startM, projectDistance(world, edge.id, anchor)) : edge.lengthM;
    const endDistance = Math.max(state.route.distanceM, Math.min(endOfTravel, state.route.distanceM + remaining));
    const startRoute = { ...state.route };
    const requested = remaining;
    const checkpoints = [...indexed.cumulativeM.filter((d) => d > startRoute.distanceM && d < endDistance), endDistance];
    for (const checkpoint of checkpoints) {
      const ratio = requested > 0 ? Math.min(1, (checkpoint - startRoute.distanceM) / requested) : 1;
      const candidate: RouteProgress = { ...state.route, distanceM: checkpoint,
        lateralOffsetM: startRoute.lateralOffsetM + (targetOffsetM - startRoute.lateralOffsetM) * ratio };
      const next = poseOnRoute(world, candidate);
      // Interpolated lane offset × interpolated vertex basis is quadratic.
      // Its exact maximum deviation from this chord is at the midpoint. Inflate
      // the sweep by that bound so reconstructing a partial route stays safe.
      const midpoint = poseOnRoute(world, { ...state.route,
        distanceM: (state.route.distanceM + candidate.distanceM) / 2,
        lateralOffsetM: (state.route.lateralOffsetM + candidate.lateralOffsetM) / 2 }).position;
      const deviation = Math.hypot(midpoint.x - (pose.position.x + next.position.x) / 2,
        midpoint.y - (pose.position.y + next.position.y) / 2,
        midpoint.z - (pose.position.z + next.position.z) / 2);
      const hit = sweepBody(pose.position, next.position, world.world.colliders, { ...body, skinM: body.skinM + deviation });
      const travelled = (checkpoint - state.route.distanceM) * hit.fraction;
      state.route.distanceM += travelled;
      state.route.lateralOffsetM += (candidate.lateralOffsetM - state.route.lateralOffsetM) * hit.fraction;
      remaining -= travelled;
      pose = poseOnRoute(world, state.route);
      if (hit.fraction < 1) {
        // Do not keep pushing sideways or teleport to the target lane after contact.
        motion.laneShift = null;
        state.route.laneIndex = nearestLane(edge.laneOffsetsM, state.route.lateralOffsetM);
        return { state, pose, blocked: true };
      }
    }
    if (remaining <= 1e-9) return { state, pose, blocked: false };
    if (!junction || !forward) return { state, pose, blocked: true };
    const plan = planBranch(world, state, forward, body);
    if (!plan) return { state, pose, blocked: true };
    motion.turn = { ...plan, junctionId: junction.id, distanceM: 0 };
    motion.laneShift = null;
    motion.bufferedTurn = null;
  }
  return { state, pose, blocked: true };
}
