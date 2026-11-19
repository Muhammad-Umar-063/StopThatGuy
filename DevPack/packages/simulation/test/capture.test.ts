import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, brandId,
  type ColliderId, type GameTuning, type ValidatedPlayerInput, type WorldData } from "@stopthatguy/shared";
import { FIXTURE_WORLD, checkEventSequence } from "@stopthatguy/test-support";
import { createSimulation, getFixedDeltaMs } from "../src/index.js";
import { toInternal } from "../src/state.js";
import { IMMEDIATE_TUNING, makeSetup, PLAYERS } from "./helpers.js";

// Isolated capture arena derived from the committed fixture. No fake movement kernel:
// the robber rests at a foot-only dead end, players start one metre behind it.
function arena(): WorldData {
  const world = structuredClone(FIXTURE_WORLD);
  const edge = world.edges[0]!;
  edge.allowedModes = ["foot"]; edge.laneOffsetsM = [0];
  world.junctions = []; world.routes = []; world.zones = []; world.colliders = [];
  for (const spawn of world.spawns) {
    spawn.placement = { edgeId: edge.id, distanceM: edge.lengthM - (spawn.kind === "robber" ? 0 : 1), laneIndex: 0 };
  }
  return world;
}
function game(tuning: GameTuning = IMMEDIATE_TUNING, world = arena()) {
  const sim = createSimulation();
  const state = sim.createInitialState(makeSetup({ tuning, world }));
  const dt = getFixedDeltaMs(tuning);
  return { sim, state, dt, step: (inputs: ValidatedPlayerInput[] = []) => sim.step(state, inputs, dt),
    snapshot: () => sim.readSerializableState(state), events: () => sim.collectEvents(state) };
}
function press(playerId = PLAYERS.ana, id = 1, sequence = id): ValidatedPlayerInput {
  return { playerId, sequence, ...NEUTRAL_HELD_CONTROLS, actions: [{ id, kind: "capture" }] };
}

test("public F action starts once, winds up for the configured duration, and publishes one capture", () => {
  const g = game();
  assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, false);
  g.step();
  assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, true);
  g.step([press()]);
  const events = g.events();
  const start = events.find(e => e.type === "captureStarted")!;
  assert.equal(start.tick, 2);
  assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, false, "an active attempt cannot be restarted");
  const duration = Math.ceil(DEFAULT_TUNING.capture.attemptMs / g.dt);
  for (let i = 1; i <= duration; i++) {
    g.step([press(PLAYERS.ana, 1, 2 + i)]);
    events.push(...g.events());
    assert.equal(g.snapshot().match.result !== null, i === duration);
  }
  assert.equal(g.snapshot().match.result?.winnerId, PLAYERS.ana);
  assert.equal(g.snapshot().match.result?.resolvedAtTick, start.tick + duration);
  assert.equal(g.snapshot().robber!.aiState, "captured");
  assert.deepEqual(events.map(e => e.type), ["matchStarted", "captureStarted", "captureResolved", "matchEnded"]);
  assert.deepEqual(checkEventSequence(events), []);
  assert.deepEqual(g.events(), []);
});

test("missed and premature presses are consumed; neither a replay nor proximity alone starts capture", () => {
  const g = game({ ...IMMEDIATE_TUNING, timing: { ...IMMEDIATE_TUNING.timing, countdownMs: 100 } });
  g.step([press()]);
  g.step(); g.step([press(PLAYERS.ana, 1, 3)]);
  for (let i = 0; i < 20; i++) g.step();
  assert.equal(g.snapshot().match.result, null);
  assert.equal(g.events().filter(e => e.type.startsWith("capture")).length, 0);
  g.step([press(PLAYERS.ana, 2, 24)]);
  assert.equal(g.events()[0]!.type, "captureStarted");
});

test("capture uses actual lane motion: an eligible cue is not a promise of success next tick", () => {
  const g = game(); g.step();
  const s = toInternal(g.state), p = s.playersById.get(PLAYERS.ana)!;
  s.world.world.edges[0]!.laneOffsetsM = [0, 2];
  assert.equal(g.sim.queryLegalActions(g.state, p.id).canCapture, true);
  g.step([{ ...press(), actions: [{ id: 1, kind: "right" }, { id: 2, kind: "capture" }] }]);
  assert.ok(Math.abs(s.captureMotion.players.get(p.id)!.x) > DEFAULT_TUNING.capture.maxRelativeSpeedMps);
  assert.equal(g.events().filter(e => e.type === "captureStarted").length, 0);
  assert.equal(g.sim.queryLegalActions(g.state, p.id).canCapture, false);
});

