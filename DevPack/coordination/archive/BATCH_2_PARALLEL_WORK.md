# Working with four Codex chats

## Current state

Batch 2 T009–T012 is integrated at c8526de; all leases released. No next batch is
started. T013–T016 dependencies are satisfied; assign new scopes before work.
The allocations and launch sequence below document the completed batch.

## Completed batch-2 allocation

The user has switched the next batch to Codex. Use one chat per task; Chat D
coordinates while implementing its own UI task in a separate worktree. The roles
are A/T009 movement, B/T010 camera, C/T011 environment, D/T012 lobby/coordinator.
Main's CHAT_REGISTRY.md identifies actual chat IDs after launch. User-authorized
messages/replies carry ownership requests and recorded decisions directly where
tools support them. Tools and file permissions must be verified in each chat;
sharing a model, window or project does not automatically share execution context.

## Start sequence

T001 → T002 → T003 → T004 are sequential foundation tasks. The coordinator can delegate ownership one at a time, but all chats must start feature work from the merged contracts/toolchain. Do not start four separate game implementations.

## Suggested parallel batches

Every row is a conservative batch. Finish integration and resolve interface/file conflicts before moving to the next row. Dependencies in board.json are the final authority. IDs are not a requirement to run unrelated ready work in numerical order.

| Batch | Lane A | Lane B | Lane C | Lane D / gate |
|---|---|---|---|---|
| 1 | T006 rooms | T007 keyboard | T008 asset pipeline | T005 street graph |
| 2 | T009 movement | T010 camera | T011 visual street | T012 lobby UI |
| 3 | T013 robber/match | T014 client state | T015 characters | T016 full map |
| 4 | T017 capture | T018 HUD | T019 vehicles art | Review/merge; no competing bootstrap edits |
| Integration gate | Review fixes | Review fixes | Review fixes | T020 first online chase |
| 5 | T021 vehicle rules | T022 prediction | T023 riding animation | T024 touch input |
| 6 | T025 sabotage | T026 vehicle UI | T027 props | T028 reconnect |
| 7 | T029 theft | T030 action feedback | T031 quality/profile | T032 interaction tests |
| 8 | T033 police | T034 spectator/results | T035 audio/effects | T036 network tests |
| 9 | T037 balance/awards | T038 final UI | T039 map art/optimization | T040 six-player playtest |
| 10 | T041 hardening | T042 device checks | T043 asset/accessibility audit | T044 integration gate |
| Release | Assigned fixes | Assigned fixes | Assigned fixes | T045 → T046 → T047 → T048 |

Fixture-driven work may happen concurrently with an implementation it will later display only if both target already-merged contracts. For example, camera T010 uses movement fixtures while T009 develops rules. It must be tested with real movement at T020. A mock implementation is never an acceptance substitute at an integration gate.

T040 tests the pre-final balance build; T044 reruns the final merged rules. T042/T043/T044 do not edit each other's production modules while testing: send fixes to the owner or arrange a temporary exclusive lease.

## Claim procedure

1. Coordinator verifies dependency status is done and records the task as ready.
2. Assign a single owner, base commit, branch/worktree and exact write paths in board.json and ACTIVE_WORK.md.
3. Worker reads the current specs and inspects the checkout before editing.
4. If more files or a new contract are required, request a scoped ownership change; coordinator decides and records it.
5. Worker completes implementation and verification, leaves all changes uncommitted, and writes only their own task handoff. Coordinator records `in_review` in main; the user reviews and commits on the task branch.
6. Reviewer checks changed behavior and evidence. The user merges reviewed task branches into main one at a time; the coordinator checks the combined result, records the actual integration commit, then marks done and releases paths. Agents do not run Git write commands.

## Isolation and merge rules

Use one existing Git branch and worktree per active task. Never have multiple chats change the same checkout at the same time. Opening all folders in one VS Code window is convenient, but does not isolate chat tools: bind each chat and terminal to its assigned absolute path and verify its branch before editing. Keep coordination edits in main serial, including when lane D also owns T012 in its task worktree.

### Current batch: T009–T012

Git root: `/home/umar/Downloads/StopThatGuy`. Application cwd is each task's
`DevPack/`. Baseline implementation ff78e06 integrates T001–T008. Worktrees start
from the subsequent committed setup; read actual HEAD at claim time.

