import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, brandId, type ColliderId, type WorldData } from "@stopthatguy/shared";
import { FIXTURE_WORLD } from "@stopthatguy/test-support";
import { indexWorld, poseOnRoute, type MovementState } from "../src/movement/index.js";
import { integrateSpeed } from "../src/movement/kinematics.js";
import { branchPath, makePolyline, projectDistance, samplePath } from "../src/movement/path.js";
import { planBranch, traverse } from "../src/movement/traversal.js";

function near(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

test("constant acceleration and braking integrate exactly across equivalent step durations", () => {
  for (const [start, target, rate] of [[0, 4, 8], [6, 0, 12], [6, 4, 6]]) {
    const expected = integrateSpeed(start!, target!, rate!, 1);
    for (const hz of [30, 60, 120]) {
      let speed = start!;
      let distance = 0;
      for (let tick = 0; tick < hz; tick++) {
        const next = integrateSpeed(speed, target!, rate!, 1 / hz);
        speed = next.speedMps;
        distance += next.distanceM;
      }
      near(speed, expected.speedMps);
      near(distance, expected.distanceM);
    }
  }
});

test("polyline traversal preserves ground height and includes every corner", () => {
  const path = makePolyline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 4 }, { x: 5, y: 3, z: 4 }]);
  near(path.lengthM, 10);
  assert.deepEqual(samplePath(path, 2.5).position, { x: 0, y: 1.5, z: 2 });
  assert.deepEqual(samplePath(path, 7.5).position, { x: 2.5, y: 3, z: 4 });
  near(samplePath(path, 7.5).yaw, Math.PI / 2);
  assert.deepEqual(samplePath(path, 99).position, path.points[2]);
});

test("committed regression-world branch connectors meet their incoming and outgoing poses", () => {
  const world = indexWorld(FIXTURE_WORLD);
  for (const junction of FIXTURE_WORLD.junctions) {
    const incoming = world.edges.get(junction.fromEdgeId)!.edge;
    for (const branch of junction.branches) {
      for (let laneIndex = 0; laneIndex < incoming.laneOffsetsM.length; laneIndex++) {
        const route = { edgeId: incoming.id, distanceM: junction.window.startM, laneIndex, lateralOffsetM: incoming.laneOffsetsM[laneIndex]! };
        const connector = branchPath(world, route, branch);
        assert.deepEqual(samplePath(connector.path, 0).position, poseOnRoute(world, route).position);
        const end = samplePath(connector.path, connector.path.lengthM).position;
        const target = poseOnRoute(world, connector.target).position;
        near(end.x, target.x);
        near(end.y, target.y);
        near(end.z, target.z);
        assert.ok(connector.target.distanceM <= world.edges.get(branch.toEdgeId)!.edge.lengthM);
      }
    }
  }
});

test("edge projection follows 3D arc distance and clamps to edge bounds", () => {
  const world = indexWorld(FIXTURE_WORLD);
  for (const edge of FIXTURE_WORLD.edges) {
    near(projectDistance(world, edge.id, edge.centerline[0]!), 0);
    const atEnd = projectDistance(world, edge.id, edge.centerline[edge.centerline.length - 1]!);
    assert.ok(atEnd <= edge.lengthM);
    const sampleDistance = edge.lengthM * 0.4;
    const point = poseOnRoute(world, { edgeId: edge.id, distanceM: sampleDistance, laneIndex: 0, lateralOffsetM: 0 }).position;
    near(projectDistance(world, edge.id, point), sampleDistance, 0.001);
  }
});

