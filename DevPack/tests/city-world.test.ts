// T016 cross-package acceptance: existing real movement/sweeps against authored gameplay data.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, brandId, type ColliderId, type EdgeId, type JunctionBranch, type PlayerId, type RouteEdge, type TravelMode, type Vec3, type WorldData } from "@stopthatguy/shared";
import { createSimulation, getFixedDeltaMs, indexWorld, poseOnRoute, queryRoadActions, roadMovementKernel,
  type MovementContext, type MovementInput, type MovementState } from "@stopthatguy/simulation";
import { checkSnapshotConsistency, createFixtureSimulationSetup, WORLD_LAYOUT_LIMITS } from "@stopthatguy/test-support";
import { LISBON_CITY_IDS as I, LISBON_CITY_WORLD as world } from "@stopthatguy/world";
// Test-only inspection of the very same internal connector and sweep used by the public kernel.
import { branchPath } from "../packages/simulation/src/movement/path.js";
import { isPathClear, sweepBody, type CollisionBody } from "../packages/simulation/src/collision/index.js";

const index = indexWorld(world), dtMs = getFixedDeltaMs(DEFAULT_TUNING);
const context: MovementContext = { world: index, tuning: DEFAULT_TUNING, dtMs };
const held: MovementInput = { forwardHeld: true, brakeHeld: false, sprintHeld: false, interactHeld: false, leftPressed: false, rightPressed: false };
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const bodyFor = (modes: TravelMode[]): CollisionBody => ({
  radiusM: Math.max(...modes.map(m => WORLD_LAYOUT_LIMITS.spawnFootprint[m === "foot" ? "player" : m].radiusM)),
  heightM: Math.max(...modes.map(m => WORLD_LAYOUT_LIMITS.spawnFootprint[m === "foot" ? "player" : m].heightM)), skinM: 0.01,
});
function stateOn(edge: RouteEdge, distanceM: number, laneIndex: number, mode: "onFoot" | "bicycle" | "scooter" = "onFoot"): MovementState {
  return { route: { edgeId: edge.id, distanceM, laneIndex, lateralOffsetM: edge.laneOffsetsM[laneIndex]! },
    speedMps: 6, stamina: 100, locomotion: mode };
}
function checkLanes(w: WorldData): void {
  const indexed = indexWorld(w);
  for (const e of w.edges) {
    // Continuous swept tube around the centerline bounds every lane and any lane change.
    // Bent shortcuts have a single zero-offset lane; roads are straight, so no miter is omitted.
    const body = bodyFor(e.allowedModes), width = Math.max(...e.laneOffsetsM.map(Math.abs));
    assert.ok(isPathClear(e.centerline, w.colliders, { ...body, radiusM: body.radiusM + width }), `${e.id}: travel band intersects collider`);
    for (const [laneIndex, offset] of e.laneOffsetsM.entries()) {
      const points = indexed.edges.get(e.id)!.cumulativeM.map(distanceM => poseOnRoute(indexed,
        { edgeId: e.id, distanceM, laneIndex, lateralOffsetM: offset }).position);
      assert.ok(isPathClear(points, w.colliders, body), `${e.id}: lane ${laneIndex} blocked`);
    }
  }
}
function checkConnector(w: WorldData, e: RouteEdge, branch: JunctionBranch, at: number, laneIndex: number): void {
  const indexed = indexWorld(w), current = stateOn(e, at, laneIndex);
  const { path, target } = branchPath(indexed, current.route, branch);
  assert.ok(isPathClear(path.points, w.colliders, bodyFor(branch.allowedModes)), `${e.id} → ${branch.toEdgeId}: connector blocked`);
  assert.deepEqual(path.points[0], poseOnRoute(indexed, current.route).position);
  assert.ok(distance(path.points.at(-1)!, poseOnRoute(indexed, target).position) < 1e-9);
  assert.ok(path.lengthM < 20, `${e.id}: unexpectedly long connector`);
  const maxGrade = branch.allowedModes.some(m => m !== "foot") ? 0.15 : 0.8;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1]!, b = path.points[i]!;
    const run = Math.hypot(b.x - a.x, b.z - a.z), rise = Math.abs(b.y - a.y);
    assert.ok(rise <= maxGrade * run + 1e-9, `${e.id} → ${branch.toEdgeId}: connector grade ${rise / run}`);
  }
}

test("continuous route/lane-change envelopes and actual late/early turn connectors clear all colliders", () => {
  checkLanes(world);
  for (const j of world.junctions) {
    const e = index.edges.get(j.fromEdgeId)!.edge;
    for (const branch of j.branches) for (let lane = 0; lane < e.laneOffsetsM.length; lane++) {
      for (const at of [j.window.startM, e.lengthM - 5, e.lengthM - 1, e.lengthM]) checkConnector(world, e, branch, at, lane);
    }
  }
});

