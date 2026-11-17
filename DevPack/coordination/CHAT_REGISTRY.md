# Batch 2 chat registry

Main checkout only; coordinator writes this file. No chats are launched by setup.
The user will open/reuse four Codex chats and paste their task prompts. Each prompt
authorizes project-scoped direct messages and replies. Verify the actual task
assignment, host and chat ID with available tools before recording an entry.
Chat D/T012 is the coordinator; old T005/Claude ownership is historical.

| Role | Task | Actual chat title | Chat ID | Host | Registration |
|---|---|---|---|---|---|
| A | T009 | pending | pending | pending | not launched |
| B | T010 | pending | pending | pending | not launched |
| C | T011 | pending | pending | pending | not launched |
| D / coordinator | T012 | pending | pending | pending | not launched |

A pending entry is not a messaging destination. If discovery cannot identify a
chat, request its exact title/ID from the user once; never send to unrelated chats.
Current session diagnostics: chat listing and send-message tools are exposed, but
reading/waiting on the two prior Codex chats returned `thread/items/list is not
supported yet`. New chats must verify their own tool capabilities. Do not require
read/wait success to send an already-authorized request to a verified destination;
if delivery is unavailable, report the limitation and continue independent work.
