# Active work and integration state

Updated: 17 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user pushes manually; agents do not push.
Integrated baseline commit: eb090b0 on main (T001 toolchain, T002 shared contracts).
Current gate: foundation (T001–T002 done; T003 in progress).

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| T003 | Chat D (coordinator, Lane A task) | main (no task branches, per user) | 87a3c85 | packages/simulation/; packages/shared/src/simulation.ts (+ doc comments in ids.ts, entities.ts); packages/test-support/src/fixtures/consistency.ts (lease); root package.json + lockfile; docs/CONTRACTS.md, ARCHITECTURE.md, DECISIONS.md; README.md, CHANGELOG.md | in_review |

## Ready queue

- None while T003 is in progress.
- T004–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.
