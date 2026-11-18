import assert from "node:assert/strict";
import { test } from "node:test";
import { brandId, WORLD_SCHEMA_VERSION, type ColliderId, type EdgeId, type JunctionId, type NodeId, type RouteId,
  type SectorId, type SpawnId, type WorldData, type ZoneId } from "@stopthatguy/shared";
import { FIXTURE_WORLD } from "@stopthatguy/test-support";
import { collectRobberDiagnostics, createSimulation, getFixedDeltaMs } from "../src/index.js";
import { sweepBody } from "../src/collision/sweep.js";
import { entersVolume } from "../src/robber/volume.js";
import { IMMEDIATE_TUNING, makeSetup, PLAYERS } from "./helpers.js";

// Task-local authored fork: a slow road exit and a foot-only exit; no production fixture imports.
const edgeId = (name: string) => brandId<EdgeId>(name);
const nodeId = (name: string) => brandId<NodeId>(name);
const sectorId = brandId<SectorId>("test-sector");
function forkWorld(): WorldData {
  const points = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }, { x: -20, y: 0, z: 20 }, { x: 20, y: 2, z: 20 }];
  const pairs = [[0, 1], [1, 2], [1, 3]] as const;
  return { schemaVersion: WORLD_SCHEMA_VERSION, worldVersion: "t013-fork-1", sectors: [{ id: sectorId, label: "Test fork" }],
    nodes: points.map((position, i) => ({ id: nodeId(`n${i}`), position, kind: i > 1 ? "exit" : "junction", sectorId })),
    edges: pairs.map(([from, to], i) => ({ id: edgeId(`e${i}`), from: nodeId(`n${from}`), to: nodeId(`n${to}`),
      centerline: [points[from]!, points[to]!], lengthM: Math.hypot(points[to]!.x - points[from]!.x, points[to]!.y - points[from]!.y, points[to]!.z - points[from]!.z),
      laneOffsetsM: [0], allowedModes: i === 2 ? ["foot"] : ["foot", "scooter"], speedLimitMps: i === 1 ? 2 : null, label: null, sectorId })),
    junctions: [{ id: brandId<JunctionId>("j0"), nodeId: nodeId("n1"), fromEdgeId: edgeId("e0"), window: { startM: 16, endM: 20 }, branches: [
      { side: "left", toEdgeId: edgeId("e1"), allowedModes: ["foot", "scooter"], turnPath: [{ x: 0, y: 0, z: 18 }, { x: -1, y: 0, z: 19 }, { x: -2, y: 0, z: 20 }] },
      { side: "right", toEdgeId: edgeId("e2"), allowedModes: ["foot"], turnPath: [{ x: 0, y: 0, z: 18 }, { x: 1, y: .1, z: 19 }, { x: 2, y: .2, z: 20 }] },
    ] }],
    colliders: [], cameraObstructions: [],
    zones: [1, 2].map(i => ({ id: brandId<ZoneId>(`z${i}`), kind: "escape", sectorId,
      volume: { shape: "box", center: points[i + 1]!, halfExtents: { x: 2, y: 2, z: 2 }, yaw: 0 } })),
    spawns: [0, 1, 2].map(i => ({ id: brandId<SpawnId>(`sp${i}`), kind: i === 2 ? "robber" : "player",
      placement: { edgeId: edgeId("e0"), laneIndex: 0, distanceM: i * 2 } })),
    routes: [1, 2].map(i => ({ id: brandId<RouteId>(`r${i}`), kind: "robberEscape", edgeIds: [edgeId("e0"), edgeId(`e${i}`)], exitZoneId: brandId<ZoneId>(`z${i}`) })),
  };
}
const sim = createSimulation();
const solo = [{ playerId: PLAYERS.ana, nickname: "Ana", joinOrder: 0 }];
const setupFor = (world: WorldData, seed = 42) => makeSetup({ world, seed, tuning: IMMEDIATE_TUNING, mode: "practice", participants: solo });
function play(world: WorldData, seed = 42, ticks = 1800) {
  const state = sim.createInitialState(setupFor(world, seed));
  const snapshots = [sim.readSerializableState(state)];
  const events = [];
  for (let i = 0; i < ticks; i++) {
    sim.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING));
    const snapshot = sim.readSerializableState(state);
    snapshots.push(snapshot); events.push(...sim.collectEvents(state));
    if (snapshot.match.result) break;
  }
  return { state, snapshots, events };
}
function seedFor(world: WorldData, route: string): number {
  for (let seed = 0; seed < 64; seed++) {
    if (sim.readSerializableState(sim.createInitialState(setupFor(world, seed))).match.robberRouteId === route) return seed;
  }
  throw new Error(`No seed selected ${route}`);
}