test("real kernel traverses every branch from every lane and allowed grounded mode without snapping or stalling", () => {
  for (const j of world.junctions) for (const branch of j.branches) {
    const e = index.edges.get(j.fromEdgeId)!.edge;
    for (const mode of branch.allowedModes.filter(m => m !== "lift")) for (let lane = 0; lane < e.laneOffsetsM.length; lane++) {
      let state = stateOn(e, e.lengthM - 5, lane, mode === "foot" ? "onFoot" : mode);
      let previous = poseOnRoute(index, state.route).position, entered = false;
      const label = `${e.id} → ${branch.toEdgeId} ${mode} lane ${lane}`;
      if (branch.side !== "forward") {
        const option = queryRoadActions(state, context)[branch.side];
        assert.equal(option.kind, "turn", label);
        assert.equal(option.kind === "turn" && option.toEdgeId, branch.toEdgeId, label);
      }
      for (let tick = 0; tick < 150; tick++) {
        const result = roadMovementKernel(state, { ...held, leftPressed: tick === 0 && branch.side === "left", rightPressed: tick === 0 && branch.side === "right" }, context);
        assert.ok(distance(previous, result.pose.position) <= Math.max(state.speedMps, result.state.speedMps) * dtMs / 1000 + 1e-7, `${label}: teleport`);
        assert.ok(result.state.speedMps > 0, `${label}: collision/stall`);
        state = result.state; previous = result.pose.position;
        if (state.route.edgeId === branch.toEdgeId && !state.motion?.turn) { entered = true; break; }
      }
      assert.ok(entered, label);
    }
  }
});

test("all four escape paths can be driven from the actual robber placement using the existing foot movement kernel", () => {
  const spawn = world.spawns.find(s => s.kind === "robber")!;
  for (const route of world.routes.filter(r => r.kind === "robberEscape")) {
    let state = stateOn(index.edges.get(spawn.placement.edgeId)!.edge, spawn.placement.distanceM, spawn.placement.laneIndex);
    let segment = 0, arrived = false, previous = poseOnRoute(index, state.route).position;
    const goal = world.zones.find(z => z.id === route.exitZoneId)!.volume;
    assert.equal(goal.shape, "cylinder");
    for (let tick = 0; tick < 9000; tick++) {
      const currentId = route.edgeIds[segment]!;
      assert.equal(state.route.edgeId, currentId, `${route.id}: left authored route`);
      const next = route.edgeIds[segment + 1], actions = queryRoadActions(state, context);
      const result = roadMovementKernel(state, { ...held,
        leftPressed: !!next && actions.left.kind === "turn" && actions.left.toEdgeId === next,
        rightPressed: !!next && actions.right.kind === "turn" && actions.right.toEdgeId === next }, context);
      assert.ok(result.state.speedMps > 0, `${route.id}: blocked`);
      assert.ok(distance(previous, result.pose.position) <= 0.201, `${route.id}: discontinuous motion`);
      state = result.state; previous = result.pose.position;
      if (state.route.edgeId !== currentId) { assert.equal(state.route.edgeId, next); segment++; }
      if (segment === route.edgeIds.length - 1 && goal.shape === "cylinder"
        && Math.hypot(previous.x - goal.center.x, previous.z - goal.center.z) < goal.radiusM
        && Math.abs(previous.y - goal.center.y) <= goal.heightM / 2) { arrived = true; break; }
    }
    assert.ok(arrived, route.id);
  }
});

test("default forward travel leaves every incoming edge including escape nodes, without trapping grounded modes", () => {
  for (const e of world.edges) for (const mode of e.allowedModes.filter(m => m !== "lift")) {
    let state = stateOn(e, e.lengthM - 5, 0, mode === "foot" ? "onFoot" : mode);
    for (let tick = 0; tick < 150 && state.route.edgeId === e.id; tick++) state = roadMovementKernel(state, held, context).state;
    assert.notEqual(state.route.edgeId, e.id, `${e.id} ${mode} never continues`);
    assert.ok(state.speedMps > 0);
  }
});

