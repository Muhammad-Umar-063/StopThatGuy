// T005: the authored first street exercised by the real simulation, and the validator's spawn geometry
// cross-checked against the simulation's poseOnRoute so both use one coordinate convention.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_TUNING, brandId, type PlayerId } from "@stopthatguy/shared";
import { createSimulation, getFixedDeltaMs, indexWorld, poseOnRoute } from "@stopthatguy/simulation";
import { checkSnapshotConsistency, createFixtureSimulationSetup, pointOnEdge, spawnPosition } from "@stopthatguy/test-support";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";

const world = FIRST_STREET_WORLD;
const participants = Array.from({ length: 6 }, (_, i) => ({ playerId: brandId<PlayerId>(`street-player-${i + 1}`), nickname: `Street ${i + 1}`, joinOrder: i }));
const setup = createFixtureSimulationSetup({ world, participants });
const close = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} ≠ ${b}`);

describe("first street in the simulation", () => {
  test("a six-player match starts on the street's spawns and stays contract-consistent through the chase start", () => {
    const sim = createSimulation();
    const state = sim.createInitialState(setup);
    const initial = sim.readSerializableState(state);
    assert.deepEqual(checkSnapshotConsistency(initial, world), []);
    assert.equal(initial.match.versions.worldVersion, "first-street-1");

    const playerSpawns = world.spawns.filter((s) => s.kind === "player");
    initial.players.forEach((player, i) => {
      const expected = spawnPosition(world, playerSpawns[i]!)!;
      for (const axis of ["x", "y", "z"] as const) close(player.pose.position[axis], expected[axis], `${player.id}.${axis}`);
    });
    const robberSpawn = world.spawns.find((s) => s.kind === "robber")!;
    assert.deepEqual(initial.robber?.route?.edgeId, robberSpawn.placement.edgeId);
    assert.deepEqual(initial.vehicles.map((v) => [v.id, v.type, v.availability]), [
      ["sp-bicycle-1", "bicycle", "available"],
      ["sp-bicycle-2", "bicycle", "available"],
    ]);
    assert.equal(initial.match.robberRouteId, null, "no escape route is authored yet");

    const dt = getFixedDeltaMs(DEFAULT_TUNING);
    for (let tick = 1; tick <= 400; tick++) {
      sim.step(state, [], dt);
      if (tick % 50 === 0) assert.deepEqual(checkSnapshotConsistency(sim.readSerializableState(state), world), [], `tick ${tick}`);
    }
    assert.equal(sim.readSerializableState(state).match.phase, "chase");
    assert.deepEqual(sim.collectEvents(state).map((e) => e.type), ["matchStarted"]);
  });

  test("validator geometry matches the simulation's poseOnRoute along every edge and lane", () => {
    const index = indexWorld(world);
    for (const edge of world.edges) {
      edge.laneOffsetsM.forEach((offset, laneIndex) => {
        for (const distanceM of [0, edge.lengthM / 3, edge.lengthM / 2, edge.lengthM]) {
          const sim = poseOnRoute(index, { edgeId: edge.id, distanceM, laneIndex, lateralOffsetM: offset });
          const check = pointOnEdge(edge, distanceM, offset);
          for (const axis of ["x", "y", "z"] as const) close(check.position[axis], sim.position[axis], `${edge.id}@${distanceM}.${axis}`);
          close(check.yaw, sim.yaw, `${edge.id}@${distanceM}.yaw`);
        }
      });
    }
  });
});