test("same-seed full replay equals every snapshot/event; both valid branches occur", () => {
  const world = forkWorld();
  for (const route of ["r1", "r2"]) {
    const seed = seedFor(world, route);
    const a = play(world, seed), b = play(world, seed);
    assert.deepEqual(a.snapshots, b.snapshots); assert.deepEqual(a.events, b.events);
    assert.equal(a.snapshots.at(-1)!.match.result?.reason, "escaped");
    assert.equal(a.snapshots[0]!.match.robberRouteId, route);
    assert.ok(a.snapshots.some(s => s.robber!.route!.edgeId === (route === "r1" ? "e1" : "e2")));
    assert.equal(a.events.filter(e => e.type === "robberEscaped").length, 1);
  }
});

test("motion follows every turn continuously, obeys height and geographic bottleneck, with no rank adjustment", () => {
  const world = forkWorld();
  const run = play(world, seedFor(world, "r1"));
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
  let cornerSeen = false;
  for (let i = 1; i < run.snapshots.length; i++) {
    const a = run.snapshots[i - 1]!.robber!, b = run.snapshots[i]!.robber!;
    const distance = Math.hypot(b.pose.position.x - a.pose.position.x, b.pose.position.y - a.pose.position.y, b.pose.position.z - a.pose.position.z);
    assert.ok(distance <= IMMEDIATE_TUNING.vehicles.scooterSpeedMps / 30 + 1e-8, `tick ${i}: ${distance}`);
    if (b.pose.position.x < -.1 && b.pose.position.z < 19.9) cornerSeen = true;
    if (b.route!.edgeId === "e1") assert.ok(b.speedMps <= 2);
    assert.equal(b.pose.position.y, 0);
  }
  assert.ok(cornerSeen, "did not cut directly from one edge to the next");
});

test("foot-only branch has a visible stationary transition before foot locomotion and follows sloped ground", () => {
  const world = forkWorld(), run = play(world, seedFor(world, "r2"));
  const transitions = run.snapshots.filter(s => s.robber!.aiState === "transition");
  assert.equal(transitions.length, Math.round(IMMEDIATE_TUNING.robber.transitionMs / getFixedDeltaMs(IMMEDIATE_TUNING)));
  assert.ok(transitions.every(s => s.robber!.speedMps === 0 && s.robber!.locomotion === "scooter"));
  assert.ok(transitions.every(s => JSON.stringify(s.robber!.pose) === JSON.stringify(transitions[0]!.robber!.pose)));
  const foot = run.snapshots.filter(s => s.robber!.route!.edgeId === "e2");
  assert.ok(foot.length > 0);
  for (const snapshot of foot) {
    const robber = snapshot.robber!;
    assert.equal(robber.locomotion, "onFoot");
    assert.ok(Math.abs(robber.pose.position.y - robber.pose.position.x / 10) < 1e-8);
    assert.ok(robber.speedMps <= IMMEDIATE_TUNING.movement.runSpeedMps);
  }
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
  const modes = run.snapshots.map(s => s.robber!.locomotion);
  assert.equal(modes.filter((mode, i) => i > 0 && mode !== modes[i - 1]).length, 1);
});

test("blocked authored route selects the clear alternative for every seed", () => {
  const world = forkWorld();
  world.colliders.push({ id: brandId<ColliderId>("block-west"), shape: "box", center: { x: -10, y: 1, z: 20 }, halfExtents: { x: 1, y: 2, z: 3 }, yaw: 0 });
  for (let seed = 0; seed < 12; seed++) assert.equal(sim.readSerializableState(sim.createInitialState(setupFor(world, seed))).match.robberRouteId, "r2");
  assert.equal(play(world).snapshots.at(-1)!.match.result?.reason, "escaped");
});

