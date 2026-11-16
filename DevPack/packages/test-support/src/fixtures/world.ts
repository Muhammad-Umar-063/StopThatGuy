// TEST DATA — a tiny representative world for contract tests and isolated development.
// It is not the game map (T005/T016 author that in packages/world).
//
// Layout (top view, +Z north, +X east; left-handed, so heading north "right" is +X):
//
//   n-west (dead end) ⇄ n-junction ──(hill, y 0→2)──▶ n-east ──stairs (foot only)──▶ n-river (exit)
//                          ▲                              └──── road loop (vehicles) ────▶ n-river
//                       n-bank (spawns)
import {
  brandId,
  WORLD_SCHEMA_VERSION,
  type ColliderId,
  type EdgeId,
  type JunctionId,
  type NodeId,
  type RouteId,
  type SectorId,
  type SpawnId,
  type TravelMode,
  type WorldData,
  type ZoneId,
} from "@stopthatguy/shared";
import { deepFreeze } from "./freeze.js";

const sector = (id: string) => brandId<SectorId>(id);
const node = (id: string) => brandId<NodeId>(id);
const edge = (id: string) => brandId<EdgeId>(id);
const junction = (id: string) => brandId<JunctionId>(id);
const zone = (id: string) => brandId<ZoneId>(id);
const spawn = (id: string) => brandId<SpawnId>(id);
const route = (id: string) => brandId<RouteId>(id);
const collider = (id: string) => brandId<ColliderId>(id);

const ALL_MODES: TravelMode[] = ["foot", "bicycle", "scooter", "lift"];
const TWO_LANES = [-1.5, 1.5];

export const FIXTURE_IDS = {
  sectors: { bank: sector("s-bank"), alley: sector("s-alley"), river: sector("s-river") },
  nodes: {
    bank: node("n-bank"),
    junction: node("n-junction"),
    west: node("n-west"),
    east: node("n-east"),
    river: node("n-river"),
  },
  edges: {
    bankNorth: edge("e-bank-north"),
    junctionWest: edge("e-junction-west"),
    westReturn: edge("e-west-return"),
    junctionEast: edge("e-junction-east"),
    eastStairs: edge("e-east-stairs"),
    eastRoad: edge("e-east-road"),
  },
  junctions: {
    bankNorth: junction("j-bank-north"),
    westDeadEnd: junction("j-west-dead-end"),
    westReturn: junction("j-west-return"),
    east: junction("j-east"),
  },
  zones: {
    shop: zone("z-shop"),
    liftBank: zone("z-lift-bank"),
    liftRiver: zone("z-lift-river"),
    riverEscape: zone("z-river-escape"),
  },
  routes: { robberRiver: route("r-robber-river"), policeAlley: route("r-police-alley"), lift: route("r-lift") },
} as const;

const { sectors: S, nodes: N, edges: E, zones: Z } = FIXTURE_IDS;

