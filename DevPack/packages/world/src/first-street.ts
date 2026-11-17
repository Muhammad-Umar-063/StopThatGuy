// First street blockout (T005): versioned world data for the opening slice of an adapted Baixa street.
// BLOCKOUT ONLY: temporary gameplay routes and collision proxies. Final art, movement rules and camera
// behaviour belong to later tasks. Units are meters. Coordinates follow shared geometry.ts:
// left-handed, +Y up, yaw 0 = +Z. Here +Z is north and +X is east.
//
//                          n-hilltop (0, 3, 120)   hill top: vehicle U-turn; stairs/terrace for foot
//                         ╱│
//          terrace path  ╱ │  e-main-n2 / e-main-s2: three lanes, climbing 3 m over 60 m (5 %)
//          (foot only)  ╱  │
//               stairs ╱   │
//   n-alley-end ●─────────● n-cross (0, 0, 60): T-junction
//   (-40, 0, 60)   alley  │ (single lane; foot and bicycle; U-turn at its west end)
//                         │  e-main-n1 / e-main-s1: three lanes, flat
//                         │  spawns: six players, the robber and two bicycles at the bike stand
//                         ● n-square (0, 0, 0): bank square, dead end with a U-turn
//
// Two-way streets use one directed edge per direction over the same centerline. A lane is a gameplay
// travel band (offsets −3, 0, +3 m, left to right of travel), not a painted traffic lane.
import {
  WORLD_SCHEMA_VERSION,
  brandId,
  type ColliderId,
  type ColliderPrimitive,
  type EdgeId,
  type Junction,
  type JunctionBranch,
  type JunctionId,
  type NodeId,
  type RouteEdge,
  type SectorId,
  type Spawn,
  type SpawnId,
  type TravelMode,
  type Vec3,
  type WorldData,
} from "@stopthatguy/shared";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const STREET: TravelMode[] = ["foot", "bicycle", "scooter"];
const ALLEY: TravelMode[] = ["foot", "bicycle"];
const FOOT: TravelMode[] = ["foot"];
const THREE_LANES = [-3, 0, 3];
const SINGLE_LANE = [0];
/** Turn/trigger window at the end of each incoming edge; within the tuning's 5–8 m approach range. */
const WINDOW_M = 8;

export const FIRST_STREET_IDS = {
  sectors: {
    square: brandId<SectorId>("s-square"),
    hill: brandId<SectorId>("s-hill"),
    alley: brandId<SectorId>("s-alley"),
  },
  nodes: {
    square: brandId<NodeId>("n-square"),
    cross: brandId<NodeId>("n-cross"),
    alleyEnd: brandId<NodeId>("n-alley-end"),
    hilltop: brandId<NodeId>("n-hilltop"),
  },
  edges: {
    mainNorth1: brandId<EdgeId>("e-main-n1"),
    mainSouth1: brandId<EdgeId>("e-main-s1"),
    mainNorth2: brandId<EdgeId>("e-main-n2"),
    mainSouth2: brandId<EdgeId>("e-main-s2"),
    alleyWest: brandId<EdgeId>("e-alley-w"),
    alleyEast: brandId<EdgeId>("e-alley-e"),
    stepsUp: brandId<EdgeId>("e-steps-up"),
    stepsDown: brandId<EdgeId>("e-steps-down"),
  },
  junctions: {
    squareUTurn: brandId<JunctionId>("j-square-uturn"),
    crossFromSouth: brandId<JunctionId>("j-cross-from-south"),
    crossFromNorth: brandId<JunctionId>("j-cross-from-north"),
    crossFromAlley: brandId<JunctionId>("j-cross-from-alley"),
    alleyEnd: brandId<JunctionId>("j-alley-end"),
    stepsBottom: brandId<JunctionId>("j-steps-bottom"),
    hilltopFromStreet: brandId<JunctionId>("j-hilltop-from-street"),
    hilltopFromSteps: brandId<JunctionId>("j-hilltop-from-steps"),
  },
} as const;

