import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_TUNING, WORLD_SCHEMA_VERSION, brandId, type EdgeId, type RouteId, type WorldData, type ZoneId } from "@stopthatguy/shared";
import { FIXTURE_IDS, FIXTURE_WORLD, checkEventSequence, checkSnapshotConsistency } from "@stopthatguy/test-support";
import { createSimulation, getFixedDeltaMs, type MovementInput } from "../src/index.js";
import {
  IMMEDIATE_TUNING,
  PLAYERS,
  SHORT_TUNING,
  makeSetup,
  recordingKernel,
  runMatch,
  scriptedInputs,
  testAdvanceKernel,
} from "./helpers.js";

const sim = createSimulation();
const close = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-3, `${label}: ${actual} ≠ ${expected}`);

describe("initial state", () => {
  test("places players in join order on the world's spawns and schedules phases from tuning", () => {
    const snapshot = sim.readSerializableState(sim.createInitialState(makeSetup()));
    const m = snapshot.match;
    assert.deepEqual(snapshot.players.map((p) => p.id), [PLAYERS.ana, PLAYERS.bruno, PLAYERS.carla]);
    assert.equal(m.hostId, PLAYERS.ana);
    assert.deepEqual([m.phase, m.tick, m.phaseEndsAtTick, m.chaseStartTick, m.chaseEndTick], ["countdown", 0, 90, 330, 11_130]);
    // sp-player-1: e-bank-north (heading +Z) at 4 m, lane 0 = -1.5 m, i.e. 1.5 m to the left (−X).
    const ana = snapshot.players[0]!;
    assert.deepEqual(ana.pose, { position: { x: -1.5, y: 0, z: 4 }, yaw: 0 });
    // sp-shop-scooter: e-junction-east (heading +X, climbing 2 m over 30.067 m) at 15 m, lane 1 = 1.5 m right (−Z).
    const scooter = snapshot.vehicles.find((v) => v.id === "sp-shop-scooter")!;
    close(scooter.pose.position.x, (15 * 30) / Math.hypot(30, 2), "scooter x");
    close(scooter.pose.position.y, (15 * 2) / Math.hypot(30, 2), "scooter y");
    close(scooter.pose.position.z, 38.5, "scooter z");
    close(scooter.pose.yaw, Math.PI / 2, "scooter yaw");
    assert.deepEqual(checkSnapshotConsistency(snapshot, FIXTURE_WORLD), []);
  });

  test("rejects invalid setups", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ playerId: brandId<typeof PLAYERS.ana>(`p${i}`), nickname: `P${i}`, joinOrder: i }));
    const one = [{ playerId: PLAYERS.ana, nickname: "Ana", joinOrder: 0 }];
    const invalid = [
      makeSetup({ participants: seven }),
      makeSetup({ participants: one }),
      makeSetup({ participants: [...one, { playerId: PLAYERS.ana, nickname: "Ana", joinOrder: 1 }] }),
      makeSetup({ participants: [...one, { playerId: PLAYERS.bruno, nickname: "‮bad", joinOrder: 1 }] }),
      makeSetup({ roomCode: "io01o" }),
      makeSetup({ seed: -1 }),
      makeSetup({ seed: 1.5 }),
      makeSetup({ world: { ...FIXTURE_WORLD, schemaVersion: WORLD_SCHEMA_VERSION + 1 } }),
      makeSetup({ tuning: { ...DEFAULT_TUNING, timing: { ...DEFAULT_TUNING.timing, simulationHz: 0 } } }),
      makeSetup({ tuning: { ...DEFAULT_TUNING, timing: { ...DEFAULT_TUNING.timing, chaseTimeLimitMs: 0 } } }),
    ];
    for (const setup of invalid) assert.throws(() => sim.createInitialState(setup), RangeError);
    assert.doesNotThrow(() => sim.createInitialState(makeSetup({ mode: "practice", participants: one })));
  });
});