test("malformed adapter actions fail atomically before any tick or acknowledgement", () => {
  const g = game(); const before = g.snapshot();
  const bad = [
    { ...press(), actions: [{ id: 1, kind: "win" }] },
    { ...press(), actions: [{ id: 0, kind: "capture" }] },
    { ...press(), actions: [{ id: 1, kind: "capture" }, { id: 1, kind: "capture" }] },
    { ...press(), actions: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, kind: "capture" })) },
    { ...press(), forwardHeld: 1 },
  ];
  for (const input of bad) {
    assert.throws(() => g.step([input as ValidatedPlayerInput]), RangeError);
    assert.deepEqual(g.snapshot(), before);
  }
});

test("range includes exactly the configured 3D boundary; facing includes cone edge but excludes behind", () => {
  const g = game(); g.step();
  const s = toInternal(g.state), p = s.playersById.get(PLAYERS.ana)!;
  const r = s.robber.pose.position;
  const can = () => g.sim.queryLegalActions(g.state, p.id).canCapture;
  p.pose = { position: { ...r, z: r.z - DEFAULT_TUNING.capture.rangeM }, yaw: 0 };
  assert.equal(can(), true);
  p.pose.position.z -= 1e-6; assert.equal(can(), false);
  p.pose.position = { ...r, y: r.y - DEFAULT_TUNING.capture.rangeM }; assert.equal(can(), true);
  p.pose.position.y -= 1e-6; assert.equal(can(), false, "different floors cannot grab through height");
  p.pose.position = { ...r, z: r.z - 1 };
  p.pose.yaw = DEFAULT_TUNING.capture.facingHalfAngleDeg * Math.PI / 180;
  assert.equal(can(), true);
  p.pose.yaw += 1e-6; assert.equal(can(), false);
  p.pose.yaw = Math.PI; assert.equal(can(), false);
  p.pose.position = { ...r }; assert.equal(can(), true, "coincident positions have no facing direction");
});

test("relative velocity considers opposing directions; mounted speed is an additional inclusive gate", () => {
  const g = game(); g.step();
  const s = toInternal(g.state), p = s.playersById.get(PLAYERS.ana)!;
  const can = () => g.sim.queryLegalActions(g.state, p.id).canCapture;
  const motion = (x: number, z: number) => s.captureMotion.players.set(p.id, { x, y: 0, z });
  motion(0, DEFAULT_TUNING.capture.maxRelativeSpeedMps);
  assert.equal(can(), true); motion(0, DEFAULT_TUNING.capture.maxRelativeSpeedMps + 1e-6); assert.equal(can(), false);
  motion(0, 2); s.captureMotion.robber = { x: 0, y: 0, z: -2 };
  assert.equal(can(), false, "equal scalar speeds in opposite directions are not zero relative speed");
  s.captureMotion.robber.z = 2; assert.equal(can(), true);
  for (const mode of ["bicycle", "scooter"] as const) {
    p.locomotion = mode;
    const limit = DEFAULT_TUNING.capture.maxMountedSpeedMps;
    motion(limit, 0); s.captureMotion.robber = { x: limit, y: 0, z: 0 };
    assert.equal(can(), true);
    motion(limit + 1e-6, 0); s.captureMotion.robber.x = limit + 1e-6; assert.equal(can(), false);
  }
  p.locomotion = "onFoot"; assert.equal(can(), true, "foot speed has no mounted gate");
});

