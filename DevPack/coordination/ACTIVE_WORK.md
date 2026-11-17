# Active work and integration state

Updated: 17 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user reviews, commits and pushes manually. Agents run no Git write commands and leave changes uncommitted (AGENTS.md "Git workflow", 17 November 2026).
Integrated baseline commit: 24e07e2 on main (T001–T004: toolchain, shared contracts, simulation foundation, verification tooling).
Current gate: foundation complete (T001–T004 done). Parallel batch 1 (T005–T008) is ready; each task needs an owner claim before work starts.

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| None | — | — | — | — | T004 integrated at 24e07e2 (user commit); claim released |

## Ready queue

- T005 — First street and route blockout (lane D; write scope packages/world/).
- T006 — Room and session lifecycle (lane A).
- T007 — Keyboard input and action mapping (lane B).
- T008 — Asset workflow and provenance (lane C).
- All four depend only on T004 (integrated at 24e07e2). None is claimed or started; claim from base 24e07e2 and record exclusive write paths before editing.
- T009–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.