describe("determinism", () => {
  test("the same setup and inputs reproduce every snapshot and event", () => {
    const moving = createSimulation({ movement: testAdvanceKernel });
    const first = runMatch(moving, makeSetup({ tuning: SHORT_TUNING }), 130);
    const second = runMatch(moving, makeSetup({ tuning: SHORT_TUNING }), 130);
    assert.deepEqual(second.snapshots, first.snapshots);
    assert.deepEqual(second.events, first.events);
    // Guard against a vacuous comparison: the scripted inputs really changed the state.
    const start = first.snapshots[0]!.players[0]!;
    const end = first.snapshots.at(-1)!.players[0]!;
    // Forward is held on ticks 40–99, but movement only runs from the chase start (tick 60): 40 ticks at 4 m/s.
    close(end.route!.distanceM, start.route!.distanceM + (40 * 4) / 30, "Ana's distance");
    assert.equal(end.route!.laneIndex, start.route!.laneIndex, "right then left returns to the original lane");
    assert.ok(first.snapshots.some((s) => s.players[0]!.route!.laneIndex !== start.route!.laneIndex), "a lane change happened");
  });

  test("the seed selects the robber route reproducibly", () => {
    const world = structuredClone(FIXTURE_WORLD) as WorldData;
    world.routes.push({
      id: brandId<RouteId>("r-robber-stairs"),
      kind: "robberEscape",
      edgeIds: [FIXTURE_IDS.edges.bankNorth, FIXTURE_IDS.edges.junctionEast, brandId<EdgeId>("e-east-stairs")],
      exitZoneId: brandId<ZoneId>("z-river-escape"),
    });
    const choose = (seed: number) => sim.readSerializableState(sim.createInitialState(makeSetup({ world, seed }))).match.robberRouteId;
    const choices = Array.from({ length: 64 }, (_, seed) => choose(seed));
    assert.deepEqual(new Set(choices), new Set(["r-robber-river", "r-robber-stairs"]), "both routes occur across seeds");
    for (let seed = 0; seed < 64; seed++) assert.equal(choose(seed), choices[seed], `seed ${seed} is stable`);
  });
});

describe("fixed-step clock and phases", () => {
  test("each step advances exactly one tick through countdown → intro → chase → results", () => {
    const { snapshots, events } = runMatch(createSimulation({ movement: testAdvanceKernel }), makeSetup({ tuning: SHORT_TUNING }), 125);
    snapshots.forEach((s, i) => assert.equal(s.match.tick, i));
    const phaseAt = (tick: number) => snapshots[tick]!.match.phase;
    assert.deepEqual([phaseAt(29), phaseAt(30), phaseAt(59), phaseAt(60), phaseAt(119), phaseAt(120), phaseAt(125)], [
      "countdown",
      "intro",
      "intro",
      "chase",
      "chase",
      "results",
      "results",
    ]);
    assert.deepEqual(
      events.map((e) => [e.type, e.id, e.tick]),
      [
        ["matchStarted", 1, 60],
        ["matchEnded", 2, 120],
      ],
    );
    const result = snapshots[125]!.match.result;
    assert.deepEqual(result && [result.outcome, result.reason, result.winnerId, result.resolvedAtTick], ["noWinner", "timeout", null, 120]);
    assert.deepEqual(checkEventSequence(events), []);
    for (const snapshot of snapshots) assert.deepEqual(checkSnapshotConsistency(snapshot, FIXTURE_WORLD, SHORT_TUNING), [], `tick ${snapshot.match.tick}`);
  });

  test("zero-length countdown and intro start the chase on the first step", () => {
    const { snapshots, events } = runMatch(sim, makeSetup({ tuning: IMMEDIATE_TUNING }), 1);
    assert.equal(snapshots[1]!.match.phase, "chase");
    assert.deepEqual(events.map((e) => [e.type, e.tick]), [["matchStarted", 1]]);
  });

  test("invalid fixed deltas throw and leave the state unchanged", () => {
    const state = sim.createInitialState(makeSetup());
    const dt = getFixedDeltaMs(DEFAULT_TUNING);
    sim.step(state, [], dt);
    const before = sim.readSerializableState(state);
    for (const delta of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -dt, 33, 1000 / 60, 2 * dt]) {
      assert.throws(() => sim.step(state, scriptedInputs(2), delta), RangeError, `delta ${delta}`);
      assert.deepEqual(sim.readSerializableState(state), before);
    }
    sim.step(state, [], dt + 1e-9);
    assert.equal(sim.readSerializableState(state).match.tick, 2);
  });
});