test("authored boxes, rotated corners and cylinders block torso LOS; low props and camera-only proxies do not", () => {
  const cases = [
    { shape: "box" as const, center: { x: 0, y: 0.9, z: 39.5 }, halfExtents: { x: 0.2, y: 0.8, z: 0.01 }, yaw: 0 },
    { shape: "box" as const, center: { x: 0.15, y: 0.9, z: 39.5 }, halfExtents: { x: 0.2, y: 0.8, z: 0.1 }, yaw: Math.PI / 4 },
    { shape: "cylinder" as const, center: { x: 0, y: 0.9, z: 39.5 }, radiusM: 0.15, heightM: 1.6 },
  ];
  for (const volume of cases) {
    const world = arena(), g = game(IMMEDIATE_TUNING, world); g.step();
    // Inject obstacles after initialization: a future blocker/effect fixture, preserving robber position.
    world.colliders.push({ ...volume, id: brandId<ColliderId>("capture-wall") });
    assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, false);
    g.step([press()]); assert.equal(g.events().filter(e => e.type === "captureStarted").length, 0);
    world.cameraObstructions = world.colliders; world.colliders = [];
    assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, true);
  }
  const world = arena(), g = game(IMMEDIATE_TUNING, world); g.step();
  world.colliders.push({ shape: "box", yaw: 0, id: brandId<ColliderId>("low-prop"), center: { x: 0, y: 0.1, z: 39.5 }, halfExtents: { x: 0.2, y: 0.1, z: 0.1 } });
  assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, true);
});

test("status/mode/phase changes cancel once and a repeated action cannot revive the attempt", () => {
  const cases: [string, (s: ReturnType<typeof toInternal>) => void, string][] = [
    ["range", s => { s.players[0]!.route!.distanceM -= 3; }, "outOfRange"],
    ["stun", s => { s.players[0]!.status.stunnedUntilTick = s.match.tick + 5; }, "stunned"],
    ["arrest", s => { s.players[0]!.participation = "arrested"; }, "arrested"],
    ["forfeit", s => { s.players[0]!.participation = "forfeit"; }, "ineligible"],
    ["spectator", s => { s.players[0]!.participation = "spectator"; }, "ineligible"],
    ["passenger", s => { s.players[0]!.locomotion = "passenger"; }, "ineligible"],
    ["disconnect", s => { s.players[0]!.connection = "disconnected"; }, "ineligible"],
    ["phase", s => { s.match.phase = "results"; }, "phaseEnded"],
    ["speed", s => { s.players[0]!.speedMps = 10; }, "tooFast"],
  ];
  for (const [label, mutate, reason] of cases) {
    const g = game(); g.step([press()]);
    assert.equal(g.events().filter(e => e.type === "captureStarted").length, 1, label);
    mutate(toInternal(g.state)); g.step([press(PLAYERS.ana, 1, 2)]);
    const cancelled = g.events().filter(e => e.type === "captureCancelled");
    assert.deepEqual(cancelled.map(e => e.type === "captureCancelled" && e.reason), [reason], label);
    for (let i = 0; i < 20; i++) g.step([press(PLAYERS.ana, 1, i + 3)]);
    assert.equal(g.events().filter(e => e.type.startsWith("capture")).length, 0, label);
    assert.notEqual(g.snapshot().match.result?.winnerId, PLAYERS.ana, label);
  }
});

test("stun ends at its exact tick; a new press after cancellation can succeed", () => {
  const g = game(); g.step([press()]); g.events();
  const p = toInternal(g.state).players[0]!;
  p.status.stunnedUntilTick = 4;
  g.step(); assert.equal(g.events()[0]!.type, "captureCancelled");
  g.step([press(PLAYERS.ana, 2)]); assert.deepEqual(g.events(), []);
  g.step([press(PLAYERS.ana, 3)]); assert.equal(g.events()[0]!.type, "captureStarted");
  for (let i = 0; i < 11; i++) g.step();
  assert.equal(g.snapshot().match.result?.winnerId, PLAYERS.ana);
});

test("noncompetitors/passengers cannot start; capture state resets with a fresh match", () => {
  for (const participation of ["spectator", "forfeit", "arrested"] as const) {
    const g = game(); toInternal(g.state).players[0]!.participation = participation;
    g.step([press()]);
    assert.equal(g.sim.queryLegalActions(g.state, PLAYERS.ana).canCapture, false);
    assert.equal(g.events().filter(e => e.type.startsWith("capture")).length, 0);
  }
  const g = game(); toInternal(g.state).players[0]!.locomotion = "passenger"; g.step([press()]);
  assert.equal(g.events().filter(e => e.type.startsWith("capture")).length, 0);
  const fresh = game(); fresh.step([press()]); assert.equal(fresh.events().filter(e => e.type === "captureStarted").length, 1);
  assert.ok(!("captureAttempts" in fresh.snapshot()), "private attempt memory never becomes wire state");
});

