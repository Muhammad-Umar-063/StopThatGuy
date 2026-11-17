import type { Pose, RouteProgress } from "@stopthatguy/shared";
import type { WorldIndex } from "./world-index.js";

/**
 * World pose for a route position (shared geometry.ts convention: left-handed, +Y up, meters,
 * yaw 0 = +Z, forward = (sin yaw, 0, cos yaw), right of travel = (cos yaw, 0, -sin yaw)).
 *
 * The point is interpolated along the centerline polyline at `distanceM` (clamped to the polyline),
 * yaw follows the horizontal direction of the containing segment, and the point is then offset
 * horizontally by `lateralOffsetM` to the right of travel. Height comes from the centerline.
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
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    position: {
      x: a.x + (b.x - a.x) * t + rightX * route.lateralOffsetM,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t + rightZ * route.lateralOffsetM,
    },
    yaw,
  };
}
