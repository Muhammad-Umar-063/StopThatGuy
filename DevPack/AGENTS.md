# Agent instructions — Stop That Guy!

These rules apply to the whole repository. Apply this file to every task; reuse it if already loaded and unchanged in the current chat. In tools that do not automatically load AGENTS.md, load it explicitly. CLAUDE.md points here; do not maintain separate competing project rules.

## Read before editing

On the first task in a new chat, read this file, docs/DECISIONS.md, docs/TOKEN_EFFICIENCY.md and docs/PARALLEL_WORK.md; use README.md as a file index if needed. Then read the assigned task entry (not the whole backlog), current coordination/ACTIVE_WORK.md, and only relevant specifications/code. On subsequent tasks in the same chat, inspect changed instructions/decisions, current ownership and the new task; reuse unchanged context. Check actual repository/Git state before editing; never assume another chat's uncommitted work exists in your checkout. Expand reading when a dependency or failure requires it.

## Token efficiency

Follow docs/TOKEN_EFFICIENCY.md. Search before broad reads, inspect focused diffs, avoid repeating architecture/planning, and report results concisely. Use one implementation owner per task. Reserve independent second-model reviews for risk or integration concerns rather than automatically duplicating every task. Required tests, important context and honest evidence take priority over saving tokens. Do not generate entire replacement files or full prompts when a small patch/task reference suffices.

## Product constraints

- Full 3D Babylon.js client, TypeScript, Vite; Node.js and Colyseus server.
- Smooth, natural character proportions; recognizable Lisbon setting; no blocky final art.
- Third-person automatic camera. Arrow keys control road-relative movement and contextual turns/lane changes. Desktop gameplay and menus must work without a mouse.
- Android landscape touch support is in the baseline. Keep real device performance unverified until measured.
- A server-authoritative match with up to six players. Never fake online multiplayer with local bots or browser-only state.
- One-player practice uses the same server/simulation rules. No separate simplified game implementation.
- User revisions override defaults. Record resulting decisions and follow the change process.

## Scope and ownership

Implement assigned tasks and required fixes within their scope. Do not implement unrelated backlog items, change frameworks, or add features because they seem useful. Claim work through the coordinator before editing. Check dependencies are integrated, not merely being worked on. Use branches/worktrees when available. Do not edit another active task's files, shared interfaces, lockfiles or bootstrap wiring without a recorded ownership transfer.

One chat is the coordinator/integrator. It alone updates tasks/board.json, ACTIVE_WORK.md, the task catalog, shared dependency versions, and project-wide decisions during parallel work. Workers return change notes for these files. Shared contracts and simulation configuration changes require a coordinated migration; do not fork duplicate types.

## Codex chat coordination

Current assignment: batch 4 T017–T020; D/T020 is sole coordinator after launch.
A/T017 capture, B/T018 HUD and C/T019 vehicle art are integrated and done. D/T020
is ready for assembly from the updated checkout; see coordination/integration/BATCH_4.md.
Read canonical MAIN docs/PARALLEL_WORK.md, coordination/BATCH_4.md and ACTIVE_WORK.
Task worktree coordination copies may describe the previous batch and are historical.
Exact pregranted leases need no duplicate approval. Use verified direct task messages
and replies authorized by the launch prompt, or single-writer mailboxes when tools
are unavailable. Record approvals before use; do not invent delivery or self-approve.
Browser gates use only the live process lock, never a future priority reservation
that an idle chat must release. Files do not wake idle chats. OS/network permissions,
costs, destructive operations and product scope changes remain separate.

## Implementation rules

- Keep rendering, simulation, room transport, UI, and content separate as defined in ARCHITECTURE.md.
- Simulation rules live in packages/simulation and must not import Babylon.js, browser globals or Colyseus.
- Client visuals may predict motion, but the server decides captures, hits, theft, arrests, vehicles and rewards.
- Use one authoritative map/config version on client and server. Never use decorative mesh geometry as the only gameplay collision definition.
- Use typed intents and runtime validation at the server boundary. Reject malformed, stale, oversized and impossible actions.
- Use installed-version documentation. T001 pins compatible versions and a lockfile; do not copy old tutorial APIs blindly.
- Do not add heavy physics, a database, React, paid services or a new engine without a concrete need recorded in a task/decision.
- Prefer small modules and explicit interfaces. Avoid speculative abstractions and giant scene files.
- Use temporary shapes in blockouts, but label them temporary. A blockout is not final visual acceptance.
- No mouse-only action, inaccessible focus trap, or gameplay advantage tied to graphics quality or frame rate.
- Verify rights before adding third-party assets. Record every shipped asset and license. Do not copy ripped game assets.
- Do not put secrets or tokens in source, logs, screenshots, or handoff text.

## Verification and completion

Run checks appropriate to the changed behavior. Use meaningful rule tests, integration tests for authoritative interactions, browser checks for client flows, and actual devices for performance claims. Run the project's required checks before integration. Do not claim a test passed if it was not run. State unavailable checks and remaining limitations.

A task is done only when its acceptance checks pass, changes are integrated, and the coordinator records the evidence. Supply a short handoff using coordination/HANDOFF_TEMPLATE.md. Leave the working tree coherent; do not revert another person's changes. Never rewrite shared Git history or delete branches/work without authorization.

## Git workflow

Current user direction (17 November 2026, after worktree setup):
- Use the existing assigned task worktree and branch for implementation. The current batch has separate worktrees listed in docs/PARALLEL_WORK.md. The main checkout is for coordination and reviewed integration. This supersedes the earlier single-main rule.
- Before editing, verify `pwd`, `git rev-parse --show-toplevel`, `git branch --show-current` and `git status --short`. A multi-folder VS Code window does not bind a chat to a folder. Use the assigned absolute working directory for every command; do not switch branches, create extra worktrees, or edit another checkout.
- Do not stage, commit, amend, push, merge, rebase or tag. Leave changes uncommitted for the user to review and commit; read-only Git commands are fine. The existing task branches/worktrees were explicitly authorized by the user.
- Workers write only their claimed paths and their own coordination/handoffs/Txxx.md. Read current claims from the main checkout's coordination/ACTIVE_WORK.md and tasks/board.json; task-worktree copies are snapshots. Only the coordinator updates shared tracking in main. Report needed shared-file edits rather than copying them into every worktree.
- When checks pass, the worker reports `in_review`, "awaiting user review, manual commit and integration", with no integration_commit. The coordinator records that status in main. A task-branch commit alone is not integration: the user merges reviewed work into main, combined checks pass, then the coordinator records the actual main integration commit and marks done.
- Historical handoffs retain their original wording. Follow the current rules here and the latest workflow decision, not superseded historical entries.

Run `npm run check` from `DevPack/` before handing off; see docs/TESTING.md "Local verification workflow".

## Changes and permissions

An explicit user request to change the game authorizes recording and implementing that change within scope. Do not repeatedly ask for confirmation of already authorized work. Pause only the affected action when essential information, credentials, a purchase, destructive operation, or required access is missing; continue independent work. Do not publish from a preparation-only task. Public release is performed when its release task is assigned and required access is available.

## Prompts

The backlog contains tasks, not copy/paste prompts. Do not generate full prompts unless the user asks for them.
