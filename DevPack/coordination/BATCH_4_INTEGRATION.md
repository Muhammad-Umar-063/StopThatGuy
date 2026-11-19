# Batch 4 assembly and acceptance checklist

Current integration status (19 November): T017–T019 are accepted on main; see
integration/BATCH_4.md. T020 is ready with an updated checkout, not implemented.
The dated planning/review notes below preserve history; their pending-commit and
old-base statements are superseded by the acceptance record.

Prepared by D/T020 on 19 November 2026. This is a plan grounded in accepted APIs,
not implementation or acceptance evidence. Code baseline: `46811168fab6feab33858ff0830a8d0631273fa8`;
main setup HEAD at registration: `3afa9760659a5b8c75ca0511bda73053db051795`.
T020 stays **planned**. Its worktree is clean; coordination edits exist only in main
and D's mailbox. A/B/C are now registered in_progress after their user launchers and active turns
were verified directly.

## Gate before gameplay edits

- [x] Verify main and all four branch names/HEADs/status, exact disjoint reservations,
  D identity, and T012–T016 accepted integration ancestry in T020.
- [x] Register each T017–T019 worker from fresh task launchers/active turn evidence.
- [ ] Resolve subsequent immutable mailbox requests serially, recording exact
  path/owner/checkout before approval.
- [ ] Review T017–T019 handoffs, focused tests, mandatory check/browser evidence and
  actual diffs. Use an independent assistant for capture/authority/state-transition review.
  T017 capture tuning/version bump requires explicit D review, even with the config prelease.
- [ ] User-reviewed commits and integration, combined checks, actual main integration
  commit recorded, and T017–T019 marked done. No automatic Git writes are authorized.
- [ ] User-authorized update of a clean T020 branch; verify it contains that integration
  commit before changing gameplay. A lease or worker's in_review status is insufficient.

## Published seams and concrete assembly

| Area | Accepted API / observation | Assembly after the gate |
|---|---|---|
| World/server | `LISBON_CITY_WORLD`, `LISBON_CITY_IDS` from `packages/world`; server bootstrap currently passes `FIRST_STREET_WORLD` to `createRoomLifecycle` | Select city in normal server and client, advertise its version in health/admission, use the same integrated config; retain first-street preview/test entry behavior. |
| Lobby/network | `createNetworkAdapter({endpoint, versions, tuning})`, `mountLobby`; `getSnapshot`, `subscribeEvents`, `sampleInput`, `clearInput`, `dispose` | Use actual HTTP/Colyseus rooms for practice and multiplayer. Drive phase transitions/results from accepted snapshots; deduplicate effects using events. No independent browser simulation. |
| Keyboard | `attachKeyboardInput`, session-scoped `createActionIdSequence`, controller `sample`, `setGameplayActive`, `releaseAll`, `dispose` | Focus a gameplay surface; feed held/edge intents to network. Disable/release while menus/results/loading own focus. Preserve text editing, Tab, Enter, Escape and fresh-key requirements after blur. |
| Camera | `createAutomaticCamera(scene, world)`, `update({pose,route}, dt)`, `reset`, `setReducedMotion`, `dispose` | Follow the displayed authoritative local pose on actual city slopes/junctions. Reset on new match/session; use authored obstruction proxies. Prediction/reconciliation remains T022. |
| Characters | `loadCharacter(scene, identity, {signal,quality,...})`; `update(dt, CharacterPresentation, cameraDistance)` | Render each connected entity and robber from real pose/speed/locomotion; bound frame deltas, cancel late asset loads and dispose removed actors. Inspect slopes and identity at normal camera distance. |
| City scenery | Existing `streetPlan` explicitly rejects worlds other than `first-street-1` | Build provisional city composition only in T020's `render/city/`, reusing available assets and actual edge/collider anchors. Do not pass city into the street-only renderer or change authoritative geometry to fit decoration. |
| HUD/capture | T014 currently emits `actions:null` and `robber:null`; snapshot has no `LegalActions`; `queryLegalActions` needs opaque server simulation state | Consume T018's published presentation boundary after integration. Establish a genuine legal-action source matching T017 rules and a documented visibility source. A client-created simulation is not authoritative. Resolve any shared/network migration with exact leases and review first. Unavailable cues stay unavailable; early buffering remains off. |
| Vehicles | T019 published `loadVehicle` / `VehicleVisual` and generated anchor definitions; handoff/gate evidence verified, in_review (see below) | After accepted integration, render visual definitions from server poses; no mount/drive/borrow prompts or client ownership. T021 handles gameplay. |
| End/retry | Existing adapter exposes authoritative result/rematch/leave intents | Minimal readable keyboard result and retry/return flow, with host permissions; no elaborate T034 screen. Clear input/action IDs appropriately for each session and reset scene/network subscriptions on repeated entry. |

