# Original transport art — T019

Arco city bicycle, Aurora step-through scooter and Largo electric delivery lift are original, reproducible art for Stop That Guy!, pending the user's art review. They are smooth vertex-coloured surfaces, not acquired stock meshes or promises of final device performance. The delivery lift has one driver and exactly two passenger seats; it is not a tram. No finished vehicle gameplay or riding animation is supplied.

## Reproduction and rights

From DevPack, run `node assets-source/vehicles/export.mjs` to regenerate the three GLBs, export report, typed definition data and environment-independent vehicle manifest. `node assets-source/vehicles/export.mjs --check` compares every output byte, including source SHA-256 hashes. `npm run test:vehicles` executes registered checks through the official Babylon glTF loader. `npm run check` includes these tests and asset catalog/manifest validation.

`geometry.mjs` supplies original smooth cylinders, ellipsoids, rounded body profiles and wheel surfaces. `model.mjs` supplies the original parts, palettes and two-passenger pictogram. `definition.mjs` is the single authored source for dimensions, pivots and contact anchors. `export.mjs` writes glTF 2.0; runtime parsing uses the integrated lazy Babylon loader. No decoder, engine or dependency was added. No external model, image, font or paid asset was acquired. The permission statement is `assets/licenses/vehicles/ORIGINAL.txt`; the active manifest records origin, creator, license, source, byte size and total resident geometry. `export-report.json` records exact source/runtime hashes and each LOD's costs. All three binaries together are about 1.30 MiB, each under 0.5 MiB, so Git LFS/compression setup is not justified or changed.

## Units, axes, authority

Authoring uses metres, +Y up, +Z vehicle forward, positive project yaw toward +X. Wheel bottoms touch Y=0. Export reflects X and reverses triangle winding; the official Babylon conversion root remains intact. Placement above that root takes project transforms. Steering uses the corresponding reflected local yaw; wheel spin uses local X. Geometry and visual anchors never write world routes, spawn records, physics, colliders or simulation state.

Parked visual envelope references match committed `WORLD_LAYOUT_LIMITS.spawnFootprint`: bicycle 0.9 m radius / 1.4 m height; scooter 1.0 / 1.4; lift 2.2 / 2.5. Actual imported vertices are tested against those envelopes. These are **unoccupied spawn clearance references**, not dynamic colliders or rider bounds. Occupied bicycles/scooters exceed 1.4 m height. T021 must resolve occupied movement using its authoritative contracts; art must not silently enlarge them. The merged city's existing wheel modes and lift circuit remain authoritative.

## Consumption and stable contacts

Import `loadVehicle` from `apps/client/src/render/vehicles/vehicle.ts` on demand. It returns a typed presentation controller, loaded through the existing lazy asset API. `update(dt, {position, yaw, speedMps, steeringRadians, pitch?, roll?, pedalAngleRadians?}, cameraDistanceM)` moves only visuals. Clamp dt to 0–0.25 seconds. Steering is bounded to ±0.6 rad, pitch/roll ±0.6 rad and signed visual speed ±40 m/s. `anchorToRef(name, vector)` yields the actual world contact, including steering/crank motion. `setQuality('low'|'medium')` selects LOD policy; `inspect()` is diagnostic and allocates; `dispose()` releases owned resources and is idempotent. Cancellation/failure releases partial loads, and scene shutdown disposes remaining visuals.

Stable IDs: `vehicle.bicycle`, `vehicle.scooter`, `vehicle.lift`. Read `VEHICLE_DEFINITIONS[type]` for named pivot hierarchy and seat roles:

- Bicycle/scooter: `seat.rider`, `hand.rider.L/R`, `foot.rider.L/R`; `pivot.steering`, `pivot.wheel.front/rear`. Bicycle adds `pivot.crank`; its foot contacts follow the crank.
- Lift: `seat.driver`, `hand.driver.L/R`, `foot.driver.L/R`; `seat.passenger.0/1`, `hand.passenger.0.L/R`, `hand.passenger.1.L/R`, corresponding foot contacts. Separate `pivot.steering.L/R` kingpins and `pivot.wheel.front.L/R`, `pivot.wheel.rear.L/R` avoid translating the wheels around a shared axle pivot. Driver handbar is stationary; steering articulates the front wheels.

Medium uses LOD0 below 12 m, LOD1 to 30 m, LOD2 beyond; low uses LOD1 below 18 m and LOD2 beyond. Boundaries have a 1 m hysteresis band. All three LOD geometries stay resident; only one is enabled. Each GLB uses one PBR vertex-colour material, no image textures and no animation clips. The controller adds one feathered contact shadow/material (120 triangles). Shadow projection is a simple presentation approximation, not a contact solver.

## Isolated review and evidence

Run `npx vite --config apps/client/src/render/vehicles/vite.config.mjs --port 5219 --strictPort`, then visit `http://127.0.0.1:5219/src/render/vehicles/preview.html`. The isolated config also builds the exact preview entry to ignored `test-results/vehicles/build`. It does not modify global Vite or bootstrap. Keys 1/2/3 select art, L/M select quality, C cycles provisional views, F shows real T015 static character fit, W spins wheels, arrows steer, Space stops. The committed T011 street supplies real scenery and ground elevation; this fixture does not claim city placement, driving or a gameplay camera.

`staticFit.ts` belongs only to review/tests. It poses the actual integrated 17-joint player/robber rig against authored contacts, measuring hip-seat, wrist-palm and ankle-sole gaps. It is neither a riding controller nor T023's animation implementation. The preview's hill view places the parked model on the sampled street elevation; it does not solve slope suspension. Contact fit is checked at rest, with yaw transforms and across low/medium LODs; wheel/crank/steering articulation is checked separately. A contact fit does not prove collision-free riding through the full motion range.

All Chrome commands, including smoke, must use the current batch lock:

```sh
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh npm run test:vehicles:browser
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh npm run check
KEYBOARD_BROWSER_PORT=5419 ASSET_BROWSER_PORT=5519 bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh npm run test:browser
```

Exit 75 means another task is actively testing; no browser reservation is held. Dev/built browser reports and screenshots live under `test-results/vehicles/{dev,built}/`. Reports contain source/runtime hashes, actual draw calls, loaded geometry buffers, visible LOD triangles, material/image counts, fit residuals and lifecycle results. Controlled WebGL frame submission stabilizes screenshots on SwiftShader; it is not a hardware FPS benchmark. See `EVIDENCE.md` for completed results and limitations.
