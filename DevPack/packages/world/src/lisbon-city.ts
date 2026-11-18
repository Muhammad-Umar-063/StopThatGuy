// Six gameplay blocks, adapted Baixa/Alfama geography. Data and collision proxies, NOT finished art.
// +X east, +Z north, metres. See ../CITY_LAYOUT.md for stable route IDs and integration boundaries.
import { WORLD_SCHEMA_VERSION, brandId, type ColliderId, type ColliderPrimitive, type EdgeId, type NodeId,
  type RouteId, type RouteNode, type SectorId, type Spawn, type SpawnId, type TravelMode, type WorldData,
  type Zone, type ZoneId } from "@stopthatguy/shared";
import { cityJunctions, freeze, pair, v } from "./city-authoring.js";

const S = {
  arcade: brandId<SectorId>("city-s-arcade"), bank: brandId<SectorId>("city-s-bank"), quay: brandId<SectorId>("city-s-quay"),
  lift: brandId<SectorId>("city-s-lift"), hill: brandId<SectorId>("city-s-hill"), alfama: brandId<SectorId>("city-s-alfama"),
};
const nodeId = (x: number, z: number) => brandId<NodeId>(`city-n-${x}-${z}`);
const N = { bank: nodeId(1, 0), market: nodeId(1, 1), westExit: nodeId(0, 0), eastExit: nodeId(3, 0), hillExit: nodeId(3, 2),
  arcadeLow: brandId<NodeId>("city-n-arcade-low"), arcadeHigh: brandId<NodeId>("city-n-arcade-high"),
  stepsLow: brandId<NodeId>("city-n-steps-low"), stepsHigh: brandId<NodeId>("city-n-steps-high") };
const Z = { shop: brandId<ZoneId>("city-z-shop"), liftLow: brandId<ZoneId>("city-z-lift-low"), liftHigh: brandId<ZoneId>("city-z-lift-high"),
  west: brandId<ZoneId>("city-z-river-west"), east: brandId<ZoneId>("city-z-river-east"), hill: brandId<ZoneId>("city-z-hill-exit") };
const R = { west: brandId<RouteId>("city-r-escape-west"), arcade: brandId<RouteId>("city-r-escape-arcade"),
  east: brandId<RouteId>("city-r-escape-east"), hill: brandId<RouteId>("city-r-escape-hill"),
  policeLow: brandId<RouteId>("city-r-police-baixa"), policeHigh: brandId<RouteId>("city-r-police-hill"), lift: brandId<RouteId>("city-r-lift-circuit") };
