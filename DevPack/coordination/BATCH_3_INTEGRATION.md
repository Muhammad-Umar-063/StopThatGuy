# Closed — accepted at 4681116

All four tasks were reviewed, committed and integrated. See integration/BATCH_3.md
for final checks and remaining scope. The original checklist below is historical.

# Batch 3 integration checklist — 18 November 2026

This is a pending manual-integration checklist, not authorization to commit/merge.
Accepted baseline: `edfdce7b5ca2856cc2ff01e656476f0025d4f439`. All four feature
worktrees remain separate and uncommitted. D is the sole coordinator; direct
cross-chat delivery is unavailable, so registrations/decisions use the file mailbox.

## Current state

- T016: **in_review**, 16 new tests; final check passed 350 tests/validation/smoke.
  All browser components passed across the terminated combined run (exit 143 at
  final environment) and successful standalone environment retry (exit 0).
  No combined browser exit-0 claim. Own handoff and ignored logs are published.
- T013: active; draft handoff reviewed. Worker reports final check 354 tests;
  browser acceptance pending. Not accepted/in_review yet.
- T014: active; draft handoff reviewed. Worker reports 18 focused tests; mandatory
  check/browser acceptance pending. Next browser slot granted (REQ-001).
- T015: active; no published handoff yet. Corrected character dev/built checks
  and mandatory gates pending. Slot after T014 granted (REQ-001).
- T013 REQ-001: granted after review, `robber.transitionMs = 1000`, config version
  `provisional-3`, only in its already leased config.ts. See matching decision.
- T016 REQ-001: exact root `tests/city-world.test.ts` lease granted in T016 only.
- T013 REQ-002: host diagnostic logging recorded for manual integration; no file
  ownership transfer. No unanswered requests at this review boundary. Mailbox updates do
  not wake idle chats automatically; D checks again before its handoff.

## Serial reviewed integration

1. **T016:** review city data/tests, preserve `FIRST_STREET_WORLD`/`first-street-1`
   byte-for-byte, register `LISBON_CITY_WORLD`/`lisbon-city-1`. Root/world test globs
   already execute new tests. No package/script/lock/schema migration is needed.
2. **T013:** merge only after its own acceptance. Replay all four city escape
   routes through real robber AI with fixed seeds and legal player inputs. Every
   route includes a scooter-to-foot boundary and arcade/stair speed bottleneck.
   Test continuous collision-clear transition, alternate-route fallback and
   no-route safe timeout; verify exactly-once immutable results.
   `city-r-escape-west` passes the hill escape zone before its chosen west exit:
   only the selected `escapeTargetZoneId` may finish that match. Add this regression.
   Measure legal player interception/catchability; T016 foot-kernel path tests
   prove traversal, not final robber chase balance or capture (T017).
3. **T014:** preserve host/readiness/lifecycle and validate input authority with
   actual independent clients. Its current first-street transport acceptance must
   remain. Later explicit city selection must match on both ends; reject old
   config/world versions (including T013 provisional-3) rather than mix data.
   T014 server adapter and T013 pure simulation must be tested together after merge.
   Drain the merged `collectRobberDiagnostics(state)` at host initialization and
   after steps, logging fallback reasons once without secrets (T013 REQ-002).
   T013 tests drained records; no current host logging integration is claimed.
4. **T015:** preserve core/environment asset manifests/catalog entries and add the
   character category to both individual and combined validation. Keep all existing
   root/client/browser tests when combining its root script edits with T014 client
   scripts/Vite entry. Preserve first-street previews; the full-city art is T039.
5. Run combined `npm run check`, browser gates with the shared lock, and diff checks
   after each compatible integration step. Review actual handoffs/changed paths;
   leases do not transfer code and no uncommitted code copying is allowed.

## Scope and evidence limits

- The normal app remains the smoke bootstrap plus isolated previews. T020 owns
  assembly of the playable online chase; no T016 bootstrap/demo was added.
- Lift/patrol data and conservative clearance are verified. Boarding, ownership,
  lift driving, police pursuit and character animation are their separate tasks.
- The map is six gameplay blocks with temporary collision proxies. No claim of
  finished full-city art, real Android performance, screen-reader testing or
  multiplayer city acceptance is made by T016.
- Final map balance, spawn-row advantage and real chase playtests remain open.
  Do not mark an unmerged task done; user review, manual commit/integration and
  combined acceptance are still required.

Browser queue after T016 release: T014 → T015 → T013; workers publish completion/
yield in own status. All published requests answered at D handoff. Future requests
may require resuming D; file publication does not automatically wake idle chats.
