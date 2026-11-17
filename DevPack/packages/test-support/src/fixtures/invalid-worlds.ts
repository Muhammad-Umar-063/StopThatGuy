// TEST DATA — deliberately invalid world data. Each sample is FIXTURE_WORLD with exactly one defect and
// lists the issue codes it must produce (and nothing else) plus a record the report must name, so a
// sample can only pass for its intended reason. FIXTURE_WORLD itself must validate cleanly.
import type { WorldIssueCode } from "@stopthatguy/shared";
import { polylineLength } from "../validation/world.js";
import { deepFreeze } from "./freeze.js";
import { FIXTURE_WORLD } from "./world.js";

export interface InvalidWorldSample {
  label: string;
  /** Raw data as a loader would receive it. */
  world: unknown;
  expectedCodes: readonly WorldIssueCode[];
  /** An ID or path that must appear in the refs of a reported issue. */
  expectedRef: string;
}

/** Untyped draft: samples are deliberately malformed, so they are edited without the WorldData type. */
type Draft = any;

function variant(label: string, expectedCodes: WorldIssueCode[], expectedRef: string, mutate: (world: Draft) => void): InvalidWorldSample {
  const world: Draft = JSON.parse(JSON.stringify(FIXTURE_WORLD));
  mutate(world);
  return { label, world, expectedCodes, expectedRef };
}

const byId = (list: Draft[], id: string): Draft => {
  const found = list.find((item: Draft) => item.id === id);
  if (!found) throw new Error(`invalid-world fixture references missing ${id}`);
  return found;
};

