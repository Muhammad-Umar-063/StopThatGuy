# Current integration takeover — 18 November 2026

All T013–T016 workers now report in_review with final handoffs. Root is the sole
integration owner under the user's explicit review/commit/merge authorization.
Previous task leases are closed to further worker edits. The history below is
preserved; its earlier in_progress labels and browser queue are superseded.
No T017–T020 implementation is active yet. User performs the GitHub push.

# Batch 3 — current ownership

Prepared 17 November 2026. T001–T012 are done. All four new task branches start at
`edfdce7b5ca2856cc2ff01e656476f0025d4f439`. T013–T015 are **in_progress**. T016 is **in_review**, awaiting user review, manual commit and integration.
Setup documents are uncommitted in main. No preparation commit or push was made.
Read these live main records, not the historical batch-2 copies in task worktrees.
Old worktrees remain preserved. History: archive/BATCH_2_ACTIVE_WORK.md.

Chat D/T016 is the sole coordinator after launch. Main tracking is reserved for D;
all gameplay implementation happens in the assigned task worktree. Start D first.
These are already granted exclusive scopes: workers do NOT request them again.
Paths below are relative to DevPack in the named checkout. One owner per file.

## T013 — Chat A — in_progress

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T013/DevPack`
Branch: `task/T013-robber-progression`

- `packages/simulation/src/robber/`
- `packages/simulation/src/match/`
- `packages/simulation/src/state.ts`
- `packages/simulation/src/step.ts`
- `packages/simulation/src/simulation.ts`
- `packages/simulation/src/index.ts`
- `packages/simulation/test/robber.test.ts`
- `packages/simulation/test/match.test.ts`
- `packages/simulation/test/simulation.test.ts`
- `packages/shared/src/config.ts`
- `coordination/handoffs/T013.md`

## T014 — Chat B — in_progress

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T014/DevPack`
Branch: `task/T014-client-network`

- `apps/client/src/network/`
- `apps/client/package.json`
- `apps/client/vite.config.ts`
- `apps/server/src/rooms/game-room.ts`
- `apps/server/src/rooms/README.md`
- `apps/server/src/rooms/test/input.test.mjs`
- `apps/server/src/rooms/test/lifecycle.test.mjs`
- `apps/server/src/adapters/match-simulation.ts`
- `apps/server/src/validation/command-gate.ts`
- `apps/server/src/validation/player-input.ts`
- `coordination/handoffs/T014.md`

## T015 — Chat C — in_progress

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T015/DevPack`
Branch: `task/T015-characters`

- `apps/client/src/render/characters/`
- `apps/client/public/assets/characters/`
- `assets-source/characters/`
- `assets/manifest-characters.json`
- `assets/licenses/characters/`
- `assets/catalog.json`
- `scripts/assets/workflow.test.ts`
- `scripts/validate-data.ts`
- `package.json`
- `coordination/handoffs/T015.md`

## T016 — Chat D — in_review

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T016/DevPack`
Branch: `task/T016-city-graph`

- `packages/world/`
- `coordination/handoffs/T016.md`

## Lease limits and remaining reservations

- T013 owns simulation orchestration plus config.ts only for robber/match tuning.
  Reuse existing timing/transport tuning. Version any changed shared tuning; D
  reviews compatibility and records exact proposed values before new tuning is used.
  No movement rewrite or protocol/schema change is preapproved.
- T014 owns existing server input transport hooks, validation and tests so it can
  prove actual movement and acknowledgements. It does not edit pure simulation.
  Its client package.json lease is for test scripts only; vite.config.ts is for its
  isolated network acceptance entry only. Preserve existing entries and scripts.
- T015 owns root package.json for character test/browser registration only, and
  asset catalog/validation aggregation for the character manifest. Preserve all
  existing gates. No dependency change is preapproved. Character browser fixtures
  can use an owned standalone Vite config; global Vite config belongs to T014.
- T016 owns world data/tests/exports. Preserve FIRST_STREET_WORLD/version and
  existing consumers. Add a distinct versioned city and AUTHORED_WORLDS entry.
  Do not switch normal bootstrap or old environment preview silently.
- Every other shared contract, package-lock.json, dependency version, bootstrap,
  common fixture, validator and build configuration is reserved, not an implicit
  worker lease. D may grant an exact exclusive lease within assigned scope after
  checking overlap; record path, checkout, purpose and request ID here first.
  Changing a protocol needs a compatibility/migration plan and focused review.
- D alone writes main tasks/board.json, this file, CHAT_REGISTRY.md, necessary
  decisions, batch coordination records and task clarifications. Do not overwrite
  the uncommitted setup edits. No implementation in main during parallel work.

## Coordination and completion

Read docs/PARALLEL_WORK.md and coordination/BATCH_3.md from MAIN. Each worker owns
its own mailbox requests/status; D owns decisions. A recorded matching approval
is sufficient: do not wait for the same approval in a chat message or ask the user
to relay it again. Requests outside these preleases are not self-approved.

