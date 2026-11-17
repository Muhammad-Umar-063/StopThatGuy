import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { WORLD_SCHEMA_VERSION } from "@stopthatguy/shared";
import { FIXTURE_WORLD, INVALID_WORLD_SAMPLES, validateWorldData } from "../src/index.js";

describe("world data validation", () => {
  test("the fixture world is valid, including after a JSON round trip", () => {
    for (const world of [FIXTURE_WORLD, JSON.parse(JSON.stringify(FIXTURE_WORLD))]) {
      const report = validateWorldData(world);
      assert.deepEqual(report, { schemaVersion: WORLD_SCHEMA_VERSION, worldVersion: FIXTURE_WORLD.worldVersion, ok: true, issues: [] });
    }
  });

  test("non-object input is rejected, not thrown", () => {
    for (const input of [null, 42, "world", []]) {
      const report = validateWorldData(input);
      assert.equal(report.ok, false);
      assert.deepEqual([...new Set(report.issues.map((i) => i.code))], ["invalidValue"]);
    }
  });

  for (const sample of INVALID_WORLD_SAMPLES) {
    test(`rejects: ${sample.label}`, () => {
      const report = validateWorldData(sample.world);
      const summary = report.issues.map((i) => `${i.code}: ${i.message}`).join("\n");
      assert.equal(report.ok, false, `expected failure\n${summary}`);
      assert.deepEqual([...new Set(report.issues.map((i) => i.code))].sort(), [...sample.expectedCodes].sort(), `only the intended defect\n${summary}`);
      assert.ok(report.issues.some((i) => i.refs.includes(sample.expectedRef)), `an issue names ${sample.expectedRef}\n${summary}`);
    });
  }

  test("a missing escape route is a warning, not an error", () => {
    const world = JSON.parse(JSON.stringify(FIXTURE_WORLD));
    world.routes = world.routes.filter((r: { kind: string }) => r.kind !== "robberEscape");
    const report = validateWorldData(world);
    assert.equal(report.ok, true);
    assert.deepEqual(
      report.issues.map((i) => [i.severity, i.code]),
      [["warning", "unreachableExit"]],
    );
  });
});
