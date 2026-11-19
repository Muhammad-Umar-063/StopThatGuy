# Batch 4 — active reservations

Prepared 19 November 2026. T001–T016 are done. Accepted code baseline and all four
new branch HEADs: `46811168fab6feab33858ff0830a8d0631273fa8`. No next-task chat has been launched by setup.
A/T017, B/T018 and C/T019 are ready; D coordinates first. T020 gameplay remains
planned until T017–T019 are reviewed/integrated and its checkout is updated with
the user's Git authorization. Coordination work does not mark T020 in_progress.

Chat D/T020 is sole coordinator after launch. Main tracking is D-only; game code
belongs in each assigned worktree. These exact scopes are PREGRANTED; do not ask
for them again. Paths are relative to DevPack in the named checkout.

## T017 — Chat A — ready

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T017/DevPack`
Branch: `task/T017-capture-results`

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

## T018 — Chat B — ready

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T018/DevPack`
Branch: `task/T018-chase-hud`

- `apps/client/src/ui/hud/`
- `apps/client/src/network/view.ts`
- `apps/client/src/network/view.test.ts`
- `apps/client/package.json`
- `apps/client/vite.config.ts`
- `coordination/handoffs/T018.md`

## T019 — Chat C — ready

Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T019/DevPack`
Branch: `task/T019-transport-art`

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

## T020 — Chat D — planned

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
