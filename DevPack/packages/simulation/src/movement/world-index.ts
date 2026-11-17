import type { EdgeId, Junction, RouteEdge, WorldData } from "@stopthatguy/shared";

export interface IndexedEdge {
  edge: RouteEdge;
  /** Distance (m) along the centerline at each centerline point; first is 0. */
  cumulativeM: readonly number[];
}

/** Read-only lookup tables over WorldData, built once per match. Never mutates the world. */
export interface WorldIndex {
  world: WorldData;
  edges: ReadonlyMap<EdgeId, IndexedEdge>;
  junctionsByFromEdge: ReadonlyMap<EdgeId, Junction>;
}

export function indexWorld(world: WorldData): WorldIndex {
  const edges = new Map<EdgeId, IndexedEdge>();
  for (const edge of world.edges) {
    const cumulativeM = [0];
    for (let i = 1; i < edge.centerline.length; i++) {
      const a = edge.centerline[i - 1]!;
      const b = edge.centerline[i]!;
      cumulativeM.push(cumulativeM[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
    }
    edges.set(edge.id, { edge, cumulativeM });
  }
  const junctionsByFromEdge = new Map<EdgeId, Junction>(world.junctions.map((j) => [j.fromEdgeId, j]));
  return { world, edges, junctionsByFromEdge };
}
