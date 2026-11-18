# Batch 3 preparation evidence — 17 November 2026

## Verified setup

- Four branches/worktrees at edfdce7; old T005–T012 branches/worktrees preserved.
- All 12 task worktrees clean; only canonical main preparation documents changed.
- Four independent npm ci --offline installs: 117 packages each, exit 0.
- npm ls --all passed in each; workspace symlinks resolve within their own worktree.
- All package-lock.json files unchanged and identical to the baseline.
- npm reported install-script allowScripts warnings for esbuild/msgpackr-extract;
  no package configuration was changed. Toolchain build/smoke below passed.
- Disjoint granted path scopes, ready dependencies, prompt paths and workspace
  folders verified; previous main coordination documents archived byte-for-byte.
- Browser wrapper syntax, contention exit 75 and lock release verified.
- Full npm run check passed in T016 after clean install: typecheck, production
  build, 334 tests (0 failures, 0 skipped), data/assets validation, real server
  health and Chrome WebGL smoke. Other identical branches need not repeat the gate.
- Full specialized browser suite was not rerun for this documentation/setup-only
  change. It passed during batch-2 integration; feature workers run relevant gates.
- git diff --check passed. No gameplay implementation, staging, commit or push.
- code --reuse-window accepted the updated StopThatGuy.code-workspace, exit 0.

Machine-local logs: .worktrees/coordination/batch3/baseline-check.log and
T013–T016-dependencies.json. The workspace, mailbox, lock and logs are locally
ignored; portable main docs/prompts remain uncommitted for the user's review.
