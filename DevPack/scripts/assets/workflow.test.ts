import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateAssetManifest } from "@stopthatguy/test-support/node";
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

test("real provenance validates schema 1 without warnings, and catalog covers every runtime file", () => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, "assets/manifest.json"), "utf8"));
  const publicDir = resolve(ROOT, "apps/client/public");
  const report = validateAssetManifest(manifest, { projectRoot: ROOT, publicDir });
  assert.equal(report.ok, true, JSON.stringify(report.issues));
  assert.deepEqual(report.issues, []);
  assert.equal(manifest.status, "active");
  assert.deepEqual(manifest.assets.map((a: { id: string }) => a.id).sort(), Object.keys(catalog).sort());
  const paths = manifest.assets.map((a: { id: keyof typeof catalog; runtimePath: string; source: { path: string }; license: { textPath: string } }) => {
    assert.equal(a.runtimePath, catalog[a.id].runtimePath);
    assert.ok(readFileSync(resolve(ROOT, a.source.path)).length > 0);
    assert.ok(readFileSync(resolve(ROOT, a.license.textPath)).length > 0);
    return a.runtimePath;
  });
  const files = readdirSync(resolve(publicDir, "assets"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).map((entry) => resolve(entry.parentPath, entry.name).slice(publicDir.length + 1));
  assert.deepEqual(files.sort(), paths.sort(), "every public asset must be declared; candidate assets must not silently ship");
});