test("late turn input does not retrace the incoming anchor and duplicate endpoints retain heading", () => {
  const world = indexWorld(FIXTURE_WORLD);
  const junction = FIXTURE_WORLD.junctions.find((j) => j.branches.some((b) => b.side === "left"))!;
  const branch = junction.branches.find((b) => b.side === "left")!;
  const edge = world.edges.get(junction.fromEdgeId)!.edge;
  const route = { edgeId: edge.id, distanceM: junction.window.endM - 1, laneIndex: 0, lateralOffsetM: 0 };
  const start = poseOnRoute(world, route);
  const path = branchPath(world, route, branch).path;
  const next = samplePath(path, 0.01).position;
  const forwardDelta = (next.x - start.position.x) * Math.sin(start.yaw) + (next.z - start.position.z) * Math.cos(start.yaw);
  assert.ok(forwardDelta >= -1e-9);
  const west = makePolyline([{ x: 0, y: 0, z: 0 }, { x: -3, y: 0, z: 0 }, { x: -3, y: 0, z: 0 }]);
  near(samplePath(west, west.lengthM).yaw, -Math.PI / 2);
});

const testBody = { radiusM: 0.25, heightM: 1.5, skinM: 0.01 };
function grounded(world: ReturnType<typeof indexWorld>, edgeId: MovementState["route"]["edgeId"], distanceM: number): MovementState {
  const edge = world.edges.get(edgeId)!.edge;
  return { route: { edgeId, distanceM, laneIndex: 0, lateralOffsetM: edge.laneOffsetsM[0]! },
    speedMps: 4, stamina: DEFAULT_TUNING.movement.staminaMax, locomotion: "onFoot" };
}

test("regression dead-end turnaround consumes actual curve distance without a teleport", () => {
  const world = indexWorld(FIXTURE_WORLD);
  const junction = FIXTURE_WORLD.junctions.find((j) => j.branches.some((b) => b.side === "forward" && b.turnPath.length > 0))!;
  const outgoing = junction.branches.find((b) => b.side === "forward")!.toEdgeId;
  let current = grounded(world, junction.fromEdgeId, junction.window.startM);
  let previous = poseOnRoute(world, current.route).position;
  let reached = false;
  for (let i = 0; i < 30; i++) {
    const result = traverse(current, 1, current.route.lateralOffsetM,
      { world, tuning: DEFAULT_TUNING, dtMs: 250 }, testBody);
    assert.equal(result.blocked, false);
    const p = result.pose.position;
    assert.ok(Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z) <= 1 + 1e-8);
    previous = p;
    current = result.state;
    if (current.route.edgeId === outgoing) { reached = true; break; }
  }
  assert.equal(reached, true);
});

test("traversal stops at a thin blocker and sweeps lateral movement even while stationary", () => {
  const data = structuredClone(FIXTURE_WORLD) as WorldData;
  const base = indexWorld(data);
  const incoming = data.junctions[0]!.fromEdgeId;
  const current = grounded(base, incoming, 8);
  current.route.lateralOffsetM = 0;
  const at = poseOnRoute(base, { ...current.route, distanceM: 10 }).position;
  data.colliders = [{ id: brandId<ColliderId>("thin"), shape: "box", center: { ...at, y: at.y + 1 }, halfExtents: { x: 0.05, y: 1, z: 0.05 }, yaw: 0 }];
  const world = indexWorld(data);
  const context = { world, tuning: DEFAULT_TUNING, dtMs: 1000 / 30 };
  const swept = traverse(current, 20, 0, context, testBody);
  assert.equal(swept.blocked, true);
  assert.ok(swept.state.route.distanceM < 10);
  const lateral = { ...current, route: { ...current.route, distanceM: 10, lateralOffsetM: -1 } };
  const shifted = traverse(lateral, 0, 1, context, testBody);
  assert.equal(shifted.blocked, true);
  assert.ok(shifted.state.route.lateralOffsetM < 0);
});

test("branch planning refuses forbidden transport modes and obstructed curves", () => {
  const data = structuredClone(FIXTURE_WORLD) as WorldData;
  const junction = data.junctions[0]!;
  const branch = junction.branches[0]!;
  branch.allowedModes = ["foot"];
  let world = indexWorld(data);
  const current = grounded(world, junction.fromEdgeId, junction.window.startM);
  assert.equal(planBranch(world, { ...current, locomotion: "scooter" }, branch, testBody), null);
  assert.ok(planBranch(world, current, branch, testBody));
  const point = branch.turnPath[1]!;
  data.colliders.push({ id: brandId<ColliderId>("blocked-turn"), shape: "cylinder", center: { ...point, y: point.y + 1 }, radiusM: 1, heightM: 2 });
  world = indexWorld(data);
  assert.equal(planBranch(world, current, branch, testBody), null);
});

