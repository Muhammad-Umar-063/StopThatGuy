# T008 evidence — interim install, 17 November 2026

Current result: locked-install integration passes; see
[batch 1 verification](../../coordination/integration/BATCH_1.md). Earlier text logs
retain the original pre-integration failures; browser JSON/images were refreshed.

**Task status remains blocked.** The functional evidence below uses the approved
local `--no-save` install of `@babylonjs/loaders@9.37.0` and its required peer
`babylonjs-gltf2interface@9.37.0`. Both are extraneous until Chat D's exact-pinned
manifest/lockfile update reaches this branch. A clean `npm ci` gate is pending.

| Evidence | Actual result |
|---|---|
| `asset-tests.txt` | **14/14 pass**: deterministic export/catalog/provenance; lazy plugin registration; real Babylon GLB transforms/vertices/counts; concurrent/repeated disposal; 404/corrupt/truncated GLB; pre-cancellation, timeout, scene exit and cancellation during real decoding. |
| `browser-dev.json`, `browser-dev.txt`, `dev-*.png` | **Pass**, actual Vite development page. |
| `browser-built.json`, `browser-built.txt`, `built-*.png` | **Pass**, actual production demo bundle. |
| `typecheck.txt` | Workspace/tools typecheck passes. |
| `check.txt` | **Fails** only at the existing shared test requiring the repository manifest to be empty (`packages/test-support/test/asset-manifest.test.ts:50–56`). Typecheck/build and 30 simulation tests pass; test-support 146/147 pass. |
| `root-tests.txt` | Separately run after the check stopped: **3/3 pass**. |
| `validate.txt` | Separately run existing validator: active / one real asset, no errors or warnings. |
| `smoke.txt` | Separately run built server/client smoke: **pass** with no browser errors. |

Both asset browser runs used Chrome **154.0.8037.92**, 1280×900, headless SwiftShader,
on **5208** with strict port selection. They verified the loader adapter is not
requested until Load is clicked, real rendering and measured metre bounds, ground
origin, forward/right/upright axes, +90° yaw toward +X, three unload/reload cycles,
visible HTTP 404 and corrupt-file errors, successful retries, and complete scene
shutdown. JSON records the deliberate 404 separately from unexpected errors;
there are no unexpected errors/warnings. Perspective and yaw screenshots were
visually inspected. All started test processes stopped and port 5208 was released.

Asset disposal returns all asset resources to baseline. Babylon's one scene-owned
BRDF lookup texture is accounted separately, reused across loads and freed on
scene shutdown. No asset textures ship. Built demo chunk output includes a
983.11 kB (232.82 kB gzip) **demand-loaded** `gltfSupport` chunk and further lazy
PBR chunks; this is the standalone demo build, not a measured main-game size delta.
The build warns about large chunks. No representative performance claim is made;
T031 owns further budgeting and real hardware measurement.

Source export SHA-256:
`7d1761290d2171c0334b2f85492069c786ea27e1741a35bca048787b5393f069`.
Runtime GLB is 12,764 bytes, 128 triangles, 3 materials, 1 base LOD, no textures or
animations. `tsx scripts/assets/build.ts --check` confirms byte reproducibility.

Tracked files unchanged by the authorized temporary install:
- `apps/client/package.json`: `08c9adc0fd53bbd20a64c31c83143db805a14809e43b88ed47a3b7e10c638555`
- `package-lock.json`: `21f42dcac8baaa1cb447f480221c0c3ef4b60a9bc48d5d9f5d94404c0fa099a8`

Before `in_review`: obtain the tracked dependency update and shared test correction
through Chat D/user integration, run `npm ci`, rerun the focused/browser gates and
`npm run check`, and update this evidence. No real device/GPU/Android benchmarks or
final visual-quality acceptance exist.