const sectors = [S.arcade, S.bank, S.quay, S.lift, S.hill, S.alfama];
const heights = [0, 6, 18];
const nodes: RouteNode[] = [];
for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
  const id = nodeId(col, row);
  nodes.push({ id, position: v(col * 100, heights[row]!, row * 100),
    kind: [N.westExit, N.eastExit, N.hillExit].includes(id) ? "exit" : "junction",
    sectorId: sectors[Math.min(row, 1) * 3 + Math.min(col, 2)]! });
}
nodes.push(
  { id: N.arcadeLow, position: v(0, 3, 50), kind: "junction", sectorId: S.arcade },
  { id: N.arcadeHigh, position: v(50, 6, 100), kind: "junction", sectorId: S.arcade },
  { id: N.stepsLow, position: v(250, 6, 100), kind: "junction", sectorId: S.alfama },
  { id: N.stepsHigh, position: v(300, 12, 150), kind: "junction", sectorId: S.alfama },
);
const pos = (id: NodeId) => ({ ...nodes.find(n => n.id === id)!.position });
const ROAD: TravelMode[] = ["foot", "bicycle", "scooter"];
const LIFT: TravelMode[] = [...ROAD, "lift"];
// Lift circuit reuses broad roads. Stop triggers are safe platforms, not mandatory bottlenecks.
const road = (name: string, a: NodeId, b: NodeId, sector: SectorId, label: string, lift = false) => {
  const start = pos(a), end = pos(b), run = Math.hypot(end.x - start.x, end.z - start.z);
  const dx = (end.x - start.x) * 5 / run, dz = (end.z - start.z) * 5 / run;
  // Flat five-metre junction landings keep all incoming lane offsets at the same height as
  // the turn. A sloped edge reaching the node can otherwise create a nearly vertical late turn.
  const line = start.y === end.y ? [start, end] : [start, v(start.x + dx, start.y, start.z + dz),
    v(end.x - dx, end.y, end.z - dz), end];
  return pair(name, a, b, line, sector, label, lift ? LIFT : ROAD, [-3, 0, 3]);
};
const pairs = {
  riverWest: road("river-west", nodeId(0, 0), nodeId(1, 0), S.arcade, "Cais do Arco"),
  riverCentral: road("river-central", nodeId(1, 0), nodeId(2, 0), S.bank, "Avenida da Ribeira"),
  riverEast: road("river-east", nodeId(2, 0), nodeId(3, 0), S.quay, "Avenida da Ribeira"),
  marketWestA: road("market-west-a", nodeId(0, 1), N.arcadeHigh, S.arcade, "Rua das Lojas", true),
  marketWestB: road("market-west-b", N.arcadeHigh, nodeId(1, 1), S.bank, "Rua das Lojas", true),
  marketCentral: road("market-central", nodeId(1, 1), nodeId(2, 1), S.bank, "Rua das Lojas"),
  marketEastA: road("market-east-a", nodeId(2, 1), N.stepsLow, S.quay, "Rua das Lojas"),
  marketEastB: road("market-east-b", N.stepsLow, nodeId(3, 1), S.quay, "Rua das Lojas"),
  ridgeWest: road("ridge-west", nodeId(0, 2), nodeId(1, 2), S.lift, "Rua do Miradouro", true),
  ridgeCentral: road("ridge-central", nodeId(1, 2), nodeId(2, 2), S.hill, "Rua do Miradouro"),
  ridgeEast: road("ridge-east", nodeId(2, 2), nodeId(3, 2), S.alfama, "Rua do Miradouro"),
  westSouthA: road("west-south-a", nodeId(0, 0), N.arcadeLow, S.arcade, "Rua do Arco"),
  westSouthB: road("west-south-b", N.arcadeLow, nodeId(0, 1), S.arcade, "Rua do Arco"),
  westHill: road("west-hill", nodeId(0, 1), nodeId(0, 2), S.lift, "Calçada do Elevador", true),
  bank: road("bank", nodeId(1, 0), nodeId(1, 1), S.bank, "Rua do Banco"),
  bankHill: road("bank-hill", nodeId(1, 1), nodeId(1, 2), S.hill, "Calçada do Banco", true),
  eastAvenue: road("east-avenue", nodeId(2, 0), nodeId(2, 1), S.quay, "Rua da Ribeira"),
  hill: road("hill", nodeId(2, 1), nodeId(2, 2), S.hill, "Calçada das Flores"),
  quay: road("quay", nodeId(3, 0), nodeId(3, 1), S.quay, "Rua do Cais"),
  eastHillA: road("east-hill-a", nodeId(3, 1), N.stepsHigh, S.alfama, "Calçada da Colina"),
  eastHillB: road("east-hill-b", N.stepsHigh, nodeId(3, 2), S.alfama, "Calçada da Colina"),
  arcade: pair("arcade", N.arcadeLow, N.arcadeHigh,
    [pos(N.arcadeLow), v(10, 3, 60), v(35, 6, 85), pos(N.arcadeHigh)], S.arcade, "Passagem do Arco", ["foot"], [0]),
  steps: pair("steps", N.stepsLow, N.stepsHigh,
    [pos(N.stepsLow), v(260, 6, 110), v(275, 12, 125), pos(N.stepsHigh)], S.alfama, "Escadinhas das Flores", ["foot"], [0]),
};
const E = Object.fromEntries(Object.entries(pairs).map(([name, [out, back]]) => [name, { out: out.id, back: back.id }])) as
  { [K in keyof typeof pairs]: { out: EdgeId; back: EdgeId } };
