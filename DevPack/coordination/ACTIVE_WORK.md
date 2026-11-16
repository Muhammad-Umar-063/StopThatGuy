# Active work and integration state

Updated: 16 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user pushes manually; agents do not push.
Integrated baseline commit: 9a6dd22 on main (T001 toolchain).
Current gate: foundation (T001 done; T002 in progress).

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| T002 | Chat D (coordinator) | main (no task branches, per user) | 70d675c | packages/shared/; packages/test-support/{package.json,tsconfig.json,src/index.ts,src/fixtures/,test/} (leased from T004 scope); root package.json + lockfile; apps/*/package.json, apps/*/tsconfig*, apps/client/vite.config.ts, apps/*/src/bootstrap/main.ts (shared wiring only); docs/CONTRACTS.md, DECISIONS.md, README.md, CHANGELOG.md | in_review |

## Ready queue

- None while T002 is in progress.
- T003–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.
