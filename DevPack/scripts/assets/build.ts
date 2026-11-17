// Deterministic exporter for OUR procedural fixture, not a GLB parser/importer.
// Runtime decoding uses the official Babylon glTF loader.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import source from "../../assets-source/dev-axis-marker.json" with { type: "json" };
import catalog from "../../assets/catalog.json" with { type: "json" };

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
type V3 = [number, number, number];
type Geometry = { name: string; positions: number[]; normals: number[]; indices: number[]; color: number[] };

export function exportSample() {
  const geometries: Geometry[] = [];
  function geometry(name: string, color: number[]): Geometry {
    const mesh = { name, color, positions: [], normals: [], indices: [] };
    geometries.push(mesh);
    return mesh;
  }
  function triangle(mesh: Geometry, a: V3, b: V3, c: V3, normals?: [V3, V3, V3]) {
    const ab = b.map((v, i) => v - a[i]!) as V3;
    const ac = c.map((v, i) => v - a[i]!) as V3;
    const cross: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const normal = cross.map((v) => v / Math.hypot(...cross)) as V3;
    const start = mesh.positions.length / 3;
    // Reflect X and normals; reverse winding to preserve outward faces.
    for (const [i, v] of [a, b, c].entries()) {
      mesh.positions.push(-v[0], v[1], v[2]);
      const n = normals?.[i] ?? normal;
      mesh.normals.push(-n[0], n[1], n[2]);
    }
    mesh.indices.push(start, start + 2, start + 1);
  }
  const post = geometry("calibration-post", source.colors.post);
  const { radius, height, segments } = source.post;
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI * 2 / segments;
    const b = (i + 1) * Math.PI * 2 / segments;
    const na: V3 = [Math.cos(a), 0, Math.sin(a)];
    const nb: V3 = [Math.cos(b), 0, Math.sin(b)];
    const va: V3 = [na[0] * radius, 0, na[2] * radius];
    const vb: V3 = [nb[0] * radius, 0, nb[2] * radius];
    const ta: V3 = [va[0], height, va[2]];
    const tb: V3 = [vb[0], height, vb[2]];
    triangle(post, va, ta, vb, [na, na, nb]);
    triangle(post, vb, ta, tb, [nb, na, nb]);
    triangle(post, [0, height, 0], tb, ta);
    triangle(post, [0, 0, 0], va, vb);
  }
  // Convex polygon, counterclockwise in X/Z, extruded along Y.
  function prism(mesh: Geometry, polygon: [number, number][], low: number, high: number) {
    const at = (i: number, y: number): V3 => [polygon[i]![0], y, polygon[i]![1]];
    for (let i = 1; i < polygon.length - 1; i++) {
      triangle(mesh, at(0, high), at(i + 1, high), at(i, high));
      triangle(mesh, at(0, low), at(i, low), at(i + 1, low));
    }
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      triangle(mesh, at(i, low), at(i, high), at(j, low));
      triangle(mesh, at(j, low), at(i, high), at(j, high));
    }
  }
  const arrow = geometry("calibration-forward-arrow", source.colors.arrow);
  const p = source.arrow;
  prism(arrow, [[-p.shaftHalfWidth, p.back], [p.shaftHalfWidth, p.back], [p.shaftHalfWidth, p.shoulder], [-p.shaftHalfWidth, p.shoulder]], p.bottom, p.top);
  prism(arrow, [[-p.halfWidth, p.shoulder], [p.halfWidth, p.shoulder], [0, p.tip]], p.bottom, p.top);
  const side = geometry("calibration-right-marker", source.colors.sideMarker);
  const [x0, y0, z0] = source.sideMarker.min as V3;
  const [x1, y1, z1] = source.sideMarker.max as V3;
  prism(side, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1);

  const binaryParts: Buffer[] = [];
  const bufferViews: { buffer: number; byteOffset: number; byteLength: number; target: number }[] = [];
  const accessors: { bufferView: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }[] = [];
  let offset = 0;
  function accessor(values: number[], type: "VEC3" | "SCALAR", positions = false) {
    const width = type === "VEC3" ? 3 : 1;
    const bytes = Buffer.alloc(values.length * (width === 3 ? 4 : 2));
    values.forEach((v, i) => width === 3 ? bytes.writeFloatLE(v, i * 4) : bytes.writeUInt16LE(v, i * 2));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: width === 3 ? 34962 : 34963 });
    binaryParts.push(bytes, Buffer.alloc((4 - bytes.length % 4) % 4));
    offset += Math.ceil(bytes.length / 4) * 4;
    const bounds = positions ? {
      min: [0, 1, 2].map((axis) => Math.min(...values.filter((_, i) => i % 3 === axis))),
      max: [0, 1, 2].map((axis) => Math.max(...values.filter((_, i) => i % 3 === axis))),
    } : {};
    accessors.push({ bufferView: bufferViews.length - 1, componentType: width === 3 ? 5126 : 5123, count: values.length / width, type, ...bounds });
    return accessors.length - 1;
  }
  const meshes = geometries.map((g, material) => ({ name: g.name, primitives: [{
    attributes: { POSITION: accessor(g.positions, "VEC3", true), NORMAL: accessor(g.normals, "VEC3") },
    indices: accessor(g.indices, "SCALAR"), material, mode: 4,
  }] }));
  const landmarks = Object.entries(catalog["dev.axis-marker"].landmarksM).map(([name, position]) => ({
    name: `landmark-${name}`, translation: [-position[0]!, position[1]!, position[2]!],
  }));
  const nodes = [...geometries.map((g, mesh) => ({ name: g.name, mesh })), ...landmarks];
  const gltf = {
    asset: { version: "2.0", generator: "Stop That Guy! T008 fixture exporter v1", copyright: "Original project development sample; assets/licenses/dev-axis-marker.txt" },
    scene: 0, scenes: [{ name: "DEVELOPMENT calibration — not final art", nodes: nodes.map((_, i) => i) }], nodes, meshes,
    materials: geometries.map((g) => ({ name: g.name, pbrMetallicRoughness: { baseColorFactor: g.color, metallicFactor: 0, roughnessFactor: 0.72 } })),
    buffers: [{ byteLength: offset }], bufferViews, accessors,
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat(binaryParts);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + bin.length, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, paddedJson, binHeader, bin]);
  const technical = { triangles: geometries.reduce((n, g) => n + g.indices.length / 3, 0), lods: 1, materials: geometries.length, textureSizes: [], animations: [] };
  return { glb, technical, sha256: createHash("sha256").update(glb).digest("hex") };
}

