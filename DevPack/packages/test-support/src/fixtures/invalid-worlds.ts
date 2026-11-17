// TEST DATA — deliberately invalid world data. Each sample is FIXTURE_WORLD with exactly one defect and
// lists the issue codes it must produce (and nothing else) plus a record the report must name, so a
// sample can only pass for its intended reason. FIXTURE_WORLD itself must validate cleanly.
import type { WorldIssueCode } from "@stopthatguy/shared";
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
]);