## Additional ownership to settle before use

No new implementation lease is granted by this checklist. Current A/B/C preleases
remain exclusive until accepted integration and explicit release/transfer.

- `package.json`: T019 owns scripts now. The current root test glob is `tests/*.test.ts`,
  so T020's nested `tests/integration/chase/` tests will need explicit registration
  in ordinary test/browser commands after transfer; preserve all existing gates.
- `apps/client/package.json`, `package-lock.json`: a client runtime import of the
  world workspace needs a declared existing-workspace dependency if absent. T018
  owns client scripts now; no new external package/version is proposed.
- `apps/client/index.html` and `scripts/smoke.ts`: inspect the normal-page shell/smoke
  contract before assembly. Current smoke expects a running renderer and protocol
  status label. Record leases if either requires adaptation; never disable smoke.
- HUD live-source work may require network decoder/adapter, server adapter and shared
  transport paths. Choose the smallest exact list only after reviewing T017/T018
  APIs; this is an unresolved integration seam, not an approved schema change.

## Acceptance to execute after assembly

- [ ] Real keyboard practice on the normal entry uses the same server/rules/city.
- [ ] Two independent browser sessions create/join by code, ready, host-start,
  observe countdown/intro, traverse real junctions with camera/characters/HUD,
  and see continuous robber motion and identical immutable terminal results.
- [ ] Normal spawn-to-interception route through the authored city achieves legal
  capture without teleports. Record seed, route, inputs and ticks. Exercise escape
  and timeout as well; label accelerated-clock or fixture-assisted rule tests
  separately from normal browser play and catchability evidence.
- [ ] Capture cues agree with T017 eligibility/cancellation and server resolution;
  departures cannot win. No impossible interaction prompts or buffered turns.
- [ ] Version mismatch, admission/server failure, missing asset/loading cancellation,
  leave/retry and repeated room/match entry recover with visible keyboard focus.
  Check no stuck inputs, duplicate subscriptions, orphan sessions or retained scenes.
- [ ] Inspect dev and built screenshots at wide/narrow landscape, low/medium quality
  and reduced motion. Record provisional city art and actual hardware; do not claim
  Android performance or finished T039 art from software-rendered screenshots.
- [ ] Verify newly registered tests actually execute; run focused checks, full check,
  relevant/full regression browser gates and `git diff --check`. Record commands,
  exit codes, test counts and separate fixture/live results in T020's handoff.

All Chrome gates use the actual lock (no queue or advance reservation):

```sh
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh npm run check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh env KEYBOARD_BROWSER_PORT=5420 ASSET_BROWSER_PORT=5520 npm run test:browser
```

Own server is 2620, Vite preview 5220 with `--strictPort`; legacy fixed-port suites
also require this lock. Exit 75 means busy: continue independent work and retry,
never kill other owners' processes. Store evidence under ignored `test-results/`.

No T020 gameplay/check/browser acceptance has run at coordination startup. Accepted
baseline checks are historical evidence in `integration/BATCH_3.md`, not a fresh
T020 pass. After all required acceptance passes, report in_review with no integration
commit; done still requires reviewed integration. No automatic wakeup is promised.

## Reviewed T017 request — still pending implementation/integration

REQ-001 grants capture tuning plus exact events.ts/versions.ts leases in T017.
Use protocol 2 / config provisional-4 after accepted integration; see DECISIONS.
Capture motion must include lane/turn displacement, and zero-active results must
flow through the CHASE tick/event drain. This closes the proposal review only;
implementation, combined decoding/authority/catchability tests and Git integration
remain required. T018/T019 startup confirmations are received; neither requested
an additional lease at this phase boundary.

REQ-001 decision/corrections were delivered directly to T017; T018 received the
compatibility notice. Mounted/passenger departure cleanup remains a documented
T021/T028 boundary; current real-session departure acceptance is on foot.

## T019 published visual boundary — acceptance pending

Received directly from verified Chat C on 19 November 2026; declaration signatures
and generated definitions inspected read-only in T019's assigned checkout. This
records an integration contract, not accepted/merged code. No implementation was
copied into T020; T019 remains in_progress.

- `apps/client/src/render/vehicles/vehicle.ts`: `loadVehicle(scene, type, options)`
  supports quality, abort signal, base URL and timeout. Returned `VehicleVisual`
  offers `update(dtSeconds, presentation, cameraDistanceM)`, `setQuality`,
  `anchorToRef(name, Vector3)`, diagnostic `inspect`, and `dispose`.
