import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, type GameEvent, type MatchResult } from "@stopthatguy/shared";
import { FIXTURE_WORLD, checkEventSequence, checkSnapshotConsistency } from "@stopthatguy/test-support";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { advanceFixedStepClock, collectRobberDiagnostics, createFixedStepClock, createSimulation, getFixedDeltaMs } from "../src/index.js";
import { finishMatch, resolveEscapeAndTimeout } from "../src/match/progression.js";
import { toInternal } from "../src/state.js";
import { IMMEDIATE_TUNING, makeSetup, PLAYERS, SHORT_TUNING } from "./helpers.js";

const sim = createSimulation();
const participants = [{ playerId: PLAYERS.ana, nickname: "Ana", joinOrder: 0 }];
const practice = () => makeSetup({ mode: "practice", participants });

test("public practice match runs the actual countdown/intro/chase and escapes exactly once", () => {
  const state = sim.createInitialState(practice());
  const initial = sim.readSerializableState(state);
  const events: GameEvent[] = [];
  let moved = false;
  for (let tick = 1; tick <= 2000; tick++) {
    sim.step(state, [], getFixedDeltaMs(DEFAULT_TUNING));
    const snapshot = sim.readSerializableState(state);
    assert.deepEqual(checkSnapshotConsistency(snapshot, FIXTURE_WORLD), [], `tick ${tick}`);
    events.push(...sim.collectEvents(state));
    if (tick < 330) {
      assert.equal(snapshot.match.phase, tick < 90 ? "countdown" : "intro");
      assert.deepEqual(snapshot.robber, initial.robber, "opening stays in departing state until published chase tick");
    } else if (snapshot.robber!.pose.position.z !== initial.robber!.pose.position.z) moved = true;
    if (snapshot.match.result) break;
  }
  const final = sim.readSerializableState(state);
  assert.ok(moved);
  assert.equal(final.match.result?.reason, "escaped");
  assert.equal(final.match.result?.winnerId, null);
  assert.equal(final.robber!.aiState, "escaped");
  assert.deepEqual(events.map(e => e.type), ["matchStarted", "robberEscaped", "matchEnded"]);
  assert.equal(events[0]!.tick, 330);
  assert.equal(events[1]!.tick, final.match.result!.resolvedAtTick);
  assert.equal(events[2]!.tick, events[1]!.tick);
  assert.deepEqual(checkEventSequence(events), []);
});

test("first-street without escape routes safely completes a full default practice timeout", () => {
  const state = sim.createInitialState({ ...practice(), world: FIRST_STREET_WORLD });
  let previous = sim.readSerializableState(state).robber!.pose.position;
  let travelled = 0;
  const events: GameEvent[] = [];
  for (let tick = 1; tick <= 11130; tick++) {
    sim.step(state, [], getFixedDeltaMs(DEFAULT_TUNING));
    const snapshot = sim.readSerializableState(state), robber = snapshot.robber!;
    const distance = Math.hypot(robber.pose.position.x - previous.x, robber.pose.position.y - previous.y, robber.pose.position.z - previous.z);
    assert.ok(distance <= DEFAULT_TUNING.vehicles.scooterSpeedMps / 30 + 1e-8);
    travelled += distance; previous = robber.pose.position;
    assert.equal(robber.escapeTargetZoneId, null);
    assert.equal(snapshot.match.phase, tick < 90 ? "countdown" : tick < 330 ? "intro" : tick < 11130 ? "chase" : "results");
    events.push(...sim.collectEvents(state));
  }
  const final = sim.readSerializableState(state);
  assert.ok(travelled > 100, "fallback actually travels legal graph edges");
  assert.equal(final.match.result?.reason, "timeout");
  assert.equal(final.match.result?.resolvedAtTick, 11130);
  assert.deepEqual(events.map(e => e.type), ["matchStarted", "matchEnded"]);
  assert.deepEqual(collectRobberDiagnostics(state).map(d => d.reason), ["missingEscapeRoutes"]);
});

test("practice and multiplayer use identical robber routes, timings, transitions and outcome", () => {
  const one = sim.createInitialState({ ...practice(), tuning: IMMEDIATE_TUNING });
  const many = sim.createInitialState(makeSetup({ tuning: IMMEDIATE_TUNING }));
  for (let tick = 1; tick <= 2000; tick++) {
    for (const state of [one, many]) sim.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING));
    const a = sim.readSerializableState(one), b = sim.readSerializableState(many);
    assert.deepEqual(a.robber, b.robber);
    assert.deepEqual(a.match.result, b.match.result);
    assert.deepEqual(sim.collectEvents(one), sim.collectEvents(many));
    if (a.match.result) return;
  }
  assert.fail("neither match finished");
});

