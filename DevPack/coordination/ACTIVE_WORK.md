# Active work and integration state

Updated: 17 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user reviews, commits and pushes manually. Agents run no Git write commands and leave changes uncommitted (AGENTS.md "Git workflow", 17 November 2026).
Integrated baseline commit: 46f57d4 on main (T001–T004 implementation through 24e07e2, plus completed tracking). All four prepared task worktrees start at 46f57d4.
Current gate: parallel batch 1. T005 in review (Chat D; awaiting user review, manual commit and integration); T006 in progress (Chat A); T008 in progress (Chat C); T007 reserved for Chat B and not yet started. Coordination edits in main remain serial.

This file and tasks/board.json in `/home/umar/Downloads/StopThatGuy/DevPack/` are the live coordination records. Copies in task worktrees are snapshots; workers read main and return updates in their own handoff. The prepared task-to-worktree map and write scopes are in docs/PARALLEL_WORK.md. Setup does not assign owners or start tasks.

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| T005 | Chat D (coordinator; T005 implementer) | task/T005-street-graph, `.worktrees/T005` | 46f57d4 | packages/world/; leases: packages/test-support/src/validation/world.ts, packages/test-support/src/fixtures/invalid-worlds.ts, scripts/validate-data.ts, tests/street-world.test.ts, package.json (root build order only), package-lock.json (packages/world workspace entry only); coordination/handoffs/T005.md | in_review: awaiting user review, manual commit and integration |
| T006 | Chat A | task/T006-room-lifecycle, `.worktrees/T006` | 46f57d4 | apps/server/src/rooms/, apps/server/src/adapters/, apps/server/src/validation/; leases (17 Nov): apps/server/src/bootstrap/main.ts, apps/server/package.json, apps/server/tsconfig.build.json (exclude tests from the build only); queued: package-lock.json after T005 integration; coordination/handoffs/T006.md | in_progress (lockfile and runtime world wiring wait for T005 integration) |
| T007 | Chat B (reserved) | task/T007-keyboard-input, `.worktrees/T007` | 46f57d4 | apps/client/src/input/keyboard/; coordination/handoffs/T007.md | reserved, not started |
| T008 | Chat C | task/T008-asset-pipeline, `.worktrees/T008` | 46f57d4 | assets/, assets-source/, scripts/assets/, apps/client/src/render/assets/, apps/client/public/assets/; coordination/handoffs/T008.md | in_progress (approved loaders dependency arrives from main after T005 integration) |

## Ready queue

- T006, T007 and T008 are ready and reserved for Chats A, B and C (see claims above). Each worker verifies its worktree, branch and these paths before editing; reservation is not a start.
- Tests belong inside each task's claimed paths unless separately leased. Coordinator-controlled and not leased: packages/shared/, other packages/test-support/ files, packages/simulation/, apps/*/package.json, tsconfig*, apps/*/src/bootstrap/, .github/, docs and instructions. Root package.json and package-lock.json are leased to T005 for the listed narrow changes; other tasks request lockfile/manifest changes through the user, and the coordinator assigns one exclusive owner and checkout.
- T009–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Approved dependency (coordinator, 17 Nov, for T008): `@babylonjs/loaders@9.37.0` plus its required peer `babylonjs-gltf2interface@9.37.0`, both Apache-2.0 and exact-pinned in `apps/client/package.json`. A trial in a scratch copy showed the import `@babylonjs/loaders/glTF/2.0/index.js` typechecks and builds. Imported statically from bootstrap it adds about +547 kB (+124 kB gzip) to the main chunk, plus lazy PBR chunks, so it must be loaded on demand from T008's module, not eagerly; T031 owns budgets. Single owner and checkout: Chat D in main, after T005 is integrated (main edits beyond coordination records need the user's go-ahead at that point). The user commits, then updates task branches from main. T008 does not edit either file. Interim: in its own worktree only, T008 may run `npm install --no-save @babylonjs/loaders@9.37.0 -w @stopthatguy/client`, which was verified to leave package.json and the lockfile unchanged; a later `npm ci` removes it. T008 cannot be in_review until the tracked dependency is on its branch and `npm ci` plus `npm run check` pass.
- Lease queue for `package-lock.json`: T005 (current) → Chat D in main (T008's approved dependency) → T006 (apps/server workspace metadata). T006's turn starts after that main update is committed and its branch is updated. After the user updates `task/T006-room-lifecycle` from main, T006 runs `npm install` once to record only the `apps/server` workspace metadata. Until then T006 must not run `npm install` or `npm ci` (its package.json will not match the lockfile), and its clean-install verification is pending.
- Runtime world source (coordinator decision, 17 Nov): the server runs `FIRST_STREET_WORLD` (`first-street-1`) from `@stopthatguy/world`, the T005 package. It becomes usable in T006 only after T005 is integrated and T006's branch includes it; never copy T005's uncommitted files. Until then rooms take the world as an injected option, and only tests use `FIXTURE_WORLD`. Server bootstrap and production code must not import `@stopthatguy/test-support`.

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.

A task stays `in_review` until the user commits and merges it into main and the combined checks pass. Record the actual main integration commit, not merely the task branch commit. Agents leave all edits uncommitted.
