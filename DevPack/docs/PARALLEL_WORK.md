# Four-chat workflow — batch 4

Accepted code: `46811168fab6feab33858ff0830a8d0631273fa8`. T013–T016 integrated; current exact leases are in main
coordination/ACTIVE_WORK.md. Old worktrees and historical records are preserved.

Start Chat D/T020 first for coordination, then A/T017, B/T018 and C/T019 together.
T020 gameplay assembly is sequential: it waits for accepted T017–T019 integration
and an authorized update of its clean worktree to that main commit. Do not implement
against copies of their uncommitted files. D can inspect APIs, prepare the checklist
and review/coordinate while the other three work. No fourth independent task is claimed.

| Chat | Task | Cwd relative to repository root | Branch |
|---|---|---|---|
| A | T017 — Capture and authoritative result rules | `.worktrees/T017/DevPack` | `task/T017-capture-results` |
| B | T018 — Chase HUD and contextual cues | `.worktrees/T018/DevPack` | `task/T018-chase-hud` |
| C | T019 — Transport models and visual definitions | `.worktrees/T019/DevPack` | `task/T019-transport-art` |
| D | T020 — First playable online chase and coordination | `.worktrees/T020/DevPack` | `task/T020-online-chase` |

Repository root: /home/umar/Downloads/StopThatGuy. Use absolute assigned cwd for every
command and verify branch/status. One VS Code window does not bind chats to folders.
Task trees start at the accepted code baseline; main contains the newer setup docs.
Always read live MAIN AGENTS/DECISIONS/PARALLEL_WORK/ACTIVE_WORK/BATCH_4 and board.
Worktree coordination snapshots are historical. Do not copy tracking edits into trees.

Only D edits live main tracking. Workers own their implementation, own handoff and
mailbox request/status. Exact preleases need no duplicate permission; new shared
paths require D's recorded exclusive lease. No ownership approval copies code.
Use verified direct messaging when available; otherwise use BATCH_4 file protocol.
File updates do not wake stopped chats; resume D for later unresolved requests.

All browser/Chrome gates, including npm run check's smoke, use:
`bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh <command>`
The common OS lock lasts only for the running command. No advance priority reservations.
Busy exit 75 is a resource wait, not a product failure. Continue independent work;
never busy-poll, kill another worker's process or bypass the lock. Fixed-port camera,
lobby, network, environment and character suites must remain serialized.

| Task | Server | Vite | Keyboard browser | Asset browser |
|---|---|---|---|---|
| T017 | 2617 | 5217 | 5417 | 5517 |
| T018 | 2618 | 5218 | 5418 | 5518 |
| T019 | 2619 | 5219 | 5419 | 5519 |
| T020 | 2620 | 5220 | 5420 | 5520 |

Use strictPort and actual runner configuration; not every existing suite honors
all variables. Local server .env contains only the assigned port. Test artifacts
belong in ignored test-results. Dependencies are isolated per worktree.

Run focused tests while implementing, mandatory npm run check before handoff and
relevant browser acceptance. Register tests in ordinary commands; never label fixture
previews as live gameplay. Leave feature changes uncommitted and report in_review.
The user reviews/commits/merges or explicitly authorizes an integration operation.
Run combined checks before marking done. No reset/stash/automatic branch switching.

Next gate: T020 playable online chase. T021+ vehicle logic, prediction, riding and
mobile controls remain later tasks. Specs/board dependencies are authoritative.
