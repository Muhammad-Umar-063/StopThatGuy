import type { JunctionBranch, Pose, RouteProgress, Vec3 } from "@stopthatguy/shared";
import { poseOnRoute } from "./geometry.js";
import type { WorldIndex } from "./world-index.js";

export interface Polyline {
  points: readonly Vec3[];
  cumulativeM: readonly number[];
  lengthM: number;
}

export function makePolyline(points: readonly Vec3[]): Polyline {
  const copied: Vec3[] = [];
  for (const p of points) {
    const previous = copied[copied.length - 1];
    if (!previous || Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z) > 1e-10) copied.push({ ...p });
  }
  if (copied.length === 1) copied.push({ ...copied[0]! });
  const cumulativeM = [0];
  for (let i = 1; i < copied.length; i++) {
    const a = copied[i - 1]!;
    const b = copied[i]!;
    cumulativeM.push(cumulativeM[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  if (copied.length < 2) throw new RangeError("A movement path needs at least two points");
  return { points: copied, cumulativeM, lengthM: cumulativeM[cumulativeM.length - 1]! };
}

export function samplePath(path: Polyline, distanceM: number): Pose {
  const distance = Math.max(0, Math.min(path.lengthM, distanceM));
  let i = 1;
  while (i < path.points.length - 1 && (path.cumulativeM[i]! <= distance || path.cumulativeM[i]! === path.cumulativeM[i - 1]!)) i++;
  const a = path.points[i - 1]!;
  const b = path.points[i]!;
  const length = path.cumulativeM[i]! - path.cumulativeM[i - 1]!;
  const fraction = length > 0 ? (distance - path.cumulativeM[i - 1]!) / length : 0;
  return {
    position: { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, z: a.z + (b.z - a.z) * fraction },
    yaw: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** Nearest centerline distance, used to attach authored turn curves to their outgoing edge. */
export function projectDistance(world: WorldIndex, edgeId: RouteProgress["edgeId"], point: Vec3): number {
  const indexed = world.edges.get(edgeId);
  if (!indexed) throw new RangeError(`Unknown edge ${edgeId}`);
  let nearest = Infinity;
  let distanceM = 0;
  const points = indexed.edge.centerline;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSquared)) : 0;
    const error = (point.x - a.x - dx * fraction) ** 2 + (point.y - a.y - dy * fraction) ** 2 + (point.z - a.z - dz * fraction) ** 2;
    if (error < nearest) {
      nearest = error;
      distanceM = Math.min(indexed.edge.lengthM, indexed.cumulativeM[i - 1]! + Math.sqrt(lengthSquared) * fraction);
    }
  }
  return distanceM;
}

export function nearestLane(offsets: readonly number[], offsetM: number): number {
  let index = 0;
  for (let i = 1; i < offsets.length; i++) {
    if (Math.abs(offsets[i]! - offsetM) < Math.abs(offsets[index]! - offsetM)) index = i;
  }
  return index;
}

/** Branch connector retains authored turn geometry and smoothly joins the chosen outgoing lane. */
export function branchPath(world: WorldIndex, route: RouteProgress, branch: JunctionBranch): { path: Polyline; target: RouteProgress } {
  const outgoing = world.edges.get(branch.toEdgeId)?.edge;
  if (!outgoing) throw new RangeError(`Unknown branch edge ${branch.toEdgeId}`);
  const from = poseOnRoute(world, route);
  const last = branch.turnPath[branch.turnPath.length - 1];
  const distanceM = last ? projectDistance(world, outgoing.id, last) : 0;
  const center = poseOnRoute(world, { edgeId: outgoing.id, distanceM, laneIndex: 0, lateralOffsetM: 0 });
  const anchor = last ?? from.position;
  const projectedOffset = (anchor.x - center.position.x) * Math.cos(center.yaw) - (anchor.z - center.position.z) * Math.sin(center.yaw);
  const laneIndex = nearestLane(outgoing.laneOffsetsM, projectedOffset);
  const target: RouteProgress = { edgeId: outgoing.id, distanceM, laneIndex, lateralOffsetM: outgoing.laneOffsetsM[laneIndex]! };
  const end = poseOnRoute(world, target);
  const points = [from.position, ...remainingCurve(from, branch.turnPath), end.position];
  return { path: makePolyline(points), target };
}

/** A late press joins the unpassed curve instead of reversing to its incoming anchor. */
function remainingCurve(from: Pose, points: readonly Vec3[]): readonly Vec3[] {
  if (points.length === 0) return points;
  const ahead = (p: Vec3) => (p.x - from.position.x) * Math.sin(from.yaw) + (p.z - from.position.z) * Math.cos(from.yaw);
  if (ahead(points[0]!) >= 0) return points;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const start = ahead(a), end = ahead(b);
    if (end >= 0) {
      const fraction = -start / (end - start);
      return [{ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, z: a.z + (b.z - a.z) * fraction }, ...points.slice(i)];
    }
  }
  // The apex of a turnaround is already behind us. Join its outgoing anchor,
  // which necessarily points back down the road, without retracing the whole U.
  return points.slice(-1);
}
