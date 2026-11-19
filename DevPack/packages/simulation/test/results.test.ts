import assert from "node:assert/strict";
import { test } from "node:test";
import { NEUTRAL_HELD_CONTROLS, brandId, type GameEvent, type GameTuning, type PlayerId, type RouteId,
  type ValidatedPlayerInput, type ZoneId } from "@stopthatguy/shared";
import { FIXTURE_WORLD, checkEventSequence } from "@stopthatguy/test-support";
import { advanceFixedStepClock, createFixedStepClock, createSimulation, forfeitPlayer, getFixedDeltaMs } from "../src/index.js";
import { compareAttempts } from "../src/capture/memory.js";
import { toInternal } from "../src/state.js";
import { IMMEDIATE_TUNING, makeSetup, PLAYERS } from "./helpers.js";

// Public setup derived from the committed regression world. The robber approaches a real exit
// slowly; capture and escape are resolved by the actual movement/AI/tick pipeline.
function setup(tuning: GameTuning = IMMEDIATE_TUNING) {
  const world = structuredClone(FIXTURE_WORLD), edge = world.edges[0]!;
  edge.allowedModes = ["foot"]; edge.laneOffsetsM = [0]; edge.speedLimitMps = 0.1;
  world.junctions = []; world.colliders = [];
  const exit = { id: brandId<ZoneId>("capture-exit"), kind: "escape" as const, sectorId: edge.sectorId,
    volume: { shape: "cylinder" as const, center: { x: 0, y: 0, z: 40 }, radiusM: 0.05, heightM: 2 } };
  world.zones = [exit];
  world.routes = [{ id: brandId<RouteId>("capture-route"), kind: "robberEscape", edgeIds: [edge.id], exitZoneId: exit.id }];
  for (const spawn of world.spawns) spawn.placement = { edgeId: edge.id, laneIndex: 0, distanceM: spawn.kind === "robber" ? 39.6 : 39 };
  return makeSetup({ tuning, world });
}
function run(inputs: (tick: number) => ValidatedPlayerInput[] = () => [], tuning = IMMEDIATE_TUNING, ticks = 150) {
  const sim = createSimulation(), state = sim.createInitialState(setup(tuning)), events: GameEvent[] = [];
  for (let tick = 1; tick <= ticks; tick++) { sim.step(state, inputs(tick), getFixedDeltaMs(tuning)); events.push(...sim.collectEvents(state)); }
  return { sim, state, events, snapshot: sim.readSerializableState(state) };
}
const press = (playerId: PlayerId, sequence: number, id = 1): ValidatedPlayerInput => ({
  playerId, sequence, ...NEUTRAL_HELD_CONTROLS, actions: [{ id, kind: "capture" }],
});

test("same-tick capture beats actual swept escape and timeout; one-tick earlier terminal events cancel", () => {
  const escapeTick = run().snapshot.match.result!.resolvedAtTick;
  const duration = Math.ceil(IMMEDIATE_TUNING.capture.attemptMs / getFixedDeltaMs(IMMEDIATE_TUNING));
  const start = escapeTick - duration;
  for (const timeoutOffset of [0, -1]) {
    const tuning = { ...IMMEDIATE_TUNING, timing: { ...IMMEDIATE_TUNING.timing,
      chaseTimeLimitMs: (escapeTick - 1 + timeoutOffset) * getFixedDeltaMs(IMMEDIATE_TUNING) } };
    const r = run(t => t === start ? [press(PLAYERS.ana, t)] : [], tuning);
    assert.equal(r.snapshot.match.result?.reason, timeoutOffset === 0 ? "captured" : "timeout");
    assert.equal(r.events.filter(e => e.type === "matchEnded").length, 1);
    assert.equal(r.events.filter(e => e.type === "robberEscaped").length, 0);
    assert.equal(r.events.filter(e => e.type === "captureCancelled").length, timeoutOffset === 0 ? 0 : 1);
  }
  const late = run(t => t === start + 1 ? [press(PLAYERS.ana, t)] : []);
  assert.equal(late.snapshot.match.result?.reason, "escaped");
  assert.equal(late.events.filter(e => e.type === "captureCancelled").length, 1);
  assert.equal(late.events.filter(e => e.type === "captureResolved").length, 0);
});

