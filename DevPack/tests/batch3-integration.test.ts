import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING, brandId, type ColliderId, type GameEvent } from "@stopthatguy/shared";
import { collectRobberDiagnostics, createSimulation, getFixedDeltaMs, type RobberDiagnostic } from "@stopthatguy/simulation";
import { createFixtureSimulationSetup } from "@stopthatguy/test-support";
import { FIRST_STREET_WORLD, LISBON_CITY_IDS as ids, LISBON_CITY_WORLD as city } from "@stopthatguy/world";
import { decodeSnapshot, NetworkFailure } from "../apps/client/src/network/decode.js";
import { MatchSimulation } from "../apps/server/src/adapters/match-simulation.js";
import { entersVolume } from "../packages/simulation/src/robber/volume.js";

for (const [seed, routeId] of [[0, ids.routes.hill], [1, ids.routes.arcade], [3, ids.routes.east], [4, ids.routes.west]] as const) {
  test(`merged city/robber/client decoder completes ${routeId}`, () => {
    const setup = createFixtureSimulationSetup({ world: city, seed });
    const sim = createSimulation(), state = sim.createInitialState(setup), dt = getFixedDeltaMs(setup.tuning);
    let previous = sim.readSerializableState(state);
    const target = previous.robber!.escapeTargetZoneId;
    assert.equal(previous.match.robberRouteId, routeId);
    const hill = city.zones.find(zone => zone.id === ids.zones.hill)!;
    const events: GameEvent[] = [];
    let transitionTicks = 0, passedHill = false;
    for (let tick = 0; tick < 7000 && previous.match.result === null; tick++) {
      sim.step(state, [], dt);
      const next = sim.readSerializableState(state);
      const decoded = decodeSnapshot(JSON.stringify(next), previous.match.versions, setup.participants[0]!.playerId);
      assert.equal(decoded.match.tick, next.match.tick);
      const a = previous.robber!.pose.position, b = next.robber!.pose.position;
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= setup.tuning.vehicles.scooterSpeedMps * dt / 1000 + 1e-6);
      if (next.robber!.aiState === "transition") {
        transitionTicks++;
        assert.equal(next.robber!.speedMps, 0);
      }
      if (routeId === ids.routes.west && entersVolume(a, b, hill.volume) !== null) {
        passedHill = true;
        assert.equal(next.match.result, null, "crossing the hill exit cannot finish the selected west route");
      }
      assert.deepEqual(collectRobberDiagnostics(state), []);
      events.push(...sim.collectEvents(state));
      previous = next;
    }
    assert.equal(previous.match.result?.reason, "escaped");
    assert.equal(previous.robber!.escapeTargetZoneId, target);
    assert.equal(transitionTicks, Math.ceil(setup.tuning.robber.transitionMs / dt));
    if (routeId === ids.routes.west) assert.ok(passedHill);
    const escapes = events.filter(event => event.type === "robberEscaped");
    assert.equal(escapes.length, 1);
    assert.equal(escapes[0]!.exitZoneId, target);
    assert.equal(events.filter(event => event.type === "matchEnded").length, 1);
    for (let i = 0; i < 5; i++) sim.step(state, [], dt);
    assert.deepEqual(sim.readSerializableState(state).match.result, previous.match.result);
    assert.deepEqual(sim.collectEvents(state), []);
  });
}

test("server drains initialization and step fallback diagnostics once without changing wire events", () => {
  const tuning = { ...DEFAULT_TUNING, timing: { ...DEFAULT_TUNING.timing, countdownMs: 0, introMs: 0 } };
  const world = { ...FIRST_STREET_WORLD, colliders: [{ id: brandId<ColliderId>("test-block-all"), shape: "box" as const,
    center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 10000, y: 10000, z: 10000 }, yaw: 0 }] };
  const records: RobberDiagnostic[] = [];
  const host = new MatchSimulation(createFixtureSimulationSetup({ world, tuning }), diagnostic => records.push(diagnostic));
  assert.equal(records.length, 1);
  assert.equal(records[0]!.reason, "missingEscapeRoutes");
  assert.deepEqual(host.events(), []);
  for (let i = 0; i < 10; i++) host.advance(getFixedDeltaMs(tuning));
  assert.ok(records.some(record => record.reason === "routeBlocked" && record.tick > 0));
  const keys = records.map(record => `${record.reason}:${record.edgeId}:${record.routeId}`);
  assert.equal(new Set(keys).size, records.length);
  assert.deepEqual(host.events().map(event => event.type), ["matchStarted"]);
  assert.equal(host.snapshot().match.result, null);
});

test("merged network decoder rejects the pre-robber config and wrong city version", () => {
  const setup = createFixtureSimulationSetup({ world: city });
  const sim = createSimulation(), state = sim.createInitialState(setup), snapshot = sim.readSerializableState(state);
  const raw = JSON.stringify(snapshot), local = setup.participants[0]!.playerId;
  for (const versions of [{ ...snapshot.match.versions, configVersion: "provisional-2" },
    { ...snapshot.match.versions, worldVersion: FIRST_STREET_WORLD.worldVersion }]) {
    assert.throws(() => decodeSnapshot(raw, versions, local), (error: unknown) => error instanceof NetworkFailure && error.code === "versionMismatch");
  }
});
