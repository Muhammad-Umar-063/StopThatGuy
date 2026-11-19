# T017–T019 accepted integration — 19 November 2026

Accepted code: `642e89ac1934bf8c35749df32c090d5be786503e` on main. The user authorized local commits and
merges; GitHub push remains the user's action. T017–T019 are done. T020 is ready
for implementation, not completed. No online chase assembly was added by this operation.

| Task | Feature commit | Main merge |
|---|---|---|
| T017 capture/results | 72e61c9 | d048ea9 |
| T018 chase HUD | a48bbcb | cdc6b61 |
| T019 transport art | bf28337 | 2eb5a3d |

All three merged without conflicts. Root preserved D's current coordination work
in 000bf76, then added capture/HUD interoperability assertions in 6b28ec6/642e89a.
Historical worker handoffs, mailbox states and the assembly checklist are superseded
by this acceptance record for integration status; their scope limits remain valid.
Old branches/worktrees remain preserved. The clean T020 branch is fast-forwarded
to accepted main including these records; dependencies/lockfile did not change.

## Verification

- `npm run check`: exit0; 439 tests passed, zero failures/skips; workspace/tools
  typechecks, production builds, authored-world and asset validation, actual server
  health and Chrome154/SwiftShader WebGL smoke passed on merged code.
- Two new root integration tests passed separately after that check, followed by
  tools typecheck: real public capture-query → serialization/decoder → HUD view
  across readiness, attempt, completion and departure. They verify mapped winner/
  result reason and immutable terminal behavior. Total 441 passing tests across
  these runs. Both additions are included by the ordinary root test glob.
- Full `npm run test:browser`: exit0 on merged code. Keyboard; lobby dev/built;
  real two-session network dev/built; HUD dev/built; assets dev/built; camera dev/built;
  environment; characters dev/built; vehicles dev/built. All Chrome runs used the
  shared batch-4 process lock. Logs: ignored `test-results/integration/batch4/`
  check.log, check.exit, focused.log, browser.log and browser.exit; category reports
  and screenshots remain in their usual ignored directories.
- Independent integration review found no blocking authority/contract/state-transition
  issues and reviewed the new interoperability tests. Ownership/whitespace audits passed.

## Remaining scope

Protocol2/config provisional-4 are integrated. The normal bootstrap still renders
the T001 smoke scene and server still uses first-street-1. HUD tests are fixture
and component acceptance; live legal-action/visibility transport and complete
online chase assembly remain T020. No playable game or release readiness is claimed.
Vehicles are art/controllers with static-fit evidence; driving/boarding/riding
logic is later work. User art approval and real-device performance remain unverified.

T017–T019 leases are closed. D resumes coordination and T020 only from its updated
checkout, requesting exact additional integration paths where needed. Routine
worker Git operations remain manual; this one local integration authorization
is not a blanket grant for future commits. No GitHub push was performed.