test("simultaneous captures use stable join order, independent of frame ordering and action IDs", () => {
  for (const ids of [[PLAYERS.carla, PLAYERS.bruno, PLAYERS.ana], [PLAYERS.ana, PLAYERS.carla, PLAYERS.bruno]]) {
    const r = run(t => t === 1 ? ids.map((id, i) => press(id, 1000 - i, 100 - i)) : []);
    assert.equal(r.snapshot.match.result?.winnerId, PLAYERS.ana);
    assert.equal(r.events.filter(e => e.type === "captureResolved").length, 1);
    assert.equal(r.events.filter(e => e.type === "captureCancelled").length, 2);
    assert.deepEqual(checkEventSequence(r.events), []);
  }
  const earlier = run(t => t === 1 ? [press(PLAYERS.carla, 1)] : t === 2 ? [press(PLAYERS.ana, 1)] : []);
  assert.equal(earlier.snapshot.match.result?.winnerId, PLAYERS.carla, "earlier completion beats earlier join order");
  const join = (id: PlayerId) => id === PLAYERS.ana ? 0 : 1;
  const a = { playerId: PLAYERS.ana, completionTick: 20, startTick: 10 };
  const b = { playerId: PLAYERS.bruno, completionTick: 20, startTick: 9 };
  assert.ok(compareAttempts(a, b, join) > 0, "equal completion uses earlier start before join order");
});

test("arrest at completion invalidates that capture; another eligible competitor may win", () => {
  const sim = createSimulation(), state = sim.createInitialState(setup());
  const dt = getFixedDeltaMs(IMMEDIATE_TUNING);
  sim.step(state, [press(PLAYERS.ana, 1), press(PLAYERS.bruno, 1)], dt);
  for (let i = 0; i < 10; i++) sim.step(state, [], dt);
  // Existing participation fixture substitutes only the future police stage, not capture resolution.
  toInternal(state).players[0]!.participation = "arrested";
  sim.step(state, [], dt);
  assert.equal(sim.readSerializableState(state).match.result?.winnerId, PLAYERS.bruno);
  assert.equal(sim.collectEvents(state).find(e => e.type === "captureCancelled")?.type, "captureCancelled");
});

test("trusted departures cancel idempotently and allCompetitorsOut resolves on the next chase tick", () => {
  const sim = createSimulation(), state = sim.createInitialState(setup()), dt = getFixedDeltaMs(IMMEDIATE_TUNING);
  sim.step(state, [press(PLAYERS.ana, 1)], dt); sim.collectEvents(state);
  forfeitPlayer(state, PLAYERS.ana); forfeitPlayer(state, PLAYERS.ana);
  const cancelled = sim.collectEvents(state);
  assert.equal(cancelled.length, 1); assert.equal(cancelled[0]!.type, "captureCancelled");
  assert.equal(sim.readSerializableState(state).players[0]!.participation, "forfeit");
  forfeitPlayer(state, PLAYERS.bruno); forfeitPlayer(state, PLAYERS.carla);
  assert.equal(sim.readSerializableState(state).match.result, null, "departure cannot publish outside the tick");
  sim.step(state, [press(PLAYERS.ana, 2, 2)], dt);
  assert.equal(sim.readSerializableState(state).match.result?.reason, "allCompetitorsOut");
  assert.deepEqual(sim.collectEvents(state).map(e => e.type), ["matchEnded"]);
  forfeitPlayer(state, PLAYERS.ana); sim.step(state, [], dt);
  assert.deepEqual(sim.collectEvents(state), []);
  assert.throws(() => forfeitPlayer(state, brandId<PlayerId>("unknown")), RangeError);
});

test("active passengers and stunned players still count; spectators do not, and countdown cannot end a match", () => {
  for (const kind of ["passenger", "stunned", "spectator"] as const) {
    const sim = createSimulation(), state = sim.createInitialState(setup());
    forfeitPlayer(state, PLAYERS.bruno); forfeitPlayer(state, PLAYERS.carla);
    const p = toInternal(state).players[0]!;
    if (kind === "passenger") p.locomotion = "passenger";
    if (kind === "stunned") p.status.stunnedUntilTick = 100;
    if (kind === "spectator") p.participation = "spectator";
    sim.step(state, [press(p.id, 1)], getFixedDeltaMs(IMMEDIATE_TUNING));
    assert.equal(sim.readSerializableState(state).match.result?.reason ?? null, kind === "spectator" ? "allCompetitorsOut" : null);
  }
  const tuning = { ...IMMEDIATE_TUNING, timing: { ...IMMEDIATE_TUNING.timing, countdownMs: 1000 } };
  const sim = createSimulation(), state = sim.createInitialState(setup(tuning));
  for (const id of Object.values(PLAYERS)) forfeitPlayer(state, id);
  sim.step(state, [], getFixedDeltaMs(tuning));
  assert.equal(sim.readSerializableState(state).match.result, null);
});

