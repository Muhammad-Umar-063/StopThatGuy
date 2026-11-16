# Implementation backlog

48 tasks. These are scoped work items, not full AI prompts. All implementation is unstarted. Only T001 is initially ready; a task becomes ready after its dependencies are integrated and its file ownership is available.

Read [parallel workflow](../docs/PARALLEL_WORK.md) for batches and model allocation. Task state belongs in [board.json](board.json); do not infer completion from an ID or batch. Initial estimates are not per-task promises.

A task is done only after its acceptance check passes, appropriate tests are recorded, its changes are integrated and the coordinator updates the board. “Blocked” means a concrete missing dependency/access/evidence, not merely a difficult task.

## Task index

| ID | Task | Lane | Depends on |
|---|---|---|---|
| [T001](#t001) | Repository and toolchain setup | D | None |
| [T002](#t002) | Shared contracts and fixtures | D | T001 |
| [T003](#t003) | Fixed-step simulation foundation | A | T002 |
| [T004](#t004) | Validation and integration tooling | D | T001, T002, T003 |
| [T005](#t005) | First street and route blockout | D | T004 |
| [T006](#t006) | Room and session lifecycle | A | T004 |
| [T007](#t007) | Keyboard input and action mapping | B | T004 |
| [T008](#t008) | Asset workflow and provenance | C | T004 |
| [T009](#t009) | Road movement, lanes and stamina | A | T005, T007 |
| [T010](#t010) | Automatic third-person camera | B | T005, T007 |
| [T011](#t011) | Finished street visual slice | C | T005, T008 |
| [T012](#t012) | Keyboard-accessible lobby screens | D | T006, T007 |
| [T013](#t013) | Robber AI and match progression | A | T006, T009 |
| [T014](#t014) | Client connection and state adapter | B | T006, T009 |
| [T015](#t015) | Character models and movement animation | C | T008, T011 |
| [T016](#t016) | Complete playable city graph | D | T005, T011 |
| [T017](#t017) | Capture and authoritative result rules | A | T013 |
| [T018](#t018) | Chase HUD and contextual cues | B | T010, T013, T014 |
| [T019](#t019) | Transport models and visual definitions | C | T008, T011 |
| [T020](#t020) | Integrate first playable online chase | D | T012, T013, T014, T015, T016, T017, T018, T019 |
| [T021](#t021) | Authoritative vehicles, borrowing and lift | A | T020 |
| [T022](#t022) | Prediction, reconciliation and interpolation | B | T020 |
| [T023](#t023) | Vehicle riding and interaction animation | C | T015, T019, T020 |
| [T024](#t024) | Android touch controls | D | T018, T020 |
| [T025](#t025) | Authoritative sabotage and protection | A | T021 |
| [T026](#t026) | Transport interaction presentation | B | T018, T021, T023 |
| [T027](#t027) | City prop kit and obstacle presentation | C | T016, T019, T023 |
| [T028](#t028) | Reconnect, forfeit and room cleanup | D | T020, T022 |
| [T029](#t029) | Shop theft and wanted state | A | T021, T025 |
| [T030](#t030) | Action feedback and control polish | B | T024, T025, T026 |
| [T031](#t031) | Quality presets and first device profiling | C | T015, T016, T023, T027 |
| [T032](#t032) | Interaction integration regression suite | D | T025, T026, T028 |
| [T033](#t033) | Police pursuit and arrest | A | T016, T029 |
| [T034](#t034) | Spectating, awards screen and rematch UI | B | T017, T028, T030 |
| [T035](#t035) | Audio and comic event presentation | C | T027, T030 |
| [T036](#t036) | Latency and malformed-input verification | D | T022, T028, T032 |
| [T037](#t037) | Awards, route and economy balancing | A | T017, T021, T025, T029, T033 |
| [T038](#t038) | Final menu, errors and accessibility flow | B | T024, T030, T034 |
| [T039](#t039) | Full-map visual consistency and optimization | C | T031, T035 |
| [T040](#t040) | Six-player gameplay playtest | D | T033, T034, T036 |
| [T041](#t041) | Server validation and abuse hardening | A | T036, T037, T040 |
| [T042](#t042) | Desktop and Android acceptance checks | B | T038, T039, T040 |
| [T043](#t043) | Asset, accessibility and presentation audit | C | T035, T038, T039 |
| [T044](#t044) | Final local integration and regression gate | D | T037, T038, T039, T040 |
| [T045](#t045) | Deployment configuration and release preparation | D | T041, T042, T043, T044 |
| [T046](#t046) | Staging deployment and external verification | D | T045 |
| [T047](#t047) | User playtest and release fixes | D | T046 |
| [T048](#t048) | Public release and developer handoff | D | T047 |

<a id="t001"></a>

## T001 — Repository and toolchain setup

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** None
- **Primary write scope:** `package.json`, `package-lock.json`, `apps/*/package.json`, `tsconfig*`, `apps/*/src/bootstrap/`
- **Work:** Create npm workspaces, pin compatible Babylon/Vite/Colyseus/TypeScript versions, establish client/server entry points and accurate local commands. Record version choices.
- **Acceptance:** Clean install, client and server start, build and typecheck succeed; no game features or fake multiplayer are required here.

<a id="t002"></a>

## T002 — Shared contracts and fixtures

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T001
- **Primary write scope:** `packages/shared/`, `packages/test-support/src/fixtures/`
- **Work:** Define typed intents, runtime validation schemas, phases, entities, world contracts, versions and UI view models from CONTRACTS.md. Supply deterministic fixtures.
- **Acceptance:** Client/server can import the same definitions; invalid sample payloads are rejected; fixture views cover lobby, chase, arrest and results.

<a id="t003"></a>

## T003 — Fixed-step simulation foundation

- **Lane:** A — Simulation / server rules
- **Dependencies:** T002
- **Primary write scope:** `packages/simulation/`
- **Work:** Create seeded state initialization, fixed-step update loop, event ordering and the pure movement interface. Establish dependency boundaries.
- **Acceptance:** Identical seeded input sequences produce identical rule outcomes; no browser/renderer/network imports; time steps and state transitions are testable.

<a id="t004"></a>

## T004 — Validation and integration tooling

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T001, T002, T003
- **Primary write scope:** `scripts/`, `tests/`, `packages/test-support/`, `.github/`
- **Work:** Add build/typecheck/test scripts, world/asset validation skeletons and smoke fixtures. Configure CI if the repository host supports it; otherwise provide local equivalents.
- **Acceptance:** A clean-checkout verification sequence is documented and runs; fixtures can support isolated UI, renderer and server work.

<a id="t005"></a>

## T005 — First street and route blockout

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T004
- **Primary write scope:** `packages/world/`
- **Work:** Author one street, lane bands, junction, foot shortcut, slope, spawns, simple colliders and turnaround. Export data through frozen contracts.
- **Acceptance:** All initial routes are reachable; no spawn overlaps a collider; lane/branch permissions and ground heights validate.

<a id="t006"></a>

## T006 — Room and session lifecycle

- **Lane:** A — Simulation / server rules
- **Dependencies:** T004
- **Primary write scope:** `apps/server/src/rooms/`, `apps/server/src/adapters/`, `apps/server/src/validation/`
- **Work:** Implement create/join codes, guest identity, room capacity, ready/start commands and basic phase transport using simulation adapters.
- **Acceptance:** Independent clients join the same room; invalid/full rooms and unauthorized host commands return clear failures; sessions remain distinct.

<a id="t007"></a>

## T007 — Keyboard input and action mapping

- **Lane:** B — Controls / client / UI
- **Dependencies:** T004
- **Primary write scope:** `apps/client/src/input/keyboard/`
- **Work:** Translate arrow keys and secondary bindings into shared intents, including held vs edge actions and input focus rules.
- **Acceptance:** No repeated lane request from key-repeat; blur releases held keys; text fields work; game input does not scroll the page.

<a id="t008"></a>

## T008 — Asset workflow and provenance

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T004
- **Primary write scope:** `assets/`, `assets-source/`, `scripts/assets/`, `apps/client/src/render/assets/`
- **Work:** Establish catalog/manifest, model import fixture, coordinate checks and original-to-runtime workflow. Select lawful candidate assets and record availability.
- **Acceptance:** One sample GLB displays at correct scale/orientation; provenance exists; unavailable final assets are explicitly listed; no unlicensed content is shipped.

<a id="t009"></a>

## T009 — Road movement, lanes and stamina

- **Lane:** A — Simulation / server rules
- **Dependencies:** T005, T007
- **Primary write scope:** `packages/simulation/src/movement/`, `packages/simulation/src/collision/`
- **Work:** Implement path/lane movement, junction arbitration, ground height, braking, stamina, swept collision and dead-end escape using shared configuration.
- **Acceptance:** Required CONTROLS.md edge cases pass; speed is fixed-step independent; buffered input never both shifts and turns.

<a id="t010"></a>

## T010 — Automatic third-person camera

- **Lane:** B — Controls / client / UI
- **Dependencies:** T005, T007
- **Primary write scope:** `apps/client/src/camera/`
- **Work:** Implement follow, smooth contextual turns, slopes, obstruction and reduced-motion behavior against movement fixtures.
- **Acceptance:** Camera stays behind travel direction, avoids walls and behaves consistently at different frame rates; no mouse control is required.

<a id="t011"></a>

## T011 — Finished street visual slice

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T005, T008
- **Primary write scope:** `apps/client/src/render/environment/`, `apps/client/public/assets/environment/`, `assets-source/environment/`, `assets/manifest-environment.json`
- **Work:** Build one Lisbon-style street with final-direction materials, lighting, smooth surfaces and quality toggles. Use stable world IDs.
- **Acceptance:** Actual gameplay-camera views show low/medium settings; blockout and final assets are distinguishable; initial scene cost is recorded.

<a id="t012"></a>

## T012 — Keyboard-accessible lobby screens

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T006, T007
- **Primary write scope:** `apps/client/src/ui/lobby/`, `apps/client/src/ui/menu/`
- **Work:** Build nickname, create/join, room code, readiness and start screens against the UI adapter, including failure states.
- **Acceptance:** Full flow works with keyboard only; empty/invalid input and room failures are readable; fixture transport is clearly labeled until integration.

<a id="t013"></a>

## T013 — Robber AI and match progression

- **Lane:** A — Simulation / server rules
- **Dependencies:** T006, T009
- **Primary write scope:** `packages/simulation/src/robber/`, `packages/simulation/src/match/`
- **Work:** Implement opening, countdown/intro/chase, seeded routes, bottlenecks, escape/timeout and safe route fallback.
- **Acceptance:** Robber follows valid routes without teleporting; timers use server ticks; practice can reach an escape/timeout result.

<a id="t014"></a>

## T014 — Client connection and state adapter

- **Lane:** B — Controls / client / UI
- **Dependencies:** T006, T009
- **Primary write scope:** `apps/client/src/network/`
- **Work:** Connect Colyseus sessions to presentation/UI state; decode snapshots/events, deduplicate events and acknowledge inputs.
- **Acceptance:** Two clients see matching authoritative state; no client-declared position/winner; loading/error paths are exposed through the adapter.

<a id="t015"></a>

## T015 — Character models and movement animation

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T008, T011
- **Primary write scope:** `apps/client/src/render/characters/`, `apps/client/public/assets/characters/`, `assets-source/characters/`, `assets/manifest-characters.json`
- **Work:** Import the chosen smooth-proportion characters, rig/clip mapping, base animation blending and readable player/robber identity.
- **Acceptance:** Run/sprint/idle/turn blend without severe sliding; real rendered character fits the street; licenses and LODs are recorded.

<a id="t016"></a>

## T016 — Complete playable city graph

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T005, T011
- **Primary write scope:** `packages/world/`
- **Work:** Extend the map to 6–8 gameplay blocks with hill/foot routes, shop, lift stops, police routes and alternate exits.
- **Acceptance:** Graph and collider checks pass; no dead ends trap players; shortcuts and vehicle-permitted routes connect all required locations.

<a id="t017"></a>

## T017 — Capture and authoritative result rules

- **Lane:** A — Simulation / server rules
- **Dependencies:** T013
- **Primary write scope:** `packages/simulation/src/capture/`, `packages/simulation/src/results/`
- **Work:** Implement capture wind-up, range/visibility/speed checks, cancellations and deterministic result/tie ordering.
- **Acceptance:** Capture/escape/timeout conflicts resolve exactly once; spectators cannot win; results are immutable after resolution.

<a id="t018"></a>

## T018 — Chase HUD and contextual cues

- **Lane:** B — Controls / client / UI
- **Dependencies:** T010, T013, T014
- **Primary write scope:** `apps/client/src/ui/hud/`
- **Work:** Display timer, stamina, robber direction, turn/lane cues, contextual actions and essential feedback using the shared view model.
- **Acceptance:** Cues reflect legal actions; UI is readable at narrow landscape sizes; no gameplay information relies only on color or audio.

<a id="t019"></a>

## T019 — Transport models and visual definitions

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T008, T011
- **Primary write scope:** `apps/client/src/render/vehicles/`, `apps/client/public/assets/vehicles/`, `assets-source/vehicles/`, `assets/manifest-vehicles.json`
- **Work:** Create/import bicycles, scooters and the simple lift vehicle with anchors, wheels, seats and collision-envelope references.
- **Acceptance:** Models match scale/seat positions, have LODs/provenance and expose stable animation anchors without authority logic.

<a id="t020"></a>

## T020 — Integrate first playable online chase

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T012, T013, T014, T015, T016, T017, T018, T019
- **Primary write scope:** `apps/client/src/bootstrap/`, `apps/server/src/bootstrap/`, `tests/integration/chase/`
- **Work:** Wire the merged client/server/map/render/UI modules into one end-to-end chase. Verify one-player practice and multiplayer capture/escape.
- **Acceptance:** At least two independent clients finish matching results; practice works through the same server; controls/camera work in a real scene. Review the visual slice and record feedback.

<a id="t021"></a>

## T021 — Authoritative vehicles, borrowing and lift

- **Lane:** A — Simulation / server rules
- **Dependencies:** T020
- **Primary write scope:** `packages/simulation/src/vehicles/`, `packages/simulation/src/interactions/`
- **Work:** Implement atomic claims, mount/dismount, bicycle/scooter handling, borrowing and fixed-route lift seats/stops. Evaluate the user-authorized cannon-es option against the simple controller; record whether it is needed. If adoption changes shared simulation/network architecture, scope that integration as a new task before expanding implementation.
- **Acceptance:** Same-tick claims produce one owner; safe dismount and seat limits hold; foot-only paths reject mounted traversal.

<a id="t022"></a>

## T022 — Prediction, reconciliation and interpolation

- **Lane:** B — Controls / client / UI
- **Dependencies:** T020
- **Primary write scope:** `apps/client/src/presentation/`
- **Work:** Predict local movement with shared kernel, replay unacknowledged inputs and interpolate remote motion with bounded extrapolation.
- **Acceptance:** 100–200 ms RTT remains usable; corrections do not pass through walls; authoritative transitions reset invalid prediction.

<a id="t023"></a>

## T023 — Vehicle riding and interaction animation

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T015, T019, T020
- **Primary write scope:** `apps/client/src/render/animation/`
- **Work:** Blend mounting, riding, pedaling/wheels, leaning, dismounting and stumble states using fixture/shared movement state.
- **Acceptance:** Hands/seat/wheels align reasonably; animations do not change collision or authoritative speed; placeholders are recorded.

<a id="t024"></a>

## T024 — Android touch controls

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T018, T020
- **Primary write scope:** `apps/client/src/input/touch/`, `apps/client/src/ui/touch/`
- **Work:** Add landscape directional/action buttons, multitouch, safe areas, pointer cancellation and rotate-device guidance.
- **Acceptance:** Forward plus sprint/action works; backgrounding releases all inputs; gameplay emits exactly the same intents as desktop.

<a id="t025"></a>

## T025 — Authoritative sabotage and protection

- **Lane:** A — Simulation / server rules
- **Dependencies:** T021
- **Primary write scope:** `packages/simulation/src/sabotage/`
- **Work:** Implement one shove/kick, range/facing/LOS, cooldown, momentum cost, vehicle wobble and recovery protection.
- **Acceptance:** Misses and hits resolve consistently; no stun stacking; passengers/arrested players cannot attack; cooldown cannot be bypassed.

<a id="t026"></a>

## T026 — Transport interaction presentation

- **Lane:** B — Controls / client / UI
- **Dependencies:** T018, T021, T023
- **Primary write scope:** `apps/client/src/ui/interactions/`, `apps/client/src/presentation/vehicles/`
- **Work:** Connect borrowing/mount/dismount/lift prompts to server-confirmed outcomes and existing vehicle animations.
- **Acceptance:** Competing claims show a clear loser state; no phantom mounting; touch and keyboard get the same contextual feedback.

<a id="t027"></a>

## T027 — City prop kit and obstacle presentation

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T016, T019, T023
- **Primary write scope:** `apps/client/src/render/props/`, `apps/client/public/assets/props/`, `assets/manifest-props.json`
- **Work:** Add modular street props and visuals for already-authored blockers, cosmetic crowds and accessible shortcut cues.
- **Acceptance:** All gameplay obstacles remain visible on low quality; decorations do not alter shared collision or block camera readability.

<a id="t028"></a>

## T028 — Reconnect, forfeit and room cleanup

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T020, T022
- **Primary write scope:** `apps/server/src/rooms/`, `apps/client/src/network/`, `tests/integration/reconnect/`
- **Work:** Complete grace-period session recovery, neutral missing input, host transfer, vehicle release, room expiration and restart messaging.
- **Acceptance:** Reconnect restores the same identity/state; expired sessions cannot reclaim a seat; abandoned rooms and rematches release resources.

<a id="t029"></a>

## T029 — Shop theft and wanted state

- **Lane:** A — Simulation / server rules
- **Dependencies:** T021, T025
- **Primary write scope:** `packages/simulation/src/crime/`
- **Work:** Implement hold-to-steal, cancellation, visible-zone detection and wanted state for the fictional bike shop.
- **Acceptance:** Borrowing never triggers theft; cancelled theft is consistent; detection conditions match cues and server rules.

<a id="t030"></a>

## T030 — Action feedback and control polish

- **Lane:** B — Controls / client / UI
- **Dependencies:** T024, T025, T026
- **Primary write scope:** `apps/client/src/ui/hud/`, `apps/client/src/ui/interactions/`, `apps/client/src/presentation/feedback/`
- **Work:** Present shove outcomes, protection, shop progress/wanted fixtures and action failures without overwhelming the chase.
- **Acceptance:** All actions have readable availability/result feedback; event deduplication prevents repeated feedback; keyboard/touch parity remains intact.

<a id="t031"></a>

## T031 — Quality presets and first device profiling

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T015, T016, T023, T027
- **Primary write scope:** `apps/client/src/render/quality/`, `scripts/performance/`, `docs/TEST_RESULTS.md`
- **Work:** Implement low/medium presets, adaptive resolution and LOD limits. Name available baseline devices and collect initial representative measurements.
- **Acceptance:** Settings preserve gameplay entities; actual devices/results or missing-device limits are recorded; no unsupported FPS claims.

<a id="t032"></a>

## T032 — Interaction integration regression suite

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T025, T026, T028
- **Primary write scope:** `tests/integration/interactions/`, `tests/browser/interactions/`
- **Work:** Exercise transport contention, sabotage, rematch cleanup and connection loss across independent clients.
- **Acceptance:** Race-condition and full-flow tests pass; failures produce reproducible seeds/scenarios and follow-up fixes.

<a id="t033"></a>

## T033 — Police pursuit and arrest

- **Lane:** A — Simulation / server rules
- **Dependencies:** T016, T029
- **Primary write scope:** `packages/simulation/src/police/`
- **Work:** Implement reachable pursuit, arrest proximity/visibility timer, vehicle release and transition to eliminated spectator state.
- **Acceptance:** Police do not teleport; non-wanted players are not arrested; same-tick arrest invalidates capture; all-arrested ends round.

<a id="t034"></a>

## T034 — Spectating, awards screen and rematch UI

- **Lane:** B — Controls / client / UI
- **Dependencies:** T017, T028, T030
- **Primary write scope:** `apps/client/src/ui/results/`, `apps/client/src/ui/spectator/`
- **Work:** Render authoritative result/award data, spectator target cycling and rematch flow, including no-winner cases.
- **Acceptance:** Keyboard/touch can spectate and rematch; spectator UI emits no competitive actions; result fixtures include arrest and host departure.

<a id="t035"></a>

## T035 — Audio and comic event presentation

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T027, T030
- **Primary write scope:** `apps/client/src/audio/`, `apps/client/src/render/effects/`, `apps/client/public/assets/audio/`, `assets/manifest-audio.json`
- **Work:** Add licensed/original sounds, restrained event effects, short comic lines, volume controls and gesture-based audio activation.
- **Acceptance:** Mute works; essential cues remain visible; duplicate events do not spam audio; effects respect low/reduced-motion settings.

<a id="t036"></a>

## T036 — Latency and malformed-input verification

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T022, T028, T032
- **Primary write scope:** `tests/integration/network/`, `tests/integration/validation/`, `packages/test-support/src/network/`
- **Work:** Run six-session tests under RTT/jitter/stalls, stale inputs, malformed payloads and duplicate action IDs.
- **Acceptance:** No state corruption, duplicate claims or unauthorized actions; stalls/reconnect recover cleanly; limits and measurements recorded.

<a id="t037"></a>

## T037 — Awards, route and economy balancing

- **Lane:** A — Simulation / server rules
- **Dependencies:** T017, T021, T025, T029, T033
- **Primary write scope:** `packages/simulation/src/results/`, `packages/simulation/src/balance/`
- **Work:** Complete derived awards/deductions and tune catchability, route timing and transport/crime tradeoffs against reproducible scenarios.
- **Acceptance:** At most one capture winner; all rewards derive from validated events; foot shortcuts matter and every escape route is reasonably contestable.

<a id="t038"></a>

## T038 — Final menu, errors and accessibility flow

- **Lane:** B — Controls / client / UI
- **Dependencies:** T024, T030, T034
- **Primary write scope:** `apps/client/src/ui/`
- **Work:** Polish menu focus, connection/error/retry states, settings, loading, results and keyboard/touch navigation.
- **Acceptance:** Full user journey works without mouse; text inputs behave normally; loading/error states have a recovery path; no lost focus traps.

<a id="t039"></a>

## T039 — Full-map visual consistency and optimization

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T031, T035
- **Primary write scope:** `apps/client/src/render/`, `apps/client/public/assets/`, `assets-source/`, `assets/`
- **Work:** Apply approved slice style across the map, remove final placeholders, tune assets/lighting/culling and verify budgets.
- **Acceptance:** Low/medium remain visually coherent; manifest complete; performance comparison and representative views recorded; unavailable assets are explicit blockers.

<a id="t040"></a>

## T040 — Six-player gameplay playtest

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T033, T034, T036
- **Primary write scope:** `tests/playtest/`, `coordination/playtests/`
- **Work:** Run actual multiplayer scenarios with theft, police, sabotage, capture/escape and spectators; collect control/fairness bugs.
- **Acceptance:** At least six independent sessions complete scenarios; distinguish automated sessions from human participants; record results and taskable defects.

<a id="t041"></a>

## T041 — Server validation and abuse hardening

- **Lane:** A — Simulation / server rules
- **Dependencies:** T036, T037, T040
- **Primary write scope:** `apps/server/src/validation/`, `packages/simulation/src/validation/`
- **Work:** Close issues from tests, validate rate/payload/privilege bounds and protect session/result invariants.
- **Acceptance:** Malformed/overspeed/duplicate/unauthorized commands fail safely; no secret logging; intended reconnect and normal play still pass.

<a id="t042"></a>

## T042 — Desktop and Android acceptance checks

- **Lane:** B — Controls / client / UI
- **Dependencies:** T038, T039, T040
- **Primary write scope:** `tests/browser/acceptance/`, `docs/DEVICE_RESULTS.md`
- **Work:** Verify complete keyboard and touch journeys on named devices/browsers, including sustained gameplay and focus/rotation behavior.
- **Acceptance:** Device/browser matrix and FPS/frame-time evidence exist; unsupported or unavailable hardware is marked unverified, not passed.

<a id="t043"></a>

## T043 — Asset, accessibility and presentation audit

- **Lane:** C — 3D art / animation / performance
- **Dependencies:** T035, T038, T039
- **Primary write scope:** `docs/ART_AUDIT.md`, `assets/`
- **Work:** Audit licenses, missing assets, animation quality, text contrast, non-color cues, audio controls and low-quality consistency.
- **Acceptance:** Every shipped asset has rights/provenance; critical information survives low/muted/reduced-motion settings; issues are tracked.

<a id="t044"></a>

## T044 — Final local integration and regression gate

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T037, T038, T039, T040
- **Primary write scope:** `apps/client/src/bootstrap/`, `apps/server/src/bootstrap/`, `tests/release/`
- **Work:** Integrate final gameplay and presentation, run clean builds/full regressions, verify repeated matches and document remaining blockers.
- **Acceptance:** Capture and escape full loops work with six sessions; crime/spectating/rematch work; no unresolved release-blocking local defect.

<a id="t045"></a>

## T045 — Deployment configuration and release preparation

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T041, T042, T043, T044
- **Primary write scope:** `deployment/`, `scripts/release/`, `.env.example`, `docs/DEPLOYMENT.md`, `README.md`
- **Work:** Choose available hosting/region, prepare static client and persistent server configuration, health checks, secure URLs and rollback instructions.
- **Acceptance:** Reproducible builds/config exist; no credentials committed; costs/access requirements identified; no public-release claim.

<a id="t046"></a>

## T046 — Staging deployment and external verification

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T045
- **Primary write scope:** `deployment/`, `tests/release/`, `coordination/releases/`
- **Work:** Deploy the staging version pair when assigned and access is available; test independent devices over HTTPS/WSS and restart behavior.
- **Acceptance:** Real staging URLs and version IDs recorded; external clients finish a match; version mismatch, restart and connection failures are readable.

<a id="t047"></a>

## T047 — User playtest and release fixes

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T046
- **Primary write scope:** `coordination/playtests/`, `coordination/releases/`
- **Work:** Collect the user playtest, classify defects vs new features and coordinate scoped fixes with the owning implementation lane.
- **Acceptance:** Feedback is recorded; critical fixes are integrated/retested; new requests have task IDs. If user feedback is unavailable, this task remains pending rather than fabricated.

<a id="t048"></a>

## T048 — Public release and developer handoff

- **Lane:** D — Coordination / integration / QA
- **Dependencies:** T047
- **Primary write scope:** `docs/`, `README.md`, `coordination/releases/`
- **Work:** Publish the validated client/server pair when release is assigned, smoke test it, and finalize setup, operations, limitations and known follow-up tasks.
- **Acceptance:** Public URLs/version and rollback path are recorded; production full loop passes; documentation matches the working build; release status is truthful.

## Shared-file rule

Primary paths are proposed leases, not permission to overwrite another worker. Contract/config additions, root dependencies, bootstrap wiring and task-state edits go through the coordinator. Asset sub-manifests are merged into the main manifest by tooling/integrator. A worker needing an unlisted path records the need before editing.

## New tasks

Append T049 onward for user changes and material fixes. Keep stable IDs. Include dependency, lane, write scope, acceptance, and regression impact. Small fixes within an unfinished task may remain in that task; do not silently reopen completed behavior without a record.