test("missing/dangling routes, missing zones and impossible mode permissions never invent an escape", () => {
  for (const change of [
    (w: WorldData) => { w.routes = []; },
    (w: WorldData) => { w.routes[0]!.edgeIds[1] = edgeId("missing"); w.routes.length = 1; },
    (w: WorldData) => { w.zones = []; },
    (w: WorldData) => { w.junctions[0]!.branches.forEach(b => { b.allowedModes = ["lift"]; }); },
  ]) {
    const world = forkWorld(); change(world);
    const { state, snapshots, events } = play(world, 42, 900);
    assert.equal(snapshots[0]!.match.robberRouteId, null);
    assert.equal(snapshots[0]!.robber!.escapeTargetZoneId, null);
    assert.ok(snapshots.every(s => s.robber!.aiState !== "escaped"));
    assert.ok(!events.some(e => e.type === "robberEscaped"));
    assert.ok(collectRobberDiagnostics(state).length > 0);
    assert.deepEqual(collectRobberDiagnostics(state), []);
  }
});

test("an obstructed fallback stops at swept contact and cannot teleport or tunnel", () => {
  const world = forkWorld(); world.routes = [];
  world.colliders.push({ id: brandId<ColliderId>("wall"), shape: "box", center: { x: 0, y: 1, z: 9 }, halfExtents: { x: 3, y: 2, z: .01 }, yaw: 0 });
  const run = play(world, 42, 300);
  const last = run.snapshots.at(-1)!.robber!;
  assert.ok(last.pose.position.z > 8 && last.pose.position.z < 8.64);
  assert.equal(last.speedMps, 0);
  assert.ok(collectRobberDiagnostics(run.state).some(d => d.reason === "routeBlocked"));
  for (let i = 1; i < run.snapshots.length; i++) {
    const a = run.snapshots[i - 1]!.robber!.pose.position, b = run.snapshots[i]!.robber!.pose.position;
    assert.equal(sweepBody(a, b, world.colliders, { radiusM: .35, heightM: 1.8, skinM: .01 }).fraction, 1);
  }
});

test("an exit crossed within a step is reached; colliders beyond it do not invalidate the route", () => {
  const world = forkWorld(); world.routes.length = 1;
  world.zones[0]!.volume = { shape: "box", center: { x: -10, y: 0, z: 20 }, halfExtents: { x: .001, y: 1, z: 1 }, yaw: 0 };
  world.colliders.push({ id: brandId<ColliderId>("after-exit"), shape: "box", center: { x: -15, y: 1, z: 20 }, halfExtents: { x: 1, y: 2, z: 3 }, yaw: 0 });
  const run = play(world);
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
  assert.ok(Math.abs(run.snapshots.at(-1)!.robber!.pose.position.x + 9.999) < 1e-8);
});

test("authored route can begin on a later reachable edge without snapping there", () => {
  const world = forkWorld(); world.routes.length = 1; world.routes[0]!.edgeIds.shift();
  const run = play(world);
  assert.equal(run.snapshots[0]!.robber!.pose.position.z, 4);
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
});

