// Run through tsx so the test exercises the actual client TypeScript loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { loadVisualAsset, AssetLoadError } from '../../apps/client/src/render/assets/loadVisualAsset.ts';
import { inspectSample } from '../../apps/client/src/render/assets/inspectSample.ts';
import { assetUrl } from '../../apps/client/src/render/assets/catalog.ts';
import { exportSample } from './build.ts';

const id = 'dev.axis-marker';
const bytes = exportSample().glb;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The scene owns Babylon's shared BRDF lookup texture. Never dispose it per asset.
const counts = (scene) => [scene.meshes.length, scene.materials.length, scene.textures.filter((t) => t !== scene.environmentBRDFTexture).length,
  scene.geometries.length, scene.transformNodes.length, scene.animationGroups.length];
async function fixture(run, fetcher = async () => new Response(bytes)) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { await run(scene); } finally { globalThis.fetch = originalFetch; scene.dispose(); engine.dispose(); }
}

test('importing the public API does not eagerly register the glTF plugin', () => {
  assert.equal(SceneLoader.IsPluginForExtensionAvailable('.glb'), false);
});

test('catalog URL supports a deployment subpath and rejects unknown IDs', () => {
  assert.equal(assetUrl(id, '/game/'), '/game/assets/dev/axis-marker.glb');
  assert.throws(() => assetUrl('missing'), /Unknown visual asset/);
});

test('official loader: metre bounds, upright/forward/right landmarks, origin, technical metadata and yaw', () => fixture(async (scene) => {
  const baseline = counts(scene);
  const asset = await loadVisualAsset(scene, id);
  const info = inspectSample(asset);
  assert.equal(info.ok, true, info.errors.join('; '));
  assert.equal(info.triangles, 128);
  assert.equal(info.materials, 3);
  assert.equal(info.textures, 0);
  assert.deepEqual(info.animations, []);
  assert.deepEqual(info.landmarksM.origin, [0, 0, 0]);
  assert.ok(Math.abs(info.landmarksM.right[0] - 0.5) < 1e-6, 'asymmetric side is +X after glTF conversion');
  // Inspect actual loaded vertices too; landmark transforms alone could lie.
  const arrow = asset.container.meshes.find((m) => m.name === 'calibration-forward-arrow');
  arrow.computeWorldMatrix(true);
  const vertices = arrow.getVerticesData(VertexBuffer.PositionKind);
  const tip = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const world = Vector3.TransformCoordinates(Vector3.FromArray(vertices, i), arrow.getWorldMatrix());
    if (Math.abs(world.z - 1) < 1e-6) tip.push(world);
  }
  assert.ok(tip.length > 0 && tip.every((v) => Math.abs(v.x) < 1e-6));
  assert.ok(asset.container.meshes.every((m) => !m.checkCollisions && !m.isPickable));
  asset.root.rotation.y = Math.PI / 2;
  const rotated = inspectSample(asset);
  assert.equal(rotated.ok, true, rotated.errors.join('; '));
  assert.ok(Math.abs(rotated.landmarksM.forward[0] - 1) < 1e-6);
  assert.ok(Math.abs(rotated.landmarksM.forward[2]) < 1e-6);
  asset.dispose(); asset.dispose();
  assert.deepEqual(counts(scene), baseline);
}));

test('repeated and concurrent loads own separate resources and dispose to baseline', () => fixture(async (scene) => {
  const baseline = counts(scene);
  let sharedBrdf;
  for (let i = 0; i < 3; i++) {
    const [a, b] = await Promise.all([loadVisualAsset(scene, id), loadVisualAsset(scene, id)]);
    sharedBrdf ??= scene.environmentBRDFTexture;
    assert.equal(scene.environmentBRDFTexture, sharedBrdf, 'reuse the scene cache across loads');
    a.dispose();
    assert.equal(inspectSample(b).ok, true);
    assert.ok(!b.root.isDisposed());
    b.dispose();
    assert.deepEqual(counts(scene), baseline);
    assert.deepEqual(scene.textures, [sharedBrdf], 'only one scene-owned lookup texture persists');
  }
}));

for (const [name, response] of [
  ['HTTP 404', () => new Response('not found', { status: 404 })],
  ['invalid GLB', () => new Response('this is not glTF')],
  ['truncated GLB', () => new Response(bytes.subarray(0, 40))],
]) {
  test(`${name} reports a named asset error and leaves no scene resources`, () => fixture(async (scene) => {
    const baseline = counts(scene);
    await assert.rejects(loadVisualAsset(scene, id), (e) => e instanceof AssetLoadError && e.code === 'load' && e.message.includes(id));
    assert.deepEqual(counts(scene), baseline);
  }, async () => response()));
}

test('pre-cancelled load performs no fetch', () => fixture(async (scene) => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(loadVisualAsset(scene, id, { signal: abort.signal }), { code: 'cancelled' });
}, () => { throw new Error('fetch must not start'); }));

const stalledFetch = (_, { signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});
test('timeout and scene disposal abort in-flight work without attaching resources', () => fixture(async (scene) => {
  const baseline = counts(scene);
  await assert.rejects(loadVisualAsset(scene, id, { timeoutMs: 10 }), { code: 'timeout' });
  assert.deepEqual(counts(scene), baseline);
  const result = loadVisualAsset(scene, id);
  const rejected = assert.rejects(result, { code: 'cancelled' });
  scene.dispose();
  await rejected;
}, stalledFetch));

test('late successful decode after cancellation is disposed', () => fixture(async (scene) => {
  const baseline = counts(scene);
  const abort = new AbortController();
  let decodedMeshes = 0;
  let reachedEnd;
  const complete = new Promise((resolve) => { reachedEnd = resolve; });
  const observer = SceneLoader.OnPluginActivatedObservable.addOnce((plugin) => {
    plugin.onMeshLoadedObservable.add(() => {
      decodedMeshes++;
      // Cancel during the actual decoder, after it creates its root mesh.
      if (decodedMeshes === 1) abort.abort();
    });
    plugin.onCompleteObservable.addOnce(reachedEnd);
  });
  try {
    await assert.rejects(loadVisualAsset(scene, id, { signal: abort.signal }), { code: 'cancelled' });
    await Promise.race([complete, delay(1000).then(() => { throw new Error('Decoder did not finish after cancellation'); })]);
    await delay(0); // allow the wrapper to dispose the completed, unmounted container
    assert.equal(decodedMeshes, 4, 'official decoder completed the root plus all three meshes');
    assert.deepEqual(counts(scene), baseline);
  } finally { SceneLoader.OnPluginActivatedObservable.remove(observer); }
}));

test('scene disposal releases an already loaded instance; right-handed scenes are rejected', () => fixture(async (scene) => {
  const asset = await loadVisualAsset(scene, id);
  scene.dispose();
  assert.ok(asset.root.isDisposed());
  assert.equal(scene.textures.length, 0, 'scene disposal also frees the shared BRDF texture');
  asset.dispose();
  await assert.rejects(loadVisualAsset(scene, id), { code: 'scene' });
}));
test('right-handed scenes cannot silently change the project coordinate convention', () => fixture(async (scene) => {
  scene.useRightHandedSystem = true;
  await assert.rejects(loadVisualAsset(scene, id), { code: 'scene' });
}));