import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { queryRoadActions, roadMovementKernel, type MovementInput } from "../src/movement/index.js";
const neutral: MovementInput = { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: false, leftPressed: false, rightPressed: false };
const forward = { ...neutral, forwardHeld: true };
const street = indexWorld(FIRST_STREET_WORLD);
const context = (hz = 30, allowEarlyTurnBuffer = false) => ({ world: street, tuning: DEFAULT_TUNING, dtMs: 1000 / hz, allowEarlyTurnBuffer });
const onStreet = (id = "e-main-n1", distanceM = 6, laneIndex = 1): MovementState => {
  const edge = FIRST_STREET_WORLD.edges.find((e) => e.id === id)!;
  return { route: { edgeId: edge.id, distanceM, laneIndex, lateralOffsetM: edge.laneOffsetsM[laneIndex]! },
    speedMps: 0, stamina: DEFAULT_TUNING.movement.staminaMax, locomotion: "onFoot" };
};

test("road kernel acceleration/coast/brake and stamina agree at 30/60/120 Hz", () => {
  const runs = [30, 60, 120].map((hz) => {
    let state = onStreet();
    for (let i = 0; i < hz * 4; i++) state = roadMovementKernel(state, { ...forward, sprintHeld: true }, context(hz)).state;
    near(state.stamina, 20, 1e-6);
    for (let i = 0; i < hz * 2; i++) state = roadMovementKernel(state, neutral, context(hz)).state;
    near(state.stamina, 35, 1e-6);
    near(state.speedMps, 0);
    return state;
  });
  for (const state of runs) {
    near(state.route.distanceM, runs[0]!.route.distanceM, 1e-6);
    near(state.stamina, runs[0]!.stamina, 1e-6);
  }
  const moving = { ...onStreet(), speedMps: 6 };
  const braked = roadMovementKernel(moving, { ...forward, brakeHeld: true, sprintHeld: true }, { ...context(), dtMs: 500 });
  near(braked.state.speedMps, 0);
  near(braked.state.route.distanceM, 7.5);
  near(braked.state.stamina, 100);
});

test("exhausted sprint requires release; stamina recovery starts after its delay", () => {
  let state = { ...onStreet(), stamina: 1 };
  state = roadMovementKernel(state, { ...forward, sprintHeld: true }, { ...context(), dtMs: 100 }).state;
  assert.equal(state.motion?.sprintExhausted, true);
  near(state.stamina, 0);
  for (let i = 0; i < 60; i++) state = roadMovementKernel(state, { ...forward, sprintHeld: true }, context()).state;
  assert.ok(state.stamina > 0);
  near(state.speedMps, 4);
  assert.equal(queryRoadActions(state, context()).canSprint, false);
  state = roadMovementKernel(state, forward, context()).state;
  assert.equal(queryRoadActions(state, context()).canSprint, true);
  const sprint = roadMovementKernel(state, { ...forward, sprintHeld: true }, context()).state;
  assert.ok(sprint.speedMps > 4 && sprint.stamina < state.stamina);
});

test("one press shifts exactly one lane smoothly; simultaneous directions cancel", () => {
  const initial = onStreet("e-main-n1", 6, 0);
  const before = structuredClone(initial);
  let state = roadMovementKernel(initial, { ...neutral, rightPressed: true }, context()).state;
  assert.equal(state.route.laneIndex, 1);
  assert.ok(state.route.lateralOffsetM > -3 && state.route.lateralOffsetM < 0);
  for (let i = 0; i < 30; i++) state = roadMovementKernel(state, neutral, context()).state;
  near(state.route.lateralOffsetM, 0);
  assert.equal(state.route.laneIndex, 1);
  assert.deepEqual(initial, before, "kernel does not mutate caller state");
  const cancelled = roadMovementKernel(state, { ...neutral, leftPressed: true, rightPressed: true }, context());
  assert.equal(cancelled.state.route.laneIndex, 1);
  assert.equal(cancelled.state.motion?.turn, null);
  assert.equal(queryRoadActions(onStreet("e-alley-w", 10, 0), context()).left.kind, "none");
  assert.equal(queryRoadActions(onStreet("e-main-n1", 6, 2), context()).right.kind, "none");
});

