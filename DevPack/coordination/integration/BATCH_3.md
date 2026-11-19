# Batch 3 accepted integration — 19 November 2026

Accepted code: `46811168fab6feab33858ff0830a8d0631273fa8` on main. User authorized local review, commits and merges;
GitHub push remains the user's action. All four tasks are done and old leases closed.
Task commits: T013 8729cca, T014 a98d547, T015 58a230a, T016 789477b.
They merged serially without Git conflicts; old worktrees/branches are preserved.

Independent compatibility review replayed all four actual city escape routes through
merged robber rules and client decoding. Root added six normal regression tests:
all four routes, continuous movement, exactly one stopped mode transition, correct
selected escape target (west passes hill safely), terminal immutability, config/world
mismatch rejection, and once-only host diagnostic draining at initialization/steps.
The deferred T013 REQ-002 host consumer is now connected; simulation stays I/O-free.

## Actual verification

- npm run check passed: 399 tests, zero failures/skips, typecheck/build, all world and
  asset manifests, real server health and headless Chrome/WebGL smoke.
- Complete npm run test:browser passed on main, exit 0: keyboard, lobby dev/built,
  real network dev/built, asset dev/built, camera dev/built, environment and character
  dev/built. Tests serialized through the shared process lock.
- git diff --check passed. Root inspected the existing character/street screenshot;
  natural-proportion meshes render with distinct identity. User art approval and
  physical device performance remain separate, unverified matters.
- Logs: ignored test-results/integration/batch3/check.log and browser.log. Browser
  reports/screenshots remain in their existing test-results category folders.

## Explicit remaining scope

Normal bootstrap remains the existing smoke app and FIRST_STREET_WORLD; city selection
and playable online scene assembly are T020. HUD legal-action/visibility sources,
capture, vehicle gameplay, prediction and later police/forfeit systems are not
claimed complete. Neutral-input route replay does not establish catchability or
balance; T017/T020 acceptance must test legal interception and capture.

Review found server departure currently changes only the published participation
state, not pure simulation eligibility. T017 has preleased the minimum server hooks
to prevent disconnected players completing capture. Reconnect remains T028.

Earlier worker handoffs and BATCH_3_INTEGRATION checklist are historical snapshots;
this accepted integration record supersedes their pending status and REQ-002 note.
