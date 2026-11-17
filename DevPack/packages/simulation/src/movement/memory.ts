import type { RouteProgress } from "@stopthatguy/shared";
import type { MovementContext, MovementMemory } from "./kernel.js";

/** Check private state too: a valid public pose must never hide a poisoned next tick. */
export function validMovementMemory(memory: MovementMemory | undefined, context: MovementContext): boolean {
  if (!memory) return true; // Older custom kernels may omit transient state.
  const finiteNonnegative = (n: number) => Number.isFinite(n) && n >= 0;
  const routeValid = (route: RouteProgress) => {
    const edge = context.world.edges.get(route.edgeId)?.edge;
    return edge !== undefined && finiteNonnegative(route.distanceM) && route.distanceM <= edge.lengthM + 1e-6
      && Number.isInteger(route.laneIndex) && route.laneIndex >= 0 && route.laneIndex < edge.laneOffsetsM.length
      && Number.isFinite(route.lateralOffsetM);
  };
  if (!finiteNonnegative(memory.staminaRecoveryMs) || typeof memory.sprintExhausted !== "boolean") return false;
  if (memory.laneShift && (!Number.isFinite(memory.laneShift.fromOffsetM)
    || !finiteNonnegative(memory.laneShift.elapsedMs) || memory.laneShift.elapsedMs > context.tuning.movement.laneShiftMs)) return false;
  if (memory.bufferedTurn && (!Number.isFinite(memory.bufferedTurn.remainingMs)
    || memory.bufferedTurn.remainingMs < -context.dtMs - 1e-8 || memory.bufferedTurn.remainingMs > context.tuning.junction.turnInputBufferMs
    || !context.world.world.junctions.some((j) => j.id === memory.bufferedTurn!.junctionId
      && j.branches.some((b) => b.toEdgeId === memory.bufferedTurn!.toEdgeId)))) return false;
  if (memory.turn) {
    const { path, distanceM, target, junctionId } = memory.turn;
    if (!routeValid(target) || !context.world.world.junctions.some((j) => j.id === junctionId
      && j.branches.some((b) => b.toEdgeId === target.edgeId)) || !finiteNonnegative(distanceM)
      || !finiteNonnegative(path.lengthM) || distanceM > path.lengthM + 1e-8
      || path.points.length < 2 || path.points.length !== path.cumulativeM.length || path.cumulativeM[0] !== 0) return false;
    let length = 0;
    for (let i = 0; i < path.points.length; i++) {
      const point = path.points[i]!;
      if (![point.x, point.y, point.z].every(Number.isFinite)) return false;
      if (i > 0) {
        const prior = path.points[i - 1]!;
        length += Math.hypot(point.x - prior.x, point.y - prior.y, point.z - prior.z);
      }
      if (!Number.isFinite(path.cumulativeM[i]) || Math.abs(path.cumulativeM[i]! - length) > 1e-6) return false;
    }
    if (Math.abs(length - path.lengthM) > 1e-6) return false;
  }
  return true;
}
