import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { WORLD_SCHEMA_VERSION, type Vec3, type WorldData } from "@stopthatguy/shared";
import { WORLD_LAYOUT_LIMITS, reachableEdges, spawnPosition, validateWorldData } from "@stopthatguy/test-support";
import { AUTHORED_WORLDS, FIRST_STREET_IDS, FIRST_STREET_WORLD } from "../src/index.js";

const world = FIRST_STREET_WORLD;
const E = FIRST_STREET_IDS.edges;
const edge = (id: string) => world.edges.find((e) => e.id === id)!;
const junction = (id: string) => world.junctions.find((j) => j.id === id)!;
const spawnById = (id: string) => world.spawns.find((s) => s.id === id)!;
const close = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} ≠ ${b}`);
const near = (p: Vec3, q: Vec3, label: string) => (["x", "y", "z"] as const).forEach((k) => close(p[k], q[k], `${label}.${k}`));
const steepest = (points: readonly Vec3[]) =>
  Math.max(0, ...points.slice(1).map((b, i) => Math.abs(b.y - points[i]!.y) / Math.hypot(b.x - points[i]!.x, b.z - points[i]!.z)));

describe("first street world data", () => {
  test("validates cleanly apart from the documented missing escape route", () => {
    const report = validateWorldData(world);
    assert.equal(report.ok, true, report.issues.map((i) => i.message).join("\n"));
    assert.deepEqual(
      report.issues.map((i) => [i.severity, i.code]),
      [["warning", "unreachableExit"]],
    );
    assert.equal(report.schemaVersion, WORLD_SCHEMA_VERSION);
    assert.equal(report.worldVersion, "first-street-1");
  });

  test("is the registered authored world and is frozen, JSON-safe plain data", () => {
    assert.deepEqual(AUTHORED_WORLDS, [world]);
    const isDeepFrozen = (value: unknown): boolean =>
      typeof value !== "object" || value === null || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
    assert.ok(isDeepFrozen(world));
    assert.deepEqual(JSON.parse(JSON.stringify(world)), world);
  });
});

describe("T005 features", () => {
  test("lane bands: a three-lane street and a single-lane alley", () => {
    assert.deepEqual(edge(E.mainNorth1).laneOffsetsM, [-3, 0, 3]);
    assert.deepEqual(edge(E.alleyWest).laneOffsetsM, [0]);
  });

  test("a junction with left and forward branches, with modes narrowed for the alley", () => {
    const j = junction(FIRST_STREET_IDS.junctions.crossFromSouth);
    assert.deepEqual(j.branches.map((b) => [b.side, b.toEdgeId, b.allowedModes]), [
      ["left", E.alleyWest, ["foot", "bicycle"]],
      ["forward", E.mainNorth2, ["foot", "bicycle", "scooter"]],
    ]);
    assert.deepEqual([j.window.startM, j.window.endM], [52, 60]);
  });

  test("the foot-only stairs are a real shortcut to the hill top", () => {
    const stairs = edge(E.stepsUp);
    assert.deepEqual(stairs.allowedModes, ["foot"]);
    const byRoad = edge(E.alleyEast).lengthM + edge(E.mainNorth2).lengthM; // alley end → cross → hill top
    assert.ok(stairs.lengthM < byRoad - 20, `stairs ${stairs.lengthM} m vs road ${byRoad} m`);
    close(steepest(stairs.centerline), 3 / 8, "stair grade");
  });

  test("a modest slope: the hill street climbs 3 m over 60 m", () => {
    const hill = edge(E.mainNorth2);
    assert.equal(hill.centerline.at(-1)!.y - hill.centerline[0]!.y, 3);
    close(steepest(hill.centerline), 0.05, "hill grade");
    for (const e of world.edges) {
      const limit = e.allowedModes.some((m) => m !== "foot") ? WORLD_LAYOUT_LIMITS.maxWheeledGrade : WORLD_LAYOUT_LIMITS.maxFootGrade;
      assert.ok(steepest(e.centerline) <= limit, `${e.id} grade`);
    }
  });

  test("turnarounds: the bank-square dead end and the hill top both offer a forward U-turn", () => {
    const square = world.nodes.find((n) => n.id === FIRST_STREET_IDS.nodes.square)!;
    assert.equal(square.kind, "deadEnd");
    const uTurn = junction(FIRST_STREET_IDS.junctions.squareUTurn).branches;
    assert.deepEqual(uTurn.map((b) => [b.side, b.toEdgeId]), [["forward", E.mainNorth1]]);
    const top = junction(FIRST_STREET_IDS.junctions.hilltopFromStreet).branches.find((b) => b.side === "forward")!;
    assert.equal(top.toEdgeId, E.mainSouth2);
    assert.ok(top.allowedModes.includes("scooter"), "vehicles can turn at the hill top");
  });

  test("spawns: six players in two rows, the robber ahead and two bicycles at the stand", () => {
    const kinds = world.spawns.map((s) => (s.kind === "vehicle" ? s.vehicleType : s.kind));
    assert.deepEqual(kinds, ["player", "player", "player", "player", "player", "player", "robber", "bicycle", "bicycle"]);
    // Northbound (yaw 0): right of travel is +X, so lane 0 (offset −3) is on the west side.
    near(spawnPosition(world, spawnById("sp-player-1"))!, { x: -3, y: 0, z: 6 }, "sp-player-1");
    near(spawnPosition(world, spawnById("sp-player-6"))!, { x: 3, y: 0, z: 10 }, "sp-player-6");
    near(spawnPosition(world, spawnById("sp-robber"))!, { x: 0, y: 0, z: 22 }, "sp-robber");
    near(spawnPosition(world, spawnById("sp-bicycle-1"))!, { x: 3, y: 0, z: 30 }, "sp-bicycle-1");
  });

  test("simple colliders include the bank, the bike stand and street-side blocks; none enters the street band", () => {
    const ids = world.colliders.map((c) => c.id);
    for (const id of ["c-bank", "c-bike-stand", "c-block-east-south"]) assert.ok(ids.includes(id as (typeof ids)[number]), id);
    for (const c of world.colliders) {
      const halfX = c.shape === "box" ? c.halfExtents.x : c.radiusM;
      assert.ok(Math.abs(c.center.x) - halfX >= 4.5, `${c.id} stays outside the main street band x ∈ [−4.5, 4.5]`);
    }
  });
});

describe("reachability and permissions", () => {
  test("every route is reachable on foot from every player spawn", () => {
    const all = world.edges.map((e) => e.id as string).sort();
    for (const s of world.spawns.filter((x) => x.kind === "player")) {
      assert.deepEqual([...reachableEdges(world, [s.placement.edgeId], "foot")].sort(), all, s.id);
    }
  });

  test("bicycles reach the street and alley but never the stairs; scooters stay on the main street", () => {
    const bike = reachableEdges(world, [spawnById("sp-bicycle-1").placement.edgeId], "bicycle");
    assert.deepEqual([...bike].sort(), [E.alleyEast, E.alleyWest, E.mainNorth1, E.mainNorth2, E.mainSouth1, E.mainSouth2].sort());
    const scooter = reachableEdges(world, [E.mainNorth1], "scooter");
    assert.deepEqual([...scooter].sort(), [E.mainNorth1, E.mainNorth2, E.mainSouth1, E.mainSouth2].sort());
  });

  test("a collider moved onto a spawn would be rejected", () => {
    const broken = JSON.parse(JSON.stringify(world)) as WorldData;
    const lamp = broken.colliders.find((c) => c.id === "c-lamp-1")!;
    lamp.center = { x: 0, y: 2, z: 6 }; // sp-player-2
    const report = validateWorldData(broken);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((i) => i.code === "spawnInsideCollider" && i.refs.includes("sp-player-2")));
  });
});