export function buildSample(checkOnly: boolean) {
  const result = exportSample();
  const target = resolve(ROOT, "apps/client/public", catalog["dev.axis-marker"].runtimePath);
  const manifestPath = resolve(ROOT, "assets/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let entry = manifest.assets.find((a: { id: string }) => a.id === "dev.axis-marker");
  if (checkOnly) {
    if (!entry || entry.runtimePath !== catalog["dev.axis-marker"].runtimePath) throw new Error("Manifest/catalog ID or path mismatch");
    if (!readFileSync(target).equals(result.glb)) throw new Error("Stale GLB: run scripts/assets/build.ts");
    if (entry.fileSizeBytes !== result.glb.length || JSON.stringify(entry.technical) !== JSON.stringify(result.technical)) throw new Error("Stale manifest technical metadata");
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, result.glb);
    if (!entry) {
      entry = {
        id: "dev.axis-marker", kind: "model", runtimePath: catalog["dev.axis-marker"].runtimePath,
        source: { path: "assets-source/dev-axis-marker.json", url: null },
        creator: "Chat C (Codex), original procedural geometry for Stop That Guy!", origin: "self-authored",
        license: { id: "LicenseRef-Project-Original", textPath: "assets/licenses/dev-axis-marker.txt", url: null },
        attribution: { required: false, text: null },
        modifications: "Deterministic export by scripts/assets/build.ts: metres, X reflection and winding reversal to right-handed glTF. Development calibration only.",
        generatorTermsCheckedAt: null,
      };
      manifest.assets.push(entry);
    }
    entry.fileSizeBytes = result.glb.length;
    entry.technical = result.technical;
    manifest.status = "active";
    manifest.description = "Runtime provenance, schema 1. Only an original DEVELOPMENT calibration sample ships; no final characters, city, vehicles or audio are available yet. See assets/CANDIDATES.md.";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildSample(process.argv.includes("--check"));
  console.log(`dev.axis-marker: ${result.glb.length} bytes; ${result.technical.triangles} triangles; sha256 ${result.sha256}`);
}
