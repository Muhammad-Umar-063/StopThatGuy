# T008 asset workflow

Only `dev.axis-marker` ships. It is an original **development calibration sample**,
not a final character, vehicle, street or visual-quality target. Final content gaps
and creator/license links are in [CANDIDATES.md](CANDIDATES.md).

## Reproduce and verify

Run from this worktree's `DevPack/` using the locked install:

```sh
node_modules/.bin/tsx scripts/assets/build.ts
node_modules/.bin/tsx scripts/assets/build.ts --check
node_modules/.bin/tsx --conditions=stopthatguy-source --test scripts/assets/workflow.test.ts scripts/assets/runtime.test.mjs
node scripts/assets/browser.mjs --dev
node scripts/assets/browser.mjs
npm run check
git diff --check
```

The first command exports the source dimensions/colors deterministically, then
records actual bytes and technical counts in schema-1 `manifest.json`. It changes
only this sample's runtime file and manifest metadata. `--check` never writes and
fails for stale exports or counts. The workflow test checks complete runtime-file
coverage, provenance files and the existing schema validator. The runtime tests
load the actual bytes through Babylon, check transformed vertices/landmarks and
metadata, and exercise errors, cancellation, timeout, isolation and disposal.

**Dependencies:** Exact `@babylonjs/loaders@9.37.0` and
`babylonjs-gltf2interface@9.37.0` pins are tracked with the workspace lockfile.
A clean install, focused tests, full check and dev/built browser gates passed
at batch 1 integration. The earlier temporary install is no longer required.

The public `loadVisualAsset.ts` API dynamically imports `gltfSupport.ts` only when
an asset needs decoding. That adapter owns the approved official glTF imports.
Do not eagerly import/re-export the adapter from bootstrap. Node and dev/built
browser tests verify lazy registration/chunk loading. No custom GLB parser, CDN
loader, compression decoder or serializer dependency is used.

The shared manifest regression now validates the repository's actual status and
content, with a separate synthetic test for empty-development data.

The browser runner starts its own server on **5208** by default (override with
`ASSET_BROWSER_PORT`) with strict port selection,
and stops only its own server/browser. Default mode builds the standalone demo
into ignored `scripts/assets/.demo-dist/` and serves that production bundle;
`--dev` serves source. Both record actual browser JSON/screenshots in ignored
`test-results/assets/`, so verification does not modify another task's tracked
evidence. The asset owner may set `ASSET_EVIDENCE_DIR=assets/evidence` to refresh
curated evidence deliberately. A missing loader/browser or a busy port fails, never skips.
Chrome/Chromium must be installed (or set `CHROME_PATH`). SwiftShader evidence is
functional rendering evidence only, not a real-GPU or Android benchmark.
Both browser modes and all 14 focused asset tests pass with the locked install.
See coordination/integration/BATCH_1.md for the combined integration result.

To inspect manually, start `npm run dev:client -- --host 127.0.0.1 --port 5208
--strictPort` and open
`http://127.0.0.1:5208/src/render/assets/demo.html`. Append `?autoload=0` to wait for
the Load button (used to verify on-demand loading). It offers keyboard-accessible
retry, unload, yaw and top-view buttons. The development page is an independent
entry point; the normal game/bootstrap is unchanged. `npm run check` includes the focused asset tests and export check.
`npm run test:browser` runs keyboard and asset dev/built browser checks; CI runs
both commands. The standalone production build needs no config edit. It is not currently included in the ordinary game's production bundle.

## Files and stable IDs

- `assets-source/dev-axis-marker.json`: editable original dimensions/colors in metres.
- `scripts/assets/build.ts`: deterministic, tiny fixture exporter. Writes glTF 2.0
  JSON + binary chunks directly; it only exports this geometry and never parses
  an imported GLB. Blender is not installed/required for this development fixture.
- `assets/catalog.json`: central runtime ID/path table and calibration expectations.
  Rendering uses `AssetId`, never scattered paths. Retain IDs across art replacement.
- `assets/manifest.json`: schema-1 provenance and technical metadata, active because
  a real source/license/runtime entry exists. Candidate leads are excluded.
- `apps/client/public/assets/dev/axis-marker.glb`: 12,764 bytes, 128 triangles,
  three opaque rough PBR materials, one LOD (the base mesh), no textures/animations.
- `assets/licenses/dev-axis-marker.txt`: scoped original-project provenance and use
  record; no third-party license claim. AI-assisted procedural code, no media model.

The runtime API `loadVisualAsset(scene, id, {signal?, timeoutMs?, baseUrl?})` returns
an owned container and placement root. Position/yaw the placement root in project
coordinates. Dispose the returned handle on view removal. Each call owns separate
resources; no cache or instancing policy is implied. Loading errors include the
stable ID and a reason; callers display retry UI. Cancellation aborts fetch and
prevents late decoded containers from attaching. Scene exit also cancels pending
loads and disposes completed instances. The sample disables picking/collision.
Babylon creates one shared PBR BRDF lookup texture in the scene. Per-asset disposal
retains this scene-owned cache for other PBR users; tests identify it by object
identity, verify it does not grow across reloads, and check scene disposal frees it.
It is distinct from shipped textures and does not belong in the asset manifest.

## Coordinate contract and calibration

Project world: Babylon left-handed, metres, Y up, X/Z ground, yaw 0 = +Z;
positive yaw turns toward +X (shared `geometry.ts`). glTF is right-handed/Y-up.
The exporter reflects authored X and reverses winding, including reflected normals.
The [pinned Babylon 9.37.0 loader](https://github.com/BabylonJS/Babylon.js/blob/9.37.0/packages/dev/loaders/src/glTF/2.0/glTFLoader.pure.ts)
in AUTO mode inserts a Y half-turn and Z reflection for a left-handed scene;
together they reflect X back into project space. Keep that conversion root intact.
Do not also rotate/scale meshes to compensate, or set `useRightHandedSystem = true`.

The post touches y=0 and reaches y=1. Orange points forward to z=1; the asymmetric
pink marker reaches x=0.5. The authored ground origin is [0,0,0], not the visual
bounding-box center. Bounds are min [-0.18,0,-0.075], max [0.5,1,1]. Named landmarks
check origin/up/forward/right, loaded vertices check geometry, and the browser
shows a 0.25 m grid and metre axes. At +90° yaw, forward must become [1,0,0].
These are visual calibration bounds, never server colliders or route data.

## Adding real art later

Acquire only after checking the exact source/archive license. Save original source
and license text, creator, URL, acquisition date, and source hash; add manifest
provenance with technical counts from the exported file. For generated media also
record actual service terms and `generatorTermsCheckedAt`. Normalize metre scale,
upright/forward direction and ground/contact origin in Blender or the authoring
tool. Retain only required geometry, materials, textures and animation clips.
Reserve a catalog ID, export GLB, inspect normals/materials/rig, then validate the
actual browser import, transforms, failures and disposal. A manifest pass alone
cannot establish any of these. Candidate paths/IDs enter the active manifest only
once real licensed exports exist. Author gameplay collision separately in world data.

No compression is justified for this 12.8 KB sample. Do not add Draco/Meshopt/KTX
until required and tested end to end. Ordinary Git is adequate; Git LFS and Git
configuration remain unchanged. Reassess LFS for actual multi-megabyte source
files; do not check in whole downloaded packs or redundant build output.
