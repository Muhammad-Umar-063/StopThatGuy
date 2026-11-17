import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_TUNING } from "@stopthatguy/shared";
import { createSimulation, getFixedDeltaMs } from "../src/index.js";
import { makeSetup } from "./helpers.js";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : [],
  );
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// Property names (including optional chains) are world data, not host global reads.
const forbidden = /\b(Math\s*\.\s*random|Date\s*\.\s*now|new\s+Date\b)|(?<![\w$.])(?:performance|setTimeout|setInterval|setImmediate|requestAnimationFrame|queueMicrotask|globalThis|window|document|navigator|process|require)\b/;
const boundaryCode = (code: string) => stripComments(code).replace(/\?\.\s*|\.\s*/g, ".");
test("boundary guard accepts data properties but rejects actual host APIs", () => {
  for (const sample of ["junction.window.startM", "junction?.window.endM", "junction . window", "record.document"]) {
    assert.doesNotMatch(boundaryCode(sample), forbidden);
  }
  for (const sample of ["window.location", "window?.document", "document.body", "navigator.userAgent", "globalThis.window",
    "process.env", "performance.now()", "Math.random()", "Date.now()", "new Date()", "setTimeout(fn, 0)",
    "setInterval(fn, 0)", "setImmediate(fn)", "requestAnimationFrame(fn)", "queueMicrotask(fn)", "require('fs')"]) {
    assert.match(boundaryCode(sample), forbidden, sample);
  }
});

describe("dependency boundaries", () => {
  test("production dependencies are limited to @stopthatguy/shared", () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ["@stopthatguy/shared"]);
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies });
    assert.ok(!all.some((name) => /babylon|colyseus|three|cannon/.test(name)), all.join(", "));
  });

  test("source imports only shared and its own modules, and reads no clocks, randomness, timers or host globals", () => {

    for (const file of sourceFiles(join(packageDir, "src"))) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const [, specifier] of code.matchAll(/\bfrom\s+"([^"]+)"/g)) {
        assert.ok(specifier === "@stopthatguy/shared" || specifier!.startsWith("./") || specifier!.startsWith("../"), `${file} imports ${specifier}`);
      }
      assert.doesNotMatch(code, /\bimport\s*\(/, `${file} uses dynamic import`);
      assert.doesNotMatch(boundaryCode(code), forbidden, file);
    }
  });
});

describe("package resolution", () => {
  const built = existsSync(join(packageDir, "dist", "index.js")) && existsSync(join(packageDir, "dist", "movement", "index.js"));

  test("the compiled package resolves without the source condition and matches the source build", { skip: built ? false : "dist not built: run `npm run build` first" }, () => {
    const setup = makeSetup();
    const ticks = 400; // crosses the chase start at tick 330
    const script = `
      const sim = await import("@stopthatguy/simulation");
      const movement = await import("@stopthatguy/simulation/movement");
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const setup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const simulation = sim.createSimulation();
      const state = simulation.createInitialState(setup);
      const dt = sim.getFixedDeltaMs(setup.tuning);
      for (let i = 0; i < ${ticks}; i++) simulation.step(state, [{
        playerId: setup.participants[0].playerId, sequence: i + 1, forwardHeld: true,
        brakeHeld: false, sprintHeld: true, interactHeld: false,
        actions: i >= 335 ? [{ id: 1, kind: "right" }] : [],
      }], dt);
      process.stdout.write(JSON.stringify({
        resolved: [import.meta.resolve("@stopthatguy/simulation"), import.meta.resolve("@stopthatguy/simulation/movement"), import.meta.resolve("@stopthatguy/shared")],
        poseOnRoute: typeof movement.poseOnRoute,
        snapshot: simulation.readSerializableState(state),
        events: simulation.collectEvents(state),
      }));`;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: packageDir,
      input: JSON.stringify(setup),
      env: { ...process.env, NODE_OPTIONS: "" },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const output = JSON.parse(child.stdout) as { resolved: string[]; poseOnRoute: string; snapshot: unknown; events: unknown };
    assert.match(output.resolved[0]!, /packages\/simulation\/dist\/index\.js$/);
    assert.match(output.resolved[1]!, /packages\/simulation\/dist\/movement\/index\.js$/);
    assert.match(output.resolved[2]!, /packages\/shared\/dist\/index\.js$/);
    assert.equal(output.poseOnRoute, "function");

    const sim = createSimulation();
    const state = sim.createInitialState(setup);
    const initial = sim.readSerializableState(state);
    for (let i = 0; i < ticks; i++) sim.step(state, [{
      playerId: setup.participants[0]!.playerId, sequence: i + 1, forwardHeld: true,
      brakeHeld: false, sprintHeld: true, interactHeld: false,
      actions: i >= 335 ? [{ id: 1, kind: "right" }] : [],
    }], getFixedDeltaMs(DEFAULT_TUNING));
    const moved = sim.readSerializableState(state).players.find((p) => p.id === setup.participants[0]!.playerId)!;
    const start = initial.players.find((p) => p.id === moved.id)!;
    assert.ok(moved.route!.distanceM > start.route!.distanceM && moved.stamina < start.stamina);
    assert.deepEqual(output.snapshot, sim.readSerializableState(state));
    assert.deepEqual(output.events, sim.collectEvents(state));
  });
});
