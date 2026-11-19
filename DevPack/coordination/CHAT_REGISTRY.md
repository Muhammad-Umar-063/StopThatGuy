# Batch 4 chat registry

Setup does not launch or send work to chats. D/T020 coordinates after launch.
Register actual task, cwd, branch, HEAD and ID/host when each prompt is executed;
never treat an earlier task's chat ID as a current task assignment automatically.

| Role | Task | Chat ID / host | State |
|---|---|---|---|
| A | T017 | unregistered | ready |
| B | T018 | unregistered | ready |
| C | T019 | unregistered | ready |
| D / coordinator | T020 | unregistered | coordinator reserved; gameplay planned |

Suggested chats to reuse (titles still describe older tasks): A “Implement T006 room
lifecycle”; B “Implement third-person camera”; C “Implement T008 asset workflow”;
D “Implement accessible lobby screens”. Actual IDs must be freshly registered.
History: archive/BATCH_3_CHAT_REGISTRY.md. Use file mailboxes if chat tools/IDs are
unavailable; do not require a user ID relay just to implement preleased work.
