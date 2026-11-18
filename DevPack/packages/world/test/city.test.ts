import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { TRAVEL_MODES, type AuthoredRoute, type EdgeId, type RouteEdge, type TravelMode, type Vec3, type Volume, type WorldData } from "@stopthatguy/shared";
import { pointOnEdge, reachableEdges, spawnPosition, validateWorldData, WORLD_LAYOUT_LIMITS } from "@stopthatguy/test-support";
import { AUTHORED_WORLDS, FIRST_STREET_WORLD, LISBON_CITY_IDS as I, LISBON_CITY_WORLD as world } from "../src/index.js";

const edge = (id: EdgeId, w = world) => w.edges.find(e => e.id === id)!;
const branches = (id: EdgeId, w = world) => w.junctions.find(j => j.fromEdgeId === id)!.branches;
const grade = (points: Vec3[]) => Math.max(...points.slice(1).map((b, i) => {
  const a = points[i]!;
  return Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
}));
function contains(volume: Volume, p: Vec3): boolean {
  if (volume.shape === "cylinder") return Math.hypot(p.x - volume.center.x, p.z - volume.center.z) <= volume.radiusM
    && Math.abs(p.y - volume.center.y) <= volume.heightM / 2 + 1e-9;
  const x = p.x - volume.center.x, z = p.z - volume.center.z;
  return Math.abs(x * Math.cos(volume.yaw) - z * Math.sin(volume.yaw)) <= volume.halfExtents.x
    && Math.abs(x * Math.sin(volume.yaw) + z * Math.cos(volume.yaw)) <= volume.halfExtents.z
    && Math.abs(p.y - volume.center.y) <= volume.halfExtents.y;
}
function checkRoute(w: WorldData, r: AuthoredRoute): void {
  const mode: TravelMode = r.kind === "lift" ? "lift" : "foot";
  for (let i = 0; i < r.edgeIds.length; i++) {
    const current = edge(r.edgeIds[i]!, w);
    assert.ok(current.allowedModes.includes(mode), `${r.id}: ${current.id} forbids ${mode}`);
    const next = r.edgeIds[i + 1] ?? (r.kind !== "robberEscape" ? r.edgeIds[0] : undefined);
    if (next) assert.ok(branches(current.id, w).some(b => b.toEdgeId === next && b.allowedModes.includes(mode)), `${r.id}: illegal transition ${current.id} → ${next}`);
  }
  if (r.kind === "robberEscape") {
    const robber = w.spawns.find(s => s.kind === "robber")!;
    assert.equal(r.edgeIds[0], robber.placement.edgeId);
    assert.ok(robber.placement.distanceM < edge(r.edgeIds[0]!, w).lengthM - 8);
    const last = edge(r.edgeIds.at(-1)!, w), zone = w.zones.find(z => z.id === r.exitZoneId)!;
    assert.equal(zone.kind, "escape");
    assert.equal(w.nodes.find(n => n.id === last.to)!.kind, "exit");
    for (const offset of last.laneOffsetsM) assert.ok(contains(zone.volume, pointOnEdge(last, last.lengthM, offset).position), `${r.id}: exit misses lane ${offset}`);
  }
}

test("distinct, frozen, registered six-block city preserves the exact first-street data", () => {
  assert.equal(world.worldVersion, "lisbon-city-1");
  assert.equal(world.sectors.length, 6);
  assert.equal(Math.max(...world.nodes.map(n => n.position.x)), 300);
  assert.equal(Math.max(...world.nodes.map(n => n.position.z)), 200);
  assert.equal(Math.max(...world.nodes.map(n => n.position.y)), 18);
  assert.deepEqual(AUTHORED_WORLDS, [FIRST_STREET_WORLD, world]);
  const frozen = (value: unknown): boolean => value === null || typeof value !== "object" || Object.isFrozen(value) && Object.values(value).every(frozen);
  assert.ok(frozen(world));
  assert.deepEqual(JSON.parse(JSON.stringify(world)), world);
  assert.equal(createHash("sha256").update(JSON.stringify(FIRST_STREET_WORLD)).digest("hex"), "7d80fd00fb5f6ce43d3ef309bcb22006db6da783aa3a728a3db9961c88cb7599");
  const report = validateWorldData(world);
  assert.equal(report.ok, true, JSON.stringify(report.issues));
  assert.deepEqual(report.issues, []);
});

