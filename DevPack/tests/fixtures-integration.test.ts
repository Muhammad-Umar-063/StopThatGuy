// Cross-package checks: fixtures drive the real simulation, fixture entry points stay browser-safe,
// and test data never becomes a production dependency.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { getFixedDeltaMs, createSimulation } from "@stopthatguy/simulation";
import { FIXTURE_WORLD, checkSnapshotConsistency, createFixtureSimulationSetup } from "@stopthatguy/test-support";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}

describe("fixtures with the real simulation", () => {
  test("the fixture setup starts a match that conforms to the state contract through the chase start", () => {
    const setup = createFixtureSimulationSetup();
    const sim = createSimulation();
    const state = sim.createInitialState(setup);
    const dt = getFixedDeltaMs(setup.tuning);
    for (let tick = 1; tick <= 330; tick++) sim.step(state, [], dt);
    const snapshot = sim.readSerializableState(state);
    assert.equal(snapshot.match.phase, "chase");
    assert.deepEqual(checkSnapshotConsistency(snapshot, FIXTURE_WORLD), []);
    assert.deepEqual(sim.collectEvents(state).map((e) => e.type), ["matchStarted"]);
  });
});

describe("package boundaries", () => {
  test("browser-facing sources import no Node built-ins", () => {
    const nodeOnly = new Set(["packages/test-support/src/node.ts", "packages/test-support/src/validation/assets.ts"]);
    const files = ["packages/shared/src", "packages/simulation/src", "packages/test-support/src"].flatMap((dir) => tsFiles(join(ROOT, dir)));
    for (const file of files) {
      const path = relative(ROOT, file).split("\\").join("/");
      if (nodeOnly.has(path)) continue;
      assert.doesNotMatch(readFileSync(file, "utf8"), /from\s+"node:/, `${path} imports a Node built-in`);
    }
  });

  test("test data is never a production dependency", () => {
    for (const pkg of ["apps/client", "apps/server", "packages/shared", "packages/simulation"]) {
      const manifest = JSON.parse(readFileSync(join(ROOT, pkg, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
      assert.ok(!("@stopthatguy/test-support" in (manifest.dependencies ?? {})), `${pkg} depends on test-support`);
    }
  });
});
