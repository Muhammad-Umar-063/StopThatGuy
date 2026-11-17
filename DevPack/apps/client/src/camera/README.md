# T010 automatic camera

`createAutomaticCamera(scene, world, { reducedMotion? })` creates a Babylon
`TargetCamera` with no keyboard, pointer, wheel or touch input bindings. Bootstrap
integration is deferred. Call `update({ pose, route }, deltaSeconds)` once per
render frame with the displayed player pose; `reset(subject)` handles a new
match or spectator target. `setReducedMotion(undefined)` follows the OS;
`true`/`false` applies the user's explicit preference. Call `dispose()` when
unmounting. Scene disposal also removes the preference listener and camera.
The caller owns rendering, resizing, entity selection and the world lifetime.

The standalone `createFollowCamera(world, reducedMotion?)` has no browser or
Babylon dependency. It copies the subject position; neither camera ever mutates
world data, player poses, route progress, input, or simulation state. A `null`
route (passenger) still follows the supplied world pose and yaw.

Presentation defaults: 5 m behind / 3 m above; level roll; 2 m look-ahead;
exponential position, yaw and slope damping. Linear sample integration keeps
follow lag consistent across frame rates. Yaw wraps along the shortest arc.
Ground grade comes from the committed route centerline and is restrained on
steep segments. Reduced motion uses a shorter 0.75 m look-ahead, tighter position
follow, slower turns and slower obstruction recovery. FOV is fixed; there is no
shake, bob, motion blur or zoom pulse in either mode. These constants are local
presentation settings, not shared gameplay tuning.

Both `world.colliders` and `world.cameraObstructions` block the camera. The boom
from the current torso to the damped camera is swept with a conservative 0.25 m
envelope against yawed boxes and capped cylinders; contact retracts immediately
and clearance restores the boom gradually. Safety takes precedence over a
minimum follow distance. Overlapping anchor proxies receive a bounded push-out;
invalid worlds with mutually enclosing proxies still require authoring fixes.
Decorative meshes need authored camera proxies; meshes are not queried or
silently promoted into gameplay collision. Camera framing does not modify player
collision. A delta over 0.5 seconds or displacement over 12 m resets the camera
after a stall/teleport; ordinary contextual turns do not snap.

## Fixture preview and acceptance

Run from this worktree's absolute DevPack directory. Dependencies are already
installed. The preview has a visibly labelled capsule/blockout and scripted
playback from committed T002 snapshots/world, T003 `poseOnRoute` and T005 street
data. It imports no uncommitted T009 code and is not a movement implementation.
The temporary geometry is confined to the preview; shared world data is untouched.

```sh
node_modules/.bin/tsx --conditions=stopthatguy-source --test apps/client/src/camera/*.test.ts
node apps/client/src/camera/browser/acceptance.mjs --dev
node apps/client/src/camera/browser/acceptance.mjs
node apps/client/src/camera/browser/preview.mjs
```

The last command builds and holds a preview at
<http://127.0.0.1:5210/src/camera/browser/demo.html>, using strict port 5210.
Add `--dev` to serve source instead. Stop it with Ctrl+C. Browser acceptance
starts/stops only its own preview/Chromium and fails if port 5210 is occupied or
Chrome is unavailable (`CHROME_PATH` overrides discovery). It captures built
screenshots and writes `test-results/camera/browser-{dev,built}.json` (ignored).
Set `CAMERA_EVIDENCE_DIR` explicitly to refresh curated evidence. Rendering uses headless
Chromium/SwiftShader; it is not device/GPU performance evidence.

The camera unit tests run in the standard client/root test commands. Both camera
browser commands run in the root browser gate, serializing port 5210. Fixture
preview output and browser profiles are ignored; curated evidence is opt-in.

Live T009 movement, T011 final street visuals, network interpolation, spectator
controls, device performance and user camera-feel acceptance remain later
integration evidence (T020 and relevant follow-ups).
