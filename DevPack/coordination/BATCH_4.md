# Batch 4 — T017–T019 accepted; T020 ready

Accepted code: `642e89ac1934bf8c35749df32c090d5be786503e`. T017–T019 were reviewed, committed and merged
locally under the user's explicit authorization; combined verification passed.
See integration/BATCH_4.md. Root fast-forwards clean T020 to accepted main plus
these records; D can resume implementation. T020 itself has no gameplay changes.
User pushes main. Earlier setup baselines/plans and handoff/mailbox pending states
are historical. Current exact ownership is in ACTIVE_WORK.md.

## Start order and dependencies

Start D/T020 for coordination; after coordinator ready, start A/T017, B/T018 and
C/T019 concurrently. D checks registration/requests and prepares the integration
checklist. The dependency gate is now satisfied: T017–T019 are done and T020 contains their
accepted main commit. D must not copy uncommitted code or begin fake parallel assembly.
Future Git commits/merges/branch updates require user authorization; preparation
of these trees does not grant those operations to feature chats.

## File mailbox protocol

Root: /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4
Each worker owns only Txxx/status.json and Txxx/requests/REQ-001.json (and later IDs).
D owns Txxx/decisions/REQ-001.json. Use temporary sibling + rename for atomic writes.
Request fields: id, task, checkout, exact paths, purpose, proposed contract/config
change and independent work remaining. IDs are immutable; amend with a new request.
Status fields: task, role, branch, base/head, verified threadId/host or null, state,
concise progress, pending request IDs and handoff. Never dump credentials/environment.
D checks overlap, records exact path/checkout/purpose/request in main ACTIVE_WORK and
board, THEN publishes a matching granted/deferred/denied decision. Only granted is
approval. Before reporting blocked, reread main and decisions: no duplicate user relay.
Check at startup, phase boundaries and before final handoff; no continuous polling.
Use verified direct messaging for notifications if available. Files alone cannot wake
idle chats; the user may need to resume D for genuinely new unresolved requests.

## Browser lock and ports

Every browser gate, including check's smoke, uses this wrapper from its OWN DevPack:

```bash
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh npm run check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh env KEYBOARD_BROWSER_PORT=5417 ASSET_BROWSER_PORT=5517 npm run test:browser
```

Use your ports from PARALLEL_WORK, not the T017 example universally. The wrapper
uses one common flock; exit 75 means another command is active. No future slot can
be reserved in a status file. When free, any ready worker may acquire it without D
approval. Retry after independent work; never bypass locks or kill another process.
Do not nest wrappers. Native unit checks can run concurrently. Fixed legacy preview
ports still require the same lock. D does not run a background scheduler.

## Ownership and completion

Exact preleases are in ACTIVE_WORK/board and need no reapproval. Scope limits there
cover tuning, test scripts, asset registration and T017 departure handling. Other
shared contracts/lockfiles/bootstrap/build changes require explicit exact leases.
Workers preserve existing gates and report meaningful acceptance, not fixture-only
claims. Main tracking is D-only; implementation belongs in the assigned worktree.
Required checks plus handoff yield in_review; reviewed integration yields done.
T020's final acceptance must include actual keyboard play, camera/character/HUD and
matching two-client results on the authored city; graph replay alone is insufficient.
