import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, NEUTRAL_HELD_CONTROLS, PROTOCOL_VERSION, type ValidatedPlayerInput } from "@stopthatguy/shared";
import { createSimulation, forfeitPlayer, getFixedDeltaMs } from "@stopthatguy/simulation";
import { createFixtureSimulationSetup, FIXTURE_WORLD, FIXTURE_CHASE_VIEW, FIXTURE_PLAYER_IDS } from "@stopthatguy/test-support";
import { decodeSnapshot } from "../apps/client/src/network/decode.js";
import { createView } from "../apps/client/src/network/view.js";

// Isolated public-simulation arena. This checks component interoperability, not live HUD transport.
function arena() {
  const world = structuredClone(FIXTURE_WORLD), edge = world.edges[0]!;
  edge.allowedModes = ["foot"]; edge.laneOffsetsM = [0];
  world.junctions = []; world.routes = []; world.zones = []; world.colliders = [];
  for (const spawn of world.spawns) spawn.placement = {
    edgeId: edge.id, distanceM: edge.lengthM - (spawn.kind === "robber" ? 0 : 1), laneIndex: 0,
  };
  const tuning = { ...DEFAULT_TUNING, timing: { ...DEFAULT_TUNING.timing, countdownMs: 0, introMs: 0 } };
  const playerId = FIXTURE_PLAYER_IDS.ana;
  const simulation = createSimulation();
  const state = simulation.createInitialState(createFixtureSimulationSetup({ world, tuning, mode: "practice",
    participants: [{ playerId, nickname: "Capture Ana", joinOrder: 0 }] }));
  const dt = getFixedDeltaMs(tuning);
  const step = (inputs: ValidatedPlayerInput[] = []) => simulation.step(state, inputs, dt);
  const view = () => {
    const raw = simulation.readSerializableState(state);
    const snapshot = decodeSnapshot(JSON.stringify(raw), raw.match.versions, playerId);
    assert.equal(snapshot.match.versions.protocolVersion, PROTOCOL_VERSION);
    return createView(snapshot, playerId, "connected", null, FIXTURE_CHASE_VIEW.settings, [], tuning,
      { snapshot, playerId, legalActions: simulation.queryLegalActions(state, playerId), robberVisible: null });
  };
  const start = () => step([{ playerId, sequence: 1, ...NEUTRAL_HELD_CONTROLS, actions: [{ id: 1, kind: "capture" }] }]);
  return { simulation, state, step, view, start, dt, tuning, playerId };
}

test("merged capture query, decoder and HUD distinguish readiness, pending attempt and final result", () => {
  const g = arena();
  assert.equal(g.view().actions, null);
  g.step();
  assert.equal(g.view().actions?.canCapture, true);
  g.start();
  assert.ok(g.simulation.collectEvents(g.state).some(e => e.type === "captureStarted"));
  for (let tick = 0; tick < Math.ceil(g.tuning.capture.attemptMs / g.dt); tick++) {
    assert.equal(g.view().actions?.canCapture, false, "pending attempt cannot restart");
    assert.equal(g.view().result, null, "unavailable action must not fabricate completion");
    assert.equal(g.view().robber, null, "visibility remains unavailable without its source");
    g.step();
  }
  const final = g.view();
  assert.equal(final.phase, "results");
  assert.equal(final.actions, null);
  assert.ok(final.result);
  assert.equal(final.result.localPlayerWon, true);
  assert.equal(final.result.reason, "captured");
  assert.equal(g.simulation.readSerializableState(g.state).match.result?.winnerId, g.playerId);
  assert.equal(g.simulation.collectEvents(g.state).filter(e => e.type === "matchEnded").length, 1);
  g.step();
  assert.deepEqual(g.view().result, final.result);
  assert.deepEqual(g.simulation.collectEvents(g.state), []);
});

test("departure cancels a real pending attempt before HUD can display a capture result", () => {
  const g = arena(); g.step(); g.start(); g.simulation.collectEvents(g.state);
  forfeitPlayer(g.state, g.playerId);
  const cancellation = g.simulation.collectEvents(g.state);
  assert.equal(cancellation.length, 1);
  assert.equal(cancellation[0]!.type, "captureCancelled");
  assert.equal(g.view().actions, null);
  assert.equal(g.view().result, null, "departure does not resolve outside the simulation tick");
  g.step();
  const result = g.simulation.readSerializableState(g.state).match.result!;
  assert.equal(result.reason, "allCompetitorsOut");
  assert.equal(result.winnerId, null);
  assert.equal(g.view().result?.reason, "allCompetitorsOut");
  assert.equal(g.view().phase, "results");
  assert.equal(g.view().actions, null);
  assert.equal(g.simulation.collectEvents(g.state).filter(e => e.type === "matchEnded").length, 1);
});
