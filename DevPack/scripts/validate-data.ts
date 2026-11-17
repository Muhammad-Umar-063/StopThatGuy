// npm run validate — validates world data and the asset provenance manifest.
// Usage: npm run validate [-- path/to/world.json ...]   (extra JSON world files are optional)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_WORLD, validateWorldData } from "@stopthatguy/test-support";
import { AUTHORED_WORLDS } from "@stopthatguy/world";
import { validateAssetManifestFile } from "@stopthatguy/test-support/node";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** World data checked on every run: every authored world (@stopthatguy/world) plus the test fixture. */
const REGISTERED_WORLDS: { name: string; data: unknown }[] = [
  ...AUTHORED_WORLDS.map((world) => ({ name: `${world.worldVersion} (@stopthatguy/world)`, data: world })),
  { name: "FIXTURE_WORLD (@stopthatguy/test-support)", data: FIXTURE_WORLD },
];

let failed = false;

console.log("World data");
const worlds = [
  ...REGISTERED_WORLDS,
  ...process.argv.slice(2).map((file) => {
    try {
      return { name: file, data: JSON.parse(readFileSync(resolve(file), "utf8")) as unknown };
    } catch (error) {
      return { name: file, data: undefined, loadError: (error as Error).message };
    }
  }),
];
for (const world of worlds) {
  if ("loadError" in world) {
    failed = true;
    console.log(`  ✖ ${world.name}: cannot read JSON (${world.loadError})`);
    continue;
  }
  const report = validateWorldData(world.data);
  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");
  failed ||= !report.ok;
  console.log(`  ${report.ok ? "✔" : "✖"} ${world.name} [${report.worldVersion || "no version"}]: ${errors.length} errors, ${warnings.length} warnings`);
  for (const issue of report.issues) console.log(`      ${issue.severity} ${issue.code}: ${issue.message}`);
}
console.log("  ℹ checked: structure, references, foot reachability, per-mode continuation, spawn clearance, grades, turn-path ground");
console.log("  ℹ not checked: collider placement relative to routes, lateral slope, moving blockers (later tasks)");

console.log("\nAsset manifest (assets/manifest.json)");
const assets = validateAssetManifestFile(join(ROOT, "assets/manifest.json"), {
  projectRoot: ROOT,
  publicDir: join(ROOT, "apps/client/public"),
});
failed ||= !assets.ok;
const empty = assets.status === "empty-development" ? " (explicitly empty development manifest; no asset files to check)" : "";
console.log(`  ${assets.ok ? "✔" : "✖"} status ${assets.status ?? "invalid"}, ${assets.assetCount} assets${empty}`);
for (const issue of assets.issues) console.log(`      ${issue.severity} ${issue.code} [${issue.ref}]: ${issue.message}`);
console.log("  ℹ a passing manifest check does not verify:");
for (const item of assets.notVerified) console.log(`      - ${item}`);

console.log(failed ? "\nValidation FAILED" : "\nValidation passed");
process.exitCode = failed ? 1 : 0;