test("equivalent elapsed samples at 30/60/144 FPS drive the same fixed ticks and escape", () => {
  const run = (fps: number) => {
    const state = sim.createInitialState({ ...practice(), tuning: IMMEDIATE_TUNING });
    const clock = createFixedStepClock();
    for (let i = 0; i < fps * 20; i++) {
      const advance = advanceFixedStepClock(clock, 1000 / fps, getFixedDeltaMs(IMMEDIATE_TUNING));
      for (let step = 0; step < advance.steps; step++) sim.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING));
      assert.equal(advance.droppedMs, 0);
    }
    const snapshot = sim.readSerializableState(state);
    assert.equal(snapshot.match.tick, 600);
    assert.equal(snapshot.match.result?.reason, "escaped");
    return { snapshot, events: sim.collectEvents(state) };
  };
  assert.deepEqual(run(30), run(60)); assert.deepEqual(run(60), run(144));
});

test("escape wins a same-tick timeout; an earlier timeout still wins", () => {
  const reference = sim.createInitialState({ ...practice(), tuning: IMMEDIATE_TUNING });
  while (!sim.readSerializableState(reference).match.result) sim.step(reference, [], getFixedDeltaMs(IMMEDIATE_TUNING));
  const escapeTick = sim.readSerializableState(reference).match.result!.resolvedAtTick;
  for (const offset of [0, -1]) {
    const tuning = { ...IMMEDIATE_TUNING, timing: { ...IMMEDIATE_TUNING.timing, chaseTimeLimitMs: (escapeTick - 1 + offset) * getFixedDeltaMs(IMMEDIATE_TUNING) } };
    const state = sim.createInitialState({ ...practice(), tuning });
    for (let i = 0; i < escapeTick + 2; i++) sim.step(state, [], getFixedDeltaMs(tuning));
    assert.equal(sim.readSerializableState(state).match.result?.reason, offset === 0 ? "escaped" : "timeout");
  }
});

test("terminal results and competitive state stay immutable across later inputs, reads and event mutations", () => {
  const state = sim.createInitialState({ ...practice(), tuning: SHORT_TUNING });
  for (let i = 0; i < 120; i++) sim.step(state, [], getFixedDeltaMs(SHORT_TUNING));
  const terminal = sim.readSerializableState(state);
  const events = sim.collectEvents(state);
  const ended = events.find(e => e.type === "matchEnded")!;
  if (ended.type === "matchEnded") (ended.result as { winnerId: unknown }).winnerId = PLAYERS.ana;
  const copy = sim.readSerializableState(state); (copy.match.result as { reason: unknown }).reason = "escaped";
  copy.robber!.pose.position.x = 999;
  for (let tick = 121; tick < 160; tick++) sim.step(state, [{ playerId: PLAYERS.ana, sequence: tick,
    forwardHeld: true, brakeHeld: false, sprintHeld: true, interactHeld: true, actions: [{ id: tick, kind: "capture" }] }], getFixedDeltaMs(SHORT_TUNING));
  const after = sim.readSerializableState(state);
  assert.deepEqual(after.match.result, terminal.match.result);
  assert.deepEqual(after.robber, terminal.robber);
  assert.deepEqual(after.players.map(p => [p.pose, p.speedMps, p.stamina]), terminal.players.map(p => [p.pose, p.speedMps, p.stamina]));
  assert.deepEqual(sim.collectEvents(state), []);
});

test("reserved capture stage can publish before escape/timeout without a second result (no capture rules implemented)", () => {
  const state = sim.createInitialState({ ...practice(), tuning: IMMEDIATE_TUNING });
  const internal = toInternal(state);
  sim.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING));
  internal.robberMemory.pendingEscape = internal.robber.escapeTargetZoneId;
  internal.match.chaseEndTick = internal.match.tick;
  const capture: MatchResult = { outcome: "capture", reason: "captured", winnerId: PLAYERS.ana,
    resolvedAtTick: internal.match.tick, awards: [], stats: [], deductions: [] };
  finishMatch(internal, capture);
  resolveEscapeAndTimeout(internal);
  finishMatch(internal, { ...capture, winnerId: PLAYERS.bruno });
  assert.equal(sim.readSerializableState(state).match.result?.winnerId, PLAYERS.ana);
  assert.deepEqual(sim.collectEvents(state).map(e => e.type), ["matchStarted", "matchEnded"]);
});

test("new match resets all route, transition, RNG and terminal memory; invalid robber tuning is rejected", () => {
  const setup = { ...practice(), tuning: IMMEDIATE_TUNING };
  const original = sim.readSerializableState(sim.createInitialState(setup));
  const state = sim.createInitialState(setup);
  for (let i = 0; i < 600; i++) sim.step(state, [], getFixedDeltaMs(IMMEDIATE_TUNING));
  assert.ok(sim.readSerializableState(state).match.result);
  assert.deepEqual(sim.readSerializableState(sim.createInitialState(setup)), original);
  for (const transitionMs of [0, -1, Infinity, NaN]) assert.throws(() => sim.createInitialState({ ...setup,
    tuning: { ...IMMEDIATE_TUNING, robber: { transitionMs } } }), /robber transition/);
});
