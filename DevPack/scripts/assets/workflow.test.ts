import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateAssetManifest, validateAssetManifestFile, type AssetManifest } from "@stopthatguy/test-support/node";
import { buildSample, exportSample, ROOT } from "./build.js";
import catalog from "../../assets/catalog.json" with { type: "json" };

test("source export is byte-reproducible and checked-in runtime/metadata have not drifted", () => {
  const a = exportSample();
  const b = exportSample();
  assert.deepEqual(a.glb, b.glb);
  assert.equal(a.sha256, b.sha256);
  assert.ok(a.glb.length < 20_000, "calibration fixture must stay small");
  assert.deepEqual(a.technical, { triangles: 128, lods: 1, materials: 3, textureSizes: [], animations: [] });
  assert.doesNotThrow(() => buildSample(true));
});

const manifestPaths = ["assets/manifest.json", "assets/manifest-environment.json"] as const;
const options = { projectRoot: ROOT, publicDir: resolve(ROOT, "apps/client/public") };
const readManifests = (): AssetManifest[] => manifestPaths.map((path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8")) as AssetManifest);
const combine = (manifests: AssetManifest[]): AssetManifest => ({ schemaVersion: 1, status: "active", description: "All shipped asset categories", assets: manifests.flatMap((manifest) => manifest.assets) });

test("real provenance validates every category and combined schema 1, and catalog covers every runtime file", () => {
  const manifests = readManifests();
  for (const category of manifests) {
    const report = validateAssetManifest(category, options);
    assert.equal(report.ok, true, JSON.stringify(report.issues));
    assert.deepEqual(report.issues, []);
    assert.equal(category.status, "active");
  }
  const manifest = combine(manifests);
  const { publicDir } = options;
  const report = validateAssetManifest(manifest, options);
  assert.equal(report.ok, true, JSON.stringify(report.issues));
  assert.deepEqual(report.issues, []);
  assert.equal(manifest.status, "active");
  assert.deepEqual(manifest.assets.map((a: { id: string }) => a.id).sort(), Object.keys(catalog).sort());
  const paths = manifest.assets.map((a) => {
    assert.equal(a.runtimePath, catalog[a.id as keyof typeof catalog].runtimePath);
    assert.ok(a.source.path);
    assert.ok(a.license.textPath);
    assert.ok(readFileSync(resolve(ROOT, a.source.path)).length > 0);
    assert.ok(readFileSync(resolve(ROOT, a.license.textPath)).length > 0);
    return a.runtimePath;
  });
  const files = readdirSync(resolve(publicDir, "assets"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).map((entry) => resolve(entry.parentPath, entry.name).slice(publicDir.length + 1));
  assert.deepEqual(files.sort(), paths.sort(), "every public asset must be declared; candidate assets must not silently ship");
});


test("category aggregation rejects cross-manifest duplicate IDs and runtime paths", () => {
  for (const field of ["id", "runtimePath"] as const) {
    const manifests = readManifests();
    manifests[1]!.assets[0]![field] = manifests[0]!.assets[0]![field];
    const report = validateAssetManifest(combine(manifests), options);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.code === (field === "id" ? "duplicateId" : "duplicatePath")));
  }
});

test("category errors and missing manifests cannot disappear during aggregation", () => {
  const manifests = readManifests();
  manifests[1]!.schemaVersion = 999;
  assert.equal(validateAssetManifest(manifests[1], options).ok, false);
  // Combining entry arrays cannot replace individual category validation.
  assert.equal(validateAssetManifest(combine(manifests), options).ok, true);
  assert.equal(validateAssetManifestFile(resolve(ROOT, "assets/manifest-missing.json"), options).ok, false);
});