test("eligible turn wins over lane shift in every lane and ignores presses while turning", () => {
  for (let lane = 0; lane < 3; lane++) {
    let state = { ...onStreet("e-main-n1", 56, lane), speedMps: 4 };
    assert.equal(queryRoadActions(state, context()).left.kind, "turn");
    state = roadMovementKernel(state, { ...forward, leftPressed: true }, context()).state;
    assert.equal(state.motion?.turn?.target.edgeId, "e-alley-w");
    assert.equal(state.motion?.laneShift, null);
    for (let i = 0; i < 150 && state.route.edgeId !== "e-alley-w"; i++) {
      state = roadMovementKernel(state, { ...forward, rightPressed: true }, context()).state;
      assert.equal(state.motion?.bufferedTurn, null);
    }
    assert.equal(state.route.edgeId, "e-alley-w");
    assert.equal(state.route.laneIndex, 0);
  }
});

test("early buffer is opt-in, expires, and never also shifts a lane", () => {
  const initial = { ...onStreet("e-main-n1", 54.5, 1), speedMps: 4 };
  assert.equal(queryRoadActions(initial, context()).left.kind, "laneChange");
  assert.deepEqual(queryRoadActions(initial, context(30, true)).left,
    { kind: "turn", junctionId: "j-cross-from-south", toEdgeId: "e-alley-w", label: street.edges.get(brandId("e-alley-w"))!.edge.label, earlyBuffer: true });
  let state = roadMovementKernel(initial, { ...forward, leftPressed: true }, context(30, true)).state;
  assert.ok(state.motion?.bufferedTurn);
  assert.equal(state.route.laneIndex, 1);
  for (let i = 0; i < 10; i++) state = roadMovementKernel(state, forward, context(30, true)).state;
  assert.ok(state.motion?.turn);
  assert.equal(state.motion?.laneShift, null);
  let expired = roadMovementKernel(initial, { ...neutral, leftPressed: true }, context(30, true)).state;
  expired.speedMps = 0;
  for (let i = 0; i < 12; i++) expired = roadMovementKernel(expired, neutral, context(30, true)).state;
  assert.equal(expired.motion?.bufferedTurn, null);
  assert.equal(expired.motion?.turn, null);
  assert.equal(expired.route.laneIndex, 1);
});

test("lookahead is speed-sized and never widens authored windows; forbidden branches fall back to lanes", () => {
  const slow = { ...onStreet("e-main-n1", 54, 1), speedMps: 4 };
  const fast = { ...slow, speedMps: 6 };
  assert.equal(queryRoadActions(slow, context()).left.kind, "laneChange");
  assert.equal(queryRoadActions(fast, context()).left.kind, "turn");
  assert.equal(queryRoadActions({ ...fast, route: { ...fast.route, distanceM: 51 }, speedMps: 20 }, context()).left.kind, "laneChange");
  assert.equal(queryRoadActions({ ...fast, locomotion: "scooter" }, context()).left.kind, "laneChange");
  const steps = { ...onStreet("e-alley-w", 35, 0), locomotion: "bicycle" as const, speedMps: 4 };
  assert.equal(queryRoadActions(steps, context()).right.kind, "none");
});

