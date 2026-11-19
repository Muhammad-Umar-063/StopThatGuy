# T019 verification evidence

Evidence is from the assigned `task/T019-transport-art` checkout, based on `46811168fab6feab33858ff0830a8d0631273fa8`, on 19 November 2026. Runtime/source hashes in the dev and built browser JSON reports match the checked outputs. The exact source and GLB SHA-256 values are in `export-report.json`.

## Asset costs

| Asset ID | GLB bytes | Near / middle / far triangles | All resident triangles | Actual native vertex/index bytes |
| --- | ---: | ---: | ---: | ---: |
| `vehicle.bicycle` | 462,372 | 6,088 / 3,332 / 1,996 | 11,416 | 448,096 |
| `vehicle.scooter` | 404,940 | 7,072 / 3,536 / 1,912 | 12,520 | 393,360 |
| `vehicle.lift` | 498,656 | 7,680 / 4,296 / 2,512 | 14,488 | 483,248 |

Total GLB payload: 1,365,968 bytes (1.30 MiB). Each vehicle uses one vertex-colour PBR material, zero image textures, and one extra contact-shadow mesh/material (120 triangles). All three LODs remain resident. These figures exclude the reused street and character assets.

## Actual rendering

Chrome 154.0.8037.92 used WebGL2 through ANGLE/Vulkan SwiftShader. Dev and isolated production builds each capture 28 views and perform 12 articulation, keyboard, delayed-load quality, failure, retry, cancellation and lifecycle checks. The viewport is 1440×900; low renders at 1080×675 and medium at 1440×900. Captures submit controlled real WebGL frames; they are not NullEngine screenshots or hardware FPS tests.

Across the reviewed dev/built views:

| Setting | Scene draw calls | Submitted triangles, including passes | Reused street geometry | Highest configured geometry with three fit characters |
| --- | ---: | ---: | ---: | ---: |
| Low | 24–34 | 102,598–117,764 | 103,688 | 122,280 |
| Medium | 58–66 | 395,410–436,804 | 196,904 | 244,480 |

`submittedTriangles` comes from Babylon's actual index submission counter and includes thin-instance multiplicity and extra rendering passes. Medium enables the existing 1024² street shadow map, so submitted triangles must not be confused with the single visible scene's geometry. Configured geometry includes all enabled street instances, which can exceed what a given view submits. The vehicle is selected one at a time; this is not a worst-case city fleet benchmark.

The reused street reports nine image/dynamic textures and 3,932,160 bytes estimated RGBA/mips. Scene texture inventory additionally records Babylon's 256² BRDF LUT, medium's 1024² shadow map, and up to three 72×1 float bone palettes (1,152 bytes each) for the fit characters. No vehicle image textures are hidden in these numbers. Native render-target allocation/driver overhead is not estimated as measured GPU memory.

Screenshots and machine-readable evidence (ignored, local artifacts):

- `test-results/vehicles/dev/browser.json` and `test-results/vehicles/built/browser.json`.
- `{dev,built}/{bicycle,scooter,lift}-{low,medium}-{chase,front,side}.png`.
- `{dev,built}/{bicycle,scooter,lift}-{low,medium}-static-fit.png`.
- `{dev,built}/{bicycle,scooter,lift}-articulation.png`, `*-low-far.png`, `lift-hill-street.png`, `load-failure.png`.

The screenshots were visually inspected. They establish metre-scale appearance, front orientation, smooth surfaces, actual character placement and the low/medium appearance in the committed street. They do not establish driving, boarding, collision authority or finished character riding poses.

## Fit and review

Five registered vehicle tests cover deterministic source outputs and rights metadata, finite normals/winding, all LODs, actual loaded vertex envelopes, supporting geometry below sole contacts, tire/fender clearance, world-space anchors with yaw/steering/crank transforms, LOD hysteresis, invalid input, failed/cancelled loads, completion-boundary cancellation, resource plateaus and scene cleanup. Both integrated player and robber rigs are tested at all three LODs, two yaws and a translated/elevated origin. CPU-deformed sole vertices are checked against contacts, in addition to actual transformed palm/sole points. Browser fit residuals are at most 4.66 mm; imported sole support checks permit up to 30 mm surface clearance.

A second assistant independently reviewed lifecycle, coordinate signs, registration and real skin/geometry fit. Review found and prompted fixes for palm-frame measurement, lift footwell clearance and quality changes during pending loads. Screenshot inspection also prompted fender clearance and a curved scooter shield. The final independent scooter check found no lower-leg/shoe intersections with hard body/shield/wheels across either character or any LOD; shield clearance was 41–61 mm. Soft cushion contact compresses approximately 8–16 mm in the static pose. Lift soles stand 17–24 mm above the sloped deck. These are explicit static-fit approximations; T023 owns final riding deformation and full steering/pedal-range contact behavior.

## Gate records and limits

Focused checks, mandatory check and full browser gate logs are retained under `test-results/vehicles/`. The final run records numeric command results in `check-final.exit` and `full-browser-final.exit` alongside `check-final.log` and `full-browser-final.log`. An earlier combined shell returned 143 after all assertions printed success; that run was not used as a clean command-level acceptance result. The final rerun passed both commands with recorded exit **0**: mandatory `npm run check` (404 tests plus real browser smoke) and the complete `KEYBOARD_BROWSER_PORT=5419 ASSET_BROWSER_PORT=5519 npm run test:browser` chain. Both used the batch browser lock. `git diff --check` also passed.

No physical Android/low-end device, touch boarding, city fleet stress test, authoritative vehicle logic, integrated T020 gameplay or T023 riding animation was tested. User art approval remains pending. The isolated preview emits Vite's advisory large-chunk warning because it includes the street, character and art-review fixtures; production consumers should load the vehicle module on demand through the documented lazy API. No dependency, lockfile, bootstrap, world data or collision contract changed.