const edges = Object.values(pairs).flat();
const liftCircuit = [E.marketWestA.out, E.marketWestB.out, E.bankHill.out, E.ridgeWest.back, E.westHill.back];
// One-way lift circuit; foot/bicycle/scooter retain both road directions.
for (const edge of edges) if (!liftCircuit.includes(edge.id)) edge.allowedModes = edge.allowedModes.filter(mode => mode !== "lift");
// Visible single-lane arcade/stair bottlenecks. The road bypasses retain normal mode speeds.
for (const e of pairs.arcade) e.speedLimitMps = 3.5;
for (const e of pairs.steps) e.speedLimitMps = 3;
const box = (id: string, x: number, z: number, halfX: number, halfZ: number, ground = 0): ColliderPrimitive => ({
  id: brandId<ColliderId>(id), shape: "box", center: v(x, ground + 10, z), halfExtents: v(halfX, 10, halfZ), yaw: 0,
});
// Broad street setbacks; two corner-cut courtyards leave the full foot corridor unobstructed.
const colliders: ColliderPrimitive[] = [
  box("city-c-arcade-south", 50, 25, 35, 10), box("city-c-arcade-east", 75, 60, 10, 25),
  box("city-c-bank", 150, 50, 35, 35), box("city-c-quay", 250, 50, 35, 35),
  box("city-c-elevador", 50, 150, 35, 35, 6), box("city-c-hill", 150, 150, 35, 35, 6),
  box("city-c-alfama-west", 225, 150, 10, 35, 6), box("city-c-alfama-north", 260, 175, 25, 10, 6),
];
const zone = (id: ZoneId, kind: Zone["kind"], center: ReturnType<typeof v>, sectorId: SectorId, radiusM = 5): Zone => ({
  id, kind, sectorId, volume: { shape: "cylinder", center: { ...center, y: center.y + (kind === "escape" ? 1 : 1.5) },
    radiusM, heightM: kind === "escape" ? 4 : 3 },
});
const spawn = (id: string, edgeId: EdgeId, distanceM: number, laneIndex: number) => ({
  id: brandId<SpawnId>(id), placement: { edgeId, distanceM, laneIndex },
});
const spawns: Spawn[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ ...spawn(`city-sp-player-${i + 1}`, E.bank.out, i < 3 ? 6 : 10, i % 3), kind: "player" as const })),
  { ...spawn("city-sp-robber", E.bank.out, 22, 1), kind: "robber" },
  { ...spawn("city-sp-bike-west", E.bank.out, 38, 0), kind: "vehicle", vehicleType: "bicycle", access: "public" },
  { ...spawn("city-sp-bike-east", E.bank.out, 38, 2), kind: "vehicle", vehicleType: "bicycle", access: "public" },
  { ...spawn("city-sp-shop-bike", E.marketCentral.out, 30, 2), kind: "vehicle", vehicleType: "bicycle", access: "shop" },
  { ...spawn("city-sp-scooter", E.marketCentral.out, 45, 2), kind: "vehicle", vehicleType: "scooter", access: "borrowable" },
  { ...spawn("city-sp-lift", E.marketWestA.out, 25, 1), kind: "vehicle", vehicleType: "lift", access: "public" },
  { ...spawn("city-sp-police-baixa", E.riverWest.out, 50, 1), kind: "police" },
  { ...spawn("city-sp-police-hill", E.marketWestA.out, 40, 1), kind: "police" },
];

export const LISBON_CITY_IDS = freeze({ sectors: S, nodes: N, edges: E, zones: Z, routes: R });
/** Distinct gameplay map. Existing server and street renderer intentionally continue using first-street-1. */
export const LISBON_CITY_WORLD: WorldData = freeze<WorldData>({
  schemaVersion: WORLD_SCHEMA_VERSION, worldVersion: "lisbon-city-1",
  sectors: ["Arco courtyards", "Bank square and shops", "Ribeira quays", "Elevador block", "Banco hill", "Alfama lanes"]
    .map((label, i) => ({ id: sectors[i]!, label })),
  nodes, edges, junctions: cityJunctions(edges), colliders, spawns,
  zones: [zone(Z.shop, "shop", v(130, 6, 100), S.bank),
    zone(Z.liftLow, "liftStop", v(10, 6, 100), S.lift), zone(Z.liftHigh, "liftStop", v(50, 18, 200), S.lift),
    zone(Z.west, "escape", pos(N.westExit), S.arcade), zone(Z.east, "escape", pos(N.eastExit), S.quay),
    zone(Z.hill, "escape", pos(N.hillExit), S.alfama)],
  routes: [
    { id: R.west, kind: "robberEscape", exitZoneId: Z.west,
      edgeIds: [E.bank.out, E.marketCentral.out, E.marketEastA.out, E.steps.out, E.eastHillB.out,
        E.ridgeEast.back, E.ridgeCentral.back, E.ridgeWest.back, E.westHill.back, E.westSouthB.back, E.westSouthA.back] },
    { id: R.arcade, kind: "robberEscape", exitZoneId: Z.west,
      edgeIds: [E.bank.out, E.marketWestB.back, E.arcade.back, E.westSouthA.back] },
    { id: R.east, kind: "robberEscape", exitZoneId: Z.east,
      edgeIds: [E.bank.out, E.marketCentral.out, E.marketEastA.out, E.steps.out, E.eastHillA.back, E.quay.back] },
    { id: R.hill, kind: "robberEscape", exitZoneId: Z.hill,
      edgeIds: [E.bank.out, E.marketCentral.out, E.marketEastA.out, E.steps.out, E.eastHillB.out] },
    { id: R.policeLow, kind: "police", edgeIds: [E.riverWest.out, E.riverCentral.out, E.riverEast.out, E.quay.out,
      E.marketEastB.back, E.marketEastA.back, E.marketCentral.back, E.marketWestB.back, E.marketWestA.back,
      E.westSouthB.back, E.westSouthA.back] },
    { id: R.policeHigh, kind: "police", edgeIds: [E.marketWestA.out, E.marketWestB.out, E.marketCentral.out,
      E.marketEastA.out, E.marketEastB.out, E.eastHillA.out, E.eastHillB.out, E.ridgeEast.back,
      E.ridgeCentral.back, E.ridgeWest.back, E.westHill.back] },
    { id: R.lift, kind: "lift", edgeIds: liftCircuit },
  ],
  cameraObstructions: colliders.map(c => ({ ...c, id: brandId<ColliderId>(`${c.id}-camera`) })),
});