test("capture result, competitive state and event publication are immutable after all later inputs/departures", () => {
  const r = run(t => t === 1 ? [press(PLAYERS.ana, 1)] : []), original = structuredClone(r.snapshot);
  const ended = r.events.find(e => e.type === "matchEnded")!;
  if (ended.type === "matchEnded") (ended.result as { winnerId: unknown }).winnerId = PLAYERS.bruno;
  r.snapshot.match.result = null; r.snapshot.robber!.pose.position.x = 1000;
  for (let t = 151; t <= 180; t++) r.sim.step(r.state, [press(PLAYERS.bruno, t, t)], getFixedDeltaMs(IMMEDIATE_TUNING));
  forfeitPlayer(r.state, PLAYERS.ana);
  const after = r.sim.readSerializableState(r.state);
  assert.deepEqual(after.match.result, original.match.result); assert.deepEqual(after.robber, original.robber);
  assert.deepEqual(after.players.map(p => [p.pose, p.stamina, p.speedMps]), original.players.map(p => [p.pose, p.stamina, p.speedMps]));
  assert.deepEqual(r.sim.collectEvents(r.state), []);
  assert.deepEqual(after.match.result!.awards, []); assert.deepEqual(after.match.result!.stats, []);
});

test("equivalent 30/60/144 FPS elapsed samples produce identical fixed-tick capture results/events", () => {
  const play = (fps: number) => {
    const sim = createSimulation(), state = sim.createInitialState(setup()), clock = createFixedStepClock(), dt = getFixedDeltaMs(IMMEDIATE_TUNING);
    let tick = 0;
    for (let i = 0; i < fps; i++) {
      const { steps, droppedMs } = advanceFixedStepClock(clock, 1000 / fps, dt); assert.equal(droppedMs, 0);
      for (let j = 0; j < steps; j++) sim.step(state, ++tick === 1 ? [press(PLAYERS.ana, tick)] : [], dt);
    }
    return { snapshot: sim.readSerializableState(state), events: sim.collectEvents(state) };
  };
  assert.deepEqual(play(30), play(60)); assert.deepEqual(play(60), play(144));
  assert.equal(play(30).snapshot.match.result?.reason, "captured");
});

import { LISBON_CITY_WORLD, LISBON_CITY_IDS as CITY } from "@stopthatguy/world";
import { createFixtureSimulationSetup, checkSnapshotConsistency } from "@stopthatguy/test-support";

test("unmodified authored city: normal spawns and shortcut interception legally capture seed 4 on public ticks", () => {
  const sim = createSimulation();
  const initial = createFixtureSimulationSetup({ world: LISBON_CITY_WORLD, seed: 4 });
  const state = sim.createInitialState(initial), local = sim.readSerializableState(state).players[0]!.id;
  const path = [CITY.edges.bank.out, CITY.edges.marketWestB.back, CITY.edges.arcade.back, CITY.edges.westSouthA.back];
  assert.equal(sim.readSerializableState(state).match.robberRouteId, CITY.routes.west);
  let nextIndex = 1, action = 0, sawPlayerTurn = false, sawRobberTurn = false;
  const events: GameEvent[] = [];
  for (let tick = 1; tick <= 6000; tick++) {
    const before = sim.readSerializableState(state), player = before.players.find(p => p.id === local)!, robber = before.robber!;
    if (before.match.result) break;
    if (player.route!.edgeId === path[nextIndex]) nextIndex++;
    const next = path[nextIndex], legal = sim.queryLegalActions(state, local);
    const actions: ValidatedPlayerInput["actions"][number][] = [];
    for (const side of ["left", "right"] as const) {
      if (legal[side].kind === "turn" && legal[side].toEdgeId === next) actions.push({ id: ++action, kind: side });
    }
    if (legal.canCapture) actions.push({ id: ++action, kind: "capture" });
    // Follow the shortcut then wait at the west approach. Start moving when the robber draws level.
    const wait = player.route!.edgeId === path.at(-1)
      && (robber.route!.edgeId !== path.at(-1) || robber.route!.distanceM < player.route!.distanceM - 0.5);
    sim.step(state, [{ playerId: local, sequence: tick, ...NEUTRAL_HELD_CONTROLS, forwardHeld: !wait, sprintHeld: true, actions }], getFixedDeltaMs(initial.tuning));
    const after = sim.readSerializableState(state), moved = after.players.find(p => p.id === local)!;
    sawPlayerTurn ||= Math.abs(moved.pose.yaw - player.pose.yaw) > 0.01;
    sawRobberTurn ||= Math.abs(after.robber!.pose.yaw - robber.pose.yaw) > 0.01;
    if (tick % 300 === 0) assert.deepEqual(checkSnapshotConsistency(after, LISBON_CITY_WORLD), []);
    events.push(...sim.collectEvents(state));
  }
  const result = sim.readSerializableState(state).match.result;
  assert.ok(sawPlayerTurn && sawRobberTurn);
  assert.equal(result?.winnerId, local); assert.equal(result?.reason, "captured");
  assert.equal(result?.resolvedAtTick, 5589);
  assert.equal(events.filter(e => e.type === "captureStarted").length, 1);
  assert.equal(events.filter(e => e.type === "captureResolved").length, 1);
  assert.equal(events.filter(e => e.type === "matchEnded").length, 1);
});
