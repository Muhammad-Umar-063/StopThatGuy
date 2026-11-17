# Batch 2 integration — T009–T012

Verified locally on 17 November 2026 under the user's explicit instruction to
finish, verify, commit and merge. **No push was performed; the user will push.**
Accepted integration commit: `c8526de26b0601342cb136c7fc0fb5c546e12798`.

## Integrated work

| Task | Feature commit | Merge commit | Result |
|---|---|---|---|
| T009 movement | 70a20ae | 15cd404 | Finished default road kernel, controls/stamina, collision and private memory |
| T010 camera | 3f70c1e | b1af24f | Automatic follow/obstruction/reduced motion with fixture acceptance |
| T011 street | 6630b64 | 9cf7ad6 | Registered and verified original Lisbon street, low/medium quality and resource cleanup |
| T012 lobby | 2bd2f85 | 10a0911 | Keyboard-accessible room screens with explicit fixture transport |

All four feature branches merged without conflicts. Existing worker changes and
older T005–T008 worktrees were preserved. Original T009/T011 handoffs were partial;
completion during integration resolved their outstanding implementation/acceptance.
No task was marked done based on the initial partial handoffs.

T009 review found a lateral jump at bent centerlines and unsafe collision
reconstruction; continuous vertex offsets and conservative swept collision fix
it, with a regression checking the resulting pose outside the blocker. Default
simulation tests use real inputs on FIRST_STREET_WORLD, including practice/normal
equivalence, action resends, turns and compiled/source parity. Movement memory is
private and isolated; CONFIG_VERSION is provisional-2, wire protocol remains 1.

T011 inspection fixed ground/roof winding, hidden panes/doors, mirrored signage,
roof/ground gaps and duplicated/leaking plaster textures. Core and environment
manifests validate separately and together; duplicates and missing files fail.
Catalog calibration metadata retains its literal asset-ID type.

Integration registers every new test in standard commands/CI and fixes two
reproduced browser-test races: wait for both blur/hidden without imposing order,
and wait for documentElement during asset navigation. Original input-release,
ready-state, failure and resource assertions remain. Normal browser runs write
ignored artifacts rather than changing tracked screenshots.

## Verification

- `npm ci --offline`: clean locked install, 117 packages installed; no new package
  versions. Simulation adds only the existing world workspace as a dev dependency.
- `npm run check`: exit 0. Typecheck, production build, **334/334 tests**, world and
  both asset-category validation, actual Chrome smoke passed; zero skipped tests.
- Counts: client 61 (keyboard 43, camera 14, lobby 4), server 15, simulation 61,
  test-support 156, world 14, cross-package 5, asset 16, environment 6.
- Server tests include independent real clients and compiled normal bootstrap;
  simulation compiled/source equivalence now includes movement/sprint input.
- `npm run test:browser`: exit 0. Keyboard 10, lobby 14 (source+built), assets 8 checks
  per source/built gate, camera 10 checks per source/built gate, plus six street
  views and reload/disposal. All JSON gate reports have ok=true and no errors.
- Street costs: low 103,688 scene triangles / 19–29 draws; medium 196,904 / 52–62.
  Nine asset/sign textures, estimated 3.75 MiB excluding renderer/shadow allocations.
  Reload: 48 meshes / 23 materials / 11 textures unchanged; unload 1/1/1, shutdown zero.
- `git diff --check` and staged whitespace gates passed. All eight preserved task
  worktrees are clean; main contains only committed accepted work after closeout.
- Full logs: local `/tmp/stg-batch2-install.log`, `/tmp/stg-batch2-check.log`,
  `/tmp/stg-batch2-browser.log`. Browser artifacts: ignored DevPack/test-results.
  Curated camera/environment evidence is beside each component and included in Git.
  CI is configured to run both gates and upload artifacts; remote CI is unverified.

## Remaining planned scope

These four tasks meet their component acceptance. The main page remains the smoke
scene. Camera, lobby and street have labeled isolated previews; real online chase
assembly is T020. Characters, robber logic, full map and client adapter are later
tasks, starting with T013–T016 (dependencies satisfied; not started or assigned).
Visible early-buffer cues remain T014/T018; buffering stays disabled in normal
gameplay until then. T022 must review private-motion reconstruction for prediction.
World escape-route and large-bundle warnings remain later scope.

Chrome 154/SwiftShader proves rendering and behavior, not low-end/Android hardware
performance or final user art approval. Future feature chats retain manual Git
operations unless the user authorizes otherwise. All batch-2 edit leases are released.
