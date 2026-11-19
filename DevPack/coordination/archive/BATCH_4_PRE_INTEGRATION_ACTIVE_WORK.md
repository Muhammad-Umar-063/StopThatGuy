# Batch 4 — active reservations

Integration in progress: the user authorized root on 19 November 2026 to commit
and merge current changes locally. Root owns serial integration and tracking
until verification finishes; worker feature edits remain paused. User will push.
The reservations and review states below are the pre-integration record.

Verified 19 November 2026 by Chat D. T001–T016 are done. Accepted code baseline
and all four task HEADs verified clean at coordinator startup: `46811168fab6feab33858ff0830a8d0631273fa8`.
Main HEAD: `3afa9760659a5b8c75ca0511bda73053db051795` (accepted code plus setup).
D is active for coordination. T017, T018 and T019 are all in_review after verified
handoffs/gate evidence; none is integrated. Actual task identities are in CHAT_REGISTRY.
Exact pregranted scopes remain unchanged. T020 gameplay remains
planned until T017–T019 are reviewed/integrated and its checkout is updated with
the user's Git authorization. Coordination work does not mark T020 in_progress.

Chat D/T020 is the active sole coordinator: local thread
`01a1ea31-eab3-7e02-a75c-948fa0e4986c`, verified from runtime identity and the app.
All four branch names, actual base commits and disjoint claims were verified against
BATCH_4_PLAN.json. T012–T016 integration commits are ancestors of the T020 baseline.
Direct chat tools are available; worker IDs are registered only after fresh task
assignment evidence. Old titles/IDs alone do not launch or register a worker.

Main tracking is D-only; game code
belongs in each assigned worktree. These exact scopes are PREGRANTED; do not ask
for them again. Paths are relative to DevPack in the named checkout.

## T017 — Chat A — in_review

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T017/DevPack`
Branch: `task/T017-capture-results`

Awaiting user review, manual commit and integration; no integration commit.
Handoff and saved check/browser evidence verified. All exact T017 ownership below
remains reserved through review; no transfer or automatic Git action is implied.

- `packages/simulation/src/capture/`
- `packages/simulation/src/results/`
- `packages/simulation/src/state.ts`
- `packages/simulation/src/step.ts`
- `packages/simulation/src/simulation.ts`
- `packages/simulation/src/index.ts`
- `packages/simulation/src/match/progression.ts`
- `packages/simulation/test/capture.test.ts`
- `packages/simulation/test/results.test.ts`
- `packages/simulation/test/simulation.test.ts`
- `packages/shared/src/config.ts`
- `coordination/handoffs/T017.md`
- `apps/server/src/rooms/game-room.ts`
- `apps/server/src/adapters/match-simulation.ts`
- `apps/server/src/rooms/test/capture.test.mjs`

### T017 additional exact leases — REQ-001 granted 19 November 2026

Exclusive owner Chat A/T017, checkout `/home/umar/Downloads/StopThatGuy/.worktrees/T017/DevPack`:

- `packages/shared/src/events.ts`: add only `notFacing` and `ineligible` cancellation reasons.
- `packages/shared/src/versions.ts`: `PROTOCOL_VERSION` 1 → 2; world schema unchanged.

Preleased `packages/shared/src/config.ts`: `CONFIG_VERSION` provisional-4;
capture relative horizontal speed ≤3 m/s, mounted horizontal speed ≤4 m/s,
facing half-angle 60°, existing 1.5 m / 350 ms preserved. Other tuning unchanged.
Motion must include actual lane/turn displacement; yaw × longitudinal speed alone
is insufficient. Use identical eligibility for query/start/continuation/completion.
See DECISIONS and the matching mailbox decision for required compatibility,
server departure, zero-active ordering and regression conditions. This grant
changes ownership only; runtime integration remains manual and unperformed.

## T018 — Chat B — in_review

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T018/DevPack`
Branch: `task/T018-chase-hud`

Awaiting user review, manual commit and integration; no integration commit.
Handoff, saved check/full-browser reports and fixture HUD screenshots verified.
Exact ownership remains reserved through review; live cue integration is still T020.

- `apps/client/src/ui/hud/`
- `apps/client/src/network/view.ts`
- `apps/client/src/network/view.test.ts`
- `apps/client/package.json`
- `apps/client/vite.config.ts`
- `coordination/handoffs/T018.md`

## T019 — Chat C — in_review

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T019/DevPack`
Branch: `task/T019-transport-art`

Awaiting user review, manual commit and integration; no integration commit.
Final check/full-browser exit records, hashes and static-fit screenshots verified.
Exact ownership remains reserved through review; no transfer or Git action implied.

- `apps/client/src/render/vehicles/`
- `apps/client/public/assets/vehicles/`
- `assets-source/vehicles/`
- `assets/manifest-vehicles.json`
- `assets/licenses/vehicles/`
- `assets/catalog.json`
- `scripts/assets/workflow.test.ts`
- `scripts/validate-data.ts`
- `package.json`
- `coordination/handoffs/T019.md`

## T020 — Chat D — coordination active; gameplay planned

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T020/DevPack`
Branch: `task/T020-online-chase`

- `apps/client/src/bootstrap/`
- `apps/server/src/bootstrap/`
- `apps/client/src/render/city/`
- `tests/integration/chase/`
- `coordination/handoffs/T020.md`

## Scope limits

- T017 server room/adapter/capture-test lease is for authoritative capture input,
  departure cancellation and corresponding tests only. Existing diagnostic draining,
  movement input validation and room lifecycle must remain intact. No full reconnect.
  Its config lease requires D review of exact new capture tuning and version bump.
- T018 network/view.ts is only presentation composition from legitimate data, not
  fabricated legal actions or visibility. Client package/Vite leases cover HUD test
  registration/isolated preview only. Preserve existing gates and runtime versions.
- T019 root package scripts and asset catalog/validation/workflow leases cover vehicle
  registration only. Preserve character/environment/core artifacts and tests.
- T020 gameplay path leases become usable only after dependencies are integrated.
  Bootstrap and provisional city rendering do not authorize all other packages.
- Other shared interfaces, lockfile/dependency versions, bootstrap/test/build files,
  validators and another worker's paths remain reserved. D records additional exact
  exclusive leases and compatibility plans before use; no protocol changes implied.
- D alone edits live main board/claims/registry/decisions, necessary task clarifications,
  batch coordination and integration checklist. Never overwrite unrelated work.

## Coordination / test ownership

Read main docs/PARALLEL_WORK.md and coordination/BATCH_4.md. Single-writer mailboxes
are in .worktrees/coordination/batch4. Verified direct messages are optional; files
are the fallback and do not wake idle chats. A recorded approval needs no duplicate
user relay. Project scopes do not replace actual OS/network permissions.

No future browser-slot reservations. A ready worker may acquire the shared flock
when free; it releases on command exit. Busy exit 75 means continue independent
work and retry later. Do not wait for a finished chat's stale status notice.

Feature workers do not stage/commit/merge/push/rebase/reset/stash or switch branches.
Leave implementation uncommitted, report in_review after checks/handoff. Done requires
accepted integration. The user's preceding batch integration authorization is scoped
and does not grant future worker Git writes. T020 waits for an authorized branch update.

Assembly/API findings and acceptance gate: BATCH_4_INTEGRATION.md. This checklist
grants no additional implementation leases and records no gameplay acceptance.
