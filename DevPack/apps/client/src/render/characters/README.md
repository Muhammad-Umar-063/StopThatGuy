# T015 character presentation

`loadCharacter(scene, 'player' | 'robber', options)` uses the integrated lazy GLB
loader and returns one owned character with three LOD meshes, one skeleton, five
real clip mappings, one image-free surface material and a separate feathered
contact-shadow material. `update(dtSeconds, input, cameraDistanceM)` consumes typed `CharacterPresentation`: actual speed, locomotion,
turn effort, world ground position, yaw and optional route slope. Clamp frame
stalls to at most 0.25 seconds. No simulation/network dependency or subscription
is created; the caller owns its update loop.

`CharacterAnimator` samples the imported AnimationGroup tracks into reused
quaternion/vector scratch storage. Idle/run/sprint weights fade over 100 ms;
run and sprint share a phase and actual speed determines cadence from blended
stride length. A sprint intention at zero speed still displays idle. Turn clips
add upper-body balance without resetting lower-body phase. Stop/start preserves
gait phase; idle breathing continues. A post-blend hip correction prevents nonlinear
quaternion blending from pushing either sole into the ground while retaining
authored airborne phases. Low selects LOD1 near and LOD2 beyond 15 m;
medium selects LOD0 near, LOD1 beyond 9 m and LOD2 beyond 24 m. A 1 m hysteresis
band avoids distance-boundary flicker. Identity and bag remain visible in each.

Pass AbortSignal/timeout to loading. Errors from the lazy API are surfaced to the
caller. `dispose()` is idempotent and releases the owned skeleton, all LOD meshes,
clip groups, materials, shadow and scene observer. Scene disposal also releases
the character. Babylon's shared environment BRDF LUT belongs to the scene; it is
not a per-character texture and must not be destroyed while the street uses it.
Repeated-load checks compare stable resource counts, then require zero after
scene shutdown.

## Preview and gates

The character-owned `vite.config.mjs` leaves global Vite/bootstrap untouched.
Manual preview: `node_modules/.bin/vite --config
apps/client/src/render/characters/vite.config.mjs` (strict port 5215), then
`/src/render/characters/preview.html`. It renders the committed T011 street via
`createStreetEnvironment`, with a provisional review camera and presentation-only
movement. It is not online gameplay or the T010 camera. Buttons and 1–5/L/M/C,
Space and arrow shortcuts support keyboard review. Four views include a 5% hill and a far-LOD check.

Unit checks are registered in `npm test`/`npm run check`; dev and built browser
checks are registered in root `npm run test:browser`. Run all Chrome gates through
the shared batch lock, including check's smoke. Artifacts are ignored:

- `test-results/characters/unit.txt`, `typecheck.txt`, `check.txt` and `browser-suite.txt`.
- `test-results/characters/dev/` and `built/`: screenshots and `browser.json`.
- Source/runtime hashes and mesh budgets: `assets-source/characters/export-report.json`.

Measured costs, reproducible acceptance coverage and artifact interpretation are in
[EVIDENCE.md](EVIDENCE.md). Automated capture advances controlled real WebGL frames;
the interactive preview retains its normal loop.

SwiftShader evidence proves rendering/behavior on that browser only. Real Android
FPS, GPU memory/thermal behavior and user art approval remain unverified. Future
riding, stumble, police and victory expansion is intentionally outside this task.
Full online presentation wiring remains T020; no character was silently installed
in the normal smoke bootstrap. No dependency or lockfile edit is required.
