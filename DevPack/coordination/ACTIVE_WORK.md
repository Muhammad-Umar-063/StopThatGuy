# Active work and integration state

Updated: 17 November 2026.

Coordinator: Codex integration/setup chat until launch handoff to Chat D (T012).
The user reports all previous chats finished and is closing Claude. Do not resume
T005–T008 implementation or create a competing coordinator.

Verified implementation baseline: `ff78e06` on main. T001–T008 are integrated;
batch 1 acceptance and resolved blockers: coordination/integration/BATCH_1.md.
The user authorized local commits/integration/setup for this operation, then chose
to push to GitHub personally. Future feature chats leave edits uncommitted.

## Batch 2 reservations

These are prepared assignments, not running implementations. Worktrees are created
from the committed batch-2 setup on top of ff78e06. Chat D records each actual
HEAD as base_commit and the chat ID at launch before changing status to in_progress.
Start Chat D/T012 first so it can register the coordinator and worker assignments.

| Task | Owner | Branch / worktree | Exclusive paths relative to DevPack | Status |
|---|---|---|---|---|
| T009 | Chat A (Codex) | `task/T009-road-movement` / `.worktrees/T009` | `packages/simulation/src/movement/`; `packages/simulation/src/collision/`; `packages/simulation/test/movement.test.ts`; `packages/simulation/test/collision.test.ts`; `coordination/handoffs/T009.md` | ready; reserved |
| T010 | Chat B (Codex) | `task/T010-follow-camera` / `.worktrees/T010` | `apps/client/src/camera/`; `coordination/handoffs/T010.md` | ready; reserved |
| T011 | Chat C (Codex) | `task/T011-street-visuals` / `.worktrees/T011` | `apps/client/src/render/environment/`; `apps/client/public/assets/environment/`; `assets-source/environment/`; `assets/manifest-environment.json`; `coordination/handoffs/T011.md` | ready; reserved |
| T012 | Chat D (Codex) | `task/T012-lobby-ui` / `.worktrees/T012` | `apps/client/src/ui/lobby/`; `apps/client/src/ui/menu/`; `coordination/handoffs/T012.md` | ready; reserved |

## Coordination authority

Only `/home/umar/Downloads/StopThatGuy/DevPack/coordination/ACTIVE_WORK.md` and
`tasks/board.json` in main are live. Task-worktree copies are snapshots. Main's
CHAT_REGISTRY.md records verified chat IDs; placeholders are not destinations.
Workers message Chat D directly when tools are available and authorized by their
launch prompts. Chat D records decisions before replying. No worker edits main.

All T005–T008 leases are released following verified integration. Shared contracts,
tuning, simulation wiring outside T009's listed paths, package manifests/lockfile,
compiler/build/CI settings, client bootstrap and shared asset catalog/manifest are
reserved for the coordinator. Grant one exact-file lease in one checkout at a time.
Never add independent copies of shared types or overwrite another task's data.
T011 owns a separate environment manifest; aggregation into the central catalog
and validator is coordinated. Additional preview/test paths must also be leased.
The T012 chat performs its UI implementation only in T012; its coordination edits
in main are a separate, explicit role. No other chat may edit T012 UI concurrently.

## Dependency and completion gates

T009/T010 depend on integrated T005/T007; T011 on T005/T008; T012 on T006/T007.
All four are ready. Camera, visual street and lobby work use committed contracts
and labeled fixtures where later movement/network integration is still pending.
No task may rely on another task's uncommitted implementation. Record shared-change
prerequisites and request manual commits/branch updates when needed; do not copy
uncommitted code across worktrees. Parallel folders cannot guarantee conflict-free
merges, so integrate sequentially and run combined checks.

After acceptance passes, workers write their own handoff and Chat D records
in_review. The user handles commits and merges unless explicitly authorizing the
coordinator. Done requires actual integration into main plus combined verification.
T013 onward remains planned until its dependencies and ownership are recorded.

## Local run isolation

See docs/PARALLEL_WORK.md for per-task server, client and browser-test ports.
Use each worktree's independent node_modules and local .env. Stop only processes
you start. Prior task worktrees are preserved for reference, outside active VS Code
folders; do not edit them.

## Remaining product evidence

Baseline laptop/Android hardware, final art acceptance, hosting and final asset
sources are still unconfirmed. Hold-Up remains provisional. The client is still a
smoke scene; batch 2 creates the next pieces, not a finished online chase.
