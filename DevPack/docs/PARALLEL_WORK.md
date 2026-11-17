# Working with 3–4 Claude / ChatGPT chats

## Model allocation

Both assistants can implement any lane. This is a useful division of responsibilities, not a claim that one model is inherently better at a category. Keep ownership stable so each chat builds context; use the other assistant for review where risk justifies it. Follow TOKEN_EFFICIENCY.md; do not duplicate implementation or automatically run two full reviews per task.

| Chat/lane | Suggested assistant | Main responsibility |
|---|---|---|
| A | Claude | Pure gameplay simulation, robber AI, vehicles, crime, police, server validation |
| B | ChatGPT/Codex | Controls, camera, client networking/presentation, HUD and touch/keyboard UI |
| C | Either; ChatGPT is a convenient starting allocation | 3D scene, assets, animation, lighting and performance; Blender/asset tools when needed |
| D | Either; use a coding environment with repository access | Coordinator, integration, world data in early batches, tests, deployment and documentation |

For three chats: A and B remain dedicated; C handles both art and coordination/QA serially. Do not run C's art task and D's integration task as if they were two independent owners in the same chat. Expect less concurrency. For four chats, D coordinates while A/B/C implement their tasks; D can run independent tests/map work with its own write scope.

Coordination is a role, not an additional AI model. Claude/ChatGPT browser chats without repository tools cannot automatically edit files, run tests or share another chat's state. Supply the relevant committed files and transfer returned changes deliberately. Do not claim cross-chat synchronization exists merely because the conversations belong to the same user.

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

Use one existing Git branch and worktree per active task. Never have multiple chats change the same checkout at the same time. Opening all folders in one VS Code window is convenient, but does not isolate chat tools: bind each chat and terminal to its assigned absolute path and verify its branch before editing. Keep coordination edits in main serial, including when lane D also owns T005 in its task worktree.

### Current batch: T005–T008

Repository root: `/home/umar/Downloads/StopThatGuy`. Run application commands inside each worktree's `DevPack/` directory. All four task branches start at `46f57d4`, which includes the T004 implementation at `24e07e2` and its completed tracking.

| Task | Worktree relative to repository root | Required branch | Primary write paths relative to DevPack |
|---|---|---|---|
| T005 | `.worktrees/T005` | `task/T005-street-graph` | `packages/world/` |
| T006 | `.worktrees/T006` | `task/T006-room-lifecycle` | `apps/server/src/rooms/`, `apps/server/src/adapters/`, `apps/server/src/validation/` |
| T007 | `.worktrees/T007` | `task/T007-keyboard-input` | `apps/client/src/input/keyboard/` |
| T008 | `.worktrees/T008` | `task/T008-asset-pipeline` | `assets/`, `assets-source/`, `scripts/assets/`, `apps/client/src/render/assets/` |

This is a prepared assignment map, not an active claim. The coordinator must record an owner and exact paths before implementation starts. Each task may write its own `coordination/handoffs/Txxx.md`; include task tests inside the claimed scope or obtain a lease for a separate test path. Do not rewrite shared test fixtures, validators, exports or test configuration merely because a task needs them. For example, T005 validator work in `packages/test-support/` needs an exclusive lease.

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