test("every allowed edge reaches every other allowed edge in each travel mode, including lift", () => {
  for (const mode of TRAVEL_MODES) {
    const expected = world.edges.filter(e => e.allowedModes.includes(mode)).map(e => e.id).sort();
    for (const start of expected) assert.deepEqual([...reachableEdges(world, [start], mode)].sort(), expected, `${mode} from ${start}`);
  }
  for (const s of world.spawns) {
    const mode = s.kind === "vehicle" ? s.vehicleType : "foot";
    assert.ok(edge(s.placement.edgeId).allowedModes.includes(mode), s.id);
    assert.ok(spawnPosition(world, s));
  }
});

test("one unambiguous junction per approach, correct signed side cues and legal default continuations even at exits", () => {
  assert.equal(world.junctions.length, world.edges.length);
  assert.equal(new Set(world.junctions.map(j => j.fromEdgeId)).size, world.edges.length);
  const yaw = (e: RouteEdge, end: boolean) => {
    const a = e.centerline[end ? e.centerline.length - 2 : 0]!, b = e.centerline[end ? e.centerline.length - 1 : 1]!;
    return Math.atan2(b.x - a.x, b.z - a.z);
  };
  for (const incoming of world.edges) {
    const j = world.junctions.find(j => j.fromEdgeId === incoming.id)!;
    assert.equal(j.nodeId, incoming.to);
    assert.equal(new Set(j.branches.map(b => b.side)).size, j.branches.length);
    assert.ok(Math.abs(incoming.lengthM - j.window.startM - 8) < 1e-9);
    for (const mode of incoming.allowedModes) {
      assert.ok(j.branches.some(b => b.allowedModes.includes(mode)), `${incoming.id}: ${mode} trapped`);
      if (mode !== "lift") assert.ok(j.branches.some(b => b.side === "forward" && b.allowedModes.includes(mode)), `${incoming.id}: no ${mode} default`);
    }
    for (const b of j.branches) {
      const target = edge(b.toEdgeId);
      assert.equal(target.from, incoming.to);
      assert.deepEqual(b.allowedModes, incoming.allowedModes.filter(m => target.allowedModes.includes(m)));
      const angle = Math.atan2(Math.sin(yaw(target, false) - yaw(incoming, true)), Math.cos(yaw(target, false) - yaw(incoming, true)));
      if (b.side !== "forward") assert.equal(b.side, angle < 0 ? "left" : "right");
      assert.ok(grade(b.turnPath) <= WORLD_LAYOUT_LIMITS.maxFootGrade || b.turnPath.length === 0);
    }
  }
});

test("escape paths start at the robber and end inside three distinct exits; patrol/lift loops legally close", () => {
  for (const route of world.routes) checkRoute(world, route);
  const escapes = world.routes.filter(r => r.kind === "robberEscape");
  assert.equal(escapes.length, 4);
  assert.equal(new Set(escapes.map(r => r.exitZoneId)).size, 3);
  for (const route of escapes) {
    assert.ok(edge(route.edgeIds[0]!).allowedModes.includes("scooter"));
    assert.ok(route.edgeIds.some(id => !edge(id).allowedModes.includes("scooter") && edge(id).speedLimitMps !== null), `${route.id}: no transport transition/bottleneck`);
  }
  const covered = new Set(world.routes.filter(r => r.kind === "police").flatMap(r => r.edgeIds.map(id => edge(id).sectorId)));
  assert.equal(covered.size, 6);
  for (const s of world.spawns.filter(s => s.kind === "police")) {
    assert.ok(world.routes.some(r => r.kind === "police" && r.edgeIds[0] === s.placement.edgeId));
  }
});

test("an unavailable escape branch has another authored escape; sectors have two road approaches", () => {
  const escapes = world.routes.filter(r => r.kind === "robberEscape");
  for (const e of world.edges.filter(e => e.id !== I.edges.bank.out)) {
    assert.ok(escapes.some(r => !r.edgeIds.includes(e.id)), `all escapes require ${e.id}`);
  }
  for (const sector of world.sectors) {
    const entrances = world.junctions.flatMap(j => edge(j.fromEdgeId).sectorId === sector.id ? [] :
      j.branches.filter(b => b.allowedModes.includes("scooter") && edge(b.toEdgeId).sectorId === sector.id)
        .map(b => ({ from: j.fromEdgeId, to: b.toEdgeId, node: j.nodeId })));
    const nodes = new Set(entrances.map(entry => entry.node));
    assert.ok(nodes.size >= 2, `${sector.id}: fewer than two cross-sector entrances`);
    for (const blockedNode of nodes) {
      const w = structuredClone(world);
      for (const j of w.junctions.filter(j => j.nodeId === blockedNode && edge(j.fromEdgeId).sectorId !== sector.id)) {
        j.branches = j.branches.filter(b => edge(b.toEdgeId).sectorId !== sector.id);
      }
      const reached = reachableEdges(w, [I.edges.bank.out], "scooter");
      assert.ok(entrances.some(entry => entry.node !== blockedNode && reached.has(entry.from) && reached.has(entry.to)),
        `${sector.id}: closing entrance at ${blockedNode} blocks every alternative`);
    }
  }
  // Block either immediate branch after the shared spawn edge: the remaining side still reaches an exit.
  for (const blocked of [I.edges.marketWestB.back, I.edges.marketCentral.out]) {
    const w = structuredClone(world);
    for (const j of w.junctions) j.branches = j.branches.filter(b => b.toEdgeId !== blocked);
    const reached = reachableEdges(w, [I.edges.bank.out], "foot");
    assert.ok(escapes.some(r => r.edgeIds.every(id => reached.has(id))), blocked);
  }
});