- Presentation fields: world position, yaw, speedMps, steeringRadians; optional
  pitch, roll and absolute pedalAngleRadians. These are visual inputs, not authority.
  Current update requires finite nonnegative frame delta ≤0.25 seconds; callers
  must bound frame stalls. `anchorToRef` returns transformed world-space contacts.
- `definitions.ts` / `definitions.generated.json`: catalog IDs `vehicle.bicycle`,
  `vehicle.scooter`, `vehicle.lift`; wheel/steering/crank pivots and typed seat roles.
  Bike/scooter: `seat.rider`, `hand.rider.L/R`, `foot.rider.L/R`. Lift:
  `seat.driver`, `seat.passenger.0/.1` and corresponding hand/foot prefixes.
- Clearance values reference unchanged `WORLD_LAYOUT_LIMITS.spawnFootprint`:
  bicycle 0.9/1.4 m, scooter 1/1.4 m, lift 2.2/2.5 m radius/height. They cover
  unoccupied parked models; they are not rider envelopes or moving colliders.
- Latest pre-handoff export report lists LOD0 geometry at 6,088 / 7,072 / 7,680
  triangles respectively, superseding the earlier 5,752 / 6,688 / 7,656 counts.
  D inspected that report and verified the three GLBs total 1,365,968 bytes on disk;
  no scene/device performance claim follows from these model sizes.
- API/anchor names are unchanged. Consume generated definitions, not copied numeric
  placements: bicycle crank-local foot Y is 0.025 m; scooter steering/front-wheel
  pivot Z is 0.74 m, preserving authored world hand contacts; lift foot Y is 0.40 m
  and driver foot Z is 0.93 m, with an authored open footwell. D inspected the
  generated coordinates read-only; static T015 fit/real-skin review is worker-reported.
- C reports five vehicle tests, independent lifecycle/skin review and final check
  (404 tests plus smoke) passed. The full browser command is still running with
  explicit exit records; final browser acceptance, handoff and evidence review
  remain pending. T019 stays in_progress and no additional lease is requested.

T020 consumes only reviewed integrated exports after its dependency gate. T021
owns boarding/driving and T023 riding animation; this API does not authorize them.

## T017 progress report — browser gate / handoff pending

Verified Chat A reports implementation and independent review complete: check passed
425 tests with zero skips plus typecheck/build/validation/Chrome smoke; focused
26 passed (22 simulation, 4 real-client rules tests). D inspected the smoke JSON
(`ok: true`, protocol 2/config provisional-4) and test/API declarations read-only;
D has not rerun these checks or accepted the completed handoff. T017 stays
in_progress while its relevant client browser suite runs under the shared lock.

The four real-client tests use an explicitly isolated rule arena: matching one-shot
results, disconnect during wind-up, practice/reset, and protocol/config rejection
plus both new cancellation reasons. This is real transport evidence with fixture
geometry, not normal-city browser acceptance. The independent reviewer reportedly
found floating-point speed-boundary rejection; A fixed it with 1e-9 m/s tolerance
and a real-motion regression, then reports a clear re-review.

The registered public simulation test in `packages/simulation/test/results.test.ts`
uses unmodified LISBON_CITY_WORLD and normal spawns, seed 4, traversing
`bank.out → marketWestB.back → arcade.back → westSouthA.back`, waiting to intercept,
and resolves capture at tick 5589. This is one authored-city simulation replay;
other-seed catchability, actual keyboard/camera/HUD play and browser interception
remain T020 acceptance. Preserve this distinction in the final evidence.

Published T017 seam: exported trusted server-only `forfeitPlayer(state, playerId)`;
`queryLegalActions(...).canCapture` shares the actual-XZ-motion eligibility and is
false during an already-active attempt. A false cue alone does not say an attempt
was cancelled or completed. There is no replicated attempt progress or legal-action
transport; do not fabricate either. T018/T020 must connect a legitimate presentation
source after accepted integration. No uncommitted code was copied into T020.

## T017 handoff verified — in_review, not integrated

This final record supersedes the earlier T017 browser/handoff-pending note. D read
`/home/umar/Downloads/StopThatGuy/.worktrees/T017/DevPack/coordination/handoffs/T017.md`,
mailbox status and saved focused/check/browser logs. Log totals confirm 425 check
tests and 26 focused tests, zero failures/skips; smoke JSON passes with protocol 2
and config provisional-4. The client browser gate completed 10 keyboard + 14 lobby
tests and five real-network checks each in dev/built; both network JSON reports
are ok with empty errors (matching ticks 369/373). Worker reports command exit 0,
independent re-review clear and all owned runner processes exited. D did not rerun
the unchanged expensive checks.

