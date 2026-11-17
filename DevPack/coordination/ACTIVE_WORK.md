# Active work and integration state

Updated: 17 November 2026.

Coordinator: Chat D (Claude Code).
Repository / remote: Git root is the parent of this pack folder; remote `origin` on GitHub. The user reviews, commits and pushes manually. Agents run no Git write commands and leave changes uncommitted (AGENTS.md "Git workflow", 17 November 2026).
Integrated baseline commit: 50d552d on main (T001 toolchain, T002 shared contracts, T003 simulation foundation).
Current gate: foundation (T001–T003 done; T004 in review, awaiting user review and manual commit). T005–T008 start only after T004 is committed and recorded.

## Active claims

| Task | Owner/chat | Branch/worktree | Base commit | Exclusive write paths | Status |
|---|---|---|---|---|---|
| T004 | Chat D (coordinator) | main, uncommitted (user commits manually) | c8758a1 | scripts/, tests/, packages/test-support/, repo-root .github/workflows/, assets/manifest.json, root package.json + lockfile + tsconfig.tools.json + .gitignore, packages/shared/src/world.ts (issue code), AGENTS.md, docs/TESTING.md, DECISIONS.md, README.md, CHANGELOG.md | in_review: awaiting user review and manual commit |

## Ready queue

- None. T005–T008 become ready once T004 is committed by the user and recorded as integrated.
- T005–T048 — Planned; wait for recorded dependencies and ownership.

## Pending decisions/evidence

- Exact baseline laptop/Android devices are not identified.
- Hold-Up movement is a provisional default.
- Final asset sources and hosting are not selected.
- User visual feedback follows the first finished-street build.

## Handoff discipline

Only the coordinator edits this shared file during parallel work. Workers provide updates in their task handoffs. Remove a claim only after integration, cancellation or explicit ownership transfer; do not infer it from a silent chat.
