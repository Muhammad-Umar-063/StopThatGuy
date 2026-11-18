# T015 acceptance evidence — 18 November 2026

The original player and satchel robber are actual skinned GLBs, approximately
1.82 m tall, rendered through Babylon 9.37's official lazy loader in the committed
`first-street-1` T011 environment. They are an original art direction pending user
review. The isolated fixture supplies presentation inputs and a provisional camera;
it does not establish multiplayer/gameplay integration.

## Reproducible gates

Run from DevPack, with the assigned browser lock:

```sh
node assets-source/characters/export.mjs --check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh npm run check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh env KEYBOARD_BROWSER_PORT=5415 ASSET_BROWSER_PORT=5515 npm run test:browser
```

The five character tests are registered in `npm test`/`npm run check`. They verify
byte reproduction and technical metadata; normals/weights/scales; real Babylon
skin and clip decoding; deformed vertex grounding, reduced-speed blend and stance;
and lazy load/yaw/LOD/cancellation-completion-race/repeated-disposal behavior.
The sixteen asset tests also validate the character category and preserve
cross-category duplicate ID/path rejection. NullEngine tests alone are not visual
proof.

The registered character browser gate runs both Vite dev and an independent
production build on strict port 5215. Each run checks seven views, twelve motion
transitions (idle/run/sprint/reduced speed/left and right turns at both qualities), world-space stance slip, keyboard shortcuts/native button activation,
three reloads, full disposal, cancellation, visible real-404 failure, recovery,
scene shutdown and a clean console. It advances deterministic presentation time
and submits controlled real WebGL frames before screenshots, avoiding unnecessary
continuous SwiftShader rendering during capture. The interactive preview retains
its normal render loop. Neither mode is an FPS benchmark.

Machine-readable evidence and screenshots are ignored artifacts under
`test-results/characters/{dev,built}/`. Each `browser.json` includes pass/failure,
timestamps, source and runtime SHA-256 hashes, browser/renderer identity, costs,
transition weights and resource counts. Inspect `low-chase.png`, `medium-front.png`,
`low-hill.png`, `medium-hill.png`, `low-far-lod.png`, `motion-sprint-7-0.png`,
`motion-run-3.2--1.png`, their `low-motion-*` equivalents and `load-failure.png`. The final handoff records aggregate
gate results; logs are `check.txt` and `browser-suite.txt` in the same artifact root.

## Recorded results

- `npm run check`: exit 0; 339 tests, zero failures/skips, typecheck, build,
  manifest validation and Chrome smoke passed (`test-results/characters/check.txt`).
- Full assigned `npm run test:browser`: exit 1 after keyboard, lobby, asset,
  camera and six environment views passed; the unchanged environment gate hit a
  10-second CDP `Runtime.evaluate` timeout (`browser-suite.txt`). This is not a
  successful aggregate invocation.
- Locked standalone `node apps/client/src/render/environment/browser.mjs` retry:
  exit 0, six views, reload/disposal and clean console (`environment-retry.txt`;
  `test-results/environment/browser.json`).
- Locked `npm run test:characters:browser`: exit 0; dev and built each have seven
  views and eighteen motion/input/lifecycle checks, with no console errors
  (`browser-focused.txt`). Final captures completed at 12:41:23Z and 12:42:23Z on
  18 November. Recorded runtime/source hashes match the final files.
- Export reproduction, `git diff --check` and new-file whitespace check: passed.

All component acceptance gates have passing evidence. The aggregate timeout is
retained for the integrator; the unchanged environment harness uses a shorter CDP
budget than this task's controlled-frame capture. No unrelated test was edited
or assertion skipped. Final low/medium and motion screenshots were inspected.

## Measured costs

Chrome 154.0.8037.92; ANGLE Vulkan SwiftShader (Subzero). CSS viewport 1440 × 900.
These are the actual two-character fixture costs, not a six-player/device budget.

| Metric | Low | Medium |
| --- | ---: | ---: |
| Internal resolution | 1080 × 675 | 1440 × 900 |
| Scene draw calls, chase / front / hill | 30 / 24 / 22 | 63 / 57 / 55 |
| Selected player / robber triangles | 4,528 / 4,760 | 12,824 / 13,768 |
| Street instance triangles before culling | 103,688 | 196,904 |
| Combined triangles including two 120-triangle contacts, before culling | 113,216 | 223,736 |
| Street RGBA + mip estimate, excluding shadow map/shared LUT | 3,932,160 bytes | 3,932,160 bytes |
| Street shadow map | none | 1024 × 1024 |

Each character uses one model material plus one contact material, 17 joints and
five clip groups. No authored character image textures are present. Babylon uses
one runtime bone-palette texture per character (1,152 bytes each in this browser).
All three LODs are resident: player 12,824 / 4,528 / 1,900 triangles; robber
13,768 / 4,760 / 2,020. Far-view acceptance selects LOD2 for both.

Observed native character mesh-buffer payloads are 815,928 bytes for the player
and 875,416 bytes for the robber (1,691,344 bytes total, about 1.61 MiB). This counts
unique native vertex capacities and index count × native index width; Babylon
9.37 leaves index-buffer `capacity` at zero. It excludes contact geometry, CPU
copies, animation arrays, drivers and other scene resources, so it is not total
GPU/process memory. GLBs total 1,969,392 bytes. Exact source/runtime hashes and
exported buffer/LOD inventories are in `assets-source/characters/export-report.json`.

## Behavior and limits

At 4.8 m/s, the sampled planted foot moves at most 0.000070572 m per 1/240-second
sample in world space; sampled stance-height range is below 0.000001 m. The 0.4 m/s
case settles near 50% idle / 50% run without sole penetration. This proves these
fixture samples, not arbitrary-terrain IK. The hill view checks the authored 5%
grade; it does not add collision or terrain authority.

Three reloads plateau at 57 meshes, 26 materials, 12 textures, 2 skeletons,
10 animation groups, 43 transform nodes and 10 scene-dispose observers. Unloading
characters returns to the current low-quality environment baseline: 47 / 22 / 10 /
0 / 0 / 1 / 4 respectively. Scene shutdown leaves zero meshes, materials, textures,
skeletons, animation groups and transform nodes.

Real Android/low-end FPS, driver memory/thermal behavior and six-player performance
remain unmeasured. User art approval and T020 gameplay presentation wiring remain
pending. Riding, stumble, police and victory animation are later scope. No new
package, purchased model, third-party archive or dependency-lock change is needed.
