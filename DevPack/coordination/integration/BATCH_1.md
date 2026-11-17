# Batch 1 integration — T005–T008

Verified 17 November 2026 by Codex under the user's explicit commit/push authorization.

## Integrated work

- T005: d192e0c, merged at fb262c3 — authored world and layout validation.
- T006: 15c556e, merged at a033bc1 — room lifecycle and real-client transport.
- T007: 4af41b0, merged at 1636a4e — keyboard intents and focus handling.
- T008: db816d4, merged at 25146d3 — reproducible sample GLB and lazy asset loader.

The four original handoffs are historical implementation reports. Their pending
integration blockers are resolved by the subsequent integration-fix commit:
normal bootstrap uses FIRST_STREET_WORLD, the lockfile declares server workspace
and approved loader dependencies, keyboard/asset tests run in standard checks,
and the manifest test supports active content with a synthetic empty case.
Client test typing is separate from production typing. Shared coordination-document
merge conflicts were resolved by preserving main's newer records; incoming copies
were verified to be the identical pre-task snapshots. No feature-code conflicts.

## Verification

- Clean `npm ci`: 117 packages installed, no reported vulnerabilities.
- Final `npm run check`: exit 0; 277 tests (keyboard 43, server 15, simulation 30,
  test-support 156, world 14, cross-package 5, assets 14), typecheck/build,
  authored-world/asset validation and Chrome smoke passed.
- Server tests include the actual compiled normal bootstrap with two independent
  clients using first-street-1, then ready/start and valid simulation snapshots.
- Compiled lifecycle transport subset: 2/2, including six independent clients
  and practice/multiplayer phase/rematch behavior.
- `npm run test:browser`: exit 0; keyboard 10/10, asset dev and built gates passed.
  Actual GLB transforms, lazy loading, failure recovery and disposal verified.
  The built perspective screenshot was visually inspected.
- `git diff --check`: passed before commit.
- CI now runs both standard and browser gates; remote results are separate from
  this locally verified result.

## Remaining scope

The normal client is still the T001 smoke scene. Keyboard and asset modules are
verified independently; the playable visual street, camera and lobby are next.
World routes have no escape route yet (documented warning). Movement, robber AI,
reconnect and final art remain later tasks. Browser evidence uses headless Chrome
154 with SwiftShader and does not establish low-end hardware performance.