export const FIXTURE_WORLD: WorldData = deepFreeze<WorldData>({
  schemaVersion: WORLD_SCHEMA_VERSION,
  worldVersion: "fixture-world-1",
  sectors: [
    { id: S.bank, label: "Bank square (fixture)" },
    { id: S.alley, label: "Alfama-style alley (fixture)" },
    { id: S.river, label: "Riverfront (fixture)" },
  ],
  nodes: [
    { id: N.bank, position: { x: 0, y: 0, z: 0 }, kind: "waypoint", sectorId: S.bank },
    { id: N.junction, position: { x: 0, y: 0, z: 40 }, kind: "junction", sectorId: S.bank },
    { id: N.west, position: { x: -30, y: 0, z: 40 }, kind: "deadEnd", sectorId: S.alley },
    { id: N.east, position: { x: 30, y: 2, z: 40 }, kind: "junction", sectorId: S.bank },
    { id: N.river, position: { x: 30, y: -1, z: 70 }, kind: "exit", sectorId: S.river },
  ],
  edges: [
    {
      id: E.bankNorth,
      from: N.bank,
      to: N.junction,
      centerline: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 40 }],
      lengthM: 40,
      laneOffsetsM: TWO_LANES,
      allowedModes: ALL_MODES,
      speedLimitMps: null,
      label: "Rua do Banco (fixture)",
      sectorId: S.bank,
    },
    {
      // Single-lane alley: turns only, no lane changes, no scooters.
      id: E.junctionWest,
      from: N.junction,
      to: N.west,
      centerline: [{ x: 0, y: 0, z: 40 }, { x: -30, y: 0, z: 40 }],
      lengthM: 30,
      laneOffsetsM: [0],
      allowedModes: ["foot", "bicycle"],
      speedLimitMps: null,
      label: "Beco (fixture)",
      sectorId: S.alley,
    },
    {
      id: E.westReturn,
      from: N.west,
      to: N.junction,
      centerline: [{ x: -30, y: 0, z: 40 }, { x: 0, y: 0, z: 40 }],
      lengthM: 30,
      laneOffsetsM: [0],
      allowedModes: ["foot", "bicycle"],
      speedLimitMps: null,
      label: null,
      sectorId: S.alley,
    },
    {
      // Hill street: climbs 2 m.
      id: E.junctionEast,
      from: N.junction,
      to: N.east,
      centerline: [{ x: 0, y: 0, z: 40 }, { x: 30, y: 2, z: 40 }],
      lengthM: 30.067,
      laneOffsetsM: TWO_LANES,
      allowedModes: ALL_MODES,
      speedLimitMps: null,
      label: "Calçada (fixture)",
      sectorId: S.bank,
    },
    {
      // Foot-only stair shortcut: much shorter than the road loop.
      id: E.eastStairs,
      from: N.east,
      to: N.river,
      centerline: [{ x: 30, y: 2, z: 40 }, { x: 30, y: -1, z: 70 }],
      lengthM: 30.15,
      laneOffsetsM: [0],
      allowedModes: ["foot"],
      speedLimitMps: null,
      label: "Escadinhas (fixture)",
      sectorId: S.river,
    },
    {
      id: E.eastRoad,
      from: N.east,
      to: N.river,
      centerline: [
        { x: 30, y: 2, z: 40 },
        { x: 50, y: 1, z: 40 },
        { x: 50, y: -1, z: 70 },
        { x: 30, y: -1, z: 70 },
      ],
      lengthM: 70.092,
      laneOffsetsM: TWO_LANES,
      allowedModes: ALL_MODES,
      speedLimitMps: 8,
      label: "Avenida (fixture)",
      sectorId: S.river,
    },
  ],
  junctions: [
    {
      id: FIXTURE_IDS.junctions.bankNorth,
      nodeId: N.junction,
      fromEdgeId: E.bankNorth,
      window: { startM: 32, endM: 40 },
      branches: [
        {
          side: "left",
          toEdgeId: E.junctionWest,
          turnPath: [{ x: 0, y: 0, z: 37 }, { x: -1, y: 0, z: 39.5 }, { x: -3, y: 0, z: 40 }],
          allowedModes: ["foot", "bicycle"],
        },
        {
          side: "right",
          toEdgeId: E.junctionEast,
          turnPath: [{ x: 0, y: 0, z: 37 }, { x: 1, y: 0, z: 39.5 }, { x: 3, y: 0.2, z: 40 }],
          allowedModes: ALL_MODES,
        },
      ],
    },
    {
      // Dead end: forward movement at the end selects the marked turnaround.
      id: FIXTURE_IDS.junctions.westDeadEnd,
      nodeId: N.west,
      fromEdgeId: E.junctionWest,
      window: { startM: 24, endM: 30 },
      branches: [
        {
          side: "forward",
          toEdgeId: E.westReturn,
          turnPath: [{ x: -27, y: 0, z: 40 }, { x: -30, y: 0, z: 41.5 }, { x: -27, y: 0, z: 40 }],
          allowedModes: ["foot", "bicycle"],
        },
      ],
    },
    {
      id: FIXTURE_IDS.junctions.westReturn,
      nodeId: N.junction,
      fromEdgeId: E.westReturn,
      window: { startM: 24, endM: 30 },
      branches: [{ side: "forward", toEdgeId: E.junctionEast, turnPath: [], allowedModes: ["foot", "bicycle"] }],
    },
    {
      id: FIXTURE_IDS.junctions.east,
      nodeId: N.east,
      fromEdgeId: E.junctionEast,
      window: { startM: 22, endM: 30 },
      branches: [
        {
          side: "left",
          toEdgeId: E.eastStairs,
          turnPath: [{ x: 27, y: 1.8, z: 40 }, { x: 30, y: 2, z: 41 }, { x: 30, y: 1.9, z: 43 }],
          allowedModes: ["foot"],
        },
        { side: "forward", toEdgeId: E.eastRoad, turnPath: [], allowedModes: ALL_MODES },
      ],
    },
  ],
  colliders: [
    { id: collider("c-bank-building"), shape: "box", center: { x: -8, y: 4, z: 5 }, halfExtents: { x: 5, y: 4, z: 5 }, yaw: 0 },
    { id: collider("c-fountain"), shape: "cylinder", center: { x: 6, y: 0.5, z: 20 }, radiusM: 1.2, heightM: 1 },
  ],
  zones: [
    {
      id: Z.shop,
      kind: "shop",
      volume: { shape: "box", center: { x: 15, y: 1.5, z: 44 }, halfExtents: { x: 3, y: 1.5, z: 2 }, yaw: 0 },
      sectorId: S.bank,
    },
    {
      id: Z.liftBank,
      kind: "liftStop",
      volume: { shape: "box", center: { x: 2.5, y: 1, z: 10 }, halfExtents: { x: 1.5, y: 1, z: 3 }, yaw: 0 },
      sectorId: S.bank,
    },
    {
      id: Z.liftRiver,
      kind: "liftStop",
      volume: { shape: "box", center: { x: 40, y: 0, z: 71.5 }, halfExtents: { x: 3, y: 1, z: 1.5 }, yaw: 0 },
      sectorId: S.river,
    },
    {
      id: Z.riverEscape,
      kind: "escape",
      volume: { shape: "cylinder", center: { x: 30, y: -1, z: 70 }, radiusM: 3, heightM: 3 },
      sectorId: S.river,
    },
  ],
  spawns: [
    ...[0, 1, 2, 3, 4, 5].map((index) => ({
      id: spawn(`sp-player-${index + 1}`),
      kind: "player" as const,
      placement: { edgeId: E.bankNorth, distanceM: 4 + 3 * Math.floor(index / 2), laneIndex: index % 2 },
    })),
    { id: spawn("sp-robber"), kind: "robber", placement: { edgeId: E.bankNorth, distanceM: 16, laneIndex: 1 } },
    { id: spawn("sp-police-1"), kind: "police", placement: { edgeId: E.junctionWest, distanceM: 12, laneIndex: 0 } },
    {
      id: spawn("sp-bicycle"),
      kind: "vehicle",
      placement: { edgeId: E.junctionEast, distanceM: 6, laneIndex: 1 },
      vehicleType: "bicycle",
      access: "public",
    },
    {
      id: spawn("sp-shop-scooter"),
      kind: "vehicle",
      placement: { edgeId: E.junctionEast, distanceM: 15, laneIndex: 1 },
      vehicleType: "scooter",
      access: "shop",
    },
    {
      id: spawn("sp-lift"),
      kind: "vehicle",
      placement: { edgeId: E.bankNorth, distanceM: 20, laneIndex: 1 },
      vehicleType: "lift",
      access: "public",
    },
  ],
  routes: [
    { id: FIXTURE_IDS.routes.robberRiver, kind: "robberEscape", edgeIds: [E.bankNorth, E.junctionEast, E.eastRoad], exitZoneId: Z.riverEscape },
    { id: FIXTURE_IDS.routes.policeAlley, kind: "police", edgeIds: [E.junctionWest, E.westReturn, E.junctionEast] },
    { id: FIXTURE_IDS.routes.lift, kind: "lift", edgeIds: [E.bankNorth, E.junctionEast, E.eastRoad] },
  ],
  cameraObstructions: [
    { id: collider("co-bank-arcade"), shape: "box", center: { x: -3, y: 3, z: 30 }, halfExtents: { x: 1, y: 3, z: 4 }, yaw: 0 },
  ],
});
