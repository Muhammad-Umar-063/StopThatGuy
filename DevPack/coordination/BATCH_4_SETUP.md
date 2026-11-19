# Batch 4 setup verified — 19 November 2026

Accepted integrated code baseline: `46811168fab6feab33858ff0830a8d0631273fa8`. All four new branches start there.
Current canonical setup documents are committed subsequently on main; read main
instructions directly. No T017–T020 implementation/chat has been started by setup.

## Worktrees and readiness

| Chat | Task | Branch | State |
|---|---|---|---|
| A | T017 capture/results | task/T017-capture-results | ready |
| B | T018 HUD | task/T018-chase-hud | ready |
| C | T019 transport art | task/T019-transport-art | ready |
| D | T020 online chase | task/T020-online-chase | coordinate now; assembly waits for T017–T019 integration |

Application directories: /home/umar/Downloads/StopThatGuy/.worktrees/T017/DevPack
through T020/DevPack. VS Code contains main + those four task roots in
/home/umar/Downloads/StopThatGuy/StopThatGuy.code-workspace. The code CLI opened it
with --reuse-window successfully. Old worktrees/branches and setup records remain.

## Checks actually run

- Four npm ci --offline installs: 117 packages each, exit 0. No dependency versions
  or lockfiles changed. npm ls --all passed in each worktree.
- Every node_modules is separate; local workspace symlinks point into its own tree.
  esbuild 0.28.2 executes in each. npm's existing esbuild/msgpackr-extract allowScripts
  warnings remain; no allowlist/configuration was changed.
- Branch names/HEADs, clean task trees, accepted ancestors, dependency statuses,
  disjoint path leases, workspace JSON and all folder paths verified.
- All sixteen T005–T020 task worktrees clean. Completed T013–T016 commits are
  ancestors of main. T020 correctly remains planned with unmet T017–T019 dependencies.
- Common browser-lock wrapper syntax, immediate busy exit 75 and release tested.
  No status-file reservation can block a free lock in this batch.
- Accepted merged code passed 399 tests with zero failures/skips, complete check
  and the complete browser suite on main. See integration/BATCH_3.md for evidence.
  Identical code was not expensively retested in all four new trees.
- No push performed. User pushes main. No next feature was implemented.

Machine-local install inventories are under .worktrees/coordination/batch4/.
Browser/check artifacts are ignored in DevPack/test-results/integration/batch3/.
Prompts: main coordination/prompts/T017.md through T020.md. Start D first, then A/B/C.
Use only the short launcher OR the full prompt; it is not a two-message procedure.
