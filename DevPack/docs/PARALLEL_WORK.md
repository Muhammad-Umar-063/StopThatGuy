# Working with four Codex chats

## Current batch: T013–T016

Start Chat D/T016 first; after it reports coordinator ready, start A/T013, B/T014
and C/T015. All four can implement concurrently in separate worktrees. Main is
coordination-only. The previous batch T009–T012 is complete; its roles are historical.

| Chat | Task | Worktree | Branch |
|---|---|---|---|
| A | T013: Robber AI and match progression | `.worktrees/T013/DevPack` | `task/T013-robber-progression` |
| B | T014: Client connection and state adapter | `.worktrees/T014/DevPack` | `task/T014-client-network` |
| C | T015: Character models and movement animation | `.worktrees/T015/DevPack` | `task/T015-characters` |
| D | T016: Complete playable city graph | `.worktrees/T016/DevPack` | `task/T016-city-graph` |

All paths are relative to /home/umar/Downloads/StopThatGuy. Baseline is edfdce7.
The exact pregranted scopes are in main coordination/ACTIVE_WORK.md and board.json.
One implementation owner per file; shared package/lock/bootstrap changes require
an exact additional lease. Do not ask again for paths already assigned to you.

## Canonical instructions and isolation

Setup docs are deliberately uncommitted in main. Branches contain the accepted
code baseline, including older coordination snapshots. At startup read MAIN's
AGENTS.md, docs/DECISIONS.md, docs/TOKEN_EFFICIENCY.md, this document,
coordination/BATCH_3.md and ACTIVE_WORK.md. They supersede historical batch roles
in the worktree. Do not copy tracking or instruction edits into task branches.
Use the assigned absolute cwd for every command. A multi-folder VS Code window
does not assign a chat's working directory. Verify root, branch, HEAD and status.
Never edit another worker's checkout or run Git writes. D's main tracking role
is the sole exception to the single-checkout editing rule.

Preleased tasks work against merged contracts. T013 tests authored route behavior
with task-local fixtures; it need not wait for uncommitted T016 world data. T014
uses the current server world and simulation; it must prove actual authority and
input transport, not a mock network. T015 renders in the existing street slice.
T016 publishes new data without replacing first-street consumers. Full online
presentation assembly remains T020; capture is T017 and prediction is T022.

## Coordination without repeated user relays

Use verified direct chat messaging when available. Read the file mailbox protocol
in coordination/BATCH_3.md when messaging is unavailable. Approvals already recorded
in main apply without a duplicate chat reply. Only D edits shared live tracking.
Check coordination at startup, phase boundaries, before blocked handoff and before
finishing. No infinite polling; idle chats do not wake merely because a file changes.
Actual filesystem/network approvals are separate and cannot be bypassed by a lease.

## Checks and completion

Run focused tests during implementation; required npm run check before handoff.
All browser/Chrome gates (including check's smoke) use the common flock wrapper in
.worktrees/coordination/batch3/run-browser.sh. This serializes expensive browser
checks and fixed ports; simulation/unit tests can run concurrently. Use own server
and Vite ports, strictPort, ignored test-results paths, and stop only own processes.

Feature work stays uncommitted. Worker writes its own handoff and status; D records
in_review after acceptance evidence, never done on an unmerged branch. The user
reviews/commits/merges later or explicitly authorizes integration. Integrate one
branch at a time and run combined checks; isolation reduces conflicts, not a guarantee.
No copying uncommitted changes between worktrees or wholesale conflict resolution.

## Development ports

| Task | Server PORT | Vite | Keyboard browser | Asset browser |
|---|---|---|---|---|
| T013 | 2613 | 5213 | 5413 | 5513 |
| T014 | 2614 | 5214 | 5414 | 5514 |
| T015 | 2615 | 5215 | 5415 | 5515 |
| T016 | 2616 | 5216 | 5416 | 5516 |

Environment, camera and lobby acceptance still have fixed ports. Acquire the lock
for individual browser tests as well as full gates. Older preview servers occupying
5210–5212 need to be closed by their owner; do not kill arbitrary processes.

## Following batches (not launched)

T017 capture, T018 HUD and T019 vehicle art precede T020 first playable online chase.
Remaining dependencies and acceptance are in tasks/board.json and BACKLOG.md.
Preserve earlier setup/history and all completed worktrees. Machine-local evidence
and the VS Code workspace location are recorded in .worktrees/SETUP.md.
