import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { AUTHORED_WORLDS } from "../src/index.js";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("world package boundaries", () => {
  test("depends only on @stopthatguy/shared at runtime and imports nothing else", () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ["@stopthatguy/shared"]);
    for (const name of readdirSync(join(packageDir, "src"))) {
      const code = readFileSync(join(packageDir, "src", name), "utf8");
      for (const [, specifier] of code.matchAll(/\bfrom\s+"([^"]+)"/g)) {
        assert.ok(specifier === "@stopthatguy/shared" || specifier!.startsWith("./"), `${name} imports ${specifier}`);
      }
    }
  });

  const built = existsSync(join(packageDir, "dist", "index.js"));
  test("the compiled package resolves without the source condition and matches the source", { skip: built ? false : "dist not built: run `npm run build` first" }, () => {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", 'const w = await import("@stopthatguy/world"); process.stdout.write(JSON.stringify({ resolved: import.meta.resolve("@stopthatguy/world"), world: w.AUTHORED_WORLDS }));'],
      { cwd: packageDir, env: { ...process.env, NODE_OPTIONS: "" }, encoding: "utf8" },
    );
    assert.equal(child.status, 0, child.stderr);
    const output = JSON.parse(child.stdout) as { resolved: string; world: unknown };
    assert.match(output.resolved, /packages\/world\/dist\/index\.js$/);
    assert.deepEqual(output.world, JSON.parse(JSON.stringify(AUTHORED_WORLDS)));
  });
});