export const INVALID_WORLD_SAMPLES: readonly InvalidWorldSample[] = deepFreeze([
  // Identities
  variant("duplicate node ID", ["duplicateId"], "n-bank", (w) => w.nodes.push({ ...w.nodes[0] })),
  variant("duplicate edge ID", ["duplicateId"], "e-bank-north", (w) => w.edges.push(JSON.parse(JSON.stringify(w.edges[0])))),
  // References
  variant("edge to a missing node", ["danglingReference"], "e-east-stairs", (w) => (byId(w.edges, "e-east-stairs").to = "n-missing")),
  variant("junction branch to a missing edge", ["danglingReference"], "j-east", (w) => (byId(w.junctions, "j-east").branches[0].toEdgeId = "e-missing")),
  variant("spawn on a missing edge", ["danglingReference"], "sp-robber", (w) => (byId(w.spawns, "sp-robber").placement.edgeId = "e-missing")),
  variant("escape route to a missing zone", ["danglingReference"], "r-robber-river", (w) => (byId(w.routes, "r-robber-river").exitZoneId = "z-missing")),
  variant("escape route to a shop zone", ["invalidValue"], "r-robber-river", (w) => (byId(w.routes, "r-robber-river").exitZoneId = "z-shop")),
  variant("robber route skipping a junction", ["unreachableExit"], "r-robber-river", (w) => (byId(w.routes, "r-robber-river").edgeIds = ["e-bank-north", "e-east-road"])),
  variant("no robber spawn", ["invalidValue"], "$.spawns", (w) => (w.spawns = w.spawns.filter((s: Draft) => s.kind !== "robber"))),
  // Coordinates and dimensions
  variant("non-finite node coordinate", ["invalidValue"], "n-bank", (w) => (w.nodes[0].position.x = Number.NaN)),
  variant("infinite turn-path point", ["invalidValue"], "j-bank-north", (w) => (byId(w.junctions, "j-bank-north").branches[0].turnPath[1].z = Number.POSITIVE_INFINITY)),
  variant("zero-size box collider", ["invalidValue"], "c-bank-building", (w) => (byId(w.colliders, "c-bank-building").halfExtents.x = 0)),
  variant("negative cylinder radius", ["invalidValue"], "c-fountain", (w) => (byId(w.colliders, "c-fountain").radiusM = -1)),
  variant("edge length not matching its centerline", ["invalidValue"], "e-bank-north", (w) => (byId(w.edges, "e-bank-north").lengthM = 41)),
  // Lanes and modes
  variant("lane offsets out of order", ["invalidValue"], "e-bank-north", (w) => (byId(w.edges, "e-bank-north").laneOffsetsM = [1.5, -1.5])),
  variant("unknown travel mode", ["invalidValue"], "e-bank-north", (w) => (byId(w.edges, "e-bank-north").allowedModes = ["foot", "jetpack"])),
  variant("spawn lane outside its edge", ["invalidValue"], "sp-player-1", (w) => (byId(w.spawns, "sp-player-1").placement.laneIndex = 5)),
  variant("scooter spawned on foot-only stairs", ["illegalVehicleRoute"], "sp-shop-scooter", (w) => {
    byId(w.spawns, "sp-shop-scooter").placement = { edgeId: "e-east-stairs", distanceM: 10, laneIndex: 0 };
  }),
  variant("branch letting scooters into the alley", ["illegalVehicleRoute"], "j-bank-north", (w) => {
    byId(w.junctions, "j-bank-north").branches[0].allowedModes = ["foot", "bicycle", "scooter"];
  }),
  variant("dead end without a forward turnaround", ["missingTurnaround"], "e-junction-west", (w) => (byId(w.junctions, "j-west-dead-end").branches[0].side = "left")),
  // Document shape
  variant("unknown top-level field", ["invalidValue"], "$.lanes", (w) => (w.lanes = [])),
  variant("unsupported schema version", ["invalidValue"], "$.schemaVersion", (w) => (w.schemaVersion = 99)),
  // Layout (T005): referentially valid data, so only phase 3 can object
  variant("spawn inside a collider", ["spawnInsideCollider"], "sp-player-1", (w) => (byId(w.colliders, "c-fountain").center = { x: -1.5, y: 0.5, z: 4 })),
  variant("two spawns on the same spot", ["invalidValue"], "sp-player-2", (w) => {
    byId(w.spawns, "sp-player-2").placement = { edgeId: "e-bank-north", distanceM: 4, laneIndex: 0 };
  }),
  variant("alley unreachable from the spawns", ["disconnectedStart"], "e-junction-west", (w) => {
    const junction = byId(w.junctions, "j-bank-north");
    junction.branches = junction.branches.filter((b: Draft) => b.side !== "left");
  }),
  variant("exit nobody can reach", ["disconnectedStart", "unreachableExit"], "n-pier", (w) => {
    w.nodes.push({ id: "n-dock", position: { x: 70, y: -1, z: 60 }, kind: "waypoint", sectorId: "s-river" });
    w.nodes.push({ id: "n-pier", position: { x: 70, y: -1, z: 70 }, kind: "exit", sectorId: "s-river" });
    const centerline = [{ x: 70, y: -1, z: 60 }, { x: 70, y: -1, z: 70 }];
    w.edges.push({ id: "e-dock-pier", from: "n-dock", to: "n-pier", centerline, lengthM: 10, laneOffsetsM: [0], allowedModes: ["foot"], speedLimitMps: null, label: null, sectorId: "s-river" });
  }),
  variant("scooter stranded where only foot and bicycle continue", ["missingTurnaround"], "e-junction-east", (w) => {
    byId(w.junctions, "j-east").branches.find((b: Draft) => b.side === "forward").allowedModes = ["foot", "bicycle", "lift"];
  }),
  variant("vehicle street steeper than the wheeled limit", ["illegalVehicleRoute"], "e-east-road", (w) => {
    const road = byId(w.edges, "e-east-road");
    road.centerline[1].y = 6;
    road.lengthM = polylineLength(road.centerline);
  }),
  variant("stairs steeper than walkable", ["invalidValue"], "e-east-stairs", (w) => {
    const stairs = byId(w.edges, "e-east-stairs");
    stairs.centerline.splice(1, 0, { x: 30, y: 30, z: 41 });
    stairs.lengthM = polylineLength(stairs.centerline);
  }),
  variant("turn path floating above the ground", ["invalidValue"], "j-bank-north", (w) => {
    byId(w.junctions, "j-bank-north").branches.find((b: Draft) => b.side === "right").turnPath[2].y = 2;
  }),
]);
