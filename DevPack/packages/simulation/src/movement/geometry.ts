import type { Pose, RouteProgress, Vec3 } from "@stopthatguy/shared";
import type { WorldIndex } from "./world-index.js";

/**
 * World pose for a route position (shared geometry.ts convention: left-handed, +Y up, meters,
 * yaw 0 = +Z, forward = (sin yaw, 0, cos yaw), right of travel = (cos yaw, 0, -sin yaw)).
 *
 * The point is interpolated along the centerline polyline at `distanceM` (clamped to the polyline),
 * yaw follows the horizontal direction of the containing segment, and the point is then offset
 * by a continuous mitered lateral basis. Shared vertex offsets prevent lane teleports
 * at bends. Very sharp/reversing corners bound the miter to twice lane width.
 * Height comes from the centerline.
 */
export function poseOnRoute(world: WorldIndex, route: RouteProgress): Pose {
  const indexed = world.edges.get(route.edgeId);
  if (!indexed) throw new RangeError(`unknown edge ${route.edgeId}`);
  const { edge, cumulativeM } = indexed;
  const points = edge.centerline;
  const total = cumulativeM[cumulativeM.length - 1] ?? 0;
  const distance = Math.min(Math.max(route.distanceM, 0), total);

  // First segment whose end reaches `distance`, skipping zero-length segments where possible.
  let i = 1;
  while (i < points.length - 1 && (cumulativeM[i]! < distance || cumulativeM[i]! === cumulativeM[i - 1]!)) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const segmentLength = cumulativeM[i]! - cumulativeM[i - 1]!;
  const t = segmentLength > 0 ? (distance - cumulativeM[i - 1]!) / segmentLength : 0;

  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const startRight = vertexRight(points, i - 1);
  const endRight = vertexRight(points, i);
  const rightX = startRight.x + (endRight.x - startRight.x) * t;
  const rightZ = startRight.z + (endRight.z - startRight.z) * t;
  return {
    position: {
      x: a.x + (b.x - a.x) * t + rightX * route.lateralOffsetM,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t + rightZ * route.lateralOffsetM,
    },
    yaw,
  };
}

function vertexRight(points: readonly Vec3[], index: number): { x: number; z: number } {
  const at = points[index]!;
  let before = index - 1;
  let after = index + 1;
  while (before >= 0 && Math.hypot(at.x - points[before]!.x, at.z - points[before]!.z) < 1e-9) before--;
  while (after < points.length && Math.hypot(points[after]!.x - at.x, points[after]!.z - at.z) < 1e-9) after++;
  const normal = (a: Vec3, b: Vec3) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    return { x: (b.z - a.z) / length, z: -(b.x - a.x) / length };
  };
  const incoming = before >= 0 ? normal(points[before]!, at) : null;
  const outgoing = after < points.length ? normal(at, points[after]!) : null;
  if (!incoming || !outgoing) return incoming ?? outgoing ?? { x: 1, z: 0 };
  const denominator = 1 + incoming.x * outgoing.x + incoming.z * outgoing.z;
  if (denominator < 1e-9) return { x: 0, z: 0 };
  const x = (incoming.x + outgoing.x) / denominator, z = (incoming.z + outgoing.z) / denominator;
  const scale = Math.min(1, 2 / Math.hypot(x, z));
  return { x: x * scale, z: z * scale };
}
