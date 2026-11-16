# Active work and integration state

Updated: 16 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: local Git repository (root is the parent of this pack folder); no remote.
Integrated baseline commit: 8d4fd1a (documentation only).
Current gate: T001 toolchain setup in progress.

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| T001 | Chat D (coordinator) | task/T001-toolchain | 8d4fd1a | package.json, package-lock.json, .npmrc, .gitignore, tsconfig*, apps/*/package.json, apps/*/tsconfig*, apps/*/src/bootstrap/, apps/client/index.html, apps/client/vite.config.ts, apps/server/.env.example, README.md | in_review |

## Ready queue

- None while T001 is in progress.
- T002–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.