test("real movement at exact speed limits tolerates position subtraction roundoff, but not excess speed", () => {
  for (const excess of [0, 1e-6]) {
    const world = arena(); world.edges[0]!.speedLimitMps = DEFAULT_TUNING.capture.maxRelativeSpeedMps + excess;
    const g = game(IMMEDIATE_TUNING, world), s = toInternal(g.state), p = s.players[0]!;
    p.speedMps = world.edges[0]!.speedLimitMps;
    g.step([{ ...press(), forwardHeld: true }]);
    assert.equal(g.events().some(e => e.type === "captureStarted"), excess === 0);
  }
});

test("a real corner crossing contributes both displacement components during a capture wind-up", () => {
  const world = arena(), edge = world.edges[0]!;
  edge.centerline = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 39.5 }, { x: 0.5, y: 0, z: 39.5 }];
  for (const spawn of world.spawns.filter(p => p.kind === "player")) spawn.placement.distanceM = 39.49;
  const g = game(IMMEDIATE_TUNING, world); let crossed = false;
  for (let tick = 1; tick <= 16; tick++) {
    g.step([{ ...press(PLAYERS.ana, tick, tick), forwardHeld: true }]);
    const velocity = toInternal(g.state).captureMotion.players.get(PLAYERS.ana);
    if (velocity && velocity.x > 0 && velocity.z > 0) {
      crossed = true;
      const player = g.snapshot().players[0]!;
      assert.equal(player.pose.yaw, Math.PI / 2);
      assert.ok(velocity.z > 0.01, "yaw-only motion would discard the incoming component");
    }
  }
  assert.ok(crossed); assert.equal(g.snapshot().match.result?.winnerId, PLAYERS.ana);
});

test("losing LOS or facing during wind-up cancels without waiting for completion", () => {
  const world = arena(), g = game(IMMEDIATE_TUNING, world); g.step([press()]); g.events();
  world.colliders.push({ id: brandId<ColliderId>("wall-added"), shape: "box", center: { x: 0, y: 1, z: 39.5 },
    halfExtents: { x: 0.2, y: 1, z: 0.01 }, yaw: 0 });
  g.step(); assert.equal(g.events().find(e => e.type === "captureCancelled")?.reason, "lostSight");
  const turnWorld = arena();
  // The genuine road kernel follows this U-bend, turning the player away from a stationary robber.
  const edge = turnWorld.edges[0]!;
  edge.centerline = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 39.5 }, { x: 0.01, y: 0, z: 39.5 }, { x: 0.01, y: 0, z: 39.01 }];
  for (const spawn of turnWorld.spawns.filter(p => p.kind === "player")) spawn.placement.distanceM = 39.49;
  const turned = game(IMMEDIATE_TUNING, turnWorld);
  // Future authoritative heading change fixture: testing cancellation, not introducing steering controls.
  const s = toInternal(turned.state); s.robber.pose.position = { x: 0, y: 0, z: 40 };
  s.robberMemory.halted = true;
  turned.step([press()]); assert.ok(turned.events().some(e => e.type === "captureStarted"));
  let cancellation = false;
  for (let tick = 2; tick <= 12; tick++) {
    turned.step([{ ...press(PLAYERS.ana, 1, tick), forwardHeld: true }]);
    cancellation ||= turned.events().some(e => e.type === "captureCancelled" && e.reason === "notFacing");
  }
  assert.ok(cancellation);
});

test("invalid capture tuning is rejected before state creation", () => {
  for (const patch of [{ rangeM: 0 }, { attemptMs: 0 }, { attemptMs: Infinity }, { maxRelativeSpeedMps: -1 },
    { maxMountedSpeedMps: NaN }, { facingHalfAngleDeg: 0 }, { facingHalfAngleDeg: 181 }]) {
    assert.throws(() => game({ ...IMMEDIATE_TUNING, capture: { ...IMMEDIATE_TUNING.capture, ...patch } }), /capture tuning/);
  }
});
