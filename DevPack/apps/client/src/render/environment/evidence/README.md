# T011 evidence — 17 November 2026

The final production preview passed six rendered views, reload resource equality,
and complete shutdown in Chrome 154.0.8037.92 using SwiftShader. All low/medium
views were inspected. This is actual rendering with a labeled fixed preview camera
and player-scale capsule; it is not a live chase, final character or final user art
approval. Surrounding map expansion remains T016.

| Quality | View | Internal resolution | Draw calls/frame | Scene triangles before culling |
|---|---|---|---|---|
| low | Bank approach | 1080×675 | 29 | 103,688 |
| low | Alley junction | 1080×675 | 22 | 103,688 |
| low | Hill grade | 1080×675 | 19 | 103,688 |
| medium | Bank approach | 1440×900 | 62 | 196,904 |
| medium | Alley junction | 1440×900 | 55 | 196,904 |
| medium | Hill grade | 1440×900 | 52 | 196,904 |

Low has 636 repeated mesh instances; medium has 716. Both use nine asset/sign
textures (five 256², one 512², three 512×128), estimated 3.75 MiB RGBA plus mipmaps.
This excludes the renderer's BRDF lookup texture, shadow attachment and other GPU
allocations. Medium adds a 1024² shadow map. Triangle totals exclude the marker
and count the environment before frustum culling; draw calls are actual measured
per-frame totals. These costs are not device frame-time measurements.

- `browser.json`, `browser.txt`, `low-*.png`, `medium-*.png`: final street acceptance.
  Medium reload restores 48 meshes / 23 materials / 11 textures exactly; unload
  leaves only the marker, its material and engine BRDF lookup (1/1/1); shutdown
  leaves zero scene resources. No browser errors. Command:
  `ENVIRONMENT_EVIDENCE_DIR=apps/client/src/render/environment/evidence node apps/client/src/render/environment/browser.mjs`.
- `unit.txt`: 10 passing focused tests: six environment checks (including upward
  surface winding) and four provenance/combined-category checks.
- `export.txt`: deterministic original GLB check, 1,211,428 bytes / 6,440 template
  triangles / 14 materials. The runtime procedural street has additional geometry.
- `check.txt`: final `npm run check` passed: 279 registered tests, typecheck,
  production build, individual+combined asset validation, world validation and
  actual smoke browser. Explicit environment tests still await integration script registration.
- `regression-browser.txt`: latest assigned baseline browser run failed only the
  pre-existing keyboard test's assumption that blur precedes hidden. Both real
  events fired in the opposite order. An earlier calibration browser run also
  exposed a documentElement readiness race. The coordinator owns these fixes in
  main and will rerun combined gates after merge; this worktree does not claim
  a green baseline browser rerun.

Inspection caught and fixed backface-culled ground, recessed facade panels hidden
by shells, mirrored sign UVs, open roof/ground gaps and cloned plaster texture
leaks. Initial numeric browser passes alone were not treated as visual acceptance.
The final views include those fixes. One intermediate concurrent software-render
run timed out; final runs were serial with bounded readiness/frame waits.

Normal browser runs write ignored `test-results/environment`, keeping curated
screenshots stable. No real laptop/Android performance or five-minute chase claim.
No new dependencies, third-party assets, package changes or Git operations by the worker.
