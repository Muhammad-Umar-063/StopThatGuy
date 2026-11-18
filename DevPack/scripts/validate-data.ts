// npm run validate — validates world data and the asset provenance manifest.
// Usage: npm run validate [-- path/to/world.json ...]   (extra JSON world files are optional)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_WORLD, validateWorldData } from "@stopthatguy/test-support";
import { AUTHORED_WORLDS } from "@stopthatguy/world";
import { validateAssetManifestFile, validateAssetManifest, type AssetManifest, type AssetManifestReport } from "@stopthatguy/test-support/node";

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

const assetOptions = { projectRoot: ROOT, publicDir: join(ROOT, "apps/client/public") };
const assetManifests: AssetManifest[] = [];
const manifestPaths = ["assets/manifest.json", "assets/manifest-environment.json", "assets/manifest-characters.json"];
function printAssets(label: string, report: AssetManifestReport): void {
  failed ||= !report.ok;
  console.log(`\nAsset manifest (${label})`);
  const empty = report.status === "empty-development" ? " (explicitly empty development manifest; no asset files to check)" : "";
  console.log(`  ${report.ok ? "✔" : "✖"} status ${report.status ?? "invalid"}, ${report.assetCount} assets${empty}`);
  for (const issue of report.issues) console.log(`      ${issue.severity} ${issue.code} [${issue.ref}]: ${issue.message}`);
}
for (const path of manifestPaths) {
  const report = validateAssetManifestFile(join(ROOT, path), assetOptions);
  printAssets(path, report);
  if (report.ok) assetManifests.push(JSON.parse(readFileSync(join(ROOT, path), "utf8")) as AssetManifest);
}
if (assetManifests.length === manifestPaths.length) {
  const assets = validateAssetManifest({
    schemaVersion: 1, status: "active", description: "All shipped asset categories",
    assets: assetManifests.flatMap((manifest) => manifest.assets),
  }, assetOptions);
  printAssets("combined categories; duplicate IDs and runtime paths", assets);
  console.log("  ℹ a passing manifest check does not verify:");
  for (const item of assets.notVerified) console.log(`      - ${item}`);
} else {
  console.log("  ✖ combined asset validation requires every valid category manifest");
}

console.log(failed ? "\nValidation FAILED" : "\nValidation passed");
process.exitCode = failed ? 1 : 0;