| Task | Worktree relative to Git root | Branch | Primary scope |
|---|---|---|---|
| T009 | `.worktrees/T009` | `task/T009-road-movement` | `packages/simulation/src/movement/`, `packages/simulation/src/collision/`, `packages/simulation/test/movement.test.ts`, `packages/simulation/test/collision.test.ts` |
| T010 | `.worktrees/T010` | `task/T010-follow-camera` | `apps/client/src/camera/` |
| T011 | `.worktrees/T011` | `task/T011-street-visuals` | `apps/client/src/render/environment/`, `apps/client/public/assets/environment/`, `assets-source/environment/`, `assets/manifest-environment.json` |
| T012 | `.worktrees/T012` | `task/T012-lobby-ui` | `apps/client/src/ui/lobby/`, `apps/client/src/ui/menu/` |

This is a prepared assignment map, not an active claim. The coordinator must record an owner and exact paths before implementation starts. Each task may write its own `coordination/handoffs/Txxx.md`; include task tests inside the claimed scope or obtain a lease for a separate test path. Do not rewrite shared test fixtures, validators, exports or test configuration merely because a task needs them. Shared tuning, validators and bootstrap wiring need an exclusive lease.

Only the main checkout's `tasks/board.json` and `coordination/ACTIVE_WORK.md` are live coordination records. Workers read these records from main and report proposed changes in their own handoff; they do not edit the snapshots in their task worktrees. The same rule applies to shared instructions, decisions and backlog. An explicitly requested instruction repair may be synchronized once across checkouts; it is not permission for ongoing cross-worktree editing.

If a task needs a reserved file, the coordinator records a temporary exclusive lease, including exact paths and checkout, and makes sure no other active task edits that file. Implement the shared change once. Dependent work waits for its reviewed integration and the user's branch update; never copy uncommitted shared code between worktrees or change another task's files to make a local build pass.

Dependencies are satisfied only after integration into main and successful combined checks. The user performs commits, merges, branch updates and pushes manually. Merge completed task branches one at a time, check each combined result, and bring needed main changes into dependent branches before their next task. Do not discard local changes, rewrite history, or resolve a conflict by selecting one side wholesale. Integration conflicts remain possible even with separate folders; leases and combined tests reduce the risk.

Use distinct ports for simultaneous development servers. Machine-local port suggestions and setup evidence are in `.worktrees/SETUP.md` at the repository root. Do not stop another task's processes.

## Reserved ownership

Coordinator: root package manifests/lockfile, build config, shared contract/schema/config changes, bootstrap wiring, board and ACTIVE_WORK, decision log and backlog. Workers can propose edits; the coordinator may lease a reserved file exclusively for a task. Initial T002 owns contract creation. Later rules tasks request config additions as a coordinated change rather than hard-coding divergent constants.

World data: map task owner in T005/T016, then explicit lease for changes. Art owners edit visual assets and stable references, not hidden gameplay collision changes. Asset workers use separate manifests by category; the integrator combines them. Tests primarily belong to the task that changes behavior; broad QA suites belong to D.

## Review without merge conflicts

The reviewing assistant should return findings or use a separate review branch. Do not let a review chat silently fix files the implementing chat is still editing. Findings include location, failure scenario and expected behavior; the owner applies the fix or hands over the lease.

## Completion record

Use HANDOFF_TEMPLATE.md. Store each completed handoff under coordination/handoffs/Txxx.md. The coordinator updates shared status. Prompts are generated only when the user asks, using the current task, specs and integrated state.

## Batch 2 ports and launch

| Task | Server PORT | Vite port | KEYBOARD_BROWSER_PORT | ASSET_BROWSER_PORT |
|---|---|---|---|---|
| T009 | 2609 | 5209 | 5409 | 5509 |
| T010 | 2610 | 5210 | 5410 | 5510 |
| T011 | 2611 | 5211 | 5411 | 5511 |
| T012 | 2612 | 5212 | 5412 | 5512 |

Start T012 first using coordination/prompts/T012.md; start T009–T011 after it
registers the coordinator/reservations. Each prompt is self-contained and grants
project-scoped direct messaging. Prompts do not launch chats or implement tasks.
Use assigned Vite ports with `--strictPort`; pass the two browser port environment
variables when running `npm run test:browser`. The full check's smoke runner picks
free ports automatically. Local .env supplies server PORT in each new worktree.