test("both single-lane foot shortcuts save over 20% against adjacent road paths; hills remain within mode grades", () => {
  const comparisons = [
    [I.edges.arcade.out, [I.edges.westSouthB.out, I.edges.marketWestA.out]],
    [I.edges.steps.out, [I.edges.marketEastB.out, I.edges.eastHillA.out]],
  ] as const;
  for (const [id, roadIds] of comparisons) {
    const shortcut = edge(id), road = roadIds.map(id => edge(id));
    assert.deepEqual(shortcut.allowedModes, ["foot"]);
    assert.deepEqual(shortcut.laneOffsetsM, [0]);
    assert.equal(shortcut.from, road[0]!.from);
    assert.equal(shortcut.to, road.at(-1)!.to);
    assert.ok(shortcut.lengthM < road.reduce((sum, e) => sum + e.lengthM, 0) * 0.8);
    assert.ok(branches(road[0]!.id).some(b => b.toEdgeId === road[1]!.id && b.allowedModes.includes("scooter")));
  }
  assert.ok(grade(edge(I.edges.steps.out).centerline) > 0.25, "stairs trade a steeper grade for shorter travel");
  for (const e of world.edges) assert.ok(grade(e.centerline) <= (e.allowedModes.some(m => m !== "foot") ? 0.15 : 0.8), e.id);
});

test("shop and lift stop triggers touch reachable routes; lift is optional with parallel walking and wheeled access", () => {
  const lift = world.routes.find(r => r.kind === "lift")!;
  for (const z of world.zones.filter(z => z.kind === "shop" || z.kind === "liftStop")) {
    for (const mode of ["foot", "bicycle", "scooter", ...(z.kind === "liftStop" ? ["lift"] : [])] as TravelMode[]) {
      const hits = world.edges.filter(e => e.allowedModes.includes(mode)).filter(e =>
        Array.from({ length: 101 }, (_, i) => pointOnEdge(e, e.lengthM * i / 100).position).some(p => contains(z.volume, p)));
      assert.ok(hits.length, `${z.id}: no ${mode} access`);
      if (mode === "lift") assert.ok(hits.some(e => lift.edgeIds.includes(e.id)));
    }
  }
  const shop = world.zones.find(z => z.id === I.zones.shop)!;
  const bike = world.spawns.find(s => s.kind === "vehicle" && s.access === "shop")!;
  assert.ok(contains(shop.volume, spawnPosition(world, bike)!));
  const publicBikes = world.spawns.filter(s => s.kind === "vehicle" && s.vehicleType === "bicycle" && s.access === "public");
  assert.equal(publicBikes.length, 2);
  assert.equal(publicBikes[0]!.placement.distanceM, publicBikes[1]!.placement.distanceM, "symmetric stands on both sides of the bank street");
});

test("route-specific checks reject missing transitions, forbidden modes, broken loop closure and misplaced exits", () => {
  const broken = () => structuredClone(world);
  let w = broken(), route = w.routes.find(r => r.id === I.routes.west)!;
  w.junctions.find(j => j.fromEdgeId === route.edgeIds[0])!.branches = [];
  assert.throws(() => checkRoute(w, route), /illegal transition/);
  w = broken(); route = w.routes.find(r => r.id === I.routes.lift)!;
  edge(route.edgeIds[1]!, w).allowedModes = ["foot"];
  assert.throws(() => checkRoute(w, route), /forbids lift/);
  w = broken(); route = w.routes.find(r => r.id === I.routes.policeLow)!;
  w.junctions.find(j => j.fromEdgeId === route.edgeIds.at(-1))!.branches = [];
  assert.throws(() => checkRoute(w, route), /illegal transition/);
  w = broken(); route = w.routes.find(r => r.id === I.routes.east)!;
  w.zones.find(z => z.id === I.zones.east)!.volume.center.x += 20;
  assert.throws(() => checkRoute(w, route), /exit misses lane/);
});
