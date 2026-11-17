import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateAssetManifest, validateAssetManifestFile, type AssetIssueCode, type AssetPaths } from "../src/node.js";

const projectDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** A complete, valid entry for the temporary project created below. */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "props.crate",
    kind: "model",
    runtimePath: "assets/props/crate.glb",
    source: { path: "assets-source/props/crate.blend", url: null },
    creator: "Test Author",
    origin: "self-authored",
    license: { id: "CC0-1.0", textPath: "assets/licenses/CC0-1.0.txt", url: null },
    attribution: { required: false, text: null },
    modifications: "none",
    fileSizeBytes: 1234,
    generatorTermsCheckedAt: null,
    technical: { triangles: 120, materials: 1 },
    ...overrides,
  };
}

const manifest = (assets: unknown[], status = "active") => ({ schemaVersion: 1, status, assets });

describe("asset manifest validation", () => {
  let root = "";
  let paths: AssetPaths;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "stg-assets-"));
    paths = { projectRoot: root, publicDir: join(root, "apps/client/public") };
    const write = (path: string, bytes: number) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), Buffer.alloc(bytes));
    };
    write("apps/client/public/assets/props/crate.glb", 1234);
    write("apps/client/public/assets/props/barrel.glb", 10);
    write("assets-source/props/crate.blend", 5);
    write("assets/licenses/CC0-1.0.txt", 5);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("the repository's development manifest is explicitly empty and valid", () => {
    const report = validateAssetManifestFile(join(projectDir, "assets/manifest.json"), {
      projectRoot: projectDir,
      publicDir: join(projectDir, "apps/client/public"),
    });
    assert.deepEqual([report.ok, report.status, report.assetCount, report.issues], [true, "empty-development", 0, []]);
    assert.ok(report.notVerified.length > 0, "the report states what remains unverified");
  });

  test("a complete entry with matching files passes", () => {
    const report = validateAssetManifest(manifest([entry()]), paths);
    assert.deepEqual(report.issues, []);
    assert.equal(report.ok, true);
  });

  test("a source outside the repository is only a warning", () => {
    const report = validateAssetManifest(manifest([entry({ source: { path: "assets-source/missing.blend", url: null } })]), paths);
    assert.equal(report.ok, true);
    assert.deepEqual(report.issues.map((i) => [i.severity, i.code]), [["warning", "missingSource"]]);
  });

  const barrel = { id: "props.barrel", runtimePath: "assets/props/barrel.glb", fileSizeBytes: 10 };
  const invalid: [string, unknown, AssetIssueCode][] = [
    ["empty manifest not declared as empty", manifest([]), "undeclaredEmpty"],
    ["empty-development manifest listing assets", manifest([entry()], "empty-development"), "malformed"],
    ["unknown top-level field", { ...manifest([entry()]), licenses: [] }, "malformed"],
    ["missing creator", manifest([entry({ creator: "" })]), "malformed"],
    ["missing field", manifest([Object.fromEntries(Object.entries(entry()).filter(([key]) => key !== "modifications"))]), "malformed"],
    ["invalid ID", manifest([entry({ id: "Crate!" })]), "malformed"],
    ["absolute runtime path", manifest([entry({ runtimePath: "/etc/passwd" })]), "malformed"],
    ["path traversal", manifest([entry({ runtimePath: "assets/../../secret.glb" })]), "malformed"],
    ["runtime path outside assets/", manifest([entry({ runtimePath: "index.html" })]), "malformed"],
    ["duplicate IDs", manifest([entry(), entry({ runtimePath: barrel.runtimePath, fileSizeBytes: barrel.fileSizeBytes })]), "duplicateId"],
    ["duplicate runtime paths", manifest([entry(), entry({ id: barrel.id })]), "duplicatePath"],
    ["missing runtime file", manifest([entry({ runtimePath: "assets/props/missing.glb" })]), "missingFile"],
    ["size mismatch", manifest([entry({ fileSizeBytes: 999 })]), "sizeMismatch"],
    ["license without text or URL", manifest([entry({ license: { id: "CC0-1.0", textPath: null, url: null } })]), "malformed"],
    ["missing license text", manifest([entry({ license: { id: "CC-BY-4.0", textPath: "assets/licenses/missing.txt", url: null } })]), "missingLicenseText"],
    ["required attribution without text", manifest([entry({ attribution: { required: true, text: null } })]), "malformed"],
    ["generated asset without terms check date", manifest([entry({ origin: "generated" })]), "malformed"],
    ["unknown technical field", manifest([entry({ technical: { polygons: 3 } })]), "malformed"],
  ];
  for (const [label, input, code] of invalid) {
    test(`rejects: ${label}`, () => {
      const report = validateAssetManifest(input, paths);
      const summary = report.issues.map((i) => `${i.code}: ${i.message}`).join("\n");
      assert.equal(report.ok, false, summary);
      assert.deepEqual([...new Set(report.issues.map((i) => i.code))], [code], `only the intended defect\n${summary}`);
    });
  }

  test("unreadable or invalid JSON is reported as malformed", () => {
    const file = join(root, "broken.json");
    writeFileSync(file, "{ not json");
    const report = validateAssetManifestFile(file, paths);
    assert.deepEqual([report.ok, report.issues.map((i) => i.code)], [false, ["malformed"]]);
  });
});
