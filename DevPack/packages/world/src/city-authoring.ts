// Construction helpers for the authored city, evaluated once into plain WorldData.
// These are not runtime routing or movement rules.
import { brandId, type BranchSide, type EdgeId, type Junction, type JunctionBranch, type JunctionId,
  type NodeId, type RouteEdge, type SectorId, type TravelMode, type Vec3 } from "@stopthatguy/shared";

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const length = (points: readonly Vec3[]): number => points.slice(1).reduce((sum, b, i) => {
  const a = points[i]!;
  return sum + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}, 0);

export function pair(name: string, from: NodeId, to: NodeId, points: Vec3[], sectorId: SectorId,
  label: string, modes: TravelMode[], lanes: number[]): [RouteEdge, RouteEdge] {
  const edge = (suffix: string, a: NodeId, b: NodeId, centerline: Vec3[]): RouteEdge => ({
    id: brandId<EdgeId>(`city-e-${name}-${suffix}`), from: a, to: b, centerline,
    lengthM: length(centerline), sectorId, label, allowedModes: [...modes], laneOffsetsM: [...lanes], speedLimitMps: null,
  });
  return [edge("out", from, to, points), edge("back", to, from, [...points].reverse().map(p => ({ ...p })))];
}

function tangent(edge: RouteEdge, end: boolean): number {
  const points = edge.centerline;
  const a = points[end ? points.length - 2 : 0]!, b = points[end ? points.length - 1 : 1]!;
  return Math.atan2(b.x - a.x, b.z - a.z);
}

// Authored corners attach 3 m from the node along the first/last segment, including its height.
// Roads are straight; the two foot lanes have flat approaches longer than this anchor distance.
function anchor(edge: RouteEdge, end: boolean): Vec3 {
  const points = edge.centerline;
  const a = points[end ? points.length - 1 : 0]!, b = points[end ? points.length - 2 : 1]!;
  const t = 3 / Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

/** At most three non-returning branches per approach. Always provide a default continuation. */
export function cityJunctions(edges: RouteEdge[]): Junction[] {
  return edges.map(incoming => {
    const options = edges.filter(e => e.from === incoming.to && e.to !== incoming.from).map(outgoing => {
      const angle = Math.atan2(Math.sin(tangent(outgoing, false) - tangent(incoming, true)),
        Math.cos(tangent(outgoing, false) - tangent(incoming, true)));
      return { outgoing, angle };
    });
    if (options.length === 0 || options.length > 3) throw new Error(`Invalid city intersection at ${incoming.id}`);
    // Straight when available; at a corner/T, the shallowest legal road is the signed default bend.
    // Prefer a road over stairs, so a wheeled traveller never automatically enters a foot branch.
    options.sort((a, b) => Number(b.outgoing.allowedModes.includes("scooter")) - Number(a.outgoing.allowedModes.includes("scooter"))
      || Math.abs(a.angle) - Math.abs(b.angle) || a.angle - b.angle);
    const branches: JunctionBranch[] = options.map(({ outgoing, angle }, i) => {
      const side: BranchSide = i === 0 ? "forward" : angle < 0 ? "left" : "right";
      const modes = incoming.allowedModes.filter(m => outgoing.allowedModes.includes(m));
      const a = anchor(incoming, true), c = anchor(outgoing, false), node = incoming.centerline.at(-1)!;
      // A quadratic corner sampled into the contract's polyline, with continuous end heights.
      const turnPath = Math.abs(angle) < 1e-9 ? [] : [a, ...[0.25, 0.5, 0.75].map(t => v(
        (1 - t) ** 2 * a.x + 2 * t * (1 - t) * node.x + t * t * c.x,
        (1 - t) ** 2 * a.y + 2 * t * (1 - t) * node.y + t * t * c.y,
        (1 - t) ** 2 * a.z + 2 * t * (1 - t) * node.z + t * t * c.z)), c];
      return { side, toEdgeId: outgoing.id, allowedModes: modes, turnPath };
    });
    if (new Set(branches.map(b => b.side)).size !== branches.length || branches.some(b => b.allowedModes.length === 0)) {
      throw new Error(`Ambiguous city branches at ${incoming.id}`);
    }
    return { id: brandId<JunctionId>(`city-j-${incoming.id.slice(7)}`), nodeId: incoming.to, fromEdgeId: incoming.id,
      window: { startM: incoming.lengthM - 8, endM: incoming.lengthM }, branches };
  });
}

export function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