test("actual unsprinted foot travel through each shortcut is faster than its legal road bypass despite the bottleneck cap", () => {
  function travelMs(ids: EdgeId[]): number {
    let state = { ...stateOn(index.edges.get(ids[0]!)!.edge, 0, 1), speedMps: 0 };
    // Foot passages have only lane 0; use the centre lane consistently for both alternatives.
    state.route.laneIndex = index.edges.get(ids[0]!)!.edge.laneOffsetsM.indexOf(0);
    state.route.lateralOffsetM = 0;
    let segment = 0;
    for (let tick = 1; tick < 2000; tick++) {
      const next = ids[segment + 1], actions = queryRoadActions(state, context);
      state = roadMovementKernel(state, { ...held,
        leftPressed: !!next && actions.left.kind === "turn" && actions.left.toEdgeId === next,
        rightPressed: !!next && actions.right.kind === "turn" && actions.right.toEdgeId === next }, context).state;
      if (state.route.edgeId !== ids[segment]) { assert.equal(state.route.edgeId, next); segment++; }
      // Compare equivalent five-metre approach checkpoints before the shared destination.
      if (segment === ids.length - 1 && state.route.distanceM >= index.edges.get(ids[segment]!)!.edge.lengthM - 5) return tick * dtMs;
    }
    throw new Error(`Never reached ${ids.at(-1)}`);
  }
  for (const [shortcut, bypass] of [
    [[I.edges.arcade.out], [I.edges.westSouthB.out, I.edges.marketWestA.out]],
    [[I.edges.steps.out], [I.edges.marketEastB.out, I.edges.eastHillA.out]],
  ] as [EdgeId[], EdgeId[]][]) {
    const directMs = travelMs(shortcut), roadMs = travelMs(bypass);
    assert.ok(directMs < roadMs - 500, `${shortcut}: ${directMs} ms vs road ${roadMs} ms`);
  }
});

test("safe shop/lift waiting volumes and conservative spawn envelopes remain clear", () => {
  for (const zone of world.zones.filter(z => z.kind !== "escape")) {
    const volume = zone.volume;
    assert.equal(volume.shape, "cylinder");
    if (volume.shape !== "cylinder") continue;
    const ground = { ...volume.center, y: volume.center.y - volume.heightM / 2 };
    assert.equal(sweepBody(ground, ground, world.colliders,
      { radiusM: volume.radiusM + 0.45, heightM: 2.5, skinM: 0.01 }).fraction, 1, zone.id);
  }
  for (const spawn of world.spawns) {
    const e = index.edges.get(spawn.placement.edgeId)!.edge;
    const p = poseOnRoute(index, stateOn(e, spawn.placement.distanceM, spawn.placement.laneIndex).route).position;
    const mode = spawn.kind === "vehicle" ? spawn.vehicleType : "foot";
    assert.equal(sweepBody(p, p, world.colliders, bodyFor([mode])).fraction, 1, spawn.id);
  }
});

test("geometric acceptance rejects a thin mid-route blocker and a blocked turn that the data validator does not cover", () => {
  let w = structuredClone(world);
  w.colliders.push({ id: brandId<ColliderId>("test-road-blocker"), shape: "box", center: { x: 100, y: 5, z: 56.123 }, halfExtents: { x: 5, y: 5, z: 0.001 }, yaw: 0 });
  assert.throws(() => checkLanes(w), /travel band intersects collider/);
  w = structuredClone(world);
  const e = w.edges.find(e => e.id === I.edges.bank.out)!, branch = w.junctions.find(j => j.fromEdgeId === e.id)!.branches.find(b => b.side === "left")!;
  const curve = branchPath(indexWorld(w), stateOn(e, e.lengthM - 5, 1).route, branch).path;
  const center = curve.points[2]!;
  w.colliders.push({ id: brandId<ColliderId>("test-turn-blocker"), shape: "cylinder", center: { ...center, y: center.y + 1 }, radiusM: 0.05, heightM: 2 });
  assert.throws(() => checkConnector(w, e, branch, e.lengthM - 5, 1), /connector blocked/);
  assert.notEqual(queryRoadActions(stateOn(e, e.lengthM - 5, 1), { ...context, world: indexWorld(w) }).left.kind, "turn");
});

test("public simulation loads the new city/version in practice and six-player modes and processes real movement", () => {
  for (const count of [1, 6]) {
    const participants = Array.from({ length: count }, (_, i) => ({ playerId: brandId<PlayerId>(`city-player-${i}`), nickname: `Player ${i}`, joinOrder: i }));
    const setup = createFixtureSimulationSetup({ world, participants, mode: count === 1 ? "practice" : "normal" });
    const sim = createSimulation(), state = sim.createInitialState(setup), initial = sim.readSerializableState(state);
    assert.equal(initial.match.versions.worldVersion, "lisbon-city-1");
    assert.ok(world.routes.some(r => r.kind === "robberEscape" && r.id === initial.match.robberRouteId));
    for (let tick = 1; tick <= 900; tick++) {
      sim.step(state, participants.map(p => ({ playerId: p.playerId, sequence: tick, ...held, actions: [] })), dtMs);
      if (tick % 100 === 0) assert.deepEqual(checkSnapshotConsistency(sim.readSerializableState(state), world), []);
    }
    const final = sim.readSerializableState(state);
    assert.equal(final.match.phase, "chase");
    for (const [i, player] of final.players.entries()) assert.ok(distance(player.pose.position, initial.players[i]!.pose.position) > 50);
    // This proves the existing simulation consumes the new map. T013 robber AI and T014 transport
    // are separate unmerged worktrees and are deliberately not copied into this acceptance.
  }
});
