import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector.js";
import { ASSET_CATALOG, DEVELOPMENT_SAMPLE_ID } from "./catalog.js";
import type { VisualAsset } from "./loadVisualAsset.js";

/** Development fixture inspection only. Never produces world colliders. */
export function inspectSample(asset: VisualAsset) {
  const definition = ASSET_CATALOG[DEVELOPMENT_SAMPLE_ID];
  const minimum = new Vector3(Infinity, Infinity, Infinity);
  const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  const inversePlacement = Matrix.Invert(asset.root.computeWorldMatrix(true));
  let triangles = 0;
  for (const mesh of asset.container.meshes) {
    if (!mesh.getTotalVertices()) continue;
    mesh.computeWorldMatrix(true);
    triangles += mesh.getTotalIndices() / 3;
    for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      const point = Vector3.TransformCoordinates(corner, inversePlacement);
      minimum.minimizeInPlace(point);
      maximum.maximizeInPlace(point);
    }
  }
  const landmarks = Object.fromEntries(Object.keys(definition.landmarksM).map((name) => {
    const node = asset.container.transformNodes.find((n) => n.name === `landmark-${name}`);
    if (!node) throw new Error(`Missing calibration landmark: ${name}`);
    node.computeWorldMatrix(true);
    return [name, node.getAbsolutePosition().asArray()];
  }));
  const errors: string[] = [];
  function near(actual: readonly number[], expected: readonly number[], label: string) {
    if (actual.length !== expected.length || actual.some((n, i) => !Number.isFinite(n) || Math.abs(n - expected[i]!) > 1e-5)) {
      errors.push(`${label}: got [${actual}], expected [${expected}]`);
    }
  }
  near(minimum.asArray(), definition.boundsM.min, "minimum (metres)");
  near(maximum.asArray(), definition.boundsM.max, "maximum (metres)");
  for (const [name, local] of Object.entries(definition.landmarksM)) {
    near(landmarks[name]!, Vector3.TransformCoordinates(Vector3.FromArray(local), asset.root.getWorldMatrix()).asArray(), name);
  }
  if (triangles !== 128) errors.push(`Expected 128 sample triangles, got ${triangles}`);
  return { ok: errors.length === 0, errors, boundsM: { min: minimum.asArray(), max: maximum.asArray() }, landmarksM: landmarks, triangles,
    materials: asset.container.materials.length, textures: asset.container.textures.length, animations: asset.container.animationGroups.map((a) => a.name) };
}
