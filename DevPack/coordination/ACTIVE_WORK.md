# Active work and integration state

Updated: 17 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user reviews, commits and pushes manually. Agents run no Git write commands and leave changes uncommitted (AGENTS.md "Git workflow", 17 November 2026).
Integrated baseline commit: 46f57d4 on main (T001–T004 implementation through 24e07e2, plus completed tracking). All four prepared task worktrees start at 46f57d4.
Current gate: foundation complete (T001–T004 done). Parallel batch 1 (T005–T008) is ready; each task needs an owner claim before work starts.

This file and tasks/board.json in `/home/umar/Downloads/StopThatGuy/DevPack/` are the live coordination records. Copies in task worktrees are snapshots; workers read main and return updates in their own handoff. The prepared task-to-worktree map and write scopes are in docs/PARALLEL_WORK.md. Setup does not assign owners or start tasks.

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| None | — | — | — | — | T004 integrated at 24e07e2 (user commit); claim released |

## Ready queue

- T005 — First street and route blockout (lane D; write scope packages/world/).
- T006 — Room and session lifecycle (lane A).
- T007 — Keyboard input and action mapping (lane B).
- T008 — Asset workflow and provenance (lane C).
- All four depend only on T004 (integrated at 24e07e2). None is claimed or started; claim from base 46f57d4 and record exclusive write paths before editing.
- T009–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.

A task stays `in_review` until the user commits and merges it into main and the combined checks pass. Record the actual main integration commit, not merely the task branch commit. Agents leave all edits uncommitted.
