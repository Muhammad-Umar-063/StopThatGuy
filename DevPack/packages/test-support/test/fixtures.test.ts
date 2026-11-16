import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GAME_EVENT_TYPES, type AuthoritativeSnapshot, type WorldData } from "@stopthatguy/shared";
import {
  FIXTURE_CAPTURE_EVENTS,
  FIXTURE_ESCAPE_EVENTS,
  FIXTURE_IDS,
  FIXTURE_PLAYER_IDS,
  FIXTURE_SNAPSHOTS,
  FIXTURE_VIEWS,
  FIXTURE_WORLD,
  checkEventSequence,
  checkSnapshotConsistency,
  checkViewModel,
  checkWorldConsistency,
} from "../src/index.js";

describe("fixture world", () => {
  test("conforms to the world contract", () => {
    assert.deepEqual(checkWorldConsistency(FIXTURE_WORLD), []);
  });

  test("represents turns, a dead-end turnaround, a single-lane alley, a foot-only shortcut and all route kinds", () => {
    const sides = new Set(FIXTURE_WORLD.junctions.flatMap((j) => j.branches.map((b) => b.side)));
    assert.deepEqual([...sides].sort(), ["forward", "left", "right"]);
    assert.ok(FIXTURE_WORLD.nodes.some((n) => n.kind === "deadEnd"));
    assert.ok(FIXTURE_WORLD.nodes.some((n) => n.kind === "exit"));
    assert.ok(FIXTURE_WORLD.edges.some((e) => e.laneOffsetsM.length === 1));
    const stairs = FIXTURE_WORLD.edges.find((e) => e.id === FIXTURE_IDS.edges.eastStairs);
    const road = FIXTURE_WORLD.edges.find((e) => e.id === FIXTURE_IDS.edges.eastRoad);
    assert.deepEqual(stairs?.allowedModes, ["foot"]);
    assert.ok(stairs && road && stairs.lengthM < road.lengthM, "the foot shortcut must be shorter than the road");
    assert.deepEqual(new Set(FIXTURE_WORLD.routes.map((r) => r.kind)), new Set(["robberEscape", "police", "lift"]));
  });

  test("the checker reports broken references (not vacuous)", () => {
    const broken = structuredClone(FIXTURE_WORLD) as WorldData;
    broken.edges[0]!.to = "missing-node" as WorldData["edges"][number]["to"];
    broken.junctions[0]!.branches[0]!.allowedModes = ["scooter"];
    const issues = checkWorldConsistency(broken);
    assert.ok(issues.some((i) => i.includes("unknown endpoint")), issues.join("\n"));
    assert.ok(issues.some((i) => i.includes("subset")), issues.join("\n"));
  });
});

describe("fixture snapshots", () => {
  for (const [name, snapshot] of Object.entries(FIXTURE_SNAPSHOTS)) {
    test(`${name} conforms to the state contract`, () => {
      assert.deepEqual(checkSnapshotConsistency(snapshot, FIXTURE_WORLD), []);
    });
  }

  test("cover the required scenarios", () => {
    const s = FIXTURE_SNAPSHOTS;
    assert.equal(s.lobby.match.phase, "lobby");
    assert.equal(s.chase.match.phase, "chase");
    assert.ok(s.vehicles.players.some((p) => p.locomotion === "bicycle"));
    assert.ok(s.vehicles.players.some((p) => p.locomotion === "passenger"));
    assert.ok(s.wanted.players.some((p) => p.status.wanted));
    assert.equal(s.wanted.police[0]?.state, "pursuing");
    const participation = new Set(s.arrested.players.map((p) => p.participation));
    for (const state of ["active", "arrested", "forfeit", "spectator"] as const) assert.ok(participation.has(state), state);
    assert.equal(s.captureResult.match.result?.winnerId, FIXTURE_PLAYER_IDS.ana);
    assert.equal(s.escapeResult.match.result?.reason, "escaped");
    assert.equal(s.timeoutResult.match.result?.reason, "timeout");
    for (const r of [s.escapeResult.match.result, s.timeoutResult.match.result]) assert.equal(r?.winnerId, null);
  });

  test("a capture winner keeps the win despite a theft deduction", () => {
    const result = FIXTURE_SNAPSHOTS.captureResult.match.result;
    assert.equal(result?.outcome, "capture");
    assert.ok(result?.deductions.some((d) => d.playerId === result.winnerId && d.reason === "vehicleTheft"));
  });

  test("the checker reports inconsistent ownership (not vacuous)", () => {
    const broken = structuredClone(FIXTURE_SNAPSHOTS.chase) as AuthoritativeSnapshot;
    broken.vehicles[0]!.ownerId = FIXTURE_PLAYER_IDS.carla;
    broken.match.result = FIXTURE_SNAPSHOTS.captureResult.match.result;
    const issues = checkSnapshotConsistency(broken, FIXTURE_WORLD);
    assert.ok(issues.some((i) => i.includes("owner does not ride it")), issues.join("\n"));
    assert.ok(issues.some((i) => i.includes("results phase")), issues.join("\n"));
  });
});

describe("fixture events", () => {
  test("sequences have increasing IDs and non-decreasing ticks", () => {
    assert.deepEqual(checkEventSequence(FIXTURE_CAPTURE_EVENTS), []);
    assert.deepEqual(checkEventSequence(FIXTURE_ESCAPE_EVENTS), []);
  });

  test("together cover every event type", () => {
    const covered = new Set([...FIXTURE_CAPTURE_EVENTS, ...FIXTURE_ESCAPE_EVENTS].map((e) => e.type));
    assert.deepEqual([...GAME_EVENT_TYPES].filter((t) => !covered.has(t)), []);
  });

  test("matchEnded carries the same result as the results snapshot", () => {
    const capture = FIXTURE_CAPTURE_EVENTS.at(-1);
    const escape = FIXTURE_ESCAPE_EVENTS.at(-1);
    assert.equal(capture?.type === "matchEnded" && capture.result, FIXTURE_SNAPSHOTS.captureResult.match.result);
    assert.equal(escape?.type === "matchEnded" && escape.result, FIXTURE_SNAPSHOTS.escapeResult.match.result);
  });
});

describe("fixture views", () => {
  for (const [name, view] of Object.entries(FIXTURE_VIEWS)) {
    test(`${name} conforms and is labelled as fixture data`, () => {
      assert.deepEqual(checkViewModel(view), []);
      assert.equal(view.dataSource, "fixture");
    });
  }

  test("cover lobby, chase, arrest and results", () => {
    assert.equal(FIXTURE_VIEWS.lobby.phase, "lobby");
    assert.equal(FIXTURE_VIEWS.chase.phase, "chase");
    assert.equal(FIXTURE_VIEWS.arrest.localPlayer?.participation, "arrested");
    assert.equal(FIXTURE_VIEWS.captureResults.result?.localPlayerWon, true);
    assert.equal(FIXTURE_VIEWS.noWinnerResults.result?.winner, null);
  });
});

test("fixtures are frozen, JSON-serializable plain data", () => {
  const all = { FIXTURE_WORLD, FIXTURE_SNAPSHOTS, FIXTURE_VIEWS, FIXTURE_CAPTURE_EVENTS, FIXTURE_ESCAPE_EVENTS };
  const isDeepFrozen = (value: unknown): boolean =>
    typeof value !== "object" || value === null || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
  for (const [name, value] of Object.entries(all)) {
    assert.ok(isDeepFrozen(value), `${name} must be deeply frozen`);
    assert.deepEqual(JSON.parse(JSON.stringify(value)), value, `${name} must survive a JSON round trip`);
  }
});