const S = FIRST_STREET_IDS.sectors;
const N = FIRST_STREET_IDS.nodes;
const E = FIRST_STREET_IDS.edges;
const J = FIRST_STREET_IDS.junctions;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function polylineLength(points: readonly Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

function edge(id: EdgeId, from: NodeId, to: NodeId, centerline: Vec3[], laneOffsetsM: number[], allowedModes: TravelMode[], label: string | null, sectorId: SectorId): RouteEdge {
  return { id, from, to, centerline, lengthM: round3(polylineLength(centerline)), laneOffsetsM, allowedModes, speedLimitMps: null, label, sectorId };
}

const reversed = (points: Vec3[]) => [...points].reverse().map((p) => ({ ...p }));

// Centerlines.
const MAIN_SOUTH: Vec3[] = [v(0, 0, 0), v(0, 0, 60)];
const MAIN_HILL: Vec3[] = [v(0, 0, 60), v(0, 3, 120)];
const ALLEY_LINE: Vec3[] = [v(0, 0, 60), v(-40, 0, 60)];
// Alley end → short flat landing → stairs climbing 3 m over 8 m (37.5 %) → terrace footpath to the hill top.
const STEPS_LINE: Vec3[] = [v(-40, 0, 60), v(-40, 0, 66), v(-40, 3, 74), v(-20, 3, 100), v(0, 3, 120)];

const EDGES: RouteEdge[] = [
  edge(E.mainNorth1, N.square, N.cross, MAIN_SOUTH, THREE_LANES, STREET, "Rua do Banco (blockout)", S.square),
  edge(E.mainSouth1, N.cross, N.square, reversed(MAIN_SOUTH), THREE_LANES, STREET, "Rua do Banco (blockout)", S.square),
  edge(E.mainNorth2, N.cross, N.hilltop, MAIN_HILL, THREE_LANES, STREET, "Calçada do Banco (blockout)", S.hill),
  edge(E.mainSouth2, N.hilltop, N.cross, reversed(MAIN_HILL), THREE_LANES, STREET, "Calçada do Banco (blockout)", S.hill),
  edge(E.alleyWest, N.cross, N.alleyEnd, ALLEY_LINE, SINGLE_LANE, ALLEY, "Travessa do Arco (blockout)", S.alley),
  edge(E.alleyEast, N.alleyEnd, N.cross, reversed(ALLEY_LINE), SINGLE_LANE, ALLEY, "Travessa do Arco (blockout)", S.alley),
  edge(E.stepsUp, N.alleyEnd, N.hilltop, STEPS_LINE, SINGLE_LANE, FOOT, "Escadinhas do Arco (blockout)", S.alley),
  edge(E.stepsDown, N.hilltop, N.alleyEnd, reversed(STEPS_LINE), SINGLE_LANE, FOOT, "Escadinhas do Arco (blockout)", S.alley),
];

const lengthOf = (id: EdgeId) => EDGES.find((e) => e.id === id)!.lengthM;

function junction(id: JunctionId, nodeId: NodeId, fromEdgeId: EdgeId, branches: JunctionBranch[]): Junction {
  const endM = lengthOf(fromEdgeId);
  return { id, nodeId, fromEdgeId, window: { startM: round3(endM - WINDOW_M), endM }, branches };
}

const branch = (side: JunctionBranch["side"], toEdgeId: EdgeId, allowedModes: TravelMode[], turnPath: Vec3[]): JunctionBranch => ({
  side,
  toEdgeId,
  turnPath,
  allowedModes,
});

// Sides are relative to the incoming direction: northbound left = west; southbound right = west;
// eastbound left = north; westbound right = north. "forward" is the default continuation, including U-turns.
const JUNCTIONS: Junction[] = [
  junction(J.squareUTurn, N.square, E.mainSouth1, [branch("forward", E.mainNorth1, STREET, [v(-1.5, 0, 4), v(0, 0, 1), v(1.5, 0, 4)])]),
  junction(J.crossFromSouth, N.cross, E.mainNorth1, [
    branch("left", E.alleyWest, ALLEY, [v(0, 0, 57), v(-1, 0, 59.5), v(-3, 0, 60)]),
    branch("forward", E.mainNorth2, STREET, []),
  ]),
  junction(J.crossFromNorth, N.cross, E.mainSouth2, [
    branch("right", E.alleyWest, ALLEY, [v(0, 0.15, 63), v(-1, 0.025, 60.5), v(-3, 0, 60)]),
    branch("forward", E.mainSouth1, STREET, []),
  ]),
  junction(J.crossFromAlley, N.cross, E.alleyEast, [
    branch("left", E.mainNorth2, ALLEY, [v(-3, 0, 60), v(-1, 0, 60.5), v(0, 0.05, 61)]),
    branch("right", E.mainSouth1, ALLEY, [v(-3, 0, 60), v(-1, 0, 59.5), v(0, 0, 58)]),
  ]),
  junction(J.alleyEnd, N.alleyEnd, E.alleyWest, [
    branch("right", E.stepsUp, FOOT, [v(-37, 0, 60), v(-39.5, 0, 61), v(-40, 0, 63)]),
    branch("forward", E.alleyEast, ALLEY, [v(-36, 0, 60), v(-39.5, 0, 60.8), v(-36, 0, 60)]),
  ]),
  junction(J.stepsBottom, N.alleyEnd, E.stepsDown, [branch("left", E.alleyEast, FOOT, [v(-40, 0, 63), v(-39.5, 0, 61), v(-37, 0, 60)])]),
  junction(J.hilltopFromStreet, N.hilltop, E.mainNorth2, [
    branch("left", E.stepsDown, FOOT, [v(0, 2.85, 117), v(-0.5, 3, 119.5), v(-3, 3, 117)]),
    branch("forward", E.mainSouth2, STREET, [v(1.5, 2.85, 117), v(0, 3, 119.5), v(-1.5, 2.85, 117)]),
  ]),
  junction(J.hilltopFromSteps, N.hilltop, E.stepsUp, [branch("right", E.mainSouth2, FOOT, [v(-3, 3, 117), v(-0.5, 3, 119.5), v(0, 2.85, 117)])]),
];

const box = (id: string, center: Vec3, halfExtents: Vec3): ColliderPrimitive => ({ id: brandId<ColliderId>(id), shape: "box", center, halfExtents, yaw: 0 });

// Temporary collision proxies (buildings, bike stand, lamp). The street band is x ∈ [−4.5, 4.5].
const COLLIDERS: ColliderPrimitive[] = [
  box("c-bank", v(-15, 6, 15), v(8, 6, 12)),
  box("c-block-west-mid", v(-15, 6, 43.5), v(8, 6, 12.5)),
  box("c-block-east-south", v(15, 6, 29.5), v(8, 6, 26.5)),
  box("c-block-east-north", v(15, 6, 91), v(8, 7, 27)),
  box("c-alley-house", v(-24, 4, 65.5), v(12, 4, 2.5)),
  box("c-bike-stand", v(5.8, 0.5, 32), v(0.6, 0.5, 3)),
  { id: brandId<ColliderId>("c-lamp-1"), shape: "cylinder", center: v(-5, 2, 45), radiusM: 0.15, heightM: 4 },
];

const spawn = (id: string, distanceM: number, laneIndex: number) => ({
  id: brandId<SpawnId>(id),
  placement: { edgeId: E.mainNorth1, distanceM, laneIndex },
});

// Bank square, facing north: two rows of three, the robber ahead, bicycles at the stand.
const SPAWNS: Spawn[] = [
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...spawn(`sp-player-${i + 1}`, i < 3 ? 6 : 10, i % 3), kind: "player" as const })),
  { ...spawn("sp-robber", 22, 1), kind: "robber" },
  { ...spawn("sp-bicycle-1", 30, 2), kind: "vehicle", vehicleType: "bicycle", access: "public" },
  { ...spawn("sp-bicycle-2", 34, 2), kind: "vehicle", vehicleType: "bicycle", access: "public" },
];

/** The first playable street (T005). Robber escape routes, exits and police arrive with later tasks. */
export const FIRST_STREET_WORLD: WorldData = deepFreeze<WorldData>({
  schemaVersion: WORLD_SCHEMA_VERSION,
  worldVersion: "first-street-1",
  sectors: [
    { id: S.square, label: "Bank square and Rua do Banco (blockout)" },
    { id: S.hill, label: "Hill street (blockout)" },
    { id: S.alley, label: "Alley, stairs and terrace (blockout)" },
  ],
  nodes: [
    { id: N.square, position: v(0, 0, 0), kind: "deadEnd", sectorId: S.square },
    { id: N.cross, position: v(0, 0, 60), kind: "junction", sectorId: S.square },
    { id: N.alleyEnd, position: v(-40, 0, 60), kind: "junction", sectorId: S.alley },
    { id: N.hilltop, position: v(0, 3, 120), kind: "junction", sectorId: S.hill },
  ],
  edges: EDGES,
  junctions: JUNCTIONS,
  colliders: COLLIDERS,
  zones: [],
  spawns: SPAWNS,
  routes: [],
  cameraObstructions: [box("co-bank-arcade", v(-7.5, 3, 15), v(0.5, 3, 10))],
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
