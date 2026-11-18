# Batch 3 launch and coordination

Main: /home/umar/Downloads/StopThatGuy/DevPack
Mailbox root: /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3
All implementation starts from edfdce7. Main setup docs are intentionally uncommitted;
read main instructions directly. Do not copy their older snapshots or setup edits.

## Launch

1. User pastes main coordination/prompts/T016.md into Chat D. D verifies its checkout,
   reads all four reservations, registers itself (actual ID only if available), updates
   T016 to in_progress in main and its own status, and reports coordinator ready.
2. User pastes T013, T014, T015 prompts into Chats A, B, C. Workers verify their scope
   and publish registration/status; pregranted leases need no further permission.
3. D records registrations/status in main and handles requests alongside its map task.
   No chat has been started merely by writing these prompts.

## File mailbox: one writer per file

For each task T013–T016:
- Worker owns `Txxx/status.json` and `Txxx/requests/REQ-001.json`, REQ-002.json, etc.
- D owns `Txxx/decisions/REQ-001.json`, etc. Workers never write decision files.
- Requests include id, task, checkout, exact paths, purpose, proposed contract/config
  change, and whether independent work remains. Do not include secrets or source dumps.
- Status includes task, branch, base/head, verifiable threadId/host or null, state,
  concise progress, request IDs and handoff path. Write a temporary sibling then rename
  for an atomic update. Each request ID is unique and immutable after publication;
  amend via a new request referring to the previous ID.
- D checks for conflicting live leases, records granted paths/checkout/request ID in
  main ACTIVE_WORK and board.json, then writes a decision with the same ID, status
  granted/deferred/denied, exact paths and reason. Only a matching recorded grant
  authorizes editing. Deferred/denied is not an approval.
- Before reporting a lease blocker, workers re-read main and their decisions folder.
  An existing grant is enough even if no chat message arrived. Continue independent
  work on pending requests. Never ask the user to relay an approval already on disk.
- D reads requests during task boundaries and before its final handoff, and resolves
  current requests. Worker checks decisions after each meaningful phase. No busy loops.
- If direct messaging is available, verify registry IDs and send a compact notification
  or wakeup after publishing a request/decision. Otherwise files are the fallback.
  A stopped/finished coordinator cannot react to files; the user may need to resume D
  with “Check the batch-3 mailbox and resolve pending requests.” Be honest about this.

These project leases never grant OS access. If sandbox access is missing, use the
actual permission tool for your assigned checkout and mailbox directory; D also
needs main tracking access. Do not treat a sandbox rejection as a project veto.

## Test lock

From the assigned DevPack cwd, run browser gates through:

```bash
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh npm run check
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch3/run-browser.sh env KEYBOARD_BROWSER_PORT=5414 ASSET_BROWSER_PORT=5514 npm run test:browser
```

Use YOUR ports (table in PARALLEL_WORK), not the T014 example for every task. The
wrapper uses Linux flock and fails immediately with exit 75 when another suite is
running. That is a busy resource, not a failing product test; continue non-browser
work and retry after the other suite finishes. It holds the lock for the command
lifetime and releases automatically on exit. Never wrap a command twice. Run unit
checks directly; do not acquire a lock for the whole implementation session.

## Review / integration after all tasks

Feature chats leave changes uncommitted and write scoped handoffs. D reviews leases,
acceptance and pending cross-task issues; it does not merge or declare tasks done.
Recommended later integration order: T016 world, T013 robber, T014 transport, T015 art,
with combined verification on each compatible step. Preserve first-street version,
check new-world routing with real simulation and transport after integration, and
register all new tests and asset manifests. Full game assembly remains T020.