test("a short foot approach cannot hide a second arrival that retains the required scooter", () => {
  const world = forkWorld();
  const a = world.edges[1]!, b = world.edges[2]!;
  a.allowedModes = ["foot"]; a.speedLimitMps = null;
  b.allowedModes = ["foot", "scooter"]; b.to = a.to;
  b.centerline = [{ x: 0, y: 0, z: 20 }, { x: 20, y: 0, z: 20 }, { x: -20, y: 0, z: 20 }]; b.lengthM = 60;
  world.nodes.push({ id: nodeId("merge-end"), position: { x: -20, y: 0, z: 40 }, kind: "junction", sectorId },
    { id: nodeId("exit-end"), position: { x: -20, y: 0, z: 60 }, kind: "exit", sectorId });
  world.edges.push({ ...a, id: edgeId("merge"), from: a.to, to: nodeId("merge-end"), allowedModes: ["foot", "scooter"],
    centerline: [{ x: -20, y: 0, z: 20 }, { x: -20, y: 0, z: 40 }], lengthM: 20 },
  { ...a, id: edgeId("exit"), from: nodeId("merge-end"), to: nodeId("exit-end"), allowedModes: ["scooter"],
    centerline: [{ x: -20, y: 0, z: 40 }, { x: -20, y: 0, z: 60 }], lengthM: 20 });
  const branches = world.junctions[0]!.branches;
  branches[0]!.side = "forward"; branches[0]!.allowedModes = ["foot"];
  branches[1]!.allowedModes = ["foot", "scooter"]; branches[1]!.turnPath = [];
  for (const [from, to] of [["e1", "merge"], ["e2", "merge"], ["merge", "exit"]]) {
    const source = world.edges.find(e => e.id === from)!;
    world.junctions.push({ id: brandId<JunctionId>(`j-${from}`), fromEdgeId: source.id, nodeId: source.to,
      window: { startM: source.lengthM - 4, endM: source.lengthM },
      branches: [{ side: "forward", toEdgeId: edgeId(to!), turnPath: [], allowedModes: from === "e1" ? ["foot"] : ["scooter"] }] });
  }
  world.zones[0]!.volume = { shape: "box", center: { x: -20, y: 0, z: 60 }, halfExtents: { x: 1, y: 1, z: 1 }, yaw: 0 };
  world.routes.length = 1; world.routes[0]!.edgeIds = [edgeId("merge"), edgeId("exit")];
  const run = play(world);
  assert.equal(run.snapshots[0]!.match.robberRouteId, "r1");
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
  assert.ok(run.snapshots.some(s => s.robber!.route!.edgeId === "e2"));
  assert.ok(run.snapshots.every(s => s.robber!.locomotion === "scooter"));
});

test("regression world with bent offset lanes completes a clear route within the speed bound", () => {
  const run = play(FIXTURE_WORLD);
  assert.equal(run.snapshots.at(-1)!.match.result?.reason, "escaped");
  for (let i = 1; i < run.snapshots.length; i++) {
    const a = run.snapshots[i - 1]!.robber!.pose.position, b = run.snapshots[i]!.robber!.pose.position;
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= 10 / 30 + 1e-8);
  }
});

test("exit geometry respects vertical bounds, yaw and cylindrical swept entry", () => {
  assert.ok(Math.abs(entersVolume({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { shape: "cylinder", center: { x: 0, y: 0, z: 0 }, radiusM: .1, heightM: 1 })! - .475) < 1e-12);
  assert.equal(entersVolume({ x: -2, y: 2, z: 0 }, { x: 2, y: 2, z: 0 },
    { shape: "cylinder", center: { x: 0, y: 0, z: 0 }, radiusM: 1, heightM: 1 }), null);
  assert.equal(entersVolume({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { shape: "box", center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: .5 }, yaw: Math.PI / 2 }), .375);
});

test("dense authored vertices do not exhaust a loop budget or lose tick time", () => {
  const world = forkWorld();
  const road = world.edges[0]!;
  // Dense section near departure: 200 geometry pieces crossed in one normal tick once accelerated.
  road.centerline = [{ x: 0, y: 0, z: 0 }, ...Array.from({ length: 201 }, (_, i) => ({ x: 0, y: 0, z: 10 + i / 1000 })), { x: 0, y: 0, z: 20 }];
  world.routes.length = 1; world.routes[0]!.edgeIds = [road.id];
  world.zones[0]!.volume = { shape: "box", center: { x: 0, y: 0, z: 10.2 }, halfExtents: { x: 1, y: 1, z: .001 }, yaw: 0 };
  const dense = play(world);
  road.centerline = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }];
  const sparse = play(world);
  assert.equal(dense.snapshots.at(-1)!.match.result?.reason, "escaped");
  assert.equal(dense.snapshots.at(-1)!.match.result?.resolvedAtTick, sparse.snapshots.at(-1)!.match.result?.resolvedAtTick);
  assert.deepEqual(collectRobberDiagnostics(dense.state), []);
});