describe("inputs", () => {
  test("malformed adapter input throws before any change", () => {
    const state = sim.createInitialState(makeSetup());
    const dt = getFixedDeltaMs(DEFAULT_TUNING);
    const before = sim.readSerializableState(state);
    const base = { playerId: PLAYERS.ana, sequence: 1, forwardHeld: true, brakeHeld: false, sprintHeld: false, interactHeld: false, actions: [] };
    const bad = [
      [{ ...base, playerId: brandId<typeof PLAYERS.ana>("p-ghost") }],
      [base, { ...base, sequence: 2 }],
      [{ ...base, sequence: -1 }],
      [{ ...base, actions: [{ id: 3, kind: "left" as const }, { id: 2, kind: "right" as const }] }],
    ];
    for (const inputs of bad) assert.throws(() => sim.step(state, inputs, dt), RangeError);
    assert.deepEqual(sim.readSerializableState(state), before);
  });

  test("edge actions apply exactly once despite resends; omitted players get neutral input", () => {
    const log: MovementInput[] = [];
    const recorder = createSimulation({ movement: recordingKernel(log) });
    const { snapshots } = runMatch(recorder, makeSetup({ tuning: IMMEDIATE_TUNING }), 3, (tick) => [
      {
        playerId: PLAYERS.ana,
        sequence: 10 + tick,
        forwardHeld: true,
        brakeHeld: false,
        sprintHeld: false,
        interactHeld: false,
        actions: tick === 1 ? [{ id: 1, kind: "left" }] : [{ id: 1, kind: "left" }, { id: 2, kind: "capture" }],
      },
    ]);
    // Three grounded players per tick, in join order: Ana, Bruno (omitted), Carla (omitted).
    const ana = log.filter((_, i) => i % 3 === 0);
    assert.deepEqual(ana.map((input) => input.leftPressed), [true, false, false]);
    for (const [i, input] of log.entries()) {
      if (i % 3 !== 0) assert.deepEqual(input, { forwardHeld: false, brakeHeld: false, sprintHeld: false, interactHeld: false, leftPressed: false, rightPressed: false });
    }
    const anaRecord = snapshots[3]!.players[0]!;
    assert.equal(anaRecord.lastProcessedInputSequence, 13);
    assert.equal(anaRecord.lastProcessedActionId, 2);
  });

  test("future actions are explicitly unavailable", () => {
    const state = sim.createInitialState(makeSetup({ tuning: IMMEDIATE_TUNING }));
    const legal = sim.queryLegalActions(state, PLAYERS.ana);
    assert.deepEqual(legal, { left: { kind: "none" }, right: { kind: "none" }, canSprint: false, interact: null, canCapture: false, canSabotage: false });
    legal.canCapture = true;
    assert.equal(sim.queryLegalActions(state, PLAYERS.ana).canCapture, false);
    assert.throws(() => sim.queryLegalActions(state, brandId<typeof PLAYERS.ana>("p-ghost")), RangeError);
  });

  test("an invalid movement kernel result is rejected", () => {
    const broken = createSimulation({
      movement: (current, _input, context) => ({ state: { ...current, speedMps: Number.NaN }, pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 } }),
    });
    const state = broken.createInitialState(makeSetup({ tuning: IMMEDIATE_TUNING }));
    const before = broken.readSerializableState(state).players;
    assert.throws(() => broken.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING)), /movement kernel/);
    assert.deepEqual(broken.readSerializableState(state).players.map((p) => p.pose), before.map((p) => p.pose), "no player moved");
  });
});

describe("events and isolation", () => {
  test("events drain once and drained copies cannot change the state", () => {
    const state = sim.createInitialState(makeSetup({ tuning: SHORT_TUNING }));
    const dt = getFixedDeltaMs(SHORT_TUNING);
    for (let tick = 1; tick <= 60; tick++) sim.step(state, [], dt);
    const started = sim.collectEvents(state);
    assert.deepEqual(started, [{ type: "matchStarted", chaseStartTick: 60, id: 1, tick: 60 }]);
    assert.deepEqual(sim.collectEvents(state), []);
    (started[0] as { chaseStartTick: number }).chaseStartTick = 999;

    for (let tick = 61; tick <= 120; tick++) sim.step(state, [], dt);
    const ended = sim.collectEvents(state);
    assert.equal(ended.length, 1);
    const endedEvent = ended[0]!;
    assert.equal(endedEvent.type, "matchEnded");
    if (endedEvent.type === "matchEnded") (endedEvent.result as { winnerId: unknown }).winnerId = PLAYERS.ana;
    const snapshot = sim.readSerializableState(state);
    assert.equal(snapshot.match.chaseStartTick, 60);
    assert.equal(snapshot.match.result?.winnerId, null);
  });

  test("mutating a snapshot cannot corrupt internal state", () => {
    const state = sim.createInitialState(makeSetup());
    const first = sim.readSerializableState(state);
    const pristine = structuredClone(first);
    first.players[0]!.pose.position.x = 999;
    first.players.pop();
    first.match.phase = "results";
    first.vehicles[0]!.passengerIds.push(PLAYERS.ana);
    first.match.versions.protocolVersion = 42;
    assert.deepEqual(sim.readSerializableState(state), pristine);
  });

  test("setup data and frozen fixtures are not mutated", () => {
    // FIXTURE_WORLD and DEFAULT_TUNING are deep-frozen, so any write would throw in this strict-mode module.
    const frozenRun = () => runMatch(createSimulation({ movement: testAdvanceKernel }), makeSetup({ tuning: SHORT_TUNING }), 125);
    assert.doesNotThrow(frozenRun);

    const setup = makeSetup({ world: structuredClone(FIXTURE_WORLD) as WorldData, tuning: structuredClone(SHORT_TUNING) });
    const before = JSON.stringify(setup);
    runMatch(createSimulation({ movement: testAdvanceKernel }), setup, 125);
    assert.equal(JSON.stringify(setup), before);
    assert.equal(setup.participants[0]!.playerId, PLAYERS.carla, "participants are not re-ordered in place");
  });

  test("the state handle exposes no internals", () => {
    const state = sim.createInitialState(makeSetup());
    assert.deepEqual(Reflect.ownKeys(state), []);
    assert.ok(Object.isFrozen(state));
    assert.throws(() => sim.readSerializableState({} as typeof state), TypeError);
  });
});