test("authored forward continuations, slopes and dead-end return consume distance without teleports", () => {
  for (const edge of ["e-main-n1", "e-main-n2", "e-alley-w"]) {
    let state = { ...onStreet(edge, edge === "e-alley-w" ? 34 : 55, edge === "e-alley-w" ? 0 : 1), speedMps: 4 };
    let prior = poseOnRoute(street, state.route);
    let changed = false;
    for (let i = 0; i < 160; i++) {
      const next = roadMovementKernel(state, forward, context());
      const a = next.pose.position, b = prior.position;
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 4 / 30 + 0.001, `${edge}: no teleport`);
      prior = next.pose;
      state = next.state;
      if (state.route.edgeId !== edge) { changed = true; break; }
    }
    assert.ok(changed, `${edge}: transitioned`);
    if (edge === "e-main-n2") assert.ok(prior.position.y > 2.5);
  }
});

test("road cues reject colliding lane shifts and turns; a forward sweep cannot tunnel", () => {
  const data = structuredClone(FIRST_STREET_WORLD) as WorldData;
  data.colliders.push({ id: brandId("lane-wall"), shape: "box", center: { x: -1.5, y: 1, z: 6 }, halfExtents: { x: 0.05, y: 1, z: 1 }, yaw: 0 });
  const ctx = { ...context(), world: indexWorld(data) };
  assert.equal(queryRoadActions(onStreet("e-main-n1", 6, 1), ctx).left.kind, "none");
  data.colliders.push({ id: brandId("turn-wall"), shape: "cylinder", center: { x: -1, y: 1, z: 59.5 }, radiusM: 1, heightM: 2 });
  const blocked = queryRoadActions({ ...onStreet("e-main-n1", 56, 1), speedMps: 4 }, { ...ctx, world: indexWorld(data) });
  assert.notEqual(blocked.left.kind, "turn");
  data.colliders.push({ id: brandId("forward-wall"), shape: "box", center: { x: 0, y: 1, z: 8 }, halfExtents: { x: 4, y: 1, z: 0.01 }, yaw: 0 });
  const hit = roadMovementKernel({ ...onStreet(), speedMps: 40 }, forward, { ...ctx, dtMs: 200, world: indexWorld(data) });
  assert.ok(hit.state.route.distanceM < 8);
  assert.equal(hit.state.speedMps, 0);
});

test("bent multi-lane edges have continuous offset poses and conservative partial collision", () => {
  const data = structuredClone(FIRST_STREET_WORLD) as WorldData;
  const edge = data.edges[0]!;
  edge.centerline = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }];
  edge.lengthM = 20;
  data.junctions = [];
  data.colliders = [];
  let world = indexWorld(data);
  let state = onStreet("e-main-n1", 9.9, 2);
  let prior = poseOnRoute(world, state.route).position;
  for (let i = 0; i < 3; i++) {
    const result = traverse(state, 0.1, 3, { ...context(), world }, testBody);
    const next = result.pose.position;
    assert.ok(Math.hypot(next.x - prior.x, next.z - prior.z) < 0.2, "no lateral teleport across bend");
    state = result.state;
    prior = next;
  }
  data.colliders = [{ id: brandId("corner-block"), shape: "box", center: { x: 3.8, y: 1, z: 7 },
    halfExtents: { x: 0.05, y: 1, z: 1 }, yaw: 0 }];
  world = indexWorld(data);
  const result = traverse(onStreet("e-main-n1", 10, 2), 4, 2, { ...context(), world }, testBody);
  assert.equal(result.blocked, true);
  const p = result.pose.position;
  assert.ok(p.x + testBody.radiusM + testBody.skinM <= 3.75 + 1e-8, "fractional route remains outside blocker");
});

test("removing explicit early-cue opt-in cancels a pending buffer before consuming it", () => {
  let state = { ...onStreet("e-main-n1", 54.9, 1), speedMps: 4 };
  state = roadMovementKernel(state, { ...forward, leftPressed: true }, context(30, true)).state;
  assert.ok(state.route.distanceM > 55 && state.motion?.bufferedTurn);
  state = roadMovementKernel(state, forward, context()).state;
  assert.equal(state.motion?.bufferedTurn, null);
  assert.equal(state.motion?.turn, null);
});