Use the shared test lock for every browser/Chrome gate, including npm run check.
No stage/commit/merge/push/rebase/reset/stash/branch switch in feature chats.
Report in_review only after tests and handoff; done requires reviewed integration.

## Launch verification — 18 November 2026

D verified main and all four assigned branches at full baseline `edfdce7b5ca2856cc2ff01e656476f0025d4f439`.
All task worktrees were clean; main setup changes were preserved. T005/T011
dependencies are integrated at the accepted baseline. D thread `01a1ea31-eab3-7e02-a75c-948fa0e4986c`
is verified from CODEX_THREAD_ID/CODEX_SESSION_ID (local Codex). Direct cross-chat
delivery is unavailable; the batch-3 file mailboxes are active. T013–T015 were
not launched at this initial inspection; their later verified registrations are
recorded above and in CHAT_REGISTRY. All pregranted scopes remain exclusive.

## Additional exclusive lease — T016 / REQ-001

- Path: `tests/city-world.test.ts`. Owner: Chat D/T016. Checkout:
  `/home/umar/Downloads/StopThatGuy/.worktrees/T016/DevPack`.
- Purpose: actual merged simulation/movement acceptance on the new city, including
  lane/turn sweeps and public API version/spawn consistency. Existing root wildcard
  runs/typechecks the test. No dependency, script, bootstrap or shared-contract edit.
- Granted after checking all preleases; no overlap. This is not code integration.

## T013 tuning review — REQ-001 — granted 18 November 2026

- Existing exclusive owner/checkout unchanged: Chat A/T013,
  `/home/umar/Downloads/StopThatGuy/.worktrees/T013/DevPack`,
  `packages/shared/src/config.ts`.
- Approve only `GameTuning.robber.transitionMs = 1000` and `CONFIG_VERSION`
  `provisional-3`. Preserve phase durations, existing movement/vehicle tuning,
  protocol and world schemas. D obtained an independent contract review.
- Fixed-step dwell; brake/stage in collision-clear space before a foot-only edge;
  stopped pose/speed during transition; validate modes/clearance and exactly-once
  completion. Existing robber transition/locomotion fields suffice. No ownership,
  remount, inventory or new wire events (T021).
- GAMEPLAY requires a transport transition. D will ensure every selectable T016
  escape includes an authored foot boundary and a geographic bottleneck. T013
  should test this with its own fixtures, not copy uncommitted city data.
- T014 must use the merged config version and test mismatch handling at later
  manual integration. This approval is not runtime/code integration.

## T013 diagnostic consumer request — REQ-002 — deferred to integration

- Exact path `apps/server/src/adapters/match-simulation.ts` remains exclusively
  owned by T014 in `/home/umar/Downloads/StopThatGuy/.worktrees/T014/DevPack`.
  No T013 lease/ownership transfer is granted.
- After reviewed manual T013 integration, T014/T020 integration must drain
  `collectRobberDiagnostics(state)` on initialization/steps and log deterministic
  missing/unreachable/blocked/no-safe-continuation records without secrets.
  Use the actual merged export; do not copy T013's uncommitted implementation.
- T013 may finish rule acceptance with tests of the drained diagnostics, while
  reporting host logging explicitly unintegrated. This is a recorded follow-up,
  not a blocker on its independently testable rules and not a false logging claim.

## Browser scheduling — T014 REQ-001 — granted

After T016's currently running standalone environment retry releases the lock,
T014 has priority for its mandatory check and real-network/browser acceptance.
T013 and T015 should defer new lock acquisitions until T014 publishes completion
or yields the slot; already running gates may finish. All commands still use
run-browser.sh; no lock bypass, process killing or script ownership change.
This is coordination priority, not an OS-enforced queue or automatic wakeup.
D will not rerun already passed browser components ahead of T014.

## T016 acceptance and next browser slots

T016 is in_review: 16 new tests, final `npm run check` 350 tests/validation/smoke,
all browser components and diff checks passed. Combined browser command exited
143 during its last environment component; standalone locked environment retry
exited 0 (six views, reload/disposal, no errors). No combined exit-0 claim.
Handoff: `.worktrees/T016/DevPack/coordination/handoffs/T016.md`.
No feature commit/integration occurred; first-street consumers are preserved.

T016's environment retry has completed and released the lock. Queue: **T014 →
T015 → T013**. T015 REQ-001 is granted the next eligible slot after T014 publishes
completion/yield; T013 follows T015. Existing running suites finish. Use the
shared wrapper and owned ports; no preemption or browser-script changes. Each
worker publishes slot completion/yield in its own status.json so the next worker
can proceed without a user relay. These notices do not automatically wake chats.

D reviewed published T013/T014 draft handoffs: both retain in_progress while
browser acceptance is pending. T015 has not yet published a handoff. All current
requests have decisions; T013 REQ-002 host logging remains a deferred integration
item, not a transferred lease. See BATCH_3_INTEGRATION.md. D is not a continuously
running mailbox monitor after its final response; resume it for later requests.
