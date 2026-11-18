# Batch 3 chat registry

D/T016 is the active coordinator. All four tasks have published started status. The role letters are
assignments, not chat IDs. Never reuse batch-2 IDs without fresh verification.
History is preserved in archive/BATCH_2_CHAT_REGISTRY.md.

| Role | Task | Chat ID / host | State |
|---|---|---|---|
| A | T013 | `01a1e9fa-a445-7d90-8f1d-1c33e5e389e5` / local Codex (mailbox and branch verified) | in_progress |
| B | T014 | `01a1ea37-4368-7100-8cd9-6ad2f299df5d` / local Codex VS Code (mailbox and branch verified) | in_progress |
| C | T015 | `01a1e9fc-6fb5-7000-9099-74cf86ed3055` / local Codex (mailbox and branch verified) | in_progress |
| D / coordinator | T016 | `01a1ea31-eab3-7e02-a75c-948fa0e4986c` / local Codex (environment verified 2026-11-18) | in_review |

Workers put their task, actual branch/HEAD and verifiable chat ID/host (if exposed)
in their own status.json. Do not dump the process environment. If ID is unavailable,
record that explicitly and coordinate through files; no need to ask the user for
an ID just to implement a preleased task. D cross-checks task/path/branch and records
registrations here. Only verified destinations may receive direct messages.
