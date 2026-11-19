# Batch 4 — T017–T019 accepted; T020 ready

Accepted code: `642e89ac1934bf8c35749df32c090d5be786503e`. Root completed the user's authorized local
integration on 19 November 2026; the user pushes main. See integration/BATCH_4.md.
T017 capture/results, T018 HUD and T019 transport art are done; all their leases
are released. Historical scopes are in archive/BATCH_4_PRE_INTEGRATION_ACTIVE_WORK.md.
Their worker handoffs/mailboxes are pre-integration snapshots, not current blockers.

## T020 — Chat D — ready, gameplay not started

Coordinator/implementer: local chat `01a1ea31-eab3-7e02-a75c-948fa0e4986c`.
Checkout: `/home/umar/Downloads/StopThatGuy/.worktrees/T020/DevPack`.
Branch: `task/T020-online-chase`, fast-forwarded to accepted main with these records.
Read current MAIN AGENTS/DECISIONS/PARALLEL_WORK/BATCH_4/board on resume. Build before
using production outputs in the updated checkout. No dependency version changed.

Pregranted implementation paths, relative to DevPack in T020 only:

- `apps/client/src/bootstrap/`
- `apps/server/src/bootstrap/`
- `apps/client/src/render/city/`
- `tests/integration/chase/`
- `coordination/handoffs/T020.md`

D owns canonical main coordination/board/decisions. Record exact additional leases
before editing other integration paths, including network/shared contracts and
build/test wiring. Released prior leases do not automatically grant all paths.
Assembly/API notes and pending gates: BATCH_4_INTEGRATION.md. Live legal-action and
visibility sources must be genuine; no fabricated authoritative capture cues.
Capture attempt progress is not the same as canCapture start readiness.

## Coordination and tests

Use verified direct messages or batch-4 single-writer mailboxes. No duplicate approval
relay for recorded grants. Files do not wake idle chats. Actual OS/network access
remains separate. Every Chrome gate (including check smoke) uses:
`bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh <command>`.
Only running processes hold the lock; no advance reservation or polling loop.

Future feature work stays uncommitted unless the user authorizes otherwise. T020
must pass its full actual online chase acceptance before being marked done. No
further task has started, and no local integration result means the MVP is finished.