D independently verified the 19 changed/untracked files against current exact
leases, their whitespace, no staged edits and correct task branch/base. New tests
are included by the ordinary simulation/server test globs. T017 is now in_review,
awaiting user review, manual commit and integration; integration_commit remains null
and its file leases remain reserved. Unchanged asset/camera/street/character browser
suites were outside T017's focused client gate; combined integration gates remain.

Real capture socket tests use a labeled rule arena; the normal-spawn seed-4 city
capture is public-simulation replay. Neither proves the T020 keyboard/camera/HUD
online city chase. Legal-action transport and attempt presentation remain unadded.
T020 stays planned until T017–T019 accepted integration and authorized branch update.

## T018 handoff verified — in_review, fixture-only HUD

D read the T018 handoff/README and saved check/focused/full-browser logs: 408 check
tests including nine new tests, nine focused passes, zero failures/skips, smoke
passed, full registered browser run completed through the existing character gate.
HUD dev/built reports each contain 10 passing groups with empty errors and explicit
fixture dataSource. D inspected wide-turn and 640×360 wanted screenshots: labels
and focus remain visible and panels do not overlap. The compact layout still needs
assessment over the actual T020 scene; a static fixture canvas is not scene acceptance.
Worker reports independent review and confirmed fixes for stale cross-snapshot cues
and repeated-message announcements. D did not rerun unchanged expensive tests.

D independently passed a 16-file exact-ownership/whitespace/unstaged audit, verified
branch/base and new unit/browser registration in ordinary client commands. T018 is
in_review, awaiting user review, manual commit and integration; no integration commit
and its leases remain reserved. No shared protocol/config/dependency change in T018.
Optional design audit's separately wired button finding is documented as a false
positive; actual keyboard activation passes. Physical device performance is unverified.

Integration API: `mountChaseHud(root, adapter)` returns an idempotent disposer; the
HUD consumes views without owning gameplay keys, focus, camera or authority. The
optional final `AcceptedChaseCues` argument to `network/view.ts:createView` carries
`{snapshot, playerId, legalActions, robberVisible}` and must bind the exact accepted
snapshot object used to create that view. Compose atomically; no mutable snapshot
reuse between ticks. Invalid/stale/player-mismatched/inactive cues fail closed.
Visibility must come from an agreed source, not position presence; bearing uses
player yaw, not camera yaw. The boundary rejects early-buffer turns the current UI
contract cannot express. `canCapture` only controls start readiness, never attempt
progress, cancellation or completion. Default live cues remain null.

T020 still needs legitimate legal-action/visibility source integration, appropriate
exact network/shared leases and parity against accepted protocol-2 T017 rules. These
HUD checks ran on T018's committed protocol-1/config-provisional-3 baseline and do not
prove combined version-2 compatibility. No uncommitted implementation was copied.

## T019 handoff verified — all three dependencies now in_review

This supersedes T019's earlier browser/handoff-pending progress notes. D inspected
its handoff and asset EVIDENCE.md, mandatory check log (404 passing tests, zero
failures/skips), numeric `check-final.exit` and `full-browser-final.exit` (both 0),
and complete browser-log ending. Both vehicle browser reports contain 28 views,
12 articulation/input/lifecycle steps and empty console errors. All source/export,
three GLB and seven runtime-file hashes match current files. Five new vehicle tests
and dev/built browser runners are registered in ordinary root gates, retaining
previous asset categories and checks. D did not repeat the expensive acceptance run.

D independently verified all 26 changed/untracked files are owned and no changes
are staged. One trailing space in untracked vehicles.test.mjs was corrected by C;
final tracked/untracked whitespace audit passes. No behavior changed, so no test
rerun was required. D inspected the medium static-fit screenshots for bicycle,
scooter and lift. Original models and actual integrated character contacts are
visible; cushion/deck approximations and untested full riding articulation remain
explicit in the evidence. This is preview/fit evidence, not boarding/driving,
a city fleet stress test, physical-device performance or user art approval.

T019 is now in_review alongside T017/T018. Their exact ownership remains reserved
through review. All three have null integration commits and uncommitted work;
manual review/commits, combined integration verification and an authorized clean
T020 branch update are still required. T020 remains planned with no gameplay edits.
No new task is started, no main game code written, and no Git write is authorized.
